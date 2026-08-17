'use strict'

/**
 * 按域组装 IPC 依赖组。不在此文件写 ipcMain.handle。
 */

const { registerCoreIpc } = require('../ipc')

/** Electron 宿主与通用 Node 绑定。 */
function electronDeps(ctx) {
  return {
    BrowserWindow: ctx.BrowserWindow,
    dialog: ctx.dialog,
    shell: ctx.shell,
    app: ctx.app,
    path: ctx.path,
    fs: ctx.fs,
    crypto: ctx.crypto,
    https: ctx.https,
    http: ctx.http,
    clipboard: ctx.clipboard,
    screen: ctx.screen,
    Menu: ctx.Menu,
    logger: ctx.logger,
  }
}

/** 用户数据目录与设置文件。 */
function pathDeps(ctx) {
  return {
    DATA_DIR: ctx.DATA_DIR,
    KNOWLEDGE_DIR: ctx.KNOWLEDGE_DIR,
    MEMORY_DIR: ctx.MEMORY_DIR,
    PROMPT_SPACE_DIR: ctx.PROMPT_SPACE_DIR,
    LOGS_DIR: ctx.LOGS_DIR,
    SOURCES_FILE: ctx.SOURCES_FILE,
    loadSettings: ctx.loadSettings,
    saveSettings_: ctx.saveSettings_,
    settingsSecure: ctx.settingsSecure,
  }
}

/** 知识源、Fabric、Provider。 */
function knowledgeDeps(ctx) {
  return {
    sourcesLib: ctx.sourcesLib,
    gitlabSource: ctx.gitlabSource,
    webSource: ctx.webSource,
    loadSourcesStore: ctx.loadSourcesStore,
    saveSourcesStore: ctx.saveSourcesStore,
    findSource: ctx.findSource,
    productKnowledge: ctx.productKnowledge,
    productMemory: ctx.productMemory,
    contextCache: ctx.contextCache,
    knowledgeOs: ctx.knowledgeOs,
    llmwikiService: ctx.llmwikiService,
    obsidianBridge: ctx.obsidianBridge,
    fabricGovernance: ctx.fabricGovernance,
    knowledgeStewardStore: ctx.knowledgeStewardStore,
    kosSourcesCtx: ctx.kosSourcesCtx,
    ensureFabricSeeded: ctx.ensureFabricSeeded,
    fabricGraph: ctx.fabricGraph,
    fabricWeave: ctx.fabricWeave,
    fabricRetrieval: ctx.fabricRetrieval,
    qmdEngine: ctx.qmdEngine,
    knowledgeProvider: ctx.knowledgeProvider,
    listProvidersRedacted: ctx.listProvidersRedacted,
    encProviderKey: ctx.encProviderKey,
    buildFabricCtx: ctx.buildFabricCtx,
    resolveActiveProvider: ctx.resolveActiveProvider,
    listRegistryProviders: ctx.listRegistryProviders,
    getActiveSourceRoot: ctx.getActiveSourceRoot,
    buildActiveSourceFileTools: ctx.buildActiveSourceFileTools,
    llmModelCatalog: ctx.llmModelCatalog,
    normalizeRemoteConfig: ctx.normalizeRemoteConfig,
    createRemoteConfigClient: ctx.createRemoteConfigClient,
    mergeOrgPublicConfig: ctx.mergeOrgPublicConfig,
  }
}

