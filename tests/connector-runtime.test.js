'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('events')
const { PassThrough } = require('stream')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createMcpHostRegistry } = require('../src/lib/mcp-host')
const connectorCaps = require('../src/lib/connector-capabilities')
const { buildConnectorToolSurface, executeGenericConnector } = require('../src/lib/connectors/tool-runtime')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const store = require('../src/lib/connectors/store')
const { createCapabilityStore, resolvePaths } = require('../src/lib/capability-store')

function createMockMcpSpawn(toolMap = {}) {
  return () => {
    const stdout = new PassThrough()
    const child = new EventEmitter()
    child.stdout = stdout
    child.stderr = new PassThrough()
    child.kill = () => {}
    child.stdin = {
      write(chunk) {
        const msg = JSON.parse(String(chunk).trim())
        queueMicrotask(() => {
          if (msg.method === 'initialize') {
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                serverInfo: { name: 'mock' },
              },
            }) + '\n')
          } else if (msg.method === 'tools/list') {
            const tools = toolMap.tools || [{ name: 'echo', description: 'Echo' }]
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { tools },
            }) + '\n')
          } else if (msg.method === 'tools/call') {
            const name = msg.params?.name
            const text = toolMap.callResults?.[name] || `called:${name}`
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { content: [{ type: 'text', text }] },
            }) + '\n')
          }
        })
        return true
      },
    }
    return child
  }
}

describe('connector-capabilities multi MCP', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-conn-runtime-'))
    connectorCaps.clearMcpDefinitionCache()
  })
  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('projects two enabled MCP connectors in parallel with prefixed names', async () => {
    store.upsertConnector(dir, {
      id: 'alpha',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'mock-a', args: [], envKeys: [] },
      allowlist: ['search'],
    })
    store.upsertConnector(dir, {
      id: 'beta',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'mock-b', args: [], envKeys: [] },
      allowlist: ['search'],
    })
    const connectors = store.loadConnectors(dir)
    const registry = createMcpHostRegistry()
    const spawnImpl = createMockMcpSpawn({
      tools: [{ name: 'search', description: 'Search' }],
    })
    const projection = await connectorCaps.buildMcpAgentProjection(connectors, {
      registry,
      spawnImpl,
      ephemeralSessions: true,
    })
    assert.equal(projection.ok, true)
    const names = projection.definitions.map((d) => d.function.name).sort()
    assert.deepEqual(names, ['mcp.alpha.search', 'mcp.beta.search'])
    await connectorCaps.closeMcpSessions(projection.sessions)
  })

  it('projects nothing when allowlist is empty', async () => {
    store.upsertConnector(dir, {
      id: 'alpha',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'mock-a', args: [], envKeys: [] },
      allowlist: [],
    })
    const projection = await connectorCaps.buildMcpAgentProjection(store.loadConnectors(dir), {
      spawnImpl: createMockMcpSpawn({ tools: [{ name: 'echo' }] }),
      ephemeralSessions: true,
    })
    assert.equal(projection.ok, true)
    assert.equal(projection.definitions.length, 0)
  })

  it('returns explicit error on sanitized connector id collision', async () => {
    const connectors = [
      {
        id: 'foo-bar',
        type: 'mcp',
        enabled: true,
        agentVisible: true,
        mcp: { command: 'a', args: [], envKeys: [] },
        allowlist: ['x'],
      },
      {
        id: 'foo_bar',
        type: 'mcp',
        enabled: true,
        agentVisible: true,
        mcp: { command: 'b', args: [], envKeys: [] },
        allowlist: ['x'],
      },
    ]
    const projection = await connectorCaps.buildMcpAgentProjection(connectors, {
      spawnImpl: createMockMcpSpawn(),
      ephemeralSessions: true,
    })
    assert.equal(projection.ok, false)
    assert.equal(projection.code, 'sanitized_id_conflict')
    assert.match(projection.message, /冲突/)
  })

  it('probe, preview, and allowlist DTO omit secret values', async () => {
    process.env.TEST_MCP_TOKEN = 'secret-value'
    const conn = {
      id: 'preview-mcp',
      type: 'mcp',
      enabled: true,
      allowlist: ['echo'],
      mcp: {
        command: 'mock',
        args: [],
        envKeys: ['TEST_MCP_TOKEN'],
      },
    }
    const spawnImpl = createMockMcpSpawn({
      tools: [{ name: 'echo', description: 'Echo tool' }],
    })
    const health = await connectorCaps.probeMcpHealth(conn.mcp, { spawnImpl })
    assert.equal(health.ok, true)
    assert.equal(health.state, 'online')

    const preview = await connectorCaps.previewMcpTools(conn, { spawnImpl })
    assert.equal(preview.ok, true)
    assert.deepEqual(preview.projectedAllowlist, ['mcp.preview_mcp.echo'])
    assert.equal(JSON.stringify(preview).includes('secret-value'), false)
    assert.deepEqual(preview.mcp.envKeys, ['TEST_MCP_TOKEN'])

    const dto = await connectorCaps.buildMcpAllowlistDto(conn, { spawnImpl })
    assert.equal(dto.availableTools[0].selected, true)
    assert.equal(dto.availableTools[0].projectedName, 'mcp.preview_mcp.echo')
    delete process.env.TEST_MCP_TOKEN
  })

  it('disconnect lifecycle closes registry client', async () => {
    const registry = createMcpHostRegistry()
    const spawnImpl = createMockMcpSpawn({ tools: [] })
    await connectorCaps.onConnectorEnabled('life-mcp', { command: 'mock', args: [], envKeys: [] }, {
      registry,
      spawnImpl,
    })
    assert.deepEqual(registry.listConnectedIds(), ['life-mcp'])
    await connectorCaps.onConnectorDisabled('life-mcp', { registry })
    assert.deepEqual(registry.listConnectedIds(), [])
  })
})

