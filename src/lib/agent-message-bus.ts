'use strict'

const crypto = require('crypto')

const BUS_VERSION = 1
const MAX_PAYLOAD_BYTES = 32 * 1024

const MESSAGE_TYPES = Object.freeze([
  'task.assign',
  'task.progress',
  'handoff.request',
  'handoff.accept',
  'handoff.reject',
  'approval.request',
  'approval.decision',
  'artifact.publish',
  'evidence.record',
  'run.terminal',
  'error',
])

const TERMINAL_TYPES = new Set(['run.terminal'])

const SCHEMA_WHITELIST = Object.freeze({
  'task.assign': ['targetAgentPackageId', 'prompt', 'handoffContext', 'inputSchemaRef', 'correlationId'],
  'task.progress': ['percent', 'phase', 'durationMs', 'summary', 'correlationId'],
  'handoff.request': ['targetAgentPackageId', 'handoffContext', 'inputSchemaRef', 'summary', 'requirementId', 'sourceExpertId', 'targetExpertId', 'correlationId'],
  'handoff.accept': ['handoffContext', 'summary', 'requirementId', 'correlationId'],
  'handoff.reject': ['reason', 'correlationId'],
  'approval.request': ['toolCallId', 'risk', 'draftRef', 'draftId', 'title', 'summary', 'expiresAt', 'correlationId'],
  'approval.decision': ['toolCallId', 'decision', 'approved', 'draftRef', 'draftId', 'summary', 'approverId', 'correlationId'],
  'artifact.publish': ['artifactId', 'type', 'status', 'summary', 'workSurfaceRef', 'correlationId'],
  'evidence.record': ['claimRef', 'sourceTool', 'ledgerEntryHash', 'verificationStatus', 'digest', 'provenance', 'summary', 'correlationId'],
  'run.terminal': ['terminal', 'stopReason', 'metrics', 'outputPayload', 'summary', 'artifactRefs', 'evidenceRefs', 'retriable', 'correlationId'],
  error: ['code', 'message', 'retriable', 'correlationId'],
})

const NON_DIAGNOSTIC_AFTER_TERMINAL = new Set([
  'task.assign',
  'task.progress',
  'handoff.request',
  'handoff.accept',
  'handoff.reject',
  'approval.request',
  'approval.decision',
  'artifact.publish',
  'evidence.record',
])

function createMessageId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function payloadByteLength(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload == null ? {} : payload), 'utf8')
  } catch {
    return MAX_PAYLOAD_BYTES + 1
  }
}

function pickWhitelistedPayload(type, payload) {
  const allowed = SCHEMA_WHITELIST[type]
  if (!allowed || payload == null) return {}
  if (typeof payload !== 'object' || Array.isArray(payload)) return {}
  const out = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key]
  }
  return out
}

const PROMPT_INJECTION_PATTERN = /\b(ignore|disregard|override)\b.{0,80}\b(previous|prior|system|developer|instructions?)\b|system\s*prompt|developer\s*message|越过.{0,20}(系统|指令)|忽略.{0,30}(之前|系统|指令)/i

function containsPromptInjection(value, depth = 0) {
  if (depth > 6 || value == null) return false
  if (typeof value === 'string') return PROMPT_INJECTION_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(item => containsPromptInjection(item, depth + 1))
  if (typeof value === 'object') {
    return Object.values(value).some(item => containsPromptInjection(item, depth + 1))
  }
  return false
}

class AgentMessageBus {
  /**
   * @param {object} opts
   * @param {import('./agent-run-store').AgentRunStore} [opts.runStore] - persist mirror
   * @param {(msg: object) => boolean} [opts.isRunAuthorized]
   * @param {() => number|string} [opts.now]
   * @param {(level: string, detail: object) => void} [opts.logger]
   */
  constructor(opts = {}) {
    this.runStore = opts.runStore || null
    this.isRunAuthorized = typeof opts.isRunAuthorized === 'function'
      ? opts.isRunAuthorized
      : () => true
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now()
    this.logger = typeof opts.logger === 'function' ? opts.logger : () => {}

    this._handlers = new Map()
    this._globalHandlers = new Set()
    this._seenMessageIds = new Set()
    this._seenIdempotency = new Set()
    this._lastSeqByRun = new Map()
    this._terminalClosed = new Set()
    this._runSeq = new Map()
  }

