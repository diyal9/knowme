/**
 * 对话气泡：用户/助手均左对齐。
 * 首 Token 只在主进程日志，不进气泡。
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  buildExecutionTimelineView,
  formatElapsed,
  userStatusLabel,
} from '../../../domain/agent-execution-timeline'
import { compactUserShortcutBubbleText } from '../../../domain/agent-shortcut-display'
import { ContentView } from '../content-view/ContentView'
import { AgentFollowUps, AgentGroundingMeta, AgentStructuredUi } from './AgentMessageExtras'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'

function useLiveNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

export function AgentMessageBubble({
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
  const showThinking = (thinking || (live && !body)) && !timeline

  return (
    <div className={`${cls}${timeline ? ' has-execution' : ''}`} data-testid="msg-assistant">
      {timeline ? <AgentExecutionTimeline view={timeline} /> : null}
      {showThinking ? (
        <div className="thinking-status" data-testid="agent-thinking-status">
          <span className="agent-execution-orb" aria-hidden="true" />
          <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>
            {userStatusLabel(message?.activity || '正在处理')}
            {elapsedLabel ? ` · ${elapsedLabel}` : ''}
          </span>
        </div>
      ) : body || children || message ? (
        <>
          {body || children ? (
            <div className="agent-response-body" data-assistant-body="1">
              {body ? (
                <ContentView
                  source={body}
                  caret={streaming ? <span className="stream-cursor" aria-hidden="true">▍</span> : null}
                />
              ) : null}
              {children}
            </div>
          ) : null}
          {message && onStructuredPick ? (
            <AgentStructuredUi message={message} onPick={onStructuredPick} />
          ) : null}
          {message ? <AgentGroundingMeta message={message} /> : null}
          {showFollowUps && modeId && onFollowUp && body && !streaming ? (
            <AgentFollowUps modeId={modeId} onPick={onFollowUp} />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
