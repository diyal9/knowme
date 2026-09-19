'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { buildConnectorToolSurface } = require('../src/lib/connectors/tool-runtime')
const { buildToolSurfaceFromRegistry } = require('../src/lib/tool-surface-builder')
const { guardCapabilityToolSurface } = require('../src/lib/agent-capability-surface-guard')
const { discoverAuthorizedTools } = require('../src/lib/agent-tool-discovery')
const { clearLazyMcpSchemaCache } = require('../src/lib/connectors/lazy-mcp-projection')

function connector(id, count = 1) {
  return { id, name: `Catalog ${id}`, type: 'mcp', enabled: true, agentVisible: true,
    mcp: { command: 'mock', env: { SECRET: 'never-in-metadata' } },
    allowlist: Array.from({ length: count }, (_, index) => `tool_${index}`),
    toolPolicies: [{ match: '*', risk: 'read', sideEffects: false, requiresApproval: false }] }
}

async function fixture(t, connectors, options = {}) {
  clearLazyMcpSchemaCache()
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-cold-mcp-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const calls = { connect: [], list: [], execute: [], close: [] }
  const host = { async connect(id) {
    calls.connect.push(id)
    if (id === 'offline') throw new Error('private connection diagnostic')
    return { async listTools() {
      calls.list.push(id)
      await options.beforeList?.(id)
      return { ok: true, tools: connectors.find(conn => conn.id === id).allowlist.map(name => ({ name,
        inputSchema: { type: 'object', properties: { remote_schema_sentinel: { type: 'string' } } },
        _knowme: { mcpSchemaLoader: true } })) }
    }, async callTool(name, args) { calls.execute.push([id, name, args]); return { ok: true, text: 'real operation output' } } }
  }, async disconnect(id) { calls.close.push(id) } }
  let authorized = true
  const registry = createRegistry()
  const runtime = await buildConnectorToolSurface(userData, { registry, mcpRegistry: host,
    connectorStore: { migrateLegacy() {}, loadConnectors: () => connectors }, mcpTimeoutMs: 1000 })
  t.after(() => runtime.close())
  let validatorCalls = 0
  const validateExecutionApproval = async () => { validatorCalls++; return { ok: authorized } }
  const built = buildToolSurfaceFromRegistry(registry, { userData, runId: 'run', sessionId: 'session', validateExecutionApproval })
  const surface = guardCapabilityToolSurface(built.surface, () => ({
    scope: { noTools: !authorized, decision: () => ({ allowed: authorized }) }, connectors,
    governancePolicy: {},
  }))
  return { calls, registry, surface, connectors, validatorCalls: () => validatorCalls, revoke: () => { authorized = false },
    executor: surface.createToolExecutor(), runtime }
}

test('strict 500 cold connector catalog pages metadata without a single connection, including offline', async t => {
  const connectors = Array.from({ length: 499 }, (_, index) => connector(`catalog_${index}`))
  connectors.push(connector('offline'))
  const f = await fixture(t, connectors)
  const initial = f.surface.getToolRecords().filter(def => def._knowme.source === 'mcp')
  assert.equal(initial.length, 500)
  assert.ok(initial.every(def => def._knowme.mcpSchemaLoader === true))
  assert.doesNotMatch(JSON.stringify(initial), /remote_schema_sentinel|never-in-metadata/)
  const found = new Set()
  let cursor = 0
  do {
    const result = discoverAuthorizedTools(f.surface, { query: '', cursor, limit: 16 })
    for (const item of result.discovery.tools) if (item.name.startsWith('mcp_load_')) found.add(item.name)
    cursor = result.discovery.nextCursor
  } while (cursor !== null)
  assert.equal(found.size, 500)
  assert.equal(f.calls.connect.length, 0)
  assert.equal(f.calls.list.length, 0)
  const selected = await f.executor.executeToolCall({ name: 'mcp_load_catalog_498', arguments: '{}' })
  assert.equal(selected.ok, true)
  assert.ok(f.validatorCalls() >= 2, 'host validator reaches loader before and after discovery')
  assert.deepEqual(f.calls.connect, ['catalog_498'])
  assert.deepEqual(f.calls.list, ['catalog_498'])
  assert.equal(f.calls.execute.length, 0)
  assert.ok(f.registry.has('mcp.catalog_498.tool_0'))
  assert.ok(f.surface.getToolRecords().some(def => def.function.name === 'mcp.catalog_498.tool_0'))
  assert.equal((await f.executor.executeToolCall({ name: 'mcp.catalog_498.tool_0', arguments: '{}' })).ok, true)
  assert.equal(f.calls.execute.length, 1)
  assert.equal(f.calls.connect.includes('offline'), false)
})

