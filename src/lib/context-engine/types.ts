'use strict'

const AUTHORITY_ORDER = Object.freeze({
  platform: 500,
  scene: 400,
  persona: 300,
  data: 200,
  user: 100,
})

const KINDS = new Set([
  'core_instruction',
  'scene_instruction',
  'persona',
  'tool_contract',
  'task_fact',
  'retrieval',
  'memory',
  'skill',
  'user_preference',
  'user_input',
])

const AUTHORITIES = new Set(Object.keys(AUTHORITY_ORDER))
const TRUST_LEVELS = new Set(['trusted', 'untrusted'])
const CACHE_POLICIES = new Set(['stable', 'session', 'turn'])

const KIND_DEFAULTS = Object.freeze({
  core_instruction: { authority: 'platform', trust: 'trusted', cachePolicy: 'stable', priority: 100, critical: true },
  scene_instruction: { authority: 'scene', trust: 'trusted', cachePolicy: 'session', priority: 90, critical: true },
  persona: { authority: 'persona', trust: 'trusted', cachePolicy: 'session', priority: 85, critical: false },
  tool_contract: { authority: 'scene', trust: 'trusted', cachePolicy: 'stable', priority: 80, critical: true },
  task_fact: { authority: 'data', trust: 'trusted', cachePolicy: 'turn', priority: 75 },
  skill: { authority: 'data', trust: 'trusted', cachePolicy: 'session', priority: 65 },
  user_preference: { authority: 'data', trust: 'trusted', cachePolicy: 'session', priority: 55 },
  retrieval: { authority: 'data', trust: 'untrusted', cachePolicy: 'turn', priority: 45 },
  memory: { authority: 'data', trust: 'untrusted', cachePolicy: 'session', priority: 35 },
  user_input: { authority: 'user', trust: 'untrusted', cachePolicy: 'turn', priority: 100 },
})

function clean(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function list(value, max = 32) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => clean(item, 120))
    .filter(Boolean))].slice(0, max)
}

function positiveInt(value, fallback, max = 64000) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(1, Math.min(max, Math.round(n)))
}

function normalizeSource(source = {}) {
  const raw = source && typeof source === 'object' ? source : {}
  return {
    type: clean(raw.type || 'runtime', 48),
    id: clean(raw.id, 180),
    version: clean(raw.version, 80),
    label: clean(raw.label, 160),
  }
}

function normalizeAppliesTo(appliesTo = {}) {
  const raw = appliesTo && typeof appliesTo === 'object' ? appliesTo : {}
  return {
    scenes: list(raw.scenes),
    phases: list(raw.phases),
    tiers: list(raw.tiers),
    executionPolicies: list(raw.executionPolicies),
    locales: list(raw.locales),
    capabilityIds: list(raw.capabilityIds, 100),
  }
}

function normalizeContextBlock(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const kind = KINDS.has(raw.kind) ? raw.kind : 'retrieval'
  const defaults = KIND_DEFAULTS[kind]
  let authority = AUTHORITIES.has(raw.authority) ? raw.authority : defaults.authority
  const trust = TRUST_LEVELS.has(raw.trust) ? raw.trust : defaults.trust
  // External/untrusted text can never promote itself into an instruction authority.
  if (trust === 'untrusted' && ['platform', 'scene', 'persona'].includes(authority)) {
    authority = kind === 'user_input' ? 'user' : 'data'
  }
  const content = String(raw.content == null ? '' : raw.content).trim()
  if (!content) return null
  const id = clean(raw.id || `${kind}:${index + 1}`, 180)
  if (!id) return null
  const meta = raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {}
  return {
    id,
    kind,
    authority,
    trust,
    priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : defaults.priority,
    maxTokens: positiveInt(raw.maxTokens, 1600),
    source: normalizeSource(raw.source),
    locale: clean(raw.locale, 32),
    cachePolicy: CACHE_POLICIES.has(raw.cachePolicy) ? raw.cachePolicy : defaults.cachePolicy,
    appliesTo: normalizeAppliesTo(raw.appliesTo),
    optional: raw.optional === true,
    critical: raw.critical == null ? defaults.critical === true : raw.critical === true,
    explicit: raw.explicit === true,
    sensitive: raw.sensitive === true,
    content,
    meta,
    _index: index,
  }
}

function authorityRank(value) {
  return AUTHORITY_ORDER[value] || 0
}

module.exports = {
  AUTHORITY_ORDER,
  KINDS,
  KIND_DEFAULTS,
  clean,
  list,
  normalizeContextBlock,
  normalizeAppliesTo,
  normalizeSource,
  authorityRank,
}
