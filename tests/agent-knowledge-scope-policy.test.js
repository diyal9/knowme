const { test } = require('node:test')
const assert = require('node:assert/strict')
const { resolveSessionRetrievalProviders, projectSessionKnowledge } = require('../src/lib/capability-hub/map')
const { makeKnowledgeCollectionRef: ref } = require('../src/shared/knowledge-selection')

const remote = Object.freeze({ id: 'remote', displayName: 'Remote', kind: 'ragflow', collectionIds: Object.freeze(['a', 'b']), apiKey: 'not-in-ui' })
const local = { id: 'local', kind: 'qmd-local' }
const deps = { getActiveProvider: () => local, resolveProviderById: id => ({ local, remote }[id]) }

test('empty Agent knowledge scope never falls back to active global provider', () => {
  assert.deepEqual(resolveSessionRetrievalProviders({}, { ...deps, allowedKnowledgeIds: [] }).providers, [])
  assert.deepEqual(resolveSessionRetrievalProviders({ knowledgeRefs: [{ id: 'local' }] }, { ...deps, allowedKnowledgeIds: [] }).providers, [])
})

test('Agent defaults select only granted knowledge, not the global default', () => {
  const result = resolveSessionRetrievalProviders({}, { ...deps, allowedKnowledgeIds: [ref('remote', 'a')] })
  assert.deepEqual(result.providers.map(p => p.id), ['remote'])
  assert.deepEqual(result.providers[0].collectionIds, ['a'])
})

test('broad session reference cannot expand a collection-only Agent grant', () => {
  const result = resolveSessionRetrievalProviders({ knowledgeRefs: [{ id: 'remote' }, { id: ref('remote', 'b') }] }, { ...deps, allowedKnowledgeIds: [ref('remote', 'a')] })
  assert.deepEqual(result.providers[0].collectionIds, ['a'])
  assert.deepEqual(result.missingIds, [ref('remote', 'b')])
})

test('duplicate and mixed references are order independent without mutating provider grants', () => {
  for (const ids of [[ref('remote', 'a'), 'remote'], ['remote', ref('remote', 'a')]]) {
    const result = resolveSessionRetrievalProviders({ knowledgeRefs: ids.map(id => ({ id })) }, deps)
    assert.equal(result.providers.length, 1)
    assert.deepEqual(result.providers[0].collectionIds, ['a', 'b'])
    assert.notEqual(result.providers[0].collectionIds, remote.collectionIds)
  }
})

test('knowledge projection excludes credentials and ungranted sources', () => {
  const result = projectSessionKnowledge({}, { activeProviderId: 'local', providers: [local, remote] }, { allowedKnowledgeIds: [ref('remote', 'a')] })
  assert.deepEqual(result.available.map(p => p.id), ['remote'])
  assert.equal(JSON.stringify(result).includes('not-in-ui'), false)
  assert.equal(JSON.stringify(result).includes('apiKey'), false)
})

test('disabled provider and nonexistent collections do not cause cross-source fallback', () => {
  const result = resolveSessionRetrievalProviders({}, { ...deps, allowedKnowledgeIds: [ref('remote', 'missing')] })
  assert.deepEqual(result.providers, [])
  const disabled = resolveSessionRetrievalProviders({}, { ...deps, allowedKnowledgeIds: ['remote'], resolveProviderById: () => ({ ...remote, enabled: false }) })
  assert.deepEqual(disabled.providers, [])
})

test('provider deny defeats collection grants and collection deny narrows broad grants', () => {
  const blocked = resolveSessionRetrievalProviders({}, { ...deps, allowedKnowledgeIds: [ref('remote', 'a')], deniedKnowledgeIds: ['remote'] })
  assert.deepEqual(blocked.providers, [])
  const narrowed = resolveSessionRetrievalProviders({ knowledgeRefs: [{ id: 'remote' }] }, { ...deps, deniedKnowledgeIds: ['ragflow:remote:b'] })
  assert.deepEqual(narrowed.providers[0].collectionIds, ['a'])
})
