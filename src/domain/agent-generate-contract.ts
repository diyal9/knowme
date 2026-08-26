import type { ChatMessage, ConversationHistoryTurn } from '../shared/api'
import { INCOMPLETE_ASSISTANT_REPLY } from './agent-v2-runtime'
import { seedPrepareTrace } from './agent-execution-timeline'
import { stripLeadingAssistantIdentity } from './assistant-identity'

export function seedStreamingAssistant(id: string, runId: string, createdAt = new Date().toISOString()): ChatMessage {
  return {
    id,
    role: 'assistant',
    text: '',
    createdAt,
    streaming: true,
    thinking: true,
    runId,
    protocolVersion: 2,
    v2AnswerCommitted: false,
    startedAt: Date.now(),
    activity: '正在准备上下文…',
    trace: seedPrepareTrace(),
  }
}

export function historyTurns(messages: ChatMessage[]): ConversationHistoryTurn[] {
  return messages
    .filter((item) => (item.role === 'user' || item.role === 'assistant') && item.text && !item.streaming)
    .map((item) => ({
      id: item.id,
      role: item.role as ConversationHistoryTurn['role'],
      text: item.text,
      ...(item.runId ? { runId: item.runId } : {}),
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
    }))
}

export function finalizeGenerateReply(existing: ChatMessage | undefined, input: {
  cancelled: boolean
  resultError: string
  resultText: string
  displayName?: string
}): { text: string; role: ChatMessage['role']; activity: string } {
  const committed = Boolean(existing?.v2AnswerCommitted && existing.text?.trim())
  const streamedText = stripLeadingAssistantIdentity(existing?.text?.trim() || '', input.displayName)
  if (input.cancelled) {
    return { text: streamedText || '已停止生成', role: existing?.role || 'assistant', activity: '已停止生成' }
  }
  if (input.resultError && !committed) {
    return { text: input.resultError, role: 'error', activity: '生成失败' }
  }
  return {
    text: committed ? streamedText : (streamedText || input.resultText || INCOMPLETE_ASSISTANT_REPLY),
    role: existing?.role || 'assistant',
    activity: '',
  }
}
