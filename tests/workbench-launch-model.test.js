const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const launchModel = require('../src/lib/workbench-launch-model')

describe('workbench-launch-model', () => {
  it('normalizes bounded fields and strips secret-shaped keys', () => {
    const intent = launchModel.normalizeLaunchIntent({
      step: 'inputs',
      domain: 'engineering',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      goal: '  整理研发交付  ',
      inputRefs: [{ id: 'docs/report.md', kind: 'artifact', token: 'secret' }],
      backend: 'daemon',
      profileSnapshot: {
        profileIds: ['producer'],
        apiKey: 'must-not-persist',
      },
      runId: 'run_1',
      rootRunId: 'root_1',
      slug: 'delivery',
      executionSource: 'workbench',
      returnState: { view: 'work', password: 'hidden' },
      status: 'ready',
    })

    assert.equal(intent.goal, '整理研发交付')
    assert.equal(intent.domain, 'engineering')
    assert.equal(intent.inputRefs[0].id, 'docs/report.md')
    assert.equal(intent.profileSnapshot.apiKey, undefined)
    assert.equal(intent.returnState.view, 'work')
    assert.equal(intent.returnState.password, undefined)
    assert.equal(intent.status, 'ready')
  })

  it('patches intent without dropping stable run references', () => {
    const base = launchModel.normalizeLaunchIntent({
      goal: '整理会议纪要',
      resourceType: 'pipeline',
      resourceId: 'meeting-notes',
      runId: 'run_existing',
      rootRunId: 'root_existing',
      slug: 'meeting-existing',
      status: 'draft',
      step: 'inputs',
    })
    const patched = launchModel.patchLaunchIntent(base, {
      step: 'confirm',
      status: 'ready',
      backend: 'local-team',
    })
    assert.equal(patched.goal, '整理会议纪要')
    assert.equal(patched.step, 'confirm')
    assert.equal(patched.backend, 'local-team')
    assert.equal(patched.rootRunId, 'root_existing')
  })

  it('clears prior run references when starting a different intent', () => {
    const patched = launchModel.patchLaunchIntent({
      domain: 'visual',
      goal: '生成视觉图像',
      resourceType: 'pipeline',
      resourceId: 'visual-brief-to-export',
      backend: 'local-team',
      executionSource: 'agent-graph',
      runId: 'run_visual',
      rootRunId: 'root_visual',
      slug: 'visual-existing',
      status: 'launched',
    }, {
      domain: 'engineering',
      goal: '实现并测试功能',
      resourceId: 'engineering-delivery',
      status: 'ready',
    })
    assert.equal(patched.runId, '')
    assert.equal(patched.rootRunId, '')
    assert.equal(patched.slug, '')
    assert.equal(patched.backend, '')
    assert.equal(patched.executionSource, '')
  })

  it('assesses readiness and reports missing inputs', () => {
    const readiness = launchModel.assessLaunchReadiness({
      step: 'inputs',
      status: 'draft',
    })
    assert.equal(readiness.ready, false)
    assert.ok(readiness.blockers.some(item => item.id === 'missing-goal'))
    assert.equal(readiness.step, 'inputs')
  })

  it('blocks duplicate launch when a run already exists', () => {
    const existing = launchModel.markLaunchCompleted(
      launchModel.normalizeLaunchIntent({
        goal: '整理研发交付',
        resourceType: 'pipeline',
        resourceId: 'delivery-pack',
        backend: 'daemon',
      }),
      { runId: 'run_existing', rootRunId: 'root_existing', slug: 'delivery' },
    )
    const guard = launchModel.guardDuplicateLaunch(existing, existing)
    assert.equal(guard.ok, false)
    assert.equal(guard.duplicate, true)
    assert.equal(guard.runId, 'run_existing')
  })

  it('allows restart recovery before launch completes', () => {
    const intent = launchModel.normalizeLaunchIntent({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      step: 'readiness',
      status: 'ready',
    })
    assert.equal(launchModel.isRecoverableLaunch(intent), true)
    const launched = launchModel.markLaunchCompleted(intent, { runId: 'run_1' })
    assert.equal(launchModel.isRecoverableLaunch(launched), false)
  })

  it('maps cancelled launch intent to cancelled draft phase and non-recoverable', () => {
    const intent = launchModel.normalizeLaunchIntent({
      goal: '三元礼包',
      resourceType: 'pipeline',
      resourceId: 'meeting-notes',
      step: 'inputs',
      status: 'cancelled',
    })
    assert.equal(launchModel.isRecoverableLaunch(intent), false)
    assert.equal(launchModel.deriveLegacyDraftFields(intent).phase, 'cancelled')
  })

  it('derives legacy fields and rebuilds launch intent', () => {
    const legacy = {
      goal: '整理研发交付',
      workflowId: 'delivery-pack',
      executionSource: 'daemon',
      rootRunId: 'root_1',
      artifactRefs: [{ id: 'docs/report.md', kind: 'artifact' }],
    }
    const intent = launchModel.launchIntentFromLegacy(legacy)
    assert.equal(intent.resourceType, 'pipeline')
    assert.equal(intent.resourceId, 'delivery-pack')
    assert.equal(intent.inputRefs[0].id, 'docs/report.md')

    const contextFields = launchModel.deriveLegacyContextFields(intent)
    assert.equal(contextFields.workflowId, 'delivery-pack')
    assert.equal(contextFields.executionSource, 'daemon')
  })

  it('keeps fingerprint stable for equivalent intents', () => {
    const a = launchModel.launchFingerprint({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      inputRefs: [{ id: 'docs/report.md', kind: 'artifact' }],
    })
    const b = launchModel.launchFingerprint({
      goal: '整理研发交付',
      resourceType: 'pipeline',
      resourceId: 'delivery-pack',
      inputRefs: [{ id: 'docs/report.md', kind: 'artifact', title: 'ignored-for-hash' }],
    })
    assert.equal(a, b)
  })
})
