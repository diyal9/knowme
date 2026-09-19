const assert = require('node:assert/strict')
const { test } = require('node:test')
const { guardCapabilityToolSurface } = require('../src/lib/agent-capability-surface-guard')

function fixture() {
  const records = new Map()
  let calls = 0
  let reads = 0
  let stateReads = 0
  const state = { scope: { decision: (_kind, id) => ({ allowed: id === 'docs' }) },
    connectors: [{ id: 'docs', type: 'mcp', enabled: true, allowlist: ['search'] }], governancePolicy: {} }
  const validate = name => records.has(name) ? { ok: true } : { ok: false, code: 'unknown_tool' }
  const raw = { getToolRecords: () => { reads++; return [...records.values()] },
    getToolDefinitions: () => [...records.values()].map(({ type, function: fn }) => ({ type, function: fn })),
    isAllowedTool: name => records.has(name), validateToolCall: validate,
    createToolExecutor: () => ({ validateToolCall: validate, executeToolCall: async call => {
      const result = validate(call.name)
      if (result.ok) calls++
      return result
    } }) }
  const surface = guardCapabilityToolSurface(raw, () => { stateReads++; return state })
  const executor = surface.createToolExecutor({})
  const activate = (id = 'docs') => records.set('mcp_docs_search', { type: 'function',
    function: { name: 'mcp_docs_search', parameters: { type: 'object' } },
    _knowme: { source: 'mcp', connectorId: id, rawToolName: 'search' } })
  return { records, state, surface, executor, activate, calls: () => calls,
    reads: () => reads, stateReads: () => stateReads }
}

test('an executor created before activation accepts a selected dynamic tool and guards later revocation', async () => {
  const f = fixture()
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).code, 'unknown_tool')
  assert.deepEqual(f.surface.getToolRecords(), [])
  f.activate()
  assert.equal(f.surface.isAllowedTool('mcp_docs_search'), true)
  assert.equal(f.executor.isAllowedTool('mcp_docs_search'), true)
  assert.equal(f.surface.getToolDefinitions().length, 1)
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).ok, true)
  const reads = f.reads(), stateReads = f.stateReads()
  assert.equal(f.surface.getToolRecords().length, 1)
  assert.equal(f.reads() - reads, 1)
  assert.equal(f.stateReads() - stateReads, 1)
  for (const deny of [() => { f.state.scope.noTools = true },
    () => { f.state.governancePolicy.denylist = ['mcp_docs_search'] },
    () => { f.state.connectors[0].enabled = false },
    () => { f.state.connectors[0].allowlist = [] }]) {
    f.state.scope.noTools = false
    f.state.governancePolicy = {}
    f.state.connectors[0] = { id: 'docs', type: 'mcp', enabled: true, allowlist: ['search'] }
    deny()
    assert.equal(f.surface.isAllowedTool('mcp_docs_search'), false)
    assert.deepEqual(f.surface.getToolRecords(), [])
    assert.equal(f.executor.validateToolCall('mcp_docs_search', {}).code, 'scope_denied')
    assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).code, 'scope_denied')
  }
  assert.equal(f.calls(), 1)
})

test('dynamic activation cannot bypass fresh scope on first direct dispatch; replacement uses fresh contract', async () => {
  const f = fixture()
  f.activate('unbound')
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).code, 'scope_denied')
  f.activate()
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).ok, true)
  f.activate('unbound')
  assert.equal(f.surface.validateToolCall('mcp_docs_search', {}).code, 'scope_denied')
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).code, 'scope_denied')
  f.records.clear()
  assert.equal((await f.executor.executeToolCall({ name: 'mcp_docs_search' })).code, 'scope_denied')
  assert.equal((await f.executor.executeToolCall({ name: 'never_registered' })).code, 'unknown_tool')
  assert.equal(f.calls(), 1)
})

test('only the exact host schema loader bypasses raw-operation names, never scope or hard policy', () => {
  const f = fixture()
  const name = 'mcp_load_docs'
  const contract = { source: 'mcp', connectorId: 'docs', mcpSchemaLoader: true, capability: 'mcp-schema:docs',
    risk: 'read', sideEffects: false, requiresApproval: false }
  const put = (toolName, metadata) => f.records.set(toolName, { type: 'function', function: { name: toolName }, _knowme: metadata })
  put(name, contract)
  assert.equal(f.surface.isAllowedTool(name), true)
  for (const changed of [{ mcpSchemaLoader: false }, { rawToolName: 'delete' }, { sideEffects: true },
    { requiresApproval: true }, { capability: 'connector:docs' }]) {
    put(name, { ...contract, ...changed })
    assert.equal(f.surface.isAllowedTool(name), false)
  }
  put('mcp.docs.delete', { ...contract, rawToolName: 'delete' })
  assert.equal(f.surface.isAllowedTool('mcp.docs.delete'), false)
  put(name, contract)
  f.state.governancePolicy.allowlist = ['mcp.docs.search']
  assert.equal(f.surface.isAllowedTool(name), false)
  f.state.governancePolicy = {}
  f.state.connectors[0].allowlist = []
  assert.equal(f.surface.isAllowedTool(name), false)
  f.state.connectors[0].allowlist = ['search']
  f.state.scope.decision = () => ({ allowed: false })
  assert.equal(f.surface.isAllowedTool(name), false)
})
