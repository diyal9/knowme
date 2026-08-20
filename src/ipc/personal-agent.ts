'use strict'

const path = require('path')
const { createPersonalAgentService } = require('../lib/personal-agent')
const { routeWorkRelationship, resultActions } = require('../lib/work-relationship-router')
const { projectCommonExperts } = require('../lib/personal-expert-roster')

/** Restricted IPC surface for the singleton personal agent. */
function registerPersonalAgentIpc(ipcMain, deps) {
  const {
    DATA_DIR,
    MEMORY_DIR,
    productMemory,
    loadSettings,
    getAgentProfileStore,
    ensureCapabilityHub,
    getWorkbenchModeStore,
    listProvidersRedacted,
  } = deps
  let service = null

  function getService() {
    if (!service) {
      service = createPersonalAgentService({
        profileStore: getAgentProfileStore(),
        productMemory,
        memoryDir: MEMORY_DIR,
        auditFile: path.join(DATA_DIR, 'personal-agent-growth.json'),
        loadSettings,
      })
    }
    return service
  }

  async function validationOptions(confirmedRisk) {
    const catalog = await Promise.all([
      ensureCapabilityHub().listCapabilities({ kind: 'skill' }).catch(() => ({ items: [] })),
      ensureCapabilityHub().listCapabilities({ kind: 'connector' }).catch(() => ({ items: [] })),
    ])
    const skills = Array.isArray(catalog[0]?.items) ? catalog[0].items : []
    const connectors = Array.isArray(catalog[1]?.items) ? catalog[1].items : []
    const providers = listProvidersRedacted().providers || []
    return {
      enabledSkillIds: skills.filter(item => item.enabled === true).map(item => item.id),
      availableConnectorIds: connectors
        .filter(item => item.enabled !== false && ['installed', 'enabled'].includes(String(item.status || '').toLowerCase()))
        .map(item => item.id),
      availableKnowledgeIds: providers.map(item => item.id),
      confirmedRisk: confirmedRisk === true,
    }
  }

  async function commonExperts() {
    if (typeof getWorkbenchModeStore !== 'function') return []
    const catalog = await ensureCapabilityHub().listCapabilities({ kind: 'expert' }).catch(() => ({ items: [] }))
    return projectCommonExperts(getWorkbenchModeStore().load(), catalog?.items || [])
  }

  ipcMain.handle('personal-agent-get', async () => ({ ...getService().get(), commonExperts: await commonExperts() }))
  ipcMain.handle('personal-agent-save', (_event, payload = {}) => getService().save(payload))
  ipcMain.handle('personal-agent-teach', (_event, payload = {}) => getService().teach(payload))
  ipcMain.handle('personal-agent-growth-list', (_event, payload = {}) => getService().growthList(payload))
  ipcMain.handle('personal-agent-route-work', async (_event, payload = {}) => ({
    ...routeWorkRelationship(payload),
    commonExperts: await commonExperts(),
  }))
  ipcMain.handle('personal-agent-result-actions', () => ({ ok: true, actions: resultActions() }))
  ipcMain.handle('personal-agent-apply-proposal', async (_event, payload = {}) =>
    getService().applyProposal(payload, await validationOptions(payload.confirmedRisk)))
}

module.exports = { registerPersonalAgentIpc }
