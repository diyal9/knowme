'use strict'

/**
 * Fail-fast dependency checks for IPC register* modules.
 * Prevents "passed in bag but never destructured / never passed" silent undefineds.
 */

function assertRequiredDeps(deps, required, scope = 'ipc') {
  const bag = deps && typeof deps === 'object' ? deps : {}
  const missing = []
  for (const key of required) {
    const value = bag[key]
    if (value == null) {
      missing.push(key)
      continue
    }
    // Optional soft check: common injectable callables
    if (typeof value === 'undefined') missing.push(key)
  }
  if (missing.length) {
    throw new Error(`[${scope}] missing required deps: ${missing.join(', ')}`)
  }
  return true
}

module.exports = { assertRequiredDeps }
