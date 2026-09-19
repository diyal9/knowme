'use strict'

/**
 * Local Brain persistence. The store keeps only cognition, references and
 * provider metadata; knowledge bodies remain in their original repositories.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SCHEMA_VERSION = 1
const FILES = Object.freeze({
  nodes: 'nodes.json',
  claims: 'claims.json',
  evidence: 'evidence.json',
  proposals: 'proposals.json',
  providers: 'provider-catalog.json',
  layout: 'layout.json',
  state: 'state.json',
})

const NODE_KINDS = new Set([
  'self', 'person', 'project', 'goal', 'decision', 'preference', 'problem',
  'task', 'concept', 'source', 'collection',
])
const CLAIM_STATUSES = new Set([
  'observed', 'inferred', 'confirmed', 'rejected', 'superseded', 'expired',
])
const PROPOSAL_KINDS = new Set(['cognition', 'behavior', 'capability', 'conflict', 'expiry'])
const PROPOSAL_TARGETS = new Set(['brain', 'partner_profile', 'capability'])
const PROPOSAL_STATUSES = new Set(['pending', 'confirmed', 'rejected', 'snoozed'])

function brainDir(userData) {
  return path.join(userData, 'knowledge-os', 'brain')
}

function filePath(userData, key) {
  return path.join(brainDir(userData), FILES[key])
}

function now() {
  return new Date().toISOString()
}

function stableId(prefix, value) {
  const hash = crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 18)
  return `${prefix}_${hash}`
}

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    migrationVersion: 0,
    createdAt: now(),
    updatedAt: now(),
    lastRebuiltAt: null,
    stats: { nodes: 0, claims: 0, evidence: 0, proposals: 0, providers: 0 },
  }
}

function defaultFor(key) {
  if (key === 'layout') return { version: 1, positions: {}, updatedAt: now() }
  if (key === 'state') return emptyState()
  return { version: 1, items: [], updatedAt: now() }
}

function readJson(file, fallback) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    return value && typeof value === 'object' ? value : fallback
  } catch {
    try {
      const value = JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'))
      return value && typeof value === 'object' ? value : fallback
    } catch { return fallback }
  }
}

function writeAtomic(file, value) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const temp = `${file}.knowme-${crypto.randomBytes(4).toString('hex')}.tmp`
  const previous = `${file}.previous`
  const backup = `${file}.bak`
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  try {
    if (fs.existsSync(file)) {
      try {
        JSON.parse(fs.readFileSync(file, 'utf8'))
        fs.copyFileSync(file, backup)
      } catch { /* retain the last known-good backup */ }
      fs.renameSync(file, previous)
    }
    fs.renameSync(temp, file)
    if (fs.existsSync(previous)) fs.unlinkSync(previous)
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch { /* cleanup */ }
    try { if (!fs.existsSync(file) && fs.existsSync(previous)) fs.renameSync(previous, file) } catch { /* restore best effort */ }
    throw error
  }
}

function ensureBrain(userData) {
  fs.mkdirSync(brainDir(userData), { recursive: true })
  for (const key of Object.keys(FILES)) {
    const file = filePath(userData, key)
    if (!fs.existsSync(file)) writeAtomic(file, defaultFor(key))
  }
  return brainDir(userData)
}

function readCollection(userData, key) {
  ensureBrain(userData)
  const data = readJson(filePath(userData, key), defaultFor(key))
  return Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : [])
}

function writeCollection(userData, key, items) {
  writeAtomic(filePath(userData, key), { version: 1, items, updatedAt: now() })
  refreshState(userData)
  return items
}

