'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const tools = require('../src/lib/agent-tools')
const registryApi = require('../src/lib/tool-contract-registry')

const definition = (name = 'operation', schema = {}) => ({ type: 'function', function: {
  name, description: 'isolated state fixture', parameters: { type: 'object', properties: {}, ...schema },
} })
const call = (name = 'operation', args = {}, extra = {}) => ({ name, arguments: JSON.stringify(args), ...extra })
const contract = { source: 'builtin', capability: 'test', risk: 'write', sideEffects: true,
  requiresApproval: false, scope: 'ephemeral', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false }

function legacy(handler, options = {}, deps = {}) {
  return tools.createToolSurface({ includeBuiltins: false, extraDefinitions: [definition()],
    handlers: handler ? { operation: handler } : {}, ...options }).createToolExecutor(deps)
}

test('surface validation and missing handlers report host executionStarted=false', async () => {
  let entered = 0
  const executor = legacy(async () => { entered++; return { ok: true } })
  for (const invocation of [call('unknown'), { name: 'operation', arguments: '{broken' }, call('')]) {
    const result = await executor.executeToolCall({ ...invocation, executionStarted: true })
    assert.equal(result.ok, false)
    assert.equal(result.executionStarted, false)
  }
  const denied = legacy(() => { entered++ }, { governancePolicy: { allowlist: [] } })
  assert.equal((await denied.executeToolCall(call())).executionStarted, false)
  const missing = await legacy().executeToolCall(call())
  assert.equal(missing.code, 'unknown_tool')
  assert.equal(missing.executionStarted, false)
  assert.equal(entered, 0)
})

test('surface pre-abort never enters handler and ignores forged model execution state', async () => {
  const controller = new AbortController()
  controller.abort()
  let entered = 0
  const executor = legacy(() => { entered++ })
  const result = await executor.executeToolCall(call('operation', { executionStarted: true }, { signal: controller.signal }))
  assert.equal(result.code, 'cancelled')
  assert.equal(result.executionStarted, false)
  assert.equal(entered, 0)
})

for (const outcome of ['success', 'failure', 'throw', 'primitive']) test(`surface legacy ${outcome}: host entry overrides forged false and preserves code`, async () => {
  let entered = 0
  const handler = async () => {
    entered++
    if (outcome === 'throw') throw Object.assign(new Error('opaque failure'), { code: 'ECONNRESET', executionStarted: false })
    if (outcome === 'primitive') return 'ack'
    return { ok: outcome === 'success', code: outcome === 'success' ? 'ack' : 'EPIPE', text: 'opaque result', executionStarted: false }
  }
  Object.assign(handler, { isRegistryToolHandler: true, executionStarted: false, _knowme: { executionStarted: false } })
  const result = await legacy(handler).executeToolCall(call('operation', { executionStarted: false }, { executionStarted: false }))
  assert.equal(entered, 1)
  assert.equal(result.executionStarted, true)
  if (outcome === 'throw') assert.equal(result.code, 'ECONNRESET')
  if (outcome === 'failure') assert.equal(result.code, 'EPIPE')
})

