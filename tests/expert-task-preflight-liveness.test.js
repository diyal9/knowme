'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const { normalizeTask } = require(path.join(root, 'src/lib/workbench-task-store'))
const { preflightExpertTools } = require(path.join(root, 'src/lib/expert-task-tool-preflight'))
const agentRun = require(path.join(root, 'src/lib/agent-run'))

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function observe(promise) {
  const state = { settled: false }
  state.promise = promise.then(value => { state.settled = true; state.value = value; return value })
  return state
}

async function drain() {
  // Yield event-loop turns, not elapsed time. An unresolved deferred never
  // becomes resolved merely because these checkpoints have been reached.
  for (let index = 0; index < 20; index++) await new Promise(resolve => setImmediate(resolve))
}

function fixture(stage = 'status', overrides = {}) {
  const filename = path.join(root, 'src/lib/expert-task-runtime.ts')
  const nativeRequire = createRequire(filename)
  const timers = new Map()
  let timerId = 0
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: nativeRequire, __filename: filename, __dirname: path.dirname(filename),
    URL, AbortController,
    setInterval: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id },
    clearInterval: id => timers.delete(id),
  }, { filename })
  const requiredTools = stage === 'tools' ? ['a.read'] : []
  const output = { id: 'primary', title: '诊断结果', type: 'answer', required: true,
    requiredTools, requiredConnectorIds: ['a'] }
  const snapshot = { bindings: { skills: [], connectors: ['a'] }, capabilityManifest: {
    version: 'rqa03-fixture', permissions: { tools: { allowlist: requiredTools },
      connectors: { allowedConnectorIds: ['a'] }, network: true, write: true },
    metadata: { knowme: { execution: { deliverables: [output] } } },
  } }
  let task = normalizeTask({ id: 'rqa03', kind: 'expert', expertId: 'arbitrary-agent', status: 'starting',
    goal: '诊断挂起预检', brief: { goal: '诊断挂起预检', deliverables: [output] },
    execRef: { kind: 'session', id: 'rqa03-session' }, assignmentSnapshot: { agentVersion: 'rqa03-fixture' } })
  // This single-record adapter exercises legacy same-task retry/controller recovery.
  // New commission IDs and immutable terminal records are covered with the real store
  // in expert-commission-lifecycle.test.js.
  const legacy = value => normalizeTask({ ...value, brief: { ...value.brief, completionPolicy: undefined } })
  const store = {
    get: () => ({ ok: true, task: structuredClone(task) }),
    update: (_id, patch) => { task = legacy({ ...task, ...patch }); return store.get() },
    create: patch => { task = legacy({ ...patch, id: 'rqa03' }); return store.get() },
    list: () => ({ ok: true, tasks: [structuredClone(task)] }),
  }
  const calls = [], gates = [], modelCalls = []
  const control = { auto: false }
  const ready = () => ({ ok: true, connector: { id: 'a', enabled: true, agentVisible: true,
    status: { ok: true, state: 'ready', ...(stage === 'status' ? { projectedAllowlist: requiredTools } : {}) } } })
  const discovered = () => ({ ok: true, projectedAllowlist: requiredTools })
  const api = Object.fromEntries(['status', 'tools'].map(kind => [
    kind === 'status' ? 'getConnectorStatus' : 'getConnectorTools',
    (...args) => {
      calls.push({ kind, argc: args.length, hasAbortSignal: args.some(arg => arg?.signal || arg instanceof AbortSignal) })
      if (kind !== stage || control.auto) return Promise.resolve(kind === 'status' ? ready() : discovered())
      const gate = deferred()
      gates.push(gate)
      return gate.promise
    },
  ]))
  let session = { id: 'rqa03-session', messages: [], run: agentRun.createEmptyRun() }
  const runtimeDeps = {
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture-not-used', apiEndpoint: 'https://not-contacted.invalid' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => snapshot,
      createSessionSnapshot: () => ({ ok: true, snapshot }) }) }),
    getConnectorsApi: () => api,
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: rows => { session = rows[0] },
    runAgentGenerate: async (_deps, payload, options) => {
      modelCalls.push({ runId: payload.runId, aborted: options.controller.signal.aborted })
      return { error: 'diagnostic_model_boundary_stop' }
    },
    agentRun,
    ...overrides,
  }
  const runtime = module.exports.createExpertTaskRuntime(runtimeDeps)
  return { runtime, runtimeDeps, store, timers, calls, gates, modelCalls, control, snapshot,
    release: index => gates[index].resolve(stage === 'status' ? ready() : discovered()),
    start: () => runtime.createStart({ taskId: 'rqa03', expertId: 'arbitrary-agent',
      brief: { goal: '诊断挂起预检', deliverables: [output] } }) }
}


