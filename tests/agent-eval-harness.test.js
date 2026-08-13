'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { loadFixtures, runEvalFixture, runAllEvals } = require('./agent-eval-harness')

describe('agent-eval-harness', () => {
  const fixtures = loadFixtures()

  it('loads baseline fixtures', () => {
    assert.ok(fixtures.length >= 7, `expected >=7 fixtures, got ${fixtures.length}`)
    const names = fixtures.map(f => f.name)
    for (const expected of [
      'chat-simple',
      'knowledge-tool',
      'tool-recovery',
      'plan-incomplete',
      'grounding-inject',
      'cancel-mid-model',
      'error-no-api-key',
    ]) {
      assert.ok(names.includes(expected), `missing fixture ${expected}`)
    }
  })

  for (const fixture of fixtures) {
    it(`eval: ${fixture.name}`, async () => {
      const result = await runEvalFixture(fixture)
      if (!result.passed) {
        assert.fail(result.diff || `eval ${fixture.name} failed`)
      }
      assert.equal(result.passed, true)
      assert.ok(result.report)
    })
  }

  it('runAllEvals summary all pass offline', async () => {
    const results = await runAllEvals()
    const failed = results.filter(r => !r.passed)
    assert.equal(failed.length, 0, failed.map(f => f.diff).join('\n'))
  })

  it('stage events include runPhase metadata', async () => {
    const fixture = fixtures.find(f => f.name === 'chat-simple')
    const result = await runEvalFixture(fixture)
    assert.ok(result.events.some(e =>
      e.runPhase === 'PREPARE' || e.runPhase === 'MODEL'
      || e.phase === 'PREPARE' || e.phase === 'MODEL'
      || e.payload?.runPhase === 'PREPARE' || e.payload?.runPhase === 'MODEL',
    ))
  })
})
