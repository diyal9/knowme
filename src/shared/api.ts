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
  personalAgentGet?: () => Promise<PersonalAgentResult>
  personalAgentSave?: (payload: Record<string, unknown>) => Promise<PersonalAgentResult>
  personalAgentTeach?: (payload: Record<string, unknown>) => Promise<PersonalAgentTeachResult>
  personalAgentApplyProposal?: (payload: Record<string, unknown>) => Promise<PersonalAgentResult>
  personalAgentGrowthList?: (payload?: { limit?: number }) => Promise<PersonalAgentGrowthResult>
  personalAgentRouteWork?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  personalAgentResultActions?: () => Promise<{ ok?: boolean; actions?: Array<{ id: string; label: string; confirmation: boolean }> }>
  workbenchLoad: () => Promise<WorkbenchLoadResult>
  workbenchModeList: () => Promise<WorkbenchModeListResult>
  workbenchModeSelect: (modeId: string) => Promise<WorkbenchModeListResult>
  workbenchAutomationList: () => Promise<WorkbenchAutomationListResult>
  workbenchWorkflowPackageSave: (payload: { package: Record<string, unknown> }) => Promise<WorkflowPackageSaveResult>
  workbenchTaskList: () => Promise<{ items?: WorkbenchTask[] }>
  workbenchTaskCreate: (input: Record<string, unknown>) => Promise<{ ok?: boolean; task?: WorkbenchTask; error?: string }>
  workbenchTaskUpdate: (id: string, patch: Record<string, unknown>) => Promise<{ ok?: boolean; task?: WorkbenchTask; error?: string }>
  workbenchTaskGet: (id: string) => Promise<WorkbenchTask | null>
  workbenchTaskArchive: (id: string) => Promise<{ ok?: boolean; error?: string }>
  expertTaskPreparePlanConfirmation?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; token?: string; expiresAt?: string; code?: string; error?: string }>
  expertTaskCreateStart?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; task?: WorkbenchTask; started?: boolean; error?: string }>
    expertTaskProvideInput?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; task?: WorkbenchTask; started?: boolean; queued?: boolean; error?: string }>
  expertTaskReviewDeliverable?: (payload: Record<string, unknown>) => Promise<{ ok?: boolean; task?: WorkbenchTask; error?: string }>
  expertTaskCancel?: (id: string) => Promise<{ ok?: boolean; task?: WorkbenchTask; error?: string }>
  expertTaskRetry?: (id: string) => Promise<{ ok?: boolean; task?: WorkbenchTask; started?: boolean; error?: string }>
  expertTaskGet?: (id: string) => Promise<{ ok?: boolean; task?: WorkbenchTask; error?: string }>
  expertTaskList?: () => Promise<{ ok?: boolean; tasks?: WorkbenchTask[]; error?: string }>
  workbenchWorkflowPackageList: (filter?: Record<string, unknown>) => Promise<{
    items?: WorkflowItem[]
    packages?: Record<string, unknown>[]
  }>
  workbenchWorkflowPackageGet: (id: string) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageFork: (id: string, options?: Record<string, unknown>) => Promise<{ ok?: boolean; package?: Record<string, unknown>; error?: string }>
  workbenchWorkflowPackageArchive: (id: string) => Promise<{ ok?: boolean; error?: string }>
  workflowActionCatalog?: () => Promise<{ ok?: boolean; actions?: Record<string, unknown>[]; error?: string }>
  workflowValidate?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowPublish?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunStart?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunGet?: (id: string) => Promise<Record<string, unknown>>
  workflowRunPause?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunResume?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunSubmitHuman?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunSubmitGate?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunIntervene?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunRerun?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunSubstitute?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workflowRunComment?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workbenchExternalWorkflowPreflight?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workbenchAgentGraphStart?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  workbenchAgentRunTree?: (rootRunId: string) => Promise<Record<string, unknown>>
  workbenchAgentRunDecision?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
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
  llmModels?: () => Promise<{ presets?: { id: string; label?: string; contextWindow?: number; supportsTools?: boolean; supportsVision?: boolean }[]; groups?: { id: string; label?: string; models?: { id: string; label?: string; contextWindow?: number; supportsTools?: boolean; supportsVision?: boolean }[] }[] }>
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
  agentSessionClearHistory?: () => Promise<{
    ok?: boolean
    error?: string
    session?: AgentSession
    ui?: { openSessionIds?: string[]; activeSessionId?: string }
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
  artifactPreviewResolve?: (source: string) => Promise<{ ok?: boolean; source?: string; error?: string }>
  aiGenerate: (payload: Record<string, unknown>) => Promise<AiGenerateResult>
  aiCancelRun: (runId: string) => Promise<unknown>
  onAiStreamChunk?: (cb: (chunk: AiStreamChunk) => void) => () => void
  onAiStreamEvent?: (cb: (event: AiStreamEvent) => void) => () => void
  knowledgeProviderList?: () => Promise<KnowledgeProviderListResult>
  knowledgeOsList: () => Promise<KnowledgeListResult>
  brainSnapshot?: (options?: { includeInactive?: boolean; includeResolved?: boolean }) => Promise<BrainSnapshot>
  brainNeighborhood?: (payload: { nodeId?: string; depth?: number; limit?: number; kinds?: BrainNodeKind[]; statuses?: BrainClaimStatus[] }) => Promise<BrainNeighborhood>
  brainQuery?: (request: BrainQueryRequest) => Promise<BrainQueryResult>
  brainNodeGet?: (id: string) => Promise<BrainNodeDetail>
  brainExplain?: (ref: string) => Promise<BrainExplainResult>
  brainPath?: (payload: { fromId: string; toId: string; maxDepth?: number }) => Promise<BrainPathResult>
  brainProposalList?: (options?: { includeResolved?: boolean }) => Promise<{ ok?: boolean; proposals?: BrainProposal[]; error?: string }>
  brainProposalCreate?: (payload: Partial<BrainProposal>) => Promise<{ ok?: boolean; proposal?: BrainProposal; error?: string }>
  brainObserve?: (payload: { text: string; sessionId?: string; taskId?: string; runId?: string; projectId?: string; agentId?: string; ephemeral?: boolean; allowLearning?: boolean; allowPromotionProposal?: boolean; sourceLabel?: string }) => Promise<{ ok?: boolean; skipped?: boolean; reason?: string; proposals?: BrainProposal[]; error?: string }>
  brainReferenceSave?: (payload: Partial<BrainEvidence> & { ref?: string; nodeId?: string; authority?: number; scope?: string }) => Promise<{ ok?: boolean; node?: BrainNode; evidence?: BrainEvidence; error?: string }>
  brainProposalConfirm?: (payload: { id: string; patch?: Record<string, unknown> }) => Promise<{ ok?: boolean; proposal?: BrainProposal; error?: string }>
  brainProposalReject?: (id: string) => Promise<{ ok?: boolean; proposal?: BrainProposal; error?: string }>
  brainProposalSnooze?: (id: string) => Promise<{ ok?: boolean; proposal?: BrainProposal; error?: string }>
  brainForget?: (id: string) => Promise<{ ok?: boolean; node?: BrainNode; error?: string }>
  brainRebuild?: () => Promise<BrainSnapshot>
  brainProviderSync?: (id: string) => Promise<{ ok?: boolean; provider?: KnowledgeProviderItem; collections?: KnowledgeCollection[]; error?: string }>
  brainLayoutSave?: (positions: Record<string, { x: number; y: number }>) => Promise<{ ok?: boolean; layout?: BrainSnapshot['layout']; error?: string }>
  brainGrowthList?: (options?: { limit?: number; targetType?: BrainProposal['targetType'] }) => Promise<BrainGrowthResult>
  brainGrowthUndo?: (id: string) => Promise<{ ok?: boolean; event?: BrainGrowthEvent; error?: string }>
  capabilityPackList: () => Promise<{ ok?: boolean; packs?: unknown[]; items?: unknown[] }>
  capabilityPackEmptyState?: () => Promise<{ ok?: boolean; groups?: PackEmptyGroup[] }>
  capabilityList?: (opts?: { kind?: CapabilityKind }) => Promise<CapabilityListResult>
  knowledgeSearch: (q: string) => Promise<KnowledgeSearchResult>
  projectsList?: () => Promise<ProjectsListResult>
  projectsSetActive?: (id: string) => Promise<ProjectsListResult>
  projectsUpdate?: (id: string, patch: Partial<ProjectRef>) => Promise<ProjectsListResult & { project?: ProjectRef }>
  projectsArchive?: (id: string, archived?: boolean) => Promise<ProjectsListResult>
  projectsDetach?: (id: string) => Promise<ProjectsListResult>
  projectsContext?: (id?: string) => Promise<ProjectContextResult>
  projectsOpenRoot?: (id: string) => Promise<{ ok?: boolean; error?: string }>
  projectsRelink?: (id: string) => Promise<ProjectsListResult & { canceled?: boolean }>
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
  graph?: Record<string, unknown>
  status?: string
  locked?: boolean
  executionBackends?: string[]
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

/**
 * Stable metadata shared by task activity producers and presentation surfaces.
 * Keep this additive: older task records may omit every field except summary/timestamps.
 */
export type WorkbenchActivitySource = 'user' | 'expert' | 'partner' | 'workflow' | 'system' | string
export type WorkbenchActivityKind = 'message' | 'event' | 'deliverable' | 'review' | string

export interface WorkbenchTaskEvent {
  id?: string
  type?: string
  kind?: WorkbenchActivityKind
  source?: WorkbenchActivitySource
  sequence?: number
  summary?: string
  actorId?: string
  createdAt?: string
}

export type ExpertTaskAttentionKind =
  | 'missing_information'
  | 'missing_material'
  | 'capability_unavailable'
  | 'authorization_required'
  | 'configuration_required'
  | 'workspace_required'
  | 'tool_failed'
  | 'operation_status_unknown'
  | 'evidence_incomplete'
  | 'retryable_failure'

export type ExpertTaskAttentionAction =
  | 'provide_input'
  | 'open_capability'
  | 'open_settings'
  | 'open_workspace'
  | 'retry'
  | 'reroute'

export interface ExpertTaskAttentionIssue {
  id: string
  code?: string
  message?: string
}

/** 当前阻塞任务继续推进的唯一主要原因；旧任务可缺省并由事件文案兼容推断。 */
export interface ExpertTaskAttention {
  kind: ExpertTaskAttentionKind | string
  action: ExpertTaskAttentionAction | string
  /** Host-bound operation checkpoint; never authorization supplied by the renderer. */
  draftId?: string
  runId?: string
  title?: string
  detail?: string
  field?: string
  item?: string
  question?: string
  example?: string
  options?: string[]
  /** Structured list of all blocking prerequisites; item/detail remain the primary legacy projection. */
  issues?: ExpertTaskAttentionIssue[]
  defaultValue?: string
  required?: boolean
  createdAt?: string
}

/** 正式执行的可观察状态。updatedAt 代表真实进展，heartbeatAt 只代表执行器仍存活。 */
export interface ExpertTaskProgress {
  phase?: 'preflight' | 'running' | 'waiting_tool' | 'review' | 'blocked' | 'failed' | string
  label?: string
  detail?: string
  startedAt?: string
  updatedAt?: string
  heartbeatAt?: string
}

export interface WorkbenchTaskComment {
  id?: string
  body?: string
  authorId?: string
  createdAt?: string
}

export interface WorkbenchTaskDeliverable {
  deliverableId?: string
  title?: string
  type?: string
  version?: number
  required?: boolean
  previousVersionId?: string
  artifactRef?: string
  /** Every artifact produced for this deliverable version; artifactRef remains the primary/legacy ref. */
  artifactRefs?: string[]
  executionRef?: string
  kind?: WorkbenchActivityKind
  source?: WorkbenchActivitySource
  sequence?: number
  createdAt?: string
  evidenceStatus?: 'verified' | 'blocked' | 'not_required' | string
  acceptanceStatus?: string
  comments?: WorkbenchTaskComment[]
}

export interface WorkbenchTask {
  lifecycle?: { phase: string; outcome: string | null; waitingReason: string | null; label: string; terminal: boolean }
  taskVersion?: number
  /** Activity metadata is versioned independently from the task payload. */
  activityContractVersion?: 1 | number
  id: string
  /** Stable product Project ownership; never inferred from the current UI project after creation. */
  projectId?: string | null
  projectSnapshot?: {
    projectId?: string
    workspaceSourceId?: string
    branch?: string
    commit?: string
    repositoryRef?: string
    outputPolicy?: {
      deliverablesDir?: string
      conflictStrategy?: 'version' | 'overwrite' | 'ask'
    }
    capturedAt?: string
  } | null
  kind?: 'expert' | 'workflow' | 'legacy' | string
  title?: string
  status?: string
  schedule?: unknown
  goal?: string
  resultSummary?: string
  expertId?: string
  /** 仅用于加载当前身份/persona；不授予 Skill 或 Connector 执行权限。 */
  personaExpertId?: string
  /** 当前会话执行策略；专家规划/讨论固定为 no-tools。 */
  executionPolicy?: 'no-tools' | 'tools-allowed' | string
  expertName?: string
  workflowId?: string
  workflowName?: string
  execRef?: WorkbenchExecRef
  createdAt?: string
  updatedAt?: string
  pinned?: boolean
  visibility?: 'private' | 'organization'
  brief?: {
    completionPolicy?: 'automatic' | 'review'
    goal?: string
    plan?: {
      goal?: string
      deliverables?: string[]
      acceptanceCriteria?: string[]
      capabilityUse?: string[]
      steps?: string[]
      risks?: string[]
    }
    requiresMaterials?: boolean
    /** 用于在运行前准确指出仍缺少哪一项输入；不等同于已提交材料。 */
    requiredInputs?: { id?: string; label?: string; required?: boolean }[]
    materials?: { id?: string; type?: string; title?: string; ref?: string; content?: string }[]
    deliverables?: {
      id?: string
      title?: string
      type?: string
      required?: boolean
      acceptanceCriteria?: string[]
      requiredTools?: string[]
      requiredSkills?: string[]
      requiredConnectorIds?: string[]
      requiredEvidence?: Record<string, unknown>[]
      requiredArtifacts?: Record<string, unknown>[]
      minArtifacts?: number
      completionConditions?: Record<string, unknown>[]
    }[]
    constraints?: string[]
    dueAt?: string
  }
  assignmentSnapshot?: Record<string, unknown>
  knowledgeRefs?: { id?: string; name?: string; path?: string }[] | string[]
  participants?: { id?: string; role?: string; name?: string }[]
  events?: WorkbenchTaskEvent[]
  attention?: ExpertTaskAttention | null
  progress?: ExpertTaskProgress | null
  /** 用户在专家执行期间提交的补充；由通用专家运行时在下一轮执行前消费。 */
  inputQueue?: { pending?: boolean; count?: number; queuedAt?: string } | null
  deliverables?: WorkbenchTaskDeliverable[]
  executionEvidence?: {
    runId?: string
    deliverableId?: string
    gateStatus?: 'verified' | 'blocked' | 'not_required' | string
    verificationPassed?: boolean
    qualificationContext?: {
      contractVersion?: number
      configurationId?: string
      complete?: boolean
      missing?: string[]
      runtime?: { hash?: string }
      agent?: { id?: string; version?: string; hash?: string }
      skills?: { id?: string; hash?: string }[]
      connectors?: { id?: string; hash?: string }[]
      model?: { provider?: string; id?: string; requestedId?: string; label?: string; autoRouted?: boolean }
    }
    /** 同模型自动复核仅是运行护栏，不是专家资格认证。 */
    qualityGuardrail?: {
      mode?: 'same_model_guardrail' | string
      enabled?: boolean
      passed?: boolean
      rewritten?: boolean
      initialPassed?: boolean
      finalPassed?: boolean
      budgetExhausted?: boolean
      issues?: { criterion?: number; problem?: string; requiredChange?: string }[]
    }
    toolCalls?: { id?: string; name?: string; status?: string; resultRef?: string; error?: string; durationMs?: number | null }[]
    evidence?: { id?: string; status?: string; digest?: string; provenance?: Record<string, unknown> }[]
    violations?: { code?: string; message?: string; missingTools?: string[] }[]
    createdAt?: string
  }[]
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
  /** Product Project binding. workspaceId is retained only for legacy automation records. */
  projectId?: string
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

export type BrainNodeKind = 'self' | 'person' | 'project' | 'goal' | 'decision' | 'preference' | 'problem' | 'task' | 'concept' | 'source' | 'collection'
export type BrainClaimStatus = 'observed' | 'inferred' | 'confirmed' | 'rejected' | 'superseded' | 'expired'

export interface BrainNode {
  id: string
  projectId?: string
  kind: BrainNodeKind
  label: string
  summary?: string
  tags?: string[]
  scope?: 'global' | 'project' | 'session' | 'organization'
  authority?: number
  sourceRef?: string
  providerId?: string
  collectionId?: string
  external?: boolean
  stale?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface BrainClaim {
  id: string
  projectId?: string
  subjectId: string
  predicate: string
  objectNodeId?: string
  value?: string | number | boolean
  status: BrainClaimStatus
  confidence?: number
  scope?: string
  validFrom?: string
  validTo?: string
  evidenceRefs?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface BrainEvidence {
  id: string
  projectId?: string
  sourceId?: string
  filePath?: string
  taskId?: string
  runId?: string
  type?: string
  providerId?: string
  collectionId?: string
  documentRef?: string
  title?: string
  snippet?: string
  persistence?: 'local' | 'reference' | 'ephemeral'
  capturedAt?: string
  expiresAt?: string
}

export interface BrainProposal {
  id: string
  projectId?: string
  kind?: 'cognition' | 'behavior' | 'capability' | 'conflict' | 'expiry' | string
  targetType?: 'brain' | 'partner_profile' | 'capability'
  status?: 'pending' | 'confirmed' | 'rejected' | 'snoozed'
  summary?: string
  rationale?: string
  effects?: Record<string, unknown>[]
  evidenceRefs?: string[]
  fingerprint?: string
  category?: 'about' | 'project' | 'relation' | 'conflict' | 'capability'
  confidence?: number
  impact?: string
  sourceRef?: string
  sourceLabel?: string
  memoryPatternId?: string
  observationCount?: number
  lastObservedAt?: string
  snoozedUntil?: string
  source?: 'brain' | 'steward' | 'partner'
  createdAt?: string
}

export interface KnowledgeCollection {
  id: string
  name?: string
  description?: string
  documentCount?: number
  updatedAt?: string | null
  tags?: string[]
  permission?: string | Record<string, unknown> | null
  status?: string | number | null
  health?: string | null
  topics?: string[]
}

export interface KnowledgeProviderStatus {
  ok?: boolean
  state?: 'ready' | 'offline' | 'degraded' | string
  checkedAt?: string
  error?: string | null
}

export interface KnowledgeProviderAdapter {
  kind: string
  getStatus(provider: KnowledgeProviderItem): Promise<KnowledgeProviderStatus>
  listCollections(provider: KnowledgeProviderItem): Promise<{ ok?: boolean; collections?: KnowledgeCollection[]; error?: string }>
  queryCollection(provider: KnowledgeProviderItem, query: string, options?: Record<string, unknown>): Promise<BrainQueryResult>
  getDocument?(ref: string): Promise<{ ref?: string; title?: string; content?: string }>
}

export interface BrainSnapshot {
  ok?: boolean
  error?: string
  schemaVersion?: number
  nodes?: BrainNode[]
  claims?: BrainClaim[]
  evidence?: BrainEvidence[]
  proposals?: BrainProposal[]
  providers?: KnowledgeProviderItem[]
  layout?: { positions?: Record<string, { x: number; y: number }> }
  stats?: { nodes?: number; claims?: number; evidence?: number; proposals?: number; providers?: number }
  state?: Record<string, unknown>
}

export interface BrainNeighborhood {
  ok?: boolean
  error?: string
  rootId?: string
  nodes?: BrainNode[]
  claims?: BrainClaim[]
  truncated?: boolean
  stats?: BrainSnapshot['stats']
}

export interface AgentKnowledgePolicy {
  brainScopes?: string[]
  providers?: Array<{ providerId: string; collectionIds?: string[] }>
  allowPersonalMemory?: boolean
  allowRemoteQuery?: boolean
  allowPromotionProposal?: boolean
  allowDirectWrite?: false
}

export interface BrainQueryRequest {
  text?: string
  query?: string
  mode?: 'local' | 'external' | 'mixed'
  kinds?: BrainNodeKind[]
  statuses?: BrainClaimStatus[]
  topK?: number
  forceExternal?: boolean
  knowledgePolicy?: AgentKnowledgePolicy
}

export interface BrainHit {
  ref: string
  title?: string
  snippet?: string
  nodeId?: string
  relationPath?: string[]
  relationNodes?: string[]
  relationLabels?: string[]
  sourceKind?: 'brain' | 'llmwiki' | 'local' | 'gitlab' | 'ragflow' | 'remote-rag'
  providerId?: string
  collectionId?: string
  score?: number
  authority?: number
  freshness?: number
  claimStatus?: BrainClaimStatus
  graphDistance?: number | null
  conflict?: boolean
  persistence?: 'local' | 'external' | 'ephemeral'
  evidence?: BrainEvidence[]
  explanation?: string
}

export interface BrainQueryResult {
  ok?: boolean
  error?: string
  hits?: BrainHit[]
  externalAttempted?: boolean
  message?: string | null
}

export interface BrainNodeDetail {
  ok?: boolean
  error?: string
  node?: BrainNode
  claims?: BrainClaim[]
  evidence?: BrainEvidence[]
}

export interface BrainExplainResult extends BrainNodeDetail {
  claim?: BrainClaim | null
  explanation?: string
}

export interface BrainPathResult {
  ok?: boolean
  error?: string
  nodeIds?: string[]
  claimIds?: string[]
  distance?: number
  nodes?: BrainNode[]
  claims?: BrainClaim[]
  evidence?: BrainEvidence[]
  explanation?: string
}

export interface BrainGrowthEvent {
  id: string
  proposalId?: string
  targetType?: 'brain' | 'partner_profile' | 'capability'
  kind?: string
  summary?: string
  status?: 'applied' | 'reverted'
  reversible?: boolean
  source?: string
  createdAt?: string
  revertedAt?: string
  memoryPatternId?: string
}

export interface BrainGrowthResult {
  ok?: boolean
  error?: string
  events?: BrainGrowthEvent[]
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
  projectId?: string | null
  type?: string
  title?: string
  body?: string
  status?: string
  targetPath?: string
  /** Provider/daemon URL for remotely hosted media; targetPath remains the local-file field. */
  url?: string
  /** Provider artifact path retained for generic media resolvers. */
  path?: string
  meta?: {
    mode?: string
    noteId?: string
    sourceId?: string
    path?: string
    projectId?: string
    taskId?: string
    runId?: string
    automationId?: string
    agentId?: string
  }
}

export interface AgentSession {
  id: string
  /** Optional stable Project ownership. General advisory sessions may remain unbound. */
  projectId?: string | null
  title?: string
  displayTitle?: string
  pinned?: boolean
  agentId?: string
  sessionKind?: 'personal-topic' | 'expert-task' | 'workflow-run' | 'legacy' | string
  profileId?: string
  contextId?: string
  expertId?: string
  knowledgeRefs?: string[]
  taskRef?: { id?: string; kind?: string } | null
  run?: {
    goal?: string
    artifacts?: AgentRunArtifact[]
  } | null
  /** 最近更新；历史列表按此排序，缺省时不展示相对时间 */
  updatedAt?: string
  /** 主进程列表投影中的消息数，用于隐藏未交互的空白会话 */
  messageCount?: number
  /** 历史列表中的一行会话摘要 */
  summary?: string
}

export interface PersonalAgentContext {
  id: string
  name?: string
  workspaceRef?: string
  role?: string
  skillRefs?: { id: string; version?: string; contentHash?: string }[]
  knowledgeRefs?: { id: string; version?: string; contentHash?: string }[]
  connectorRefs?: { id: string; version?: string; contentHash?: string }[]
  permissions?: Record<string, unknown>
}

export interface PersonalAgentProfile {
  profileVersion: number
  id: string
  agentId: string
  profileKind: 'personal' | 'overlay'
  name?: string
  identity: { displayName?: string; avatar?: string }
    contexts: PersonalAgentContext[]
    taskPreferences: Record<string, unknown>
    roleOverlay?: string
    promptOverlay?: string
  skillRefs?: { id: string; version?: string; contentHash?: string }[]
  knowledgeRefs?: { id: string; version?: string; contentHash?: string }[]
  connectorRefs?: { id: string; version?: string; contentHash?: string }[]
  permissions?: Record<string, unknown>
  memoryPolicy?: Record<string, unknown>
  knowledgePolicy?: Record<string, unknown>
}

export interface PersonalAgentGrowthEvent {
  id: string
  type: string
  status?: string
  summary?: string
  proposalId?: string
  memoryRef?: string
  reversible?: boolean
  createdAt?: string
}

export interface PersonalAgentProposal {
  id: string
  kind: string
  summary?: string
  status?: string
  patch?: Record<string, unknown>
  targetType?: 'brain' | 'partner_profile' | 'capability'
  createdAt?: string
}

export interface PersonalAgentResult {
  ok?: boolean
  error?: string
  code?: string
  profile?: PersonalAgentProfile
  proposal?: PersonalAgentProposal
  recentGrowth?: PersonalAgentGrowthEvent[]
  pendingProposalCount?: number
  commonExperts?: Array<{
    id: string
    name: string
    description?: string
    category?: string
    status?: string
  }>
}

export interface PersonalAgentTeachResult extends PersonalAgentResult {
  applied?: boolean
  requiresConfirmation?: boolean
  undoEventId?: string
  memoryRef?: string
  event?: PersonalAgentGrowthEvent
}

export interface PersonalAgentGrowthResult {
  ok?: boolean
  error?: string
  events?: PersonalAgentGrowthEvent[]
  proposals?: PersonalAgentProposal[]
}

export interface AgentFileRef {
  id: string
  title?: string
  preview?: string
  project?: string
  updatedAt?: string
}

export interface ConversationHistoryTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  runId?: string
  createdAt?: string
}

export interface AgentTurnIdentity {
  userMessageId: string
  assistantMessageId: string
  userCreatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
  /** Stable transcript ordering metadata; distinct from streaming performance timing. */
  createdAt?: string
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

export interface CapabilityQualification {
  state: 'ready' | 'limited'
  issues?: string[]
  limitedSkills?: string[]
  assessedAtImport?: boolean
}

export interface CapabilityReadiness {
  /** Runtime dependency readiness is optional for legacy/unassessed entries. */
  state?: 'ready' | 'limited'
  items?: Array<{
    id: string
    kind: string
    required?: boolean
    status?: string
    reason?: string
  }>
  issues?: Array<{
    code?: string
    dependency?: { id?: string; kind?: string }
    message?: string
  }>
  /** Route-specific readiness is diagnostic only; it does not make the whole expert unavailable. */
  routes?: Array<{
    id: string
    label?: string
    state?: 'ready' | 'limited'
    requiredSkills?: string[]
    requiredConnectorIds?: string[]
    issues?: Array<{
      code?: string
      dependency?: { id?: string; kind?: string }
      message?: string
    }>
  }>
}

export interface CapabilityItem {
  id: string
  kind: CapabilityKind
  name?: string
  description?: string
  /** Skill manifest supplied icon name, usually from experience.tasks[0].icon. */
  icon?: string
  category?: string
  status?: string
  enabled?: boolean
  installed?: boolean
  type?: string
  /** Explicit package qualification. Missing means legacy/unassessed, not failed. */
  qualification?: CapabilityQualification
  /** Current runtime dependency readiness. Missing means legacy/unassessed, not failed. */
  readiness?: CapabilityReadiness
  /** Bundled portfolio lifecycle. Legacy experts remain resolvable for history but cannot start new tasks. */
  lifecycle?: {
    state?: 'active' | 'legacy' | string
    newTasks?: boolean
    successors?: Array<{ kind: CapabilityKind | 'workflow' | string; id: string }>
  }
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
  sourceId?: string | null
  spaceSourceId?: string | null
  subDir?: string
  repositoryRef?: string
  collectionId?: string
  endpoint?: string
  hasApiKey?: boolean
  health?: string
  updatedAt?: string
  collections?: KnowledgeCollection[]
  collectionIds?: string[]
  lastQueryAt?: string
  lastQueryStatus?: string
  recentQueries?: Array<{ collectionId?: string; queryHash?: string; hitCount?: number; status?: string; latencyMs?: number; queriedAt?: string }>
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
  /** 本轮实际使用的模型身份；用于运行审计与专家资格证据分组。 */
  provider?: string
  model?: string
  requestedModel?: string
  label?: string
  autoRouted?: boolean
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
  /** Context Engine 的隐私安全装配清单；不包含原始上下文正文。 */
  contextManifest?: AgentContextManifest
  /** 进程内匿名聚合指标与 SLO 快照。 */
  contextEngineMetrics?: Record<string, unknown>
}

export interface AgentContextManifest {
  version: number
  scene: string
  phase?: string
  identity?: string
  executionPolicy: string
  locale: string
  promptPackVersion?: string
  estimatedTokens: number
  candidateEstimatedTokens?: number
  savedEstimatedTokens?: number
  included: Array<{
    id: string
    kind: string
    authority: string
    trust: string
    sourceTrust?: 'platform' | 'bundled' | 'user' | 'external'
    projectedRole?: 'system' | 'user'
    critical?: boolean
    usedTokens: number
    chars: number
    hash: string
    truncated?: boolean
    sensitive?: boolean
    source?: { type?: string; idHash?: string; version?: string }
    cachePolicy?: string
  }>
  omitted: Array<{
    id: string
    reason: string
    source?: { type?: string; idHash?: string; version?: string }
  }>
  conflicts: Array<{
    type: string
    winner: { id: string; value: string }
    suppressed: Array<{ id: string; value: string }>
  }>
  rankings?: Array<{
    id: string
    score: number
    lexicalScore?: number
    vectorScore?: number
    confidenceScore?: number
    freshnessScore?: number
  }>
  semanticSelection?: {
    version: number
    mode: 'off' | 'shadow' | 'active'
    status: 'skipped' | 'degraded' | 'shadow' | 'applied'
    reason?: string
    providerHash?: string
    latencyMs: number
    candidateCount: number
    eligibleCount: number
    cacheHits: number
    requested: number
    sensitiveExcluded: number
    wouldChange: boolean
    limited: boolean
  }
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

export type ProjectStatus = 'active' | 'archived' | 'missing' | 'readonly'

export interface ProjectRef {
  id: string
  name: string
  description?: string
  workspaceSourceId: string
  referenceSourceIds?: string[]
  outputPolicy?: {
    deliverablesDir?: string
    conflictStrategy?: 'version' | 'overwrite' | 'ask'
  }
  brainPolicy?: {
    observeCompletedTasks?: boolean
    createProposals?: boolean
  }
  status: ProjectStatus
  workspace?: (ContentSourceRef & { sourceId?: string; repositoryRef?: string }) | null
  createdAt?: string
  updatedAt?: string
  lastOpenedAt?: string | null
}

export interface ProjectsListResult {
  ok?: boolean
  error?: string
  version?: number
  projects?: ProjectRef[]
  activeProjectId?: string | null
}

export interface ProjectContextResult {
  ok?: boolean
  error?: string
  project?: ProjectRef
  workspace?: (ContentSourceRef & {
    sourceId?: string
    repositoryRef?: string
    available?: boolean
    writable?: boolean
  }) | null
  references?: Array<ContentSourceRef & { sourceId?: string; readable?: boolean }>
  permissions?: {
    readWorkspace?: boolean
    writeWorkspace?: boolean
    readReferences?: boolean
  }
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
  rootPath?: string
}

declare global {
  interface Window {
    api?: KnowMeApi
  }
}

export {}
