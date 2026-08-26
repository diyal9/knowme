'use strict'

const assert = require('node:assert/strict')
const { describe, it, beforeEach } = require('node:test')
const engine = require('../src/lib/context-engine')

describe('context-engine metrics', () => {
  beforeEach(() => engine.resetContextEngineMetrics())

  it('aggregates privacy-safe latency, fallback, cache and token metrics', () => {
    engine.recordContextSemanticTelemetry({
      mode: 'active', status: 'degraded', reason: 'timeout', latencyMs: 1200,
      cacheHits: 3, requested: 1, wouldChange: false,
    }, { cacheEntries: 3, cacheBytes: 96, inFlight: 0, circuits: 1 })
    engine.recordContextAssembly({
      estimatedTokens: 400,
      savedEstimatedTokens: 600,
      included: [{ trust: 'trusted', projectedRole: 'system', critical: true, truncated: false }],
      omitted: [{ reason: 'budget' }],
    }, 2)
    const snapshot = engine.contextEngineMetricsSnapshot()
    assert.equal(snapshot.counters['context.semantic.degraded'], 1)
    assert.equal(snapshot.ratios.cacheHit, 0.75)
    assert.equal(snapshot.histograms['context.assembly.tokens_saved'].p95, 600)
    assert.equal(JSON.stringify(snapshot).includes('timeout'), true)
    assert.equal(JSON.stringify(snapshot).includes('prompt'), false)
  })

  it('marks trust and critical truncation invariant violations as degraded', () => {
    engine.recordContextAssembly({
      included: [
        { trust: 'untrusted', projectedRole: 'system', critical: false, truncated: false },
        { trust: 'trusted', projectedRole: 'system', critical: true, truncated: true },
      ],
      omitted: [],
    }, 1)
    const snapshot = engine.contextEngineMetricsSnapshot()
    assert.equal(snapshot.slo.status, 'degraded')
    assert.deepEqual(snapshot.slo.violations.sort(), ['critical_context_truncated', 'untrusted_system_projection'])
  })
})
