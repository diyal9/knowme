/**
 * agent-run-manager/lifecycle — Run 创建、启动、终止、查询与诊断。
 * 不负责：子 Run 编排（见 children.ts）、持久化恢复（见 recovery.ts）。
 */
'use strict'

const { createOperationKey } = require('../agent-run-store')
const { BUS_VERSION } = require('../agent-message-bus')
const { TERMINAL_STATUSES, cloneRun } = require('./constants')
const t = require('./transitions')

function createRun(mgr, spec = {}) {
  const dup = spec.idempotencyKey ? t.checkIdempotency(mgr, spec.idempotencyKey) : null
  if (dup) return dup

  const run = t.baseRunRecord(mgr, spec)
  mgr.launchSpecs.set(run.runId, {
    prompt: spec.prompt,
    expertId: spec.expertId,
    agentPackageId: spec.agentPackageId,
    backend: spec.backend,
    builderId: spec.builderId,
    handoff: spec.handoff || spec.handoffContext,
    governanceEnvelope: spec.governanceEnvelope,
    packageSnapshotHash: spec.packageSnapshotHash,
    budget: spec.budget,
    tier: spec.tier,
    session: spec.session,
    parentSignal: spec.parentSignal,
    onEmit: spec.onEmit,
    onTerminal: spec.onTerminal,
  })
  t.transitionRun(mgr, run, 'queued')
  mgr.runs.set(run.runId, run)
  mgr.metrics.gauge('active_runs', t.activeRunCount(mgr))
  t.persistRun(mgr, run, 'run.created', { packageRef: run.packageRef })
  t.broadcast(mgr, { type: 'run.created', runId: run.runId, run: cloneRun(run) })

  if (mgr.scheduler && spec.autoLaunch !== false) {
    mgr.scheduler.register({
      runId: run.runId,
      parentRunId: run.parentRunId,
      rootRunId: run.rootRunId,
      depth: run.depth,
      joinStrategy: run.joinStrategy,
      budget: spec.budget,
      meta: spec.meta,
    })
  }

  if (spec.idempotencyKey && mgr.runStore) {
    const key = createOperationKey({ idempotencyKey: spec.idempotencyKey })
    mgr.runStore.writeReceipt('__global__', key, {
      result: { runId: run.runId, status: run.status },
    })
  }

  return { ok: true, runId: run.runId, run: cloneRun(run) }
}

function adoptRunningRun(mgr, spec = {}) {
  const existing = spec.runId ? mgr.runs.get(String(spec.runId)) : null
  const created = existing ? { ok: true, runId: existing.runId, run: cloneRun(existing) } : createRun(mgr, {
    ...spec,
    autoLaunch: false,
  })
  if (!created.ok) return created
  const run = mgr.runs.get(created.runId)
  if (!run) return { ok: false, code: 'run_not_found' }
  if (run.status === 'created' || run.status === 'queued') {
    t.transitionRun(mgr, run, 'running', {
      startedAt: run.startedAt || new Date(mgr.now()).toISOString(),
      phase: 'RUNNING',
    })
    t.persistRun(mgr, run, 'run.started', { adopted: true })
    t.broadcast(mgr, { type: 'run.started', runId: run.runId, status: run.status, adopted: true })
  }
  if (spec.abortController) mgr.abortControllers.set(run.runId, spec.abortController)
  return { ok: true, runId: run.runId, run: cloneRun(run) }
}

function completeAdoptedRun(mgr, runId, result = {}) {
  return finalizeTerminal(mgr, runId, result)
}

