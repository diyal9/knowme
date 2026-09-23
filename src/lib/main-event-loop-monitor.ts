'use strict'

const { monitorEventLoopDelay, performance } = require('node:perf_hooks')

/** Record long main-process turns without adding work to the hot path. */
function startMainEventLoopMonitor(options = {}) {
  const logger = options.logger
  const intervalMs = Math.max(1000, Number(options.intervalMs) || 2000)
  const thresholdMs = Math.max(50, Number(options.thresholdMs) || 100)
  const histogram = monitorEventLoopDelay({ resolution: 20 })
  histogram.enable()
  let previousUtilization = performance.eventLoopUtilization()
  const timer = setInterval(() => {
    const maxMs = histogram.max / 1e6
    const p99Ms = histogram.percentile(99) / 1e6
    const utilization = performance.eventLoopUtilization(previousUtilization)
    previousUtilization = utilization
    histogram.reset()
    if (maxMs < thresholdMs || typeof logger?.warn !== 'function') return
    try {
      logger.warn('system', 'event-loop-stall', `主进程事件循环延迟 ${Math.round(maxMs)}ms`, {
        maxMs: Math.round(maxMs), p99Ms: Math.round(p99Ms),
        utilization: Number(utilization.utilization.toFixed(3)), intervalMs,
      })
    } catch { /* telemetry must never affect the main process */ }
  }, intervalMs)
  timer.unref?.()
  return { stop() { clearInterval(timer); histogram.disable() } }
}

module.exports = { startMainEventLoopMonitor }
