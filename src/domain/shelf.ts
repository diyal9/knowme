import { executionBackendLabel } from './workbench-labels'

export type WorkflowSource = 'official' | 'team' | 'personal' | 'forked' | string

/** Current Demo labels (provenance.js), not a re-invention. */
export function shelfProvenanceLabel(source: WorkflowSource): '我的' | '官方' | '共享' {
  const value = String(source || '')
  if (value === 'personal' || value === 'forked') return '我的'
  if (value === 'official') return '官方'
  return '共享'
}

export function shelfProvenanceKind(source: WorkflowSource): 'mine' | 'team' {
  const value = String(source || '')
  return value === 'personal' || value === 'forked' ? 'mine' : 'team'
}

/** Demo-only vertical seed ids that must never appear on the shelf. */
export const DEMO_VERTICAL_SEED_IDS = [
  'demo-meeting-minutes',
  'demo-req-impl-test-ship',
  'demo-brief-gen-review-export',
] as const

export function isDemoVerticalSeed(id: string): boolean {
  return (DEMO_VERTICAL_SEED_IDS as readonly string[]).includes(String(id || ''))
}

/** Demo/test workflow ids that must not appear on the production shelf. */
export function isDemoShelfEntry(id: string): boolean {
  const key = String(id || '').trim().toLowerCase()
  if (!key) return false
  if (isDemoVerticalSeed(key)) return true
  return key.startsWith('demo-')
}

export type ShelfDomain = 'all' | 'office' | 'engineering' | 'visual'

export function workflowDomain(item: { goalTypes?: string[]; provenance?: { domain?: string } }): Exclude<ShelfDomain, 'all'> | 'other' {
  const fromProv = String(item.provenance?.domain || '').toLowerCase()
  if (fromProv === 'office' || fromProv === 'engineering' || fromProv === 'visual') return fromProv
  const types = (item.goalTypes || []).map((t) => String(t).toLowerCase())
  if (types.some((t) => t.includes('office') || t.includes('meeting'))) return 'office'
  if (types.some((t) => t.includes('eng') || t.includes('dev') || t.includes('code'))) return 'engineering'
  if (types.some((t) => t.includes('visual') || t.includes('design'))) return 'visual'
  return 'other'
}

export type ShelfLayout = 'grid' | 'list'

export function shelfDomainIcon(domain: string): string {
  if (domain === 'office') return 'note'
  if (domain === 'engineering') return 'code'
  if (domain === 'visual') return 'image'
  return 'workflow'
}

export interface ShelfCardModel {
  id: string
  name: string
  description: string
  source: string
  provenanceLabel: '我的' | '官方' | '共享'
  provenanceKind: 'mine' | 'team'
  domain: string
  markIcon: string
  inputLabel: string
  outcomeLabel: string
  backendLabel: string
  stepLabels: string[]
  stepCount: number
  blocked: boolean
  /** 货架加载时带上的 graph，编排入口可离线打开，不必再 GET。 */
  graph?: Record<string, unknown>
}

function shelfFlowStepLabels(item: {
  graph?: { nodes?: unknown[] }
  nodes?: unknown[]
  package?: { graph?: { nodes?: unknown[] }; nodes?: unknown[] }
}): string[] {
  const pkg = item.package && typeof item.package === 'object' ? item.package : item
  const graph = pkg.graph && typeof pkg.graph === 'object' ? pkg.graph : pkg
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : Array.isArray(pkg.nodes) ? pkg.nodes : []
  const labels: string[] = []
  const seen = new Set<string>()
  for (const raw of nodes) {
    const node = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const kind = String(node.kind || node.type || '').toLowerCase()
    if (kind && kind !== 'agent') continue
    const agentId = String(node.agentPackageId || node.agent || '').trim()
    const name = String(node.name || node.label || '').trim()
    // 名称若等于 packageId，保留 id 供 UI 解析中文名；否则用可读名称
    const label = name && name !== agentId ? name : (agentId || name)
    if (!label || seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  return labels.slice(0, 6)
}

export function toShelfCard(item: {
  id: string
  name?: string
  description?: string
  source?: string
  locked?: boolean
  status?: string
  inputs?: { label?: string }[]
  outputs?: { label?: string }[]
  goalTypes?: string[]
  provenance?: { domain?: string }
  graph?: Record<string, unknown> & { nodes?: unknown[] }
  nodes?: unknown[]
  package?: { graph?: Record<string, unknown> & { nodes?: unknown[] }; nodes?: unknown[] }
  executionBackends?: string[]
  executionSource?: string
}): ShelfCardModel {
  const status = String(item.status || '').toLowerCase()
  const domain = workflowDomain(item)
  const stepLabels = shelfFlowStepLabels(item)
  const stepCount = Math.max(1, stepLabels.length)
  const graph = item.graph && typeof item.graph === 'object'
    ? item.graph
    : (item.package?.graph && typeof item.package.graph === 'object' ? item.package.graph : undefined)
  return {
    id: item.id,
    name: String(item.name || item.id).trim() || '未命名工作流',
    description: String(item.description || '').trim(),
    source: String(item.source || ''),
    provenanceLabel: shelfProvenanceLabel(item.source || ''),
    provenanceKind: shelfProvenanceKind(item.source || ''),
    domain,
    markIcon: shelfDomainIcon(domain),
    inputLabel: String(item.inputs?.[0]?.label || '一句话目标'),
    outcomeLabel: String(item.outputs?.[0]?.label || '可查看、可追溯的工作结果'),
    backendLabel: executionBackendLabel(item),
    stepLabels,
    stepCount,
    blocked: item.locked === true || status === 'locked' || status === 'disabled',
    graph,
  }
}

export function shelfLockHint(daemonOnline: boolean | null | undefined): string | null {
  if (daemonOnline === false) return '管线服务离线，工作流暂不可启动。'
  return null
}

/** 货架空态副文案，对齐 f6ad048 `shelfSupplyHint`。 */
export function shelfSupplyHint(daemonOnline: boolean | null | undefined): string {
  if (daemonOnline === false) return '连接管线服务，或点击「新建工作流」编排自己的流程。'
  return '在专家库安装专家后，可编排工作流或直接使用共享流程。'
}

export function filterShelfCards(
  items: ShelfCardModel[],
  query: string,
  domain: ShelfDomain,
): ShelfCardModel[] {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (isDemoShelfEntry(item.id)) return false
    if (domain !== 'all' && item.domain !== domain) return false
    if (!q) return true
    return `${item.name} ${item.description}`.toLowerCase().includes(q)
  })
}