async function cleanup(f) {
  f.control.auto = true
  for (let turn = 0; turn < 5; turn++) {
    f.gates.forEach((_gate, index) => f.release(index))
    await drain()
  }
  assert.equal(f.timers.size, 0)
}

for (const stage of ['status', 'tools']) {
  test(`RQA03 execute/${stage}: cancel settles and permits a single retry`, async t => {
    const f = fixture(stage)
    t.after(() => cleanup(f))
    const pending = observe(f.runtime.execute('rqa03'))
    await drain()
    const controller = f.runtime.controllers.get('rqa03')
    f.runtime.cancel('rqa03')
    await drain()
    assert.equal(controller.signal.aborted, true)
    assert.equal(pending.settled, true)
    assert.equal(f.runtime.controllers.size, 0)
    assert.equal(f.timers.size, 0)
    assert.equal(f.store.get().task.status, 'cancelled')
    const retry = f.runtime.retry('rqa03')
    assert.equal(retry.started, true)
    assert.equal(f.runtime.retry('rqa03').ok, false)
    await drain()
    const active = f.runtime.controllers.get('rqa03')
    f.gates[0].reject(new Error('late abandoned provider rejection'))
    await drain()
    assert.equal(f.runtime.controllers.get('rqa03'), active)
    assert.equal(f.store.get().task.status, 'starting')
    f.runtime.cancel('rqa03')
    await drain()
    assert.equal(f.modelCalls.length, 0)
  })

  test(`RQA03 createStart/${stage}: cancelled preflight cannot resurrect or lose its event`, async t => {
    const f = fixture(stage)
    t.after(() => cleanup(f))
    const pending = observe(f.start())
    await drain()
    assert.equal(f.runtime.controllers.size, 1)
    f.runtime.cancel('rqa03')
    await drain()
    assert.equal(pending.settled, true)
    assert.equal(pending.value.started, false)
    f.release(0)
    await drain()
    assert.equal(f.modelCalls.length, 0)
    assert.equal(f.store.get().task.status, 'cancelled')
    assert.ok(f.store.get().task.events.some(event => event.type === 'cancelled'))
  })
}

test('RQA03 create/cancel/retry: stale result cannot replace or orphan the retry controller', async t => {
  const f = fixture()
  t.after(() => cleanup(f))
  const original = observe(f.start())
  await drain()
  f.runtime.cancel('rqa03')
  await drain()
  assert.equal(original.settled, true)
  assert.equal(f.runtime.retry('rqa03').started, true)
  await drain()
  const active = f.runtime.controllers.get('rqa03')
  const duplicate = await f.runtime.execute('rqa03')
  assert.equal(duplicate.ok, false)
  assert.equal((await f.start()).ok, false)
  f.release(0)
  await drain()
  assert.equal(f.gates.length, 2)
  assert.equal(f.runtime.controllers.get('rqa03'), active)
  assert.equal(f.timers.size, 1)
  f.runtime.cancel('rqa03')
  await drain()
  assert.equal(active.signal.aborted, true)
  assert.equal(f.runtime.controllers.size, 0)
  f.release(1)
  await drain()
  assert.equal(f.modelCalls.length, 0)
  assert.equal(f.store.get().task.status, 'cancelled')
})

test('RQA03 optional provider: bounded wait preserves a complete confirmed union', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const gate = deferred()
  const snapshot = { bindings: { connectors: ['a', 'optional'] }, capabilityManifest: { permissions: {
    tools: { allowlist: ['a.read'] }, connectors: { allowedConnectorIds: ['a', 'optional'] },
  } } }
  const pending = observe(preflightExpertTools({ snapshot, connectorIds: [], requiredTools: ['a.read'],
    probeTimeoutMs: 50, timeoutMs: 200,
    getConnectorsApi: () => ({ getConnectorStatus: id => id === 'optional' ? gate.promise : Promise.resolve({
      ok: true, connector: { id, enabled: true, status: { ok: true, projectedAllowlist: ['a.read'] } },
    }) }),
  }))
  await drain()
  t.mock.timers.tick(50)
  await drain()
  assert.equal(pending.settled, true)
  assert.equal(pending.value.ok, true)
  gate.reject(new Error('late optional rejection'))
  await drain()
})

