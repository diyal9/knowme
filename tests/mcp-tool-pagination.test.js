'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('events')
const { PassThrough } = require('stream')
const { createMcpSessionForTransport } = require('../src/lib/mcp-host')
const { listAllMcpTools, MAX_MCP_TOOL_PAGES } = require('../src/lib/mcp-tool-pagination')

// Exercise each real transport's JSON-RPC adapter, not a mock listTools method.
function pagedSession(transport, pageResult) {
  const params = []
  function reply(payload) {
    if (payload.id == null) return null
    const response = { jsonrpc: '2.0', id: payload.id }
    if (payload.method === 'tools/list') {
      params.push(payload.params)
      Object.assign(response, pageResult(payload.params, params.length))
    } else response.result = {}
    return response
  }
  const stream = new PassThrough()
  const child = new EventEmitter()
  child.stdout = stream
  child.stderr = new PassThrough()
  child.kill = () => stream.end()
  child.stdin = { write(chunk) {
    const response = reply(JSON.parse(String(chunk)))
    if (response) queueMicrotask(() => stream.write(JSON.stringify(response) + '\n'))
    return true
  } }
  const fetchImpl = async (_url, init) => {
    if (init.method === 'GET') {
      stream.write('event: endpoint\ndata: /messages\n\n')
      init.signal.addEventListener('abort', () => stream.end(), { once: true })
      return { ok: true, body: stream }
    }
    const response = reply(JSON.parse(init.body))
    if (transport === 'sse' && response) {
      queueMicrotask(() => stream.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`))
    }
    return { ok: true, json: async () => response }
  }
  const session = createMcpSessionForTransport({ transport, command: 'fake-mcp', url: 'https://mcp.example/rpc' },
    { spawnImpl: () => child, fetchImpl, timeoutMs: 500 })
  return { session, params }
}

for (const transport of ['stdio', 'streamable-http', 'sse']) {
  it(`${transport}: collects all 500 definitions over two actual tools/list pages`, async t => {
    const tools = Array.from({ length: 500 }, (_, index) => ({ name: `tool_${index}`,
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }))
    const fake = pagedSession(transport, ({ cursor }) => ({ result: cursor === undefined
      ? { tools: tools.slice(0, 250), nextCursor: 'opaque+/page=2' }
      : { tools: tools.slice(250) } }))
    t.after(() => fake.session.close())
    assert.deepEqual(await fake.session.listTools(), { ok: true, tools })
    assert.deepEqual(fake.params, [{}, { cursor: 'opaque+/page=2' }])
  })

  it(`${transport}: repeated cursor fails without publishing partial tools`, async t => {
    const fake = pagedSession(transport, () => ({ result: { tools: [{ name: 'partial' }], nextCursor: 'loop' } }))
    t.after(() => fake.session.close())
    const result = await fake.session.listTools()
    assert.equal(result.ok, false)
    assert.equal(result.code, 'mcp_pagination_error')
    assert.match(result.message, /repeated cursor/)
    assert.deepEqual(result.tools, [])
    assert.equal(fake.params.length, 2)
  })

  it(`${transport}: later page RPC error discards earlier definitions`, async t => {
    const fake = pagedSession(transport, (_, page) => page === 1
      ? { result: { tools: [{ name: 'partial' }], nextCursor: 'second' } }
      : { error: { code: -32603, message: 'later page unavailable' } })
    t.after(() => fake.session.close())
    const result = await fake.session.listTools()
    assert.equal(result.ok, false)
    assert.match(result.message, /later page unavailable/)
    assert.deepEqual(result.tools, [])
    assert.equal(fake.params.length, 2)
  })
}

it('pagination rejects too many pages rather than returning a truncated success', async () => {
  let calls = 0
  const result = await listAllMcpTools(async () => ({ ok: true,
    result: { tools: [{ name: `tool_${calls}` }], nextCursor: String(++calls) } }))
  assert.equal(calls, MAX_MCP_TOOL_PAGES)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'mcp_pagination_error')
  assert.match(result.message, /exceeded 1000 pages/)
  assert.deepEqual(result.tools, [])
})

it('pagination accepts a complete catalog on the final allowed page', async () => {
  let calls = 0
  const result = await listAllMcpTools(async () => ({ ok: true, result: {
    tools: [{ name: `tool_${++calls}` }], ...(calls < MAX_MCP_TOOL_PAGES ? { nextCursor: String(calls) } : {}),
  } }))
  assert.equal(result.ok, true)
  assert.equal(result.tools.length, MAX_MCP_TOOL_PAGES)
})

it('pagination treats empty cursor as opaque and detects multi-cursor cycles', async () => {
  const cursors = ['', 'B', '']
  const params = []
  const result = await listAllMcpTools(async value => {
    params.push(value)
    return { ok: true, result: { tools: [], nextCursor: cursors[params.length - 1] } }
  })
  assert.deepEqual(params, [{}, { cursor: '' }, { cursor: 'B' }])
  assert.equal(result.code, 'mcp_pagination_error')
  assert.deepEqual(result.tools, [])
})

it('pagination fails closed on malformed pages and invalid cursor types', async () => {
  for (const result of [{ tools: [], nextCursor: 7 }, { nextCursor: 'missing-tools' }]) {
    const listed = await listAllMcpTools(async () => ({ ok: true, result }))
    assert.equal(listed.code, 'mcp_pagination_error')
    assert.deepEqual(listed.tools, [])
  }
})
