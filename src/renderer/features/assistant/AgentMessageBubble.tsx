/**
 * 对话气泡：用户/助手均左对齐；流式纯文本、结束后再 lazy Markdown，减 chunk 解析开销。
 * 首 Token 只在主进程日志，不进气泡。不负责分页窗口（见 AssistantPane）。
 */
import { lazy, memo, Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  buildExecutionTimelineView,
  formatElapsed,
  userStatusLabel,
} from '../../../domain/agent-execution-timeline'
import { compactUserShortcutBubbleText } from '../../../domain/agent-shortcut-display'
import { AgentFollowUps, AgentGroundingMeta, AgentStructuredUi } from './AgentMessageExtras'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'
import { AgentPlanChecklist } from './AgentPlanChecklist'

const LazyContentView = lazy(() =>
  import('../content-view/ContentView').then((m) => ({ default: m.ContentView })),
)

function useLiveNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const ms = window.knowme?.perf?.liveNowIntervalMs || 500
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
    <Suspense fallback={<PlainContentFallback text={body} />}>
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
    return (
      <div
        className="agent-bubble user"
        data-testid="msg-user"
        {...(userMsgIdx != null ? { 'data-user-msg-idx': userMsgIdx } : {})}
      >
        {compactUserShortcutBubbleText(text || '') || text}
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
  const timeline = message ? buildExecutionTimelineView(message, now) : null
  const elapsed = Number.isFinite(message?.elapsedMs)
    ? Number(message?.elapsedMs)
    : (live && Number(message?.startedAt) ? now - Number(message?.startedAt) : 0)
  const elapsedLabel = formatElapsed(elapsed)
  // 有时间线时不再叠 thinking 胶囊，避免同一句「正在整理」出现两次
  const showThinking = Boolean(!timeline && (thinking || (live && !body)))

  return (
    <div className={`${cls}${timeline ? ' has-execution' : ''}`} data-testid="msg-assistant">
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
      {showFollowUps && modeId && onFollowUp && body && !streaming ? (
        <AgentFollowUps modeId={modeId} onPick={onFollowUp} />
      ) : null}
    </div>
  )
}

export const AgentMessageBubble = memo(AgentMessageBubbleImpl)
