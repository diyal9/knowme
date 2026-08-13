'use strict'

/**
 * Capability Hub — 统一 install store 与 capabilities/ 目录生命周期。
 * 用户数据根目录可注入，便于单元测试。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { validateAndNormalizeManifest } = require('./capability-manifest-v2')

const STORE_VERSION = 1
const VALID_KINDS = new Set(['skill', 'expert', 'connector'])
const VALID_SOURCES = new Set(['curated', 'local', 'zip', 'https', 'custom', 'local-repo'])
const VALID_STATUSES = new Set([
  'available',
  'installing',
  'installed',
  'enabled',
  'disabled',
  'failed',
  'updating',
  'uninstalling',
  'removed',
])

const DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i

function nowIso() {
  return new Date().toISOString()
}

function defaultBundledRoot() {
  return path.join(__dirname, '..', 'catalog')
}

function resolvePaths(userData) {
  const root = path.join(String(userData || ''), 'capabilities')
  return {
    root,
    installStore: path.join(root, 'install-store.json'),
    catalogOverlay: path.join(root, 'catalog-overlay.json'),
    favorites: path.join(root, 'favorites.json'),
    staging: path.join(root, 'imports', 'staging'),
    skills: path.join(root, 'skills'),
    experts: path.join(root, 'experts'),
    connectors: path.join(root, 'connectors'),
    snapshots: path.join(root, 'snapshots'),
  }
}

function favoriteKey(kind, id) {
  const k = String(kind || 'skill').trim() || 'skill'
  const i = String(id || '').trim()
  if (!i) return ''
  return `${k}:${i}`
}

function loadFavorites(userData) {
  const paths = resolvePaths(userData)
  fs.mkdirSync(paths.root, { recursive: true })
  const raw = readJson(paths.favorites)
  const keys = new Set()
  const list = Array.isArray(raw?.keys) ? raw.keys : (Array.isArray(raw?.ids) ? raw.ids : [])
  for (const item of list) {
    const key = String(item || '').trim()
    if (key) keys.add(key)
  }
  return {
    version: Number(raw?.version) || 1,
    updatedAt: String(raw?.updatedAt || '').trim() || nowIso(),
    keys,
    paths,
  }
}

function saveFavorites(userData, favorites) {
  const paths = resolvePaths(userData)
  const keys = [...(favorites.keys || [])].map(String).filter(Boolean).sort()
  writeJsonAtomic(paths.favorites, {
    version: 1,
    updatedAt: nowIso(),
    keys,
  })
  return { ok: true, keys }
}

function listFavoriteKeys(userData) {
  return [...loadFavorites(userData).keys]
}

function isFavorite(userData, kind, id) {
  const key = favoriteKey(kind, id)
  if (!key) return false
  return loadFavorites(userData).keys.has(key)
}

function toggleFavorite(userData, kind, id) {
  const key = favoriteKey(kind, id)
  if (!key) return { ok: false, error: '无效的收藏目标' }
  const fav = loadFavorites(userData)
  const next = !fav.keys.has(key)
  if (next) fav.keys.add(key)
  else fav.keys.delete(key)
  saveFavorites(userData, fav)
  return { ok: true, key, favorite: next, keys: [...fav.keys].sort() }
}

function kindDir(paths, kind) {
  if (kind === 'skill') return paths.skills
  if (kind === 'expert') return paths.experts
  if (kind === 'connector') return paths.connectors
  return null
}

function entryInstallDir(paths, entry) {
  const base = kindDir(paths, entry.kind)
  if (!base) return null
  return path.join(base, entry.id)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function renameWithRetrySync(src, dest, options = {}) {
  const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : 4
  const delays = Array.isArray(options.delays) && options.delays.length
    ? options.delays
    : [20, 50, 100, 200]
  const renameSync = typeof options.renameSync === 'function' ? options.renameSync : fs.renameSync
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      renameSync(src, dest)
      return { ok: true, attempts: attempt + 1 }
    } catch (error) {
      lastError = error
      const retryable = ['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)
      if (!retryable || attempt >= retries) break
      const delay = Number(delays[Math.min(attempt, delays.length - 1)]) || 0
      if (delay > 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
      }
    }
  }
  return { ok: false, error: lastError }
}

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  const renamed = renameWithRetrySync(tmp, file)
  if (!renamed.ok) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best effort */ }
    throw renamed.error
  }
}

