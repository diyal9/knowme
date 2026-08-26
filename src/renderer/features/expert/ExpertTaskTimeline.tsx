import type { WorkbenchTask } from '../../../shared/api'
import { expertTaskEventLabel } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { ExpertAvatarMark } from './ExpertAvatarMark'

type TaskEvent = NonNullable<WorkbenchTask['events']>[number]

const USER_EVENTS = new Set(['input_provided', 'changes_requested', 'deliverable_accepted'])
const SYSTEM_EVENTS = new Set([
  'task_created',
  'preflight_started',
  'preflight_passed',
  'preflight_failed',
  'task_failed',
  'task_cancelled',
  'execution_contract_upgraded',
])

function eventRole(type: unknown): 'expert' | 'user' | 'system' {
  const key = String(type || '')
  if (USER_EVENTS.has(key)) return 'user'
  if (SYSTEM_EVENTS.has(key)) return 'system'
  return 'expert'
}

function eventKind(type: unknown): string {
  const key = String(type || '')
  if (['task_created', 'preflight_started', 'preflight_passed', 'execution_contract_upgraded'].includes(key)) return '任务理解'
  if (['input_requested', 'preflight_failed'].includes(key)) return '需要确认'
  if (key === 'input_provided') return '用户补充'
  if (key === 'task_started') return '执行计划'
  if (key === 'progress') return '进度更新'
  if (['deliverable_created', 'deliverable_submitted'].includes(key)) return '阶段成果'
  if (key === 'changes_requested') return '修改意见'
  if (key === 'revision_ready') return '修改版本'
  if (['deliverable_accepted', 'task_completed'].includes(key)) return '正式交付'
  if (['task_failed', 'task_cancelled'].includes(key)) return '异常记录'
  return '协作更新'
}

function displayEventSummary(event: TaskEvent) {
  const summary = String(event.summary || '').trim()
  const title = expertTaskEventLabel(event.type, event.summary)
  return summary && summary !== title ? summary : ''
}

export function ExpertTaskTimeline({
  events,
  expertId,
  expertName,
  hasActiveStep,
}: {
  events: TaskEvent[]
  expertId: string
  expertName: string
  hasActiveStep: boolean
}) {
  if (!events.length) {
    return (
      <div className="wb-expert-collab-empty">
        <Icon name="commentThread" />
        <strong>协作记录将在专家接单后出现</strong>
        <span>这里会保留专家理解、关键确认、阶段结果和修改记录。</span>
      </div>
    )
  }

  return (
    <ol className="wb-expert-process-list wb-expert-collab-list" aria-label="专家协作记录">
      {events.map((event, index) => {
        const role = eventRole(event.type)
        const isCurrentStep = hasActiveStep && index === events.length - 1
        const title = expertTaskEventLabel(event.type, event.summary)
        const summary = displayEventSummary(event)
        return (
          <li
            key={event.id || `${event.type || 'event'}-${index}`}
            className={`is-${role}`}
            aria-current={isCurrentStep ? 'step' : undefined}
          >
            <span className="wb-expert-process-actor" aria-hidden="true">
              {role === 'expert' ? (
                <ExpertAvatarMark agent={{ id: expertId, name: expertName }} className="wb-expert-process-avatar" size={30} />
              ) : role === 'user' ? (
                <span className="wb-expert-user-mark">我</span>
              ) : (
                <span className="wb-expert-system-mark"><Icon name="check" /></span>
              )}
            </span>
            <article className="wb-expert-collab-entry">
              <header>
                <strong>{role === 'expert' ? expertName : role === 'user' ? '我' : '任务系统'}</strong>
                <span>{eventKind(event.type)}</span>
                <time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time>
              </header>
              <h3>{title}</h3>
              {summary ? <p>{summary}</p> : null}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
