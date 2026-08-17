'use strict'

/**
 * semantic-index — 内容源语义索引（Cursor 式 codebase context 的核心）。
 *
 * 纯逻辑 + 依赖注入：分块 → 注入 embed 生成向量 → 余弦检索最相关 span。
 * 不直接触碰 fs / 网络：readFile 与 embed 均由调用方注入，便于单测与缓存。
 */

const { cosineSimilarity } = require('./knowledge-rank')

const DEFAULT_CHUNK_CHARS = 1200
const DEFAULT_OVERLAP = 200
const DEFAULT_MAX_CHUNKS = 400
const DEFAULT_EMBED_BATCH = 32
const DEFAULT_TOPK = 8
const DEFAULT_MAX_PER_FILE = 2
const DEFAULT_DIVERSITY_LAMBDA = 0.78

const SEMANTIC_SEARCH_DEF = {
  type: 'function',
  function: {
    name: 'semantic_search',
    description: 'Semantically search the active content source using vector similarity. Prefer this over grep for conceptual questions where exact keywords are unknown.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Non-empty natural-language description of what to find.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
}

/**
 * 将长文本切成带重叠的窗口，尽量在换行处断开。
 * @returns {Array<{ text:string, start:number, end:number }>}
 */
function chunkText(content, opts = {}) {
  const text = String(content || '')
  if (!text.trim()) return []
  const size = Math.max(200, Number(opts.maxChars) || DEFAULT_CHUNK_CHARS)
  const overlap = Math.max(0, Math.min(size - 1, Number(opts.overlap) || DEFAULT_OVERLAP))
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + size)
    if (end < text.length) {
      // 优先在窗口后半段的换行处断开，避免切碎语义
      const slice = text.slice(start, end)
      const nl = slice.lastIndexOf('\n', size)
      if (nl > size * 0.5) end = start + nl + 1
    }
    const piece = text.slice(start, end)
    if (piece.trim()) chunks.push({ text: piece.trim(), start, end })
    if (end >= text.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

/**
 * 遍历文件清单，读取内容并分块。
 * @param {Array<{path:string}>} files
 * @param {(rel:string)=>(string|null)} readFile
 */
function chunkDocuments(files, readFile, opts = {}) {
  const list = Array.isArray(files) ? files : []
  const read = typeof readFile === 'function' ? readFile : () => null
  const maxChunks = Number.isFinite(opts.maxChunks) && opts.maxChunks > 0 ? opts.maxChunks : DEFAULT_MAX_CHUNKS
  const out = []
  for (const file of list) {
    if (out.length >= maxChunks) break
    const rel = typeof file === 'string' ? file : file?.path
    if (!rel) continue
    const content = read(rel)
    if (content == null) continue
    const fileWeight = Number.isFinite(file?.weight) ? Number(file.weight) : 1
    const pieces = chunkText(content, opts)
    for (let i = 0; i < pieces.length; i++) {
      if (out.length >= maxChunks) break
      out.push({ path: rel, chunkIndex: i, text: pieces[i].text, fileWeight })
    }
  }
  return out
}

async function embedInBatches(embed, texts, batchSize = DEFAULT_EMBED_BATCH) {
  const size = Math.max(1, Number(batchSize) || DEFAULT_EMBED_BATCH)
  const out = []
  for (let i = 0; i < texts.length; i += size) {
    const part = await embed(texts.slice(i, i + size))
    if (!Array.isArray(part)) throw new Error('embed 返回非数组')
    out.push(...part)
  }
  return out
}

/**
 * 构建带向量的索引（需注入 embed；网络在调用方）。
 * @returns {Promise<{ chunks: Array, vectors: number[][] }>}
 */
async function buildEmbeddedIndex(opts = {}) {
  const embed = typeof opts.embed === 'function' ? opts.embed : null
  if (!embed) return { chunks: [], vectors: [] }
  const chunks = chunkDocuments(opts.files, opts.readFile, opts)
  if (!chunks.length) return { chunks: [], vectors: [] }
  const vectors = await embedInBatches(embed, chunks.map(c => c.text), opts.embedBatch)
  return { chunks, vectors }
}

/**
 * 用已有查询向量在索引中检索最相关 chunk。
 * @param {{chunks:Array, vectors:number[][]}} index
 * @param {number[]} queryVector
 * @param {{topK?:number}} [opts]
 */
function mmrSelect(scored, vectors, topK, lambda = DEFAULT_DIVERSITY_LAMBDA) {
  const selected = []
  const selectedIdx = []
  const candidates = scored.map((item, i) => ({ ...item, _i: i }))
  const l = Math.min(1, Math.max(0, Number(lambda) || DEFAULT_DIVERSITY_LAMBDA))
  while (selected.length < topK && candidates.length) {
    let best = null
    let bestIdx = -1
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      const rel = Number(c.score) || 0
      let maxSim = 0
      for (const si of selectedIdx) {
        const sim = cosineSimilarity(vectors[c._i], vectors[si])
        if (sim > maxSim) maxSim = sim
      }
      const mmr = l * rel - (1 - l) * maxSim
      if (!best || mmr > best._mmr) {
        best = { ...c, _mmr: mmr }
        bestIdx = i
      }
    }
    if (!best) break
    selected.push(best)
    selectedIdx.push(best._i)
    candidates.splice(bestIdx, 1)
  }
  return selected.map(({ _i, _mmr, ...rest }) => rest)
}

function searchChunks(index, queryVector, opts = {}) {
  const chunks = index?.chunks || []
  const vectors = index?.vectors || []
  if (!chunks.length || !Array.isArray(queryVector)) return []
  const topK = Number.isFinite(opts.topK) && opts.topK > 0 ? opts.topK : DEFAULT_TOPK
  const scored = chunks.map((chunk, i) => ({
    path: chunk.path,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    // P1-2：新近/活跃文件加权（温和倍率，避免过拟合）
    score: Number((
      cosineSimilarity(queryVector, vectors[i]) *
      Math.min(1.5, Math.max(0.7, Number(chunk.fileWeight) || 1))
    ).toFixed(4)),
  }))
  scored.sort((a, b) => b.score - a.score)
  const mmrEnabled = opts.mmr !== false
  const diverse = mmrEnabled
    ? mmrSelect(scored, vectors, Math.max(topK * 3, topK), opts.diversityLambda)
    : scored
  const processed = postProcessHitsWithMeta(diverse, opts)
  const hits = processed.hits.slice(0, topK).filter(h => h.score > 0)
  if (opts.returnMeta) {
    return {
      hits,
      meta: {
        ...processed.meta,
        candidateCount: scored.length,
        mmrApplied: mmrEnabled,
      },
    }
  }
  return hits
}

/**
 * 端到端语义查询：embed(query) → searchChunks。
 */
async function query(index, embed, queryText, opts = {}) {
  const q = String(queryText || '').trim()
  if (!q || typeof embed !== 'function') return []
  const vectors = await embed([q])
  const qv = Array.isArray(vectors) ? vectors[0] : null
  if (!qv) return []
  return searchChunks(index, qv, opts)
}

async function queryDetailed(index, embed, queryText, opts = {}) {
  const q = String(queryText || '').trim()
  if (!q || typeof embed !== 'function') return { hits: [], meta: { queryEmpty: !q } }
  const vectors = await embed([q])
  const qv = Array.isArray(vectors) ? vectors[0] : null
  if (!qv) return { hits: [], meta: { vectorMissing: true } }
  return searchChunks(index, qv, { ...opts, returnMeta: true })
}

function normalizeFingerprint(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '')
    .slice(0, 140)
}

