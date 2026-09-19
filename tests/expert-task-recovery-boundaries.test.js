const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const agentRun = require('../src/lib/agent-run')
const { MAX_EXPERT_IMAGE_BYTES } = require('../src/lib/expert-task-input')

function fixture(t, patch = {}, generate = async () => ({ text: '已整理材料' })) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-recovery-boundary-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'tasks.json')
  const store = createStore(file)
  const created = store.create({ kind: 'expert', expertId: 'fixture-expert', status: 'starting',
    goal: '整理材料', brief: { goal: '整理材料', materials: [], deliverables: [{ id: 'primary', type: 'answer' }] },
    execRef: { kind: 'session', id: 'session-fixture' }, ...patch })
  let session = { id: 'session-fixture', messages: [], run: agentRun.createEmptyRun() }
  const calls = []
  const deps = {
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://fixture.test' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: sessions => { session = sessions[0] },
    runAgentGenerate: async (...args) => { calls.push(args[1]); return generate(...args) }, agentRun,
  }
  return { store, file, id: created.task.id, calls, runtime: createExpertTaskRuntime(deps), deps }
}

async function settled(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail('runtime did not settle')
}

for (const materials of [[{}], [null], [{ kind: 'image', dataUrl: 'data:image/png;base64,' }],
  [{ title: 'empty', content: ' ' }], [{ path: 'C:\\private\\file.txt' }],
  [{ content: 'x'.repeat(8001) }], [{ content: 'valid' }, { kind: 'image', dataUrl: 'invalid' }], {}]) {
  it(`rejects the entire queued text/attachment batch: ${JSON.stringify(materials).slice(0, 90)}`, t => {
    const f = fixture(t, { status: 'running' })
    f.runtime.controllers.set(f.id, new AbortController())
    const before = fs.readFileSync(f.file, 'utf8')
    const result = f.runtime.provideInput({ taskId: f.id, note: '正文也不得部分提交', materials, queue: true })
    assert.equal(result.ok, false)
    assert.equal(fs.readFileSync(f.file, 'utf8'), before)
    assert.equal(f.calls.length, 0)
  })
}

it('rejects an image that bypasses the renderer and exceeds the host byte budget', t => {
  const f = fixture(t, { status: 'running' })
  f.runtime.controllers.set(f.id, new AbortController())
  const oversized = Buffer.alloc(MAX_EXPERT_IMAGE_BYTES + 1).toString('base64')
  const result = f.runtime.provideInput({ taskId: f.id, materials: [{
    kind: 'image', title: 'oversized.png', dataUrl: `data:image/png;base64,${oversized}`,
  }], queue: true })
  assert.equal(result.ok, false)
  assert.match(result.error, /10 MB/)
})

it('rejects overflowing batches instead of dropping new text or attachments at the store limit', t => {
  const f = fixture(t, { status: 'running', brief: { goal: '整理材料', materials: Array.from({ length: 31 }, (_, i) => ({ content: `旧材料${i}` })) } })
  f.runtime.controllers.set(f.id, new AbortController())
  const before = fs.readFileSync(f.file, 'utf8')
  assert.equal(f.runtime.provideInput({ taskId: f.id, note: '新增文字', materials: [{ content: '新增附件' }] }).ok, false)
  assert.equal(fs.readFileSync(f.file, 'utf8'), before)
})

it('persists queued text and image together and reloads both from disk', t => {
  const f = fixture(t, { status: 'running' })
  f.runtime.controllers.set(f.id, new AbortController())
  const image = { kind: 'image', title: '示意图', dataUrl: 'data:image/png;base64,ZmFrZQ==' }
  assert.equal(f.runtime.provideInput({ taskId: f.id, note: '保持原比例', materials: [image] }).queued, true)
  const saved = createStore(f.file).get(f.id).task
  assert.equal(saved.inputQueue.count, 1)
  assert.equal(saved.brief.materials[0].dataUrl, image.dataUrl)
  assert.equal(saved.brief.materials[1].content, '保持原比例')
})

for (const action of ['provide_input', 'reroute', 'open_capability', 'open_settings', 'retry']) {
  it(`a new ${action} checkpoint stops a previously queued supplement and survives restart`, async t => {
    let finish
    const blocked = new Promise(resolve => { finish = resolve })
    const f = fixture(t, {}, async () => blocked)
    const run = f.runtime.execute(f.id)
    await settled(() => f.calls.length === 1)
    f.runtime.provideInput({ taskId: f.id, note: '这是问题出现前的补充' })
    finish({ text: '请选择下一步', attention: { kind: 'missing_information', action, question: '选择新的目标对象', options: ['甲', '乙'] } })
    const result = await run
    assert.equal(result.task.status, 'needs_input')
    assert.equal(f.calls.length, 1)
    const restarted = createExpertTaskRuntime({ ...f.deps, getWorkbenchTaskStore: () => createStore(f.file) })
    assert.deepEqual((await restarted.recoverQueuedTasks()).recovered, [])
    assert.equal(f.store.get(f.id).task.attention.action, action)
    assert.equal(f.store.get(f.id).task.inputQueue.pending, true)
    assert.equal(f.calls.length, 1)
  })
}

