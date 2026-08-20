import { useEffect, useMemo, useState } from 'react'
import type { WorkbenchTask } from '../../../shared/api'
import { expertDisplayName } from '../../../domain/expert-present'
import { expertHomeTasks, taskStatusMeta, workflowShelfTasks } from '../../../domain/run-projection'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

type TaskManageScope = 'expert' | 'workflow'

function taskTitle(task: WorkbenchTask, scope: TaskManageScope): string {
  if (task.title) return task.title
  if (scope === 'workflow') return task.workflowName || task.workflowId || '未命名工作流运行'
  return '未命名专家协作'
}

function taskOwner(task: WorkbenchTask, scope: TaskManageScope): string {
  if (scope === 'workflow') return task.workflowName || task.workflowId || '工作流运行'
  return expertDisplayName(task.expertName || task.expertId)
}

function taskSummary(task: WorkbenchTask, scope: TaskManageScope): string {
  const summary = String(task.resultSummary || task.goal || '').trim()
  if (summary) return summary
  return scope === 'workflow' ? '本次工作流已经完成' : '本次专家协作已经完成'
}

export function TaskManageModal({ scope }: { scope: TaskManageScope }) {
  const open = useAppStore((s) => s.taskManageOpen)
  const tasks = useAppStore((s) => s.tasks)
  const close = useAppStore((s) => s.closeTaskManage)
  const archiveTasks = useAppStore((s) => s.archiveTasks)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const completedTasks = useMemo(
    () => (scope === 'workflow' ? workflowShelfTasks(tasks) : expertHomeTasks(tasks))
      .filter((task) => taskStatusMeta(task.status).dot === 'done'),
    [scope, tasks],
  )
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  )

  useEffect(() => {
    setSelected({})
  }, [open, scope])

  if (!open) return null

  const workflowMode = scope === 'workflow'
  const contextLabel = workflowMode ? '工作流' : '专家协作'
  const heading = workflowMode ? '清理工作流运行记录' : '清理已完成协作'
  const helper = workflowMode
    ? '仅移除已完成的运行记录，不影响工作流配置、节点与交付文件'
    : '仅移除已完成的协作记录，相关文件与交付物不会删除'

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function selectAll() {
    setSelected(Object.fromEntries(completedTasks.map((task) => [task.id, true])))
  }

  function selectNone() {
    setSelected({})
  }

  return (
    <div className="wb-modal-mask" data-testid="task-manage-modal" role="dialog" aria-modal="true" aria-labelledby="wbTaskManageTitle">
      <div className={`wb-modal wb-task-manage-modal is-${scope}`} data-task-scope={scope}>
        <div className="wb-modal-head">
          <div className="wb-task-clean-heading">
            <span className="wb-task-manage-context">{contextLabel}</span>
            <h2 id="wbTaskManageTitle" className="wb-modal-title">{heading}</h2>
            <span>{helper}</span>
          </div>
          <button type="button" className="wb-modal-close" aria-label="关闭" onClick={close}>×</button>
        </div>
        <div className="wb-modal-body" id="wbTaskManageBody">
          {completedTasks.length === 0 ? (
            <div className="wb-task-manage-empty">
              <span aria-hidden="true"><Icon name={workflowMode ? 'workflow' : 'users'} /></span>
              <div>
                <strong>暂无可清理记录</strong>
                <p>{workflowMode ? '完成的工作流运行会显示在这里。' : '完成的专家协作会显示在这里。'}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="wb-task-manage-hint">已完成 {completedTasks.length} 项，可选择不再需要保留的记录。</p>
              <div className="wb-task-manage-list">
                {completedTasks.map((task) => {
                  const owner = taskOwner(task, scope)
                  return (
                    <article key={task.id} className="wb-task-manage-item">
                      <label className="wb-task-manage-row">
                        <input
                          type="checkbox"
                          data-task-manage-id={task.id}
                          checked={!!selected[task.id]}
                          onChange={() => toggle(task.id)}
                        />
                        {workflowMode ? (
                          <span className="wb-task-manage-avatar" aria-hidden="true"><Icon name="workflow" /></span>
                        ) : (
                          <ExpertAvatarMark
                            agent={{ id: task.expertId || owner, name: owner }}
                            className="wb-task-manage-avatar"
                            size={32}
                          />
                        )}
                        <span className="wb-task-manage-copy">
                          <strong>{taskTitle(task, scope)}</strong>
                          <span className="wb-task-manage-expert">{workflowMode ? `工作流 · ${owner}` : `执行专家 · ${owner}`}</span>
                          <span className="wb-task-manage-summary">{taskSummary(task, scope)}</span>
                        </span>
                        <small className="wb-task-manage-status"><span aria-hidden="true" />{taskStatusMeta(task.status).label}</small>
                      </label>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <div className="wb-modal-actions wb-task-manage-actions">
          <div className="wb-task-manage-strategies" role="group" aria-label="选择策略">
            <button type="button" className="wb-modal-btn" onClick={selectAll}>全选</button>
            <button type="button" className="wb-modal-btn ghost" onClick={selectNone}>取消全选</button>
          </div>
          <span className="wb-task-manage-selection" aria-live="polite">
            {selectedIds.length ? `已选择 ${selectedIds.length} 项` : '请选择要清理的记录'}
          </span>
          <button
            type="button"
            className="wb-modal-btn danger"
            disabled={selectedIds.length === 0}
            onClick={() => void archiveTasks(selectedIds)}
          >
            清理所选
          </button>
        </div>
      </div>
    </div>
  )
}