/**
 * P1-3：去重与轻聚类
 * - 去重：path + 文本指纹
 * - 聚类：同文件内 chunkIndex 相邻视为同簇
 * - 限流：每文件最多保留 maxPerFile 段，降低重复刷屏
 */
function postProcessHitsWithMeta(hits, opts = {}) {
  const list = Array.isArray(hits) ? hits : []
  const maxPerFile = Number.isFinite(opts.maxPerFile) && opts.maxPerFile > 0
    ? opts.maxPerFile
    : DEFAULT_MAX_PER_FILE
  const seen = new Set()
  const perFileCount = new Map()
  const clustersByFile = new Map()
  let seq = 0
  const kept = []
  let droppedDedup = 0
  let droppedPerFile = 0
  for (const hit of list) {
    const path = String(hit.path || '')
    if (!path) continue
    const key = `${path}|${normalizeFingerprint(hit.text)}`
    if (seen.has(key)) { droppedDedup++; continue }
    seen.add(key)
    const used = perFileCount.get(path) || 0
    if (used >= maxPerFile) { droppedPerFile++; continue }
    perFileCount.set(path, used + 1)
    const idx = Number(hit.chunkIndex) || 0
    const clusters = clustersByFile.get(path) || []
    const near = clusters.find((c) => idx >= c.min - 1 && idx <= c.max + 1)
    let clusterId
    let clusterSize
    if (near) {
      near.min = Math.min(near.min, idx)
      near.max = Math.max(near.max, idx)
      near.size += 1
      clusterId = near.id
      clusterSize = near.size
    } else {
      const id = `${path}#${seq++}`
      clusters.push({ id, min: idx, max: idx, size: 1 })
      clustersByFile.set(path, clusters)
      clusterId = id
      clusterSize = 1
    }
    kept.push({ ...hit, clusterId, clusterSize })
  }
  const clusterIds = new Set(kept.map(item => item.clusterId))
  return {
    hits: kept,
    meta: {
      inputCount: list.length,
      outputCount: kept.length,
      droppedDedup,
      droppedPerFile,
      clusterCount: clusterIds.size,
      fileCount: new Set(kept.map(item => item.path)).size,
    },
  }
}

