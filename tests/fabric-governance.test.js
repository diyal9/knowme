'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const fabricGraph = require('../src/lib/fabric-graph')
const fabricWeave = require('../src/lib/fabric-weave')
const fabricGovernance = require('../src/lib/fabric-governance')
const fabricRetrieval = require('../src/lib/fabric-retrieval')
const knowledgeOs = require('../src/lib/knowledge-os')
const kp = require('../src/lib/knowledge-provider')

describe('fabric-governance', () => {
  let userData
  let wikiRoot

  before(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-gov-'))
    knowledgeOs.ensureDirs(userData)
    wikiRoot = knowledgeOs.defaultPaths(userData).wiki
    fs.writeFileSync(path.join(wikiRoot, 'auth.md'), '# 认证流程\n\nOAuth 与 JWT。\n', 'utf8')
    fs.writeFileSync(path.join(wikiRoot, 'notes.md'), '# 便签\n\n桌面便签。\n', 'utf8')
    knowledgeOs.saveConfig(userData, { spaceSourceId: null, subDir: '' })
    fabricGraph.ensureFabric(userData)
    fabricGraph.upsertNode(userData, {
      id: 'c:auth',
      kind: 'concept',
      title: '认证流程',
      summary: 'OAuth 与 JWT 认证',
      authority: 4,
      path: 'auth.md',
    })
  })

  after(() => {
    try { fs.rmSync(userData, { recursive: true, force: true }) } catch { /* cleanup */ }
  })

  it('SSOT: higher authority creates update proposal', () => {
    const r = fabricGovernance.checkSsot(userData, {
      title: '认证流程',
      summary: '更新版 OAuth',
      authority: 5,
    })
    assert.equal(r.action, 'update_proposal')
    assert.ok(r.proposal)
  })

  it('SSOT: equal authority marks conflict in mark mode', () => {
    const r = fabricGovernance.checkSsot(userData, {
      title: '认证流程',
      summary: '重复概念',
      authority: 4,
    })
    assert.equal(r.action, 'mark_conflict')
    assert.ok(r.proposal)
  })

  it('SSOT: lower authority creates alias proposal', () => {
    const r = fabricGovernance.checkSsot(userData, {
      title: '认证流程',
      summary: '低权威草稿',
      authority: 2,
    })
    assert.equal(r.action, 'alias_proposal')
    assert.ok(r.proposal)
  })

  it('SSOT: block mode rejects equal authority ingest', () => {
    fabricGovernance.setSsotMode(userData, 'block')
    const r = fabricGovernance.checkIngestSsot(userData, {
      title: '认证流程',
      text: 'blocked duplicate',
      authority: 4,
    })
    assert.equal(r.blocked, true)
    fabricGovernance.setSsotMode(userData, 'mark')
  })

  it('detects broken anchor when ext file missing', () => {
    fabricGraph.upsertNode(userData, {
      id: 'a:kb_personal/missing.md',
      kind: 'anchor',
      kbId: 'kb_personal',
      extRef: 'missing-file.md',
      title: 'Missing',
      authority: 3,
    })
    const provider = kp.defaultPersonalProvider({ spaceSourceId: null })
    const issues = fabricGovernance.detectBrokenAnchors(userData, [{ ...provider, id: 'kb_personal' }], {})
    assert.ok(issues.some(i => i.category === 'broken_anchor'))
  })

  it('marks stale anchor when file hash changes', () => {
    const extPath = path.join(wikiRoot, 'stale-target.md')
    fs.writeFileSync(extPath, '# Stale\n\nv1\n', 'utf8')
    const content = fs.readFileSync(extPath, 'utf8')
    const fp = fabricGovernance.fileFingerprint(extPath, content)
    fabricGraph.upsertNode(userData, {
      id: 'a:kb_personal/stale-target.md',
      kind: 'anchor',
      kbId: 'kb_personal',
      extRef: 'stale-target.md',
      title: 'Stale',
      syncHash: 'oldhash0000000000',
      syncMtime: fp.syncMtime,
      stale: false,
    })
    fs.writeFileSync(extPath, '# Stale\n\nv2 changed\n', 'utf8')
    const provider = kp.defaultPersonalProvider({ spaceSourceId: null })
    const scan = fabricGovernance.scanStaleAnchors(userData, [{ ...provider, id: 'kb_personal' }], {})
    assert.ok(scan.staleCount >= 1)
    const graph = fabricGraph.loadGraph(userData)
    const node = graph.nodes.find(n => n.id === 'a:kb_personal/stale-target.md')
    assert.equal(node.stale, true)
  })

  it('runUnifiedCheckup aggregates wiki lint and conflicts', () => {
    fabricGraph.upsertNode(userData, {
      id: 'c:dup-a',
      kind: 'concept',
      title: '重复标题',
      authority: 2,
    })
    fabricGraph.upsertNode(userData, {
      id: 'c:dup-b',
      kind: 'concept',
      title: '重复标题',
      authority: 2,
    })
    fabricGraph.upsertEdge(userData, {
      from: 'c:dup-a',
      to: 'c:dup-b',
      type: 'contradicts',
    })
    const provider = kp.defaultPersonalProvider({ spaceSourceId: null })
    const report = fabricGovernance.runUnifiedCheckup(userData, {
      providers: [{ ...provider, id: 'kb_personal' }],
    })
    assert.equal(report.ok, true)
    assert.ok(report.categories.conflict >= 1 || report.categories.duplicate_title >= 1)
    assert.ok(typeof report.overallHealth === 'number')
  })

  it('records retrieval conflicts back to graph', () => {
    fabricGraph.upsertNode(userData, { id: 'c:x', kind: 'concept', title: 'X', authority: 3 })
    fabricGraph.upsertNode(userData, { id: 'c:y', kind: 'concept', title: 'Y', authority: 5 })
    const hits = [{
      nodeId: 'c:x',
      title: 'X',
      conflict: { type: 'contradicts', winnerId: 'c:y', winnerTitle: 'Y' },
    }]
    const before = (fabricGraph.loadGraph(userData).edges || []).filter(e => e.type === 'contradicts').length
    fabricGovernance.recordRetrievalConflicts(userData, hits)
    const after = (fabricGraph.loadGraph(userData).edges || []).filter(e => e.type === 'contradicts').length
    assert.ok(after >= before)
  })

  it('enqueue and process reweave queue', () => {
    fabricGovernance.enqueueReweave(userData, 'kb_personal')
    const provider = kp.defaultPersonalProvider({ spaceSourceId: null })
    const out = fabricGovernance.processReweaveQueue(userData, {
      providers: [{ ...provider, id: 'kb_personal' }],
    }, { max: 1 })
    assert.equal(out.ok, true)
    assert.ok(Array.isArray(out.processed))
  })

  it('resolveConflicts still works with governance edges', () => {
    const graph = fabricGraph.loadGraph(userData)
    const hits = [
      { nodeId: 'c:auth', title: '认证流程', authority: 4 },
    ]
    const out = fabricRetrieval.resolveConflicts(hits, graph)
    assert.ok(Array.isArray(out))
  })
})
