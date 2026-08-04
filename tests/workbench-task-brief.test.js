/**
 * workbench-task-brief — 任务事实摘要，防止协作区编造外部审批链
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  LOCAL_APPROVER,
  buildWorkbenchTaskBrief,
  classifyWorkbenchPaths,
  workbenchGroundingRules,
} = require('../src/lib/workbench-task-brief')

describe('workbench-task-brief', () => {
  it('marks done tasks as completed instead of waiting for process', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      currentNode: '',
      agents: ['开发者'],
      artifacts: [{ path: 'docs/report.md' }],
    })
    assert.equal(brief.waitingKind, 'none')
    assert.equal(brief.currentNodeLabel, '已完成')
    assert.match(brief.factualBrief, /已完成/)
    assert.doesNotMatch(brief.factualBrief, /等待流程推进/)
    assert.doesNotMatch(brief.factualBrief, /财务|法务|运营/)
    assert.ok(brief.artifacts.includes('docs/report.md'))
    assert.match(brief.nextAction, /任务产物/)
  })

  it('does not treat task input paths as artifacts in next-step guidance', () => {
    const classified = classifyWorkbenchPaths(
      [{ path: 'ingest/brief.md' }, { path: 'docs/report.md' }],
      { root: 'ingest/', prd: 'ingest/brief.md' }
    )
    assert.deepEqual(classified.artifacts.map(item => item.path), ['docs/report.md'])
    assert.ok(classified.inputs.some(item => item.path === 'ingest/brief.md'))

    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      artifacts: [{ path: 'ingest/brief.md' }],
      inputs: { root: 'ingest/', prd: 'ingest/brief.md' },
    })
    assert.deepEqual(brief.artifacts, [])
    assert.doesNotMatch(brief.nextAction, /ingest\/brief\.md/)
    assert.doesNotMatch(brief.factualBrief, /已有产物：ingest/)
    assert.match(brief.factualBrief, /任务输入：已配置启动输入/)
  })

  it('rewrites misleading waiting labels when status is done', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      currentNode: '等待流程推进',
    })
    assert.equal(brief.currentNodeLabel, '已完成')
  })

  it('attributes pending gates to the local developer operator', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'running',
      currentNode: 'developer-review',
      pendingGates: [{ node: 'developer-review', title: '开发者验收' }],
      agents: ['开发者'],
    })
    assert.equal(brief.waitingKind, 'gate')
    assert.equal(brief.approver, LOCAL_APPROVER)
    assert.match(brief.factualBrief, /本机操作者（开发者）/)
    assert.match(brief.factualBrief, /通过 \/ 修订 \/ 打回/)
    assert.doesNotMatch(brief.factualBrief, /等待财务|法务审批|运营审批/)
    assert.match(brief.nextAction, /不要假设存在财务、法务/)
  })

  it('describes clarification waiting without inventing departments', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'waiting',
      pendingClarifications: [{ question: '活动预算是多少？' }],
    })
    assert.equal(brief.waitingKind, 'clarification')
    assert.match(brief.factualBrief, /活动预算是多少？/)
    assert.doesNotMatch(brief.factualBrief, /财务审批|法务/)
  })

  it('derives user-facing tone and headline per state', () => {
    const done = buildWorkbenchTaskBrief({ status: 'done' })
    assert.equal(done.tone, 'done')
    assert.equal(done.headline, '任务已完成')

    const gate = buildWorkbenchTaskBrief({
      status: 'running',
      pendingGates: [{ node: 'developer-review', title: '开发者验收' }],
    })
    assert.equal(gate.tone, 'waiting')
    assert.match(gate.headline, /等待你确认/)

    const clarify = buildWorkbenchTaskBrief({
      status: 'waiting',
      pendingClarifications: [{ question: '预算多少？' }],
    })
    assert.equal(clarify.tone, 'waiting')
    assert.match(clarify.headline, /补充/)

    const running = buildWorkbenchTaskBrief({ status: 'running' })
    assert.equal(running.tone, 'running')
    assert.equal(running.headline, '正在执行')

    const failed = buildWorkbenchTaskBrief({ status: 'failed' })
    assert.equal(failed.tone, 'error')
    assert.match(failed.headline, /失败/)

    const degraded = buildWorkbenchTaskBrief({ status: 'done', degraded: true })
    assert.equal(degraded.tone, 'muted')
    assert.match(degraded.headline, /流程详情暂不可用/)
  })

  it('exports grounding rules that forbid fabricated roles', () => {
    const rules = workbenchGroundingRules()
    assert.match(rules, /财务、法务、运营/)
    assert.match(rules, /本机操作者（开发者）/)
    assert.match(rules, /本地工作流\/知识库未提供/)
  })
})
