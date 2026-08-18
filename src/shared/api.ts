export type { KnowledgeLintIssue, KnowledgeLintResult, KnowledgeReadResult } from './api-extended'
import type { KnowMeExtendedApi } from './api-extended'
import type {
  GroundingStatusDto,
  PackEmptyGroup,
  StructuredChoiceBar,
  AgentTraceItemDto,
} from './api-assistant'

export type {
  GroundingStatusDto,
  PackEmptyGroup,
  PackEmptyScene,
  StructuredChoiceBar,
  StructuredChoiceItem,
  AgentTraceItemDto,
} from './api-assistant'

/**
 * Typed KnowMe preload bridge. Keep in sync with src/preload.js.
 * Renderer MUST call only these methods — never ipcRenderer.
 */
export interface KnowMeApi extends KnowMeExtendedApi {
  workbenchLoad: () => Promise<WorkbenchLoadResult>
  workbenchModeList: () => Promise<WorkbenchModeListResult>
  workbenchModeSelect: (modeId: string) => Promise<WorkbenchModeListResult>
  workbenchAutomationList: () => Promise<WorkbenchAutomationListResult>
  workbenchWorkflowPackageSave: (payload: { package: Record<string, unknown> }) => Promise<WorkflowPackageSaveResult>
  workbenchTaskList: () => Promise<{ items?: WorkbenchTask[] }>
  workbenchTaskCreate: (input: Record<string, unknown>) => Promise<unknown>
  workbenchTaskGet: (id: string) => Promise<WorkbenchTask | null>
  workbenchTaskArchive: (id: string) => Promise<{ ok?: boolean; error?: string }>
  workbenchWorkflowPackageList: (filter?: Record<string, unknown>) => Promise<{
    items?: WorkflowItem[]
    packages?: Record<string, unknown>[]
  }>
  workbenchWorkflowPackageGet: (id: string) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageFork: (id: string, options?: Record<string, unknown>) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageArchive: (id: string) => Promise<{ ok?: boolean; error?: string }>
  workbenchDaemonTask: (slug: string) => Promise<unknown>
  workbenchDaemonOverview: () => Promise<unknown>
  workbenchDaemonProgress: (slug: string) => Promise<unknown>
  workbenchDaemonEvents: (slug: string, query?: Record<string, unknown>) => Promise<unknown>
  workbenchDaemonChanges: (slug: string) => Promise<unknown>
  workbenchDaemonWorkspaceTree?: (slug: string, relPath?: string) => Promise<unknown>
  workbenchDaemonWorkspaceBlob?: (slug: string, relPath?: string) => Promise<unknown>
  workbenchDaemonGate: (slug: string, payload: Record<string, unknown>) => Promise<unknown>
  workbenchDaemonClarify?: (slug: string, payload: Record<string, unknown>) => Promise<unknown>
  workbenchDaemonCancel: (slug: string, payload?: Record<string, unknown>) => Promise<unknown>
  workbenchLaunchStart: (payload: Record<string, unknown>) => Promise<unknown>
  workbenchPickFiles: (payload?: Record<string, unknown>) => Promise<{ ok?: boolean; canceled?: boolean; files?: { path: string; name: string }[]; error?: string }>
  appInfo: () => Promise<{ name?: string; version?: string; isPackaged?: boolean }>
  openSettings: (tab?: string) => void
  openSettingsWindow: (tab?: string) => void
  llmProfile: () => Promise<{ model?: string; provider?: string } | unknown>
  llmModels?: () => Promise<{ presets?: { id: string; label?: string; contextWindow?: number; supportsTools?: boolean }[]; groups?: { id: string; label?: string; models?: { id: string; label?: string; contextWindow?: number; supportsTools?: boolean }[] }[] }>
  llmSetModel?: (payload: { model?: string; provider?: string }) => Promise<{ ok?: boolean; error?: string }>
  llmProbe?: (payload?: {
    apiEndpoint?: string
    apiKey?: string
    model?: string
    llmProvider?: string
  }) => Promise<{ ok?: boolean; error?: string; latencyMs?: number; host?: string; model?: string }>
  agentSessionList: () => Promise<{ items?: AgentSession[]; sessions?: AgentSession[]; ui?: { openSessionIds?: string[]; activeSessionId?: string } }>
  agentSessionNew: (opts?: unknown) => Promise<AgentSession | { ok?: boolean; session?: AgentSession; ui?: unknown }>
  agentSessionGet: (id: string) => Promise<AgentSession | { ok?: boolean; session?: AgentSession } | null>
  agentSessionRename?: (id: string, title: string) => Promise<unknown>
  agentSessionPin?: (id: string, pinned: boolean) => Promise<unknown>
  agentSessionFork?: (id: string) => Promise<AgentSession | { ok?: boolean; session?: AgentSession }>
  agentSessionCloseTab?: (id: string) => Promise<{
    ok?: boolean
    ui?: { openSessionIds?: string[]; activeSessionId?: string }
    createdSessionId?: string | null
  }>
  agentSessionSetUi?: (patch: Record<string, unknown>) => Promise<unknown>
  agentSessionContextUpdate?: (sessionId: string, patch: Record<string, unknown>) => Promise<unknown>
  agentSessionTranscript?: (id: string) => Promise<{ items?: unknown[]; text?: string }>
  agentSessionSummary?: (id: string) => Promise<{ ok?: boolean; text?: string; error?: string }>
  /** 写入提案（如 editor_patch）；返回刷新后的 session */
  agentArtifactAdd?: (payload: {
    sessionId?: string
    artifact?: Partial<AgentRunArtifact>
  }) => Promise<{ ok?: boolean; error?: string; session?: AgentSession }>
  agentArtifactAccept?: (payload: {
    sessionId?: string
    artifactId?: string
  }) => Promise<{ ok?: boolean; error?: string; session?: AgentSession; editorPatch?: boolean; body?: string }>
  agentArtifactReject?: (payload: {
    sessionId?: string
    artifactId?: string
  }) => Promise<{ ok?: boolean; error?: string; session?: AgentSession }>
  agentApplyLog?: (payload: {
    sessionId?: string
    action?: string
    detail?: string
  }) => Promise<{ ok?: boolean }>
  copyToClipboard?: (text: string) => void
  aiGenerate: (payload: Record<string, unknown>) => Promise<AiGenerateResult>
  aiCancelRun: (runId: string) => Promise<unknown>
  onAiStreamChunk?: (cb: (chunk: AiStreamChunk) => void) => () => void
  onAiStreamEvent?: (cb: (event: AiStreamEvent) => void) => () => void
  knowledgeProviderList?: () => Promise<KnowledgeProviderListResult>
  knowledgeOsList: () => Promise<KnowledgeListResult>
  capabilityPackList: () => Promise<{ ok?: boolean; packs?: unknown[]; items?: unknown[] }>
  capabilityPackEmptyState?: () => Promise<{ ok?: boolean; groups?: PackEmptyGroup[] }>
  capabilityList?: (opts?: { kind?: CapabilityKind }) => Promise<CapabilityListResult>
  knowledgeSearch: (q: string) => Promise<KnowledgeSearchResult>
  sourcesList?: () => Promise<SourcesListResult>
  sourcesTree?: (sourceId?: string) => Promise<FileTreeApiResult>
  sourcesTreeChildren?: (payload: { sourceId?: string; path?: string }) => Promise<FileTreeApiResult>
  sourcesSetActive?: (id: string) => Promise<{ ok?: boolean; error?: string }>
}

