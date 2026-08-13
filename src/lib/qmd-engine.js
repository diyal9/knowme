'use strict'

/**
 * qmd-engine — 可插拔本地混合检索：优先 qmd CLI，不可用时回退 knowledge-rank。
 *
 * 默认自动探测 qmd；KNOWME_QMD=0 可明确禁用。qmd 不可用或失败时回退 knowledge-rank。
 */

const { spawn } = require('child_process')
const crypto = require('crypto')
const path = require('path')
const knowledgeRank = require('./knowledge-rank')

const DEFAULT_TOPK = 8
const QMD_ENABLED = process.env.KNOWME_QMD !== '0'

let qmdProbeCache = null
const readyCollections = new Map()

function runQmd(args, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 12000
  return new Promise(resolve => {
    let settled = false
    let out = ''
    let err = ''
    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const child = spawn('qmd', args, {
      cwd: opts.cwd || undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => { out += chunk })
    child.stderr?.on('data', chunk => { err += chunk })
    child.on('error', error => finish({
      ok: false,
      code: null,
      error: error?.code === 'ENOENT' ? 'not_installed' : 'qmd_spawn_failed',
      stdout: out,
      stderr: err,
    }))
    child.on('close', code => finish({
      ok: code === 0,
      code,
      error: code === 0 ? null : (err.trim() || 'qmd_failed'),
      stdout: out,
      stderr: err,
    }))
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      finish({ ok: false, code: null, error: 'qmd_timeout', stdout: out, stderr: err })
    }, timeoutMs)
    timer.unref?.()
  })
}

function probeQmd(opts = {}) {
  if (opts.force) qmdProbeCache = null
  if (qmdProbeCache != null) return Promise.resolve(qmdProbeCache)
  if (!QMD_ENABLED) {
    qmdProbeCache = { available: false, reason: 'explicitly_disabled' }
    return Promise.resolve(qmdProbeCache)
  }
  return runQmd(['--version'], { timeoutMs: 2500 }).then(result => {
    qmdProbeCache = result.ok
      ? { available: true, version: result.stdout.trim() }
      : { available: false, reason: result.error || 'exit_nonzero' }
    return qmdProbeCache
  })
}

async function getEngineStatus() {
  const probe = await probeQmd()
  return {
    engine: probe.available ? 'qmd' : 'fallback',
    qmdEnabled: QMD_ENABLED,
    probe,
  }
}

function fallbackQuery(queryText, docs = [], opts = {}) {
  const topK = Number.isFinite(opts.topK) ? opts.topK : DEFAULT_TOPK
  const hits = knowledgeRank.rankHits(queryText, docs, { topK })
  return {
    ok: true,
    engine: 'fallback',
    degraded: opts.degraded === true,
    fallbackReason: opts.fallbackReason || null,
    hits: hits.map(h => ({ ...h, engine: 'fallback', collectionId: opts.collectionId || 'root' })),
  }
}

async function fallbackQueryAsync(queryText, docs, opts = {}) {
  let hits = fallbackQuery(queryText, docs, opts).hits
  if (typeof opts.embed === 'function' && hits.length >= 2) {
    try {
      hits = await knowledgeRank.rerankHits(hits, {
        embed: opts.embed,
        queryText,
        alpha: Number.isFinite(opts.rerankAlpha) ? opts.rerankAlpha : 0.35,
      })
    } catch { /* keep lexical */ }
  }
  return {
    ok: true,
    engine: 'fallback',
    degraded: opts.degraded === true,
    fallbackReason: opts.fallbackReason || null,
    hits,
    reranked: !!opts.embed,
  }
}

function scopedCollectionName(collectionId, rootPath) {
  const safeId = String(collectionId || 'root')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'root'
  const canonical = path.resolve(String(rootPath || '.')).toLowerCase()
  const suffix = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 10)
  return `knowme-${safeId}-${suffix}`
}

function parseCollectionList(stdout) {
  try {
    const parsed = JSON.parse(String(stdout || ''))
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.collections)) return parsed.collections
  } catch { /* invalid/legacy list output */ }
  return []
}

async function ensureCollection(collectionId, rootPath, opts = {}) {
  const probe = await probeQmd()
  if (!probe.available) return { ok: false, error: probe.reason, available: false }
  if (!rootPath) return { ok: true, collectionId: String(collectionId || 'root'), existing: true }

  const root = path.resolve(rootPath)
  const qmdCollectionId = scopedCollectionName(collectionId, root)
  if (!opts.force && readyCollections.get(qmdCollectionId) === root) {
    return { ok: true, collectionId: qmdCollectionId, rootPath: root, cached: true }
  }

  const listed = await runQmd(['collection', 'list', '--json'], { timeoutMs: 5000 })
  const collections = listed.ok ? parseCollectionList(listed.stdout) : []
  const exists = collections.some(item => {
    const name = String(item?.name || item?.id || item?.collection || '')
    return name === qmdCollectionId
  })
  if (!exists) {
    const added = await runQmd(
      ['collection', 'add', root, '--name', qmdCollectionId],
      { timeoutMs: 15000 }
    )
    if (!added.ok && !/already exists|duplicate/i.test(`${added.error} ${added.stderr}`)) {
      return { ok: false, error: added.error || 'qmd_collection_add_failed', collectionId: qmdCollectionId }
    }
  }
  readyCollections.set(qmdCollectionId, root)
  return { ok: true, collectionId: qmdCollectionId, rootPath: root, existing: exists }
}

