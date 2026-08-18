/**
 * 助理消息列表：≤40 条直渲；更长时用 Virtuoso 只挂载视口附近气泡。
 */
import { forwardRef, useLayoutEffect, useState, type ReactNode } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { ChatMessage } from '../../../shared/api'
import type { AssistantModeId } from '../../../domain/assistant-modes'
import { extractImageUrls } from '../../../domain/agent-session'
import { INCOMPLETE_ASSISTANT_REPLY } from '../../../domain/agent-v2-runtime'
import { AgentMessageBubble } from './AgentMessageBubble'

/** 超过此条数才启用 Virtuoso，短对话避免虚拟化调度开销与测试环境零高问题 */
export const ASSISTANT_VIRTUOSO_THRESHOLD = 40

export type AssistantMessageVirtuosoProps = {
  messages: ChatMessage[]
  chatLogRef: React.RefObject<HTMLDivElement | null>
  lastAssistantId: string
  isGenerating: boolean
  modeId?: AssistantModeId
  onFollowUp: (prompt: string) => void
  onStructuredPick: (payload: string, needsInput: boolean) => void
  onImageOpen: (url: string) => void
  footer?: ReactNode
}

function renderMessageRow(
  m: ChatMessage,
  index: number,
  ctx: Omit<AssistantMessageVirtuosoProps, 'messages' | 'chatLogRef' | 'footer'>,
) {
  const images = extractImageUrls(m.text)
  const userIdx = m.role === 'user' ? index : undefined
  const role = m.role === 'user' ? 'user' : 'assistant'
  const isLastAssistant = m.id === ctx.lastAssistantId && m.role === 'assistant'
  return (
    <div className="agent-virtuoso-row" data-message-index={index}>
      <AgentMessageBubble
        role={role}
        text={m.thinking && !m.text ? undefined : m.text}
        userMsgIdx={userIdx}
        streaming={m.streaming}
        thinking={m.thinking && !m.text}
        error={m.role === 'error'}
        message={m.role === 'assistant' ? m : undefined}
        modeId={ctx.modeId}
        showFollowUps={isLastAssistant && !ctx.isGenerating && m.role !== 'error' && m.text !== INCOMPLETE_ASSISTANT_REPLY}
        onFollowUp={ctx.onFollowUp}
        onStructuredPick={ctx.onStructuredPick}
      >
        {m.attachmentName ? (
          <div className="agent-attachment">
            <span className="attachment-name">{m.attachmentName}</span>
          </div>
        ) : null}
        {images.map((url) => (
          <button
            key={url}
            type="button"
            className="agent-msg-image"
            data-testid="agent-msg-image"
            onClick={() => ctx.onImageOpen(url)}
          >
            <img src={url} alt="" />
          </button>
        ))}
      </AgentMessageBubble>
    </div>
  )
}

export const AssistantMessageVirtuoso = forwardRef<VirtuosoHandle, AssistantMessageVirtuosoProps>(
  function AssistantMessageVirtuoso(props, ref) {
    const {
      messages,
      chatLogRef,
      lastAssistantId,
      isGenerating,
      modeId,
      onFollowUp,
      onStructuredPick,
      onImageOpen,
      footer,
    } = props
    const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null)
    const rowCtx = {
      lastAssistantId,
      isGenerating,
      modeId,
      onFollowUp,
      onStructuredPick,
      onImageOpen,
    }

    useLayoutEffect(() => {
      setScrollParent(chatLogRef.current)
    }, [chatLogRef, messages.length])

    if (messages.length === 0) return null

    if (messages.length <= ASSISTANT_VIRTUOSO_THRESHOLD) {
      return (
        <div className="agent-chat-static-list" data-testid="agent-message-static-list">
          {messages.map((m, index) => (
            <div key={m.id}>{renderMessageRow(m, index, rowCtx)}</div>
          ))}
          {footer}
        </div>
      )
    }

    if (!scrollParent) return null

    return (
      <Virtuoso
        ref={ref}
        className="agent-chat-virtuoso"
        data-testid="agent-message-virtuoso"
        customScrollParent={scrollParent}
        data={messages}
        followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        increaseViewportBy={{ top: 480, bottom: 480 }}
        computeItemKey={(_, item) => item.id}
        components={{
          Footer: footer ? () => <>{footer}</> : undefined,
        }}
        itemContent={(index, m) => renderMessageRow(m, index, rowCtx)}
      />
    )
  },
)
