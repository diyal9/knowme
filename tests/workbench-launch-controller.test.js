const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const contextStore = require('../src/lib/workbench-context-store')
const draftStore = require('../src/lib/workbench-task-draft-store')
const controller = require('../src/lib/workbench-launch-controller')
const consoleModel = require('../src/lib/workbench-console-model')

describe('workbench-launch-controller', () => {
  it('normalizes workflow resource type to pipeline', () => {
    const intent = controller.normalizeIncomingIntent({
      resourceType: 'workflow',
      resourceId: 'office-meeting-to-actions',
      goal: '整理会议纪要',
    })
    assert.equal(intent.resourceType, 'pipeline')
  })

  it('rejects legacy-local backend for new launches', () => {
    const result = controller.chooseBackend({
      resourceType: 'pipeline',
      resourceId: 'office-meeting-to-actions',
      backend: 'legacy-local',
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'legacy_readonly')
  })

  it('routes pipeline daemon launches to confirm modal flow', () => {
    const route = controller.determineRoute({
      resourceType: 'pipeline',
      resourceId: 'office-meeting-to-actions',
      backend: 'daemon',
    })
    assert.equal(route, 'confirm-daemon-workflow')
  })

  it('routes agent launches to single-agent planning', () => {
    const route = controller.determineRoute({
      resourceType: 'agent',
      resourceId: 'producer',
      backend: 'local-team',
    })
    assert.equal(route, 'plan-agent-run')
  })

  it('blocks a vertical pipeline until its real dependencies are ready', () => {
    const facts = consoleModel.buildVerticalPipelineFacts({
      localTeamEnabled: true,
      availableExpertIds: ['office-assistant'],
      connectors: [],
    })
    const result = controller.chooseBackend({
      resourceType: 'pipeline',
      resourceId: 'office-meeting-to-actions',
      backend: 'local-team',
    }, { facts })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'pipeline_blocked')
  })

  it('allows a vertical pipeline after its dependencies become ready', () => {
    const facts = consoleModel.buildVerticalPipelineFacts({
      localTeamEnabled: true,
      availableExpertIds: ['office-assistant'],
      connectors: [{ id: 'feishu', kind: 'connector', enabled: true, ready: true }],
    })
    const result = controller.chooseBackend({
      resourceType: 'pipeline',
      resourceId: 'office-meeting-to-actions',
      backend: 'local-team',
    }, { facts })
    assert.equal(result.ok, true)
    assert.equal(result.backend, 'local-team')
  })

  it('saves intent to context and draft together', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-launch-controller-'))
    const stores = {
      contextStore: contextStore.createStore(path.join(dir, 'context.json')),
      draftStore: draftStore.createStore(path.join(dir, 'draft.json')),
      context: {},
      draft: null,
    }
    const saved = controller.saveIntent(stores, {
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      backend: 'local-team',
      step: 'confirm',
      status: 'ready',
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.intent.goal, '整理研发交付')
    assert.equal(saved.context.launchIntent.resourceId, 'delivery-pack')
    assert.equal(saved.draft.launchIntent.resourceId, 'delivery-pack')
  })

  it('ingests automation launchRequest payloads', () => {
    const intent = controller.ingestLaunchRequest({
      domain: 'office',
      resourceType: 'workflow',
      resourceId: 'office-meeting-to-actions',
      goal: '整理今日会议待办',
      backend: 'local-team',
    }, { executionSource: 'automation' })
    assert.equal(intent.resourceType, 'pipeline')
    assert.equal(intent.executionSource, 'automation')
    assert.equal(intent.step, 'confirm')
  })
})
