'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { knowledgeProviderFingerprint: fingerprint } = require('../src/lib/knowledge-provider-fingerprint')

test('knowledge cache identity changes with source, credential, version and collection but not diagnostics', () => {
  const provider = { id: 'same', kind: 'ragflow', endpoint: 'https://one.test/?key=private', apiKey: 'secret', collectionIds: ['b', 'a'] }
  const original = fingerprint(provider)
  assert.match(original, /^[a-f0-9]{64}$/)
  assert.doesNotMatch(original, /private|secret|one\.test/)
  assert.equal(original, fingerprint({ ...provider, collectionIds: ['a', 'b'], lastQueryAt: Date.now(), health: 'ok' }))
  for (const patch of [{ endpoint: 'https://two.test' }, { apiKey: 'rotated' }, { collectionIds: ['a'] }, { version: 2 }, { sourceId: 'other' }]) {
    assert.notEqual(original, fingerprint({ ...provider, ...patch }))
  }
})
