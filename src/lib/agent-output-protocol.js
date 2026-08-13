'use strict'

const crypto = require('crypto')

const VERSION = 2

const Lane = Object.freeze({
  PROGRESS: 'progress',
  TOOL: 'tool',
  ANSWER: 'answer',
  UI: 'ui',
  TERMINAL: 'terminal',
})

const EventType = Object.freeze({
  STAGE: 'stage',
  PLAN_UPDATED: 'plan.updated',
  GROUNDING_STATUS: 'grounding-status',
  TOOL_STARTED: 'tool.started',
  TOOL_COMPLETED: 'tool.completed',
  TOOL_FAILED: 'tool.failed',
  ANSWER_COMMITTED: 'answer.committed',
  CHOICE_READY: 'choice.ready',
  RUN_COMPLETED: 'run.completed',
  RUN_CANCELLED: 'run.cancelled',
  RUN_FAILED: 'run.failed',
  SUBRUN_STARTED: 'subrun.started',
  SUBRUN_PROGRESS: 'subrun.progress',
  SUBRUN_WAITING: 'subrun.waiting',
  SUBRUN_COMPLETED: 'subrun.completed',
  SUBRUN_FAILED: 'subrun.failed',
  SUBRUN_CANCELLED: 'subrun.cancelled',
  SUBRUN_TERMINAL: 'subrun.terminal',
})

const TERMINAL_TYPES = new Set([
  EventType.RUN_COMPLETED,
  EventType.RUN_CANCELLED,
  EventType.RUN_FAILED,
])

const SUBRUN_TYPES = new Set([
  EventType.SUBRUN_STARTED,
  EventType.SUBRUN_PROGRESS,
  EventType.SUBRUN_WAITING,
  EventType.SUBRUN_COMPLETED,
  EventType.SUBRUN_FAILED,
  EventType.SUBRUN_CANCELLED,
  EventType.SUBRUN_TERMINAL,
])

const SUBRUN_TERMINAL_TYPES = new Set([
  EventType.SUBRUN_COMPLETED,
  EventType.SUBRUN_FAILED,
  EventType.SUBRUN_CANCELLED,
  EventType.SUBRUN_TERMINAL,
])

const BUS_VERSION = 1

const BUS_TYPE_ALLOWLIST = new Set([
  'task.assign',
  'task.progress',
  'handoff.request',
  'handoff.accept',
  'handoff.reject',
  'handoff.result',
  'approval.request',
  'approval.decision',
  'artifact.publish',
  'evidence.record',
  'evidence.append',
  'run.terminal',
  'terminal',
  'error',
])

const REDACT_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential/i

const LANE_BY_TYPE = Object.freeze({
  [EventType.STAGE]: Lane.PROGRESS,
  [EventType.PLAN_UPDATED]: Lane.PROGRESS,
  [EventType.GROUNDING_STATUS]: Lane.PROGRESS,
  [EventType.TOOL_STARTED]: Lane.TOOL,
  [EventType.TOOL_COMPLETED]: Lane.TOOL,
  [EventType.TOOL_FAILED]: Lane.TOOL,
  [EventType.ANSWER_COMMITTED]: Lane.ANSWER,
  [EventType.CHOICE_READY]: Lane.UI,
  [EventType.RUN_COMPLETED]: Lane.TERMINAL,
  [EventType.RUN_CANCELLED]: Lane.TERMINAL,
  [EventType.RUN_FAILED]: Lane.TERMINAL,
  [EventType.SUBRUN_STARTED]: Lane.PROGRESS,
  [EventType.SUBRUN_PROGRESS]: Lane.PROGRESS,
  [EventType.SUBRUN_WAITING]: Lane.PROGRESS,
  [EventType.SUBRUN_COMPLETED]: Lane.PROGRESS,
  [EventType.SUBRUN_FAILED]: Lane.PROGRESS,
  [EventType.SUBRUN_CANCELLED]: Lane.PROGRESS,
  [EventType.SUBRUN_TERMINAL]: Lane.PROGRESS,
})

function stableHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 16)
}

