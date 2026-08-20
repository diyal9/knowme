export interface DaemonPathItem {
  id: string
  name?: string
  summary?: string
  description?: string
  tags?: string[]
  locked?: boolean
  catalog?: { visibility?: string; category?: string; order?: number }
}

export interface DaemonPathGroup {
  id: string
  label: string
  items: DaemonPathItem[]
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
  sourceUrl?: string
  sourceLabel?: string
  sourceTitle?: string
  relativeTime?: string
  updatedAt?: string
}

export const DAEMON_MIN_INTENT_CHARS = 20

export const DAEMON_RUN_FILTERS = [
  { id: 'all', icon: 'workbench', title: '全部' },
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
      summary: String(item.summary || ''),
      description: String(item.description || ''),
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
      locked: item.locked === true,
      catalog: {
        visibility: String(catalog.visibility || 'primary'),
        category: String(catalog.category || 'general').trim() || 'general',
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

const CATEGORY_LABELS: Record<string, string> = {
  planning: '规划与方案',
  plan: '规划与方案',
  requirement: '规划与方案',
  design: '规划与方案',
  featimpl: '功能开发',
  feature: '功能开发',
  development: '功能开发',
  implementation: '功能开发',
  coding: '功能开发',
  frontend: '前端开发',
  backend: '后端开发',
  deployment: '部署与交付',
  deploy: '部署与交付',
  delivery: '部署与交付',
  release: '部署与交付',
  migration: '迁移与改造',
  migrate: '迁移与改造',
  refactor: '迁移与改造',
  testing: '测试与质量',
  test: '测试与质量',
  qa: '测试与质量',
  general: '通用路径',
}

export function daemonPathCategoryLabel(category: string | undefined): string {
  const value = String(category || 'general').trim()
  if (!value) return CATEGORY_LABELS.general
  const key = value.toLowerCase().replace(/[\s_-]+/g, '')
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key]
  if (/migrat|refactor|upgrade/.test(key)) return '迁移与改造'
  if (/deploy|deliver|release|publish|ops/.test(key)) return '部署与交付'
  if (/test|quality|verify|validation|\bqa\b/.test(key)) return '测试与质量'
  if (/plan|require|design|analysis|research/.test(key)) return '规划与方案'
  if (/frontend|web|client/.test(key)) return '前端开发'
  if (/backend|server|api/.test(key)) return '后端开发'
  if (/feat|impl|develop|coding|runtime|integrat/.test(key)) return '功能开发'
  if (!/[a-z]/i.test(value)) return value
  return '其他路径'
}

export function groupDaemonPaths(paths: DaemonPathItem[]): DaemonPathGroup[] {
  const groups = new Map<string, DaemonPathGroup>()
  for (const item of paths) {
    const id = String(item.catalog?.category || 'general').trim() || 'general'
    const existing = groups.get(id)
    if (existing) existing.items.push(item)
    else groups.set(id, { id, label: daemonPathCategoryLabel(id), items: [item] })
  }
  return [...groups.values()]
}

const VISIBILITY_TAGS: Record<string, string> = {
  primary: '常用',
  more: '更多',
  advanced: '进阶',
}

export function daemonPathTags(item: DaemonPathItem): string[] {
  const tags = (item.tags || []).map((tag) => String(tag).trim()).filter(Boolean)
  const visibility = VISIBILITY_TAGS[String(item.catalog?.visibility || '').toLowerCase()]
  if (visibility) tags.push(visibility)
  if (item.locked) tags.push('已锁定')
  return [...new Set(tags)].slice(0, 3)
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

const TASK_URL_RE = /https?:\/\/[^\s<>"'）】\]]+/gi
const TASK_LABEL_RE = /^(需求文档|需求说明|需求|目标|标题|PRD|Goal|Brief)\s*[:：]?\s*/i

function firstTaskUrl(intent: string): string {
  const match = intent.match(TASK_URL_RE)?.[0] || ''
  return match.replace(/[),.;!?，。；！？）】]+$/, '')
}

function daemonTaskSourceLabel(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    if (/feishu\.cn$|larksuite\.com$/.test(host)) {
      if (/\/wiki\//.test(path)) return '飞书文档'
      if (/\/sheets?\//.test(path)) return '飞书表格'
      if (/\/(base|bitable)\//.test(path)) return '飞书多维表格'
      if (/\/minutes?\//.test(path)) return '飞书妙记'
      if (/\/docx?\//.test(path)) return '飞书文档'
      return '飞书链接'
    }
    return `${parsed.hostname.replace(/^www\./, '')} 链接`
  } catch {
    return '相关链接'
  }
}

function daemonTaskSourceTitle(task: Record<string, unknown>): string {
  const source = asRecord(task.source)
  const metadata = asRecord(task.metadata)
  const title = String(
    task.sourceTitle ||
    task.source_title ||
    task.documentTitle ||
    task.document_title ||
    task.docTitle ||
    task.doc_title ||
    source.title ||
    metadata.sourceTitle ||
    metadata.source_title ||
    metadata.documentTitle ||
    metadata.document_title ||
    '',
  ).trim().slice(0, 120)
  if (/^(?:飞书云文档|飞书文档|飞书知识库|飞书链接|知识库|未命名文档|无标题)$/i.test(title)) return ''
  return title
}

function daemonTaskTopic(task: Record<string, unknown>, intent: string, pathName: string, sourceUrl: string): string {
  const explicit = String(task.topic || task.subject || task.displayTitle || task.purposeTitle || '').trim()
  if (explicit) return explicit
  const prefix = intent.match(TASK_LABEL_RE)?.[1] || ''
  const prose = intent
    .replace(TASK_URL_RE, ' ')
    .replace(TASK_LABEL_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (prose) return prose.length > 44 ? `${prose.slice(0, 43).trimEnd()}…` : prose
  if (prefix) return `${prefix.toUpperCase() === 'PRD' ? '需求文档' : prefix}任务`
  if (sourceUrl) return daemonTaskSourceLabel(sourceUrl).replace(/链接$/, '任务')
  return pathName || '管线任务'
}

export function daemonTaskTimeLabel(value: string | undefined, now = Date.now()): string {
  const timestamp = Date.parse(String(value || ''))
  if (!Number.isFinite(timestamp)) return ''
  const diff = Math.max(0, now - timestamp)
  const minute = Math.floor(diff / 60000)
  if (minute < 1) return '刚刚'
  if (minute < 60) return `${minute} 分钟前`
  const hour = Math.floor(minute / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} 天前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function daemonTaskStatusLabel(task: Record<string, unknown>, bucket: string): string {
  const explicit = String(task.statusLabel || '').trim()
  if (explicit && !/^[a-z_-]+$/i.test(explicit)) return explicit
  if (bucket === 'failed') return '失败'
  if (bucket === 'done') return '已完成'
  if (bucket === 'needs_you') return '待处理'
  return '进行中'
}

function toTaskCard(raw: unknown, workflows: unknown[]): DaemonTaskCard {
  const task = asRecord(raw)
  const slug = String(task.slug || task.id || '').trim()
  const intent = String(task.intent || task.title || task.goal || '').trim()
  const pathName = pathNameOf(task, workflows)
  const bucket = String(task.bucket || runBucket(task))
  const statusLabel = daemonTaskStatusLabel(task, bucket)
  const sourceUrl = firstTaskUrl(intent)
  const sourceLabel = daemonTaskSourceLabel(sourceUrl)
  const sourceTitle = daemonTaskSourceTitle(task)
  const title = daemonTaskTopic(task, intent, pathName, sourceUrl)
  const updatedAt = String(task.updatedAt || task.updated_at || task.createdAt || task.created_at || '')
  return {
    slug,
    title,
    intent,
    intentTitle: title,
    cardTitle: title,
    pathName,
    statusLabel,
    sourceUrl,
    sourceLabel,
    sourceTitle,
    bucket,
    rawStatus: runState(task),
    tone: bucket === 'failed' ? 'failed' : (bucket === 'done' ? 'done' : (bucket === 'needs_you' ? 'waiting' : 'active')),
    cardMeta: [pathName, statusLabel].filter(Boolean).join(' · '),
    relativeTime: daemonTaskTimeLabel(updatedAt),
    updatedAt,
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
    const hay = [item.title, item.slug, item.pathName, item.statusLabel, item.intent, item.cardMeta, item.sourceLabel, item.sourceUrl]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
    return hay.includes(q)
  })
}

export function daemonFilterTitle(filter: string): string {
  return DAEMON_RUN_FILTERS.find((item) => item.id === filter)?.title || '全部'
}

export function daemonComposeCanAttempt(
  online: boolean,
  workflow: DaemonPathItem | undefined,
  submitting: boolean,
): boolean {
  return !submitting && online && !!workflow && !workflow.locked
}
