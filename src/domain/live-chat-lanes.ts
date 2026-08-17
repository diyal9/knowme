import type { ChatMessage } from '../shared/api'

export function mapMessageById(
  messages: ChatMessage[],
  assistantId: string,
  updater: (msg: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((msg) => (msg.id === assistantId ? updater(msg) : msg))
}

export function stopStreamingMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => (
    msg.streaming
      ? { ...msg, streaming: false, thinking: false, activity: '已停止生成' }
      : msg
  ))
}

export function laneHasMessage(messages: ChatMessage[] | undefined, assistantId: string): boolean {
  return Boolean(messages?.some((msg) => msg.id === assistantId))
}

export function laneHasStreaming(messages: ChatMessage[] | undefined): boolean {
  return Boolean(messages?.some((msg) => msg.streaming))
}
