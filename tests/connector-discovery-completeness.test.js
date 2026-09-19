'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const connectorCaps = require('../src/lib/connector-capabilities')
const { preflightExpertTools } = require('../src/lib/expert-task-tool-preflight')
const canonical = require('../src/catalog/experts/image-producer/capability.manifest.json')

const providerId = 'pango-image-mcp'
const targets = ['list_paint_models', 'generate_image']
// Both authorized tools occur beyond the historical 64-row preview boundary.
const definitions = [...Array.from({ length: 91 }, (_, i) => `other_tool_${i}`), ...targets]
  .map(name => ({ name, description: name, inputSchema: { type: 'object', properties: {} } }))

function fixture(allowlist = targets) {
  const calls = []
  const connector = { id: providerId, type: 'mcp', enabled: true, agentVisible: true,
    allowlist: [...allowlist], mcp: { transport: 'streamable-http', url: 'https://offline.invalid/mcp' } }
  const opts = { fetchImpl: async (_url, init) => {
    const request = JSON.parse(init.body)
    calls.push(request)
    if (request.method === 'initialize') {
      return { ok: true, status: 200, headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2024-11-05', capabilities: {} } }) }
    }
    if (request.method === 'notifications/initialized') {
      return { ok: true, status: 202, headers: { get: () => '' }, text: async () => '' }
    }
    assert.equal(request.method, 'tools/list', 'discovery must never execute a tool')
    return { ok: true, status: 200, headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { tools: definitions } }) }
  } }
  return { connector, opts, calls }
}

async function preflight(f, toolAllowlist) {
  const snapshot = { bindings: { connectors: [providerId], skills: [] }, capabilityManifest: structuredClone(canonical) }
  if (toolAllowlist) snapshot.capabilityManifest.permissions.tools.allowlist = [...toolAllowlist]
  let discoveryCalls = 0
  const result = await preflightExpertTools({ snapshot, connectorIds: [providerId], requiredTools: targets,
    getConnectorsApi: () => ({
      getConnectorStatus: async id => ({ ok: true, connector: {
        ...f.connector, id, status: { ok: true, state: 'online', toolsCount: definitions.length },
      } }),
      getConnectorTools: async id => {
        assert.equal(id, providerId)
        discoveryCalls += 1
        // Do not hand-construct selected rows: exercise the production DTO.
        return connectorCaps.buildMcpAllowlistDto(f.connector, f.opts)
      },
    }),
  })
  assert.equal(discoveryCalls, 1)
  assert.deepEqual(f.calls.map(call => call.method), ['initialize', 'notifications/initialized', 'tools/list'])
  return result
}

test('RQA24 preview exposes all 93 discovered tools including authorized tools beyond row 64', async () => {
  const f = fixture()
  const preview = await connectorCaps.previewMcpTools(f.connector, f.opts)
  assert.equal(preview.ok, true)
  assert.equal(preview.allToolCount, 93)
  assert.deepEqual(preview.tools.filter(tool => tool.allowlisted).map(tool => tool.rawName), targets)
  assert.deepEqual(preview.tools.map(tool => tool.rawName), definitions.map(tool => tool.name))
  assert.equal(preview.projectedAllowlist.length, 2)
  assert.deepEqual(f.calls.map(call => call.method), ['initialize', 'notifications/initialized', 'tools/list'])
})

test('RQA24 allowlist DTO retains later selected targets and exposes unselected tools without authorizing them', async () => {
  const f = fixture()
  const dto = await connectorCaps.buildMcpAllowlistDto(f.connector, f.opts)
  assert.equal(dto.ok, true)
  assert.deepEqual(dto.availableTools.filter(tool => tool.selected).map(tool => tool.rawName), targets)
  assert.equal(dto.availableTools.length, 93)
  assert.equal(dto.availableTools.filter(tool => !tool.selected).length, 91)
  assert.deepEqual(dto.availableTools.filter(tool => tool.selected).map(tool => tool.projectedName), dto.projectedAllowlist)
  assert.deepEqual(dto.allowlist, targets)
})

test('RQA24 generic expert preflight succeeds through the actual DTO for an authorized image provider', async () => {
  const result = await preflight(fixture())
  assert.equal(result.ok, true, JSON.stringify(result.issues))
  assert.deepEqual(result.issues, [])
})

for (const control of [
  { name: 'empty connector selection', selected: [] },
  { name: 'generate_image present but unselected', selected: ['list_paint_models'] },
  { name: 'selected tools but expert permission excludes generate_image', selected: targets, expertAllowlist: ['list_paint_models'] },
]) test(`RQA24 complete discovery does not authorize ${control.name}`, async () => {
  const result = await preflight(fixture(control.selected), control.expertAllowlist)
  assert.equal(result.ok, false)
  assert.ok(result.issues.some(issue => issue.id === 'generate_image'
    && ['required_tool_unavailable', 'scope_denied'].includes(issue.code)), JSON.stringify(result.issues))
})
