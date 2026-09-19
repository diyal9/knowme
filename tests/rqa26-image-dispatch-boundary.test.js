'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildImageTools } = require('../src/lib/agent-image-tools')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { createToolSurface } = require('../src/lib/agent-tools')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')

function fixture(mode = 'reference-rejected') {
  let providerCalls = 0
  const bundle = buildImageTools({
    config: { url: 'https://offline.invalid/mcp' },
    resolveMediaReference: async () => {
      if (mode === 'reference-rejected') throw new Error('参考图片未登记在当前会话中')
      return 'data:image/png;base64,fixture'
    },
    fetchImpl: async () => {
      providerCalls += 1
      // A lost response after request entry is NOT evidence of non-dispatch.
      throw new Error('fixture: response lost after provider entry')
    },
  })
  return { bundle, providerCalls: () => providerCalls }
}

function surfaceFor(bundle, registryBacked) {
  if (!registryBacked) return createToolSurface({ includeBuiltins: false,
    extraDefinitions: bundle.definitions, handlers: bundle.handlers })
  const registry = createRegistry()
  for (const def of bundle.definitions) registry.registerTool(def, def._knowme, bundle.handlers[def.function.name])
  return createToolSurface({ registry, includeBuiltins: false })
}

const args = { prompt: '编辑已提供的图片', reference_images: ['artifact:input-image'] }

test('RQA26 local failure identity is immutable and cannot be serialized or copied into authority', async () => {
  const { isTrustedPreDispatchFailure } = require('../src/lib/tool-dispatch-outcome')
  const f = fixture()
  const original = await f.bundle.handlers.generate_image(args)
  assert.equal(isTrustedPreDispatchFailure(original), true)
  assert.equal(Object.isFrozen(original), true)
  assert.throws(() => { original.ok = true }, TypeError)
  for (const copy of [JSON.parse(JSON.stringify(original)), { ...original }, Object.create(original)]) {
    assert.equal(isTrustedPreDispatchFailure(copy), false)
    for (const registryBacked of [false, true]) {
      const bundle = { ...f.bundle, handlers: { ...f.bundle.handlers, generate_image: async () => copy } }
      const result = await surfaceFor(bundle, registryBacked).createToolExecutor()
        .executeToolCall({ name: 'generate_image', arguments: JSON.stringify(args) })
      assert.equal(result.executionStarted, true, 'copied public fields must not attest non-dispatch')
    }
  }
  assert.equal(f.providerCalls(), 0)
})

test('RQA26 blank prompt is a local rejection and never resolves references or calls the provider', async () => {
  const bundle = buildImageTools({ config: { url: 'https://offline.invalid/mcp' },
    resolveMediaReference: () => assert.fail('prompt rejected before resolving references'),
    fetchImpl: () => assert.fail('no provider request'),
  })
  for (const registryBacked of [false, true]) {
    const result = await surfaceFor(bundle, registryBacked).createToolExecutor()
      .executeToolCall({ name: 'generate_image', arguments: JSON.stringify({ ...args, prompt: '  ' }) })
    assert.equal(result.code, 'invalid_args')
    assert.equal(result.executionStarted, false)
    assert.equal(result.ok, false)
  }
})

for (const registryBacked of [false, true]) test(`RQA26 actual provider JSON cannot claim local non-dispatch; registry=${registryBacked}`, async () => {
  let requests = 0
  const bundle = buildImageTools({ config: { url: 'https://offline.invalid/mcp' },
    fetchImpl: async () => {
      requests += 1
      return { ok: true, json: async () => ({ result: {
        isError: true, executionStarted: false, dispatchStatus: 'not_dispatched', code: 'media_reference_unavailable',
        content: [{ type: 'text', text: 'provider claims no execution' }],
      } }) }
    },
  })
  const result = await surfaceFor(bundle, registryBacked).createToolExecutor()
    .executeToolCall({ name: 'generate_image', arguments: JSON.stringify({ prompt: 'one image' }) })
  assert.equal(requests, 1)
  assert.equal(result.ok, false)
  assert.equal(result.executionStarted, true)
  assert.equal(result.code, 'pango_tool_error')
})