async function launchRun(mgr, runId) {
  const hit = getRun(mgr, runId)
  if (!hit.ok) return hit
  const run = mgr.runs.get(String(runId))
  if (!['queued', 'recovering', 'interrupted'].includes(run.status)) {
    return { ok: false, code: 'invalid_state', message: `无法 launch 状态=${run.status}` }
  }

  t.transitionRun(mgr, run, 'running', { startedAt: run.startedAt || new Date(mgr.now()).toISOString() })
  t.persistRun(mgr, run, 'run.phase', { phase: run.phase || 'PREPARE' })
  t.broadcast(mgr, { type: 'run.started', runId: run.runId, run: cloneRun(run) })

  if (!mgr.launcher) {
    return { ok: true, runId: run.runId, launched: false, reason: 'launcher_not_configured' }
  }

  try {
    const launchSpec = mgr.launchSpecs.get(run.runId) || {}
    const abortController = new AbortController()
    mgr.abortControllers.set(run.runId, abortController)
    if (launchSpec.parentSignal?.aborted) abortController.abort(launchSpec.parentSignal.reason)
    else launchSpec.parentSignal?.addEventListener?.(
      'abort',
      () => abortController.abort(launchSpec.parentSignal.reason),
      { once: true },
    )
    const handle = await mgr.launcher.launch(
      { ...cloneRun(run), ...launchSpec },
      {
        emit: (evt) => {
          launchSpec.onEmit?.(evt)
          t.broadcast(mgr, { ...evt, runId: run.runId })
        },
        onTerminal: (result) => {
          launchSpec.onTerminal?.(result)
          finalizeTerminal(mgr, run.runId, result)
        },
        signal: abortController.signal,
      },
    )
    mgr.launches.set(run.runId, handle)
    return { ok: true, runId: run.runId, launched: true, handle }
  } catch (err) {
    t.transitionRun(mgr, run, 'error', { stopReason: String(err?.message || err) })
    t.emitTerminalOnce(mgr, run, { terminal: 'failed', stopReason: run.stopReason })
    if (mgr.scheduler) mgr.scheduler.onTerminal(runId, {
      status: 'error',
      terminal: 'failed',
      code: 'launch_failed',
      message: run.stopReason,
    })
    mgr.launches.delete(runId)
    mgr.abortControllers.delete(runId)
    notifyWaiters(mgr, runId)
    return { ok: false, code: 'launch_failed', message: String(err?.message || err) }
  }
}

async function launchFromScheduler(mgr, item) {
  return launchRun(mgr, item.runId)
}

function finalizeTerminal(mgr, runId, result = {}) {
  const run = mgr.runs.get(String(runId))
  if (!run) return { ok: false, code: 'not_found' }
  if (run.terminal) {
    mgr.metrics.increment('duplicate_terminal_total', 1, { outcome: run.status })
    return { ok: true, duplicate: true }
  }

  const status = String(result.status || result.terminal || 'done').toLowerCase()
  const mapped = ['completed', 'done'].includes(status) ? 'done'
    : status === 'failed' ? 'error'
      : status === 'cancelled' ? 'cancelled' : 'error'
  run.artifactRefs = Array.isArray(result.artifactRefs) ? result.artifactRefs.slice(0, 32) : (run.artifactRefs || [])
  run.evidenceRefs = Array.isArray(result.evidenceRefs) ? result.evidenceRefs.slice(0, 32) : (run.evidenceRefs || [])
  run.meta = {
    ...(run.meta || {}),
    summary: String(result.text || result.summary || run.meta?.summary || '').slice(0, 4000),
    metrics: result.metrics || result.report?.metrics || run.meta?.metrics || {},
  }

  t.transitionRun(mgr, run, 'terminalizing')
  t.transitionRun(mgr, run, mapped, {
    stopReason: result.stopReason || result.message || null,
    phase: result.phase || run.phase,
  })

  t.emitTerminalOnce(mgr, run, {
    ...result,
    summary: run.meta.summary,
    metrics: run.meta.metrics,
    artifactRefs: run.artifactRefs,
    evidenceRefs: run.evidenceRefs,
  })
  if (mgr.scheduler) mgr.scheduler.onTerminal(runId, { status: mapped, ...result })
  mgr.launches.delete(runId)
  mgr.abortControllers.delete(runId)
  notifyWaiters(mgr, runId)
  mgr.metrics.gauge('active_runs', t.activeRunCount(mgr))
  return { ok: true, status: mapped }
}

function notifyWaiters(mgr, runId) {
  const id = String(runId)
  const list = mgr.waiters.get(id) || []
  if (!list.length) return
  mgr.waiters.delete(id)
  mgr.metrics.gauge('waiter_count', t.waiterCount(mgr))
  const status = getRunStatus(mgr, id)
  for (const waiter of list) {
    clearTimeout(waiter.timer)
    waiter.resolve(status)
  }
}

