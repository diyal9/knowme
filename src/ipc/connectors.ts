'use strict'

/**
 * Connectors + unified tool-draft approval IPC.
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerConnectorsIpc(ipcMain, deps) {
  const {
    app,
    getConnectorsApi,
    feishuAuth,
    feishuCli,
    toolDraftsStore,
    resolveTestSeamOpts,
    connectorToolRuntime,
    getActiveSourceRoot,
    fileBackup,
    sourcesLib,
  } = deps

  ipcMain.handle('connectors-list', () => getConnectorsApi().listConnectors())
  ipcMain.handle('connectors-status', (_e, id) => getConnectorsApi().getConnectorStatus(id))
  ipcMain.handle('connectors-feishu-auth-start', (_e, options = {}) =>
    feishuAuth.startFeishuAuth(app.getPath('userData'), {
      force: Boolean(options?.force),
      full: Boolean(options?.full),
      // Runtime-discovered scopes for just-in-time incremental re-authorization.
      scopes: Array.isArray(options?.scopes)
        ? options.scopes.map((s) => String(s || '').trim()).filter(Boolean)
        : [],
    })
  )
  ipcMain.handle('connectors-upsert', (_e, patch) => getConnectorsApi().upsertConnector(patch || {}))
  ipcMain.handle('connectors-set-allowlist', (_e, id, allowlist) =>
    getConnectorsApi().setAllowlist(id, allowlist))
  ipcMain.handle('tool-drafts-list', () => ({
    ok: true,
    drafts: toolDraftsStore.listPendingDrafts(app.getPath('userData')),
  }))
  ipcMain.handle('tool-approve-draft', async (_e, payload = {}) => {
    const userData = app.getPath('userData')
    const { clean, seam } = resolveTestSeamOpts(payload)
    const draft = connectorToolRuntime.getDraft(userData, clean.draftId)
    let fileAdapter = null
    if (draft?.kind === 'file') {
      const root = getActiveSourceRoot()
      if (root) {
        fileAdapter = fileBackup.buildFileWriteAdapter(root, sourcesLib, { runId: draft.runId || 'unknown' })
      }
    }
    return connectorToolRuntime.approveToolDraft(userData, clean.draftId, {
      reject: Boolean(clean.reject),
      runId: draft?.runId || clean.runId || '',
      sessionId: clean.sessionId || '',
      approverId: clean.approverId || 'user',
      fileAdapter,
      ...seam,
    })
  })
  ipcMain.handle('tool-rollback-draft', async (_e, payload = {}) => {
    const root = getActiveSourceRoot()
    if (!root) return { ok: false, code: 'no_source', message: '无活跃内容源' }
    const fileAdapter = fileBackup.buildFileWriteAdapter(root, sourcesLib, { runId: payload.runId || 'unknown' })
    return connectorToolRuntime.rollbackToolDraft(app.getPath('userData'), payload.draftId, { fileAdapter })
  })
  ipcMain.handle('connectors-create-doc-draft', (_e, payload = {}) => {
    const built = feishuCli.buildDraftWrite({
      title: payload.title,
      body: payload.body,
    })
    if (!built.ok) return built
    const extraMeta = payload.sourceArtifactId
      ? { sourceArtifactId: String(payload.sourceArtifactId).slice(0, 120) }
      : {}
    const draft = connectorToolRuntime.rememberDraft(app.getPath('userData'), {
      ...built.draft,
      meta: extraMeta,
    })
    return {
      ok: true,
      draft,
      text: built.text,
      requiresApproval: true,
    }
  })
}

module.exports = { registerConnectorsIpc }
