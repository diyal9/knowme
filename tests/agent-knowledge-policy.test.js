'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { resolveAgentKnowledgePolicy } = require('../src/lib/agent-generate-prepare')
const { createKnowledgeTools } = require('../src/lib/agent-generate-libs')
const { makeKnowledgeCollectionRef } = require('../src/shared/knowledge-selection')

const providers = [
  { id: 'local-team', kind: 'folder', collectionIds: ['docs', 'decisions'] },
  { id: 'rag-prod', kind: 'ragflow', collectionIds: ['manual', 'private'] },
]

describe('Agent Knowledge Policy', () => {
  it('gives the personal partner confirmed Brain scopes without leaking unlisted collections', () => {
    const policy = resolveAgentKnowledgePolicy({ agentId: 'personal' }, null, providers)
    assert.deepEqual(policy.brainScopes, ['global', 'project'])
    assert.equal(policy.allowPersonalMemory, true)
    assert.deepEqual(policy.providers.map(item => item.providerId), ['local-team', 'rag-prod'])
  })

  it('fails closed for an isolated Agent and intersects Provider collections', () => {
    const policy = resolveAgentKnowledgePolicy({
      agentId: 'researcher',
      knowledgePolicy: {
        brainScopes: [],
        providers: [{ providerId: 'rag-prod', collectionIds: ['manual', 'not-authorized'] }],
        allowPersonalMemory: false,
        allowRemoteQuery: true,
      },
    }, null, providers)
    assert.deepEqual(policy.brainScopes, [])
    assert.deepEqual(policy.providers, [{ providerId: 'rag-prod', collectionIds: ['manual'] }])
    assert.equal(policy.allowPersonalMemory, false)
  })

  it('blocks direct kbQuery and kbGet attempts outside the resolved policy', async () => {
    const calls = []
    const tools = createKnowledgeTools({
      app: { getPath: () => 'C:/tmp/knowme-policy-test' },
      fabricRetrieval: {
        fabricSearch: async () => ({ ok: true, hits: [] }),
        kbQuery: async (_userData, collection) => {
          calls.push(collection)
          return { ok: true, hits: [{ ref: 'allowed-ref' }] }
        },
        kbGet: async (_userData, ref) => ({ ok: true, ref }),
      },
      retrievalScope: { degraded: false, providers },
      knowledgePolicy: {
        brainScopes: [],
        providers: [{ providerId: 'rag-prod', collectionIds: ['manual'] }],
        allowPersonalMemory: false,
        allowRemoteQuery: true,
      },
      embedFn: null,
      ensureFabricSeeded: () => {},
      buildFabricCtx: () => ({}),
    })

    const deniedCollection = await tools.kbQueryTool('private', 'secret')
    assert.equal(deniedCollection.code, 'knowledge_scope_denied')
    assert.deepEqual(calls, [])
    const deniedRef = await tools.kbGetTool('guessed-ref')
    assert.equal(deniedRef.code, 'knowledge_scope_denied')

    const query = await tools.kbQueryTool('manual', 'public')
    assert.equal(query.ok, true)
    assert.deepEqual(calls, ['manual'])
    assert.equal((await tools.kbGetTool('allowed-ref')).ok, true)
  })

  it('resolves a selected RAG Dataset ref for partner chat', async () => {
    const calls = []
    const tools = createKnowledgeTools({
      app: { getPath: () => 'C:/tmp/knowme-policy-test' },
      fabricRetrieval: { kbQuery: async () => ({ ok: true, hits: [] }) },
      retrievalScope: { degraded: false, providers: [{ id: 'rag-prod', kind: 'ragflow', collectionIds: ['manual'] }] },
      knowledgePolicy: { providers: [{ providerId: 'rag-prod', collectionIds: ['manual'] }], allowRemoteQuery: true },
      ensureFabricSeeded: () => {},
      buildFabricCtx: () => ({
        queryProvider: async (provider, query, ctx) => {
          calls.push({ provider: provider.id, query, collections: ctx.collectionIds })
          return { ok: true, hits: [{ ref: 'dataset-ref' }] }
        },
      }),
    })
    const ref = makeKnowledgeCollectionRef('rag-prod', 'manual')
    const result = await tools.kbQueryTool(ref, '活动规则')
    assert.equal(result.ok, true)
    assert.deepEqual(calls, [{ provider: 'rag-prod', query: '活动规则', collections: ['manual'] }])
  })

  it('normalizes selected RAG Dataset refs before building Agent permissions', () => {
    const ref = makeKnowledgeCollectionRef('rag-prod', 'manual')
    const policy = resolveAgentKnowledgePolicy({
      agentId: 'researcher',
      knowledgePolicy: {
        providers: [{ providerId: 'rag-prod', collectionIds: [ref] }],
        allowRemoteQuery: true,
      },
    }, null, providers)
    assert.deepEqual(policy.providers, [{ providerId: 'rag-prod', collectionIds: ['manual'] }])
  })

  it('normalizes legacy provider:dataset references before authorization', () => {
    const policy = resolveAgentKnowledgePolicy({
      agentId: 'researcher',
      knowledgePolicy: {
        providers: [{ providerId: 'rag-prod', collectionIds: ['rag-prod:manual'] }],
        allowRemoteQuery: true,
      },
    }, null, providers)
    assert.deepEqual(policy.providers, [{ providerId: 'rag-prod', collectionIds: ['manual'] }])
  })

  it('directly queries selected RAG providers before Brain routing', async () => {
    const calls = []
    const tools = createKnowledgeTools({
      app: { getPath: () => 'C:/tmp/knowme-policy-test' },
      fabricRetrieval: { kbQuery: async () => ({ ok: true, hits: [] }) },
      retrievalScope: { degraded: false, providers: [{ id: 'rag-prod', kind: 'ragflow', collectionIds: ['manual', 'rules'] }] },
      knowledgePolicy: { providers: [{ providerId: 'rag-prod', collectionIds: ['manual', 'rules'] }], allowRemoteQuery: true },
      ensureFabricSeeded: () => {},
      buildFabricCtx: () => ({
        queryProvider: async (provider, query, ctx) => {
          calls.push({ provider: provider.id, query, collectionIds: ctx.collectionIds })
          return { ok: true, hits: [{ ref: 'rag-hit', title: '每日签到活动配置规则' }] }
        },
      }),
    })
    const result = await tools.queryKnowledge('每日签到活动配置规则')
    assert.equal(result.hits.length, 1)
    assert.deepEqual(calls, [{ provider: 'rag-prod', query: '每日签到活动配置规则', collectionIds: ['manual', 'rules'] }])
  })
})
