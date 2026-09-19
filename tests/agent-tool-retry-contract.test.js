'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { resolveToolInvocationPolicy } = require('../src/lib/agent-run-executor/tool-invocation-policy')
const { createToolSurface } = require('../src/lib/agent-tools')
const { createRegistry } = require('../src/lib/tool-contract-registry')

async function scenario({ contract, timeout = false, failCount = 2, sibling = false, thrown = false, cancelDuringCall = false, cancelBackoff = false, realSurface = false, errorResult }) {
  const fixture = { input: { prompt: 'Execute the requested operation once', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
    llmScript: [
      { response: { toolCalls: [{ id: 'operation-one', name: 'operation', arguments: '{}' }] } },
      { response: { text: 'The operation returned a result.' } },
    ] }
  if (sibling) fixture.llmScript[0].response.toolCalls.push({ id: 'operation-two', name: 'operation', arguments: '{"value":2}' })
  const controller = new AbortController()
  const ports = createMockRunPorts(fixture, controller.signal)
  let modelCalls = 0
  const complete = ports.llm.complete
  ports.llm.complete = (...args) => { modelCalls++; return complete(...args) }
  ports.tools.surface.getToolRecords = () => [{ type: 'function', function: { name: 'operation' }, _knowme: contract }]
  const calls = []
  const late = []
  ports.tools.execute = async call => {
    calls.push(call)
    if (cancelDuringCall) queueMicrotask(() => controller.abort())
    if (cancelDuringCall) return new Promise((resolve, reject) => late.push({ resolve, reject }))
    if (timeout) return new Promise((resolve, reject) => late.push({ resolve, reject }))
    if (thrown) throw Object.assign(new Error('ECONNRESET: acknowledgement lost'), { code: 'ECONNRESET' })
    return calls.length <= failCount
      ? (errorResult || { ok: false, code: 'network_error', text: 'ECONNRESET: result unavailable' })
      : { ok: true, text: 'Confirmed result' }
  }
  if (realSurface) {
    const provider = ports.tools.execute
    const surface = createToolSurface({ includeBuiltins: false,
      extraDefinitions: [{ type: 'function', function: { name: 'operation', description: 'Controlled operation', parameters: { type: 'object', properties: {} } }, _knowme: contract }],
      handlers: { operation: (args, signal, ctx) => provider({ name: 'operation', arguments: args, signal, timeoutMs: ctx.timeoutMs }) },
    })
    ports.tools.surface = surface
    ports.tools.execute = surface.createToolExecutor({ signal: controller.signal }).executeToolCall
  }
  const nativeSet = global.setTimeout
  const nativeClear = global.clearTimeout
  const virtual = new Set()
  const delays = []
  global.setTimeout = (fn, ms, ...args) => {
    if ([400, 800, 2000, 4000].includes(ms) || (timeout && [45000, 240000].includes(ms))) {
      const handle = { virtual: true }
      virtual.add(handle)
      delays.push(ms)
      queueMicrotask(() => {
        if (cancelBackoff && [400, 800, 2000, 4000].includes(ms)) controller.abort()
        if (virtual.delete(handle)) fn(...args)
      })
      return handle
    }
    return nativeSet(fn, ms, ...args)
  }
  global.clearTimeout = handle => handle?.virtual ? virtual.delete(handle) : nativeClear(handle)
  try {
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, event => events.push(event))
    // A provider may ignore abort and settle late; the host must consume its rejection.
    late.forEach(item => item.reject(new Error('late provider rejection')))
    await Promise.resolve()
    return { result, calls, delays, pending: late.length, modelCalls, events }
  } finally {
    global.setTimeout = nativeSet
    global.clearTimeout = nativeClear
    virtual.clear()
    late.forEach(item => item.resolve({ ok: true, text: 'cleanup' }))
  }
}

for (const contract of [
  undefined,
  { risk: 'write', sideEffects: true, idempotencySupported: false, timeoutMs: 240000 },
  { risk: 'write', sideEffects: true, idempotencySupported: true, timeoutMs: 240000 },
  { risk: 'read', timeoutMs: 240000 },
]) it(`RQA01 does not replay an uncertain operation: ${JSON.stringify(contract)}`, async () => {
  const { result, calls } = await scenario({ contract })
  assert.equal(calls.length, 1)
  assert.equal(result.metrics.toolRetries || 0, 0)
  assert.equal(result.metrics.recoveryRounds || 0, 0)
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.equal(result.attention?.kind, 'operation_status_unknown')
  assert.equal(result.attention?.title, '需要核对操作结果')
  assert.match(result.text, /可能|无法确认/)
})

it('RQA01 preserves a failed receipt and stops before a sibling operation or reflection', async () => {
  const { result, calls, modelCalls, events } = await scenario({ contract: { risk: 'write', sideEffects: true }, sibling: true })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.ok(events.some(event => event.payload?.toolName === 'operation' && event.type === 'tool.failed'))
})

it('RQA01 handles a thrown transport error without replaying the effect', async () => {
  const { result, calls, modelCalls } = await scenario({ contract: { risk: 'write', sideEffects: true }, thrown: true })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(result.attention?.kind, 'operation_status_unknown')
})

it('RQA01 reports a deterministic empty artifact instead of unknown operation status', async () => {
  const { result, calls, modelCalls } = await scenario({
    contract: { risk: 'write', sideEffects: true },
    errorResult: { ok: false, code: 'pango_no_image', text: '生图工具未返回图片', executionStarted: true },
  })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(result.attention?.kind, 'artifact_missing')
  assert.match(result.text, /没有返回可验收的成果/)
  assert.equal(result.executionEvidence.verificationPassed, false)
})

