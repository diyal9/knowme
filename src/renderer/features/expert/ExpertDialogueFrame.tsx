import type { ReactNode } from 'react'

export function ExpertDialogueFrame({
  role,
  name,
  time,
  active = false,
  error = false,
  testId,
  dataFeedKind,
  className,
  articleClassName,
  headerClassName,
  ariaLabel,
  children,
}: {
  role: 'user' | 'expert'
  name: string
  time?: string
  active?: boolean
  error?: boolean
  testId?: string
  dataFeedKind?: string
  className?: string
  articleClassName?: string
  headerClassName?: string
  ariaLabel?: string
  children: ReactNode
}) {
  const isUser = role === 'user'
  return (
    <li
      className={`wb-expert-dialogue-turn ${isUser ? 'is-user' : 'is-expert'}${error ? ' is-error' : ''}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      data-testid={testId}
      data-feed-kind={dataFeedKind}
      aria-label={ariaLabel}
    >
      <article className={articleClassName}>
        <header className={headerClassName}>
          <strong>{name}</strong>
          {time ? <time>{time}</time> : null}
        </header>
        {children}
      </article>
    </li>
  )
}
