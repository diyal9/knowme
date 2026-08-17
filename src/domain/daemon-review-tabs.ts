import { normalizeLogLines, normalizeProgressText, projectProcessTranscript } from './daemon-review'

export const REVIEW_TAB_IDS = ['steps', 'artifacts', 'changes', 'events', 'logs'] as const
export type ReviewTabId = typeof REVIEW_TAB_IDS[number]

export const REVIEW_TAB_LABELS: Record<ReviewTabId, string> = {
  steps: '步骤',
  artifacts: '制品',
  changes: '变更',
  events: '事件',
  logs: '过程日志',
}

export interface ReviewStep {
  id: string
  label: string
  meta: string
  status: string
  owner: string
  type: string
  handoff: string
  outputLabel: string
  outputTitle: string
  degraded?: boolean
  degradedPlaceholder?: boolean
}

export interface ReviewArtifact {
  id: string
  name: string
  path: string
  downloadUrl: string
}

export interface ReviewEvent {
  id: string
  type: string
  message: string
  at: string
}

export interface ReviewChanges {
  summary: string
  files: { id: string; path: string; status: string }[]
  empty: boolean
}

export interface ReviewSurface {
  activeTab: ReviewTabId
  recommendedTab: ReviewTabId
  steps: ReviewStep[]
  artifacts: ReviewArtifact[]
  events: ReviewEvent[]
  changes: ReviewChanges
  process: ReturnType<typeof projectProcessTranscript>
}

function text(value: unknown): string {
  return String(value == null ? '' : value).trim()
}

function recommendTab(input: {
  steps: ReviewStep[]
  artifacts: ReviewArtifact[]
  status: string
}): ReviewTabId {
  const state = text(input.status).toLowerCase()
  const done = ['done', 'finished', 'completed', 'success'].includes(state)
  const failed = ['failed', 'error'].includes(state)
  if (done && input.artifacts.length) return 'artifacts'
  if (failed) return 'logs'
  if (input.steps.length) return 'steps'
  if (input.artifacts.length) return 'artifacts'
  return 'steps'
}

export function projectSteps(input: {
  nodes?: unknown[]
  graphNodes?: unknown[]
  statusSteps?: Record<string, string>
}): ReviewStep[] {
  const nodes = Array.isArray(input.nodes)
    ? input.nodes
    : (Array.isArray(input.graphNodes) ? input.graphNodes : [])
  const statusMap = input.statusSteps && typeof input.statusSteps === 'object'
    ? input.statusSteps
    : {}

  return nodes.map((node, index) => {
    const raw = node && typeof node === 'object' ? node as Record<string, unknown> : {}
    const id = text(raw.id || raw.node || raw.name || `step-${index + 1}`)
    const fromStatus = text(statusMap[id] || statusMap[text(raw.id)] || '')
    const status = text(raw.status || fromStatus || 'pending').toLowerCase()
    return {
      id,
      label: text(raw.label || raw.title || raw.name || id),
      meta: text(raw.meta || raw.type || raw.role || '步骤'),
      status,
      owner: text(raw.owner),
      type: text(raw.type),
      handoff: text(raw.handoff),
      outputLabel: text(raw.outputLabel),
      outputTitle: text(raw.outputTitle),
      degraded: raw.degraded === true,
      degradedPlaceholder: raw.degradedPlaceholder === true,
    }
  })
}

function projectArtifacts(list: unknown[]): ReviewArtifact[] {
  return (Array.isArray(list) ? list : []).map((item, index) => {
    if (typeof item === 'string') {
      return { id: item, name: item, path: item, downloadUrl: '' }
    }
    const raw = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const path = text(raw.path || raw.full_path || raw.fullPath)
    const downloadUrl = text(raw.downloadUrl || raw.download_url || raw.url)
    return {
      id: text(raw.id || path || downloadUrl || `artifact-${index + 1}`),
      name: text(raw.name || raw.title || path || downloadUrl || '未命名制品'),
      path,
      downloadUrl,
    }
  })
}

function projectEvents(list: unknown): ReviewEvent[] {
  const source = Array.isArray(list)
    ? list
    : (list && typeof list === 'object' && Array.isArray((list as Record<string, unknown>).events)
      ? (list as Record<string, unknown>).events as unknown[]
      : [])
  return source.slice(-100).map((item, index) => {
    const raw: Record<string, unknown> = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : { message: item }
    return {
      id: text(raw.id || raw.event_id || `event-${index + 1}`),
      type: text(raw.type || raw.kind || raw.event || 'event'),
      message: text(raw.message || raw.summary || raw.text || raw.detail || ''),
      at: text(raw.at || raw.ts || raw.time || raw.created_at || raw.createdAt || ''),
    }
  })
}

function projectChanges(body: unknown): ReviewChanges {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const files = Array.isArray(raw.files)
    ? raw.files
    : (Array.isArray(raw.changes) ? raw.changes : [])
  const normalizedFiles = files.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `chg-${index + 1}`, path: item, status: 'modified' }
    }
    const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const path = text(rec.path || rec.file || rec.name)
    return {
      id: text(rec.id || path || `chg-${index + 1}`),
      path,
      status: text(rec.status || rec.change || rec.kind || 'modified'),
    }
  }).filter((item) => item.path)
  const summary = text(raw.summary || raw.message)
  return {
    summary: summary || (normalizedFiles.length ? `${normalizedFiles.length} 个文件变更` : ''),
    files: normalizedFiles,
    empty: !normalizedFiles.length,
  }
}

export function projectReviewSurface(input: {
  nodes?: unknown[]
  graphNodes?: unknown[]
  statusSteps?: Record<string, string>
  artifacts?: unknown[]
  events?: unknown
  changes?: unknown
  progressText?: unknown
  logsText?: unknown
  status?: unknown
  activeTab?: string
} = {}): ReviewSurface {
  const steps = projectSteps(input)
  const artifacts = projectArtifacts(input.artifacts || [])
  const events = projectEvents(input.events)
  const changes = projectChanges(input.changes)
  const process = projectProcessTranscript({
    progressText: input.progressText,
    logsText: input.logsText,
    status: input.status,
  })
  const recommended = recommendTab({ steps, artifacts, status: text(input.status) })
  const activeTab = REVIEW_TAB_IDS.includes(input.activeTab as ReviewTabId)
    ? input.activeTab as ReviewTabId
    : recommended
  return {
    activeTab,
    recommendedTab: recommended,
    steps,
    artifacts,
    events,
    changes,
    process,
  }
}

export function stepVisualLabel(status: string): string {
  const map: Record<string, string> = {
    done: '已完成',
    active: '进行中',
    error: '需处理',
    pending: '待执行',
  }
  return map[text(status).toLowerCase()] || status || '未知'
}

export function artifactEmptyCopy(status: string): { title: string; body: string } {
  const state = text(status).toLowerCase()
  if (['failed', 'error'].includes(state)) {
    return { title: '暂无制品', body: '任务未能产出可展示的文件。建议先查看「步骤」定位失败节点。' }
  }
  if (['running', 'waiting', 'queued', 'pending', 'active'].includes(state)) {
    return { title: '尚无制品', body: '管线仍在执行。产出文件生成后会显示在此。' }
  }
  return { title: '暂无制品', body: '当前没有可展示的产出文件。' }
}
