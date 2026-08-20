'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const studio = require('../src/lib/workbench-studio-model')

describe('workbench-studio-model', () => {
  it('migrates duplicate or unsupported legacy palette nodes', () => {
    const draft = studio.createDraft({
      graphMode: 'free',
      nodes: [
        { id: 'legacy-human', kind: 'human', name: '人工步骤' },
        { id: 'legacy-action', kind: 'action', name: '旧动作' },
      ],
      edges: [],
    })

    assert.equal(draft.nodes.find(node => node.id === 'legacy-human').kind, 'gate')
    assert.equal(draft.nodes.find(node => node.id === 'legacy-action').kind, 'tool')
  })

  it('adds, reorders and removes Agent steps without losing node profiles', () => {
    let draft = studio.createDraft({ name: '我的流程', goal: '完成交付' })
    draft = studio.addAgent(draft, { id: 'producer', name: '制作人' })
    draft = studio.addAgent(draft, {
      id: 'developer',
      name: '开发',
      origin: 'local',
      contentHash: 'package-hash',
      profileId: 'developer-workflow-profile',
      profile: {
        profileHash: 'profile-hash',
        promptOverlay: '先验证再实现',
        skillRefs: [{ id: 'coding' }],
        knowledgeRefs: [{ id: 'kb-team' }],
      },
    })
    draft = studio.moveNode(draft, draft.nodes[1].id, 0)

    assert.deepEqual(draft.nodes.map(node => node.agentPackageId), ['developer', 'producer'])
    assert.equal(draft.nodes[0].profile.promptOverlay, '先验证再实现')
    assert.equal(draft.nodes[0].profileId, 'developer-workflow-profile')
    assert.equal(draft.nodes[0].agentOrigin, 'local')
    assert.equal(draft.nodes[0].packageHash, 'package-hash')
    assert.equal(draft.nodes[0].profileHash, 'profile-hash')

    draft = studio.removeNode(draft, draft.nodes[1].id)
    assert.equal(draft.nodes.length, 1)
    assert.equal(draft.dirty, true)
  })

  it('compiles serial, parallel and approval relations into a valid-shaped DAG', () => {
    let draft = studio.createDraft({ goal: '并行完成并确认' })
    draft = studio.addAgent(draft, { id: 'researcher', name: '研究' })
    draft = studio.addAgent(draft, { id: 'writer', name: '写作' })
    draft = studio.addAgent(draft, { id: 'reviewer', name: '审阅' })
    draft = studio.updateNode(draft, draft.nodes[0].id, { relation: 'parallel' })
    draft = studio.updateNode(draft, draft.nodes[1].id, { relation: 'approval' })

    const graph = studio.toComposition(draft)
    const join = graph.nodes.find(node => node.type === 'join')
    const gate = graph.nodes.find(node => node.type === 'gate')
    const terminal = graph.nodes.find(node => node.type === 'terminal')

    assert.ok(join)
    assert.ok(gate)
    assert.ok(terminal)
    assert.equal(graph.gates.length, 1)
    assert.ok(graph.edges.some(edge => edge.from === join.id && edge.to === gate.id))
    assert.ok(graph.edges.some(edge => edge.from === gate.id && edge.to === draft.nodes[2].id))
    assert.equal(graph.members.length, 3)
    assert.ok(graph.members.every(member => member.agentOrigin === 'local'))
  })

  it('restores node relation and profile data from a saved graph', () => {
    const restored = studio.fromGraph({
      goal: '恢复流程',
      members: [{
        id: 'node-a',
        agentPackageId: 'agent-a',
        agentOrigin: 'local',
        packageHash: 'package-a',
        profileHash: 'profile-a-hash',
        profileId: 'profile-a',
        profile: { promptOverlay: '只输出证据', knowledgeRefs: [{ id: 'kb-personal' }] },
      }],
      nodes: [{
        id: 'node-a',
        type: 'agent',
        agentPackageId: 'agent-a',
        relation: 'approval',
      }],
    }, { sourceWorkflowId: 'workflow-a' })

    assert.equal(restored.sourceWorkflowId, 'workflow-a')
    assert.equal(restored.nodes[0].profileId, 'profile-a')
    assert.equal(restored.nodes[0].profile.promptOverlay, '只输出证据')
    assert.equal(restored.nodes[0].relation, 'approval')
    assert.equal(restored.nodes[0].packageHash, 'package-a')
    assert.equal(restored.nodes[0].profileHash, 'profile-a-hash')
  })

  it('inspectStudioGraph returns walk order and binding issues', () => {
    let draft = studio.createDraft({ name: '检查', goal: '交付' })
    draft = studio.addAgent(draft, { id: 'copywriter', name: '文案' })
    draft = studio.ensureFreeGraph(draft, { markDirty: false })
    const okReport = studio.inspectStudioGraph(draft)
    assert.equal(okReport.ok, true)
    assert.ok(okReport.walk.some(step => step.nodeId === studio.START_ID))
    assert.ok(okReport.walk.some(step => step.nodeId === studio.END_ID))

    const unbound = {
      ...draft,
      nodes: draft.nodes.map(node => (
        node.kind === 'agent' ? { ...node, agentPackageId: '' } : node
      )),
    }
    const bad = studio.inspectStudioGraph(unbound)
    assert.equal(bad.ok, false)
    assert.ok(bad.issues.some(issue => issue.code === 'missing_agent' && issue.nodeId))
  })

  it('inspectStudioGraph flags unreachable nodes', () => {
    let draft = studio.createDraft({ name: '孤岛', goal: 'x' })
    draft = studio.addAgent(draft, { id: 'a', name: 'A' })
    draft = studio.ensureFreeGraph(draft, { markDirty: false })
    const orphanId = 'orphan-node'
    draft = {
      ...draft,
      nodes: [
        ...draft.nodes,
        {
          id: orphanId,
          kind: 'agent',
          name: '孤岛专家',
          agentPackageId: 'lonely',
          x: 40,
          y: 400,
        },
      ],
    }
    const report = studio.inspectStudioGraph(draft)
    assert.equal(report.ok, false)
    assert.ok(report.issues.some(issue => issue.code === 'unreachable' && issue.nodeId === orphanId))
  })
})
