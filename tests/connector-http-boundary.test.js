'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { executeGenericConnector } = require('../src/lib/connectors/tool-runtime')

async function server(t, handler) {
  const instance = http.createServer(handler)
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { instance.closeAllConnections(); instance.close(resolve) }))
  return `http://127.0.0.1:${instance.address().port}`
}

test('HTTP rejects cross-origin/protocol/userinfo overrides before issuing any request', async t => {
  let requests = 0
  const base = await server(t, (_req, res) => { requests++; res.end('ok') })
  let leaked = 0
  const foreign = await server(t, (_req, res) => { leaked++; res.end('bad') })
  for (const target of [foreign, `//${new URL(foreign).host}/leak`, 'https://example.invalid/', 'file:///tmp/x',
    base.replace('://', '://user:password@'), `${base}.evil.invalid/`]) {
    const result = await executeGenericConnector({ type: 'http', http: { baseUrl: base } }, { path: target }, { headers: { 'X-Secret': 'private' } })
    assert.equal(result.code, 'http_target_denied', target)
  }
  assert.equal(requests, 0)
  assert.equal(leaked, 0)
})

test('HTTP cross-origin redirect never receives configured headers, cookie, bearer, or body', async t => {
  let leaked = 0
  const foreign = await server(t, (_req, res) => { leaked++; res.end('bad') })
  let original = 0
  const base = await server(t, (req, res) => {
    original++
    assert.equal(req.headers.authorization, 'Bearer private')
    assert.equal(req.headers['x-secret'], 'credential')
    res.writeHead(307, { location: `${foreign}/capture` }).end()
  })
  const result = await executeGenericConnector({ type: 'http', http: { baseUrl: base, headers: { Cookie: 'session=private' } } },
    { method: 'POST', body: 'private payload' }, { accessToken: 'private', headers: { 'X-Secret': 'credential' } })
  assert.equal(result.code, 'http_redirect_denied')
  assert.equal(original, 1)
  assert.equal(leaked, 0)
})

test('same-origin absolute/relative requests and redirects retain credentials and Fetch method semantics', async t => {
  const received = []
  const base = await server(t, (req, res) => {
    received.push([req.url, req.method, req.headers.authorization, req.headers['x-extra']])
    if (req.url === '/start') res.writeHead(303, { location: '/finish' }).end()
    else res.end('done')
  })
  const connector = { type: 'http', http: { baseUrl: `${base}/api/`, headers: { Authorization: 'Bearer trusted' } } }
  const result = await executeGenericConnector(connector, { path: `${base}/start`, method: 'POST', headers: { 'X-Extra': 'ok' }, body: 'body' })
  assert.equal(result.ok, true)
  assert.deepEqual(received, [['/start', 'POST', 'Bearer trusted', 'ok'], ['/finish', 'GET', 'Bearer trusted', 'ok']])
  assert.equal((await executeGenericConnector(connector, { path: 'relative' })).ok, true)
  assert.equal(received[2][0], '/api/relative')
})

test('header protection is case insensitive; redirects are bounded; abort reaches fetch', async t => {
  let requests = 0
  const base = await server(t, (_req, res) => { requests++; res.writeHead(302, { location: '/again' }).end() })
  const connector = { type: 'http', http: { baseUrl: base, headers: { 'X-Secret': 'configured' } } }
  for (const headers of [{ 'x-secret': 'replace' }, { AUTHORIZATION: 'replace' }, { Host: 'other' }, { 'Content-Length': '99' }]) {
    assert.equal((await executeGenericConnector(connector, { headers })).code, 'http_header_denied')
  }
  assert.equal(requests, 0)
  assert.equal((await executeGenericConnector(connector)).code, 'http_redirect_denied')
  assert.equal(requests, 6)
  const result = await executeGenericConnector(connector, {}, { signal: AbortSignal.abort() })
  assert.equal(result.ok, false)
  assert.equal(requests, 6)
})
