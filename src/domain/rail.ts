export type AppRoute = 'assistant' | 'workbench' | 'capabilities' | 'automation' | 'knowledge' | 'settings'

export type WorkbenchSurface = 'shelf' | 'taskhome' | 'run' | 'manage' | 'studio'

export const RAIL_ITEMS: { id: AppRoute; label: string; title: string }[] = [
  { id: 'assistant', label: '智能伙伴', title: '智能伙伴' },
  { id: 'workbench', label: '工作台', title: '工作台' },
{ id: 'capabilities', label: '能力中心', title: '能力中心：Agent、Skill 与 MCP 连接器' },
  { id: 'automation', label: '自动化', title: '自动化' },
  { id: 'knowledge', label: '知识网', title: '知识网' },
  { id: 'settings', label: '设置', title: '设置' },
]

export function exclusiveRailPressed(active: AppRoute, id: AppRoute): boolean {
  return active === id
}

export function studioReturnLabel(from: WorkbenchSurface | null): string {
  if (from === 'shelf') return '返回工作流'
  if (from === 'taskhome') return '返回专家协作'
  if (from === 'manage') return '返回管理工作流'
  return '返回工作台'
}
