const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const {
  createCapabilityHubService,
  projectSessionKnowledge,
  resolveSessionRetrievalProviders,
  validateSessionContextPatch,
} = require('../src/lib/capability-hub-service')
const { createSession } = require('../src/lib/agent-sessions')

const catalog = {
  activeProviderId: 'local-default',
  providers: [
    { id: 'local-default', displayName: '我的知识', kind: 'qmd-local' },
    { id: 'kp_remote', displayName: '远程库', kind: 'remote-rag' },
  ],
}

describe('session knowledge scope', () => {
  it('projects default mode when session has no explicit knowledgeRefs', () => {
    const session = createSession('general', 1)
    const projection = projectSessionKnowledge(session, catalog)
    assert.equal(projection.mode, 'default')
    assert.equal(projection.selected[0].status, 'default')
    assert.equal(projection.selected[0].id, 'local-default')
    assert.equal(projection.degraded, false)
  })

  it('projects ready and limited providers for explicit selections', () => {
    const session = createSession('general', 1, {
      knowledgeRefs: [{ id: 'kp_remote' }, { id: 'missing-kb' }],
    })
    const projection = projectSessionKnowledge(session, catalog)
    assert.equal(projection.mode, 'selected')
    assert.deepEqual(
      projection.selected.map(item => [item.id, item.status]),
      [['kp_remote', 'ready'], ['missing-kb', 'limited']],
    )
    assert.match(projection.message, /部分/)
  })

  it('marks all-invalid explicit selections as degraded without expanding scope', () => {
    const session = createSession('general', 1, {
      knowledgeRefs: [{ id: 'gone-a' }, { id: 'gone-b' }],
    })
    const scope = resolveSessionRetrievalProviders(session, {
      resolveProviderById: () => null,
      getActiveProvider: () => ({ id: 'local-default', kind: 'qmd-local' }),
    })
    assert.equal(scope.mode, 'selected')
    assert.equal(scope.providers.length, 0)
    assert.equal(scope.degraded, true)
    assert.match(scope.message, /不会检索其他知识库/)
  })

  it('falls back to active provider when no explicit selection', () => {
    const active = { id: 'local-default', kind: 'qmd-local', apiKey: 'secret' }
    const scope = resolveSessionRetrievalProviders(createSession('general', 1), {
      resolveProviderById: () => null,
      getActiveProvider: () => active,
    })
    assert.equal(scope.mode, 'default')
    assert.deepEqual(scope.providers, [active])
    assert.equal(scope.degraded, false)
  })

  it('allows session context IPC patch for knowledgeRefs and capability bindings', () => {
    assert.equal(validateSessionContextPatch({ knowledgeRefs: [] }).ok, true)
    assert.equal(validateSessionContextPatch({ skills: ['a'], connectors: [] }).ok, true)
    assert.match(validateSessionContextPatch({ apiKey: 'x' }).error, /仅允许/)
    assert.match(validateSessionContextPatch({ knowledgeRefs: 'bad' }).error, /数组/)
  })

  it('sessionDto exposes sanitized knowledge projection without provider secrets', () => {
    const hub = createCapabilityHubService({
      getUserData: () => '',
      getKnowledgeDir: () => '',
      getConnectorsApi: () => null,
      getKnowledgeCatalog: () => catalog,
      resolveProviderById: (id) => (id === 'kp_remote'
        ? { id: 'kp_remote', kind: 'remote-rag', apiKey: 'secret-key' }
        : null),
      getActiveProvider: () => ({ id: 'local-default', kind: 'qmd-local' }),
    })
    const dto = hub.sessionDto(createSession('general', 1, {
      taskRef: { id: 'task-1' },
      knowledgeRefs: [{ id: 'kp_remote' }],
    }))
    assert.deepEqual(dto.taskRef, { id: 'task-1' })
    assert.equal(dto.knowledge.mode, 'selected')
    assert.equal(dto.knowledge.selected[0].status, 'ready')
    assert.equal(JSON.stringify(dto).includes('secret-key'), false)
    assert.equal(JSON.stringify(dto).includes('apiKey'), false)
  })

  it('updateSessionKnowledgeContext normalizes knowledgeRefs', () => {
    const hub = createCapabilityHubService({
      getUserData: () => '',
      getKnowledgeDir: () => '',
      getConnectorsApi: () => null,
      getKnowledgeCatalog: () => catalog,
    })
    const session = createSession('general', 1)
    const updated = hub.updateSessionKnowledgeContext(session, {
      knowledgeRefs: [{ id: 'kp_remote' }, { id: 'kp_remote' }, { id: 'local-default' }],
    })
    assert.equal(updated.ok, true)
    assert.deepEqual(updated.session.knowledgeRefs, [{ id: 'kp_remote' }, { id: 'local-default' }])
  })

  it('gates prompt-side local knowledge context with the authoritative Session scope', () => {
    const aiGenerate = [
      fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'agent-generate-prepare.ts'), 'utf8'),
      fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'agent-generate-libs.ts'), 'utf8'),
    ].join('\n')
    assert.ok(aiGenerate.includes('resolveSessionRetrievalScope(session)'), 'ai-generate resolves scope from stored Session')
    assert.ok(aiGenerate.includes("['local', 'qmd-local'].includes"), 'local provider kinds are recognized explicitly')
    assert.ok(aiGenerate.includes('heavyCtx && localKnowledgeEnabled'), 'local snippets are excluded from remote-only or degraded scopes')
    assert.ok(aiGenerate.includes('providers: retrievalScope.providers'), 'Fabric receives only resolved providers')
  })
})
