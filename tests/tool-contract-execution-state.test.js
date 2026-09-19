'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const registryModule = require('../src/lib/tool-contract-registry')
const { createRegistry, unbindRunRuntimeContext, wrapEnvelope } = registryModule
const baseContract = {
  source: 'builtin', capability: 'fixture', risk: 'write', sideEffects: true,
  requiresApproval: false, scope: 'ephemeral', timeoutMs: 500,
  idempotencySupported: false, rollbackSupported: false,
}
function fixture(handler, overrides = {}, schema = {}) {
  const registry = createRegistry()
  assert.equal(registry.registerTool({
    type: 'function', function: { name: 'operation', parameters: { type: 'object', ...schema } },
  }, { ...baseContract, ...overrides }, handler).ok, true)
  return registry
}
// A referenced watchdog makes even the old unref'ed deadline runnable without
// real APIs, persistent userdata, long sleeps, or an unbounded test process.
async function bounded(pending) {
  let timer
  try {
    return await Promise.race([pending, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('fixture watchdog expired')), 1500)
    })])
  } finally { clearTimeout(timer) }
}

for (const contractMs of [500, 20]) {
  test('IR01 real registry short/same deadline ' + contractMs, async () => {
    const parent = new AbortController()
    let calls = 0, signal
    const registry = fixture((_args, received) => {
      calls++; signal = received
      return new Promise(() => {})
    }, { timeoutMs: contractMs })
    const result = await bounded(registry.execute('operation', {}, {
      signal: parent.signal, getRemainingTimeoutMs: () => 20,
    }))
    assert.equal(result.code, 'tool_timeout')
    assert.equal(result.executionStarted, true)
    assert.equal(result.ok, false)
    assert.equal(parent.signal.aborted, false)
    assert.equal(signal.aborted, true)
    assert.equal(calls, 1)
  })
}
test('IR01 deadline stays timeout when cooperative handler rejects AbortError', async () => {
  const registry = fixture((_args, signal) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' })), { once: true })
  }), { timeoutMs: 20 })
  const result = await bounded(registry.execute('operation', {}))
  assert.equal(result.code, 'tool_timeout')
  assert.equal(result.executionStarted, true)
})
test('IR01 parent cancellation after actual entry stays cancelled', async () => {
  const parent = new AbortController()
  let enter
  const entered = new Promise(resolve => { enter = resolve })
  const registry = fixture(() => { enter(); return new Promise(() => {}) })
  const pending = registry.execute('operation', {}, { signal: parent.signal })
  await entered
  parent.abort()
  const result = await bounded(pending)
  assert.equal(result.code, 'cancelled')
  assert.equal(result.executionStarted, true)
})
test('IR01 parent cancellation before entry is cancelled and not started', async () => {
  const parent = new AbortController()
  parent.abort()
  let calls = 0
  const registry = fixture(() => { calls++; return { ok: true } })
  const result = await registry.execute('operation', { executionStarted: true }, { signal: parent.signal })
  assert.equal(result.code, 'cancelled')
  assert.equal(result.executionStarted, false)
  assert.equal(calls, 0)
})
test('IR01 cancellation before scheduled handler microtask must not enter handler', async () => {
  const parent = new AbortController()
  let calls = 0
  const registry = fixture(() => { calls++; return { ok: true } })
  const pending = registry.execute('operation', {}, { signal: parent.signal })
  parent.abort()
  const result = await bounded(pending)
  assert.equal(result.code, 'cancelled')
  assert.equal(result.executionStarted, false)
  assert.equal(calls, 0)
})
for (const remaining of [0, -1]) {
  test('IR01 exhausted entrance budget prevents execution ' + remaining, async () => {
    let calls = 0
    const registry = fixture(() => { calls++; return { ok: true } })
    const result = await registry.execute('operation', { executionStarted: true }, { getRemainingTimeoutMs: () => remaining })
    assert.equal(result.code, 'tool_timeout')
    assert.equal(result.executionStarted, false)
    assert.equal(calls, 0)
  })
}
test('IR02 preserves transport code without requiring message keywords', async () => {
  const registry = fixture(() => {
    throw Object.assign(new Error('fetch failed'), { code: 'ECONNRESET', executionStarted: false })
  })
  const result = await registry.execute('operation', { executionStarted: false })
  assert.equal(result.code, 'ECONNRESET')
  assert.equal(result.text, 'fetch failed')
  assert.equal(result.executionStarted, true)
})
for (const error of [new Error('Bad gateway'), Object.freeze(Object.assign(new Error('opaque'), { code: 'E_CUSTOM', executionStarted: false })), 'primitive failure']) {
  test('IR02 entered failure has host execution state: ' + String(error), async () => {
    const registry = fixture(() => { throw error })
    const result = await registry.execute('operation', {})
    assert.equal(result.ok, false)
    assert.equal(result.code, error.code || 'tool_failed')
    assert.equal(result.executionStarted, true)
  })
}
for (const response of [{ ok: false, code: 'invalid_args', executionStarted: false }, { ok: false, code: 'scope_denied', executionStarted: false }, { ok: true, executionStarted: false }, { ok: true, requiresApproval: true, executionStarted: false }]) {
  test('IR02 handler self-reported executionStarted cannot override host ' + JSON.stringify(response), async () => {
    const registry = fixture(() => response)
    const result = await registry.execute('operation', { executionStarted: false })
    assert.equal(result.executionStarted, true)
    assert.equal(result.ok, response.ok)
    if (response.requiresApproval) assert.equal(result.requiresApproval, true)
  })
}
for (const condition of ['unknown', 'schema', 'ACL']) {
  test('IR02 pre-handler rejection is not started: ' + condition, async () => {
    let calls = 0
    const registry = fixture(() => { calls++; return { ok: true } }, {}, { required: ['value'] })
    const result = await registry.execute(condition === 'unknown' ? 'missing' : 'operation',
      condition === 'schema' ? {} : { value: 1, executionStarted: true },
      condition === 'ACL' ? { governancePolicy: { allowlist: [] } } : {})
    assert.equal(result.ok, false)
    assert.equal(result.executionStarted, false)
    assert.equal(calls, 0)
  })
}
test('IR02 cached success does not enter handler again', async () => {
  let calls = 0
  const registry = fixture(() => { calls++; return { ok: true, text: 'ack' } }, { idempotencySupported: true })
  const ctx = { runId: 'ir02-memory-only' }
  try {
    const first = await registry.execute('operation', { idempotencyKey: 'key' }, ctx)
    const second = await registry.execute('operation', { idempotencyKey: 'key' }, ctx)
    assert.equal(first.executionStarted, true)
    assert.equal(second.ok, true)
    assert.equal(second.executionStarted, false)
    assert.equal(calls, 1)
  } finally { unbindRunRuntimeContext(ctx.runId) }
})
test('IR02 envelope accepts execution state only from host metadata', () => {
  assert.equal(wrapEnvelope({ ok: false, executionStarted: false }).executionStarted, undefined)
  assert.equal(wrapEnvelope({ ok: false, executionStarted: false }, { executionStarted: true }).executionStarted, true)
  assert.equal(wrapEnvelope({ ok: false, executionStarted: true }, { executionStarted: false }).executionStarted, false)
})
test('IR02 only private registry wrapper identity is trusted', async () => {
  assert.equal(typeof registryModule.isRegistryToolHandler, 'function')
  const raw = async () => ({ ok: false, executionStarted: false })
  raw.isRegistryToolHandler = true
  raw.executionStarted = false
  const registry = fixture(raw)
  const projected = registry.projectToSurface(null, { governancePolicy: { allowlist: ['operation'] } })
  const wrapper = projected.handlers.operation
  assert.equal(registryModule.isRegistryToolHandler(raw), false)
  assert.equal(registryModule.isRegistryToolHandler(wrapper), true)
  assert.equal(registryModule.isRegistryToolHandler(null), false)
  assert.equal(registryModule.isRegistryToolHandler(Object.assign(async () => {}, wrapper)), false)
  assert.equal((await wrapper({}, null)).executionStarted, true)
  assert.equal((await wrapper({}, null, { governancePolicy: { allowlist: [] } })).executionStarted, false)
})

