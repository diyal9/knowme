'use strict'

/**
 * Agent profile CRUD IPC (list / get / save / remove).
 */
function registerAgentProfileIpc(ipcMain, deps) {
  const {
    getAgentProfileStore,
    ensureCapabilityHub,
    listProvidersRedacted,
  } = deps

  ipcMain.handle('agent-profile-list', (_e, agentId = '') =>
    getAgentProfileStore().list(String(agentId || '')))

  ipcMain.handle('agent-profile-get', (_e, id) =>
    getAgentProfileStore().get(String(id || '')))

  ipcMain.handle('agent-profile-save', async (_e, payload = {}) => {
    const catalog = await Promise.all([
      ensureCapabilityHub().listCapabilities({ kind: 'skill' }).catch(() => ({ items: [] })),
      ensureCapabilityHub().listCapabilities({ kind: 'connector' }).catch(() => ({ items: [] })),
    ])
    const skills = Array.isArray(catalog[0]?.items) ? catalog[0].items : []
    const connectors = Array.isArray(catalog[1]?.items) ? catalog[1].items : []
    const providers = listProvidersRedacted().providers || []
    return getAgentProfileStore().save(payload.profile || payload, {
      enabledSkillIds: skills.filter(item => item.enabled === true).map(item => item.id),
      availableConnectorIds: connectors
        .filter(item => item.enabled !== false && ['installed', 'enabled'].includes(String(item.status || '').toLowerCase()))
        .map(item => item.id),
      availableKnowledgeIds: providers.map(item => item.id),
      confirmedRisk: payload.confirmedRisk === true,
    })
  })

  ipcMain.handle('agent-profile-remove', (_e, id) =>
    getAgentProfileStore().remove(String(id || '')))
}

module.exports = { registerAgentProfileIpc }
