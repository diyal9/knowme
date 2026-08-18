/**
 * 计划清单视图：协议字段不变，文案对齐 Cursor To-dos。
 */

export type PlanItemStatus = 'pending' | 'doing' | 'done' | 'blocked'

export type PlanItemView = {
  id: string
  title: string
  status: PlanItemStatus
  mark: string
  evidence?: string
}

export type PlanView = {
  title: string
  remainingHint: string
  items: PlanItemView[]
}

const MARKS: Record<PlanItemStatus, string> = {
  doing: '▶',
  pending: '○',
  done: '✓',
  blocked: '!',
}

export function toPlanItemView(raw: { id?: string; title?: string; status?: string; evidence?: string }, index = 0): PlanItemView | null {
  const title = String(raw?.title || '').trim()
  if (!title) return null
  const status: PlanItemStatus = raw.status === 'doing' || raw.status === 'done' || raw.status === 'blocked'
    ? raw.status
    : 'pending'
  return {
    id: String(raw.id || `plan-${index + 1}`),
    title,
    status,
    mark: MARKS[status],
    evidence: String(raw.evidence || '').trim() || undefined,
  }
}

export function buildPlanView(plan: { items?: unknown[] } | null | undefined): PlanView | null {
  const items = (Array.isArray(plan?.items) ? plan.items : [])
    .map((item, index) => toPlanItemView(item && typeof item === 'object' ? item as { id?: string; title?: string; status?: string; evidence?: string } : {}, index))
    .filter(Boolean) as PlanItemView[]
  if (!items.length) return null
  const remaining = items.filter((item) => item.status === 'pending' || item.status === 'doing').length
  return {
    title: `To-dos ${items.length}`,
    remainingHint: remaining ? `剩余 ${remaining}` : '已完成',
    items,
  }
}