function cloneSafe(value) {
  if (value == null || typeof value !== 'object') return value
  return structuredClone(value)
}

function resolveLane(type, lane) {
  if (lane && Object.values(Lane).includes(lane)) return lane
  return LANE_BY_TYPE[type] || Lane.PROGRESS
}

/**
 * @param {object} event
 * @returns {{ ok: true, event: object } | { ok: false, error: string }}
 */
function validateEvent(event) {
  if (!event || typeof event !== 'object') return { ok: false, error: 'event must be an object' }
  if (event.version !== VERSION) return { ok: false, error: `unsupported version: ${event.version}` }
  if (!event.runId || typeof event.runId !== 'string') return { ok: false, error: 'runId required' }
  if (!Number.isInteger(event.seq) || event.seq < 1) return { ok: false, error: 'seq must be a positive integer' }
  const expectedLane = LANE_BY_TYPE[event.type]
  if (expectedLane && event.lane && event.lane !== expectedLane) {
    return { ok: false, error: `type ${event.type} requires lane ${expectedLane}` }
  }
  const lane = resolveLane(event.type, event.lane)
  if (!Object.values(Lane).includes(lane)) return { ok: false, error: `invalid lane: ${event.lane}` }
  if (!event.type || typeof event.type !== 'string') return { ok: false, error: 'type required' }
  if (event.payload == null || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    return { ok: false, error: 'payload must be a plain object' }
  }
  if (event.round != null && (!Number.isInteger(event.round) || event.round < 0)) {
    return { ok: false, error: 'round must be a non-negative integer when present' }
  }
  if (event.phase != null && typeof event.phase !== 'string') {
    return { ok: false, error: 'phase must be a string when present' }
  }
  try {
    structuredClone(event)
  } catch (err) {
    return { ok: false, error: `event is not structuredClone-safe: ${err.message}` }
  }
  return { ok: true, event: { ...event, lane } }
}

/**
 * @param {string} runId
 * @param {{ round?: number, phase?: string }} [defaults]
 */
function createRunEmitter(runId, defaults = {}) {
  const state = {
    runId: String(runId || 'run'),
    seq: 0,
    terminalEmitted: false,
    defaults: {
      round: defaults.round ?? 0,
      phase: defaults.phase ?? null,
    },
  }

  const create = (type, payload, meta = {}) => {
    const lane = resolveLane(type, meta.lane)
    state.seq += 1
    const envelope = {
      version: VERSION,
      runId: state.runId,
      seq: state.seq,
      lane,
      type,
      payload: cloneSafe(payload || {}),
    }
    if (meta.round != null) envelope.round = meta.round
    else if (state.defaults.round != null) envelope.round = state.defaults.round
    if (meta.phase != null) envelope.phase = meta.phase
    else if (state.defaults.phase) envelope.phase = state.defaults.phase
    return envelope
  }

  const emit = (type, payload, meta, emitFn) => {
    if (state.terminalEmitted) return null
    const envelope = create(type, payload, meta)
    const validated = validateEvent(envelope)
    if (!validated.ok) return null
    emitFn?.(validated.event)
    if (TERMINAL_TYPES.has(type)) state.terminalEmitted = true
    return validated.event
  }

  return {
    get runId() { return state.runId },
    get seq() { return state.seq },
    get terminalEmitted() { return state.terminalEmitted },
    create,
    emit,
  }
}

function mapLegacyType(legacy = {}) {
  const type = String(legacy.type || 'stage')
  if (type === 'content') return null
  if (type === 'done') return EventType.RUN_COMPLETED
  if (type === 'error') return EventType.RUN_FAILED
  if (type === 'cancelled') return EventType.RUN_CANCELLED
  if (type === 'grounding-status') return EventType.GROUNDING_STATUS
  if (type === 'plan.updated') return EventType.PLAN_UPDATED
  if (type === 'tool.started') return EventType.TOOL_STARTED
  if (type === 'tool.completed') return EventType.TOOL_COMPLETED
  if (type === 'tool.failed') return EventType.TOOL_FAILED
  if (type === 'stage' || type === 'fallback') return EventType.STAGE
  return EventType.STAGE
}