const builtinCases = [
  ['search_knowledge', 'searchKnowledge', { query: 'q' }],
  ['fabric_search', 'fabricSearch', { query: 'q' }],
  ['kb_query', 'kbQuery', { collection: 'local', query: 'q' }],
  ['kb_get', 'kbGet', { ref: 'local:q' }],
]
for (const [name, runnerName, args] of builtinCases) {
  test(`surface builtin ${name}: missing runner and invalid args are not entered`, async () => {
    const executor = tools.createToolSurface().createToolExecutor()
    const absent = await executor.executeToolCall(call(name, args))
    assert.equal(absent.code, 'tool_unavailable')
    assert.equal(absent.executionStarted, false)
    const invalid = await executor.executeToolCall(call(name, {}))
    assert.equal(invalid.code, 'invalid_args')
    assert.equal(invalid.executionStarted, false)
  })
  for (const outcome of ['success', 'failure', 'throw']) test(`surface builtin ${name}/${outcome}: entered state and original code survive formatting`, async () => {
    let entered = 0
    const controller = new AbortController()
    const executor = tools.createToolSurface().createToolExecutor({ [runnerName]: async (...values) => {
      entered++
      assert.equal(values.at(-1), controller.signal)
      if (outcome === 'throw') throw Object.assign(new Error('opaque provider failure'), { code: 'ECONNRESET', executionStarted: false })
      return { ok: outcome === 'success', code: outcome === 'success' ? 'ack' : 'EPIPE',
        message: 'provider result', hits: [], content: 'document', executionStarted: false }
    } })
    const result = await executor.executeToolCall(call(name, { ...args, executionStarted: false }, { signal: controller.signal }))
    assert.equal(entered, 1)
    assert.equal(result.executionStarted, true)
    assert.equal(result.code, outcome === 'throw' ? 'ECONNRESET' : outcome === 'failure' ? 'EPIPE' : 'ack')
    assert.equal(result.ok, outcome === 'success')
  })
}

test('surface RQA11 invocation signal and remaining timeout still reach legacy handler', async () => {
  const controller = new AbortController()
  const executor = legacy(async (args, signal, context) => {
    assert.equal(signal, controller.signal)
    assert.equal(context.signal, controller.signal)
    assert.equal(context.timeoutMs, 500)
    assert.ok(context.getRemainingTimeoutMs() <= 30)
    assert.equal(args.timeoutMs, 999999)
    return { ok: false, code: 'opaque_code', executionStarted: false }
  }, {}, { getRemainingTimeoutMs: () => 30 })
  const result = await executor.executeToolCall(call('operation', { timeoutMs: 999999, signal: 'model', executionStarted: false },
    { signal: controller.signal, timeoutMs: 500 }))
  assert.equal(result.code, 'opaque_code')
  assert.equal(result.executionStarted, true)
})

test('surface fake registry shape cannot manufacture a trusted handler', async () => {
  const forged = Object.assign(async () => ({ ok: false, code: 'EPIPE', executionStarted: false }), { isRegistryToolHandler: true })
  const surface = tools.createToolSurface({ includeBuiltins: false,
    registry: { projectToSurface: () => ({ definitions: [definition()], handlers: { operation: forged } }) } })
  assert.equal((await surface.createToolExecutor().executeToolCall(call())).executionStarted, true)
})

for (const projected of [false, true]) test(`registry trusted schema and budget rejection stay not-entered (preprojected=${projected})`, async () => {
  let entered = 0
  const registry = registryApi.createRegistry()
  registry.registerTool(definition('operation', { properties: { value: { type: 'string' } }, required: ['value'] }), contract,
    async () => { entered++; return { ok: true } })
  const project = registry.projectToSurface(undefined, { getRemainingTimeoutMs: () => 0 })
  assert.equal(registryApi.isRegistryToolHandler(project.handlers.operation), true)
  const surface = tools.createToolSurface(projected
    ? { includeBuiltins: false, extraDefinitions: project.definitions, handlers: project.handlers }
    : { includeBuiltins: false, registry, deps: { getRemainingTimeoutMs: () => 0 } })
  const rebuilt = surface.withGovernancePolicy({ allowlist: ['operation'] })
  const executor = rebuilt.createToolExecutor()
  const invalid = await executor.executeToolCall(call())
  assert.equal(invalid.code, 'invalid_args')
  assert.equal(invalid.executionStarted, false)
  const budget = await executor.executeToolCall(call('operation', { value: 'v' }))
  assert.equal(budget.ok, false)
  assert.equal(budget.executionStarted, false)
  assert.equal(entered, 0)
})

