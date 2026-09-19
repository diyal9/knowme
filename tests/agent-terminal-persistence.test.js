'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { AgentRunStore } = require('../src/lib/agent-run-store')
const { AgentRunManager } = require('../src/lib/agent-run-manager')

test('strict production storage persists adopted terminal with redacted token metrics', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-terminal-'))
  const store = new AgentRunStore({ rootDir, strictSecrets: true })
  const manager = new AgentRunManager({ runStore: store })
  manager.adoptRunningRun({ runId: 'realistic-metrics' })
  manager.completeAdoptedRun('realistic-metrics', {
    status: 'completed', summary: '图片已生成',
    metrics: { firstTokenMs: 800, promptTokens: 1500, completionTokens: 400, totalMs: 24000 },
    report: { authorization: 'Bearer do-not-store' },
  })
  const state = JSON.parse(fs.readFileSync(path.join(rootDir, 'realistic-metrics', 'state.json'), 'utf8'))
  assert.equal(state.status, 'done')
  assert.equal(state.terminal, true)
  assert.ok(state.endedAt)
  const events = fs.readFileSync(path.join(rootDir, 'realistic-metrics', 'events.jsonl'), 'utf8')
  assert.match(events, /run.terminal/)
  assert.doesNotMatch(events, /do-not-store/)
})
