'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const mcpHost = require('../src/lib/mcp-host')

describe('mcp-http-transport', () => {
  function response(body, { status = 200, contentType = 'application/json', sessionId = '' } = {}) {
    const text = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: name => name.toLowerCase() === 'content-type' ? contentType : name.toLowerCase() === 'mcp-session-id' ? sessionId : null },
      text: async () => text,
    }
  }

  function protocolFetch(handler) {
    const calls = []
    const fetchImpl = async (_url, options) => {
      const payload = JSON.parse(options.body)
      calls.push({ payload, headers: options.headers })
      if (payload.method === 'initialize') return response({ jsonrpc: '2.0', id: payload.id, result: { protocolVersion: '2024-11-05', capabilities: {} } })
      if (payload.method === 'notifications/initialized') return response(null, { status: 202, contentType: '' })
      return handler(payload, options)
    }
    return { calls, fetchImpl }
  }

  it('createStreamableHttpSession lists tools via fake fetch', async () => {
    const { calls, fetchImpl } = protocolFetch(payload => response({
      jsonrpc: '2.0', id: payload.id, result: { tools: [{ name: 'ping', description: 'p' }] },
    }))
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const listed = await session.listTools()
    assert.equal(listed.ok, true)
    assert.equal(listed.tools.length, 1)
    assert.deepEqual(calls.map(call => call.payload.method), ['initialize', 'notifications/initialized', 'tools/list'])
    assert.equal(calls[0].headers.Accept, 'application/json, text/event-stream')
  })

  it('createStreamableHttpSession callTool returns text', async () => {
    const { fetchImpl } = protocolFetch(payload => response({
      jsonrpc: '2.0', id: payload.id,
      result: { content: [{ type: 'text', text: 'hello' }] },
    }))
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const r = await session.callTool('echo', { msg: 'x' })
    assert.equal(r.ok, true)
    assert.match(r.text, /hello/)
  })

  it('healthCheck reports transport', async () => {
    const { fetchImpl } = protocolFetch(payload => response({ jsonrpc: '2.0', id: payload.id, result: { tools: [] } }))
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const h = await session.healthCheck()
    assert.equal(h.ok, true)
    assert.equal(h.transport, 'streamable-http')
  })

  it('accepts an SSE JSON-RPC response and reuses the negotiated session id', async () => {
    let initialized = false
    const seenHeaders = []
    const fetchImpl = async (_url, options) => {
      const payload = JSON.parse(options.body)
      seenHeaders.push(options.headers)
      if (payload.method === 'initialize') {
        initialized = true
        return response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { protocolVersion: '2024-11-05' } })}\n\n`, {
          contentType: 'text/event-stream', sessionId: 'session-1',
        })
      }
      if (payload.method === 'notifications/initialized') return response(null, { status: 202 })
      return response({ jsonrpc: '2.0', id: payload.id, result: { tools: [{ name: 'query' }] } })
    }
    const session = mcpHost.createStreamableHttpSession({ url: 'http://127.0.0.1:9999/mcp', fetchImpl })
    const listed = await session.listTools()
    assert.equal(initialized, true)
    assert.equal(listed.ok, true)
    assert.equal(listed.tools[0].name, 'query')
    assert.equal(seenHeaders[1]['mcp-session-id'], 'session-1')
    assert.equal(seenHeaders[2]['mcp-session-id'], 'session-1')
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
