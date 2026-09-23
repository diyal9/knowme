/**
 * 助理消息列表：≤40 条直渲；更长时用 Virtuoso 只挂载视口附近气泡。
 */
import { forwardRef, memo, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
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
  ctx: Omit<AssistantMessageVirtuosoProps, 'messages' | 'chatLogRef' | 'footer'> & {
    priorUser: ChatMessage | null
    isFirstAssistantReply: boolean
  },
) {
  const images = extractImageUrls(m.text)
  const displayText = images.length ? removeExtractedImageReferences(m.text, images) : m.text
  const userIdx = m.role === 'user' ? index : undefined
  const role = m.role === 'user' ? 'user' : 'assistant'
  const isLastAssistant = m.id === ctx.lastAssistantId && m.role === 'assistant'
  const priorUser = ctx.priorUser
  const isFirstAssistantReply = ctx.isFirstAssistantReply
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

type AssistantMessageRowProps = {
  message: ChatMessage
  index: number
  rowCtx: Omit<AssistantMessageVirtuosoProps, 'messages' | 'chatLogRef' | 'footer'> & {
    priorUser: ChatMessage | null
    isFirstAssistantReply: boolean
  }
}

// Progress events update the active message while all earlier messages remain
// identical. Memoize each row so a live run does not re-scan and re-normalize
// every historical answer on every status tick.
const AssistantMessageRow = memo(function AssistantMessageRow({ message, index, rowCtx }: AssistantMessageRowProps) {
  return renderMessageRow(message, index, rowCtx)
}, (prev, next) => {
  if (prev.message !== next.message || prev.index !== next.index) return false
  const a = prev.rowCtx
  const b = next.rowCtx
  return a.lastAssistantId === b.lastAssistantId
    && a.isGenerating === b.isGenerating
    && a.modeId === b.modeId
    && a.onFollowUp === b.onFollowUp
    && a.onStructuredPick === b.onStructuredPick
    && a.onImageOpen === b.onImageOpen
    && a.priorUser === b.priorUser
    && a.isFirstAssistantReply === b.isFirstAssistantReply
})

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
    const rowMeta = useMemo(() => {
      const meta: Array<{ priorUser: ChatMessage | null; isFirstAssistantReply: boolean }> = []
      let priorUser: ChatMessage | null = null
      let assistantSinceUser = false
      for (const message of messages) {
        meta.push({
          priorUser,
          isFirstAssistantReply: message.role === 'assistant'
            && !message.streaming
            && Boolean(priorUser)
            && !assistantSinceUser,
        })
        if (message.role === 'user') {
          priorUser = message
          assistantSinceUser = false
        } else if (message.role === 'assistant') {
          assistantSinceUser = true
        }
      }
      return meta
    }, [messages])

    useLayoutEffect(() => {
      setScrollParent(chatLogRef.current)
    }, [chatLogRef, messages.length])

    if (messages.length === 0) return null

    if (messages.length <= ASSISTANT_VIRTUOSO_THRESHOLD) {
      return (
        <div className="agent-chat-static-list" data-testid="agent-message-static-list">
          {messages.map((m, index) => (
            <div key={m.id}>
              <AssistantMessageRow message={m} index={index} rowCtx={{ ...rowCtx, ...rowMeta[index] }} />
            </div>
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
          itemContent={(index, m) => (
            <AssistantMessageRow message={m} index={index} rowCtx={{ ...rowCtx, ...rowMeta[index] }} />
          )}
      />
    )
  },
)
