import type { ChatMessage, StructuredChoiceBar, StructuredChoiceItem } from '../shared/api'

const STRUCTURED_CHOICE_ACTIONS = new Set(['fill', 'send', 'copy', 'open_link', 'open_knowledge'])

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
  if (!Array.isArray(raw)) {
    const record = asRecord(raw)
    if (Array.isArray(record.items)) {
      return parseStructuredChoiceBars([record])
    }
    return []
  }
  const bars: StructuredChoiceBar[] = []
  const wrappedBars = raw.filter((entry) => Array.isArray(asRecord(entry).items))
  if (!wrappedBars.length) {
    const items = raw.map(parseChoiceItem).filter(Boolean) as StructuredChoiceItem[]
    return items.length
      ? [{ kind: 'choice', title: '下一步建议', items }]
      : []
  }
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

function readJsonValueAt(source: string, start: number): { value: unknown; end: number } | null {
  const opening = source[start]
  if (opening !== '{' && opening !== '[') return null
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') {
      stack.push(char)
      continue
    }
    if (char !== '}' && char !== ']') continue
    const expected = char === '}' ? '{' : '['
    if (stack.pop() !== expected) return null
    if (!stack.length) {
      try {
        return { value: JSON.parse(source.slice(start, index + 1)), end: index + 1 }
      } catch {
        return null
      }
    }
  }
  return null
}

function hasSuggestionContext(source: string, start: number): boolean {
  const before = source.slice(Math.max(0, start - 320), start)
  return /下一步|建议|可直接点选|交付建议|操作建议|选择一项/i.test(before)
}

/**
 * 兼容旧会话中未拆出 ui 字段的 assistant 消息。
 * 只接受行首的 JSON，且必须是白名单 action 的建议项，避免把普通配置 JSON 变成按钮。
 */
export function extractStructuredChoiceFromText(text: string): {
  text: string
  bars: StructuredChoiceBar[]
} | null {
  const source = String(text || '').replace(/\r\n/g, '\n')
  const candidates: number[] = []
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '{' && source[index] !== '[') continue
    const lineStart = source.lastIndexOf('\n', index - 1) + 1
    if (source.slice(lineStart, index).trim()) continue
    candidates.push(index)
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const start = candidates[index]
    const parsed = readJsonValueAt(source, start)
    if (!parsed) continue
    const bars = parseStructuredChoiceBars(parsed.value)
    if (!bars.length) continue
    if (bars.some((bar) => bar.items.some((item) => !STRUCTURED_CHOICE_ACTIONS.has(String(item.action || ''))))) continue
    const trailing = source.slice(parsed.end).trim()
    if (start !== 0 && trailing && !hasSuggestionContext(source, start)) continue
    const body = `${source.slice(0, start)}\n${source.slice(parsed.end)}`
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return { text: body, bars }
  }
  return null
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
  const rawText = String(rec.text || rec.content || fallback.text || '')
  const textChoice = role === 'assistant' && rec.streaming !== true && fallback.streaming !== true
    ? extractStructuredChoiceFromText(rawText)
    : null
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
    text: textChoice?.text ?? rawText,
    createdAt,
    streaming: rec.streaming === true || fallback.streaming,
    thinking: rec.thinking === true || fallback.thinking,
    activity: String(rec.activity || fallback.activity || '').trim() || undefined,
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : undefined,
    elapsedMs: Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : undefined,
    trace: Array.isArray(rec.trace) ? rec.trace as ChatMessage['trace'] : fallback.trace,
    attachmentName: String(rec.attachmentName || fallback.attachmentName || '').trim() || undefined,
    groundingStatus,
    structuredUi: ui.length ? ui : textChoice?.bars,
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