export interface WorkflowItem {
  id: string
  name?: string
  description?: string
  source?: string
  goalTypes?: string[]
  inputs?: { label?: string }[]
  outputs?: { label?: string }[]
  provenance?: { domain?: string; kind?: string }
}

export interface WorkbenchLoadResult {
  workflows?: WorkflowItem[]
  workflowPackages?: WorkflowItem[]
  agents?: unknown[]
  daemon?: { online?: boolean; hint?: string }
  repoError?: string
}

export interface WorkbenchExecRef {
  kind?: 'session' | 'run' | 'daemon' | 'none' | string
  id?: string
}

export interface WorkbenchTask {
  id: string
  title?: string
  status?: string
  schedule?: unknown
  goal?: string
  resultSummary?: string
  expertId?: string
  expertName?: string
  workflowId?: string
  workflowName?: string
  execRef?: WorkbenchExecRef
  updatedAt?: string
  pinned?: boolean
}

export interface WorkbenchModeBinding {
  expertId?: string
  name?: string
  status?: string
}

export interface WorkbenchMode {
  id: string
  name?: string
  label?: string
  description?: string
  bindings?: WorkbenchModeBinding[]
}

export interface WorkbenchModeListResult {
  ok?: boolean
  activeModeId?: string
  modes?: WorkbenchMode[]
  error?: string
}

