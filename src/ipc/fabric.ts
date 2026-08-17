'use strict'

/**
 * Knowledge fabric graph / weave / governance IPC.
 * buildFabricCtx / ensureFabricSeeded stay in main (agent retrieval reuse).
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerFabricIpc(ipcMain, deps) {
  const {
    app,
    fabricGraph,
    fabricWeave,
    fabricRetrieval,
    fabricGovernance,
    qmdEngine,
    kosSourcesCtx,
    ensureFabricSeeded,
    buildFabricCtx,
    resolveActiveProvider,
    listRegistryProviders,
  } = deps

  ipcMain.handle('fabric-graph', () => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      return fabricGraph.getSnapshot(userData)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-query', async (_e, queryText) => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      return await fabricRetrieval.fabricSearch(userData, queryText, buildFabricCtx())
    } catch (e) {
      return { ok: false, hits: [], message: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-kb-query', async (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      return await fabricRetrieval.kbQuery(
        userData,
        payload.collection || payload.kbId,
        payload.query || payload.q,
        buildFabricCtx()
      )
    } catch (e) {
      return { ok: false, hits: [], message: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-kb-get', async (_e, ref) => {
    try {
      const userData = app.getPath('userData')
      return await fabricRetrieval.kbGet(userData, ref, buildFabricCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-weave-list', () => {
    try {
      return fabricGraph.listWeaveProposals(app.getPath('userData'))
    } catch (e) {
      return { ok: false, proposals: [], error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-weave-run', async (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      const kbId = payload.kbId || payload.providerId || resolveActiveProvider().id
      const provider = listRegistryProviders().find(p => p.id === kbId) || resolveActiveProvider()
      if (payload.autoApply) {
        return fabricWeave.autoWeaveAndApply(userData, provider, kosSourcesCtx())
      }
      return fabricWeave.weaveProvider(userData, provider, kosSourcesCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-weave-apply', (_e, proposalId) => {
    try {
      return fabricWeave.applyWeave(app.getPath('userData'), proposalId)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-weave-reject', (_e, proposalId) => {
    try {
      return fabricGraph.rejectWeaveProposal(app.getPath('userData'), proposalId)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-engine-status', async () => {
    try {
      return { ok: true, ...(await qmdEngine.getEngineStatus()) }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-governance-checkup', () => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      return fabricGovernance.runUnifiedCheckup(userData, buildFabricCtx())
    } catch (e) {
      return { ok: false, error: e.message || String(e), issues: [] }
    }
  })

  ipcMain.handle('fabric-governance-proposals', () => {
    try {
      return fabricGovernance.listGovernanceProposals(app.getPath('userData'))
    } catch (e) {
      return { ok: false, proposals: [], error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-governance-proposal-apply', (_e, proposalId) => {
    try {
      return fabricGovernance.applyGovernanceProposal(app.getPath('userData'), proposalId)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-governance-proposal-reject', (_e, proposalId) => {
    try {
      return fabricGovernance.rejectGovernanceProposal(app.getPath('userData'), proposalId)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-governance-action', (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      const issue = payload.issue || payload
      const action = payload.action || payload.act
      if (action === 'run_checkup') {
        ensureFabricSeeded(userData)
        return fabricGovernance.runUnifiedCheckup(userData, buildFabricCtx())
      }
      if (action === 'set_ssot_mode') {
        return fabricGovernance.setSsotMode(userData, payload.mode)
      }
      return fabricGovernance.createIssueProposal(userData, issue, action)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-reweave-run', async (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      ensureFabricSeeded(userData)
      const ctx = buildFabricCtx()
      if (payload.kbId) fabricGovernance.enqueueReweave(userData, payload.kbId)
      const processed = fabricGovernance.processReweaveQueue(userData, ctx, { max: payload.max || 1 })
      return processed
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('fabric-governance-config', (_e, patch) => {
    try {
      const userData = app.getPath('userData')
      if (patch && typeof patch === 'object' && patch.ssotMode) {
        return fabricGovernance.setSsotMode(userData, patch.ssotMode)
      }
      return { ok: true, config: fabricGovernance.loadConfig(userData) }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })
}

module.exports = { registerFabricIpc }
