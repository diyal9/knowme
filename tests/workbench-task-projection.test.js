/**
 * workbench-task-projection 任务工作间投影
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const M = require('../src/lib/workbench-model')
const P = require('../src/lib/workbench-task-projection')

const TEAM_RUN_JSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '.cursor', 'workflows', 'team-run.json'), 'utf8')
)
const TEAM_RUN = M.parseWorkflow(TEAM_RUN_JSON, {
  id: 'team-run',
  name: '三角色协作开发',
})

const AGENTS = [
  { id: 'producer', title: 'Producer', persona: { role: '制作人' } },
  { id: 'developer', title: 'Developer', persona: { role: '开发' } },
  { id: 'tester', title: 'Tester', persona: { role: '测试' } },
]

describe('workbench-task-projection · team-run hydrate', () => {
  it('projects real workflow nodes and named roster from repo JSON', () => {
    const projection = P.projectTaskRoom({
      task: {
        slug: 'demo-task',
        intent: '实现任务工作间团队可见性',
        workflow: 'team-run',
        state: 'running',
        status: { current_node: 'n-producer-plan' },
      },
      workflow: TEAM_RUN,
      agents: AGENTS,
    })
    assert.equal(projection.degraded, false)
    assert.equal(projection.intentTitle, '实现任务工作间团队可见性')
    assert.deepEqual(projection.agents, ['制作人', '开发', '测试'])
    assert.ok(projection.graphNodes.length >= 6)
    assert.ok(projection.graphNodes.some(n => n.id === 'n-producer-plan'))
    assert.ok(projection.graphNodes.some(n => n.meta.includes('制作人')))
    assert.equal(projection.currentOwner, '制作人')
    const labels = projection.graphNodes.map(n => n.label).join('\n')
    assert.doesNotMatch(labels, /目标与材料/)
    assert.doesNotMatch(labels, /AgentTeams 协作/)
    assert.doesNotMatch(labels, /结果与交付/)
  })

  it('marks gate owner as local approver and preserves handoff metadata', () => {
    const projection = P.projectTaskRoom({
      task: {
        workflow: 'team-run',
        state: 'waiting',
        status: { current_node: 'gate-producer' },
        pending_gates: [{ node: 'gate-producer', title: '制作人验收' }],
      },
      workflow: TEAM_RUN,
      agents: AGENTS,
    })
    assert.equal(projection.currentOwner, P.LOCAL_APPROVER)
    const gateNode = projection.graphNodes.find(n => n.id === 'gate-producer')
    assert.ok(gateNode)
    assert.match(gateNode.meta, /门禁/)
  })

  it('degrades safely when workflow definition is missing', () => {
    const projection = P.projectTaskRoom({
      task: { workflow: 'missing-flow', intent: '离线任务', state: 'done' },
      workflow: null,
      agents: [],
    })
    assert.equal(projection.degraded, true)
    assert.match(projection.degradedReason, /激活内容源可能与该工作流不匹配/)
    // 降级原因不得向用户暴露实现路径或 workflow id
    assert.doesNotMatch(projection.degradedReason, /\.cursor\/workflows/)
    assert.doesNotMatch(projection.degradedReason, /missing-flow/)
    assert.equal(projection.graphNodes.length, 1)
    assert.equal(projection.graphNodes[0].label, '流程详情暂不可用')
    assert.equal(projection.graphNodes[0].degradedPlaceholder, true)
    assert.equal(projection.currentNodeLabel, '流程详情暂不可用')
    assert.deepEqual(projection.agents, [])
    const progress = P.summarizeRunnerProgress(projection.graphNodes, { status: 'done', degraded: true })
    assert.equal(progress, '无法确认进度')
    assert.doesNotMatch(progress, /100%|已完成 1\/1/)
  })

  it('keeps honest progress for normal linear graphs', () => {
    const nodes = [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'active' },
      { id: 'c', status: 'pending' },
    ]
    assert.match(P.summarizeRunnerProgress(nodes, { status: 'running' }), /已完成 1\/3 步/)
    assert.match(P.summarizeRunnerProgress(nodes, { status: 'done' }), /100%/)
  })

  it('restores intent and graph after applyProjectionToRun', () => {
    const projection = P.projectTaskRoom({
      task: { workflow: 'team-run', intent: '恢复最近任务', state: 'done' },
      workflow: TEAM_RUN,
      agents: AGENTS,
    })
    const run = { slug: 'x', workflow: { id: 'task' }, graph: null, projection: null }
    P.applyProjectionToRun(run, projection)
    assert.equal(run.intent, '恢复最近任务')
    assert.ok(Array.isArray(run.workflow.nodes))
    assert.ok(run.graph && run.graph.order.length)
    assert.equal(run.projection.currentOwner, projection.currentOwner)
  })
})
