'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')

const bundledRoot = path.join(__dirname, '../src/catalog')

function createFixture(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa38-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  return {
    userData,
    hub: createCapabilityHubService({ getUserData: () => userData, bundledRoot }),
    storePath: path.join(userData, 'capabilities', 'install-store.json'),
  }
}

function mutateInstalled(userData, id, patch, marker) {
  const storePath = path.join(userData, 'capabilities', 'install-store.json')
  const state = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  Object.assign(state.entries[id], patch)
  if (patch.version) state.entries[id].manifest.version = patch.version
  fs.writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf8')
  const skillFile = path.join(userData, 'capabilities', 'skills', id, 'SKILL.md')
  if (marker) fs.appendFileSync(skillFile, `\n${marker}\n`, 'utf8')
  return skillFile
}

it('RQA38 updating an expert upgrades its declared bundled Skill dependencies', async t => {
  const { userData, hub, storePath } = createFixture(t)

  assert.equal((await hub.installCapability({ id: 'data-analysis-method', enabled: true })).ok, true)
  assert.equal((await hub.installCapability({ id: 'data-analyst', enabled: true })).ok, true)

  const installedSkill = mutateInstalled(userData, 'data-analysis-method', { version: '1.0.0' }, 'STALE-RQA38')

  const updated = await hub.updateCapability({ id: 'data-analyst' })
  assert.equal(updated.ok, true)
  assert.deepEqual(updated.dependencyUpdates.map(item => item.id).sort(), [
    'business-cause-analysis', 'business-insight-report', 'business-metrics-analysis',
    'data-analysis-method', 'data-report-method',
  ].sort())

  const refreshedStore = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  assert.equal(refreshedStore.entries['data-analysis-method'].version, '1.1.0')
  assert.doesNotMatch(fs.readFileSync(installedSkill, 'utf8'), /STALE-RQA38/)
  assert.equal(refreshedStore.entries['writing-polish'], undefined, 'optional Skill must not be installed implicitly')
  assert.equal(refreshedStore.entries.feishu, undefined, 'connector must never be installed or authorized implicitly')
})

it('RQA38 updating an expert installs a missing required bundled Skill', async t => {
  const { hub, storePath } = createFixture(t)
  assert.equal((await hub.installCapability({ id: 'data-analyst', enabled: true })).ok, true)
  const state = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  assert.ok(state.entries['data-analysis-method'])
  delete state.entries['data-analysis-method']
  fs.writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf8')

  const updated = await hub.updateCapability({ id: 'data-analyst' })
  assert.equal(updated.ok, true)
  assert.deepEqual(updated.dependencyUpdates.map(item => item.id).sort(), [
    'business-cause-analysis', 'business-insight-report', 'business-metrics-analysis',
    'data-analysis-method', 'data-report-method',
  ].sort())
  const installed = JSON.parse(fs.readFileSync(storePath, 'utf8')).entries['data-analysis-method']
  assert.equal(installed.version, '1.1.0')
  assert.equal(installed.enabled, true)
})

it('RQA38 updates an already installed optional Skill but never downgrades a newer dependency', async t => {
  const { userData, hub } = createFixture(t)
  for (const id of ['data-analysis-method', 'writing-polish', 'data-analyst']) {
    assert.equal((await hub.installCapability({ id, enabled: true })).ok, true)
  }
  const newerSkill = mutateInstalled(userData, 'data-analysis-method', { version: '9.0.0' }, 'KEEP-NEWER-RQA38')
  const staleOptional = mutateInstalled(userData, 'writing-polish', { version: '0.9.0' }, 'STALE-OPTIONAL-RQA38')

  const updated = await hub.updateCapability({ id: 'data-analyst' })
  assert.equal(updated.ok, true)
  assert.deepEqual(updated.dependencyUpdates.map(item => item.id).sort(), [
    'business-cause-analysis', 'business-insight-report', 'business-metrics-analysis',
    'data-report-method', 'writing-polish',
  ].sort())
  assert.match(fs.readFileSync(newerSkill, 'utf8'), /KEEP-NEWER-RQA38/)
  assert.doesNotMatch(fs.readFileSync(staleOptional, 'utf8'), /STALE-OPTIONAL-RQA38/)
})

