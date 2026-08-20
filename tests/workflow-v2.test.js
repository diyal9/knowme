const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const { createStore } = require('../src/lib/workflow-package-store')
const { createWorkflowV2Runtime } = require('../src/lib/workflow-v2-runtime')
const { routeWorkRelationship } = require('../src/lib/work-relationship-router')

describe('workflow v2 contracts and runtime', () => {
  it('reads a v2 manifest and writes a v3 Action Contract', () => {
    const result = validateAndNormalizeManifest({
      schemaVersion: 2, id: 'document-tools', kind: 'skill', name: 'Document tools', version: '1.0.0',
      actions: [{ id: 'render', inputs: { type: 'object' }, outputs: { type: 'object' }, executor: { type: 'skill-runtime', ref: 'render' }, sideEffect: 'none' }],
    })
    assert.equal(result.ok, true)
    assert.equal(result.manifest.schemaVersion, 3)
    assert.equal(result.manifest.actions[0].ref, 'document-tools#render')
  })

  it('validates human/action nodes and requires a successful run before publishing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wf2-'))
    const store = createStore({ userData: dir })
    const draft = {
      id: 'research-flow', name: '调研流程', source: 'personal', status: 'draft',
      actionRefs: [{ id: 'search', kind: 'action', version: '1.0.0' }],
      graph: { nodes: [
        { id: 'start', type: 'start' },
        { id: 'search', type: 'action', actionRef: 'research-tools#search' },
        { id: 'review', type: 'human', humanRole: 'owner' },
        { id: 'end', type: 'end' },
      ], edges: [{ from: 'start', to: 'search', mapping: { query: '$.goal' } }, { from: 'search', to: 'review' }, { from: 'review', to: 'end' }] },
    }
    assert.equal(store.save(draft).ok, true)
    assert.equal(store.publish('research-flow', {}).code, 'successful_run_required')
    assert.equal(store.publish('research-flow', { successfulRunId: 'run-1', success: true }).ok, true)
  })

  it('persists checkpoints, human decisions, interventions and comments', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wf-run-'))
    const store = createStore({ userData: dir })
    store.save({ id: 'human-flow', name: '人工流程', source: 'personal', status: 'draft', graph: { nodes: [{ id: 'human', type: 'human', humanRole: 'owner' }, { id: 'end', type: 'end' }], edges: [{ from: 'human', to: 'end' }] } })
    const runtime = createWorkflowV2Runtime({ userData: dir, workflowStore: store })
    const started = runtime.start({ workflowId: 'human-flow', input: { goal: 'review' } })
    assert.equal(started.ok, true)
    assert.equal(runtime.submitHuman(started.run.runId, 'human', { output: { accepted: true } }).ok, true)
    assert.equal(runtime.comment(started.run.runId, { body: '普通评论' }).run.comments[0].contextKind, 'comment')
    assert.equal(runtime.intervene(started.run.runId, { summary: '调整输入' }).run.status, 'paused')
    assert.equal(runtime.resume(started.run.runId).run.status, 'running')
    assert.equal(runtime.get(started.run.runId).run.checkpoints.length, 1)
  })

  it('routes only selected context to formal collaboration', () => {
    const expert = routeWorkRelationship({ agentId: 'researcher', formalDelivery: true, goal: '调研', selectedContext: [{ content: '公开背景' }], personalMemory: '不得外传' })
    assert.equal(expert.relationship, 'expert-task')
    assert.equal(expert.handoffPreview.materials[0].content, '公开背景')
    assert.equal(JSON.stringify(expert).includes('不得外传'), false)
    const workflow = routeWorkRelationship({ agentIds: ['a', 'b'], goal: '联合交付' })
    assert.equal(workflow.relationship, 'workflow')
    assert.equal(workflow.requiresConfirmation, true)
  })
})
