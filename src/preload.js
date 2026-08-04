const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 卡片生命周期
  initNote:        cb => ipcRenderer.on('init-note',        (_e, n) => cb(n)),
  pinChanged:      cb => ipcRenderer.on('pin-changed',      (_e, v) => cb(v)),
  favoriteChanged: cb => ipcRenderer.on('favorite-changed', (_e, v) => cb(v)),
  onCopy:          cb => ipcRenderer.on('cmd-copy',         () => cb()),
  onDelete:        cb => ipcRenderer.on('cmd-delete',       () => cb()),

  updateNote:     d  => ipcRenderer.send('note-update',          d),
  deleteNote:     id => ipcRenderer.send('note-delete',          id),
  toggleFavorite: id => ipcRenderer.send('note-toggle-favorite', id),
  incrementCopy:  id => ipcRenderer.send('note-increment-copy',  id),
  setAiMode:      (id, aiOpen) => ipcRenderer.invoke('note-set-ai-mode', id, !!aiOpen),
  onLayoutChanged: cb => ipcRenderer.on('layout-changed', (_e, s) => cb(s)),
  newNote:        ()  => ipcRenderer.send('new-note'),
  newVersion:     id => ipcRenderer.send('new-version',          id),
  duplicateNote:  id => ipcRenderer.send('duplicate-note',       id),

  // 操作
  copyToClipboard: text => ipcRenderer.send('copy-to-clipboard', text),
  showContextMenu: id   => ipcRenderer.send('show-context-menu', id),

  // AI
  aiGenerate: p => ipcRenderer.invoke('ai-generate', p),
  aiCancelRun: runId => ipcRenderer.invoke('ai-cancel-run', String(runId || '')),
  llmProfile: () => ipcRenderer.invoke('llm-profile'),
  llmModels: () => ipcRenderer.invoke('llm-models'),
  llmSetModel: p => ipcRenderer.invoke('llm-set-model', p),
  agentSessionList: () => ipcRenderer.invoke('agent-session-list'),
  agentSessionGet: id => ipcRenderer.invoke('agent-session-get', id),
  agentSessionNew: agentIdOrOpts => ipcRenderer.invoke('agent-session-new', agentIdOrOpts),
  agentSessionSetUi: patch => ipcRenderer.invoke('agent-session-set-ui', patch),
  agentSessionRename: (id, title) => ipcRenderer.invoke('agent-session-rename', id, title),
  agentSessionFork: id => ipcRenderer.invoke('agent-session-fork', id),
  agentSessionSummary: id => ipcRenderer.invoke('agent-session-summary', id),
  agentSessionTranscript: id => ipcRenderer.invoke('agent-session-transcript', id),
  agentSessionPin: (id, pinned) => ipcRenderer.invoke('agent-session-pin', id, pinned),
  agentSessionCloseTab: id => ipcRenderer.invoke('agent-session-close-tab', id),
  agentRunUpdate: payload => ipcRenderer.invoke('agent-run-update', payload || {}),
  agentArtifactAdd: payload => ipcRenderer.invoke('agent-artifact-add', payload || {}),
  agentArtifactAccept: payload => ipcRenderer.invoke('agent-artifact-accept', payload || {}),
  agentArtifactReject: payload => ipcRenderer.invoke('agent-artifact-reject', payload || {}),
  agentApplyLog: payload => ipcRenderer.invoke('agent-apply-log', payload || {}),
  knowledgeOsList: () => ipcRenderer.invoke('knowledge-os-list'),
  knowledgeOsRefresh: () => ipcRenderer.invoke('knowledge-os-refresh'),
  obsidianStatus: () => ipcRenderer.invoke('obsidian-status'),
  obsidianInstall: () => ipcRenderer.invoke('obsidian-install'),
  obsidianBridgeInstall: () => ipcRenderer.invoke('obsidian-bridge-install'),
  obsidianOpen: () => ipcRenderer.invoke('obsidian-open'),
  knowledgeOsQuery: q => ipcRenderer.invoke('knowledge-os-query', q),
  knowledgeOsIngest: payload => ipcRenderer.invoke('knowledge-os-ingest', payload || {}),
  knowledgeOsLint: () => ipcRenderer.invoke('knowledge-os-lint'),
  knowledgeOsPromote: payload => ipcRenderer.invoke('knowledge-os-promote', payload || {}),
  knowledgeOsRead: payload => ipcRenderer.invoke('knowledge-os-read', payload || {}),
  knowledgeOsConfig: patch => ipcRenderer.invoke('knowledge-os-config', patch),
  knowledgeOsStewardLint: sessionId => ipcRenderer.invoke('knowledge-os-steward-lint', sessionId),
  // 知识库 Provider：本地 / 远程 RAG
  knowledgeProviderList: () => ipcRenderer.invoke('knowledge-provider-list'),
  knowledgeProviderSave: payload => ipcRenderer.invoke('knowledge-provider-save', payload || {}),
  knowledgeProviderRemove: id => ipcRenderer.invoke('knowledge-provider-remove', id),
  knowledgeProviderSetActive: id => ipcRenderer.invoke('knowledge-provider-set-active', id),
  knowledgeProviderQuery: q => ipcRenderer.invoke('knowledge-provider-query', q),
  connectorsList: () => ipcRenderer.invoke('connectors-list'),
  connectorsStatus: id => ipcRenderer.invoke('connectors-status', id),
  connectorsFeishuAuthStart: options =>
    ipcRenderer.invoke('connectors-feishu-auth-start', {
      force: Boolean(options?.force),
      full: Boolean(options?.full),
      scopes: Array.isArray(options?.scopes) ? options.scopes : [],
    }),
  connectorsUpsert: patch => ipcRenderer.invoke('connectors-upsert', patch || {}),
  connectorsSetAllowlist: (id, allowlist) =>
    ipcRenderer.invoke('connectors-set-allowlist', id, allowlist),
  connectorsDrafts: () => ipcRenderer.invoke('connectors-drafts'),
  connectorsCreateDocDraft: payload =>
    ipcRenderer.invoke('connectors-create-doc-draft', payload || {}),
  connectorsApproveDraft: payload =>
    ipcRenderer.invoke('connectors-approve-draft', payload || {}),

  // Workbench：AgentTeams 编排入口
  workbenchLoad: () => ipcRenderer.invoke('workbench-load'),
  workbenchWorkflow: payload => ipcRenderer.invoke('workbench-workflow', payload || {}),
  workbenchDispatch: payload => ipcRenderer.invoke('workbench-dispatch', payload || {}),
  workbenchDaemonStart: payload => ipcRenderer.invoke('workbench-daemon-start', payload || {}),
  workbenchDaemonTask: slug => ipcRenderer.invoke('workbench-daemon-task', slug),
  workbenchDaemonArtifacts: slug => ipcRenderer.invoke('workbench-daemon-artifacts', slug),
  workbenchDaemonLaunchContext: workflowId => ipcRenderer.invoke('workbench-daemon-launch-context', workflowId),
  workbenchDaemonArtifactOpen: filePath => ipcRenderer.invoke('workbench-daemon-artifact-open', filePath),
  workbenchDaemonGate: (slug, payload) => ipcRenderer.invoke('workbench-daemon-gate', slug, payload || {}),
  workbenchDaemonClarify: (slug, payload) => ipcRenderer.invoke('workbench-daemon-clarify', slug, payload || {}),
  workbenchAuthStatus: () => ipcRenderer.invoke('workbench-auth-status'),
  workbenchAuthLogin: payload => ipcRenderer.invoke('workbench-auth-login', payload || {}),
  workbenchAuthLogout: () => ipcRenderer.invoke('workbench-auth-logout'),
  workbenchBootstrapStatus: () => ipcRenderer.invoke('workbench-bootstrap-status'),
  workbenchBootstrapRun: payload => ipcRenderer.invoke('workbench-bootstrap-run', payload || {}),
  workbenchDaemonOverview: () => ipcRenderer.invoke('workbench-daemon-overview'),
  gameStudioScenes: () => ipcRenderer.invoke('game-studio-scenes'),
  gameRequirementBuild: payload => ipcRenderer.invoke('game-requirement-build', payload || {}),
  gameRequirementApprove: payload => ipcRenderer.invoke('game-requirement-approve', payload || {}),
  gameWorkbenchHandoff: payload => ipcRenderer.invoke('game-workbench-handoff', payload || {}),
  onWorkbenchAuthChanged: cb => {
    const fn = (_e, auth) => cb(auth)
    ipcRenderer.on('workbench-auth-changed', fn)
    return () => ipcRenderer.removeListener('workbench-auth-changed', fn)
  },
  workbenchTodoList: () => ipcRenderer.invoke('workbench-todo-list'),
  workbenchTodoAdd: text => ipcRenderer.invoke('workbench-todo-add', text),
  workbenchTodoToggle: id => ipcRenderer.invoke('workbench-todo-toggle', id),
  workbenchTodoRemove: id => ipcRenderer.invoke('workbench-todo-remove', id),
  workbenchTodoClearDone: () => ipcRenderer.invoke('workbench-todo-clear-done'),
  workbenchTodoImportLegacy: items => ipcRenderer.invoke('workbench-todo-import-legacy', items || []),
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
  onSelectSettingsTab: cb => ipcRenderer.on('select-settings-tab', (_e, tab) => cb(tab)),

  // 总览列表
  initList:  cb => ipcRenderer.on('init-list', (_e, notes) => cb(notes)),
  onListHighlight: cb => {
    const fn = (_e, id) => cb(id)
    ipcRenderer.on('list-highlight', fn)
    return () => ipcRenderer.removeListener('list-highlight', fn)
  },
  showListContextMenu: opts => ipcRenderer.send('show-list-context-menu', opts),
  onListOpenGroup: cb => {
    const fn = (_e, groupKey) => cb(groupKey)
    ipcRenderer.on('list-open-group', fn)
    return () => ipcRenderer.removeListener('list-open-group', fn)
  },

  // 系统设置
  openDataDir:  ()  => ipcRenderer.send('open-data-dir'),
  openPromptSpace: () => ipcRenderer.send('open-prompt-space'),
  setAutostart: v   => ipcRenderer.send('set-autostart', v),
  getAutostart: ()  => ipcRenderer.sendSync('get-autostart'),
  importPromptSpace: () => ipcRenderer.invoke('import-prompt-space'),

  notesExport: () => ipcRenderer.invoke('notes-export'),
  notesImport: () => ipcRenderer.invoke('notes-import'),
  appInfo: () => ipcRenderer.invoke('app-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternal: url => ipcRenderer.invoke('open-external', url),

  // 产品知识库 OKF + Memory（用户数据目录）
  knowledgeStatus: () => ipcRenderer.invoke('knowledge-status'),
  knowledgeReadConcept: (id) => ipcRenderer.invoke('knowledge-read-concept', id),
  knowledgeWriteConcept: (payload) => ipcRenderer.invoke('knowledge-write-concept', payload),
  openKnowledgeDir: () => ipcRenderer.send('open-knowledge-dir'),
  memoryStatus: () => ipcRenderer.invoke('memory-status'),
  memoryOverview: () => ipcRenderer.invoke('memory-overview'),
  memoryConsolidate: () => ipcRenderer.invoke('memory-consolidate'),
  memoryInsights: payload => ipcRenderer.invoke('memory-insights', payload || {}),
  memorySetLearning: enabled => ipcRenderer.invoke('memory-set-learning', enabled === true),
  memoryReviewPattern: payload => ipcRenderer.invoke('memory-review-pattern', payload || {}),
  memoryClear: () => ipcRenderer.invoke('memory-clear'),
  openMemoryDir: () => ipcRenderer.send('open-memory-dir'),

  // 日志中心
  log: payload => ipcRenderer.send('app-log', payload || {}),
  logsQuery: opts => ipcRenderer.invoke('logs-query', opts || {}),
  logsCounts: date => ipcRenderer.invoke('logs-counts', date || ''),
  logsClear: date => ipcRenderer.invoke('logs-clear', date || ''),
  openLogsWindow: () => ipcRenderer.send('open-logs-window'),
  openLogsDir: () => ipcRenderer.send('open-logs-dir'),
  listSkills: () => ipcRenderer.invoke('list-skills'),
  createSkill: (payload) => ipcRenderer.invoke('create-skill', payload || {}),

  // 工作台（单窗口文件编辑器）
  getNote: id => ipcRenderer.invoke('get-note', id),
  workspaceInit: () => ipcRenderer.invoke('workspace-init'),
  workspaceNewNote: (payload) => ipcRenderer.invoke('workspace-new-note', payload || {}),
  workspaceNewVersion: id => ipcRenderer.invoke('workspace-new-version', id),
  workspaceDeleteNote: id => ipcRenderer.invoke('workspace-delete-note', id),
  workspaceDuplicateNote: id => ipcRenderer.invoke('workspace-duplicate-note', id),
  buildFinalPrompt: (payload) => ipcRenderer.invoke('build-final-prompt', payload || {}),
  getWorkspaceState: () => ipcRenderer.invoke('get-workspace-state'),
  saveWorkspaceState: (state) => ipcRenderer.send('save-workspace-state', state),
  onWorkspaceRefresh: cb => {
    const fn = () => cb()
    ipcRenderer.on('workspace-refresh', fn)
    return () => ipcRenderer.removeListener('workspace-refresh', fn)
  },
  onWorkspaceOpenNote: cb => {
    const fn = (_e, id) => cb(id)
    ipcRenderer.on('workspace-open-note', fn)
    return () => ipcRenderer.removeListener('workspace-open-note', fn)
  },
  onWorkspaceOpenSettings: cb => {
    const fn = (_e, tab) => cb(tab || '')
    ipcRenderer.on('workspace-open-settings', fn)
    return () => ipcRenderer.removeListener('workspace-open-settings', fn)
  },

  getNoteVersions: id => ipcRenderer.invoke('get-note-versions', id),
  getNoteDiff: (a, b) => ipcRenderer.invoke('get-note-diff', a, b),

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
  capabilityInstall: payload => ipcRenderer.invoke('capability-install', payload),
  capabilityUninstall: payload => ipcRenderer.invoke('capability-uninstall', payload),
  capabilityEnable: payload => ipcRenderer.invoke('capability-enable', payload),
  capabilityDisable: payload => ipcRenderer.invoke('capability-disable', payload),
  capabilityUpdate: payload => ipcRenderer.invoke('capability-update', payload),
  capabilityImport: payload => ipcRenderer.invoke('capability-import', payload),
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
  expertList: () => ipcRenderer.invoke('expert-list'),
  expertGet: expertId => ipcRenderer.invoke('expert-get', expertId),
  expertSave: payload => ipcRenderer.invoke('expert-save', payload),
  expertTryChat: payload => ipcRenderer.invoke('expert-try-chat', payload),
  expertSnapshot: payload => ipcRenderer.invoke('expert-snapshot', payload),
  connectorHealth: payload => ipcRenderer.invoke('connector-health', payload),
  connectorToolsPreview: payload => ipcRenderer.invoke('connector-tools-preview', payload),
  connectorSaveAllowlist: payload => ipcRenderer.invoke('connector-save-allowlist', payload),
})

const capInvoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args)

contextBridge.exposeInMainWorld('knowme', {
  capability: {
    list: opts => capInvoke('capability-list', opts),
    install: payload => capInvoke('capability-install', payload),
    uninstall: payload => capInvoke('capability-uninstall', payload),
    enable: payload => capInvoke('capability-enable', payload),
    disable: payload => capInvoke('capability-disable', payload),
    update: payload => capInvoke('capability-update', payload),
    import: payload => capInvoke('capability-import', payload),
    pickLocalFolder: () => capInvoke('capability-pick-local-folder'),
    pickZipFile: () => capInvoke('capability-pick-zip-file'),
    pickCursorRepository: () => capInvoke('capability-pick-cursor-repository'),
    scanCursorRepository: payload => capInvoke('capability-scan-cursor-repository', payload),
    importCursorRepository: payload => capInvoke('capability-import-cursor-repository', payload),
  },
  skill: {
    list: () => capInvoke('skill-list'),
    load: payload => capInvoke('skill-load', payload),
    readResource: payload => capInvoke('skill-read-resource', payload),
    runScript: payload => capInvoke('skill-run-script', payload),
    migrateLegacy: payload => capInvoke('skill-migrate-legacy', payload),
  },
  expert: {
    list: () => capInvoke('expert-list'),
    get: expertId => capInvoke('expert-get', expertId),
    save: payload => capInvoke('expert-save', payload),
    tryChat: payload => capInvoke('expert-try-chat', payload),
    snapshot: payload => capInvoke('expert-snapshot', payload),
  },
  connector: {
    health: payload => capInvoke('connector-health', payload),
    toolsPreview: payload => capInvoke('connector-tools-preview', payload),
    saveAllowlist: payload => capInvoke('connector-save-allowlist', payload),
  },
})
