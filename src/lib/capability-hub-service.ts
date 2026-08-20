/**
 * capability-hub-service — Capability Hub 组合根；对外 require 路径与导出符号不变。
 * 域实现见 capability-hub/ 子模块；映射 canonical 在 capability-hub/map。
 */
'use strict'

const path = require('path')
const {
  createCapabilityStore,
} = require('./capability-store')
const {
  createCapabilityCatalog,
} = require('./capability-catalog')
const {
  createCapabilityImport,
} = require('./capability-import')
const { createUnifiedConnectorStore } = require('./connectors/unified-store')
const { createCapabilityRuntime } = require('./capability-hub/runtime')
const { createCapabilityLifecycle } = require('./capability-hub/lifecycle')
const { createCapabilityExperts } = require('./capability-hub/experts')
const { createCapabilitySessionContext } = require('./capability-hub/session-context')
const { IPC_CHANNELS, registerCapabilityHubIpc } = require('./capability-hub/ipc')
const map = require('./capability-hub/map')

/**
 * 组装 Capability Hub 服务：store、runtime、lifecycle、experts、session、IPC。
 */
function createCapabilityHubService(deps = {}) {
  const getUserData = typeof deps.getUserData === 'function' ? deps.getUserData : () => ''
  const getKnowledgeDir = typeof deps.getKnowledgeDir === 'function'
    ? deps.getKnowledgeDir
    : () => path.join(getUserData(), 'knowledge')
  const getConnectorsApi = typeof deps.getConnectorsApi === 'function'
    ? deps.getConnectorsApi
    : () => null
  const getWorkflowStore = typeof deps.getWorkflowStore === 'function'
    ? deps.getWorkflowStore
    : () => null
  const bundledRoot = deps.bundledRoot || path.join(__dirname, '..', 'catalog')
  const getPackSkillSources = typeof deps.getPackSkillSources === 'function'
    ? deps.getPackSkillSources
    : null
  const getPackEmptyStateGroups = typeof deps.getPackEmptyStateGroups === 'function'
    ? deps.getPackEmptyStateGroups
    : () => []
  const getPackScenesForUi = typeof deps.getPackScenesForUi === 'function'
    ? deps.getPackScenesForUi
    : () => []
  const getKnowledgeCatalog = typeof deps.getKnowledgeCatalog === 'function'
    ? deps.getKnowledgeCatalog
    : () => ({ providers: [], activeProviderId: 'local-default' })
  const resolveProviderById = typeof deps.resolveProviderById === 'function'
    ? deps.resolveProviderById
    : () => null
  const getActiveProvider = typeof deps.getActiveProvider === 'function'
    ? deps.getActiveProvider
    : () => null
  const onExpertUninstalled = typeof deps.onExpertUninstalled === 'function'
    ? deps.onExpertUninstalled
    : null

  const store = createCapabilityStore({ getUserData })
  const unifiedConnectors = createUnifiedConnectorStore({
    getUserData,
    capabilityStore: store,
    mode: deps.connectorStoreMode,
  })
  const catalogApi = createCapabilityCatalog({ getUserData, bundledRoot })
  const importApi = createCapabilityImport({ getUserData })

  const runtime = createCapabilityRuntime({
    getUserData,
    getKnowledgeDir,
    store,
    unifiedConnectors,
    getPackSkillSources,
    getPackEmptyStateGroups,
    getPackScenesForUi,
  })

  const lifecycle = createCapabilityLifecycle({
    getUserData,
    getConnectorsApi,
    getWorkflowStore,
    bundledRoot,
    getPackSkillSources,
    store,
    catalogApi,
    importApi,
    unifiedConnectors,
    expertRuntime: runtime.expertRuntime,
    skillRuntime: runtime.skillRuntime,
    findPackOwnedSkill: runtime.findPackOwnedSkill,
    onExpertUninstalled,
  })

  const experts = createCapabilityExperts({
    store,
    catalogApi,
    expertRuntime: runtime.expertRuntime,
    onExpertUninstalled,
  })

  const sessionContext = createCapabilitySessionContext({
    getKnowledgeDir,
    getKnowledgeCatalog,
    resolveProviderById,
    getActiveProvider,
    capabilitiesRoot: runtime.capabilitiesRoot,
    buildInstallStoreMap: runtime.buildInstallStoreMap,
    runSkillScriptInSandbox: runtime.runSkillScriptInSandbox,
    skillRuntime: runtime.skillRuntime,
    expertRuntime: runtime.expertRuntime,
  })

  function registerIpcHandlers(handlers = {}) {
    registerCapabilityHubIpc({
      loadAgentStore: deps.loadAgentStore,
      listCapabilities: lifecycle.listCapabilities,
      listCapabilityFavorites: lifecycle.listCapabilityFavorites,
      toggleCapabilityFavorite: lifecycle.toggleCapabilityFavorite,
      installCapability: lifecycle.installCapability,
      precheckInstallCapability: lifecycle.precheckInstallCapability,
      uninstallCapability: lifecycle.uninstallCapability,
      enableCapability: lifecycle.enableCapability,
      disableCapability: lifecycle.disableCapability,
      updateCapability: lifecycle.updateCapability,
      importCapability: lifecycle.importCapability,
      precheckImportCapability: lifecycle.precheckImportCapability,
      scanCursorRepositoryForHub: lifecycle.scanCursorRepositoryForHub,
      importCursorRepository: lifecycle.importCursorRepository,
      skillRuntime: runtime.skillRuntime,
      listSkillTasks: runtime.listSkillTasks,
      expertRuntime: runtime.expertRuntime,
      saveExpertForHub: experts.saveExpertForHub,
      deleteExpertForHub: experts.deleteExpertForHub,
      unifiedConnectors,
      getConnectorsApi,
    }, handlers)
  }

  return {
    IPC_CHANNELS,
    migrateConnectorsIfNeeded: lifecycle.migrateConnectorsIfNeeded,
    backfillExpertDisplayNames: experts.backfillExpertDisplayNames,
    listCapabilities: lifecycle.listCapabilities,
    listCapabilityFavorites: lifecycle.listCapabilityFavorites,
    toggleCapabilityFavorite: lifecycle.toggleCapabilityFavorite,
    saveExpert: experts.saveExpertForHub,
    deleteExpert: experts.deleteExpertForHub,
    installCapability: lifecycle.installCapability,
    precheckInstallCapability: lifecycle.precheckInstallCapability,
    uninstallCapability: lifecycle.uninstallCapability,
    enableCapability: lifecycle.enableCapability,
    disableCapability: lifecycle.disableCapability,
    updateCapability: lifecycle.updateCapability,
    importCapability: lifecycle.importCapability,
    precheckImportCapability: lifecycle.precheckImportCapability,
    scanCursorRepositoryForHub: lifecycle.scanCursorRepositoryForHub,
    planCursorRepositoryForHub: lifecycle.planCursorRepositoryForHub,
    importCursorRepository: lifecycle.importCursorRepository,
    verifyImportedWorkflow: lifecycle.verifyImportedWorkflow,
    skillRuntime: runtime.skillRuntime,
    listSkillTasks: runtime.listSkillTasks,
    expertRuntime: runtime.expertRuntime,
    buildSkillToolsForSession: sessionContext.buildSkillToolsForSession,
    filterConnectorsForSession: sessionContext.filterConnectorsForSession,
    assembleContextForSession: sessionContext.assembleContextForSession,
    sessionDto: sessionContext.sessionDto,
    updateSessionKnowledgeContext: sessionContext.updateSessionKnowledgeContext,
    resolveSessionRetrievalScope: sessionContext.resolveSessionRetrievalScope,
    projectSessionKnowledge: map.projectSessionKnowledge,
    validateSessionContextPatch: map.validateSessionContextPatch,
    registerIpcHandlers,
    capabilitiesRoot: runtime.capabilitiesRoot,
    unifiedConnectors,
  }
}

module.exports = {
  IPC_CHANNELS,
  createCapabilityHubService,
  mapCatalogItemToHub: map.mapCatalogItemToHub,
  mapPackSkillToHub: map.mapPackSkillToHub,
  inferPackSkillDomainCategory: map.inferPackSkillDomainCategory,
  createMinimalPackage: map.createMinimalPackage,
  projectSessionKnowledge: map.projectSessionKnowledge,
  resolveSessionRetrievalProviders: map.resolveSessionRetrievalProviders,
  validateSessionContextPatch: map.validateSessionContextPatch,
}