async function syncCollection(collectionId, rootPath) {
  const prepared = await ensureCollection(collectionId, rootPath)
  if (!prepared.ok) return prepared
  const updated = await runQmd(['update'], { timeoutMs: 60000 })
  if (!updated.ok) {
    return {
      ok: false,
      available: true,
      collectionId: prepared.collectionId,
      error: updated.error || 'qmd_update_failed',
    }
  }
  return {
    ok: true,
    available: true,
    engine: 'qmd',
    collectionId: prepared.collectionId,
    updated: true,
  }
}

function normalizeQmdPath(value, collectionId) {
  let ref = String(value || '')
  const prefix = `qmd://${collectionId}/`
  if (ref.startsWith(prefix)) ref = ref.slice(prefix.length)
  return ref.replace(/\\/g, '/').replace(/^\/+/, '')
}

function mapQmdHits(json, collectionId, topK = DEFAULT_TOPK) {
  const arr = Array.isArray(json?.hits) ? json.hits : Array.isArray(json) ? json : []
  return arr.slice(0, topK).map((hit, index) => ({
    title: String(hit.title || hit.file || hit.path || `结果 ${index + 1}`).slice(0, 120),
    path: normalizeQmdPath(hit.file || hit.path || hit.ref || hit.id || hit.docid, collectionId),
    snippet: String(hit.snippet || hit.body || hit.text || hit.content || hit.context || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400),
    score: Number.isFinite(hit.score) ? hit.score : arr.length - index,
    engine: 'qmd',
    collectionId,
    docId: hit.docid || hit.id || null,
  }))
}

function buildQueryArgs(collectionId, queryText, topK = DEFAULT_TOPK) {
  return [
    'query',
    String(queryText || ''),
    '--json',
    '-n',
    String(topK),
    '-c',
    String(collectionId || 'root'),
  ]
}

function runQmdQuery(collectionId, queryText, topK) {
  const args = buildQueryArgs(collectionId, queryText, topK)
  return runQmd(args).then(result => {
    if (!result.ok) return { ok: false, error: result.error || 'qmd_failed' }
    try {
      return {
        ok: true,
        engine: 'qmd',
        degraded: false,
        hits: mapQmdHits(JSON.parse(result.stdout), collectionId, topK),
      }
    } catch {
      return { ok: false, error: 'qmd_parse_failed' }
    }
  })
}

/**
 * @param {string} collectionId
 * @param {string} queryText
 * @param {{ docs?: Array, topK?: number, embed?: Function }} opts
 */
async function queryCollection(collectionId, queryText, opts = {}) {
  const q = String(queryText || '').trim()
  if (!q) return { ok: true, engine: 'fallback', hits: [], message: '请输入查询关键词' }
  const topK = Number.isFinite(opts.topK) ? opts.topK : DEFAULT_TOPK
  const probe = await probeQmd()
  let fallbackReason = probe.available ? null : probe.reason
  if (probe.available) {
    const prepared = await ensureCollection(collectionId, opts.rootPath)
    if (prepared.ok) {
      const qmdRes = await runQmdQuery(prepared.collectionId || collectionId, q, topK)
      if (qmdRes.ok) return qmdRes
      fallbackReason = qmdRes.error
    } else {
      fallbackReason = prepared.error
    }
  }
  return fallbackQueryAsync(q, opts.docs || [], {
    ...opts,
    collectionId,
    topK,
    degraded: true,
    fallbackReason: fallbackReason || 'qmd_unavailable',
  })
}

async function getDocument(ref, opts = {}) {
  const readFile = opts.readFile
  const abs = opts.absPath
  if (typeof readFile === 'function' && abs) {
    try {
      const content = await readFile(abs)
      return { ok: true, ref, content: String(content || ''), engine: 'fallback' }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  }
  return { ok: false, error: '无法读取文档' }
}

module.exports = {
  QMD_ENABLED,
  probeQmd,
  getEngineStatus,
  queryCollection,
  syncCollection,
  ensureCollection,
  scopedCollectionName,
  mapQmdHits,
  buildQueryArgs,
  runQmdQuery,
  fallbackQuery,
  fallbackQueryAsync,
  getDocument,
}
