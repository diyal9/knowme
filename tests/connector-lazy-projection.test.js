'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildLazyMcpProjection, clearLazyMcpSchemaCache } = require('../src/lib/connectors/lazy-mcp-projection')
const { closeMcpSessions } = require('../src/lib/connector-capabilities')

function connector(id = 'alpha') {
  return { id, type: 'mcp', enabled: true, agentVisible: true, mcp: { command: 'mock' }, allowlist: ['echo'],
    toolPolicies: [{ match: '*', risk: 'read', sideEffects: false, requiresApproval: false }] }
}

function host() {
  const calls = { connect: [], list: [], execute: [], close: [] }
  const registry = {
    async connect(id) {
      calls.connect.push(id)
      return { async listTools() { calls.list.push(id); return { ok: true, tools: [{ name: 'echo', inputSchema: { type: 'object' } }] } },
        async callTool(name, args) { calls.execute.push([id, name, args]); return { ok: true, text: 'done' } } }
    },
    async disconnect(id) { calls.close.push(id) },
  }
  return { calls, registry }
}

test('fresh cached schemas project before connect, then lazily connect on actual invocation', async () => {
  clearLazyMcpSchemaCache()
  const { calls, registry } = host()
  const first = await buildLazyMcpProjection([connector()], { registry })
  assert.equal(calls.connect.length, 0)
  assert.equal((await first.handlers.mcp_load_alpha({})).ok, true)
  assert.equal(calls.connect.length, 1)
  await closeMcpSessions(first.sessions)
  const second = await buildLazyMcpProjection([connector()], { registry })
  assert.equal(second.definitions.length, 1)
  assert.equal(calls.connect.length, 1)
  assert.equal(calls.list.length, 1)
  await second.handlers['mcp.alpha.echo']({ q: 'hi' })
  assert.equal(calls.connect.length, 2)
  await closeMcpSessions(second.sessions)
  assert.deepEqual(calls.execute, [['alpha', 'echo', { q: 'hi' }]])
})

test('configuration, permissions, credentials and account boundaries invalidate schema cache', async () => {
  clearLazyMcpSchemaCache()
  const { calls, registry } = host()
  const conn = connector()
  let token = 'one'
  const opts = { registry, userData: 'one', resolveRuntimeOptions: () => ({ accessToken: token }) }
  const load = async options => { const result = await buildLazyMcpProjection([conn], options)
    if (result.handlers.mcp_load_alpha) assert.equal((await result.handlers.mcp_load_alpha({})).ok, true)
    await closeMcpSessions(result.sessions); return result }
  await load(opts)
  conn.mcp.command = 'changed'
  await load(opts)
  conn.toolPolicies[0].requiresApproval = true
  const changed = await load(opts)
  assert.equal(changed.definitions.find(def => def.function.name === 'mcp.alpha.echo')._knowme.requiresApproval, true)
  token = 'two'
  await load(opts)
  await load({ ...opts, userData: 'two' })
  assert.equal(calls.list.length, 5)
  conn.allowlist = []
  assert.equal((await load(opts)).definitions.length, 0)
  assert.equal(calls.connect.length, 5)
})

test('one throwing/offline connector does not drop healthy definitions or leak sessions', async () => {
  clearLazyMcpSchemaCache()
  const { registry, calls } = host()
  const original = registry.connect
  registry.connect = async id => id === 'broken'
    ? { async listTools() { throw new Error('secret diagnostic') } }
    : original(id)
  const projection = await buildLazyMcpProjection([connector('broken'), connector('good')], { registry })
  assert.equal(projection.ok, true)
  assert.equal(calls.connect.length, 0)
  const failed = await projection.handlers.mcp_load_broken({})
  assert.equal(failed.ok, false)
  assert.equal(JSON.stringify(failed).includes('secret diagnostic'), false)
  assert.equal((await projection.handlers.mcp_load_good({})).ok, true)
  assert.ok(projection.definitions.some(d => d.function.name === 'mcp.good.echo'))
  assert.ok(calls.close.includes('broken'))
  await closeMcpSessions(projection.sessions)
})

test('cold discovery timeout is isolated and sanitized id conflicts preserve unrelated tools', async () => {
  clearLazyMcpSchemaCache()
  const { registry } = host()
  const connect = registry.connect
  registry.connect = async id => id === 'hang' ? { listTools: () => new Promise(() => {}) } : connect(id)
  const result = await buildLazyMcpProjection([connector('hang'), connector('a-b'), connector('a_b'), connector('good')], { registry, timeoutMs: 10 })
  assert.deepEqual(result.definitions.map(d => d.function.name), ['mcp_load_hang', 'mcp_load_good'])
  assert.equal((await result.handlers.mcp_load_hang({})).code, 'mcp_timeout')
  assert.equal((await result.handlers.mcp_load_good({})).ok, true)
  assert.ok(result.partialErrors.some(error => error.code === 'sanitized_id_conflict'))
  await closeMcpSessions(result.sessions)
})

test('MCP calls reject changed configuration or credentials even with an already open session', async () => {
  clearLazyMcpSchemaCache()
  const { registry, calls } = host()
  const conn = connector()
  let token = 'one'
  const projection = await buildLazyMcpProjection([conn], { registry, resolveCurrentConnector: () => conn,
    resolveRuntimeOptions: () => ({ accessToken: token }) })
  assert.equal((await projection.handlers.mcp_load_alpha({})).ok, true)
  token = 'two'
  assert.equal((await projection.handlers['mcp.alpha.echo']({})).code, 'connector_configuration_changed')
  token = 'one'
  conn.mcp.command = 'different'
  assert.equal((await projection.handlers['mcp.alpha.echo']({})).code, 'connector_configuration_changed')
  assert.equal(calls.execute.length, 0)
  await closeMcpSessions(projection.sessions)
})

test('MCP HTTP discovery uses the same credential redirect boundary', async () => {
  clearLazyMcpSchemaCache()
  let requests = 0
  const conn = { ...connector(), mcp: { transport: 'streamable-http', url: 'https://trusted.invalid/mcp' } }
  const projection = await buildLazyMcpProjection([conn], { ephemeralSessions: true,
    resolveRuntimeOptions: () => ({ accessToken: 'private' }),
    fetchImpl: async (url, init) => {
      requests++
      assert.equal(new URL(url).origin, 'https://trusted.invalid')
      assert.equal(init.redirect, 'manual')
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer private')
      return new Response(null, { status: 307, headers: { location: 'https://foreign.invalid/capture' } })
    },
  })
  assert.equal(requests, 0)
  const selected = await projection.handlers.mcp_load_alpha({})
  assert.equal(requests, 1)
  assert.equal(selected.ok, false)
  assert.deepEqual(projection.definitions.map(def => def.function.name), ['mcp_load_alpha'])
})

test('cancelled lazy invocation does not call the remote tool after delayed connect', async () => {
  clearLazyMcpSchemaCache()
  const { registry, calls } = host()
  const first = await buildLazyMcpProjection([connector()], { registry })
  await first.handlers.mcp_load_alpha({})
  await closeMcpSessions(first.sessions)
  const second = await buildLazyMcpProjection([connector()], { registry })
  const original = registry.connect
  let release
  registry.connect = id => new Promise(resolve => { release = async () => resolve(await original(id)) })
  const controller = new AbortController()
  const result = second.handlers['mcp.alpha.echo']({}, controller.signal)
  controller.abort()
  await release()
  assert.equal((await result).code, 'cancelled')
  assert.equal(calls.execute.length, 0)
  await closeMcpSessions(second.sessions)
})
