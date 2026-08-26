'use strict'

/**
 * Context Engine 的异步语义预排序层。
 * 网络与缓存止于此处；同步 assembler 只接收可选 vectorScores 和匿名 telemetry。
 */

const crypto = require('crypto')
const { cosineSimilarity } = require('../knowledge-rank')
const { normalizeContextBlock } = require('./types')
const { resolveContextPolicy, isBlockApplicable } = require('./policy')
const { selectOptionalBlocks } = require('./selector')

const SEMANTIC_KINDS = new Set(['retrieval', 'memory', 'skill', 'task_fact', 'user_preference'])
const MAX_VECTOR_CACHE_ENTRIES = 512
const MAX_VECTOR_CACHE_BYTES = 16 * 1024 * 1024
const MAX_SEMANTIC_CANDIDATES = 32
const MAX_SEMANTIC_TEXT_CHARS = 2000
const CIRCUIT_FAILURE_THRESHOLD = 3
const CIRCUIT_COOLDOWN_MS = 30000
const MAX_PROVIDER_STATES = 32

const vectorCache = new Map()
const inFlight = new Map()
const circuits = new Map()
const recordedFailureErrors = new WeakSet()
let vectorCacheBytes = 0

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16)
}

function semanticText(block) {
  const explicit = String(block?.meta?.embeddingText || '').trim()
  if (explicit) return explicit.slice(0, MAX_SEMANTIC_TEXT_CHARS)
  return [
    block?.meta?.description,
    ...(Array.isArray(block?.meta?.tags) ? block.meta.tags : []),
    String(block?.content || '').slice(0, MAX_SEMANTIC_TEXT_CHARS),
  ].filter(Boolean).join('\n').trim().slice(0, MAX_SEMANTIC_TEXT_CHARS)
}

function touchCache(key, vector) {
  const previous = vectorCache.get(key)
  if (previous) vectorCacheBytes -= previous.bytes
  vectorCache.delete(key)
  const bytes = Array.isArray(vector) ? vector.length * 8 : 0
  if (!bytes || bytes > MAX_VECTOR_CACHE_BYTES) return
  vectorCache.set(key, { vector, bytes })
  vectorCacheBytes += bytes
  while (vectorCache.size > MAX_VECTOR_CACHE_ENTRIES || vectorCacheBytes > MAX_VECTOR_CACHE_BYTES) {
    const oldestKey = vectorCache.keys().next().value
    const oldest = vectorCache.get(oldestKey)
    vectorCache.delete(oldestKey)
    vectorCacheBytes -= oldest?.bytes || 0
  }
}

function readCache(key) {
  const entry = vectorCache.get(key)
  if (!entry) return null
  vectorCache.delete(key)
  vectorCache.set(key, entry)
  return entry.vector
}

function circuitState(providerKey, now) {
  const current = circuits.get(providerKey) || { failures: 0, blockedUntil: 0 }
  if (current.blockedUntil && current.blockedUntil <= now) {
    const reset = { failures: 0, blockedUntil: 0 }
    circuits.set(providerKey, reset)
    return reset
  }
  return current
}

function recordSuccess(providerKey) {
  circuits.set(providerKey, { failures: 0, blockedUntil: 0 })
  trimProviderStates()
}

function recordFailure(providerKey, now) {
  const current = circuitState(providerKey, now)
  const failures = current.failures + 1
  circuits.set(providerKey, {
    failures,
    blockedUntil: failures >= CIRCUIT_FAILURE_THRESHOLD ? now + CIRCUIT_COOLDOWN_MS : 0,
  })
  trimProviderStates()
}

function trimProviderStates() {
  while (circuits.size > MAX_PROVIDER_STATES) circuits.delete(circuits.keys().next().value)
}

function classifyFailure(error) {
  const code = String(error?.code || '').toLowerCase()
  if (['timeout', 'aborted', 'http_error', 'network_error', 'invalid_vector', 'zero_vector', 'dimension_mismatch', 'count_mismatch', 'input_too_large', 'response_too_large', 'invalid_response'].includes(code)) {
    return code
  }
  return 'embedding_failed'
}

