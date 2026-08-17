export interface DaemonPathItem {
  id: string
  name?: string
  locked?: boolean
  catalog?: { visibility?: string; order?: number }
}

export interface DaemonTaskCard {
  slug: string
  tone?: string
  bucket?: string
  rawStatus?: string
  cardTitle?: string
  intentTitle?: string
  title?: string
  intent?: string
  cardSummary?: string
  cardBrief?: string
  cardMeta?: string
  statusLabel?: string
  pathName?: string
  relativeTime?: string
  updatedAt?: string
}

export const DAEMON_MIN_INTENT_CHARS = 20

export const DAEMON_RUN_FILTERS = [
  { id: 'all', icon: 'workbench', title: '全部运行' },
  { id: 'active', icon: 'play', title: '进行中' },
  { id: 'needs_you', icon: 'history', title: '需要你处理' },
  { id: 'done', icon: 'check', title: '已完成' },
  { id: 'failed', icon: 'circleX', title: '失败' },
] as const

export type DaemonRunFilterId = (typeof DAEMON_RUN_FILTERS)[number]['id']

const WAITING = new Set(['waiting', 'blocked', 'gate', 'clarification', 'needs_input', 'needs-input', 'paused'])
const ACTIVE = new Set(['running', 'queued', 'pending', 'preparing', 'created', 'starting', 'active'])
const DONE = new Set(['done', 'completed', 'success', 'finished'])
const FAIL = new Set(['failed', 'error', 'rejected', 'cancelled', 'canceled'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function catalogOrder(item: DaemonPathItem): number {
  const order = Number(item.catalog?.order)
  return Number.isInteger(order) ? order : 1000
}

export function selectableDaemonPaths(workflows: unknown[]): DaemonPathItem[] {
  const list: DaemonPathItem[] = []
  for (const raw of Array.isArray(workflows) ? workflows : []) {
    const item = asRecord(raw)
    const id = String(item.id || '').trim()
    if (!id) continue
    const catalog = asRecord(item.catalog)
    list.push({
      id,
      name: String(item.name || id),
      locked: item.locked === true,
      catalog: {
        visibility: String(catalog.visibility || 'primary'),
        order: Number.isInteger(Number(catalog.order)) ? Number(catalog.order) : 1000,
      },
    })
  }
  return list.sort((a, b) => catalogOrder(a) - catalogOrder(b) || a.id.localeCompare(b.id))
}

export function daemonPathLabel(item: DaemonPathItem | undefined): string {
  if (!item) return '请选择交付路径'
  return String(item.name || item.id).trim() || '未命名路径'
}

function runState(task: Record<string, unknown>): string {
  return String(task.status || task.state || task.rawStatus || '').trim().toLowerCase()
}

function runBucket(task: Record<string, unknown>): string {
  const state = runState(task)
  if (FAIL.has(state)) return 'failed'
  if (DONE.has(state)) return 'done'
  if (WAITING.has(state)) return 'needs_you'
  if (ACTIVE.has(state) || !state) return 'active'
  return 'active'
}

function pathNameOf(task: Record<string, unknown>, workflows: unknown[]): string {
  const workflowId = String(task.workflow || task.workflowId || task.pipeline || '').trim()
  const match = selectableDaemonPaths(workflows).find((item) => item.id === workflowId)
  return match ? daemonPathLabel(match) : (workflowId || '管线服务路径')
}

function toTaskCard(raw: unknown, workflows: unknown[]): DaemonTaskCard {
  const task = asRecord(raw)
  const slug = String(task.slug || task.id || '').trim()
  const intent = String(task.intent || task.title || task.goal || '').trim()
  const pathName = pathNameOf(task, workflows)
  const statusLabel = String(task.statusLabel || task.status || task.state || 'unknown')
  const bucket = String(task.bucket || runBucket(task))
  const title = intent || pathName || slug || '管线记录'
  return {
    slug,
    title,
    intent,
    intentTitle: title,
    cardTitle: title,
    pathName,
    statusLabel,
    bucket,
    rawStatus: runState(task),
    tone: bucket === 'failed' ? 'failed' : (bucket === 'done' ? 'done' : (bucket === 'needs_you' ? 'waiting' : 'active')),
    cardMeta: [slug, pathName, statusLabel].filter(Boolean).join(' · '),
    updatedAt: String(task.updatedAt || task.updated_at || task.createdAt || ''),
  }
}

function matchesFilter(item: DaemonTaskCard, filter: string): boolean {
  const key = String(filter || 'all').trim().toLowerCase()
  if (key === 'all' || !key) return true
  if (key === 'failed' || key === 'fail' || key === 'error') return item.bucket === 'failed'
  if (key === 'needs_you' || key === 'needs-you' || key === 'waiting') return item.bucket === 'needs_you'
  if (key === 'active' || key === 'running') return item.bucket === 'active'
  if (key === 'done' || key === 'completed') return item.bucket === 'done'
  return true
}

export function daemonRunCards(
  tasks: unknown[],
  workflows: unknown[],
  filter: string,
  query: string,
): DaemonTaskCard[] {
  const records = (Array.isArray(tasks) ? tasks : []).map((task) => toTaskCard(task, workflows))
  const filtered = records.filter((item) => matchesFilter(item, filter))
  const q = String(query || '').trim().toLowerCase()
  if (!q) return filtered
  return filtered.filter((item) => {
    const hay = [item.title, item.slug, item.pathName, item.statusLabel, item.intent, item.cardMeta]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
    return hay.includes(q)
  })
}

export function daemonFilterTitle(filter: string): string {
  return DAEMON_RUN_FILTERS.find((item) => item.id === filter)?.title || '全部运行'
}

export function daemonComposeCanAttempt(
  online: boolean,
  workflow: DaemonPathItem | undefined,
  submitting: boolean,
): boolean {
  return !submitting && online && !!workflow && !workflow.locked
}
