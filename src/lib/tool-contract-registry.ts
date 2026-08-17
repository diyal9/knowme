'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const VALID_SOURCES = new Set(['builtin', 'connector', 'mcp', 'feishu'])
const VALID_RISKS = new Set(['read', 'write', 'destructive', 'network', 'external'])
const VALID_SCOPES = new Set(['content-source', 'sandbox', 'external', 'ephemeral'])

const REQUIRED_CONTRACT_FIELDS = ['source', 'capability', 'risk', 'sideEffects', 'requiresApproval', 'scope', 'timeoutMs', 'idempotencySupported', 'rollbackSupported']

const REDACT_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential|bearer/i

const ORCHESTRATION_TOOL_NAMES = new Set([
  'delegate_to_expert',
  'spawn_sub_run',
  'handoff_artifact',
  'await_sub_run',
  'get_sub_run_status',
  'cancel_sub_run',
  'send_run_message',
])

/** @type {Map<string, Map<string, object>>} */
const runIdempotencyCaches = new Map()
/** @type {Map<string, object>} */
const runRuntimeContexts = new Map()

function createAuditId() {
  return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function validateContract(contract = {}) {
  const missing = REQUIRED_CONTRACT_FIELDS.filter((k) => contract[k] === undefined || contract[k] === null)
  if (missing.length) {
    return { ok: false, code: 'invalid_contract', message: `契约缺少字段: ${missing.join(', ')}` }
  }
  if (!VALID_SOURCES.has(String(contract.source))) {
    return { ok: false, code: 'invalid_contract', message: `无效 source: ${contract.source}` }
  }
  if (!VALID_RISKS.has(String(contract.risk))) {
    return { ok: false, code: 'invalid_contract', message: `无效 risk: ${contract.risk}` }
  }
  if (!VALID_SCOPES.has(String(contract.scope))) {
    return { ok: false, code: 'invalid_contract', message: `无效 scope: ${contract.scope}` }
  }
  const timeoutMs = Number(contract.timeoutMs)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { ok: false, code: 'invalid_contract', message: 'timeoutMs 必须为正数' }
  }
  return { ok: true }
}

function normalizeRunGovernancePolicy(policy = {}) {
  const tools = policy.tools && typeof policy.tools === 'object' ? policy.tools : {}
  const orchestration = policy.orchestration && typeof policy.orchestration === 'object' ? policy.orchestration : {}
  const connectors = policy.connectors && typeof policy.connectors === 'object' ? policy.connectors : {}
  const allowlistRaw = tools.allowlist ?? policy.allowlist
  const denylistRaw = tools.denylist ?? policy.denylist
  const connectorRaw = connectors.allowedConnectorIds ?? policy.allowedConnectorIds
  const expertRaw = policy.expertToolNames ?? tools.expertToolNames
  return {
    allowlist: Array.isArray(allowlistRaw) ? allowlistRaw.map(String).filter(Boolean) : null,
    denylist: Array.isArray(denylistRaw) ? denylistRaw.map(String).filter(Boolean) : [],
    allowedConnectorIds: Array.isArray(connectorRaw) ? connectorRaw.map(String).filter(Boolean) : null,
    expertToolNames: Array.isArray(expertRaw) ? expertRaw.map(String).filter(Boolean) : null,
    orchestration: {
      allowDelegate: orchestration.allowDelegate !== false,
      allowedSubExperts: Array.isArray(orchestration.allowedSubExperts)
        ? orchestration.allowedSubExperts.map(String).filter(Boolean)
        : null,
    },
    budget: policy.budget && typeof policy.budget === 'object' ? policy.budget : null,
  }
}

function isOrchestrationToolName(name) {
  return ORCHESTRATION_TOOL_NAMES.has(String(name || '').trim())
}

const { isToolAllowedByGovernance, filterDefinitionsForGovernance, bindRunRuntimeContext, getRunRuntimeContext, unbindRunRuntimeContext, getRunIdempotencyCache, cloneEnvelope, resolveRemainingTimeoutMs, computeEffectiveTimeoutMs, mergeAbortSignals, createCombinedAbortSignal, invokeHandlerWithGovernance, validateArgsAgainstSchema, wrapEnvelope, redactSensitiveValue, redactSensitiveFields, readLastAuditHash, getLastAuditWriteError, appendAuditLog, resolveAuditOutcome, recordIdempotencyReceipt } = require('./tool-contract-governance')

class ToolContractRegistry {
  constructor() {
    this.tools = new Map()
  }

