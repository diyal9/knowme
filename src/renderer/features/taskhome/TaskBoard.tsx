import { useMemo, useState } from 'react'
import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { Icon } from '../../app/Icon'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'
import { TaskRecentCard } from './TaskRecentCard'

const ACTIVE_LIMIT = 3
const COMPLETED_LIMIT = 3

function sortByLatest(items: WorkbenchTask[]) {
  return [...items].sort((left, right) => (
    Date.parse(String(right.updatedAt || '')) - Date.parse(String(left.updatedAt || ''))
  ))
}

function taskBoardGroups(tasks: WorkbenchTask[]) {
  return [
    {
      id: 'attention',
      label: '待我处理',
      empty: '没有等待处理的任务',
      tasks: sortByLatest(tasks.filter((task) => ['draft', 'open', 'needs_input', 'review'].includes(String(task.status).toLowerCase()))),
    },
    {
      id: 'active',
      label: '进行中',
      empty: '当前没有执行中的任务',
      tasks: sortByLatest(tasks.filter((task) => ['starting', 'running', 'revising', 'queued'].includes(String(task.status).toLowerCase()))),
    },
    {
      id: 'exception',
      label: '异常',
      empty: '当前没有异常任务',
      tasks: sortByLatest(tasks.filter((task) => ['failed', 'error', 'timeout', 'blocked'].includes(String(task.status).toLowerCase()))),
    },
  ]
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const groups = useMemo(() => taskBoardGroups(tasks), [tasks])
  const completed = useMemo(() => sortByLatest(tasks.filter((task) => (
    ['completed', 'done', 'finished'].includes(String(task.status).toLowerCase())
  ))), [tasks])

  return (
    <div className="wb-task-board" data-testid={`${idPrefix}-board`}>
      <div className="wb-task-status-groups" aria-label={workflowMode ? '工作流运行看板' : '专家任务看板'}>
        {groups.map((group) => (
          <section key={group.id} className={`wb-task-status-group is-${group.id}`}>
            <header><strong>{group.label}</strong><b>{group.tasks.length}</b></header>
            <div className="wb-task-recent-list">
              {(expandedGroups[group.id] ? group.tasks : group.tasks.slice(0, ACTIVE_LIMIT)).map((task) => (
                <TaskRecentCard
                  key={task.id}
                  task={task}
                  expert={resolveExpert?.(task)}
                  workflowMode={workflowMode}
                  onOpen={() => onOpen(task)}
                />
              ))}
              {group.tasks.length === 0 ? <div className="wb-task-group-empty">{group.empty}</div> : null}
            </div>
            {group.tasks.length > ACTIVE_LIMIT ? (
              <button
                type="button"
                className="wb-task-group-more"
                aria-expanded={Boolean(expandedGroups[group.id])}
                onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
              >
                {expandedGroups[group.id] ? '收起' : `更多（${group.tasks.length - ACTIVE_LIMIT}）`}
              </button>
            ) : null}
          </section>
        ))}
      </div>

      <section className="wb-task-completed" aria-labelledby={`${idPrefix}CompletedTitle`}>
        <header>
          <strong id={`${idPrefix}CompletedTitle`}>最近完成</strong>
          <button
            type="button"
            className="wb-task-completed-clean"
            title={manageLabel}
            aria-label={manageLabel}
            onClick={onManageCompleted}
          >
            <Icon name={manageIcon} />
          </button>
        </header>
        {completed.length ? (
          <>
            <div className={`wb-task-completed-list${completedExpanded ? ' is-expanded' : ''}`}>
              {(completedExpanded ? completed : completed.slice(0, COMPLETED_LIMIT)).map((task) => (
                <TaskRecentCard
                  key={task.id}
                  task={task}
                  expert={resolveExpert?.(task)}
                  workflowMode={workflowMode}
                  onOpen={() => onOpen(task)}
                />
              ))}
            </div>
            <WorkbenchListToggle
              id={`${idPrefix}CompletedToggle`}
              expanded={completedExpanded}
              remaining={completed.length - COMPLETED_LIMIT}
              hidden={completed.length <= COMPLETED_LIMIT}
              onToggle={() => setCompletedExpanded((value) => !value)}
            />
          </>
        ) : <div className="wb-task-completed-empty">完成的任务会出现在这里</div>}
      </section>
    </div>
  )
}
