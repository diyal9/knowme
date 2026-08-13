'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const mcpHost = require('../src/lib/mcp-host')

describe('mcp-http-transport', () => {
  it('createStreamableHttpSession lists tools via fake fetch', async () => {
    const fetchImpl = async () => ({
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'ping', description: 'p' }] } }),
    })
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const listed = await session.listTools()
    assert.equal(listed.ok, true)
    assert.equal(listed.tools.length, 1)
  })

  it('createStreamableHttpSession callTool returns text', async () => {
    const fetchImpl = async () => ({
      json: async () => ({
        jsonrpc: '2.0', id: 1,
        result: { content: [{ type: 'text', text: 'hello' }] },
      }),
    })
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const r = await session.callTool('echo', { msg: 'x' })
    assert.equal(r.ok, true)
    assert.match(r.text, /hello/)
  })

  it('healthCheck reports transport', async () => {
    const fetchImpl = async () => ({ json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }) })
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const h = await session.healthCheck()
    assert.equal(h.ok, true)
    assert.equal(h.transport, 'streamable-http')
  })

  it('schema cache save/load roundtrip', () => {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-schema-'))
    mcpHost.saveSchemaCache(dir, 'playwright', [{ name: 'browser_snapshot' }])
    const tools = mcpHost.loadSchemaCache(dir, 'playwright')
    assert.equal(tools.length, 1)
  })

  it('oauth token save/load', () => {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-oauth-'))
    mcpHost.saveOAuthTokens(dir, 'pw', { access_token: 'a', refresh_token: 'r' })
    const tok = mcpHost.loadOAuthTokens(dir, 'pw')
    assert.equal(tok.access_token, 'a')
  })
})
