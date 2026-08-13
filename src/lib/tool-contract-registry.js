'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const VALID_SOURCES = new Set(['builtin', 'connector', 'mcp', 'feishu'])
const VALID_RISKS = new Set(['read', 'write', 'destructive', 'network', 'external'])
const VALID_SCOPES = new Set(['content-source', 'sandbox', 'external', 'ephemeral'])

const REQUIRED_CONTRACT_FIELDS = ['source', 'capability', 'risk', 'sideEffects', 'requiresApproval', 'scope', 'timeoutMs', 'idempotencySupported', 'rollbackSupported']

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

function isToolAllowedByGovernance(name, contract = {}, policy = null) {
  const toolName = String(name || '').trim()
  if (!toolName) return false
  if (!validateContract(contract).ok) return false

  const normalized = policy ? normalizeRunGovernancePolicy(policy) : null
  if (!normalized) return true

  if (normalized.denylist.includes(toolName)) return false
  if (normalized.allowlist && !normalized.allowlist.includes(toolName)) return false

  if (normalized.expertToolNames && !normalized.expertToolNames.includes(toolName)) {
    return false
  }

  const connectorId = String(contract.connectorId || contract.mcpConnectorId || '').trim()
  if (connectorId && normalized.allowedConnectorIds) {
    if (!normalized.allowedConnectorIds.includes(connectorId)) return false
  }

  if (isOrchestrationToolName(toolName) && normalized.orchestration.allowDelegate === false) {
    return false
  }

  return true
}

function filterDefinitionsForGovernance(definitions = [], policy = null) {
  const list = Array.isArray(definitions) ? definitions : []
  if (!policy) return list.filter((def) => validateContract(def?._knowme || {}).ok)
  return list.filter((def) => {
    const name = def?.function?.name
    return isToolAllowedByGovernance(name, def?._knowme || {}, policy)
  })
}

function bindRunRuntimeContext(runId, ctx = {}) {
  const id = String(runId || '').trim()
  if (!id) return
  runRuntimeContexts.set(id, ctx)
}

function getRunRuntimeContext(runId) {
  return runRuntimeContexts.get(String(runId || '').trim()) || null
}

function unbindRunRuntimeContext(runId) {
  runRuntimeContexts.delete(String(runId || '').trim())
  runIdempotencyCaches.delete(String(runId || '').trim())
}

function getRunIdempotencyCache(runId) {
  const id = String(runId || '').trim()
  if (!id) return new Map()
  if (!runIdempotencyCaches.has(id)) runIdempotencyCaches.set(id, new Map())
  return runIdempotencyCaches.get(id)
}

function cloneEnvelope(envelope = {}) {
  return {
    ...envelope,
    artifactRefs: Array.isArray(envelope.artifactRefs) ? [...envelope.artifactRefs] : [],
    sources: Array.isArray(envelope.sources) ? [...envelope.sources] : [],
    meta: envelope.meta && typeof envelope.meta === 'object' ? { ...envelope.meta } : null,
    draft: envelope.draft && typeof envelope.draft === 'object' ? { ...envelope.draft } : envelope.draft || null,
  }
}

function resolveRemainingTimeoutMs(ctx = {}) {
  if (typeof ctx.getRemainingTimeoutMs === 'function') {
    const remaining = ctx.getRemainingTimeoutMs()
    if (Number.isFinite(remaining)) return Math.max(0, remaining)
  }
  if (Number.isFinite(ctx.remainingTimeoutMs)) return Math.max(0, ctx.remainingTimeoutMs)
  const runtimeCtx = ctx.runId ? getRunRuntimeContext(ctx.runId) : null
  if (runtimeCtx && typeof runtimeCtx.getRemainingTimeoutMs === 'function') {
    const remaining = runtimeCtx.getRemainingTimeoutMs()
    if (Number.isFinite(remaining)) return Math.max(0, remaining)
  }
  return null
}

