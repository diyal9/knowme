'use strict'

/**
 * fabric-governance — SSOT 去重、断锚/stale 检测、联合体检、治理提案与重织队列。
 * 数据：knowledge-os/fabric/{governance.json,governance-proposals.json}
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const fabricGraph = require('./fabric-graph')
const knowledgeRank = require('./knowledge-rank')
const knowledgeOs = require('./knowledge-os')
const okfLib = require('./okf-lib')

const SSOT_SIM_THRESHOLD = 0.72
const SSOT_LEX_THRESHOLD = 0.45

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

function governanceConfigPath(userData) {
  return path.join(fabricGraph.fabricDir(userData), 'governance.json')
}

function governanceProposalsPath(userData) {
  return path.join(fabricGraph.fabricDir(userData), 'governance-proposals.json')
}

function now() {
  return new Date().toISOString()
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback
  }
}

function writeAtomic(file, data) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.knowme-${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

function defaultConfig() {
  return {
    version: 1,
    ssotMode: 'mark',
    lastCheckupAt: null,
    dismissedIssueIds: [],
    reweaveQueue: [],
  }
}

function loadConfig(userData) {
  fabricGraph.ensureFabric(userData)
  const cfg = readJson(governanceConfigPath(userData), defaultConfig)
  cfg.ssotMode = cfg.ssotMode === 'block' ? 'block' : 'mark'
  cfg.dismissedIssueIds = Array.isArray(cfg.dismissedIssueIds) ? cfg.dismissedIssueIds : []
  cfg.reweaveQueue = Array.isArray(cfg.reweaveQueue) ? cfg.reweaveQueue : []
  return cfg
}

function saveConfig(userData, patch = {}) {
  const next = { ...loadConfig(userData), ...patch, version: 1 }
  writeAtomic(governanceConfigPath(userData), next)
  return next
}

function loadProposals(userData) {
  fabricGraph.ensureFabric(userData)
  const data = readJson(governanceProposalsPath(userData), () => ({ version: 1, proposals: [] }))
  data.proposals = Array.isArray(data.proposals) ? data.proposals : []
  return data
}

function saveProposals(userData, data) {
  writeAtomic(governanceProposalsPath(userData), { ...data, updatedAt: now() })
}

function normalizeTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120)
}

function conceptIdFromPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/')
  if (!rel) return null
  return okfLib.conceptId(rel)
}

function fileFingerprint(absPath, content) {
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(absPath).mtimeMs
  } catch { /* ignore */ }
  const hash = crypto.createHash('sha256').update(String(content || '')).digest('hex').slice(0, 16)
  return { syncHash: hash, syncMtime: mtimeMs }
}

function resolveAnchorAbsPath(userData, anchor, providers, ctx) {
  const kbId = String(anchor.kbId || '')
  const extRef = String(anchor.extRef || '').replace(/\\/g, '/')
  if (!kbId || !extRef) return { ok: false }
  const provider = providers.find(p => p.id === kbId)
  if (!provider) return { ok: false, reason: 'unknown_kb' }
  const root = resolveProviderRoot(userData, provider, ctx)
  if (!root) return { ok: false, reason: 'no_root' }
  const abs = path.resolve(root, extRef)
  if (!abs.startsWith(path.resolve(root))) return { ok: false, reason: 'path_escape' }
  return { ok: true, abs, root }
}