test('IR01 runtime-bound parent cancellation is still cancelled', async () => {
  const parent = new AbortController()
  const runId = 'ir01-parent-memory-only'
  registryModule.bindRunRuntimeContext(runId, { signal: parent.signal })
  let enter
  const entered = new Promise(resolve => { enter = resolve })
  const registry = fixture(() => { enter(); return new Promise(() => {}) })
  try {
    const pending = registry.execute('operation', {}, { runId })
    await entered
    parent.abort()
    const result = await bounded(pending)
    assert.equal(result.code, 'cancelled')
    assert.equal(result.executionStarted, true)
  } finally { unbindRunRuntimeContext(runId) }
})
test('IR01 late handler rejection after deadline is consumed', async () => {
  let rejectLate
  const registry = fixture(() => new Promise((_, reject) => { rejectLate = reject }), { timeoutMs: 20 })
  const result = await bounded(registry.execute('operation', {}))
  assert.equal(result.code, 'tool_timeout')
  assert.equal(result.executionStarted, true)
  rejectLate(Object.assign(new Error('late transport failure'), { code: 'ECONNRESET' }))
  await new Promise(resolve => setImmediate(resolve))
})
test('IR02 handler cancellation code is preserved without inferring a user cancel', async () => {
  const parent = new AbortController()
  const registry = fixture(() => { throw Object.assign(new Error('provider cancelled'), { code: 'cancelled' }) })
  const result = await registry.execute('operation', {}, { signal: parent.signal })
  assert.equal(result.code, 'cancelled')
  assert.equal(result.executionStarted, true)
  assert.equal(parent.signal.aborted, false)
})
