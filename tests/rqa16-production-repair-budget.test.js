'use strict'

// Real executor + production adapter + stream parser. Only transport, tool
// effects and session storage are in memory; no API, installation or profile IO.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { buildProductionRunPorts } = require('../src/lib/agent-run-kernel-adapter')
const { createStreamAccumulator, applyCompletionJson, getStreamSnapshot } = require('../src/lib/agent-stream')
const { unbindRunRuntimeContext } = require('../src/lib/tool-contract-registry')

const answer = 'Complete replacement based on the supplied material.'
const operation = id => ({ id, name: 'operation', arguments: '{}' })
const reply = (text, finish = 'stop', calls = []) => ({ text, finish, calls })
const definition = { type: 'function', function: { name: 'operation',
  description: 'In-memory fixture operation', parameters: { type: 'object', properties: {} } } }

async function runWire({ outputTokens = 2600, maxOutput = 8192, parameter = 'max_tokens',
  mode = 'incomplete', finalFinish = 'stop', cancel = false, steps: suppliedSteps } = {}) {
  const controller = new AbortController()
  const runId = 'rqa16-' + randomUUID()
  const usesTool = ['budget', 'artifact', 'after-tool', 'repeated'].includes(mode)
  const policy = { outputTokens, maxOutput, parameter, inputBudget: 12000,
    contextWindow: 32768, temperature: 0.4 }
  const originalPolicy = structuredClone(policy)
  const prompt = usesTool ? 'Perform operation. Keep this original user anchor; produce the requested complete answer.'
    : 'Keep this original user anchor; produce the requested complete answer.'
  const input = { prompt, runId, conversationMode: 'expert-execution' }
  const session = { id: runId + '-session', messages: [], run: {} }
  let sessions = [session]
  const bodies = [], events = [], calls = [], persisted = [], transportErrors = []
  const final = cancel ? { cancel: true } : reply(answer, finalFinish)
  const steps = suppliedSteps || (mode === 'stop' ? [reply(answer)]
    : mode === 'after-tool' ? [reply('', 'tool_calls', [operation('once')]), reply('Unfinished', 'length'), final]
      : mode === 'repeated' ? [reply('', 'tool_calls', [operation('once')]), reply('', 'tool_calls', [operation('again')]), final]
        : usesTool ? [reply('', 'tool_calls', [operation('once')]), final]
          : [reply(mode === 'grounding' ? '负责人：无来源姓名。' : 'Unfinished',
            mode === 'grounding' ? 'stop' : 'length'), final])
  const taskFrame = mode === 'artifact'
    ? { requiredTools: ['operation'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 }
    : null
  const ports = buildProductionRunPorts({
    runId, settings: { apiKey: 'offline-fixture', apiEndpoint: 'https://offline.invalid/v1/chat/completions' },
    url: 'https://offline.invalid/v1/chat/completions', routedModel: { model: 'offline-fixture' },
    policy, signal: controller.signal, session, tier: usesTool ? 'assist' : 'chat', toolsEnabled: usesTool,
    apiMessages: [{ role: 'user', content: prompt }], ctxBundle: { taskFrame },
    promptCachePolicy: { enabled: false }, tokenCalKey: 'rqa16:offline-fixture',
    effectivePersonalization: { applied: [], omitted: 0 },
    toolSurface: {
      getToolDefinitions: () => [definition],
      getToolRecords: () => [{ ...definition, _knowme: { risk: 'write', sideEffects: true, timeoutMs: 1000 } }],
      validateToolCall: (_name, args) => ({ ok: true, args: JSON.parse(args || '{}') }),
    },
    toolExecutor: async call => {
      calls.push(call)
      return { ok: true, executionStarted: true, text: '{"ok":true,"receiptId":"fixture-operation"}',
        artifactRefs: mode === 'artifact' ? [{ id: 'fixture-image', type: 'image', targetPath: 'memory://fixture-image' }] : [] }
    },
    loadAgentSessions: () => sessions,
    saveAgentSessions: next => { sessions = next },
    requestAgentCompletion: async request => {
      // This is the actual body produced by the production adapter, not the
      // executor's request.policy. Never replace ports.llm.complete here.
      bodies.push(structuredClone(request.body))
      try {
        assert.equal(request.url, 'https://offline.invalid/v1/chat/completions')
        assert.equal(request.signal, controller.signal)
        const step = steps[bodies.length - 1]
        assert.ok(step, 'unexpected extra provider call beyond finite fixture')
        if (step.cancel) { controller.abort(); return { cancelled: true } }
        if (request.body.tools) for (const call of step.calls || []) {
          assert.ok(request.body.tools.some(tool => tool.function.name === call.name), `Tool ${call.name} must be offered before the mock calls it`)
        }
        const accumulator = createStreamAccumulator()
        applyCompletionJson(accumulator, { choices: [{ finish_reason: step.finish, message: {
          content: step.text || '', tool_calls: (step.calls || []).map(call => ({ id: call.id,
            type: 'function', function: { name: call.name, arguments: call.arguments } })),
        } }] })
        const snapshot = getStreamSnapshot(accumulator)
        request.onSnapshot?.(snapshot)
        return { snapshot, streamed: true }
      } catch (error) { transportErrors.push(error.message); throw error }
    },
  })
  // Only the loop-cap fixture needs a bounded context override. Policy and LLM
  // ports remain the real adapter values/functions for every test.
  if (mode === 'budget') {
    const build = ports.context.build
    ports.context.build = async (...args) => ({ ...await build(...args), budget: { maxRounds: 1, maxToolCalls: 1 } })
  }
  const persist = ports.session.persist
  ports.session.persist = async entry => { persisted.push(entry.fullText); return persist(entry) }
  if (mode === 'pre-cancel') controller.abort()
  let result
  try { result = await AgentRunExecutor.run(input, ports, event => events.push(event)) }
  finally { unbindRunRuntimeContext(runId) }
  assert.deepEqual(transportErrors, [], 'transport fixture itself must not be the reason the executor failed')
  assert.deepEqual(policy, originalPolicy, 'do not mutate the resolved shared policy')
  return { result, bodies, calls, events, persisted, parameter, prompt }
}

function assertAnswerOnly(run) {
  const final = run.bodies.at(-1)
  assert.ok(final)
  assert.equal(Object.hasOwn(final, 'tools'), false)
  assert.equal(Object.hasOwn(final, 'tool_choice'), false)
  assert.ok(final.messages.some(message => message.role === 'user' && message.content === run.prompt),
    'the original user input must survive finalization')
}

function assertBlocked(run) {
  assert.notEqual(run.result.terminal, RunPhase.DONE)
  assert.equal(run.events.some(event => event.type === 'answer.committed'), false)
  assert.equal(run.events.some(event => event.type === 'run.completed'), false)
  assert.deepEqual(run.persisted, [], 'never persist a truncated or cancelled answer')
}

for (const parameter of ['max_tokens', 'max_completion_tokens']) {
  for (const [outputTokens, maxOutput, expected] of [
    [800, 8192, 1600], [2600, 8192, 5200], [3200, 8192, 6400],
    [2600, 3000, 3000], [600, 1000, 1000], [512, 512, 512],
  ]) {
    it(`RQA16 wire ${parameter}: ${outputTokens} -> ${expected} with model cap ${maxOutput}`, async () => {
      const run = await runWire({ outputTokens, maxOutput, parameter })
      assert.equal(run.bodies.length, 2)
      assert.equal(run.result.terminal, RunPhase.DONE, JSON.stringify(run.result))
      assert.equal(run.result.text, answer)
      assert.deepEqual(run.persisted, [answer])
      assert.equal(run.bodies[0][parameter], outputTokens)
      assert.equal(run.bodies[1][parameter], expected, 'assert the FINALIZE wire body, not reqPolicy')
      const other = parameter === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'
      for (const body of run.bodies) {
        assert.equal(Object.hasOwn(body, other), false)
        assert.equal(body.model, 'offline-fixture')
        assert.equal(body.stream, true)
      }
      assertAnswerOnly(run)
      assert.equal(run.calls.length, 0)
      assert.deepEqual(run.result.metrics.modelCompletions.map(item => item.finishReason), ['length', 'stop'])
    })
  }
}

for (const mode of ['grounding', 'budget', 'artifact', 'repeated']) {
  it(`RQA16 ${mode} finalization keeps 2400 on the real wire and does not replay tools`, async () => {
    const run = await runWire({ mode })
    assert.equal(run.bodies.length, mode === 'repeated' ? 3 : 2)
    assert.equal(run.result.terminal, RunPhase.DONE, JSON.stringify(run.result))
    assert.equal(run.bodies[0].max_tokens, 2600)
    assert.equal(run.bodies.at(-1).max_tokens, 2400)
    assertAnswerOnly(run)
    assert.equal(run.calls.length, mode === 'grounding' ? 0 : 1)
    if (mode !== 'grounding') assert.ok(run.bodies[0].tools.some(tool => tool.function.name === 'operation'))
    if (mode === 'artifact') assert.equal(run.result.artifactRefs[0].id, 'fixture-image')
  })
}

it('RQA16 repair after a completed operation retains its receipt and never replays it', async () => {
  const run = await runWire({ mode: 'after-tool' })
  assert.equal(run.bodies.length, 3)
  assert.equal(run.calls.length, 1)
  assert.equal(run.result.terminal, RunPhase.DONE, JSON.stringify(run.result))
  assert.ok(run.bodies[0].tools.some(tool => tool.function.name === 'operation'))
  assertAnswerOnly(run)
  assert.ok(run.bodies[2].messages.some(message => message.role === 'tool'
    && message.content.includes('fixture-operation')), 'successful operation receipt survives repair')
  assert.equal(run.bodies[2].max_tokens, 5200)
})

for (const finalFinish of ['length', 'max_tokens']) {
  it(`RQA16 second ${finalFinish} blocks without third request or answer commit`, async () => {
    const run = await runWire({ finalFinish })
    assert.equal(run.bodies.length, 2)
    assert.equal(run.calls.length, 0)
    assertAnswerOnly(run)
    assertBlocked(run)
    assert.equal(run.result.terminal, RunPhase.ERROR)
    assert.equal(run.bodies[1].max_tokens, 5200)
  })
}

it('RQA16 a FINALIZE tool request cannot execute or commit as an answer', async () => {
  const run = await runWire({ steps: [reply('Unfinished', 'length'), reply('', 'tool_calls', [operation('forbidden')])] })
  assert.equal(run.bodies.length, 2)
  assert.equal(run.calls.length, 0)
  assertAnswerOnly(run)
  assertBlocked(run)
})

it('RQA16 cancellation at repair transport preserves signal and commits nothing', async () => {
  const run = await runWire({ cancel: true })
  assert.equal(run.bodies.length, 2)
  assert.equal(run.calls.length, 0)
  assertAnswerOnly(run)
  assertBlocked(run)
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
})

it('RQA16 pre-aborted execution never reaches the provider or tools', async () => {
  const run = await runWire({ mode: 'pre-cancel' })
  assert.equal(run.bodies.length, 0)
  assert.equal(run.calls.length, 0)
  assertBlocked(run)
  assert.equal(run.result.terminal, RunPhase.CANCELLED)
})

it('RQA16 a complete first answer uses its original wire budget without FINALIZE', async () => {
  const run = await runWire({ mode: 'stop' })
  assert.equal(run.bodies.length, 1)
  assert.equal(run.bodies[0].max_tokens, 2600)
  assert.equal(run.result.terminal, RunPhase.DONE, JSON.stringify(run.result))
  assert.deepEqual(run.persisted, [answer])
  assert.deepEqual(run.result.metrics.modelCompletions.map(item => item.finishReason), ['stop'])
})

// Direct adapter boundary cases cannot be produced by the executor, which
// always supplies a resolved per-call outputTokens. No invalid-policy inputs.
for (const fixture of [
  { label: 'finalize missing request allowance retains legacy 2400', finalize: true,
    baseCap: 8192, request: { maxOutput: 8192 }, expected: 2400 },
  { label: 'initial missing request allowance uses base 2600', finalize: false,
    baseCap: 8192, request: { maxOutput: 8192 }, expected: 2600 },
  { label: 'finalize larger request cap cannot widen base cap', finalize: true,
    baseCap: 3000, request: { outputTokens: 5200, maxOutput: 16000 }, expected: 3000 },
  { label: 'initial larger request cap cannot widen base cap', finalize: false,
    baseCap: 3000, request: { outputTokens: 5200, maxOutput: 16000 }, expected: 3000 },
  { label: 'finalize smaller request cap remains authoritative', finalize: true,
    baseCap: 8192, request: { outputTokens: 5200, maxOutput: 1000 }, expected: 1000 },
  { label: 'initial smaller request cap remains authoritative', finalize: false,
    baseCap: 8192, request: { outputTokens: 5200, maxOutput: 1000 }, expected: 1000 },
]) {
  it(`RQA16 direct adapter: ${fixture.label}`, async () => {
    const policy = { outputTokens: 2600, maxOutput: fixture.baseCap, parameter: 'max_tokens', temperature: 0.4 }
    const reqPolicy = { ...fixture.request, parameter: 'max_completion_tokens', temperature: 0.3 }
    const before = structuredClone({ policy, reqPolicy })
    const bodies = []
    const controller = new AbortController()
    const ports = buildProductionRunPorts({ settings: {}, routedModel: { model: 'offline-direct' },
      session: { id: 'offline-direct', messages: [] }, apiMessages: [], policy, signal: controller.signal,
      requestAgentCompletion: async ({ body, signal }) => {
        assert.equal(signal, controller.signal)
        bodies.push(structuredClone(body))
        return { snapshot: { content: answer, finishReason: 'stop', toolCalls: [] } }
      },
    })
    await ports.llm.complete({ messages: [{ role: 'user', content: 'Direct offline boundary.' }],
      policy: reqPolicy, finalize: fixture.finalize })
    assert.equal(bodies.length, 1)
    assert.equal(bodies[0].max_completion_tokens, fixture.expected)
    assert.equal(Object.hasOwn(bodies[0], 'max_tokens'), false, 'request parameter wins over base parameter')
    assert.equal(bodies[0].temperature, 0.3)
    assert.equal(Object.hasOwn(bodies[0], 'tools'), false)
    assert.equal(Object.hasOwn(bodies[0], 'tool_choice'), false)
    assert.deepEqual({ policy, reqPolicy }, before)
  })
}