function computeEffectiveTimeoutMs(contract = {}, ctx = {}) {
  const contractTimeout = Number(contract.timeoutMs) || 30000
  const remaining = resolveRemainingTimeoutMs(ctx)
  if (Number.isFinite(remaining)) return Math.min(contractTimeout, remaining)
  return contractTimeout
}

function mergeAbortSignals(signals = []) {
  const list = signals.filter(Boolean)
  if (list.length === 0) return null
  const aborted = list.find((sig) => sig.aborted)
  if (aborted) return aborted
  if (typeof AbortController === 'undefined') return list[0]
  const controller = new AbortController()
  const onAbort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  for (const sig of list) {
    if (typeof sig.addEventListener === 'function') {
      sig.addEventListener('abort', onAbort, { once: true })
    }
  }
  return controller.signal
}

function createCombinedAbortSignal(ctx = {}, timeoutMs) {
  const runtimeCtx = ctx.runId ? getRunRuntimeContext(ctx.runId) : null
  const signals = [ctx.signal, runtimeCtx?.signal].filter(Boolean)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return mergeAbortSignals(signals)
  }
  if (typeof AbortController === 'undefined') {
    return mergeAbortSignals(signals)
  }
  const timeoutController = new AbortController()
  const timer = setTimeout(() => {
    if (!timeoutController.signal.aborted) timeoutController.abort()
  }, timeoutMs)
  if (typeof timer.unref === 'function') timer.unref()
  const combined = mergeAbortSignals([...signals, timeoutController.signal])
  return { signal: combined, cancelTimer: () => clearTimeout(timer) }
}

async function invokeHandlerWithGovernance(handler, args, ctx, timeoutMs) {
  const { signal, cancelTimer } = createCombinedAbortSignal(ctx, timeoutMs)
  try {
    if (signal?.aborted) {
      const err = new Error('cancelled')
      err.code = 'cancelled'
      throw err
    }
    const handlerCtx = {
      signal,
      timeoutMs,
      runId: ctx.runId || '',
      parentRunId: ctx.parentRunId || '',
      subRunId: ctx.subRunId || '',
      sessionId: ctx.sessionId || '',
    }
    const result = await Promise.race([
      Promise.resolve().then(() => handler(args, signal, handlerCtx)),
      new Promise((_, reject) => {
        if (!signal) return
        if (signal.aborted) {
          reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }))
          return
        }
        if (typeof signal.addEventListener !== 'function') return
        signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }))
        }, { once: true })
      }),
    ])
    return result
  } finally {
    if (typeof cancelTimer === 'function') cancelTimer()
  }
}

function validateArgsAgainstSchema(args, schema = {}) {
  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    const val = args?.[key]
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      return { ok: false, code: 'invalid_args', message: `缺少必填参数: ${key}` }
    }
  }
  if (schema.additionalProperties === false && args && typeof args === 'object') {
    const allowed = new Set(Object.keys(schema.properties || {}))
    for (const key of Object.keys(args)) {
      if (!allowed.has(key)) {
        return { ok: false, code: 'invalid_args', message: `未知参数: ${key}` }
      }
    }
  }
  return { ok: true }
}

function wrapEnvelope(result = {}, meta = {}) {
  const auditId = result.auditId || meta.auditId || createAuditId()
  const text = String(result.text || result.message || '')
  const preview = String(result.preview || text.slice(0, 1200))
  const requiresApproval = Boolean(result.requiresApproval || meta.requiresApproval)
  return {
    ok: result.ok !== false,
    code: result.code || (result.ok === false ? 'tool_error' : 'ok'),
    text,
    preview,
    truncated: Boolean(result.truncated),
    artifactRefs: Array.isArray(result.artifactRefs) ? result.artifactRefs : [],
    auditId,
    requiresApproval,
    pendingReview: requiresApproval && result.ok !== false,
    draftId: result.draftId || result.draft?.id || null,
    draft: result.draft || null,
    meta: result.meta && typeof result.meta === 'object' ? result.meta : null,
    sources: Array.isArray(result.sources) ? result.sources : [],
    toolName: meta.toolName || result.toolName || '',
    argsSummary: meta.argsSummary || result.argsSummary || '',
    parentRunId: meta.parentRunId || result.parentRunId || null,
    subRunId: meta.subRunId || result.subRunId || null,
    idempotencyKey: meta.idempotencyKey || result.idempotencyKey || null,
    receipt: meta.receipt || result.receipt || null,
  }
}

