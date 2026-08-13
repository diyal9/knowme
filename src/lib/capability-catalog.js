'use strict'

/**
 * Capability Hub — 内置精选 catalog（bundle seed）与用户 overlay 合并。
 */

const fs = require('fs')
const path = require('path')
const {
  defaultBundledRoot,
  loadInstallStore,
  resolvePaths,
} = require('./capability-store')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  validateAndNormalizeManifest,
} = require('./capability-manifest-v2')
const { parseSkillFrontmatter } = require('./skill-runtime')
const { parseExpertFrontmatter } = require('./expert-runtime')

const CATALOG_VERSION = 1

function nowIso() {
  return new Date().toISOString()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

function normalizeCatalogEntry(raw = {}) {
  const id = String(raw.id || '').trim()
  const kind = String(raw.kind || '').trim()
  if (!id || !kind) return null
  return {
    id,
    kind,
    name: String(raw.name || id).trim(),
    originName: String(raw.originName || '').trim(),
    nameSource: String(raw.nameSource || '').trim(),
    description: String(raw.description || '').trim(),
    version: String(raw.version || '1.0.0').trim(),
    source: String(raw.source || 'curated').trim(),
    trust: String(raw.trust || 'bundled').trim(),
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    featured: raw.featured === true,
    bundlePath: String(raw.bundlePath || '').trim(),
    contentHash: String(raw.contentHash || '').trim(),
    manifest: raw.manifest && typeof raw.manifest === 'object' ? raw.manifest : null,
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : [],
    permissions: raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {},
    inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
    outputs: Array.isArray(raw.outputs) ? raw.outputs : [],
    risk: raw.risk && typeof raw.risk === 'object' ? raw.risk : { level: 'low', reasons: [] },
    provenance: raw.provenance && typeof raw.provenance === 'object' ? raw.provenance : {},
  }
}

function loadBundledEntryManifest(bundledRoot, entry) {
  if (!entry.bundlePath) return null
  const bundleRoot = path.resolve(bundledRoot, entry.bundlePath)
  const rel = path.relative(path.resolve(bundledRoot), bundleRoot)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  const sidecar = readJson(path.join(bundleRoot, SIDECAR_FILE))
  if (sidecar) {
    const normalized = validateAndNormalizeManifest(sidecar, {
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      description: entry.description,
      version: entry.version,
    })
    if (normalized.ok) return normalized.manifest
  }

  let raw = {}
  if (entry.kind === 'skill') {
    const file = path.join(bundleRoot, 'SKILL.md')
    if (fs.existsSync(file)) {
      const parsed = parseSkillFrontmatter(fs.readFileSync(file, 'utf8'))
      raw = parsed.frontmatter || {}
      raw.name = parsed.name || entry.name
      raw.description = parsed.description || entry.description
      raw.hasScripts = fs.existsSync(path.join(bundleRoot, 'scripts'))
    }
  } else if (entry.kind === 'expert') {
    const file = path.join(bundleRoot, 'EXPERT.md')
    if (fs.existsSync(file)) {
      const parsed = parseExpertFrontmatter(fs.readFileSync(file, 'utf8'))
      raw = {
        ...parsed.frontmatter,
        name: parsed.name || entry.name,
        description: parsed.description || entry.description,
        skills: parsed.skills,
        connectors: parsed.connectors,
      }
    }
  } else if (entry.kind === 'connector') {
    raw = readJson(path.join(bundleRoot, 'manifest.json')) || {}
  }
  const adapted = adaptLegacyCapability(entry.kind, raw, {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    version: entry.version,
    source: entry.source,
    ref: entry.bundlePath.replace(/\\/g, '/'),
    trust: entry.trust,
    contentHash: entry.contentHash,
    hasScripts: raw.hasScripts === true,
  })
  return adapted.ok ? adapted.manifest : null
}

function loadBundledCatalog(bundledRoot = defaultBundledRoot()) {
  const catalogFile = path.join(bundledRoot, 'catalog.json')
  const raw = readJson(catalogFile)
  const entries = []
  const list = Array.isArray(raw?.entries) ? raw.entries : []
  for (const item of list) {
    const normalized = normalizeCatalogEntry(item)
    if (normalized) {
      normalized.manifest = loadBundledEntryManifest(bundledRoot, normalized)
      if (normalized.manifest) {
        normalized.dependencies = normalized.manifest.dependencies
        normalized.permissions = normalized.manifest.permissions
        normalized.inputs = normalized.manifest.inputs
        normalized.outputs = normalized.manifest.outputs
        normalized.risk = normalized.manifest.risk
        normalized.provenance = normalized.manifest.provenance
      }
      entries.push(normalized)
    }
  }
  return {
    version: Number(raw?.version) || CATALOG_VERSION,
    updatedAt: String(raw?.updatedAt || '').trim() || nowIso(),
    bundledRoot,
    entries,
  }
}

function loadCatalogOverlay(userData) {
  const paths = resolvePaths(userData)
  const raw = readJson(paths.catalogOverlay)
  const entries = {}
  if (raw && typeof raw.entries === 'object' && raw.entries) {
    for (const [key, value] of Object.entries(raw.entries)) {
      const normalized = normalizeCatalogEntry({ ...value, id: value.id || key })
      if (normalized) entries[normalized.id] = normalized
    }
  }
  return {
    version: Number(raw?.version) || CATALOG_VERSION,
    updatedAt: String(raw?.updatedAt || '').trim() || nowIso(),
    trustedSources: Array.isArray(raw?.trustedSources) ? raw.trustedSources.map(String) : [],
    hiddenIds: Array.isArray(raw?.hiddenIds) ? raw.hiddenIds.map(String) : [],
    entries,
    paths,
  }
}

function saveCatalogOverlay(userData, overlay) {
  const paths = resolvePaths(userData)
  const payload = {
    version: CATALOG_VERSION,
    updatedAt: nowIso(),
    trustedSources: Array.isArray(overlay.trustedSources) ? overlay.trustedSources : [],
    hiddenIds: Array.isArray(overlay.hiddenIds) ? overlay.hiddenIds : [],
    entries: overlay.entries || {},
  }
  writeJsonAtomic(paths.catalogOverlay, payload)
  return payload
}

function resolveBundlePath(bundledRoot, entry) {
  if (!entry.bundlePath) return null
  const candidate = path.resolve(bundledRoot, entry.bundlePath)
  const rel = path.relative(path.resolve(bundledRoot), candidate)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return candidate
}

function mergeCatalog(bundled, overlay, installStore) {
  const hidden = new Set(overlay.hiddenIds || [])
  const map = new Map()

  for (const entry of bundled.entries) {
    if (hidden.has(entry.id)) continue
    map.set(entry.id, { ...entry, catalogLayer: 'bundled' })
  }

  for (const entry of Object.values(overlay.entries || {})) {
    if (hidden.has(entry.id)) {
      map.delete(entry.id)
      continue
    }
    const base = map.get(entry.id)
    map.set(entry.id, {
      ...(base || {}),
      ...entry,
      catalogLayer: base ? 'overlay' : 'user',
    })
  }

  const installEntries = installStore?.entries || {}
  for (const installed of Object.values(installEntries)) {
    if (map.has(installed.id) || ['removed', 'failed', 'available'].includes(installed.status)) continue
    map.set(installed.id, {
      id: installed.id,
      kind: installed.kind,
      name: installed.name || installed.id,
      originName: installed.originName || '',
      nameSource: installed.nameSource || '',
      description: installed.description || '',
      version: installed.version || '1.0.0',
      source: installed.source || 'local',
      trust: installed.trust || 'unknown',
      categories: [],
      tags: installed.repositoryId ? ['Cursor'] : [],
      featured: false,
      bundlePath: '',
      contentHash: installed.contentHash || '',
      manifest: installed.manifest || null,
      dependencies: installed.dependencies || [],
      permissions: installed.permissions || {},
      inputs: installed.inputs || [],
      outputs: installed.outputs || [],
      risk: installed.risk || { level: 'low', reasons: [] },
      provenance: installed.provenance || {},
      catalogLayer: 'installed',
    })
  }
  const merged = []
  for (const entry of map.values()) {
    const installed = installEntries[entry.id]
    const sourceAvailable = !installed?.linked || (
      installed.originRoot
      && installed.originPath
      && fs.existsSync(path.resolve(installed.originRoot, installed.originPath))
    )
    merged.push({
      ...entry,
      name: installed?.name || entry.name,
      originName: installed?.originName || entry.originName || '',
      nameSource: installed?.nameSource || entry.nameSource || '',
      manifest: installed?.manifest || entry.manifest || null,
      dependencies: installed?.manifest?.dependencies || installed?.dependencies || entry.manifest?.dependencies || entry.dependencies || [],
      permissions: installed?.manifest?.permissions || installed?.permissions || entry.manifest?.permissions || entry.permissions || {},
      inputs: installed?.manifest?.inputs || installed?.inputs || entry.manifest?.inputs || entry.inputs || [],
      outputs: installed?.manifest?.outputs || installed?.outputs || entry.manifest?.outputs || entry.outputs || [],
      risk: installed?.manifest?.risk || installed?.risk || entry.manifest?.risk || entry.risk || { level: 'low', reasons: [] },
      provenance: installed?.manifest?.provenance || installed?.provenance || entry.manifest?.provenance || entry.provenance || {},
      installed: Boolean(installed),
      enabled: installed ? installed.enabled !== false : false,
      installStatus: installed?.status || 'available',
      installedVersion: installed?.version || '',
      installedHash: installed?.contentHash || '',
      installedAt: installed?.installedAt || '',
      sourceAvailable,
      repositoryId: installed?.repositoryId || '',
    })
  }

  merged.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return merged
}

function listCatalog(userData, options = {}) {
  const bundledRoot = options.bundledRoot || defaultBundledRoot()
  const bundled = loadBundledCatalog(bundledRoot)
  const overlay = loadCatalogOverlay(userData)
  const installStore = loadInstallStore(userData)
  let items = mergeCatalog(bundled, overlay, installStore)

  if (options.kind) items = items.filter((item) => item.kind === options.kind)
  if (options.featuredOnly) items = items.filter((item) => item.featured)
  if (options.installedOnly) items = items.filter((item) => item.installed)
  if (options.enabledOnly) items = items.filter((item) => item.enabled)
  if (options.query) {
    const q = String(options.query).trim().toLowerCase()
    items = items.filter((item) => (
      item.name.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q)
      || item.tags.some((tag) => tag.toLowerCase().includes(q))
      || item.categories.some((cat) => cat.toLowerCase().includes(q))
    ))
  }

  return {
    ok: true,
    version: bundled.version,
    bundledRoot,
    entries: items,
    trustedSources: overlay.trustedSources,
  }
}

