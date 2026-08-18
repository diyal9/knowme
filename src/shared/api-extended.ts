/** Extended preload APIs for secondary windows (settings / memory / logs). */
import type {
  AttentionPayload,
  ContentSourceRef,
  FabricGraphSnapshot,
  FeishuTargetsResult,
  StewardTaskSummary,
} from './api'

export interface MemoryRecord {
  kind?: string
  summary?: string
  ts?: string
  meta?: Record<string, unknown>
}

export interface MemoryPattern {
  id: string
  summary?: string
  prompt_state?: string
  count?: number
}

export interface MemoryConsolidatedPreview {
  id?: string
  field?: string
  fieldLabel?: string
  text?: string
}

export interface MemoryOverview {
  ok?: boolean
  config?: { learningEnabled?: boolean }
  recent?: MemoryRecord[]
  patterns?: MemoryPattern[]
  consolidated?: {
    updatedAt?: string | null
    total?: number
    preview?: MemoryConsolidatedPreview[]
  }
  stats?: {
    recentCount?: number
    pendingCount?: number
    acceptedCount?: number
    consolidatedCount?: number
  }
}

export interface SettingsForm {
  apiEndpoint?: string
  apiKey?: string
  apiKeyConfigured?: boolean
  model?: string
  llmProvider?: string
  temperature?: number
  userProfile?: string
  userPrompt?: string
  industry?: string
  assistantModeConfig?: Record<string, string>
  gitlabHost?: string
  gitlabToken?: string
  gitlabTokenConfigured?: boolean
  githubToken?: string
  promptCacheControl?: boolean
  semanticRerank?: boolean
  embeddingModel?: string
  remoteConfig?: {
    enabled?: boolean
    endpoint?: string
    lastOk?: boolean
    lastError?: string
    updatedAt?: string
    fetchedAt?: string
  }
  orgManaged?: boolean
  workbenchAuth?: {
    endpoint?: string
    tenantId?: string
    tier?: string
    user?: string
    configuredAt?: string
  }
  workbenchInstall?: {
    path?: string
    lastBootstrapAt?: string
    lastBootstrapOk?: boolean
  }
}

export interface LogEntry {
  ts?: string
  level?: string
  category?: string
  event?: string
  msg?: string
  message?: string
  durationMs?: number
  runId?: string
  scope?: string
  meta?: Record<string, unknown>
}

export interface LogsQueryResult {
  ok?: boolean
  error?: string
  entries?: LogEntry[]
  date?: string
}

export interface LogsCountsResult {
  ok?: boolean
  counts?: Record<string, number>
}

export interface ConnectorRecord {
  id: string
  type?: string
  name?: string
  title?: string
  status?: string | ConnectorStatus
  enabled?: boolean
  allowlist?: string[]
  mcp?: { command?: string; args?: string[]; cwd?: string }
}

export interface FeishuPermissionPlan {
  mode?: string
  known?: boolean
  missingCategories?: { id: string; label?: string; state?: string }[]
  categories?: { id: string; label?: string; state?: string }[]
  scopes?: string[]
}

export interface FeishuPermissionSnapshot {
  known?: boolean
  complete?: boolean
  signature?: string
  categories?: { id: string; label?: string; state?: string }[]
}

export interface FeishuCapabilityReady {
  ready?: boolean
  missing?: string[]
}

export interface ConnectorStatus {
  ok?: boolean
  code?: string
  message?: string
  connected?: boolean
  verificationUrl?: string
  qrDataUrl?: string
  missing?: unknown[]
  state?: string
  userReady?: boolean
  botReady?: boolean
  enabled?: boolean
  connector?: ConnectorRecord & { status?: ConnectorStatus; enabled?: boolean }
  permissionPlan?: FeishuPermissionPlan
  permissions?: FeishuPermissionSnapshot
  capabilities?: {
    docsKb?: FeishuCapabilityReady
    officeCore?: FeishuCapabilityReady
    todayPriority?: FeishuCapabilityReady
  }
}

export interface KnowledgeReadResult {
  ok?: boolean
  error?: string
  path?: string
  kind?: string
  title?: string
  content?: string
}

export interface StewardProposal {
  id: string
  title?: string
  status?: string
  sourcePath?: string
  targetPath?: string
  confidence?: number
  rationale?: string
  proposedContent?: string
  body?: string
  taskId?: string
}

export interface KnowledgeLintIssue {
  type?: string
  path?: string
  message?: string
}

