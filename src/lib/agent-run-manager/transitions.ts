/**
 * agent-run-manager/transitions — 状态转换、持久化、终端事件广播。
 * 不负责：launch/cancel 编排（见 lifecycle.ts）。
 */
'use strict'

const { createOperationKey } = require('../agent-run-store')
const { BUS_VERSION } = require('../agent-message-bus')
const { VALID_TRANSITIONS, ACTIVE_STATUSES, TERMINAL_STATUSES, cloneRun } = require('./constants')

/** 校验并应用 Run 状态转换。 */
function transitionRun(mgr, run, nextStatus, patch = {}) {
  const current = String(run.status || 'created')
  const target = String(nextStatus)
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed || (!allowed.has(target) && current !== target)) {
    return { ok: false, code: 'invalid_transition', message: `${current} → ${target} 不允许` }
  }
  run.status = target
  Object.assign(run, patch)
  run.updatedAt = new Date(mgr.now()).toISOString()
  return { ok: true, run }
}

/** 构造新 Run 内存记录（created 态）。 */
function baseRunRecord(mgr, spec = {}) {
  const runId = String(spec.runId || mgr.idGen())
  return {
    runId,
    parentRunId: spec.parentRunId ? String(spec.parentRunId) : null,
    rootRunId: spec.rootRunId ? String(spec.rootRunId) : runId,
    depth: Number.isFinite(spec.depth) ? spec.depth : 0,
    status: 'created',
    phase: spec.phase || null,
    terminal: false,
    packageRef: spec.packageRef || null,
    expertSnapshotId: spec.expertSnapshotId || null,
    permissions: spec.permissions || {},
    childRunIds: [],
    joinStrategy: spec.joinStrategy || 'all',
    continueOnChildError: Boolean(spec.continueOnChildError),
    createdAt: new Date(mgr.now()).toISOString(),
    updatedAt: new Date(mgr.now()).toISOString(),
    startedAt: null,
    endedAt: null,
    cancelReason: null,
    stopReason: null,
    idempotencyKey: spec.idempotencyKey || null,
    seq: 0,
    sessionId: spec.sessionId || null,
    budget: spec.budget || {},
    governanceEnvelope: spec.governanceEnvelope || {},
    packageSnapshotHash: spec.packageSnapshotHash || null,
    meta: {
      ...(spec.meta || {}),
      expertId: spec.expertId || spec.meta?.expertId || null,
      builderId: spec.builderId || spec.backend || spec.meta?.builderId || 'knowme-local',
      backend: spec.backend || spec.meta?.backend || 'local-executor',
    },
  }
}

function persistRun(mgr, run, eventType, payload = {}) {
  if (!mgr.runStore) return { ok: true, skipped: true }
  const append = mgr.runStore.appendEvent(run.runId, {
    type: eventType,
    parentRunId: run.parentRunId,
    rootRunId: run.rootRunId,
    payload: { ...payload, status: run.status, phase: run.phase },
  })
  if (append.ok) {
    run.seq = append.seq
  }
  const stateWrite = mgr.runStore.writeState(run.runId, run)
  if (stateWrite.ok && append.ok) {
    mgr.runStore.updateTreeIndex(run.rootRunId, {
      runId: run.runId,
      parentRunId: run.parentRunId,
      status: run.status,
      depth: run.depth,
      terminal: run.terminal,
    })
  }
  return append.ok ? append : stateWrite
}

function broadcast(mgr, event) {
  for (const listener of mgr._eventListeners) {
    try { listener(event) } catch { /* ignore */ }
  }
  mgr.emit(event)
}

/** 终端事件只发一次，并同步 Message Bus。 */
function emitTerminalOnce(mgr, run, terminalPayload = {}) {
  if (mgr._terminalEmitted.has(run.runId)) {
    mgr.metrics.increment('duplicate_terminal_total', 1, { outcome: run.status })
    return { ok: true, duplicate: true }
  }
  mgr._terminalEmitted.add(run.runId)
  run.terminal = true
  run.endedAt = run.endedAt || new Date(mgr.now()).toISOString()

  const event = {
    type: 'run.terminal',
    runId: run.runId,
    rootRunId: run.rootRunId,
    status: run.status,
    payload: terminalPayload,
    ts: run.endedAt,
  }
  broadcast(mgr, event)
  persistRun(mgr, run, 'run.terminal', terminalPayload)

  if (mgr.messageBus) {
    mgr.messageBus.publish({
      version: BUS_VERSION,
      runId: run.runId,
      parentRunId: run.parentRunId,
      rootRunId: run.rootRunId,
      type: 'run.terminal',
      payload: {
        terminal: run.status === 'done' ? 'completed' : run.status,
        stopReason: run.stopReason || run.cancelReason || null,
        metrics: terminalPayload.metrics || {},
        outputPayload: terminalPayload.outputPayload || null,
        summary: terminalPayload.summary || run.meta?.summary || '',
        artifactRefs: terminalPayload.artifactRefs || run.artifactRefs || [],
        evidenceRefs: terminalPayload.evidenceRefs || run.evidenceRefs || [],
      },
    })
  }
  return { ok: true }
}

function checkIdempotency(mgr, idempotencyKey) {
  if (!idempotencyKey || !mgr.runStore) return null
  for (const run of mgr.runs.values()) {
    if (run.idempotencyKey === idempotencyKey && ACTIVE_STATUSES.has(run.status)) {
      return { ok: true, duplicate: true, runId: run.runId, status: run.status }
    }
  }
  const key = createOperationKey({ idempotencyKey })
  const receipt = mgr.runStore.readReceipt('__global__', key)
  if (receipt.ok && receipt.receipt?.result?.runId) {
    return { ok: true, duplicate: true, runId: receipt.receipt.result.runId, status: receipt.receipt.result.status }
  }
  return null
}

function activeRunCount(mgr) {
  let count = 0
  for (const run of mgr.runs.values()) {
    if (ACTIVE_STATUSES.has(String(run.status))) count += 1
  }
  return count
}

function waiterCount(mgr) {
  let count = 0
  for (const list of mgr.waiters.values()) count += list.length
  return count
}

function onBusMessage(mgr, msg) {
  if (msg.type === 'run.terminal' && msg.parentRunId) {
    const parent = mgr.runs.get(msg.parentRunId)
    if (parent && parent.status === 'waiting') {
      const allTerminal = (parent.childRunIds || []).every((id) => {
        const child = mgr.runs.get(id)
        return child && TERMINAL_STATUSES.has(child.status)
      })
      if (allTerminal) {
        transitionRun(mgr, parent, 'running')
        broadcast(mgr, { type: 'run.join.complete', runId: parent.runId, childRunId: msg.runId })
      }
    }
  }
  broadcast(mgr, { type: 'bus.message', message: msg })
}

module.exports = {
  transitionRun,
  baseRunRecord,
  persistRun,
  broadcast,
  emitTerminalOnce,
  checkIdempotency,
  activeRunCount,
  waiterCount,
  onBusMessage,
}
