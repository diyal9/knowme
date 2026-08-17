'use strict'

/**
 * fabric-retrieval — 根优先检索编排：根检索 → 路由 → 选择性召回 → RRF+authority 融合 → 冲突裁决。
 */

const fabricGraph = require('./fabric-graph')
const fabricGovernance = require('./fabric-governance')
const qmdEngine = require('./qmd-engine')
const knowledgeProvider = require('./knowledge-provider')
const knowledgeRank = require('./knowledge-rank')

const DEFAULT_TOPK = 8
const RRF_K = 60

function tokenOverlap(a, b) {
  const ta = new Set(knowledgeRank.tokenize(String(a || '')))
  const tb = new Set(knowledgeRank.tokenize(String(b || '')))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

function rrfFuse(lists, opts = {}) {
  const k = Number.isFinite(opts.k) ? opts.k : RRF_K
  const scores = new Map()
  const meta = new Map()
  for (const list of lists) {
    const weight = Number.isFinite(list.weight) ? list.weight : 1
    const hits = Array.isArray(list.hits) ? list.hits : []
    hits.forEach((hit, rank) => {
      const key = hit.refKey || `${hit.kbId || 'root'}:${hit.path || hit.nodeId || hit.title}`
      const inc = weight * (1 / (k + rank + 1))
      scores.set(key, (scores.get(key) || 0) + inc)
      if (!meta.has(key)) meta.set(key, hit)
      else {
        const prev = meta.get(key)
        meta.set(key, {
          ...prev,
          ...hit,
          snippet: hit.snippet || prev.snippet,
          sources: [...(prev.sources || []), ...(hit.sources || [hit.kbId || 'root'])],
        })
      }
    })
  }
  const authorityBoost = (hit) => {
    const auth = Number.isFinite(hit.authority) ? hit.authority : 2
    const tier = Number.isFinite(hit.retrievalTier) ? hit.retrievalTier : 2
    return 1 + auth * 0.08 + (6 - tier) * 0.04
  }
  return [...scores.entries()]
    .map(([key, score]) => {
      const hit = meta.get(key) || {}
      return {
        ...hit,
        refKey: key,
        rrfScore: Number((score * authorityBoost(hit)).toFixed(6)),
      }
    })
    .sort((a, b) => b.rrfScore - a.rrfScore)
}

function buildRootDocs(graph, wikiDocs = []) {
  const docs = []
  for (const node of graph.nodes || []) {
    const text = `${node.title}\n${node.summary || ''}`
    docs.push({
      title: node.title,
      path: node.path || node.id,
      content: text,
      nodeId: node.id,
      kind: node.kind,
      authority: node.authority,
      kbId: node.kbId || 'kb_personal',
      retrievalTier: 1,
      source: 'fabric-root',
    })
  }
  for (const doc of wikiDocs) {
    docs.push({
      ...doc,
      kbId: 'kb_personal',
      retrievalTier: 1,
      source: 'wiki',
      refKey: `wiki:${doc.path}`,
    })
  }
  return docs
}

function routeQuery(graph, routing, rootHits, queryText, providers = []) {
  const q = String(queryText || '').trim()
  const rootCoverage = rootHits.length
    ? rootHits.reduce((s, h) => s + (h.score || h.rrfScore || 0), 0) / rootHits.length
    : 0
  const staleAnchors = (graph.nodes || []).filter(n => n.kind === 'anchor' && n.stale)
  const topics = routing.topics || {}
  let delegateTo = []
  let forced = []
  for (const [topicKey, topic] of Object.entries(topics)) {
    if (tokenOverlap(topicKey.replace(/\./g, ' '), q) < 0.25) continue
    if (Array.isArray(topic.delegateTo)) delegateTo.push(...topic.delegateTo)
    if (Array.isArray(topic.owners)) forced.push(...topic.owners)
  }
  delegateTo = [...new Set(delegateTo)]
  forced = [...new Set(forced)]

  const shortCircuit = rootCoverage >= 6 && staleAnchors.length === 0 && rootHits.length >= 2
  const broadFanout = rootHits.length === 0 || rootCoverage < 2

  let targetKbIds = []
  if (shortCircuit) {
    targetKbIds = []
  } else if (forced.length || delegateTo.length) {
    targetKbIds = [...new Set([...forced, ...delegateTo])]
  } else if (broadFanout) {
    targetKbIds = providers
      .filter(p => p.id !== 'kb_personal' && p.id !== 'local-default')
      .sort((a, b) => (a.retrievalTier || 9) - (b.retrievalTier || 9))
      .map(p => p.id)
  } else {
    const anchorKb = rootHits
      .filter(h => h.kind === 'anchor' && h.kbId)
      .map(h => h.kbId)
    targetKbIds = [...new Set(anchorKb)]
  }

  if (staleAnchors.length) {
    const staleKb = staleAnchors.map(a => a.kbId).filter(Boolean)
    targetKbIds = [...new Set([...targetKbIds, ...staleKb])]
  }

  return {
    shortCircuit,
    broadFanout,
    rootCoverage,
    targetKbIds,
    staleAnchorCount: staleAnchors.length,
  }
}

function resolveConflicts(hits, graph) {
  const edges = graph.edges || []
  const contradictPairs = edges.filter(e => e.type === 'contradicts')
  const byId = new Map((graph.nodes || []).map(n => [n.id, n]))
  const flagged = hits.map(hit => ({ ...hit, conflict: null }))

  for (const pair of contradictPairs) {
    const a = byId.get(pair.from)
    const b = byId.get(pair.to)
    if (!a || !b) continue
    const idxA = flagged.findIndex(h => h.nodeId === a.id || h.path === a.path)
    const idxB = flagged.findIndex(h => h.nodeId === b.id || h.path === b.path)
    if (idxA < 0 || idxB < 0) continue
    const hitA = flagged[idxA]
    const hitB = flagged[idxB]
    const pinA = hitA.pinned ? 1 : 0
    const pinB = hitB.pinned ? 1 : 0
    let winner = hitA
    let loser = hitB
    if (pinB > pinA) {
      winner = hitB
      loser = hitA
    } else if ((b.authority || 0) > (a.authority || 0)) {
      winner = hitB
      loser = hitA
    } else if ((b.authority || 0) === (a.authority || 0)) {
      const recA = Date.parse(hitA.updatedAt || a.lastSynced || 0) || 0
      const recB = Date.parse(hitB.updatedAt || b.lastSynced || 0) || 0
      if (recB > recA) {
        winner = hitB
        loser = hitA
      }
    }
    loser.conflict = {
      type: 'contradicts',
      winnerTitle: winner.title,
      winnerId: winner.nodeId || winner.path,
      message: `与「${winner.title}」存在冲突，已按 authority/recency 保留优先项`,
    }
    winner.conflict = winner.conflict || null
  }
  return flagged
}

function attachProvenance(hit, routeInfo) {
  return {
    ...hit,
    provenance: {
      kbId: hit.kbId || 'kb_personal',
      source: hit.source || hit.engine || 'fabric',
      authority: hit.authority ?? 2,
      scope: hit.scope || 'client',
      route: {
        shortCircuit: !!routeInfo.shortCircuit,
        broadFanout: !!routeInfo.broadFanout,
        rootCoverage: routeInfo.rootCoverage,
      },
    },
  }
}

/**
 * @param {string} userData
 * @param {string} queryText
 * @param {object} ctx { providers, wikiDocs, loadKbDocs, queryProvider, embed, topK }
 */
async function fabricSearch(userData, queryText, ctx = {}) {
  const q = String(queryText || '').trim()
  if (!q) return { ok: true, hits: [], message: '请输入查询关键词' }

  fabricGraph.ensureFabric(userData)
  const graph = fabricGraph.loadGraph(userData)
  const routing = fabricGraph.loadRouting(userData)
  const topK = Number.isFinite(ctx.topK) ? ctx.topK : DEFAULT_TOPK

  const providers = Array.isArray(ctx.providers) ? ctx.providers : []
  const includeDraft = !!ctx.includeDraft
  const registryProviders = providers.map(p => knowledgeProvider.normalizeProvider(p))
    .filter(p => includeDraft || (p.authority || 2) > 1)

  const rootDocs = buildRootDocs(graph, ctx.wikiDocs || [])
  const rootRes = await qmdEngine.queryCollection('root', q, {
    docs: rootDocs,
    topK,
    embed: ctx.embed,
  })
  const rootHits = (rootRes.hits || []).map(h => ({
    ...h,
    kbId: h.kbId || 'kb_personal',
    authority: h.authority ?? 2,
    scope: 'client',
    retrievalTier: 1,
    refKey: h.nodeId ? `node:${h.nodeId}` : `root:${h.path}`,
    kind: h.kind || 'concept',
  }))

  const routeInfo = routeQuery(graph, routing, rootHits, q, registryProviders)
  const lists = [{ hits: rootHits, weight: 1.2 }]

  if (!routeInfo.shortCircuit) {
    for (const kbId of routeInfo.targetKbIds) {
      const provider = registryProviders.find(p => p.id === kbId)
      if (!provider) continue
      if (provider.kind === 'remote-rag' && typeof ctx.queryProvider === 'function') {
        const remote = await ctx.queryProvider(provider, q, ctx)
        if (remote.ok && remote.hits?.length) {
          lists.push({
            weight: 0.9 + (provider.authority || 2) * 0.05,
            hits: remote.hits.map(h => ({
              ...h,
              kbId: provider.id,
              authority: provider.authority,
              scope: provider.scope,
              retrievalTier: provider.retrievalTier,
              refKey: `${provider.id}:${h.path}`,
              source: 'remote-rag',
            })),
          })
        }
      } else if (typeof ctx.loadKbDocs === 'function') {
        const docs = await ctx.loadKbDocs(provider)
        const local = await qmdEngine.queryCollection(provider.collectionId || provider.id, q, {
          docs,
          topK,
          embed: ctx.embed,
        })
        if (local.hits?.length) {
          lists.push({
            weight: 0.85 + (provider.authority || 2) * 0.06,
            hits: local.hits.map(h => ({
              ...h,
              kbId: provider.id,
              authority: provider.authority,
              scope: provider.scope,
              retrievalTier: provider.retrievalTier,
              refKey: `${provider.id}:${h.path}`,
              source: 'kb-local',
            })),
          })
        }
      }
    }
  }

  let fused = rrfFuse(lists).slice(0, topK)
  fused = resolveConflicts(fused, graph).map(h => attachProvenance(h, routeInfo))
  if (ctx.recordConflicts !== false) {
    fabricGovernance.recordRetrievalConflicts(userData, fused)
  }

  const engineStatus = await qmdEngine.getEngineStatus()
  return {
    ok: true,
    hits: fused,
    route: routeInfo,
    engine: engineStatus.engine,
    qmdEnabled: engineStatus.qmdEnabled,
    message: fused.length ? null : '未找到相关知识，可尝试织网或换关键词',
  }
}

async function kbQuery(userData, collectionOrKbId, queryText, ctx = {}) {
  const provider = (ctx.providers || []).find(p => p.id === collectionOrKbId || p.collectionId === collectionOrKbId)
  if (provider?.kind === 'remote-rag' && typeof ctx.queryProvider === 'function') {
    return ctx.queryProvider(provider, queryText, ctx)
  }
  const docs = typeof ctx.loadKbDocs === 'function' && provider
    ? await ctx.loadKbDocs(provider)
    : (ctx.wikiDocs || [])
  return qmdEngine.queryCollection(collectionOrKbId, queryText, {
    docs,
    topK: ctx.topK,
    embed: ctx.embed,
  })
}

async function kbGet(userData, ref, ctx = {}) {
  const refStr = String(ref || '').trim()
  if (!refStr) return { ok: false, error: '缺少 ref' }
  const graph = fabricGraph.loadGraph(userData)
  const node = (graph.nodes || []).find(n => n.id === refStr || n.extRef === refStr || n.path === refStr)
  if (node?.summary && !ctx.fullText) {
    return { ok: true, ref: refStr, title: node.title, content: node.summary, kind: node.kind, anchor: true }
  }
  if (node?.path && typeof ctx.readWiki === 'function') {
    return ctx.readWiki(node.path)
  }
  if (typeof ctx.resolveRef === 'function') return ctx.resolveRef(refStr)
  return qmdEngine.getDocument(refStr, ctx)
}

module.exports = {
  RRF_K,
  rrfFuse,
  routeQuery,
  resolveConflicts,
  fabricSearch,
  kbQuery,
  kbGet,
}