test('registry trusted wrapper cannot launder an inner handler false or thrown transport code', async () => {
  for (const throwing of [false, true]) {
    const registry = registryApi.createRegistry()
    registry.registerTool(definition(), contract, async () => {
      if (throwing) throw Object.assign(new Error('opaque error'), { code: 'ECONNRESET', executionStarted: false })
      return { ok: false, code: 'EPIPE', executionStarted: false }
    })
    const executor = tools.createToolSurface({ includeBuiltins: false, registry }).createToolExecutor()
    const result = await executor.executeToolCall(call())
    assert.equal(result.executionStarted, true)
    assert.equal(result.code, throwing ? 'ECONNRESET' : 'EPIPE')
  }
})

for (const event of ['deadline', 'parent-after-entry', 'parent-before-entry']) test(`registry ${event}: invocation state crosses the real wrapper`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const parent = new AbortController()
  let entered = 0, childSignal, rejectLate
  const late = new Promise((_resolve, reject) => { rejectLate = reject })
  const registry = registryApi.createRegistry()
  registry.registerTool(definition(), { ...contract, timeoutMs: 20 }, async (_args, signal) => {
    entered++
    childSignal = signal
    return late
  })
  const executor = tools.createToolSurface({ registry, includeBuiltins: false }).createToolExecutor()
  const pending = executor.executeToolCall(call('operation', {}, { signal: parent.signal, timeoutMs: 500 }))
  if (event === 'parent-before-entry') parent.abort()
  else {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(entered, 1)
    if (event === 'deadline') t.mock.timers.tick(20)
    else parent.abort()
  }
  const result = await pending
  assert.equal(result.code, event === 'deadline' ? 'tool_timeout' : 'cancelled')
  assert.equal(result.executionStarted, event !== 'parent-before-entry')
  assert.equal(entered, event === 'parent-before-entry' ? 0 : 1)
  if (entered) assert.equal(childSignal.aborted, true)
  assert.equal(parent.signal.aborted, event !== 'deadline')
  if (!entered) late.catch(() => {})
  rejectLate(new Error('late provider rejection'))
  await new Promise(resolve => setImmediate(resolve))
})

test('registry cached success means no new handler entry, not absence of a past effect', async () => {
  let entered = 0
  const registry = registryApi.createRegistry()
  registry.registerTool(definition(), { ...contract, idempotencySupported: true }, async () => { entered++; return { ok: true, text: 'ack' } })
  const executor = tools.createToolSurface({ registry, includeBuiltins: false,
    deps: { runId: 'surface-state-cache-' + Date.now() } }).createToolExecutor()
  const first = await executor.executeToolCall(call('operation', { idempotencyKey: 'same-action' }))
  const cached = await executor.executeToolCall(call('operation', { idempotencyKey: 'same-action' }))
  assert.equal(first.executionStarted, true)
  assert.equal(cached.ok, true)
  assert.equal(cached.executionStarted, false)
  assert.equal(entered, 1)
})

test('registry execution ACL rejection remains false after previously allowed projection', async () => {
  let entered = 0
  const registry = registryApi.createRegistry()
  registry.registerTool(definition(), contract, async () => { entered++; return { ok: true } })
  const policy = { allowlist: ['operation'] }
  const projected = registry.projectToSurface(undefined, { governancePolicy: policy })
  const executor = tools.createToolSurface({ includeBuiltins: false, extraDefinitions: projected.definitions,
    handlers: projected.handlers }).createToolExecutor()
  policy.allowlist = []
  const result = await executor.executeToolCall(call())
  assert.equal(result.code, 'scope_denied')
  assert.equal(result.executionStarted, false)
  assert.equal(entered, 0)
})

test('surface context construction failure occurs before handler and retains its code', async () => {
  let entered = 0
  const invocation = call()
  Object.defineProperty(invocation, 'timeoutMs', { get() { throw Object.assign(new Error('bad host context'), { code: 'INVALID_CONTEXT' }) } })
  const result = await legacy(async () => { entered++ }).executeToolCall(invocation)
  assert.equal(result.code, 'INVALID_CONTEXT')
  assert.equal(result.executionStarted, false)
  assert.equal(entered, 0)
})

