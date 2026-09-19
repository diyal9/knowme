'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore, normalizeTask } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const agentRun = require('../src/lib/agent-run')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa29-'))
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    assert.ok(path.basename(root).startsWith('knowme-rqa29-'))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const file = path.join(root, 'tasks.json')
  return { file, store: createStore(file) }
}

it('preserves a long goal and plan through creation, unrelated update and reload', t => {
  const { store, file } = fixture(t)
  const goal = '完整合成材料。'.repeat(700) + '\n末尾要求：禁止外发；仅修改参数。'
  const created = store.create({ expertId: 'generic', goal, title: '标题'.repeat(100),
    brief: { goal, plan: { goal, steps: ['只处理给定材料'] } }, resultSummary: '概'.repeat(400) })
  assert.equal(created.ok, true)
  assert.equal(created.task.goal, goal)
  assert.equal(created.task.brief.plan.goal, goal)
  assert.equal(created.task.title.length, 160)
  assert.equal(created.task.resultSummary.length, 280)
  assert.equal(store.update(created.task.id, { status: 'needs_input' }).ok, true)
  const loaded = createStore(file).get(created.task.id).task
  assert.equal(loaded.goal, goal)
  assert.equal(loaded.brief.plan.goal, goal)
})

it('rejects oversized goal/plan submissions atomically, never storing a prefix', t => {
  const { store } = fixture(t)
  const oversized = '长'.repeat(32001)
  const invalid = store.create({ goal: oversized })
  assert.equal(invalid.ok, false)
  assert.equal(invalid.code, 'task_input_too_long')
  assert.equal(store.list().tasks.length, 0)
  const created = store.create({ goal: '原任务', status: 'review' })
  const before = store.get(created.task.id).task
  const rejected = store.update(created.task.id, { status: 'starting', brief: { goal: '短目标', plan: { goal: oversized } } })
  assert.equal(rejected.ok, false)
  assert.deepEqual(store.get(created.task.id).task, before)
})

it('keeps complete review feedback and rejects an over-limit review without changing acceptance', t => {
  const { store, file } = fixture(t)
  const created = store.create({ goal: '修订', status: 'review', deliverables: [
    { deliverableId: 'primary', version: 1, acceptanceStatus: 'pending' },
  ] })
  const feedback = '修改说明。'.repeat(350) + '\n最后要求：不得自动发布。'
  const reviewed = store.reviewDeliverable(created.task.id, 'primary', { action: 'changes_requested', comment: feedback })
  assert.equal(reviewed.ok, true)
  assert.equal(createStore(file).get(created.task.id).task.deliverables[0].comments.at(-1).body, feedback)
  const before = store.get(created.task.id).task
  const rejected = store.reviewDeliverable(created.task.id, 'primary', { action: 'accept', comment: '长'.repeat(8001) })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.code, 'task_input_too_long')
  assert.deepEqual(store.get(created.task.id).task, before)
})

it('never re-truncates already stored canonical goal or comments during normalization', () => {
  const goal = '旧'.repeat(32001) + 'LEGACY_END'
  const body = '评'.repeat(8001) + 'COMMENT_END'
  const normalized = normalizeTask({ goal, deliverables: [{ comments: [{ body }] }] })
  assert.equal(normalized.goal, goal)
  assert.equal(normalized.deliverables[0].comments[0].body, body)
})

it('createStart rejects invalid input before snapshot, session or execution side effects', async t => {
  const { store } = fixture(t)
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store,
    ensureAgentSession: () => { throw new Error('must not enter session setup') },
  })
  const result = await runtime.createStart({ expertId: 'generic', goal: '长'.repeat(32001) })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'task_input_too_long')
  assert.equal(store.list().tasks.length, 0)
})

