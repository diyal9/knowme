export interface GroundingSource {
  tool?: string
  status?: string
}

export interface GroundingStatus {
  status?: string
  sources?: GroundingSource[]
  violations?: unknown[]
}

export interface GroundingMetaView {
  className: string
  badge: string
  violationText: string
  sources: GroundingSource[]
}

const TOOL_LABELS: Record<string, string> = {
  'feishu.meeting_candidates': '飞书会议候选',
  'feishu.meeting_read': '飞书妙记',
  'feishu.today_priority': '今日优先级',
  'feishu.doc_kb_suggest': '文档/知识库推荐',
  'feishu.related_chats': '相关聊天',
}

function formatToolLabel(toolName: string): string {
  const key = String(toolName || '').trim()
  return TOOL_LABELS[key] || key || '外部内容读取'
}

function formatSourceStatus(status: string): string {
  if (status === 'truncated') return '截断'
  if (status === 'fail') return '失败'
  if (status === 'ok') return '成功'
  return status || '未知'
}

export function buildGroundingMetaView(gs: GroundingStatus | null | undefined): GroundingMetaView | null {
  if (!gs) return null
  const status = String(gs.status || 'pending')
  const className = status === 'verified' ? 'is-verified' : (status === 'blocked' ? 'is-blocked' : 'is-pending')
  const badge = status === 'verified' ? '输出已验证' : (status === 'blocked' ? '证据不足' : '验证中')
  const violation = Array.isArray(gs.violations) ? gs.violations[0] : null
  const violationText = violation && typeof violation === 'object'
    ? String((violation as Record<string, unknown>).message || (violation as Record<string, unknown>).code || '').trim()
    : String(violation || '').trim()
  const sources = Array.isArray(gs.sources) ? gs.sources.filter((item) => item && item.tool) : []
  return { className, badge, violationText, sources }
}

export function formatGroundingSourceLine(source: GroundingSource): string {
  return `${formatToolLabel(String(source.tool || ''))} · ${formatSourceStatus(String(source.status || ''))}`
}
