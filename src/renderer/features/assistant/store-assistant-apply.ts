/**
 * 助理会话产物卡：对接内容源写入与 editor_patch 确认。
 * 不负责气泡套用菜单（便签编辑器已退役）。
 */
import type { AgentRunArtifact, AgentSession } from '../../../shared/api'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'

function activeSession(get: StoreGet): AgentSession | undefined {
  const id = get().activeSessionId
  return get().sessions.find((item) => item.id === id)
}

function mergeSession(set: StoreSet, get: StoreGet, session: AgentSession) {
  set({
    sessions: get().sessions.map((item) => (item.id === session.id ? { ...item, ...session } : item)),
  })
}

export function createAssistantApplySlice(set: StoreSet, get: StoreGet) {
  return {
    assistantApplyTarget: null as null | { sourceId: string; path: string },

    setAssistantApplyTarget: (target: { sourceId: string; path: string } | null) => {
      set({ assistantApplyTarget: target })
    },

    acceptAssistantArtifact: async (artifactId: string) => {
      const session = activeSession(get)
      if (!session?.id) return
      const art = (session.run?.artifacts || []).find((item) => item.id === artifactId)
      const res = await api()?.agentArtifactAccept?.({
        sessionId: session.id,
        artifactId,
      }) as {
        ok?: boolean
        error?: string
        session?: AgentSession
        editorPatch?: boolean
        body?: string
      } | undefined
      if (!res?.ok) {
        get().showToast(res?.error || '接受失败')
        return
      }
      if (res.editorPatch && res.body) {
        const sourceId = art?.meta?.sourceId || get().assistantApplyTarget?.sourceId || get().activeSourceId
        const path = art?.meta?.path || art?.targetPath || get().assistantApplyTarget?.path
        if (sourceId && path) {
          const written = await api()?.sourcesWriteFile?.({ sourceId, path, content: res.body })
          if (written?.ok === false) {
            get().showToast(written.error || '写入文件失败')
          } else {
            get().showToast('已写入文件')
          }
        } else {
          get().showToast('缺少目标路径，提案已接受但未写入磁盘')
        }
      } else {
        get().showToast('已接受')
      }
      if (res.session) mergeSession(set, get, res.session)
    },

    rejectAssistantArtifact: async (artifactId: string) => {
      const session = activeSession(get)
      if (!session?.id) return
      const res = await api()?.agentArtifactReject?.({
        sessionId: session.id,
        artifactId,
      }) as { ok?: boolean; error?: string; session?: AgentSession } | undefined
      if (!res?.ok) {
        get().showToast(res?.error || '拒绝失败')
        return
      }
      if (res.session) mergeSession(set, get, res.session)
      get().showToast('已拒绝')
    },

    refreshActiveSessionArtifacts: async () => {
      try {
        const list = await api()?.agentSessionList?.()
        const sessions = (list?.sessions || []) as AgentSession[]
        const activeId = get().activeSessionId
        const fresh = sessions.find((item) => item.id === activeId)
        if (!fresh) return
        mergeSession(set, get, fresh)
      } catch {
        /* ignore */
      }
    },
  }
}

export type AssistantApplySlice = ReturnType<typeof createAssistantApplySlice>

export function selectActiveArtifacts(sessions: AgentSession[], activeSessionId: string): AgentRunArtifact[] {
  const session = sessions.find((item) => item.id === activeSessionId)
  return session?.run?.artifacts || []
}