function embeddingSimilarity(a, b) {
  const va = Array.isArray(a) ? a : null
  const vb = Array.isArray(b) ? b : null
  if (!va?.length || !vb?.length || va.length !== vb.length) return null
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i]
    na += va[i] * va[i]
    nb += vb[i] * vb[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function similarityScore(candidate, existing) {
  const cid = candidate.conceptId || conceptIdFromPath(candidate.path)
  const eid = existing.path ? conceptIdFromPath(existing.path) : null
  if (cid && eid && cid === eid) return 1
  if (candidate.id && candidate.id === existing.id) return 1
  const tA = normalizeTitle(candidate.title)
  const tB = normalizeTitle(existing.title)
  if (tA && tB && tA === tB) return 0.95
  const emb = embeddingSimilarity(candidate.embedding, existing.embedding)
  if (emb != null && emb >= SSOT_SIM_THRESHOLD) return emb
  const lex = lexicalSimilarity(
    `${candidate.title} ${candidate.summary || ''}`,
    `${existing.title} ${existing.summary || ''}`
  )
  return lex >= SSOT_LEX_THRESHOLD ? lex : 0
}

function findBestMatch(graph, candidate, minScore = SSOT_LEX_THRESHOLD) {
  const nodes = graph.nodes || []
  let best = null
  let bestScore = minScore
  for (const node of nodes) {
    if (node.kind !== 'concept' && node.kind !== 'anchor') continue
    const score = similarityScore(candidate, node)
    if (score > bestScore) {
      bestScore = score
      best = node
    }
  }
  return best ? { node: best, score: bestScore } : null
}

/**
 * SSOT 检查：ingest / 织网前调用。
 * @returns {{ action, existing?, score?, proposal?, blocked?, message? }}
 */
function checkSsot(userData, candidate = {}, opts = {}) {
  const cfg = loadConfig(userData)
  const graph = fabricGraph.loadGraph(userData)
  const match = findBestMatch(graph, candidate)
  if (!match) return { action: 'create', ok: true }

  const existing = match.node
  const candAuth = Math.max(1, Math.min(5, Number(candidate.authority) || 2))
  const existAuth = Math.max(1, Math.min(5, Number(existing.authority) || 2))

  if (candAuth > existAuth) {
    const proposal = addGovernanceProposal(userData, {
      type: 'update',
      title: `更新：${candidate.title || existing.title}`,
      rationale: `检测到与「${existing.title}」相似（${match.score.toFixed(2)}），新内容 authority 更高，建议合并更新。`,
      targetNodeId: existing.id,
      payload: { candidate, existingId: existing.id, score: match.score },
    })
    return { action: 'update_proposal', ok: true, existing, score: match.score, proposal: proposal.proposal }
  }

  if (candAuth === existAuth) {
    const proposal = addGovernanceProposal(userData, {
      type: 'alias',
      title: `别名：${candidate.title || existing.title}`,
      rationale: `与「${existing.title}」同等 authority，建议建立 alias 引用而非重复节点。`,
      targetNodeId: existing.id,
      payload: { candidate, existingId: existing.id, score: match.score },
    })
    if (cfg.ssotMode === 'block') {
      return {
        action: 'block',
        ok: false,
        blocked: true,
        existing,
        score: match.score,
        proposal: proposal.proposal,
        message: 'SSOT 阻断：已存在同等 authority 的相似概念',
      }
    }
    return {
      action: 'mark_conflict',
      ok: true,
      existing,
      score: match.score,
      proposal: proposal.proposal,
      message: '已标记潜在重复，生成 alias 提案',
    }
  }

  const proposal = addGovernanceProposal(userData, {
    type: 'alias',
    title: `引用：${candidate.title || existing.title}`,
    rationale: `已有更高 authority 版本「${existing.title}」，建议引用/别名而非新建。`,
    targetNodeId: existing.id,
    payload: { candidate, existingId: existing.id, score: match.score },
  })
  if (cfg.ssotMode === 'block') {
    return {
      action: 'block',
      ok: false,
      blocked: true,
      existing,
      score: match.score,
      proposal: proposal.proposal,
      message: 'SSOT 阻断：已有更高 authority 的相似概念',
    }
  }
  ensureContradictsEdge(userData, existing.id, candidate.id || `pending:${normalizeTitle(candidate.title)}`, {
    rationale: 'SSOT 检测到低 authority 重复',
  })
  return {
    action: 'alias_proposal',
    ok: true,
    existing,
    score: match.score,
    proposal: proposal.proposal,
  }
}

function checkIngestSsot(userData, payload = {}, ctx = {}) {
  const title = String(payload.title || '粘贴条目').trim()
  const authority = Number.isFinite(payload.authority) ? payload.authority : 2
  return checkSsot(userData, {
    title,
    summary: String(payload.text || '').slice(0, 400),
    path: payload.path,
    authority,
  }, ctx)
}

function filterSsotAnchors(userData, anchors = [], provider = {}) {
  const graph = fabricGraph.loadGraph(userData)
  const kept = []
  const ssotNotes = []
  for (const anchor of anchors) {
    const match = findBestMatch(graph, {
      ...anchor,
      authority: anchor.authority || provider.authority || 3,
    })
    if (!match) {
      kept.push(anchor)
      continue
    }
    const result = checkSsot(userData, {
      ...anchor,
      authority: anchor.authority || provider.authority || 3,
    })
    ssotNotes.push({ anchor, result })
    if (result.action === 'block') continue
    if (result.action === 'create' || result.action === 'mark_conflict' || result.action === 'alias_proposal') {
      kept.push(anchor)
    }
  }
  return { anchors: kept, ssotNotes }
}

function detectBrokenAnchors(userData, providers = [], ctx = {}) {
  const graph = fabricGraph.loadGraph(userData)
  const issues = []
  for (const node of graph.nodes || []) {
    if (node.kind !== 'anchor') continue
    const resolved = resolveAnchorAbsPath(userData, node, providers, ctx)
    if (!resolved.ok) {
      issues.push({
        id: `broken:${node.id}`,
        category: 'broken_anchor',
        severity: 'error',
        nodeId: node.id,
        kbId: node.kbId,
        extRef: node.extRef,
        title: node.title,
        message: resolved.reason === 'unknown_kb'
          ? `锚点所属库不可用：${node.kbId}`
          : `外挂文件不存在或路径无效：${node.extRef || node.id}`,
        actions: ['locate', 'propose_cleanup', 'propose_relocate', 'ignore'],
      })
      continue
    }
    if (!fs.existsSync(resolved.abs)) {
      issues.push({
        id: `broken:${node.id}`,
        category: 'broken_anchor',
        severity: 'error',
        nodeId: node.id,
        kbId: node.kbId,
        extRef: node.extRef,
        title: node.title,
        message: `外挂文件已删除或移动：${node.extRef}`,
        actions: ['locate', 'propose_cleanup', 'propose_relocate', 'ignore'],
      })
    }
  }
  return issues
}

function scanStaleAnchors(userData, providers = [], ctx = {}) {
  const graph = fabricGraph.loadGraph(userData)
  let staleCount = 0
  const issues = []
  const nodes = graph.nodes || []
  for (const node of nodes) {
    if (node.kind !== 'anchor') continue
    const resolved = resolveAnchorAbsPath(userData, node, providers, ctx)
    if (!resolved.ok || !fs.existsSync(resolved.abs)) continue
    let content = ''
    try {
      content = fs.readFileSync(resolved.abs, 'utf8')
    } catch {
      continue
    }
    const fp = fileFingerprint(resolved.abs, content)
    const stale = node.syncHash && node.syncHash !== fp.syncHash
      || (node.syncMtime && fp.syncMtime && node.syncMtime !== fp.syncMtime)
    if (stale) {
      staleCount++
      node.stale = true
      node.syncHash = fp.syncHash
      node.syncMtime = fp.syncMtime
      issues.push({
        id: `stale:${node.id}`,
        category: 'stale_anchor',
        severity: 'warn',
        nodeId: node.id,
        kbId: node.kbId,
        extRef: node.extRef,
        title: node.title,
        message: `外挂文件已变更，锚点需重织：${node.extRef}`,
        actions: ['reweave', 'locate', 'ignore'],
      })
    } else if (node.stale) {
      node.stale = false
    }
  }
  fabricGraph.saveGraph(userData, graph)
  return { staleCount, issues }
}

function listGraphConflicts(userData) {
  const graph = fabricGraph.loadGraph(userData)
  const byId = new Map((graph.nodes || []).map(n => [n.id, n]))
  const issues = []
  for (const edge of graph.edges || []) {
    if (edge.type !== 'contradicts') continue
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b) continue
    issues.push({
      id: `conflict:${edge.id}`,
      category: 'conflict',
      severity: 'warn',
      edgeId: edge.id,
      fromId: edge.from,
      toId: edge.to,
      title: `${a.title} ↔ ${b.title}`,
      message: `概念冲突：「${a.title}」(authority ${a.authority}) vs 「${b.title}」(authority ${b.authority})`,
      actions: ['propose_reconcile', 'locate', 'ignore'],
      nodes: [a, b],
    })
  }
  return issues
}

