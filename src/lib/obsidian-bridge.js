'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const OFFICIAL_DOWNLOAD_URL = 'https://obsidian.md/download?os=win'
const KNOWME_BRIDGE_PLUGIN_ID = 'knowme-bridge'
const ADVANCED_URI_PLUGIN_ID = 'obsidian-advanced-uri'
const BUNDLED_PLUGIN_DIR = path.join(__dirname, '..', 'assets', 'obsidian-plugin', KNOWME_BRIDGE_PLUGIN_ID)

function executableCandidates(env = process.env, platform = process.platform) {
  if (platform !== 'win32') return []
  const out = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Obsidian', 'Obsidian.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Obsidian', 'Obsidian.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Obsidian', 'Obsidian.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Obsidian', 'Obsidian.exe'),
  ].filter(Boolean)

  // Squirrel / auto-updater layouts: Local\Obsidian\app-*\Obsidian.exe
  const squirrelRoot = env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Obsidian')
  if (squirrelRoot) {
    try {
      for (const name of fs.readdirSync(squirrelRoot)) {
        if (!/^app-/i.test(name)) continue
        out.push(path.join(squirrelRoot, name, 'Obsidian.exe'))
      }
    } catch { /* ignore */ }
  }
  return out
}

function parseProtocolCommand(command) {
  const raw = String(command || '').trim()
  if (!raw) return null
  const quoted = raw.match(/^"([^"]+\.exe)"/i)
  if (quoted) return quoted[1]
  const bare = raw.match(/^([A-Za-z]:\\[^\s"]+\.exe)/i)
  return bare ? bare[1] : null
}

function readProtocolExecutable(opts = {}) {
  if ((opts.platform || process.platform) !== 'win32') return null
  // Allow tests to pin or disable registry lookup without touching the machine.
  if (Object.prototype.hasOwnProperty.call(opts, 'protocolExecutable')) {
    return opts.protocolExecutable || null
  }
  if (typeof opts.readProtocolCommand === 'function') {
    return parseProtocolCommand(opts.readProtocolCommand())
  }
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Classes\\obsidian\\shell\\open\\command', '/ve'],
      { encoding: 'utf8', windowsHide: true, timeout: 3000 }
    )
    const match = output.match(/REG_SZ\s+(.+)$/im)
    return parseProtocolCommand(match ? match[1].trim() : '')
  } catch {
    try {
      const output = execFileSync(
        'reg',
        ['query', 'HKLM\\Software\\Classes\\obsidian\\shell\\open\\command', '/ve'],
        { encoding: 'utf8', windowsHide: true, timeout: 3000 }
      )
      const match = output.match(/REG_SZ\s+(.+)$/im)
      return parseProtocolCommand(match ? match[1].trim() : '')
    } catch {
      return null
    }
  }
}

function hasUserData(opts = {}) {
  const env = opts.env || process.env
  const fsImpl = opts.fsImpl || fs
  const marker = path.join(env.APPDATA || '', 'obsidian', 'obsidian.json')
  if (!env.APPDATA) return false
  try { return fsImpl.statSync(marker).isFile() } catch { return false }
}

function findExecutable(opts = {}) {
  const fsImpl = opts.fsImpl || fs
  const fromProtocol = readProtocolExecutable(opts)
  const candidates = [
    ...(fromProtocol ? [fromProtocol] : []),
    ...(opts.candidates || executableCandidates(opts.env, opts.platform)),
  ]
  return candidates.find(candidate => {
    try { return fsImpl.statSync(candidate).isFile() } catch { return false }
  }) || null
}