/** 工作台货架、管线、mode、启动。 */
function workbenchDeps(ctx) {
  return {
    getWorkbenchDaemonClient: ctx.getWorkbenchDaemonClient,
    publicWorkbenchAuthStatus: ctx.publicWorkbenchAuthStatus,
    workbenchAuth: ctx.workbenchAuth,
    notifyWorkbenchAuthChanged: ctx.notifyWorkbenchAuthChanged,
    getWorkbenchTodoStore: ctx.getWorkbenchTodoStore,
    getWorkbenchTaskDraftStore: ctx.getWorkbenchTaskDraftStore,
    getWorkbenchTaskStore: ctx.getWorkbenchTaskStore,
    getWorkbenchWorkflowPackageStore: ctx.getWorkbenchWorkflowPackageStore,
    getWorkbenchContextStore: ctx.getWorkbenchContextStore,
    getWorkbenchLaunchStores: ctx.getWorkbenchLaunchStores,
    buildWorkbenchLaunchFacts: ctx.buildWorkbenchLaunchFacts,
    resolveLaunchPackageItem: ctx.resolveLaunchPackageItem,
    workbenchLaunchController: ctx.workbenchLaunchController,
    refreshWorkbenchModeProjections: ctx.refreshWorkbenchModeProjections,
    getWorkbenchModeStore: ctx.getWorkbenchModeStore,
    modeNameFromDto: ctx.modeNameFromDto,
    isExpertAvailableForWorkbench: ctx.isExpertAvailableForWorkbench,
    getWorkbenchAutomationStore: ctx.getWorkbenchAutomationStore,
    loadWorkbenchDaemonOverview: ctx.loadWorkbenchDaemonOverview,
    workbenchDaemon: ctx.workbenchDaemon,
    workbenchBootstrap: ctx.workbenchBootstrap,
    workbenchRepo: ctx.workbenchRepo,
    workbenchModel: ctx.workbenchModel,
    projectDaemonTask: ctx.projectDaemonTask,
    listLocalWorkbenchAgents: ctx.listLocalWorkbenchAgents,
    buildVerticalPipelineFactsInput: ctx.buildVerticalPipelineFactsInput,
    buildWorkflowShelf: ctx.buildWorkflowShelf,
    buildWorkbenchConsoleProjection: ctx.buildWorkbenchConsoleProjection,
    attachWorkflowDefinitions: ctx.attachWorkflowDefinitions,
    readJsonSafe: ctx.readJsonSafe,
    readTextSafe: ctx.readTextSafe,
    compileWorkbenchAgentGraphPayload: ctx.compileWorkbenchAgentGraphPayload,
    workbenchAgentGraph: ctx.workbenchAgentGraph,
  }
}

/** Agent 运行时、会话、生成。 */
function agentDeps(ctx) {
  return {
    agentRun: ctx.agentRun,
    loadAgentStore: ctx.loadAgentStore,
    saveAgentStore: ctx.saveAgentStore,
    resolveWorkbenchAgentPackage: ctx.resolveWorkbenchAgentPackage,
    ensureCapabilityHub: ctx.ensureCapabilityHub,
    ensureCapabilityPackRuntime: ctx.ensureCapabilityPackRuntime,
    ensureAgentTeamRuntime: ctx.ensureAgentTeamRuntime,
    getAgentTeamRuntime: () => ctx.agentTeamRuntime,
    workbenchAgentRunControllers: ctx.workbenchAgentRunControllers,
    workbenchAgentRunEvents: ctx.workbenchAgentRunEvents,
    createWorkbenchAgentPortFactory: ctx.createWorkbenchAgentPortFactory,
    agentRuntimePortFactories: ctx.agentRuntimePortFactories,
    getWorkbenchAgentTeamRunner: ctx.getWorkbenchAgentTeamRunner,
    workbenchAgentGateWaiters: ctx.workbenchAgentGateWaiters,
    agentArtifactTools: ctx.agentArtifactTools,
    workbenchAgentEventList: ctx.workbenchAgentEventList,
    normalizeChatEndpoint: ctx.normalizeChatEndpoint,
    parseSseLines: ctx.parseSseLines,
    extractChatText: ctx.extractChatText,
    getAgentProfileStore: ctx.getAgentProfileStore,
    agentSessions: ctx.agentSessions,
    agentSandbox: ctx.agentSandbox,
    activeAgentRuns: ctx.activeAgentRuns,
    cleanSuggestedTitle: ctx.cleanSuggestedTitle,
    localTitleFromParagraph: ctx.localTitleFromParagraph,
    ensureAgentSession: ctx.ensureAgentSession,
    saveAgentSessions: ctx.saveAgentSessions,
    loadAgentSessions: ctx.loadAgentSessions,
    buildEmbedFn: ctx.buildEmbedFn,
    requestAgentCompletion: ctx.requestAgentCompletion,
    buildMissingResourceHint: ctx.buildMissingResourceHint,
    getFeishuGroundingContext: ctx.getFeishuGroundingContext,
    hasPriorFeishuFacts: ctx.hasPriorFeishuFacts,
    agentRuntimeOutputBridges: ctx.agentRuntimeOutputBridges,
    getConnectorsApi: ctx.getConnectorsApi,
    feishuAuth: ctx.feishuAuth,
    feishuCli: ctx.feishuCli,
    toolDraftsStore: ctx.toolDraftsStore,
    resolveTestSeamOpts: ctx.resolveTestSeamOpts,
    connectorToolRuntime: ctx.connectorToolRuntime,
    fileBackup: ctx.fileBackup,
    ensureFeishuConnectorReady: ctx.ensureFeishuConnectorReady,
    toTargetItems: ctx.toTargetItems,
    gameStudio: ctx.gameStudio,
    gameRequirement: ctx.gameRequirement,
    gameWorkbenchHandoff: ctx.gameWorkbenchHandoff,
  }
}

