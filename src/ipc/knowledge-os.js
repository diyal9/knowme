'use strict'

const { spawn } = require('child_process')

/**
 * Knowledge OS + Obsidian bridge IPC.
 * Helpers kosSourcesCtx / ensureFabricSeeded stay in main (also used by fabric).
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerKnowledgeOsIpc(ipcMain, deps) {
  const {
    app,
    shell,
    knowledgeOs,
    llmwikiService,
    obsidianBridge,
    fabricGovernance,
    kosSourcesCtx,
    ensureFabricSeeded,
  } = deps

  function currentWikiRoot() {
    return knowledgeOs.resolveWikiRoot(app.getPath('userData'), kosSourcesCtx())
  }

  ipcMain.handle('knowledge-os-list', () => {
    try {
      const userData = app.getPath('userData')
      knowledgeOs.ensureDirs(userData)
      ensureFabricSeeded(userData)
      return { ok: true, ...knowledgeOs.listEntries(userData, kosSourcesCtx()) }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-refresh', async () => {
    try {
      return await llmwikiService.refresh(app.getPath('userData'), kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('obsidian-status', () => {
    try {
      return { ok: true, ...obsidianBridge.getStatus(currentWikiRoot()) }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('obsidian-install', async () => {
    try {
      await shell.openExternal(obsidianBridge.OFFICIAL_DOWNLOAD_URL)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message || '无法打开 Obsidian 官方下载页' }
    }
  })

  ipcMain.handle('obsidian-bridge-install', () => {
    try {
      const wikiRoot = currentWikiRoot()
      obsidianBridge.ensureVaultRegistered(wikiRoot)
      return {
        ...obsidianBridge.installKnowMeBridge(wikiRoot),
        wikiRoot,
      }
    } catch (e) {
      return { ok: false, error: e.message || '无法安装 KnowMe Bridge' }
    }
  })

  ipcMain.handle('obsidian-open', async () => {
    try {
      const state = obsidianBridge.prepareOpen(currentWikiRoot())
      if (!state.ok) return state
      try {
        await shell.openExternal(state.openUri)
        return {
          ok: true,
          directGraph: state.directGraph,
          wikiRoot: state.wikiRoot,
          vaultCreated: !!state.vaultCreated,
        }
      } catch (uriError) {
        if (!state.executablePath) throw uriError
        const child = spawn(state.executablePath, [state.wikiRoot], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        })
        await new Promise((resolve, reject) => {
          child.once('spawn', resolve)
          child.once('error', reject)
        })
        child.unref()
        return {
          ok: true,
          directGraph: false,
          fallback: true,
          wikiRoot: state.wikiRoot,
          vaultCreated: !!state.vaultCreated,
        }
      }
    } catch (e) {
      return { ok: false, error: e.message || '无法打开 Obsidian' }
    }
  })

  ipcMain.handle('knowledge-os-query', async (_e, queryText) => {
    try {
      return await llmwikiService.query(app.getPath('userData'), queryText, kosSourcesCtx())
    } catch (e) {
      return { ok: false, hits: [], error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-ingest', async (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      const ssot = fabricGovernance.checkIngestSsot(userData, payload, kosSourcesCtx())
      if (ssot.blocked) {
        return { ok: false, error: ssot.message || 'SSOT 阻断重复入库', ssot }
      }
      const result = await llmwikiService.ingest(userData, payload, kosSourcesCtx())
      if (result?.ok && ssot.proposal) {
        result.ssot = { action: ssot.action, proposalId: ssot.proposal.id, message: ssot.message }
      }
      return result
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-lint', async () => {
    try {
      return await llmwikiService.lint(app.getPath('userData'), kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e), issues: [] }
    }
  })

  ipcMain.handle('knowledge-os-promote', (_e, payload = {}) => {
    try {
      return knowledgeOs.promoteToOkfDraft(app.getPath('userData'), payload, kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-read', (_e, payload = {}) => {
    try {
      return knowledgeOs.readEntry(app.getPath('userData'), payload.kind || 'wiki', payload.path, kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-harness-status', () => {
    try {
      return knowledgeOs.harnessStatus(app.getPath('userData'), kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e), issues: [] }
    }
  })

  ipcMain.handle('knowledge-os-save-raw', async (_e, payload = {}) => {
    try {
      return await llmwikiService.saveRaw(app.getPath('userData'), {
        path: String(payload.path || ''),
        content: String(payload.content ?? ''),
        expectedHash: payload.expectedHash ? String(payload.expectedHash) : null,
      }, kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-config', (_e, patch) => {
    try {
      if (patch && typeof patch === 'object') {
        return { ok: true, config: knowledgeOs.saveConfig(app.getPath('userData'), patch) }
      }
      return { ok: true, config: knowledgeOs.loadConfig(app.getPath('userData')) }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })
}

module.exports = { registerKnowledgeOsIpc }
