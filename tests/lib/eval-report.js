'use strict'

const { buildFailureRecord } = require('./eval-taxonomy')

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function collectLatencies(results = []) {
  return results
    .map(r => r.metrics?.latencyMs ?? r.report?.durationMs ?? null)
    .filter(v => typeof v === 'number' && Number.isFinite(v))
}

function summarizeFailureDistribution(results = []) {
  const dist = {}
  for (const result of results) {
    if (result.passed) continue
    const record = buildFailureRecord(result)
    for (const label of record.taxonomy.length ? record.taxonomy : ['unknown']) {
      dist[label] = (dist[label] || 0) + 1
    }
  }
  return dist
}

function summarizeDimensionScores(results = []) {
  const dims = {}
  for (const result of results) {
    for (const [dim, score] of Object.entries(result.dimensions || {})) {
      if (!dims[dim]) dims[dim] = []
      dims[dim].push(score)
    }
  }
  const out = {}
  for (const [dim, scores] of Object.entries(dims)) {
    const sum = scores.reduce((a, b) => a + b, 0)
    out[dim] = {
      avg: scores.length ? sum / scores.length : 0,
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      samples: scores.length,
    }
  }
  return out
}

function enrichSummary(baseSummary, results, meta = {}) {
  const latencies = collectLatencies(results)
  const failures = results.filter(r => !r.passed)
  return {
    ...baseSummary,
    ...meta,
    passRate: baseSummary.total ? baseSummary.passed / baseSummary.total : 0,
    latency: {
      p50: percentile(latencies, 50),
      p90: percentile(latencies, 90),
      max: latencies.length ? Math.max(...latencies) : 0,
      samples: latencies.length,
    },
    failureDistribution: summarizeFailureDistribution(results),
    dimensionSummary: summarizeDimensionScores(results),
    failures: failures.map(buildFailureRecord),
    results: results.map(r => ({
      ...r,
      failureRecord: buildFailureRecord(r),
    })),
  }
}

function buildEnhancedMarkdownReport(summary) {
  const lines = [
    `# ${summary.suiteMeta?.title || 'Agent Eval Report'}`,
    '',
    `- Layer: ${summary.layer || summary.suiteMeta?.layer || 'n/a'}`,
    `- Suite: ${summary.suite}`,
    `- Baseline: ${summary.baseline}`,
    `- Gate: ${summary.suiteMeta?.gateLevel || summary.gateLevel || 'n/a'}`,
    `- Passed: ${summary.passed}/${summary.total} (${(summary.passRate * 100).toFixed(1)}%)`,
    `- Duration: ${summary.durationMs}ms`,
    `- Latency p50/p90: ${summary.latency?.p50 ?? 0}ms / ${summary.latency?.p90 ?? 0}ms`,
    '',
  ]

  if (summary.failureDistribution && Object.keys(summary.failureDistribution).length) {
    lines.push('## Failure Taxonomy', '')
    for (const [label, count] of Object.entries(summary.failureDistribution)) {
      lines.push(`- ${label}: ${count}`)
    }
    lines.push('')
  }

  if (summary.dimensionSummary && Object.keys(summary.dimensionSummary).length) {
    lines.push('## Dimension Summary', '')
    lines.push('| Dimension | Avg | Min | Max |')
    lines.push('|---|---:|---:|---:|')
    for (const [dim, stats] of Object.entries(summary.dimensionSummary)) {
      lines.push(`| ${dim} | ${stats.avg.toFixed(3)} | ${stats.min.toFixed(3)} | ${stats.max.toFixed(3)} |`)
    }
    lines.push('')
  }

  lines.push('## Scenarios', '')
  for (const item of summary.results || []) {
    lines.push(`### ${item.name} — ${item.passed ? 'PASS' : 'FAIL'}`)
    lines.push('')
    if (item.metrics) {
      lines.push(`Metrics: latency=${item.metrics.latencyMs ?? 'n/a'}ms, rounds=${item.metrics.rounds ?? 'n/a'}, toolCalls=${item.metrics.toolCalls ?? 'n/a'}`)
      lines.push('')
    }
    lines.push('| Dimension | Score |')
    lines.push('|---|---|')
    for (const [dim, score] of Object.entries(item.dimensions || {})) {
      lines.push(`| ${dim} | ${score} |`)
    }
    if (item.failureRecord?.taxonomy?.length) {
      lines.push('', `Taxonomy: ${item.failureRecord.taxonomy.join(', ')}`)
    }
    if (item.failReasons?.length) lines.push('', `Fail reasons: ${item.failReasons.join('; ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

module.exports = {
  percentile,
  collectLatencies,
  summarizeFailureDistribution,
  summarizeDimensionScores,
  enrichSummary,
  buildEnhancedMarkdownReport,
}
