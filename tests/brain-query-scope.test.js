const { test } = require('node:test')
const assert = require('node:assert/strict')
const { scopeBrainQueryData } = require('../src/lib/brain-query-scope')

const data = {
  nodes: [
    { id: 'public', kind: 'concept', scope: 'global' },
    { id: 'a', kind: 'concept', scope: 'project', projectId: 'a' },
    { id: 'b', kind: 'concept', scope: 'project', projectId: 'b' },
    { id: 'personal', kind: 'preference', scope: 'global' },
  ],
  evidence: [{ id: 'ea', projectId: 'a' }, { id: 'eb', projectId: 'b' }],
  claims: [
    { id: 'ca', subjectId: 'public', objectNodeId: 'a', evidenceRefs: ['ea'] },
    { id: 'cb', subjectId: 'public', objectNodeId: 'b', evidenceRefs: ['eb'] },
    { id: 'cross', subjectId: 'a', objectNodeId: 'b', evidenceRefs: ['ea', 'eb'] },
  ],
}

test('empty Brain scopes deny every node even when personal memory is allowed', () => {
  const scoped = scopeBrainQueryData(data, { brainScopes: [], allowPersonalMemory: true })
  assert.deepEqual(scoped.nodes, [])
  assert.deepEqual(scoped.claims, [])
})

test('runtime project scope restricts evidence and explanation paths, not only ranked nodes', () => {
  const scoped = scopeBrainQueryData(data, { brainScopes: ['global', 'project'], allowPersonalMemory: false }, { projectId: 'a' })
  assert.deepEqual(scoped.nodes.map(n => n.id), ['public', 'a'])
  assert.deepEqual(scoped.evidence.map(e => e.id), ['ea'])
  assert.deepEqual(scoped.claims.map(c => c.id), ['ca'])
  assert.equal(data.nodes.length, 4)
})

test('an unbound runtime does not search other projects; unspecified interactive scope retains access', () => {
  const policy = { brainScopes: ['global', 'project'], allowPersonalMemory: false }
  assert.deepEqual(scopeBrainQueryData(data, policy, { projectId: null }).nodes.map(n => n.id), ['public'])
  assert.deepEqual(scopeBrainQueryData(data, policy).nodes.map(n => n.id), ['public', 'a', 'b'])
})
