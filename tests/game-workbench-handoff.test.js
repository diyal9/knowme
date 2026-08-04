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
        workflows: [{ id: 'game-dev-delivery', name: 'Game Dev Delivery', tags: ['script-only'] }],
      },
      scene: { id: 'game-dev', skillId: 'game-dev-delivery', defaultWorkflow: 'game-dev-delivery' },
    })
    assert.equal(result.ok, true)
    assert.equal(result.workflow, 'game-dev-delivery')
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
      workflows: [{ id: 'game-dev-delivery' }],
    })
    assert.equal(readiness.ready, true)
  })

  it('prefers game-dev-delivery workflow', () => {
    const picked = handoff.pickWorkflow({
      workflows: [
        { id: 'demo-experience', name: 'Demo' },
        { id: 'game-dev-delivery', name: 'Delivery' },
      ],
    }, { defaultWorkflow: 'game-dev-delivery' })
    assert.equal(picked.id, 'game-dev-delivery')
  })

  it('builds meta-only handoff without gitlab repo', () => {
    const result = handoff.buildHandoff({
      requirementDoc: approvedDoc(),
      daemonOverview: {
        online: true,
        workflows: [{ id: 'game-dev-delivery', name: 'Game Dev Delivery', tags: ['script-only'] }],
      },
      scene: { id: 'game-dev', skillId: 'game-dev-delivery', defaultWorkflow: 'game-dev-delivery' },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.context.meta.handoffFrom, 'game-requirement')
    assert.equal(result.context.workspace, undefined)
    assert.equal(result.context.inputs, undefined)
  })

  it('adds gitlab context only when project path exists', () => {
    const result = handoff.buildHandoff({
      requirementDoc: approvedDoc(),
      daemonOverview: {
        online: true,
        workflows: [{ id: 'game-dev-delivery', tags: ['script-only'] }],
      },
      scene: { defaultWorkflow: 'game-dev-delivery' },
      repo: { projectPath: 'group/project', branch: 'develop' },
    })
    assert.equal(result.context.workspace.projectId, 'group/project')
    assert.equal(result.context.workspace.ref, 'develop')
    assert.match(result.context.inputs.prd, /requirements\/.+\.md/)
  })

  it('blocks agent workflow when executor not ready', () => {
    const result = handoff.buildHandoff({
      requirementDoc: approvedDoc(),
      daemonOverview: {
        online: true,
        workflows: [{ id: 'demo-experience', name: 'Demo' }],
      },
      scene: { defaultWorkflow: 'demo-experience' },
      executorReady: false,
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'executor_not_ready')
  })

  it('detects script-only workflow does not need cli', () => {
    assert.equal(handoff.workflowNeedsCli({ id: 'game-dev-delivery', tags: ['script-only'] }), false)
    assert.equal(handoff.workflowNeedsCli({ id: 'demo-experience' }), true)
  })
})
