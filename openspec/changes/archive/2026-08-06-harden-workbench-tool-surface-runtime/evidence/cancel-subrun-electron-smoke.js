'use strict'

/**
 * Electron smoke: parent cancel propagates to subRun registry (mock, no live LLM).
 * Run: node openspec/changes/harden-workbench-tool-surface-runtime/evidence/cancel-subrun-electron-smoke.js
 */

const fs = require('fs')
const path = require('path')
const orchestration = require('../../../../src/lib/agent-orchestration')

const OUT = path.join(__dirname, 'cancel-subrun-electron-smoke.json')

function main() {
  orchestration.runStateStore.map.clear()
  const parentRunId = `run_smoke_${Date.now()}`
  const state = orchestration.getOrchestrationState(parentRunId)
  state.registerSubRun({ id: 'sub_smoke_1', status: 'running', startedAt: Date.now() })
  const activeSubRuns = new Map()
  activeSubRuns.set('sub_smoke_1', { abort: () => {}, parentRunId })

  const t0 = Date.now()
  const result = orchestration.cancelAllSubRuns(parentRunId, {
    cancelSubRun: (subId) => {
      const sub = activeSubRuns.get(subId)
      if (sub) activeSubRuns.delete(subId)
    },
  })
  const elapsed = Date.now() - t0

  const payload = {
    ok: result.cancelled.length === 1 && result.withinBudget && activeSubRuns.size === 0,
    parentRunId,
    cancelled: result.cancelled,
    elapsedMs: elapsed,
    withinBudget: result.withinBudget,
    leakCount: state.runningLeakCount(),
    at: new Date().toISOString(),
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')
  console.log(JSON.stringify(payload, null, 2))
  process.exit(payload.ok ? 0 : 1)
}

main()
