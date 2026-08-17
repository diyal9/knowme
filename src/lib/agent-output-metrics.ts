'use strict'

const ALLOWED_DIAGNOSTIC_KEYS = new Set([
  'at',
  'code',
  'count',
  'hash',
  'lane',
  'length',
  'phase',
  'prevLength',
  'nextLength',
  'reason',
  'round',
  'runId',
  'seq',
  'timingMs',
  'type',
])

const FORBIDDEN_KEY_PATTERN = /(?:^|_)(text|content|body|reasoning|thought|apikey|api_key|secret|token|password|summary|payload|result|toolresult|message|prompt|arguments|args|inner|raw)(?:$|_)/i
const FORBIDDEN_VALUE_PATTERN = /(?:sk-[a-z0-9]{10,}|```suggestion|"action"\s*:\s*"send"|"reasoning"\s*:|chain-of-thought)/i

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeDiagnosticEntry(entry = {}) {
  const out = {}
  for (const [key, value] of Object.entries(entry || {})) {
    if (!ALLOWED_DIAGNOSTIC_KEYS.has(key)) continue
    if (value == null) continue
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
      continue
    }
    if (typeof value === 'string') {
      const clipped = value.slice(0, 64)
      if (FORBIDDEN_VALUE_PATTERN.test(clipped)) continue
      out[key] = clipped
      continue
    }
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

function sanitizeOutputDiagnostics(diagnostics = [], limit = 24) {
  const list = Array.isArray(diagnostics) ? diagnostics : []
  return list
    .map(item => sanitizeDiagnosticEntry(item))
    .filter(item => Object.keys(item).length > 0)
    .slice(-limit)
}

function collectSensitiveKeys(value, path = '', hits = []) {
  if (value == null) return hits
  if (typeof value === 'string') {
    if (FORBIDDEN_VALUE_PATTERN.test(value)) hits.push(path || '<root>')
    return hits
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveKeys(item, `${path}[${index}]`, hits))
    return hits
  }
  if (!isPlainObject(value)) return hits
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key
    if (FORBIDDEN_KEY_PATTERN.test(key)) hits.push(nextPath)
    collectSensitiveKeys(nested, nextPath, hits)
  }
  return hits
}

function assertNoSensitiveFields(value) {
  const hits = collectSensitiveKeys(value)
  if (hits.length) {
    throw new Error(`sensitive fields detected: ${hits.slice(0, 8).join(', ')}`)
  }
  return true
}

function buildCommitMetrics({ runStartedAt, commitAt, firstTokenMs, assemblerDiagnostics = [], extra = [] }) {
  const answerCommitMs = Math.max(0, commitAt - runStartedAt)
  const bufferMs = firstTokenMs != null ? Math.max(0, answerCommitMs - firstTokenMs) : null
  const outputDiagnostics = sanitizeOutputDiagnostics([
    ...extra,
    ...(Array.isArray(assemblerDiagnostics) ? assemblerDiagnostics : []),
  ])
  return { answerCommitMs, bufferMs, outputDiagnostics }
}

module.exports = {
  ALLOWED_DIAGNOSTIC_KEYS,
  sanitizeDiagnosticEntry,
  sanitizeOutputDiagnostics,
  collectSensitiveKeys,
  assertNoSensitiveFields,
  buildCommitMetrics,
}
