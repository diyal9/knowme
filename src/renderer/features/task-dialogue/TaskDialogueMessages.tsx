/**
 * 任务房共用消息列。思考态隐藏空正文，避免空白气泡盖住动画。
 */
import { useMemo } from 'react'
import type { ChatMessage } from '../../../shared/api'
import { INCOMPLETE_ASSISTANT_REPLY } from '../../../domain/agent-v2-runtime'
import type { AssistantModeId } from '../../../domain/assistant-modes'
import { AgentMessageBubble } from '../assistant/AgentMessageBubble'

export function TaskDialogueMessages({
  messages,
  generating = false,
  modeId,
  followUps = false,
  onPrompt,
}: {
  messages: ChatMessage[]
  generating?: boolean
  modeId?: AssistantModeId
  followUps?: boolean
  onPrompt?: (prompt: string) => void
}) {
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return ''
  }, [messages])

  return (
    <>
      {messages.map((message) => (
        <div className="agent-virtuoso-row" data-message-id={message.id} key={message.id}>
          <AgentMessageBubble
            role={message.role === 'user' ? 'user' : 'assistant'}
            text={message.thinking && !message.text ? undefined : message.text}
            streaming={message.streaming}
            thinking={Boolean(message.thinking && !message.text)}
            error={message.role === 'error'}
            message={message.role === 'assistant' ? message : undefined}
            modeId={modeId}
            showFollowUps={
              followUps
              && message.role === 'assistant'
              && message.id === lastAssistantId
              && !generating
              && Boolean(message.text)
              && message.text !== INCOMPLETE_ASSISTANT_REPLY
              && !message.streaming
            }
            onFollowUp={onPrompt}
          />
        </div>
      ))}
    </>
  )
}
