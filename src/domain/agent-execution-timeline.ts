import type { ChatMessage } from '../shared/api'

export type AgentTraceStatus = 'pending' | 'done' | 'error' | 'cancelled'

export type AgentTraceItem = {
  id: string
  kind: 'stage' | 'tool' | 'subrun'
  title: string
  status: AgentTraceStatus
  summary?: string
  durationMs?: number
  toolName?: string
  round?: number
}

export type ExecutionTimelineRow = {
  id: string
  kind: AgentTraceItem['kind']
  status: AgentTraceStatus
  title: string
  hint?: string
  durationLabel?: string
  expandable?: boolean
}

export type ExecutionTimelineView = {
  running: boolean
  /** 单步不展开，避免「执行进度」卡再套一层同文案 */
  compact: boolean
  summaryTitle: string
  summaryMeta: string
  rows: ExecutionTimelineRow[]
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

export function userStatusLabel(title: string, status = ''): string {
  const original = String(title || '').trim()
  const text = original.toLowerCase()
  if (/检索|查找|知识/.test(text)) return status === 'done' ? '资料查找完成' : '正在查找相关资料'
  if (/上下文|准备/.test(text)) return status === 'done' ? '内容整理完成' : '正在整理相关内容'
  if (/模型|生成|回答|完善/.test(text)) return status === 'done' ? '回答已完成' : '正在组织回答'
  if (/工具|操作/.test(text)) return status === 'done' ? '操作已完成' : '正在处理相关操作'
  if (/失败|错误/.test(text)) return '处理未完成'
  if (status === 'done') {
    if (original && !/^(完成|已完成|执行完成|处理完成)$/i.test(original)) return original
    return '执行完成'
  }
  return original || '正在处理'
}

export function formatElapsed(ms: number): string {
  const value = Number(ms) || 0
  if (value <= 0) return ''
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(1)}s`
}

/** 正文第一次非空时记下 firstTokenMs；已有值不覆盖。 */
export function stampStreamTiming(message: ChatMessage, now = Date.now()): ChatMessage {
  const startedAt = Number(message.startedAt) || 0
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : Number(message.elapsedMs) || 0
  const hasText = Boolean(String(message.text || '').trim())
  const existing = Number(message.firstTokenMs)
  const firstTokenMs = Number.isFinite(existing) && existing > 0
    ? existing
    : (hasText && startedAt ? elapsedMs : undefined)
  return {
    ...message,
    elapsedMs: elapsedMs || message.elapsedMs,
    firstTokenMs,
  }
}

export function formatFirstToken(ms?: number | null): string {
  const label = formatElapsed(Number(ms) || 0)
  return label ? `首 Token ${label}` : ''
}

/** 思考中显示等待；出字后显示首 Token；结束后附总耗时。 */
export function formatReplyTiming(opts: {
  firstTokenMs?: number | null
  elapsedMs?: number | null
  streaming?: boolean
  hasText?: boolean
}): string {
  const first = formatFirstToken(opts.firstTokenMs)
  const total = formatElapsed(Number(opts.elapsedMs) || 0)
  if (opts.streaming && !opts.hasText) return total ? `等待首 Token · ${total}` : '等待首 Token'
  if (opts.streaming) return first || (total ? `生成中 · ${total}` : '')
  return [first, total ? `共 ${total}` : ''].filter(Boolean).join(' · ')
}

export function seedPrepareTrace(): AgentTraceItem[] {
  return [{
    id: 'stage_prepare',
    kind: 'stage',
    title: '正在准备上下文…',
    status: 'pending',
  }]
}

function normalizeStatus(type: string, raw: unknown): AgentTraceStatus {
  const status = String(raw || '').toLowerCase()
  if (type === 'tool.started' || type.endsWith('.progress') || type.endsWith('.waiting')) return 'pending'
  if (type.includes('fail') || type === 'error' || status === 'error' || status === 'failed') return 'error'
  if (type.includes('cancel') || status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'pending') return 'pending'
  return 'done'
}

function normalizeKind(type: string, rawKind: unknown): AgentTraceItem['kind'] {
  if (type.startsWith('tool') || rawKind === 'tool') return 'tool'
  if (type.startsWith('subrun') || rawKind === 'subrun') return 'subrun'
  return 'stage'
}

export function parseTraceItems(raw: unknown): AgentTraceItem[] {
  if (!Array.isArray(raw)) return []
  const items: AgentTraceItem[] = []
  for (const entry of raw) {
    const rec = asRecord(entry)
    const id = String(rec.id || rec.toolCallId || rec.subRunId || '').trim()
    if (!id) continue
    const status = normalizeStatus('', rec.status)
    items.push({
      id,
      kind: rec.kind === 'tool' || rec.kind === 'subrun' ? rec.kind : 'stage',
      title: String(rec.timelineTitle || rec.title || rec.toolName || '').trim() || '正在处理',
      status,
      summary: String(rec.summary || '').trim() || undefined,
      durationMs: Number(rec.durationMs) || undefined,
      toolName: String(rec.toolName || '').trim() || undefined,
      round: Number.isFinite(Number(rec.round)) ? Number(rec.round) : undefined,
    })
  }
  return items.slice(-48)
}

export function applyAssistantStreamEvent(message: ChatMessage, event: Record<string, unknown>): ChatMessage {
  const nested = asRecord(event.payload)
  const flat = { ...asRecord(event), ...nested }
  const type = String(event.type || flat.type || 'stage')
  if (type === 'content' || type === 'answer.committed' || type === 'choice.ready') return message
  if (type === 'plan.updated') {
    const plan = flat.plan && typeof flat.plan === 'object' ? flat.plan as ChatMessage['plan'] : message.plan
    return plan ? { ...message, plan, thinking: false } : message
  }

  const activity = String(flat.title || flat.summary || message.activity || '').trim()
  const id = String(flat.id || flat.toolCallId || flat.subRunId || '').trim()
  if (!id) {
    return activity ? { ...message, activity, thinking: message.thinking && !message.text } : message
  }

  const item: AgentTraceItem = {
    id,
    kind: normalizeKind(type, flat.kind),
    title: String(flat.timelineTitle || flat.title || flat.toolName || '正在处理').trim(),
    status: normalizeStatus(type, flat.status),
    summary: String(flat.summary || '').trim() || undefined,
    durationMs: Number(flat.durationMs) || undefined,
    toolName: String(flat.toolName || '').trim() || undefined,
    round: Number.isFinite(Number(flat.round)) ? Number(flat.round) : undefined,
  }
  const trace = [...(message.trace || [])]
  const index = trace.findIndex((row) => row.id === item.id)
  if (index >= 0) trace[index] = { ...trace[index], ...item }
  else trace.push(item)
  return {
    ...message,
    activity: activity || message.activity,
    thinking: false,
    trace: trace.slice(-48),
  }
}

export function buildExecutionTimelineView(
  message: Pick<ChatMessage, 'trace' | 'streaming' | 'startedAt' | 'elapsedMs'>,
  now = Date.now(),
): ExecutionTimelineView | null {
  const trace = parseTraceItems(message.trace)
  if (!trace.length) return null
  const pending = trace.some((item) => item.status === 'pending')
  const running = Boolean(message.streaming) || pending
  const elapsedMs = Number.isFinite(message.elapsedMs)
    ? Number(message.elapsedMs)
    : (running && Number(message.startedAt) ? now - Number(message.startedAt) : 0)
  const toolCount = trace.filter((item) => item.kind === 'tool').length
  const errorCount = trace.filter((item) => item.status === 'error').length
  const rounds = new Set(trace.map((item) => item.round).filter((value) => Number.isFinite(value)))
  const current = [...trace].reverse().find((item) => item.status === 'pending') || trace[trace.length - 1]
  const summaryMeta = running
    ? formatElapsed(elapsedMs)
    : `${trace.length} 步${rounds.size > 1 ? ` / ${rounds.size} 轮` : ''}${toolCount ? ` / ${toolCount} 项操作` : ''}${errorCount ? ` / ${errorCount} 项未完成` : ''}`
  const currentTitle = userStatusLabel(current?.title || '正在处理', current?.status)

  return {
    running,
    compact: trace.length <= 1,
    summaryTitle: running || trace.length === 1 ? currentTitle : '执行过程',
    summaryMeta,
    rows: trace.map((item) => {
      const status = item.status
      const title = item.kind === 'tool' || item.kind === 'subrun'
        ? (item.title || item.toolName || '相关操作')
        : userStatusLabel(item.title, status)
      const hint = String(item.summary || '').trim()
      return {
        id: item.id,
        kind: item.kind,
        status,
        title,
        hint: hint && hint !== title ? hint.slice(0, 220) : undefined,
        durationLabel: formatElapsed(Number(item.durationMs) || 0),
        expandable: item.kind === 'tool' && Boolean(hint),
      }
    }),
  }
}