export interface KnowledgeLintResult {
  ok?: boolean
  error?: string
  issues?: KnowledgeLintIssue[]
}

export interface KnowMeExtendedApi {
  initSettings?: (cb: (settings: SettingsForm) => void) => void
  onSelectSettingsTab?: (cb: (tab: string) => void) => void
  onWorkspaceOpenSettings?: (cb: (tab: string) => void) => () => void
  saveSettings?: (settings: SettingsForm) => Promise<unknown>
  getSettings?: () => SettingsForm
  llmModels?: () => Promise<{ presets?: { id: string; label?: string }[] }>
  llmSetModel?: (payload: { model?: string; provider?: string }) => Promise<{ ok?: boolean; error?: string }>
  sourcesAddLocal?: () => Promise<{ ok?: boolean; error?: string }>
  sourcesAddGitlab?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  sourcesAddGithub?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  sourcesAddWeb?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  sourcesRemove?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  sourcesSync?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  sourcesList?: () => Promise<{ sources?: ContentSourceRef[]; activeSourceId?: string | null; gitAvailable?: boolean }>
  connectorsList?: () => Promise<{
    items?: ConnectorRecord[]
    connectors?: ConnectorRecord[]
  }>
  connectorsStatus?: (id: string) => Promise<ConnectorStatus>
  connectorsFeishuAuthStart?: (options?: Record<string, unknown>) => Promise<ConnectorStatus>
  connectorsUpsert?: (patch: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  connectorsSetAllowlist?: (id: string, allowlist: string[]) => Promise<{ ok?: boolean; error?: string }>
  workbenchAuthStatus?: () => Promise<{
    ok?: boolean
    auth?: {
      configured?: boolean
      endpoint?: string
      tenantId?: string
      state?: string
      user?: string
      message?: string
    }
  }>
  workbenchAuthLogin?: (payload: {
    endpoint?: string
    key?: string
    tenantId?: string
  }) => Promise<{ ok?: boolean; error?: string; auth?: Record<string, unknown> }>
  workbenchAuthLogout?: () => Promise<{ ok?: boolean }>
  workbenchBootstrapStatus?: () => Promise<{
    ok?: boolean
    status?: { message?: string; installPath?: string; ok?: boolean }
  }>
  workbenchBootstrapRun?: (payload: Record<string, unknown>) => Promise<{
    ok?: boolean
    message?: string
    error?: string
    installPath?: string
  }>
  copyToClipboard?: (text: string) => void
  knowledgeExport?: (opts?: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string; canceled?: boolean }>
  knowledgeImport?: () => Promise<{ ok?: boolean; error?: string; canceled?: boolean }>
  memoryStatus?: () => Promise<{ ok?: boolean; learning?: boolean; eventCount?: number; recentCount?: number }>
  memoryOverview?: () => Promise<MemoryOverview>
  memorySetLearning?: (enabled: boolean) => Promise<unknown>
  memoryConsolidate?: () => Promise<unknown>
  memoryReviewPattern?: (payload: { id: string; action: 'accepted' | 'dismissed' | 'pending'; summary?: string }) => Promise<{ ok?: boolean; error?: string }>
  memoryClear?: () => Promise<unknown>
  openKnowledgeDir?: () => void
  openMemoryDir?: () => void
  openDataDir?: () => void
  openExternal?: (url: string) => Promise<{ ok?: boolean; message?: string }>
  getAutostart?: () => boolean
  setAutostart?: (v: boolean) => void
  pullRemoteConfig?: () => Promise<{ ok?: boolean; error?: string; settings?: SettingsForm }>
  saveRemoteConfigPrefs?: (prefs: Record<string, unknown>) => Promise<unknown>
  initMemory?: (cb: (items: MemoryRecord[]) => void) => void
  logsQuery?: (opts: Record<string, unknown>) => Promise<LogsQueryResult>
  logsCounts?: (date?: string) => Promise<LogsCountsResult>
  logsClear?: (date?: string) => Promise<{ ok?: boolean }>
  openLogsWindow?: () => void
  openLogsDir?: () => void
  log?: (payload: Record<string, unknown>) => void
  sourcesReadFile?: (payload: { sourceId?: string; path?: string }) => Promise<{ ok?: boolean; content?: string; error?: string }>
  sourcesWriteFile?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  sourcesOpenRoot?: (id: string) => Promise<unknown>
  knowledgeOsRead?: (payload: { kind?: string; path?: string }) => Promise<KnowledgeReadResult>
  knowledgeOsLint?: () => Promise<KnowledgeLintResult>
  knowledgeOsRefresh?: () => Promise<{ ok?: boolean; scanned?: number; error?: string }>
  knowledgeAddMaterial?: (payload?: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  knowledgeOsIngest?: (payload?: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>
  knowledgeStewardTaskCreate?: (payload?: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string; task?: { id?: string }; proposals?: unknown[] }>
  knowledgeStewardTaskCancel?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  knowledgeStewardTaskRetry?: (id: string) => Promise<{ ok?: boolean; error?: string; proposals?: unknown[] }>
  knowledgeStewardProposalAccept?: (payload: { id: string; content?: string }) => Promise<{ ok?: boolean; error?: string }>
  knowledgeStewardProposalReject?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  knowledgeStewardProposalSnooze?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  knowledgeProviderSetActive?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  obsidianOpen?: () => Promise<{ ok?: boolean; error?: string }>
  capabilityPickLocalFolder?: () => Promise<{ ok?: boolean; path?: string }>
  capabilityPickZipFile?: () => Promise<{ ok?: boolean; path?: string }>
  capabilityPickCursorRepository?: () => Promise<{ ok?: boolean; path?: string }>
  capabilityInstallPrecheck?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityImportPrecheck?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityScanCursorRepository?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityImportCursorRepository?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityEnable?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityDisable?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityUninstall?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityFavoriteToggle?: (payload: { id: string; kind?: string }) => Promise<{ ok?: boolean; favorite?: boolean; error?: string }>
  workbenchModeBindExpert?: (payload: { expertId: string; modeId?: string }) => Promise<{ ok?: boolean; alreadyBound?: boolean; modeName?: string; error?: string }>
  workbenchModeUnbindExpert?: (payload: { expertId: string; modeId?: string }) => Promise<{ ok?: boolean; modeName?: string; error?: string }>
  workbenchAutomationCreate?: (payload: Record<string, unknown>) => Promise<unknown>
  workbenchAutomationUpdate?: (id: string, patch: Record<string, unknown>) => Promise<unknown>
  workbenchAutomationDelete?: (id: string) => Promise<unknown>
  workbenchAutomationToggle?: (id: string, enabled: boolean) => Promise<unknown>
  workbenchAutomationRunNow?: (id: string) => Promise<unknown>
  workbenchDaemonLogs?: (slug: string) => Promise<unknown>
  workbenchDaemonArtifacts?: (slug: string) => Promise<unknown>
  workbenchTaskArchive?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  workbenchWorkflowPackageGet?: (id: string) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageFork?: (id: string, options?: Record<string, unknown>) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageArchive?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  workbenchDaemonTask?: (slug: string) => Promise<unknown>
  workbenchDaemonProgress?: (slug: string) => Promise<unknown>
  workbenchDaemonEvents?: (slug: string, query?: Record<string, unknown>) => Promise<unknown>
  workbenchDaemonChanges?: (slug: string) => Promise<unknown>
  onWorkbenchDaemonLogEvent?: (cb: (event: unknown) => void) => () => void
  capabilityInstall?: (payload: Record<string, unknown>) => Promise<unknown>
  capabilityImport?: (payload: Record<string, unknown>) => Promise<unknown>
  expertGet?: (expertId: string) => Promise<unknown>
  expertSave?: (payload: Record<string, unknown>) => Promise<unknown>
  expertDelete?: (payload: Record<string, unknown>) => Promise<unknown>
  checkForUpdates?: () => Promise<unknown>
  attentionNotify?: (payload: AttentionPayload) => Promise<unknown>
  attentionFocusState?: () => Promise<unknown>
  onAttentionOpen?: (cb: (payload: AttentionPayload | null) => void) => () => void
  workbenchAutomationFeishuTargets?: (payload: Record<string, unknown>) => Promise<FeishuTargetsResult>
  fabricGraph?: () => Promise<FabricGraphSnapshot>
  fabricEngineStatus?: () => Promise<{ ok?: boolean; error?: string; seeded?: boolean }>
  knowledgeStewardTaskList?: () => Promise<{
    ok?: boolean
    items?: StewardTaskSummary[]
    tasks?: StewardTaskSummary[]
    proposals?: StewardProposal[]
    error?: string
  }>
}
