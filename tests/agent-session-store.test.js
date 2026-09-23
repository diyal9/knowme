'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const agentSessions = require('../src/lib/agent-sessions')
const {
  pruneEphemeralSessions,
  createAgentSessionStore,
} = require('../src/lib/agent-session-store')

function session(id, { ephemeral = false, updatedAt = '2026-09-21T00:00:00.000Z', taskId = '' } = {}) {
  const value = agentSessions.createSession('general', 1, {
    ephemeral,
    taskRef: taskId ? { id: taskId, kind: 'workbench-task' } : undefined,
  })
  return { ...value, id, ephemeral, updatedAt, createdAt: updatedAt, messages: [] }
}

describe('agent session sharded store', () => {
  it('bounds orphaned ephemeral sessions while preserving durable, task-backed, and open sessions', () => {
    const recent = Array.from({ length: 80 }, (_, i) => session(`tmp-${i}`, {
      ephemeral: true,
      updatedAt: new Date(Date.UTC(2026, 8, 21, 0, 0, i)).toISOString(),
    }))
    const result = pruneEphemeralSessions([
      session('durable'),
      session('task-backed', { ephemeral: true, taskId: 'task-1' }),
      session('open-old', { ephemeral: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
      ...recent,
    ], {
      now: Date.UTC(2026, 8, 21, 1, 0, 0),
      referencedTaskIds: new Set(['task-1']),
      referencedSessionIds: new Set(['open-old']),
      maxOrphans: 64,
    })
    assert.equal(result.sessions.length, 67)
    assert.ok(result.sessions.some(item => item.id === 'durable'))
    assert.ok(result.sessions.some(item => item.id === 'task-backed'))
    assert.ok(result.sessions.some(item => item.id === 'open-old'))
  })

  it('migrates the monolith once and persists one shard per retained session', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-session-store-'))
    try {
      const legacyFile = path.join(dir, 'agent-sessions.json')
      const taskFile = path.join(dir, 'workbench-tasks.json')
      const rootDir = path.join(dir, 'agent-sessions')
      const oldEphemeral = Array.from({ length: 100 }, (_, i) => session(`old-${i}`, {
        ephemeral: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }))
      fs.writeFileSync(taskFile, JSON.stringify({ tasks: [{ id: 'task-keep' }] }))
      fs.writeFileSync(legacyFile, JSON.stringify({
        sessions: [
          session('durable'),
          session('task-backed', { ephemeral: true, taskId: 'task-keep' }),
          ...oldEphemeral,
        ],
        ui: { openSessionIds: ['durable'], activeSessionId: 'durable' },
      }))
      const store = createAgentSessionStore({
        fs, path, legacyFile, rootDir, taskFile, agentSessions,
        now: () => Date.UTC(2026, 8, 21, 1, 0, 0),
      })
      const loaded = store.load()
      assert.deepEqual(loaded.sessions.map(item => item.id).sort(), ['durable', 'task-backed'])
      assert.strictEqual(store.load(), loaded)
      assert.equal(fs.readdirSync(path.join(rootDir, 'sessions')).filter(name => name.endsWith('.json')).length, 2)
      assert.equal(JSON.parse(fs.readFileSync(path.join(rootDir, 'index.json'), 'utf8')).version, 2)
      assert.equal(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).version, 2)
      assert.equal(fs.readdirSync(path.join(rootDir, 'migration-backups')).length, 1)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('round-trips a canonical V2 answer through disk reload', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-session-restart-'))
    try {
      const legacyFile = path.join(dir, 'agent-sessions.json')
      const taskFile = path.join(dir, 'workbench-tasks.json')
      const rootDir = path.join(dir, 'agent-sessions')
      const current = session('restart-1')
      current.messages = [{
        id: 'msg_run_restart_assistant', role: 'assistant', text: '唯一的最终答复',
        runId: 'run_restart', protocolVersion: 2, answerHash: 'hash_restart',
      }]
      const first = createAgentSessionStore({ fs, path, legacyFile, rootDir, taskFile, agentSessions })
      first.save([current], { openSessionIds: ['restart-1'], activeSessionId: 'restart-1' })
      const second = createAgentSessionStore({ fs, path, legacyFile, rootDir, taskFile, agentSessions })
      const loaded = second.load()
      assert.equal(loaded.sessions[0].messages.length, 1)
      assert.equal(loaded.sessions[0].messages[0].id, 'msg_run_restart_assistant')
      assert.equal(loaded.sessions[0].messages[0].v2AnswerCommitted, true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
