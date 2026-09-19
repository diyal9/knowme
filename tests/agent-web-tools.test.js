'use strict'

const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const { buildWebTools } = require('../src/lib/agent-web-tools')

test('test-seam web tools route search and page reads through an isolated fixture', async t => {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/search')) {
      const body = '<?xml version="1.0"?><rss><channel><item><title>Fixture result</title><link>https://example.com/article</link><description>Official fixture evidence.</description><pubDate>Tue, 08 Sep 2026 00:00:00 GMT</pubDate><source>example.com</source></item></channel></rss>'
      res.writeHead(200, { 'content-type': 'application/rss+xml' })
      res.end(body)
      return
    }
    const body = '<html><head><title>Fixture article</title></head><body><h1>Fixture article</h1><p>Official fixture evidence body.</p></body></html>'
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(body)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise(resolve => server.close(() => resolve())))

  const previous = {
    seam: process.env.KNOWME_TEST_SEAM,
    endpoint: process.env.KNOWME_TEST_WEB_FIXTURE_ENDPOINT,
  }
  process.env.KNOWME_TEST_SEAM = '1'
  process.env.KNOWME_TEST_WEB_FIXTURE_ENDPOINT = `http://127.0.0.1:${server.address().port}`
  t.after(() => {
    if (previous.seam == null) delete process.env.KNOWME_TEST_SEAM
    else process.env.KNOWME_TEST_SEAM = previous.seam
    if (previous.endpoint == null) delete process.env.KNOWME_TEST_WEB_FIXTURE_ENDPOINT
    else process.env.KNOWME_TEST_WEB_FIXTURE_ENDPOINT = previous.endpoint
  })

  const tools = buildWebTools()
  const search = await tools.handlers.search_web({ query: 'fixture evidence', mode: 'web' })
  assert.equal(search.ok, true)
  assert.equal(search.sources[0].path, 'https://example.com/article')
  const page = await tools.handlers.fetch_web_page({ url: 'https://example.com/article' })
  assert.equal(page.ok, true)
  assert.match(page.text, /Official fixture evidence body/)
})
