'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { buildToolSurfaceFromRegistry } = require('../src/lib/tool-surface-builder')
const { buildConnectorToolSurface } = require('../src/lib/connectors/tool-runtime')
const { guardCapabilityToolSurface } = require('../src/lib/agent-capability-surface-guard')
const { createCapabilityExecutionCheck } = require('../src/lib/agent-capability-execution-check')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')
const { pendingRequiredMcpSchema } = require('../src/lib/agent-required-mcp-schema')
const { evaluateRequiredTools } = require('../src/lib/agent-grounding-runtime')
const { clearLazyMcpSchemaCache } = require('../src/lib/connectors/lazy-mcp-projection')

async function coldFixture(t, count = 500) {
  clearLazyMcpSchemaCache()
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-cold-rounds-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const connectors = Array.from({ length: count }, (_, index) => ({ id: `c${index}`, name: `Catalog ${index}`, type: 'mcp',
    enabled: true, agentVisible: true, mcp: { command: 'mock' }, allowlist: ['echo'],
    toolPolicies: [{ match: '*', risk: 'read', sideEffects: false, requiresApproval: false }] }))
  const activity = { connect: [], list: [], execute: [] }
  const mcpRegistry = {
    async connect(id) {
      activity.connect.push(id)
      if (id !== `c${count - 1}`) throw new Error('Unselected offline connector must never connect')
      return { async listTools() { activity.list.push(id); return { ok: true, tools: [{ name: 'echo', description: 'Read exact item',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }] } },
      async callTool(name, args) { activity.execute.push({ id, name, args }); return { ok: true, text: 'Exact read completed.' } } }
    },
    async disconnect() {},
  }
  const registry = createRegistry()
  const runtime = await buildConnectorToolSurface(userData, { registry, mcpRegistry,
    connectorStore: { migrateLegacy() {}, loadConnectors: () => connectors }, includeSystemFeishu: false })
  t.after(() => runtime.close())
  let allowed = true
  const session = { id: 'session', agentId: 'general', run: { id: 'run', status: 'running' } }
  const getState = () => ({ connectors, availableConnectorIds: connectors.map(connector => connector.id), governancePolicy: {},
    scope: resolveAgentCapabilityScope({ session, permissions: { allowedConnectorIds: allowed ? connectors.map(connector => connector.id) : [] } }),
  })
  const validateExecutionApproval = createCapabilityExecutionCheck({ session, runId: 'run', getSession: () => session,
    getState, getConnectors: () => connectors })
  const built = buildToolSurfaceFromRegistry(registry, { userData, runId: 'run', sessionId: 'session',
    validateExecutionApproval,
  })
  const surface = guardCapabilityToolSurface(built.surface, getState)
  // Construct executor BEFORE activation: it must still dispatch newly registered tools.
  const executor = surface.createToolExecutor({})
  return { surface, executor, activity, getState, revoke: () => { allowed = false } }
}

for (const formal of [false, true]) test(`500 cold MCP connectors: ${formal ? 'formal required operation' : 'ordinary discovery'} selects loader then next-round schema without unselected connects`, async t => {
  const cold = await coldFixture(t)
  assert.equal(cold.surface.getToolRecords().filter(record => record._knowme?.mcpSchemaLoader).length, 500)
  assert.deepEqual(cold.activity.connect, [])
  const script = [
    { response: { toolCalls: [{ name: 'discover_tools', arguments: { query: formal ? 'mcp.c499.echo' : 'c499' } }] } },
    { response: { toolCalls: [{ name: 'mcp_load_c499', arguments: {} }] } },
    { response: { toolCalls: [{ name: 'mcp.c499.echo', arguments: { query: 'exact item' } }] } },
    { response: { text: 'Exact read completed.' } },
  ]
  const input = { prompt: 'Help with this task', tier: 'assist', ...(formal ? {
    conversationMode: 'expert-execution', executionContract: { requiredTools: ['mcp.c499.echo'] },
  } : {}) }
  const ports = createMockRunPorts({ input, llmScript: script })
  ports.tools.surface = cold.surface
  ports.tools.execute = cold.executor.executeToolCall
  if (formal) {
    const dependency = pendingRequiredMcpSchema('mcp.c499.echo', cold.surface, cold.getState())
    assert.equal(dependency?.loaderToolName, 'mcp_load_c499')
    assert.equal(cold.surface.isAllowedTool('mcp.c499.echo'), false)
    const build = ports.context.build
    ports.context.build = async () => ({ ...await build(), contextInfo: { pendingRequiredToolSchemas: [dependency] } })
  }
  const complete = ports.llm.complete
  let round = 0
  ports.llm.complete = request => {
    const names = request.tools?.map(tool => tool.function.name) || []
    assert.ok(names.length <= 16)
    for (const call of script[round]?.response?.toolCalls || []) assert.ok(names.includes(call.name), `${call.name} not offered on round ${round}`)
    if (round < 2) assert.ok(!names.includes('mcp.c499.echo'))
    if (formal && round === 0) assert.ok(names.includes('mcp_load_c499'), 'only the exact host-authorized loader dependency is prioritized')
    if (formal && round <= 2) assert.equal(evaluateRequiredTools(input.executionContract, ports.grounding.getToolLedger()).satisfied, false,
      'discovery and schema activation are not successful execution of the required operation')
    if (round === 1) assert.deepEqual(cold.activity.connect, [])
    round++
    return complete(request)
  }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.terminal, 'DONE', result.error)
  assert.deepEqual(cold.activity.connect, ['c499'])
  assert.deepEqual(cold.activity.list, ['c499'])
  assert.deepEqual(cold.activity.execute, [{ id: 'c499', name: 'echo', args: { query: 'exact item' } }])
  assert.equal(result.metrics.schemaActivations, 1)
  assert.ok(cold.surface.isAllowedTool('mcp.c499.echo'))
  if (formal) assert.ok(result.executionEvidence.toolCalls.some(call => call.name === 'mcp.c499.echo' && call.status === 'ok'))
})

test('revocation after discovery rejects previously offered MCP loader before any connect', async t => {
  const cold = await coldFixture(t, 1)
  assert.ok(cold.surface.isAllowedTool('mcp_load_c0'))
  cold.revoke()
  const result = await cold.executor.executeToolCall({ name: 'mcp_load_c0', arguments: {} })
  assert.equal(result.ok, false)
  assert.equal(result.executionStarted, false)
  assert.deepEqual(cold.activity.connect, [])
})