const REDACT_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential/i

function redactSensitiveValue(key, value) {
  if (REDACT_KEY_PATTERN.test(String(key || ''))) return '[REDACTED]'
  if (typeof value === 'string') {
    if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value)) return '[REDACTED]'
    if (/^t-[A-Za-z0-9]{10,}/.test(value)) return '[REDACTED]'
  }
  return value
}

function redactSensitiveFields(obj, depth = 0) {
  if (depth > 6 || obj == null) return obj
  if (Array.isArray(obj)) return obj.map((v) => redactSensitiveFields(v, depth + 1))
  if (typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]'
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitiveFields(v, depth + 1)
    } else {
      out[k] = redactSensitiveValue(k, v)
    }
  }
  return out
}

function readLastAuditHash(file) {
  try {
    if (!fs.existsSync(file)) return ''
    const content = fs.readFileSync(file, 'utf8').trim()
    if (!content) return ''
    const lastLine = content.split('\n').pop()
    const parsed = JSON.parse(lastLine)
    return String(parsed.recordHash || '')
  } catch {
    return ''
  }
}

let lastAuditWriteError = null

function getLastAuditWriteError() {
  return lastAuditWriteError
}

function appendAuditLog(userData, entry = {}) {
  if (!userData) return { ok: false, code: 'no_user_data' }
  const dir = path.join(String(userData), 'audit')
  const file = path.join(dir, 'tool-audit.jsonl')
  try {
    fs.mkdirSync(dir, { recursive: true })
    const prevHash = readLastAuditHash(file)
    const body = redactSensitiveFields({
      auditId: entry.auditId || createAuditId(),
      toolName: entry.toolName || '',
      runId: entry.runId || '',
      parentRunId: entry.parentRunId || '',
      subRunId: entry.subRunId || '',
      sessionId: entry.sessionId || '',
      approverId: entry.approverId || '',
      draftId: entry.draftId || '',
      timestamp: entry.timestamp || new Date().toISOString(),
      outcome: entry.outcome || 'unknown',
      target: String(entry.target || '').slice(0, 500),
      idempotencyKey: entry.idempotencyKey || null,
      prevHash,
    })
    const canonical = JSON.stringify(body)
    const recordHash = crypto.createHash('sha256').update(`${prevHash}|${canonical}`).digest('hex')
    const line = JSON.stringify({ ...body, recordHash })
    fs.appendFileSync(file, `${line}\n`, 'utf8')
    lastAuditWriteError = null
    return { ok: true, auditId: body.auditId, recordHash }
  } catch (err) {
    lastAuditWriteError = String(err?.message || err)
    console.error('[tool-audit] append failed:', lastAuditWriteError)
    return { ok: false, code: 'audit_write_failed', message: lastAuditWriteError }
  }
}

function resolveAuditOutcome(envelope, contract = {}) {
  if (!envelope.ok) return envelope.code === 'timeout' ? 'timeout' : 'failed'
  if (envelope.requiresApproval || contract.requiresApproval) return 'pending_review'
  if (contract.sideEffects) return 'executed'
  return 'executed'
}

function recordIdempotencyReceipt(ctx = {}, payload = {}) {
  const runtimeCtx = ctx.runId ? getRunRuntimeContext(ctx.runId) : null
  const hook = ctx.recordReceipt || runtimeCtx?.recordReceipt
  if (typeof hook !== 'function') return null
  try {
    return hook(payload)
  } catch {
    return null
  }
}

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
