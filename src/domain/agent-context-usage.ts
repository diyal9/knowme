export type ContextUsageSection = {
  key: string
  usedTokens?: number
}

export type AgentContextInfo = {
  usedTokens?: number
  contextWindow?: number
  omittedTurns?: number
  omittedMessages?: number
  sectionUsage?: ContextUsageSection[]
  sectionOmitted?: string[]
}

export type ContextUsageViewModel = {
  used: number
  limit: number
  ratio: number
  barClass: '' | 'warn' | 'danger'
  rows: ContextUsageSection[]
  note: string
  compacted: boolean
}

const SECTION_LABELS: Record<string, string> = {
  conversation: '对话',
  system: '系统提示',
  memory: '记忆',
  knowledge: '知识库',
  tools: '工具',
  grounding: '上下文',
  research: '检索',
}

export function formatTokenCount(value: number): string {
  const n = Math.max(0, Number(value) || 0)
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}

export function contextUsageSectionLabel(key: string): string {
  return SECTION_LABELS[key] || key
}

export function buildContextUsageViewModel(
  info: AgentContextInfo | null | undefined,
  fallbackLimit = 32768,
  historyTokens = 0,
): ContextUsageViewModel {
  const used = Math.max(0, Number(info?.usedTokens) || historyTokens || 0)
  const limit = Math.max(1, Number(info?.contextWindow) || fallbackLimit || 32768)
  const ratio = Math.min(used / limit, 1)
  const barClass = ratio > 0.85 ? 'danger' : ratio > 0.5 ? 'warn' : ''
  const sections = Array.isArray(info?.sectionUsage) ? info.sectionUsage : []
  const rows: ContextUsageSection[] = [
    { key: 'conversation', usedTokens: historyTokens || used },
    ...sections.filter((item) => item && item.key !== 'conversation'),
  ]
  const omittedTurns = Math.max(0, Number(info?.omittedTurns) || 0)
  const omittedMessages = Math.max(0, Number(info?.omittedMessages) || 0)
  const omittedKeys = Array.isArray(info?.sectionOmitted) ? info.sectionOmitted : []
  const noteParts: string[] = []
  if (omittedTurns || omittedMessages) {
    noteParts.push(`按轮压缩：已省略 ${omittedTurns} 轮 / ${omittedMessages} 条消息`)
  }
  if (omittedKeys.length) {
    noteParts.push(`未纳入分区：${omittedKeys.map((key) => contextUsageSectionLabel(key)).join('、')}`)
  }
  return {
    used,
    limit,
    ratio,
    barClass,
    rows: used || historyTokens || sections.length ? rows : [],
    note: noteParts.join(' · '),
    compacted: omittedTurns > 0 || omittedMessages > 0,
  }
}
