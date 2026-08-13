const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const contextStore = require('../src/lib/workbench-context-store')

describe('workbench-context-store', () => {
  it('persists bounded shared work context and restores it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-context-'))
    const store = contextStore.createStore(path.join(dir, 'context.json'))
    const saved = store.save({
      goal: '整理研发交付',
      workflowId: 'engineering-pipeline',
      workflowVersion: '2.0.0',
      compositionId: 'composition-1',
      executionSource: 'daemon',
      artifactRefs: [
        { id: 'docs/report.md', kind: 'artifact', version: '1' },
        { path: 'assets/logo.png', contentHash: 'sha256:logo' },
      ],
    })
    assert.equal(saved.ok, true)
    const restored = store.get().context
    assert.equal(restored.workflowVersion, '2.0.0')
    assert.equal(restored.executionSource, 'daemon')
    assert.equal(restored.artifactRefs[1].id, 'assets/logo.png')
  })

  it('persists launchIntent and keeps legacy context fields in sync', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-context-launch-'))
    const store = contextStore.createStore(path.join(dir, 'context.json'))
    const saved = store.saveLaunchIntent({
      step: 'readiness',
      domain: 'engineering',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      goal: '整理研发交付',
      backend: 'daemon',
      executionSource: 'workbench',
      inputRefs: [{ id: 'docs/report.md', kind: 'artifact' }],
      status: 'ready',
    })
    assert.equal(saved.ok, true)
    const restored = store.get().context
    assert.equal(restored.launchIntent.goal, '整理研发交付')
    assert.equal(restored.workflowId, 'delivery-pack')
    assert.equal(restored.executionSource, 'workbench')
    assert.equal(restored.artifactRefs[0].id, 'docs/report.md')
  })

  it('restores legacy-only context into launchIntent after restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-context-legacy-'))
    const file = path.join(dir, 'context.json')
    fs.writeFileSync(file, JSON.stringify({
      version: contextStore.STORE_VERSION,
      context: {
        goal: '整理会议纪要',
        workflowId: 'meeting-notes',
        executionSource: 'daemon',
        rootRunId: 'root_legacy',
      },
      updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8')
    const store = contextStore.createStore(file)
    const restored = store.get().context
    assert.equal(restored.launchIntent.goal, '整理会议纪要')
    assert.equal(restored.launchIntent.resourceId, 'meeting-notes')
    assert.equal(restored.launchIntent.rootRunId, 'root_legacy')
  })

  it('blocks duplicate launch when run already exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-context-dup-'))
    const store = contextStore.createStore(path.join(dir, 'context.json'))
    store.saveLaunchIntent({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      backend: 'daemon',
      status: 'ready',
      step: 'launch',
    })
    store.saveLaunchIntent({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      backend: 'daemon',
      status: 'launching',
      step: 'launch',
      runId: 'run_1',
      rootRunId: 'root_1',
    })
    const blocked = store.saveLaunchIntent({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      backend: 'daemon',
      status: 'launching',
      step: 'launch',
    })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.duplicate, true)
    assert.equal(blocked.runId, 'run_1')
  })
})