function mapLegacyPayload(legacy = {}, mappedType) {
  const base = {
    title: legacy.title || '',
    summary: legacy.summary || '',
    status: legacy.status || 'done',
    id: legacy.id,
    kind: legacy.kind,
    runPhase: legacy.runPhase,
    toolCallId: legacy.toolCallId,
    toolName: legacy.toolName,
    durationMs: legacy.durationMs,
    contextInfo: legacy.contextInfo ? cloneSafe(legacy.contextInfo) : undefined,
    needsPermission: legacy.needsPermission,
    draftId: legacy.draftId || null,
    draftStatus: legacy.draftStatus || null,
    requiresApproval: legacy.requiresApproval,
    evidenceStatus: legacy.evidenceStatus || null,
    artifactRefs: legacy.artifactRefs ? cloneSafe(legacy.artifactRefs) : undefined,
    sources: legacy.sources ? cloneSafe(legacy.sources) : undefined,
  }
  if (mappedType === EventType.RUN_COMPLETED) {
    return {
      title: legacy.title || '执行完成',
      metrics: cloneSafe(legacy.metrics || {}),
      toolCalls: legacy.toolCalls ?? null,
    }
  }
  if (mappedType === EventType.RUN_FAILED) {
    return {
      title: legacy.title || '生成失败',
      summary: legacy.summary || legacy.message || '',
      message: legacy.summary || legacy.message || '',
    }
  }
  if (mappedType === EventType.RUN_CANCELLED) {
    return {
      title: legacy.title || '已停止生成',
      summary: legacy.summary || '本次 Agent Run 已取消',
    }
  }
  if (mappedType === EventType.GROUNDING_STATUS) {
    return {
      status: legacy.status,
      claims: cloneSafe(legacy.claims || []),
      sources: cloneSafe(legacy.sources || []),
      violations: cloneSafe(legacy.violations || []),
    }
  }
  if (mappedType === EventType.PLAN_UPDATED) {
    return { plan: cloneSafe(legacy.plan || {}) }
  }
  return base
}

/**
 * Map a legacy executor event to a v2 envelope (returns null for non-mappable events).
 * @param {object} legacy
 * @param {{ runId: string, seq: number, round?: number, phase?: string }} ctx
 */
function mapLegacyEvent(legacy, ctx = {}) {
  const mappedType = mapLegacyType(legacy)
  if (!mappedType) return null
  const lane = resolveLane(mappedType, legacy.lane)
  const envelope = {
    version: VERSION,
    runId: String(ctx.runId || 'run'),
    seq: Number.isInteger(ctx.seq) ? ctx.seq : 1,
    lane,
    type: mappedType,
    payload: mapLegacyPayload(legacy, mappedType),
  }
  if (ctx.round != null) envelope.round = ctx.round
  else if (legacy.round != null) envelope.round = legacy.round
  if (ctx.phase || legacy.runPhase) envelope.phase = ctx.phase || legacy.runPhase
  const validated = validateEvent(envelope)
  return validated.ok ? validated.event : null
}

function isSubRunEventType(type) {
  return SUBRUN_TYPES.has(String(type || ''))
}

function isSubRunTerminalType(type) {
  return SUBRUN_TERMINAL_TYPES.has(String(type || ''))
}

function normalizeSubRunTerminal(payload = {}, type = '') {
  const explicit = String(payload.terminal || payload.status || '').toLowerCase()
  if (explicit === 'completed' || explicit === 'done' || explicit === 'success') return 'completed'
  if (explicit === 'cancelled' || explicit === 'canceled') return 'cancelled'
  if (explicit === 'error' || explicit === 'failed') return 'failed'
  if (type === EventType.SUBRUN_COMPLETED) return 'completed'
  if (type === EventType.SUBRUN_CANCELLED) return 'cancelled'
  if (type === EventType.SUBRUN_FAILED) return 'failed'
  if (type === EventType.SUBRUN_TERMINAL) {
    return explicit || 'completed'
  }
  return explicit || 'completed'
}

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

