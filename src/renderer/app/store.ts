import { create } from 'zustand'
import { filterShelfCards, type ShelfCardModel } from '../../domain/shelf'
import type { ChatMessage } from '../../shared/api'
import { createAssistantSlice } from '../features/assistant/store-assistant'
import { createAssistantApplySlice } from '../features/assistant/store-assistant-apply'
import { bindAttentionEvents, createAttentionSlice } from './store-attention'
import { createChromeSlice } from './store-chrome'
import { createFilesKnowledgeSlice } from './store-files-knowledge'
import { createKnowledgeSlice } from '../features/knowledge/store-knowledge'
import { emptySessionSlice, getSessionSlice } from '../features/assistant/store-session'
import { createStudioManageSlice } from '../features/studio/store-studio'
import type { AppState, ProcessView, RunState } from './store-types'
import { createWorkbenchSlice } from '../features/workbench/store-workbench'
import { createLinkPreviewSlice } from '../features/link-preview/store-link-preview'

export type { AppState, ProcessView, RunState } from './store-types'

export const useAppStore = create<AppState>((set, get) => ({
  route: 'assistant',
  settingsTab: 'sources',
  workbenchSurface: 'taskhome',
  filesOpen: false,
  shelfQuery: '',
  shelfDomain: 'all',
  shelfLayout: 'grid',
  shelfCards: [],
  shelfLoading: false,
  shelfDaemonOnline: null,
  daemonOverviewCache: null,
  tasks: [],
  run: null,
  expertRoom: null,
  workbenchDialogue: { composer: '', attachments: [] },
  managePanel: 'daemon',
  sessions: [{ id: 's1', title: '新助手', agentId: 'general' }],
  sessionHistory: [],
  activeSessionId: 's1',
  sessionStates: { s1: emptySessionSlice() },
  fileCatalog: [],
  isGenerating: false,
  assistantModels: [],
  assistantModelGroups: [],
  assistantModelId: '',
  assistantSkills: [],
  assistantStatus: '',
  assistantProcessFeed: '',
  assistantContextInfo: null,
  assistantProcessLines: [],
  assistantCancelStage: '',
  assistantRecovery: null,
  imageViewerUrl: '',
  generateRunId: '',
  fileTreeQuery: '',
  sources: [],
  activeSourceId: null,
  fileTreeNodes: [],
  fileTreeTruncated: false,
  fileTreeLoading: false,
  fileTreeCollapsed: {},
  knowledgePage: 'status',
  knowledgeQuery: '',
  knowledgeFilter: 'all',
  knowledgeWiki: [],
  knowledgeOkf: [],
  knowledgeWikiRoot: '',
  knowledgeHits: [],
  knowledgeLoading: false,
  knowledgeSearching: false,
  knowledgeMessage: null,
  knowledgeReader: null,
  knowledgeSelectedPath: null,
  knowledgeCollapsedDirs: {},
  knowledgeCollapsedSeeded: false,
  knowledgeLintIssues: [],
  knowledgeLinting: false,
  knowledgeOrganizing: false,
  knowledgeProviders: [],
  knowledgeActiveProviderId: null,
  knowledgeMoreOpen: false,
  knowledgeSelectedProposalId: null,
  stewardProposals: [],
  hubTab: 'expert',
  hubQuery: '',
  hubItems: [],
  hubLoading: false,
  studioDraft: null,
  studioIssues: [],
  studioSaving: false,
  studioReturnSurface: null,
  studioReturnManagePanel: null,
  studioKnowledgeProviders: [],
  modes: [],
  activeModeId: '',
  automationJobs: [],
  automationTemplates: [],
  manageLoading: false,
  fabricStats: null,
  stewardTasks: [],
  knowledgeIoLoading: false,

  setRoute: (route) => set({ route }),
  openSettingsSurface: (tab) => set({
    route: 'settings',
    settingsTab: String(tab || '').trim() || 'sources',
  }),
  toggleFiles: () => set({ filesOpen: !get().filesOpen }),
  setShelfQuery: (shelfQuery) => set({ shelfQuery }),
  setShelfDomain: (shelfDomain) => set({ shelfDomain }),
  setDaemonOverviewCache: (daemonOverviewCache) => set({ daemonOverviewCache }),

  ...createWorkbenchSlice(set, get),
  ...createAssistantSlice(set, get),
  ...createAssistantApplySlice(set, get),
  ...createAttentionSlice(set, get),
  ...createFilesKnowledgeSlice(set, get),
  ...createKnowledgeSlice(set, get),
  ...createStudioManageSlice(set, get),
  ...createChromeSlice(set, get),
  ...createLinkPreviewSlice(set, get),
}))

export function selectProcessView(run: RunState | null): ProcessView | null {
  if (!run) return null
  const progressText = run.progressText.trim()
  const logsText = run.processLogsText.trim()
  return {
    progress: {
      empty: !progressText,
      emptyLabel: '暂无进度',
      text: progressText,
    },
    logs: {
      empty: !logsText,
      emptyLabel: '暂无日志',
      lines: logsText ? logsText.split('\n').filter(Boolean) : [],
    },
  }
}

export function selectActiveMessages(state: AppState): ChatMessage[] {
  return getSessionSlice(state.sessionStates, state.activeSessionId).messages
}

export function selectActiveComposer(state: AppState): string {
  return getSessionSlice(state.sessionStates, state.activeSessionId).composer
}

export function selectActiveAttachments(state: AppState) {
  return getSessionSlice(state.sessionStates, state.activeSessionId).attachments
}

export function selectVisibleShelf(state: AppState): ShelfCardModel[] {
  return filterShelfCards(state.shelfCards, state.shelfQuery, state.shelfDomain)
}
