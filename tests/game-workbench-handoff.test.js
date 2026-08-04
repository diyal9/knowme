const { describe, it } = require('node:test')
const assert = require('node:assert')
const handoff = require('../src/lib/game-workbench-handoff')
const gameReq = require('../src/lib/game-requirement')

function approvedDoc() {
  const doc = gameReq.emptyDoc('登录奖励')
  doc.sections.background = 'b'
  doc.sections.goals = 'g'
  doc.sections.gameplay = 'p'
  doc.sections.acceptance = 'a'
  doc.status = 'approved'
  return doc
}

describe('game workbench handoff', () => {
  it('blocks when daemon offline', () => {
    const result = handoff.buildHandoff({
      requirementDoc: approvedDoc(),
      daemonOverview: { online: false, code: 'offline', error: '连接失败' },
      scene: { id: 'game-dev', skillId: 'game-dev-delivery' },
    })
    assert.equal(result.ok, false)
    assert.equal(result.blocked, true)
    assert.ok(Array.isArray(result.recovery))
  })

  it('builds handoff when daemon ready', () => {
    const result = handoff.buildHandoff({
      requirementDoc: approvedDoc(),
      daemonOverview: {
        online: true,
        workflows: [{ id: 'team-run', name: 'Team Run' }],
      },
      scene: { id: 'game-dev', skillId: 'game-dev-delivery', defaultWorkflow: 'team-run' },
    })
    assert.equal(result.ok, true)
    assert.equal(result.workflow, 'team-run')
    assert.match(result.slug, /game-req|login/)
    assert.equal(result.trace.skillId, 'game-dev-delivery')
  })

  it('assesses auth required state when offline without workflows', () => {
    const readiness = handoff.assessDaemonReadiness({
      auth: { state: 'required' },
      online: false,
      workflows: [],
    })
    assert.equal(readiness.ready, false)
    assert.equal(readiness.code, 'auth_required')
  })

  it('allows guest handoff when auth required but daemon online', () => {
    const readiness = handoff.assessDaemonReadiness({
      auth: { state: 'required' },
      online: true,
      workflows: [{ id: 'team-run' }],
    })
    assert.equal(readiness.ready, true)
  })
})