function mapWikiLintIssues(lint) {
  return (lint.issues || []).map((i, idx) => ({
    id: `wiki:${i.type}:${i.path || idx}`,
    category: 'wiki_lint',
    severity: i.type === 'empty' || i.type === 'broken_link' ? 'error' : 'warn',
    path: i.path,
    type: i.type,
    message: i.message,
    actions: i.canOpen ? ['locate', 'propose_fix', 'ignore'] : ['ignore'],
  }))
}

function mapOkfLintIssues(report) {
  const items = []
  for (const e of report.errors || []) {
    items.push({
      id: `okf:err:${e.file}:${e.code}`,
      category: 'okf_lint',
      severity: 'error',
      path: e.file,
      message: e.message || e.code,
      actions: ['locate', 'propose_fix', 'ignore'],
    })
  }
  for (const w of report.warnings || []) {
    items.push({
      id: `okf:warn:${w.file}:${w.code}`,
      category: 'okf_lint',
      severity: 'warn',
      path: w.file,
      message: w.message || w.code,
      actions: ['locate', 'propose_fix', 'ignore'],
    })
  }
  for (const bl of report.broken_links || []) {
    items.push({
      id: `okf:link:${bl.from}:${bl.href}`,
      category: 'okf_lint',
      severity: 'error',
      path: bl.from,
      message: `OKF 断链：${bl.href}`,
      actions: ['locate', 'propose_fix', 'ignore'],
    })
  }
  for (const o of report.orphans || []) {
    items.push({
      id: `okf:orphan:${o.conceptId}`,
      category: 'okf_lint',
      severity: 'warn',
      path: o.conceptId,
      message: `孤儿概念：${o.conceptId}`,
      actions: ['locate', 'ignore'],
    })
  }
  return items
}

