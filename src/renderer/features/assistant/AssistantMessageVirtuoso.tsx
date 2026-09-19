/**
 * 助理消息列表：≤40 条直渲；更长时用 Virtuoso 只挂载视口附近气泡。
 */
import { forwardRef, useLayoutEffect, useState, type ReactNode } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { ChatMessage } from '../../../shared/api'
import type { AssistantModeId } from '../../../domain/assistant-modes'
import { extractImageUrls, removeExtractedImageReferences } from '../../../domain/agent-session'
import { conversationFileKind, conversationFileKindLabel } from '../../../domain/conversation-file'
import { INCOMPLETE_ASSISTANT_REPLY } from '../../../domain/agent-v2-runtime'
import { AgentMessageBubble } from './AgentMessageBubble'
import { agentTurnElapsedMs, AgentTurnDivider } from './AgentTurnDivider'
import { useArtifactPreviewSource } from '../artifact/useArtifactPreviewSource'

/** 超过此条数才启用 Virtuoso，短对话避免虚拟化调度开销与测试环境零高问题 */
export const ASSISTANT_VIRTUOSO_THRESHOLD = 40

function AssistantMessageImage({ url, index, total, onOpen }: { url: string; index: number; total: number; onOpen: () => void }) {
  const resolved = useArtifactPreviewSource(url)
  const [failed, setFailed] = useState(false)
  const source = failed ? '' : resolved.source
  return (
    <button
      type="button"
      className="agent-msg-image"
      data-testid="agent-msg-image"
      aria-label={`查看第 ${index + 1} 张图片`}
      onClick={onOpen}
      disabled={!source}
    >
      {source ? <img src={source} alt="" onError={() => setFailed(true)} /> : <span className="agent-msg-image-unavailable">{resolved.loading ? '正在读取图片…' : '图片暂时不可用'}</span>}
      {source && total === 1 ? <span className="agent-msg-image-hint">点击查看原图</span> : null}
    </button>
  )
}

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
  ctx: Omit<AssistantMessageVirtuosoProps, 'messages' | 'chatLogRef' | 'footer'> & { messagesBefore: ChatMessage[] },
) {
  const images = extractImageUrls(m.text)
  const displayText = images.length ? removeExtractedImageReferences(m.text, images) : m.text
  const userIdx = m.role === 'user' ? index : undefined
  const role = m.role === 'user' ? 'user' : 'assistant'
  const isLastAssistant = m.id === ctx.lastAssistantId && m.role === 'assistant'
  const userIndex = ctx.messagesBefore.map((item) => item.role).lastIndexOf('user')
  const priorUser = userIndex >= 0 ? ctx.messagesBefore[userIndex] : null
  const isFirstAssistantReply = m.role === 'assistant' && !m.streaming && Boolean(priorUser)
    && !ctx.messagesBefore.slice(userIndex + 1).some((item) => item.role === 'assistant')
  const userInput = priorUser?.text || ''
  return (
    <div className="agent-virtuoso-row" data-message-index={index}>
      {isFirstAssistantReply && priorUser ? <AgentTurnDivider elapsedMs={agentTurnElapsedMs(priorUser, m)} /> : null}
      <AgentMessageBubble
        role={role}
        text={m.thinking && !displayText ? undefined : displayText}
        userMsgIdx={userIdx}
        streaming={m.streaming}
        thinking={m.thinking && !m.text}
        error={m.role === 'error'}
        message={m.role === 'assistant' ? m : undefined}
        modeId={ctx.modeId}
        userInput={userInput}
        showFollowUps={isLastAssistant && !ctx.isGenerating && m.role !== 'error' && m.text !== INCOMPLETE_ASSISTANT_REPLY}
        onFollowUp={ctx.onFollowUp}
        onStructuredPick={ctx.onStructuredPick}
        interactiveStructuredUi={isLastAssistant}
      >
        {m.attachmentName ? (
          <div className="agent-attachment" data-file-kind={conversationFileKind(undefined, m.attachmentName)}>
            <span className="agent-attachment-kind">{conversationFileKindLabel(conversationFileKind(undefined, m.attachmentName))}</span>
            <span className="attachment-name">{m.attachmentName}</span>
          </div>
        ) : null}
        {images.length ? (
          <div className={`agent-message-images${images.length > 1 ? ' is-gallery' : ''}`} aria-label={images.length > 1 ? `已查看 ${images.length} 张图像` : '图片预览'}>
            {images.length > 1 ? <span className="agent-message-images-label">已查看 {images.length} 张图像</span> : null}
            <div className="agent-message-images-strip">
              {images.map((url, imageIndex) => (
                <AssistantMessageImage key={url} url={url} index={imageIndex} total={images.length} onOpen={() => ctx.onImageOpen(url)} />
              ))}
            </div>
          </div>
        ) : null}
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
            <div key={m.id}>{renderMessageRow(m, index, { ...rowCtx, messagesBefore: messages.slice(0, index) })}</div>
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
        followOutput={(atBottom) => (atBottom ? 'auto' : false)}
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        increaseViewportBy={{ top: 480, bottom: 480 }}
        computeItemKey={(_, item) => item.id}
        components={{
          Footer: footer ? () => <>{footer}</> : undefined,
        }}
        itemContent={(index, m) => renderMessageRow(m, index, { ...rowCtx, messagesBefore: messages.slice(0, index) })}
      />
    )
  },
)
