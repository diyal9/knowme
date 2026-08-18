/**
 * 工作台对话发送：专家房走 LLM；管线任务房走 Daemon clarify/gate，禁止 aiGenerate。
 */
import { api, type StoreGet, type StoreSet } from '../../app/store-types'
import { createAgentRunId } from '../../../domain/agent-v2-runtime'
import { finalizeGenerateReply, historyTurns, seedStreamingAssistant } from '../../../domain/agent-generate-contract'
import {
  resolveKernelRole,
  workbenchExpertSessionId,
  workbenchRunSessionId,
  workbenchTaskRefForSessionId,
} from '../../../domain/dialogue-lanes'
import {
  pipelineComposerReceipt,
  planPipelineComposerSend,
} from '../../../domain/pipeline-composer-send'
import { invokeStreamingGenerate } from '../assistant/store-generate-invoke'
import { beginAssistantStream, patchLiveAssistantMessage } from '../assistant/store-session'

function daemonResultOk(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const rec = raw as { ok?: boolean; error?: string }
  if (rec.ok === false) return false
  if (rec.error) return false
  return rec.ok === true || rec.ok == null
}

function daemonErrorText(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== 'object') return fallback
  const rec = raw as { error?: string; message?: string }
  return String(rec.error || rec.message || fallback)
}

export function createWorkbenchDialogueActions(set: StoreSet, get: StoreGet) {
  return {
    setWorkbenchComposer: (composer: string) => {
      set({ workbenchDialogue: { ...get().workbenchDialogue, composer } })
    },

    addWorkbenchAttachment: (file: { name: string; text?: string }) => {
      const slice = get().workbenchDialogue
      if (slice.attachments.some((item) => item.name === file.name)) return
      set({ workbenchDialogue: { ...slice, attachments: [...slice.attachments, file] } })
    },

    removeWorkbenchAttachment: (name: string) => {
      const slice = get().workbenchDialogue
      set({
        workbenchDialogue: {
          ...slice,
          attachments: slice.attachments.filter((item) => item.name !== name),
        },
      })
    },

    sendWorkbenchMessage: () => {
      const slice = get().workbenchDialogue
      const text = slice.composer.trim()
      const attachment = slice.attachments[0]
      if ((!text && !attachment) || get().isGenerating) return

      const displayText = text || (attachment ? `（附件：${attachment.name}）` : '')
      const expertRoom = get().expertRoom
      const run = get().run
      const plan = planPipelineComposerSend({
        expertRoom: Boolean(expertRoom),
        run: run && !expertRoom
          ? {
              lane: run.lane,
              clarifyNode: run.clarifyNode,
              gateNode: run.gateNode,
              phase: run.phase,
            }
          : null,
        text: displayText,
      })
      if (plan.kind === 'empty') return

      const user = {
        id: `wu-${Date.now()}`,
        role: 'user' as const,
        text: displayText,
        attachmentName: attachment?.name,
      }

      if (plan.kind !== 'llm') {
        if (!run) return
        const assistant = {
          id: `wa-${Date.now()}`,
          role: 'assistant' as const,
          text: pipelineComposerReceipt(plan),
        }
        set({
          workbenchDialogue: { composer: '', attachments: [] },
          run: {
            ...run,
            dialogueMessages: [...run.dialogueMessages, user, assistant],
          },
        })
        void (async () => {
          const bridge = api()
          if (plan.kind === 'clarify') {
            const result = await bridge?.workbenchDaemonClarify?.(run.slug, {
              node: plan.node,
              answer: plan.answer,
            }).catch((err: unknown) => ({ ok: false, error: String(err) }))
            if (!daemonResultOk(result)) {
              get().showToast(daemonErrorText(result, '澄清提交失败'))
            }
          } else if (plan.kind === 'gate-revise') {
            const result = await bridge?.workbenchDaemonGate?.(run.slug, {
              node: plan.node,
              decision: 'revise',
              comment: plan.comment,
            }).catch((err: unknown) => ({ ok: false, error: String(err) }))
            if (!daemonResultOk(result)) {
              get().showToast(daemonErrorText(result, '修改意见提交失败'))
            }
          }
          await get().refreshRunTelemetry()
        })()
        return
      }

      const bridge = api()
      if (!bridge?.aiGenerate) {
        get().showToast('助手 API 未就绪，请重启应用')
        return
      }

      const assistantId = `wa-${Date.now()}`
      const runId = createAgentRunId()
      const expert = expertRoom
        ? get().hubItems.find((item) => item.id === expertRoom.id)
        : null
      const role = resolveKernelRole({
        agentId: expertRoom?.id,
        expertId: expertRoom?.id,
        category: expert?.category,
        kind: expert?.kind,
        name: expert?.name || expertRoom?.name,
        description: expert?.description,
      })
      const sessionId = expertRoom
        ? workbenchExpertSessionId(expertRoom.id)
        : workbenchRunSessionId(run?.slug || run?.workflowId || 'run')
      const assistant = seedStreamingAssistant(assistantId, runId)
      const priorHistory = historyTurns(expertRoom?.messages || run?.dialogueMessages || [])

      if (expertRoom) {
        set({
          isGenerating: true,
          generateRunId: runId,
          assistantStatus: '正在生成…',
          workbenchDialogue: { composer: '', attachments: [] },
          expertRoom: {
            ...expertRoom,
            messages: [...expertRoom.messages, user, assistant],
          },
        })
      } else if (run) {
        set({
          isGenerating: true,
          generateRunId: runId,
          assistantStatus: '正在生成…',
          workbenchDialogue: { composer: '', attachments: [] },
          run: {
            ...run,
            dialogueMessages: [...run.dialogueMessages, user, assistant],
          },
        })
      } else {
        return
      }

      beginAssistantStream(assistantId, sessionId, set)

      void (async () => {
        const result = await invokeStreamingGenerate({
          get,
          runId,
          prompt: text,
          displayPrompt: displayText,
          sessionId,
          agentId: role,
          role,
          expertId: expertRoom?.id,
          surface: 'workbench',
          taskRef: workbenchTaskRefForSessionId(sessionId),
          history: priorHistory,
          attachment,
          task: get().run ? { intent: get().run?.brief || get().run?.workflowName, slug: get().run?.slug } : null,
        })
        if (get().generateRunId !== runId) return

        set((state) => {
          const existing = (state.expertRoom?.messages || state.run?.dialogueMessages || [])
            .find((m) => m.id === assistantId)
          const final = finalizeGenerateReply(existing, result)
          return {
            isGenerating: false,
            generateRunId: '',
            assistantStatus: result.cancelled ? '已停止' : (result.resultError ? '生成失败' : ''),
            ...patchLiveAssistantMessage(state, assistantId, (msg) => ({
              ...msg,
              role: final.role,
              text: final.text,
              streaming: false,
              thinking: false,
              activity: final.activity,
              elapsedMs: msg.startedAt ? Date.now() - msg.startedAt : msg.elapsedMs,
              firstTokenMs: msg.firstTokenMs || (final.text && msg.startedAt ? Date.now() - msg.startedAt : msg.firstTokenMs),
            }), sessionId),
          }
        })
        if (result.resultError && !result.cancelled) get().showToast(result.resultError)
      })()
    },
  }
}