function stopReasonLabel(stopReason, code) {
  const key = String(stopReason || code || '').toLowerCase()
  const labels = {
    cancelled: '已取消',
    canceled: '已取消',
    error: '执行失败',
    failed: '执行失败',
    completed: '已完成',
    protocol_unsupported: '协议不兼容',
    scope_denied: '权限不足',
    timeout: '执行超时',
    interrupted: '执行中断，可恢复',
    recovering: '等待恢复',
  }
  return labels[key] || (key ? key : '已终止')
}

function builderLabel(builderId) {
  const id = String(builderId || '').toLowerCase()
  const labels = {
    'knowme-local': '本地',
    'local-executor': '本地',
    local: '本地',
    cursor: 'Cursor',
    'cursor-package': 'Cursor',
    claude: 'Claude',
    'claude-package': 'Claude',
    'daemon-agent': '管线服务',
    daemon: '管线服务',
    remote: '远程',
  }
  return labels[id] || (builderId ? String(builderId) : '本地')
}

function guidanceByStopReason(stopReason, code) {
  const key = String(stopReason || code || '').toLowerCase()
  if (key === 'timeout' || key === 'remote_timeout') {
    return {
      failureCategory: 'timeout',
      recommendedAction: 'retry',
      alternativeActions: ['switch_to_local', 'reduce_scope'],
      estimatedWait: '10-30s',
    }
  }
  if (key === 'scope_denied' || key === 'permission_denied') {
    return {
      failureCategory: 'permission',
      recommendedAction: 'open_permission_settings',
      alternativeActions: ['retry_after_approval'],
      estimatedWait: '1-3m',
    }
  }
  if (key === 'protocol_unsupported' || key === 'version_mismatch') {
    return {
      failureCategory: 'protocol',
      recommendedAction: 'switch_backend',
      alternativeActions: ['update_package', 'retry'],
      estimatedWait: '1-2m',
    }
  }
  if (key === 'evidence_blocked' || key === 'grounding_blocked') {
    return {
      failureCategory: 'evidence',
      recommendedAction: 'provide_more_context',
      alternativeActions: ['retry'],
      estimatedWait: '30-90s',
    }
  }
  if (key === 'cancelled' || key === 'canceled') {
    return {
      failureCategory: 'cancelled',
      recommendedAction: 'resume',
      alternativeActions: ['retry'],
      estimatedWait: '0-10s',
    }
  }
  return {
    failureCategory: 'unknown',
    recommendedAction: 'retry',
    alternativeActions: ['provide_more_context'],
    estimatedWait: '30-90s',
  }
}

function resolveBusType(envelope = {}) {
  return String(envelope.kind || envelope.type || '')
}

function resolveBusVersion(envelope = {}) {
  const version = envelope.busVersion ?? envelope.version
  return version == null ? null : Number(version)
}

/**
 * Map agent-message-bus envelope to parent-run v2 output event (progress/ui lane only).
 * @param {object} bus
 * @param {{ runId: string, seq: number, messageId?: string, causationId?: string }} ctx
 */
