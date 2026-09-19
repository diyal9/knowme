'use strict'

// Desired behavior, not a production fix. Explicit provider finishReason only:
// no punctuation heuristic, expert ID, API, user profile or real side effects.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { createStreamAccumulator, feedSse, flushSse, getStreamSnapshot } = require('../src/lib/agent-stream')

function providerSnapshot({ text = '', finishReason = 'stop', toolCalls = [] }) {
  const accumulator = createStreamAccumulator()
  const frames = [
    { choices: [{ delta: { content: text, tool_calls: toolCalls.map((call, index) => ({
      index, id: call.id, function: { name: call.name, arguments: call.arguments },
    })) } }] },
    { choices: [{ delta: {}, finish_reason: finishReason }] },
  ]
  const wire = frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n'
  const split = Math.floor(wire.length / 2)
  feedSse(accumulator, wire.slice(0, split))
  feedSse(accumulator, wire.slice(split))
  flushSse(accumulator)
  const snapshot = getStreamSnapshot(accumulator)
  assert.equal(snapshot.finishReason, finishReason)
  return snapshot
}

const operation = (id = 'op-1', args = '{}') => ({ id, name: 'operation', arguments: args })

async function scenario(script, { tools = false, budget } = {}) {
  const controller = new AbortController()
  const input = { prompt: 'Give the complete requested response; retain confirmed operation results.',
    tier: tools ? 'assist' : 'chat', runId: 'rqa14-run' }
  const ports = createMockRunPorts({ input, budget,
    toolRecords: [{ type: 'function', function: { name: 'operation' },
      _knowme: { risk: 'write', sideEffects: true, idempotencySupported: false, timeoutMs: 1000 } }],
    toolScript: [{ ok: true, text: '{"ok":true,"receiptId":"rqa14-receipt"}' }],
  }, controller.signal)
  const requests = [], calls = [], validations = [], persisted = [], snapshots = [], events = []
  // createMockRunPorts' llmScript currently drops finishReason. Replace only
  // that boundary with real stream snapshots, preserving the actual executor.
  ports.llm.complete = async request => {
    const { onSnapshot, ...requestData } = request
    requests.push(structuredClone(requestData))
    const step = script[requests.length - 1]
    assert.ok(step, 'unexpected model request beyond the explicit finite script')
    if (step.cancel) { controller.abort(); return { cancelled: true } }
    const snapshot = providerSnapshot(step)
    snapshots.push(snapshot)
    onSnapshot?.(snapshot)
    if (step.abortAfterSnapshot) controller.abort()
    return { snapshot, streamed: true }
  }
  ports.tools.surface.getToolDefinitions = () => [{ type: 'function', function: {
    name: 'operation', description: 'In-memory effect counter', parameters: { type: 'object', properties: {} },
  } }]
  ports.tools.surface.validateToolCall = (name, args) => {
    validations.push({ name, args })
    try { return { ok: true, args: JSON.parse(args) } }
    catch { return { ok: false, code: 'invalid_args', error: 'invalid JSON' } }
  }
  const execute = ports.tools.execute
  ports.tools.execute = async call => { calls.push(call); return execute(call) }
  const persist = ports.session.persist
  ports.session.persist = async entry => { persisted.push(entry); return persist(entry) }
  const result = await AgentRunExecutor.run(input, ports, event => events.push(event))
  return { result, requests, calls, validations, persisted, snapshots, events, ports }
}

function assertNotAccepted(run) {
  assert.notEqual(run.result.terminal, RunPhase.DONE, JSON.stringify(run.result))
  assert.notEqual(run.result.executionEvidence?.gateStatus, 'verified')
  assert.notEqual(run.result.executionEvidence?.verificationPassed, true)
  assert.equal(run.events.filter(event => event.type === 'run.completed').length, 0)
}

function assertRepairRequest(request) {
  assert.ok(request, 'a bounded answer-only repair request must exist')
  assert.equal(request.finalize, true)
  assert.ok(!request.tools || request.tools.length === 0, 'repair cannot offer tools')
  assert.ok(request.messages.some(message => message.role === 'user'
    && String(message.content).includes('Give the complete requested response')))
}

it('normal stop remains complete even without sentence-ending punctuation', async () => {
  const run = await scenario([{ text: 'A complete checklist item', finishReason: 'stop' }])
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.text, 'A complete checklist item')
  assert.equal(run.result.executionEvidence.gateStatus, 'verified')
  assert.equal(run.requests.length, 1)
  assert.equal(run.events.filter(event => event.type === 'answer.committed').length, 1)
})

it('explicit length is incomplete even with a full stop; repeated length is not accepted', async () => {
  const run = await scenario([
    { text: 'Looks complete.', finishReason: 'length' },
    { text: 'Still looks complete.', finishReason: 'length' },
  ])
  assertNotAccepted(run)
  assert.equal(run.requests.length, 2)
  assertRepairRequest(run.requests[1])
  assert.equal(run.calls.length, 0)
  assert.equal(run.persisted.some(entry => ['Looks complete.', 'Still looks complete.'].includes(entry.fullText)), false)
})

