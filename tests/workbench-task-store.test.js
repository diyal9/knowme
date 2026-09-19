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

  it('uses a confirmed plan goal instead of a legacy collaboration placeholder', () => {
    const task = normalizeTask({
      goal: '与生图执行专家协作（待填写目标）',
      expertId: 'image-producer',
      brief: {
        goal: '与生图执行专家协作（待填写目标）',
        plan: { goal: '生成一个机器人主题的基础图标（Icon/Logo）。' },
      },
    })

    assert.equal(task.goal, '生成一个机器人主题的基础图标（Icon/Logo）。')
    assert.equal(task.brief.goal, '生成一个机器人主题的基础图标（Icon/Logo）。')
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

  it('persists the execution route on tool evidence for qualification audits', () => {
    const task = normalizeTask({
      goal: '生成图片',
      expertId: 'image-producer',
      executionEvidence: [{
        runId: 'run-1',
        deliverableId: 'generated-image',
        executionRoute: 'pango-generate',
        gateStatus: 'verified',
        verificationPassed: true,
      }],
    })

    assert.equal(task.executionEvidence[0].executionRoute, 'pango-generate')
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
    assert.equal(reviewed.task.events.at(-1).kind, 'review')
    assert.equal(reviewed.task.events.at(-1).source, 'user')
    assert.equal(reviewed.task.events.at(-1).actorId, 'user')
  })

  it('persists generic artifact contracts and all artifact references across reloads', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-artifacts-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成两张候选图',
      expertId: 'third-party-visual-agent',
      brief: {
        deliverables: [{
          id: 'visuals', title: '候选图', type: 'image',
          requiredTools: ['generate_image'],
          requiredArtifacts: [{ type: 'image' }],
          minArtifacts: 2,
          completionConditions: [{ type: 'artifact_present' }],
        }],
      },
      deliverables: [{
        deliverableId: 'visuals', title: '候选图', type: 'image',
        artifactRef: 'session#image-a',
        artifactRefs: ['session#image-a', 'session#image-b'],
      }],
    })

    const reloaded = createStore(file).get(created.task.id).task

    assert.deepEqual(reloaded.deliverables[0].artifactRefs, ['session#image-a', 'session#image-b'])
    assert.deepEqual(reloaded.brief.deliverables[0].requiredTools, ['generate_image'])
    assert.deepEqual(reloaded.brief.deliverables[0].requiredArtifacts, [{ type: 'image' }])
    assert.equal(reloaded.brief.deliverables[0].minArtifacts, 2)
    assert.deepEqual(reloaded.brief.deliverables[0].completionConditions, [{ type: 'artifact_present' }])
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

  it('keeps legacy event and deliverable ordering stable across reloads', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-store-legacy-')), 'tasks.json')
    fs.writeFileSync(file, JSON.stringify({
      version: 2,
      tasks: [{
        id: 'legacy-task',
        goal: '恢复历史记录',
        expertId: 'office-partner',
        events: [{ type: 'task_started', summary: '先理解目标' }, { type: 'progress', summary: '正在处理' }],
        deliverables: [{ deliverableId: 'primary', title: '历史成果' }],
      }],
    }))
    const store = createStore(file)
    const first = store.get('legacy-task').task
    const second = store.get('legacy-task').task

    assert.deepEqual(first.events.map((event) => [event.id, event.createdAt]), second.events.map((event) => [event.id, event.createdAt]))
    assert.deepEqual(first.deliverables.map((item) => [item.deliverableId, item.createdAt]), second.deliverables.map((item) => [item.deliverableId, item.createdAt]))
    assert.equal(first.events[0].createdAt, first.createdAt)
    assert.equal(first.events[1].createdAt > first.events[0].createdAt, true)
  })

  it('adds activity provenance without changing expert and workflow task boundaries', () => {
    const expert = normalizeTask({
      id: 'expert-task',
      expertId: 'office-partner',
      events: [{ type: 'task_started', summary: '专家任务开始' }],
      deliverables: [{ deliverableId: 'primary', title: '同步稿' }],
      executionEvidence: [{ runId: 'run-1' }],
    })
    const workflow = normalizeTask({
      id: 'workflow-task',
      workflowId: 'meeting-notes',
      events: [{ type: 'run_started', summary: '管线任务开始' }],
      deliverables: [{ deliverableId: 'report', title: '报告' }],
    })

    assert.equal(expert.activityContractVersion, 1)
    assert.equal(expert.events[0].source, 'expert')
    assert.equal(expert.events[0].kind, 'event')
    assert.equal(expert.events[0].sequence, 1)
    assert.equal(expert.deliverables[0].source, 'expert')
    assert.equal(expert.deliverables[0].kind, 'deliverable')
    assert.equal(expert.executionEvidence[0].createdAt, expert.createdAt)
    assert.equal(workflow.events[0].source, 'workflow')
    assert.equal(workflow.deliverables[0].source, 'workflow')

    const legacyUserActivity = normalizeTask({
      id: 'legacy-user-activity',
      expertId: 'office-partner',
      events: [
        { type: 'input_provided', summary: '补充材料' },
        { type: 'changes_requested', source: 'system', summary: '请修改' },
      ],
    })
    assert.deepEqual(legacyUserActivity.events.map(event => ({
      type: event.type, kind: event.kind, source: event.source, actorId: event.actorId,
    })), [
      { type: 'input_provided', kind: 'message', source: 'user', actorId: 'user' },
      { type: 'changes_requested', kind: 'review', source: 'user', actorId: 'user' },
    ])
  })

  it('stamps new activity metadata at write time', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-store-activity-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({ goal: '记录新活动', expertId: 'office-partner' })
    const updated = store.appendEvent(created.task.id, { type: 'progress', summary: '已读取材料' })

    assert.equal(updated.ok, true)
    const event = updated.task.events.at(-1)
    assert.equal(event.source, 'expert')
    assert.equal(event.kind, 'event')
    assert.equal(event.sequence, 1)
    assert.ok(event.createdAt)
  })

  it('persists stable project ownership and a bounded run snapshot', () => {
    const task = normalizeTask({
      id: 'task-project',
      projectId: 'project-a',
      projectSnapshot: {
        projectId: 'project-a',
        workspaceSourceId: 'source-a',
        branch: 'main',
        commit: 'abc123',
        repositoryRef: 'group/repo',
        outputPolicy: { deliverablesDir: 'deliverables', conflictStrategy: 'ask' },
      },
    })

    assert.equal(task.projectId, 'project-a')
    assert.equal(task.projectSnapshot.workspaceSourceId, 'source-a')
    assert.equal(task.projectSnapshot.repositoryRef, 'group/repo')
    assert.deepEqual(task.projectSnapshot.outputPolicy, {
      deliverablesDir: 'deliverables',
      conflictStrategy: 'ask',
    })
    assert.ok(task.projectSnapshot.capturedAt)
  })

  it('normalizes qualification identity and labels same-model review as a guardrail', () => {
    const task = normalizeTask({
      id: 'qualification-task',
      expertId: 'solution-architect',
      assignmentSnapshot: {
        agentId: 'solution-architect', agentVersion: '2.0.0', agentHash: 'expert-hash',
        optionalSkillIds: ['optional-review'],
        hashes: { expert: 'expert-hash', skills: { architecture: 'skill-hash' }, connectors: { local: 'connector-hash' } },
      },
      executionEvidence: [{
        runId: 'qualification-run',
        qualificationContext: {
          contractVersion: 1,
          configurationId: 'expert-config-v1:abc',
          complete: true,
          runtime: { hash: 'runtime-hash' },
          agent: { id: 'solution-architect', version: '2.0.0', hash: 'expert-hash' },
          skills: [{ id: 'architecture', hash: 'skill-hash' }],
          connectors: [{ id: 'local', hash: 'connector-hash' }],
          model: { provider: 'dashscope', id: 'qwen3.8-max', requestedId: 'auto', autoRouted: true },
        },
        qualityGuardrail: { mode: 'same_model_guardrail', enabled: true, passed: true, rewritten: false },
      }],
    })

    assert.equal(task.assignmentSnapshot.hashes.skills.architecture, 'skill-hash')
    assert.deepEqual(task.assignmentSnapshot.optionalSkillIds, ['optional-review'])
    assert.equal(task.executionEvidence[0].qualificationContext.complete, true)
    assert.equal(task.executionEvidence[0].qualificationContext.runtime.hash, 'runtime-hash')
    assert.equal(task.executionEvidence[0].qualificationContext.model.id, 'qwen3.8-max')
    assert.equal(task.executionEvidence[0].qualityGuardrail.mode, 'same_model_guardrail')
  })
})