function mapBusMessageToOutputEvent(bus, ctx = {}) {
  if (!bus || typeof bus !== 'object') return null
  const busVersion = resolveBusVersion(bus)
  if (busVersion !== BUS_VERSION) {
    const subRunId = bus.runId || bus.sourceRunId
    return createSubRunOutputEvent(EventType.SUBRUN_TERMINAL, {
      subRunId,
      subRunSeq: bus.seq,
      parentRunId: bus.parentRunId || ctx.runId,
      terminal: 'failed',
      stopReason: 'protocol_unsupported',
      code: 'protocol_unsupported',
      summary: `不支持的 Bus 版本：${busVersion}`,
    }, { ...ctx, phase: 'ORCHESTRATE' })
  }

  const busType = resolveBusType(bus)
  if (!BUS_TYPE_ALLOWLIST.has(busType)) {
    const subRunId = bus.runId || bus.sourceRunId || bus.targetRunId
    return {
      version: VERSION,
      runId: String(ctx.runId || bus.parentRunId || bus.targetRunId || 'run'),
      seq: Number.isInteger(ctx.seq) ? ctx.seq : 1,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_TERMINAL,
      phase: 'ORCHESTRATE',
      payload: redactSensitiveFields({
        subRunId,
        subRunSeq: bus.seq,
        parentRunId: bus.parentRunId || ctx.runId,
        messageId: bus.messageId,
        causationId: bus.correlationId || ctx.causationId,
        terminal: 'failed',
        stopReason: 'protocol_unsupported',
        code: 'protocol_unsupported',
        summary: `未知 Bus 消息类型：${busType}`,
        builderId: bus.source,
      }),
    }
  }

  const parentRunId = String(ctx.runId || bus.parentRunId || bus.targetRunId || 'run')
  const subRunId = String(bus.runId || bus.sourceRunId || bus.targetRunId || '')
  const basePayload = redactSensitiveFields({
    subRunId,
    subRunSeq: bus.seq,
    parentRunId: bus.parentRunId || parentRunId,
    messageId: bus.messageId,
    causationId: bus.correlationId || ctx.causationId,
    builderId: bus.source,
    expertId: bus.payload?.expertId || bus.payload?.targetAgentPackageId,
    delegation: true,
    security: bus.security,
    ...(bus.payload && typeof bus.payload === 'object' ? cloneSafe(bus.payload) : {}),
  })

  const envelopeBase = {
    version: VERSION,
    runId: parentRunId,
    seq: Number.isInteger(ctx.seq) ? ctx.seq : 1,
    phase: 'ORCHESTRATE',
    round: ctx.round,
  }

  if (busType === 'approval.request') {
    const payload = bus.payload || {}
    return {
      ...envelopeBase,
      lane: Lane.UI,
      type: EventType.CHOICE_READY,
      payload: {
        ui: [{
          kind: 'approval',
          title: payload.title || '待审批操作',
          items: [{
            label: '查看草稿',
            action: 'review_draft',
            payload: JSON.stringify({
              draftId: payload.draftRef || payload.draftId,
              toolCallId: payload.toolCallId,
              subRunId,
            }),
          }],
        }],
        subRunId,
        draftId: payload.draftRef || payload.draftId,
        requiresApproval: true,
        risk: payload.risk,
        recommendedAction: 'review_draft',
        alternativeActions: ['reject'],
        estimatedWait: '1-5m',
      },
    }
  }

  if (busType === 'approval.decision') {
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_PROGRESS,
      payload: {
        ...basePayload,
        kind: 'approval',
        approved: bus.payload?.approved ?? bus.payload?.decision === 'approved',
        draftId: bus.payload?.draftRef || bus.payload?.draftId,
        summary: bus.payload?.summary || '审批已处理',
      },
    }
  }

  if (busType.startsWith('handoff.')) {
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_PROGRESS,
      payload: {
        ...basePayload,
        kind: 'handoff',
        handoffType: busType,
        summary: bus.payload?.summary || bus.payload?.requirementId || '上下文交接',
      },
    }
  }

  if (busType === 'artifact.publish') {
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_PROGRESS,
      payload: {
        ...basePayload,
        kind: 'artifact',
        artifactRefs: [{
          id: bus.payload?.artifactId,
          kind: bus.payload?.type || 'artifact',
          title: bus.payload?.summary || bus.payload?.artifactId,
          status: bus.payload?.status,
        }].filter(ref => ref.id),
      },
    }
  }

  if (busType === 'evidence.record' || busType === 'evidence.append') {
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_PROGRESS,
      payload: {
        ...basePayload,
        kind: 'evidence',
        evidence: [{
          digest: bus.payload?.digest,
          provenance: bus.payload?.provenance,
          summary: bus.payload?.summary,
        }].filter(item => item.digest || item.summary),
      },
    }
  }

  if (busType === 'task.progress') {
    const normalizedStatus = String(bus.payload?.status || '').toLowerCase()
    const isWaiting = normalizedStatus.startsWith('waiting')
      || Boolean(bus.payload?.requiresApproval)
      || Boolean(bus.payload?.waitingFor)
    const mappedType = isWaiting ? EventType.SUBRUN_WAITING : EventType.SUBRUN_PROGRESS
    const waitingAction = normalizedStatus === 'waiting_approval'
      ? { recommendedAction: 'review_draft', alternativeActions: ['reject'], estimatedWait: '1-5m' }
      : normalizedStatus === 'waiting_input'
        ? { recommendedAction: 'provide_input', alternativeActions: ['retry'], estimatedWait: '30-120s' }
        : normalizedStatus === 'waiting_child'
          ? { recommendedAction: 'wait_children', alternativeActions: ['cancel'], estimatedWait: '30-180s' }
          : {}
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: mappedType,
      payload: {
        ...basePayload,
        phase: bus.payload?.phase,
        durationMs: bus.payload?.durationMs,
        summary: bus.payload?.summary || bus.payload?.title,
        waitingFor: bus.payload?.waitingFor || null,
        ...waitingAction,
      },
    }
  }

  if (busType === 'task.assign') {
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: EventType.SUBRUN_STARTED,
      payload: {
        ...basePayload,
        expertId: bus.payload?.expertId || bus.payload?.targetAgentPackageId,
        builderId: bus.payload?.builderId || bus.source || 'knowme-local',
        summary: bus.payload?.summary || '子 Run 已分配',
      },
    }
  }

  if (busType === 'run.terminal' || busType === 'terminal' || busType === 'error') {
    const terminal = normalizeSubRunTerminal(bus.payload || {}, EventType.SUBRUN_TERMINAL)
    const mappedType = terminal === 'cancelled'
      ? EventType.SUBRUN_CANCELLED
      : terminal === 'failed'
        ? EventType.SUBRUN_FAILED
        : EventType.SUBRUN_COMPLETED
    return {
      ...envelopeBase,
      lane: Lane.PROGRESS,
      type: mappedType,
      payload: {
        ...basePayload,
        terminal,
        stopReason: bus.payload?.stopReason || bus.payload?.code || terminal,
        summary: bus.payload?.summary || stopReasonLabel(bus.payload?.stopReason, bus.payload?.code),
        retriable: Boolean(bus.payload?.retriable),
        ...guidanceByStopReason(bus.payload?.stopReason, bus.payload?.code),
      },
    }
  }

  return null
}

