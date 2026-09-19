'use strict'

// Host-only, in-process attestation. Public fields explain the outcome, but
// cannot grant trust: provider JSON, spread copies and persisted results lose it.
const preDispatchFailures = new WeakSet()

/** Only call at a local rejection site BEFORE the effectful operation begins.
 * Never wrap a provider response, post-dispatch error, or recovered JSON here.
 */
function createPreDispatchFailure(code, text) {
  const result = Object.freeze({ ok: false, code: String(code), text: String(text),
    executionStarted: false, dispatchStatus: 'not_dispatched' })
  preDispatchFailures.add(result)
  return result
}

function isTrustedPreDispatchFailure(result) {
  return Boolean(result && typeof result === 'object' && preDispatchFailures.has(result))
}

module.exports = { createPreDispatchFailure, isTrustedPreDispatchFailure }
