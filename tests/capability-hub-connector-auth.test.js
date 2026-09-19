'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const { buildRuntimeOptions } = require('../src/lib/connectors/runtime-config')
const mcpHost = require('../src/lib/mcp-host')

// Load real CJS source with local dependency substitutions, without mutating
// require.cache or global Electron/transport state used by other tests.
function loadWith(relativePath, replacements) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const localRequire = Module.createRequire(filename)
  const mod = { exports: {} }
  const wrapped = new vm.Script(Module.wrap(fs.readFileSync(filename, 'utf8')), { filename }).runInThisContext()
  wrapped(mod.exports, id => Object.hasOwn(replacements, id) ? replacements[id] : localRequire(id), mod, filename, path.dirname(filename))
  return mod.exports
}

const secrets = {
  bearer: 'fixture-private-bearer-913',
  header: 'fixture-private-header-714',
  env: 'fixture-private-env-615',
}
const channels = ['connector-health', 'connector-tools-preview']

function fixture({ target = 'bearer', failed = false, type = 'mcp', noSecrets = false, apiMode = 'available' } = {}) {
  const conn = {
    id: 'independent-auth-provider', type, enabled: true, agentVisible: true,
    mcp: target === 'env'
      ? { transport: 'stdio', command: 'mock-never-spawned', args: [], envKeys: ['SERVICE_TOKEN'] }
      : { transport: 'streamable-http', url: 'https://mock.invalid/mcp' },
    allowlist: ['inspect'],
    secretSlots: noSecrets ? [] : [{ key: 'credential', target,
      ...(target === 'header' ? { name: 'X-Service-Token', prefix: 'Token ' } : {}),
      ...(target === 'env' ? { name: 'SERVICE_TOKEN' } : {}),
    }],
  }
  let secret = secrets[target]
  const resolved = []
  const sessions = []
  let closed = 0
  const caps = loadWith('src/lib/connector-capabilities.ts', {
    './mcp-host': {
      ...mcpHost,
      createMcpSessionForTransport(config, options) {
        sessions.push({ config, options })
        return {
          async listTools() {
            return failed
              ? { ok: false, code: 'fixture_offline', message: 'Controlled discovery failure' }
              : { ok: true, tools: [{ name: 'inspect', description: 'Inspect mock state', inputSchema: { type: 'object', properties: {} } }] }
          },
          async close() { closed += 1 },
        }
      },
    },
  })
  const registered = new Map()
  const ipc = loadWith('src/lib/capability-hub/ipc.ts', {
    electron: { ipcMain: { handle(name, handler) { registered.set(name, handler) } } },
    '../connector-capabilities': caps,
  })
  const deps = {
    unifiedConnectors: { loadConnectors: () => [conn] },
    getConnectorsApi: () => ({ resolveRuntimeOptions(selected) {
      assert.strictEqual(selected, conn, 'credentials must resolve from the stored connector, not renderer data')
      resolved.push(selected.id)
      return buildRuntimeOptions(selected, { credential: secret })
    } }),
  }
  if (apiMode === 'missing-getter') delete deps.getConnectorsApi
  if (apiMode === 'null-api') deps.getConnectorsApi = () => null
  if (apiMode === 'missing-resolver') deps.getConnectorsApi = () => ({})
  ipc.registerCapabilityHubIpc(deps)
  return {
    conn, sessions, resolved, closed: () => closed,
    rotate: value => { secret = value },
    invoke: (channel, payload = {}) => registered.get(channel)({}, { connectorId: conn.id, ...payload }),
  }
}

function assertPublic(result, extraSecrets = []) {
  const serialized = JSON.stringify(result)
  for (const value of [...Object.values(secrets), ...extraSecrets, 'renderer-forged-secret']) {
    assert.ok(!serialized.includes(value), 'runtime credential value must not enter the IPC DTO')
  }
  assert.equal(Object.hasOwn(result, 'accessToken'), false)
  assert.equal(Object.hasOwn(result, 'headers'), false)
  assert.equal(Object.hasOwn(result, 'env'), false)
  if (result.mcp) assert.equal(Object.hasOwn(result.mcp, 'env'), false)
}

