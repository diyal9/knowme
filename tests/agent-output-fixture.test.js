'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { readPreload } = require('./helpers/current-src')
const {
  PROTOCOL_VERSION,
  createMessageState,
  reduceMessageEvent,
} = require('../src/lib/agent-message-state')

const PRELOAD_JS = readPreload()
const SMOKE_JS = fs.readFileSync(
  path.join(__dirname, '../openspec/changes/archive/2026-08-06-refactor-agent-multistage-output-pipeline/evidence/agent-output-electron-smoke.js'),
  'utf8',
)

function evt(seq, type, payload = {}, extra = {}) {
  return {
    version: PROTOCOL_VERSION,
    runId: 'run_fixture',
    seq,
    lane: extra.lane || 'progress',
    type,
    payload,
    phase: extra.phase || 'MODEL',
    round: extra.round ?? 1,
  }
}

describe('agent-output-fixture contract', () => {
  it('registers fixture IPC handler and preload bridge only under env flag', () => {
    const fixtureIpc = fs.readFileSync(path.join(__dirname, '../src/ipc/agent-output-fixture.ts'), 'utf8')
    assert.match(fixtureIpc, /KNOWME_AGENT_OUTPUT_FIXTURE !== '1'[\s\S]*agent-output-fixture-run/)
    assert.match(PRELOAD_JS, /KNOWME_AGENT_OUTPUT_FIXTURE === ['"]1['"][\s\S]*agentOutputFixtureRun/)
    const preloadEnvIdx = PRELOAD_JS.search(/process\.env\.KNOWME_AGENT_OUTPUT_FIXTURE === ['"]1['"]/)
    const preloadApiIdx = PRELOAD_JS.indexOf('agentOutputFixtureRun')
    assert.ok(preloadEnvIdx >= 0)
    assert.ok(preloadApiIdx > preloadEnvIdx)
    assert.doesNotMatch(
      PRELOAD_JS.slice(0, preloadEnvIdx),
      /agentOutputFixtureRun/,
    )
  })

  it('electron smoke requires ipcPathVerified in electron mode', () => {
    assert.match(SMOKE_JS, /KNOWME_AGENT_OUTPUT_FIXTURE:\s*'1'/)
    assert.match(SMOKE_JS, /dispatchViaIpc/)
    assert.match(SMOKE_JS, /ipcPathVerified/)
    assert.match(SMOKE_JS, /report\.mode !== 'electron' \|\| ipcPathVerified === true/)
  })

  it('reducer duplicate/late counters remain available to fixture state readers', () => {
    let state = createMessageState('run_fixture')
    state = reduceMessageEvent(state, evt(1, 'stage', { id: 's1', title: '准备', status: 'pending' })).state
    state = reduceMessageEvent(state, evt(2, 'stage', { id: 's2', title: '生成', status: 'pending' })).state
    const dup = reduceMessageEvent(state, evt(2, 'stage', { id: 's2b', title: '重复', status: 'pending' }))
    const late = reduceMessageEvent(state, evt(1, 'stage', { id: 's0', title: '迟到', status: 'pending' }))
    assert.equal(dup.changed, false)
    assert.equal(late.changed, false)
    assert.equal(state.counters.duplicate, 1)
    assert.equal(state.counters.late, 1)
  })
})
