'use strict'

// Diagnostic evidence only: asserts the observed defects, NOT desired behavior.
// Run from repository root with node -r ./scripts/register-ts.js <this file>.
// Uses actual runtime/preflight/normalization, in-memory services, manually
// settled Promises and fake heartbeat timers. No API, real sleep or user data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../../../..')
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

function fixture(stage = 'status') {
  const filename = path.join(root, 'src/lib/expert-task-runtime.ts')
  const nativeRequire = createRequire(filename)
  const timers = new Map()
  let timerId = 0
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: nativeRequire, URL, AbortController,
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
  const store = {
    get: () => ({ ok: true, task: structuredClone(task) }),
    update: (_id, patch) => { task = normalizeTask({ ...task, ...patch }); return store.get() },
    create: patch => { task = normalizeTask({ ...patch, id: 'rqa03' }); return store.get() },
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
  const runtime = module.exports.createExpertTaskRuntime({
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
  })
  return { runtime, store, timers, calls, gates, modelCalls, control, snapshot,
    release: index => gates[index].resolve(stage === 'status' ? ready() : discovered()),
    start: () => runtime.createStart({ taskId: 'rqa03', expertId: 'arbitrary-agent',
      brief: { goal: '诊断挂起预检', deliverables: [output] } }) }
}

async function executeCancellation(stage) {
  const f = fixture(stage)
  const pending = observe(f.runtime.execute('rqa03'))
  await drain()
  assert.equal(f.gates.length, 1)
  const controller = f.runtime.controllers.get('rqa03')
  assert.ok(controller)
  const cancelled = f.runtime.cancel('rqa03')
  await drain()
  const retry = f.runtime.retry('rqa03')
  const snapshot = { case: `execute/${stage}`, cancelledStatus: cancelled.task.status,
    signalAborted: controller.signal.aborted, executeSettled: pending.settled,
    registeredControllers: f.runtime.controllers.size, heartbeatTimers: f.timers.size,
    retryOk: retry.ok, retryError: retry.error, probeArguments: f.calls, modelCalls: f.modelCalls.length }
  assert.equal(snapshot.cancelledStatus, 'cancelled')
  assert.equal(snapshot.executeSettled, false)
  assert.equal(snapshot.registeredControllers, 1)
  assert.equal(snapshot.retryOk, false)
  assert.equal(snapshot.modelCalls, 0)
  f.release(0)
  await pending.promise
  assert.equal(f.runtime.controllers.size, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(f.modelCalls.length, 0)
  snapshot.afterManualRelease = { controllers: 0, heartbeatTimers: 0, status: f.store.get().task.status }
  return snapshot
}

async function createCancellation(stage) {
  const f = fixture(stage)
  const pending = observe(f.start())
  await drain()
  assert.equal(f.gates.length, 1)
  assert.equal(f.runtime.controllers.size, 0)
  f.runtime.cancel('rqa03')
  await drain()
  const before = { status: f.store.get().task.status, createSettled: pending.settled,
    controllers: f.runtime.controllers.size, heartbeatTimers: f.timers.size }
  f.control.auto = true
  f.release(0)
  const result = await pending.promise
  await drain()
  assert.equal(before.status, 'cancelled')
  assert.equal(result.started, true)
  assert.equal(f.modelCalls.length, 1)
  assert.equal(f.modelCalls[0].aborted, false)
  assert.equal(f.runtime.controllers.size, 0)
  assert.equal(f.timers.size, 0)
  return { case: `createStart/${stage}/cancel-then-late-success`, before,
    startedAfterCancel: result.started, afterStatus: f.store.get().task.status,
    modelCalls: f.modelCalls, cancellationEventSurvives: f.store.get().task.events.some(e => e.type === 'cancelled') }
}

async function overlappingCreateRetry() {
  const f = fixture('status')
  const original = observe(f.start())
  await drain()
  f.runtime.cancel('rqa03')
  const retry = f.runtime.retry('rqa03')
  await drain()
  assert.equal(retry.started, true)
  assert.equal(f.gates.length, 2)
  const retryController = f.runtime.controllers.get('rqa03')
  f.release(0)
  await original.promise
  await drain()
  assert.equal(f.gates.length, 3)
  const lateController = f.runtime.controllers.get('rqa03')
  assert.notEqual(lateController, retryController)
  const overlap = { retryAcceptedWhileOriginalPending: true, preflightAttempts: f.gates.length,
    oldCreateReplacedRetryController: true, retryControllerAborted: retryController.signal.aborted,
    heartbeatTimers: f.timers.size }
  f.release(1)
  await drain()
  assert.equal(f.modelCalls.length, 1)
  assert.equal(f.runtime.controllers.size, 0)
  assert.equal(f.timers.size, 1)
  const orphan = { controllers: 0, heartbeatTimers: 1, lateControllerAborted: lateController.signal.aborted }
  f.runtime.cancel('rqa03')
  assert.equal(lateController.signal.aborted, false)
  f.release(2)
  await drain()
  assert.equal(f.modelCalls.length, 2)
  assert.equal(f.timers.size, 0)
  return { case: 'createStart/cancel/retry/late-result-race', overlap, orphan,
    modelCallsAfterSecondCancel: f.modelCalls, finalStatus: f.store.get().task.status }
}

async function optionalProviderHang() {
  const gate = deferred()
  const calls = []
  const snapshot = { bindings: { connectors: ['a', 'optional'] }, capabilityManifest: { permissions: {
    tools: { allowlist: ['a.read'] }, connectors: { allowedConnectorIds: ['a', 'optional'] },
  } } }
  const pending = observe(preflightExpertTools({ snapshot, connectorIds: [], requiredTools: ['a.read'],
    getConnectorsApi: () => ({ getConnectorStatus: id => {
      calls.push(id)
      return id === 'optional' ? gate.promise : Promise.resolve({ ok: true, connector: {
        id, enabled: true, agentVisible: true, status: { ok: true, projectedAllowlist: ['a.read'] },
      } })
    } }),
  }))
  await drain()
  assert.equal(pending.settled, false)
  assert.deepEqual(calls, ['a', 'optional'])
  gate.reject(new Error('controlled optional provider failure'))
  const after = await pending.promise
  assert.equal(after.ok, true)
  return { case: 'Promise.all/optional-provider-hang', completedRequiredProvider: 'a',
    settledBeforeManualRelease: false, afterOptionalReject: after }
}

async function responseBodyHang() {
  const filename = path.join(root, 'src/lib/mcp-host.ts')
  const module = { exports: {} }
  const timers = new Map()
  let nextTimer = 0
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: createRequire(filename), AbortController,
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id },
    clearTimeout: id => timers.delete(id),
  }, { filename })
  const body = deferred()
  let signal, bodyReadStarted = false
  const session = module.exports.createMcpSessionForTransport({ transport: 'streamable-http',
    url: 'https://not-contacted.invalid' }, { timeoutMs: 15, fetchImpl: async (_url, options) => {
    signal = options.signal
    return { json: () => { bodyReadStarted = true; return body.promise } }
  } })
  const pending = observe(session.listTools())
  await drain()
  const before = { bodyReadStarted, settled: pending.settled,
    remainingDeadlineTimers: timers.size, signalAborted: signal.aborted }
  assert.equal(before.bodyReadStarted, true)
  assert.equal(before.settled, false)
  assert.equal(before.remainingDeadlineTimers, 0)
  body.resolve({ result: { tools: [] } })
  const after = await pending.promise
  await session.close()
  assert.equal(after.ok, true)
  return { case: 'actual-MCP-HTTP/headers-ready-body-hang', before, afterManualBodyRelease: after }
}

async function main() {
  const results = []
  for (const stage of ['status', 'tools']) results.push(await executeCancellation(stage))
  for (const stage of ['status', 'tools']) results.push(await createCancellation(stage))
  results.push(await overlappingCreateRetry())
  results.push(await optionalProviderHang())
  results.push(await responseBodyHang())
  console.log(JSON.stringify({ diagnostic: 'RQA03 observed liveness defects',
    realNetworkCalls: 0, realSleepCalls: 0, fakeTimersAllReleased: true, results }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
