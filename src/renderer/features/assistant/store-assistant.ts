import {
  parseAssistantModelCatalog,
  parseAssistantProfileModel,
  parseAssistantSkills,
} from '../../../domain/assistant-chrome'
import {
  dedupeSessionsById,
  mergeSessionRecord,
  normalizeAgentSurfaceTabs,
  parseSessionList,
  parseSessionRecord,
} from '../../../domain/agent-session'
import { createAssistantModeActions } from './store-assistant-modes'
import { startAssistantGenerate } from './store-assistant-generate'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'
import type { KnowledgeProviderItem } from '../../../shared/api'
import {
  detachStreamListener,
  emptySessionSlice,
  getSessionSlice,
  hydrateSession,
  patchSession,
  stopLiveStreamingMessages,
} from './store-session'

/** 主进程关 Tab 回执：打开集合为空时会带 createdSessionId */
type CloseTabResult = {
  ok?: boolean
  ui?: { openSessionIds?: string[]; activeSessionId?: string }
  createdSessionId?: string | null
}

export function createAssistantSlice(set: StoreSet, get: StoreGet) {
  return {
    ...createAssistantModeActions(set, get),
    setComposer: (composer: string) => {
      set((state) => ({ sessionStates: patchSession(state.sessionStates, get().activeSessionId, { composer }) }))
    },

    addComposerAttachment: (file: { name: string; kind?: 'text' | 'image'; text?: string; mimeType?: string; dataUrl?: string }) => {
      const sessionId = get().activeSessionId
      set((state) => {
        const slice = getSessionSlice(state.sessionStates, sessionId)
        if (slice.attachments.some((item) => item.name === file.name)) return state
        return {
          sessionStates: patchSession(state.sessionStates, sessionId, {
            attachments: [...slice.attachments, file],
          }),
        }
      })
    },

    removeComposerAttachment: (name: string) => {
      const sessionId = get().activeSessionId
      set((state) => {
        const slice = getSessionSlice(state.sessionStates, sessionId)
        return {
          sessionStates: patchSession(state.sessionStates, sessionId, {
            attachments: slice.attachments.filter((item) => item.name !== name),
          }),
        }
      })
    },

    sendMessage: (overrideText?: string) => startAssistantGenerate(set, get, overrideText),

    stopGenerate: () => {
      const runId = get().generateRunId
      set({ assistantCancelStage: 'requesting_cancel', assistantStatus: '正在请求取消…' })
      const finishCancel = () => {
        detachStreamListener()
        set((state) => ({
          isGenerating: false,
          generateRunId: '',
          assistantStatus: '已取消',
          assistantCancelStage: 'cancelled',
          assistantProcessFeed: '',
          assistantRecovery: { status: 'cancelled', recommendedAction: 'retry' },
          ...stopLiveStreamingMessages(state),
        }))
      }
      if (!runId) {
        finishCancel()
        return
      }
      set({ assistantCancelStage: 'cancelling_children' })
      void api()?.aiCancelRun?.(runId).catch(() => null).finally(finishCancel)
    },

    newSession: () => {
      const activeId = get().activeSessionId
      const active = get().sessions.find((item) => item.id === activeId)
      const activeSlice = getSessionSlice(get().sessionStates, activeId)
      const isBlankActive = active
        && ['新主题', '新助手', '新对话', '对话', '当前协作', 'New Agent'].includes(String(active.title || '').trim())
        && !activeSlice.messages.length
        && !activeSlice.composer.trim()
        && !activeSlice.attachments.length
      if (isBlankActive) return
      const local = {
        id: `s-${Date.now()}`,
        title: '新主题',
        agentId: 'personal',
        sessionKind: 'personal-topic',
        profileId: 'my-knowme',
      }
      set((state) => {
        const tabs = dedupeSessionsById([...state.sessions, local])
        return {
          sessions: tabs,
          activeSessionId: local.id,
          sessionStates: { ...state.sessionStates, [local.id]: emptySessionSlice() },
        }
      })
      void (async () => {
        try {
          const created = await api()?.agentSessionNew?.({
            agentId: 'personal',
            sessionKind: 'personal-topic',
            profileId: 'my-knowme',
          })
          const session = parseSessionRecord(created)
          if (!session) return
          set((state) => {
            const withoutLocal = state.sessions.filter((item) => item.id !== local.id)
            const sessions = mergeSessionRecord(withoutLocal, session)
            const { tabs, activeId } = normalizeAgentSurfaceTabs(sessions, session.id)
            const nextStates = { ...state.sessionStates }
            nextStates[session.id] = nextStates[local.id] || nextStates[session.id] || emptySessionSlice()
            delete nextStates[local.id]
            return {
              sessions: tabs,
              activeSessionId: activeId,
              sessionStates: nextStates,
            }
          })
          void api()?.agentSessionSetUi?.({
            openSessionIds: get().sessions.map((item) => item.id),
            activeSessionId: get().activeSessionId,
          }).catch(() => null)
        } catch {
          /* keep local tab */
        }
      })()
    },

    selectSession: (id: string) => {
      if (!get().sessions.some((s) => s.id === id) && !get().sessionHistory.some((s) => s.id === id)) return
      const fromHistory = get().sessionHistory.find((s) => s.id === id)
      set((state) => {
        const merged = state.sessions.some((s) => s.id === id)
          ? state.sessions
          : fromHistory
            ? dedupeSessionsById([...state.sessions, fromHistory])
            : state.sessions
        const { tabs, activeId } = normalizeAgentSurfaceTabs(merged, id)
        return { activeSessionId: activeId, sessions: tabs }
      })
      void api()?.agentSessionSetUi?.({ activeSessionId: get().activeSessionId }).catch(() => null)
      void hydrateSession(set, get, id)
    },

    loadAssistantSessions: async () => {
      try {
        const parsed = parseSessionList(await api()?.agentSessionList?.())
        if (!parsed.tabs.length && !parsed.history.length) return
        const prevActiveId = get().activeSessionId
        const prevSlice = getSessionSlice(get().sessionStates, prevActiveId)
        const states = { ...get().sessionStates }
        for (const session of parsed.history) {
          if (!states[session.id]) states[session.id] = emptySessionSlice()
        }
        for (const session of parsed.tabs) {
          if (!states[session.id]) states[session.id] = emptySessionSlice()
        }
        const { tabs, activeId } = normalizeAgentSurfaceTabs(parsed.tabs, parsed.activeId)
        if (prevActiveId !== activeId && prevSlice) {
          const nextSlice = getSessionSlice(states, activeId)
          const hasDraft = Boolean(prevSlice.composer.trim() || prevSlice.attachments.length)
          const targetEmpty = !nextSlice.composer.trim() && !nextSlice.attachments.length && !nextSlice.messages.length
          if (hasDraft && targetEmpty) {
            states[activeId] = {
              ...nextSlice,
              composer: prevSlice.composer,
              attachments: [...prevSlice.attachments],
            }
          }
        }
        set({
          sessions: tabs,
          sessionHistory: parsed.history,
          activeSessionId: activeId,
          sessionStates: states,
        })
        const openSessionIds = tabs.map((item) => item.id)
        if (openSessionIds.length) {
          void api()?.agentSessionSetUi?.({ openSessionIds, activeSessionId: activeId }).catch(() => null)
        }
        await hydrateSession(set, get, activeId)
      } catch {
        /* keep in-memory tabs */
      }
    },

    loadAssistantChrome: async () => {
      try {
        const [models, profile, partnerResult, skills, providers] = await Promise.all([
          api()?.llmModels?.(),
          api()?.llmProfile?.(),
          api()?.personalAgentGet?.(),
          api()?.capabilityList?.({ kind: 'skill' }),
          api()?.knowledgeProviderList?.().catch(() => null),
        ])
        const { groups, presets, defaultModelId } = parseAssistantModelCatalog(models)
        const providerList = (providers?.providers || []) as KnowledgeProviderItem[]
        const partnerProfile = partnerResult?.profile || null
        const assistantPartnerName = String(
          partnerProfile?.identity?.displayName || partnerProfile?.name || '',
        ).trim() || 'KnowMe'
        set({
          assistantModels: presets,
          assistantModelGroups: groups,
          assistantModelId: parseAssistantProfileModel(profile, defaultModelId),
          assistantPartnerName,
          assistantSkills: parseAssistantSkills(skills),
          ...(providerList.length ? {
            knowledgeProviders: providerList,
            knowledgeActiveProviderId: providers?.activeProviderId || providerList[0]?.id || get().knowledgeActiveProviderId,
          } : {}),
        })
      } catch {
        // Keep the identity slot stable on a failed preload, but never render
        // the product fallback before this request has settled.
        set({ assistantPartnerName: 'KnowMe' })
      }
      // wiki/okf 仍延后；provider 已在上面预载供专家模式知识菜单
      window.setTimeout(() => {
        void get().loadKnowledge?.()
      }, 0)
    },

    renameSession: async (id: string, title: string) => {
      const next = title.trim() || '对话'
      set({
        sessions: get().sessions.map((item) => item.id === id ? { ...item, title: next } : item),
      })
      await api()?.agentSessionRename?.(id, next).catch(() => null)
    },

    pinSession: async (id: string, pinned: boolean) => {
      set({
        sessions: get().sessions.map((item) => item.id === id ? { ...item, pinned } : item),
      })
      await api()?.agentSessionPin?.(id, pinned).catch(() => null)
    },

    forkSession: async (id: string) => {
      try {
        const raw = await api()?.agentSessionFork?.(id)
        const session = parseSessionRecord(raw)
        if (!session) return
        set((state) => {
          const sessions = mergeSessionRecord(state.sessions, session)
          const { tabs, activeId } = normalizeAgentSurfaceTabs(sessions, session.id)
          return {
            sessions: tabs,
            activeSessionId: activeId,
            sessionStates: { ...state.sessionStates, [session.id]: emptySessionSlice() },
          }
        })
        await hydrateSession(set, get, session.id)
      } catch {
        get().showToast('分叉失败')
      }
    },

    closeSessionTab: async (id: string) => {
      const remaining = get().sessions.filter((item) => item.id !== id)
      // 主进程在打开集合为空时会 createSession 并返回 createdSessionId；渲染层必须采纳，禁止写回旧 Tab
      const res = await api()?.agentSessionCloseTab?.(id).catch(() => null) as CloseTabResult | null | undefined

      if (!remaining.length) {
        const createdId = String(res?.createdSessionId || res?.ui?.activeSessionId || '').trim()
        if (createdId && createdId !== id) {
          set((state) => ({
            sessions: [{ id: createdId, title: '新助手', agentId: 'general' }],
            activeSessionId: createdId,
            sessionStates: {
              ...state.sessionStates,
              [createdId]: state.sessionStates[createdId] || emptySessionSlice(),
            },
          }))
          await hydrateSession(set, get, createdId)
          return
        }
        // 无 IPC 回执时（单测 mock）仍保证落到空白 Session，且不再保留被关 Tab
        set({ sessions: [], activeSessionId: '' })
        get().newSession()
        return
      }

      const rest = normalizeAgentSurfaceTabs(remaining, get().activeSessionId).tabs
      const prevActive = get().activeSessionId
      const nextId = rest.some((item) => item.id === prevActive)
        ? prevActive
        : (rest[0]?.id || prevActive)
      const nextActive = id === prevActive ? nextId : prevActive
      set({ sessions: rest, activeSessionId: nextActive })
      void api()?.agentSessionSetUi?.({
        openSessionIds: rest.map((item) => item.id),
        activeSessionId: nextActive,
      }).catch(() => null)
      if (nextActive && nextActive !== id) await hydrateSession(set, get, nextActive)
    },

    closeSessionTabs: async (ids: string[]) => {
      const drop = new Set(ids.filter(Boolean))
      if (!drop.size) return
      const remaining = get().sessions.filter((item) => !drop.has(item.id))
      let lastRes: CloseTabResult | null = null
      for (const sessionId of drop) {
        lastRes = (await api()?.agentSessionCloseTab?.(sessionId).catch(() => null)) as CloseTabResult | null
      }

      if (!remaining.length) {
        const createdId = String(lastRes?.createdSessionId || lastRes?.ui?.activeSessionId || '').trim()
        if (createdId && !drop.has(createdId)) {
          set((state) => ({
            sessions: [{ id: createdId, title: '新助手', agentId: 'general' }],
            activeSessionId: createdId,
            sessionStates: {
              ...state.sessionStates,
              [createdId]: state.sessionStates[createdId] || emptySessionSlice(),
            },
          }))
          await hydrateSession(set, get, createdId)
          return
        }
        set({ sessions: [], activeSessionId: '' })
        get().newSession()
        return
      }

      const rest = normalizeAgentSurfaceTabs(remaining, get().activeSessionId).tabs
      const activeId = get().activeSessionId
      const nextId = rest.some((item) => item.id === activeId) ? activeId : (rest[0]?.id || activeId)
      set({ sessions: rest, activeSessionId: nextId })
      void api()?.agentSessionSetUi?.({
        openSessionIds: rest.map((item) => item.id),
        activeSessionId: nextId,
      }).catch(() => null)
      if (nextId && drop.has(activeId)) await hydrateSession(set, get, nextId)
    },

    copySessionTranscript: async (id: string) => {
      try {
        const res = await api()?.agentSessionTranscript?.(id) as { ok?: boolean; error?: string; text?: string } | undefined
        if (res?.ok === false) {
          get().showToast(res.error || '复制失败')
          return
        }
        const text = String(res?.text || '').trim()
        if (!text) {
          get().showToast('当前还没有可复制的 Transcript')
          return
        }
        window.api?.copyToClipboard?.(text)
        get().showToast('已复制对话记录')
      } catch {
        get().showToast('复制失败')
      }
    },

    setAssistantModel: async (modelId: string) => {
      set({ assistantModelId: modelId })
      await api()?.llmSetModel?.({ model: modelId }).catch(() => null)
    },

    setSessionExpert: async (expertId: string) => {
      const id = get().activeSessionId
      set({
        sessions: get().sessions.map((item) => item.id === id ? { ...item, expertId } : item),
      })
      await api()?.agentSessionContextUpdate?.(id, { expertId }).catch(() => null)
    },

    toggleSessionKnowledge: async (refId: string) => {
      const id = get().activeSessionId
      const current = get().sessions.find((item) => item.id === id)
      const refs = current?.knowledgeRefs || []
      const next = refs.includes(refId) ? refs.filter((item) => item !== refId) : [...refs, refId]
      set({
        sessions: get().sessions.map((item) => item.id === id ? { ...item, knowledgeRefs: next } : item),
      })
      await api()?.agentSessionContextUpdate?.(id, { knowledgeRefs: next.map((item) => ({ id: item })) }).catch(() => null)
    },

    clearSessionKnowledge: async () => {
      const id = get().activeSessionId
      set({ sessions: get().sessions.map((item) => item.id === id ? { ...item, knowledgeRefs: [] } : item) })
      await api()?.agentSessionContextUpdate?.(id, { knowledgeRefs: [] }).catch(() => null)
    },

    setImageViewer: (imageViewerUrl: string) => set({ imageViewerUrl }),
  }
}
