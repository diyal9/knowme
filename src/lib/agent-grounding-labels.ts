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
  'feishu.today_priority': '飞书今日安排与待办读取',
  'feishu.related_chats': '飞书相关聊天读取',
  'feishu.doc_kb_suggest': '飞书文档/知识库检索',
  'today priority': '飞书今日安排与待办读取',
  'related chats': '飞书相关聊天读取',
  'doc kb': '飞书文档/知识库检索',
  'preview_external_project': '扫描外部项目',
  'design_external_workflow_import': '生成导入方案',
  'import_external_project': '执行项目导入',
  'verify_imported_workflow': '验证导入工作流',
  'emit_artbundle_specs': '提交 ArtBundle 规格文件',
  'create_artifact': '保存交付物',
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

function getViolationClaimLabels(violation) {
  const labels = Array.isArray(violation?.claimLabels) ? violation.claimLabels
    : (Array.isArray(violation?.claims) ? violation.claims.slice(0, 32).map(claim => claim?.label) : [])
  return [...new Set(labels.slice(0, 32).filter(label => typeof label === 'string'
    && /^[\p{L}\p{N} -]{1,24}$/u.test(label)))].slice(0, 8)
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
    const unmet = Array.isArray(violation.unmet) ? violation.unmet : []
    const tools = [...new Set(unmet.map(rule => formatToolLabelForUser(rule?.tool)).filter(Boolean))]
    if (tools.length) {
      return `还缺少可核验结果：${tools.join('、')}。通常不需要补充背景，请确认任务路径和选择后点击“重新执行”。`
    }
    return '工具返回的内容不足，无法完成验收。通常不需要补充背景，请确认任务输入后点击“重新执行”。'
  }
  if (code === 'false_execution_claim') {
    return '回复中的操作完成声明缺少对应的成功执行凭据，暂不能确认这些操作已完成'
  }
  if (code === 'ungrounded_external_fact') {
    const labels = getViolationClaimLabels(violation)
    return labels.length
      ? `回复中的「${labels.join('、')}」尚未与来源对应，需要重新核对依据`
      : '回复中的部分字段尚未与来源对应，需要重新核对依据'
  }
  if (code === 'unresolved_source_citation') {
    return '回复中的部分来源引用无法对应当前材料，需要重新核对引用'
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
    getViolationClaimLabels,
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