function normalizeId(id) {
  const value = String(id || '').trim()
  if (!value || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)) {
    return { ok: false, error: '无效的能力 id' }
  }
  if (DEVICE_NAME_RE.test(value)) {
    return { ok: false, error: '能力 id 不能使用 Windows 保留设备名' }
  }
  return { ok: true, id: value }
}

function normalizeEntry(raw = {}) {
  const idResult = normalizeId(raw.id)
  if (!idResult.ok) return idResult

  const kind = String(raw.kind || '').trim()
  if (!VALID_KINDS.has(kind)) {
    return { ok: false, error: '无效的能力 kind' }
  }

  const source = String(raw.source || 'local').trim()
  if (!VALID_SOURCES.has(source)) {
    return { ok: false, error: '无效的来源 source' }
  }

  const status = String(raw.status || 'installed').trim()
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, error: '无效的状态 status' }
  }

  const enabled = raw.enabled !== false
  const nextStatus = enabled
    ? (status === 'disabled' ? 'enabled' : (status === 'installed' ? 'enabled' : status))
    : (status === 'enabled' || status === 'installed' ? 'disabled' : status)

  let manifest = null
  if (raw.manifest && typeof raw.manifest === 'object') {
    const normalizedManifest = validateAndNormalizeManifest(raw.manifest, {
      id: idResult.id,
      kind,
      version: raw.version,
      name: raw.name,
      description: raw.description,
    })
    if (!normalizedManifest.ok) {
      return { ok: false, error: normalizedManifest.issues[0]?.message || '无效的 capability manifest' }
    }
    manifest = normalizedManifest.manifest
  }

  return {
    ok: true,
    entry: {
      id: idResult.id,
      kind,
      source,
      version: String(raw.version || '1.0.0').trim() || '1.0.0',
      enabled,
      status: nextStatus,
      trust: String(raw.trust || (source === 'curated' ? 'bundled' : 'unknown')).trim(),
      contentHash: String(raw.contentHash || '').trim(),
      installedAt: String(raw.installedAt || '').trim(),
      updatedAt: String(raw.updatedAt || '').trim(),
      error: String(raw.error || '').trim(),
      originUrl: String(raw.originUrl || '').trim(),
      linked: raw.linked === true,
      originRoot: String(raw.originRoot || '').trim(),
      originPath: String(raw.originPath || '').trim().replace(/\\/g, '/'),
      repositoryId: String(raw.repositoryId || '').trim(),
      name: String(raw.name || '').trim(),
      originName: String(raw.originName || '').trim(),
      nameSource: String(raw.nameSource || '').trim(),
      description: String(raw.description || '').trim(),
      manifest,
      dependencies: manifest?.dependencies || (Array.isArray(raw.dependencies) ? raw.dependencies : []),
      permissions: manifest?.permissions || (raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {}),
      inputs: manifest?.inputs || (Array.isArray(raw.inputs) ? raw.inputs : []),
      outputs: manifest?.outputs || (Array.isArray(raw.outputs) ? raw.outputs : []),
      risk: manifest?.risk || (raw.risk && typeof raw.risk === 'object' ? raw.risk : { level: 'low', reasons: [] }),
      provenance: manifest?.provenance || (raw.provenance && typeof raw.provenance === 'object' ? raw.provenance : {}),
    },
  }
}

function loadInstallStore(userData) {
  const paths = resolvePaths(userData)
  fs.mkdirSync(paths.root, { recursive: true })
  const raw = readJson(paths.installStore)
  const entries = {}
  if (raw && typeof raw.entries === 'object' && raw.entries) {
    for (const [key, value] of Object.entries(raw.entries)) {
      const normalized = normalizeEntry({ ...value, id: value.id || key })
      if (normalized.ok) entries[normalized.entry.id] = normalized.entry
    }
  }
  return {
    version: STORE_VERSION,
    updatedAt: String(raw?.updatedAt || '').trim() || nowIso(),
    entries,
    paths,
  }
}

