import { connectorFromStatusPayload, maybeAugmentFeishuPrompt } from '../../../domain/agent-feishu-prompt'
import { buildAgentGeneratePayload } from '../../../domain/agent-v2-runtime'
import { api, type StoreGet } from '../../app/store-types'
import { detachStreamListener, waitForStreamFlush } from './store-session'
import type { ExpertDiscussionContext, ExpertDiscussionMode } from '../../../domain/expert-discussion'
import type { AgentTurnIdentity, ConversationHistoryTurn } from '../../../shared/api'

export async function invokeStreamingGenerate(input: {
  get: StoreGet
  runId: string
  prompt: string
  displayPrompt: string
  sessionId: string
  agentId: string
  role?: string
  expertId?: string
  surface?: string
  taskRef?: { id?: string; kind?: string } | null
  history: ConversationHistoryTurn[]
  turn: AgentTurnIdentity
  attachment?: { name?: string; text?: string; kind?: 'text' | 'image'; mimeType?: string; dataUrl?: string }
  task?: unknown
  skillRefs?: string[]
  conversationMode?: ExpertDiscussionMode
  expertDiscussionContext?: ExpertDiscussionContext
}): Promise<{ cancelled: boolean; resultError: string; resultText: string }> {
  const bridge = api()
  let resultText = ''
  let resultError = ''
  let cancelled = false
  try {
    const prompt = await maybeAugmentFeishuPrompt(input.prompt, async () => {
      const raw = await bridge?.connectorsStatus?.('feishu')
      return connectorFromStatusPayload(raw)
    })
    const result = await bridge!.aiGenerate(buildAgentGeneratePayload({
      prompt,
      displayPrompt: input.displayPrompt,
      sessionId: input.sessionId,
      agentId: input.agentId,
      role: input.role,
      expertId: input.expertId,
      surface: input.surface,
      taskRef: input.taskRef,
      runId: input.runId,
      history: input.history,
      turn: input.turn,
      attachment: input.attachment,
      task: input.task,
      skillRefs: input.skillRefs,
      conversationMode: input.conversationMode,
      expertDiscussionContext: input.expertDiscussionContext,
    }))
    cancelled = Boolean(result?.cancelled)
    resultError = String(result?.error || '').trim()
    resultText = String(result?.text || '').trim()
  } catch (err) {
    resultError = err instanceof Error ? err.message : '发送失败，请稍后重试'
  }
  await waitForStreamFlush()
  detachStreamListener()
  if (input.get().generateRunId !== input.runId) {
    return { cancelled: true, resultError: '', resultText: '' }
  }
  return { cancelled, resultError, resultText }
}
