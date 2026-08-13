'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const orchestration = require('../src/lib/agent-orchestration')

describe('agent-orchestration', () => {
  it('enforces sub run budget', async () => {
    orchestration.runStates.clear()
    const { handlers, state } = orchestration.buildOrchestrationTools({
      runId: 'orch-1',
      spawnSubRun: async () => ({ ok: true, text: 'done' }),
    })
    await handlers.delegate_to_expert({ expertId: 'e1', prompt: 'p1' })
    await handlers.delegate_to_expert({ expertId: 'e2', prompt: 'p2' })
    const r = await handlers.delegate_to_expert({ expertId: 'e3', prompt: 'p3' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'orchestration_depth_exceeded')
    assert.equal(state.subRuns.length, 2)
  })

  it('handoff_artifact records payload', async () => {
    const synced = []
    const { handlers, state } = orchestration.buildOrchestrationTools({
      runId: 'orch-2',
      syncHandoff: async (p) => { synced.push(p) },
    })
    const r = await handlers.handoff_artifact({ artifactIds: ['a1'], summary: 's' })
    assert.equal(r.ok, true)
    assert.equal(state.handoffs.length, 1)
    assert.equal(synced.length, 1)
  })

  it('parseOrchestrationFrontmatter reads limits', () => {
    const p = orchestration.parseOrchestrationFrontmatter({ orchestration: { maxSubRuns: 2, maxParallel: 1 } })
    assert.equal(p.orchestrationEnabled, true)
    assert.equal(p.maxSubRuns, 2)
  })

  it('cancelAll marks running sub runs cancelled', () => {
    const state = new orchestration.OrchestrationState('r')
    state.registerSubRun({ id: 's1', status: 'running' })
    const result = state.cancelAll({ cancelSubRun: () => {} })
    assert.equal(result.cancelled.length, 1)
  })
})
