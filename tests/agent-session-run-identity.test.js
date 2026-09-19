'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { persistSessionRunIdentity } = require('../src/lib/agent-session-run-identity')
const { normalizeSession } = require('../src/lib/agent-sessions')

test('session normalization preserves the active root run identity', () => {
  const normalized = normalizeSession({ id: 'session-1', run: { id: 'run-1', status: 'active' } })
  assert.equal(normalized.run.id, 'run-1')
})

test('root run identity is persisted without overwriting newer stored session state', () => {
  const session = { id: 'session-1', updatedAt: 'old', run: { status: 'active', toolsUsed: [] } }
  let stored = [{
    id: 'session-1',
    messages: [{ id: 'newer-message' }],
    run: { status: 'active', toolsUsed: ['search_knowledge'] },
  }]
  const result = persistSessionRunIdentity(session, 'run-1', {
    loadAgentSessions: () => stored,
    saveAgentSessions: next => { stored = next },
  })
  assert.equal(result.ok, true)
  assert.equal(session.run.id, 'run-1')
  assert.equal(stored[0].run.id, 'run-1')
  assert.deepEqual(stored[0].run.toolsUsed, ['search_knowledge'])
  assert.deepEqual(stored[0].messages, [{ id: 'newer-message' }])
})

test('root run identity fails closed and restores the in-memory session when persistence fails', () => {
  const originalRun = { status: 'active' }
  const session = { id: 'session-1', updatedAt: 'old', run: originalRun }
  const result = persistSessionRunIdentity(session, 'run-1', {
    loadAgentSessions: () => [session],
    saveAgentSessions: () => { throw new Error('disk unavailable') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'run_identity_persist_failed')
  assert.equal(session.run, originalRun)
  assert.equal(session.updatedAt, 'old')
})