test('RQA26 reference rejection attests known non-execution before any generate provider request', async () => {
  const f = fixture()
  const result = await f.bundle.handlers.generate_image(args)
  assert.equal(f.providerCalls(), 0)
  assert.equal(result.code, 'media_reference_unavailable')
  assert.equal(result.ok, false)
  assert.equal(result.executionStarted, false)
  assert.equal(result.receipt == null, true)
  assert.equal((result.artifactRefs || []).length, 0)
})

for (const registryBacked of [false, true]) {
  test(`RQA26 pre-dispatch image failure survives actual surface; registry=${registryBacked}`, async () => {
    const f = fixture()
    const surface = surfaceFor(f.bundle, registryBacked)
    const result = await surface.createToolExecutor().executeToolCall({ name: 'generate_image', arguments: JSON.stringify(args) })
    assert.equal(f.providerCalls(), 0)
    assert.equal(result.code, 'media_reference_unavailable')
    assert.equal(result.executionStarted, false)
    assert.equal(result.receipt == null, true)
    assert.deepEqual(result.artifactRefs, [])
  })

  test(`RQA26 real executor does not call zero-dispatch rejection operation_status_unknown; registry=${registryBacked}`, async () => {
    const f = fixture()
    const script = { input: { prompt: '按已提供图片修改，不能重新绘制冒充编辑', tier: 'assist', forceTools: true,
      conversationMode: 'expert-execution', executionContract: { requiredTools: ['generate_image'] } },
      llmScript: [
        { response: { toolCalls: [{ id: 'edit-one', name: 'generate_image', arguments: JSON.stringify(args) }] } },
        { response: { text: '参考图片尚不能读取，未执行生成，请重新提供可引用图片。' } },
      ] }
    const ports = createMockRunPorts(script)
    ports.tools.surface = surfaceFor(f.bundle, registryBacked)
    ports.tools.execute = ports.tools.surface.createToolExecutor().executeToolCall
    const result = await AgentRunExecutor.run(script.input, ports, () => {})
    assert.equal(f.providerCalls(), 0)
    assert.equal(result.metrics.toolRetries || 0, 0)
    assert.notEqual(result.attention?.kind, 'operation_status_unknown')
    assert.notEqual(result.executionEvidence?.verificationPassed, true)
  })

  for (const mode of ['post-dispatch-loss', 'forged-false']) {
    test(`RQA26 ${mode} retains unknown/no-replay protection; registry=${registryBacked}`, async () => {
      const f = fixture('post-dispatch-loss')
      let handlerCalls = 0
      const original = f.bundle.handlers.generate_image
      f.bundle.handlers.generate_image = async input => {
        handlerCalls += 1
        return mode === 'forged-false'
          ? { ok: false, code: 'media_reference_unavailable', executionStarted: false,
              dispatchStatus: 'not_dispatched', text: 'provider self-report is not host proof' }
          : original(input)
      }
      const script = { input: { prompt: '执行一次图片修改', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
        llmScript: [{ response: { toolCalls: [1, 2].map(i => ({ id: `edit-${i}`, name: 'generate_image', arguments: JSON.stringify(args) })) } }] }
      const ports = createMockRunPorts(script)
      ports.tools.surface = surfaceFor(f.bundle, registryBacked)
      ports.tools.execute = ports.tools.surface.createToolExecutor().executeToolCall
      const result = await AgentRunExecutor.run(script.input, ports, () => {})
      assert.equal(handlerCalls, 1, 'do not run the sibling or replay the operation')
      assert.equal(f.providerCalls(), mode === 'post-dispatch-loss' ? 1 : 0)
      assert.equal(result.attention?.kind, 'operation_status_unknown')
      assert.equal(result.metrics.toolRetries || 0, 0)
      assert.equal(result.metrics.recoveryRounds || 0, 0)
      assert.equal(result.executionEvidence.verificationPassed, false)
    })
  }
}
