'use strict'
const { readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const bridge = require('../src/lib/obsidian-bridge')

function withTemp(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-obsidian-'))
  try { return fn(root) } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

describe('obsidian vault bridge', () => {
  it('detects a Windows user install without running a shell command', () => withTemp(root => {
    const local = path.join(root, 'local')
    const exe = path.join(local, 'Obsidian', 'Obsidian.exe')
    fs.mkdirSync(path.dirname(exe), { recursive: true })
    fs.writeFileSync(exe, '')
    assert.equal(bridge.findExecutable({
      platform: 'win32',
      env: { LOCALAPPDATA: local },
      protocolExecutable: null,
    }), exe)
  }))

  it('parses custom-path protocol handlers from the Windows registry command', () => {
    assert.equal(
      bridge.parseProtocolCommand('"D:\\softroot\\obsidian\\Obsidian.exe" "%1"'),
      'D:\\softroot\\obsidian\\Obsidian.exe'
    )
    assert.equal(
      bridge.parseProtocolCommand('C:\\Tools\\Obsidian.exe %1'),
      'C:\\Tools\\Obsidian.exe'
    )
  })

  it('treats protocol registration as installed even outside standard folders', () => withTemp(root => {
    const exe = path.join(root, 'custom', 'Obsidian.exe')
    fs.mkdirSync(path.dirname(exe), { recursive: true })
    fs.writeFileSync(exe, '')
    const status = bridge.getStatus(root, {
      platform: 'win32',
      candidates: [],
      env: { APPDATA: path.join(root, 'empty-appdata') },
      protocolExecutable: exe,
    })
    assert.equal(status.installed, true)
    assert.equal(status.executablePath, exe)
    assert.equal(status.protocolRegistered, true)
  }))

  it('builds a native URI for the current Wiki index', () => withTemp(root => {
    fs.writeFileSync(path.join(root, 'index.md'), '# Index\n')
    const uri = bridge.nativeOpenUri(root)
    assert.match(uri, /^obsidian:\/\/open\?path=/)
    assert.ok(decodeURIComponent(uri.split('path=')[1]).endsWith('index.md'))
  }))

  it('uses Advanced URI only when the plugin exists and is enabled', () => withTemp(root => {
    const pluginDir = path.join(root, '.obsidian', 'plugins', bridge.ADVANCED_URI_PLUGIN_ID)
    fs.mkdirSync(pluginDir, { recursive: true })
    fs.writeFileSync(path.join(pluginDir, 'main.js'), '')
    fs.writeFileSync(path.join(pluginDir, 'manifest.json'), '{}')
    fs.writeFileSync(
      path.join(root, '.obsidian', 'community-plugins.json'),
      JSON.stringify([bridge.ADVANCED_URI_PLUGIN_ID])
    )
    assert.equal(bridge.hasAdvancedUri(root), true)
    const status = bridge.getStatus(root, {
      candidates: [],
      protocolExecutable: null,
      env: { APPDATA: path.join(root, 'empty-appdata') },
    })
    assert.equal(status.directGraph, true)
    assert.match(status.openUri, /^obsidian:\/\/adv-uri\?/)
    assert.match(status.openUri, /graph%253Aopen/)
  }))

  it('installs and enables the bundled KnowMe Bridge idempotently', () => withTemp(root => {
    const wiki = path.join(root, 'vault')
    const source = path.join(root, 'bundled')
    fs.mkdirSync(path.join(wiki, '.obsidian'), { recursive: true })
    fs.mkdirSync(source, { recursive: true })
    fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({ id: bridge.KNOWME_BRIDGE_PLUGIN_ID }))
    fs.writeFileSync(path.join(source, 'main.js'), 'module.exports = class {}')
    fs.writeFileSync(path.join(wiki, '.obsidian', 'community-plugins.json'), '["another-plugin"]')

    const first = bridge.installKnowMeBridge(wiki, { sourceDir: source })
    const second = bridge.installKnowMeBridge(wiki, { sourceDir: source })
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(bridge.hasKnowMeBridge(wiki), true)
    const enabled = JSON.parse(fs.readFileSync(path.join(wiki, '.obsidian', 'community-plugins.json'), 'utf8'))
    assert.deepEqual(enabled, ['another-plugin', bridge.KNOWME_BRIDGE_PLUGIN_ID])
    const status = bridge.getStatus(wiki, {
      candidates: [],
      protocolExecutable: path.join(root, 'Obsidian.exe'),
      env: { APPDATA: path.join(root, 'empty-appdata') },
      fsImpl: {
        ...fs,
        statSync(p) {
          if (String(p).endsWith('Obsidian.exe')) return { isFile: () => true }
          return fs.statSync(p)
        },
      },
    })
    assert.equal(status.graphProvider, 'knowme')
    assert.match(status.openUri, /^obsidian:\/\/knowme\?/)
  }))

  it('registers an unlisted Wiki folder as an Obsidian vault before opening', () => withTemp(root => {
    const wiki = path.join(root, 'server-src', 'llm-wiki')
    const appData = path.join(root, 'appdata')
    fs.mkdirSync(wiki, { recursive: true })
    fs.writeFileSync(path.join(wiki, 'index.md'), '# Index\n')
    fs.mkdirSync(path.join(appData, 'obsidian'), { recursive: true })
    fs.writeFileSync(path.join(appData, 'obsidian', 'obsidian.json'), JSON.stringify({
      vaults: {
        existing: { path: path.join(root, 'other-vault'), ts: 1 },
      },
    }))

    const prepared = bridge.prepareOpen(wiki, {
      candidates: [path.join(root, 'Obsidian.exe')],
      protocolExecutable: path.join(root, 'Obsidian.exe'),
      env: { APPDATA: appData },
      fsImpl: {
        ...fs,
        statSync(p) {
          if (String(p).endsWith('Obsidian.exe')) return { isFile: () => true }
          return fs.statSync(p)
        },
      },
    })

    assert.equal(prepared.ok, true)
    assert.equal(prepared.vaultCreated, true)
    assert.match(prepared.openUri, /^obsidian:\/\/open\?path=/)
    const decoded = decodeURIComponent(prepared.openUri.split('path=')[1])
    assert.ok(decoded.endsWith('server-src/llm-wiki/index.md'))
    assert.doesNotMatch(decoded, /\\/)

    const saved = JSON.parse(fs.readFileSync(path.join(appData, 'obsidian', 'obsidian.json'), 'utf8'))
    const paths = Object.values(saved.vaults).map(v => path.resolve(v.path))
    assert.ok(paths.some(p => path.resolve(p) === path.resolve(wiki)))
  }))

  it('keeps the native vault handoff when Obsidian or Advanced URI is unavailable', () => withTemp(root => {
    fs.mkdirSync(path.join(root, '.obsidian', 'plugins', bridge.ADVANCED_URI_PLUGIN_ID), { recursive: true })
    fs.writeFileSync(path.join(root, '.obsidian', 'plugins', bridge.ADVANCED_URI_PLUGIN_ID, 'main.js'), '')
    fs.writeFileSync(path.join(root, '.obsidian', 'community-plugins.json'), '[]')
    const status = bridge.getStatus(root, {
      candidates: [],
      protocolExecutable: null,
      env: { APPDATA: path.join(root, 'empty-appdata') },
    })
    assert.equal(status.installed, false)
    assert.equal(status.directGraph, false)
    assert.match(status.openUri, /^obsidian:\/\/open\?path=/)
    assert.equal(status.downloadUrl, 'https://obsidian.md/download?os=win')
  }))

  it('reuses an already registered vault without rewriting config', () => withTemp(root => {
    const wiki = path.join(root, 'llm-wiki')
    const appData = path.join(root, 'appdata')
    fs.mkdirSync(path.join(wiki, '.obsidian'), { recursive: true })
    fs.mkdirSync(path.join(appData, 'obsidian'), { recursive: true })
    fs.writeFileSync(path.join(appData, 'obsidian', 'obsidian.json'), JSON.stringify({
      vaults: {
        abcdef0123456789: { path: wiki, ts: 42 },
      },
    }))
    const before = fs.readFileSync(path.join(appData, 'obsidian', 'obsidian.json'), 'utf8')
    const prepared = bridge.prepareOpen(wiki, {
      candidates: [],
      protocolExecutable: path.join(root, 'fake-Obsidian.exe'),
      env: { APPDATA: appData },
      fsImpl: {
        ...fs,
        statSync(p) {
          if (String(p).endsWith('fake-Obsidian.exe')) return { isFile: () => true }
          return fs.statSync(p)
        },
      },
    })
    assert.equal(prepared.ok, true)
    assert.equal(prepared.vaultCreated, false)
    assert.equal(prepared.vaultId, 'abcdef0123456789')
    assert.equal(fs.readFileSync(path.join(appData, 'obsidian', 'obsidian.json'), 'utf8'), before)
  }))

  it('exposes fixed IPC APIs and removes the embedded graph bridge', () => {
    const preload = readPreload()
    const main = require('./helpers/main-ipc-bundle').readMainEntryBundle()
    const knowledgeOsIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'knowledge-os.ts'), 'utf8')
    assert.match(preload, /obsidianStatus: \(\) => ipcRenderer\.invoke\('obsidian-status'\)/)
    assert.match(preload, /obsidianInstall: \(\) => ipcRenderer\.invoke\('obsidian-install'\)/)
    assert.match(preload, /obsidianBridgeInstall: \(\) => ipcRenderer\.invoke\('obsidian-bridge-install'\)/)
    assert.match(preload, /obsidianOpen: \(\) => ipcRenderer\.invoke\('obsidian-open'\)/)
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('obsidian-status'/)
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('obsidian-install'/)
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('obsidian-bridge-install'/)
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('obsidian-open'/)
    assert.match(main, /registerCoreIpc/)
    assert.doesNotMatch(preload, /knowledgeOsGraph|knowledge-os-graph/)
    assert.doesNotMatch(main, /knowledgeGraph|knowledge-os-graph/)
    assert.doesNotMatch(knowledgeOsIpc, /knowledgeGraph|knowledge-os-graph/)
  })
})
