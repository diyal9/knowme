const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  normalizeTask,
  normalizeExecRef,
  normalizeKnowledgeRefs,
  createStore,
} = require('../src/lib/workbench-task-store')

describe('workbench task store', () => {
  it('normalizes taskRef, knowledgeRefs and session execRef', () => {
    const task = normalizeTask({
      id: 'task-1',
      goal: '整理资料',
      expertId: 'writer',
      workflowId: 'meeting-notes',
      workflowName: '会议纪要与待办',
      taskRef: { id: 'task-1', extra: 'ignored' },
      knowledgeRefs: [{ id: 'local-default' }, { id: 'local-default' }, { id: 'kp_a' }],
      execRef: { kind: 'session', id: 'session_abc' },
    })
    assert.deepEqual(task.taskRef, { id: 'task-1' })
    assert.deepEqual(task.knowledgeRefs, [{ id: 'local-default' }, { id: 'kp_a' }])
    assert.deepEqual(task.execRef, { kind: 'session', id: 'session_abc' })
    assert.equal(task.workflowId, 'meeting-notes')
    assert.equal(task.workflowName, '会议纪要与待办')
    assert.equal(task.resultSummary, '')
    assert.equal(normalizeExecRef(null).kind, 'none')
  })

  it('normalizes optional resultSummary for task cards', () => {
    const task = normalizeTask({
      goal: '整理资料',
      resultSummary: '已写出纪要草稿与 3 条待办',
    })
    assert.equal(task.resultSummary, '已写出纪要草稿与 3 条待办')
    assert.equal(normalizeTask({ resultSummary: 'x'.repeat(400) }).resultSummary.length, 280)
  })

  it('persists knowledgeRefs, workflowId and execRef through create/update', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-store-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '专家任务',
      expertId: 'dev',
      workflowId: 'office-meeting',
      workflowName: '会议纪要与待办',
      knowledgeRefs: [{ id: 'kp_remote' }],
    })
    assert.equal(created.ok, true)
    assert.deepEqual(created.task.knowledgeRefs, [{ id: 'kp_remote' }])
    assert.equal(created.task.workflowId, 'office-meeting')
    assert.equal(created.task.workflowName, '会议纪要与待办')

    const updated = store.update(created.task.id, {
      execRef: { kind: 'session', id: 'session_xyz' },
      knowledgeRefs: [{ id: 'local-default' }],
      status: 'running',
    })
    assert.equal(updated.ok, true)
    assert.deepEqual(updated.task.execRef, { kind: 'session', id: 'session_xyz' })
    assert.deepEqual(updated.task.knowledgeRefs, [{ id: 'local-default' }])
    assert.equal(updated.task.workflowId, 'office-meeting')

    const listed = store.list()
    assert.equal(listed.tasks.length, 1)
    assert.deepEqual(listed.tasks[0].knowledgeRefs, [{ id: 'local-default' }])
    assert.equal(normalizeKnowledgeRefs(Array.from({ length: 20 }, (_, i) => ({ id: `kp_${i}` }))).length, 16)
  })

  it('persists schedule fields and clears nextRunAt when disabled', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-sched-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '每日简报',
      expertId: 'writer',
      scheduleEnabled: true,
      schedule: { type: 'daily', dailyTime: '08:30' },
    })
    assert.equal(created.ok, true)
    assert.equal(created.task.scheduleEnabled, true)
    assert.equal(created.task.schedule.dailyTime, '08:30')
    assert.equal(created.task.scheduleLabel, '每天 08:30')
    assert.ok(created.task.nextRunAt)

    const disabled = store.update(created.task.id, { scheduleEnabled: false })
    assert.equal(disabled.ok, true)
    assert.equal(disabled.task.scheduleEnabled, false)
    assert.equal(disabled.task.nextRunAt, '')
    assert.equal(disabled.task.scheduleLabel, '')

    const child = store.create({
      goal: '每日简报 · 定时执行',
      expertId: 'writer',
      scheduleParentId: created.task.id,
    })
    assert.equal(child.task.scheduleParentId, created.task.id)
  })

  it('records revision feedback and moves a reviewed deliverable back to expert work', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-review-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '整理飞书消息',
      expertId: 'office-partner',
      status: 'review',
      deliverables: [{
        deliverableId: 'primary',
        title: '可直接审阅的同步稿',
        type: 'document',
        version: 1,
        required: true,
        artifactRef: 'session-1#artifact-v1',
        acceptanceStatus: 'pending',
      }],
    })

    const reviewed = store.reviewDeliverable(created.task.id, 'primary', {
      action: 'changes_requested',
      actorId: 'user',
      comment: '请补充每条消息的负责人和截止时间。',
    })

    assert.equal(reviewed.ok, true)
    assert.equal(reviewed.task.status, 'revising')
    assert.equal(reviewed.task.deliverables[0].acceptanceStatus, 'changes_requested')
    assert.equal(reviewed.task.deliverables[0].comments.at(-1).authorId, 'user')
    assert.equal(reviewed.task.deliverables[0].comments.at(-1).body, '请补充每条消息的负责人和截止时间。')
    assert.equal(reviewed.task.events.at(-1).type, 'changes_requested')
  })

  it('reopens legacy completed tasks when required deliverables are missing', () => {
    const task = normalizeTask({
      goal: '先预览再执行导入',
      expertId: 'external-capability-importer',
      status: 'completed',
      brief: {
        goal: '先预览再执行导入',
        deliverables: [
          { id: 'preview', title: '导入预览', required: true },
          { id: 'result', title: '导入与验证结果', required: true },
        ],
      },
      deliverables: [{
        deliverableId: 'preview',
        title: '导入预览',
        acceptanceStatus: 'accepted',
      }],
    })

    assert.equal(task.status, 'needs_input')
  })
})
