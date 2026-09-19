'use strict'

// Independent runtime boundary review. All provider/tool/persistence ports are
// in-memory fixtures; artifact refs below are not real image qualification.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')

const operation = id => ({ id, name: 'operation', arguments: '{}' })
const snapshot = (content, finishReason = null, toolCalls = []) => ({ content, finishReason, toolCalls })

async function runBoundary(steps, { overCap = false, artifact = false } = {}) {
  const controller = new AbortController()
  const input = { prompt: 'Return the requested complete response.', runId: 'rqa14-independent',
    tier: overCap || artifact ? 'assist' : 'chat',
    ...(artifact ? { conversationMode: 'expert-execution' } : {}) }
  const ports = createMockRunPorts({ input,
    budget: overCap ? { maxRounds: 4, maxToolCalls: 1 } : undefined,
    taskFrame: artifact ? { requiredTools: ['operation'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 } : undefined,
    toolScript: [{ ok: true, text: 'Recorded fixture operation.',
      artifactRefs: artifact ? [{ id: 'saved-fixture', type: 'image', targetPath: 'https://example.test/fixture.png' }] : [] }],
  }, controller.signal)
  const requests = [], calls = [], persisted = [], events = []
  ports.llm.complete = async request => {
    requests.push(request)
    const step = steps[requests.length - 1]
    assert.ok(step, 'no unbounded additional provider requests')
    if (step.cancel) { controller.abort(); return { cancelled: true } }
    if (step.error) return { error: step.error }
    request.onSnapshot?.(step)
    return { snapshot: step, streamed: true }
  }
  ports.tools.surface.getToolDefinitions = () => [{ type: 'function', function: {
    name: 'operation', parameters: { type: 'object', properties: {} },
  } }]
  ports.tools.surface.validateToolCall = (_name, args) => ({ ok: true, args: JSON.parse(args) })
  const execute = ports.tools.execute
  ports.tools.execute = async call => { calls.push(call); return execute(call) }
  const persist = ports.session.persist
  ports.session.persist = async entry => { persisted.push(entry); return persist(entry) }
  const result = await AgentRunExecutor.run(input, ports, event => events.push(event))
  return { result, requests, calls, persisted, events, ports }
}

function assertAnswerOnly(run) {
  assert.equal(run.requests.length, 2)
  assert.equal(run.requests[1].finalize, true)
  assert.ok(!run.requests[1].tools?.length)
}

function assertRejected(run) {
  assert.notEqual(run.result.terminal, RunPhase.DONE,
    JSON.stringify({ terminal: run.result.terminal, text: run.result.text, evidence: run.result.executionEvidence }))
  assert.notEqual(run.result.executionEvidence?.gateStatus, 'verified')
  assert.equal(run.events.some(event => event.type === 'answer.committed'), false)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
  assert.equal(run.persisted.length, 0)
}

// Two calls already exceed the fixed one-call cap; there is no incomplete plan
// that could authorize adaptive expansion. The pre-tool prose must not rescue
// an explicitly incomplete/cancelled FINALIZE response.
for (const [name, final] of [
  ['length', snapshot('Cut final.', 'length')],
  ['max_tokens', snapshot('Cut final.', 'max_tokens')],
  ['unexpected tool request', snapshot('Do this next.', 'tool_calls', [operation('forbidden')])],
]) {
  it(`over-cap batch FINALIZE rejects ${name} instead of accepting pre-tool prose`, async () => {
    const run = await runBoundary([
      snapshot('Pre-tool draft.', 'tool_calls', [operation('a'), operation('b')]), final,
    ], { overCap: true })
    assertAnswerOnly(run)
    assert.equal(run.calls.length, 0)
    assertRejected(run)
  })
}

it('over-cap batch cancellation cannot commit or persist the pre-tool draft', async () => {
  const run = await runBoundary([
    snapshot('Pre-tool draft.', 'tool_calls', [operation('a'), operation('b')]), { cancel: true },
  ], { overCap: true })
  assertAnswerOnly(run)
  assert.equal(run.calls.length, 0)
  assert.equal(run.result.terminal, RunPhase.CANCELLED, JSON.stringify(run.result))
  assert.equal(run.result.cancelled, true)
  assertRejected(run)
})

it('normal null finishReason stays compatible without extra finalization', async () => {
  const run = await runBoundary([snapshot('Complete checklist')])
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.text, 'Complete checklist')
  assert.equal(run.requests.length, 1)
})

it('max_tokens can converge once to a compatible null finishReason answer', async () => {
  const run = await runBoundary([snapshot('Cut.', 'max_tokens'), snapshot('Complete replacement')])
  assertAnswerOnly(run)
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.text, 'Complete replacement')
})

it('mixed repeated truncation reasons cannot escape the single repair bound', async () => {
  const run = await runBoundary([snapshot('Cut.', 'max_tokens'), snapshot('Still cut.', 'length')])
  assertAnswerOnly(run)
  assertRejected(run)
})

for (const [name, initial] of [
  ['incomplete repair', snapshot('Cut.', 'length')],
  ['GROUND repair', snapshot('负责人：没有来源的人。', 'stop')],
]) {
  it(`${name} refuses unexpected FINALIZE tool calls without executing them`, async () => {
    const run = await runBoundary([initial, snapshot('Unexpected call.', 'tool_calls', [operation('forbidden')])])
    assertAnswerOnly(run)
    assert.equal(run.calls.length, 0)
    assertRejected(run)
  })
}

for (const [name, final] of [
  ['length', snapshot('Cut handoff.', 'length')],
  ['max_tokens', snapshot('Cut handoff.', 'max_tokens')],
  ['unexpected tool request', snapshot('Call again.', 'tool_calls', [operation('forbidden')])],
  ['provider error', { error: 'Fixture provider unavailable' }],
]) {
  it(`artifact_ready preserves successful fixture artifact with a factual fallback after ${name}`, async () => {
    const run = await runBoundary([
      snapshot('', 'tool_calls', [operation('generate')]), final,
    ], { artifact: true })
    assertAnswerOnly(run)
    assert.equal(run.calls.length, 1, 'never repeat the side effect')
    assert.equal(run.result.terminal, RunPhase.DONE, run.result.error)
    assert.equal(run.result.artifactRefs[0].id, 'saved-fixture')
    assert.match(run.result.text, /已生成 1 项可验收成果/)
    assert.equal(run.result.executionEvidence.verificationPassed, true)
  })
}

it('artifact_ready cancellation retains the successful tool ledger but cannot commit a success summary', async () => {
  const run = await runBoundary([
    snapshot('', 'tool_calls', [operation('generate')]), { cancel: true },
  ], { artifact: true })
  assertAnswerOnly(run)
  assert.equal(run.calls.length, 1)
  // cancelled() does not expose artifactRefs in its public result. Assert the
  // existing ledger contract, not an invented cancelled-result artifact API.
  assert.ok(run.ports._eval.toolLedger.calls.some(call => call.name === 'operation' && call.status === 'ok'))
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
  assertRejected(run)
})
