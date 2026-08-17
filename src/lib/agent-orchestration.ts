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

function buildOrchestrationTools(opts = {}) {
  const runId = opts.runId || 'default'
  const state = getOrchestrationState(runId)
  const spawnSubRun = typeof opts.spawnSubRun === 'function' ? opts.spawnSubRun : null
  const syncHandoff = typeof opts.syncHandoff === 'function' ? opts.syncHandoff : null
  const runManager = opts.runManager || null
  const parentSignal = opts.parentSignal || opts.signal || null

  const launchChild = async ({ subId, expertId, prompt, handoff, backend }) => {
    const handoffCheck = validateHandoffPayload(handoff)
    if (!handoffCheck.ok) return handoffCheck

    if (runManager && typeof runManager.createAndLaunchChild === 'function') {
      return runManager.createAndLaunchChild({
        runId: subId,
        subRunId: subId,
        parentRunId: runId,
        expertId,
        prompt,
        handoff,
        backend,
        parentSignal,
      })
    }

    if (!spawnSubRun) {
      return { ok: false, code: 'tool_unavailable', text: '子 Run 执行器未配置' }
    }

    const result = await spawnSubRun({ subRunId: subId, expertId, prompt, handoff })
    return normalizeSpawnResult(result, subId)
  }

  const queryStatus = (subRunId) => {
    if (runManager && typeof runManager.getRunStatus === 'function') {
      return runManager.getRunStatus(subRunId)
    }
    const local = state.findSubRun(subRunId)
    if (!local) return { ok: false, code: 'not_found', text: '子 Run 不存在' }
    const durationMs = Date.now() - (local.startedAt || Date.now())
    return {
      ok: true,
      runId: subRunId,
      status: local.status,
      phase: local.phase || local.status,
      durationMs,
      expertId: local.expertId,
      summary: local.result?.text || local.text || '',
    }
  }

  const handlers = {
    delegate_to_expert: async (args = {}) => {
      const expertId = String(args.expertId || '').trim()
      const prompt = String(args.prompt || '').trim()
      if (!expertId || !prompt) return { ok: false, code: 'invalid_args', text: '需要 expertId 和 prompt' }

      const handoffCheck = validateHandoffPayload(args.handoff)
      if (!handoffCheck.ok) return handoffCheck

      const gate = state.canSpawn()
      if (!gate.ok) return { ok: false, code: gate.code, text: gate.message }

      const subId = createSubRunId()
      state.registerSubRun({ id: subId, expertId, status: 'running', startedAt: Date.now(), handoff: args.handoff })

      try {
        const result = await launchChild({
          subId,
          expertId,
          prompt,
          handoff: args.handoff,
          backend: args.backend,
        })

        const normalized = normalizeSpawnResult(result, subId)
        if (!normalized.ok) {
          state.completeSubRun(subId, { status: 'failed', result: normalized })
          return normalized
        }

        const childStatus = normalized.status || (normalized.launched ? 'running' : 'completed')
        state.completeSubRun(subId, {
          status: childStatus,
          result: normalized,
          text: normalized.text,
          phase: normalized.phase,
        })

        if (childStatus === 'running') {
          return {
            ok: true,
            text: normalized.text || `子 Run ${subId} 已启动（专家 ${expertId}）`,
            meta: { subRunId: subId, expertId, status: 'running', launched: true },
          }
        }

        return {
          ok: normalized.ok !== false,
          text: normalized.text || `专家 ${expertId} 子任务完成`,
          meta: { subRunId: subId, expertId, status: childStatus },
        }
      } catch (err) {
        state.completeSubRun(subId, { status: 'failed' })
        return { ok: false, code: 'tool_failed', text: String(err?.message || err).slice(0, 500) }
      }
    },

    spawn_sub_run: async (args = {}) => {
      const prompt = String(args.prompt || '').trim()
      if (!prompt) return { ok: false, code: 'invalid_args', text: '需要 prompt' }
      return handlers.delegate_to_expert({
        expertId: args.expertId || 'general',
        prompt,
        handoff: args.handoff,
        backend: args.backend,
      })
    },

    handoff_artifact: async (args = {}) => {
      const ids = Array.isArray(args.artifactIds) ? args.artifactIds.map(String) : []
      if (!ids.length) return { ok: false, code: 'invalid_args', text: '需要 artifactIds' }

      const payload = {
        runId,
        artifactIds: ids,
        summary: String(args.summary || '').slice(0, 2000),
        at: new Date().toISOString(),
      }

      const handoffCheck = validateHandoffPayload(payload)
      if (!handoffCheck.ok) return handoffCheck

      state.handoffs.push(payload)

      if (runManager && typeof runManager.sendMessage === 'function') {
        runManager.sendMessage({
          sourceRunId: runId,
          targetRunId: args.targetRunId || runId,
          kind: 'handoff',
          payload,
        })
      }

      if (syncHandoff) await syncHandoff(payload)
      return { ok: true, text: `已 handoff ${ids.length} 个 artifact`, meta: payload }
    },

    await_sub_run: async (args = {}) => {
      const subRunId = String(args.subRunId || '').trim()
      if (!subRunId) return { ok: false, code: 'invalid_args', text: '需要 subRunId' }
      const timeoutMs = Number.isFinite(Number(args.timeoutMs)) ? Number(args.timeoutMs) : 60000

      if (runManager && typeof runManager.awaitRun === 'function') {
        const awaited = await runManager.awaitRun(subRunId, timeoutMs)
        if (awaited.ok) {
          state.completeSubRun(subRunId, {
            status: awaited.status || 'completed',
            result: awaited,
            text: awaited.summary || awaited.text,
            phase: awaited.phase,
          })
          return {
            ok: true,
            text: awaited.summary || awaited.text || `子 Run ${subRunId} 已完成`,
            meta: {
              subRunId,
              terminal: awaited.terminal || awaited.status,
              durationMs: awaited.durationMs,
              builderId: awaited.builderId,
            },
          }
        }
        return {
          ok: false,
          code: awaited.code || 'subrun_timeout',
          text: awaited.text || `子 Run ${subRunId} 等待超时`,
          meta: { subRunId },
        }
      }

      const local = state.findSubRun(subRunId)
      if (!local) return { ok: false, code: 'not_found', text: '子 Run 不存在' }

      if (isTerminalStatus(local.status)) {
        return {
          ok: true,
          text: local.result?.text || local.text || `子 Run ${subRunId} 已完成`,
          meta: {
            subRunId,
            terminal: local.status,
            durationMs: Date.now() - (local.startedAt || Date.now()),
          },
        }
      }

      return {
        ok: false,
        code: 'subrun_timeout',
        text: `子 Run ${subRunId} 仍在运行；未配置 RunManager.awaitRun`,
        meta: { subRunId, status: local.status },
      }
    },

    get_sub_run_status: async (args = {}) => {
      const subRunId = String(args.subRunId || '').trim()
      if (!subRunId) return { ok: false, code: 'invalid_args', text: '需要 subRunId' }

      const status = queryStatus(subRunId)
      if (!status.ok) return status

      if (status.status === 'running' || status.status === 'pending') {
        return {
          ok: true,
          text: `子 Run ${subRunId} 运行中`,
          meta: {
            subRunId,
            status: 'running',
            phase: status.phase || 'MODEL',
            durationMs: status.durationMs,
            expertId: status.expertId,
          },
        }
      }

      return {
        ok: true,
        text: status.summary || `子 Run ${subRunId} 终态: ${status.status}`,
        meta: {
          subRunId,
          status: status.status,
          phase: status.phase,
          terminal: status.terminal || status.status,
          stopReason: status.stopReason || null,
          durationMs: status.durationMs,
          expertId: status.expertId,
          builderId: status.builderId,
        },
      }
    },

    cancel_sub_run: async (args = {}) => {
      const subRunId = String(args.subRunId || '').trim()
      const reason = String(args.reason || 'orchestration_cancel').slice(0, 200)
      if (!subRunId) return { ok: false, code: 'invalid_args', text: '需要 subRunId' }

      const startedAt = Date.now()
      let cancelResult = { ok: false }

      if (runManager && typeof runManager.cancelRun === 'function') {
        cancelResult = await runManager.cancelRun(subRunId, reason)
      } else if (typeof opts.cancelSubRun === 'function') {
        opts.cancelSubRun(subRunId, reason)
        cancelResult = { ok: true }
      } else {
        return { ok: false, code: 'tool_unavailable', text: 'cancelSubRun 未配置' }
      }

      state.completeSubRun(subRunId, { status: 'cancelled', cancelledAt: Date.now(), stopReason: reason })

      return {
        ok: cancelResult.ok !== false,
        text: `子 Run ${subRunId} 已取消`,
        meta: {
          subRunId,
          withinBudget: Date.now() - startedAt <= CANCEL_BUDGET_MS,
          elapsedMs: Date.now() - startedAt,
        },
      }
    },

    send_run_message: async (args = {}) => {
      const targetRunId = String(args.targetRunId || '').trim()
      const kind = String(args.kind || '').trim()
      if (!targetRunId || !kind) return { ok: false, code: 'invalid_args', text: '需要 targetRunId 与 kind' }

      const payloadCheck = validateHandoffPayload(args.payload)
      if (!payloadCheck.ok) return payloadCheck

      const envelopePayload = {
        ...(args.payload || {}),
      }

      if (runManager && typeof runManager.sendMessage === 'function') {
        const sent = runManager.sendMessage({
          sourceRunId: runId,
          targetRunId,
          kind,
          payload: envelopePayload,
          protocolVersion: args.protocolVersion,
        })
        if (!sent.ok) return sent
        state.messages.push(sent.envelope)
        return {
          ok: true,
          text: `已向 ${targetRunId} 发送 ${kind} 消息`,
          meta: { messageId: sent.envelope.messageId, targetRunId, kind },
        }
      }

      const envelope = {
        busVersion: 1,
        messageId: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        sourceRunId: runId,
        targetRunId,
        kind,
        payload: envelopePayload,
        ts: new Date().toISOString(),
      }
      state.messages.push(envelope)
      return {
        ok: true,
        text: `已向 ${targetRunId} 发送 ${kind} 消息（内存）`,
        meta: { messageId: envelope.messageId, targetRunId, kind },
      }
    },
  }

  return {
    definitions: ORCHESTRATION_TOOL_DEFS,
    handlers,
    state,
    cancelAll: (o) => state.cancelAll(o),
    cancelAllSubRuns: (o) => cancelAllSubRuns(runId, { ...o, runManager }),
    runManager,
  }
}

module.exports = {
  MAX_SUB_RUNS,
  MAX_PARALLEL,
  MAX_DEPTH,
  CANCEL_BUDGET_MS,
  HANDOFF_MAX_BYTES,
  ORCHESTRATION_TOOL_DEFS,
  OrchestrationState,
  runStates: runStateStore.map,
  runStateStore,
  createSubRunId,
  getOrchestrationState,
  cancelAllSubRuns,
  parseOrchestrationFrontmatter,
  validateOrchestrationPolicy,
  validateHandoffPayload,
  isFakeSpawnResult,
  buildOrchestrationTools,
}
