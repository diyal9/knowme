'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const ledger = require('../src/lib/agent-grounding-ledger')
const { hydrateDeliverableContracts } = require('../src/lib/expert-execution-profile')
const { createToolSurface } = require('../src/lib/agent-tools-surface')
const { createAgentToolRuntime } = require('../src/lib/agent-tool-runtime')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { wrapEnvelope } = require('../src/lib/tool-contract-governance')

test('production surface and runtime preserve receipts all the way to final grounding', async () => {
  const toolName = 'provider_render'
  const output = { ok: true, text: '已生成图片。',
    artifactRefs: [{ id: 'asset-1', type: 'image', targetPath: 'C:/outputs/image.png' }],
    receipt: { effects: [{ type: 'save', target: 'asset-1' }] } }
  const surface = createToolSurface({
    includeBuiltins: false, MAX_TOOL_RESULT_CHARS: 12000,
    extraDefinitions: [{ type: 'function', function: { name: toolName, description: 'render', parameters: { type: 'object', properties: {} } } }],
    handlers: { [toolName]: async () => wrapEnvelope(output) },
  })
  const runtime = await createAgentToolRuntime({ runId: 'receipt-integration',
    resolveToolSurfaceForRun: async () => ({ surface }) })
  const fixture = {
    input: { prompt: '生成图片', tier: 'assist', forceTools: true,
      executionContract: { requiredTools: [toolName], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 } },
    llmScript: [
      { response: { toolCalls: [{ name: toolName, arguments: {} }] } },
      { response: { text: '图片已保存，可以预览。' } },
    ],
  }
  const ports = createMockRunPorts(fixture)
  ports.tools.definitions = surface.getToolDefinitions()
  ports.tools.validate = surface.validateToolCall
  ports.tools.execute = runtime.execute
  let observed = false
  ports.media = { observeArtifacts: async artifacts => {
    observed = artifacts[0].id === 'asset-1'
    return [{ type: 'image_url', image_url: { url: 'https://example.test/real-shaped-output.png' } }]
  } }
  const complete = ports.llm.complete
  ports.llm.complete = async args => {
    if (args.finalize) assert.ok(args.messages.some(message => Array.isArray(message.content)
      && message.content.some(item => item.type === 'image_url')))
    return complete(args)
  }
  const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
  assert.equal(observed, true)
  assert.equal(result.executionEvidence.verificationPassed, true, JSON.stringify(result.executionEvidence))
  assert.match(result.text, /已保存/)
  assert.equal(result.artifactRefs[0].id, 'asset-1')
})

test('successful generation plus persisted artifact supports save without name-based exceptions', () => {
  for (const toolName of ['generate_image', 'custom_provider.execute', 'render_asset']) {
    const merged = ledger.mergeToolResultsIntoLedgers({ toolMessages: [{
      toolName, toolCallId: 'real-shaped-call', status: 'done',
      text: '已生成 1 张图片，预览已附在成果区。',
      artifactRefs: [{ id: 'image-1', type: 'image', targetPath: 'C:/outputs/logo.png' }],
      receipt: { effects: [{ type: 'save', target: 'image-1' }] },
    }] })
    const verification = ledger.verifyClaims({ text: '图片已保存，可以点击预览。', ...merged })
    assert.equal(verification.passed, true, JSON.stringify(verification.violations))
    assert.equal(ledger.verifyClaims({ text: '已修改代码。', ...merged }).passed, false)
  }
})

test('failed calls, missing artifact receipts and prose alone cannot prove save', () => {
  for (const override of [
    { status: 'error' }, { artifactRefs: [] }, { receipt: null },
    { receipt: { effects: [{ type: 'save', target: 'another-artifact' }] } },
  ]) {
    const merged = ledger.mergeToolResultsIntoLedgers({ toolMessages: [{
      toolName: 'custom_provider.execute', toolCallId: 'call', status: 'done', text: '图片已保存。',
      artifactRefs: [{ id: 'image-1', targetPath: 'C:/outputs/logo.png' }],
      receipt: { effects: [{ type: 'save', target: 'image-1' }] }, ...override,
    }] })
    assert.equal(ledger.verifyClaims({ text: '图片已保存。', ...merged }).passed, false)
  }
})

test('structured results are evidence independent of tool identity, while thin documents remain blocked', () => {
  for (const text of ['[{"id":"model-a"}]', '{"counts":{"created":1}}', '{"measurements":[2,3]}']) {
    assert.equal(ledger.classifyToolResultQuality('any.tool', { text }).status, 'ok')
  }
  for (const text of ['[]', '{}', '{"ok":true}', '{"items":[]}']) {
    assert.equal(ledger.classifyToolResultQuality('any.tool', { text }).status, 'empty')
  }
  assert.equal(ledger.classifyToolResultQuality('any.tool', { text: '{"title":"文档"}' }).status, 'truncated')
  assert.equal(ledger.classifyToolResultQuality('any.tool', { text: '{"ok":false,"items":[1]}' }).status, 'fail')
})

test('a save-claim mismatch is not falsely presented as a meeting read failure', () => {
  const gate = ledger.applyOutputGate({
    text: '图片已保存', regenUsed: true,
    verification: { passed: false, violations: [{ code: 'unsupported_execution_claim' }] },
    taskFrame: { requiredTools: ['generate_image'] },
  })
  assert.doesNotMatch(gate.text, /会议|读取|重新选择候选/)
  assert.match(gate.text, /操作凭据/)
})

test('persisted deliverable contracts remain idempotent over repeated hydration', () => {
  const spec = { id: 'asset', type: 'image', requiredTools: ['any.tool'],
    requiredEvidence: [{ kind: 'tool_result', tool: 'any.tool' }],
    requiredArtifacts: [{ type: 'image', minCount: 2 }],
    completionConditions: [{ type: 'tool_success', tool: 'any.tool' }], minArtifacts: 2 }
  const snapshot = { capabilityManifest: { metadata: { knowme: { execution: { deliverables: [spec] } } } } }
  let brief = { deliverables: [{ ...spec, requiredEvidence: Array(16).fill(spec.requiredEvidence[0]) }] }
  for (let i = 0; i < 20; i += 1) brief = hydrateDeliverableContracts(brief, snapshot)
  assert.deepEqual(brief.deliverables[0].requiredEvidence, spec.requiredEvidence)
  assert.deepEqual(brief.deliverables[0].requiredArtifacts, spec.requiredArtifacts)
  assert.deepEqual(brief.deliverables[0].completionConditions, [
    ...spec.completionConditions,
    { type: 'artifact_present' },
  ])
  assert.equal(brief.deliverables[0].minArtifacts, 2)
})
