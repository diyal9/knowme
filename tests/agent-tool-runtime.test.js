'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createAgentToolRuntime,
  asToolRef,
  findToolName,
  buildToolCapabilityManifest,
  buildToolRuntimeInstruction,
  selectToolDefinitions,
} = require('../src/lib/agent-tool-runtime')

function fakeSurface() {
  const definitions = [
    {
      type: 'function',
      function: { name: 'th_art_probe_psd', description: 'probe', parameters: { type: 'object', properties: {} } },
      _knowme: { toolRef: { id: 'project.th-art.probe-psd', version: '1.0.0' } },
    },
  ]
  return {
    getToolDefinitions: () => definitions,
    getToolRecords: () => definitions.map(def => ({ name: def.function.name, definition: def })),
    isAllowedTool: name => name === 'th_art_probe_psd',
    validateToolCall: (name, raw) => name === 'th_art_probe_psd'
      ? { ok: true, name, args: typeof raw === 'string' ? JSON.parse(raw) : raw }
      : { ok: false, code: 'unknown_tool', message: 'unknown' },
    createToolExecutor: () => ({
      executeToolCall: async call => ({ ok: true, text: `executed:${call.name}` }),
    }),
  }
}

test('toolRef preserves id/version and resolves namespaced project tool', () => {
  const ref = asToolRef({ id: 'project.th-art.probe-psd', version: '1.0.0', name: 'th_art_probe_psd' })
  assert.deepEqual(ref, { id: 'project.th-art.probe-psd', version: '1.0.0', name: 'th_art_probe_psd' })
  assert.equal(findToolName(fakeSurface(), ref), 'th_art_probe_psd')
})

test('Agent Tool Runtime executes toolRef through the common executor and emits receipt', async () => {
  const runtime = await createAgentToolRuntime({
    runId: 'run_test',
    resolveToolSurfaceForRun: async () => ({ mode: 'v1', surface: fakeSurface(), close: async () => {} }),
  })
  const result = await runtime.execute({
    id: 'call_test',
    toolRef: { id: 'project.th-art.probe-psd', version: '1.0.0', name: 'th_art_probe_psd' },
    args: {},
  })
  assert.equal(result.ok, true)
  assert.equal(result.toolName, 'th_art_probe_psd')
  assert.equal(result.receipt.runId, 'run_test')
  assert.equal(result.receipt.status, 'succeeded')
  await runtime.close()
})

test('tool runtime exposes a bounded capability manifest and decision policy', () => {
  const records = [{
    type: 'function',
    function: { name: 'feishu.search_docs', description: 'Search documents' },
    _knowme: { source: 'feishu', capability: 'document-search', risk: 'read', sideEffects: false },
  }, {
    type: 'function',
    function: { name: 'feishu.draft_write_doc', description: 'Draft a document' },
    _knowme: { source: 'feishu', capability: 'document-write', risk: 'write', sideEffects: true, requiresApproval: true },
  }]
  assert.deepEqual(buildToolCapabilityManifest(records).map(item => item.name), [
    'feishu.search_docs', 'feishu.draft_write_doc',
  ])
  const block = buildToolRuntimeInstruction(records)
  assert.equal(block.id, 'tool.runtime-index')
  assert.match(block.content, /document-search/)
  assert.match(block.content, /渐进式装载/)
  assert.match(block.content, /授权|恢复规则/)
  assert.doesNotMatch(block.content, /feishu\.draft_write_doc/)
})

test('tool runtime selects a small intent window and keeps required tools', () => {
  const records = [
    { type: 'function', function: { name: 'search_web', description: '搜索公开网页' }, _knowme: { capability: 'web-search', risk: 'read' } },
    { type: 'function', function: { name: 'feishu.search_docs', description: '搜索飞书文档' }, _knowme: { capability: 'document-search', source: 'feishu', risk: 'read' } },
    { type: 'function', function: { name: 'pango.generate_image', description: '生成图片' }, _knowme: { capability: 'image-generation', source: 'pango', risk: 'write', sideEffects: true } },
    { type: 'function', function: { name: 'write_file', description: '写入文件' }, _knowme: { capability: 'file-write', risk: 'write', sideEffects: true } },
  ]
  const selected = selectToolDefinitions(records, {
    prompt: '请搜索飞书文档中的会议纪要',
    maxTools: 3,
    requiredTools: ['pango.generate_image'],
  })
  assert.deepEqual(selected.selectedNames, ['discover_tools', 'pango.generate_image', 'feishu.search_docs'])
  assert.equal(selected.definitions.length, 3)
})