for (const entry of ['execute', 'createStart']) {
  for (const stage of ['status', 'tools']) {
    test(`RQA03 ${entry}/${stage}: timeout is structured and retryable, not configuration`, async t => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const f = fixture(stage, { preflightTimeoutMs: 200, preflightProbeTimeoutMs: 50 })
      t.after(() => cleanup(f))
      const pending = observe(entry === 'execute' ? f.runtime.execute('rqa03') : f.start())
      await drain()
      t.mock.timers.tick(50)
      await drain()
      assert.equal(pending.settled, true)
      assert.ok(pending.value.preflightIssues.some(issue => issue.code === 'preflight_timeout' && issue.stage === stage && issue.retryable))
      assert.equal(f.store.get().task.attention.action, 'retry')
      assert.equal(f.store.get().task.attention.kind, 'retryable_failure')
      assert.equal(f.runtime.controllers.size, 0)
      assert.equal(f.runtime.retry('rqa03').started, true)
      await drain()
      f.runtime.cancel('rqa03')
      await drain()
    })
  }
}

test('RQA03 total deadline bounds status plus tools and abort detaches late rejections', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const status = deferred(), tools = deferred()
  const pending = observe(preflightExpertTools({ snapshot: { bindings: { connectors: ['a'] } },
    connectorIds: ['a'], requiredTools: ['a.read'], timeoutMs: 60, probeTimeoutMs: 50,
    getConnectorsApi: () => ({ getConnectorStatus: () => status.promise, getConnectorTools: () => tools.promise }),
  }))
  await drain()
  t.mock.timers.tick(40)
  status.resolve({ ok: true, connector: { id: 'a', enabled: true, status: { ok: true } } })
  await drain()
  t.mock.timers.tick(20)
  await drain()
  assert.equal(pending.settled, true)
  assert.equal(pending.value.ok, false)
  assert.ok(pending.value.issues.some(issue => issue.code === 'preflight_timeout' && issue.stage === 'overall' && issue.retryable))
  tools.reject(new Error('late body rejection'))
  await drain()
})

test('RQA03 create preview preserves queued materials and events through one execution handoff', async t => {
  const payloads = []
  const f = fixture('status', { runAgentGenerate: async (_deps, payload) => {
    payloads.push(payload)
    return { text: '已整理所给材料' }
  } })
  t.after(() => cleanup(f))
  const pending = observe(f.start())
  await drain()
  const queued = f.runtime.provideInput({ taskId: 'rqa03', note: '保留新增负责人与截止日期' })
  assert.equal(queued.queued, true)
  f.control.auto = true
  f.release(0)
  await pending.promise
  await drain()
  assert.equal(payloads.length, 1)
  assert.match(payloads[0].prompt, /保留新增负责人与截止日期/)
  assert.ok(f.store.get().task.events.some(event => event.type === 'input_queued'))
  assert.equal(f.store.get().task.inputQueue, null)
})

test('RQA03 preflight timeout with queued input stops for retry without discarding input', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture('status', { preflightProbeTimeoutMs: 50 })
  t.after(() => cleanup(f))
  const pending = observe(f.runtime.execute('rqa03'))
  await drain()
  f.runtime.provideInput({ taskId: 'rqa03', note: '原始材料新增复核截止时间' })
  t.mock.timers.tick(50)
  await drain()
  assert.equal(pending.settled, true)
  assert.equal(f.gates.length, 1)
  assert.equal(f.runtime.controllers.size, 0)
  assert.equal(f.store.get().task.attention.action, 'retry')
  assert.match(f.store.get().task.brief.materials.at(-1).content, /复核截止时间/)
  assert.ok(f.store.get().task.events.some(event => event.type === 'input_queued'))
  f.runtime.cancel('rqa03')
})

