'use strict'

// Diagnostic of current behavior, not a passing production qualification test.
// Real executor/surface, synthetic model and effects, no network or filesystem writes.
const assert = require('node:assert/strict')
const path = require('node:path')
const root = path.resolve(__dirname, '../../../..')
const { AgentRunExecutor } = require(path.join(root, 'src/lib/agent-run-executor'))
const { createMockRunPorts } = require(path.join(root, 'src/lib/agent-run-ports'))
const { createToolSurface } = require(path.join(root, 'src/lib/agent-tools-surface'))

async function observe(mode) {
  const definition = { type: 'function', function: { name: 'submit_job', parameters: { type: 'object', properties: {} } },
    _knowme: { source: 'connector', capability: 'job', risk: 'write', sideEffects: true,
      requiresApproval: false, scope: 'external', timeoutMs: 240000,
      idempotencySupported: false, rollbackSupported: false } }
  const calls = []
  const pending = []
  const timerDelays = []
  const fixture = { input: { prompt: 'Submit one synthetic job', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
    llmScript: [
      { response: { toolCalls: [{ id: 'one-operation', name: 'submit_job', arguments: '{}' }] } },
      { response: { text: 'Operation status cannot be confirmed.' } },
    ] }
  const surface = createToolSurface({ includeBuiltins: false, extraDefinitions: [definition], handlers: {
    submit_job: async (_args, signal) => {
      calls.push({ signal, syntheticEffect: calls.length + 1 })
      if (mode === 'network_after_effect') return { ok: false, code: 'network_error', text: 'ECONNRESET after synthetic effect' }
      return new Promise(resolve => pending.push(resolve))
    },
  } })
  const ports = createMockRunPorts(fixture)
  ports.tools.surface = surface
  const passedTimeouts = []
  ports.tools.execute = call => {
    passedTimeouts.push(call.timeoutMs)
    return surface.createToolExecutor({ signal: call.signal }).executeToolCall(call)
  }
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const virtualTimers = new Set()
  global.setTimeout = (callback, ms, ...args) => {
    if ([400, 800, 2000, 4000].includes(ms) || (mode === 'outer_timeout' && ms === 45000)) {
      const timer = { virtual: true }
      virtualTimers.add(timer)
      timerDelays.push(ms)
      queueMicrotask(() => { if (virtualTimers.delete(timer)) callback(...args) })
      return timer
    }
    return originalSetTimeout(callback, ms, ...args)
  }
  global.clearTimeout = timer => {
    if (timer?.virtual) virtualTimers.delete(timer)
    else originalClearTimeout(timer)
  }
  try {
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(calls.length, 3, 'records the current automatic replay defect')
    assert.deepEqual(passedTimeouts, [45000, 45000, 45000])
    const row = { mode, declaredContract: definition._knowme, syntheticEffects: calls.length,
      handlerSignalsAborted: calls.map(item => item.signal?.aborted ?? null),
      passedTimeouts, timerDelays, pendingHandlersAtHostReturn: pending.length,
      retries: result.metrics.toolRetries, terminal: result.terminal, text: result.text }
    pending.forEach(resolve => resolve({ ok: true, text: 'late synthetic completion' }))
    await Promise.resolve()
    return row
  } finally {
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
    virtualTimers.clear()
    pending.forEach(resolve => resolve({ ok: true, text: 'diagnostic cleanup' }))
  }
}

;(async () => {
  const rows = []
  for (const mode of ['network_after_effect', 'outer_timeout']) rows.push(await observe(mode))
  console.log(JSON.stringify({ kind: 'current-defect-diagnostic', realExternalEffects: 0, rows }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
