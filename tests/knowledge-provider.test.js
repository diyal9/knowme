'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const kp = require('../src/lib/knowledge-provider')

describe('knowledge-provider', () => {
  it('normalizes local, qmd-local and remote-rag defaults', () => {
    const local = kp.normalizeProvider({ id: 'a' })
    assert.equal(local.kind, 'local')
    assert.equal(local.scope, 'client')
    assert.equal(local.authority, 2)
    assert.equal(local.displayName, '本地知识库')
    const qmd = kp.normalizeProvider({ id: 'b', kind: 'qmd-local', authority: 4, collectionId: 'root' })
    assert.equal(qmd.kind, 'qmd-local')
    assert.equal(qmd.collectionId, 'root')
    assert.equal(qmd.authority, 4)
    const rag = kp.normalizeProvider({ id: 'c', kind: 'remote-rag' })
    assert.equal(rag.kind, 'remote-rag')
    assert.equal(rag.topK, kp.DEFAULT_TOPK)
    assert.equal(rag.writable, false)
  })

  it('redacts apiKey in listing (hasApiKey only)', () => {
    const red = kp.redactProvider({ id: 'b', kind: 'remote-rag', apiKey: 'secret-123', endpoint: 'https://x' })
    assert.equal(red.hasApiKey, true)
    assert.equal('apiKey' in red, false)
    assert.equal(JSON.stringify(red).includes('secret-123'), false)
  })

  it('maps varied RAG response shapes to unified hits', () => {
    const a = kp.mapRagResponse({ hits: [{ title: 'T', snippet: 'S', score: 9 }] })
    assert.equal(a[0].title, 'T')
    assert.equal(a[0].score, 9)
    const b = kp.mapRagResponse({ results: [{ text: 'body', source: 'doc.md' }] })
    assert.equal(b[0].snippet, 'body')
    assert.equal(b[0].path, 'doc.md')
    const c = kp.mapRagResponse([{ content: 'plain' }])
    assert.equal(c[0].snippet, 'plain')
    assert.equal(kp.mapRagResponse(null).length, 0)
  })

  it('remote-rag posts and returns mapped hits', async () => {
    let seen = null
    const fetchFn = async (url, opts) => {
      seen = { url, opts }
      return { ok: true, status: 200, json: async () => ({ hits: [{ title: 'R', snippet: 'x' }] }) }
    }
    const res = await kp.queryProvider(
      { id: 'b', kind: 'remote-rag', endpoint: 'https://rag.example/query', apiKey: 'k1', collection: 'c' },
      '报销',
      { fetch: fetchFn }
    )
    assert.equal(res.ok, true)
    assert.equal(res.hits[0].title, 'R')
    assert.equal(seen.url, 'https://rag.example/query')
    assert.ok(seen.opts.headers.authorization.includes('k1'))
    assert.ok(seen.opts.body.includes('报销'))
  })

  it('remote-rag missing endpoint returns error, no request', async () => {
    const res = await kp.queryProvider({ id: 'b', kind: 'remote-rag' }, 'q', {})
    assert.equal(res.ok, false)
    assert.ok(res.message.includes('未配置'))
  })

  it('remote-rag non-200 degrades gracefully', async () => {
    const fetchFn = async () => ({ ok: false, status: 503, json: async () => ({}) })
    const res = await kp.queryProvider(
      { id: 'b', kind: 'remote-rag', endpoint: 'https://x', apiKey: 'k' },
      'q',
      { fetch: fetchFn }
    )
    assert.equal(res.ok, false)
    assert.equal(res.hits.length, 0)
    assert.equal(res.message.includes('k'), false)
  })

  it('remote-rag network failure never leaks apiKey', async () => {
    const fetchFn = async () => { throw new Error('boom apiKey=supersecret') }
    const res = await kp.queryProvider(
      { id: 'b', kind: 'remote-rag', endpoint: 'https://x', apiKey: 'supersecret' },
      'q',
      { fetch: fetchFn }
    )
    assert.equal(res.ok, false)
    assert.equal(res.message.includes('supersecret'), false)
  })

  it('remote-rag timeout aborts and reports timeout', async () => {
    const fetchFn = (url, opts) =>
      new Promise((_resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    const res = await kp.queryProvider(
      { id: 'b', kind: 'remote-rag', endpoint: 'https://x', apiKey: 'k' },
      'q',
      { fetch: fetchFn, timeoutMs: 20 }
    )
    assert.equal(res.ok, false)
    assert.ok(res.message.includes('超时'))
  })
})
