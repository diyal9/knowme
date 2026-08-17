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

module.exports = {
  stableHash,
  cloneSafe,
  resolveLane,
  validateEvent,
  createRunEmitter,
  mapLegacyType,
  mapLegacyPayload,
  mapLegacyEvent,
  isSubRunEventType,
  isSubRunTerminalType,
  normalizeSubRunTerminal,
  REDACT_KEY_PATTERN,
}
