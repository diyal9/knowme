import type { AttentionItem } from '../../domain/attention'
import type { AppRoute, WorkbenchSurface } from '../../domain/rail'
import type { ContentSource, FileTreeNode } from '../../domain/file-tree'
import type { KnowledgePage } from '../../domain/knowledge-surface'
import type { KnowledgeKindFilter } from '../../domain/knowledge-tree'
import type { KnowledgeReadResult, StewardProposal } from '../../shared/api-extended'
import type {
  AgentContextInfo,
  AgentFileRef,
  AgentSession,
  CapabilityItem,
  CapabilityKind,
  ChatMessage,
  KnowledgeEntry,
  KnowledgeHit,
  KnowledgeLintIssue,
  KnowledgeProviderItem,
  WorkbenchAutomationJob,
  WorkbenchAutomationTemplate,
  WorkbenchMode,
  WorkbenchTask,
  StewardTaskSummary,
} from '../../shared/api'
import type { ShelfCardModel, ShelfDomain, ShelfLayout } from '../../domain/shelf'
import type { StudioDraft, StudioIssue } from '../../domain/studio'
import type { ExpertDiscussionContext } from '../../domain/expert-discussion'

import type { RunArtifact, RunPhase } from '../../domain/run-telemetry'
import type { RunLane } from '../../domain/workbench-task-room'
import type { ReviewTabId } from '../../domain/daemon-review-tabs'
import type { RunGraphNode } from '../../domain/run-projection'
import type { DaemonPathItem } from '../../domain/daemon-compose'
import type { LinkPreviewOpenOptions, LinkPreviewState } from '../features/link-preview/store-link-preview'

export interface RunState {
  taskId: string
  workflowId: string
  workflowName: string
  slug: string
  lane: RunLane
  phase: RunPhase
  brief: string
  launchInputs: Record<string, string>
  log: string[]
  gateNode: string | null
  clarifyNode: string | null
  gateTitle: string | null
  processLogsText: string
  progressText: string
  showProcess: boolean
  artifacts: RunArtifact[]
  inputAgents: string[]
  agents: { id: string; name: string; role?: string }[]
  graphNodes: RunGraphNode[]
  currentOwner: string
  projectionDegraded: boolean
  projectionDegradedReason: string
  reviewTab: ReviewTabId
  reviewEvents: { id: string; type: string; message: string; at: string }[]
  reviewChanges: { summary: string; files: { id: string; path: string; status: string }[]; empty: boolean }
  daemonStatus: string
  dialogueMessages: ChatMessage[]
  workflowRunId: string
  workflowPackage: Record<string, unknown> | null
  selectedNodeId: string | null
}

export interface ExpertRoomState {
  id: string
  /** 正式任务 id；为空时表示尚未确认计划的协作草稿。 */
  taskId?: string
  /** 专家 id 与任务 id 分离，确保正式任务中的对话仍使用正确专家身份。 */
  expertId?: string
  name: string
  goal: string
  log: string[]
  messages: ChatMessage[]
  skills: string[]
  connectors: string[]
  knowledgeRefs: string[]
  /** 正式任务讨论所依据的当前任务与成果快照；不用于驱动任务执行。 */
  discussionContext?: ExpertDiscussionContext
}

export interface WorkbenchDialogueSlice {
  composer: string
  attachments: ComposerAttachment[]
}

export interface DaemonOverviewCache {
  workflows: DaemonPathItem[]
  tasks: unknown[]
  loadedAt: number
}

export interface ProcessView {
  progress: { empty: boolean; emptyLabel: string; text: string }
  logs: { empty: boolean; emptyLabel: string; lines: string[] }
}

export interface AssistantModelOption {
  id: string
  label: string
  contextWindow?: number
  supportsTools?: boolean
  supportsVision?: boolean
}

export interface AssistantModelGroup {
  id: string
  label: string
  models: AssistantModelOption[]
}

export interface StudioKnowledgeProvider {
  id: string
  name: string
  kind?: string
}

/** 与 shared/api.AgentContextInfo 同步；流式 stage_prepare 写入 assistantContextInfo */
export type { AgentContextInfo }

export interface SessionSlice {
  messages: ChatMessage[]
  composer: string
  attachments: ComposerAttachment[]
}

export interface ComposerAttachment {
  name: string
  kind?: 'text' | 'image'
  text?: string
  mimeType?: string
  dataUrl?: string
}

