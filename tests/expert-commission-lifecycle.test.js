const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { projectExpertTaskLifecycle } = require('../src/shared/expert-task-lifecycle')
const agentRun = require('../src/lib/agent-run')

function fixture(t, generate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-commission-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'tasks.json')
  const store = createStore(file)
  const sessions = new Map()
  const payloads = []
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://fixture.invalid' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({
      readSessionSnapshot: () => ({ capabilityManifest: {} }),
      createSessionSnapshot: () => ({ ok: true, snapshot: { capabilityManifest: {} } }),
    }) }),
    ensureAgentSession: id => {
      if (!sessions.has(id)) sessions.set(id, { id, messages: [], run: agentRun.createEmptyRun() })
      return { session: sessions.get(id), sessions: [...sessions.values()] }
    },
    saveAgentSessions: rows => rows.forEach(row => sessions.set(row.id, row)),
    runAgentGenerate: async (_deps, payload) => {
      payloads.push(payload)
      return generate ? generate(payload) : { text: '已基于给定材料交付结果。', runId: payload.runId }
    },
    agentRun,
  })
  return { store, runtime, file, payloads, sessions }
}

async function waitTask(store, id, status) {
  for (let count = 0; count < 150; count++) {
    const task = store.get(id).task
    if (task?.status === status) return task
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail(`expected ${status}, received ${store.get(id).task?.status}`)
}

const brief = { goal: '根据给定材料整理结果', deliverables: [{ id: 'one', type: 'answer', title: '结果', required: true }] }

test('a new commission waits across reload until the user confirms', async t => {
  const f = fixture(t)
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief })
  const task = await waitTask(f.store, created.task.id, 'review')
  assert.equal(task.brief.completionPolicy, 'review')
  assert.equal(task.deliverables[0].acceptanceStatus, 'pending')
  assert.equal(task.lifecycle.phase, 'waiting')
  assert.equal(createStore(f.file).get(task.id).task.status, 'review')
  assert.equal(f.runtime.get(task.id).task.status, 'review')
  assert.equal(f.payloads.length, 1)
  const accepted = f.runtime.reviewDeliverable({ taskId: task.id, deliverableId: 'one', action: 'accept' })
  assert.equal(accepted.task.status, 'completed')
  assert.equal(accepted.task.deliverables[0].acceptanceStatus, 'accepted')
  assert.equal(f.runtime.get(task.id).task.status, 'completed')
})

test('an automatic commission preserves its policy and closes without review', async t => {
  const f = fixture(t)
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief: { ...brief, completionPolicy: 'automatic' } })
  const task = await waitTask(f.store, created.task.id, 'completed')
  assert.equal(task.brief.completionPolicy, 'automatic')
  assert.equal(task.deliverables[0].acceptanceStatus, 'not_required')
  assert.equal(task.events.some(event => event.type === 'automatically_completed'), true)
  assert.equal(f.runtime.get(task.id).task.status, 'completed')
})

test('all required outputs are generated once before awaiting confirmation', async t => {
  const f = fixture(t)
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief: { ...brief,
    deliverables: [...brief.deliverables, { id: 'two', type: 'answer', title: '第二份', required: true }],
  } })
  const task = await waitTask(f.store, created.task.id, 'review')
  assert.equal(f.payloads.length, 2)
  assert.deepEqual(task.deliverables.map(item => item.deliverableId), ['one', 'two'])
  assert.ok(task.deliverables.every(item => item.acceptanceStatus === 'pending'))
  const partial = f.runtime.reviewDeliverable({ taskId: task.id, deliverableId: 'one', action: 'accept' })
  assert.equal(partial.task.status, 'review')
  assert.equal(partial.started, false)
  assert.equal(f.payloads.length, 2)
  const final = f.runtime.reviewDeliverable({ taskId: task.id, deliverableId: 'two', action: 'accept' })
  assert.equal(final.task.status, 'completed')
})

test('legacy automatic closure reopens for confirmation without generating or changing versions', t => {
  const f = fixture(t)
  const old = f.store.create({ kind: 'expert', expertId: 'custom-expert', status: 'completed',
    brief: { ...brief, completionPolicy: 'automatic' },
    deliverables: [{ deliverableId: 'one', type: 'answer', version: 2, acceptanceStatus: 'not_required' }],
  })
  const restored = f.runtime.get(old.task.id).task
  assert.equal(restored.status, 'review')
  assert.equal(restored.deliverables[0].version, 2)
  assert.equal(restored.deliverables[0].acceptanceStatus, 'pending')
  assert.equal(f.runtime.get(old.task.id).task.events.filter(event => event.type === 'review_restored').length, 1)
  assert.equal(f.payloads.length, 0)
})

