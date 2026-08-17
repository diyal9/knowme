/**
 * capability-hub/ipc — Capability Hub IPC 通道注册与通道名常量。
 * 不负责：业务实现（委托 lifecycle / experts / runtime）。
 */
'use strict'

const { ipcMain } = require('electron')
const { getSessionCapabilityBindings } = require('../agent-context-assembly')
const connectorCaps = require('../connector-capabilities')
const { fail, ok } = require('./map')

const IPC_CHANNELS = Object.freeze({
  capability: [
    'capability-list',
    'capability-install',
    'capability-install-precheck',
    'capability-uninstall',
    'capability-enable',
    'capability-disable',
    'capability-update',
    'capability-import',
    'capability-import-precheck',
    'capability-pick-local-folder',
    'capability-pick-zip-file',
    'capability-pick-cursor-repository',
    'capability-scan-cursor-repository',
    'capability-import-cursor-repository',
    'capability-favorite-list',
    'capability-favorite-toggle',
  ],
  skill: [
    'skill-list',
    'skill-load',
    'skill-read-resource',
    'skill-run-script',
    'skill-migrate-legacy',
    'skill-task-list',
  ],
  expert: [
    'expert-list',
    'expert-get',
    'expert-save',
    'expert-delete',
    'expert-try-chat',
    'expert-snapshot',
  ],
  connector: [
    'connector-health',
    'connector-tools-preview',
    'connector-save-allowlist',
  ],
})

/**
 * 注册 Hub 相关 ipcMain.handle；handlers 仅含 UI 依赖（如 showOpenDialog）。
 */
