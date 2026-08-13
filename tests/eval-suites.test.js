'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { listSuites, resolveSuite, runSuite } = require('./lib/eval-suites')
const { deriveFailureTaxonomy, TAXONOMY_LABELS } = require('./lib/eval-taxonomy')
const { enrichSummary } = require('./lib/eval-report')
const { validateNormalizedResult, validateRunMetadata } = require('./lib/benchmark-schema')

describe('eval-suites registry', () => {
  it('lists layered suites with gate metadata', () => {
    const suites = listSuites()
    const ids = suites.map(s => s.id)
    assert.ok(ids.includes('hard-offline'))
    assert.ok(ids.includes('self-e2e-controlled'))
    assert.ok(ids.includes('cross-product-benchmark'))
    const l0 = resolveSuite('hard-offline')
    assert.equal(l0.layer, 'L0')
    assert.equal(l0.gateLevel, 'blocking')
    const l1 = resolveSuite('self-e2e-controlled')
    assert.equal(l1.gateLevel, 'advisory')
  })

  it('runs L0 hard-offline suite offline', async () => {
    const summary = await runSuite('hard-offline', { baselineName: 'v1' })
    assert.equal(summary.suite, 'hard-offline')
    assert.ok(summary.total >= 8)
    assert.equal(summary.passed, summary.total)
    assert.ok(summary.passRate === 1)
    assert.ok(typeof summary.latency.p50 === 'number')
  })
})

describe('eval taxonomy', () => {
  it('covers required labels', () => {
    for (const label of ['missing_tool', 'ungrounded_claim', 'recovery_fail', 'timeout']) {
      assert.ok(TAXONOMY_LABELS.includes(label))
    }
  })

  it('derives missing_tool from toolChoice failure', () => {
    const labels = deriveFailureTaxonomy({
      passed: false,
      dimensions: { toolChoice: 0 },
      failReasons: ['toolChoice: 0 < 1'],
      report: { text: '' },
    })
    assert.ok(labels.includes('missing_tool'))
  })
})

describe('eval report enrichment', () => {
  it('adds failure distribution and dimension summary', () => {
    const results = [
      { name: 'a', passed: true, dimensions: { toolChoice: 1 }, report: { durationMs: 10 }, failReasons: [] },
      { name: 'b', passed: false, dimensions: { toolChoice: 0 }, report: { durationMs: 20 }, failReasons: ['toolChoice'] },
    ]
    const summary = enrichSummary({ suite: 'hard-offline', baseline: 'v1', total: 2, passed: 1, durationMs: 30 }, results)
    assert.equal(summary.passRate, 0.5)
    assert.ok(summary.failureDistribution.missing_tool >= 1)
    assert.ok(summary.dimensionSummary.toolChoice)
  })
})

describe('benchmark schema fairness', () => {
  it('rejects official compare when metadata missing', () => {
    const check = validateRunMetadata({ product: 'knowme' })
    assert.equal(check.invalidForOfficialCompare, true)
    assert.ok(check.missing.includes('taskVersion'))
  })

  it('validates normalized adapter output fields', () => {
    const check = validateNormalizedResult({
      finalAnswer: 'ok',
      toolLogs: [],
      evidenceRefs: [],
      latencyMs: 1,
      rounds: 1,
      errors: [],
    })
    assert.equal(check.ok, true)
  })
})