function abortedError() {
  const error = new Error('Embedding 请求已取消')
  error.code = 'aborted'
  return error
}

function waitForShared(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortedError())
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortedError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

async function embedWithCache(embed, providerKey, entries, signal) {
  const vectors = new Map()
  const missingByKey = new Map()
  let cacheHits = 0
  for (const entry of entries) {
    const cacheKey = `${providerKey}:${hashValue(entry.text)}`
    entry.cacheKey = cacheKey
    const cached = readCache(cacheKey)
    if (cached) {
      vectors.set(entry.id, cached)
      cacheHits++
    } else if (!missingByKey.has(cacheKey)) {
      missingByKey.set(cacheKey, entry)
    }
  }

  const missing = [...missingByKey.values()]
  if (missing.length) {
    const requestKey = `${providerKey}:${missing.map(entry => entry.cacheKey).join(',')}`
    let pending = inFlight.get(requestKey)
    if (!pending) {
      // Provider 请求由自身短超时负责取消；调用者只取消自己的等待，避免共享请求互相拖累。
      pending = Promise.resolve(embed(missing.map(entry => entry.text)))
      inFlight.set(requestKey, pending)
      pending.finally(() => inFlight.delete(requestKey)).catch(() => {})
    }
    const embedded = await waitForShared(pending, signal)
    if (!Array.isArray(embedded) || embedded.length !== missing.length) {
      const error = new Error('Embedding 返回数量不匹配')
      error.code = 'count_mismatch'
      throw error
    }
    missing.forEach((entry, index) => touchCache(entry.cacheKey, embedded[index]))
    for (const entry of entries) {
      if (!vectors.has(entry.id)) vectors.set(entry.id, readCache(entry.cacheKey))
    }
  }
  return { vectors, cacheHits, requested: missing.length }
}

function selectionIds(result) {
  return (result?.blocks || []).filter(block => block.optional).map(block => block.id)
}

function baseTelemetry({ mode, status, reason, startedAt, providerHash = '', ...rest }) {
  return {
    version: 1,
    mode,
    status,
    reason: String(reason || ''),
    providerHash,
    latencyMs: Math.max(0, Date.now() - startedAt),
    ...rest,
  }
}