/**
 * Normalize subrun lifecycle event for parent-run emission.
 * @param {string} type
 * @param {object} payload
 * @param {{ runId: string, seq: number, phase?: string, round?: number }} ctx
 */
function createSubRunOutputEvent(type, payload = {}, ctx = {}) {
  const mappedType = String(type || EventType.SUBRUN_PROGRESS)
  if (!SUBRUN_TYPES.has(mappedType)) return null
  const envelope = {
    version: VERSION,
    runId: String(ctx.runId || payload.parentRunId || 'run'),
    seq: Number.isInteger(ctx.seq) ? ctx.seq : 1,
    lane: Lane.PROGRESS,
    type: mappedType,
    payload: redactSensitiveFields(cloneSafe(payload || {})),
  }
  if (ctx.phase) envelope.phase = ctx.phase
  if (ctx.round != null) envelope.round = ctx.round
  const validated = validateEvent(envelope)
  return validated.ok ? validated.event : null
}

module.exports = {
  VERSION,
  Lane,
  EventType,
  TERMINAL_TYPES,
  SUBRUN_TYPES,
  SUBRUN_TERMINAL_TYPES,
  BUS_VERSION,
  BUS_TYPE_ALLOWLIST,
  stableHash,
  cloneSafe,
  validateEvent,
  createRunEmitter,
  mapLegacyEvent,
  mapLegacyType,
  mapLegacyPayload,
  isSubRunEventType,
  isSubRunTerminalType,
  normalizeSubRunTerminal,
  redactSensitiveFields,
  redactSensitiveValue,
  stopReasonLabel,
  builderLabel,
  mapBusMessageToOutputEvent,
  createSubRunOutputEvent,
  resolveBusType,
  resolveBusVersion,
}
