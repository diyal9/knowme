'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  createSession,
  normalizeSession,
  sessionDisplayTitle,
  AGENTS,
} = require('../src/lib/agent-sessions')
const agentRun = require('../src/lib/agent-run')

describe('agent-run', () => {
  it('normalizes missing run on legacy sessions', () => {
    const legacy = normalizeSession({
      id: 'session_old',
      agentId: 'general',
      title: '旧会话',
      messages: [{ role: 'user', text: '你好' }],
    })
    assert.equal(legacy.run, undefined)
    assert.equal(legacy.messages.length, 1)
  })

  it('createSession includes run; steward role', () => {
    const s = createSession('steward', 1, { goal: '整理 Wiki' })
    assert.equal(s.run.role, 'steward')
    assert.equal(s.run.goal, '整理 Wiki')
    assert.ok(AGENTS.some((a) => a.id === 'steward'))
  })

  it('accept/reject artifact state machine', () => {
    let s = createSession('steward', 1)
    const art = agentRun.normalizeArtifact({
      type: 'knowledge_proposal',
      title: '提案',
      body: 'body',
      targetPath: 'concepts/x.md',
    })
    s = agentRun.addArtifact(s, art)
    assert.equal(s.run.status, 'review')
    assert.equal(s.run.artifacts[0].status, 'draft')

    s = agentRun.setArtifactStatus(s, art.id, 'accepted')
    assert.equal(s.run.artifacts[0].status, 'accepted')
    assert.equal(s.run.status, 'done')

    s = agentRun.setArtifactStatus(s, art.id, 'rejected')
    assert.equal(s.run.artifacts[0].status, 'rejected')
  })

  it('records tools and uses goal as tab title fallback', () => {
    let s = createSession('steward', 1, { goal: '知识健康检查' })
    s = agentRun.recordTool(s, 'wiki.lint')
    assert.deepEqual(s.run.toolsUsed, ['wiki.lint'])
    assert.equal(sessionDisplayTitle(s), '知识健康检查')
  })

  it('normalizes and updates bounded execution steps', () => {
    let s = createSession('general', 1)
    s = agentRun.upsertStep(s, {
      id: 'tool_1',
      kind: 'tool',
      title: '搜索知识库',
      status: 'pending',
      toolName: 'search_knowledge',
    })
    s = agentRun.upsertStep(s, {
      id: 'tool_1',
      kind: 'tool',
      title: '搜索知识库',
      status: 'done',
      summary: '命中 2 条',
      toolName: 'search_knowledge',
      durationMs: 42,
    })
    assert.equal(s.run.steps.length, 1)
    assert.equal(s.run.steps[0].status, 'done')
    assert.equal(s.run.steps[0].durationMs, 42)
    assert.equal(s.run.steps[0].summary, '命中 2 条')
  })

  it('health report artifact from lint', () => {
    const art = agentRun.healthReportArtifact({
      healthy: false,
      scanned: 3,
      issues: [{ type: 'empty', path: 'a.md', message: '空' }],
    })
    assert.equal(art.type, 'health_report')
    assert.ok(art.body.includes('empty'))
  })

  it('supports editor_patch and applyLog', () => {
    let s = createSession('general', 1)
    const art = agentRun.editorPatchArtifact({
      body: '新全文',
      mode: 'replace',
      noteId: 'n1',
    })
    assert.equal(art.type, 'editor_patch')
    assert.equal(art.meta.mode, 'replace')
    s = agentRun.addArtifact(s, art)
    assert.equal(s.run.artifacts[0].type, 'editor_patch')
    s = agentRun.recordApply(s, { action: 'insert', detail: '已插入', noteId: 'n1' })
    assert.equal(s.run.applyLog.length, 1)
    assert.equal(s.run.applyLog[0].action, 'insert')
    s = agentRun.setArtifactStatus(s, art.id, 'accepted')
    assert.equal(s.run.artifacts[0].status, 'accepted')
  })

  it('caps applyLog and ignores invalid actions', () => {
    let s = createSession('general', 1)
    s = agentRun.recordApply(s, { action: 'noop', detail: 'x' })
    assert.equal(s.run.applyLog.length, 0)
    for (let i = 0; i < 35; i++) {
      s = agentRun.recordApply(s, { action: 'copy', detail: String(i) })
    }
    assert.equal(s.run.applyLog.length, agentRun.MAX_APPLY_LOG)
  })

  it('persists structured plan separately from steps', () => {
    let s = createSession('general', 1)
    s = agentRun.replacePlan(s, [
      { id: 'p1', title: '搜索资料', status: 'pending' },
      { id: 'p2', title: '汇总结论', status: 'pending' },
    ])
    assert.equal(s.run.plan.items.length, 2)
    assert.equal(agentRun.countPlanRemaining(s.run.plan), 2)
    s = agentRun.setPlanItemStatus(s, 'p1', 'doing')
    s = agentRun.setPlanItemStatus(s, 'p1', 'done', '命中 2 条')
    s = agentRun.upsertPlanItems(s, [{ id: 'p2', title: '汇总结论', status: 'blocked', evidence: '需审批' }])
    assert.equal(s.run.plan.items[0].status, 'done')
    assert.equal(s.run.plan.items[1].status, 'blocked')
    assert.equal(agentRun.countPlanRemaining(s.run.plan), 0)
    const checklist = agentRun.formatPlanChecklist(s.run.plan)
    assert.ok(checklist.includes('[x]'))
    assert.ok(checklist.includes('[!]'))
    s = agentRun.upsertStep(s, { id: 't1', kind: 'tool', title: '搜索', status: 'done' })
    assert.equal(s.run.plan.items.length, 2)
    assert.equal(s.run.steps.length, 1)
  })
})