async function cancelRun(mgr, runId, reason = 'user_cancel') {
  const id = String(runId || '')
  const inFlight = mgr._cancelPromises.get(id)
  if (inFlight) {
    mgr.metrics.increment('duplicate_cancel_total')
    return inFlight
  }
  const operation = cancelRunInternal(mgr, id, reason)
  mgr._cancelPromises.set(id, operation)
  try {
    return await operation
  } finally {
    mgr._cancelPromises.delete(id)
  }
}

async function cancelRunInternal(mgr, runId, reason = 'user_cancel') {
  const startedAt = mgr.now()
  const hit = getRun(mgr, runId)
  if (!hit.ok) return hit
  const run = mgr.runs.get(String(runId))

  if (TERMINAL_STATUSES.has(run.status)) {
    return { ok: true, alreadyTerminal: true, runId: run.runId, status: run.status }
  }

  run.cancelReason = reason
  mgr.abortControllers.get(run.runId)?.abort(reason)

  const childIds = [...(run.childRunIds || [])]
  const cancelledChildren = []
  for (const childId of childIds) {
    const res = await cancelRun(mgr, childId, reason)
    if (res.ok) cancelledChildren.push(childId)
  }

  if (mgr.scheduler) mgr.scheduler.cancel(runId)
  if (mgr.launcher) {
    const handle = mgr.launches.get(run.runId)
    if (handle) {
      try { await mgr.launcher.cancel(run.runId, reason) } catch { /* best effort */ }
    }
  }
  if (TERMINAL_STATUSES.has(run.status)) {
    const elapsedMs = mgr.now() - startedAt
    mgr.metrics.increment('cancel_total', 1, { outcome: run.status })
    mgr.metrics.observe('cancel_latency_ms', elapsedMs)
    return {
      ok: true,
      alreadyTerminal: true,
      runId: run.runId,
      status: run.status,
      cancelledChildren,
      elapsedMs,
      withinBudgetMs: elapsedMs <= mgr.cancelBudgetMs,
    }
  }

  t.transitionRun(mgr, run, 'terminalizing')
  t.transitionRun(mgr, run, 'cancelled')
  t.emitTerminalOnce(mgr, run, { terminal: 'cancelled', stopReason: reason })
  mgr.launches.delete(run.runId)
  mgr.abortControllers.delete(run.runId)
  notifyWaiters(mgr, run.runId)

  const elapsedMs = mgr.now() - startedAt
  mgr.metrics.increment('cancel_total', 1, { outcome: run.status })
  mgr.metrics.observe('cancel_latency_ms', elapsedMs)
  mgr.metrics.gauge('active_runs', t.activeRunCount(mgr))
  return {
    ok: true,
    runId: run.runId,
    cancelledChildren,
    elapsedMs,
    withinBudgetMs: elapsedMs <= mgr.cancelBudgetMs,
  }
}

function retryRun(mgr, runId, opts = {}) {
  const hit = getRun(mgr, runId)
  if (!hit.ok) return hit
  const prev = hit.run

  if (!opts.force && !['error', 'cancelled'].includes(prev.status)) {
    return { ok: false, code: 'not_retriable', message: '仅 error/cancelled 可重试' }
  }
  if (prev.idempotencyKey && !opts.force && !opts.newIdempotencyKey) {
    return { ok: false, code: 'idempotency_required', message: '需新 idempotencyKey 或 force' }
  }

  const priorLaunch = mgr.launchSpecs.get(prev.runId) || {}
  const spec = {
    ...priorLaunch,
    packageRef: prev.packageRef,
    expertSnapshotId: prev.expertSnapshotId,
    permissions: prev.permissions,
    governanceEnvelope: prev.governanceEnvelope,
    budget: prev.budget,
    parentRunId: prev.parentRunId,
    rootRunId: prev.rootRunId,
    depth: prev.depth,
    joinStrategy: prev.joinStrategy,
    idempotencyKey: opts.newIdempotencyKey || null,
    sessionId: prev.sessionId,
    meta: { ...prev.meta, retriedFrom: prev.runId, attempt: (prev.meta?.attempt || 1) + 1 },
    autoLaunch: opts.autoLaunch !== false,
  }
  const children = require('./children')
  return prev.parentRunId
    ? children.createChildRun(mgr, prev.parentRunId, spec)
    : createRun(mgr, spec)
}

