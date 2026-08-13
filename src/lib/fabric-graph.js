'use strict'

/**
 * fabric-graph — Knowledge Fabric 语义/结构层 + 路由元数据 CRUD。
 * 数据根：%APPDATA%\\KnowMe\\knowledge-os\\fabric\\{graph.json,routing.json}
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const EDGE_TYPES = new Set([
  'refines',
  'coversTopic',
  'alias',
  'relatesTo',
  'contradicts',
  'ownedBy',
])

const NODE_KINDS = new Set(['concept', 'anchor'])

function fabricDir(userData) {
  return path.join(userData, 'knowledge-os', 'fabric')
}

function graphPath(userData) {
  return path.join(fabricDir(userData), 'graph.json')
}

function routingPath(userData) {
  return path.join(fabricDir(userData), 'routing.json')
}

function weaveProposalsPath(userData) {
  return path.join(fabricDir(userData), 'weave-proposals.json')
}

function now() {
  return new Date().toISOString()
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
}

function defaultGraph() {
  return { version: 1, nodes: [], edges: [], updatedAt: now() }
}

function defaultRouting() {
  return { version: 1, topics: {}, kbs: {}, updatedAt: now() }
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

function ensureFabric(userData) {
  fs.mkdirSync(fabricDir(userData), { recursive: true })
  const gp = graphPath(userData)
  const rp = routingPath(userData)
  if (!fs.existsSync(gp)) writeAtomic(gp, defaultGraph())
  if (!fs.existsSync(rp)) writeAtomic(rp, defaultRouting())
  const wp = weaveProposalsPath(userData)
  if (!fs.existsSync(wp)) writeAtomic(wp, { version: 1, proposals: [], updatedAt: now() })
  return { graph: loadGraph(userData), routing: loadRouting(userData) }
}

function loadGraph(userData) {
  const g = readJson(graphPath(userData), defaultGraph)
  g.nodes = Array.isArray(g.nodes) ? g.nodes : []
  g.edges = Array.isArray(g.edges) ? g.edges : []
  g.version = g.version || 1
  return g
}

function saveGraph(userData, graph) {
  const next = { ...graph, updatedAt: now() }
  writeAtomic(graphPath(userData), next)
  return next
}

function loadRouting(userData) {
  const r = readJson(routingPath(userData), defaultRouting)
  r.topics = r.topics && typeof r.topics === 'object' ? r.topics : {}
  r.kbs = r.kbs && typeof r.kbs === 'object' ? r.kbs : {}
  r.version = r.version || 1
  return r
}

function saveRouting(userData, routing) {
  const next = { ...routing, updatedAt: now() }
  writeAtomic(routingPath(userData), next)
  return next
}

function normalizeNode(node = {}) {
  const kind = NODE_KINDS.has(node.kind) ? node.kind : 'concept'
  return {
    id: String(node.id || id(kind === 'anchor' ? 'a' : 'c')),
    kind,
    title: String(node.title || '未命名').slice(0, 160),
    summary: String(node.summary || '').slice(0, 800),
    tags: Array.isArray(node.tags) ? node.tags.map(t => String(t).slice(0, 40)).slice(0, 12) : [],
    authority: Math.max(1, Math.min(5, Number.isFinite(node.authority) ? node.authority : 2)),
    path: node.path != null ? String(node.path).replace(/\\/g, '/') : undefined,
    kbId: node.kbId != null ? String(node.kbId) : undefined,
    extRef: node.extRef != null ? String(node.extRef).replace(/\\/g, '/') : undefined,
    embedding: node.embedding != null ? node.embedding : undefined,
    lastSynced: node.lastSynced || null,
    syncHash: node.syncHash != null ? String(node.syncHash) : undefined,
    syncMtime: Number.isFinite(node.syncMtime) ? node.syncMtime : undefined,
    stale: !!node.stale,
  }
}

function normalizeEdge(edge = {}) {
  const type = EDGE_TYPES.has(edge.type) ? edge.type : 'relatesTo'
  return {
    id: String(edge.id || id('e')),
    from: String(edge.from || ''),
    to: String(edge.to || ''),
    type,
    weight: Number.isFinite(edge.weight) ? Math.max(0, Math.min(1, edge.weight)) : 0.5,
  }
}

function upsertNode(userData, node) {
  ensureFabric(userData)
  const graph = loadGraph(userData)
  const n = normalizeNode(node)
  const idx = graph.nodes.findIndex(item => item.id === n.id)
  if (idx >= 0) graph.nodes[idx] = { ...graph.nodes[idx], ...n }
  else graph.nodes.push(n)
  return { ok: true, node: n, graph: saveGraph(userData, graph) }
}

function removeNode(userData, nodeId) {
  const graph = loadGraph(userData)
  const nid = String(nodeId || '')
  graph.nodes = graph.nodes.filter(n => n.id !== nid)
  graph.edges = graph.edges.filter(e => e.from !== nid && e.to !== nid)
  return { ok: true, graph: saveGraph(userData, graph) }
}

function upsertEdge(userData, edge) {
  ensureFabric(userData)
  const graph = loadGraph(userData)
  const e = normalizeEdge(edge)
  if (!e.from || !e.to) return { ok: false, error: '边缺少 from/to' }
  const idx = graph.edges.findIndex(item => item.id === e.id)
  if (idx >= 0) graph.edges[idx] = { ...graph.edges[idx], ...e }
  else graph.edges.push(e)
  return { ok: true, edge: e, graph: saveGraph(userData, graph) }
}

function removeEdge(userData, edgeId) {
  const graph = loadGraph(userData)
  graph.edges = graph.edges.filter(e => e.id !== String(edgeId || ''))
  return { ok: true, graph: saveGraph(userData, graph) }
}

function getSnapshot(userData) {
  ensureFabric(userData)
  return {
    ok: true,
    graph: loadGraph(userData),
    routing: loadRouting(userData),
    stats: summarizeGraph(loadGraph(userData)),
  }
}

function summarizeGraph(graph) {
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  return {
    concepts: nodes.filter(n => n.kind === 'concept').length,
    anchors: nodes.filter(n => n.kind === 'anchor').length,
    edges: edges.length,
    staleAnchors: nodes.filter(n => n.kind === 'anchor' && n.stale).length,
    contradicts: edges.filter(e => e.type === 'contradicts').length,
  }
}

function updateKbRouting(userData, kbId, patch = {}) {
  ensureFabric(userData)
  const routing = loadRouting(userData)
  const key = String(kbId || '')
  routing.kbs[key] = {
    ...(routing.kbs[key] || {}),
    ...patch,
    lastWoven: patch.lastWoven || routing.kbs[key]?.lastWoven || null,
    staleAnchors: Number.isFinite(patch.staleAnchors)
      ? patch.staleAnchors
      : (routing.kbs[key]?.staleAnchors || 0),
    health: Number.isFinite(patch.health)
      ? patch.health
      : (routing.kbs[key]?.health ?? 1),
  }
  return saveRouting(userData, routing)
}

function upsertTopicRouting(userData, topicKey, patch = {}) {
  ensureFabric(userData)
  const routing = loadRouting(userData)
  const key = String(topicKey || '').trim()
  if (!key) return { ok: false, error: '缺少 topic key' }
  routing.topics[key] = {
    owners: [],
    coverageInRoot: 0,
    delegateTo: [],
    authorityRank: [],
    ...(routing.topics[key] || {}),
    ...patch,
  }
  saveRouting(userData, routing)
  return { ok: true, topic: routing.topics[key] }
}

function loadWeaveProposals(userData) {
  const data = readJson(weaveProposalsPath(userData), () => ({ version: 1, proposals: [] }))
  data.proposals = Array.isArray(data.proposals) ? data.proposals : []
  return data
}

function saveWeaveProposals(userData, data) {
  writeAtomic(weaveProposalsPath(userData), { ...data, updatedAt: now() })
}

function addWeaveProposal(userData, proposal) {
  ensureFabric(userData)
  const store = loadWeaveProposals(userData)
  const item = {
    id: String(proposal.id || id('fwp')),
    status: proposal.status === 'accepted' || proposal.status === 'rejected' ? proposal.status : 'pending',
    kbId: String(proposal.kbId || ''),
    title: String(proposal.title || '织网提案').slice(0, 120),
    rationale: String(proposal.rationale || '').slice(0, 800),
    anchors: Array.isArray(proposal.anchors) ? proposal.anchors : [],
    edges: Array.isArray(proposal.edges) ? proposal.edges : [],
    topics: proposal.topics && typeof proposal.topics === 'object' ? proposal.topics : {},
    createdAt: proposal.createdAt || now(),
  }
  store.proposals = [item, ...store.proposals.filter(p => p.id !== item.id)].slice(0, 200)
  saveWeaveProposals(userData, store)
  return { ok: true, proposal: item }
}

function applyWeaveProposal(userData, proposalId) {
  const store = loadWeaveProposals(userData)
  const proposal = store.proposals.find(p => p.id === String(proposalId || ''))
  if (!proposal) return { ok: false, error: '织网提案不存在' }
  if (proposal.status === 'accepted') return { ok: true, already: true }
  for (const anchor of proposal.anchors || []) upsertNode(userData, anchor)
  for (const edge of proposal.edges || []) upsertEdge(userData, edge)
  proposal.status = 'accepted'
  saveWeaveProposals(userData, store)
  if (proposal.kbId) {
    updateKbRouting(userData, proposal.kbId, { lastWoven: now(), health: 1 })
  }
  return { ok: true, proposal, graph: loadGraph(userData) }
}

function rejectWeaveProposal(userData, proposalId) {
  const store = loadWeaveProposals(userData)
  const proposal = store.proposals.find(p => p.id === String(proposalId || ''))
  if (!proposal) return { ok: false, error: '织网提案不存在' }
  proposal.status = 'rejected'
  saveWeaveProposals(userData, store)
  return { ok: true, proposal }
}

function listWeaveProposals(userData) {
  ensureFabric(userData)
  const store = loadWeaveProposals(userData)
  return { ok: true, proposals: store.proposals }
}

/** 从 wiki 条目种子化 concept 节点（MVP 文件级） */
function seedConceptsFromEntries(userData, entries = [], opts = {}) {
  ensureFabric(userData)
  const graph = loadGraph(userData)
  const authority = Number.isFinite(opts.authority) ? opts.authority : 2
  let added = 0
  for (const entry of entries) {
    const rel = String(entry.path || '').replace(/\\/g, '/')
    if (!rel) continue
    const nodeId = `c:${rel.replace(/[^\w\u4e00-\u9fff/.-]+/g, '-')}`
    if (graph.nodes.some(n => n.id === nodeId)) continue
    graph.nodes.push(normalizeNode({
      id: nodeId,
      kind: 'concept',
      title: entry.title || rel,
      summary: String(entry.summary || '').slice(0, 400),
      path: rel,
      authority,
      tags: entry.kind === 'okf' ? ['okf'] : ['wiki'],
    }))
    added++
  }
  if (added) saveGraph(userData, graph)
  return { ok: true, added, graph }
}

module.exports = {
  EDGE_TYPES,
  NODE_KINDS,
  fabricDir,
  ensureFabric,
  loadGraph,
  saveGraph,
  loadRouting,
  saveRouting,
  normalizeNode,
  normalizeEdge,
  upsertNode,
  removeNode,
  upsertEdge,
  removeEdge,
  getSnapshot,
  summarizeGraph,
  updateKbRouting,
  upsertTopicRouting,
  addWeaveProposal,
  applyWeaveProposal,
  rejectWeaveProposal,
  listWeaveProposals,
  seedConceptsFromEntries,
}