function computeKbHealth(kbId, issues, graph) {
  const kbIssues = issues.filter(i => i.kbId === kbId || i.category === 'wiki_lint')
  const anchors = (graph.nodes || []).filter(n => n.kind === 'anchor' && n.kbId === kbId)
  const stale = anchors.filter(n => n.stale).length
  const broken = issues.filter(i => i.category === 'broken_anchor' && i.kbId === kbId).length
  const penalty = kbIssues.filter(i => i.severity === 'error').length * 0.12
    + kbIssues.filter(i => i.severity === 'warn').length * 0.04
    + stale * 0.08
    + broken * 0.15
  return Math.max(0, Math.min(1, Number((1 - penalty).toFixed(2))))
}

function runUnifiedCheckup(userData, ctx = {}) {
  fabricGraph.ensureFabric(userData)
  const providers = Array.isArray(ctx.providers) ? ctx.providers : []
  const graph = fabricGraph.loadGraph(userData)
  const cfg = loadConfig(userData)
  const dismissed = new Set(cfg.dismissedIssueIds || [])

  const wikiLint = knowledgeOs.lintWiki(userData, ctx)
  let okfIssues = []
  try {
    const okfRoot = knowledgeOs.defaultPaths(userData).okf
    if (okfRoot && fs.existsSync(okfRoot)) {
      okfIssues = mapOkfLintIssues(okfLib.lintBundle(okfRoot))
    }
  } catch { /* optional okf */ }

  const broken = detectBrokenAnchors(userData, providers, ctx)
  const staleScan = scanStaleAnchors(userData, providers, ctx)
  const conflicts = listGraphConflicts(userData)

  const ssotDupes = []
  const concepts = (graph.nodes || []).filter(n => n.kind === 'concept')
  const seenTitles = new Map()
  for (const c of concepts) {
    const key = normalizeTitle(c.title)
    if (!key) continue
    if (seenTitles.has(key)) {
      ssotDupes.push({
        id: `dup:${c.id}:${seenTitles.get(key)}`,
        category: 'duplicate_title',
        severity: 'warn',
        nodeId: c.id,
        path: c.path,
        title: c.title,
        message: `Fabric 概念标题重复：${c.title}`,
        actions: ['propose_reconcile', 'locate', 'ignore'],
      })
    } else {
      seenTitles.set(key, c.id)
    }
  }

  let issues = [
    ...mapWikiLintIssues(wikiLint),
    ...okfIssues,
    ...broken,
    ...staleScan.issues,
    ...conflicts,
    ...ssotDupes,
  ].filter(i => !dismissed.has(i.id))

  const categories = {}
  for (const i of issues) {
    categories[i.category] = (categories[i.category] || 0) + 1
  }

  const kbHealth = {}
  const kbIds = [...new Set([
    ...providers.map(p => p.id),
    ...(graph.nodes || []).filter(n => n.kbId).map(n => n.kbId),
  ])]
  for (const kbId of kbIds) {
    const health = computeKbHealth(kbId, issues, graph)
    kbHealth[kbId] = health
    fabricGraph.updateKbRouting(userData, kbId, {
      health,
      staleAnchors: (graph.nodes || []).filter(n => n.kind === 'anchor' && n.kbId === kbId && n.stale).length,
    })
  }

  const errorCount = issues.filter(i => i.severity === 'error').length
  const warnCount = issues.filter(i => i.severity === 'warn').length
  const overallHealth = Math.max(0, Math.min(1, Number((1 - errorCount * 0.08 - warnCount * 0.02).toFixed(2))))

  saveConfig(userData, { lastCheckupAt: now() })

  return {
    ok: true,
    scannedAt: now(),
    ssotMode: cfg.ssotMode,
    overallHealth,
    kbHealth,
    categories,
    issueCount: issues.length,
    errorCount,
    warnCount,
    healthy: issues.length === 0,
    wikiScanned: wikiLint.scanned,
    issues,
    stats: fabricGraph.summarizeGraph(graph),
    reweaveQueue: cfg.reweaveQueue,
  }
}

