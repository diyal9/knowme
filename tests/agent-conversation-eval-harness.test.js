'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const {
  runConversationScenario,
  runConversationSuite,
  loadConversationFixtures,
} = require('./agent-conversation-eval-harness')

describe('agent-conversation-eval-harness', () => {
  it('loads conversation fixtures from disk', () => {
    const fixtures = loadConversationFixtures()
    assert.ok(fixtures.length >= 10)
    assert.ok(fixtures.some(f => f.name === 'feishu-meeting-pick-2-no-tool'))
    assert.ok(fixtures.some(f => f.name === 'recovery-after-tool-error'))
    assert.ok(fixtures.some(f => f.name === 'governance-refusal-ungrounded'))
  })

  it('feishu-meeting-pick-2-no-tool regression passes eval gate (mustFail)', async () => {
    const fixtures = loadConversationFixtures()
    const fixture = fixtures.find(f => f.name === 'feishu-meeting-pick-2-no-tool')
    assert.ok(fixture)
    const result = await runConversationScenario(fixture)
    assert.equal(result.passed, true, result.failReasons?.join('; ') || JSON.stringify(result.dimensions))
    assert.equal(result.dimensions.toolChoice, 0)
    assert.ok(!String(result.report.text).includes('议题：'))
  })

  it('feishu-meeting-pick-2-happy path passes', async () => {
    const fixtures = loadConversationFixtures()
    const fixture = fixtures.find(f => f.name === 'feishu-meeting-pick-2-happy')
    const result = await runConversationScenario(fixture)
    assert.equal(result.passed, true, JSON.stringify(result))
    assert.equal(result.dimensions.toolChoice, 1)
    const calls = result.ports.toolLedger.calls.map(c => c.name)
    assert.ok(calls.includes('feishu.meeting_read'))
  })

  it('hard suite scenarios all pass eval gate', async () => {
    const results = await runConversationSuite()
    const failed = results.filter(r => !r.passed)
    assert.equal(failed.length, 0, failed.map(f => `${f.name}: ${f.failReasons?.join(',')}`).join('\n'))
  })
})
