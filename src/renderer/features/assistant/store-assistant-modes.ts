import { BUILTIN_ASSISTANT_MODES } from '../../../domain/assistant-modes'
import {
  dedupeSessionsById,
  mergeSessionRecord,
  normalizeAgentSurfaceTabs,
  parseSessionRecord,
} from '../../../domain/agent-session'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'
import { emptySessionSlice } from './store-session'

export function createAssistantModeActions(set: StoreSet, get: StoreGet) {
  return {
    startAssistantMode: async (modeId: string) => {
      if (get().isGenerating) {
        get().showToast('当前助手正在生成，请稍候')
        return
      }
      const local = { id: `s-${Date.now()}`, title: '新对话', agentId: modeId }
      set((state) => ({
        route: 'assistant',
        sessions: dedupeSessionsById([local, ...state.sessions]),
        activeSessionId: local.id,
        sessionStates: { ...state.sessionStates, [local.id]: emptySessionSlice() },
      }))
      try {
        const created = await api()?.agentSessionNew?.({ agentId: modeId })
        const session = parseSessionRecord(created)
        if (!session) return
        set((state) => {
          const withoutLocal = state.sessions.filter((item) => item.id !== local.id)
          const sessions = mergeSessionRecord(withoutLocal, { ...session, agentId: modeId })
          const { tabs, activeId } = normalizeAgentSurfaceTabs(sessions, session.id)
          const nextStates = { ...state.sessionStates }
          nextStates[session.id] = nextStates[local.id] || emptySessionSlice()
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
        const label = BUILTIN_ASSISTANT_MODES.find((item) => item.id === modeId)?.name || modeId
        get().showToast(`已切换到${label}`)
      } catch {
        get().showToast('切换模式失败')
      }
    },
  }
}