it('RQA01 relays cancellation to the current invocation and consumes its late rejection', async () => {
  const { result, calls, modelCalls } = await scenario({ contract: { risk: 'write', sideEffects: true }, cancelDuringCall: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].signal.aborted, true)
  assert.equal(modelCalls, 1)
  assert.equal(result.cancelled, true)
})

it('RQA01 cancellation during backoff prevents the next read attempt', async () => {
  const { result, calls, modelCalls } = await scenario({ contract: { risk: 'read', sideEffects: false }, cancelBackoff: true })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(result.cancelled, true)
})

it('RQA01 rejects invalid deadlines and does not infer replay safety from missing metadata', () => {
  for (const timeoutMs of [undefined, 0, -1, Infinity, NaN, '240000', 2147483648, 1.5]) {
    const policy = resolveToolInvocationPolicy({ getToolRecords: () => [{ function: { name: 'operation' }, _knowme: { timeoutMs } }] }, 'operation', 45000)
    assert.deepEqual(policy, { timeoutMs: 45000, retrySafe: false })
  }
  assert.deepEqual(resolveToolInvocationPolicy({ getToolRecords: () => undefined }, 'operation', 45000), { timeoutMs: 45000, retrySafe: false })
})

it('RQA01 retries a declared side-effect-free read with the existing bounded backoff', async () => {
  const { result, calls, delays } = await scenario({ contract: { risk: 'read', sideEffects: false, timeoutMs: 90000 } })
  assert.equal(calls.length, 3)
  assert.deepEqual(delays, [400, 800])
  assert.equal(result.metrics.toolRetries, 2)
  assert.equal(result.executionEvidence.verificationPassed, true)
})

it('RQA01 uses the actual tool contract deadline for a successful long-running tool', async () => {
  const { result, calls } = await scenario({ contract: { risk: 'write', sideEffects: true, timeoutMs: 240000 }, failCount: 0 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].timeoutMs, 240000)
  assert.equal(result.executionEvidence.verificationPassed, true)
})

it('RQA01 aborts the timed-out invocation and stops before replay or a success answer', async () => {
  const { result, calls, delays, pending } = await scenario({ contract: { risk: 'write', sideEffects: true, timeoutMs: 240000 }, timeout: true })
  assert.equal(calls.length, 1)
  assert.deepEqual(delays, [240000])
  assert.equal(calls[0].signal.aborted, true)
  assert.equal(pending, 1)
  assert.equal(result.attention?.kind, 'operation_status_unknown')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

for (const timeout of [false, true]) it(`RQA01 carries contract and cancellation through the actual tool surface: timeout=${timeout}`, async () => {
  const { result, calls, modelCalls } = await scenario({ contract: { risk: 'write', sideEffects: true, timeoutMs: 240000 }, realSurface: true, timeout })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(calls[0].timeoutMs, 240000)
  assert.equal(calls[0].signal.aborted, timeout)
  assert.equal(result.attention?.kind, 'operation_status_unknown')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

for (const errorResult of [
  { ok: false, code: 'tool_failed', text: 'Bad gateway' },
  { ok: false, code: 'cancelled', text: 'cancelled' },
  { ok: false, code: 'tool_timeout', text: '参数已发送，但连接超时' },
  { ok: false, code: 'tool_timeout', text: 'permission cancelled argument' },
  { ok: false, code: 'invalid_args', text: 'The operation began before invalid parameters were detected', executionStarted: true },
]) it(`RQA01 never infers an unexecuted write from its failure message: ${errorResult.code}/${errorResult.text}`, async () => {
  const { calls, modelCalls, result } = await scenario({ contract: { risk: 'write', sideEffects: true }, sibling: true, errorResult })
  assert.equal(calls.length, 1)
  assert.equal(modelCalls, 1)
  assert.equal(result.metrics.recoveryRounds || 0, 0)
  assert.equal(result.attention?.kind, 'operation_status_unknown')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

for (const mode of ['deadline-shorter', 'deadline-equal', 'transport-code']) it(`RQA01 protects the real registry boundary: ${mode}`, async () => {
  const fixture = { input: { prompt: 'Perform one operation', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
    llmScript: [{ response: { toolCalls: [1, 2].map(value => ({ id: `op-${value}`, name: 'operation', arguments: JSON.stringify({ value }) })) } },
      { response: { text: 'Completed.' } }] }
  const ports = createMockRunPorts(fixture)
  const registry = createRegistry()
  const signals = []
  let settleLate
  const contract = { source: 'builtin', capability: 'diagnostic', risk: 'write', sideEffects: true,
    requiresApproval: false, scope: 'ephemeral', timeoutMs: mode === 'deadline-equal' ? 20 : 500,
    idempotencySupported: false, rollbackSupported: false }
  registry.registerTool({ type: 'function', function: { name: 'operation', parameters: { type: 'object', properties: { value: { type: 'number' } } } } }, contract,
    async (_args, signal) => {
      signals.push(signal)
      if (signals.length > 1) return { ok: true, text: 'Confirmed second operation' }
      if (mode === 'transport-code') throw Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' })
      return new Promise(resolve => { settleLate = resolve })
    })
  const surface = createToolSurface({ registry, includeBuiltins: false, deps: { getRemainingTimeoutMs: () => 20 } })
  ports.tools.surface = surface
  ports.tools.execute = surface.createToolExecutor({ getRemainingTimeoutMs: () => 20 }).executeToolCall
  try {
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(signals.length, 1)
    assert.equal(ports.signal.aborted, false)
    assert.equal(result.attention?.kind, 'operation_status_unknown')
    assert.equal(result.executionEvidence.verificationPassed, false)
  } finally { settleLate?.({ ok: true, text: 'late result must not be delivered' }) }
})
