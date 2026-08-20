/**
 * 运行阻塞/失败的下一步指引。过程态不写入终态 answer。
 * cancelStage / recovery 来自 store；未写入时只按 assistantStatus 分类。
 */
import { buildRecoveryView } from '../../../domain/agent-recovery-actions'
import { useAppStore } from '../../app/store'

export function GuidedRecoveryPanel() {
  const isGenerating = useAppStore((s) => s.isGenerating)
  const status = useAppStore((s) => s.assistantStatus)
  const cancelStage = useAppStore((s) => s.assistantCancelStage)
  const recovery = useAppStore((s) => s.assistantRecovery)
  if (!status && !cancelStage && !recovery) return null
  if (isGenerating && !recovery && !cancelStage) return null

  const cancelled = cancelStage === 'cancelled' || recovery?.status === 'cancelled' || status === '已取消'
  if (cancelled) {
    return (
      <aside className="agent-guided-recovery is-cancelled" data-testid="guided-recovery-panel" aria-live="polite">
        <strong>已取消</strong>
      </aside>
    )
  }

  const view = buildRecoveryView({
    status: cancelStage || recovery?.status || status,
    code: recovery?.code,
    recommendedAction: recovery?.recommendedAction,
    estimatedWait: recovery?.estimatedWait,
  })

  const stageLabel = cancelStage === 'requesting_cancel'
    ? '正在请求取消…'
    : cancelStage === 'cancelling_children'
      ? '正在取消子任务…'
      : cancelStage === 'resume_pending'
        ? '正在恢复…'
        : ''

  return (
    <aside className="agent-guided-recovery" data-testid="guided-recovery-panel" aria-live="polite">
      <strong>{stageLabel || view.title}</strong>
      {view.estimatedWait ? <span className="agent-guided-wait">预计 {view.estimatedWait}</span> : null}
      <p>{view.recommended.hint}</p>
      <div className="agent-guided-actions">
        <button type="button" className="agent-guided-primary" data-recovery={view.recommended.id}>{view.recommended.label}</button>
        {view.alternatives.slice(0, 2).map((action) => (
          <button type="button" key={action.id} className="agent-guided-alt" data-recovery={action.id}>{action.label}</button>
        ))}
      </div>
    </aside>
  )
}