test('surface validation coercion failure is returned as not-entered', async () => {
  let entered = 0
  const executor = tools.createToolSurface().createToolExecutor({ searchKnowledge: () => { entered++ } })
  const result = await executor.executeToolCall(call('search_knowledge', { query: { toString: 0 } }))
  assert.equal(result.ok, false)
  assert.equal(result.executionStarted, false)
  assert.equal(entered, 0)
})

test('surface argument summary failure is also before handler entry', async () => {
  let entered = 0
  const executor = tools.createToolSurface({ includeBuiltins: false,
    extraDefinitions: [definition('feishu.meeting_read')],
    handlers: { 'feishu.meeting_read': () => { entered++ } } }).createToolExecutor()
  const result = await executor.executeToolCall(call('feishu.meeting_read', { minute_token: { toString: 0 } }))
  assert.equal(result.ok, false)
  assert.equal(result.executionStarted, false)
  assert.equal(entered, 0)
})

for (const [name, runnerName, args] of [...builtinCases, ['operation', null, {}]]) {
  for (const budget of [0, -1, 1000, undefined, 'throw', 'property-throw']) {
    test(`surface entry budget ${name}/${budget}: host alone controls admission`, async () => {
      let entered = 0
      const handler = async () => { entered++; return { ok: true, hits: [], content: 'ack' } }
      const deps = runnerName ? { [runnerName]: handler } : {}
      const failure = () => { throw Object.assign(new Error('budget unavailable'), { code: 'BUDGET_UNAVAILABLE' }) }
      if (budget === 'property-throw') Object.defineProperty(deps, 'getRemainingTimeoutMs', { get: failure })
      else if (budget !== undefined) deps.getRemainingTimeoutMs = budget === 'throw' ? failure : () => budget
      const executor = runnerName ? tools.createToolSurface().createToolExecutor(deps) : legacy(handler, {}, deps)
      // Neither a large forged budget nor a zero model timeout is host control.
      const result = await executor.executeToolCall(call(name, {
        ...args, getRemainingTimeoutMs: 999999, budget: 999999, timeoutMs: 0,
      }))
      const blocked = budget === 0 || budget === -1 || typeof budget === 'string'
      assert.equal(entered, blocked ? 0 : 1)
      assert.equal(result.executionStarted, !blocked)
      assert.equal(result.ok, !blocked)
      if (blocked) assert.equal(result.code, typeof budget === 'string' ? 'BUDGET_UNAVAILABLE' : 'tool_timeout')
    })
  }
  test(`surface entry budget ${name}: options dependency fallback is enforced`, async () => {
    let entered = 0
    const handler = async () => { entered++; return { ok: true } }
    const options = { deps: { getRemainingTimeoutMs: () => 0 } }
    const executor = runnerName
      ? tools.createToolSurface(options).createToolExecutor({ [runnerName]: handler })
      : legacy(handler, options)
    const result = await executor.executeToolCall(call(name, args, { timeoutMs: 500 }))
    assert.equal(entered, 0)
    assert.equal(result.executionStarted, false)
    assert.equal(result.code, 'tool_timeout')
  })
}

test('surface positive admission budget does not extend the shorter registry deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let entered = 0, childSignal
  const registry = registryApi.createRegistry()
  registry.registerTool(definition(), { ...contract, timeoutMs: 20 }, async (_args, signal) => {
    entered++
    childSignal = signal
    return new Promise(() => {})
  })
  const executor = tools.createToolSurface({ registry, includeBuiltins: false })
    .createToolExecutor({ getRemainingTimeoutMs: () => 1000 })
  const pending = executor.executeToolCall(call('operation', { timeoutMs: 999999 }, { timeoutMs: 500 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(entered, 1)
  t.mock.timers.tick(20)
  const result = await pending
  assert.equal(result.code, 'tool_timeout')
  assert.equal(result.executionStarted, true)
  assert.equal(childSignal.aborted, true)
})