export interface FeishuTargetItem {
  id: string
  name?: string
}

export interface AutomationPushTargets {
  miniApp?: boolean
  bot?: boolean
  userTargets?: FeishuTargetItem[]
  groupTargets?: FeishuTargetItem[]
}

export interface WorkbenchAutomationJob {
  id: string
  name?: string
  prompt?: string
  scheduleLabel?: string
  workflowId?: string
  domain?: string
  backend?: string
  workspaceId?: string
  connectorId?: string
  permissionMode?: string
  schedule?: {
    type?: 'daily' | 'interval' | 'once' | 'cron'
    dailyTime?: string
    intervalValue?: number
    intervalUnit?: 'hour' | 'day'
    onceAt?: string
    cronExpr?: string
  }
  dateRange?: { start?: string; end?: string }
  pushTargets?: AutomationPushTargets
  enabled?: boolean
  lastStatus?: string
}

export interface FeishuTargetsResult {
  ok?: boolean
  error?: string
  mode?: 'user' | 'chat'
  items?: FeishuTargetItem[]
}

export interface AttentionPayload {
  id: string
  kind?: string
  title?: string
  body?: string
  urgency?: 'info' | 'input'
  source?: string
  deepLink?: { type?: string; slug?: string; runId?: string } | null
}

export interface FabricGraphSnapshot {
  ok?: boolean
  error?: string
  nodeCount?: number
  edgeCount?: number
  anchorCount?: number
  staleAnchors?: number
}
export interface StewardTaskSummary {
  id: string
  status?: string
  title?: string
}

export interface WorkbenchAutomationTemplate {
  id: string
  title?: string
  description?: string
  prompt?: string
}

export interface WorkbenchAutomationListResult {
  ok?: boolean
  jobs?: WorkbenchAutomationJob[]
  templates?: WorkbenchAutomationTemplate[]
  error?: string
}

export interface WorkflowPackageSaveResult {
  ok?: boolean
  package?: {
    id: string
    name?: string
    graph?: Record<string, unknown>
    version?: string
  }
  error?: string
}

export interface AgentRunArtifact {
  id: string
  type?: string
  title?: string
  body?: string
  status?: string
  targetPath?: string
  meta?: { mode?: string; noteId?: string; sourceId?: string; path?: string }
}

export interface AgentSession {
  id: string
  title?: string
  displayTitle?: string
  pinned?: boolean
  agentId?: string
  expertId?: string
  knowledgeRefs?: string[]
  taskRef?: { id?: string; kind?: string } | null
  run?: {
    goal?: string
    artifacts?: AgentRunArtifact[]
  } | null
  /** 最近更新；历史列表按此排序，缺省时不展示相对时间 */
  updatedAt?: string
}