  nextSeq(runId) {
    const id = String(runId)
    const next = (this._runSeq.get(id) || 0) + 1
    this._runSeq.set(id, next)
    return next
  }

  isTerminalClosed(runId) {
    return this._terminalClosed.has(String(runId))
  }

  validateEnvelope(envelope = {}) {
    const version = Number(envelope.version ?? envelope.busVersion)
    if (version !== BUS_VERSION) {
      return { ok: false, code: 'bus_version_unsupported', message: '协议不兼容' }
    }

    const type = String(envelope.type || envelope.kind || '')
    if (!MESSAGE_TYPES.includes(type)) {
      return { ok: false, code: 'bus_unknown_type', message: `未知消息类型: ${type}` }
    }

    const runId = String(envelope.runId || '')
    if (!runId) return { ok: false, code: 'missing_run_id', message: '缺少 runId' }

    if (!this.isRunAuthorized(runId, envelope)) {
      return { ok: false, code: 'bus_unauthorized', message: 'Run 未授权' }
    }

    const payload = pickWhitelistedPayload(type, envelope.payload)
    const promptInjectionSuspected = containsPromptInjection(payload)
    const bytes = payloadByteLength(payload)
    if (bytes > MAX_PAYLOAD_BYTES) {
      return { ok: false, code: 'handoff_payload_too_large', message: 'payload 超过 32KB' }
    }

    if (type === 'handoff.request' || type === 'task.assign') {
      const ctx = payload.handoffContext
      if (ctx != null && payloadByteLength(ctx) > MAX_PAYLOAD_BYTES) {
        return { ok: false, code: 'handoff_payload_too_large', message: 'handoffContext 超过 32KB' }
      }
    }

    return {
      ok: true,
      normalized: {
        version: BUS_VERSION,
        messageId: String(envelope.messageId || createMessageId()),
        correlationId: envelope.correlationId ? String(envelope.correlationId) : null,
        runId,
        parentRunId: envelope.parentRunId ? String(envelope.parentRunId) : null,
        rootRunId: envelope.rootRunId ? String(envelope.rootRunId) : runId,
        seq: Number.isFinite(envelope.seq) ? Number(envelope.seq) : null,
        type,
        timestamp: envelope.timestamp || new Date(this.now()).toISOString(),
        source: ['local', 'remote', 'daemon'].includes(envelope.source) ? envelope.source : 'local',
        payload,
        security: promptInjectionSuspected
          ? { promptInjectionSuspected: true, trust: 'untrusted-child-output' }
          : { promptInjectionSuspected: false, trust: 'untrusted-child-output' },
        idempotencyKey: envelope.idempotencyKey ? String(envelope.idempotencyKey) : null,
        targetRunId: envelope.targetRunId ? String(envelope.targetRunId) : null,
        sourceRunId: envelope.sourceRunId ? String(envelope.sourceRunId) : runId,
      },
    }
  }

  subscribe(runId, handler) {
    const id = String(runId)
    if (!this._handlers.has(id)) this._handlers.set(id, new Set())
    this._handlers.get(id).add(handler)
    return () => this._handlers.get(id)?.delete(handler)
  }

  subscribeGlobal(handler) {
    this._globalHandlers.add(handler)
    return () => this._globalHandlers.delete(handler)
  }

  _dispatch(normalized) {
    const targets = new Set()
    if (normalized.targetRunId) targets.add(normalized.targetRunId)
    if (normalized.parentRunId) targets.add(normalized.parentRunId)
    targets.add(normalized.runId)

    for (const runId of targets) {
      const handlers = this._handlers.get(runId)
      if (handlers) {
        for (const fn of handlers) {
          try { fn(normalized) } catch (err) {
            this.logger('error', { code: 'handler_failed', runId, message: String(err?.message || err) })
          }
        }
      }
    }
    for (const fn of this._globalHandlers) {
      try { fn(normalized) } catch (err) {
        this.logger('error', { code: 'global_handler_failed', message: String(err?.message || err) })
      }
    }
  }