function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeNode(input = {}) {
  const timestamp = now()
  const kind = NODE_KINDS.has(input.kind) ? input.kind : 'concept'
  const label = clean(input.label || input.title || '未命名', 160) || '未命名'
  return {
    id: clean(input.id, 220) || stableId('node', `${kind}:${label}`),
    kind,
    label,
    summary: clean(input.summary, 1200),
    tags: [...new Set((Array.isArray(input.tags) ? input.tags : []).map(item => clean(item, 50)).filter(Boolean))].slice(0, 20),
    scope: ['global', 'project', 'session', 'organization'].includes(input.scope) ? input.scope : 'global',
    projectId: clean(input.projectId, 100) || undefined,
    authority: Math.max(1, Math.min(5, Number(input.authority) || 2)),
    sourceRef: clean(input.sourceRef || input.path || input.extRef, 500) || undefined,
    providerId: clean(input.providerId || input.kbId, 160) || undefined,
    collectionId: clean(input.collectionId, 160) || undefined,
    external: input.external === true,
    stale: input.stale === true,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

function normalizeClaim(input = {}) {
  const timestamp = now()
  const subjectId = clean(input.subjectId || input.from, 220)
  const predicate = clean(input.predicate || input.type || 'relatesTo', 100) || 'relatesTo'
  const objectNodeId = clean(input.objectNodeId || input.to, 220) || undefined
  const value = input.value == null ? undefined : input.value
  return {
    id: clean(input.id, 220) || stableId('claim', `${subjectId}:${predicate}:${objectNodeId || JSON.stringify(value)}`),
    subjectId,
    predicate,
    objectNodeId,
    value,
    status: CLAIM_STATUSES.has(input.status) ? input.status : 'confirmed',
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 0.8)),
    scope: clean(input.scope || 'global', 100) || 'global',
    projectId: clean(input.projectId, 100) || undefined,
    validFrom: input.validFrom || undefined,
    validTo: input.validTo || undefined,
    evidenceRefs: [...new Set((Array.isArray(input.evidenceRefs) ? input.evidenceRefs : []).map(item => clean(item, 220)).filter(Boolean))],
    weight: Number.isFinite(Number(input.weight)) ? Math.max(0, Math.min(1, Number(input.weight))) : undefined,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

function normalizeEvidence(input = {}) {
  const timestamp = now()
  const type = ['conversation', 'local_file', 'llmwiki', 'gitlab', 'ragflow', 'remote_rag'].includes(input.type)
    ? input.type
    : 'local_file'
  const title = clean(input.title || input.documentRef || '来源', 180) || '来源'
  return {
    id: clean(input.id, 220) || stableId('evidence', `${type}:${input.providerId || ''}:${input.collectionId || ''}:${input.documentRef || title}`),
    type,
    projectId: clean(input.projectId, 100) || undefined,
    sourceId: clean(input.sourceId, 160) || undefined,
    filePath: clean(input.filePath || input.path, 500) || undefined,
    taskId: clean(input.taskId, 100) || undefined,
    runId: clean(input.runId, 160) || undefined,
    providerId: clean(input.providerId, 160) || undefined,
    collectionId: clean(input.collectionId, 160) || undefined,
    documentRef: clean(input.documentRef, 500) || undefined,
    title,
    snippet: clean(input.snippet, 800) || undefined,
    contentHash: clean(input.contentHash, 160) || undefined,
    persistence: ['local', 'reference', 'ephemeral'].includes(input.persistence) ? input.persistence : 'reference',
    capturedAt: input.capturedAt || timestamp,
    expiresAt: input.expiresAt || undefined,
  }
}

function normalizeProposal(input = {}) {
  const timestamp = now()
  const kind = PROPOSAL_KINDS.has(input.kind) ? input.kind : 'cognition'
  const summary = clean(input.summary || input.title || '新的理解', 300) || '新的理解'
  return {
    id: clean(input.id, 220) || stableId('proposal', `${kind}:${summary}:${timestamp}`),
    kind,
    targetType: PROPOSAL_TARGETS.has(input.targetType) ? input.targetType : 'brain',
    status: PROPOSAL_STATUSES.has(input.status) ? input.status : 'pending',
    projectId: clean(input.projectId, 100) || undefined,
    summary,
    rationale: clean(input.rationale, 1200),
    effects: Array.isArray(input.effects) ? input.effects.slice(0, 50) : [],
    evidenceRefs: [...new Set((Array.isArray(input.evidenceRefs) ? input.evidenceRefs : []).map(item => clean(item, 220)).filter(Boolean))],
    fingerprint: clean(input.fingerprint, 160) || undefined,
    category: ['about', 'project', 'relation', 'conflict', 'capability'].includes(input.category) ? input.category : undefined,
    confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(1, Number(input.confidence))) : undefined,
    impact: clean(input.impact, 600) || undefined,
    sourceRef: clean(input.sourceRef, 500) || undefined,
    sourceLabel: clean(input.sourceLabel, 180) || undefined,
    memoryPatternId: clean(input.memoryPatternId, 180) || undefined,
    observationCount: Math.max(1, Number(input.observationCount) || 1),
    lastObservedAt: input.lastObservedAt || timestamp,
    snoozedUntil: input.snoozedUntil || undefined,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

function upsert(items, item) {
  const index = items.findIndex(current => current.id === item.id)
  if (index >= 0) items[index] = { ...items[index], ...item, createdAt: items[index].createdAt || item.createdAt }
  else items.push(item)
  return item
}

function upsertNode(userData, input) {
  const items = readCollection(userData, 'nodes')
  const item = normalizeNode(input)
  upsert(items, item)
  writeCollection(userData, 'nodes', items)
  return item
}

function upsertClaim(userData, input) {
  const items = readCollection(userData, 'claims')
  const item = normalizeClaim(input)
  if (!item.subjectId || (!item.objectNodeId && item.value == null)) throw new Error('Brain Claim 缺少主语或宾语')
  if (!item.evidenceRefs.length) throw new Error('Brain Claim 必须引用至少一项 Evidence')
  const evidenceIds = new Set(readCollection(userData, 'evidence').map(evidence => evidence.id))
  if (item.evidenceRefs.some(ref => !evidenceIds.has(ref))) throw new Error('Brain Claim 引用了不存在的 Evidence')
  upsert(items, item)
  writeCollection(userData, 'claims', items)
  return item
}

function upsertEvidence(userData, input) {
  const items = readCollection(userData, 'evidence')
  const item = normalizeEvidence(input)
  upsert(items, item)
  writeCollection(userData, 'evidence', items)
  return item
}

function upsertProposal(userData, input) {
  const items = readCollection(userData, 'proposals')
  const item = normalizeProposal(input)
  upsert(items, item)
  writeCollection(userData, 'proposals', items)
  return item
}

function saveProviders(userData, providers) {
  const items = Array.isArray(providers) ? providers.map(item => ({ ...item, apiKey: undefined })) : []
  writeCollection(userData, 'providers', items)
  return items
}

function updateProvider(userData, providerId, patch = {}) {
  const items = readCollection(userData, 'providers')
  const index = items.findIndex(item => item.id === providerId)
  if (index < 0) return null
  items[index] = { ...items[index], ...patch, id: items[index].id, apiKey: undefined }
  writeCollection(userData, 'providers', items)
  return items[index]
}

function recordProviderQuery(userData, input = {}) {
  const items = readCollection(userData, 'providers')
  const index = items.findIndex(item => item.id === input.providerId)
  if (index < 0) return null
  const timestamp = input.queriedAt || now()
  const recentQueries = [
    {
      collectionId: clean(input.collectionId, 160) || undefined,
      queryHash: clean(input.queryHash, 160),
      hitCount: Math.max(0, Number(input.hitCount) || 0),
      status: clean(input.status || 'ok', 40),
      latencyMs: Math.max(0, Number(input.latencyMs) || 0),
      queriedAt: timestamp,
    },
    ...(Array.isArray(items[index].recentQueries) ? items[index].recentQueries : []),
  ].slice(0, 10)
  items[index] = {
    ...items[index],
    lastQueryAt: timestamp,
    lastQueryStatus: clean(input.status || 'ok', 40),
    recentQueries,
  }
  writeCollection(userData, 'providers', items)
  return items[index]
}

function saveLayout(userData, positions) {
  const safePositions = {}
  if (positions && typeof positions === 'object') {
    for (const [rawId, point] of Object.entries(positions).slice(0, 1000)) {
      const id = clean(rawId, 220)
      const x = Number(point?.x)
      const y = Number(point?.y)
      if (id && Number.isFinite(x) && Number.isFinite(y)) {
        safePositions[id] = { x: Math.max(-10000, Math.min(10000, x)), y: Math.max(-10000, Math.min(10000, y)) }
      }
    }
  }
  const layout = { version: 1, positions: safePositions, updatedAt: now() }
  writeAtomic(filePath(userData, 'layout'), layout)
  return layout
}

function updateState(userData, patch = {}) {
  ensureBrain(userData)
  const state = readJson(filePath(userData, 'state'), emptyState())
  const next = { ...state, ...patch, schemaVersion: SCHEMA_VERSION, updatedAt: now() }
  writeAtomic(filePath(userData, 'state'), next)
  return next
}

function refreshState(userData) {
  ensureBrain(userData)
  const state = readJson(filePath(userData, 'state'), emptyState())
  const stats = {
    nodes: readCollectionRaw(userData, 'nodes').length,
    claims: readCollectionRaw(userData, 'claims').length,
    evidence: readCollectionRaw(userData, 'evidence').length,
    proposals: readCollectionRaw(userData, 'proposals').filter(item => item.status === 'pending').length,
    providers: readCollectionRaw(userData, 'providers').length,
  }
  const next = { ...state, schemaVersion: SCHEMA_VERSION, updatedAt: now(), stats }
  writeAtomic(filePath(userData, 'state'), next)
  return next
}

function readCollectionRaw(userData, key) {
  const data = readJson(filePath(userData, key), defaultFor(key))
  return Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : [])
}

function snapshot(userData) {
  ensureBrain(userData)
  const nodes = readCollectionRaw(userData, 'nodes')
  const claims = readCollectionRaw(userData, 'claims')
  const evidence = readCollectionRaw(userData, 'evidence')
  const proposals = readCollectionRaw(userData, 'proposals')
  const providers = readCollectionRaw(userData, 'providers')
  const persistedState = readJson(filePath(userData, 'state'), emptyState())
  const stats = {
    nodes: nodes.length,
    claims: claims.length,
    evidence: evidence.length,
    proposals: proposals.filter(item => item.status === 'pending').length,
    providers: providers.length,
  }
  const state = { ...persistedState, schemaVersion: SCHEMA_VERSION, stats }
  const layout = readJson(filePath(userData, 'layout'), defaultFor('layout'))
  return {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    nodes,
    claims,
    evidence,
    proposals,
    providers,
    layout,
    state,
    stats,
  }
}

module.exports = {
  SCHEMA_VERSION,
  FILES,
  NODE_KINDS,
  CLAIM_STATUSES,
  brainDir,
  filePath,
  stableId,
  ensureBrain,
  readCollection,
  writeCollection,
  normalizeNode,
  normalizeClaim,
  normalizeEvidence,
  normalizeProposal,
  upsertNode,
  upsertClaim,
  upsertEvidence,
  upsertProposal,
  saveProviders,
  updateProvider,
  recordProviderQuery,
  saveLayout,
  updateState,
  snapshot,
}
