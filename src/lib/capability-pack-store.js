'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { assertPathInsideRoot } = require('./capability-store')
const { PACK_ID_RE } = require('./capability-pack-schema')

const STORE_VERSION = 1

function nowIso() {
  return new Date().toISOString()
}

function defaultBundledPacksRoot() {
  return path.join(__dirname, '..', 'packs')
}

function resolvePackPaths(userData) {
  const root = path.join(String(userData || ''), 'capability-packs')
  return {
    root,
    store: path.join(root, 'pack-store.json'),
    installed: path.join(root, 'installed'),
  }
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

function hashDirectory(root) {
  const hash = crypto.createHash('sha256')
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else {
        hash.update(entry.name)
        hash.update(fs.readFileSync(full))
      }
    }
  }
  if (fs.existsSync(root)) walk(root)
  return hash.digest('hex').slice(0, 16)
}

function createPackStore(options = {}) {
  const userData = options.userData || ''
  const bundledRoot = options.bundledRoot || defaultBundledPacksRoot()
  const paths = resolvePackPaths(userData)

  function loadStore() {
    const raw = readJson(paths.store)
    if (!raw || raw.version !== STORE_VERSION) {
      return { version: STORE_VERSION, packs: {}, updatedAt: nowIso() }
    }
    return raw
  }

  function saveStore(store) {
    store.updatedAt = nowIso()
    writeJsonAtomic(paths.store, store)
  }

  function getEntry(packId) {
    if (!PACK_ID_RE.test(String(packId || '').trim())) return null
    const store = loadStore()
    return store.packs[packId] || null
  }

  function upsertEntry(entry) {
    if (!PACK_ID_RE.test(String(entry?.id || '').trim())) return null
    const store = loadStore()
    store.packs[entry.id] = entry
    saveStore(store)
    return entry
  }

  function removeEntry(packId) {
    if (!PACK_ID_RE.test(String(packId || '').trim())) return false
    const store = loadStore()
    delete store.packs[packId]
    saveStore(store)
    return true
  }

  function installedDir(packId) {
    const id = String(packId || '').trim()
    if (!PACK_ID_RE.test(id)) return null
    const guard = assertPathInsideRoot(paths.installed, path.resolve(paths.installed, id))
    return guard.ok ? guard.path : null
  }

  function resolvePackRoot(packId, entry) {
    if (entry?.source === 'installed') {
      const dir = installedDir(packId)
      if (dir && fs.existsSync(dir)) return dir
    }
    const id = String(packId || '').trim()
    if (!PACK_ID_RE.test(id)) return null
    const guard = assertPathInsideRoot(bundledRoot, path.resolve(bundledRoot, id))
    return guard.ok ? guard.path : null
  }

  return {
    paths,
    bundledRoot,
    loadStore,
    saveStore,
    getEntry,
    upsertEntry,
    removeEntry,
    installedDir,
    resolvePackRoot,
    hashDirectory,
  }
}

function resolvePackFile(packRoot, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..')) return null
  const full = path.resolve(packRoot, rel)
  const guard = assertPathInsideRoot(packRoot, full)
  if (!guard.ok) return null
  return full
}

module.exports = {
  STORE_VERSION,
  defaultBundledPacksRoot,
  resolvePackPaths,
  createPackStore,
  resolvePackFile,
}