function getRun(mgr, runId) {
  const id = String(runId || '')
  const cached = mgr.runs.get(id)
  if (cached) return { ok: true, run: cloneRun(cached), source: 'memory' }

  if (mgr.runStore) {
    const query = mgr.runStore.queryRun(id)
    if (query.ok) {
      mgr.runs.set(id, query.state)
      return { ok: true, run: cloneRun(query.state), source: query.source }
    }
    return { ok: false, code: query.code || 'not_found', message: query.message || 'Run 不存在或已清理' }
  }

  return { ok: false, code: 'not_found', message: 'Run 不存在或已清理' }
}

function getRunTree(mgr, rootRunId) {
  const id = String(rootRunId || '')
  if (mgr.runStore) {
    const tree = mgr.runStore.getRunTree(id)
    if (tree.ok) {
      const nodes = {}
      let resumeAvailable = false
      for (const [runId, indexed] of Object.entries(tree.nodes || {})) {
        const hit = getRun(mgr, runId)
        const run = hit.ok ? hit.run : {}
        const status = run.status || indexed.status
        if (status === 'interrupted' || status === 'recovering') resumeAvailable = true
        nodes[runId] = {
          ...indexed,
          ...run,
          children: indexed.children || run.childRunIds || [],
          artifacts: run.artifactRefs || [],
          evidence: run.evidenceRefs || [],
          summary: run.meta?.summary || '',
          metrics: run.meta?.metrics || {},
          expertId: run.meta?.expertId || null,
          builderId: run.meta?.builderId || run.meta?.backend || 'knowme-local',
          terminal: run.terminal
            ? (status === 'done' ? 'completed' : status === 'error' ? 'failed' : status)
            : null,
        }
      }
      return {
        ...tree,
        nodes,
        root: nodes[id] || tree.root,
        resumeAvailable,
      }
    }
  }

  const nodes = {}
  for (const run of mgr.runs.values()) {
    if (run.rootRunId === id || run.runId === id) {
      nodes[run.runId] = { ...run, children: run.childRunIds || [] }
    }
  }
  if (!Object.keys(nodes).length) {
    return { ok: false, code: 'not_found', message: 'Run 树不存在' }
  }
  return { ok: true, rootRunId: id, nodes, root: nodes[id] || null }
}

function getRunStatus(mgr, runId) {
  const hit = getRun(mgr, runId)
  if (!hit.ok) return hit
  const run = hit.run
  const started = run.startedAt ? Date.parse(run.startedAt) : mgr.now()
  const ended = run.endedAt ? Date.parse(run.endedAt) : mgr.now()
  return {
    ok: true,
    runId: run.runId,
    parentRunId: run.parentRunId,
    rootRunId: run.rootRunId,
    status: run.status,
    phase: run.phase,
    terminal: run.terminal ? run.status : null,
    stopReason: run.stopReason || run.cancelReason || null,
    durationMs: Math.max(0, ended - started),
    expertId: mgr.launchSpecs.get(run.runId)?.expertId || run.meta?.expertId || null,
    builderId: mgr.launchSpecs.get(run.runId)?.builderId || mgr.launchSpecs.get(run.runId)?.backend || run.meta?.builderId || 'knowme-local',
    summary: run.meta?.summary || '',
    metrics: run.meta?.metrics || {},
  }
}

function queryEvents(mgr, runId, opts = {}) {
  if (!mgr.runStore) return { ok: false, code: 'store_unavailable' }
  let events
  try {
    events = mgr.runStore.readEvents(String(runId), { tolerantTail: true })
  } catch (error) {
    return {
      ok: false,
      code: error.code || 'event_log_corrupt',
      message: String(error.message || error),
    }
  }
  const fromSeq = Number(opts.fromSeq) || 0
  const filtered = events.filter((e) => Number(e.seq) > fromSeq)
  return { ok: true, events: filtered, lastSeq: events.reduce((m, e) => Math.max(m, Number(e.seq) || 0), 0) }
}

function attachSession(mgr, runId, sessionId) {
  const hit = getRun(mgr, runId)
  if (!hit.ok) return hit
  const run = mgr.runs.get(String(runId))
  run.sessionId = String(sessionId)
  run.updatedAt = new Date(mgr.now()).toISOString()
  t.persistRun(mgr, run, 'run.session.attached', { sessionId: run.sessionId })
  return { ok: true, runId: run.runId, sessionId: run.sessionId }
}

