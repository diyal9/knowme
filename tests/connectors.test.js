'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  normalizeConnector,
  mergeWithDefaults,
  projectedToolNames,
  publicConnectorView,
} = require('../src/lib/connectors/normalize')
const store = require('../src/lib/connectors/store')
const { createConnectorsApi } = require('../src/lib/connectors')
const { summarizeFeishuPermissions } = require('../src/lib/connectors/feishu-auth')
const { parseAuthJson } = require('../src/lib/connectors/feishu-status')
const { parseJsonLine, normalizeVerificationUrl } = require('../src/lib/connectors/feishu-auth')
const connectorCaps = require('../src/lib/connector-capabilities')

describe('connectors normalize', () => {
  it('merges defaults for feishu and mcp', () => {
    const list = mergeWithDefaults([])
    assert.equal(list.length >= 2, true)
    assert.ok(list.some((c) => c.id === 'feishu'))
    assert.ok(list.some((c) => c.id === 'mcp-default'))
  })

  it('strips secrets from mcp public view', () => {
    const conn = normalizeConnector({
      id: 'mcp-default',
      type: 'mcp',
      mcp: { command: 'npx', args: ['-y', 'x'], envKeys: ['TOKEN'] },
      allowlist: ['a', 'a', 'b'],
    })
    const view = publicConnectorView(conn)
    assert.deepEqual(view.allowlist, ['a', 'b'])
    assert.deepEqual(view.mcp.envKeys, ['TOKEN'])
    assert.equal('TOKEN_VALUE' in view, false)
  })

  it('keeps the built-in feishu connector type during partial updates', () => {
    const conn = normalizeConnector({
      id: 'feishu',
      type: 'mcp',
      title: 'MCP',
      enabled: true,
      allowlist: ['feishu.search_docs'],
    })
    assert.equal(conn.type, 'feishu')
    assert.equal(conn.title, '飞书')
  })

  it('projects tools only when enabled and visible', () => {
    assert.deepEqual(projectedToolNames({ enabled: false, allowlist: ['a'] }), [])
    assert.deepEqual(projectedToolNames({ enabled: true, agentVisible: false, allowlist: ['a'] }), [])
    assert.deepEqual(projectedToolNames({ enabled: true, allowlist: ['a', 'b'] }), ['a', 'b'])
  })

  it('derives grounded office workflows from the feishu read allowlist', () => {
    const names = projectedToolNames({
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.search_docs', 'feishu.read_doc'],
    })
    assert.deepEqual(names, [
      'feishu.search_docs',
      'feishu.read_doc',
      'feishu.meeting_candidates',
      'feishu.meeting_read',
      'feishu.related_chats',
      'feishu.today_priority',
      'feishu.doc_kb_suggest',
    ])
  })
})

describe('connectors store', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-conn-'))
  })
  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('persists upsert without inventing tokens', () => {
    store.upsertConnector(dir, {
      id: 'mcp-default',
      type: 'mcp',
      enabled: true,
      mcp: { command: 'node', args: ['server.js'], envKeys: ['API_KEY'] },
      allowlist: ['search_x'],
    })
    const loaded = store.loadConnectors(dir)
    const mcp = loaded.find((c) => c.id === 'mcp-default')
    assert.equal(mcp.enabled, true)
    assert.equal(mcp.mcp.command, 'node')
    assert.deepEqual(mcp.allowlist, ['search_x'])
    const raw = fs.readFileSync(path.join(dir, 'connectors.json'), 'utf8')
    assert.equal(raw.includes('sk-'), false)
  })
})

