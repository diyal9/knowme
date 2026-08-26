import { useMemo, useState } from 'react'
import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { Icon } from '../../app/Icon'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'
import { TaskRecentCard } from './TaskRecentCard'

const INBOX_LIMIT = 6

type InboxFilter = 'current' | 'attention' | 'running' | 'exception' | 'completed'

const INBOX_FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'current', label: '当前' },
  { id: 'attention', label: '待我处理' },
  { id: 'running', label: '进行中' },
  { id: 'exception', label: '异常' },
  { id: 'completed', label: '已完成' },
]

const INBOX_STATUS: Record<Exclude<InboxFilter, 'current'>, Set<string>> = {
  attention: new Set(['review', 'needs_input', 'open', 'draft']),
  running: new Set(['starting', 'queued', 'running', 'revising', 'pending', 'waiting', 'preparing', 'created', 'active']),
  exception: new Set(['failed', 'error', 'timeout', 'blocked']),
  completed: new Set(['completed', 'done', 'finished', 'success', 'succeeded']),
}

const INBOX_PRIORITY: Record<string, number> = {
  failed: 0, error: 0, timeout: 0, blocked: 0,
  review: 1, needs_input: 1, open: 1, draft: 1,
  starting: 2, queued: 2, running: 2, revising: 2,
  pending: 2, waiting: 2, preparing: 2, created: 2, active: 2,
}

function sortByLatest(items: WorkbenchTask[]) {
  return [...items].sort((left, right) => (
    Date.parse(String(right.updatedAt || '')) - Date.parse(String(left.updatedAt || ''))
  ))
}

function inboxBucket(task: WorkbenchTask): Exclude<InboxFilter, 'current'> | 'other' {
  const status = String(task.status || '').toLowerCase()
  if (INBOX_STATUS.exception.has(status)) return 'exception'
  if (INBOX_STATUS.attention.has(status)) return 'attention'
  if (INBOX_STATUS.running.has(status)) return 'running'
  if (INBOX_STATUS.completed.has(status)) return 'completed'
  return 'other'
}

function sortInbox(items: WorkbenchTask[]) {
  return [...items].sort((left, right) => {
    const priority = (INBOX_PRIORITY[String(left.status).toLowerCase()] ?? 8)
      - (INBOX_PRIORITY[String(right.status).toLowerCase()] ?? 8)
    return priority || Date.parse(String(right.updatedAt || '')) - Date.parse(String(left.updatedAt || ''))
  })
}

export function TaskBoard({
  tasks,
  workflowMode = false,
  idPrefix,
  manageLabel,
  manageIcon = 'trash',
  resolveExpert,
  onOpen,
  onManageCompleted,
}: {
  tasks: WorkbenchTask[]
  workflowMode?: boolean
  idPrefix: string
  manageLabel: string
  manageIcon?: 'trash' | 'settingsLine'
  resolveExpert?: (task: WorkbenchTask) => CapabilityItem | undefined
  onOpen: (task: WorkbenchTask) => void
  onManageCompleted: () => void
}) {
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('current')
  const [inboxExpanded, setInboxExpanded] = useState(false)
  const inboxTasks = useMemo(() => {
    const matching = tasks.filter((task) => {
      const bucket = inboxBucket(task)
      return inboxFilter === 'current' ? bucket !== 'completed' && bucket !== 'other' : bucket === inboxFilter
    })
    return inboxFilter === 'completed' ? sortByLatest(matching) : sortInbox(matching)
  }, [inboxFilter, tasks])
  const inboxCounts = useMemo(() => {
    const counts: Record<InboxFilter, number> = { current: 0, attention: 0, running: 0, exception: 0, completed: 0 }
    tasks.forEach((task) => {
      const bucket = inboxBucket(task)
      if (bucket === 'other') return
      counts[bucket] += 1
      if (bucket !== 'completed') counts.current += 1
    })
    return counts
  }, [tasks])
  const visibleTasks = inboxExpanded ? inboxTasks : inboxTasks.slice(0, INBOX_LIMIT)
  const ownerLabel = workflowMode ? '工作流' : '专家'
  const emptyText: Record<InboxFilter, string> = workflowMode
    ? {
        current: '当前没有运行中的工作流任务',
        attention: '没有等待你处理的工作流任务',
        running: '当前没有运行中的工作流任务',
        exception: '当前没有异常的工作流任务',
        completed: '完成的工作流任务会出现在这里',
      }
    : {
        current: '当前没有需要处理的专家任务',
        attention: '没有等待你处理的任务',
        running: '当前没有进行中的任务',
        exception: '当前没有异常任务',
        completed: '完成的任务会出现在这里',
      }

  return (
    <div className={`wb-task-inbox${workflowMode ? ' is-workflow' : ''}`} data-testid={`${idPrefix}-board`}>
      <div className="wb-task-inbox-toolbar">
        <div
          className="wb-task-inbox-filters"
          role="tablist"
          aria-label={workflowMode ? '工作流运行筛选' : '专家任务筛选'}
        >
          {INBOX_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={inboxFilter === filter.id}
              className={inboxFilter === filter.id ? 'is-active' : ''}
              onClick={() => {
                setInboxFilter(filter.id)
                setInboxExpanded(false)
              }}
            >
              <span>{filter.label}</span>
              <b>{inboxCounts[filter.id]}</b>
            </button>
          ))}
        </div>
        {inboxFilter === 'completed' && inboxCounts.completed > 0 ? (
          <button
            type="button"
            className="wb-task-inbox-manage"
            title={manageLabel}
            aria-label={manageLabel}
            onClick={onManageCompleted}
          >
            <Icon name={manageIcon} />
          </button>
        ) : null}
      </div>
      <div className="wb-task-inbox-shell">
        <div className="wb-task-inbox-columns" aria-hidden="true">
          <span>任务</span><span>{ownerLabel}</span><span>更新</span><span>状态</span>
        </div>
        {visibleTasks.length ? (
          <div className="wb-task-inbox-list">
            {visibleTasks.map((task) => (
              <TaskRecentCard
                key={task.id}
                task={task}
                expert={resolveExpert?.(task)}
                workflowMode={workflowMode}
                presentation="inbox"
                onOpen={() => onOpen(task)}
              />
            ))}
          </div>
        ) : <div className="wb-task-inbox-empty">{emptyText[inboxFilter]}</div>}
      </div>
      <WorkbenchListToggle
        id={`${idPrefix}InboxToggle`}
        expanded={inboxExpanded}
        remaining={inboxTasks.length - INBOX_LIMIT}
        label="查看全部"
        hidden={inboxTasks.length <= INBOX_LIMIT}
        onToggle={() => setInboxExpanded((value) => !value)}
      />
    </div>
  )
}
