'use strict'

// Only host-owned contracts can establish replay safety. An idempotency flag
// alone is not proof that the provider deduplicates an in-flight operation.
function resolveToolInvocationPolicy(surface, name, fallbackTimeoutMs) {
  const records = surface?.getToolRecords?.()
  const record = Array.isArray(records) ? records.find(item => item?.function?.name === name) : undefined
  const contract = record?._knowme
  const declaredTimeout = contract?.timeoutMs
  return {
    retrySafe: contract?.risk === 'read' && contract?.sideEffects === false,
    timeoutMs: Number.isInteger(declaredTimeout) && declaredTimeout > 0 && declaredTimeout <= 2147483647
      ? declaredTimeout : fallbackTimeoutMs,
  }
}

function waitForRetry(delayMs, signal) {
  return new Promise(resolve => {
    let timer
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    if (signal?.aborted) { resolve(); return }
    timer = setTimeout(finish, delayMs)
    signal?.addEventListener('abort', finish, { once: true })
  })
}

module.exports = { resolveToolInvocationPolicy, waitForRetry }
