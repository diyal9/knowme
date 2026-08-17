'use strict'

/**
 * Knowledge provider CRUD + kb-mount IPC.
 * Provider helpers (listProvidersRedacted / resolve*) stay in main for agent/capability use.
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerKnowledgeProviderIpc(ipcMain, deps) {
  const {
    app,
    knowledgeOs,
    knowledgeProvider,
    fabricGraph,
    fabricWeave,
    fabricRetrieval,
    kosSourcesCtx,
    ensureFabricSeeded,
    buildFabricCtx,
    listProvidersRedacted,
    encProviderKey,
  } = deps

  ipcMain.handle('knowledge-provider-list', () => {
    try {
      return { ok: true, ...listProvidersRedacted() }
    } catch (e) {
      return { ok: false, error: e.message || String(e), providers: [], activeProviderId: null }
    }
  })

  ipcMain.handle('knowledge-provider-save', (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      const cfg = knowledgeOs.loadConfig(userData)
      const providers = Array.isArray(cfg.providers) ? [...cfg.providers] : []
      const kind = payload.kind === 'remote-rag' ? 'remote-rag' : 'local'
      const id = payload.id && payload.id !== 'local-default'
        ? String(payload.id)
        : `kp_${Date.now().toString(36)}`

      if (kind === 'local') {
        knowledgeOs.saveConfig(userData, {
          spaceSourceId: payload.spaceSourceId || null,
          subDir: String(payload.subDir || ''),
        })
        return { ok: true, ...listProvidersRedacted() }
      }

      const idx = providers.findIndex((p) => p.id === id)
      const prev = idx >= 0 ? providers[idx] : {}
      const rawKey = payload.apiKey != null ? String(payload.apiKey) : null
      const apiKeyEnc = rawKey ? encProviderKey(rawKey) : (prev.apiKeyEnc || null)
      if (rawKey && !apiKeyEnc) {
        return { ok: false, error: '当前系统无法安全加密 API Key，未保存密钥' }
      }
      const rec = {
        id,
        kind: 'remote-rag',
        displayName: String(payload.displayName || '远程 RAG 知识库').slice(0, 60),
        endpoint: String(payload.endpoint || ''),
        collection: String(payload.collection || ''),
        topK: Number.isFinite(payload.topK) ? payload.topK : knowledgeProvider.DEFAULT_TOPK,
        apiKeyEnc,
      }
      if (idx >= 0) providers[idx] = rec
      else providers.push(rec)
      knowledgeOs.saveConfig(userData, { providers })
      return { ok: true, id, ...listProvidersRedacted() }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-provider-remove', (_e, id) => {
    try {
      const userData = app.getPath('userData')
      const cfg = knowledgeOs.loadConfig(userData)
      const providers = (Array.isArray(cfg.providers) ? cfg.providers : []).filter((p) => p.id !== id)
      const patch = { providers }
      if (cfg.activeProviderId === id) patch.activeProviderId = 'local-default'
      knowledgeOs.saveConfig(userData, patch)
      return { ok: true, ...listProvidersRedacted() }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-provider-set-active', (_e, id) => {
    try {
      knowledgeOs.saveConfig(app.getPath('userData'), { activeProviderId: id || 'local-default' })
      return { ok: true, ...listProvidersRedacted() }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-provider-query', async (_e, queryText) => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      const ctx = buildFabricCtx()
      return await fabricRetrieval.fabricSearch(userData, queryText, ctx)
    } catch (e) {
      return { ok: false, hits: [], message: e.message || String(e) }
    }
  })

  ipcMain.handle('kb-mount', async (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      const provider = knowledgeProvider.normalizeProvider({
        id: payload.id || `kb_${Date.now().toString(36)}`,
        kind: payload.kind || 'qmd-local',
        displayName: payload.displayName || '外挂知识库',
        spaceSourceId: payload.spaceSourceId || null,
        subDir: payload.subDir || '',
        scope: payload.scope || 'client',
        authority: payload.authority || 3,
        retrievalTier: payload.retrievalTier || 2,
        collectionId: payload.collectionId || payload.id,
      })
      const cfg = knowledgeOs.loadConfig(userData)
      const providers = Array.isArray(cfg.providers) ? [...cfg.providers] : []
      const idx = providers.findIndex(p => p.id === provider.id)
      const rec = { ...provider }
      delete rec.apiKey
      if (idx >= 0) providers[idx] = rec
      else providers.push(rec)
      knowledgeOs.saveConfig(userData, { providers, activeProviderId: provider.id })
      fabricGraph.updateKbRouting(userData, provider.id, { health: 1, staleAnchors: 0 })
      const woven = payload.weave !== false
        ? fabricWeave.weaveProvider(userData, provider, kosSourcesCtx())
        : { ok: true, skipped: true }
      return { ok: true, provider: knowledgeProvider.redactProvider(rec), weave: woven }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })
}

module.exports = { registerKnowledgeProviderIpc }
