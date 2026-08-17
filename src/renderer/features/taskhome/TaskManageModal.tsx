import { useMemo, useState } from 'react'
import type { WorkbenchTask } from '../../../shared/api'
import { expertHomeTasks, taskStatusMeta } from '../../../domain/run-projection'
import { useAppStore } from '../../app/store'

export function TaskManageModal() {
  const open = useAppStore((s) => s.taskManageOpen)
  const tasks = useAppStore((s) => s.tasks)
  const close = useAppStore((s) => s.closeTaskManage)
  const archiveTasks = useAppStore((s) => s.archiveTasks)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const expertTasks = useMemo(() => expertHomeTasks(tasks), [tasks])
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  )

  if (!open) return null

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function selectAll() {
    setSelected(Object.fromEntries(expertTasks.map((task) => [task.id, true])))
  }

  function selectNone() {
    setSelected({})
  }

  function selectDone() {
    setSelected(Object.fromEntries(
      expertTasks.filter((task) => taskStatusMeta(task.status).dot === 'done').map((task) => [task.id, true]),
    ))
  }

  return (
    <div className="wb-modal-mask" data-testid="task-manage-modal" role="dialog" aria-labelledby="wbTaskManageTitle">
      <div className="wb-modal wb-task-manage-modal">
        <div className="wb-modal-head">
          <strong id="wbTaskManageTitle" className="wb-modal-title">管理最近协作</strong>
          <button type="button" className="wb-modal-close" aria-label="关闭" onClick={close}>×</button>
        </div>
        <div className="wb-modal-body" id="wbTaskManageBody">
          {expertTasks.length === 0 ? (
            <p className="empty">还没有协作记录。</p>
          ) : expertTasks.map((task) => (
            <label key={task.id} className="wb-task-manage-row">
              <input
                type="checkbox"
                data-task-manage-id={task.id}
                checked={!!selected[task.id]}
                onChange={() => toggle(task.id)}
              />
              <span>{task.title || task.id}</span>
              <small>{taskStatusMeta(task.status).label}</small>
            </label>
          ))}
        </div>
        <div className="wb-modal-actions wb-task-manage-actions">
          <div className="wb-task-manage-strategies" role="group" aria-label="选择策略">
            <button type="button" className="wb-modal-btn" onClick={selectAll}>全选</button>
            <button type="button" className="wb-modal-btn ghost" onClick={selectDone}>已完成</button>
            <button type="button" className="wb-modal-btn ghost" onClick={selectNone}>清空</button>
          </div>
          <span className="wb-task-manage-spacer" />
          <button
            type="button"
            className="wb-modal-btn danger"
            disabled={selectedIds.length === 0}
            onClick={() => void archiveTasks(selectedIds)}
          >
            删除所选
          </button>
        </div>
      </div>
    </div>
  )
}