describe('connector tool-runtime multi MCP integration', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-tool-runtime-'))
    connectorCaps.clearMcpDefinitionCache()
  })
  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('buildConnectorToolSurface lazily opens and closes multiple ephemeral MCP sessions', async t => {
    let openChildren = 0
    const spawnImpl = () => {
      openChildren += 1
      const child = createMockMcpSpawn({
        tools: [{ name: 'tool_a', description: 'A' }],
      })()
      const origKill = child.kill.bind(child)
      child.kill = () => {
        openChildren -= 1
        origKill()
      }
      return child
    }
    store.upsertConnector(dir, {
      id: 'one',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'mock-1', args: [], envKeys: [] },
      allowlist: ['tool_a'],
    })
    store.upsertConnector(dir, {
      id: 'two',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'mock-2', args: [], envKeys: [] },
      allowlist: ['tool_a'],
    })
    const runtime = await buildConnectorToolSurface(dir, {
      spawnImpl,
      ephemeralMcpSessions: true,
    })
    t.after(() => runtime.close())
    assert.equal(openChildren, 0)
    assert.deepEqual(runtime.surface.getToolDefinitions().map(d => d.function.name).filter(n => n.startsWith('mcp_load_')).sort(),
      ['mcp_load_one', 'mcp_load_two'])
    assert.equal(runtime.surface.getToolDefinitions().some(d => d.function.name.startsWith('mcp.')), false)
    const executor = runtime.surface.createToolExecutor()
    assert.equal((await executor.executeToolCall({ name: 'mcp_load_one', arguments: '{}' })).ok, true)
    assert.equal(openChildren, 1)
    assert.equal(runtime.surface.getToolDefinitions().some(d => d.function.name === 'mcp.two.tool_a'), false)
    assert.equal((await executor.executeToolCall({ name: 'mcp_load_two', arguments: '{}' })).ok, true)
    const names = runtime.surface.getToolDefinitions()
      .map((d) => d.function.name)
      .filter((n) => n.startsWith('mcp.'))
      .sort()
    assert.deepEqual(names, ['mcp.one.tool_a', 'mcp.two.tool_a'])
    assert.equal(openChildren, 2)
    for (const name of names) {
      const record = runtime.surface.getToolRecords().find(d => d.function.name === name)
      assert.equal(record._knowme.source, 'mcp')
      assert.equal(record._knowme.mcpSchemaLoader, false)
      assert.equal(record._knowme.requiresApproval, true)
      assert.equal((await executor.executeToolCall({ name, arguments: '{}' })).code, 'approval_required')
    }
    await runtime.close()
    assert.equal(openChildren, 0)
  })

  it('loads then runs a manifest-only connector through the unified store', async t => {
    const paths = resolvePaths(dir)
    const connectorDir = path.join(paths.connectors, 'manifest-only')
    fs.mkdirSync(connectorDir, { recursive: true })
    fs.writeFileSync(path.join(connectorDir, 'manifest.json'), JSON.stringify({
      id: 'manifest-only',
      kind: 'connector',
      name: 'Manifest Only',
      version: '1.0.0',
      type: 'mcp',
      allowlist: ['echo'],
      toolPolicies: [{ match: 'echo', risk: 'read', sideEffects: false, requiresApproval: false }],
      mcp: { command: 'mock', args: [], envKeys: [] },
    }), 'utf8')
    createCapabilityStore({ userData: dir }).upsertEntry({
      id: 'manifest-only',
      kind: 'connector',
      source: 'custom',
      enabled: true,
      status: 'enabled',
    })

    let spawned = 0
    const spawnEcho = createMockMcpSpawn({ tools: [{ name: 'echo', description: 'Echo' }] })
    const runtime = await buildConnectorToolSurface(dir, {
      spawnImpl: () => { spawned++; return spawnEcho() },
      ephemeralMcpSessions: true,
    })
    t.after(() => runtime.close())
    assert.equal(spawned, 0)
    const initial = runtime.surface.getToolDefinitions().map(d => d.function.name)
    assert.ok(initial.includes('mcp_load_manifest_only'))
    assert.equal(initial.includes('mcp.manifest_only.echo'), false)
    const executor = runtime.surface.createToolExecutor()
    assert.equal((await executor.executeToolCall({ name: 'mcp_load_manifest_only', arguments: '{}' })).ok, true)
    assert.equal(spawned, 1)
    const names = runtime.surface.getToolDefinitions().map(d => d.function.name)
    assert.ok(names.includes('mcp.manifest_only.echo'))
    const record = runtime.surface.getToolRecords().find(d => d.function.name === 'mcp.manifest_only.echo')
    assert.equal(record._knowme.source, 'mcp')
    assert.equal(record._knowme.connectorId, 'manifest-only')
    assert.equal(record._knowme.mcpSchemaLoader, false)
    assert.equal(record._knowme.sideEffects, false)
    assert.equal(record._knowme.requiresApproval, false)
    const called = await executor.executeToolCall({ name: 'mcp.manifest_only.echo', arguments: '{}' })
    assert.equal(called.ok, true)
    assert.equal(called.text, 'called:echo')
    await runtime.close()
  })

  it('preserves feishu draft approval path alongside MCP tools', async () => {
    store.upsertConnector(dir, {
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.draft_write_doc'],
    })
    const runtime = await buildConnectorToolSurface(dir, {
      ephemeralMcpSessions: true,
      spawnImpl: () => { throw new Error('MCP should not spawn for feishu-only surface') },
    })
    const names = runtime.surface.getToolDefinitions().map((d) => d.function.name)
    assert.ok(names.includes('feishu.draft_write_doc'))
    await runtime.close()
  })

  it('projects built-in Feishu CLI tools for a system run without an Expert binding', async () => {
    const unbound = await buildConnectorToolSurface(dir, {
      allowedConnectorIds: [],
      includeSystemFeishu: true,
      spawnImpl: () => { throw new Error('MCP should not spawn for Feishu-only system surface') },
    })
    const names = unbound.surface.getToolDefinitions().map((d) => d.function.name)
    assert.ok(names.includes('feishu.search_docs'))
    assert.ok(names.includes('feishu.read_doc'))
    assert.ok(names.includes('feishu.draft_write_doc'))
    await unbound.close()

    const ordinary = await buildConnectorToolSurface(dir, {
      allowedConnectorIds: [],
      spawnImpl: () => { throw new Error('MCP should not spawn for an ordinary unbound surface') },
    })
    assert.equal(ordinary.surface.getToolDefinitions().some((d) => d.function.name.startsWith('feishu.')), false)
    await ordinary.close()
  })

  it('returns a structured actionable failure when a CLI exits non-zero', async () => {
    const result = await executeGenericConnector({
      type: 'cli',
      cli: { command: process.execPath, args: ['-e', "process.stderr.write('cli exploded'); process.exit(7)"] },
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'cli_exit_nonzero')
    assert.match(result.text, /CLI 退出失败.*7.*cli exploded/)
    assert.equal(result.meta.exitCode, 7)
  })

  it('registers generic CLI connectors with connector semantics in v1', async () => {
    store.upsertConnector(dir, {
      id: 'local-cli',
      type: 'cli',
      enabled: true,
      cli: { command: process.execPath, args: ['-e', "process.stdout.write('ok')"] },
    })
    const reg = createRegistry()
    const runtime = await buildConnectorToolSurface(dir, { registry: reg })
    const name = 'connector_local_cli_call'
    assert.equal(reg.has(name), true)
    assert.equal(reg.get(name).contract.source, 'connector')
    assert.equal(reg.get(name).contract.connectorType, 'cli')
    assert.deepEqual(reg.getRegistrationIssues(), [])
    await runtime.close()
  })
})
