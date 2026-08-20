const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  RETIRED_EXPERT_IDS,
  shouldRemoveExpert,
  shouldRemoveWorkflow,
  shouldRemoveTask,
  migrateProductionCatalog,
} = require('../src/lib/production-catalog-migration')

describe('production catalog migration', () => {
  it('only targets retired official and explicit demo/test experts', () => {
    assert.ok(RETIRED_EXPERT_IDS.includes('game-studio-partner'))
    assert.equal(shouldRemoveExpert('producer', { source: 'curated' }), true)
    assert.equal(shouldRemoveExpert('test-writer', { source: 'custom' }), true)
    assert.equal(shouldRemoveExpert('client-research', { source: 'custom' }), false)
  })

  it('removes empty shells and archived legacy forks but preserves real personal work', () => {
    assert.equal(shouldRemoveWorkflow('my-empty', { name: '我的专家协作', graph: { nodes: [] }, agentRefs: [] }), true)
    assert.equal(shouldRemoveWorkflow('legacy-fork', {
      status: 'archived', parentRef: { id: 'official-visual-brief-review' },
      graph: { nodes: [{ id: 'n1' }] }, agentRefs: [{ id: 'visual-designer' }],
    }), true)
    assert.equal(shouldRemoveWorkflow('client-flow', {
      status: 'draft', name: '客户周报', graph: { nodes: [{ id: 'n1' }] }, agentRefs: [{ id: 'office-partner' }],
    }), false)
  })

  it('recognizes explicit demo tasks without matching normal task history', () => {
    assert.equal(shouldRemoveTask({ id: 'task-1', goal: '三元礼包', title: '会议闭环' }), true)
    assert.equal(shouldRemoveTask({ id: 'task-2', goal: '整理本周真实会议', title: '日常办公' }), false)
  })

  it('backs up data, prunes demo records and resets only untouched v6 catalog installs', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-production-catalog-'))
    const capabilityRoot = path.join(userData, 'capabilities')
    fs.mkdirSync(path.join(capabilityRoot, 'experts', 'producer'), { recursive: true })
    fs.writeFileSync(path.join(capabilityRoot, 'experts', 'producer', 'EXPERT.md'), 'legacy')
    fs.writeFileSync(path.join(capabilityRoot, 'install-store.json'), JSON.stringify({
      version: 1,
      entries: {
        producer: { id: 'producer', kind: 'expert', source: 'curated' },
        'product-manager': { id: 'product-manager', kind: 'expert', source: 'curated', installedAt: '2026-08-19T03:09:51.000Z' },
        'office-partner': { id: 'office-partner', kind: 'expert', source: 'curated', installedAt: '2026-08-19T03:09:51.000Z' },
        'client-expert': { id: 'client-expert', kind: 'expert', source: 'custom' },
      },
    }))
    fs.writeFileSync(path.join(capabilityRoot, 'catalog-overlay.json'), JSON.stringify({
      version: 1, entries: { producer: { id: 'producer', kind: 'expert' }, 'client-expert': { id: 'client-expert', kind: 'expert' } },
    }))
    fs.writeFileSync(path.join(userData, 'workbench-workflows.json'), JSON.stringify({
      version: 2,
      packages: {
        'my-empty': { id: 'my-empty', name: '我的专家协作', graph: { nodes: [] }, agentRefs: [] },
        'client-flow': { id: 'client-flow', name: '客户周报', graph: { nodes: [{ id: 'n1' }] }, agentRefs: [{ id: 'client-expert' }] },
      },
    }))
    fs.mkdirSync(path.join(userData, 'migrations'), { recursive: true })
    fs.writeFileSync(path.join(userData, 'migrations', 'formal-catalog-v6.json'), JSON.stringify({
      completedAt: '2026-08-19T03:09:52.000Z', installedExperts: ['product-manager', 'office-partner'],
    }))
    fs.writeFileSync(path.join(userData, 'workbench-modes.json'), JSON.stringify({
      version: 1, bindings: { office: [{ expertId: 'office-partner' }] },
    }))
    fs.writeFileSync(path.join(userData, 'workbench-tasks.json'), JSON.stringify({ version: 2, tasks: [] }))

    const removed = []
    const result = await migrateProductionCatalog({
      userData,
      hub: {
        uninstallCapability: async ({ id }) => { removed.push(id); return { ok: true } },
      },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(removed.sort(), ['producer', 'product-manager'])
    assert.deepEqual(result.resetCatalogExperts, ['product-manager'])
    assert.ok(fs.existsSync(path.join(result.backupRoot, 'install-store.json')))
    const overlay = JSON.parse(fs.readFileSync(path.join(capabilityRoot, 'catalog-overlay.json')))
    assert.equal(overlay.entries.producer, undefined)
    assert.ok(overlay.entries['client-expert'])
    const workflows = JSON.parse(fs.readFileSync(path.join(userData, 'workbench-workflows.json')))
    assert.equal(workflows.packages['my-empty'], undefined)
    assert.ok(workflows.packages['client-flow'])
  })
})
