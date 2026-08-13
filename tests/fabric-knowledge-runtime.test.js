'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const kp = require('../src/lib/knowledge-provider')
const fabricGraph = require('../src/lib/fabric-graph')
const fabricWeave = require('../src/lib/fabric-weave')
const fabricRetrieval = require('../src/lib/fabric-retrieval')
const qmdEngine = require('../src/lib/qmd-engine')
const knowledgeOs = require('../src/lib/knowledge-os')

describe('fabric-knowledge-runtime', () => {
  let userData
  let wikiRoot

  before(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fabric-'))
    knowledgeOs.ensureDirs(userData)
    wikiRoot = knowledgeOs.defaultPaths(userData).wiki
    fs.writeFileSync(path.join(wikiRoot, 'ipc-guide.md'), '# Electron IPC\n\n主进程与渲染进程通过 IPC 通信。\n', 'utf8')
    fs.writeFileSync(path.join(wikiRoot, 'notes.md'), '# 便签\n\n桌面便签同步依赖 IPC。\n', 'utf8')
    knowledgeOs.saveConfig(userData, { spaceSourceId: null, subDir: '' })
  })

  after(() => {
    try { fs.rmSync(userData, { recursive: true, force: true }) } catch { /* cleanup */ }
  })

  it('normalizes KB registry metadata on providers', () => {
    const p = kp.normalizeProvider({
      id: 'kb_personal',
      kind: 'qmd-local',
      scope: 'shared',
      authority: 4,
      retrievalTier: 1,
      writable: true,
      promotable: true,
      collectionId: 'root',
    })
    assert.equal(p.kind, 'qmd-local')
    assert.equal(p.scope, 'shared')
    assert.equal(p.authority, 4)
    assert.equal(p.retrievalTier, 1)
    assert.equal(p.collectionId, 'root')
    assert.equal(kp.defaultPersonalProvider().writable, true)
  })

  it('reads and writes fabric graph and routing', () => {
    fabricGraph.ensureFabric(userData)
    fabricGraph.upsertNode(userData, {
      id: 'c:ipc',
      kind: 'concept',
      title: 'IPC 通信',
      summary: 'Electron IPC 指南',
      authority: 3,
      path: 'ipc-guide.md',
    })
    fabricGraph.upsertEdge(userData, {
      id: 'e1',
      from: 'c:ipc',
      to: 'c:notes',
      type: 'relatesTo',
      weight: 0.6,
    })
    fabricGraph.upsertTopicRouting(userData, 'electron.ipc', {
      owners: ['kb_personal'],
      coverageInRoot: 0.8,
      delegateTo: ['kb_personal'],
    })
    const snap = fabricGraph.getSnapshot(userData)
    assert.equal(snap.stats.concepts, 1)
    assert.equal(snap.stats.edges, 1)
    assert.ok(snap.routing.topics['electron.ipc'])
  })

  it('weaves anchors and proposes edges from wiki files', () => {
    const provider = kp.defaultPersonalProvider({ spaceSourceId: null })
    const woven = fabricWeave.weaveProvider(userData, { ...provider, id: 'kb_personal' }, {})
    assert.equal(woven.ok, true)
    assert.ok(woven.proposal.anchors.length >= 2)
    const applied = fabricWeave.applyWeave(userData, woven.proposal.id)
    assert.equal(applied.ok, true)
    const snap = fabricGraph.getSnapshot(userData)
    assert.ok(snap.stats.anchors >= 2)
  })

  it('routes with short-circuit, forced recall, and broad fanout', () => {
    const graph = {
      nodes: [
        { id: 'c:a', kind: 'concept', title: 'A', summary: 'alpha', authority: 3 },
        { id: 'a:b', kind: 'anchor', title: 'B', kbId: 'kb_ext', summary: 'beta', stale: false },
      ],
      edges: [],
    }
    const routing = {
      topics: {
        'security.auth': { owners: ['kb_server'], delegateTo: ['kb_server'], coverageInRoot: 0.2 },
      },
      kbs: {},
    }
    const strong = [{ score: 8, kind: 'concept', title: 'A' }, { score: 7, kind: 'concept', title: 'A2' }]
    const short = fabricRetrieval.routeQuery(graph, routing, strong, 'alpha', [
      { id: 'kb_ext', retrievalTier: 2 },
    ])
    assert.equal(short.shortCircuit, true)
    assert.equal(short.targetKbIds.length, 0)

    const weak = fabricRetrieval.routeQuery(graph, routing, [], 'security auth jwt', [
      { id: 'kb_server', retrievalTier: 1 },
      { id: 'kb_ext', retrievalTier: 2 },
    ])
    assert.ok(weak.targetKbIds.includes('kb_server'))

    const broad = fabricRetrieval.routeQuery(graph, routing, [{ score: 0.5 }], 'unknown topic xyz', [
      { id: 'kb_a', retrievalTier: 2 },
      { id: 'kb_b', retrievalTier: 3 },
    ])
    assert.equal(broad.broadFanout, true)
    assert.ok(broad.targetKbIds.length >= 1)
  })

  it('fuses lists with RRF and authority weighting', () => {
    const fused = fabricRetrieval.rrfFuse([
      { weight: 1, hits: [{ refKey: 'a', title: 'A', authority: 2, path: 'a' }] },
      { weight: 1.2, hits: [{ refKey: 'b', title: 'B', authority: 5, path: 'b' }] },
    ])
    assert.equal(fused[0].title, 'B')
    assert.ok(fused[0].rrfScore > fused[1].rrfScore)
  })

  it('resolves contradicts by authority then recency', () => {
    const graph = {
      nodes: [
        { id: 'c:old', title: '旧', authority: 2, lastSynced: '2020-01-01T00:00:00.000Z' },
        { id: 'c:new', title: '新', authority: 4, lastSynced: '2026-01-01T00:00:00.000Z' },
      ],
      edges: [{ from: 'c:old', to: 'c:new', type: 'contradicts' }],
    }
    const hits = [
      { nodeId: 'c:old', title: '旧', authority: 2, path: 'old' },
      { nodeId: 'c:new', title: '新', authority: 4, path: 'new' },
    ]
    const out = fabricRetrieval.resolveConflicts(hits, graph)
    const loser = out.find(h => h.nodeId === 'c:old')
    assert.ok(loser.conflict)
    assert.match(loser.conflict.message, /新/)
  })

  it('runs fabric search without embed (fallback, no model)', async () => {
    fabricGraph.seedConceptsFromEntries(userData, [
      { path: 'ipc-guide.md', title: 'Electron IPC' },
    ], { authority: 3 })
    const res = await fabricRetrieval.fabricSearch(userData, 'Electron IPC', {
      providers: [kp.defaultPersonalProvider()],
      wikiDocs: [
        { title: 'Electron IPC', path: 'ipc-guide.md', content: '主进程与渲染进程通过 IPC 通信' },
      ],
      loadKbDocs: async () => [],
      queryProvider: async () => ({ ok: true, hits: [] }),
    })
    assert.equal(res.ok, true)
    assert.equal(res.engine, 'fallback')
    assert.ok(res.hits.length >= 1)
  })

  it('uses lexical fallback when qmd feature flag is off', async () => {
    const status = await qmdEngine.getEngineStatus()
    assert.equal(status.engine, 'fallback')
    const out = await qmdEngine.queryCollection('root', 'IPC', {
      docs: [{ title: 'IPC', path: 'ipc.md', content: 'IPC 通信指南' }],
    })
    assert.equal(out.engine, 'fallback')
    assert.ok(out.hits.length >= 1)
  })
})
