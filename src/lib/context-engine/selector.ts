'use strict'

const { cosineSimilarity, tokenize: tokenizeKnowledgeText } = require('../knowledge-rank')
const { authorityRank } = require('./types')

function tokenize(value) {
  return [...new Set(tokenizeKnowledgeText(String(value || '')).filter(Boolean))]
}

function lexicalScore(query, block) {
  const q = tokenize(query)
  if (!q.length) return 0
  const haystack = `${block?.meta?.description || ''} ${(block?.meta?.tags || []).join(' ')} ${String(block?.content || '').slice(0, 4000)}`
  const terms = new Set(tokenize(haystack))
  let hit = 0
  for (const token of q) if (terms.has(token)) hit++
  return hit / q.length
}

function scopeScore(block, policy) {
  const applies = block?.appliesTo || {}
  let score = 0
  if (applies.scenes?.includes(policy.scene)) score += 0.4
  if (policy.phase && applies.phases?.includes(policy.phase)) score += 0.25
  if (applies.tiers?.includes(policy.tier)) score += 0.15
  if (applies.executionPolicies?.includes(policy.executionPolicy)) score += 0.1
  if (block.explicit) score += 1
  return score
}

function confidenceScore(block) {
  const raw = block?.meta?.confidence
  if (Number.isFinite(Number(raw))) return Math.max(0, Math.min(1, Number(raw)))
  return ({ high: 1, confirmed: 1, medium: 0.6, inferred: 0.45, low: 0.2 })[String(raw || '').toLowerCase()] || 0
}

function freshnessScore(block, now = Date.now()) {
  const declared = block?.meta?.freshness
  if (Number.isFinite(Number(declared))) return Math.max(0, Math.min(1, Number(declared)))
  const updatedAt = Date.parse(String(block?.meta?.updatedAt || block?.source?.updatedAt || ''))
  if (!Number.isFinite(updatedAt)) return 0
  const ageDays = Math.max(0, (Number(now) - updatedAt) / 86_400_000)
  return Math.max(0, 1 - ageDays / 90)
}

function stableRank(blocks, policy, query, vectorScores = new Map(), now = Date.now()) {
  return blocks.map((block, index) => {
    const lex = lexicalScore(query, block)
    const vector = Math.max(0, Math.min(1, Number(vectorScores.get(block.id)) || 0))
    const structural = scopeScore(block, policy)
    const confidence = confidenceScore(block)
    const freshness = freshnessScore(block, now)
    const authority = authorityRank(block.authority) / 500
    const score = block.explicit
      ? 10 + structural + authority * 0.1
      : structural + lex * 0.45 + vector * 0.3 + confidence * 0.1 + freshness * 0.1
        + authority * 0.04 + Math.max(0, Number(block.priority) || 0) / 1000
    return { block, score, index, lexicalScore: lex, vectorScore: vector, confidenceScore: confidence, freshnessScore: freshness }
  }).sort((a, b) => b.score - a.score || b.block.priority - a.block.priority || a.index - b.index)
}

function selectOptionalBlocks(input = {}) {
  const { blocks = [], policy, query = '', topK = 8, vectorScores } = input
  const mandatory = []
  const optional = []
  for (const block of blocks) {
    if (block.optional) optional.push(block)
    else mandatory.push(block)
  }
  const scores = vectorScores instanceof Map
    ? vectorScores
    : new Map(Object.entries(vectorScores || {}))
  const ranked = stableRank(optional, policy || {}, query, scores, inputNow(input))
  const selectedRanked = ranked.slice(0, Math.max(0, Number(topK) || 0))
  const selectedIds = new Set(selectedRanked.map(item => item.block.id))
  return {
    blocks: [...mandatory, ...optional.filter(block => selectedIds.has(block.id))],
    omitted: optional.filter(block => !selectedIds.has(block.id)).map(block => ({
      id: block.id,
      reason: 'irrelevant',
    })),
    rankings: selectedRanked.map(item => ({
      id: item.block.id,
      score: Number(item.score.toFixed(4)),
      lexicalScore: Number(item.lexicalScore.toFixed(4)),
      vectorScore: Number(item.vectorScore.toFixed(4)),
      confidenceScore: Number(item.confidenceScore.toFixed(4)),
      freshnessScore: Number(item.freshnessScore.toFixed(4)),
    })),
  }
}

function inputNow(input = {}) {
  const value = Number(input.now)
  return Number.isFinite(value) ? value : Date.now()
}

async function selectOptionalBlocksWithEmbedding(input = {}) {
  const embed = typeof input.embed === 'function' ? input.embed : null
  const optional = (input.blocks || []).filter(block => block.optional)
  if (!embed || !String(input.query || '').trim() || !optional.length) {
    return selectOptionalBlocks(input)
  }
  try {
    const texts = [String(input.query), ...optional.map(block => (
      `${block.meta?.description || ''}\n${String(block.content || '').slice(0, 4000)}`.trim()
    ))]
    const vectors = await embed(texts)
    if (!Array.isArray(vectors) || vectors.length !== texts.length) return selectOptionalBlocks(input)
    const scores = new Map(optional.map((block, index) => [
      block.id,
      cosineSimilarity(vectors[0], vectors[index + 1]),
    ]))
    return selectOptionalBlocks({ ...input, vectorScores: scores })
  } catch {
    return selectOptionalBlocks(input)
  }
}

module.exports = {
  tokenize,
  lexicalScore,
  scopeScore,
  confidenceScore,
  freshnessScore,
  selectOptionalBlocks,
  selectOptionalBlocksWithEmbedding,
}
