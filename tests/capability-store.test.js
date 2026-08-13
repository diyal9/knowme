'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const store = require('../src/lib/capability-store')

describe('capability-store', () => {
  let userData

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-store-'))
  })

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('writes install-store atomically via tmp rename', () => {
    const paths = store.resolvePaths(userData)
    store.upsertEntry(userData, {
      id: 'writing-polish',
      kind: 'skill',
      source: 'curated',
      status: 'enabled',
    })
    assert.ok(fs.existsSync(paths.installStore))
    const raw = fs.readFileSync(paths.installStore, 'utf8')
    assert.match(raw, /writing-polish/)
    assert.doesNotMatch(raw, /\.tmp/)
  })

  it('retries transient Windows rename locks with a finite bound', () => {
    let attempts = 0
    const result = store.renameWithRetrySync('tmp', 'store', {
      retries: 3,
      delays: [0],
      renameSync: () => {
        attempts += 1
        if (attempts < 3) {
          const error = new Error('locked')
          error.code = 'EPERM'
          throw error
        }
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.attempts, 3)
    assert.equal(attempts, 3)
  })

  it('installs from staging and computes content hash', () => {
    const staging = path.join(userData, 'stage-skill')
    fs.mkdirSync(staging, { recursive: true })
    fs.writeFileSync(path.join(staging, 'SKILL.md'), '# demo\n', 'utf8')

    const result = store.installFromStaging(userData, {
      id: 'demo-skill',
      kind: 'skill',
      source: 'local',
      stagingPath: staging,
    })
    assert.equal(result.ok, true)
    assert.match(result.entry.contentHash, /^sha256:/)
    assert.equal(result.entry.status, 'enabled')

    const installDir = path.join(store.resolvePaths(userData).skills, 'demo-skill', 'SKILL.md')
    assert.ok(fs.existsSync(installDir))
  })

  it('supports enable/disable/update/uninstall lifecycle', () => {
    const stagingA = path.join(userData, 'stage-a')
    const stagingB = path.join(userData, 'stage-b')
    fs.mkdirSync(stagingA, { recursive: true })
    fs.mkdirSync(stagingB, { recursive: true })
    fs.writeFileSync(path.join(stagingA, 'SKILL.md'), 'version-a', 'utf8')
    fs.writeFileSync(path.join(stagingB, 'SKILL.md'), 'version-b', 'utf8')

    store.installFromStaging(userData, {
      id: 'lifecycle-skill',
      kind: 'skill',
      source: 'local',
      version: '1.0.0',
      stagingPath: stagingA,
    })

    const disabled = store.disable(userData, 'lifecycle-skill')
    assert.equal(disabled.ok, true)
    assert.equal(disabled.entry.enabled, false)
    assert.equal(disabled.entry.status, 'disabled')

    const enabled = store.enable(userData, 'lifecycle-skill')
    assert.equal(enabled.entry.enabled, true)

    const updated = store.updateFromStaging(userData, 'lifecycle-skill', {
      stagingPath: stagingB,
      version: '1.1.0',
    })
    assert.equal(updated.ok, true)
    assert.equal(updated.entry.version, '1.1.0')
    assert.ok(fs.readFileSync(
      path.join(store.resolvePaths(userData).skills, 'lifecycle-skill', 'SKILL.md'),
      'utf8'
    ).includes('version-b'))

    const removed = store.uninstall(userData, 'lifecycle-skill')
    assert.equal(removed.ok, true)
    assert.equal(store.getEntry(userData, 'lifecycle-skill').ok, false)
  })

  it('filters enabled and installed entries', () => {
    store.upsertEntry(userData, { id: 'a', kind: 'skill', source: 'local', enabled: true, status: 'enabled' })
    store.upsertEntry(userData, { id: 'b', kind: 'skill', source: 'local', enabled: false, status: 'disabled' })

    const enabledOnly = store.listEntries(userData, { enabledOnly: true })
    assert.deepEqual(enabledOnly.entries.map((item) => item.id), ['a'])

    const installedOnly = store.listEntries(userData, { installedOnly: true })
    assert.equal(installedOnly.entries.length, 2)
  })

  it('rejects unsafe copy segments', () => {
    const src = path.join(userData, 'src')
    fs.mkdirSync(src, { recursive: true })
    fs.writeFileSync(path.join(src, 'ok.txt'), 'x', 'utf8')
    const dest = path.join(store.resolvePaths(userData).root, '..', 'escape-out')
    const result = store.copyDirectorySafe(src, dest, store.resolvePaths(userData).root)
    assert.equal(result.ok, false)
  })
})
