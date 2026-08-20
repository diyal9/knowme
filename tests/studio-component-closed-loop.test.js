'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const studio = require('../src/lib/workbench-studio-model')
const canvas = require('../src/lib/workbench-studio-canvas')
const { AgentTeamWorkflowRunner } = require('../src/lib/agent-team-workflow-runner')
const { compileWorkbenchAgentGraph } = require('../src/lib/workbench-agent-graph')

function emptyFreeDraft(goal = '闭环验收') {
  return studio.createDraft({
    goal,
    graphMode: 'free',
    edges: [],
    nodes: [
      { id: studio.START_ID, kind: 'start', x: 40, y: 80 },
      { id: studio.END_ID, kind: 'end', x: 900, y: 80 },
    ],
  })
}

describe('studio component closed-loop acceptance', () => {
  it('covers every palette kind in fields / palette', () => {
    const kinds = canvas.paletteTypes().map(item => item.kind)
    for (const kind of ['start', 'end', 'agent', 'condition', 'join', 'gate', 'knowledge', 'mcp', 'request']) {
      assert.ok(kinds.includes(kind), `missing palette ${kind}`)
    }
    const llmFields = canvas.fieldsFromNode({
      kind: 'llm',
      name: '大模型',
      config: { modelName: 'qwen-plus', prompt: 'hi' },
    })
    assert.equal(llmFields.some(field => field.bind === 'agentPackageId'), false)
    assert.ok(llmFields.some(field => field.bind === 'config.modelName'))
  })

  it('N1/N2/N3/N8 normal specialty paths validate and compile without agent', () => {
    let draft = emptyFreeDraft()
    draft = studio.addNode(draft, {
      kind: 'llm',
      name: '总结',
      config: { modelName: 'qwen-plus', prompt: '总结 {{input}}' },
    })
    draft = studio.addNode(draft, {
      kind: 'tool',
      name: '工具',
      config: { skillId: 'web-search' },
    })
    draft = studio.addNode(draft, {
      kind: 'knowledge',
      name: '知识',
      config: { knowledgeId: 'kb-main' },
    })
    const llm = draft.nodes.find(n => n.kind === 'llm')
    const tool = draft.nodes.find(n => n.kind === 'tool')
    const knowledge = draft.nodes.find(n => n.kind === 'knowledge')
    draft = studio.connect(draft, llm.id, tool.id)
    draft = studio.connect(draft, tool.id, knowledge.id)
    draft = studio.connect(draft, knowledge.id, studio.END_ID)

    const check = studio.validateDraft(draft)
    assert.equal(check.ok, true, JSON.stringify(check.issues))
    const graph = studio.toComposition(draft)
    assert.ok(graph.nodes.some(n => n.type === 'llm'))
    assert.ok(graph.nodes.some(n => n.type === 'tool'))
    assert.ok(graph.nodes.some(n => n.type === 'knowledge'))
    assert.equal(graph.nodes.some(n => n.type === 'agent'), false)
    assert.equal(graph.members.length, 0)
    assert.equal(graph.template, null)

    const compiled = compileWorkbenchAgentGraph({
      ...graph,
      goal: draft.goal,
      teamPackageId: 'studio-specialty-loop',
      teamName: 'specialty',
      version: '1.0.0',
    })
    assert.equal(compiled.ok, true, JSON.stringify(compiled.issues))
  })

  it('N4 expert path still requires package; N5 condition branches; E1 cycle rejected', () => {
    let draft = emptyFreeDraft()
    draft = studio.addNode(draft, { kind: 'agent', name: '专家', agentPackageId: '' })
    assert.equal(studio.validateDraft(draft).ok, false)
    assert.ok(studio.validateDraft(draft).issues.some(item => item.code === 'missing_agent'))

    draft = emptyFreeDraft()
    draft = studio.addNode(draft, {
      kind: 'llm',
      name: '总结',
      config: { modelName: 'auto', prompt: 'x' },
    })
    draft = studio.addNode(draft, {
      kind: 'condition',
      name: '判断',
      config: { left: 'input', compare: 'equal', right: 'ok' },
    })
    draft = studio.addNode(draft, {
      kind: 'tool',
      name: '工具',
      config: { skillId: 'web-search' },
    })
    const llm = draft.nodes.find(n => n.kind === 'llm')
    const cond = draft.nodes.find(n => n.kind === 'condition')
    const tool = draft.nodes.find(n => n.kind === 'tool')
    draft = studio.connect(draft, llm.id, cond.id)
    draft = studio.connect(draft, cond.id, tool.id, { branch: 'true' })
    draft = studio.connect(draft, cond.id, studio.END_ID, { branch: 'false' })
    draft = studio.connect(draft, tool.id, studio.END_ID)
    assert.equal(studio.validateDraft(draft).ok, true)

    const cycled = studio.connect(draft, tool.id, llm.id)
    assert.equal(cycled.edges.some(e => e.from === tool.id && e.to === llm.id), false)
  })

  it('abnormal configs E2-E7 produce typed issues (not missing_agent for specialty)', () => {
    let draft = emptyFreeDraft()
    assert.ok(studio.validateDraft(draft).issues.some(item => item.code === 'empty'))

    draft = studio.addNode(emptyFreeDraft(), { kind: 'llm', name: '裸', config: { prompt: 'hi' } })
    let check = studio.validateDraft(draft)
    assert.equal(check.ok, false)
    assert.ok(check.issues.some(item => item.code === 'missing_model'))
    assert.equal(check.issues.some(item => item.code === 'missing_agent'), false)

    draft = studio.addNode(emptyFreeDraft(), { kind: 'tool', name: '工具', config: {} })
    check = studio.validateDraft(draft)
    assert.ok(check.issues.some(item => item.code === 'missing_skill'))

    draft = studio.addNode(emptyFreeDraft(), { kind: 'knowledge', name: '知识', config: {} })
    check = studio.validateDraft(draft)
    assert.ok(check.issues.some(item => item.code === 'missing_knowledge'))

    draft = studio.addNode(emptyFreeDraft(), { kind: 'condition', name: '条件', config: {} })
    check = studio.validateDraft(draft)
    assert.ok(check.issues.some(item => item.code === 'condition_no_out'))
  })

  it('E10 leftover agentPackageId on specialty does not block save', () => {
    let draft = emptyFreeDraft()
    draft = studio.addNode(draft, {
      kind: 'llm',
      name: '旧数据',
      agentPackageId: 'legacy-expert',
      config: { modelName: 'gpt-4o', prompt: 'ok' },
    })
    assert.equal(studio.validateDraft(draft).ok, true)
    const graph = studio.toComposition(draft)
    assert.ok(graph.nodes.some(n => n.type === 'llm' && !n.agentPackageId))
  })

  it('runner executes llm→tool specialty chain without missing_agent', async () => {
    const events = []
    const nodeStates = new Map()
    const fakeManager = {
      adoptRunningRun: () => ({ ok: true }),
      completeAdoptedRun: () => ({ ok: true }),
      awaitRun: async () => ({ ok: true, status: 'completed', terminal: 'completed' }),
      getRun: () => ({ ok: true, run: {} }),
    }
    const runner = new AgentTeamWorkflowRunner({
      runManager: fakeManager,
      resolveAgentPackage: () => ({ ok: false }),
      specialtyHandlers: {
        llm: async ({ prompt }) => ({ ok: true, summary: `LLM:${prompt.slice(0, 40)}` }),
        tool: async ({ upstream, config }) => ({
          ok: true,
          summary: `TOOL:${config.skillId}:${upstream.slice(0, 40)}`,
        }),
      },
      emit: event => events.push(event),
    })

    const teamPackage = {
      schemaVersion: 1,
      packageId: 'specialty-team',
      name: 'specialty',
      version: '1.0.0',
      members: [],
      workflow: {
        nodes: [
          { id: 'n-llm', type: 'llm', config: { modelName: 'qwen-plus', prompt: '总结 {{input}}' } },
          { id: 'n-tool', type: 'tool', config: { skillId: 'web-search' } },
          { id: 'n-terminal', type: 'terminal', status: 'completed' },
        ],
        edges: [
          { from: 'n-llm', to: 'n-tool' },
          { from: 'n-tool', to: 'n-terminal' },
        ],
        joinStrategy: 'allSucceeded',
        parallelism: 1,
      },
      gates: [],
      tests: [],
    }

    const result = await runner.run(teamPackage, { text: 'hello world' }, { rootRunId: 'root-specialty-1' })
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.results['n-tool'].summary.includes('web-search'), true)
    assert.equal(events.some(item => item.code === 'missing_agent'), false)
    assert.ok(events.some(item => item.type === 'team.node.completed' && item.nodeId === 'n-llm'))
  })

  it('N6/N7 join and gate nodes compile in free graph with agents', () => {
    let draft = emptyFreeDraft()
    draft = studio.addNode(draft, { kind: 'agent', name: 'A', agentPackageId: 'a' })
    draft = studio.addNode(draft, { kind: 'agent', name: 'B', agentPackageId: 'b' })
    draft = studio.addNode(draft, { kind: 'join', name: '汇合' })
    draft = studio.addNode(draft, { kind: 'gate', name: '确认', config: { title: '请确认' } })
    const a = draft.nodes.find(n => n.name === 'A')
    const b = draft.nodes.find(n => n.name === 'B')
    const join = draft.nodes.find(n => n.kind === 'join')
    const gate = draft.nodes.find(n => n.kind === 'gate')
    draft = studio.connect(draft, a.id, join.id)
    draft = studio.connect(draft, b.id, join.id)
    draft = studio.connect(draft, join.id, gate.id)
    draft = studio.connect(draft, gate.id, studio.END_ID)
    assert.equal(studio.validateDraft(draft).ok, true)
    const graph = studio.toComposition(draft)
    assert.ok(graph.nodes.some(n => n.type === 'join'))
    assert.ok(graph.nodes.some(n => n.type === 'gate'))
    assert.equal(graph.members.length, 2)
  })
})