function saveInstallStore(userData, store) {
  const paths = resolvePaths(userData)
  const payload = {
    version: STORE_VERSION,
    updatedAt: nowIso(),
    entries: store.entries || {},
  }
  writeJsonAtomic(paths.installStore, payload)
  return payload
}

function assertSafeRelativeSegment(segment) {
  const part = String(segment || '')
  if (!part || part === '.' || part === '..') return false
  if (part.includes('\0')) return false
  if (/^[a-zA-Z]:/.test(part)) return false
  if (part.startsWith('/') || part.startsWith('\\')) return false
  if (DEVICE_NAME_RE.test(part)) return false
  return true
}

function assertPathInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  const rel = path.relative(resolvedRoot, resolvedTarget)
  if (rel === '' || rel === '.') {
    return { ok: true, path: resolvedTarget }
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: '路径超出 capabilities 根目录' }
  }
  return { ok: true, path: resolvedTarget }
}

function assertNotSymlink(filePath) {
  try {
    const stat = fs.lstatSync(filePath)
    if (stat.isSymbolicLink()) {
      return { ok: false, error: '不允许符号链接' }
    }
  } catch (err) {
    return { ok: false, error: err.message || '无法读取路径' }
  }
  return { ok: true }
}

function walkFiles(dir, visitor) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!assertSafeRelativeSegment(entry.name)) {
      throw new Error(`非法路径段: ${entry.name}`)
    }
    const full = path.join(dir, entry.name)
    const linkCheck = assertNotSymlink(full)
    if (!linkCheck.ok) throw new Error(linkCheck.error)
    if (entry.isDirectory()) {
      walkFiles(full, visitor)
    } else if (entry.isFile()) {
      visitor(full)
    }
  }
}

function hashDirectory(dir) {
  const hash = crypto.createHash('sha256')
  const files = []
  walkFiles(dir, (file) => files.push(file))
  files.sort((a, b) => a.localeCompare(b))
  for (const file of files) {
    const rel = path.relative(dir, file).replace(/\\/g, '/')
    hash.update(rel)
    hash.update('\0')
    hash.update(fs.readFileSync(file))
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

function copyDirectorySafe(srcDir, destDir, rootGuard) {
  const srcResolved = path.resolve(srcDir)
  const guard = assertPathInsideRoot(rootGuard || path.dirname(destDir), destDir)
  if (!guard.ok) return guard

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true })
  }
  fs.mkdirSync(destDir, { recursive: true })

  function copyRecursive(from, to) {
    const linkCheck = assertNotSymlink(from)
    if (!linkCheck.ok) return linkCheck
    const stat = fs.statSync(from)
    if (stat.isDirectory()) {
      fs.mkdirSync(to, { recursive: true })
      for (const name of fs.readdirSync(from)) {
        if (!assertSafeRelativeSegment(name)) {
          return { ok: false, error: `非法路径段: ${name}` }
        }
        const next = copyRecursive(path.join(from, name), path.join(to, name))
        if (!next.ok) return next
      }
      return { ok: true }
    }
    if (stat.isFile()) {
      fs.copyFileSync(from, to)
      return { ok: true }
    }
    return { ok: false, error: '仅支持普通文件与目录' }
  }

  return copyRecursive(srcResolved, guard.path)
}

function getEntry(userData, id) {
  const store = loadInstallStore(userData)
  const entry = store.entries[String(id || '').trim()]
  if (!entry) return { ok: false, code: 'not_found', error: '未安装该能力' }
  return { ok: true, entry, paths: store.paths }
}

function listEntries(userData, filter = {}) {
  const store = loadInstallStore(userData)
  let items = Object.values(store.entries)
  if (filter.kind) items = items.filter((item) => item.kind === filter.kind)
  if (filter.enabledOnly) items = items.filter((item) => item.enabled)
  if (filter.installedOnly) {
    items = items.filter((item) => !['removed', 'available', 'failed'].includes(item.status))
  }
  items.sort((a, b) => a.id.localeCompare(b.id))
  return { ok: true, entries: items, paths: store.paths }
}

function upsertEntry(userData, patch) {
  const normalized = normalizeEntry(patch)
  if (!normalized.ok) return normalized
  const store = loadInstallStore(userData)
  const entry = {
    ...normalized.entry,
    updatedAt: nowIso(),
    installedAt: normalized.entry.installedAt || nowIso(),
  }
  store.entries[entry.id] = entry
  saveInstallStore(userData, store)
  return { ok: true, entry }
}