  registerTool(definition, contract, handler) {
    const name = String(definition?.function?.name || '').trim()
    if (!name) return { ok: false, code: 'invalid_tool', message: '工具缺少 name' }
    const validated = validateContract(contract)
    if (!validated.ok) return validated
    this.tools.set(name, {
      definition: {
        type: 'function',
        function: {
          name,
          description: String(definition.function?.description || name).slice(0, 500),
          parameters: definition.function?.parameters || { type: 'object', properties: {} },
        },
        _knowme: { ...contract },
      },
      contract,
      handler: typeof handler === 'function' ? handler : null,
    })
    return { ok: true, name }
  }

  get(name) {
    return this.tools.get(String(name || '').trim()) || null
  }

  has(name) {
    return this.tools.has(String(name || '').trim())
  }

  list() {
    return [...this.tools.values()]
  }

  getDefinitions() {
    return this.list().map((t) => t.definition)
  }

  getDefinitionsForRun(policy = null) {
    return filterDefinitionsForGovernance(this.getDefinitions(), policy)
  }

  validateToolCall(name, rawArgs, parseArgs, policy = null) {
    const toolName = String(name || '').trim()
    const entry = this.get(toolName)
    if (!entry) {
      return { ok: false, code: 'unknown_tool', message: `未注册工具: ${toolName}` }
    }
    if (policy && !isToolAllowedByGovernance(toolName, entry.contract, policy)) {
      return { ok: false, code: 'scope_denied', message: `工具未授权: ${toolName}` }
    }
    const parsed = typeof parseArgs === 'function'
      ? parseArgs(rawArgs)
      : { ok: true, args: rawArgs && typeof rawArgs === 'object' ? rawArgs : {} }
    if (!parsed.ok) return parsed
    const schemaCheck = validateArgsAgainstSchema(parsed.args, entry.definition.function.parameters)
    if (!schemaCheck.ok) return schemaCheck
    return { ok: true, name: toolName, args: parsed.args, contract: entry.contract }
  }