function registerCapabilityHubIpc(deps, handlers = {}) {
  const {
    loadAgentStore,
    listCapabilities,
    listCapabilityFavorites,
    toggleCapabilityFavorite,
    installCapability,
    precheckInstallCapability,
    uninstallCapability,
    enableCapability,
    disableCapability,
    updateCapability,
    importCapability,
    precheckImportCapability,
    scanCursorRepositoryForHub,
    importCursorRepository,
    skillRuntime,
    listSkillTasks,
    expertRuntime,
    saveExpertForHub,
    deleteExpertForHub,
    unifiedConnectors,
    getConnectorsApi,
  } = deps

  const showOpenDialog = handlers.showOpenDialog

  ipcMain.handle('capability-list', (_e, opts) => listCapabilities(opts || {}))
  ipcMain.handle('capability-favorite-list', () => listCapabilityFavorites())
  ipcMain.handle('capability-favorite-toggle', (_e, payload) => toggleCapabilityFavorite(payload || {}))
  ipcMain.handle('capability-install', (_e, payload) => installCapability(payload || {}))
  ipcMain.handle('capability-install-precheck', (_e, payload) => precheckInstallCapability(payload || {}))
  ipcMain.handle('capability-uninstall', (_e, payload) => uninstallCapability(payload || {}))
  ipcMain.handle('capability-enable', (_e, payload) => enableCapability(payload || {}))
  ipcMain.handle('capability-disable', (_e, payload) => disableCapability(payload || {}))
  ipcMain.handle('capability-update', (_e, payload) => updateCapability(payload || {}))
  ipcMain.handle('capability-import', (_e, payload) => importCapability(payload || {}))
  ipcMain.handle('capability-import-precheck', (_e, payload) => precheckImportCapability(payload || {}))
  ipcMain.handle('capability-scan-cursor-repository', (_e, payload) =>
    scanCursorRepositoryForHub(payload || {}))
  ipcMain.handle('capability-import-cursor-repository', (_e, payload) =>
    importCursorRepository(payload || {}))

  ipcMain.handle('capability-pick-local-folder', async (e) => {
    if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
    const result = await showOpenDialog(e.sender, {
      title: '选择能力包文件夹',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
    return ok({ path: result.filePaths[0] })
  })

  ipcMain.handle('capability-pick-zip-file', async (e) => {
    if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
    const result = await showOpenDialog(e.sender, {
      title: '选择 ZIP 能力包',
      properties: ['openFile'],
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    })
    if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
    return ok({ path: result.filePaths[0] })
  })

  ipcMain.handle('capability-pick-cursor-repository', async (e) => {
    if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
    const result = await showOpenDialog(e.sender, {
      title: '选择 Cursor 智能体仓库',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
    return ok({ path: result.filePaths[0] })
  })

  ipcMain.handle('skill-list', () => {
    const items = skillRuntime().listSlashPickerItems()
    const skills = items.map((item) => ({
      id: item.id,
      title: item.name,
      slash: item.slash,
      description: item.description || '',
      source: item.source,
      legacy: item.legacy === true,
    }))
    return ok({ skills, items })
  })

  ipcMain.handle('skill-load', (_e, payload = {}) => {
    const skillId = String(payload.skillId || payload.id || '').trim()
    const sessionId = String(payload.sessionId || '').trim()
    let filterOpts = {}
    if (sessionId && loadAgentStore) {
      const { sessions } = loadAgentStore()
      const session = sessions.find((s) => s.id === sessionId)
      if (session) {
        const bindings = getSessionCapabilityBindings(session, expertRuntime())
        if (bindings.allowedSkillIds) filterOpts = { allowedIds: bindings.allowedSkillIds }
      }
    }
    const result = skillRuntime().loadSkillL1(skillId, filterOpts)
    return result.ok ? ok(result) : result
  })

  ipcMain.handle('skill-read-resource', (_e, payload = {}) => {
    const result = skillRuntime().readSkillResource(
      payload.skillId || payload.id,
      payload.path || payload.resource,
    )
    return result.ok ? ok(result) : result
  })

  ipcMain.handle('skill-run-script', async (_e, payload = {}) => {
    const sessionId = String(payload.sessionId || '').trim()
    let permissions = payload.permissions || {}
    if (sessionId && loadAgentStore) {
      const { sessions } = loadAgentStore()
      const session = sessions.find((s) => s.id === sessionId)
      if (session?.run?.permissions) permissions = session.run.permissions
    }
    const result = await skillRuntime().runSkillScript(
      payload.skillId || payload.id,
      payload.script || payload.scriptPath,
      payload.args || {},
      permissions,
    )
    return result.ok ? ok(result) : result
  })

  ipcMain.handle('skill-migrate-legacy', (_e, payload = {}) => {
    const result = skillRuntime().exportLegacyToSkillMd(
      payload.legacySkillId || payload.id,
      payload.targetId,
    )
    return result.ok ? ok(result) : result
  })

  ipcMain.handle('skill-task-list', () => ok(listSkillTasks()))

  ipcMain.handle('expert-list', () => ok({ experts: expertRuntime().listExperts() }))

  ipcMain.handle('expert-get', (_e, expertId) => {
    const result = expertRuntime().loadExpert(expertId)
    return result.ok ? ok({ expert: result }) : result
  })

  ipcMain.handle('expert-save', (_e, payload = {}) => saveExpertForHub(payload || {}))

  ipcMain.handle('expert-delete', (_e, payload = {}) => deleteExpertForHub(payload || {}))

  ipcMain.handle('expert-snapshot', (_e, payload = {}) => {
    const result = expertRuntime().createSessionSnapshot(
      String(payload.sessionId || '').trim(),
      String(payload.expertId || '').trim(),
    )
    return result.ok ? ok(result) : result
  })

  ipcMain.handle('expert-try-chat', (_e, payload = {}) => {
    const result = expertRuntime().buildTryChatSession(String(payload.expertId || '').trim(), payload)
    return result.ok ? ok({ session: result.session, ephemeral: true }) : result
  })

  ipcMain.handle('connector-health', async (_e, payload = {}) => {
    const connectorId = String(payload.connectorId || payload.id || '').trim()
    const connectors = unifiedConnectors.loadConnectors()
    const conn = connectors.find((c) => c.id === connectorId)
    if (!conn) return fail('not_found', '连接器不存在')
    if (conn.type !== 'mcp') {
      return ok({ state: conn.enabled ? 'enabled' : 'disabled', toolsCount: 0 })
    }
    const probe = await connectorCaps.probeMcpHealth(conn.mcp || {})
    return probe.ok ? ok(probe) : probe
  })

  ipcMain.handle('connector-tools-preview', async (_e, payload = {}) => {
    const connectorId = String(payload.connectorId || payload.id || '').trim()
    const connectors = unifiedConnectors.loadConnectors()
    const conn = connectors.find((c) => c.id === connectorId)
    if (!conn) return fail('not_found', '连接器不存在')
    const preview = await connectorCaps.previewMcpTools(conn)
    return preview.ok ? ok(preview) : preview
  })

  ipcMain.handle('connector-save-allowlist', (_e, payload = {}) => {
    const connectorId = String(payload.connectorId || payload.id || '').trim()
    const allowlist = Array.isArray(payload.allowlist) ? payload.allowlist : []
    const result = unifiedConnectors.setAllowlist(connectorId, allowlist)
    if (!result.ok) return result
    getConnectorsApi()?.upsertConnector?.({ id: connectorId, allowlist })
    return ok({ connectorId, allowlist })
  })
}

module.exports = {
  IPC_CHANNELS,
  registerCapabilityHubIpc,
}