for (const channel of channels) {
  for (const target of ['bearer', 'header', 'env']) {
    test(`${channel}: forwards host ${target} credentials without expanding the public DTO`, async () => {
      const f = fixture({ target })
      const before = JSON.stringify(f.conn)
      const result = await f.invoke(channel, {
        accessToken: 'renderer-forged-secret', headers: { Authorization: 'renderer-forged-secret' },
        env: { SERVICE_TOKEN: 'renderer-forged-secret' },
        runtimeOptions: { accessToken: 'renderer-forged-secret' },
        connector: { id: 'other-provider' },
      })
      assert.equal(f.sessions.length, 1)
      assert.deepEqual(f.sessions[0].options, buildRuntimeOptions(f.conn, { credential: secrets[target] }),
        'the captured MCP session must receive the resolver options')
      assert.deepEqual(f.resolved, [f.conn.id])
      assert.strictEqual(f.sessions[0].config, f.conn.mcp)
      assert.equal(f.closed(), 1)
      assert.equal(JSON.stringify(f.conn), before, 'credential resolution must not mutate connector configuration')
      assert.equal(result.ok, true)
      if (channel === 'connector-health') {
        assert.deepEqual(result, { ok: true, state: 'online', message: 'MCP 在线，发现 1 个工具', toolsCount: 1 })
      } else {
        assert.equal(result.connectorId, f.conn.id)
        assert.deepEqual(result.allowlist, ['inspect'])
        assert.equal(result.tools.length, 1)
        assert.equal(result.tools[0].rawName, 'inspect')
        assert.equal(result.tools[0].projected, true)
        assert.deepEqual(result.projectedAllowlist, [result.tools[0].projectedName])
        assert.equal(result.allToolCount, 1)
      }
      assertPublic(result)
    })
  }

  test(`${channel}: keeps failure DTO and credentials private on discovery failure`, async () => {
    const f = fixture({ failed: true, target: 'header' })
    const result = await f.invoke(channel)
    assert.deepEqual(f.sessions[0].options, buildRuntimeOptions(f.conn, { credential: secrets.header }))
    assert.equal(result.ok, false)
    assert.equal(result.code, 'fixture_offline')
    assert.equal(result.message, 'Controlled discovery failure')
    assert.equal(f.closed(), 1)
    assertPublic(result)
  })

  test(`${channel}: missing connector does not resolve credentials or open transport`, async () => {
    const f = fixture()
    const result = await f.invoke(channel, { connectorId: 'absent' })
    assert.deepEqual(result, { ok: false, code: 'not_found', error: '连接器不存在' })
    assert.deepEqual(f.resolved, [])
    assert.deepEqual(f.sessions, [])
  })

  test(`${channel}: resolves fresh host credentials per invocation`, async () => {
    const f = fixture()
    const first = await f.invoke(channel)
    f.rotate('fixture-rotated-bearer-416')
    const second = await f.invoke(channel)
    assert.equal(f.sessions[0].options.accessToken, secrets.bearer)
    assert.equal(f.sessions[1].options.accessToken, 'fixture-rotated-bearer-416')
    assert.equal(f.resolved.length, 2)
    assert.equal(f.closed(), 2)
    assertPublic(first)
    assertPublic(second, ['fixture-rotated-bearer-416'])
  })

  test(`${channel}: unauthenticated connector still works with empty runtime options`, async () => {
    const f = fixture({ noSecrets: true })
    const result = await f.invoke(channel)
    assert.deepEqual(f.sessions[0].options, { accessToken: '', headers: {}, env: {} })
    assert.equal(result.ok, true)
    assertPublic(result)
  })

  for (const apiMode of ['missing-getter', 'null-api', 'missing-resolver']) {
    test(`${channel}: ${apiMode} preserves no-secret configured connection`, async () => {
      const f = fixture({ apiMode, noSecrets: true })
      const result = await f.invoke(channel, {
        accessToken: 'renderer-forged-secret',
        headers: { Authorization: 'renderer-forged-secret' },
        env: { SERVICE_TOKEN: 'renderer-forged-secret' },
        runtimeOptions: { accessToken: 'renderer-forged-secret' },
      })
      assert.equal(result.ok, true)
      assert.deepEqual(f.resolved, [])
      assert.equal(f.sessions.length, 1)
      assert.strictEqual(f.sessions[0].config, f.conn.mcp)
      assert.deepEqual(f.sessions[0].options, {}, 'absence of a host resolver must not fabricate credentials')
      assert.equal(f.closed(), 1)
      if (channel === 'connector-health') {
        assert.deepEqual(result, { ok: true, state: 'online', message: 'MCP 在线，发现 1 个工具', toolsCount: 1 })
      } else {
        assert.equal(result.connectorId, f.conn.id)
        assert.equal(result.tools[0].rawName, 'inspect')
        assert.deepEqual(result.projectedAllowlist, [result.tools[0].projectedName])
      }
      assertPublic(result)
    })
  }

  test(`${channel}: missing resolver does not convert service failure to success`, async () => {
    const f = fixture({ apiMode: 'null-api', failed: true })
    const result = await f.invoke(channel)
    assert.deepEqual(f.sessions[0].options, {})
    assert.equal(result.ok, false)
    assert.equal(result.code, 'fixture_offline')
    assert.equal(result.message, 'Controlled discovery failure')
    assert.equal(f.closed(), 1)
    assertPublic(result)
  })
}

test('connector-health: preserves non-MCP fast path without resolving credentials', async () => {
  const f = fixture({ type: 'http' })
  assert.deepEqual(await f.invoke('connector-health'), { ok: true, state: 'enabled', toolsCount: 0 })
  assert.deepEqual(f.resolved, [])
  assert.deepEqual(f.sessions, [])
})
