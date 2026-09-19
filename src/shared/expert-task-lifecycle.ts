/** One lifecycle for a single expert commission; runtime statuses remain compatible. */
export function isExpertDeliverableComplete(item: { acceptanceStatus?: string; evidenceStatus?: string }) {
  return ['accepted', 'not_required'].includes(item.acceptanceStatus || '')
    && !['blocked', 'failed'].includes(item.evidenceStatus || '')
}

export function projectExpertTaskLifecycle(task: {
  status?: string
  attention?: { action?: string; kind?: string } | null
  resultSummary?: string
  updatedAt?: string
}) {
  const status = task.status || 'draft'
  const outcome = status === 'completed' ? 'completed'
    : status === 'failed' ? 'incomplete' : status === 'cancelled' ? 'cancelled' : null
  const phase = outcome ? 'ended' : ['needs_input', 'review'].includes(status) ? 'waiting'
    : ['starting', 'running', 'revising'].includes(status) ? 'executing' : 'pending'
  const waitingReason = phase !== 'waiting' ? null : status === 'review' ? 'review'
    : task.attention?.kind === 'approval_required' ? 'approval'
      : task.attention?.action === 'provide_input' ? 'input' : 'recovery'
  const label = outcome === 'completed' ? '已结束 · 已完成'
    : outcome === 'incomplete' ? '已结束 · 未完成'
      : outcome === 'cancelled' ? '已结束 · 已取消'
        : phase === 'waiting' ? '等待中' : phase === 'executing' ? '执行中' : '待开始'
  return { phase, outcome, waitingReason, label, terminal: phase === 'ended' }
}

/** Execution readiness is separate from the user's acceptance. */
export function isExpertDeliverableReady(item: { acceptanceStatus?: string; evidenceStatus?: string; version?: number }) {
  return Number(item.version) > 0
    && ['pending', 'accepted', 'not_required'].includes(item.acceptanceStatus || '')
    && !['blocked', 'failed'].includes(item.evidenceStatus || '')
}
