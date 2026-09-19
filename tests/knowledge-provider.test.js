'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const kp = require('../src/lib/knowledge-provider')
const fabricWeave = require('../src/lib/fabric-weave')

describe('knowledge-provider', () => {
  it('normalizes local, folder, GitLab, qmd-local, remote-rag and RAGFlow defaults', () => {
    const local = kp.normalizeProvider({ id: 'a' })
    assert.equal(local.kind, 'local')
    assert.equal(local.scope, 'client')
    assert.equal(local.authority, 2)
    assert.equal(local.displayName, '本地知识库')
    const qmd = kp.normalizeProvider({ id: 'b', kind: 'qmd-local', authority: 4, collectionId: 'root', collections: [{ id: 'root', name: 'LLM Wiki', documentCount: 688 }] })
    assert.equal(qmd.kind, 'qmd-local')
    assert.equal(qmd.collectionId, 'root')
    assert.equal(qmd.authority, 4)
    assert.equal(qmd.collections[0].documentCount, 688)
    const rag = kp.normalizeProvider({ id: 'c', kind: 'remote-rag' })
    assert.equal(rag.kind, 'remote-rag')
    assert.equal(rag.topK, kp.DEFAULT_TOPK)
    assert.equal(rag.writable, false)
    const ragflow = kp.normalizeProvider({ id: 'rf', kind: 'ragflow', endpoint: 'https://rag.example', collectionIds: ['a'] })
    assert.equal(ragflow.kind, 'ragflow')
    assert.deepEqual(ragflow.collectionIds, ['a'])
    const folder = kp.normalizeProvider({ id: 'folder:one', kind: 'folder', sourceId: 'source:one' })
    const gitlab = kp.normalizeProvider({ id: 'gitlab:one', kind: 'gitlab', sourceId: 'source:repo', repositoryRef: 'group/project' })
    assert.equal(folder.kind, 'folder')
    assert.equal(folder.sourceId, 'source:one')
    assert.equal(gitlab.kind, 'gitlab')
    assert.equal(gitlab.repositoryRef, 'group/project')
  })

  it('routes every built-in kind through the Provider Adapter Registry', async () => {
    const kinds = kp.listProviderAdapters().map(adapter => adapter.kind)
    for (const kind of ['local', 'qmd-local', 'folder', 'gitlab', 'remote-rag', 'ragflow']) assert.equal(kinds.includes(kind), true)
    let providers = null
    const result = await kp.queryProvider({ id: 'folder:docs', kind: 'folder' }, 'decision', {
      userData: 'fixture',
      fabricSearch: async (_root, _query, options) => { providers = options.providers; return { ok: true, hits: [] } },
    })
    assert.equal(result.ok, true)
    assert.equal(providers.length, 1)
    assert.equal(providers[0].kind, 'folder')
  })

  it('resolves folder and GitLab adapters only through an authorized source binding', () => {
    const ctx = { sources: [{ id: 'source:repo', rootPath: 'D:/workspace/repo' }] }
    const folder = fabricWeave.resolveProviderRoot('D:/userdata', kp.normalizeProvider({ id: 'folder', kind: 'folder', sourceId: 'source:repo', subDir: 'docs' }), ctx)
    const gitlab = fabricWeave.resolveProviderRoot('D:/userdata', kp.normalizeProvider({ id: 'gitlab', kind: 'gitlab', sourceId: 'source:repo' }), ctx)
    assert.equal(folder.replace(/\\/g, '/'), 'D:/workspace/repo/docs')
    assert.equal(gitlab.replace(/\\/g, '/'), 'D:/workspace/repo')
    assert.equal(fabricWeave.resolveProviderRoot('D:/userdata', kp.normalizeProvider({ id: 'bad', kind: 'folder', sourceId: 'missing' }), ctx), null)
    assert.equal(fabricWeave.resolveProviderRoot('D:/userdata', kp.normalizeProvider({ id: 'escape', kind: 'folder', sourceId: 'source:repo', subDir: '../../secret' }), ctx), null)
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

  it('RAGFlow lists only collection metadata', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: [{ id: 'd1', name: 'Policies', description: 'Rules', document_count: 12, update_time: 10 }] }) })
    const result = await kp.listCollections({ id: 'rf', kind: 'ragflow', endpoint: 'https://rag.example', apiKey: 'secret' }, { fetch: fetchFn })
    assert.equal(result.ok, true)
    assert.deepEqual(result.collections[0], { id: 'd1', name: 'Policies', description: 'Rules', documentCount: 12, updatedAt: 10, tags: [], permission: null, status: null })
    assert.equal(JSON.stringify(result).includes('content'), false)
    assert.equal(JSON.stringify(result).includes('embedding'), false)
  })

  it('RAGFlow queries all authorized collections and maps ephemeral refs', async () => {
    let body = null
    let requestUrl = ''
    const fetchFn = async (url, opts) => {
      requestUrl = String(url)
      body = JSON.parse(opts.body)
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { chunks: [{ document_name: 'Policy', content: 'answer', dataset_id: 'a', doc_id: 'doc1', similarity: .8 }] } }) }
    }
    const result = await kp.queryProvider({ id: 'rf', kind: 'ragflow', endpoint: 'https://rag.example', apiKey: 'secret', collectionIds: ['a', 'b', 'c'] }, 'leave policy', { fetch: fetchFn })
    assert.equal(requestUrl, 'https://rag.example/api/v1/retrieval')
    assert.deepEqual(body.dataset_ids, ['a', 'b', 'c'])
    assert.equal(body.page_size, 8)
    assert.equal(result.hits[0].source, 'ragflow')
    assert.equal(result.hits[0].path, 'doc1')
    assert.equal(body.keyword, true)
    assert.equal(body.use_kg, false)
    assert.equal(body.top_k, 30)
  })

  it('builds the complete RAGFlow retrieval schema from query options', () => {
    const request = kp.buildRagflowRetrievalRequest(
      { id: 'rf', kind: 'ragflow', collectionIds: ['d1'], topK: 8 },
      '活动配置规则',
      {
        collectionIds: ['d2', 'd2'],
        documentIds: ['f1'],
        candidateTopK: 40,
        page: 2,
        pageSize: 12,
        similarityThreshold: 0.15,
        vectorSimilarityWeight: 0.4,
        keyword: true,
        useKnowledgeGraph: true,
        rerankId: 'rerank-1',
        crossLanguages: ['Chinese', 'English'],
        metadataCondition: { fields: [{ name: 'project', value: 'TH' }] },
        tocEnhance: true,
        forceRefresh: true,
      },
    )
    assert.deepEqual(request, {
      dataset_ids: ['d2'],
      question: '活动配置规则',
      top_k: 40,
      page: 2,
      page_size: 12,
      similarity_threshold: 0.15,
      vector_similarity_weight: 0.4,
      keyword: true,
      use_kg: true,
      document_ids: ['f1'],
      rerank_id: 'rerank-1',
      cross_languages: ['Chinese', 'English'],
      metadata_condition: { fields: [{ name: 'project', value: 'TH' }] },
      toc_enhance: true,
      force_refresh: true,
    })
  })

  it('selects an intent-aware retrieval profile and lets explicit options win', () => {
    assert.equal(kp.classifyRagflowQueryIntent('每日签到活动配置规则.md 在哪里'), 'exact')
    assert.equal(kp.classifyRagflowQueryIntent('这个规则为什么这样配置？'), 'factual')
    assert.equal(kp.classifyRagflowQueryIntent('这个知识库有哪些活动规则？'), 'exploratory')
    const options = kp.resolveRagflowRetrievalOptions('这个知识库有哪些活动规则？', kp.normalizeProvider({ id: 'rf', kind: 'ragflow' }), {
      vectorSimilarityWeight: 0.35,
      keyword: true,
    })
    assert.equal(options.queryIntent, 'exploratory')
    assert.equal(options.vectorSimilarityWeight, 0.35)
    assert.equal(options.keyword, true)
    assert.equal(options.useKnowledgeGraph, true)
  })

  it('reports the actual Dataset scope when RAGFlow returns no chunks', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: { chunks: [], total: 0 } }) })
    const result = await kp.queryProvider(
      { id: 'rf', kind: 'ragflow', endpoint: 'https://rag.example', apiKey: 'secret', collectionIds: ['d1', 'd2'] },
      '每日签到活动配置规则',
      { fetch: fetchFn },
    )
    assert.equal(result.ok, true)
    assert.match(result.message, /d1, d2/)
    assert.deepEqual(result.diagnostics.datasetIds, ['d1', 'd2'])
    assert.equal(result.diagnostics.request.keyword, true)
  })

  it('resolves an exact filename to document_ids before retrying retrieval', async () => {
    const requests = []
    const fetchFn = async (url, opts) => {
      requests.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null })
      if (String(url).includes('/documents?')) {
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { docs: [{ id: 'doc-sign', name: '每日签到活动配置规则.md' }] } }) }
      }
      if (requests.length === 1) return { ok: true, status: 200, json: async () => ({ code: 0, data: { chunks: [], total: 0 } }) }
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { chunks: [{ document_name: '每日签到活动配置规则.md', doc_id: 'doc-sign', content: '签到规则', dataset_id: 'd1', similarity: .9 }], total: 1 } }) }
    }
    const result = await kp.queryProvider({ id: 'rf', kind: 'ragflow', endpoint: 'https://rag.example', apiKey: 'secret', collectionIds: ['d1'] }, '每日签到活动配置规则', { fetch: fetchFn })
    assert.equal(result.hits[0].path, 'doc-sign')
    assert.deepEqual(requests[2].body.document_ids, ['doc-sign'])
  })
})
