import type { ExpertLike } from '../../../domain/expert-present'
import type { ExpertNarrativeMoment } from '../../../domain/expert-collab-narrative'
import { ExpertDialogueFrame } from './ExpertDialogueFrame'

function timeLabel(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const time = new Date(raw)
  if (!Number.isFinite(time.getTime())) return ''
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ExpertNarrativeMomentView({
  moment,
  expert,
  expertName,
}: {
  moment: ExpertNarrativeMoment
  expert: ExpertLike
  expertName: string
}) {
  const isUser = moment.role === 'user'
  const time = timeLabel(moment.createdAt)
  return (
    <ExpertDialogueFrame
      role={isUser ? 'user' : 'expert'}
      name={isUser ? '我' : expertName}
      time={time}
      active={moment.active}
      testId={isUser ? 'expert-user-moment' : 'expert-narrative-moment'}
      dataFeedKind="moment"
    >
        <p>{moment.body}</p>
        {moment.disclosure?.details.length ? (
          <details className="wb-expert-judgement">
            <summary>{moment.disclosure.label}<span aria-hidden="true" /></summary>
            <dl>
              {moment.disclosure.details.map((detail, index) => (
                <div key={`${detail.label}-${index}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
    </ExpertDialogueFrame>
  )
}
