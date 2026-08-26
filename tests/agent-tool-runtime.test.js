'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createAgentToolRuntime, asToolRef, findToolName } = require('../src/lib/agent-tool-runtime')

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
