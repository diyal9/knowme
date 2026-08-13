const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const lifecycle = require('../src/lib/workbench-task-lifecycle')
const draftStore = require('../src/lib/workbench-task-draft-store')

describe('workbench-task-lifecycle', () => {
  it('does not treat terminal as success', () => {
    assert.equal(lifecycle.classifyTaskState('finished'), 'success')
    assert.equal(lifecycle.classifyTaskState('failed'), 'failure')
    assert.equal(lifecycle.classifyTaskState('rejected'), 'failure')
    assert.equal(lifecycle.classifyTaskState('cancelled'), 'cancelled')
    assert.equal(lifecycle.isTerminalKind(lifecycle.classifyTaskState('failed')), true)
    assert.equal(lifecycle.stateLabel('failed'), '执行失败')
    assert.equal(lifecycle.stateAction('failed'), '重新执行')
  })

  it('prioritizes waiting projection over a generic running state', () => {
    assert.equal(lifecycle.classifyTaskState('running', { gate: { node: 'review' } }), 'waiting')
    assert.equal(lifecycle.stateAction('waiting', { clarification: { node: 'ask' } }), '处理下一步')
  })

  it('HITL pending overrides completed job-like states (WebUI align)', () => {
    const resolved = lifecycle.resolveDaemonRuntimeState({
      job: { state: 'completed' },
      status: { state: 'idle', current_step: 'n3-proto' },
      pending_clarifications: [{ node: 'n3-proto', question: '请补充需求' }],
    })
    assert.equal(resolved.kind, 'waiting')
    assert.equal(resolved.terminal, false)
    assert.equal(resolved.hitl, true)
    assert.equal(resolved.state, 'waiting')
    assert.equal(
      lifecycle.classifyTaskState('completed', {
        pending_clarifications: [{ node: 'n3-proto' }],
      }),
      'waiting',
    )
    assert.equal(lifecycle.hasPendingHitl({
      pending_gates: [{ node: 'gate-1' }],
    }), true)
  })

  it('completed without HITL stays success', () => {
    const resolved = lifecycle.resolveDaemonRuntimeState({
      job: { state: 'completed' },
      status: { state: 'completed' },
    })
    assert.equal(resolved.kind, 'success')
    assert.equal(resolved.terminal, true)
  })

  it('projectRunLifecycle unifies daemon HITL and local gate waiting', () => {
    const daemonWait = lifecycle.projectRunLifecycle({
      backend: 'daemon',
      task: {
        job: { state: 'completed' },
        status: { state: 'idle' },
        pending_clarifications: [{ node: 'n1', question: '补充需求' }],
      },
    })
    assert.equal(daemonWait.kind, 'waiting')
    assert.equal(daemonWait.hitlKind, 'clarification')
    assert.equal(daemonWait.outcomeLabel, '等待你')
    assert.equal(daemonWait.compactLabel, '澄清')
    assert.equal(daemonWait.cancellable, true)

    const localGate = lifecycle.projectRunLifecycle({
      backend: 'agent-graph',
      rawStatus: 'waiting',
      pendingGates: [{ nodeId: 'gate-1', title: '开发自测' }],
    })
    assert.equal(localGate.kind, 'waiting')
    assert.equal(localGate.hitlKind, 'gate')
    assert.equal(localGate.outcomeLabel, '等待你')
    assert.equal(localGate.compactLabel, '待确认')
  })

  it('projectRunLifecycle marks terminal runs as not cancellable', () => {
    const done = lifecycle.projectRunLifecycle({
      backend: 'daemon',
      task: { status: { state: 'completed' }, job: { state: 'completed' } },
      terminalKind: 'success',
    })
    assert.equal(done.cancellable, false)
    assert.equal(done.outcomeLabel, '已完成')

    const cancelled = lifecycle.projectRunLifecycle({
      backend: 'agent-graph',
      rawStatus: 'cancelled',
      terminalKind: 'cancelled',
    })
    assert.equal(cancelled.cancellable, false)
    assert.equal(cancelled.compactLabel, '已取消')
  })
})

describe('workbench-task-draft-store', () => {
  it('persists a bounded draft and removes secret-shaped context keys', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-draft-'))
    const file = path.join(dir, 'draft.json')
    const store = draftStore.createStore(file)
    const saved = store.save({
      goal: '  整理会议纪要并生成待办  ',
      workflowId: 'meeting-notes',
      agentIds: ['producer', 'tester'],
      context: {
        meta: { sceneId: 'meeting' },
        token: 'must-not-persist',
        inputs: { root: 'ingest/' },
      },
      executionSource: 'agent-graph',
      rootRunId: 'workbench_graph_1',
      composition: {
        goal: '整理会议纪要并生成待办',
        members: [{ agentPackageId: 'producer' }],
      },
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.draft.goal, '整理会议纪要并生成待办')
    assert.equal(saved.draft.context.token, undefined)
    assert.equal(store.get().draft.workflowId, 'meeting-notes')
    assert.equal(store.get().draft.executionSource, 'agent-graph')
    assert.equal(store.get().draft.rootRunId, 'workbench_graph_1')
    assert.equal(store.get().draft.composition.members[0].agentPackageId, 'producer')

    const cleared = store.clear()
    assert.equal(cleared.ok, true)
    assert.equal(store.get().draft, null)
  })

  it('rejects an empty draft', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-draft-'))
    const store = draftStore.createStore(path.join(dir, 'draft.json'))
    assert.equal(store.save({ goal: '' }).ok, false)
  })

  it('persists launchIntent and restores recoverable draft after restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-draft-launch-'))
    const file = path.join(dir, 'draft.json')
    const store = draftStore.createStore(file)
    const saved = store.saveLaunchIntent({
      step: 'readiness',
      domain: 'office',
      resourceType: 'pipeline',
      resourceId: 'meeting-notes',
      goal: '整理会议纪要并生成待办',
      backend: 'local-team',
      executionSource: 'workbench',
      status: 'ready',
      profileSnapshot: { profileIds: ['producer'] },
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.draft.launchIntent.goal, '整理会议纪要并生成待办')
    assert.equal(saved.draft.workflowId, 'meeting-notes')
    assert.equal(saved.draft.profileIds[0], 'producer')

    const restored = draftStore.createStore(file).get().draft
    assert.equal(restored.launchIntent.step, 'readiness')
    assert.equal(restored.launchIntent.status, 'ready')
  })

  it('blocks duplicate launch in draft store', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-draft-dup-'))
    const store = draftStore.createStore(path.join(dir, 'draft.json'))
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
      status: 'launched',
      step: 'launch',
      runId: 'run_draft_1',
      rootRunId: 'root_draft_1',
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
    assert.equal(blocked.runId, 'run_draft_1')
  })
})
