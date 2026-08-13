'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const webSearch = require('../src/lib/web-search')
const agentWebTools = require('../src/lib/agent-web-tools')
const agentTools = require('../src/lib/agent-tools')
const { createRegistry, validateContract } = require('../src/lib/tool-contract-registry')

function rss(items) {
  return `<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`
}

function item({ title, url, description = '', pubDate = '', source = '' }) {
  return `<item>
    <title><![CDATA[${title}]]></title>
    <link>${url.replace(/&/g, '&amp;')}</link>
    <description><![CDATA[${description}]]></description>
    ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
    ${source ? `<source>${source}</source>` : ''}
  </item>`
}

describe('web-search', () => {
  it('parses, filters, deduplicates and bounds RSS results', () => {
    const xml = rss([
      item({
        title: 'AI update',
        url: 'https://example.com/a#section',
        description: '<b>Primary</b> story',
        pubDate: 'Fri, 07 Aug 2026 02:00:00 GMT',
        source: 'Example',
      }),
      item({
        title: 'AI update duplicate',
        url: 'https://example.com/a',
        pubDate: 'Fri, 07 Aug 2026 03:00:00 GMT',
      }),
      item({
        title: 'Old story',
        url: 'https://example.com/old',
        pubDate: 'Mon, 03 Aug 2026 02:00:00 GMT',
      }),
      item({
        title: 'Unsafe',
        url: 'http://127.0.0.1/private',
        pubDate: 'Fri, 07 Aug 2026 03:00:00 GMT',
      }),
      item({
        title: 'No date but usable',
        url: 'https://another.example/news',
      }),
    ])
    const results = webSearch.parseRssItems(xml, {
      now: new Date('2026-08-07T08:00:00.000Z'),
      recencyDays: 1,
      limit: 10,
    })
    assert.equal(results.length, 2)
    assert.equal(results[0].url, 'https://example.com/a')
    assert.equal(results[0].snippet, 'Primary story')
    assert.equal(results[0].publishedAt, '2026-08-07T02:00:00.000Z')
    assert.equal(results[1].publishedAt, null)
    assert.ok(results.every(result => result.retrievedAt === '2026-08-07T08:00:00.000Z'))
  })

  it('normalizes temporal news queries and unwraps Bing result URLs', () => {
    assert.equal(webSearch.normalizeSearchQuery('帮我看下今天 AI 最新资讯', 'news'), '帮我看下 AI')
    const target = 'https://news.example.com/ai-release?id=7'
    const wrapped = `https://www.bing.com/news/apiclick.aspx?ref=FexRss&url=${encodeURIComponent(target)}`
    assert.equal(webSearch.normalizeResultUrl(wrapped), target)
    const endpoint = new URL(webSearch.defaultEndpointBuilder({
      query: 'AI',
      mode: 'news',
      recencyDays: 1,
    }))
    assert.equal(endpoint.searchParams.get('mkt'), 'en-US')
    assert.equal(endpoint.searchParams.get('freshness'), 'Day')
  })

  it('searches through an injectable provider and returns provenance', async () => {
    let requested = ''
    const result = await webSearch.searchWeb('AI news', {
      mode: 'news',
      recencyDays: 1,
      limit: 3,
      now: new Date('2026-08-07T08:00:00.000Z'),
      endpointBuilder: ({ query, mode }) => `https://search.example/${mode}?q=${encodeURIComponent(query)}`,
      fetchImpl: async url => {
        requested = url
        return new Response(rss([
          item({
            title: 'Model release',
            url: 'https://vendor.example/release',
            description: 'A new model shipped.',
            pubDate: 'Fri, 07 Aug 2026 04:00:00 GMT',
          }),
        ]), { status: 200, headers: { 'content-type': 'application/rss+xml' } })
      },
    })
    assert.equal(result.ok, true)
    assert.match(requested, /search\.example\/news/)
    assert.equal(result.provider, 'bing-rss')
    assert.equal(result.results[0].url, 'https://vendor.example/release')
    assert.equal(result.retrievedAt, '2026-08-07T08:00:00.000Z')
  })

  it('returns stable errors for invalid responses and provider failures', async () => {
    const invalid = await webSearch.searchWeb('AI', {
      fetchImpl: async () => new Response('<html>blocked</html>', { status: 200 }),
    })
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'invalid_response')

    const failed = await webSearch.searchWeb('AI', {
      fetchImpl: async () => new Response('down', { status: 503 }),
    })
    assert.equal(failed.ok, false)
    assert.equal(failed.code, 'http_error')
    assert.equal(failed.status, 503)
  })

  it('times out a slow provider', async () => {
    const result = await webSearch.searchWeb('AI', {
      timeoutMs: 100,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'timeout')
  })
})

describe('search_web agent tool', () => {
  it('declares a complete research contract and preserves source metadata', async () => {
    const bundle = agentWebTools.buildWebTools({
      now: new Date('2026-08-07T08:00:00.000Z'),
      searchFetchImpl: async () => new Response(rss([
        item({
          title: 'AI release',
          url: 'https://example.com/release',
          description: 'Release details',
          pubDate: 'Fri, 07 Aug 2026 06:00:00 GMT',
        }),
      ]), { status: 200 }),
    })
    const definition = bundle.definitions.find(def => def.function.name === 'search_web')
    assert.equal(definition._knowme.source, 'builtin')
    assert.equal(definition._knowme.capability, 'web-search')
    assert.equal(definition._knowme.research.kind, 'web-search')
    assert.equal(validateContract(definition._knowme).ok, true)
    const registry = createRegistry()
    assert.equal(registry.registerTool(
      definition,
      definition._knowme,
      bundle.handlers.search_web,
    ).ok, true)
    assert.ok(registry.getDefinitions().some(def => def.function.name === 'search_web'))

    const surface = agentTools.createToolSurface({
      extraDefinitions: bundle.definitions,
      handlers: bundle.handlers,
    })
    const executor = surface.createToolExecutor()
    const result = await executor.executeToolCall({
      name: 'search_web',
      arguments: JSON.stringify({ query: 'AI', mode: 'news', recency_days: 1 }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.sources[0].path, 'https://example.com/release')
    assert.equal(result.sources[0].publishedAt, '2026-08-07T06:00:00.000Z')
    assert.match(result.text, /摘要仅用于发现线索/)
  })
})
