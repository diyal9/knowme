'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')

const { createConnectorSecretStore } = require('../src/lib/connectors/secret-store')
const { configurationState, buildRuntimeOptions, resolveToolPolicy } = require('../src/lib/connectors/runtime-config')
const { assessConnectorRequirements } = require('../src/lib/connectors/dependency-resolver')
const { normalizeWorkflowPackage } = require('../src/lib/workflow-package')

describe('managed connector platform', () => {
  it('encrypts connector secrets and returns only configured keys', () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'km-connector-secret-'))
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: buffer => Buffer.from(buffer.toString('utf8').replace(/^encrypted:/, ''), 'utf8'),
    }
    try {
      const store = createConnectorSecretStore({ userData, safeStorage })
      const saved = store.setSecrets('creator', { access_token: 'secret-value-123' })
      assert.equal(saved.ok, true)
      assert.deepEqual(store.configuredKeys('creator'), ['access_token'])
      assert.equal(store.resolveSecrets('creator').access_token, 'secret-value-123')
      assert.equal(fs.readFileSync(store.file(), 'utf8').includes('secret-value-123'), false)
    } finally { fs.rmSync(userData, { recursive: true, force: true }) }
  })

  it('maps configured secrets to transport runtime without exposing them in connector config', () => {
    const connector = {
      id: 'creator', enabled: true,
      mcp: { transport: 'sse', url: 'http://127.0.0.1:3103/sse' },
      secretSlots: [{ key: 'access_token', required: true, target: 'bearer' }],
    }
    assert.equal(configurationState(connector, []).state, 'needs_configuration')
    assert.equal(configurationState(connector, ['access_token']).ready, true)
    assert.equal(buildRuntimeOptions(connector, { access_token: 'abc' }).accessToken, 'abc')
  })

  it('uses exact/glob tool policies and a conservative fallback', () => {
    const connector = { toolPolicies: [{ match: 'get_*', risk: 'read', sideEffects: false, requiresApproval: false }] }
    assert.equal(resolveToolPolicy(connector, 'get_state').risk, 'read')
    assert.equal(resolveToolPolicy(connector, 'delete_all').requiresApproval, true)
  })

  it('blocks required connector dependencies and only warns for optional ones', async () => {
    const subject = { connectorDependencies: [
      { id: 'photoshop-mcp', required: true },
      { id: 'cocos-creator-mcp', required: false },
    ] }
    const result = await assessConnectorRequirements(subject, {}, {
      getConnectorStatus: async id => id === 'photoshop-mcp'
        ? { ok: true, connector: { status: { ok: false, state: 'offline', message: 'not running' } } }
        : { ok: false, code: 'not_found' },
    })
    assert.equal(result.ok, false)
    assert.equal(result.blockers[0].id, 'photoshop-mcp')
    assert.equal(result.warnings[0].id, 'cocos-creator-mcp')
  })

  it('persists workflow connector dependencies as a first-class contract', () => {
    const normalized = normalizeWorkflowPackage({
      id: 'connector-flow', name: 'Connector flow', source: 'personal', status: 'draft',
      connectorDependencies: [{ id: 'photoshop-mcp', required: true, tools: ['photoshop_ping'] }],
      graph: { nodes: [{ id: 'start', type: 'agent', agentPackageId: 'expert-a' }], edges: [] },
    })
    assert.equal(normalized.ok, true)
    assert.equal(normalized.package.connectorDependencies[0].id, 'photoshop-mcp')
    assert.deepEqual(normalized.package.connectorDependencies[0].tools, ['photoshop_ping'])
  })
})
