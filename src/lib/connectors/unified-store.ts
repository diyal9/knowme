'use strict'

const fs = require('fs')
const path = require('path')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  serializeSidecar,
  validateAndNormalizeManifest,
} = require('../capability-manifest-v2')
const { createCapabilityStore, resolvePaths } = require('../capability-store')
const legacyStore = require('./store')
const { BUILTIN_IDS, normalizeConnector } = require('./normalize')

const MIGRATION_FLAG = '.connectors-unified-v2'
const VALID_MODES = new Set(['dual', 'unified', 'legacy'])

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

function connectorManifest(connector) {
  const conn = normalizeConnector(connector)
  return {
    id: conn.id,
    kind: 'connector',
    name: conn.title || conn.id,
    description: connector.description || conn.meta?.identityHint || '',
    version: String(connector.version || '1.0.0'),
    type: conn.type,
    agentVisible: conn.agentVisible !== false,
    allowlist: conn.allowlist || [],
    secretSlots: conn.secretSlots || [],
    toolPolicies: conn.toolPolicies || [],
    healthCheck: conn.healthCheck || null,
    capabilities: conn.capabilities || [],
    configState: conn.configState || 'ready',
    ...(conn.type === 'mcp' ? { mcp: conn.mcp || {} } : {}),
    permissions: connector.permissions || {
      tools: conn.allowlist || [],
      externalSystem: conn.type,
    },
  }
}

function normalizeUnifiedManifest(raw, options = {}) {
  const sidecar = options.sidecar
  if (sidecar) {
    const normalized = validateAndNormalizeManifest(sidecar, {
      id: raw.id,
      kind: 'connector',
      name: raw.name || raw.title,
      version: raw.version,
    })
    if (normalized.ok) return normalized
  }
  return adaptLegacyCapability('connector', raw, {
    id: raw.id,
    name: raw.name || raw.title || raw.id,
    description: raw.description || '',
    version: raw.version || '1.0.0',
    source: options.source || 'managed',
    ref: options.ref || '',
    trust: options.trust || 'unknown',
    adaptedFrom: 'connector-manifest',
  })
}

