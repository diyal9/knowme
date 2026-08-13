'use strict'

const TAXONOMY_LABELS = [
  'missing_tool',
  'wrong_tool_args',
  'ungrounded_claim',
  'context_drift',
  'recovery_fail',
  'timeout',
]

function deriveFailureTaxonomy(result = {}) {
  const labels = []
  const dimensions = result.dimensions || {}
  const failReasons = result.failReasons || []
  const report = result.report || {}
  const text = String(report.text || report.fullText || '')

  if (dimensions.toolChoice === 0) labels.push('missing_tool')
  if (typeof dimensions.toolArgs === 'number' && dimensions.toolArgs < 1) labels.push('wrong_tool_args')
  if (dimensions.factFaithfulness === 0 || dimensions.ungroundedClaimRate === 0) {
    labels.push('ungrounded_claim')
  }
  if (typeof dimensions.contextContinuity === 'number' && dimensions.contextContinuity < 0.9) {
    labels.push('context_drift')
  }
  if (dimensions.recoveryPassRate === 0 || dimensions.recoveryPass === 0) {
    labels.push('recovery_fail')
  }
  if (
    report.terminal === 'ERROR'
    || failReasons.some(r => /timeout/i.test(r))
    || /timeout/i.test(String(report.error || ''))
  ) {
    labels.push('timeout')
  }
  if (!labels.length && !result.passed && text.includes('尚未')) {
    labels.push('missing_tool')
  }
  return [...new Set(labels.filter(l => TAXONOMY_LABELS.includes(l)))]
}

function buildFailureRecord(result = {}) {
  const taxonomy = deriveFailureTaxonomy(result)
  const primary = taxonomy[0] || (result.passed ? null : 'unknown')
  return {
    scenario: result.name,
    passed: result.passed,
    dimension: primary,
    failReason: (result.failReasons || [])[0] || null,
    taxonomy,
    trace: `${result.name || 'unknown'} × ${primary || 'pass'} × ${taxonomy.join(',') || 'none'}`,
  }
}

module.exports = {
  TAXONOMY_LABELS,
  deriveFailureTaxonomy,
  buildFailureRecord,
}
