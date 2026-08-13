'use strict'

/**
 * Workbench run phase mapping (browser + Node testable).
 */
;(function (root) {
  function runPhaseFromStatus(status, mode, terminalKind) {
    const value = String(status || '').toLowerCase()
    if (!value || value === 'idle') return 'idle'
    if (value === 'ready' || value === 'preparing') return 'preparing'
    if (value === 'running' || value === 'queued' || value === 'pending' || value === 'waiting' || value === 'blocked') {
      return 'running'
    }
    if (value === 'done' || value === 'success' || value === 'completed' || value === 'finished') {
      return 'completed'
    }
    if (value === 'failed' || value === 'error' || value === 'rejected') return 'failed'
    if (value === 'cancelled' || value === 'canceled') return 'cancelled'
    if (mode === 'daemon' && terminalKind === 'success') return 'completed'
    return 'running'
  }

  root.WorkbenchRunPhase = {
    runPhaseFromStatus: runPhaseFromStatus,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPhaseFromStatus: runPhaseFromStatus }
  }
})(typeof window !== 'undefined' ? window : globalThis)