it('restart does not auto-accept or replace a pending review with queued work', async t => {
  const f = fixture(t, { status: 'review', inputQueue: { pending: true, count: 1 } })
  assert.deepEqual((await f.runtime.recoverQueuedTasks()).recovered, [])
  assert.equal(f.store.get(f.id).task.status, 'review')
  assert.equal(f.calls.length, 0)
})

it('an explicit answer consumes the saved queue once, without an extra replay', async t => {
  const f = fixture(t, { status: 'needs_input', inputQueue: { pending: true, count: 1 },
    attention: { kind: 'missing_information', action: 'provide_input', question: '需要哪个团队？' } })
  const result = f.runtime.provideInput({ taskId: f.id, note: '使用设计团队的材料' })
  assert.equal(result.ok, true)
  await settled(() => !f.runtime.controllers.has(f.id))
  assert.equal(f.calls.length, 1)
  assert.equal(f.store.get(f.id).task.inputQueue, null)
})

for (const attention of [{ kind: 'missing_information', action: 'reroute' }, { kind: 'operation_status_unknown', action: 'retry' },
  { kind: 'approval_required', action: 'retry' }]) {
  it(`retry cannot bypass ${attention.kind}/${attention.action}`, t => {
    const f = fixture(t, { status: 'needs_input', attention })
    const before = fs.readFileSync(f.file, 'utf8')
    assert.equal(f.runtime.retry(f.id).ok, false)
    assert.equal(fs.readFileSync(f.file, 'utf8'), before)
  })
}

it('persists the exact operation checkpoint identity through execution and cold reload', async t => {
  const f = fixture(t, {}, async () => ({ text: '等待批准',
    attention: { kind: 'approval_required', action: 'provide_input', draftId: 'operation-one', runId: 'original-run' } }))
  const result = await f.runtime.execute(f.id)
  assert.equal(result.task.status, 'needs_input')
  const saved = createStore(f.file).get(f.id).task
  assert.equal(saved.attention.draftId, 'operation-one')
  assert.equal(saved.attention.runId, 'original-run')
  assert.equal(f.runtime.retry(f.id).ok, false)
  assert.equal(f.runtime.provideInput({ taskId: f.id, note: '批准' }).ok, false)
  assert.equal(f.calls.length, 1)
})

it('persists concise progress without diagnostics and avoids identical event spam', async t => {
  const f = fixture(t, {}, async (_deps, _payload, { emit }) => {
    for (let i = 0; i < 8; i++) emit({ type: 'tool.started', payload: {
      title: '读取资料', summary: 'Authorization: Bearer fixture-private-secret',
    } })
    const current = f.store.get(f.id).task
    assert.equal(current.progress.label, '读取资料')
    assert.doesNotMatch(JSON.stringify(current.progress), /fixture-private-secret|Authorization/)
    assert.equal(current.events.filter(item => item.type === 'tool_progress').length, 1)
    emit({ type: 'tool.started', payload: { title: '{"token":"fixture-private-secret"}' } })
    assert.equal(f.store.get(f.id).task.progress.label, '工具正在执行')
    return { text: '已整理材料' }
  })
  await f.runtime.execute(f.id)
})

it('stores only the safe diagnostic projection without changing conversation messages', async t => {
  const f = fixture(t, {}, async (_deps, _payload, { emit }) => {
    emit({ title: '准备完成', contextInfo: { toolRuntime: { toolCount: 25, rawBody: 'private-source' } } })
    return { text: '已整理材料', metrics: { toolSurface: { available: 25, loaded: 1, loadedNames: ['search_knowledge'] },
      roundContext: { usedTokens: 1200, schemaTokens: 200, inputBudget: 2000 }, prompt: 'private-prompt' } }
  })
  await f.runtime.execute(f.id)
  const saved = f.deps.ensureAgentSession().session
  assert.equal(saved.expertTaskDiagnostics.loaded, 1)
  assert.equal(saved.expertTaskDiagnostics.schemaTokens, 200)
  assert.doesNotMatch(JSON.stringify(saved.expertTaskDiagnostics), /private/)
  assert.deepEqual(saved.messages, [])
})

it('does not let input bypass a pending approval checkpoint', t => {
  const f = fixture(t, { status: 'needs_input', attention: { kind: 'approval_required', action: 'provide_input' } })
  const before = fs.readFileSync(f.file, 'utf8')
  assert.equal(f.runtime.provideInput({ taskId: f.id, note: '授权并继续' }).ok, false)
  assert.equal(fs.readFileSync(f.file, 'utf8'), before)
})

  it('synchronizes legacy placeholder goals from the persisted plan without generating messages', async t => {
    const f = fixture(t, { status: 'cancelled', goal: '待填写目标',
      brief: { goal: '待填写目标', plan: { goal: '确认后的任务目标' } } })
    await f.runtime.recoverQueuedTasks()
    assert.equal(f.store.get(f.id).task.goal, '确认后的任务目标')
    assert.equal(f.store.get(f.id).task.brief.goal, '确认后的任务目标')
    assert.equal(f.calls.length, 0)
    assert.deepEqual(f.deps.ensureAgentSession().session.messages, [])
  })
