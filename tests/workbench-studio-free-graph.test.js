'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const studio = require('../src/lib/workbench-studio-model')

describe('workbench-studio free graph', () => {
  it('supports free edges and specialty node kinds compiled for runtime', () => {
    let draft = studio.createDraft({
      goal: '自由图',
      graphMode: 'free',
      edges: [],
      nodes: [
        { id: studio.START_ID, kind: 'start', x: 40, y: 80 },
        { id: studio.END_ID, kind: 'end', x: 900, y: 80 },
      ],
    })
    draft = studio.addNode(draft, {
      kind: 'llm',
      name: '总结',
      config: { prompt: '总结', modelName: 'qwen' },
    })
    draft = studio.addNode(draft, {
      kind: 'condition',
      name: '是否足够',
      config: { left: 'input', compare: 'equal', right: 'ok' },
    })
    draft = studio.addNode(draft, {
      kind: 'tool',
      name: '搜索',
      config: { skillId: 'web-search' },
    })
    const llm = draft.nodes.find(n => n.kind === 'llm')
    const cond = draft.nodes.find(n => n.kind === 'condition')
    const tool = draft.nodes.find(n => n.kind === 'tool')
    draft = studio.connect(draft, studio.START_ID, llm.id)
    draft = studio.connect(draft, llm.id, cond.id)
    draft = studio.connect(draft, cond.id, tool.id, { branch: 'true', label: '成立' })
    draft = studio.connect(draft, cond.id, studio.END_ID, { branch: 'false', label: '不成立' })
    draft = studio.connect(draft, tool.id, studio.END_ID)

    const graph = studio.toComposition(draft)
    assert.ok(graph.nodes.some(n => n.type === 'llm' && n.config?.prompt === '总结'))
    assert.ok(graph.nodes.some(n => n.type === 'condition'))
    assert.ok(graph.nodes.some(n => n.type === 'tool'))
    assert.ok(graph.edges.some(e => e.branch === 'true'))
    assert.ok(graph.edges.some(e => e.branch === 'false'))
    assert.equal(graph.members.length, 0)
    assert.equal(studio.validateDraft(draft).ok, true)

    const restored = studio.fromGraph(graph, { name: 'restored' })
    assert.equal(restored.graphMode, 'free')
    assert.ok(restored.nodes.some(n => n.kind === 'condition'))
    assert.ok(restored.nodes.some(n => n.kind === 'llm'))
  })

  it('lets free-graph DAG wiring skip fan-out from start for later nodes', () => {
    let draft = studio.createDraft({
      graphMode: 'free',
      edges: [],
      nodes: [
        { id: studio.START_ID, kind: 'start' },
        { id: studio.END_ID, kind: 'end' },
      ],
    })
    draft = studio.addNode(draft, { kind: 'agent', name: 'A', agentPackageId: 'a' })
    draft = studio.addNode(draft, { kind: 'agent', name: 'B', agentPackageId: 'b' })
    const a = draft.nodes.find(n => n.name === 'A')
    const b = draft.nodes.find(n => n.name === 'B')
    assert.ok(draft.edges.some(e => e.from === studio.START_ID && e.to === a.id))
    assert.equal(draft.edges.some(e => e.from === studio.START_ID && e.to === b.id), false)
    draft = studio.connect(draft, a.id, b.id)
    draft = studio.connect(draft, b.id, studio.END_ID)
    assert.ok(draft.edges.some(e => e.from === a.id && e.to === b.id))
    assert.ok(draft.edges.some(e => e.from === b.id && e.to === studio.END_ID))
    // cycle rejected
    const cycled = studio.connect(draft, b.id, a.id)
    assert.equal(cycled.edges.some(e => e.from === b.id && e.to === a.id), false)
  })

  it('rejects llm without model (not missing_agent)', () => {
    let draft = studio.createDraft({
      graphMode: 'free',
      edges: [],
      nodes: [
        { id: studio.START_ID, kind: 'start' },
        { id: studio.END_ID, kind: 'end' },
      ],
    })
    draft = studio.addNode(draft, { kind: 'llm', name: '裸模型', config: { prompt: 'hi' } })
    const check = studio.validateDraft(draft)
    assert.equal(check.ok, false)
    assert.ok(check.issues.some(item => item.code === 'missing_model'))
    assert.equal(check.issues.some(item => item.code === 'missing_agent'), false)
  })

  it('accepts llm without expert when model is selected', () => {
    let draft = studio.createDraft({
      goal: '无专家大模型',
      graphMode: 'free',
      edges: [],
      nodes: [
        { id: studio.START_ID, kind: 'start' },
        { id: studio.END_ID, kind: 'end' },
      ],
    })
    draft = studio.addNode(draft, {
      kind: 'llm',
      name: '模型',
      config: { modelName: 'auto', prompt: 'hello' },
    })
    assert.equal(studio.validateDraft(draft).ok, true)
  })

  it('can normalize linear drafts to free without marking dirty', () => {
    const linear = studio.createDraft({
      name: '线性流程',
      nodes: [
        { kind: 'agent', name: '写作', agentPackageId: 'writer' },
      ],
    })
    assert.equal(linear.dirty, false)
    const upgraded = studio.ensureFreeGraph(linear, { markDirty: false })
    assert.equal(upgraded.graphMode, 'free')
    assert.equal(upgraded.dirty, false)
    assert.ok(upgraded.nodes.some(n => n.kind === 'start'))
    assert.ok(upgraded.edges.length > 0)

    const marked = studio.ensureFreeGraph(linear)
    assert.equal(marked.dirty, true)
  })
})
