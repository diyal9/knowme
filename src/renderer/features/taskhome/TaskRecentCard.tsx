import type { WorkbenchTask } from '../../../shared/api'
import { taskRecentSummary, taskStatusMeta, taskRelTime } from '../../../domain/run-projection'
import { Icon } from '../../app/Icon'

export function TaskRecentCard({
  task,
  workflowMode,
  onOpen,
}: {
  task: WorkbenchTask
  workflowMode?: boolean
  onOpen: () => void
}) {
  const meta = taskStatusMeta(task.status)
  const summary = taskRecentSummary(task)
  const when = taskRelTime(task.updatedAt)
  const actor = workflowMode
    ? (task.workflowName || task.workflowId || '工作流')
    : (task.expertName || task.expertId || '专家')

  return (
    <article className="wb-task-card">
      <button type="button" className="wb-task-card-main" data-testid={`task-open-${task.id}`} onClick={onOpen}>
        <span className="wb-task-card-top">
          <span className={`wb-task-state-dot ${meta.dot}`} aria-hidden="true" />
          <span className="wb-task-state">{meta.label}</span>
        </span>
        <span className="wb-task-name">{task.title || task.id}</span>
        <span className="wb-task-summary">{summary}</span>
        <span className="wb-task-intent">
          {workflowMode ? (
            <span className="ico ico-sm" aria-hidden="true"><Icon name="workflow" /></span>
          ) : (
            <span className="wb-task-card-avatar" aria-hidden="true"><Icon name="users" /></span>
          )}
          <span>{actor}</span>
          <span className="wb-task-intent-sep" aria-hidden="true">·</span>
          <span>{when || '刚刚'}</span>
        </span>
      </button>
    </article>
  )
}
