const { ipcRenderer } = require("electron")

module.exports = {
  personalAgentGet: () => ipcRenderer.invoke('personal-agent-get'),
  personalAgentSave: payload => ipcRenderer.invoke('personal-agent-save', payload || {}),
  personalAgentTeach: payload => ipcRenderer.invoke('personal-agent-teach', payload || {}),
  personalAgentApplyProposal: payload => ipcRenderer.invoke('personal-agent-apply-proposal', payload || {}),
  personalAgentGrowthList: payload => ipcRenderer.invoke('personal-agent-growth-list', payload || {}),
  personalAgentRouteWork: payload => ipcRenderer.invoke('personal-agent-route-work', payload || {}),
  personalAgentResultActions: () => ipcRenderer.invoke('personal-agent-result-actions'),
  agentProfileGet: id => ipcRenderer.invoke('agent-profile-get', id),
  agentProfileSave: payload => ipcRenderer.invoke('agent-profile-save', payload || {}),
  agentProfileRemove: id => ipcRenderer.invoke('agent-profile-remove', id),
  workbenchContextGet: () => ipcRenderer.invoke('workbench-context-get'),
  workbenchContextSave: patch => ipcRenderer.invoke('workbench-context-save', patch || {}),
  workbenchContextClear: () => ipcRenderer.invoke('workbench-context-clear'),
  workbenchLaunchAssess: payload => ipcRenderer.invoke('workbench-launch-assess', payload || {}),
  workbenchLaunchSave: payload => ipcRenderer.invoke('workbench-launch-save', payload || {}),
  workbenchLaunchStart: payload => ipcRenderer.invoke('workbench-launch-start', payload || {}),
  workbenchLaunchComplete: payload => ipcRenderer.invoke('workbench-launch-complete', payload || {}),
  workbenchModeList: () => ipcRenderer.invoke('workbench-mode-list'),
  workbenchModeSelect: modeId => ipcRenderer.invoke('workbench-mode-select', String(modeId || '')),
  workbenchModeBindExpert: payload => ipcRenderer.invoke('workbench-mode-bind-expert', payload || {}),
  workbenchModeUnbindExpert: payload => ipcRenderer.invoke('workbench-mode-unbind-expert', payload || {}),
  workbenchAutomationList: () => ipcRenderer.invoke('workbench-automation-list'),
  workbenchAutomationCreate: payload => ipcRenderer.invoke('workbench-automation-create', payload || {}),
  workbenchAutomationUpdate: (id, patch) => ipcRenderer.invoke('workbench-automation-update', id, patch || {}),
  workbenchAutomationDelete: id => ipcRenderer.invoke('workbench-automation-delete', id),
  workbenchAutomationToggle: (id, enabled) => ipcRenderer.invoke('workbench-automation-toggle', id, enabled === true),
  workbenchAutomationFeishuTargets: payload => ipcRenderer.invoke('workbench-automation-feishu-targets', payload || {}),
  workbenchAutomationRunNow: id => ipcRenderer.invoke('workbench-automation-run-now', id),
  onWorkbenchStreamChunk: cb => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('workbench-stream-chunk', fn)
    return () => ipcRenderer.removeListener('workbench-stream-chunk', fn)
  },
  aiSuggestTitle: p => ipcRenderer.invoke('ai-suggest-title', p),
  onAiStreamChunk: cb => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('ai-stream-chunk', fn)
    return () => ipcRenderer.removeListener('ai-stream-chunk', fn)
  },
  onAiStreamEvent: cb => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('ai-stream-event', fn)
    return () => ipcRenderer.removeListener('ai-stream-event', fn)
  },

  // 设置
  initSettings: cb => ipcRenderer.on('init-settings', (_e, s) => cb(s)),
  saveSettings: s  => ipcRenderer.invoke('save-settings', s),
  saveRemoteConfigPrefs: prefs => ipcRenderer.invoke('remote-config-save-prefs', prefs),
  pullRemoteConfig: () => ipcRenderer.invoke('remote-config-pull'),
  getSettings:  ()  => ipcRenderer.sendSync('get-settings'),
  openSettings: tab => ipcRenderer.send('open-settings', tab || ''),
  openSettingsWindow: tab => ipcRenderer.send('open-settings-window', tab || ''),
  openMemoryPanel: () => ipcRenderer.send('open-memory-panel'),
  onSelectSettingsTab: cb => ipcRenderer.on('select-settings-tab', (_e, tab) => cb(tab)),

  // 系统设置
  openDataDir:  ()  => ipcRenderer.send('open-data-dir'),
  openPromptSpace: () => ipcRenderer.send('open-prompt-space'),
  setAutostart: v   => ipcRenderer.send('set-autostart', v),
  getAutostart: ()  => ipcRenderer.sendSync('get-autostart'),
  importPromptSpace: () => ipcRenderer.invoke('import-prompt-space'),

  appInfo: () => ipcRenderer.invoke('app-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  resolveLinkTitle: url => ipcRenderer.invoke('resolve-link-title', url),

  // 产品知识库 OKF + Memory（用户数据目录）
  knowledgeStatus: () => ipcRenderer.invoke('knowledge-status'),
  knowledgeReadConcept: (id) => ipcRenderer.invoke('knowledge-read-concept', id),
  knowledgeWriteConcept: (payload) => ipcRenderer.invoke('knowledge-write-concept', payload),
  openKnowledgeDir: () => ipcRenderer.send('open-knowledge-dir'),
  memoryStatus: () => ipcRenderer.invoke('memory-status'),
  memoryOverview: () => ipcRenderer.invoke('memory-overview'),
  memoryGlobalUpsert: payload => ipcRenderer.invoke('memory-global-upsert', payload || {}),
  memoryGlobalRemove: id => ipcRenderer.invoke('memory-global-remove', id),
  memoryConsolidate: () => ipcRenderer.invoke('memory-consolidate'),
  memoryInsights: payload => ipcRenderer.invoke('memory-insights', payload || {}),
  memorySetLearning: enabled => ipcRenderer.invoke('memory-set-learning', enabled === true),
  memoryReviewPattern: payload => ipcRenderer.invoke('memory-review-pattern', payload || {}),
  memoryClear: () => ipcRenderer.invoke('memory-clear'),
  openMemoryDir: () => ipcRenderer.send('open-memory-dir'),
  initMemory: cb => ipcRenderer.on('init-memory', (_e, items) => cb(items)),

  // 日志中心
  log: payload => ipcRenderer.send('app-log', payload || {}),
  logsQuery: opts => ipcRenderer.invoke('logs-query', opts || {}),
  logsCounts: date => ipcRenderer.invoke('logs-counts', date || ''),
  logsClear: date => ipcRenderer.invoke('logs-clear', date || ''),
  openLogsWindow: () => ipcRenderer.send('open-logs-window'),
  openLogsDir: () => ipcRenderer.send('open-logs-dir'),
  listSkills: () => ipcRenderer.invoke('list-skills'),
  createSkill: (payload) => ipcRenderer.invoke('create-skill', payload || {}),

  workspaceInit: () => ipcRenderer.invoke('workspace-init'),
  buildFinalPrompt: (payload) => ipcRenderer.invoke('build-final-prompt', payload || {}),
  getWorkspaceState: () => ipcRenderer.invoke('get-workspace-state'),
  saveWorkspaceState: (state) => ipcRenderer.send('save-workspace-state', state),
  onWorkspaceRefresh: cb => {
    const fn = () => cb()
    ipcRenderer.on('workspace-refresh', fn)
    return () => ipcRenderer.removeListener('workspace-refresh', fn)
  },
  onWorkspaceOpenSettings: cb => {
    const fn = (_e, tab) => cb(tab || '')
    ipcRenderer.on('workspace-open-settings', fn)
    return () => ipcRenderer.removeListener('workspace-open-settings', fn)
  },

  // 内容源：本地文件夹 / GitLab
  sourcesList: () => ipcRenderer.invoke('sources-list'),
  sourcesSetActive: id => ipcRenderer.invoke('sources-set-active', id),
  sourcesAddLocal: () => ipcRenderer.invoke('sources-add-local'),
  sourcesAddGitlab: payload => ipcRenderer.invoke('sources-add-gitlab', payload || {}),
  sourcesAddGithub: payload => ipcRenderer.invoke('sources-add-github', payload || {}),
  sourcesAddWeb: payload => ipcRenderer.invoke('sources-add-web', payload || {}),
  sourcesRemove: id => ipcRenderer.invoke('sources-remove', id),
  sourcesSync: id => ipcRenderer.invoke('sources-sync', id),
  sourcesTree: sourceId => ipcRenderer.invoke('sources-tree', sourceId),
  sourcesTreeChildren: payload => ipcRenderer.invoke('sources-tree-children', payload || {}),
  sourcesReadFile: payload => ipcRenderer.invoke('sources-read-file', payload || {}),
  sourcesWriteFile: payload => ipcRenderer.invoke('sources-write-file', payload || {}),
  sourcesOpenRoot: id => ipcRenderer.invoke('sources-open-root', id),

  // Capability Hub（flat fallback，knowme.* 为主入口）
  capabilityList: opts => ipcRenderer.invoke('capability-list', opts),
  capabilityFavoriteList: () => ipcRenderer.invoke('capability-favorite-list'),
  capabilityFavoriteToggle: payload => ipcRenderer.invoke('capability-favorite-toggle', payload),
  capabilityInstall: payload => ipcRenderer.invoke('capability-install', payload),
  capabilityInstallPrecheck: payload => ipcRenderer.invoke('capability-install-precheck', payload),
  capabilityUninstall: payload => ipcRenderer.invoke('capability-uninstall', payload),
  capabilityEnable: payload => ipcRenderer.invoke('capability-enable', payload),
  capabilityDisable: payload => ipcRenderer.invoke('capability-disable', payload),
  capabilityUpdate: payload => ipcRenderer.invoke('capability-update', payload),
  capabilityImport: payload => ipcRenderer.invoke('capability-import', payload),
  capabilityImportPrecheck: payload => ipcRenderer.invoke('capability-import-precheck', payload),
  capabilityPickLocalFolder: () => ipcRenderer.invoke('capability-pick-local-folder'),
  capabilityPickZipFile: () => ipcRenderer.invoke('capability-pick-zip-file'),
  capabilityPickCursorRepository: () => ipcRenderer.invoke('capability-pick-cursor-repository'),
  capabilityScanCursorRepository: payload => ipcRenderer.invoke('capability-scan-cursor-repository', payload),
  capabilityImportCursorRepository: payload => ipcRenderer.invoke('capability-import-cursor-repository', payload),
  skillList: () => ipcRenderer.invoke('skill-list'),
  skillLoad: payload => ipcRenderer.invoke('skill-load', payload),
  skillReadResource: payload => ipcRenderer.invoke('skill-read-resource', payload),
  skillRunScript: payload => ipcRenderer.invoke('skill-run-script', payload),
  skillMigrateLegacy: payload => ipcRenderer.invoke('skill-migrate-legacy', payload),
  skillTaskList: () => ipcRenderer.invoke('skill-task-list'),
  expertList: () => ipcRenderer.invoke('expert-list'),
  expertGet: expertId => ipcRenderer.invoke('expert-get', expertId),
  expertSave: payload => ipcRenderer.invoke('expert-save', payload),
  expertDelete: payload => ipcRenderer.invoke('expert-delete', payload),
  expertTryChat: payload => ipcRenderer.invoke('expert-try-chat', payload),
  expertSnapshot: payload => ipcRenderer.invoke('expert-snapshot', payload),
  connectorHealth: payload => ipcRenderer.invoke('connector-health', payload),
  connectorToolsPreview: payload => ipcRenderer.invoke('connector-tools-preview', payload),
  connectorSaveAllowlist: payload => ipcRenderer.invoke('connector-save-allowlist', payload),
  attentionNotify: payload => ipcRenderer.invoke('attention-notify', payload || {}),
  attentionFocusState: () => ipcRenderer.invoke('attention-focus-state'),
  attentionToastDismiss: () => ipcRenderer.invoke('attention-toast-dismiss'),
  attentionToastActivate: () => ipcRenderer.send('attention-toast-activate'),
  onAttentionToastInit: cb => {
    const fn = (_e, payload) => cb(payload)
    ipcRenderer.on('attention-toast-init', fn)
    return () => ipcRenderer.removeListener('attention-toast-init', fn)
  },
  onAttentionOpen: cb => {
    const fn = (_e, payload) => cb(payload)
    ipcRenderer.on('attention-open', fn)
    return () => ipcRenderer.removeListener('attention-open', fn)
  },
}