it('createStart preserves the full confirmed goal before entering a legitimate input wait', async t => {
  const { store, file } = fixture(t)
  const goal = '背景。'.repeat(1000) + '\n只分析，不生成或外发。'
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store,
    ensureAgentSession: () => ({ session: { id: 'rqa29-create' }, sessions: [] }), saveAgentSessions: () => {},
    ensureCapabilityHub: () => ({ expertRuntime: () => ({
      createSessionSnapshot: () => ({ ok: true, snapshot: {} }), readSessionSnapshot: () => ({}),
    }) }),
  })
  const result = await runtime.createStart({ expertId: 'generic', goal: '与某专家协作（待填写目标）',
    brief: { plan: { goal, steps: ['分析材料'] }, requiresMaterials: true },
  })
  assert.equal(result.ok, true)
  assert.equal(result.started, false)
  assert.equal(result.task.status, 'needs_input')
  assert.equal(result.task.goal, goal)
  assert.equal(result.task.assignmentSnapshot.plan.goal, goal)
  assert.equal(createStore(file).get(result.task.id).task.goal, goal)
  assert.equal(runtime.get(result.task.id).task.goal, goal)
})

it('rejects non-text goal and comment rather than coercing them into instructions', t => {
  const { store } = fixture(t)
  assert.equal(store.create(null).ok, false)
  assert.equal(store.create({ goal: { command: 'not text' } }).ok, false)
  assert.equal(store.create({ goal: '任务', deliverables: [{ comments: [{ body: { command: 'not text' } }] }] }).ok, false)
  assert.equal(store.list().tasks.length, 0)
})

it('reading a canonical long goal twice does not rewrite the task', () => {
  const goal = '长'.repeat(3000) + 'TAIL'
  const task = normalizeTask({ id: 'rqa29-memory-only', kind: 'expert', expertId: 'generic', goal,
    brief: { goal }, deliverables: [], execRef: { kind: 'session', id: 'rqa29-read' } })
  const writes = []
  const store = { get: () => ({ ok: true, task }), update: (_id, patch) => {
    writes.push(patch)
    return { ok: true, task }
  } }
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({}) }) }),
  })
  assert.equal(runtime.get(task.id).task.goal, goal)
  assert.equal(runtime.get(task.id).task.goal, goal)
  assert.deepEqual(writes, [], 'read-only reconciliation must not keep migrating an unchanged goal')
})

it('real store to runtime revision preserves goal and the last feedback prohibition', async t => {
  const { store, file } = fixture(t)
  const goal = '任务材料。'.repeat(600) + '\nGOAL_END：不得外发。'
  const feedback = '更正理由。'.repeat(300) + '\nFEEDBACK_END：禁止重试，必须先征求同意。'
  const created = store.create({ expertId: 'generic', goal, status: 'review',
    brief: { goal, deliverables: [{ id: 'primary', type: 'answer', title: '答复' }] },
    execRef: { kind: 'session', id: 'rqa29-session' },
    deliverables: [{ deliverableId: 'primary', version: 1, artifactRef: 'rqa29-session#v1' }],
  })
  assert.equal(store.reviewDeliverable(created.task.id, 'primary', { action: 'changes_requested', comment: feedback }).ok, true)
  const reopened = createStore(file)
  let session = { id: 'rqa29-session', messages: [], run: { ...agentRun.createEmptyRun(), artifacts: [{ id: 'v1', type: 'document', body: '原稿' }] } }
  let payload
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => reopened,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }), normalizeChatEndpoint: x => x,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({}) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }), saveAgentSessions: items => { session = items[0] },
    runAgentGenerate: async (_deps, input) => { payload = input; return { runId: input.runId, text: '离线夹具答复',
      executionEvidence: { gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [] } } }, agentRun,
  })
  await runtime.execute(created.task.id)
  assert.ok(payload)
  assert.ok(payload.prompt.includes(goal), 'complete goal must reach execution')
  assert.ok(payload.prompt.includes(feedback), 'complete saved feedback must reach execution')
  assert.equal(reopened.get(created.task.id).task.goal, goal)
})
