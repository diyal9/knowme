/**
 * 助手 Context Usage 视图模型：区分 IPC/流式实测与 historyTokens 估算。
 * 不负责解析 IPC 原始 payload（见 store-session.parseContextInfo）。
 */
import type { AgentContextInfo, AgentContextSectionUsage } from '../shared/api'

export type { AgentContextInfo, AgentContextSectionUsage as ContextUsageSection }

export type ContextUsageSource = 'session' | 'estimate' | 'none'

export type ContextUsageViewModel = {
  used: number
  limit: number
  ratio: number
  barClass: '' | 'warn' | 'danger'
  rows: AgentContextSectionUsage[]
  note: string
  compacted: boolean
  /** 用量数据来源：会话实测 / 本地估算 / 尚无数据 */
  source: ContextUsageSource
  /** UI 副标题：「会话用量」或「估算」 */
  sourceLabel: string
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

/** 将会话 contextInfo 与 historyTokens 估算合成菜单侧栏展示模型 */
export function buildContextUsageViewModel(
  info: AgentContextInfo | null | undefined,
  fallbackLimit = 32768,
  historyTokens = 0,
): ContextUsageViewModel {
  const hasSessionUsage = info != null && Number.isFinite(Number(info.usedTokens))
  const source: ContextUsageSource = hasSessionUsage
    ? 'session'
    : historyTokens > 0
      ? 'estimate'
      : 'none'
  const sourceLabel = source === 'session' ? '会话用量' : source === 'estimate' ? '估算' : ''
  const used = Math.max(0, hasSessionUsage ? Number(info?.usedTokens) : historyTokens || 0)
  const limit = Math.max(1, Number(info?.contextWindow) || fallbackLimit || 32768)
  const ratio = Math.min(used / limit, 1)
  const barClass = ratio > 0.85 ? 'danger' : ratio > 0.5 ? 'warn' : ''
  const sections = Array.isArray(info?.sectionUsage) ? info.sectionUsage : []
  const rows: AgentContextSectionUsage[] = [
    { key: 'conversation', usedTokens: hasSessionUsage ? used : historyTokens || used },
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
    source,
    sourceLabel,
  }
}