function markWaiting(mgr, runId, reason = 'join') {
  const run = mgr.runs.get(String(runId))
  if (!run) return { ok: false, code: 'not_found' }
  t.transitionRun(mgr, run, 'waiting', { waitReason: reason })
  t.persistRun(mgr, run, 'run.waiting', { reason })
  if (mgr.scheduler) mgr.scheduler.markWaiting(runId, reason)
  return { ok: true, run: cloneRun(run) }
}

function saveCheckpoint(mgr, runId, checkpointId, data = {}) {
  if (!mgr.runStore) return { ok: false, code: 'store_unavailable' }
  const run = mgr.runs.get(String(runId))
  if (run) {
    data = {
      ...data,
      pendingNodes: data.pendingNodes || run.childRunIds?.filter((id) => {
        const child = mgr.runs.get(id)
        return child && !TERMINAL_STATUSES.has(child.status)
      }),
      completedNodes: data.completedNodes || run.childRunIds?.filter((id) => {
        const child = mgr.runs.get(id)
        return child && TERMINAL_STATUSES.has(child.status)
      }),
    }
  }
  return mgr.runStore.saveCheckpoint(runId, checkpointId, data)
}

function sendMessage(mgr, message = {}) {
  if (!mgr.messageBus) return { ok: false, code: 'bus_unavailable', text: 'Message Bus 未配置' }
  const kindMap = {
    handoff: 'handoff.request',
    status: 'task.progress',
    terminal: 'run.terminal',
    artifact: 'artifact.publish',
    evidence: 'evidence.record',
  }
  const type = kindMap[message.kind] || message.type || message.kind
  return mgr.messageBus.publish({
    version: BUS_VERSION,
    runId: message.sourceRunId || message.runId,
    parentRunId: message.parentRunId || null,
    rootRunId: message.rootRunId || message.runId || message.sourceRunId,
    targetRunId: message.targetRunId,
    type,
    payload: message.payload || {},
    correlationId: message.correlationId,
    idempotencyKey: message.idempotencyKey,
  })
}

function getDiagnostics(mgr) {
  const queues = mgr.scheduler?.queues || {}
  const queueDepth = Object.values(queues).reduce(
    (total, queue) => total + (Array.isArray(queue) ? queue.length : 0),
    0,
  )
  const activeLaunches = mgr.launcher?.activeLaunches?.size || 0
  const activeRuns = t.activeRunCount(mgr)
  const waiters = t.waiterCount(mgr)
  const abortControllers = mgr.abortControllers.size
  const resourceLeakCount = [...mgr.runs.values()].filter(run => (
    TERMINAL_STATUSES.has(String(run.status))
    && (
      mgr.launches.has(run.runId)
      || mgr.abortControllers.has(run.runId)
      || mgr.waiters.has(run.runId)
    )
  )).length
  if (resourceLeakCount) mgr.metrics.increment('resource_leak_detected_total', resourceLeakCount)
  return {
    ok: true,
    authority: 'AgentRunManager+AgentRunStore',
    resources: {
      activeRuns,
      activeLaunches,
      waiters,
      abortControllers,
      cancelOperations: mgr._cancelPromises.size,
      resourceLeakCount,
    },
    queues: {
      depth: queueDepth,
      ready: queues.ready?.length || 0,
      waiting: queues.waiting?.length || 0,
      blocked: queues.blocked?.length || 0,
      retry: queues.retry?.length || 0,
    },
    metrics: mgr.metrics.snapshot({
      active_runs: activeRuns,
      active_launches: activeLaunches,
      waiter_count: waiters,
      queue_depth: queueDepth,
      resource_leak_count: resourceLeakCount,
    }),
  }
}

module.exports = {
  createRun,
  adoptRunningRun,
  completeAdoptedRun,
  launchRun,
  launchFromScheduler,
  finalizeTerminal,
  notifyWaiters,
  cancelRun,
  cancelRunInternal,
  retryRun,
  getRun,
  getRunTree,
  getRunStatus,
  queryEvents,
  attachSession,
  markWaiting,
  saveCheckpoint,
  sendMessage,
  getDiagnostics,
}