test('selected 500-tool schema registers every authorized record in the existing registry and existing executor', async t => {
  const f = await fixture(t, [connector('selected', 500), connector('offline')])
  assert.equal(f.registry.list().length, 2)
  assert.equal((await f.executor.executeToolCall({ name: 'mcp.selected.tool_499', arguments: '{}' })).code, 'unknown_tool')
  const result = await f.executor.executeToolCall({ name: 'mcp_load_selected', arguments: '{}' })
  assert.equal(result.ok, true)
  assert.equal(result.meta.totalTools, 500)
  assert.equal(result.meta.loadedToolNames.length, 16)
  assert.equal(f.registry.list().length, 502)
  const records = f.surface.getToolRecords().filter(def => def._knowme.rawToolName)
  assert.equal(records.length, 500)
  assert.ok(records.every(def => def._knowme.mcpSchemaLoader === false))
  const discovered = discoverAuthorizedTools(f.surface, { query: 'mcp.selected.tool_499', limit: 16 })
  assert.ok(discovered.discovery.tools.some(row => row.name === 'mcp.selected.tool_499'))
  assert.equal((await f.executor.executeToolCall({ name: 'mcp.selected.tool_499', arguments: '{}' })).ok, true)
  assert.deepEqual(f.calls.execute.map(row => row.slice(0, 2)), [['selected', 'tool_499']])
  assert.deepEqual(f.calls.connect, ['selected'])
  const selectedAgain = await f.executor.executeToolCall({ name: 'mcp_load_selected', arguments: '{}' })
  assert.equal(selectedAgain.ok, true)
  assert.deepEqual(f.calls.list, ['selected'])
  const failed = await f.executor.executeToolCall({ name: 'mcp_load_offline', arguments: '{}' })
  assert.equal(failed.ok, false)
  assert.doesNotMatch(failed.text, /private connection diagnostic/)
  assert.equal((await f.executor.executeToolCall({ name: 'mcp.selected.tool_499', arguments: '{}' })).ok, true)
})

for (const mutation of ['revoke', 'disable', 'configuration', 'cancel']) {
  test(`selected discovery ${mutation} before completion never registers or exposes remote schemas`, async t => {
    let release
    let started
    const entered = new Promise(resolve => { started = resolve })
    const pending = new Promise(resolve => { release = resolve })
    const f = await fixture(t, [connector('selected'), connector('offline')], {
      beforeList: async () => { started(); await pending },
    })
    const controller = new AbortController()
    const loading = f.executor.executeToolCall({ name: 'mcp_load_selected', arguments: '{}', signal: controller.signal })
    let admissionTimer
    try {
      await Promise.race([entered, new Promise((_, reject) => {
        admissionTimer = setTimeout(() => reject(new Error('Loader never entered discovery')), 2000)
      })])
    } finally { clearTimeout(admissionTimer) }
    if (mutation === 'revoke') f.revoke()
    if (mutation === 'disable') f.connectors[0].enabled = false
    if (mutation === 'configuration') f.connectors[0].mcp.command = 'changed'
    if (mutation === 'cancel') controller.abort()
    release()
    const result = await loading
    assert.equal(result.ok, false)
    assert.equal(f.registry.has('mcp.selected.tool_0'), false)
    assert.equal(f.calls.execute.length, 0)
    assert.equal(f.calls.connect.includes('offline'), false)
  })
}

test('unselected cold connector denied by scope never starts discovery', async t => {
  const f = await fixture(t, [connector('selected')])
  f.revoke()
  const result = await f.executor.executeToolCall({ name: 'mcp_load_selected', arguments: '{}' })
  assert.equal(result.code, 'scope_denied')
  assert.equal(f.calls.connect.length, 0)
})
