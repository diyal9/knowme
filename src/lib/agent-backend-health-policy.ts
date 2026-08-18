'use strict'

/**
 * 远程 adapter 健康窗口与降级决策。超过阈值则切本地，不静默挂起。
 */

const DEFAULT_WINDOW = 8
const FAIL_RATIO = 0.5
const LOCAL_BACKEND = 'local-executor'

function createBackendHealthPolicy(opts = {}) {
  const windowSize = Number.isFinite(opts.windowSize) ? opts.windowSize : DEFAULT_WINDOW
  const failRatio = Number.isFinite(opts.failRatio) ? opts.failRatio : FAIL_RATIO
  const localBackend = String(opts.localBackend || LOCAL_BACKEND)
  /** @type {Map<string, { ok: boolean, at: number, timeout?: boolean }[]>} */
  const samples = new Map()

  function record(backendId, sample) {
    const id = String(backendId || '')
    if (!id) return
    const list = samples.get(id) || []
    list.push({
      ok: sample.ok !== false,
      at: Number(sample.at) || Date.now(),
      timeout: sample.timeout === true || sample.code === 'timeout',
    })
    samples.set(id, list.slice(-windowSize))
  }

  function snapshot(backendId) {
    const list = samples.get(String(backendId || '')) || []
    const n = list.length
    const fails = list.filter((row) => !row.ok).length
    const timeouts = list.filter((row) => row.timeout).length
    const lastFail = [...list].reverse().find((row) => !row.ok)
    const lastOk = [...list].reverse().find((row) => row.ok)
    return {
      samples: n,
      failRate: n ? fails / n : 0,
      timeoutRate: n ? timeouts / n : 0,
      recoveryDelayMs: lastFail && lastOk && lastOk.at > lastFail.at ? lastOk.at - lastFail.at : 0,
    }
  }

  function decide(backendId, probe) {
    const id = String(backendId || localBackend)
    record(id, probe || { ok: true })
    if (id === localBackend) {
      return { backend: id, degraded: false, reason: '' }
    }
    const stats = snapshot(id)
    const probeFailed = probe && probe.ok === false
    if (probeFailed || (stats.samples >= 3 && stats.failRate >= failRatio)) {
      return {
        backend: localBackend,
        degraded: true,
        reason: probeFailed ? String(probe.code || probe.message || 'remote_unhealthy') : 'fail_rate_threshold',
        from: id,
        stats,
        recoveryHint: '远程恢复后下次启动会再探测；本次已切本地执行。',
      }
    }
    return { backend: id, degraded: false, reason: '', stats }
  }

  return { record, snapshot, decide, samples }
}

module.exports = { createBackendHealthPolicy, DEFAULT_WINDOW, FAIL_RATIO }
