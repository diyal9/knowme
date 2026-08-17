'use strict'

/**
 * fabric-weave — 挂载外挂库 → 抽取文件级锚点 → 与根概念相似匹配连边 → Steward 织网提案。
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const fabricGraph = require('./fabric-graph')
const knowledgeRank = require('./knowledge-rank')
const knowledgeOs = require('./knowledge-os')

const TEXT_EXT = new Set(['.md', '.txt', '.markdown'])
const SUMMARY_LEN = 320

function titleFromContent(content, fallback) {
  const m = String(content || '').match(/^#\s+(.+)$/m)
  if (m) return m[1].trim().slice(0, 120)
  const fm = String(content || '').match(/^title:\s*["']?(.+?)["']?\s*$/m)
  if (fm) return fm[1].trim().slice(0, 120)
  return fallback
}

function summarizeContent(content) {
  const body = String(content || '')
    .replace(/^---[\s\S]*?---\r?\n/, '')
    .replace(/^#+\s+.+\n?/m, '')
    .replace(/\s+/g, ' ')
    .trim()
  return body.slice(0, SUMMARY_LEN)
}

function walkTextFiles(dir, base = dir, acc = [], depth = 0) {
  if (acc.length >= 500 || depth > 6) return acc
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const ent of entries) {
    if (acc.length >= 500) break
    if (ent.name.startsWith('.')) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue
      walkTextFiles(full, base, acc, depth + 1)
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (!TEXT_EXT.has(ext)) continue
      acc.push({
        abs: full,
        rel: path.relative(base, full).replace(/\\/g, '/'),
      })
    }
  }
  return acc
}

function lexicalSimilarity(a, b) {
  const ta = new Set(knowledgeRank.tokenize(String(a || '')))
  const tb = new Set(knowledgeRank.tokenize(String(b || '')))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.sqrt(ta.size * tb.size)
}

function resolveProviderRoot(userData, provider, ctx = {}) {
  if (provider.kind === 'local' || provider.kind === 'qmd-local') {
    if (provider.spaceSourceId && Array.isArray(ctx.sources)) {
      const src = ctx.sources.find(s => s.id === provider.spaceSourceId)
      if (src?.rootPath) {
        const base = path.resolve(src.rootPath)
        const sub = String(provider.subDir || '').trim()
        if (!sub) return base
        return path.join(base, ...sub.split('/').filter(Boolean))
      }
    }
    return knowledgeOs.resolveWikiRoot(userData, ctx)
  }
  return null
}

function fileFingerprint(absPath, content) {
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(absPath).mtimeMs
  } catch { /* ignore */ }
  const hash = crypto.createHash('sha256').update(String(content || '')).digest('hex').slice(0, 16)
  return { syncHash: hash, syncMtime: mtimeMs }
}

function extractAnchors(userData, provider, ctx = {}) {
  const kbId = String(provider.id || 'kb_external')
  const root = resolveProviderRoot(userData, provider, ctx)
  if (!root || !fs.existsSync(root)) {
    return { ok: false, error: '无法解析外挂库目录', anchors: [] }
  }
  const files = walkTextFiles(root)
  const anchors = []
  for (const f of files) {
    let content = ''
    try {
      content = fs.readFileSync(f.abs, 'utf8')
    } catch {
      continue
    }
    const title = titleFromContent(content, path.basename(f.rel, path.extname(f.rel)))
    const summary = summarizeContent(content)
    const fp = fileFingerprint(f.abs, content)
    const existing = (fabricGraph.loadGraph(userData).nodes || []).find(
      n => n.kind === 'anchor' && n.kbId === kbId && n.extRef === f.rel
    )
    const stale = !!(existing?.syncHash && existing.syncHash !== fp.syncHash)
    anchors.push(fabricGraph.normalizeNode({
      id: existing?.id || `a:${kbId}/${f.rel.replace(/[^\w\u4e00-\u9fff/.-]+/g, '-')}`,
      kind: 'anchor',
      kbId,
      extRef: f.rel,
      title,
      summary,
      authority: Math.max(1, Math.min(5, provider.authority || 3)),
      lastSynced: new Date().toISOString(),
      syncHash: fp.syncHash,
      syncMtime: fp.syncMtime,
      stale,
    }))
  }
  return { ok: true, anchors, root, fileCount: files.length }
}

