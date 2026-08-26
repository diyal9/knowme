import type { ChatMessage, StructuredChoiceBar, StructuredChoiceItem } from '../shared/api'

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
}

function parseChoiceItem(raw: unknown): StructuredChoiceItem | null {
  const rec = asRecord(raw)
  const label = String(rec.label || '').trim()
  if (!label) return null
  return {
    id: String(rec.id || '').trim() || undefined,
    label,
    description: String(rec.description || '').trim() || undefined,
    action: String(rec.action || 'send').trim() || 'send',
    payload: String(rec.payload || ''),
  }
}

export function parseStructuredChoiceBars(raw: unknown): StructuredChoiceBar[] {
  if (!Array.isArray(raw)) return []
  const bars: StructuredChoiceBar[] = []
  for (const entry of raw) {
    const rec = asRecord(entry)
    const items = Array.isArray(rec.items) ? rec.items.map(parseChoiceItem).filter(Boolean) as StructuredChoiceItem[] : []
    if (!items.length) continue
    bars.push({
      kind: String(rec.kind || 'choice'),
      title: String(rec.title || '结构化选择').trim() || '结构化选择',
      items,
    })
  }
  return bars
}

export function parseGroundingStatus(raw: unknown) {
  const rec = asRecord(raw)
  if (!Object.keys(rec).length) return undefined
  return {
    status: String(rec.status || '').trim() || undefined,
    sources: Array.isArray(rec.sources)
      ? rec.sources.map((item) => {
        const row = asRecord(item)
        return {
          tool: String(row.tool || '').trim() || undefined,
          status: String(row.status || '').trim() || undefined,
        }
      }).filter((item) => item.tool)
      : undefined,
    violations: Array.isArray(rec.violations) ? rec.violations : undefined,
  }
}

export function enrichChatMessage(raw: unknown, fallback: Partial<ChatMessage>): ChatMessage {
  const rec = asRecord(raw)
  const role: ChatMessage['role'] = rec.role === 'user' || rec.role === 'assistant' || rec.role === 'system' || rec.role === 'error'
    ? rec.role
    : (fallback.role || 'assistant')
  const ui = parseStructuredChoiceBars(rec.ui)
  const groundingStatus = parseGroundingStatus(rec.groundingStatus)
  const suggestionChosenIndex = Number.isInteger(rec.suggestionChosenIndex)
    ? Number(rec.suggestionChosenIndex)
    : undefined
  const startedAt = Number(rec.startedAt || fallback.startedAt)
  const elapsedMs = Number(rec.elapsedMs || fallback.elapsedMs)
  const createdAtValue = String(rec.createdAt || fallback.createdAt || '').trim()
  const createdAt = createdAtValue && !Number.isNaN(new Date(createdAtValue).getTime())
    ? new Date(createdAtValue).toISOString()
    : undefined
  return {
    id: String(rec.id || fallback.id || ''),
    role,
    text: String(rec.text || rec.content || fallback.text || ''),
    createdAt,
    streaming: rec.streaming === true || fallback.streaming,
    thinking: rec.thinking === true || fallback.thinking,
    activity: String(rec.activity || fallback.activity || '').trim() || undefined,
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : undefined,
    elapsedMs: Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : undefined,
    trace: Array.isArray(rec.trace) ? rec.trace as ChatMessage['trace'] : fallback.trace,
    attachmentName: String(rec.attachmentName || fallback.attachmentName || '').trim() || undefined,
    groundingStatus,
    structuredUi: ui.length ? ui : undefined,
    suggestionChosenIndex,
    protocolVersion: Number(rec.protocolVersion) || fallback.protocolVersion,
    runId: String(rec.runId || fallback.runId || '').trim() || undefined,
    v2AnswerCommitted: rec.v2AnswerCommitted === true || fallback.v2AnswerCommitted,
    plan: rec.plan && typeof rec.plan === 'object' ? rec.plan as ChatMessage['plan'] : fallback.plan,
  }
}

export function lastErrorMessageText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i]
    if (item.role === 'error' && String(item.text || '').trim()) return String(item.text).trim()
  }
  return ''
}

export function hasErrorMessage(messages: ChatMessage[]): boolean {
  return Boolean(lastErrorMessageText(messages))
}
