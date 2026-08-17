'use strict'

/**
 * knowledge-rank — 纯逻辑混合排序：分词 + TF 打分 + 标题/路径加权 + 短语命中 + 关键行提取。
 *
 * 不做任何 IO。knowledge-os 传入 { title, path, content } 文档列表，返回结构化 hits。
 * 预留 embedding 可插拔：调用方可在拿到候选后再做向量重排，此处只负责词面混合召回。
 */

const SNIPPET_LEN = 200
const DEFAULT_TOPK = 8
const CJK = /[\u4e00-\u9fff]/

/**
 * 分词：拉丁按单词，CJK 按字 + 相邻二元组（bigram），全部小写。
 */
function tokenize(text) {
  const value = String(text || '').toLowerCase()
  const tokens = []
  const latin = value.match(/[a-z0-9]+/g) || []
  for (const w of latin) {
    if (w.length > 1) tokens.push(w)
  }
  // CJK：以相邻二元组（bigram）为主信号；只有孤立单字（前后无 CJK）才作为单字词，
  // 避免同一个词被单字 + bigram 重复计分。
  const runs = value.match(/[\u4e00-\u9fff]+/g) || []
  for (const run of runs) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i + 1 < run.length; i++) {
      tokens.push(run[i] + run[i + 1])
    }
  }
  return tokens
}

/** 去重的查询词集合，保留原短语用于短语命中。 */
function parseQuery(queryText) {
  const phrase = String(queryText || '').toLowerCase().trim()
  const terms = [...new Set(tokenize(phrase))]
  return { phrase, terms }
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = haystack.indexOf(needle, idx + needle.length)
  }
  return count
}

/**
 * 单文档打分。返回 { score, matchedTerms }。
 */
function scoreDocument(query, doc) {
  const title = String(doc?.title || '').toLowerCase()
  const pathText = String(doc?.path || '').toLowerCase()
  const content = String(doc?.content || '').toLowerCase()
  const haystack = `${title}\n${pathText}\n${content}`
  let score = 0
  let matchedTerms = 0
  for (const term of query.terms) {
    const isBigram = CJK.test(term) && term.length === 2
    const isLongLatin = !CJK.test(term) && term.length >= 3
    const weight = isBigram ? 2 : isLongLatin ? 1.5 : 1
    const tf = countOccurrences(content, term)
    const titleHit = title.includes(term)
    const pathHit = pathText.includes(term)
    if (tf === 0 && !titleHit && !pathHit) continue
    matchedTerms++
    // 饱和 TF，避免长文刷分
    score += weight * (Math.log1p(tf) + (titleHit ? 4 : 0) + (pathHit ? 1.5 : 0))
  }
  // 短语完整命中大幅加权
  if (query.phrase && query.phrase.length > 1 && haystack.includes(query.phrase)) {
    score += 8
    matchedTerms = Math.max(matchedTerms, 1)
  }
  // 命中更多不同查询词 → 覆盖度奖励
  if (query.terms.length) {
    score += (matchedTerms / query.terms.length) * 3
  }
  return { score, matchedTerms }
}

/**
 * 提取与查询最相关的行作为片段。
 */
function extractKeyLines(content, query, maxLen = SNIPPET_LEN) {
  const raw = String(content || '')
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return raw.replace(/\s+/g, ' ').trim().slice(0, maxLen)
  let best = null
  let bestScore = -1
  for (const line of lines) {
    const lower = line.toLowerCase()
    let s = 0
    if (query.phrase && lower.includes(query.phrase)) s += 6
    for (const term of query.terms) {
      if (lower.includes(term)) s += CJK.test(term) && term.length === 2 ? 2 : 1
    }
    if (s > bestScore) { bestScore = s; best = line }
  }
  const chosen = bestScore > 0 && best ? best : lines[0]
  return chosen.replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

/**
 * 对候选文档排序，返回结构化 hits。
 * @param {string} queryText
 * @param {Array<{title,path,content}>} docs
 * @param {{ topK?: number }} [opts]
 */
function rankHits(queryText, docs, opts = {}) {
  const query = parseQuery(queryText)
  if (!query.terms.length) return []
  const list = Array.isArray(docs) ? docs : []
  const scored = []
  for (const doc of list) {
    const { score, matchedTerms } = scoreDocument(query, doc)
    if (score <= 0 || matchedTerms === 0) continue
    scored.push({
      title: String(doc.title || '').slice(0, 120),
      path: String(doc.path || ''),
      snippet: extractKeyLines(doc.content, query),
      score: Number(score.toFixed(4)),
    })
  }
  scored.sort((a, b) => b.score - a.score)
  const topK = Number.isFinite(opts.topK) && opts.topK > 0 ? opts.topK : DEFAULT_TOPK
  return scored.slice(0, topK)
}

/** 余弦相似度；维度不一致或零向量返回 0。 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0
    const y = Number(b[i]) || 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** 0..1 归一化词面分。 */
function normalizeLexical(hits) {
  const max = hits.reduce((m, h) => Math.max(m, Number(h.score) || 0), 0)
  return hits.map(h => (max > 0 ? (Number(h.score) || 0) / max : 0))
}

/**
 * 词面分与向量相似度融合，重排并回填 rerankScore / semanticScore。
 * @param {Array} hits rankHits 产物
 * @param {number[]} similarities 与 hits 对齐的余弦相似度（-1..1）
 * @param {number} [alpha] 词面权重（默认 0.5）
 */
function blendScores(hits, similarities, alpha = 0.5) {
  const lex = normalizeLexical(hits)
  const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 0.5))
  const merged = hits.map((h, i) => {
    const sim = Math.min(1, Math.max(0, (Number(similarities[i]) || 0)))
    const rerankScore = Number((a * lex[i] + (1 - a) * sim).toFixed(4))
    return { ...h, semanticScore: Number(sim.toFixed(4)), rerankScore }
  })
  merged.sort((x, y) => y.rerankScore - x.rerankScore)
  return merged
}

/**
 * 可插拔向量语义重排（二阶段）。
 * 无 embed 或候选为空时原样返回，保证离线/失败安全。
 * @param {Array} hits
 * @param {{ embed?: (texts:string[])=>Promise<number[][]>, queryText?: string, alpha?: number, textOf?: (hit)=>string }} [opts]
 */
async function rerankHits(hits, opts = {}) {
  const list = Array.isArray(hits) ? hits : []
  const embed = typeof opts.embed === 'function' ? opts.embed : null
  if (!embed || list.length < 2) return list
  const textOf = typeof opts.textOf === 'function'
    ? opts.textOf
    : (h) => `${h.title || ''}\n${h.snippet || ''}`.trim()
  const query = String(opts.queryText || '').trim()
  if (!query) return list
  const docTexts = list.map(textOf)
  const vectors = await embed([query, ...docTexts])
  if (!Array.isArray(vectors) || vectors.length !== docTexts.length + 1) return list
  const qv = vectors[0]
  const sims = docTexts.map((_, i) => cosineSimilarity(qv, vectors[i + 1]))
  return blendScores(list, sims, opts.alpha)
}

module.exports = {
  SNIPPET_LEN,
  DEFAULT_TOPK,
  tokenize,
  parseQuery,
  scoreDocument,
  extractKeyLines,
  rankHits,
  cosineSimilarity,
  normalizeLexical,
  blendScores,
  rerankHits,
}