function getCatalogEntry(userData, id, options = {}) {
  const result = listCatalog(userData, options)
  const entry = result.entries.find((item) => item.id === String(id || '').trim())
  if (!entry) return { ok: false, code: 'not_found', error: 'catalog 中不存在该能力' }
  return { ok: true, entry, bundledRoot: result.bundledRoot }
}

function upsertOverlayEntry(userData, patch) {
  const normalized = normalizeCatalogEntry(patch)
  if (!normalized) return { ok: false, error: '无效的 catalog 条目' }
  const overlay = loadCatalogOverlay(userData)
  overlay.entries[normalized.id] = normalized
  saveCatalogOverlay(userData, overlay)
  return { ok: true, entry: normalized }
}

function removeOverlayEntry(userData, id) {
  const overlay = loadCatalogOverlay(userData)
  const key = String(id || '').trim()
  if (!overlay.entries[key]) return { ok: false, code: 'not_found', error: 'overlay 中不存在该条目' }
  delete overlay.entries[key]
  saveCatalogOverlay(userData, overlay)
  return { ok: true }
}

function addTrustedSource(userData, sourceUrl) {
  const url = String(sourceUrl || '').trim()
  if (!url) return { ok: false, error: '来源 URL 不能为空' }
  const overlay = loadCatalogOverlay(userData)
  if (!overlay.trustedSources.includes(url)) overlay.trustedSources.push(url)
  saveCatalogOverlay(userData, overlay)
  return { ok: true, trustedSources: overlay.trustedSources }
}

