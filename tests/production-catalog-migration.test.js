const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore: createTaskStore } = require('../src/lib/workbench-task-store')
const {
  MIGRATION_ID,
  IMAGE_PRODUCER_CAPABILITY_IDS,
  RETIRED_EXPERT_IDS,
  REMOVED_BUNDLED_EXPERT_IDS,
  RETAINED_EXPERT_IDS,
  PRODUCTION_EXPERT_IDS,
  shouldRemoveExpert,
  shouldRemoveWorkflow,
  shouldRemoveTask,
  migrateProductionCatalog,
  syncImageProducerCapabilities,
  syncRetainedExpertCapabilities,
  mergeRouteDependencies,
} = require('../src/lib/production-catalog-migration')
const { hashDirectory } = require('../src/lib/capability-store')

function tempUserData(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'capabilities'), { recursive: true })
  return root
}

describe('focused production expert migration', () => {
  it('keeps three production experts and never auto-removes user-owned experts', () => {
    assert.equal(MIGRATION_ID, 'focused-expert-roster-v13')
    assert.equal(RETAINED_EXPERT_IDS.length, 3)
    assert.deepEqual(PRODUCTION_EXPERT_IDS, RETAINED_EXPERT_IDS)
    assert.deepEqual(new Set(RETAINED_EXPERT_IDS), new Set([
      'image-producer', 'operations-data-analyst', 'agent-operations',
    ]))
    assert.equal(REMOVED_BUNDLED_EXPERT_IDS.length, 21)
    assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('product-manager'))
    assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('research-analyst'))
    assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('software-engineer'))
    assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('office-partner'))
    assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('data-analyst'))
    assert.ok(RETIRED_EXPERT_IDS.includes('visual-designer'))
    assert.equal(shouldRemoveExpert('visual-designer', { source: 'curated' }), true)
    assert.equal(shouldRemoveExpert('visual-designer', { source: 'custom' }), false)
    assert.equal(shouldRemoveExpert('test-writer', { source: 'custom' }), false)
  })

  it('retains generic demo cleanup without matching normal production work', () => {
    assert.equal(shouldRemoveWorkflow('my-empty', {
      name: '我的专家协作', graph: { nodes: [] }, agentRefs: [],
    }), true)
    assert.equal(shouldRemoveWorkflow('client-flow', {
      name: '客户周报', graph: { nodes: [{ id: 'n1' }] }, agentRefs: [{ id: 'office-partner' }],
    }), false)
    assert.equal(shouldRemoveWorkflow('official-daily-office', { source: 'official' }), true)
    assert.equal(shouldRemoveWorkflow('official-product-requirement', { source: 'official' }), true)
    assert.equal(shouldRemoveWorkflow('daily-summary', { source: 'daemon' }), true)
    assert.equal(shouldRemoveTask({ id: 'task-1', goal: '三元礼包' }), true)
    assert.equal(shouldRemoveTask({ id: 'task-2', goal: '整理本周真实会议', expertId: 'office-partner' }), false)
    assert.equal(shouldRemoveTask({ id: 'task-3', goal: '复核历史分析', expertId: 'data-analyst' }), false)
  })

  it('upgrades the image expert with visual planning and real generation capabilities', async (t) => {
    const userData = tempUserData(t, 'knowme-image-expert-upgrade-')
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({
      version: 1,
      entries: {
        'image-producer': {
          id: 'image-producer', kind: 'expert', source: 'curated', version: '2.0.0', enabled: false, status: 'disabled',
        },
      },
    }))
    const installed = []
    const result = await syncImageProducerCapabilities({
      userData,
      hub: { installCapability: async payload => { installed.push(payload); return { ok: true } } },
    })
    assert.deepEqual(result.updated, [
      'creative-concept-method', 'visual-brief-prompt',
      'th-art-intake', 'th-art-prompt-enrich', 'th-art-pango-generate',
      'writing-polish', 'image-producer',
    ])
    assert.equal(installed.at(-1).enabled, false)
    assert.ok(installed.slice(0, -1).every(item => item.enabled === true))
  })

  it('refreshes curated image capabilities when content changes without a version bump', async (t) => {
    const userData = tempUserData(t, 'knowme-image-expert-content-drift-')
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
    const entries = Object.fromEntries(IMAGE_PRODUCER_CAPABILITY_IDS.map(id => {
      const catalogEntry = catalog.entries.find(item => item.id === id)
      return [id, {
        id,
        kind: id === 'image-producer' ? 'expert' : 'skill',
        source: 'curated',
        version: catalogEntry.version,
        enabled: true,
        status: 'enabled',
        contentHash: 'sha256:stale-before-current-package',
      }]
    }))
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({ version: 1, entries }))

    const installed = []
    const result = await syncImageProducerCapabilities({
      userData,
      hub: { installCapability: async payload => { installed.push(payload); return { ok: true } } },
    })

    assert.deepEqual(result.updated, IMAGE_PRODUCER_CAPABILITY_IDS)
    assert.deepEqual(result.updatedDetails, IMAGE_PRODUCER_CAPABILITY_IDS.map(id => ({ id, reason: 'content_changed' })))
  })

  it('upgrades only curated retained experts and preserves disabled state', async (t) => {
    const userData = tempUserData(t, 'knowme-retained-expert-upgrade-')
    const entries = Object.fromEntries(RETAINED_EXPERT_IDS.map(id => [id, {
      id, kind: 'expert', source: 'curated', version: '0.1.0', enabled: true, status: 'enabled',
    }]))
    entries['agent-operations'] = {
      id: 'agent-operations', kind: 'expert', source: 'custom', version: '9.0.0', enabled: true, status: 'enabled',
    }
    entries['visual-designer'] = {
      id: 'visual-designer', kind: 'expert', source: 'curated', version: '2.0.0', enabled: true, status: 'enabled',
    }
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({ version: 1, entries }))

    const installed = []
    const result = await syncRetainedExpertCapabilities({
      userData,
      hub: { installCapability: async payload => { installed.push(payload); return { ok: true } } },
    })

    assert.deepEqual(result.updated.sort(), RETAINED_EXPERT_IDS.filter(id => id !== 'agent-operations').sort())
    assert.deepEqual(result.ignored, [{ id: 'agent-operations', reason: 'user_owned' }])
    assert.equal(installed.some(item => item.id === 'visual-designer'), false)
  })

  it('refreshes retained curated experts when the package content changes without a version bump', async (t) => {
    const userData = tempUserData(t, 'knowme-retained-expert-content-drift-')
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
    const entries = Object.fromEntries(RETAINED_EXPERT_IDS.map(id => {
      const catalogEntry = catalog.entries.find(item => item.id === id)
      return [id, {
        id, kind: 'expert', source: 'curated', version: catalogEntry.version,
        enabled: true, status: 'enabled', contentHash: 'sha256:stale-before-current-package',
      }]
    }))
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({ version: 1, entries }))

    const installed = []
    const result = await syncRetainedExpertCapabilities({
      userData,
      hub: { installCapability: async payload => { installed.push(payload); return { ok: true } } },
    })

    assert.deepEqual(result.updated, RETAINED_EXPERT_IDS)
    assert.deepEqual(result.updatedDetails, RETAINED_EXPERT_IDS.map(id => ({ id, reason: 'content_changed' })))
  })

  it('updates already-installed curated packages instead of routing them through first-install validation', async (t) => {
    const userData = tempUserData(t, 'knowme-retained-expert-update-api-')
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
    const catalogById = new Map(catalog.entries.map(item => [item.id, item]))
    const entries = Object.fromEntries(['agent-operations', 'agent-registry-operations'].map(id => {
      const catalogEntry = catalogById.get(id)
      return [id, {
        id,
        kind: catalogEntry.kind,
        source: 'curated',
        version: catalogEntry.version,
        enabled: true,
        status: 'enabled',
        contentHash: 'sha256:stale-before-current-package',
      }]
    }))
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({ version: 1, entries }))

    const updated = []
    const result = await syncRetainedExpertCapabilities({
      userData,
      hub: {
        installCapability: async () => { throw new Error('existing curated packages must use updateCapability') },
        updateCapability: async payload => { updated.push(payload); return { ok: true } },
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(updated.map(item => item.id), ['agent-registry-operations', 'agent-operations'])
  })

  it('never overwrites a user-managed dependency while syncing a retained curated expert', async (t) => {
    const userData = tempUserData(t, 'knowme-retained-expert-user-dependency-')
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
    const imageEntry = catalog.entries.find(item => item.id === 'image-producer')
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({
      version: 1,
      entries: {
        'image-producer': {
          id: 'image-producer', kind: 'expert', source: 'curated', version: imageEntry.version,
          enabled: true, status: 'enabled', contentHash: hashDirectory(path.join(__dirname, '../src/catalog', imageEntry.bundlePath)),
        },
        'th-art-intake': {
          id: 'th-art-intake', kind: 'skill', source: 'local-repo', version: '99.0.0',
          enabled: true, status: 'enabled', contentHash: 'sha256:user-owned',
        },
      },
    }))

    const installed = []
    const updated = []
    const result = await syncRetainedExpertCapabilities({
      userData,
      hub: {
        installCapability: async payload => { installed.push(payload); return { ok: true } },
        updateCapability: async payload => { updated.push(payload); return { ok: true } },
      },
    })

    assert.equal(result.ok, true)
    assert.equal(installed.some(item => item.id === 'th-art-intake'), false)
    assert.equal(updated.some(item => item.id === 'th-art-intake'), false)
    assert.ok(result.ignored.some(item => item.id === 'th-art-intake' && item.reason === 'user_owned_dependency'))
  })

  it('installs missing required dependencies even when retained expert packages are current', async (t) => {
    const userData = tempUserData(t, 'knowme-retained-expert-dependencies-')
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
    const catalogById = new Map(catalog.entries.map(item => [item.id, item]))
    const entries = Object.fromEntries(RETAINED_EXPERT_IDS.map(id => {
      const catalogEntry = catalogById.get(id)
      return [id, {
        id, kind: 'expert', source: 'curated', version: catalogEntry.version,
        enabled: true,
        status: 'enabled',
        contentHash: hashDirectory(path.join(__dirname, '../src/catalog', catalogEntry.bundlePath)),
      }]
    }))
    fs.writeFileSync(path.join(userData, 'capabilities', 'install-store.json'), JSON.stringify({ version: 1, entries }))

    const installed = []
    const result = await syncRetainedExpertCapabilities({
      userData,
      hub: { installCapability: async payload => { installed.push(payload); return { ok: true } } },
    })
    const expected = new Set(RETAINED_EXPERT_IDS.flatMap(id => {
      const entry = catalogById.get(id)
      const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog', entry.bundlePath, 'capability.manifest.json'), 'utf8'))
      return (manifest.dependencies || []).filter(dependency => dependency.required === true).map(dependency => dependency.id)
    }))

    assert.deepEqual(new Set(result.dependencyUpdates.map(item => item.id)), expected)
    assert.deepEqual(new Set(installed.map(item => item.id)), expected)
    assert.deepEqual(result.updated, [])
  })

  it('promotes tool-backed route dependencies when an old sidecar marked them optional', () => {
    const merged = mergeRouteDependencies([
      { id: 'office-core', kind: 'skill', required: true },
      { id: 'feishu-today-priority', kind: 'skill', required: false },
      { id: 'feishu', kind: 'connector', required: false },
    ], {
      metadata: {
        knowme: {
          execution: {
            routes: [{
              id: 'today-priority',
              skillId: 'feishu-today-priority',
              connectorId: 'feishu',
              requiredTools: ['feishu.today_priority'],
            }],
          },
        },
      },
    })

    assert.deepEqual(merged, [
      { id: 'office-core', kind: 'skill', required: true },
      { id: 'feishu-today-priority', kind: 'skill', required: true },
      { id: 'feishu', kind: 'connector', required: false },
    ])
  })

  it('deletes retired curated expert installs while preserving office and data task history', async (t) => {
    const userData = tempUserData(t, 'knowme-focused-roster-cleanup-')
    const capabilityRoot = path.join(userData, 'capabilities')
    const entries = Object.fromEntries(REMOVED_BUNDLED_EXPERT_IDS.map(id => [id, {
      id, kind: 'expert', source: 'curated', version: '1.0.0', enabled: true, status: 'enabled',
    }]))
    fs.writeFileSync(path.join(capabilityRoot, 'install-store.json'), JSON.stringify({ version: 1, entries }))
    const taskFile = path.join(userData, 'workbench-tasks.json')
    fs.writeFileSync(taskFile, JSON.stringify({
      version: 2,
      tasks: [
        ...REMOVED_BUNDLED_EXPERT_IDS.map((expertId, index) => ({
          id: `retired-${index + 1}`, kind: 'expert', expertId,
          goal: `旧任务 ${expertId}`, status: 'completed',
        })),
        { id: 'remove-product-extra', kind: 'expert', expertId: 'product-manager', goal: '旧产品任务', status: 'completed' },
      ],
    }))

    const removed = []
    const result = await migrateProductionCatalog({
      userData,
      hub: {
        installCapability: async () => ({ ok: true }),
        uninstallCapability: async ({ id }) => { removed.push(id); return { ok: true } },
      },
    })

    assert.equal(result.ok, true)
    assert.deepEqual(removed.sort(), [...REMOVED_BUNDLED_EXPERT_IDS].sort())
    assert.equal(result.removedTasks.length, REMOVED_BUNDLED_EXPERT_IDS.length - 1)
    assert.equal('backupRoot' in result, false)
    const store = createTaskStore(taskFile)
    assert.equal(store.list().tasks.length, 2)
    assert.ok(store.list().tasks.some(task => task.expertId === 'office-partner'))
    assert.ok(store.list().tasks.some(task => task.expertId === 'data-analyst'))
  })

  it('preserves a custom expert and its task even when its id matches a retired bundled id', async (t) => {
    const userData = tempUserData(t, 'knowme-focused-roster-custom-')
    const capabilityRoot = path.join(userData, 'capabilities')
    fs.writeFileSync(path.join(capabilityRoot, 'install-store.json'), JSON.stringify({
      version: 1,
      entries: {
        'visual-designer': {
          id: 'visual-designer', kind: 'expert', source: 'custom', version: '9.0.0', enabled: true, status: 'enabled',
        },
      },
    }))
    const taskFile = path.join(userData, 'workbench-tasks.json')
    fs.writeFileSync(taskFile, JSON.stringify({
      version: 2,
      tasks: [{ id: 'custom-task', kind: 'expert', expertId: 'visual-designer', goal: '用户自定义视觉任务' }],
    }))
    const removed = []
    const result = await migrateProductionCatalog({
      userData,
      hub: {
        installCapability: async () => ({ ok: true }),
        uninstallCapability: async ({ id }) => { removed.push(id); return { ok: true } },
      },
    })
    assert.deepEqual(removed, [])
    assert.deepEqual(result.removedTasks, [])
    assert.equal(createTaskStore(taskFile).get('custom-task').ok, true)
  })

  it('deletes orphaned tasks from retired bundled experts even when their install records are already gone', async (t) => {
    const userData = tempUserData(t, 'knowme-focused-roster-orphan-task-')
    const capabilityRoot = path.join(userData, 'capabilities')
    fs.writeFileSync(path.join(capabilityRoot, 'install-store.json'), JSON.stringify({ version: 1, entries: {} }))
    const taskFile = path.join(userData, 'workbench-tasks.json')
    fs.writeFileSync(taskFile, JSON.stringify({
      version: 2,
      tasks: [
        { id: 'orphan-task', kind: 'expert', expertId: 'visual-designer', goal: '已失去安装记录的旧任务' },
        { id: 'keep-task', kind: 'expert', expertId: 'image-producer', goal: '保留的新任务' },
      ],
    }))

    const result = await migrateProductionCatalog({
      userData,
      hub: {
        installCapability: async () => ({ ok: true }),
        uninstallCapability: async () => ({ ok: true }),
      },
    })

    assert.deepEqual(result.removedTasks, ['orphan-task'])
    assert.equal(createTaskStore(taskFile).get('orphan-task').ok, false)
    assert.equal(createTaskStore(taskFile).get('keep-task').ok, true)
  })
})