it('RQA38 never overwrites a user-managed Skill that shares a dependency id', async t => {
  const { userData, hub } = createFixture(t)
  for (const id of ['data-analysis-method', 'data-analyst']) {
    assert.equal((await hub.installCapability({ id, enabled: true })).ok, true)
  }
  const userManaged = mutateInstalled(userData, 'data-analysis-method', {
    version: '0.1.0', source: 'custom', trust: 'user_confirmed',
  }, 'KEEP-USER-RQA38')

  const updated = await hub.updateCapability({ id: 'data-analyst' })
  assert.equal(updated.ok, true)
  assert.deepEqual(updated.dependencyUpdates.map(item => item.id).sort(), [
    'business-cause-analysis', 'business-insight-report', 'business-metrics-analysis',
    'data-report-method',
  ].sort())
  assert.ok(updated.warnings.some(item => item.code === 'dependency_update_not_managed'))
  assert.match(fs.readFileSync(userManaged, 'utf8'), /KEEP-USER-RQA38/)
})

it('RQA56 linked repository overlays do not hide bundled dependency metadata or block expert updates', async t => {
  const { userData, hub, storePath } = createFixture(t)
  const skillIds = ['creative-concept-method', 'visual-brief-prompt', 'th-art-intake', 'th-art-prompt-enrich', 'th-art-pango-generate']
  for (const id of [...skillIds, 'image-producer']) {
    assert.equal((await hub.installCapability({ id, enabled: true, riskConfirmed: true })).ok, true)
  }

  const overlayPath = path.join(userData, 'capabilities', 'catalog-overlay.json')
  const overlay = { version: 1, trustedSources: [], hiddenIds: [], entries: {} }
  for (const id of skillIds) {
    const linkedFile = mutateInstalled(userData, id, {
      version: '1.0.0', source: 'local-repo', trust: 'user_confirmed', linked: true,
      originRoot: userData, originPath: path.join('capabilities', 'skills', id),
      repositoryId: 'user-linked-rqa56',
    }, `KEEP-LINKED-RQA56-${id}`)
    overlay.entries[id] = {
      id, kind: 'skill', name: id, version: '1.0.0', source: 'local-repo', trust: 'user_confirmed',
      bundlePath: '',
    }
    assert.match(fs.readFileSync(linkedFile, 'utf8'), new RegExp(`KEEP-LINKED-RQA56-${id}`))
  }
  fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2), 'utf8')

  const updated = await hub.updateCapability({ id: 'image-producer', riskConfirmed: true })
  assert.equal(updated.ok, true, updated.error)
  assert.deepEqual(updated.dependencyUpdates, [])
  assert.deepEqual(
    updated.warnings.filter(item => item.code === 'dependency_update_not_managed').map(item => item.dependency.id),
    skillIds,
  )
  assert.deepEqual(
    updated.warnings.filter(item => item.code === 'missing_dependency').map(item => item.dependency.id).sort(),
    ['pango-image-mcp'],
  )
  assert.deepEqual(
    updated.warnings.filter(item => item.code === 'missing_optional_dependency').map(item => item.dependency.id).sort(),
    ['photoshop-mcp', 'writing-polish'],
  )
  const state = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  assert.equal(state.entries['image-producer'].version, '4.0.2')
  for (const id of skillIds) {
    assert.equal(state.entries[id].source, 'local-repo')
    assert.equal(state.entries[id].version, '1.0.0')
    assert.match(fs.readFileSync(path.join(userData, 'capabilities', 'skills', id, 'SKILL.md'), 'utf8'), /KEEP-LINKED-RQA56/)
  }
})
