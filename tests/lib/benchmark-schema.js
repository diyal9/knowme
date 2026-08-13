'use strict'

const REQUIRED_RESULT_FIELDS = [
  'finalAnswer',
  'toolLogs',
  'evidenceRefs',
  'latencyMs',
  'rounds',
  'errors',
]

const REQUIRED_RUN_METADATA = [
  'taskVersion',
  'rubricVersion',
  'executedAt',
  'product',
]

function normalizeBenchmarkResult(raw = {}) {
  return {
    finalAnswer: raw.finalAnswer ?? raw.text ?? '',
    toolLogs: Array.isArray(raw.toolLogs) ? raw.toolLogs : [],
    evidenceRefs: Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : [],
    latencyMs: typeof raw.latencyMs === 'number' ? raw.latencyMs : 0,
    rounds: typeof raw.rounds === 'number' ? raw.rounds : 0,
    errors: Array.isArray(raw.errors) ? raw.errors : [],
    metadata: raw.metadata || {},
  }
}

function validateNormalizedResult(result = {}) {
  const missing = REQUIRED_RESULT_FIELDS.filter(f => result[f] == null)
  return { ok: missing.length === 0, missing }
}

function validateRunMetadata(meta = {}) {
  const missing = REQUIRED_RUN_METADATA.filter(f => !meta[f])
  return {
    ok: missing.length === 0,
    missing,
    invalidForOfficialCompare: missing.length > 0,
  }
}

function scoreTaskAgainstRubric(normalized, rubric = {}) {
  const dimensions = {}
  const failReasons = []
  const taxonomy = []

  if (rubric.requiredTools?.length) {
    const names = normalized.toolLogs.filter(t => t.status === 'ok').map(t => t.name)
    const missing = rubric.requiredTools.filter(t => !names.includes(t))
    dimensions.toolChoice = missing.length ? 0 : 1
    if (missing.length) {
      failReasons.push(`missing required tools: ${missing.join(', ')}`)
      taxonomy.push('missing_tool')
    }
  } else {
    dimensions.toolChoice = 1
  }

  const forbidden = rubric.forbiddenClaims || []
  const hits = forbidden.filter(token => token && String(normalized.finalAnswer).includes(token))
  dimensions.factFaithfulness = hits.length ? 0 : 1
  if (hits.length) {
    failReasons.push(`forbidden claims: ${hits.join(', ')}`)
    taxonomy.push('ungrounded_claim')
  }

  dimensions.taskCompletion = rubric.expectTerminal
    ? (normalized.metadata?.terminal === rubric.expectTerminal ? 1 : 0)
    : (normalized.errors.length ? 0 : 1)

  const passed = failReasons.length === 0 && Object.values(dimensions).every(v => v >= (rubric.minScore ?? 1))
  return { passed, dimensions, failReasons, taxonomy: [...new Set(taxonomy)] }
}

module.exports = {
  REQUIRED_RESULT_FIELDS,
  REQUIRED_RUN_METADATA,
  normalizeBenchmarkResult,
  validateNormalizedResult,
  validateRunMetadata,
  scoreTaskAgainstRubric,
}
