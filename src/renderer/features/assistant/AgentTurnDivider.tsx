import type { ChatMessage } from '../../../shared/api'

function timestamp(value: unknown): number {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Prefer measured execution time; restored history falls back to message timestamps. */
export function agentTurnElapsedMs(user: ChatMessage, assistant: ChatMessage): number {
  const measured = Number(assistant.elapsedMs)
  if (Number.isFinite(measured) && measured > 0) return measured
  const started = Number(assistant.startedAt)
  const repliedAt = timestamp(assistant.createdAt)
  if (Number.isFinite(started) && started > 0 && repliedAt > started) return repliedAt - started
  const requestedAt = timestamp(user.createdAt)
  return requestedAt > 0 && repliedAt > requestedAt ? repliedAt - requestedAt : 0
}

export function AgentTurnDivider({ elapsedMs, as: Tag = 'div', className = '' }: { elapsedMs: number; as?: 'div' | 'li'; className?: string }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return null
  const totalSeconds = Math.max(1, Math.round(elapsedMs / 1000))
  const elapsed = totalSeconds >= 60
    ? `${Math.floor(totalSeconds / 60)}分钟 ${totalSeconds % 60}秒`
    : `${totalSeconds}秒`
  return (
    <Tag className={`agent-turn-divider ${className}`.trim()} aria-label={`本轮用时 ${elapsed}`}>
      <span className="agent-turn-divider-label">用时 {elapsed}<i className="agent-turn-divider-chevron" aria-hidden="true">›</i></span>
    </Tag>
  )
}
