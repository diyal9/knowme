/**
 * 对话气泡：用户/助手均左对齐；流式纯文本、结束后再 lazy Markdown，减 chunk 解析开销。
 * 首 Token 只在主进程日志，不进气泡。不负责分页窗口（见 AssistantPane）。
 */
import { lazy, memo, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '../../app/store'
import {
  buildExecutionTimelineView,
  formatElapsed,
  userStatusLabel,
} from '../../../domain/agent-execution-timeline'
import { compactUserShortcutBubbleText } from '../../../domain/agent-shortcut-display'
import { AgentGroundingMeta, AgentStructuredUi } from './AgentMessageExtras'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'
import { AgentMessageActions } from './AgentMessageActions'
import { AgentPlanChecklist } from './AgentPlanChecklist'

const LazyContentView = lazy(() =>
  import('../content-view/ContentView').then((m) => ({ default: m.ContentView })),
)

function useLiveNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    // Elapsed time is secondary information; updating it twice per second
    // makes the thinking shell feel like it is flashing during short replies.
    const ms = window.knowme?.perf?.liveNowIntervalMs || 1000
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

/** lazy 加载前以纯文本占位，避免长对话首屏阻塞 Markdown 解析 */
function PlainContentFallback({ text, caret }: { text: string; caret?: ReactNode }) {
  return (
    <div className="agent-md-fallback" data-testid="content-view-fallback">
      {text}
      {caret}
    </div>
  )
}

/** 非流式消息的安全占位：Markdown 懒加载期间不展示原始协议文本。 */
function ContentPendingFallback() {
  return (
    <div
      className="agent-md-fallback agent-md-loading"
      data-testid="content-view-loading"
      aria-busy="true"
      aria-label="正在整理内容"
    >
      正在整理内容…
    </div>
  )
}

const USER_URL_RE = /https?:\/\/[^\s<>]+/gi

function readableUrlLabel(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const path = decodeURIComponent(url.pathname).split('/').filter(Boolean).pop() || url.hostname
    return path.replace(/[-_]+/g, ' ').replace(/\.(md|markdown|html?|txt)$/i, '').trim() || url.hostname
  } catch {
    return rawUrl
  }
}

function UserMessageContent({ text }: { text: string }) {
  const openLinkPreview = useAppStore((state) => state.openLinkPreview)
  const titleCache = useAppStore((state) => state.linkTitleCache)
  const cacheLinkTitle = useAppStore((state) => state.cacheLinkTitle)
  const attemptedTitles = useRef(new Set<string>())
  const chunks = text.split(USER_URL_RE)
  const urls = text.match(USER_URL_RE) || []
  const urlKey = urls.join('\n')
  useEffect(() => {
    let cancelled = false
    const pending = urls.filter((url) => !titleCache[url] && !attemptedTitles.current.has(url))
    if (!pending.length) return () => { cancelled = true }
    pending.forEach((url) => attemptedTitles.current.add(url))
    void Promise.all(pending.slice(0, 3).map(async (url) => {
      try {
        const result = await window.api?.resolveLinkTitle?.(url)
        if (!cancelled && result?.ok && result.title) cacheLinkTitle(url, result.title)
      } catch { /* 标题预取失败时保留可读 URL 标签 */ }
    }))
    return () => { cancelled = true }
  }, [cacheLinkTitle, titleCache, urlKey])
  return (
    <>
      {chunks.map((chunk, index) => (
        <span key={`${index}-${chunk.slice(0, 12)}`}>
          {chunk}
          {index < urls.length ? (() => {
            const rawHref = urls[index]
            const href = rawHref.replace(/[),.;，。；！？]+$/, '')
            const suffix = rawHref.slice(href.length)
            const label = titleCache[href] || readableUrlLabel(href)
            return (
              <>
                <a
                  className="agent-user-link"
                  href={href}
                  title={href}
                  onClick={(event) => {
                    event.preventDefault()
                    openLinkPreview(href, label, { resolveTitle: true })
                  }}
                >
                  {label}
                </a>
                {suffix}
              </>
            )
          })() : null}
        </span>
      ))}
    </>
  )
}

function AssistantBodyContent({
  body,
  streaming,
  caret,
}: {
  body: string
  streaming: boolean
  caret?: ReactNode
}) {
  // 流式期间预拉 ContentView 包，结束切 Markdown 时少等一轮网络/解析
  useEffect(() => {
    if (streaming) void import('../content-view/ContentView')
  }, [streaming])

  if (streaming) {
    return <PlainContentFallback text={body} caret={caret} />
  }

  return (
    <Suspense fallback={<ContentPendingFallback />}>
      <LazyContentView source={body} streaming={false} />
    </Suspense>
  )
}