/** notes 数据兼容 stub（产品面已退役，IPC 仍读 notes 目录）。 */
function notesCompatDeps(ctx) {
  return {
    noteId: ctx.noteId,
    noteVersions: ctx.noteVersions,
    noteDiff: ctx.noteDiff,
    readNote: ctx.readNote,
    saveNote: ctx.saveNote,
    deleteNoteF: ctx.deleteNoteF,
    loadAllNotes: ctx.loadAllNotes,
    newNote: ctx.newNote,
    newVersion: ctx.newVersion,
    duplicateNote: ctx.duplicateNote,
    noteWins: ctx.noteWins,
    delPending: ctx.delPending,
    resumeAfterNoteHide: ctx.resumeAfterNoteHide,
    clearLastClosedIf: (id) => {
      if (ctx.lastClosedNoteId === id)
        ctx.lastClosedNoteId = null
    },
    getListWin: () => ctx.listWin,
    noteClassify: ctx.noteClassify,
    chatCompletionOnce: ctx.chatCompletionOnce,
    workspaceNoteBrief: ctx.workspaceNoteBrief,
    groupNotesByProject: ctx.groupNotesByProject,
    applyNoteLayout: ctx.applyNoteLayout,
    showNote: ctx.showNote,
  }
}

/** 窗口、托盘、设置壳。 */
function shellDeps(ctx) {
  return {
    notifyWorkspaceRefresh: ctx.notifyWorkspaceRefresh,
    getSettingsWin: () => ctx.settingsWin,
    showOpenDialogFor: ctx.showOpenDialogFor,
    updateTray: ctx.updateTray,
    openSettings: ctx.openSettings,
    openSettingsWindow: ctx.openSettingsWindow,
    openMemoryPanel: ctx.openMemoryPanel,
    importPromptSpace: ctx.importPromptSpace,
    openLogViewer: ctx.openLogViewer,
    checkForUpdatesManual: ctx.checkForUpdatesManual,
    updateTaskbarAnchor: ctx.updateTaskbarAnchor,
    getWorkspaceWin: () => ctx.workspaceWin,
    createWorkspaceWindow: ctx.createWorkspaceWindow,
    getWindowIconOption: ctx.getWindowIconOption,
  }
}

/** 供 src/ipc 按域 pick；不要在本文件写 ipcMain.handle。 */
function createIpcGroups(ctx) {
  return {
    electron: electronDeps(ctx),
    paths: pathDeps(ctx),
    knowledge: knowledgeDeps(ctx),
    workbench: workbenchDeps(ctx),
    agent: agentDeps(ctx),
    notesCompat: notesCompatDeps(ctx),
    shell: shellDeps(ctx),
  }
}

function bindCoreIpc(ctx) {
  registerCoreIpc(ctx.ipcMain, createIpcGroups(ctx))
}

module.exports = { createIpcGroups, bindCoreIpc }
