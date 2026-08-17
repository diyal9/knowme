import type { AttentionItem } from '../../domain/attention'
import type { AppRoute, WorkbenchSurface } from '../../domain/rail'
import type { ContentSource, FileTreeNode } from '../../domain/file-tree'
import type { KnowledgePage } from '../../domain/knowledge-surface'
import type { KnowledgeKindFilter } from '../../domain/knowledge-tree'
import type { KnowledgeReadResult, StewardProposal } from '../../shared/api-extended'
import type {
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

import type { RunArtifact, RunPhase } from '../../domain/run-telemetry'
import type { RunLane } from '../../domain/workbench-task-room'
import type { ReviewTabId } from '../../domain/daemon-review-tabs'
import type { RunGraphNode } from '../../domain/run-projection'
import type { LinkPreviewState } from '../features/link-preview/store-link-preview'

export interface RunState {
  workflowId: string
  workflowName: string
  slug: string
  lane: RunLane
  phase: RunPhase
  brief: string
  log: string[]
  gateNode: string | null
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
}

export interface ExpertRoomState {
  id: string
  name: string
  goal: string
  log: string[]
  messages: ChatMessage[]
  skills: string[]
  connectors: string[]
  knowledgeRefs: string[]
}

export interface WorkbenchDialogueSlice {
  composer: string
  attachments: { name: string; text?: string }[]
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

export interface AgentContextInfo {
  usedTokens?: number
  contextWindow?: number
  omittedTurns?: number
  omittedMessages?: number
  sectionUsage?: { key: string; usedTokens?: number }[]
  sectionOmitted?: string[]
}

export interface SessionSlice {
  messages: ChatMessage[]
  composer: string
  attachments: { name: string; text?: string }[]
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
  assistantSkills: CapabilityItem[]
  assistantStatus: string
  assistantProcessFeed: string
  assistantContextInfo: AgentContextInfo | null
  assistantProcessLines: string[]
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
  openLinkPreview: (href: string, title?: string) => boolean
  closeLinkPreview: () => void
  setLinkFullscreen: (next: boolean) => void
  setRoute: (route: AppRoute) => void
  openSettingsSurface: (tab?: string) => void
  setWorkbenchSurface: (surface: WorkbenchSurface) => void
  toggleFiles: () => void
  setShelfQuery: (q: string) => void
  setShelfDomain: (d: ShelfDomain) => void
  setShelfLayout: (layout: ShelfLayout) => void
  loadWorkbench: () => Promise<void>
  loadTasks: () => Promise<void>
  startRun: (card: ShelfCardModel) => void
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
  openExpertRoom: (room: { id: string; name: string; goal?: string }) => void
  closeExpertRoom: () => void
  setExpertRoomGoal: (goal: string) => void
  patchExpertRoomBindings: (patch: Partial<Pick<ExpertRoomState, 'skills' | 'connectors' | 'knowledgeRefs'>>) => void
  setWorkbenchComposer: (v: string) => void
  addWorkbenchAttachment: (file: { name: string; text?: string }) => void
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
  applyAssistantText: (mode: 'insert' | 'append' | 'replace', text: string) => Promise<void>
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
  addComposerAttachment: (file: { name: string; text?: string }) => void
  removeComposerAttachment: (name: string) => void
  setHubTab: (tab: CapabilityKind) => void
  setHubQuery: (q: string) => void
  loadHubCapabilities: () => Promise<void>
  loadWorkbenchModes: () => Promise<void>
  initStudio: () => void
  enterStudio: (from?: WorkbenchSurface, workflowId?: string) => void
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
