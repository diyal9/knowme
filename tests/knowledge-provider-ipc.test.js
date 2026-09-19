'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const knowledgeProvider = require('../src/lib/knowledge-provider')
const { registerKnowledgeProviderIpc } = require('../src/ipc/knowledge-provider')

function createHarness(initialConfig = {}) {
  const handlers = new Map()
  let config = { providers: [], ...initialConfig }
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  const listProvidersRedacted = () => ({
    providers: config.providers.map(knowledgeProvider.redactProvider),
    activeProviderId: config.activeProviderId || 'local-default',
  })
  registerKnowledgeProviderIpc(ipcMain, {
    app: { getPath: () => 'fixture-user-data' },
    knowledgeOs: {
      loadConfig: () => config,
      saveConfig: (_root, patch) => { config = { ...config, ...patch }; return config },
    },
    knowledgeProvider,
    fabricGraph: {},
    fabricWeave: {},
    fabricRetrieval: {},
    kosSourcesCtx: () => ({}),
    ensureFabricSeeded: () => {},
    buildFabricCtx: () => ({}),
    listProvidersRedacted,
    encProviderKey: (value) => `encrypted:${value.length}`,
  })
  return { handlers, getConfig: () => config }
}

describe('knowledge-provider IPC', () => {
  it('mounts multiple LLM Wiki folders as independent providers', async () => {
    const harness = createHarness()
    const save = harness.handlers.get('knowledge-provider-save')

    const first = await save({}, { kind: 'qmd-local', displayName: '研发 Wiki', sourceId: 'source:dev' })
    const second = await save({}, { kind: 'qmd-local', displayName: '产品 Wiki', sourceId: 'source:product' })

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.notEqual(first.id, second.id)
    assert.equal(harness.getConfig().providers.length, 2)
    assert.deepEqual(harness.getConfig().providers.map(item => item.sourceId), ['source:dev', 'source:product'])
    assert.equal(harness.getConfig().providers.every(item => item.kind === 'qmd-local'), true)
  })

  it('never returns or persists a plaintext RAGFlow key', async () => {
    const harness = createHarness()
    const save = harness.handlers.get('knowledge-provider-save')
    const result = await save({}, { kind: 'ragflow', displayName: '团队 RAG', endpoint: 'https://rag.example', apiKey: 'private-value' })

    assert.equal(result.ok, true)
    assert.equal(JSON.stringify(result).includes('private-value'), false)
    assert.equal(harness.getConfig().providers[0].apiKeyEnc, 'encrypted:13')
    assert.equal('apiKey' in harness.getConfig().providers[0], false)
  })
})
