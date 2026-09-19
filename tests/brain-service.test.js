'use strict'

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const brainStore = require('../src/lib/brain-store')
const { createService } = require('../src/lib/brain-service')
const productMemory = require('../src/lib/product-memory')

const roots = []
function tempUserData() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-brain-'))
  roots.push(root)
  return root
}
afterEach(() => {
  while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true })
})

function serviceFixture() {
  return createService({
    store: brainStore,
    knowledgeOs: {
      listEntries: () => ({
        wikiRoot: 'D:/mounted-wiki',
        wiki: [{ kind: 'wiki', path: 'projects/knowme.md', title: 'KnowMe project' }],
        okf: [{ kind: 'okf', path: 'decisions/local-first.md', title: 'Local first decision' }],
      }),
    },
    fabricGraph: {
      loadGraph: () => ({
        nodes: [
          { id: 'legacy:a', kind: 'concept', title: 'Legacy concept' },
          { id: 'legacy:b', kind: 'concept', title: 'Legacy target' },
          { id: 'c:projects/knowme.md', kind: 'concept', title: 'Auto-seeded Wiki entry', path: 'projects/knowme.md', tags: ['wiki'] },
        ],
        edges: [
          { id: 'edge:a-b', from: 'legacy:a', to: 'legacy:b', type: 'relatesTo', weight: .7 },
          { id: 'edge:a-wiki', from: 'legacy:a', to: 'c:projects/knowme.md', type: 'relatesTo', weight: .5 },
        ],
      }),
    },
    productMemory: {
      loadGlobalMemories: () => [{ id: 'pref:1', type: 'preference', text: 'Give the conclusion first', scope: 'global', source: { type: 'conversation', label: 'User confirmed' } }],
    },
  })
}