function matchEdges(anchors, concepts, minScore = 0.18) {
  const edges = []
  for (const anchor of anchors) {
    let best = null
    let bestScore = minScore
    for (const concept of concepts) {
      const score = lexicalSimilarity(
        `${anchor.title} ${anchor.summary}`,
        `${concept.title} ${concept.summary || ''}`
      )
      if (score > bestScore) {
        bestScore = score
        best = concept
      }
    }
    if (best) {
      edges.push(fabricGraph.normalizeEdge({
        from: best.id,
        to: anchor.id,
        type: scoreToEdgeType(bestScore),
        weight: Number(bestScore.toFixed(3)),
      }))
    }
  }
  return edges
}

function scoreToEdgeType(score) {
  if (score >= 0.55) return 'refines'
  if (score >= 0.35) return 'coversTopic'
  return 'relatesTo'
}

function inferTopics(anchors, kbId) {
  const topics = {}
  for (const anchor of anchors) {
    const tag = String(anchor.title || '').split(/[\s/:-]+/)[0]?.toLowerCase()
    if (!tag || tag.length < 2) continue
    const key = `${kbId}.${tag}`.slice(0, 80)
    topics[key] = {
      owners: [kbId],
      coverageInRoot: 0.3,
      delegateTo: [kbId],
      authorityRank: [kbId, 'kb_personal'],
    }
  }
  return topics
}

/**
 * 生成织网提案（不自动写入 graph，需用户确认或 apply）。
 */
function weaveProvider(userData, provider, ctx = {}) {
  fabricGraph.ensureFabric(userData)
  const graph = fabricGraph.loadGraph(userData)
  const extracted = extractAnchors(userData, provider, ctx)
  if (!extracted.ok) return extracted

  const ssot = require('./fabric-governance').filterSsotAnchors(userData, extracted.anchors, provider)
  const anchors = ssot.anchors
  const concepts = (graph.nodes || []).filter(n => n.kind === 'concept')
  const edges = matchEdges(anchors, concepts)
  const topics = inferTopics(anchors, provider.id)
  const ssotNote = ssot.ssotNotes.length
    ? ` SSOT：${ssot.ssotNotes.length} 项已生成 alias/更新提案或标记冲突。`
    : ''

  const proposal = {
    kbId: provider.id,
    title: `织网：${provider.displayName || provider.id}`,
    rationale: `从 ${extracted.fileCount} 个文件抽取 ${anchors.length} 个锚点，匹配 ${edges.length} 条关系边。${ssotNote}`,
    anchors,
    edges,
    topics,
    ssotNotes: ssot.ssotNotes,
  }
  return fabricGraph.addWeaveProposal(userData, proposal)
}

function applyWeave(userData, proposalId) {
  const applied = fabricGraph.applyWeaveProposal(userData, proposalId)
  if (!applied.ok) return applied
  const proposal = applied.proposal
  if (proposal?.topics) {
    const routing = fabricGraph.loadRouting(userData)
    routing.topics = { ...routing.topics, ...proposal.topics }
    fabricGraph.saveRouting(userData, routing)
  }
  return applied
}

function autoWeaveAndApply(userData, provider, ctx = {}) {
  const created = weaveProvider(userData, provider, ctx)
  if (!created.ok) return created
  return applyWeave(userData, created.proposal.id)
}

module.exports = {
  resolveProviderRoot,
  extractAnchors,
  matchEdges,
  weaveProvider,
  applyWeave,
  autoWeaveAndApply,
  lexicalSimilarity,
}
