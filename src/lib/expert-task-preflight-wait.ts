'use strict'

const duration = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.min(value, 2147483647) : fallback

function preflightError(code, stage, id = 'preflight') {
  return Object.assign(new Error(code === 'preflight_cancelled' ? '任务预检已取消' : '任务预检超时，请重试'), {
    code, stage, id, retryable: code === 'preflight_timeout',
  })
}

/** Host wait boundary only: detaching does not stop a non-cooperative provider. */
function createPreflightWait({ signal, timeoutMs, probeTimeoutMs } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort(preflightError('preflight_cancelled', 'overall'))
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(preflightError('preflight_timeout', 'overall')), duration(timeoutMs, 30000))
  return {
    signal: controller.signal,
    wait(operation, stage, id) {
      return new Promise((resolve, reject) => {
        let settled = false, probeTimer
        const finish = (callback, value) => {
          if (settled) return
          settled = true
          clearTimeout(probeTimer)
          controller.signal.removeEventListener('abort', onAbort)
          callback(value)
        }
        const onAbort = () => finish(reject, controller.signal.reason)
        if (controller.signal.aborted) { onAbort(); return }
        controller.signal.addEventListener('abort', onAbort, { once: true })
        probeTimer = setTimeout(() => finish(reject, preflightError('preflight_timeout', stage, id)), duration(probeTimeoutMs, 15000))
        // Install both handlers even when cancellation wins. Late results are
        // ignored; a late provider rejection is consumed, never unhandled.
        try { Promise.resolve(operation()).then(value => finish(resolve, value), error => finish(reject, error)) }
        catch (error) { finish(reject, error) }
      })
    },
    close() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      controller.abort(preflightError('preflight_cancelled', 'overall'))
    },
  }
}

module.exports = { createPreflightWait }
