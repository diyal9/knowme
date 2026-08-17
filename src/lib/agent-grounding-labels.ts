'use strict'

/**
 * 用户可见的工具/能力名称映射。内部 ledger 仍保留机器 tool id。
 */

const TOOL_USER_LABELS = {
  'search_web': '公开网络搜索',
  'fetch_web_page': '公开网页原文读取',
  'search_knowledge': '当前知识库检索',
  'feishu.meeting_read': '飞书会议妙记读取',
  'feishu.meeting_candidates': '飞书会议候选检索',
  'feishu.read_doc': '飞书文档读取',
  'feishu.get_wiki_node': '飞书知识库读取',
  'feishu.search_docs': '飞书文档搜索',
  'feishu.draft_minute_permission': '飞书妙记权限申请',
}

const RAW_TOOL_ID_RE = /[a-zA-Z0-9_-]+\.[a-zA-Z0-9_.-]+/g

function formatToolLabelForUser(toolName) {
  const name = String(toolName || '').trim()
  if (!name) return '外部内容读取'
  if (TOOL_USER_LABELS[name]) return TOOL_USER_LABELS[name]
  const short = name.includes('.') ? name.split('.').slice(1).join('·') : name
  return short.replace(/_/g, ' ').trim() || '外部内容读取'
}

function formatToolLabelsForUser(tools = []) {
  const list = Array.isArray(tools) ? tools : [tools]
  return list.filter(Boolean).map(formatToolLabelForUser)
}

function stripRawToolIdsFromText(text = '') {
  return String(text || '').replace(RAW_TOOL_ID_RE, (id) => formatToolLabelForUser(id))
}

function formatViolationForUser(violation) {
  if (!violation || typeof violation !== 'object') return ''
  const code = String(violation.code || '')
  if (code === 'missing_required_tools') {
    const tools = Array.isArray(violation.missingTools) ? violation.missingTools : []
    if (tools.length) {
      return `缺少必需读取：${formatToolLabelsForUser(tools).join('、')}`
    }
    const msg = String(violation.message || '')
    const match = msg.match(/缺少必需工具调用:\s*(.+)/)
    if (match) {
      const labels = match[1].split(',').map(t => formatToolLabelForUser(t.trim())).filter(Boolean)
      if (labels.length) return `缺少必需读取：${labels.join('、')}`
    }
    return '缺少必需读取，暂不能给出具体细节'
  }
  if (code === 'missing_required_evidence') {
    return '工具返回的内容不足，无法据此生成具体事实'
  }
  if (code === 'false_execution_claim') {
    return '当前还没有成功的读取结果，不能声称已完成读取'
  }
  if (code === 'ungrounded_external_fact') {
    return '还没有可验证的正文证据，不能输出具体议题或责任人'
  }
  if (code === 'completion_unmet') {
    return '任务完成条件尚未满足'
  }
  if (code === 'unbound_selection') {
    return '选择尚未绑定到具体会议或文档'
  }
  const fallback = stripRawToolIdsFromText(violation.message || '')
  return fallback || '证据不足，需先完成读取或澄清选择'
}

function formatViolationsForUser(violations = []) {
  const list = Array.isArray(violations) ? violations : []
  if (!list.length) return ''
  return formatViolationForUser(list[0])
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TOOL_USER_LABELS,
    RAW_TOOL_ID_RE,
    formatToolLabelForUser,
    formatToolLabelsForUser,
    stripRawToolIdsFromText,
    formatViolationForUser,
    formatViolationsForUser,
  }
}

if (typeof window !== 'undefined') {
  window.GroundingLabels = {
    formatToolLabelForUser,
    formatToolLabelsForUser,
    stripRawToolIdsFromText,
    formatViolationForUser,
    formatViolationsForUser,
  }
}