describe('local Brain', () => {
  it('keeps project cognition and its evidence bound to the originating project', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root, { providers: [] })

    const proposal = service.observeConversation(root, {
      text: '我正在做的项目是 KnowMe 项目上下文改造。',
      agentId: 'personal',
      sessionId: 'session:project',
      taskId: 'task:project',
      runId: 'run:project',
      projectId: 'project:knowme',
    }).proposals[0]
    assert.equal(proposal.projectId, 'project:knowme')

    const confirmed = await service.confirm(root, proposal.id)
    assert.equal(confirmed.ok, true)
    const snapshot = service.snapshot(root)
    const evidence = snapshot.evidence.find(item => item.id === proposal.evidenceRefs[0])
    const node = snapshot.nodes.find(item => item.label === proposal.summary)
    const claim = snapshot.claims.find(item => item.objectNodeId === node.id)

    assert.equal(evidence.projectId, 'project:knowme')
    assert.equal(evidence.taskId, 'task:project')
    assert.equal(evidence.runId, 'run:project')
    assert.equal(node.projectId, 'project:knowme')
    assert.equal(claim.projectId, 'project:knowme')
  })

  it('turns explicit conversation observations into one governed and reversible proposal', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root, { providers: [] })

    const observed = service.observeConversation(root, {
      text: '我的偏好是项目资料采用本地优先存储。',
      agentId: 'personal',
      sessionId: 'session:one',
      runId: 'run:one',
    })
    assert.equal(observed.proposals.length, 1)
    const proposal = observed.proposals[0]
    assert.equal(service.snapshot(root).nodes.some(item => item.label === proposal.summary), false)
    assert.equal(service.snapshot(root).proposals.length, 1)
    assert.equal(service.observeConversation(root, { text: '我的偏好是项目资料采用本地优先存储。', agentId: 'personal' }).duplicates.length, 1)

    const confirmed = await service.confirm(root, proposal.id, { summary: '项目资料优先保存在本地' })
    assert.equal(confirmed.ok, true)
    const after = service.snapshot(root, { includeResolved: true })
    assert.equal(after.nodes.some(item => item.label === '项目资料优先保存在本地'), true)
    assert.equal(after.nodes.some(item => item.label === proposal.summary), false)
    assert.equal(after.claims.some(item => item.id === `claim:observation:${proposal.fingerprint}` && item.status === 'confirmed'), true)
    assert.equal(after.evidence.some(item => item.snippet === proposal.summary), true)
    assert.equal(service.observeConversation(root, { text: '我的偏好是项目资料采用本地优先存储。', agentId: 'personal' }).proposals.length, 0)

    const undone = await service.undoGrowth(root, confirmed.growthEvent.id)
    assert.equal(undone.ok, true)
    assert.equal(service.snapshot(root).nodes.some(item => item.label === '项目资料优先保存在本地'), false)
  })

  it('routes collaboration preferences to Partner Profile instead of the Brain graph', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root, { providers: [] })
    const proposal = service.observeConversation(root, { text: '我的偏好是回答时先给结论。', agentId: 'personal' }).proposals[0]
    assert.equal(proposal.kind, 'behavior')
    assert.equal(proposal.targetType, 'partner_profile')
    assert.equal(proposal.effects.some(effect => effect.op === 'upsert_node'), false)
    let appliedPatch = null
    const confirmed = await service.confirm(root, proposal.id, {}, {
      applyPartnerGrowth: async (item) => {
        appliedPatch = item.effects[0].patch
        return { ok: true, reverseEffects: [{ op: 'restore_profile', value: { id: 'my-knowme' } }] }
      },
    })
    assert.equal(confirmed.ok, true)
    assert.equal(appliedPatch.promptOverlay, '我的偏好是回答时先给结论')
    assert.equal(service.snapshot(root).nodes.some(item => item.label.includes('先给结论')), false)
  })

  it('suppresses rejected, sensitive, ephemeral and unauthorized observations', () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root, { providers: [] })
    const first = service.observeConversation(root, { text: '我的目标是发布本地 Brain。', agentId: 'personal' }).proposals[0]
    assert.ok(first)
    service.reject(root, first.id)
    const repeated = service.observeConversation(root, { text: '我的目标是发布本地 Brain。', agentId: 'personal' })
    assert.equal(repeated.proposals.length, 0)
    assert.equal(repeated.duplicates[0].status, 'rejected')
    assert.equal(service.observeConversation(root, { text: '请记住：我的 API key 是 sk-secret1234', agentId: 'personal' }).reason, 'sensitive')
    assert.equal(service.observeConversation(root, { text: '仅本次对话，我喜欢非常简短的回答', agentId: 'personal' }).reason, 'ephemeral')
    assert.equal(service.observeConversation(root, { text: '我的偏好是简洁回答', agentId: 'expert:qa' }).reason, 'agent-policy')
  })

  it('promotes a repeated Memory pattern through the same proposal and review state', async () => {
    const root = tempUserData()
    const memoryDir = path.join(root, 'memory')
    const service = createService({
      store: brainStore,
      knowledgeOs: { listEntries: () => ({ wiki: [], okf: [] }) },
      fabricGraph: { loadGraph: () => ({ nodes: [], edges: [] }) },
      productMemory,
    })
    service.rebuild(root, { providers: [], memoryDir })
    for (let index = 0; index < 3; index += 1) {
      service.observeConversation(root, { text: '我通常选择项目资料本地优先存储', agentId: 'personal' }, { memoryDir })
    }
    const pending = service.snapshot(root, {}, { memoryDir }).proposals
    assert.equal(pending.length, 1)
    assert.equal(pending[0].memoryPatternId.startsWith('pat_'), true)
    assert.equal(pending[0].observationCount, 3)
    const reviewMemoryPattern = (id, action, summary) => productMemory.reviewPattern(memoryDir, id, action, summary)
    const confirmed = await service.confirm(root, pending[0].id, {}, { reviewMemoryPattern })
    assert.equal(confirmed.ok, true)
    assert.equal(productMemory.getVisiblePatterns(memoryDir)[0].prompt_state, 'accepted')
    assert.equal((await service.undoGrowth(root, confirmed.growthEvent.id, { reviewMemoryPattern })).ok, true)
    assert.equal(productMemory.getVisiblePatterns(memoryDir)[0].prompt_state, 'dismissed')
  })

  it('initializes a versioned role taxonomy without treating the scaffold as learned cognition', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    const first = service.rebuild(root, { brainProfile: { industry: 'software', occupationId: 'qa-engineer' }, providers: [] })
    const categories = first.nodes.filter((node) => node.tags.includes('brain-taxonomy-category'))
    assert.equal(categories.length, 8)
    assert.equal(categories.some((node) => node.label === '测试策略'), true)
    assert.equal(first.state.taxonomyProfileId, 'software:qa-engineer')
    const categoryIds = new Set(categories.map((node) => node.id))
    const taxonomyClaims = first.claims.filter((claim) => categoryIds.has(claim.objectNodeId))
    assert.equal(taxonomyClaims.length, 8)
    assert.equal(taxonomyClaims.every((claim) => claim.evidenceRefs.length === 1), true)
    const search = await service.query(root, { text: '测试策略', mode: 'local' }, { brainProfile: { industry: 'software', occupationId: 'qa-engineer' }, providers: [] })
    assert.equal(search.hits.some((hit) => categoryIds.has(hit.nodeId)), false)

    brainStore.upsertNode(root, { id: 'concept:kept', kind: 'concept', label: '用户确认的稳定知识', tags: ['confirmed'] })
    const switched = service.ensureReady(root, { brainProfile: { industry: 'content', occupationId: 'editor' }, providers: [] })
    assert.equal(switched.state.taxonomyProfileId, 'content:editor')
    assert.equal(switched.nodes.some((node) => node.id === 'concept:kept'), true)
    assert.equal(switched.nodes.some((node) => node.tags.includes('brain-taxonomy-category') && node.label === '受众与选题'), true)
    assert.equal(switched.nodes.some((node) => node.id.startsWith('taxonomy:software:qa-engineer:')), false)
  })

  it('creates the canonical JSON store and recovers the last valid collection', () => {
    const root = tempUserData()
    brainStore.ensureBrain(root)
    for (const file of Object.values(brainStore.FILES)) assert.equal(fs.existsSync(path.join(brainStore.brainDir(root), file)), true)
    brainStore.upsertNode(root, { id: 'n:one', kind: 'concept', label: 'One' })
    brainStore.upsertNode(root, { id: 'n:two', kind: 'concept', label: 'Two' })
    fs.writeFileSync(brainStore.filePath(root, 'nodes'), '{broken', 'utf8')
    const recovered = brainStore.snapshot(root)
    assert.equal(recovered.nodes.some((node) => node.id === 'n:one'), true)
    assert.equal(recovered.state.schemaVersion, 1)
  })

  it('keeps Brain snapshots read-only while returning current collection stats', () => {
    const root = tempUserData()
    brainStore.ensureBrain(root)
    brainStore.upsertNode(root, { id: 'n:one', kind: 'concept', label: 'One' })
    const stateFile = brainStore.filePath(root, 'state')
    const before = fs.readFileSync(stateFile, 'utf8')

    const snapshot = brainStore.snapshot(root)

    assert.equal(snapshot.stats.nodes, 1)
    assert.equal(snapshot.state.stats.nodes, 1)
    assert.equal(fs.readFileSync(stateFile, 'utf8'), before)
  })

  it('migrates cognition and provider metadata without importing mounted Wiki documents', () => {
    const root = tempUserData()
    const service = serviceFixture()
    const ctx = { providers: [
      { id: 'local-default', kind: 'qmd-local', displayName: '我的知识', collectionId: 'root' },
      { id: 'rag:one', kind: 'ragflow', displayName: 'RAGFlow', endpoint: 'https://rag.example', collections: [{ id: 'dataset:1', name: 'Policies' }] },
    ] }
    const first = service.rebuild(root, ctx)
    const second = service.rebuild(root, ctx)
    assert.equal(second.nodes.length, first.nodes.length)
    assert.equal(second.claims.length, first.claims.length)
    assert.equal(second.evidence.length, first.evidence.length)
    assert.equal(second.nodes.some((node) => node.id === 'self:me'), true)
    assert.equal(second.nodes.some((node) => node.kind === 'collection' && node.collectionId === 'dataset:1'), true)
    assert.equal(second.nodes.some((node) => node.kind === 'preference'), true)
    const llmWikiSource = second.nodes.find((node) => node.kind === 'source' && node.providerId === 'local-default')
    assert.equal(llmWikiSource.label, '本地 LLM Wiki')
    assert.equal(llmWikiSource.external, true)
    assert.equal(second.nodes.some((node) => node.id === 'c:projects/knowme.md'), false)
    assert.equal(second.nodes.some((node) => node.sourceRef === 'projects/knowme.md' || node.sourceRef === 'decisions/local-first.md'), false)
    assert.equal(second.evidence.some((item) => item.type === 'llmwiki'), false)
    const localProvider = second.providers.find((provider) => provider.id === 'local-default')
    assert.equal(localProvider.collections[0].documentCount, 2)
    assert.equal(second.nodes.some((node) => node.kind === 'collection' && node.providerId === 'local-default'), true)
    assert.equal(second.claims.some((claim) => claim.subjectId === 'self:me' && claim.predicate === 'knows'), false)
    assert.equal(second.claims.filter((claim) => claim.subjectId === llmWikiSource.id && claim.predicate === 'contains').length, 1)
    assert.equal(second.claims.every((claim) => claim.evidenceRefs.length > 0), true)
    assert.equal(JSON.stringify(second.providers).includes('apiKey'), false)
  })

  it('removes v2 auto-imported Wiki artifacts while preserving explicit external references', () => {
    const root = tempUserData()
    const service = serviceFixture()
    brainStore.ensureBrain(root)
    const oldSourceId = brainStore.stableId('source', 'llmwiki:D:/mounted-wiki')
    const oldNodeId = brainStore.stableId('knowledge', 'D:/mounted-wiki:projects/knowme.md')
    const oldEvidenceId = brainStore.stableId('evidence', 'llmwiki:D:/mounted-wiki:projects/knowme.md')
    brainStore.upsertNode(root, { id: oldSourceId, kind: 'source', label: 'LLM Wiki', tags: ['llmwiki', 'mounted'] })
    brainStore.upsertNode(root, { id: oldNodeId, kind: 'concept', label: 'KnowMe project', tags: ['wiki'], sourceRef: 'projects/knowme.md' })
    brainStore.upsertEvidence(root, { id: oldEvidenceId, type: 'llmwiki', title: 'KnowMe project', documentRef: 'projects/knowme.md' })
    brainStore.upsertClaim(root, { subjectId: oldSourceId, predicate: 'contains', objectNodeId: oldNodeId, evidenceRefs: [oldEvidenceId] })
    brainStore.upsertNode(root, { id: 'reference:kept', kind: 'source', label: '用户收藏的引用', tags: ['reference'], providerId: 'local-default', external: true })
    brainStore.upsertEvidence(root, { id: 'evidence:kept', type: 'llmwiki', title: '用户收藏的引用', documentRef: 'kept.md', persistence: 'reference' })
    brainStore.updateState(root, { migrationVersion: 2 })

    const migrated = service.ensureReady(root, { providers: [{ id: 'local-default', kind: 'qmd-local', collectionId: 'root' }] })
    assert.equal(migrated.state.migrationVersion, 3)
    assert.equal(migrated.nodes.some((node) => node.id === oldSourceId || node.id === oldNodeId), false)
    assert.equal(migrated.evidence.some((item) => item.id === oldEvidenceId), false)
    assert.equal(migrated.nodes.some((node) => node.id === 'reference:kept'), true)
    assert.equal(migrated.evidence.some((item) => item.id === 'evidence:kept'), true)
  })

  it('marks removed provider anchors unavailable instead of deleting history', () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root, { providers: [{ id: 'rag:gone', kind: 'ragflow', collections: [{ id: 'd1', name: 'Old dataset' }] }] })
    const after = service.rebuild(root, { providers: [] })
    const old = after.nodes.find((node) => node.providerId === 'rag:gone')
    assert.equal(old.stale, true)
    assert.equal(after.claims.some((claim) => (claim.subjectId === old.id || claim.objectNodeId === old.id) && claim.status === 'expired'), true)
    assert.equal(service.snapshot(root).proposals.some((proposal) => proposal.kind === 'expiry'), true)
  })

  it('applies Brain changes only after proposal confirmation and keeps review history', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const proposal = service.propose(root, {
      id: 'proposal:goal', kind: 'cognition', targetType: 'brain', summary: 'Remember a goal',
      effects: [{ op: 'upsert_node', value: { id: 'goal:ship', kind: 'goal', label: 'Ship Brain' } }],
    }).proposal
    assert.equal(service.snapshot(root).nodes.some((node) => node.id === 'goal:ship'), false)
    assert.equal((await service.confirm(root, proposal.id)).ok, true)
    assert.equal(service.snapshot(root, { includeResolved: true }).nodes.some((node) => node.id === 'goal:ship'), true)
    assert.equal(service.snapshot(root, { includeResolved: true }).proposals.find((item) => item.id === proposal.id).status, 'confirmed')
    const later = service.propose(root, { id: 'proposal:later', summary: 'Review later' }).proposal
    assert.equal(service.snooze(root, later.id).proposal.status, 'snoozed')
    const rejected = service.propose(root, { id: 'proposal:never-again', summary: 'Do not repeat' }).proposal
    service.reject(root, rejected.id)
    assert.equal(service.propose(root, { id: rejected.id, summary: 'Do not repeat' }).suppressed, true)
  })

  it('requires every durable Claim to resolve at least one Evidence reference', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    brainStore.upsertNode(root, { id: 'goal:evidence', kind: 'goal', label: 'Evidence-backed goal' })
    assert.throws(() => brainStore.upsertClaim(root, {
      subjectId: 'self:me', predicate: 'pursues', objectNodeId: 'goal:evidence', evidenceRefs: [],
    }), /Evidence/)

    const proposal = service.propose(root, {
      id: 'proposal:evidence-order', summary: 'Confirm an evidence-backed relationship', targetType: 'brain',
      effects: [
        { op: 'upsert_claim', value: { id: 'claim:evidence-order', subjectId: 'self:me', predicate: 'pursues', objectNodeId: 'goal:evidence', evidenceRefs: ['evidence:proposal'] } },
        { op: 'upsert_evidence', value: { id: 'evidence:proposal', type: 'conversation', title: 'User confirmation', persistence: 'local' } },
      ],
    }).proposal
    assert.equal((await service.confirm(root, proposal.id)).ok, true)
    assert.deepEqual(service.snapshot(root).claims.find(item => item.id === 'claim:evidence-order').evidenceRefs, ['evidence:proposal'])
  })

  it('reranks by graph evidence, exposes conflicts and explains a multi-hop path', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    brainStore.upsertNode(root, { id: 'project:brain', kind: 'project', label: 'Local Brain', authority: 5 })
    brainStore.upsertNode(root, { id: 'decision:json', kind: 'decision', label: 'Use atomic JSON storage', authority: 5 })
    brainStore.upsertNode(root, { id: 'decision:sqlite', kind: 'decision', label: 'Use SQLite storage', authority: 3 })
    brainStore.upsertEvidence(root, { id: 'e:path', type: 'conversation', title: 'Confirmed architecture discussion', persistence: 'local' })
    brainStore.upsertClaim(root, { id: 'c:self-project', subjectId: 'self:me', predicate: 'worksOn', objectNodeId: 'project:brain', status: 'confirmed', evidenceRefs: ['e:path'] })
    brainStore.upsertClaim(root, { id: 'c:project-json', subjectId: 'project:brain', predicate: 'madeDecision', objectNodeId: 'decision:json', status: 'confirmed', evidenceRefs: ['e:path'] })
    brainStore.upsertClaim(root, { id: 'c:project-sqlite', subjectId: 'project:brain', predicate: 'madeDecision', objectNodeId: 'decision:sqlite', status: 'inferred', evidenceRefs: ['e:path'] })

    const result = await service.query(root, { text: 'atomic JSON storage', mode: 'local', topK: 5 })
    const hit = result.hits.find(item => item.nodeId === 'decision:json')
    assert.equal(hit.claimStatus, 'confirmed')
    assert.equal(hit.graphDistance, 2)
    assert.deepEqual(hit.relationPath, ['c:self-project', 'c:project-json'])
    assert.equal(hit.conflict, true)
    assert.match(hit.explanation, /我.*Local Brain.*Use atomic JSON storage/)
    const relation = service.findPath(root, 'self:me', 'decision:json')
    assert.equal(relation.ok, true)
    assert.equal(relation.distance, 2)
    assert.equal(relation.evidence[0].id, 'e:path')
  })

  it('records confirmed growth, reverses Brain effects and persists graph layout', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const proposal = service.propose(root, {
      id: 'proposal:reversible', summary: 'Add a reversible goal', targetType: 'brain',
      effects: [{ op: 'upsert_node', value: { id: 'goal:reversible', kind: 'goal', label: 'Reversible goal' } }],
    }).proposal
    const confirmed = await service.confirm(root, proposal.id)
    assert.equal(confirmed.growthEvent.reversible, true)
    assert.equal(service.growthList(root).events.length, 1)
    assert.equal(service.snapshot(root).nodes.some(item => item.id === 'goal:reversible'), true)
    const undone = await service.undoGrowth(root, confirmed.growthEvent.id)
    assert.equal(undone.ok, true)
    assert.equal(service.snapshot(root).nodes.some(item => item.id === 'goal:reversible'), false)
    assert.equal(service.growthList(root).events[0].status, 'reverted')
    service.saveLayout(root, { 'self:me': { x: 320, y: 240 } })
    assert.deepEqual(service.snapshot(root).layout.positions['self:me'], { x: 320, y: 240 })
  })

  it('routes partner and capability growth through confirmation handlers and shared undo', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const calls = []
    const ctx = {
      applyPartnerGrowth: async () => ({ ok: true, reverseEffects: [{ op: 'restore_profile', value: { id: 'my-knowme' } }] }),
      undoPartnerGrowth: async () => { calls.push('undo-partner'); return { ok: true } },
      applyCapabilityGrowth: async () => ({ ok: true, reverseEffects: [{ op: 'capability_disable', id: 'research' }] }),
      undoCapabilityGrowth: async () => { calls.push('undo-capability'); return { ok: true } },
    }
    const partner = service.propose(root, { id: 'p:partner', kind: 'behavior', targetType: 'partner_profile', summary: 'More proactive', effects: [{ promptOverlay: 'More proactive' }] }).proposal
    const capability = service.propose(root, { id: 'p:capability', kind: 'capability', targetType: 'capability', summary: 'Enable research', effects: [{ op: 'capability_enable', id: 'research' }] }).proposal
    const partnerApplied = await service.confirm(root, partner.id, {}, ctx)
    const capabilityApplied = await service.confirm(root, capability.id, {}, ctx)
    assert.equal(partnerApplied.growthEvent.targetType, 'partner_profile')
    assert.equal(capabilityApplied.growthEvent.targetType, 'capability')
    assert.equal((await service.undoGrowth(root, partnerApplied.growthEvent.id, ctx)).ok, true)
    assert.equal((await service.undoGrowth(root, capabilityApplied.growthEvent.id, ctx)).ok, true)
    assert.deepEqual(calls, ['undo-partner', 'undo-capability'])
  })

  it('favorites only an external reference, not the source body', () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const result = service.saveReference(root, { providerId: 'rf', collectionId: 'rules', documentRef: 'doc:42', title: 'Policy reference', snippet: 'Necessary short summary' })
    assert.equal(result.ok, true)
    assert.equal(result.evidence.persistence, 'reference')
    assert.equal(result.node.external, true)
    assert.equal(JSON.stringify(service.snapshot(root)).includes('full document body'), false)
  })

  it('uses external results ephemerally and enforces provider collection grants', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const before = service.snapshot(root).evidence.length
    let observed = null
    const result = await service.query(root, {
      text: 'contact me at user@example.com about policy', mode: 'external',
      knowledgePolicy: { brainScopes: [], providers: [{ providerId: 'rag:one', collectionIds: ['allowed', 'second', 'blocked'] }], allowRemoteQuery: true },
    }, {
      providers: [{ id: 'rag:one', kind: 'ragflow', collectionIds: ['blocked'] }],
      fabricSearch: async (_root, query, options) => {
        observed = { query, providers: options.providers }
        return { hits: [{ title: 'Policy', snippet: 'External body', path: 'doc:1', source: 'ragflow', kbId: 'rag:one', collectionId: 'allowed', score: .9 }] }
      },
    })
    assert.equal(result.hits[0].sourceKind, 'ragflow')
    assert.equal(result.hits[0].persistence, 'external')
    assert.equal(observed.query.includes('user@example.com'), false)
    assert.deepEqual(observed.providers[0].collectionIds, ['allowed', 'second'])
    assert.equal(service.snapshot(root).evidence.length, before)
  })

  it('caches federated hits outside durable Brain with a TTL', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    let calls = 0
    const request = { text: 'external policy', mode: 'external', knowledgePolicy: { providers: [{ providerId: 'rag:one', collectionIds: ['a'] }], allowRemoteQuery: true } }
    const ctx = {
      providers: [{ id: 'rag:one', kind: 'ragflow' }],
      fabricSearch: async () => { calls += 1; return { hits: [{ title: 'Policy', path: 'd1', snippet: 'cached', source: 'ragflow', kbId: 'rag:one' }] } },
    }
    await service.query(root, request, ctx)
    await service.query(root, request, ctx)
      assert.equal(calls, 1)
      assert.equal(fs.existsSync(path.join(root, 'knowledge-os', 'cache', 'brain-query')), true)
      assert.equal(brainStore.snapshot(root).evidence.some((item) => item.snippet === 'cached'), false)
      await service.query(root, request, { ...ctx, providers: [{ ...ctx.providers[0], endpoint: 'https://changed.invalid' }] })
      assert.equal(calls, 2, 'same provider ID with different source configuration cannot reuse old hits')
  })

  it('does not query any external Provider when the Agent policy grants none', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    let calls = 0
    const result = await service.query(root, {
      text: 'restricted external knowledge',
      mode: 'external',
      knowledgePolicy: { providers: [], allowRemoteQuery: true },
    }, {
      providers: [{ id: 'rag:private', kind: 'ragflow', collectionIds: ['private'] }],
      fabricSearch: async () => { calls += 1; return { hits: [] } },
    })
    assert.equal(calls, 0)
    assert.equal(result.externalAttempted, false)
  })

  it('can isolate an Agent from personal Brain nodes', async () => {
    const root = tempUserData()
    const service = serviceFixture()
    service.rebuild(root)
    const result = await service.query(root, {
      text: 'conclusion preference', mode: 'local',
      knowledgePolicy: { brainScopes: ['global'], allowPersonalMemory: false, allowRemoteQuery: false },
    })
    assert.equal(result.hits.some((hit) => hit.title === 'Give the conclusion first'), false)
  })
})