function removeEntry(userData, id) {
  const store = loadInstallStore(userData)
  const key = String(id || '').trim()
  if (!store.entries[key]) return { ok: false, code: 'not_found', error: '未安装该能力' }
  delete store.entries[key]
  saveInstallStore(userData, store)
  return { ok: true }
}

function installFromStaging(userData, options = {}) {
  const normalized = normalizeEntry({
    id: options.id,
    kind: options.kind,
    source: options.source || 'local',
    version: options.version,
    trust: options.trust,
    originUrl: options.originUrl,
    name: options.name,
    description: options.description,
    manifest: options.manifest,
    dependencies: options.dependencies,
    permissions: options.permissions,
    inputs: options.inputs,
    outputs: options.outputs,
    risk: options.risk,
    provenance: options.provenance,
    status: 'installing',
    enabled: options.enabled !== false,
  })
  if (!normalized.ok) return normalized

  const stagingPath = String(options.stagingPath || '').trim()
  if (!stagingPath || !fs.existsSync(stagingPath)) {
    return { ok: false, code: 'staging_missing', error: '安装源目录不存在' }
  }

  const store = loadInstallStore(userData)
  const paths = store.paths
  const installDir = entryInstallDir(paths, normalized.entry)
  const guard = assertPathInsideRoot(paths.root, installDir)
  if (!guard.ok) return guard

  store.entries[normalized.entry.id] = {
    ...normalized.entry,
    status: 'installing',
    updatedAt: nowIso(),
  }
  saveInstallStore(userData, store)

  const copied = copyDirectorySafe(stagingPath, guard.path, paths.root)
  if (!copied.ok) {
    store.entries[normalized.entry.id] = {
      ...normalized.entry,
      status: 'failed',
      error: copied.error,
      updatedAt: nowIso(),
    }
    saveInstallStore(userData, store)
    return copied
  }

  let contentHash = ''
  try {
    contentHash = hashDirectory(guard.path)
  } catch (err) {
    fs.rmSync(guard.path, { recursive: true, force: true })
    store.entries[normalized.entry.id] = {
      ...normalized.entry,
      status: 'failed',
      error: err.message || '内容哈希失败',
      updatedAt: nowIso(),
    }
    saveInstallStore(userData, store)
    return { ok: false, code: 'hash_failed', error: store.entries[normalized.entry.id].error }
  }

  const installed = {
    ...normalized.entry,
    status: normalized.entry.enabled ? 'enabled' : 'disabled',
    contentHash,
    installedAt: nowIso(),
    updatedAt: nowIso(),
    error: '',
  }
  store.entries[normalized.entry.id] = installed
  saveInstallStore(userData, store)
  return { ok: true, entry: installed, installDir: guard.path }
}

function uninstall(userData, id, options = {}) {
  const store = loadInstallStore(userData)
  const key = String(id || '').trim()
  const existing = store.entries[key]
  if (!existing) return { ok: false, code: 'not_found', error: '未安装该能力' }

  store.entries[key] = {
    ...existing,
    status: 'uninstalling',
    updatedAt: nowIso(),
  }
  saveInstallStore(userData, store)

  const installDir = entryInstallDir(store.paths, existing)
  const isCuratedOnly = existing.source === 'curated' && options.curatedKeepBundle === true
  if (installDir && fs.existsSync(installDir) && !isCuratedOnly) {
    const guard = assertPathInsideRoot(store.paths.root, installDir)
    if (guard.ok) fs.rmSync(guard.path, { recursive: true, force: true })
  }

  if (options.removeRecord !== false) {
    delete store.entries[key]
    saveInstallStore(userData, store)
    return { ok: true, removed: true }
  }

  store.entries[key] = {
    ...existing,
    status: 'removed',
    enabled: false,
    updatedAt: nowIso(),
  }
  saveInstallStore(userData, store)
  return { ok: true, entry: store.entries[key] }
}

