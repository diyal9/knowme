import type { ChatMessage } from '../../../shared/api'
import { compactUserShortcutBubbleText } from '../../../domain/agent-shortcut-display'
import { conversationMessageId, createAgentRunId, INCOMPLETE_ASSISTANT_REPLY } from '../../../domain/agent-v2-runtime'
import { settleExecutionTrace } from '../../../domain/agent-execution-timeline'
import { finalizeGenerateReply, historyTurns, seedStreamingAssistant } from '../../../domain/agent-generate-contract'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'
import { invokeStreamingGenerate } from './store-generate-invoke'
import {
  beginAssistantStream,
  getSessionSlice,
  patchAssistantMessage,
  patchSession,
} from './store-session'

export function startAssistantGenerate(set: StoreSet, get: StoreGet, overrideText?: string) {
  const sessionId = get().activeSessionId
  const slice = getSessionSlice(get().sessionStates, sessionId)
  const text = String(overrideText ?? slice.composer).trim()
  const attachment = slice.attachments[0]
  if ((!text && !attachment) || get().isGenerating) return

  const bridge = api()
  if (!bridge?.aiGenerate) {
    get().showToast('助手 API 未就绪，请重启应用')
    return
  }

  const displayText = compactUserShortcutBubbleText(text)
    || (attachment ? `（附件：${attachment.name}）` : '')
  const runId = createAgentRunId()
  const userCreatedAt = new Date().toISOString()
  const session = get().sessions.find((item) => item.id === sessionId)
  const assistantDisplayName = get().assistantPartnerName || 'KnowMe'
  const userId = conversationMessageId(runId, 'user')
  const assistantId = conversationMessageId(runId, 'assistant')
  const user: ChatMessage = {
    id: userId,
    role: 'user',
    text: displayText,
    runId,
    createdAt: userCreatedAt,
    attachmentName: attachment?.name,
  }
  const assistant = seedStreamingAssistant(assistantId, runId, userCreatedAt)

  set((state) => ({
    isGenerating: true,
    generateRunId: runId,
    assistantStatus: '正在生成…',
    assistantProcessFeed: '',
    assistantCancelStage: '',
    assistantRecovery: null,
    sessionStates: patchSession(state.sessionStates, sessionId, {
      composer: '',
      attachments: [],
      messages: [...slice.messages, user, assistant],
    }),
  }))
  beginAssistantStream(assistantId, sessionId, set)

  void (async () => {
    const result = await invokeStreamingGenerate({
      get,
      runId,
      prompt: text,
      displayPrompt: displayText,
      sessionId,
      agentId: session?.agentId || session?.expertId || 'general',
      role: session?.agentId,
      surface: 'assistant',
      history: historyTurns(slice.messages),
      turn: {
        userMessageId: userId,
        assistantMessageId: assistantId,
        userCreatedAt,
      },
      attachment,
    })
    if (get().generateRunId !== runId) return

    set((state) => {
      const existing = getSessionSlice(state.sessionStates, sessionId).messages.find((m) => m.id === assistantId)
      const final = finalizeGenerateReply(existing, { ...result, displayName: assistantDisplayName })
      const terminalStatus = result.cancelled
        ? 'cancelled' as const
        : (result.resultError || final.role === 'error' || final.text === INCOMPLETE_ASSISTANT_REPLY)
          ? 'error' as const
          : 'done' as const
      return {
        isGenerating: false,
        generateRunId: '',
        assistantStatus: '',
        assistantProcessFeed: '',
        assistantCancelStage: '',
        assistantRecovery: result.resultError && !result.cancelled
          ? { status: 'failed', code: 'generate_failed', recommendedAction: 'retry' }
          : null,
        sessionStates: patchAssistantMessage(state.sessionStates, sessionId, assistantId, (msg) => ({
          ...msg,
          role: final.role,
          text: final.text,
          streaming: false,
          thinking: false,
          activity: final.activity,
          trace: settleExecutionTrace(msg.trace, terminalStatus),
          elapsedMs: msg.startedAt ? Date.now() - msg.startedAt : msg.elapsedMs,
          firstTokenMs: msg.firstTokenMs || (final.text && msg.startedAt ? Date.now() - msg.startedAt : msg.firstTokenMs),
        })),
      }
    })
    if (result.resultError && !result.cancelled) get().showToast(result.resultError)
    void get().refreshActiveSessionArtifacts?.()
  })()
}