function AgentMessageBubbleImpl({
  role,
  text,
  userMsgIdx,
  streaming,
  thinking,
  error,
  message,
  userInput,
  modeId,
  showFollowUps,
  onFollowUp,
  onStructuredPick,
  children,
}: {
  role: 'user' | 'assistant' | 'system'
  text?: string
  userMsgIdx?: number
  streaming?: boolean
  thinking?: boolean
  error?: boolean
  message?: import('../../../shared/api').ChatMessage
  userInput?: string
  modeId?: import('../../../domain/assistant-modes').AssistantModeId
  showFollowUps?: boolean
  onFollowUp?: (prompt: string) => void
  onStructuredPick?: (payload: string, needsInput: boolean) => void
  children?: ReactNode
}) {
  const live = role === 'assistant' && Boolean(streaming || thinking)
  const now = useLiveNow(live)
  const body = String(text || '').trim()

  if (role === 'system') {
    return (
      <button type="button" className="msg system">
        {text}
        {children}
      </button>
    )
  }

  if (role === 'user') {
    const userText = compactUserShortcutBubbleText(text || '') || text
    return (
      <div
        className="agent-bubble user conversation-turn conversation-turn-user"
        data-testid="msg-user"
        aria-label="你的消息"
        {...(userMsgIdx != null ? { 'data-user-msg-idx': userMsgIdx } : {})}
      >
        <div className="agent-user-message" data-testid="user-message-content">
          <UserMessageContent text={userText || ''} />
        </div>
        {children}
      </div>
    )
  }

  const cls = [
    'agent-bubble',
    'assistant',
    streaming ? 'streaming' : '',
    thinking ? 'thinking' : '',
    error ? 'err' : '',
  ].filter(Boolean).join(' ')
  const rawTimeline = message ? buildExecutionTimelineView(message, now) : null
  // A lone prepare/model stage is an internal lifecycle detail. Keep simple
  // chat on one stable thinking surface, but retain the timeline for genuine
  // tools/sub-runs and multi-step reasoning (the expandable process view).
  const hasRealExecution = Boolean(message?.trace?.some((item) => item.kind === 'tool' || item.kind === 'subrun'))
  const hasMultiStepTrace = (message?.trace?.length || 0) > 1
  const timeline = rawTimeline && (hasRealExecution || hasMultiStepTrace) ? rawTimeline : null
  const elapsed = Number.isFinite(message?.elapsedMs)
    ? Number(message?.elapsedMs)
    : (live && Number(message?.startedAt) ? now - Number(message?.startedAt) : 0)
  const elapsedLabel = formatElapsed(elapsed)
  // 有时间线时不再叠 thinking 胶囊，避免同一句「正在整理」出现两次
  const showThinking = Boolean(!timeline && (thinking || (live && !body)))

  return (
    <article
      className={`${cls} conversation-turn conversation-turn-assistant${timeline ? ' has-execution' : ''}`}
      data-testid="msg-assistant"
      aria-label="KnowMe 回复"
    >
      {(timeline || (showThinking && !body)) ? (
        <div className="agent-activity-surface" data-testid="agent-activity-surface">
          {timeline ? <AgentExecutionTimeline view={timeline} /> : null}
          {showThinking && !body ? (
            <div className="thinking-status" data-testid="agent-thinking-status">
              <span className="agent-execution-orb" aria-hidden="true" />
              <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
              <span>
                {userStatusLabel(message?.activity || '正在处理')}
                {elapsedLabel ? ` · ${elapsedLabel}` : ''}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {body || children ? (
        <div className="agent-response-body" data-assistant-body="1">
          {body ? (
            <AssistantBodyContent
              body={body}
              streaming={Boolean(streaming)}
              caret={streaming ? <span className="stream-cursor" aria-hidden="true">▍</span> : null}
            />
          ) : null}
          {children}
        </div>
      ) : null}
      {message ? <AgentPlanChecklist message={message} /> : null}
      {message && onStructuredPick ? (
        <AgentStructuredUi message={message} onPick={onStructuredPick} />
      ) : null}
      {message ? <AgentGroundingMeta message={message} /> : null}
      {/* 底部操作只允许模型通过 structuredUi 明确声明；不再根据关键词猜测。 */}
      {body && !streaming && !error ? <AgentMessageActions text={body} timestamp={message?.startedAt} /> : null}
    </article>
  )
}

export const AgentMessageBubble = memo(AgentMessageBubbleImpl)
