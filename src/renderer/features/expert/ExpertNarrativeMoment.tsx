import type { ExpertLike } from '../../../domain/expert-present'
import type { ExpertNarrativeMoment } from '../../../domain/expert-collab-narrative'
import { useEffect, useMemo, useState } from 'react'
import { ExpertDialogueFrame } from './ExpertDialogueFrame'

function timeLabel(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const time = new Date(raw)
  if (!Number.isFinite(time.getTime())) return ''
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function timeValue(value: unknown) {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function executionTimeLabel(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const totalSeconds = Math.max(1, Math.round(ms / 1000))
  return totalSeconds >= 60
    ? `${Math.floor(totalSeconds / 60)}分钟 ${totalSeconds % 60}秒`
    : `${totalSeconds}秒`
}

function ExpertExecutionMoment({
  moment,
  startedAt,
  endedAt,
}: {
  moment: ExpertNarrativeMoment
  startedAt?: string
  endedAt?: string
}) {
  const execution = moment.execution!
  const running = moment.active === true
  const inspectByDefault = ['failed', 'cancelled', 'needs_input'].includes(execution.status)
  const [open, setOpen] = useState(running || inspectByDefault)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (running) setOpen(true)
    else if (!inspectByDefault) setOpen(false)
  }, [inspectByDefault, running])
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const activityStart = execution.activities.map((item) => timeValue(item.createdAt)).find(Boolean) || 0
  const activityEnd = [...execution.activities].reverse().map((item) => timeValue(item.createdAt)).find(Boolean) || 0
  const start = timeValue(startedAt) || activityStart
  const end = running ? now : (timeValue(endedAt) || activityEnd)
  const elapsed = executionTimeLabel(start && end > start ? end - start : 0)
  const summary = running
    ? `已处理${elapsed ? ` ${elapsed}` : ''}`
    : execution.status === 'failed'
      ? `执行未完成${elapsed ? ` · 用时 ${elapsed}` : ''}`
      : execution.status === 'cancelled'
        ? `执行已取消${elapsed ? ` · 用时 ${elapsed}` : ''}`
        : elapsed ? `用时 ${elapsed}` : '执行过程'
  const activities = useMemo(() => execution.activities.length
    ? execution.activities
    : [{ id: moment.id, kind: 'commentary' as const, body: moment.body }], [execution.activities, moment.body, moment.id])

  return (
    <details
      className={`wb-expert-execution-disclosure${running ? ' is-running' : ''}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-testid="expert-execution-turn"
    >
      <summary aria-label={`${summary}，${open ? '收起执行过程' : '展开执行过程'}`}>
        <span>{summary}</span>
        <i aria-hidden="true" />
      </summary>
      <div className="wb-expert-execution-timeline" role="log" aria-live={running ? 'polite' : 'off'}>
        {activities.map((activity) => (
          <div key={activity.id} className={`wb-expert-execution-activity is-${activity.kind}`}>
            {activity.kind === 'action' ? <span className="wb-expert-execution-action-mark" aria-hidden="true" /> : null}
            <p>{activity.body}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

export function ExpertNarrativeMomentView({
  moment,
  expert,
  expertName,
  executionStartedAt,
  executionEndedAt,
}: {
  moment: ExpertNarrativeMoment
  expert: ExpertLike
  expertName: string
  executionStartedAt?: string
  executionEndedAt?: string
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
      className={moment.execution ? 'wb-expert-execution-turn' : undefined}
    >
        {moment.execution ? (
          <ExpertExecutionMoment moment={moment} startedAt={executionStartedAt} endedAt={executionEndedAt} />
        ) : <p>{moment.body}</p>}
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
