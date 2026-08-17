/**
 * 助理「应用到文件」与会话产物卡：对接内容源读写 + editor_patch 确认。
 * 不负责 Markdown 渲染。
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

    applyAssistantText: async (mode: 'insert' | 'append' | 'replace', text: string) => {
      const body = String(text || '').trim()
      if (!body) {
        get().showToast('没有可应用的内容')
        return
      }
      const session = activeSession(get)
      if (!session?.id) {
        get().showToast('请先打开一个对话 Session')
        return
      }
      const target = get().assistantApplyTarget
      const sourceId = target?.sourceId || get().activeSourceId
      if (!sourceId || !target?.path) {
        get().showToast('请先在文件中心打开一个文件预览')
        return
      }

      if (mode === 'replace') {
        const artifact = {
          type: 'editor_patch',
          title: '替换当前文件全文（待确认）',
          body,
          status: 'draft',
          targetPath: target.path,
          meta: { mode: 'replace', sourceId, path: target.path },
        }
        const res = await api()?.agentArtifactAdd?.({ sessionId: session.id, artifact }) as {
          ok?: boolean
          error?: string
          session?: AgentSession
        } | undefined
        if (!res?.ok) {
          get().showToast(res?.error || '无法创建写入提案')
          return
        }
        if (res.session) mergeSession(set, get, res.session)
        get().showToast('请确认是否允许替换全文')
        return
      }

      // 无光标时 insert 与 append 均落到文末（独立笔记编辑器已退役）
      try {
        const read = await api()?.sourcesReadFile?.({ sourceId, path: target.path }) as {
          ok?: boolean
          content?: string
          error?: string
        } | undefined
        if (read?.ok === false) {
          get().showToast(read.error || '无法读取文件')
          return
        }
        const prev = String(read?.content || '')
        const next = prev
          ? `${prev.replace(/\s+$/, '')}\n\n${body}`
          : body
        const written = await api()?.sourcesWriteFile?.({ sourceId, path: target.path, content: next })
        if (written?.ok === false) {
          get().showToast(written.error || '写入失败')
          return
        }
        await api()?.agentApplyLog?.({
          sessionId: session.id,
          action: mode,
          detail: mode === 'insert' ? '已写入文件（无光标，按追加处理）' : '已追加到文末',
        }).catch(() => null)
        get().showToast(mode === 'insert' ? '已写入文件（无光标，按追加处理）' : '已追加到文末')
      } catch {
        get().showToast('写入失败')
      }
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