function enabledCommunityPlugins(wikiRoot, fsImpl = fs) {
  try {
    const raw = fsImpl.readFileSync(path.join(wikiRoot, '.obsidian', 'community-plugins.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function hasEnabledPlugin(wikiRoot, pluginId, fsImpl = fs) {
  if (!wikiRoot) return false
  const mainFile = path.join(wikiRoot, '.obsidian', 'plugins', pluginId, 'main.js')
  const manifestFile = path.join(wikiRoot, '.obsidian', 'plugins', pluginId, 'manifest.json')
  try {
    return fsImpl.statSync(mainFile).isFile()
      && fsImpl.statSync(manifestFile).isFile()
      && enabledCommunityPlugins(wikiRoot, fsImpl).includes(pluginId)
  } catch {
    return false
  }
}

function hasKnowMeBridge(wikiRoot, fsImpl = fs) {
  return hasEnabledPlugin(wikiRoot, KNOWME_BRIDGE_PLUGIN_ID, fsImpl)
}

function hasAdvancedUri(wikiRoot, fsImpl = fs) {
  return hasEnabledPlugin(wikiRoot, ADVANCED_URI_PLUGIN_ID, fsImpl)
}

function installKnowMeBridge(wikiRoot, opts = {}) {
  const fsImpl = opts.fsImpl || fs
  const root = path.resolve(String(wikiRoot || ''))
  const sourceDir = opts.sourceDir || BUNDLED_PLUGIN_DIR
  const targetDir = path.join(root, '.obsidian', 'plugins', KNOWME_BRIDGE_PLUGIN_ID)
  const files = ['manifest.json', 'main.js']

  fsImpl.mkdirSync(targetDir, { recursive: true })
  for (const name of files) {
    const source = path.join(sourceDir, name)
    const target = path.join(targetDir, name)
    const content = fsImpl.readFileSync(source)
    fsImpl.writeFileSync(target, content)
  }

  const enabledFile = path.join(root, '.obsidian', 'community-plugins.json')
  const enabled = enabledCommunityPlugins(root, fsImpl)
  if (!enabled.includes(KNOWME_BRIDGE_PLUGIN_ID)) enabled.push(KNOWME_BRIDGE_PLUGIN_ID)
  const tempFile = `${enabledFile}.knowme.tmp`
  fsImpl.writeFileSync(tempFile, `${JSON.stringify(enabled, null, 2)}\n`, 'utf8')
  fsImpl.renameSync(tempFile, enabledFile)

  return {
    ok: true,
    pluginId: KNOWME_BRIDGE_PLUGIN_ID,
    targetDir,
    enabled: true,
    requiresReload: true,
  }
}

function toUriPath(absPath) {
  return path.resolve(String(absPath || '')).replace(/\\/g, '/')
}

function normalizeVaultPath(absPath) {
  return path.resolve(String(absPath || '')).replace(/[\\/]+$/, '').toLowerCase()
}

function obsidianConfigPath(opts = {}) {
  const env = opts.env || process.env
  return path.join(env.APPDATA || '', 'obsidian', 'obsidian.json')
}

function readVaultConfig(opts = {}) {
  const fsImpl = opts.fsImpl || fs
  const configPath = obsidianConfigPath(opts)
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : { vaults: {} }
  } catch {
    return { vaults: {} }
  }
}

function findRegisteredVault(wikiRoot, opts = {}) {
  const wanted = normalizeVaultPath(wikiRoot)
  const config = readVaultConfig(opts)
  const vaults = config.vaults && typeof config.vaults === 'object' ? config.vaults : {}
  for (const [id, entry] of Object.entries(vaults)) {
    if (!entry || !entry.path) continue
    if (normalizeVaultPath(entry.path) === wanted) {
      return { id, path: entry.path, name: path.basename(entry.path) }
    }
  }
  return null
}

function ensureVaultConfigDir(wikiRoot, fsImpl = fs) {
  const dir = path.join(wikiRoot, '.obsidian')
  try { fsImpl.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

function ensureVaultRegistered(wikiRoot, opts = {}) {
  const fsImpl = opts.fsImpl || fs
  const root = path.resolve(String(wikiRoot || ''))
  ensureVaultConfigDir(root, fsImpl)

  const existing = findRegisteredVault(root, opts)
  if (existing) return { ...existing, created: false }

  const configPath = obsidianConfigPath(opts)
  const config = readVaultConfig(opts)
  if (!config.vaults || typeof config.vaults !== 'object') config.vaults = {}

  let id = crypto.randomBytes(8).toString('hex')
  while (config.vaults[id]) id = crypto.randomBytes(8).toString('hex')

  config.vaults[id] = {
    path: root,
    ts: Date.now(),
    open: true,
  }

  const dir = path.dirname(configPath)
  try { fsImpl.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  fsImpl.writeFileSync(configPath, `${JSON.stringify(config)}\n`, 'utf8')

  return { id, path: root, name: path.basename(root), created: true }
}

function openTarget(wikiRoot, fsImpl = fs) {
  const indexFile = path.join(wikiRoot, 'index.md')
  try {
    if (fsImpl.statSync(indexFile).isFile()) return indexFile
  } catch { /* use root */ }
  return wikiRoot
}

function nativeOpenUri(wikiRoot, fsImpl = fs) {
  return `obsidian://open?path=${encodeURIComponent(toUriPath(openTarget(wikiRoot, fsImpl)))}`
}

function knowMeGraphOpenUri(wikiRoot) {
  const vault = path.basename(path.resolve(wikiRoot))
  return `obsidian://knowme?vault=${encodeURIComponent(vault)}&action=graph`
}

function graphOpenUri(wikiRoot) {
  const vault = path.basename(path.resolve(wikiRoot))
  const command = encodeURIComponent(encodeURIComponent('graph:open'))
  return `obsidian://adv-uri?vault=${encodeURIComponent(vault)}&commandid=${command}`
}

function graphUriForStatus(status, fsImpl = fs) {
  if (status.bridgeInstalled) return knowMeGraphOpenUri(status.wikiRoot)
  if (status.advancedUriInstalled) return graphOpenUri(status.wikiRoot)
  return nativeOpenUri(status.wikiRoot, fsImpl)
}

function getStatus(wikiRoot, opts = {}) {
  const fsImpl = opts.fsImpl || fs
  const root = path.resolve(String(wikiRoot || ''))
  const protocolExecutable = readProtocolExecutable(opts)
  const executablePath = findExecutable({ ...opts, fsImpl, protocolExecutable })
  const protocolRegistered = !!protocolExecutable
  const userDataPresent = hasUserData(opts)
  const installed = !!(executablePath || protocolRegistered || userDataPresent)
  const bridgeInstalled = hasKnowMeBridge(root, fsImpl)
  const advancedUriInstalled = hasAdvancedUri(root, fsImpl)
  const directGraph = bridgeInstalled || advancedUriInstalled
  const registered = findRegisteredVault(root, opts)
  const status = {
    installed,
    executablePath,
    protocolRegistered,
    wikiRoot: root,
    vaultName: path.basename(root),
    vaultRegistered: !!registered,
    bridgeInstalled,
    advancedUriInstalled,
    directGraph,
    graphProvider: bridgeInstalled ? 'knowme' : advancedUriInstalled ? 'advanced-uri' : null,
    downloadUrl: OFFICIAL_DOWNLOAD_URL,
  }
  return { ...status, openUri: graphUriForStatus(status, fsImpl) }
}

function prepareOpen(wikiRoot, opts = {}) {
  const status = getStatus(wikiRoot, opts)
  if (!status.installed) {
    return { ok: false, code: 'not_installed', error: '尚未安装 Obsidian', ...status }
  }
  const registered = ensureVaultRegistered(status.wikiRoot, opts)
  const openUri = graphUriForStatus(status, opts.fsImpl || fs)
  return {
    ok: true,
    ...status,
    openUri,
    vaultRegistered: true,
    vaultCreated: !!registered.created,
    vaultId: registered.id,
  }
}

module.exports = {
  OFFICIAL_DOWNLOAD_URL,
  KNOWME_BRIDGE_PLUGIN_ID,
  ADVANCED_URI_PLUGIN_ID,
  BUNDLED_PLUGIN_DIR,
  executableCandidates,
  parseProtocolCommand,
  readProtocolExecutable,
  hasUserData,
  findExecutable,
  enabledCommunityPlugins,
  hasEnabledPlugin,
  hasKnowMeBridge,
  hasAdvancedUri,
  installKnowMeBridge,
  toUriPath,
  normalizeVaultPath,
  findRegisteredVault,
  ensureVaultRegistered,
  nativeOpenUri,
  knowMeGraphOpenUri,
  graphOpenUri,
  getStatus,
  prepareOpen,
}
