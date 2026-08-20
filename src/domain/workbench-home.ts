import type { CapabilityItem, WorkbenchMode } from '../shared/api'

export const TASK_QUICK_PREVIEW = 3
export const TASK_RECENT_PREVIEW = 3
export const SHELF_GRID_NARROW_MAX = 900

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
  if (!Number.isFinite(width) || width <= 0) return 2
  return width <= SHELF_GRID_NARROW_MAX ? 1 : 2
}

export function shelfSummaryText(total: number, runnable: number): string {
  if (total <= 0) return ''
  return `${runnable} 个可运行`
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
