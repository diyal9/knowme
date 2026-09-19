import type { ReactNode } from 'react'
import type { ChatMessage } from '../../../shared/api'
import { agentTurnElapsedMs, AgentTurnDivider } from '../assistant/AgentTurnDivider'

/**
 * Prefer the measured execution duration. Older restored sessions only have
 * message timestamps, so use the elapsed time from the user's turn as a
 * faithful fallback rather than inventing a duration.
 */
export function expertTurnElapsedMs(user: ChatMessage, assistant: ChatMessage): number {
  return agentTurnElapsedMs(user, assistant)
}

export function ExpertTurnDivider({ elapsedMs }: { elapsedMs: number }) {
  return <AgentTurnDivider as="li" className="wb-expert-turn-divider" elapsedMs={elapsedMs} />
}

/**
 * The single timeline surface for every expert collaboration phase.
 * Message, plan, approval, result, and review turns differ in content but
 * always enter the same ordered stream and inherit the same layout rail.
 */
export function ExpertConversationTimeline({
  children,
  className = '',
  label = '专家协作记录',
  testId,
}: {
  children: ReactNode
  className?: string
  label?: string
  testId?: string
}) {
  return (
    <ol
      className={`wb-expert-conversation-timeline ${className}`.trim()}
      aria-label={label}
      data-testid={testId}
    >
      {children}
    </ol>
  )
}
