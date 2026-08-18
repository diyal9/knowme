/**
 * 工作台顶栏客户端搜索：货架 / 任务 / 自动化。
 * 不做全库 IPC；切 Tab 后仍用同一 query。
 */

export type WorkbenchSearchHitKind = 'shelf' | 'task' | 'automation'

export type WorkbenchSearchable = {
  id: string
  name?: string
  description?: string
  scheduleLabel?: string
}

export function matchesWorkbenchQuery(item: WorkbenchSearchable, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${item.id} ${item.name || ''} ${item.description || ''} ${item.scheduleLabel || ''}`.toLowerCase()
  return hay.includes(q)
}

export function filterByWorkbenchQuery<T extends WorkbenchSearchable>(items: T[], query: string): T[] {
  return items.filter((item) => matchesWorkbenchQuery(item, query))
}
