'use strict'

// Independent policy-boundary tests. No source/frozen-test edits or API calls.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { createStreamAccumulator, applyCompletionJson, getStreamSnapshot } = require('../src/lib/agent-stream')

async function runBudget({ outputTokens = 2600, maxOutput = 8192, mode = 'incomplete', secondFinish = 'stop' } = {}) {
  const usesTool = mode === 'budget' || mode === 'artifact'
  const input = { prompt: 'Provide the requested complete response.', runId: 'rqa14-budget',
    tier: usesTool ? 'assist' : 'chat', ...(mode === 'artifact' ? { conversationMode: 'expert-execution' } : {}) }
  const script = mode === 'stop' ? [{ text: 'Complete response without punctuation', finish: 'stop' }]
    : usesTool ? [{ finish: 'tool_calls', calls: [{ id: 'op-1', name: 'operation', arguments: '{}' }] },
      { text: 'The requested result is available.', finish: secondFinish }]
      : [{ text: mode === 'grounding' ? '负责人：无来源姓名。' : 'Unfinished draft',
        finish: mode === 'grounding' ? 'stop' : 'length' },
      { text: 'The complete rewritten response.', finish: secondFinish }]
  const ports = createMockRunPorts({ input,
    budget: mode === 'budget' ? { maxRounds: 1, maxToolCalls: 1 } : undefined,
    taskFrame: mode === 'artifact' ? { requiredTools: ['operation'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 } : undefined,
    toolRecords: [{ function: { name: 'operation' }, _knowme: { risk: 'write', sideEffects: true, timeoutMs: 1000 } }],
    toolScript: [{ ok: true, text: '{"ok":true,"receiptId":"budget-receipt"}',
      artifactRefs: mode === 'artifact' ? [{ id: 'fixture-image', type: 'image', targetPath: 'memory://fixture-image' }] : [] }],
  })
  let originalPolicy
  const build = ports.context.build
  ports.context.build = async (...args) => {
    const context = await build(...args)
    originalPolicy = { ...context.policy, outputTokens, maxOutput, inputBudget: 12000 }
    return { ...context, policy: originalPolicy }
  }
  const requests = [], events = []
  let toolExecutions = 0
  const execute = ports.tools.execute
  ports.tools.execute = async call => { toolExecutions++; return execute(call) }
  ports.llm.complete = async request => {
    const { onSnapshot: _onSnapshot, ...data } = request
    requests.push(structuredClone(data))
    const step = script[requests.length - 1]
    assert.ok(step, 'repair exceeded the finite two-response script')
    const accumulator = createStreamAccumulator()
    applyCompletionJson(accumulator, { choices: [{ finish_reason: step.finish, message: {
      content: step.text || '', tool_calls: (step.calls || []).map(call => ({ id: call.id, type: 'function',
        function: { name: call.name, arguments: call.arguments } })),
    } }] })
    const snapshot = getStreamSnapshot(accumulator)
    assert.equal(snapshot.finishReason, step.finish)
    return { snapshot, streamed: false }
  }
  const result = await AgentRunExecutor.run(input, ports, event => events.push(event))
  return { result, requests, originalPolicy, events, toolExecutions }
}

for (const [outputTokens, maxOutput] of [[2600, 8192], [2600, 3000], [4096, 4096], [800, 10000]]) {
  it(`incomplete repair preserves budget and respects 2x/cap: ${outputTokens}/${maxOutput}`, async () => {
    const run = await runBudget({ outputTokens, maxOutput })
    assert.equal(run.requests.length, 2)
    const repair = run.requests[1]
    assert.equal(repair.finalize, true)
    assert.ok(!repair.tools || repair.tools.length === 0)
    assert.ok(repair.policy.outputTokens >= outputTokens, 'repair must not shrink an already valid output budget')
    assert.ok(repair.policy.outputTokens <= Math.min(2 * outputTokens, maxOutput), 'repair must respect both upper bounds')
    assert.equal(repair.policy.maxOutput, maxOutput)
    assert.equal(repair.policy.inputBudget, 12000, 'do not expand inputBudget alongside the repair')
    assert.equal(run.requests[0].policy.outputTokens, outputTokens)
    assert.equal(run.originalPolicy.outputTokens, outputTokens, 'do not mutate the shared resolved policy')
    assert.equal(run.result.terminal, RunPhase.DONE)
    assert.equal(run.result.text, 'The complete rewritten response.')
  })
}

it('more repair tokens do not authorize a third model call after a second length', async () => {
  const run = await runBudget({ secondFinish: 'length' })
  assert.equal(run.requests.length, 2)
  assert.equal(run.requests[1].finalize, true)
  assert.ok(!run.requests[1].tools || run.requests[1].tools.length === 0)
  assert.notEqual(run.result.terminal, RunPhase.DONE)
  assert.notEqual(run.result.executionEvidence?.verificationPassed, true)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
  assert.equal(run.toolExecutions, 0)
})

it('normal stop uses the original budget once and never requests repair', async () => {
  const run = await runBudget({ mode: 'stop' })
  assert.equal(run.requests.length, 1)
  assert.notEqual(run.requests[0].finalize, true)
  assert.equal(run.requests[0].policy.outputTokens, 2600)
  assert.equal(run.result.terminal, RunPhase.DONE)
  assert.equal(run.result.text, 'Complete response without punctuation')
})

for (const mode of ['grounding', 'budget', 'artifact']) {
  it(`${mode} finalization keeps its existing 2400-token budget`, async () => {
    const run = await runBudget({ mode })
    assert.equal(run.requests.length, 2)
    assert.equal(run.requests[1].finalize, true)
    assert.equal(run.requests[1].policy.outputTokens, 2400)
    assert.equal(run.requests[1].policy.inputBudget, 12000)
    assert.ok(!run.requests[1].tools || run.requests[1].tools.length === 0)
    assert.equal(run.toolExecutions, mode === 'grounding' ? 0 : 1)
    assert.equal(run.result.terminal, RunPhase.DONE)
    if (mode === 'artifact') assert.equal(run.result.artifactRefs[0].id, 'fixture-image')
  })
}
