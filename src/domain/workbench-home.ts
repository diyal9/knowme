import type { CapabilityItem, WorkbenchMode } from '../shared/api'

export const TASK_QUICK_PREVIEW = 3
export const TASK_RECENT_PREVIEW = 3
export const SHELF_GRID_SINGLE_MAX = 600
export const SHELF_GRID_DOUBLE_MAX = 900

export type ExpertHomeDomain = 'all' | 'office' | 'engineering' | 'visual'

export const EXPERT_HOME_DOMAINS: { id: ExpertHomeDomain; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'office', label: '办公' },
  { id: 'engineering', label: '研发' },
  { id: 'visual', label: '视觉' },
]

const TEST_EXPERT_ID_RE = /^(test\d*|qa-copy[-_].+)$/i
const TEST_EXPERT_PROMPT_RE = /测试用/

export function previewSlice<T>(items: T[], expanded: boolean, preview: number): T[] {
  if (expanded || items.length <= preview) return items
  return items.slice(0, preview)
}

export function previewNeedsToggle(total: number, preview: number): boolean {
  return total > preview
}

export function previewToggleLabel(expanded: boolean, total: number, preview: number): string {
  if (expanded) return '收起'
  return `更多（${Math.max(0, total - preview)}）`
}

export function shelfRowCapacity(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 3
  if (width <= SHELF_GRID_SINGLE_MAX) return 1
  if (width <= SHELF_GRID_DOUBLE_MAX) return 2
  return 3
}

export function shelfSummaryText(total: number, runnable: number): string {
  if (total <= 0) return ''
  return `${runnable} 个可运行`
}

export function expertHomeDomain(item: Pick<CapabilityItem, 'id' | 'name' | 'description' | 'category'>): Exclude<ExpertHomeDomain, 'all'> {
  const text = [item.id, item.name, item.description, item.category]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
  if (/(visual|design|image|creative|\bui\b|\bux\b|\bart\b|graphic|视觉|美术|设计|图像|生图|创意|策划)/i.test(text)) return 'visual'
  if (/(engineering|software|develop|coding|code|data|research|product|研发|开发|代码|测试|技术|软件|数据|研究|产品|需求|架构)/i.test(text)) return 'engineering'
  return 'office'
}

/** Test/QA fixtures that must not appear as workbench home experts. */
export function isDemoOrTestExpert(item: {
  id?: string
  name?: string
  description?: string
  systemPrompt?: string
}): boolean {
  const id = String(item.id || '').trim()
  const name = String(item.name || '').trim()
  if (TEST_EXPERT_ID_RE.test(id) || TEST_EXPERT_ID_RE.test(name)) return true
  const blob = `${item.description || ''} ${item.systemPrompt || ''}`
  return TEST_EXPERT_PROMPT_RE.test(blob)
}

export function boundWorkbenchExpertIds(modes: WorkbenchMode[] | undefined): Set<string> {
  const ids = new Set<string>()
  for (const mode of modes || []) {
    for (const binding of mode.bindings || []) {
      const id = String(binding.expertId || '').trim()
      if (id) ids.add(id)
    }
  }
  return ids
}

export function workbenchHomeExperts<T extends CapabilityItem>(
  items: T[],
  modes: WorkbenchMode[] | undefined,
): T[] {
  const bound = boundWorkbenchExpertIds(modes)
  if (!bound.size) return []
  return items.filter((item) => {
    if (item.kind && item.kind !== 'expert') return false
    if (!bound.has(item.id)) return false
    return !isDemoOrTestExpert(item)
  })
}
