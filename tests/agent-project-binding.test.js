'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  persistSessionProjectBinding,
  guardFileAdapterForProjectBinding,
  guardToolBundleForProjectBinding,
} = require('../src/lib/project-session-binding.ts')

test('first file operation persists an unbound session project exactly once', async () => {
  const session = { id: 'session-1', projectId: null, title: 'Global topic' }
  let stored = [{ ...session }]
  let saves = 0
  const bind = () => persistSessionProjectBinding(session, 'project-a', {
    loadAgentSessions: () => stored,
    saveAgentSessions: next => {
      saves += 1
      stored = next
    },
  })
  const adapter = guardFileAdapterForProjectBinding({
    validatePath: rel => ({ ok: true, rel }),
    listDir: async rel => ({ ok: true, rel, nodes: [] }),
  }, bind)

  assert.equal(session.projectId, null)
  assert.deepEqual(adapter.validatePath('notes.md'), { ok: true, rel: 'notes.md' })
  assert.equal(session.projectId, 'project-a')
  assert.equal(stored[0].projectId, 'project-a')
  await adapter.listDir('')
  assert.equal(saves, 1)
})

test('file operation is blocked when project ownership cannot be persisted', () => {
  const session = { id: 'session-2', projectId: null }
  let validated = false
  const adapter = guardFileAdapterForProjectBinding({
    validatePath: () => {
      validated = true
      return { ok: true }
    },
  }, () => persistSessionProjectBinding(session, 'project-b', {
    loadAgentSessions: () => [session],
    saveAgentSessions: () => { throw new Error('disk unavailable') },
  }))

  const result = adapter.validatePath('draft.md')
  assert.equal(result.ok, false)
  assert.match(result.error, /无法保存会话的项目归属/)
  assert.equal(validated, false)
  assert.equal(session.projectId, null)
})

test('project-scoped artifact tools bind before their handler executes', async () => {
  const events = []
  const guarded = guardToolBundleForProjectBinding({
    definitions: [],
    handlers: {
      create_markdown: async () => {
        events.push('execute')
        return { ok: true }
      },
    },
  }, () => {
    events.push('bind')
    return { ok: true, projectId: 'project-c' }
  })

  const result = await guarded.handlers.create_markdown({ title: 'Result' })
  assert.equal(result.ok, true)
  assert.deepEqual(events, ['bind', 'execute'])
})