test('explicit human review remains waiting until accepted', async t => {
  const f = fixture(t)
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief: { ...brief, completionPolicy: 'review' } })
  const task = await waitTask(f.store, created.task.id, 'review')
  assert.equal(task.lifecycle.phase, 'waiting')
  assert.equal(task.lifecycle.waitingReason, 'review')
  assert.equal(task.deliverables[0].acceptanceStatus, 'pending')
  const reviewed = f.runtime.reviewDeliverable({ taskId: task.id, deliverableId: 'one', action: 'accept' })
  assert.equal(reviewed.task.status, 'completed')
  assert.equal(reviewed.task.deliverables[0].acceptanceStatus, 'accepted')
})

test('missing execution evidence remains waiting and cannot automatically end', async t => {
  const f = fixture(t, payload => ({ text: '暂时无法读取。', runId: payload.runId,
    executionEvidence: { gateStatus: 'blocked', verificationPassed: false, violations: [{ code: 'missing_required_tools', tool: 'read' }] },
  }))
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief })
  const task = await waitTask(f.store, created.task.id, 'needs_input')
  assert.equal(task.lifecycle.terminal, false)
  assert.equal(task.deliverables.length, 0)
})

test('artifact-backed delivery is invalidated when its persisted artifact is missing or unreadable', t => {
  const f = fixture(t)
  const sessionId = 'session-artifact-check'
  f.sessions.set(sessionId, { id: sessionId, messages: [], run: { ...agentRun.createEmptyRun(), artifacts: [{ id: 'empty-file', type: 'file' }] } })
  const created = f.store.create({
    kind: 'expert', expertId: 'custom-expert', status: 'review', execRef: { kind: 'session', id: sessionId },
    brief: { goal: '生成文件', completionPolicy: 'review', deliverables: [{
      id: 'one', type: 'file', title: '结果文件', required: true, minArtifacts: 1,
      completionConditions: [{ type: 'artifact_present' }],
    }] },
    deliverables: [{ deliverableId: 'one', type: 'file', title: '结果文件', version: 1,
      artifactRef: `${sessionId}#empty-file`, artifactRefs: [`${sessionId}#empty-file`], acceptanceStatus: 'pending' }],
  })
  const reconciled = f.runtime.get(created.task.id).task
  assert.equal(reconciled.status, 'needs_input')
  assert.equal(reconciled.deliverables[0].evidenceStatus, 'blocked')
})

test('failed commission ends incomplete and explicit retry creates a linked commission', async t => {
  let failed = true
  const f = fixture(t, () => { if (failed) throw new Error('fixture unavailable'); return { text: '恢复后的结果' } })
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief })
  const old = await waitTask(f.store, created.task.id, 'failed')
  assert.equal(old.lifecycle.outcome, 'incomplete')
  failed = false
  const retried = await f.runtime.retry(old.id)
  assert.notEqual(retried.task.id, old.id)
  assert.equal(retried.task.taskRef.id, old.id)
  await waitTask(f.store, retried.task.id, 'review')
  assert.equal(f.store.get(old.id).task.status, 'failed')
})

test('single lifecycle projects waiting reasons and all three end outcomes', () => {
  for (const status of ['completed', 'failed', 'cancelled']) assert.equal(projectExpertTaskLifecycle({ status }).phase, 'ended')
  assert.equal(projectExpertTaskLifecycle({ status: 'needs_input', attention: { kind: 'approval_required' } }).waitingReason, 'approval')
  assert.equal(projectExpertTaskLifecycle({ status: 'draft' }).phase, 'pending')
  assert.equal(projectExpertTaskLifecycle({ status: 'running' }).phase, 'executing')
})


test('adjusting a result creates a new version and still requires user confirmation', async t => {
  const f = fixture(t)
  const created = await f.runtime.createStart({ expertId: 'custom-expert', brief })
  const first = await waitTask(f.store, created.task.id, 'review')
  const requested = f.runtime.reviewDeliverable({ taskId: first.id, deliverableId: 'one', action: 'changes_requested', comment: '补充细节' })
  assert.equal(requested.started, true)
  const revised = await waitTask(f.store, first.id, 'review')
  assert.equal(revised.deliverables[0].version, 2)
  assert.equal(revised.deliverables[0].acceptanceStatus, 'pending')
  assert.equal(f.runtime.reviewDeliverable({ taskId: first.id, deliverableId: 'one', action: 'accept' }).task.status, 'completed')
})