for (const knownTask of [true, false]) test(`RQA03 real IPC create/cancel/retry binding (${knownTask ? 'existing' : 'new'} task)`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const f = fixture()
  const handlers = new Map()
  require('../src/ipc/expert-task').registerExpertTaskIpc({ handle: (name, handler) => handlers.set(name, handler) }, f.runtimeDeps)
  const invoke = (name, value) => handlers.get('expert-task-' + name)(null, value)
  const pending = observe(invoke('create-start', { ...(knownTask ? { taskId: 'rqa03' } : {}), expertId: 'arbitrary-agent',
    brief: { goal: '已知任务正文', deliverables: [{ id: 'primary', type: 'answer', requiredConnectorIds: ['a'] }] },
  }))
  await drain()
  invoke('cancel', 'rqa03')
  await drain()
  assert.equal(pending.settled, true)
  assert.equal(pending.value.started, false)
  assert.equal(invoke('retry', 'rqa03').started, true)
  await drain()
  f.release(0)
  await drain()
  assert.equal(f.gates.length, 2)
  invoke('cancel', 'rqa03')
  await drain()
  f.gates[1].reject(new Error('abandoned IPC provider'))
  await drain()
  assert.equal(invoke('get', 'rqa03').task.status, 'cancelled')
  assert.equal(f.modelCalls.length, 0)
})

test('RQA03 wait boundary cleans timers/listeners for success, timeout, throw and abort', async () => {
  const { getEventListeners } = require('node:events')
  const filename = path.join(root, 'src/lib/expert-task-preflight-wait.ts')
  const timers = new Map()
  let nextId = 0
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, AbortController,
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id },
    clearTimeout: id => timers.delete(id),
  }, { filename })
  for (const scenario of ['success', 'throw', 'probe', 'overall', 'abort', 'pre-aborted']) {
    const parent = new AbortController()
    if (scenario === 'pre-aborted') parent.abort()
    const context = module.exports.createPreflightWait({ signal: parent.signal, timeoutMs: 200, probeTimeoutMs: 50 })
    const gate = deferred()
    let called = false
    const pending = context.wait(() => {
      called = true
      if (scenario === 'throw') throw new Error('sync provider error')
      return gate.promise
    }, 'status', 'a')
    const outcome = pending.then(value => value, error => error.code || error.message)
    if (scenario === 'success') gate.resolve('confirmed')
    if (scenario === 'probe' || scenario === 'overall') [...timers.values()].find(timer => timer.ms === (scenario === 'probe' ? 50 : 200)).fn()
    if (scenario === 'abort') parent.abort()
    const result = await outcome
    assert.equal(result, scenario === 'success' ? 'confirmed' : scenario === 'throw' ? 'sync provider error'
      : ['probe', 'overall'].includes(scenario) ? 'preflight_timeout' : 'preflight_cancelled')
    if (scenario === 'pre-aborted') assert.equal(called, false)
    context.close()
    assert.equal(timers.size, 0)
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0)
    assert.equal(getEventListeners(context.signal, 'abort').length, 0)
    gate.reject(new Error('late rejection after close'))
    // No provider call was made in these two cases; consume our unused fixture.
    if (scenario === 'throw' || scenario === 'pre-aborted') gate.promise.catch(() => {})
    await drain()
  }
})

test('RQA03 single-flight is keyed by the canonical task returned by the store', async t => {
  const f = fixture()
  t.after(() => cleanup(f))
  void f.runtime.execute('rqa03')
  await drain()
  const first = f.runtime.controllers.get('rqa03')
  // The store normalizes aliases; a raw caller id must not bypass ownership.
  const duplicate = observe(f.runtime.execute(' rqa03 '))
  await drain()
  assert.equal(duplicate.settled, true)
  assert.equal(duplicate.value.code, 'task_busy')
  assert.equal(f.runtime.controllers.get('rqa03'), first)
  f.runtime.cancel('rqa03')
  await drain()
})

