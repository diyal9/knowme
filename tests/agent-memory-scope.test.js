'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selectScopedWorkMemories } = require('../src/lib/agent-memory-scope')

test('matching a topic or legacy projected scope cannot authorize another project memory', () => {
  const items = [
    { id: 'legacy', type: 'work_memory', scope: 'project', text: 'matching task words' },
    { id: 'other', type: 'work_memory', projectId: 'b', text: 'other project' },
    { id: 'own', type: 'work_memory', projectId: 'a', text: 'own project' },
    { id: 'task', type: 'work_memory', source: { sessionId: 's' }, text: 'this task' },
  ]
  const result = selectScopedWorkMemories(items, { brainScopes: ['project'], allowPersonalMemory: false }, { id: 's', projectId: 'a' })
  assert.deepEqual(result.items.map(item => item.id), ['own', 'task'])
  assert.deepEqual(result.omitted.map(item => item.reason), ['scope_unproven', 'scope_unproven'])
  assert.doesNotMatch(JSON.stringify(result.omitted), /matching task|other project/)
})

test('authorized personal work memory is deduplicated and project grants are not assumed', () => {
  const items = [{ id: 'a', type: 'work_memory', projectId: 'a', text: 'same text' }, { id: 'b', type: 'work_memory', text: 'same  text' }]
  assert.equal(selectScopedWorkMemories(items, { allowPersonalMemory: true }).items.length, 1)
  assert.equal(selectScopedWorkMemories(items, { brainScopes: [] }, { projectId: 'a' }).items.length, 0)
  assert.equal(selectScopedWorkMemories([{ type: 'work_memory', sessionId: 's', text: 'same session' }],
    { brainScopes: [], allowPersonalMemory: false }, { id: 's' }).items.length, 0)
})
