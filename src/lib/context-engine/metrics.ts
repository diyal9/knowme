'use strict'

const { createAgentRuntimeMetrics } = require('../agent-runtime-metrics')

const MIN_SLO_SAMPLE_SIZE = 20
const SLO = Object.freeze({
  assemblyP95Ms: 10,
  semanticP95Ms: 1500,
  degradedRate: 0.05,
})

let runtime = createAgentRuntimeMetrics({ histogramLimit: 256 })

function safeKey(value, fallback = 'unknown') {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48)
  return key || fallback
}

function recordContextSemanticTelemetry(telemetry = {}, cacheStats = {}) {
  const mode = safeKey(telemetry.mode, 'off')
  const status = safeKey(telemetry.status, 'skipped')
  const reason = safeKey(telemetry.reason, 'none')
  runtime.increment('context.turns')
  runtime.increment(`context.semantic.mode.${mode}`)
  runtime.increment(`context.semantic.status.${status}`, 1, { code: reason, outcome: status })
  if (mode !== 'off' && status !== 'skipped') runtime.increment('context.semantic.attempts')
  if (status === 'degraded') runtime.increment('context.semantic.degraded', 1, { code: reason })
  if (reason === 'circuit_open') runtime.increment('context.semantic.circuit_open')
  if (telemetry.wouldChange === true) runtime.increment('context.semantic.would_change')
  runtime.increment('context.semantic.cache_hits', Number(telemetry.cacheHits) || 0)
  runtime.increment('context.semantic.requested_vectors', Number(telemetry.requested) || 0)
  if (mode !== 'off' && status !== 'skipped') {
    runtime.observe('context.semantic.latency_ms', Number(telemetry.latencyMs) || 0)
  }
  runtime.gauge('context.semantic.cache_entries', Number(cacheStats.cacheEntries) || 0)
  runtime.gauge('context.semantic.cache_bytes', Number(cacheStats.cacheBytes) || 0)
  runtime.gauge('context.semantic.in_flight', Number(cacheStats.inFlight) || 0)
  runtime.gauge('context.semantic.circuits', Number(cacheStats.circuits) || 0)
}

function recordContextAssembly(manifest = {}, latencyMs = 0) {
  runtime.increment('context.assemblies')
  runtime.observe('context.assembly.latency_ms', latencyMs)
  runtime.observe('context.assembly.tokens_used', Number(manifest.estimatedTokens) || 0)
  runtime.observe('context.assembly.tokens_saved', Number(manifest.savedEstimatedTokens) || 0)
  runtime.increment('context.blocks.included', Array.isArray(manifest.included) ? manifest.included.length : 0)
  runtime.increment('context.blocks.omitted', Array.isArray(manifest.omitted) ? manifest.omitted.length : 0)
  const unsafeProjection = (manifest.included || []).filter(item => item.trust === 'untrusted' && item.projectedRole === 'system').length
  const truncatedCritical = (manifest.included || []).filter(item => item.critical === true && item.truncated === true).length
  if (unsafeProjection) runtime.increment('context.invariant.untrusted_system', unsafeProjection)
  if (truncatedCritical) runtime.increment('context.invariant.critical_truncated', truncatedCritical)
}

function recordCriticalBudgetFailure() {
  runtime.increment('context.critical_budget_rejections')
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0
}

function contextEngineMetricsSnapshot(cacheStats = {}) {
  const base = runtime.snapshot({
    'context.semantic.cache_entries': Number(cacheStats.cacheEntries) || 0,
    'context.semantic.cache_bytes': Number(cacheStats.cacheBytes) || 0,
    'context.semantic.in_flight': Number(cacheStats.inFlight) || 0,
    'context.semantic.circuits': Number(cacheStats.circuits) || 0,
  })
  const counters = base.counters || {}
  const attempts = Number(counters['context.semantic.attempts']) || 0
  const degraded = Number(counters['context.semantic.degraded']) || 0
  const hits = Number(counters['context.semantic.cache_hits']) || 0
  const requested = Number(counters['context.semantic.requested_vectors']) || 0
  const assemblyP95 = Number(base.histograms?.['context.assembly.latency_ms']?.p95) || 0
  const semanticP95 = Number(base.histograms?.['context.semantic.latency_ms']?.p95) || 0
  const violations = []
  if ((Number(counters['context.invariant.untrusted_system']) || 0) > 0) violations.push('untrusted_system_projection')
  if ((Number(counters['context.invariant.critical_truncated']) || 0) > 0) violations.push('critical_context_truncated')
  if (assemblyP95 > SLO.assemblyP95Ms) violations.push('assembly_p95')
  if (attempts >= MIN_SLO_SAMPLE_SIZE && semanticP95 > SLO.semanticP95Ms) violations.push('semantic_p95')
  if (attempts >= MIN_SLO_SAMPLE_SIZE && ratio(degraded, attempts) > SLO.degradedRate) violations.push('semantic_degraded_rate')
  return {
    ...base,
    version: 1,
    ratios: {
      degraded: ratio(degraded, attempts),
      cacheHit: ratio(hits, hits + requested),
    },
    slo: {
      status: violations.length ? 'degraded' : attempts < MIN_SLO_SAMPLE_SIZE ? 'warming' : 'healthy',
      sampleSize: attempts,
      thresholds: SLO,
      violations,
    },
  }
}

function resetContextEngineMetrics() {
  runtime = createAgentRuntimeMetrics({ histogramLimit: 256 })
}

module.exports = {
  MIN_SLO_SAMPLE_SIZE,
  SLO,
  recordContextSemanticTelemetry,
  recordContextAssembly,
  recordCriticalBudgetFailure,
  contextEngineMetricsSnapshot,
  resetContextEngineMetrics,
}
