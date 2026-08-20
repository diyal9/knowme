import { useEffect, useState } from 'react'
import type { WorkbenchTask } from '../../../shared/api'
import { useAppStore } from '../../app/store'
import { expertDeliverableTitle, expertDisplayName, expertTaskEventLabel } from '../../../domain/expert-present'

export function ExpertRoomSurface() {
  const room = useAppStore((s) => s.expertRoom)
  const [task, setTask] = useState<WorkbenchTask | null>(null)
  useEffect(() => {
    if (!room?.id) return
    const onTaskUpdated = (event: Event) => {
      const next = (event as CustomEvent<WorkbenchTask>).detail
      if (next?.id === room.id) setTask(next)
    }
    window.addEventListener('knowme:expert-task-updated', onTaskUpdated)
    void window.api?.expertTaskGet?.(room.id).then((result) => setTask(result?.task || null)).catch(() => setTask(null))
    return () => window.removeEventListener('knowme:expert-task-updated', onTaskUpdated)
  }, [room?.id])
  if (!room) return null
  const materials = task?.brief?.materials || []
  const requested = task?.brief?.deliverables || []
  const status = String(task?.status || 'starting')
  const nextStep = status === 'needs_input'
    ? '补充专家需要的信息'
    : status === 'review'
      ? '验收或退回交付物'
      : ['starting', 'running', 'revising'].includes(status)
        ? '等待专家提交新成果'
        : status === 'completed'
          ? '任务已完成，无待办'
          : '查看任务记录'
  return (
    <aside className="wb-expert-context" data-testid="expert-room" aria-label="专家任务上下文">
      <section className="wb-expert-next-step">
        <span className="wb-detail-eyebrow">下一步</span>
        <strong>{nextStep}</strong>
        <p>{status === 'review' || status === 'needs_input' ? '处理后任务会自动继续。' : '状态变化会同步更新到这里。'}</p>
      </section>
      <section>
        <span className="wb-detail-eyebrow">当前任务</span>
        <strong className="wb-expert-context-name">{expertDisplayName(task?.expertName || room.name)}</strong>
        <h3>{task?.brief?.goal || task?.goal || room.goal}</h3>
        <dl>
          <div><dt>材料</dt><dd>{materials.length ? materials.map((item) => item.title).join('、') : '无额外材料'}</dd></div>
          <div><dt>预期交付</dt><dd>{requested.length ? requested.map((item) => expertDeliverableTitle(item.title)).join('、') : '任务交付物'}</dd></div>
        </dl>
      </section>
      <section className="is-grow wb-expert-audit">
        <details>
          <summary>协作记录 <span>{task?.events?.length || 0}</span></summary>
          <ol className="wb-expert-event-list">
            {(task?.events || []).slice(-8).reverse().map((event) => (
              <li key={event.id}>
                <strong>{expertTaskEventLabel(event.type, event.summary)}</strong>
                {event.type === 'changes_requested' && event.summary ? <p>{event.summary}</p> : null}
                <span>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</span>
              </li>
            ))}
          </ol>
          {!task?.events?.length ? <p>任务记录将在预检后出现。</p> : null}
        </details>
      </section>
    </aside>
  )
}
