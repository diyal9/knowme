const fs = require('fs')
const os = require('os')
const path = require('path')
const { describe, it } = require('node:test')
const assert = require('node:assert')
const { loadInstallStore, resolvePaths } = require('../src/lib/capability-store')
const legacyStore = require('../src/lib/connectors/store')
const { createUnifiedConnectorStore } = require('../src/lib/connectors/unified-store')

function tempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-unified-connectors-'))
}

describe('unified connector store', () => {
  it('migrates legacy connectors idempotently with backups', () => {
    const userData = tempUserData()
    legacyStore.saveConnectors(userData, [{
      id: 'company-mcp',
      type: 'mcp',
      title: 'Company MCP',
      enabled: true,
      allowlist: ['search'],
      mcp: { command: 'node', args: ['server.js'], cwd: '', envKeys: [] },
    }])
    const store = createUnifiedConnectorStore({ userData })
    const first = store.migrateLegacy()
    const second = store.migrateLegacy()
    assert.equal(first.ok, true)
    assert.equal(first.skipped, false)
    assert.equal(second.skipped, true)
    assert.ok(fs.existsSync(`${legacyStore.connectorsPath(userData)}.unified-v2.bak`))
    assert.ok(fs.existsSync(path.join(resolvePaths(userData).connectors, 'company-mcp', 'manifest.json')))
    assert.equal(loadInstallStore(userData).entries['company-mcp'].enabled, true)
    assert.equal(store.loadConnectors().filter(item => item.id === 'company-mcp').length, 1)
  })

  it('loads a manifest-only connector without legacy config', () => {
    const userData = tempUserData()
    const store = createUnifiedConnectorStore({ userData, mode: 'unified' })
    const written = store.writeManagedConnector({
      id: 'manifest-only',
      type: 'mcp',
      title: 'Manifest Only',
      enabled: true,
      allowlist: ['query'],
      mcp: { command: 'node', args: ['server.js'], cwd: '', envKeys: [] },
    }, { source: 'custom', trust: 'user_confirmed' })
    assert.equal(written.ok, true)
    assert.equal(fs.existsSync(legacyStore.connectorsPath(userData)), false)
    const loaded = store.loadConnectors().find(item => item.id === 'manifest-only')
    assert.equal(loaded.enabled, true)
    assert.deepEqual(loaded.allowlist, ['query'])
    assert.equal(loaded.manifest.risk.level, 'high')
  })

  it('updates authority first and projects allowlist to legacy shape', () => {
    const userData = tempUserData()
    const store = createUnifiedConnectorStore({ userData })
    store.writeManagedConnector({
      id: 'sync-mcp',
      type: 'mcp',
      title: 'Sync MCP',
      enabled: false,
      allowlist: [],
      mcp: { command: '', args: [], cwd: '', envKeys: [] },
    }, { source: 'custom', trust: 'user_confirmed' })
    const updated = store.setAllowlist('sync-mcp', ['search', 'read'])
    assert.equal(updated.ok, true)
    const managed = store.loadManagedConnector('sync-mcp')
    const projected = legacyStore.loadConnectors(userData).find(item => item.id === 'sync-mcp')
    assert.deepEqual(managed.allowlist, ['search', 'read'])
    assert.deepEqual(projected.allowlist, ['search', 'read'])
  })
})
