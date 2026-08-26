const { describe, it } = require('node:test')
const assert = require('node:assert')

const runtime = require('../src/lib/embedding-runtime')

describe('embedding-runtime', () => {
  it('keeps knowledge and context enablement independent', () => {
    const settings = {
      apiEndpoint: 'https://api.example.com/v1/chat/completions',
      apiKey: 'main-key',
      semanticRerank: true,
      contextSemanticMode: 'off',
    }
    assert.ok(runtime.buildEmbedFn(settings, { scope: 'knowledge', fetchImpl: async () => ({ ok: true }) }))
    assert.equal(runtime.buildEmbedFn(settings, { scope: 'context', fetchImpl: async () => ({ ok: true }) }), null)
  })

  it('uses an independent endpoint and key and validates ordered vectors', async () => {
    let request = null
    const embed = runtime.buildEmbedFn({
      apiEndpoint: 'https://chat.example.com/v1',
      apiKey: 'main-key',
      embeddingEndpoint: 'https://vector.example.com/v1',
      embeddingApiKey: 'vector-key',
      embeddingModel: 'embed-test',
      contextSemanticMode: 'active',
    }, {
      scope: 'context',
      fetchImpl: async (url, options) => {
        request = { url, options }
        return {
          ok: true,
          json: async () => ({
            data: [
              { index: 1, embedding: [0, 1] },
              { index: 0, embedding: [1, 0] },
            ],
          }),
        }
      },
    })
    const vectors = await embed(['first', 'second'])
    assert.deepEqual(vectors, [[1, 0], [0, 1]])
    assert.equal(request.url, 'https://vector.example.com/v1/embeddings')
    assert.equal(request.options.headers.authorization, 'Bearer vector-key')
    assert.equal(request.options.redirect, 'error')
    assert.deepEqual(JSON.parse(request.options.body), { model: 'embed-test', input: ['first', 'second'] })
  })

  it('never forwards the main API key to a different custom host', () => {
    const settings = {
      apiEndpoint: 'https://chat.example.com/v1',
      apiKey: 'main-secret',
      embeddingEndpoint: 'https://vector.example.com/v1',
      contextSemanticMode: 'active',
    }
    const profile = runtime.resolveEmbeddingProfile(settings, { scope: 'context' })
    assert.equal(profile.apiKey, '')
    assert.equal(profile.inheritedApiKey, false)
    assert.equal(profile.requiresDedicatedApiKey, true)
    assert.equal(runtime.buildEmbedFn(settings, {
      scope: 'context', fetchImpl: async () => ({ ok: true }),
    }), null)
  })

  it('rejects invalid dimensions and non-finite values', async () => {
    const embed = runtime.buildEmbedFn({
      apiEndpoint: 'https://api.example.com/v1',
      apiKey: 'key',
      contextSemanticMode: 'active',
    }, {
      scope: 'context',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [Number.NaN] },
        ] }),
      }),
    })
    await assert.rejects(() => embed(['a', 'b']), error => error.code === 'dimension_mismatch')
  })

  it('uses a bounded timeout and reports timeout instead of hanging', async () => {
    const embed = runtime.buildEmbedFn({
      apiEndpoint: 'https://api.example.com/v1',
      apiKey: 'key',
      contextSemanticMode: 'active',
    }, {
      scope: 'context',
      timeoutMs: 250,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    })
    const started = Date.now()
    await assert.rejects(() => embed(['slow']), error => error.code === 'timeout')
    assert.ok(Date.now() - started < 1000)
  })

  it('probes inherited provider settings without exposing the endpoint in the result', async () => {
    const result = await runtime.probeEmbeddingConnection({
      apiEndpoint: 'https://api.example.com/v1/chat/completions',
      apiKey: 'key',
      embeddingModel: 'embed-test',
    }, {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.host, 'api.example.com')
    assert.equal(result.dimensions, 3)
    assert.equal(result.endpoint, undefined)
  })

  it('supports OpenAI and DashScope OpenAI-compatible contracts', async () => {
    const cases = [
      {
        provider: 'openai', endpoint: 'https://api.openai.com/v1', model: 'text-embedding-3-small',
      },
      {
        provider: 'dashscope', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'text-embedding-v3',
      },
    ]
    for (const item of cases) {
      let body
      const embed = runtime.buildEmbedFn({
        llmProvider: item.provider,
        apiEndpoint: item.endpoint,
        apiKey: 'test-key',
        contextSemanticMode: 'active',
      }, {
        scope: 'context',
        fetchImpl: async (_url, options) => {
          body = JSON.parse(options.body)
          return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 2] }] }) }
        },
      })
      assert.deepEqual(await embed(['contract']), [[1, 2]])
      assert.equal(body.model, item.model)
    }
  })

  it('rejects unsafe endpoints, oversized inputs and oversized responses', async () => {
    assert.equal(runtime.validateEmbeddingEndpoint('file:///private/key').ok, false)
    assert.equal(runtime.validateEmbeddingEndpoint('https://user:pass@example.com/v1').ok, false)
    const settings = {
      apiEndpoint: 'https://api.example.com/v1', apiKey: 'key', contextSemanticMode: 'active',
    }
    const inputLimited = runtime.buildEmbedFn(settings, {
      scope: 'context', maxTotalInputChars: 1024,
      fetchImpl: async () => { throw new Error('must not call') },
    })
    await assert.rejects(() => inputLimited(['x'.repeat(800), 'y'.repeat(800)]), error => error.code === 'input_too_large')

    const responseLimited = runtime.buildEmbedFn(settings, {
      scope: 'context', maxResponseBytes: 1024,
      fetchImpl: async () => ({
        ok: true,
        headers: { get: name => name === 'content-length' ? '2048' : null },
        json: async () => ({ data: [] }),
      }),
    })
    await assert.rejects(() => responseLimited(['x']), error => error.code === 'response_too_large')
  })

  it('classifies provider throttling as an HTTP failure without retrying', async () => {
    let calls = 0
    const embed = runtime.buildEmbedFn({
      apiEndpoint: 'https://api.example.com/v1', apiKey: 'key', contextSemanticMode: 'active',
    }, {
      scope: 'context',
      fetchImpl: async () => {
        calls++
        return { ok: false, status: 429 }
      },
    })
    await assert.rejects(() => embed(['rate limited']), error => error.code === 'http_error')
    assert.equal(calls, 1)
  })

  it('rejects malformed JSON and provider 5xx responses deterministically', async () => {
    const settings = {
      apiEndpoint: 'https://api.example.com/v1', apiKey: 'key', contextSemanticMode: 'active',
    }
    const malformed = runtime.buildEmbedFn(settings, {
      scope: 'context',
      fetchImpl: async () => ({ ok: true, text: async () => '{invalid' }),
    })
    await assert.rejects(() => malformed(['x']), error => error.code === 'invalid_response')
    const unavailable = runtime.buildEmbedFn(settings, {
      scope: 'context',
      fetchImpl: async () => ({ ok: false, status: 503 }),
    })
    await assert.rejects(() => unavailable(['x']), error => error.code === 'http_error')
  })

  it('rejects duplicate or missing vector indexes', async () => {
    const embed = runtime.buildEmbedFn({
      apiEndpoint: 'https://api.example.com/v1?region=test', apiKey: 'key', contextSemanticMode: 'active',
    }, {
      scope: 'context',
      fetchImpl: async url => {
        assert.equal(url, 'https://api.example.com/v1/embeddings?region=test')
        return { ok: true, json: async () => ({ data: [
          { index: 0, embedding: [1, 0] },
          { index: 0, embedding: [0, 1] },
        ] }) }
      },
    })
    await assert.rejects(() => embed(['a', 'b']), error => error.code === 'invalid_response')
  })
})
