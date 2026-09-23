'use strict'

/**
 * Brain application service: projects legacy cognition into one local graph,
 * answers explainable queries and delegates external retrieval without copying
 * provider knowledge bodies into the durable Brain.
 */

const crypto = require('crypto')
const path = require('path')
const brainStore = require('./brain-store')
const knowledgeRank = require('./knowledge-rank')
const defaultKnowledgeOs = require('./knowledge-os')
const defaultFabricGraph = require('./fabric-graph')
const defaultProductMemory = require('./product-memory')
const memoryConsolidation = require('./memory-consolidation')
const knowledgeProvider = require('./knowledge-provider')
const queryCache = require('./brain-query-cache')
const growthLedger = require('./growth-ledger')
const brainTaxonomy = require('./brain-taxonomy')
const brainQueryScope = require('./brain-query-scope')
const { createCognitionRuntime } = require('./brain-cognition-runtime')

const MIGRATION_VERSION = 3
const DEFAULT_TOP_K = 8
const MAX_VISIBLE_NODES = 100
const STATUS_WEIGHT = Object.freeze({ confirmed: 1, observed: 0.68, inferred: 0.48 })

function hashContent(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

function kindForMemory(type) {
  return ({ preference: 'preference', goal: 'goal', decision: 'decision', relationship: 'person' })[type] || 'concept'
}

function predicateForNode(kind) {
  return ({
    preference: 'hasPreference',
    goal: 'pursues',
    decision: 'madeDecision',
    project: 'worksOn',
    problem: 'hasOpenProblem',
    task: 'hasTask',
    person: 'relatesTo',
  })[kind] || 'knows'
}

function memoryEvidenceType(source = {}) {
  return source.type === 'conversation' ? 'conversation' : 'local_file'
}

function nodeFromFabric(input = {}) {
  const external = input.kind === 'anchor' && !!input.kbId && !['kb_personal', 'local-default'].includes(input.kbId)
  return brainStore.normalizeNode({
    id: input.id,
    kind: input.kind === 'anchor' ? (external ? 'collection' : 'source') : 'concept',
    label: input.title,
    summary: input.summary,
    tags: input.tags,
    authority: input.authority,
    sourceRef: input.path || input.extRef,
    providerId: input.kbId,
    external,
    stale: input.stale,
    updatedAt: input.lastSynced || undefined,
  })
}

function isLegacyWikiSeedNode(input = {}) {
  const sourceRef = String(input.path || input.sourceRef || '').replace(/\\/g, '/')
  const tags = new Set(Array.isArray(input.tags) ? input.tags : [])
  if (!sourceRef || input.kind !== 'concept' || (!tags.has('wiki') && !tags.has('okf'))) return false
  const legacyId = `c:${sourceRef.replace(/[^\w\u4e00-\u9fff/.-]+/g, '-')}`
  return input.id === legacyId
}

function legacyWikiArtifactIds(snapshot = {}) {
  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : []
  const claims = Array.isArray(snapshot.claims) ? snapshot.claims : []
  const sourceIds = new Set(nodes
    .filter(item => item.kind === 'source' && item.tags?.includes('llmwiki') && item.tags?.includes('mounted'))
    .map(item => item.id))
  const generatedNodeIds = new Set(nodes
    .filter(item => (
      sourceIds.has(item.id)
      || (String(item.id || '').startsWith('knowledge_') && (item.tags?.includes('wiki') || item.tags?.includes('okf')))
      || isLegacyWikiSeedNode(item)
    ))
    .map(item => item.id))
  const generatedClaims = claims.filter(item => (
    generatedNodeIds.has(item.subjectId)
    || generatedNodeIds.has(item.objectNodeId)
    || (sourceIds.has(item.subjectId) && item.predicate === 'contains')
  ))
  const evidenceIds = new Set(generatedClaims.flatMap(item => item.evidenceRefs || []))
  return { generatedNodeIds, evidenceIds }
}

function uniqueById(items) {
  return [...new Map(items.filter(Boolean).map(item => [item.id, item])).values()]
}

function dateScore(value, at = Date.now()) {
  const timestamp = Date.parse(value || '')
  if (!Number.isFinite(timestamp)) return 0.55
  const ageDays = Math.max(0, (at - timestamp) / 86400000)
  return Math.max(0.15, Math.exp(-ageDays / 240))
}

function activeClaim(claim, at = Date.now()) {
  if (!claim || ['rejected', 'superseded', 'expired'].includes(claim.status)) return false
  const validTo = Date.parse(claim.validTo || '')
  return !Number.isFinite(validTo) || validTo >= at
}

function graphIndex(data, at = Date.now()) {
  const adjacency = new Map()
  const conflictClaimIds = new Set()
  const conflictNodeIds = new Set()
  const groups = new Map()
  const evidenceIds = new Set((data.evidence || []).map(item => item.id))
  for (const claim of data.claims || []) {
    if (!activeClaim(claim, at)) continue
    if (!(claim.evidenceRefs || []).some(id => evidenceIds.has(id))) continue
    if (claim.objectNodeId) {
      for (const [from, to] of [[claim.subjectId, claim.objectNodeId], [claim.objectNodeId, claim.subjectId]]) {
        if (!adjacency.has(from)) adjacency.set(from, [])
        adjacency.get(from).push({ nodeId: to, claimId: claim.id })
      }
    }
    const key = `${claim.subjectId}:${claim.predicate}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(claim)
  }
  for (const claims of groups.values()) {
    const values = new Set(claims.map(claim => claim.objectNodeId || JSON.stringify(claim.value)))
    if (values.size <= 1) continue
    for (const claim of claims) {
      conflictClaimIds.add(claim.id)
      conflictNodeIds.add(claim.subjectId)
      if (claim.objectNodeId) conflictNodeIds.add(claim.objectNodeId)
    }
  }
  return { adjacency, conflictClaimIds, conflictNodeIds }
}

function shortestPath(data, fromId, toId, options = {}) {
  if (!fromId || !toId) return null
  if (fromId === toId) return { nodeIds: [fromId], claimIds: [], distance: 0 }
  const index = options.index || graphIndex(data)
  const maxDepth = Math.max(1, Math.min(8, Number(options.maxDepth) || 6))
  const queue = [{ nodeId: fromId, nodeIds: [fromId], claimIds: [] }]
  const visited = new Set([fromId])
  while (queue.length) {
    const current = queue.shift()
    if (current.claimIds.length >= maxDepth) continue
    for (const edge of index.adjacency.get(current.nodeId) || []) {
      if (visited.has(edge.nodeId)) continue
      const next = {
        nodeId: edge.nodeId,
        nodeIds: [...current.nodeIds, edge.nodeId],
        claimIds: [...current.claimIds, edge.claimId],
      }
      if (edge.nodeId === toId) return { nodeIds: next.nodeIds, claimIds: next.claimIds, distance: next.claimIds.length }
      visited.add(edge.nodeId)
      queue.push(next)
    }
  }
  return null
}

function createService(deps = {}) {
  const store = deps.store || brainStore
  const knowledgeOs = deps.knowledgeOs || defaultKnowledgeOs
  const fabricGraph = deps.fabricGraph || defaultFabricGraph
  const productMemory = deps.productMemory || defaultProductMemory
  const cognitionRuntime = createCognitionRuntime({ store, productMemory, propose: (userData, input) => propose(userData, input) })

  function rebuild(userData, ctx = {}) {
    store.ensureBrain(userData)
    const existing = store.snapshot(userData)
    const legacyWiki = legacyWikiArtifactIds(existing)
    const oldTaxonomyNodeIds = new Set(existing.nodes.filter(brainTaxonomy.isTaxonomyNode).map(item => item.id))
    const nodes = existing.nodes.filter(item => !legacyWiki.generatedNodeIds.has(item.id) && !oldTaxonomyNodeIds.has(item.id))
    const llmWikiEvidenceIds = new Set(existing.evidence.filter(item => item.type === 'llmwiki').map(item => item.id))
    const claims = existing.claims.filter(item => !oldTaxonomyNodeIds.has(item.subjectId) && !oldTaxonomyNodeIds.has(item.objectNodeId)).filter(item => !(
      legacyWiki.generatedNodeIds.has(item.subjectId)
      || legacyWiki.generatedNodeIds.has(item.objectNodeId)
      || (item.subjectId === 'self:me'
        && item.predicate === 'knows'
        && (item.evidenceRefs || []).some(id => llmWikiEvidenceIds.has(id)))
    ))
    const evidence = existing.evidence.filter(item => !legacyWiki.evidenceIds.has(item.id) && !String(item.id || '').startsWith('evidence:brain-taxonomy:'))
    const proposals = [...existing.proposals]
    const providers = []
    const self = store.normalizeNode({
      id: 'self:me',
      kind: 'self',
      label: ctx.userLabel || '我',
      summary: 'KnowMe 持续理解并由用户确认的个人与工作上下文。',
      tags: ['self'],
      authority: 5,
    })
    nodes.push(self)

    const migrationEvidence = store.normalizeEvidence({
      id: 'evidence:legacy-migration',
      type: 'local_file',
      title: 'KnowMe 本地数据迁移',
      documentRef: path.join(userData, 'knowledge-os'),
      persistence: 'local',
      contentHash: hashContent(`brain-migration-${MIGRATION_VERSION}`),
    })
    evidence.push(migrationEvidence)

    const taxonomy = brainTaxonomy.buildTaxonomy(store, ctx.brainProfile || {})
    nodes.push(...taxonomy.nodes)
    claims.push(...taxonomy.claims)
    evidence.push(taxonomy.evidence)

    try {
      const graph = fabricGraph.loadGraph(userData)
      const skippedWikiSeeds = new Set((graph.nodes || []).filter(isLegacyWikiSeedNode).map(item => item.id))
      for (const item of graph.nodes || []) {
        if (!skippedWikiSeeds.has(item.id)) nodes.push(nodeFromFabric(item))
      }
      for (const edge of graph.edges || []) {
        if (skippedWikiSeeds.has(edge.from) || skippedWikiSeeds.has(edge.to)) continue
        claims.push(store.normalizeClaim({
          id: `legacy:${edge.id}`,
          subjectId: edge.from,
          predicate: edge.type,
          objectNodeId: edge.to,
          status: 'confirmed',
          confidence: Number.isFinite(edge.weight) ? edge.weight : 0.7,
          evidenceRefs: [migrationEvidence.id],
          weight: edge.weight,
        }))
      }
    } catch { /* legacy Fabric is optional */ }

    let mountedWikiCount = 0
    try {
      const entries = knowledgeOs.listEntries(userData, ctx.sources ? ctx : (ctx.sourcesCtx || ctx))
      mountedWikiCount = (entries.wiki || []).length + (entries.okf || []).length
    } catch { /* provider metadata remains usable while the mounted wiki is unavailable */ }

    const memoryDir = ctx.memoryDir || path.join(userData, 'memory')
    try {
      for (const item of productMemory.loadGlobalMemories(memoryDir)) {
        const nodeKind = kindForMemory(item.type)
        const nodeId = store.stableId('memory', item.id || `${item.type}:${item.text}`)
        const evidenceId = store.stableId('evidence', `memory:${item.id || item.text}`)
        nodes.push(store.normalizeNode({
          id: nodeId,
          kind: nodeKind,
          label: item.text,
          summary: item.source?.label || '用户确认的长期记忆',
          tags: ['memory', 'confirmed'],
          scope: item.scope === 'project' ? 'project' : 'global',
          authority: 5,
          updatedAt: item.updatedAt,
        }))
        evidence.push(store.normalizeEvidence({
          id: evidenceId,
          type: memoryEvidenceType(item.source),
          title: item.source?.label || '用户确认的记忆',
          documentRef: item.id,
          snippet: item.text,
          persistence: 'local',
          capturedAt: item.updatedAt || item.createdAt,
        }))
        claims.push(store.normalizeClaim({
          id: store.stableId('claim', `self:${predicateForNode(nodeKind)}:${nodeId}`),
          subjectId: self.id,
          predicate: predicateForNode(nodeKind),
          objectNodeId: nodeId,
          status: 'confirmed',
          confidence: 1,
          scope: item.scope === 'project' ? `project:${item.project || ''}` : 'global',
          evidenceRefs: [evidenceId],
          updatedAt: item.updatedAt,
        }))
      }
      const consolidated = memoryConsolidation.loadConsolidated(memoryDir)
      for (const item of consolidated.items || []) {
        const nodeKind = ({ currentProject: 'project', goal: 'goal', openProblem: 'problem', decision: 'decision', preference: 'preference' })[item.field] || 'concept'
        const nodeId = store.stableId('observed', item.id || `${item.field}:${item.text}`)
        const evidenceId = store.stableId('evidence', `consolidated:${item.id || item.text}`)
        const confirmed = item.confidence === 'confirmed'
        nodes.push(store.normalizeNode({
          id: nodeId,
          kind: nodeKind,
          label: item.text,
          summary: confirmed ? '已确认的工作记忆' : 'KnowMe 近期观察，尚待确认',
          tags: ['memory', confirmed ? 'confirmed' : 'inferred'],
          scope: nodeKind === 'project' ? 'project' : 'global',
          authority: confirmed ? 4 : 2,
          updatedAt: item.updatedAt,
        }))
        evidence.push(store.normalizeEvidence({
          id: evidenceId,
          type: 'local_file',
          title: item.source?.summary || '近期工作记忆',
          documentRef: item.id,
          snippet: item.text,
          persistence: 'local',
          capturedAt: item.updatedAt,
        }))
        claims.push(store.normalizeClaim({
          id: store.stableId('claim', `self:${predicateForNode(nodeKind)}:${nodeId}`),
          subjectId: self.id,
          predicate: predicateForNode(nodeKind),
          objectNodeId: nodeId,
          status: confirmed ? 'confirmed' : 'inferred',
          confidence: confirmed ? 1 : item.confidence === 'derived' ? 0.6 : 0.4,
          evidenceRefs: [evidenceId],
          validTo: item.staleAt || undefined,
          updatedAt: item.updatedAt,
        }))
      }
    } catch { /* Memory remains independently usable */ }

    const providerDefs = Array.isArray(ctx.providers)
      ? ctx.providers
      : (() => {
          try { return knowledgeOs.loadConfig(userData).providers || [] } catch { return [] }
        })()
    const previousProviders = new Map((existing.providers || []).map(item => [item.id, item]))
    const effectiveProviderDefs = providerDefs.length || Array.isArray(ctx.providers)
      ? providerDefs
      : [knowledgeProvider.defaultPersonalProvider()]
    const normalizedProviders = effectiveProviderDefs
      .map(item => {
        const safe = knowledgeProvider.redactProvider(item)
        const previous = previousProviders.get(safe.id)
        const localMounted = ['local', 'qmd-local', 'folder', 'gitlab'].includes(safe.kind)
        const fallbackCollections = localMounted ? [{
          id: safe.collectionId || 'root',
          name: safe.displayName || '本地 LLM Wiki',
          description: '本地挂载的 LLM Wiki，仅在查询时读取，不属于 Brain。',
          documentCount: mountedWikiCount,
          updatedAt: null,
          tags: ['local', 'llmwiki'],
        }] : []
        const collections = safe.collections?.length
          ? safe.collections
          : previous?.collections?.length
            ? previous.collections
            : fallbackCollections
        return { ...safe, collections }
      })
    for (const provider of normalizedProviders) {
      const safe = { ...provider, collections: Array.isArray(provider.collections) ? provider.collections : [] }
      providers.push(safe)
      const sourceId = `provider:${provider.id}`
      nodes.push(store.normalizeNode({
        id: sourceId,
        kind: 'source',
        label: provider.kind === 'folder'
          ? '本地文件夹'
          : provider.kind === 'gitlab'
            ? 'GitLab 工作副本'
            : provider.kind === 'local' || provider.kind === 'qmd-local'
              ? '本地 LLM Wiki'
          : provider.displayName || provider.id,
        summary: provider.kind === 'local' || provider.kind === 'qmd-local'
          ? '本地挂载知识库，仅在查询时读取，不属于 Brain'
          : provider.kind === 'folder' || provider.kind === 'gitlab'
            ? '绑定的工作资料入口，仅在查询时读取正文，不复制进 Brain'
          : '按需检索的外部知识源，不会全量导入 Brain',
        tags: ['provider', provider.kind],
        scope: provider.scope === 'shared' ? 'organization' : 'global',
        authority: provider.authority,
        providerId: provider.id,
        external: true,
      }))
      for (const collection of safe.collections) {
        const collectionId = `collection:${provider.id}:${collection.id}`
        nodes.push(store.normalizeNode({
          id: collectionId,
          kind: 'collection',
          label: collection.name || collection.displayName || collection.id,
          summary: collection.description || '外部知识库目录',
          tags: ['collection', ...(collection.tags || [])],
          scope: provider.scope === 'shared' ? 'organization' : 'global',
          authority: provider.authority,
          providerId: provider.id,
          collectionId: collection.id,
          external: true,
        }))
        claims.push(store.normalizeClaim({
          id: store.stableId('claim', `${sourceId}:contains:${collectionId}`),
          subjectId: sourceId,
          predicate: 'contains',
          objectNodeId: collectionId,
          status: 'confirmed',
          confidence: 1,
          evidenceRefs: [migrationEvidence.id],
        }))
      }
    }

    const activeProviderIds = new Set(normalizedProviders.map(item => item.id))
    for (const node of nodes) {
      if (!node.providerId || activeProviderIds.has(node.providerId)) continue
      node.stale = true
      node.updatedAt = new Date().toISOString()
      for (const claim of claims) {
        if (claim.subjectId !== node.id && claim.objectNodeId !== node.id) continue
        claim.status = 'expired'
        claim.validTo = node.updatedAt
        claim.updatedAt = node.updatedAt
      }
      const proposalId = `provider-unavailable:${node.providerId}`
      if (!proposals.some(item => item.id === proposalId)) proposals.push(store.normalizeProposal({
        id: proposalId,
        kind: 'expiry',
        targetType: 'brain',
        summary: `${node.label} 的来源已不可用`,
        rationale: '外挂知识源已被移除或不再授权，相关理解已停止作为稳定事实使用。',
        evidenceRefs: [],
      }))
    }

    const durableEvidence = uniqueById(evidence)
    const durableEvidenceIds = new Set(durableEvidence.map(item => item.id))
    const rebuiltAt = new Date().toISOString()
    const durableClaims = uniqueById(claims)
      .filter(item => item.subjectId && (item.objectNodeId || item.value != null))
      .map((item) => {
        const evidenceRefs = (item.evidenceRefs || []).filter(id => durableEvidenceIds.has(id))
        return evidenceRefs.length
          ? { ...item, evidenceRefs }
          : { ...item, evidenceRefs: [], status: 'expired', validTo: item.validTo || rebuiltAt, updatedAt: rebuiltAt }
      })
    store.writeCollection(userData, 'nodes', uniqueById(nodes))
    store.writeCollection(userData, 'claims', durableClaims)
    store.writeCollection(userData, 'evidence', durableEvidence)
    store.writeCollection(userData, 'proposals', uniqueById(proposals))
    store.saveProviders(userData, uniqueById(providers))
    store.updateState(userData, {
      migrationVersion: MIGRATION_VERSION,
      taxonomyVersion: taxonomy.version,
      taxonomyProfileId: taxonomy.profileId,
      taxonomyRoleLabel: taxonomy.roleLabel,
      lastRebuiltAt: new Date().toISOString(),
      migrationError: null,
    })
    return store.snapshot(userData)
  }

  function ensureReady(userData, ctx = {}) {
    store.ensureBrain(userData)
    const snapshot = store.snapshot(userData)
    if (ctx.brainV1 === false) return snapshot
    const requestedTaxonomy = brainTaxonomy.profileFor(ctx.brainProfile || {})
    const taxonomyReady = Number(snapshot.state?.taxonomyVersion || 0) >= brainTaxonomy.TAXONOMY_VERSION
      && snapshot.state?.taxonomyProfileId === requestedTaxonomy.profileId
    if (Number(snapshot.state?.migrationVersion || 0) >= MIGRATION_VERSION && taxonomyReady) return snapshot
    try {
      return rebuild(userData, ctx)
    } catch (error) {
      store.updateState(userData, { migrationError: error.message || String(error) })
      return store.snapshot(userData)
    }
  }

  function snapshot(userData, options = {}, ctx = {}) {
    ensureReady(userData, ctx)
    if (ctx.memoryDir) syncMemoryProposals(userData, ctx)
    const data = store.snapshot(userData)
    const includeInactive = options.includeInactive === true
    return {
      ...data,
      claims: includeInactive
        ? data.claims
        : data.claims.filter(item => !['rejected', 'superseded', 'expired'].includes(item.status)),
      proposals: options.includeResolved
        ? data.proposals
        : data.proposals.filter(item => item.status === 'pending'),
    }
  }

  function getNeighborhood(userData, nodeId, options = {}, ctx = {}) {
    const data = snapshot(userData, {}, ctx)
    const depth = Math.max(1, Math.min(3, Number(options.depth) || 1))
    const limit = Math.max(1, Math.min(MAX_VISIBLE_NODES, Number(options.limit) || MAX_VISIBLE_NODES))
    const kinds = new Set(Array.isArray(options.kinds) ? options.kinds : [])
    const statuses = new Set(Array.isArray(options.statuses) ? options.statuses : [])
    const visited = new Set([nodeId])
    let frontier = [nodeId]
    const selectedClaims = []
    for (let step = 0; step < depth && frontier.length && visited.size < limit; step++) {
      const next = []
      for (const claim of data.claims) {
        if (statuses.size && !statuses.has(claim.status)) continue
        const touches = frontier.includes(claim.subjectId) || frontier.includes(claim.objectNodeId)
        if (!touches) continue
        selectedClaims.push(claim)
        const candidate = frontier.includes(claim.subjectId) ? claim.objectNodeId : claim.subjectId
        if (candidate && !visited.has(candidate) && visited.size < limit) {
          visited.add(candidate)
          next.push(candidate)
        }
      }
      frontier = next
    }
    let nodes = data.nodes.filter(item => visited.has(item.id))
    if (kinds.size) nodes = nodes.filter(item => item.id === nodeId || kinds.has(item.kind))
    const allowed = new Set(nodes.map(item => item.id))
    return {
      ok: true,
      rootId: nodeId,
      nodes,
      claims: uniqueById(selectedClaims).filter(item => allowed.has(item.subjectId) && (!item.objectNodeId || allowed.has(item.objectNodeId))),
      truncated: visited.size >= limit,
      stats: data.stats,
    }
  }

  async function localQuery(data, text, request = {}) {
    const policy = normalizePolicy(request.policy || request.knowledgePolicy)
    data = await brainQueryScope.scopeBrainQueryDataAsync(data, policy, request)
    const evidenceById = new Map(data.evidence.map(item => [item.id, item]))
    const claimsByNode = new Map()
    const yieldToEventLoop = () => new Promise(resolve => {
      if (typeof setImmediate === 'function') setImmediate(resolve)
      else setTimeout(resolve, 0)
    })
    for (let claimIndex = 0; claimIndex < data.claims.length; claimIndex += 1) {
      const claim = data.claims[claimIndex]
      if ((claimIndex + 1) % 128 === 0) await yieldToEventLoop()
      if (!(claim.evidenceRefs || []).some(id => evidenceById.has(id))) continue
      for (const id of [claim.subjectId, claim.objectNodeId].filter(Boolean)) {
        if (!claimsByNode.has(id)) claimsByNode.set(id, [])
        claimsByNode.get(id).push(claim)
      }
    }
    const kinds = new Set(Array.isArray(request.kinds) ? request.kinds : [])
    const statuses = new Set(Array.isArray(request.statuses) ? request.statuses : [])
    const docs = []
    for (let nodeIndex = 0; nodeIndex < data.nodes.length; nodeIndex += 1) {
      const node = data.nodes[nodeIndex]
      if ((nodeIndex + 1) % 128 === 0) await yieldToEventLoop()
      if (brainTaxonomy.isTaxonomyNode(node)
        || (kinds.size && !kinds.has(node.kind))
        || !policy.brainScopes.includes(node.scope || 'global')
        || (!policy.allowPersonalMemory && ['self', 'preference', 'person', 'goal'].includes(node.kind))
        || (!policy.allowPersonalMemory && (node.tags || []).includes('memory'))
        || (statuses.size && !(claimsByNode.get(node.id) || []).some(claim => statuses.has(claim.status)))) continue
        const related = claimsByNode.get(node.id) || []
        const content = [
          node.summary,
          ...(node.tags || []),
          ...related.filter(claim => !statuses.size || statuses.has(claim.status)).map(claim => `${claim.predicate} ${claim.value ?? ''}`),
      ].filter(Boolean).join('\n')
      docs.push({ title: node.label, path: node.id, content })
    }
    const topK = Number(request.topK) || DEFAULT_TOP_K
    let ranked = await knowledgeRank.rankHitsAsync(text, docs, {
      topK: Math.min(40, topK * 4),
      signal: request.signal,
    })
    if (!ranked.length && (kinds.size || statuses.size)) {
      ranked = docs.slice(0, Math.min(40, topK * 4)).map((doc, index) => ({
        title: doc.title,
        path: doc.path,
        snippet: String(doc.content || '').split('\n').find(Boolean) || doc.title,
        score: Math.max(0.05, 0.2 - index * 0.002),
      }))
    }
    const index = graphIndex(data)
    const nodesById = new Map(data.nodes.map(item => [item.id, item]))
    return ranked.map(hit => {
      const node = data.nodes.find(item => item.id === hit.path)
      const relatedClaims = (claimsByNode.get(node.id) || [])
        .filter(claim => statuses.has(claim.status) || activeClaim(claim))
        .filter(claim => !statuses.size || statuses.has(claim.status))
      const refs = [...new Set(relatedClaims.flatMap(claim => claim.evidenceRefs || []))]
      const hitEvidence = refs.map(id => evidenceById.get(id)).filter(Boolean).slice(0, 6)
      const strongestStatus = relatedClaims.map(claim => claim.status)
        .sort((a, b) => Number(STATUS_WEIGHT[b] || 0) - Number(STATUS_WEIGHT[a] || 0))[0] || 'observed'
      const statusWeight = STATUS_WEIGHT[strongestStatus] || 0.35
      const freshness = Math.max(dateScore(node.updatedAt), ...relatedClaims.map(claim => dateScore(claim.updatedAt || claim.validFrom)))
      const relation = shortestPath(data, 'self:me', node.id, { index, maxDepth: 6 })
      const graphDistance = relation?.distance ?? null
      const graphWeight = graphDistance == null ? 0.25 : 1 / (1 + graphDistance * 0.45)
      const authority = Number(node.authority || 0) / 5
      const conflict = index.conflictNodeIds.has(node.id) || relatedClaims.some(claim => index.conflictClaimIds.has(claim.id))
      const relationLabels = (relation?.nodeIds || []).map(id => nodesById.get(id)?.label || id)
      const rerankScore = Number(hit.score || 0) * (0.58 + statusWeight * 0.18 + freshness * 0.1 + authority * 0.08 + graphWeight * 0.06) * (conflict ? 0.9 : 1)
      return {
        ref: `brain:${node.id}`,
        title: node.label,
        snippet: hit.snippet || node.summary,
        nodeId: node.id,
        relationPath: relation?.claimIds || relatedClaims.slice(0, 4).map(claim => claim.id),
        relationNodes: relation?.nodeIds || [node.id],
        relationLabels,
        sourceKind: 'brain',
        score: rerankScore,
        authority: node.authority,
        freshness,
        claimStatus: strongestStatus,
        graphDistance,
        conflict,
        persistence: 'local',
        evidence: hitEvidence,
        explanation: relationLabels.length > 1
          ? `${relationLabels.join(' → ')}；${strongestStatus === 'confirmed' ? '关系已确认' : '关系尚待确认'}${conflict ? '；存在相互冲突的记录' : ''}`
          : relatedClaims.length
            ? `与 ${relatedClaims.length} 条已记录关系相关${conflict ? '，其中存在冲突' : ''}`
          : '名称或摘要与查询相关',
      }
    }).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, topK)
  }

  function planLocalRequest(text, request = {}) {
    const planned = { ...request }
    if (!Array.isArray(request.kinds) || !request.kinds.length) {
      if (/偏好|喜欢|习惯/.test(text)) planned.kinds = ['preference']
      else if (/决定|决策/.test(text)) planned.kinds = ['decision']
      else if (/现在.*做什么|当前.*工作|主要.*做/.test(text)) planned.kinds = ['project', 'goal', 'task', 'problem']
    }
    if (!Array.isArray(request.statuses) || !request.statuses.length) {
      if (/推测|推断|尚未确认|不确定/.test(text)) planned.statuses = ['inferred', 'observed']
      else if (/推翻|旧结论|过期|曾经/.test(text)) planned.statuses = ['superseded', 'expired']
      else if (/已确认|确定的/.test(text)) planned.statuses = ['confirmed']
    }
    return planned
  }

  function normalizePolicy(policy = {}) {
    return {
      brainScopes: Array.isArray(policy.brainScopes) ? policy.brainScopes : ['global', 'project'],
      providers: Array.isArray(policy.providers) ? policy.providers : [],
      allowPersonalMemory: policy.allowPersonalMemory !== false,
      allowRemoteQuery: policy.allowRemoteQuery === true,
      allowPromotionProposal: policy.allowPromotionProposal !== false,
      allowDirectWrite: false,
    }
  }

  async function query(userData, request = {}, ctx = {}) {
    const text = String(request.text || request.query || '').trim()
    if (!text) return { ok: true, hits: [], message: '请输入要查找的内容' }
    const localRequest = planLocalRequest(text, request)
    const wantsInactive = (localRequest.statuses || []).some(status => ['superseded', 'expired', 'rejected'].includes(status))
    const data = snapshot(userData, { includeInactive: wantsInactive }, ctx)
    const policy = normalizePolicy(request.knowledgePolicy)
    const mode = ['local', 'external', 'mixed'].includes(request.mode) ? request.mode : 'local'
    const localHits = mode === 'external'
      ? []
      : await localQuery(data, text, { ...localRequest, policy, signal: ctx.signal })
    let externalHits = []
    let externalAttempted = false
    const shouldExternal = mode !== 'local'
      && policy.allowRemoteQuery
      && policy.providers.length > 0
      && (mode === 'external' || localHits.length < 2 || request.forceExternal === true)
    if (shouldExternal && typeof ctx.fabricSearch === 'function') {
      externalAttempted = true
      let providerDefs = []
      const remoteText = String(text)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[邮箱]')
        .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
        .replace(/\b\d{17}[\dXx]\b/g, '[证件号]')
      try {
        const allowedIds = policy.providers.map(item => item.providerId)
        providerDefs = (ctx.providers || []).filter(provider => allowedIds.includes(provider.id))
          .slice(0, Math.max(1, Math.min(3, Number(request.maxProviders) || 3)))
          .map(provider => {
            const grant = policy.providers.find(item => item.providerId === provider.id)
            const collectionIds = (grant?.collectionIds || provider.collectionIds || []).slice(0, Math.max(1, Math.min(2, Number(request.maxCollectionsPerProvider) || 2)))
            return { ...provider, collectionIds, collection: collectionIds[0] || provider.collection }
          })
        const cacheKey = queryCache.keyFor({ query: remoteText, projectId: request.projectId || null, policy,
          providers: providerDefs.map(require('./knowledge-provider-fingerprint').knowledgeProviderFingerprint) })
        const cached = request.bypassCache === true ? null : queryCache.read(userData, cacheKey)
        const startedAt = Date.now()
        const result = cached ? { hits: cached } : await ctx.fabricSearch(userData, remoteText, { ...ctx, providers: providerDefs, topK: request.topK || DEFAULT_TOP_K })
        const rawHits = result.hits || []
        if (!cached) queryCache.write(userData, cacheKey, rawHits, request.cacheTtlMs)
        for (const provider of providerDefs) {
          const providerHits = rawHits.filter(hit => (hit.kbId || hit.provenance?.kbId) === provider.id)
          store.recordProviderQuery?.(userData, {
            providerId: provider.id,
            collectionId: provider.collectionIds?.[0] || provider.collection,
            queryHash: hashContent(remoteText),
            hitCount: providerHits.length,
            status: 'ok',
            latencyMs: cached ? 0 : Date.now() - startedAt,
          })
        }
        externalHits = rawHits.map(hit => ({
          ref: hit.refKey || hit.path || hit.nodeId,
          title: hit.title,
          snippet: hit.snippet || '',
          nodeId: hit.nodeId,
          sourceKind: hit.source === 'ragflow' ? 'ragflow' : hit.source === 'remote-rag' ? 'remote-rag' : hit.source === 'gitlab' ? 'gitlab' : hit.source === 'wiki' ? 'llmwiki' : 'local',
          providerId: hit.kbId || hit.provenance?.kbId,
          collectionId: hit.collectionId,
          score: hit.rerankScore || hit.rrfScore || hit.score || 0,
          authority: hit.authority || hit.provenance?.authority || 2,
          freshness: dateScore(hit.updatedAt || hit.provenance?.updatedAt),
          claimStatus: 'observed',
          graphDistance: null,
          conflict: false,
          persistence: 'external',
          evidence: [{
            id: store.stableId('evidence', `query:${hit.kbId || ''}:${hit.path || hit.refKey || hit.title}`),
            type: hit.source === 'ragflow' ? 'ragflow' : hit.source === 'remote-rag' ? 'remote_rag' : 'llmwiki',
            providerId: hit.kbId,
            collectionId: hit.collectionId,
            documentRef: hit.path || hit.refKey,
            title: hit.title,
            snippet: hit.snippet,
            persistence: 'ephemeral',
            capturedAt: new Date().toISOString(),
          }],
          explanation: `按需检索自 ${hit.kbId || hit.source || '外挂知识库'}，未写入长期 Brain`,
        }))
      } catch {
        for (const provider of providerDefs) {
          store.recordProviderQuery?.(userData, { providerId: provider.id, queryHash: hashContent(remoteText), status: 'error', hitCount: 0 })
        }
        /* external retrieval degrades to local */
      }
    }
    const externalByTitle = new Map()
    for (const hit of externalHits) {
      const key = String(hit.title || '').trim().toLowerCase()
      if (!key) continue
      if (!externalByTitle.has(key)) externalByTitle.set(key, [])
      externalByTitle.get(key).push(hit)
    }
    for (const hits of externalByTitle.values()) {
      const variants = new Set(hits.map(hit => String(hit.snippet || '').trim().toLowerCase()))
      const providers = new Set(hits.map(hit => hit.providerId).filter(Boolean))
      if (variants.size > 1 && providers.size > 1) hits.forEach(hit => { hit.conflict = true })
    }
    const fused = [...localHits.map((hit, rank) => ({ ...hit, fusionScore: 1 / (60 + rank + 1) })),
      ...externalHits.map((hit, rank) => ({ ...hit, fusionScore: 1 / (60 + rank + 1) }))]
      .map(hit => ({
        ...hit,
        fusionScore: hit.fusionScore
          + (Number(hit.authority || 0) / 5) * .0025
          + Number(hit.freshness || 0) * .0015
          + Number(STATUS_WEIGHT[hit.claimStatus] || 0) * .002
          + (hit.graphDistance == null ? 0 : 1 / (1 + hit.graphDistance)) * .0015
          - (hit.conflict ? .001 : 0),
      }))
    const byKey = new Map()
    for (const hit of fused) {
      const id = hit.nodeId || hit.ref || store.stableId('hit', `${hit.title}:${hit.snippet}`)
      const key = `${String(hit.title || '').toLowerCase()}:${String(hit.snippet || '').slice(0, 80).toLowerCase()}`
      const previous = byKey.get(key)
      if (!previous || hit.fusionScore > previous.fusionScore) byKey.set(key, { ...hit, id })
      else previous.fusionScore += hit.fusionScore
    }
    const deduped = [...byKey.values()].sort((a, b) => Number(b.fusionScore || 0) - Number(a.fusionScore || 0))
      .slice(0, Math.max(1, Math.min(20, Number(request.topK) || DEFAULT_TOP_K)))
      .map(({ id, fusionScore, ...hit }) => ({ ...hit, score: fusionScore }))
    return {
      ok: true,
      operation: 'brain_query',
      hits: deduped,
      externalAttempted,
      message: deduped.length ? null : '没有找到相关理解或资料',
    }
  }

  function getNode(userData, nodeId, ctx = {}) {
    const data = snapshot(userData, { includeInactive: true, includeResolved: true }, ctx)
    const node = data.nodes.find(item => item.id === nodeId)
    if (!node) return { ok: false, error: 'Brain 节点不存在' }
    const claims = data.claims.filter(item => item.subjectId === nodeId || item.objectNodeId === nodeId)
    const evidenceIds = [...new Set(claims.flatMap(item => item.evidenceRefs || []))]
    return { ok: true, node, claims, evidence: data.evidence.filter(item => evidenceIds.includes(item.id)) }
  }

  function explain(userData, ref, ctx = {}) {
    const data = snapshot(userData, { includeInactive: true, includeResolved: true }, ctx)
    const id = String(ref || '').replace(/^brain:/, '')
    const claim = data.claims.find(item => item.id === id)
    const node = data.nodes.find(item => item.id === id)
    const claims = claim ? [claim] : node
      ? data.claims.filter(item => item.subjectId === node.id || item.objectNodeId === node.id)
      : []
    if (!claim && !node) return { ok: false, error: '没有找到可解释的 Brain 内容' }
    const evidenceIds = [...new Set(claims.flatMap(item => item.evidenceRefs || []))]
    return {
      ok: true,
      node: node || null,
      claim: claim || null,
      claims,
      evidence: data.evidence.filter(item => evidenceIds.includes(item.id)),
      explanation: claim
        ? `${claim.status === 'confirmed' ? '已确认' : '尚待确认'}：${claim.predicate}`
        : `与 ${claims.length} 条关系相关，来源 ${evidenceIds.length} 项`,
    }
  }

  function findPath(userData, fromId, toId, options = {}, ctx = {}) {
    const data = snapshot(userData, { includeInactive: options.includeInactive === true }, ctx)
    const pathResult = shortestPath(data, fromId, toId, options)
    if (!pathResult) return { ok: false, error: '这两个节点之间还没有可解释的关系链', nodeIds: [], claimIds: [] }
    const nodes = pathResult.nodeIds.map(id => data.nodes.find(item => item.id === id)).filter(Boolean)
    const claims = pathResult.claimIds.map(id => data.claims.find(item => item.id === id)).filter(Boolean)
    const evidenceIds = [...new Set(claims.flatMap(item => item.evidenceRefs || []))]
    return {
      ok: true,
      ...pathResult,
      nodes,
      claims,
      evidence: data.evidence.filter(item => evidenceIds.includes(item.id)),
      explanation: nodes.map(item => item.label).join(' → '),
    }
  }

  function propose(userData, input = {}) {
    const proposals = store.readCollection(userData, 'proposals')
    const reviewed = proposals.find(item => (
      (input.id && item.id === input.id)
      || (input.fingerprint && item.fingerprint === input.fingerprint)
    ))
    if (reviewed) {
      const suppressed = reviewed.status === 'rejected' || reviewed.status === 'confirmed'
      return { ok: true, suppressed, duplicate: !suppressed, proposal: reviewed }
    }
    return { ok: true, proposal: store.upsertProposal(userData, input) }
  }

  function syncMemoryProposals(userData, ctx = {}) {
    return cognitionRuntime.syncMemoryProposals(userData, ctx)
  }

  function observeConversation(userData, input = {}, ctx = {}) {
    return cognitionRuntime.observeConversation(userData, input, ctx)
  }

  function saveReference(userData, input = {}) {
    const evidence = store.upsertEvidence(userData, {
      id: input.id,
      type: input.type || (input.providerId ? 'remote_rag' : 'local_file'),
      providerId: input.providerId,
      collectionId: input.collectionId,
      documentRef: input.documentRef || input.ref,
      title: input.title,
      snippet: input.snippet,
      contentHash: input.contentHash,
      persistence: 'reference',
    })
    const node = store.upsertNode(userData, {
      id: input.nodeId || store.stableId('reference', `${input.providerId || 'local'}:${input.documentRef || input.ref || input.title}`),
      kind: input.collectionId ? 'collection' : 'source',
      label: input.title || input.documentRef || '收藏的资料',
      summary: '收藏的来源引用；正文仍保留在原知识库。',
      tags: ['reference'],
      scope: input.scope || 'global',
      authority: input.authority || 2,
      sourceRef: input.documentRef || input.ref,
      providerId: input.providerId,
      collectionId: input.collectionId,
      external: !!input.providerId,
    })
    return { ok: true, node, evidence }
  }

  function applyBrainEffects(userData, effects = []) {
    const applied = []
    const orderedEffects = [...effects].sort((a, b) => {
      const phase = { upsert_evidence: 0, upsert_node: 1, supersede_claim: 2, upsert_claim: 3 }
      return Number(phase[a?.op] ?? 2) - Number(phase[b?.op] ?? 2)
    })
    for (const effect of orderedEffects) {
      if (effect.op === 'upsert_node') applied.push(store.upsertNode(userData, effect.value || effect.node || {}))
      if (effect.op === 'upsert_claim') applied.push(store.upsertClaim(userData, { ...(effect.value || effect.claim || {}), status: 'confirmed' }))
      if (effect.op === 'upsert_evidence') applied.push(store.upsertEvidence(userData, effect.value || effect.evidence || {}))
      if (effect.op === 'supersede_claim') {
        const claims = store.readCollection(userData, 'claims')
        const item = claims.find(candidate => candidate.id === effect.id)
        if (item) {
          item.status = 'superseded'
          item.updatedAt = new Date().toISOString()
          store.writeCollection(userData, 'claims', claims)
          applied.push(item)
        }
      }
    }
    return applied
  }

  function patchEffectsSummary(effects = [], previousSummary, nextSummary) {
    const previous = String(previousSummary || '').trim()
    const next = String(nextSummary || '').trim()
    if (!previous || !next || previous === next) return effects
    return effects.map(effect => {
      if (!effect || typeof effect !== 'object') return effect
      const value = effect.value && typeof effect.value === 'object' ? { ...effect.value } : effect.value
      if (value && typeof value === 'object') {
        if (value.label === previous) value.label = next
        if (value.summary === previous) value.summary = next
        if (value.value === previous) value.value = next
        if (value.text === previous) value.text = next
      }
      return { ...effect, value }
    })
  }

  function brainReverseEffects(userData, effects = []) {
    const data = store.snapshot(userData)
    const reverse = []
    for (const effect of effects) {
      if (effect.op === 'upsert_node') {
        const normalized = store.normalizeNode(effect.value || effect.node || {})
        const previous = data.nodes.find(item => item.id === normalized.id)
        reverse.unshift(previous ? { op: 'restore_node', value: previous } : { op: 'delete_node', id: normalized.id })
      }
      if (effect.op === 'upsert_claim') {
        const normalized = store.normalizeClaim(effect.value || effect.claim || {})
        const previous = data.claims.find(item => item.id === normalized.id)
        reverse.unshift(previous ? { op: 'restore_claim', value: previous } : { op: 'delete_claim', id: normalized.id })
      }
      if (effect.op === 'upsert_evidence') {
        const normalized = store.normalizeEvidence(effect.value || effect.evidence || {})
        const previous = data.evidence.find(item => item.id === normalized.id)
        reverse.unshift(previous ? { op: 'restore_evidence', value: previous } : { op: 'delete_evidence', id: normalized.id })
      }
      if (effect.op === 'supersede_claim') {
        const previous = data.claims.find(item => item.id === effect.id)
        if (previous) reverse.unshift({ op: 'restore_claim', value: previous })
      }
    }
    return reverse
  }

  function applyBrainReverseEffects(userData, effects = []) {
    const collections = {
      node: store.readCollection(userData, 'nodes'),
      claim: store.readCollection(userData, 'claims'),
      evidence: store.readCollection(userData, 'evidence'),
    }
    for (const effect of effects) {
      const match = String(effect.op || '').match(/^(restore|delete)_(node|claim|evidence)$/)
      if (!match) continue
      const [, action, kind] = match
      const items = collections[kind]
      const id = effect.id || effect.value?.id
      const index = items.findIndex(item => item.id === id)
      if (action === 'delete' && index >= 0) items.splice(index, 1)
      if (action === 'restore' && effect.value) {
        if (index >= 0) items[index] = effect.value
        else items.push(effect.value)
      }
    }
    store.writeCollection(userData, 'nodes', collections.node)
    store.writeCollection(userData, 'claims', collections.claim)
    store.writeCollection(userData, 'evidence', collections.evidence)
    return effects
  }

  async function confirm(userData, proposalId, patch = {}, ctx = {}) {
    const proposals = store.readCollection(userData, 'proposals')
    const proposal = proposals.find(item => item.id === proposalId)
    if (!proposal) return { ok: false, error: '提案不存在' }
    if (proposal.status === 'confirmed') return { ok: true, already: true, proposal }
    const nextSummary = String(patch.summary || proposal.summary || '').trim() || proposal.summary
    const next = {
      ...proposal,
      ...patch,
      summary: nextSummary,
      effects: patchEffectsSummary(proposal.effects, proposal.summary, nextSummary),
      status: 'confirmed',
      updatedAt: new Date().toISOString(),
    }
    const index = proposals.findIndex(item => item.id === proposalId)
    proposals[index] = next
    let applied = []
    let reverseEffects = []
    if (next.memoryPatternId && typeof ctx.reviewMemoryPattern === 'function') {
      const reviewed = await ctx.reviewMemoryPattern(next.memoryPatternId, 'accepted', next.summary)
      if (reviewed?.ok === false) return reviewed
    }
    if (next.targetType === 'brain') {
      reverseEffects = brainReverseEffects(userData, next.effects)
      applied = applyBrainEffects(userData, next.effects)
    } else if (next.targetType === 'partner_profile' && typeof ctx.applyPartnerGrowth === 'function') {
      const result = await ctx.applyPartnerGrowth(next)
      if (result?.ok === false) return result
      applied = [result]
      reverseEffects = result?.reverseEffects || []
    } else if (next.targetType === 'capability' && typeof ctx.applyCapabilityGrowth === 'function') {
      const result = await ctx.applyCapabilityGrowth(next)
      if (result?.ok === false) return result
      applied = [result]
      reverseEffects = result?.reverseEffects || []
    } else if (next.targetType !== 'brain') {
      return { ok: false, error: '当前成长目标没有可用的提交处理器' }
    }
    store.writeCollection(userData, 'proposals', proposals)
    const growthEvent = growthLedger.append(userData, {
      proposalId: next.id,
      targetType: next.targetType,
      kind: next.kind,
      summary: next.summary,
      effects: next.effects,
      reverseEffects,
      reversible: reverseEffects.length > 0,
      memoryPatternId: next.memoryPatternId,
    })
    return { ok: true, proposal: next, applied, growthEvent }
  }

  async function undoGrowth(userData, eventId, ctx = {}) {
    const event = growthLedger.read(userData).events.find(item => item.id === eventId)
    if (!event) return { ok: false, error: '成长记录不存在' }
    if (!event.reversible || event.status === 'reverted') return { ok: false, error: '这项成长不可撤销或已经撤销' }
    if (event.memoryPatternId && typeof ctx.reviewMemoryPattern === 'function') {
      const reviewed = await ctx.reviewMemoryPattern(event.memoryPatternId, 'dismissed', '')
      if (reviewed?.ok === false) return reviewed
    }
    let result
    if (event.targetType === 'brain') {
      result = { ok: true, applied: applyBrainReverseEffects(userData, event.reverseEffects) }
    }
    else if (event.targetType === 'partner_profile' && typeof ctx.undoPartnerGrowth === 'function') result = await ctx.undoPartnerGrowth(event)
    else if (event.targetType === 'capability' && typeof ctx.undoCapabilityGrowth === 'function') result = await ctx.undoCapabilityGrowth(event)
    else result = { ok: false, error: '当前成长类型没有可用的撤销处理器' }
    if (result?.ok === false) return result
    const marked = growthLedger.markReverted(userData, eventId)
    return { ok: true, event: marked.event, result }
  }

  function growthList(userData, options = {}) {
    return growthLedger.list(userData, options)
  }

  function saveLayout(userData, positions) {
    return { ok: true, layout: store.saveLayout(userData, positions) }
  }

  function reject(userData, proposalId, ctx = {}) {
    const proposals = store.readCollection(userData, 'proposals')
    const proposal = proposals.find(item => item.id === proposalId)
    if (!proposal) return { ok: false, error: '提案不存在' }
    if (proposal.memoryPatternId && typeof ctx.reviewMemoryPattern === 'function') {
      const reviewed = ctx.reviewMemoryPattern(proposal.memoryPatternId, 'dismissed', '')
      if (reviewed?.ok === false) return reviewed
    }
    proposal.status = 'rejected'
    proposal.updatedAt = new Date().toISOString()
    store.writeCollection(userData, 'proposals', proposals)
    return { ok: true, proposal }
  }

  function snooze(userData, proposalId) {
    const proposals = store.readCollection(userData, 'proposals')
    const proposal = proposals.find(item => item.id === proposalId)
    if (!proposal) return { ok: false, error: '提案不存在' }
    proposal.status = 'snoozed'
    proposal.snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    proposal.updatedAt = new Date().toISOString()
    store.writeCollection(userData, 'proposals', proposals)
    return { ok: true, proposal }
  }

  function forget(userData, targetId) {
    const nodes = store.readCollection(userData, 'nodes')
    const claims = store.readCollection(userData, 'claims')
    const node = nodes.find(item => item.id === targetId)
    if (!node) return { ok: false, error: '要忘记的内容不存在' }
    node.stale = true
    node.forgottenAt = new Date().toISOString()
    node.updatedAt = node.forgottenAt
    for (const claim of claims) {
      if (claim.subjectId === targetId || claim.objectNodeId === targetId) {
        claim.status = 'expired'
        claim.validTo = node.forgottenAt
        claim.updatedAt = node.forgottenAt
      }
    }
    store.writeCollection(userData, 'nodes', nodes)
    store.writeCollection(userData, 'claims', claims)
    return { ok: true, node }
  }

  async function syncProvider(userData, providerId, ctx = {}) {
    const provider = (ctx.providers || []).find(item => item.id === providerId)
    if (!provider) return { ok: false, error: '知识源不存在' }
    if (typeof ctx.listCollections !== 'function') return { ok: false, error: '该知识源不支持读取知识库列表' }
    const result = await ctx.listCollections(provider)
    if (result?.ok === false) {
      store.updateProvider?.(userData, providerId, { health: 'offline', lastHealthCheckAt: new Date().toISOString() })
      return result
    }
    const catalog = store.readCollection(userData, 'providers')
    const safe = knowledgeProvider.redactProvider({
      ...provider,
      collections: result.collections || [],
      health: 'ready',
      lastHealthCheckAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    })
    const index = catalog.findIndex(item => item.id === providerId)
    if (index >= 0) catalog[index] = safe
    else catalog.push(safe)
    store.saveProviders(userData, catalog)
    rebuild(userData, ctx)
    return { ok: true, provider: safe, collections: safe.collections || [] }
  }

  return Object.freeze({
    rebuild,
    ensureReady,
    snapshot,
    getNeighborhood,
    query,
    getNode,
    explain,
    findPath,
    propose,
    observeConversation,
    syncMemoryProposals,
    saveReference,
    confirm,
    growthList,
    undoGrowth,
    saveLayout,
    reject,
    snooze,
    forget,
    syncProvider,
    normalizePolicy,
  })
}

const brain = createService()

module.exports = {
  MIGRATION_VERSION,
  DEFAULT_TOP_K,
  MAX_VISIBLE_NODES,
  createService,
  ...brain,
}
