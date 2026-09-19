'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const catalog = require('../src/lib/capability-catalog')
const store = require('../src/lib/capability-store')

const BUNDLED_ROOT = path.join(__dirname, '..', 'src', 'catalog')

describe('capability-catalog', () => {
  let userData

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-catalog-'))
  })

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('loads bundled seed with skills expert and connector templates', () => {
    const bundled = catalog.loadBundledCatalog(BUNDLED_ROOT)
    assert.ok(bundled.entries.length >= 5)
    assert.ok(bundled.entries.some((item) => item.id === 'writing-polish' && item.kind === 'skill'))
    assert.ok(bundled.entries.some((item) => item.id === 'code-review' && item.kind === 'skill'))
    assert.ok(bundled.entries.some((item) => item.id === 'office-partner' && item.kind === 'expert'))
    assert.ok(bundled.entries.some((item) => item.id === 'feishu' && item.kind === 'connector'))
    assert.ok(bundled.entries.some((item) => item.id === 'mcp-generic' && item.kind === 'connector'))
  })

  it('publishes only active focused experts while defaulting custom entries to active', () => {
    const bundled = catalog.loadBundledCatalog(BUNDLED_ROOT)
    const removed = bundled.entries.find((item) => item.id === 'requirement-reviewer')
    const active = bundled.entries.find((item) => item.id === 'product-manager')
    assert.equal(removed, undefined)
    assert.deepEqual(active.lifecycle, { state: 'active', newTasks: true, successors: [] })

    catalog.upsertOverlayEntry(userData, {
      id: 'custom-expert', kind: 'expert', name: '自定义专家', source: 'custom',
    })
    const custom = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT })
      .entries.find((item) => item.id === 'custom-expert')
    assert.deepEqual(custom.lifecycle, { state: 'active', newTasks: true, successors: [] })
  })

  it('merges user overlay and reflects install store state', () => {
    catalog.upsertOverlayEntry(userData, {
      id: 'custom-local',
      kind: 'skill',
      name: '本地技能',
      description: 'overlay only',
      version: '0.1.0',
      source: 'local',
      trust: 'unknown',
      bundlePath: '',
    })

    store.upsertEntry(userData, {
      id: 'writing-polish',
      kind: 'skill',
      source: 'curated',
      status: 'enabled',
      enabled: true,
      version: '1.0.0',
      contentHash: 'sha256:abc',
    })

    const list = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT })
    const curated = list.entries.find((item) => item.id === 'writing-polish')
    const overlay = list.entries.find((item) => item.id === 'custom-local')
    assert.equal(curated.installed, true)
    assert.equal(curated.enabled, true)
    assert.equal(curated.installStatus, 'enabled')
    assert.equal(overlay.catalogLayer, 'user')
  })

  it('keeps the current bundled manifest ahead of a stale curated install manifest', () => {
    const bundled = catalog.loadBundledCatalog(BUNDLED_ROOT)
    const current = bundled.entries.find((item) => item.id === 'image-producer' && item.kind === 'expert')
    const stale = JSON.parse(JSON.stringify(current.manifest))
    delete stale.metadata.knowme.execution.deliverables[0].requiredConnectorIds

    store.upsertEntry(userData, {
      id: 'image-producer',
      kind: 'expert',
      source: 'curated',
      status: 'enabled',
      enabled: true,
      version: current.version,
      contentHash: 'sha256:stale',
      manifest: stale,
    })

    const entry = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT })
      .entries.find((item) => item.id === 'image-producer')
    assert.deepEqual(
      entry.manifest.metadata.knowme.execution.deliverables[0].requiredConnectorIds,
      ['pango-image-mcp'],
    )
  })

  it('filters by kind query and featured', () => {
    const skills = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT, kind: 'skill' })
    assert.ok(skills.entries.every((item) => item.kind === 'skill'))

    const featured = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT, featuredOnly: true })
    assert.ok(featured.entries.every((item) => item.featured))

    const searched = catalog.listCatalog(userData, {
      bundledRoot: BUNDLED_ROOT,
      query: '飞书',
    })
    assert.ok(searched.entries.some((item) => item.id === 'feishu'))
  })

  it('shows installed entries even when no catalog overlay exists', () => {
    store.upsertEntry(userData, {
      id: 'linked-only',
      kind: 'skill',
      source: 'local-repo',
      enabled: true,
      status: 'enabled',
      name: 'Linked Only',
      description: 'registered from Cursor',
      linked: true,
      originRoot: userData,
      originPath: 'missing-source',
      repositoryId: 'repo-1',
    })
    const list = catalog.listCatalog(userData, { bundledRoot: BUNDLED_ROOT })
    const linked = list.entries.find((item) => item.id === 'linked-only')
    assert.equal(linked.installed, true)
    assert.equal(linked.name, 'Linked Only')
    assert.equal(linked.sourceAvailable, false)
  })

  it('resolves bundled install source safely', () => {
    const entry = catalog.getCatalogEntry(userData, 'writing-polish', { bundledRoot: BUNDLED_ROOT }).entry
    const source = catalog.getBundledInstallSource(entry, BUNDLED_ROOT)
    assert.equal(source.ok, true)
    assert.ok(fs.existsSync(path.join(source.bundlePath, 'SKILL.md')))
  })
})
