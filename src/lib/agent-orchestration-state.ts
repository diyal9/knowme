'use strict'

const crypto = require('crypto')
const { createEvictingMap } = require('./runtime-store')
const {
  CANCEL_BUDGET_MS,
  HANDOFF_MAX_BYTES,
  validateHandoffPayload,
  isFakeSpawnResult,
  isTerminalStatus,
} = require('./agent-run-launcher')

const MAX_SUB_RUNS = 2
const MAX_PARALLEL = 1
const MAX_DEPTH = 1

const ORCHESTRATION_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'delegate_to_expert',
      description: 'Delegate a sub-task to another expert with isolated context. Max depth 1.',
      parameters: {
        type: 'object',
        properties: {
          expertId: { type: 'string' },
          prompt: { type: 'string' },
          handoff: { type: 'object' },
        },
        required: ['expertId', 'prompt'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_sub_run',
      description: 'Spawn a child agent run with budget limits.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          expertId: { type: 'string' },
          handoff: { type: 'object' },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handoff_artifact',
      description: 'Pass artifact references to daemon or parent run.',
      parameters: {
        type: 'object',
        properties: {
          artifactIds: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['artifactIds'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'await_sub_run',
      description: 'Wait for a child run to reach terminal status.',
      parameters: {
        type: 'object',
        properties: {
          subRunId: { type: 'string' },
          timeoutMs: { type: 'number' },
        },
        required: ['subRunId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sub_run_status',
      description: 'Query child run status, phase, and duration.',
      parameters: {
        type: 'object',
        properties: {
          subRunId: { type: 'string' },
        },
        required: ['subRunId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_sub_run',
      description: 'Cancel a running child run.',
      parameters: {
        type: 'object',
        properties: {
          subRunId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['subRunId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_run_message',
      description: 'Send a versioned bus message to a child or parent run.',
      parameters: {
        type: 'object',
        properties: {
          targetRunId: { type: 'string' },
          kind: { type: 'string' },
          payload: { type: 'object' },
          protocolVersion: { type: 'number' },
        },
        required: ['targetRunId', 'kind', 'payload'],
        additionalProperties: false,
      },
    },
  },
]

function createSubRunId() {
  return `subrun_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

function normalizeSpawnResult(result, subId) {
  if (!result) return { ok: false, code: 'launch_failed', text: 'spawn 无返回' }
  if (isFakeSpawnResult(result)) {
    return {
      ok: false,
      code: 'fake_spawn_rejected',
      text: '拒绝登记式假成功：子 Run 未真实启动 Executor',
    }
  }
  const status = result.status || (result.ok !== false ? 'completed' : 'failed')
  return { ...result, status, meta: { ...(result.meta || {}), subRunId: subId } }
}

class OrchestrationState {
  constructor(runId) {
    this.runId = runId
    this.subRuns = []
    this.activeParallel = 0
    this.depth = 0
    this.handoffs = []
    this.messages = []
  }

  canSpawn() {
    if (this.subRuns.length >= MAX_SUB_RUNS) return { ok: false, code: 'orchestration_depth_exceeded', message: '子 Run 预算已用尽' }
    if (this.activeParallel >= MAX_PARALLEL) return { ok: false, code: 'parallel_cap_exceeded', message: '并行子 Run 已达上限' }
    if (this.depth >= MAX_DEPTH) return { ok: false, code: 'orchestration_depth_exceeded', message: '编排深度超限' }
    return { ok: true }
  }

  registerSubRun(entry) {
    this.subRuns.push(entry)
    this.activeParallel += 1
    return entry
  }

  completeSubRun(subRunId, result = {}) {
    const idx = this.subRuns.findIndex((s) => s.id === subRunId)
    if (idx >= 0) {
      const terminal = isTerminalStatus(result.status)
      this.subRuns[idx] = { ...this.subRuns[idx], ...result, status: result.status || 'completed' }
      if (terminal || result.status === 'failed' || result.status === 'cancelled') {
        this.activeParallel = Math.max(0, this.activeParallel - 1)
      }
    }
  }

  findSubRun(subRunId) {
    return this.subRuns.find((s) => s.id === subRunId) || null
  }

  cancelAll(opts = {}) {
    const cancelled = []
    const startedAt = Date.now()
    for (const sub of this.subRuns) {
      if (sub.status === 'running' && typeof opts.cancelSubRun === 'function') {
        opts.cancelSubRun(sub.id)
        sub.status = 'cancelled'
        sub.cancelledAt = Date.now()
        cancelled.push(sub.id)
      }
    }
    this.activeParallel = 0
    return { cancelled, elapsedMs: Date.now() - startedAt, withinBudget: Date.now() - startedAt <= CANCEL_BUDGET_MS }
  }

  runningLeakCount() {
    return this.subRuns.filter((s) => s.status === 'running').length
  }
}

const runStateStore = createEvictingMap({ maxEntries: 100, ttlMs: 60 * 60 * 1000 })

function getOrchestrationState(runId) {
  const id = String(runId || 'default')
  let state = runStateStore.map.get(id)
  if (state && typeof state.cancelAll === 'function') return state
  state = new OrchestrationState(id)
  runStateStore.map.set(id, state)
  return state
}

function cancelAllSubRuns(parentRunId, opts = {}) {
  const state = getOrchestrationState(parentRunId)
  const result = state.cancelAll(opts)
  if (typeof opts.runManager?.cancelAllChildren === 'function') {
    return Promise.resolve(
      opts.runManager.cancelAllChildren(parentRunId, opts.reason || 'parent_cancel'),
    ).then((runtimeResult = {}) => ({
      ...result,
      runtimeCancelled: runtimeResult.cancelled || [],
      elapsedMs: Math.max(result.elapsedMs || 0, runtimeResult.elapsedMs || 0),
      withinBudget: result.withinBudget !== false && runtimeResult.withinBudget !== false,
    })).catch(() => result)
  }
  if (state.runningLeakCount() > 0 && typeof opts.onLeak === 'function') {
    opts.onLeak(state.runningLeakCount())
  }
  return result
}

function parseOrchestrationFrontmatter(frontmatter = {}) {
  const out = {
    maxSubRuns: MAX_SUB_RUNS,
    maxParallel: MAX_PARALLEL,
    allowedExperts: [],
    orchestrationEnabled: false,
  }
  if (frontmatter.orchestration) {
    out.orchestrationEnabled = true
    if (Number.isFinite(Number(frontmatter.orchestration.maxSubRuns))) {
      out.maxSubRuns = Math.min(MAX_SUB_RUNS, Number(frontmatter.orchestration.maxSubRuns))
    }
    if (Number.isFinite(Number(frontmatter.orchestration.maxParallel))) {
      out.maxParallel = Math.min(MAX_PARALLEL, Number(frontmatter.orchestration.maxParallel))
    }
    if (Array.isArray(frontmatter.orchestration.allowedExperts)) {
      out.allowedExperts = frontmatter.orchestration.allowedExperts.map(String)
    }
  }
  if (frontmatter.orchestrationEnabled === true || frontmatter.orchestrationEnabled === 'true') {
    out.orchestrationEnabled = true
  }
  return out
}

function validateOrchestrationPolicy(expertPackage = {}, opts = {}) {
  const policy = parseOrchestrationFrontmatter(expertPackage.orchestration || expertPackage)
  if (!policy.orchestrationEnabled) return { ok: true, policy }
  if (opts.expertId && policy.allowedExperts.length && !policy.allowedExperts.includes(opts.expertId)) {
    return { ok: false, code: 'scope_denied', message: '专家不在 orchestration allowlist' }
  }
  return { ok: true, policy }
}

module.exports = {
  createSubRunId,
  normalizeSpawnResult,
  OrchestrationState,
  getOrchestrationState,
  cancelAllSubRuns,
  parseOrchestrationFrontmatter,
  validateOrchestrationPolicy,
}
