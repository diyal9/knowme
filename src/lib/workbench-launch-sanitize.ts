'use strict'

const VERSION = 1

const LIMITS = Object.freeze({
  step: 40,
  domain: 40,
  resourceType: 40,
  resourceId: 160,
  goal: 240,
  backend: 40,
  runId: 160,
  rootRunId: 160,
  slug: 80,
  executionSource: 40,
  status: 40,
  inputRefs: 32,
  returnStateDepth: 3,
  profileSnapshotDepth: 3,
})

const STEPS = Object.freeze(['intent', 'inputs', 'readiness', 'confirm', 'launch'])
const STATUSES = Object.freeze(['draft', 'ready', 'blocked', 'launching', 'launched', 'cancelled'])
const DOMAINS = Object.freeze(['office', 'engineering', 'visual', 'all'])
const RESOURCE_TYPES = Object.freeze(['pipeline', 'agent', 'graph', 'artifact', 'automation', 'composition'])
const LAUNCHED_STATUSES = new Set(['launching', 'launched'])
const RECOVERABLE_STATUSES = new Set(['draft', 'ready', 'blocked'])
const SECRET_KEY = /(?:token|secret|password|passwd|authorization|api[_-]?key|access[_-]?key|private[_-]?key|cookie|credential)/i

function nowIso() {
  return new Date().toISOString()
}

function text(value, max = 240) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function pickEnum(value, allowed, fallback = '') {
  const normalized = text(value, 80).toLowerCase()
  return allowed.includes(normalized) ? normalized : fallback
}

function safeTree(value, depth = 0, maxDepth = LIMITS.returnStateDepth) {
  if (depth > maxDepth || value === null || value === undefined) return undefined
  if (typeof value === 'string') return value.slice(0, 1000)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map(item => safeTree(item, depth + 1, maxDepth))
      .filter(item => item !== undefined)
  }
  if (typeof value !== 'object') return undefined
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue
    const safe = safeTree(item, depth + 1, maxDepth)
    if (safe !== undefined) result[String(key).slice(0, 80)] = safe
  }
  return Object.keys(result).length ? result : undefined
}

function normalizeInputRef(raw) {
  if (typeof raw === 'string') {
    const id = text(raw, 160)
    return id ? { id, kind: 'artifact' } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const id = text(raw.id || raw.path, 160)
  if (!id) return null
  return {
    id,
    kind: text(raw.kind, 40) || 'artifact',
    version: text(raw.version, 40),
    hash: text(raw.hash || raw.contentHash, 160),
    title: text(raw.title, 160),
    inputPath: Boolean(raw.inputPath),
  }
}

function normalizeInputRefs(value) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeInputRef)
    .filter(Boolean)
    .slice(0, LIMITS.inputRefs)
}

module.exports = {
  VERSION,
  LIMITS,
  STEPS,
  STATUSES,
  DOMAINS,
  RESOURCE_TYPES,
  LAUNCHED_STATUSES,
  RECOVERABLE_STATUSES,
  SECRET_KEY,
  nowIso,
  text,
  pickEnum,
  safeTree,
  normalizeInputRef,
  normalizeInputRefs,
}