async function prepareContextSemanticSelection(input = {}) {
  const startedAt = Date.now()
  const mode = ['shadow', 'active'].includes(String(input.mode || '').toLowerCase())
    ? String(input.mode).toLowerCase()
    : 'off'
  const query = String(input.query || '').trim()
  const topK = Math.max(0, Number(input.topK) || 0)
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : []
  const rawOptionalCount = rawBlocks.filter(block => block?.optional === true).length
  const base = { candidateCount: rawOptionalCount, eligibleCount: 0, cacheHits: 0, requested: 0, wouldChange: false }

  if (mode === 'off') {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'skipped', reason: 'disabled', startedAt, ...base }) }
  }
  if (!query) {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'skipped', reason: 'empty_query', startedAt, ...base }) }
  }
  if (!topK || rawOptionalCount <= topK) {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'skipped', reason: 'selection_not_needed', startedAt, ...base }) }
  }
  const providerHash = input.embed?.cacheKey ? hashValue(input.embed.cacheKey) : ''
  if (typeof input.embed !== 'function') {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'degraded', reason: 'unavailable', startedAt, providerHash, ...base }) }
  }

  const policy = resolveContextPolicy(input.policy || {})
  const normalized = rawBlocks
    .map(normalizeContextBlock)
    .filter(Boolean)
    .filter(block => isBlockApplicable(block, policy))
  const optional = normalized.filter(block => block.optional)
  if (optional.length <= topK) {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'skipped', reason: 'selection_not_needed', startedAt, providerHash, ...base, candidateCount: optional.length }) }
  }

  const semanticCandidates = optional.filter(block => SEMANTIC_KINDS.has(block.kind) && !block.explicit)
  if (!input.allowSensitive && semanticCandidates.some(block => block.sensitive)) {
    return {
      vectorScores: new Map(),
      telemetry: baseTelemetry({
        mode,
        status: 'degraded',
        reason: 'sensitive_context_blocked',
        startedAt,
        providerHash,
        ...base,
        sensitiveExcluded: semanticCandidates.filter(block => block.sensitive).length,
      }),
    }
  }
  const candidates = semanticCandidates
    .filter(block => input.allowSensitive || !block.sensitive)
    .slice(0, MAX_SEMANTIC_CANDIDATES)
    .map(block => ({ block, text: semanticText(block) }))
    .filter(item => item.text)
  if (!candidates.length) {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'skipped', reason: 'no_eligible_candidates', startedAt, providerHash, ...base }) }
  }

  const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now()
  const providerKey = String(input.embed.cacheKey || 'embedding-provider')
  if (circuitState(providerKey, now).blockedUntil > now) {
    return { vectorScores: new Map(), telemetry: baseTelemetry({ mode, status: 'degraded', reason: 'circuit_open', startedAt, providerHash, ...base, eligibleCount: candidates.length }) }
  }

  try {
    const entries = [
      { id: '__query__', text: query.slice(0, 2000) },
      ...candidates.map(item => ({ id: item.block.id, text: item.text })),
    ]
    const embedded = await embedWithCache(input.embed, providerKey, entries, input.signal)
    const queryVector = embedded.vectors.get('__query__')
    const vectorScores = new Map(candidates.map(item => [
      item.block.id,
      cosineSimilarity(queryVector, embedded.vectors.get(item.block.id)),
    ]))
    recordSuccess(providerKey)

    const baseline = selectOptionalBlocks({ blocks: normalized, policy, query, topK, now })
    const semantic = selectOptionalBlocks({ blocks: normalized, policy, query, topK, now, vectorScores })
    const wouldChange = selectionIds(baseline).join('|') !== selectionIds(semantic).join('|')
    return {
      vectorScores: mode === 'active' ? vectorScores : new Map(),
      telemetry: baseTelemetry({
        mode,
        status: mode === 'active' ? 'applied' : 'shadow',
        reason: '',
        startedAt,
        providerHash,
        candidateCount: optional.length,
        eligibleCount: candidates.length,
        cacheHits: embedded.cacheHits,
        requested: embedded.requested,
        wouldChange,
        limited: semanticCandidates.length > MAX_SEMANTIC_CANDIDATES,
      }),
    }
  } catch (error) {
    if (String(error?.code || '') !== 'aborted') {
      if (error && typeof error === 'object') {
        if (!recordedFailureErrors.has(error)) {
          recordedFailureErrors.add(error)
          recordFailure(providerKey, now)
        }
      } else {
        recordFailure(providerKey, now)
      }
    }
    return {
      vectorScores: new Map(),
      telemetry: baseTelemetry({
        mode,
        status: 'degraded',
        reason: classifyFailure(error),
        startedAt,
        providerHash,
        ...base,
        eligibleCount: candidates.length,
      }),
    }
  }
}

function resetSemanticRuntime() {
  vectorCache.clear()
  inFlight.clear()
  circuits.clear()
  vectorCacheBytes = 0
}

function semanticRuntimeStats() {
  return {
    cacheEntries: vectorCache.size,
    cacheBytes: vectorCacheBytes,
    maxCacheBytes: MAX_VECTOR_CACHE_BYTES,
    inFlight: inFlight.size,
    circuits: circuits.size,
  }
}

module.exports = {
  SEMANTIC_KINDS,
  MAX_VECTOR_CACHE_ENTRIES,
  MAX_VECTOR_CACHE_BYTES,
  MAX_SEMANTIC_CANDIDATES,
  MAX_SEMANTIC_TEXT_CHARS,
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_COOLDOWN_MS,
  hashValue,
  semanticText,
  prepareContextSemanticSelection,
  resetSemanticRuntime,
  semanticRuntimeStats,
}