export interface OverlayDrawer {
  title: string
  body?: string
}

export interface OverlayContextMenuItem {
  id: string
  label: string
  danger?: boolean
  onClick: () => void
}

export interface OverlayContextMenu {
  x: number
  y: number
  items: OverlayContextMenuItem[]
}

export interface WorkspaceModalState {
  slug: string
}

export type ManagePanel = 'daemon' | 'workflows' | 'automation'

export interface ConfirmModalState {
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  /** 第三动作：离开编排时的「保存后离开」。 */
  altLabel?: string
  onAlt?: () => void | Promise<void>
}

export interface AppState {
  route: AppRoute
  settingsTab: string
  workbenchSurface: WorkbenchSurface
  filesOpen: boolean
  shelfQuery: string
  shelfDomain: ShelfDomain
  shelfLayout: ShelfLayout
  shelfCards: ShelfCardModel[]
  shelfLoading: boolean
  shelfDaemonOnline: boolean | null
  daemonOverviewCache: DaemonOverviewCache | null
  tasks: WorkbenchTask[]
  run: RunState | null
  expertRoom: ExpertRoomState | null
  workbenchDialogue: WorkbenchDialogueSlice
  managePanel: ManagePanel
  sessions: AgentSession[]
  sessionHistory: AgentSession[]
  activeSessionId: string
  sessionStates: Record<string, SessionSlice>
  fileCatalog: AgentFileRef[]
  isGenerating: boolean
  assistantModels: AssistantModelOption[]
  assistantModelGroups: AssistantModelGroup[]
  assistantModelId: string
  /** Stable partner label loaded before empty-home identity text is shown. */
  assistantPartnerName: string
  assistantSkills: CapabilityItem[]
  assistantStatus: string
  assistantProcessFeed: string
  assistantContextInfo: AgentContextInfo | null
  assistantProcessLines: string[]
  /** requesting_cancel → cancelling_children → cancelled；空串表示无取消过程 */
  assistantCancelStage: '' | 'requesting_cancel' | 'cancelling_children' | 'cancelled' | 'resume_pending'
  assistantRecovery: {
    status?: string
    code?: string
    recommendedAction?: string
    estimatedWait?: string
  } | null
  imageViewerUrl: string
  generateRunId: string
  fileTreeQuery: string
  sources: ContentSource[]
  activeSourceId: string | null
  fileTreeNodes: FileTreeNode[]
  fileTreeTruncated: boolean
  fileTreeLoading: boolean
  fileTreeCollapsed: Record<string, true>
  assistantApplyTarget: { sourceId: string; path: string } | null
  knowledgePage: KnowledgePage
  knowledgeQuery: string
  knowledgeFilter: KnowledgeKindFilter
  knowledgeWiki: KnowledgeEntry[]
  knowledgeOkf: KnowledgeEntry[]
  knowledgeWikiRoot: string
  knowledgeHits: KnowledgeHit[]
  knowledgeLoading: boolean
  knowledgeSearching: boolean
  knowledgeMessage: string | null
  knowledgeReader: KnowledgeReadResult | null
  knowledgeSelectedPath: string | null
  knowledgeCollapsedDirs: Record<string, true>
  knowledgeCollapsedSeeded: boolean
  knowledgeLintIssues: KnowledgeLintIssue[]
  knowledgeLinting: boolean
  knowledgeOrganizing: boolean
  knowledgeProviders: KnowledgeProviderItem[]
  knowledgeActiveProviderId: string | null
  knowledgeMoreOpen: boolean
  knowledgeSelectedProposalId: string | null
  stewardProposals: StewardProposal[]
  hubTab: CapabilityKind
  hubQuery: string
  hubItems: CapabilityItem[]
  hubLoading: boolean
  studioDraft: StudioDraft | null
  studioIssues: StudioIssue[]
  studioSaving: boolean
  studioReturnSurface: WorkbenchSurface | null
  studioReturnManagePanel: ManagePanel | null
  studioKnowledgeProviders: StudioKnowledgeProvider[]
  modes: WorkbenchMode[]
  activeModeId: string
  automationJobs: WorkbenchAutomationJob[]
  automationTemplates: WorkbenchAutomationTemplate[]
  manageLoading: boolean
  overlayToast: string
  overlayDrawer: OverlayDrawer | null
  overlayContextMenu: OverlayContextMenu | null
  confirmModal: ConfirmModalState | null
  workspaceModal: WorkspaceModalState | null
  taskManageOpen: boolean
  attentionItems: AttentionItem[]
  attentionPulse: boolean
  fabricStats: { nodeCount?: number; edgeCount?: number; staleAnchors?: number } | null
  stewardTasks: StewardTaskSummary[]
  knowledgeIoLoading: boolean
  linkPreview: LinkPreviewState | null
  linkFullscreen: boolean
  linkTitleCache: Record<string, string>
  cacheLinkTitle: (href: string, title: string) => void
  openLinkPreview: (href: string, title?: string, options?: LinkPreviewOpenOptions) => boolean
  updateLinkPreviewTitle: (title: string) => void
  openMarkdownPreview: (href: string, title?: string) => Promise<boolean>
  closeLinkPreview: () => void
  setLinkFullscreen: (next: boolean) => void
  setRoute: (route: AppRoute) => void
  openSettingsSurface: (tab?: string) => void
  setWorkbenchSurface: (surface: WorkbenchSurface) => void
  toggleFiles: () => void
  setShelfQuery: (q: string) => void
  setShelfDomain: (d: ShelfDomain) => void
  setShelfLayout: (layout: ShelfLayout) => void
  setDaemonOverviewCache: (cache: DaemonOverviewCache | null) => void
  loadWorkbench: () => Promise<void>
  loadTasks: () => Promise<void>
  launchWorkflow: (card: ShelfCardModel, payload: { goal: string; inputs: Record<string, string> }) => Promise<boolean>
  reopenTaskRun: (task: WorkbenchTask, opts?: { lane?: RunLane }) => Promise<void>
  setRunBrief: (brief: string) => void
  confirmLaunch: () => Promise<void>
  refreshRunTelemetry: () => Promise<void>
  setRunReviewTab: (tab: ReviewTabId) => void
  hitlDecide: (accept: boolean) => void
  returnToShelf: () => void
  rerun: () => void
  toggleProcessLog: () => void
  openWorkflowManage: () => void
  archiveWorkflow: (workflowId: string) => Promise<void>
  openTaskManage: () => void
  closeTaskManage: () => void
  archiveTasks: (ids: string[]) => Promise<void>
  openAutomationCenter: () => void
  openWorkbenchRail: () => void
  openExpertRoom: (room: { id: string; taskId?: string; expertId?: string; name: string; goal?: string }) => void
  closeExpertRoom: () => void
  setExpertRoomGoal: (goal: string) => void
  patchExpertRoomBindings: (patch: Partial<Pick<ExpertRoomState, 'skills' | 'connectors' | 'knowledgeRefs'>>) => void
  setWorkbenchComposer: (v: string) => void
  addWorkbenchAttachment: (file: ComposerAttachment) => void
  removeWorkbenchAttachment: (name: string) => void
  sendWorkbenchMessage: () => void
  startExpertCollab: () => Promise<void>
  saveAutomation: (payload: Record<string, unknown>, id?: string) => Promise<boolean>
  deleteAutomation: (id: string) => Promise<void>
  runAutomationNow: (id: string) => Promise<void>
  openDaemonReview: (jobName: string) => Promise<void>
  openDaemonTaskSlug: (slug: string, meta?: { name?: string }) => Promise<void>
  updateStudioNodeFields: (nodeId: string, patch: Record<string, unknown>) => void
  setComposer: (v: string) => void
  sendMessage: (overrideText?: string) => void
  stopGenerate: () => void
  newSession: () => void
  selectSession: (id: string) => void
  loadAssistantSessions: () => Promise<void>
  loadAssistantChrome: () => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  pinSession: (id: string, pinned: boolean) => Promise<void>
  forkSession: (id: string) => Promise<void>
  closeSessionTab: (id: string) => Promise<void>
  closeSessionTabs: (ids: string[]) => Promise<void>
  copySessionTranscript: (id: string) => Promise<void>
  setAssistantModel: (modelId: string) => Promise<void>
  setSessionExpert: (expertId: string) => Promise<void>
  startAssistantMode: (modeId: string) => Promise<void>
  toggleSessionKnowledge: (refId: string) => Promise<void>
  clearSessionKnowledge: () => Promise<void>
  setAssistantApplyTarget: (target: { sourceId: string; path: string } | null) => void
  acceptAssistantArtifact: (artifactId: string) => Promise<void>
  rejectAssistantArtifact: (artifactId: string) => Promise<void>
  refreshActiveSessionArtifacts: () => Promise<void>
  setImageViewer: (url: string) => void
  loadFileCatalog: () => Promise<void>
  setFileTreeQuery: (q: string) => void
  loadFileTree: () => Promise<void>
  selectSource: (id: string) => Promise<void>
  toggleFileDir: (sourceId: string, relPath: string) => Promise<void>
  createSourceFile: () => Promise<void>
  collapseFileTree: () => void
  openSourceRoot: () => Promise<void>
  setKnowledgePage: (page: KnowledgePage) => void
  setKnowledgeFilter: (filter: KnowledgeKindFilter) => void
  toggleKnowledgeDir: (path: string) => void
  setKnowledgeQuery: (q: string) => void
  loadKnowledge: () => Promise<void>
  refreshKnowledge: () => Promise<void>
  searchKnowledge: () => Promise<void>
  exportKnowledge: () => Promise<void>
  importKnowledge: () => Promise<void>
  loadKnowledgeIo: () => Promise<void>
  openKnowledgeEntry: (entry: { kind?: string; path?: string }) => Promise<void>
  closeKnowledgeEntry: () => void
  lintKnowledge: () => Promise<void>
  organizeKnowledge: (scope?: { mode?: string; topic?: string }) => Promise<void>
  addKnowledgeMaterial: (text: string, title?: string) => Promise<boolean>
  selectKnowledgeProposal: (id: string | null) => void
  decideKnowledgeProposal: (action: 'accept' | 'reject' | 'snooze', content?: string) => Promise<void>
  setKnowledgeProvider: (id: string) => Promise<void>
  openObsidian: () => Promise<void>
  setKnowledgeMoreOpen: (open: boolean) => void
  upsertAttention: (raw: unknown) => void
  clearAttention: (id?: string) => void
  activateAttention: (id: string) => void
  setAttentionPulse: (pulse: boolean) => void
  addComposerAttachment: (file: ComposerAttachment) => void
  removeComposerAttachment: (name: string) => void
  setHubTab: (tab: CapabilityKind) => void
  setHubQuery: (q: string) => void
  loadHubCapabilities: () => Promise<void>
  loadWorkbenchModes: () => Promise<void>
  initStudio: () => void
  enterStudio: (from?: WorkbenchSurface, workflowId?: string) => void
  enterStudioFromExpertTask: (payload: {
    mode: 'reuse' | 'overflow'
    taskId: string
    expertName: string
    goal: string
    resultLabel?: string
    resultSummary?: string
  }) => void
  forkWorkflow: (workflowId: string) => Promise<void>
  leaveStudio: () => boolean
  addStudioNode: () => void
  addStudioNodeFromPalette: (kind: string) => void
  addStudioAgent: (agent: { id: string; name?: string; description?: string }) => void
  autoLayoutStudio: () => void
  inspectStudio: () => {
    ok: boolean
    issues: StudioIssue[]
    walk: { nodeId: string }[]
    startId?: string
  } | null
  disconnectStudioEdge: (edgeId: string) => void
  updateStudioDraftName: (name: string) => void
  updateStudioDraftGoal: (goal: string) => void
  updateStudioDraftIo: (kind: 'inputs' | 'outputs', rows: unknown[]) => void
  loadStudioKnowledgeProviders: () => Promise<void>
  moveStudioNode: (nodeId: string, x: number, y: number) => void
  connectStudioNodes: (fromId: string, toId: string, branch?: string) => void
  removeStudioNode: (nodeId: string) => void
  saveStudio: () => Promise<boolean>
  loadManage: () => Promise<void>
  selectMode: (modeId: string) => Promise<void>
  showToast: (msg: string) => void
  openDrawer: (drawer: OverlayDrawer) => void
  closeDrawer: () => void
  openContextMenu: (menu: OverlayContextMenu) => void
  closeContextMenu: () => void
  openConfirm: (modal: ConfirmModalState) => void
  closeConfirm: () => void
  openWorkspaceModal: (slug: string) => void
  closeWorkspaceModal: () => void
}

export type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
) => void
export type StoreGet = () => AppState

export function api() {
  return window.api
}