  async execute(name, args, ctx = {}) {
    const toolName = String(name || '').trim()
    const entry = this.get(toolName)
    if (!entry || typeof entry.handler !== 'function') {
      return wrapEnvelope({ ok: false, code: 'unknown_tool', text: `未注册工具: ${toolName}` }, { toolName })
    }

    const governancePolicy = ctx.governancePolicy || null
    if (governancePolicy && !isToolAllowedByGovernance(toolName, entry.contract, governancePolicy)) {
      return wrapEnvelope({
        ok: false,
        code: 'scope_denied',
        text: `工具未授权: ${toolName}`,
      }, { toolName, parentRunId: ctx.parentRunId, subRunId: ctx.subRunId })
    }

    const schemaCheck = validateArgsAgainstSchema(args, entry.definition.function.parameters)
    if (!schemaCheck.ok) {
      return wrapEnvelope({ ok: false, code: schemaCheck.code, text: schemaCheck.message }, { toolName })
    }

    const runtimeCtx = ctx.runId ? getRunRuntimeContext(ctx.runId) : null
    const mergedCtx = {
      ...ctx,
      signal: mergeAbortSignals([ctx.signal, runtimeCtx?.signal].filter(Boolean)),
      getRemainingTimeoutMs: ctx.getRemainingTimeoutMs || runtimeCtx?.getRemainingTimeoutMs,
      recordReceipt: ctx.recordReceipt || runtimeCtx?.recordReceipt,
    }

    if (mergedCtx.signal?.aborted) {
      return wrapEnvelope({
        ok: false,
        code: 'cancelled',
        text: '工具执行已取消',
      }, { toolName, parentRunId: mergedCtx.parentRunId, subRunId: mergedCtx.subRunId })
    }

    const idempotencyKey = String(args?.idempotencyKey || ctx.idempotencyKey || '').trim()
    const runId = String(mergedCtx.runId || '').trim()
    if (entry.contract.idempotencySupported && idempotencyKey && runId) {
      const cached = getRunIdempotencyCache(runId).get(idempotencyKey)
      if (cached) {
        return cloneEnvelope({ ...cached, receipt: cached.receipt || { deduplicated: true, idempotencyKey } })
      }
    }

    const auditId = createAuditId()
    const timeoutMs = computeEffectiveTimeoutMs(entry.contract, mergedCtx)
    if (Number.isFinite(timeoutMs) && timeoutMs <= 0) {
      return wrapEnvelope({
        ok: false,
        code: 'timeout',
        text: 'Run 剩余时间不足，工具未执行',
        auditId,
      }, { toolName, parentRunId: mergedCtx.parentRunId, subRunId: mergedCtx.subRunId, idempotencyKey })
    }

    const auditMeta = {
      auditId,
      toolName,
      parentRunId: mergedCtx.parentRunId || '',
      subRunId: mergedCtx.subRunId || '',
      idempotencyKey: idempotencyKey || null,
    }

    const startedAt = Date.now()
    try {
      const result = await invokeHandlerWithGovernance(entry.handler, args, mergedCtx, timeoutMs)
      const envelope = wrapEnvelope(result || {}, {
        ...auditMeta,
        requiresApproval: Boolean(result?.requiresApproval || entry.contract.requiresApproval),
      })

      if (entry.contract.sideEffects || entry.contract.requiresApproval || envelope.requiresApproval) {
        appendAuditLog(mergedCtx.userData, {
          auditId,
          toolName,
          runId: mergedCtx.runId || '',
          parentRunId: mergedCtx.parentRunId || '',
          subRunId: mergedCtx.subRunId || '',
          sessionId: mergedCtx.sessionId || '',
          approverId: mergedCtx.approverId || '',
          outcome: resolveAuditOutcome(envelope, entry.contract),
          target: String(args?.path || args?.from || args?.title || args?.url || '').slice(0, 200),
          idempotencyKey: idempotencyKey || null,
        })
      }

      if (entry.contract.idempotencySupported && idempotencyKey && runId && envelope.ok !== false) {
        getRunIdempotencyCache(runId).set(idempotencyKey, cloneEnvelope(envelope))
        const receipt = recordIdempotencyReceipt(mergedCtx, {
          runId,
          parentRunId: mergedCtx.parentRunId || null,
          subRunId: mergedCtx.subRunId || null,
          toolName,
          idempotencyKey,
          auditId: envelope.auditId,
          envelope,
        })
        if (receipt) envelope.receipt = receipt
      }

      return envelope
    } catch (err) {
      const resolvedCode = err?.code === 'cancelled' || mergedCtx.signal?.aborted
        ? 'cancelled'
        : (Date.now() - startedAt >= timeoutMs ? 'timeout' : 'tool_failed')
      appendAuditLog(mergedCtx.userData, {
        auditId,
        toolName,
        runId: mergedCtx.runId || '',
        parentRunId: mergedCtx.parentRunId || '',
        subRunId: mergedCtx.subRunId || '',
        sessionId: mergedCtx.sessionId || '',
        outcome: resolvedCode === 'timeout' ? 'timeout' : 'failed',
        target: String(args?.path || args?.title || '').slice(0, 200),
        idempotencyKey: idempotencyKey || null,
      })
      return wrapEnvelope({
        ok: false,
        code: resolvedCode,
        text: String(err?.message || err).slice(0, 500),
        auditId,
      }, auditMeta)
    }
  }

  projectToSurface(parseArgs, ctx = {}) {
    const policy = ctx.governancePolicy || null
    const definitions = this.getDefinitionsForRun(policy)
    const allowed = new Set(definitions.map((def) => def.function.name))
    const handlers = {}
    for (const name of allowed) {
      const entry = this.get(name)
      if (entry?.handler) {
        handlers[name] = async (args, signal, handlerCtx = {}) => this.execute(name, args, {
          ...ctx,
          ...handlerCtx,
          signal: mergeAbortSignals([ctx.signal, signal, handlerCtx.signal].filter(Boolean)),
        })
      }
    }
    return { definitions, handlers, registry: this, parseArgs, governancePolicy: policy }
  }
}

function createRegistry() {
  return new ToolContractRegistry()
}

function isToolSurfaceV1() {
  const flag = String(process.env.KNOWME_TOOL_SURFACE || 'v1').trim().toLowerCase()
  return flag !== 'legacy'
}

module.exports = {
  VALID_SOURCES,
  VALID_RISKS,
  VALID_SCOPES,
  REQUIRED_CONTRACT_FIELDS,
  ORCHESTRATION_TOOL_NAMES,
  REDACT_KEY_PATTERN,
  createAuditId,
  validateContract,
  validateArgsAgainstSchema,
  normalizeRunGovernancePolicy,
  isToolAllowedByGovernance,
  filterDefinitionsForGovernance,
  bindRunRuntimeContext,
  getRunRuntimeContext,
  unbindRunRuntimeContext,
  computeEffectiveTimeoutMs,
  wrapEnvelope,
  redactSensitiveFields,
  redactSensitiveValue,
  getLastAuditWriteError,
  appendAuditLog,
  ToolContractRegistry,
  createRegistry,
  isToolSurfaceV1,
}
