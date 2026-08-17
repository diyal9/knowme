import type { ChatMessage } from '../shared/api'
import { INCOMPLETE_ASSISTANT_REPLY } from './agent-v2-runtime'
import { seedPrepareTrace } from './agent-execution-timeline'

export function seedStreamingAssistant(id: string, runId: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    text: '',
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

export function historyTurns(messages: ChatMessage[]): { role: string; text: string }[] {
  return messages
    .filter((item) => (item.role === 'user' || item.role === 'assistant') && item.text && !item.streaming)
    .map((item) => ({ role: item.role, text: item.text }))
}

export function finalizeGenerateReply(existing: ChatMessage | undefined, input: {
  cancelled: boolean
  resultError: string
  resultText: string
}): { text: string; role: ChatMessage['role']; activity: string } {
  const committed = Boolean(existing?.v2AnswerCommitted && existing.text?.trim())
  const streamedText = existing?.text?.trim() || ''
  if (input.cancelled) {
    return { text: streamedText || '已停止生成', role: existing?.role || 'assistant', activity: '已停止生成' }
  }
  if (input.resultError && !committed) {
    return { text: input.resultError, role: 'error', activity: '生成失败' }
  }
  return {
    text: committed ? existing!.text : (streamedText || input.resultText || INCOMPLETE_ASSISTANT_REPLY),
    role: existing?.role || 'assistant',
    activity: '',
  }
}
