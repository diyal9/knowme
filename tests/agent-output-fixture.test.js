'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const {
  PROTOCOL_VERSION,
  createMessageState,
  reduceMessageEvent,
} = require('../src/lib/agent-message-state')

const WORKSPACE_AGENT = fs.readFileSync(path.join(__dirname, '../src/workspace-agent.js'), 'utf8')
const MAIN_JS = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '../src/ipc/agent-output-fixture.js'), 'utf8')
const PRELOAD_JS = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8')
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
  it('only exposes __KnowMeAgentOutputFixture behind localStorage flag', () => {
    const marker = '__KnowMeAgentOutputFixture'
    const flagIdx = WORKSPACE_AGENT.indexOf('__knowme_agent_output_fixture')
    const installIdx = WORKSPACE_AGENT.indexOf('function installAgentOutputFixture')
    const exposeIdx = WORKSPACE_AGENT.indexOf(`window.${marker}`)
    assert.ok(flagIdx >= 0)
    assert.ok(installIdx >= 0)
    assert.ok(exposeIdx >= 0)
    assert.ok(flagIdx < exposeIdx)
    assert.match(
      WORKSPACE_AGENT.slice(installIdx, exposeIdx + 200),
      /localStorage\.getItem\('__knowme_agent_output_fixture'\)\s*!==\s*'1'/,
    )
  })

  it('fixture hook does not expose file/network/tool write helpers', () => {
    const block = WORKSPACE_AGENT.slice(
      WORKSPACE_AGENT.indexOf('function installAgentOutputFixture'),
      WORKSPACE_AGENT.indexOf('function resetChat'),
    )
    assert.doesNotMatch(block, /\b(fetch|XMLHttpRequest|writeFile|openExternal|aiGenerate|toolExecutor)\b/)
    assert.doesNotMatch(block, /\b(window\.api\.|knowme\.)\w*(write|upload|delete|exec)\w*\(/i)
  })

  it('registers fixture IPC handler and preload bridge only under env flag', () => {
    const fixtureIpc = fs.readFileSync(path.join(__dirname, '../src/ipc/agent-output-fixture.js'), 'utf8')
    assert.match(fixtureIpc, /KNOWME_AGENT_OUTPUT_FIXTURE !== '1'[\s\S]*agent-output-fixture-run/)
    assert.match(PRELOAD_JS, /KNOWME_AGENT_OUTPUT_FIXTURE === '1'[\s\S]*agentOutputFixtureRun/)
    const preloadEnvIdx = PRELOAD_JS.indexOf("process.env.KNOWME_AGENT_OUTPUT_FIXTURE === '1'")
    const preloadApiIdx = PRELOAD_JS.indexOf('agentOutputFixtureRun')
    assert.ok(preloadEnvIdx >= 0)
    assert.ok(preloadApiIdx > preloadEnvIdx)
    assert.doesNotMatch(
      PRELOAD_JS.slice(0, preloadEnvIdx),
      /agentOutputFixtureRun/,
    )
  })

  it('workspace fixture exposes dispatchViaIpc behind ipc bridge availability', () => {
    assert.match(WORKSPACE_AGENT, /dispatchViaIpc\(event\)/)
    assert.match(WORKSPACE_AGENT, /window\.api\?\.agentOutputFixtureRun/)
    assert.match(WORKSPACE_AGENT, /ensureFixtureIpcListener/)
    assert.match(WORKSPACE_AGENT, /onAiStreamEvent/)
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