function isTrustedSource(userData, sourceUrl) {
  const overlay = loadCatalogOverlay(userData)
  const url = String(sourceUrl || '').trim()
  return overlay.trustedSources.some((item) => url.startsWith(item))
}

function getBundledInstallSource(entry, bundledRoot = defaultBundledRoot()) {
  const bundlePath = resolveBundlePath(bundledRoot, entry)
  if (!bundlePath || !fs.existsSync(bundlePath)) {
    return { ok: false, code: 'bundle_missing', error: '内置包路径不存在' }
  }
  return { ok: true, bundlePath }
}

function createCapabilityCatalog(options = {}) {
  const getUserData = typeof options.getUserData === 'function'
    ? options.getUserData
    : () => String(options.userData || '')
  const bundledRoot = options.bundledRoot || defaultBundledRoot()

  return {
    loadBundledCatalog: () => loadBundledCatalog(bundledRoot),
    loadCatalogOverlay: () => loadCatalogOverlay(getUserData()),
    listCatalog: (opts) => listCatalog(getUserData(), { ...opts, bundledRoot }),
    getCatalogEntry: (id, opts) => getCatalogEntry(getUserData(), id, { ...opts, bundledRoot }),
    upsertOverlayEntry: (patch) => upsertOverlayEntry(getUserData(), patch),
    removeOverlayEntry: (id) => removeOverlayEntry(getUserData(), id),
    addTrustedSource: (url) => addTrustedSource(getUserData(), url),
    isTrustedSource: (url) => isTrustedSource(getUserData(), url),
    getBundledInstallSource: (entry) => getBundledInstallSource(entry, bundledRoot),
  }
}

module.exports = {
  CATALOG_VERSION,
  loadBundledCatalog,
  loadCatalogOverlay,
  saveCatalogOverlay,
  mergeCatalog,
  listCatalog,
  getCatalogEntry,
  upsertOverlayEntry,
  removeOverlayEntry,
  addTrustedSource,
  isTrustedSource,
  getBundledInstallSource,
  resolveBundlePath,
  createCapabilityCatalog,
  loadBundledEntryManifest,
}
