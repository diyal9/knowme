const { test } = require('node:test')
const assert = require('node:assert/strict')
const { guardKnowledgeTools, knowledgeScopeFingerprint } = require('../src/lib/agent-knowledge-request-guard')
const { createKnowledgeTools } = require('../src/lib/agent-generate-libs')

test('knowledge guard checks revocation before IO and before disclosing in-flight results', async () => {
  const scope = { providers: [{ id: 'p', collectionIds: ['a'] }] }
  const policy = { providers: [{ providerId: 'p', collectionIds: ['a'] }], allowRemoteQuery: true }
  let latest = { retrievalScope: scope, knowledgePolicy: policy }
  let calls = 0
  const guarded = guardKnowledgeTools({ read: async () => { calls++; latest = null; return { text: 'private' } } },
    { retrievalScope: scope, knowledgePolicy: policy, getCurrentScope: () => latest })
  assert.equal((await guarded.read()).code, 'knowledge_scope_changed')
  assert.equal(calls, 1)
  assert.equal((await guarded.read()).code, 'knowledge_scope_changed')
  assert.equal(calls, 1)
})

test('knowledge fingerprint is canonical and does not include credentials', () => {
  const a = knowledgeScopeFingerprint({ providers: [{ id: 'p', collectionIds: ['b', 'a'], apiKey: 'secret' }] })
  const b = knowledgeScopeFingerprint({ providers: [{ id: 'p', collectionIds: ['a', 'b'], apiKey: 'secret' }] })
  assert.equal(a, b)
  assert.equal(a.includes('secret'), false)
  assert.notEqual(a, knowledgeScopeFingerprint({ providers: [{ id: 'p', collectionIds: ['a', 'b'], apiKey: 'changed' }] }))
})

test('re-binding the session project invalidates the previous native Brain query closure', async () => {
  let calls = 0
  const guarded = guardKnowledgeTools({ read: async () => { calls++; return { ok: true } } }, {
    retrievalScope: { providers: [] }, knowledgePolicy: {}, projectId: 'a',
    getCurrentScope: () => ({ retrievalScope: { providers: [] }, knowledgePolicy: {}, projectId: 'b' }),
  })
  assert.equal((await guarded.read()).code, 'knowledge_scope_changed')
  assert.equal(calls, 0)
})

test('direct selected RAG query cannot bypass remote-query denial', async () => {
  let calls = 0
  const tools = createKnowledgeTools({
    app: { getPath: () => 'unused' }, fabricRetrieval: {},
    retrievalScope: { providers: [{ id: 'remote', kind: 'ragflow', collectionIds: ['a'] }] },
    knowledgePolicy: { providers: [{ providerId: 'remote', collectionIds: ['a'] }], allowRemoteQuery: false },
    ensureFabricSeeded: () => {}, buildFabricCtx: () => ({ queryProvider: async () => { calls++; return { hits: [] } } }),
  })
  assert.equal((await tools.queryKnowledge('query')).code, 'remote_query_denied')
  assert.equal(calls, 0)
})

test('Brain access is not authorization to guess arbitrary document references', async () => {
  let calls = 0
  const tools = createKnowledgeTools({
    app: { getPath: () => 'unused' }, fabricRetrieval: { kbGet: async () => { calls++ } },
    retrievalScope: { providers: [] }, knowledgePolicy: { brainScopes: ['project'] },
    ensureFabricSeeded: () => {}, buildFabricCtx: () => ({}),
  })
  assert.equal((await tools.kbGetTool('another-agent-document')).code, 'knowledge_scope_denied')
  assert.equal(calls, 0)
})

test('provider-wide tool target obeys collection policy and cannot fall back to every dataset', async () => {
  const calls = []
  const tools = createKnowledgeTools({
    app: { getPath: () => 'unused' }, fabricRetrieval: {},
    retrievalScope: { providers: [{ id: 'remote', kind: 'ragflow', collectionIds: ['a', 'secret'] }] },
    knowledgePolicy: { providers: [{ providerId: 'remote', collectionIds: ['a'] }], allowRemoteQuery: true },
    ensureFabricSeeded: () => {}, buildFabricCtx: () => ({ queryProvider: async (_p, _q, options) => { calls.push(options.collectionIds); return { hits: [] } } }),
  })
  await tools.kbQueryTool('remote', 'query')
  assert.deepEqual(calls, [['a']])
  assert.equal((await tools.kbQueryTool('secret', 'query')).code, 'knowledge_scope_denied')
})

test('native Brain works without a mounted Wiki or RAG; unavailable explicit selections do not fall back', async () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-native-scope-'))
  try {
    const makeTools = mode => createKnowledgeTools({
      app: { getPath: () => root }, fabricRetrieval: { fabricSearch: async () => { throw new Error('No external provider authorized') } },
      retrievalScope: { mode, degraded: true, providers: [] },
      knowledgePolicy: { brainScopes: ['project'], providers: [], allowPersonalMemory: false, allowRemoteQuery: false },
      ensureFabricSeeded: () => {}, buildFabricCtx: () => ({ providers: [] }),
    })
    const native = await makeTools('default').queryKnowledge('当前项目决策')
    assert.notEqual(native.degraded, true)
    assert.ok(Array.isArray(native.hits))
    const selected = await makeTools('selected').queryKnowledge('当前项目决策')
    assert.equal(selected.degraded, true)
    assert.deepEqual(selected.hits, [])
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
