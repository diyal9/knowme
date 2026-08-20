const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const workflow = require('../src/lib/workflow-package')
const storeModule = require('../src/lib/workflow-package-store')

function sample(overrides = {}) {
  return {
    id: 'engineering-pipeline',
    name: '软件研发管线',
    source: 'official',
    status: 'published',
    executionBackends: ['daemon', 'local-team'],
    agentRefs: [{ id: 'developer', version: '1.2.0', contentHash: 'sha256:dev' }],
    skillRefs: [{ id: 'code-review', version: '1.0.0', contentHash: 'sha256:skill' }],
    graph: {
      nodes: [
        { id: 'developer', type: 'agent', agentPackageId: 'developer' },
        { id: 'terminal', type: 'terminal' },
      ],
      edges: [{ from: 'developer', to: 'terminal' }],
    },
    ...overrides,
  }
}

describe('workflow-package', () => {
  it('normalizes and snapshots a professional workflow', () => {
    const result = workflow.validateWorkflowPackage(sample(), {
      resolveAgentPackage: () => ({ ok: true }),
      resolveSkill: () => ({ ok: true }),
    })
    assert.equal(result.ok, true)
    assert.match(result.package.packageHash, /^sha256:/)
    const snapshot = workflow.createWorkflowSnapshot(result.package)
    assert.equal(snapshot.ok, true)
    assert.equal(snapshot.snapshot.agentRefs[0].contentHash, 'sha256:dev')
  })

  it('rejects dangling edges and unsupported backends', () => {
    const result = workflow.validateWorkflowPackage(sample({
      executionBackends: ['daemon'],
      graph: { nodes: [{ id: 'developer', type: 'agent' }], edges: [{ from: 'developer', to: 'missing' }] },
    }), { supportedBackends: ['local-team'] })
    assert.equal(result.ok, false)
    assert.deepEqual(result.issues.map(item => item.code), ['dangling_edge', 'unsupported_backend'])
  })

  it('allows a composed workflow with one expert at the product boundary', () => {
    const result = workflow.validateWorkflowPackage(sample({
      executionBackends: ['local-team'],
    }), { enforceProductBoundary: true })
    assert.equal(result.ok, true)
  })

  it('allows an executable composed workflow without an expert node', () => {
    const result = workflow.validateWorkflowPackage(sample({
      executionBackends: ['local-team'],
      agentRefs: [],
      graph: {
        nodes: [
          { id: 'draft', type: 'llm', config: { modelName: 'local-model', prompt: '整理输入' } },
          { id: 'terminal', type: 'terminal' },
        ],
        edges: [{ from: 'draft', to: 'terminal' }],
      },
    }), { enforceProductBoundary: true })
    assert.equal(result.ok, true)
  })

  it('rejects a composed graph that has no executable node', () => {
    const result = workflow.validateWorkflowPackage(sample({
      executionBackends: ['local-team'],
      agentRefs: [],
      graph: {
        nodes: [{ id: 'terminal', type: 'terminal' }],
        edges: [],
      },
    }), { enforceProductBoundary: true })
    assert.equal(result.ok, false)
    assert.equal(result.issues.some(item => item.code === 'executable_node_required'), true)
  })

  it('forks official workflows without mutating the source', () => {
    const result = workflow.forkWorkflowPackage(sample(), { id: 'my-engineering', name: '我的研发流程' })
    assert.equal(result.ok, true)
    assert.equal(result.package.source, 'forked')
    assert.deepEqual(result.package.parentRef, { id: 'engineering-pipeline', version: '1.0.0' })
    assert.equal(result.package.status, 'draft')
  })
})

describe('workflow-package-store', () => {
  it('persists, lists, forks and protects official packages', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-workflows-'))
    const store = storeModule.createStore({ userData: dir })
    assert.equal(store.save(sample()).ok, true)
    assert.equal(store.save({ ...sample(), name: '改官方' }).code, 'official_readonly')
    const forked = store.fork('engineering-pipeline', { id: 'personal-pipeline' })
    assert.equal(forked.ok, true)
    assert.equal(store.list({ source: 'forked' }).packages.length, 1)
    assert.equal(store.archive('personal-pipeline').ok, true)
  })
})