export interface AgentFileRef {
  id: string
  title?: string
  preview?: string
  project?: string
  updatedAt?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
  streaming?: boolean
  thinking?: boolean
  activity?: string
  startedAt?: number
  elapsedMs?: number
  /** 从 startedAt 到正文首字的毫秒；未出字前不写。 */
  firstTokenMs?: number
  trace?: AgentTraceItemDto[]
  attachmentName?: string
  groundingStatus?: GroundingStatusDto
  structuredUi?: StructuredChoiceBar[]
  suggestionChosenIndex?: number
  protocolVersion?: number
  runId?: string
  v2AnswerCommitted?: boolean
  messageState?: unknown
  plan?: {
    version?: number
    updatedAt?: string
    remaining?: number
    items?: { id?: string; title?: string; status?: string; evidence?: string }[]
  }
}

export interface AiStreamChunk {
  text?: string
  sessionId?: string
  runId?: string
}

export interface AiGenerateResult {
  text?: string
  error?: string
  streamed?: boolean
  cancelled?: boolean
  sessionId?: string
  runId?: string
}

export type CapabilityKind = 'expert' | 'skill' | 'connector'

export interface CapabilityItem {
  id: string
  kind: CapabilityKind
  name?: string
  description?: string
  category?: string
  status?: string
  enabled?: boolean
  installed?: boolean
}

export interface CapabilityListResult {
  ok?: boolean
  items?: CapabilityItem[]
  error?: string
}

export interface KnowledgeEntry {
  kind?: 'wiki' | 'okf'
  path: string
  title?: string
  editable?: boolean
}

export interface KnowledgeListResult {
  ok?: boolean
  error?: string
  wiki?: KnowledgeEntry[]
  okf?: KnowledgeEntry[]
  wikiRoot?: string
}

export interface KnowledgeProviderItem {
  id: string
  displayName?: string
  name?: string
  kind?: string
}

export interface KnowledgeProviderListResult {
  ok?: boolean
  error?: string
  providers?: KnowledgeProviderItem[]
  activeProviderId?: string | null
}

/** 上下文分区 token 占用（stage_prepare / 流式 contextInfo.sectionUsage） */
export interface AgentContextSectionUsage {
  /** 分区键：conversation / knowledge / tools / grounding 等 */
  key: string
  /** 该分区估算或实测 token 数 */
  usedTokens?: number
}

/** 单次 run 的上下文窗口占用快照（IPC / 流式 stage_prepare 下发） */
export interface AgentContextInfo {
  /** 主进程聚合已用 token；有值时 UI 标「会话用量」 */
  usedTokens?: number
  /** 当前模型上下文窗口上限 */
  contextWindow?: number
  /** 按轮压缩时已省略的对话轮数 */
  omittedTurns?: number
  /** 按轮压缩时已省略的消息条数 */
  omittedMessages?: number
  /** 各分区 token 占用明细 */
  sectionUsage?: AgentContextSectionUsage[]
  /** 因预算未纳入的分区键列表 */
  sectionOmitted?: string[]
}

export interface AiStreamEvent {
  runId?: string
  sessionId?: string
  type?: string
  title?: string
  summary?: string
  status?: string
  id?: string
  payload?: Record<string, unknown>
  contextInfo?: AgentContextInfo
}

export interface KnowledgeHit {
  title?: string
  path?: string
  snippet?: string
  score?: number
}

export interface KnowledgeSearchResult {
  ok?: boolean
  hits?: KnowledgeHit[]
  message?: string | null
  error?: string
}

export interface ContentSourceRef {
  id: string
  type: string
  displayName?: string
  rootPath?: string
  branch?: string
}

export interface SourcesListResult {
  sources?: ContentSourceRef[]
  activeSourceId?: string | null
  gitAvailable?: boolean
}

export interface FileTreeApiNode {
  type: 'dir' | 'file'
  name: string
  path: string
  depth?: number
}

export interface FileTreeApiResult {
  ok?: boolean
  error?: string
  nodes?: FileTreeApiNode[]
  truncated?: boolean
  lazy?: boolean
}

declare global {
  interface Window {
    api?: KnowMeApi
  }
}

export {}
