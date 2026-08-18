/**
 * 气泡内 To-dos：与 plan.updated 同源，不回写 IPC。
 */
import { buildPlanView } from '../../../domain/agent-plan-view'
import type { ChatMessage } from '../../../shared/api'

export function AgentPlanChecklist({ message }: { message: ChatMessage }) {
  const view = buildPlanView(message.plan)
  if (!view) return null
  return (
    <section className="agent-plan-checklist" data-testid="agent-plan-checklist" aria-label={view.title}>
      <div className="agent-plan-head">
        {view.title}
        <span> · {view.remainingHint}</span>
      </div>
      <ul className="agent-plan-list">
        {view.items.map((item) => (
          <li key={item.id} className={`agent-plan-item status-${item.status}`}>
            <span className="agent-plan-mark" aria-hidden="true">{item.mark}</span>
            <span className="agent-plan-title">
              {item.title}
              {item.evidence ? <span className="agent-plan-evidence">{item.evidence}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
