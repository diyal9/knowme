'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { uniqueKnowledgeHits } = require('../src/lib/knowledge-hit-projection')
test('duplicate fragments are removed but different chunks and source citations survive', () => {
  const a = { refKey: 'doc', providerId: 'a', snippet: 'same text', provenance: { kbId: 'a' } }
  const rows = uniqueKnowledgeHits([a, { ...a, snippet: 'same  text' }, { ...a, snippet: 'second chunk' }, { ...a, providerId: 'b' }])
  assert.equal(rows.length, 3)
  assert.equal(rows[0], a)
  assert.deepEqual(rows[0].provenance, { kbId: 'a' })
})
