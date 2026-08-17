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

const { stableHash, cloneSafe, resolveLane, validateEvent, createRunEmitter, mapLegacyType, mapLegacyPayload, mapLegacyEvent, isSubRunEventType, isSubRunTerminalType, normalizeSubRunTerminal } = require('./agent-output-protocol-core')

const { redactSensitiveValue, redactSensitiveFields, stopReasonLabel, builderLabel, guidanceByStopReason, resolveBusType, resolveBusVersion } = require('./agent-output-protocol-bus')

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