function postProcessHits(hits, opts = {}) {
  return postProcessHitsWithMeta(hits, opts).hits
}

/** 结构化命中格式化，供工具结果展示。 */
function formatSemanticMatches(queryText, hits) {
  const list = Array.isArray(hits) ? hits : []
  if (!list.length) return `未找到与「${queryText}」语义相关的内容`
  const groups = new Map()
  for (const hit of list) {
    const key = String(hit.path || '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(hit)
  }
  const lines = [`共 ${list.length} 段语义命中「${queryText}」，来自 ${groups.size} 个文件：`]
  let fileNo = 0
  for (const [file, fileHits] of groups.entries()) {
    fileNo++
    lines.push(`${fileNo}. ${file}（${fileHits.length} 段）`)
    fileHits.forEach((h, i) => {
      lines.push(`   ${i + 1}) chunk ${h.chunkIndex}, 相似度 ${h.score}${h.clusterSize > 1 ? `, 聚类 ${h.clusterSize}` : ''}`)
      const snippet = String(h.text || '').replace(/\s+/g, ' ').trim().slice(0, 240)
      if (snippet) lines.push(`      ${snippet}`)
    })
  }
  return lines.join('\n')
}

module.exports = {
  DEFAULT_CHUNK_CHARS,
  DEFAULT_OVERLAP,
  DEFAULT_MAX_CHUNKS,
  DEFAULT_EMBED_BATCH,
  DEFAULT_TOPK,
  DEFAULT_MAX_PER_FILE,
  DEFAULT_DIVERSITY_LAMBDA,
  SEMANTIC_SEARCH_DEF,
  chunkText,
  chunkDocuments,
  embedInBatches,
  buildEmbeddedIndex,
  searchChunks,
  query,
  queryDetailed,
  normalizeFingerprint,
  mmrSelect,
  postProcessHitsWithMeta,
  postProcessHits,
  formatSemanticMatches,
}