function setEnabled(userData, id, enabled) {
  const store = loadInstallStore(userData)
  const key = String(id || '').trim()
  const existing = store.entries[key]
  if (!existing) return { ok: false, code: 'not_found', error: '未安装该能力' }
  if (['removed', 'failed', 'available'].includes(existing.status)) {
    return { ok: false, code: 'invalid_state', error: '当前状态不可切换启用' }
  }

  const entry = {
    ...existing,
    enabled: enabled === true,
    status: enabled === true ? 'enabled' : 'disabled',
    updatedAt: nowIso(),
  }
  store.entries[key] = entry
  saveInstallStore(userData, store)
  return { ok: true, entry }
}

function enable(userData, id) {
  return setEnabled(userData, id, true)
}

function disable(userData, id) {
  return setEnabled(userData, id, false)
}

function updateFromStaging(userData, id, options = {}) {
  const current = getEntry(userData, id)
  if (!current.ok) return current

  const store = loadInstallStore(userData)
  store.entries[current.entry.id] = {
    ...current.entry,
    status: 'updating',
    updatedAt: nowIso(),
  }
  saveInstallStore(userData, store)

  const result = installFromStaging(userData, {
    id: current.entry.id,
    kind: current.entry.kind,
    source: options.source || current.entry.source,
    version: options.version || current.entry.version,
    trust: options.trust || current.entry.trust,
    originUrl: options.originUrl || current.entry.originUrl,
    name: options.name || current.entry.name,
    description: options.description || current.entry.description,
    manifest: options.manifest || current.entry.manifest,
    dependencies: options.dependencies || current.entry.dependencies,
    permissions: options.permissions || current.entry.permissions,
    inputs: options.inputs || current.entry.inputs,
    outputs: options.outputs || current.entry.outputs,
    risk: options.risk || current.entry.risk,
    provenance: options.provenance || current.entry.provenance,
    enabled: current.entry.enabled,
    stagingPath: options.stagingPath,
  })
  return result
}

function clearStaging(userData) {
  const paths = resolvePaths(userData)
  if (fs.existsSync(paths.staging)) {
    fs.rmSync(paths.staging, { recursive: true, force: true })
  }
  fs.mkdirSync(paths.staging, { recursive: true })
  return { ok: true, staging: paths.staging }
}

function createCapabilityStore(options = {}) {
  const getUserData = typeof options.getUserData === 'function'
    ? options.getUserData
    : () => String(options.userData || '')

  return {
    resolvePaths: () => resolvePaths(getUserData()),
    loadInstallStore: () => loadInstallStore(getUserData()),
    saveInstallStore: (store) => saveInstallStore(getUserData(), store),
    listEntries: (filter) => listEntries(getUserData(), filter),
    getEntry: (id) => getEntry(getUserData(), id),
    upsertEntry: (patch) => upsertEntry(getUserData(), patch),
    removeEntry: (id) => removeEntry(getUserData(), id),
    installFromStaging: (opts) => installFromStaging(getUserData(), opts),
    uninstall: (id, opts) => uninstall(getUserData(), id, opts),
    enable: (id) => enable(getUserData(), id),
    disable: (id) => disable(getUserData(), id),
    updateFromStaging: (id, opts) => updateFromStaging(getUserData(), id, opts),
    clearStaging: () => clearStaging(getUserData()),
    listFavoriteKeys: () => listFavoriteKeys(getUserData()),
    isFavorite: (kind, id) => isFavorite(getUserData(), kind, id),
    toggleFavorite: (kind, id) => toggleFavorite(getUserData(), kind, id),
    hashDirectory,
    copyDirectorySafe,
  }
}

module.exports = {
  STORE_VERSION,
  VALID_KINDS,
  VALID_SOURCES,
  VALID_STATUSES,
  resolvePaths,
  defaultBundledRoot,
  normalizeEntry,
  loadInstallStore,
  saveInstallStore,
  favoriteKey,
  loadFavorites,
  saveFavorites,
  listFavoriteKeys,
  isFavorite,
  toggleFavorite,
  listEntries,
  getEntry,
  upsertEntry,
  removeEntry,
  installFromStaging,
  uninstall,
  enable,
  disable,
  updateFromStaging,
  clearStaging,
  hashDirectory,
  copyDirectorySafe,
  renameWithRetrySync,
  assertSafeRelativeSegment,
  assertPathInsideRoot,
  assertNotSymlink,
  createCapabilityStore,
}
