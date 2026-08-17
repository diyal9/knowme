'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildConsoleProjection } = require('../src/lib/workbench-console-model')

const { readMainEntryBundle } = require('./helpers/main-ipc-bundle')

const root = path.join(__dirname, '..')
const main = readMainEntryBundle()
const shelfDomain = fs.readFileSync(path.join(root, 'src', 'domain', 'shelf.ts'), 'utf8')
const consoleModel = fs.readFileSync(path.join(root, 'src', 'lib', 'workbench-console-model.ts'), 'utf8')
const automationStore = fs.readFileSync(path.join(root, 'src', 'lib', 'workbench-automation-store.ts'), 'utf8')

describe('workbench production-console anti-patterns', () => {
  it('does not classify Daemon as a professional domain', () => {
    const projection = buildConsoleProjection({
      daemon: { online: true, tasks: [{ slug: 'task-1', intent: '开发并测试功能', state: 'running' }] },
    })
    assert.equal(projection.runs[0].domain, 'engineering')
    assert.equal(projection.runs[0].executionSource, 'daemon')
    assert.ok(!projection.domains.some(item => item.id === 'daemon'))
  })

  it('does not inject demo vertical seeds or bundled official packages onto the workflow shelf', () => {
    assert.doesNotMatch(main, /verticals:\s*workbenchConsoleModel\.resolveVerticalPipelines/)
    assert.doesNotMatch(main, /verticals:\s*officialWorkflows\.listOfficialWorkflowPackages/)
    assert.doesNotMatch(main, /status: 'unavailable'[\s\S]*office-meeting-to-actions/)
    assert.doesNotMatch(main, /id: 'office-meeting-to-actions'[\s\S]{0,200}status: 'unavailable'/)
    assert.match(main, /const verticals = Array\.isArray\(input\.verticals\)/)
    assert.match(shelfDomain, /DEMO_VERTICAL_SEED_IDS/)
    assert.match(shelfDomain, /isDemoShelfEntry/)
    assert.match(shelfDomain, /if \(isDemoShelfEntry\(item\.id\)\) return false/)
  })

  it('does not expose a fake automation scheduler action', () => {
    assert.doesNotMatch(automationStore, /调度器开发中/)
    assert.match(automationStore, /code: 'scheduler_unavailable'/)
    assert.match(consoleModel, /unavailable/)
    assert.match(consoleModel, /scheduler_unavailable/)
  })

  it('keeps failure, waiting and cancellation distinct from success', () => {
    const projection = buildConsoleProjection({
      agentRuns: [
        { runId: 'success', status: 'done' },
        { runId: 'failure', status: 'failed' },
        { runId: 'waiting', status: 'approval_required' },
        { runId: 'cancelled', status: 'cancelled' },
      ],
    })
    assert.deepEqual(
      Object.fromEntries(projection.runs.map(item => [item.id, item.status])),
      { success: 'success', failure: 'failure', waiting: 'waiting', cancelled: 'cancelled' }
    )
    assert.deepEqual(projection.attention.map(item => item.runId).sort(), ['failure', 'waiting'])
  })
})
