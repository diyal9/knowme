'use strict'

const FEISHU_FACT_TOOLS = new Set([
  'feishu.related_chats',
  'feishu.today_priority',
  'feishu.doc_kb_suggest',
  'feishu.search_docs',
  'feishu.read_doc',
  'feishu.get_wiki_node',
  'feishu.meeting_candidates',
  'feishu.meeting_read',
  'feishu.meeting_inventory',
])

function hasPriorFeishuFacts(session) {
  const list = Array.isArray(session?.messages) ? session.messages : []
  const liveReceipt = list.some(item => item
    && item.role === 'tool'
    && item.status === 'done'
    && FEISHU_FACT_TOOLS.has(String(item.toolName || ''))
    && String(item.text || '').trim())
  if (liveReceipt) return true

  // Tool messages eventually move into the platform-authored compaction
  // digest. Recognize only its dedicated tool section, never arbitrary user
  // prose, so long conversations retain the same grounding provenance.
  const summary = String(session?.summary || '')
  const toolSections = summary.match(/### 已执行工具与结果\s*\n[\s\S]*?(?=\n### |$)/g) || []
  return toolSections.some(section => [...FEISHU_FACT_TOOLS].some(toolName => (
    section.includes(`- ${toolName}：`) || section.includes(`- ${toolName}:`)
  )))
}

module.exports = { FEISHU_FACT_TOOLS, hasPriorFeishuFacts }
