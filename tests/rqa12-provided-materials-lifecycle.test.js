'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')
const { validateProvidedMaterials } = require('../src/lib/provided-materials')
const agentRun = require('../src/lib/agent-run')

const ORIGINAL = '用户原始材料：R1负责人待确认，截止时间周五。'
const SUPPLEMENT = '用户排队补充：R1负责人为小林，截止时间仍为周五。'
const ATTACHMENT = '用户附件材料：R2仅为建议，尚未批准。'
const FEEDBACK = 'REVISION_INSTRUCTION：保留待确认项，不把建议写成已批准。'
const FORBIDDEN = /SYSTEM_ONLY|SOP_ONLY|OLD_HISTORY|OLD_ARTIFACT|GENERATED_BODY|REVISION_INSTRUCTION/
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex')

async function waitFor(predicate, label) {
  const deadline = Date.now() + 2000
  do {
    const result = predicate()
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, 10))
  } while (Date.now() < deadline)
  assert.fail(`Lifecycle did not reach ${label}`)
}

// Real disk-backed task store, runtime transitions and artifact persistence.
// Only generation/settings/session/capability I/O are fixture dependencies;
// this deliberately does not claim real prepare, GROUND or model coverage.
function fixture(t, generate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa12-lifecycle-'))
  const store = createStore(path.join(dir, 'tasks.json'))
  const created = store.create({ expertId: 'generic-reviewer', status: 'starting', goal: '静态评审',
    execRef: { kind: 'session', id: 'lifecycle-session' },
    brief: { goal: '静态评审', materials: [{ id: 'M1', title: '原始材料', content: ORIGINAL }],
      deliverables: [{ id: 'primary', type: 'answer', title: '评审', required: true }] },
  })
  assert.equal(created.ok, true)
  const taskId = created.task.id
  let session = { id: 'lifecycle-session',
    messages: [{ role: 'assistant', runId: 'old-run', text: 'OLD_HISTORY' }],
    run: { ...agentRun.createEmptyRun(), artifacts: [{ id: 'old', body: 'OLD_ARTIFACT' }] } }
  const calls = []
  const releases = []
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://no-network.invalid' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({
      persona: { systemPrompt: 'SYSTEM_ONLY', sop: 'SOP_ONLY' }, capabilityManifest: {},
    }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: sessions => { session = sessions[0] },
    runAgentGenerate: async (_deps, payload) => {
      calls.push(payload)
      return generate(payload, calls.length)
    },
    agentRun,
  })
  t.after(async () => {
    if (runtime.controllers.has(taskId)) runtime.cancel(taskId)
    releases.forEach(release => release())
    await waitFor(() => !runtime.controllers.has(taskId), 'fixture idle before cleanup')
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return { runtime, store, taskId, calls, session: () => session,
    task: () => store.get(taskId).task,
    gate: () => {
      let release
      const promise = new Promise(resolve => { release = resolve })
      releases.push(release)
      return { promise, release }
    },
    settled: status => waitFor(() => {
      const task = store.get(taskId).task
      return !runtime.controllers.has(taskId) && task.status === status ? task : null
    }, `idle ${status}`),
  }
}

function success(payload, number) {
  return { runId: payload.runId, text: `GENERATED_BODY_${number}：静态评审正文。`,
    executionEvidence: { gateStatus: 'not_required', verificationPassed: true,
      toolCalls: [], evidence: [], violations: [] } }
}

function assertSnapshot(payload, taskId, expectedTexts) {
  assert.equal(payload.workbenchTaskId, taskId)
  assert.equal(payload.taskRef.id, taskId)
  const snapshot = validateProvidedMaterials(payload.providedMaterials, { taskId, runId: payload.runId })
  assert.ok(snapshot)
  assert.deepEqual(snapshot.items.map(item => item.text), expectedTexts)
  assert.doesNotMatch(JSON.stringify(snapshot), FORBIDDEN)
  assert.ok(Object.isFrozen(payload.providedMaterials))
  assert.ok(Object.isFrozen(payload.providedMaterials.items))
  for (const item of snapshot.items) {
    assert.equal(item.contentHash, hash(item.text))
    assert.equal(item.origin, 'user_material')
    assert.equal(item.completeness, 'unknown')
    assert.equal(item.source, undefined)
    assert.equal(item.status, undefined)
    assert.ok(Object.isFrozen(item))
  }
  return snapshot
}

function assertRebound(before, after, taskId) {
  assert.notEqual(before.runId, after.runId, 'a lifecycle transition must start a new run')
  assert.notEqual(before.providedMaterials.snapshotHash, after.providedMaterials.snapshotHash)
  assert.equal(before.providedMaterials.items[0].contentHash, after.providedMaterials.items[0].contentHash)
  assert.throws(() => validateProvidedMaterials(before.providedMaterials,
    { taskId, runId: after.runId }), { code: 'provided_materials_invalid' })
  assert.throws(() => validateProvidedMaterials(after.providedMaterials,
    { taskId: `${taskId}-other`, runId: after.runId }), { code: 'provided_materials_invalid' })
}

it('real provideInput queues material without mutating the active snapshot, then binds the next run', async t => {
  let firstGate
  let secondGate
  const f = fixture(t, async (payload, number) => {
    assert.ok(number <= 2, 'queued input must be consumed exactly once')
    await (number === 1 ? firstGate.promise : secondGate.promise)
    return success(payload, number)
  })
  firstGate = f.gate()
  secondGate = f.gate()
  const firstExecution = f.runtime.execute(f.taskId)
  await waitFor(() => f.calls.length === 1, 'first generation entry')
  const first = f.calls[0]
  const frozenFirst = JSON.stringify(assertSnapshot(first, f.taskId, [ORIGINAL]))
  const queued = f.runtime.provideInput({ taskId: f.taskId, queue: true, note: SUPPLEMENT,
    materials: [{ id: 'M2', title: '补充附件', content: ATTACHMENT }] })
  assert.equal(queued.ok, true)
  assert.equal(queued.queued, true)
  assert.equal(queued.started, false)
  assert.equal(f.calls.length, 1)
  assert.equal(f.task().inputQueue.pending, true)
  assert.equal(f.task().events.at(-1).type, 'input_queued')
  assert.deepEqual(f.task().brief.materials.map(item => item.content), [ORIGINAL, ATTACHMENT, SUPPLEMENT])
  assert.equal(JSON.stringify(first.providedMaterials), frozenFirst)

  firstGate.release()
  await firstExecution
  await waitFor(() => f.calls.length === 2, 'queued generation entry')
  const second = f.calls[1]
  assertSnapshot(second, f.taskId, [ORIGINAL, ATTACHMENT, SUPPLEMENT])
  assertRebound(first, second, f.taskId)
  assert.equal(JSON.stringify(first.providedMaterials), frozenFirst)
  assert.equal(f.task().inputQueue, null)
  assert.equal(f.task().events.filter(item => item.type === 'queued_input_applied').length, 1)
  secondGate.release()
  const completed = await f.settled('review')
  assert.equal(f.calls.length, 2)
  assert.equal(completed.executionEvidence.at(-1).runId, second.runId)
  assert.equal(completed.inputQueue, null)
})

it('real review revision includes new text attachments but not feedback, prior artifacts or SOP as material', async t => {
  const f = fixture(t, async (payload, number) => success(payload, number))
  await f.runtime.execute(f.taskId)
  const v1 = await f.settled('review')
  const oldArtifactRef = v1.deliverables[0].artifactRef
  assertSnapshot(f.calls[0], f.taskId, [ORIGINAL])
  const reviewed = f.runtime.reviewDeliverable({ taskId: f.taskId, deliverableId: 'primary',
    action: 'changes_requested', comment: FEEDBACK,
    attachments: [{ kind: 'text', name: '新增事实.txt', text: ATTACHMENT }] })
  assert.equal(reviewed.ok, true)
  assert.equal(reviewed.started, true)
  const v2 = await f.settled('review')
  assert.equal(f.calls.length, 2)
  assertSnapshot(f.calls[1], f.taskId, [ORIGINAL, ATTACHMENT])
  assertRebound(f.calls[0], f.calls[1], f.taskId)
  assert.match(f.calls[1].prompt, /GENERATED_BODY_1/)
  assert.match(f.calls[1].prompt, /REVISION_INSTRUCTION/)
  assert.match(f.calls[1].prompt, /SOP_ONLY/)
  assert.equal(v2.deliverables[0].version, 2)
  assert.notEqual(v2.deliverables[0].artifactRef, oldArtifactRef)
  assert.equal(v2.deliverables[0].executionRef, `agent-run:${f.calls[1].runId}`)
  assert.ok(f.session().run.artifacts.some(item => oldArtifactRef.endsWith(`#${item.id}`)))
  assert.equal(v2.deliverables[0].comments.at(-1).body, FEEDBACK)
})

it('failed revision followed by real retry rebinds the same materials and preserves v1 plus feedback', async t => {
  const f = fixture(t, async (payload, number) => number === 2
    ? { runId: payload.runId, error: '连接超时：隔离测试注入，不涉及真实请求' }
    : success(payload, number))
  await f.runtime.execute(f.taskId)
  const v1 = await f.settled('review')
  const oldArtifactRef = v1.deliverables[0].artifactRef
  const artifactCount = f.session().run.artifacts.length
  const reviewed = f.runtime.reviewDeliverable({ taskId: f.taskId, deliverableId: 'primary',
    action: 'changes_requested', comment: FEEDBACK,
    attachments: [{ kind: 'text', name: '新增事实.txt', text: ATTACHMENT }] })
  assert.equal(reviewed.started, true)
  const failed = await f.settled('failed')
  assert.equal(failed.attention.action, 'retry')
  assert.equal(failed.deliverables[0].version, 1)
  assert.equal(failed.deliverables[0].artifactRef, oldArtifactRef)
  assert.equal(f.session().run.artifacts.length, artifactCount)
  assertSnapshot(f.calls[1], f.taskId, [ORIGINAL, ATTACHMENT])
  assertRebound(f.calls[0], f.calls[1], f.taskId)

  const retried = f.runtime.retry(f.taskId)
  assert.equal(retried.ok, true)
  assert.equal(retried.started, true)
  const v2 = await f.settled('review')
  assert.equal(f.calls.length, 3)
  assertSnapshot(f.calls[2], f.taskId, [ORIGINAL, ATTACHMENT])
  assertRebound(f.calls[1], f.calls[2], f.taskId)
  assert.deepEqual(f.calls[2].providedMaterials.items, f.calls[1].providedMaterials.items)
  assert.match(f.calls[2].prompt, /GENERATED_BODY_1/)
  assert.match(f.calls[2].prompt, /REVISION_INSTRUCTION/)
  assert.doesNotMatch(f.calls[2].prompt, /GENERATED_BODY_2/)
  assert.equal(v2.deliverables[0].version, 2)
  assert.equal(v2.deliverables[0].comments.at(-1).body, FEEDBACK)
  assert.equal(v2.deliverables[0].executionRef, `agent-run:${f.calls[2].runId}`)
  assert.equal(f.session().run.artifacts.length, artifactCount + 1)
  assert.equal(v2.events.filter(item => item.type === 'retried').length, 1)
})