describe('connectors api', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-conn-api-'))
  })
  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('lists connectors and probes feishu via injected status', async () => {
    const api = createConnectorsApi({
      getUserData: () => dir,
      probeFeishu: async () => ({
        ok: true,
        state: 'online',
        message: 'bot ready',
        identity: 'bot',
        botReady: true,
        userReady: false,
      }),
    })
    const list = api.listConnectors()
    assert.equal(list.ok, true)
    const status = await api.getConnectorStatus('feishu')
    assert.equal(status.ok, true)
    assert.equal(status.connector.status.state, 'online')
  })

  it('marks feishu as auth_required when read allowlist needs user identity', async () => {
    const api = createConnectorsApi({
      getUserData: () => dir,
      probeFeishu: async () => ({
        ok: true,
        state: 'online',
        message: 'bot ready',
        identity: 'bot',
        botReady: true,
        userReady: false,
      }),
    })
    api.upsertConnector({
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.search_docs', 'feishu.read_doc'],
    })
    const status = await api.getConnectorStatus('feishu')
    assert.equal(status.ok, true)
    assert.equal(status.connector.status.state, 'auth_required')
    assert.ok(status.connector.status.projectedAllowlist.includes('feishu.related_chats'))
  })

  it('exposes docsKb capability readiness separately from optional calendar scope', async () => {
    const api = createConnectorsApi({
      getUserData: () => dir,
      probeFeishu: async () => ({
        ok: true,
        state: 'online',
        message: 'user ready',
        identity: 'user',
        botReady: true,
        userReady: true,
        permissions: summarizeFeishuPermissions([
          'drive:file:download',
          'search:docs:read',
          'docx:document:readonly',
          'docx:document:create',
          'wiki:node:read',
          'wiki:space:read',
          'task:task:read',
          'im:chat:read',
          'im:message:readonly',
          'im:message.send_as_user',
        ].join(' ')),
      }),
    })
    api.upsertConnector({
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.search_docs', 'feishu.read_doc'],
    })
    const status = await api.getConnectorStatus('feishu')
    assert.equal(status.ok, true)
    assert.equal(status.connector.status.capabilities.docsKb.ready, true)
    assert.equal(status.connector.status.capabilities.todayPriority.ready, false)
  })

  it('setAllowlist updates projected names', () => {
    const api = createConnectorsApi({ getUserData: () => dir })
    api.upsertConnector({ id: 'feishu', type: 'feishu', enabled: true, allowlist: [] })
    api.setAllowlist('feishu', ['feishu.search_docs', 'feishu.read_doc'])
    assert.deepEqual(api.getProjectedAllowlist(), [
      'feishu.search_docs',
      'feishu.read_doc',
      'feishu.meeting_candidates',
      'feishu.meeting_read',
      'feishu.related_chats',
      'feishu.today_priority',
      'feishu.doc_kb_suggest',
    ])
  })
})

describe('connector-capabilities helpers', () => {
  it('lists only enabled MCP connectors with command', () => {
    const list = connectorCaps.listEnabledMcpConnectors([
      { id: 'a', type: 'mcp', enabled: true, mcp: { command: 'x' }, allowlist: ['t'] },
      { id: 'b', type: 'mcp', enabled: false, mcp: { command: 'y' }, allowlist: ['t'] },
      { id: 'c', type: 'mcp', enabled: true, mcp: { command: '' }, allowlist: ['t'] },
      { id: 'feishu', type: 'feishu', enabled: true, allowlist: [] },
    ])
    assert.deepEqual(list.map((c) => c.id), ['a'])
  })

  it('publicMcpConfigView never includes env values', () => {
    process.env.CONN_SECRET = 'top-secret'
    const view = connectorCaps.publicMcpConfigView({
      command: 'node',
      args: ['srv.js'],
      envKeys: ['CONN_SECRET'],
    })
    assert.deepEqual(view.envKeys, ['CONN_SECRET'])
    assert.equal(JSON.stringify(view).includes('top-secret'), false)
    delete process.env.CONN_SECRET
  })
})

describe('feishu status parse', () => {
  it('parses auth status json', () => {
    const parsed = parseAuthJson(JSON.stringify({
      identity: 'bot',
      identities: { bot: { available: true, status: 'ready' }, user: { available: false } },
      note: 'ok',
    }))
    assert.equal(parsed.identity, 'bot')
  })

  it('parses the JSON line from in-app device authorization', () => {
    const parsed = parseJsonLine('notice\n{"device_code":"d","verification_url":"https://example.test"}\n')
    assert.equal(parsed.device_code, 'd')
    assert.equal(parsed.verification_url, 'https://example.test')
    assert.equal(normalizeVerificationUrl('"https://example.test?a=1&b=2"'), 'https://example.test?a=1&b=2')
    assert.equal(normalizeVerificationUrl('\\"https://example.test?a=1&b=2\\"'), 'https://example.test?a=1&b=2')
    assert.equal(normalizeVerificationUrl('"\\\"https://example.test?a=1&b=2\\\""'), 'https://example.test?a=1&b=2')
    assert.equal(normalizeVerificationUrl('“https://example.test?a=1&b=2”'), 'https://example.test?a=1&b=2')
  })
})