it('one answer-only repair ending in stop can replace a length-truncated draft', async () => {
  const run = await scenario([
    { text: 'Unfinished draft', finishReason: 'length' },
    { text: 'The complete requested response.', finishReason: 'stop' },
  ])
  assert.equal(run.requests.length, 2)
  assertRepairRequest(run.requests[1])
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.text, 'The complete requested response.')
  assert.equal(run.result.executionEvidence.gateStatus, 'verified')
  assert.equal(run.events.filter(event => event.type === 'answer.committed').length, 1)
  assert.equal(run.persisted.some(entry => entry.fullText === 'Unfinished draft'), false)
})

it('length-truncated tool arguments prevent the entire uncommitted tool batch from executing', async () => {
  const run = await scenario([
    { finishReason: 'length', toolCalls: [operation('valid-prefix'), operation('cut-args', '{"target":')] },
    { text: 'The operation was not attempted; the request was incomplete.', finishReason: 'stop' },
  ], { tools: true })
  assert.equal(run.calls.length, 0, 'even the syntactically valid prefix call belongs to the incomplete response')
  assert.equal(run.validations.length, 0, 'length is checked before dispatch/argument recovery')
  assert.equal(run.events.some(event => event.type === 'tool.started'), false)
})

it('syntactically valid JSON is not permission to execute a length-terminated tool response', async () => {
  const run = await scenario([
    { finishReason: 'length', toolCalls: [operation()] },
    { text: 'The incomplete tool request was not executed.', finishReason: 'stop' },
  ], { tools: true })
  assert.equal(run.calls.length, 0)
  assert.equal(run.result.metrics.toolCalls, 0)
})

it('successful tool effects survive answer repair and are never replayed', async () => {
  const run = await scenario([
    { finishReason: 'tool_calls', toolCalls: [operation()] },
    { text: 'The receipt details are', finishReason: 'length' },
    { text: 'The operation receipt is rqa14-receipt.', finishReason: 'stop' },
  ], { tools: true })
  assert.equal(run.calls.length, 1)
  assert.equal(run.requests.length, 3)
  assertRepairRequest(run.requests[2])
  assert.ok(run.requests[2].messages.some(message => message.role === 'tool'
    && String(message.content).includes('rqa14-receipt')))
  assert.equal(run.result.text, 'The operation receipt is rqa14-receipt.')
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.executionEvidence.toolCalls.filter(call => call.status === 'ok').length, 1)
})

it('a second length after successful execution keeps the receipt but cannot complete the answer', async () => {
  const run = await scenario([
    { finishReason: 'tool_calls', toolCalls: [operation()] },
    { text: 'Receipt summary', finishReason: 'length' },
    { text: 'Incomplete receipt summary', finishReason: 'length' },
  ], { tools: true })
  assert.equal(run.calls.length, 1)
  assertNotAccepted(run)
  assert.equal(run.requests.length, 3)
  assert.ok(run.ports._eval.toolLedger.calls.some(call => call.name === 'operation' && call.status === 'ok'))
})

it('GROUND-triggered FINALIZE with length cannot become a verified answer', async () => {
  const run = await scenario([
    { text: '负责人：没有来源的人。', finishReason: 'stop' },
    { text: 'A harmless-looking but truncated answer.', finishReason: 'length' },
  ])
  assert.equal(run.requests.length, 2)
  assertRepairRequest(run.requests[1])
  assertNotAccepted(run)
})

it('tool-budget FINALIZE with length is not DONE or an acceptable deliverable', async () => {
  const run = await scenario([
    { finishReason: 'tool_calls', toolCalls: [operation()] },
    { text: 'A budget-finalized but incomplete answer.', finishReason: 'length' },
  ], { tools: true, budget: { maxRounds: 1, maxToolCalls: 1 } })
  assert.equal(run.calls.length, 1)
  assert.equal(run.requests.length, 2)
  assertRepairRequest(run.requests[1])
  assertNotAccepted(run)
})

it('parent cancellation accompanying length remains cancellation without repair', async () => {
  const run = await scenario([{ text: 'Partial', finishReason: 'length', abortAfterSnapshot: true }])
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
  assert.equal(run.result.cancelled, true)
  assert.equal(run.requests.length, 1)
  assert.equal(run.events.filter(event => event.type === 'run.cancelled').length, 1)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
})

it('cancellation during length repair does not return the earlier draft as DONE', async () => {
  const run = await scenario([{ text: 'Partial', finishReason: 'length' }, { cancel: true }])
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
  assert.equal(run.result.cancelled, true)
  assert.equal(run.requests.length, 2)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
})

it('cancellation during GROUND FINALIZE stays cancelled rather than persisting a refusal as DONE', async () => {
  const run = await scenario([{ text: '负责人：没有来源的人。', finishReason: 'stop' }, { cancel: true }])
  assert.equal(run.requests.length, 2)
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
  assert.equal(run.result.cancelled, true)
  assert.equal(run.events.filter(event => event.type === 'run.cancelled').length, 1)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
})