  _mirrorToStore(normalized) {
    if (!this.runStore) return { ok: true, skipped: true }
    const mirrorRunId = normalized.rootRunId || normalized.runId
    return this.runStore.appendEvent(mirrorRunId, {
      type: `bus.${normalized.type}`,
      parentRunId: normalized.parentRunId,
      rootRunId: normalized.rootRunId,
      payload: {
        messageId: normalized.messageId,
        correlationId: normalized.correlationId,
        runId: normalized.runId,
        sourceRunId: normalized.sourceRunId,
        targetRunId: normalized.targetRunId,
        seq: normalized.seq,
        source: normalized.source,
        type: normalized.type,
        payload: normalized.payload,
        security: normalized.security,
        idempotencyKey: normalized.idempotencyKey,
        timestamp: normalized.timestamp,
      },
    })
  }

  publish(envelope = {}) {
    const validated = this.validateEnvelope(envelope)
    if (!validated.ok) {
      this.logger('warn', validated)
      return validated
    }

    const msg = validated.normalized
    if (this._seenMessageIds.has(msg.messageId)) {
      return { ok: true, duplicate: true, ack: true, messageId: msg.messageId }
    }
    if (msg.idempotencyKey && this._seenIdempotency.has(msg.idempotencyKey)) {
      return { ok: true, duplicate: true, ack: true, idempotencyKey: msg.idempotencyKey }
    }

    const runId = msg.runId
    if (this._terminalClosed.has(runId) && NON_DIAGNOSTIC_AFTER_TERMINAL.has(msg.type)) {
      return { ok: false, code: 'bus_stream_closed', message: 'Run 已终态，拒绝非诊断消息' }
    }

    const lastSeq = this._lastSeqByRun.get(runId) || 0
    const seq = msg.seq != null ? msg.seq : this.nextSeq(runId)
    msg.seq = seq

    if (seq <= lastSeq && !TERMINAL_TYPES.has(msg.type)) {
      this.logger('warn', { code: 'out_of_order', runId, seq, lastSeq, messageId: msg.messageId })
      return { ok: true, ignored: true, ack: true, code: 'out_of_order', seq, lastSeq }
    }
    if (seq > lastSeq + 1) {
      this.logger('warn', { code: 'seq_gap', runId, seq, lastSeq, messageId: msg.messageId })
    }

    this._seenMessageIds.add(msg.messageId)
    if (msg.idempotencyKey) this._seenIdempotency.add(msg.idempotencyKey)
    this._lastSeqByRun.set(runId, Math.max(lastSeq, seq))

    const mirror = this._mirrorToStore(msg)
    if (mirror && mirror.ok === false && mirror.code !== 'seq_mismatch') {
      return mirror
    }

    this._dispatch(msg)

    if (TERMINAL_TYPES.has(msg.type)) {
      this._terminalClosed.add(runId)
      const terminal = String(msg.payload?.terminal || 'completed')
      if (['completed', 'failed', 'cancelled'].includes(terminal)) {
        this._terminalClosed.add(runId)
      }
    }

    return { ok: true, ack: true, message: msg }
  }

  routeToParent(childEnvelope = {}) {
    const parentRunId = childEnvelope.parentRunId
    if (!parentRunId) {
      return { ok: false, code: 'missing_parent_run_id', message: '缺少 parentRunId' }
    }
    return this.publish({
      ...childEnvelope,
      targetRunId: parentRunId,
      runId: String(childEnvelope.runId || childEnvelope.sourceRunId || ''),
    })
  }

  closeTerminal(runId, terminal = 'completed', extra = {}) {
    return this.publish({
      version: BUS_VERSION,
      runId: String(runId),
      type: 'run.terminal',
      payload: { terminal, ...extra },
    })
  }

  resetForTests() {
    this._seenMessageIds.clear()
    this._seenIdempotency.clear()
    this._lastSeqByRun.clear()
    this._terminalClosed.clear()
    this._runSeq.clear()
  }
}

module.exports = {
  AgentMessageBus,
  BUS_VERSION,
  MAX_PAYLOAD_BYTES,
  MESSAGE_TYPES,
  SCHEMA_WHITELIST,
  TERMINAL_TYPES,
  createMessageId,
  pickWhitelistedPayload,
  payloadByteLength,
}
