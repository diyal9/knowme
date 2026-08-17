/**
 * agent-run-manager/recovery — 从 Store 恢复 Run 与 resume 续跑。
 * 不负责：新建 Run（见 lifecycle.ts）。
 */
'use strict'

const { ACTIVE_STATUSES, TERMINAL_STATUSES } = require('./constants')
const t = require('./transitions')
const lifecycle = require('./lifecycle')

function readFallbackState(runStore, runId) {
  const hit = runStore.readState(runId)
  return hit.ok ? hit.state : null
}

function resumeRun(mgr, runId, opts = {}) {
  const hit = lifecycle.getRun(mgr, runId)
  if (!hit.ok) return hit
  const run = mgr.runs.get(String(runId))

  if (mgr.runStore && opts.checkpointId) {
    const cp = mgr.runStore.loadCheckpoint(runId, opts.checkpointId)
    if (!cp.ok) return cp
    if (cp.checkpoint.lastSeq > (run.seq || 0)) {
      return { ok: false, code: 'resume_unsafe', message: 'checkpoint 与 Event Log 不一致' }
    }
  }

  if (mgr.runStore) {
    const replay = mgr.runStore.replay(runId, {
      tolerantTail: true,
      onEvent: (state, event) => {
        if (event.type === 'run.state' && event.payload?.state) return event.payload.state
        return state
      },
    })
    if (!replay.ok) {
      mgr.metrics.increment('recovery_rejected_total', 1, { code: replay.code })
      return {
        ok: false,
        code: replay.code || 'event_log_corrupt',
        message: replay.message || 'Run 持久化数据损坏，无法安全恢复',
      }
    }
    if (replay.state) {
      Object.assign(run, replay.state)
    }
  }

  const resumable = ['waiting', 'recovering', 'interrupted', 'blocked', 'queued']
  if (!resumable.includes(run.status) && !opts.force) {
    return { ok: false, code: 'resume_unsafe', message: `状态 ${run.status} 不可自动恢复` }
  }

  const action = opts.action || 'continue'
  if (action === 'abandon') {
    return lifecycle.cancelRun(mgr, runId, 'abandoned')
  }
  if (action === 'retry') {
    return lifecycle.retryRun(mgr, runId, opts)
  }

  if (run.status === 'blocked') t.transitionRun(mgr, run, 'queued')
  else if (run.status !== 'queued') t.transitionRun(mgr, run, 'recovering')
  t.persistRun(mgr, run, 'run.resumed', { action })
  t.broadcast(mgr, { type: 'run.resumed', runId: run.runId, action })
  mgr.metrics.increment('resume_total', 1, { outcome: action })

  if (opts.launch !== false) {
    return lifecycle.launchRun(mgr, runId)
  }
  t.transitionRun(mgr, run, 'running')
  const { cloneRun } = require('./constants')
  return { ok: true, runId: run.runId, run: cloneRun(run) }
}

function loadFromStore(mgr, rootRunId) {
  if (!mgr.runStore) return { ok: false, code: 'store_unavailable' }
  const tree = mgr.runStore.getRunTree(rootRunId)
  if (!tree.ok) return tree

  const loaded = []
  for (const node of Object.values(tree.nodes)) {
    const replay = mgr.runStore.replay(node.runId, { tolerantTail: true })
    if (!replay.ok) {
      mgr.metrics.increment('recovery_rejected_total', 1, { code: replay.code })
      return {
        ok: false,
        code: replay.code || 'event_log_corrupt',
        message: replay.message || `Run ${node.runId} 无法安全恢复`,
        runId: node.runId,
        loaded,
      }
    }
    const state = replay.state || readFallbackState(mgr.runStore, node.runId)
    if (state) {
      const wasActive = ACTIVE_STATUSES.has(String(state.status))
      if (wasActive) {
        state.status = 'interrupted'
        state.phase = 'INTERRUPTED'
        state.stopReason = state.stopReason || 'process_restarted'
        state.interruptedAt = new Date(mgr.now()).toISOString()
        state.terminal = false
      }
      mgr.runs.set(node.runId, state)
      if (TERMINAL_STATUSES.has(String(state.status))) mgr._terminalEmitted.add(node.runId)
      if (wasActive) {
        t.persistRun(mgr, state, 'run.interrupted', {
          stopReason: state.stopReason,
          recoverable: true,
        })
        mgr.metrics.increment('recovery_interrupted_total')
      } else {
        mgr.metrics.increment('recovery_terminal_total')
      }
      loaded.push(node.runId)
    }
  }
  return { ok: true, loaded, rootRunId }
}

function recoverAllFromStore(mgr) {
  if (!mgr.runStore || typeof mgr.runStore.listRootRunIds !== 'function') {
    return { ok: false, code: 'store_unavailable', recovered: [] }
  }
  const recovered = []
  const errors = []
  for (const rootRunId of mgr.runStore.listRootRunIds()) {
    const result = loadFromStore(mgr, rootRunId)
    if (result.ok) recovered.push(...result.loaded)
    else errors.push({ rootRunId, code: result.code || 'recovery_failed' })
  }
  const result = { ok: errors.length === 0, recovered: [...new Set(recovered)], errors }
  mgr.metrics.increment(
    errors.length ? 'recovery_failed_total' : 'recovery_success_total',
    1,
    { outcome: errors.length ? 'failed' : 'success' },
  )
  return result
}

module.exports = {
  resumeRun,
  loadFromStore,
  recoverAllFromStore,
  readFallbackState,
}