test('RQA03 synchronous startup failure releases the registered attempt', async () => {
  const f = fixture()
  const update = f.store.update
  f.store.update = (id, patch) => {
    if (patch.events?.at(-1)?.type === 'preflight_started') throw new Error('controlled startup persistence failure')
    return update(id, patch)
  }
  const result = await f.runtime.execute('rqa03').catch(error => ({ error: error.message }))
  assert.equal(f.runtime.controllers.size, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(result.task.status, 'failed')
  assert.equal(result.task.attention.action, 'retry')
})

for (const kind of ['operation_status_unknown', 'resource_unavailable', undefined, '', null, 42, {}]) {
  test(`RQA01 typed attention preserves ${JSON.stringify(kind)} with an untyped fallback`, async t => {
    const upstream = { kind, action: 'provide_input', title: '需要核对操作结果',
      detail: '请求可能已提交，不能安全重复操作。', field: '操作结果', item: '外部操作',
      question: '请先核对是否已完成，再提供结果。', example: '提供服务端状态或记录编号',
      options: ['已完成', '确认未执行', '仍无法确认'], defaultValue: '', required: true }
    let generated = 0
    const f = fixture('status', { runAgentGenerate: async () => {
      generated++
      return { attention: upstream, blockedEvidence: false, text: '',
        executionEvidence: { verificationPassed: false, gateStatus: 'blocked' } }
    } })
    t.after(() => cleanup(f))
    f.control.auto = true
    const result = await f.runtime.execute('rqa03')
    const expected = typeof kind === 'string' && kind ? kind : 'missing_information'
    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.attention.kind, expected)
    assert.equal(result.task.attention.action, 'provide_input')
    for (const key of ['title', 'detail', 'field', 'item', 'question', 'example', 'options', 'defaultValue', 'required']) {
      assert.deepEqual(result.task.attention[key], upstream[key], key)
    }
    assert.equal(f.runtime.retry('rqa03').ok, false)
    assert.equal(f.runtime.provideInput({ taskId: 'rqa03', note: '确认' }).ok, false)
    const clarification = f.runtime.provideInput({ taskId: 'rqa03', note: '补充什么？' })
    assert.equal(clarification.ok, false)
    assert.match(clarification.error, /请先核对是否已完成/)
    assert.equal(result.task.deliverables.some(item => item.version > 0), false)
    assert.equal(generated, 1)
  })
}

test('RQA01 typed input attention cannot be bypassed by an already queued supplement', async t => {
  const response = deferred()
  let generated = 0
  const f = fixture('status', { runAgentGenerate: async () => { generated++; return response.promise } })
  t.after(() => cleanup(f))
  f.control.auto = true
  const pending = f.runtime.execute('rqa03')
  await drain()
  assert.equal(f.runtime.provideInput({ taskId: 'rqa03', note: '这是操作发出前的旧补充' }).queued, true)
  response.resolve({ attention: { kind: 'operation_status_unknown', action: 'provide_input',
    title: '需要核对操作结果', question: '请核对服务端是否已经执行。' }, blockedEvidence: false })
  await pending
  await drain()
  assert.equal(generated, 1)
  const task = f.store.get().task
  assert.equal(task.status, 'needs_input')
  assert.equal(task.attention.kind, 'operation_status_unknown')
  assert.equal(task.inputQueue.pending, true)
  assert.match(task.brief.materials.at(-1).content, /旧补充/)
  assert.equal(task.events.some(event => event.type === 'queued_input_applied'), false)
  assert.equal(f.runtime.retry('rqa03').ok, false)
})

test('RQA01 recovery keeps a typed input checkpoint paused until fresh user input', async t => {
  let generated = 0
  const f = fixture('status', { runAgentGenerate: async () => {
    generated++
    return { text: '已按用户提供的新核对结果处理' }
  } })
  t.after(() => cleanup(f))
  f.control.auto = true
  f.store.update('rqa03', { status: 'needs_input', inputQueue: { pending: true, count: 1 },
    attention: { kind: 'operation_status_unknown', action: 'provide_input', title: '需要核对操作结果',
      question: '请核对服务端是否已经执行。' } })
  const recovered = await f.runtime.recoverQueuedTasks()
  await drain()
  assert.equal(recovered.recovered.length, 0)
  assert.equal(generated, 0)
  assert.equal(f.store.get().task.attention.kind, 'operation_status_unknown')
  assert.equal(f.runtime.provideInput({ taskId: 'rqa03', note: '已核对记录编号ABC，操作完成，请只记录结果' }).started, true)
  await drain()
  assert.equal(generated, 1)
})
