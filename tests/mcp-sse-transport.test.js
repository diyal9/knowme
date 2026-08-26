'use strict'

const assert = require('node:assert/strict')
const { it } = require('node:test')
const { createLegacySseSession, createMcpSessionForTransport } = require('../src/lib/mcp-host')

function fakeLegacySse() {
  const waiting = []
  const queued = ['event: endpoint\ndata: /messages?session=1\n\n']
  function push(value) {
    const resolve = waiting.shift()
    if (resolve) resolve({ value: Buffer.from(value), done: false })
    else queued.push(value)
  }
  const body = {
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (queued.length) return Promise.resolve({ value: Buffer.from(queued.shift()), done: false })
          return new Promise(resolve => waiting.push(resolve))
        },
      }
    },
  }
  const calls = []
  async function fetchImpl(url, init) {
    calls.push({ url, init })
    if (init.method === 'GET') return { ok: true, body }
    const payload = JSON.parse(init.body)
    if (payload.id != null) {
      const result = payload.method === 'initialize'
        ? { protocolVersion: '2024-11-05' }
        : payload.method === 'tools/list'
          ? { tools: [{ name: 'ping', inputSchema: { type: 'object' } }] }
          : { content: [{ type: 'text', text: 'pong' }] }
      queueMicrotask(() => push(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: payload.id, result })}\n\n`))
    }
    return { ok: true, json: async () => ({}) }
  }
  return { fetchImpl, calls }
}

it('legacy SSE discovers and calls tools through the shared MCP session contract', async () => {
  const fake = fakeLegacySse()
  const session = createLegacySseSession({ url: 'http://127.0.0.1:3103/sse', fetchImpl: fake.fetchImpl, timeoutMs: 1000 })
  const listed = await session.listTools()
  assert.equal(listed.ok, true)
  assert.equal(listed.tools[0].name, 'ping')
  const called = await session.callTool('ping', {})
  assert.equal(called.ok, true)
  assert.equal(called.text, 'pong')
  assert.ok(fake.calls.some(call => call.url.includes('/messages?session=1')))
  await session.close()
})

it('transport factory selects legacy SSE', () => {
  const session = createMcpSessionForTransport({ transport: 'sse', url: 'http://localhost/sse' }, { fetchImpl: async () => ({ ok: false, status: 500 }) })
  assert.equal(session.transport, 'sse')
})