function addGovernanceProposal(userData, proposal = {}) {
  const store = loadProposals(userData)
  const item = {
    id: String(proposal.id || id('fgp')),
    status: 'pending',
    type: String(proposal.type || 'cleanup'),
    title: String(proposal.title || '治理提案').slice(0, 120),
    rationale: String(proposal.rationale || '').slice(0, 800),
    targetNodeId: proposal.targetNodeId || null,
    edgeId: proposal.edgeId || null,
    kbId: proposal.kbId || null,
    payload: proposal.payload && typeof proposal.payload === 'object' ? proposal.payload : {},
    createdAt: now(),
  }
  store.proposals = [item, ...store.proposals.filter(p => p.id !== item.id)].slice(0, 200)
  saveProposals(userData, store)
  return { ok: true, proposal: item }
}

function listGovernanceProposals(userData) {
  return { ok: true, proposals: loadProposals(userData).proposals }
}

function applyGovernanceProposal(userData, proposalId) {
  const store = loadProposals(userData)
  const proposal = store.proposals.find(p => p.id === String(proposalId || ''))
  if (!proposal) return { ok: false, error: '治理提案不存在' }
  if (proposal.status === 'accepted') return { ok: true, already: true, proposal }

  if (proposal.type === 'cleanup' && proposal.targetNodeId) {
    fabricGraph.removeNode(userData, proposal.targetNodeId)
  } else if (proposal.type === 'alias' && proposal.targetNodeId && proposal.payload?.candidate) {
    const cand = proposal.payload.candidate
    const aliasId = cand.id || `c:${normalizeTitle(cand.title).replace(/[^\w\u4e00-\u9fff-]+/g, '-')}`
    fabricGraph.upsertEdge(userData, {
      from: aliasId,
      to: proposal.targetNodeId,
      type: 'alias',
      weight: proposal.payload.score || 0.8,
    })
  } else if (proposal.type === 'reconcile' && proposal.payload?.fromId && proposal.payload?.toId) {
    fabricGraph.upsertEdge(userData, {
      from: proposal.payload.fromId,
      to: proposal.payload.toId,
      type: 'refines',
      weight: 0.7,
    })
    if (proposal.edgeId) fabricGraph.removeEdge(userData, proposal.edgeId)
  } else if (proposal.type === 'reweave' && proposal.kbId) {
    enqueueReweave(userData, proposal.kbId)
  }

  proposal.status = 'accepted'
  saveProposals(userData, store)
  return { ok: true, proposal }
}

function rejectGovernanceProposal(userData, proposalId) {
  const store = loadProposals(userData)
  const proposal = store.proposals.find(p => p.id === String(proposalId || ''))
  if (!proposal) return { ok: false, error: '治理提案不存在' }
  proposal.status = 'rejected'
  saveProposals(userData, store)
  return { ok: true, proposal }
}

function ensureContradictsEdge(userData, fromId, toId, meta = {}) {
  if (!fromId || !toId || fromId === toId) return { ok: false }
  const graph = fabricGraph.loadGraph(userData)
  const exists = (graph.edges || []).some(
    e => e.type === 'contradicts'
      && ((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))
  )
  if (exists) return { ok: true, already: true }
  return fabricGraph.upsertEdge(userData, {
    from: String(fromId),
    to: String(toId),
    type: 'contradicts',
    weight: 0.6,
    rationale: meta.rationale,
  })
}

function recordRetrievalConflicts(userData, hits = []) {
  let added = 0
  for (const hit of hits) {
    if (!hit.conflict || hit.conflict.type !== 'contradicts') continue
    const loserId = hit.nodeId
    const winnerId = hit.conflict.winnerId
    if (!loserId || !winnerId) continue
    const r = ensureContradictsEdge(userData, loserId, winnerId, { rationale: '检索冲突回流' })
    if (r.ok && !r.already) added++
  }
  return { ok: true, added }
}

