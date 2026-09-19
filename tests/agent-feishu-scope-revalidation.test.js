const assert = require('node:assert/strict')
const { test } = require('node:test')
const { guardCapabilityToolSurface } = require('../src/lib/agent-capability-surface-guard')
const { createCapabilityExecutionCheck } = require('../src/lib/agent-capability-execution-check')

test('old Feishu contracts without connectorId revalidate scope, availability and allowlist on cached surfaces', async () => {
  const name = 'feishu.search_docs'
  const def = { type: 'function', function: { name }, _knowme: { source: 'feishu' } }
  let granted = true
  let connectors = [{ id: 'feishu', enabled: true, allowlist: [name] }]
  let calls = 0
  const validate = () => ({ ok: true })
  const raw = { getToolRecords: () => [def], getToolDefinitions: () => [def], isAllowedTool: () => true,
    validateToolCall: validate, createToolExecutor: () => ({ validateToolCall: validate,
      executeToolCall: async () => { calls++; return { ok: true } } }) }
  const surface = guardCapabilityToolSurface(raw, () => ({ connectors, scope: {
    decision: (kind, id) => ({ allowed: kind === 'connectors' && id === 'feishu' && granted }),
  } }))
  const executor = surface.createToolExecutor({})
  assert.equal(surface.isAllowedTool(name), true)
  await executor.executeToolCall({ name })
  for (const revoke of [() => { granted = false }, () => { connectors[0].enabled = false },
    () => { connectors[0].allowlist = [] }, () => { connectors[0].agentVisible = false }, () => { connectors = [] }]) {
    granted = true
    connectors = [{ id: 'feishu', enabled: true, allowlist: [name] }]
    revoke()
    assert.equal(surface.isAllowedTool(name), false)
    assert.equal(executor.isAllowedTool(name), false)
    assert.deepEqual(surface.getToolDefinitions(), [])
    assert.deepEqual(surface.getToolRecords(), [])
    assert.equal(surface.validateToolCall(name, {}).code, 'scope_denied')
    assert.equal((await executor.executeToolCall({ name })).code, 'scope_denied')
  }
  assert.equal(calls, 1)
})

test('deferred Feishu approval uses namespace ownership and the current connector allowlist', () => {
  const session = { id: 's', run: { id: 'r' } }
  const name = 'feishu.search_docs'
  const contract = { source: 'feishu', capability: 'search', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false }
  let granted = true
  const connector = { id: 'feishu', enabled: true, allowlist: [name] }
  const check = createCapabilityExecutionCheck({ session, runId: 'r', getSession: () => session,
    getState: () => ({ scope: { decision: () => ({ allowed: granted }) } }), getConnectors: () => [connector] })
  const request = { toolName: name, contract, runId: 'r', sessionId: 's' }
  assert.equal(check(request).ok, true)
  connector.allowlist = []
  assert.equal(check(request).ok, false)
  connector.allowlist = [name]
  granted = false
  assert.equal(check(request).ok, false)
  granted = true
  connector.enabled = false
  assert.equal(check(request).ok, false)
})