function createUnifiedConnectorStore(options = {}) {
  const getUserData = typeof options.getUserData === 'function'
    ? options.getUserData
    : () => String(options.userData || '')
  const capabilityStore = options.capabilityStore || createCapabilityStore({ getUserData })
  const mode = VALID_MODES.has(options.mode)
    ? options.mode
    : (VALID_MODES.has(process.env.KNOWME_CONNECTOR_STORE_MODE) ? process.env.KNOWME_CONNECTOR_STORE_MODE : 'dual')

  function userData() {
    return getUserData()
  }

  function paths() {
    return resolvePaths(userData())
  }

  function connectorDir(id) {
    return path.join(paths().connectors, String(id || '').trim())
  }

  function loadManagedConnector(id) {
    const dir = connectorDir(id)
    const raw = readJson(path.join(dir, 'manifest.json'))
    if (!raw) return null
    const entry = capabilityStore.getEntry(id)
    const sidecar = readJson(path.join(dir, SIDECAR_FILE))
    const normalizedManifest = normalizeUnifiedManifest(raw, {
      sidecar,
      source: entry.ok ? entry.entry.source : 'managed',
      trust: entry.ok ? entry.entry.trust : 'unknown',
      ref: path.join('connectors', id, 'manifest.json').replace(/\\/g, '/'),
    })
    if (!normalizedManifest.ok) return null
    const config = normalizeConnector({
      id,
      title: raw.name || raw.title || id,
      type: raw.type || normalizedManifest.manifest.metadata?.connector?.type || 'mcp',
      enabled: entry.ok ? entry.entry.enabled !== false : false,
      agentVisible: raw.agentVisible !== false,
      allowlist: raw.allowlist || normalizedManifest.manifest.permissions?.tools || [],
      mcp: raw.mcp || normalizedManifest.manifest.metadata?.connector?.mcp || {},
      secretSlots: raw.secretSlots || normalizedManifest.manifest.metadata?.connector?.secretSlots || [],
      toolPolicies: raw.toolPolicies || normalizedManifest.manifest.metadata?.connector?.toolPolicies || [],
      healthCheck: raw.healthCheck || normalizedManifest.manifest.metadata?.connector?.healthCheck || null,
      capabilities: raw.capabilities || normalizedManifest.manifest.metadata?.connector?.capabilities || [],
      configState: raw.configState || normalizedManifest.manifest.metadata?.connector?.configState || 'ready',
      meta: raw.meta || { identityHint: raw.description || '' },
    })
    return {
      ...config,
      description: raw.description || normalizedManifest.manifest.description || '',
      version: normalizedManifest.manifest.version,
      manifest: normalizedManifest.manifest,
      installStatus: entry.ok ? entry.entry.status : 'available',
      source: entry.ok ? entry.entry.source : 'managed',
    }
  }

  function listManagedConnectors() {
    const root = paths().connectors
    if (!fs.existsSync(root)) return []
    const out = []
    for (const id of fs.readdirSync(root)) {
      const item = loadManagedConnector(id)
      if (item) out.push(item)
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  function loadConnectors() {
    if (mode === 'legacy') return legacyStore.loadConnectors(userData())
    const managed = listManagedConnectors()
    if (mode === 'unified') return managed
    const byId = new Map(managed.map(item => [item.id, item]))
    for (const legacy of legacyStore.loadConnectors(userData())) {
      if (!byId.has(legacy.id)) byId.set(legacy.id, { ...legacy, source: 'legacy-fallback' })
    }
    return [...byId.values()]
  }

  function writeManagedConnector(connector, options = {}) {
    const conn = normalizeConnector(connector)
    const dir = connectorDir(conn.id)
    fs.mkdirSync(dir, { recursive: true })
    const raw = connectorManifest({ ...connector, ...conn })
    const normalized = normalizeUnifiedManifest(raw, {
      source: options.source || connector.source || (BUILTIN_IDS.has(conn.id) ? 'curated' : 'custom'),
      trust: options.trust || connector.manifest?.provenance?.trust || (BUILTIN_IDS.has(conn.id) ? 'bundled' : 'user_confirmed'),
      ref: path.join('connectors', conn.id, 'manifest.json').replace(/\\/g, '/'),
    })
    if (!normalized.ok) return { ok: false, code: 'invalid_manifest', error: normalized.issues?.[0]?.message || '连接器声明无效' }
    writeJsonAtomic(path.join(dir, 'manifest.json'), raw)
    const sidecar = serializeSidecar(normalized.manifest)
    if (!sidecar.ok) return { ok: false, code: 'invalid_manifest', error: sidecar.issues?.[0]?.message || '连接器声明无效' }
    fs.writeFileSync(path.join(dir, SIDECAR_FILE), sidecar.content, 'utf8')
    const stored = capabilityStore.upsertEntry({
      id: conn.id,
      kind: 'connector',
      source: options.source || connector.source || (BUILTIN_IDS.has(conn.id) ? 'curated' : 'custom'),
      version: normalized.manifest.version,
      trust: options.trust || normalized.manifest.provenance.trust,
      enabled: conn.enabled === true,
      status: conn.enabled === true ? 'enabled' : 'disabled',
      name: normalized.manifest.name,
      description: normalized.manifest.description,
      manifest: normalized.manifest,
    })
    if (!stored.ok) return stored
    return { ok: true, connector: { ...conn, manifest: normalized.manifest }, entry: stored.entry }
  }

  function projectLegacy() {
    if (mode === 'legacy') return legacyStore.loadConnectors(userData())
    const projection = listManagedConnectors().map(conn => normalizeConnector(conn))
    return legacyStore.saveConnectors(userData(), projection)
  }

  function upsertConnector(patch) {
    if (mode === 'legacy') return legacyStore.upsertConnector(userData(), patch)
    const existing = loadConnectors().find(conn => conn.id === String(patch.id || '').trim())
    const next = normalizeConnector({ ...(existing || {}), ...patch })
    const written = writeManagedConnector({ ...(existing || {}), ...patch, ...next })
    if (!written.ok) return written
    projectLegacy()
    return loadConnectors()
  }

  function setAllowlist(connectorId, allowlist) {
    const id = String(connectorId || '').trim()
    if (mode === 'legacy') return legacyStore.setAllowlist(userData(), id, allowlist)
    const existing = loadConnectors().find(conn => conn.id === id)
    if (!existing) return { ok: false, code: 'not_found', connectors: loadConnectors() }
    const written = writeManagedConnector({ ...existing, allowlist })
    if (!written.ok) return written
    projectLegacy()
    return { ok: true, connectors: loadConnectors() }
  }

  function setEnabled(connectorId, enabled) {
    const id = String(connectorId || '').trim()
    if (mode === 'legacy') {
      const list = legacyStore.upsertConnector(userData(), { id, enabled: enabled === true })
      return { ok: true, connectors: list }
    }
    const existing = loadConnectors().find(conn => conn.id === id)
    if (!existing) return { ok: false, code: 'not_found', connectors: loadConnectors() }
    const written = writeManagedConnector({ ...existing, enabled: enabled === true })
    if (!written.ok) return written
    projectLegacy()
    return { ok: true, connector: written.connector, entry: written.entry, connectors: loadConnectors() }
  }

  function removeConnector(connectorId) {
    const id = String(connectorId || '').trim()
    if (mode === 'legacy') return legacyStore.removeConnector(userData(), id)
    const existing = loadManagedConnector(id)
    if (!existing) return { ok: false, code: 'not_found', connectors: loadConnectors() }
    const result = capabilityStore.uninstall(id)
    if (!result.ok) return result
    const dir = connectorDir(id)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    projectLegacy()
    return { ok: true, connectors: loadConnectors() }
  }

  function migrateLegacy() {
    if (mode === 'legacy') return { ok: true, skipped: true, mode }
    const resolved = paths()
    fs.mkdirSync(resolved.root, { recursive: true })
    const flagFile = path.join(resolved.root, MIGRATION_FLAG)
    if (fs.existsSync(flagFile)) return { ok: true, skipped: true, mode }

    const legacyFile = legacyStore.connectorsPath(userData())
    if (fs.existsSync(legacyFile) && !fs.existsSync(`${legacyFile}.unified-v2.bak`)) {
      fs.copyFileSync(legacyFile, `${legacyFile}.unified-v2.bak`)
    }
    if (fs.existsSync(resolved.installStore) && !fs.existsSync(`${resolved.installStore}.unified-v2.bak`)) {
      fs.copyFileSync(resolved.installStore, `${resolved.installStore}.unified-v2.bak`)
    }

    let migrated = 0
    for (const connector of legacyStore.loadConnectors(userData())) {
      if (loadManagedConnector(connector.id)) continue
      const written = writeManagedConnector(connector, {
        source: BUILTIN_IDS.has(connector.id) ? 'curated' : 'custom',
        trust: BUILTIN_IDS.has(connector.id) ? 'bundled' : 'migrated',
      })
      if (written.ok) migrated += 1
    }
    projectLegacy()
    fs.writeFileSync(flagFile, `${new Date().toISOString()}\n`, 'utf8')
    return { ok: true, skipped: false, migrated, mode }
  }

  return {
    mode,
    paths,
    loadConnectors,
    listManagedConnectors,
    loadManagedConnector,
    upsertConnector,
    setAllowlist,
    setEnabled,
    removeConnector,
    projectLegacy,
    migrateLegacy,
    writeManagedConnector,
  }
}

module.exports = {
  MIGRATION_FLAG,
  VALID_MODES,
  connectorManifest,
  normalizeUnifiedManifest,
  createUnifiedConnectorStore,
}