function dismissIssue(userData, issueId) {
  const cfg = loadConfig(userData)
  const key = String(issueId || '')
  if (!key) return { ok: false, error: '缺少 issueId' }
  if (!cfg.dismissedIssueIds.includes(key)) cfg.dismissedIssueIds.push(key)
  saveConfig(userData, { dismissedIssueIds: cfg.dismissedIssueIds.slice(-500) })
  return { ok: true }
}

function enqueueReweave(userData, kbId) {
  const cfg = loadConfig(userData)
  const key = String(kbId || '')
  if (!key) return { ok: false, error: '缺少 kbId' }
  const queue = cfg.reweaveQueue.filter(q => q.kbId !== key)
  queue.unshift({ kbId: key, enqueuedAt: now() })
  saveConfig(userData, { reweaveQueue: queue.slice(0, 20) })
  return { ok: true, queue: queue.slice(0, 20) }
}

function processReweaveQueue(userData, ctx = {}, opts = {}) {
  const cfg = loadConfig(userData)
  const max = Number.isFinite(opts.max) ? opts.max : 1
  const providers = Array.isArray(ctx.providers) ? ctx.providers : []
  const processed = []
  const remaining = [...cfg.reweaveQueue]

  while (processed.length < max && remaining.length) {
    const item = remaining.shift()
    const provider = providers.find(p => p.id === item.kbId)
    if (!provider) continue
    const fabricWeave = require('./fabric-weave')
    const woven = fabricWeave.weaveProvider(userData, provider, ctx)
    if (woven.ok) {
      fabricGraph.updateKbRouting(userData, item.kbId, { lastWoven: now() })
      processed.push({ kbId: item.kbId, proposalId: woven.proposal?.id })
    }
  }

  saveConfig(userData, { reweaveQueue: remaining })
  scanStaleAnchors(userData, providers, ctx)
  return { ok: true, processed, remaining }
}

function createIssueProposal(userData, issue = {}, action = '') {
  const act = String(action || '')
  if (act === 'propose_cleanup' && issue.nodeId) {
    return addGovernanceProposal(userData, {
      type: 'cleanup',
      title: `清理悬空锚点：${issue.title || issue.nodeId}`,
      rationale: issue.message,
      targetNodeId: issue.nodeId,
      kbId: issue.kbId,
    })
  }
  if (act === 'propose_relocate' && issue.nodeId) {
    return addGovernanceProposal(userData, {
      type: 'cleanup',
      title: `重定位锚点：${issue.title || issue.nodeId}`,
      rationale: `${issue.message}。请在外挂库恢复文件后重织，或移除此锚点。`,
      targetNodeId: issue.nodeId,
      kbId: issue.kbId,
    })
  }
  if (act === 'propose_reconcile' && issue.fromId && issue.toId) {
    return addGovernanceProposal(userData, {
      type: 'reconcile',
      title: `调和冲突：${issue.title || ''}`,
      rationale: issue.message,
      edgeId: issue.edgeId,
      payload: { fromId: issue.fromId, toId: issue.toId },
    })
  }
  if (act === 'reweave' && issue.kbId) {
    enqueueReweave(userData, issue.kbId)
    return addGovernanceProposal(userData, {
      type: 'reweave',
      title: `重织：${issue.kbId}`,
      rationale: issue.message,
      kbId: issue.kbId,
    })
  }
  if (act === 'ignore' && issue.id) {
    return dismissIssue(userData, issue.id)
  }
  return { ok: false, error: '不支持的操作' }
}

function setSsotMode(userData, mode) {
  const ssotMode = mode === 'block' ? 'block' : 'mark'
  saveConfig(userData, { ssotMode })
  return { ok: true, ssotMode }
}

module.exports = {
  loadConfig,
  saveConfig,
  setSsotMode,
  checkSsot,
  checkIngestSsot,
  filterSsotAnchors,
  detectBrokenAnchors,
  scanStaleAnchors,
  listGraphConflicts,
  runUnifiedCheckup,
  addGovernanceProposal,
  listGovernanceProposals,
  applyGovernanceProposal,
  rejectGovernanceProposal,
  ensureContradictsEdge,
  recordRetrievalConflicts,
  dismissIssue,
  enqueueReweave,
  processReweaveQueue,
  createIssueProposal,
  fileFingerprint,
  similarityScore,
  findBestMatch,
}
