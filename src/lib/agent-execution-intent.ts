'use strict'

const { detectFeishuIntent } = require('./feishu-grounding')

const EMPTY_FEISHU_INTENT = Object.freeze({
  mentioned: false,
  needsSearch: false,
  needsContentRead: false,
  asksMinutes: false,
  directDocRead: false,
  asksRelatedChats: false,
  asksTodayPriority: false,
  asksDocKbSuggest: false,
})

// Project declared obligations into verification intent; never expand the
// contract from SOP text, source material, or inferred workflow prerequisites.
const FEISHU_TOOL_INTENTS = Object.freeze({
  'feishu.related_chats': ['asksRelatedChats'],
  'feishu.today_priority': ['asksTodayPriority'],
  'feishu.doc_kb_suggest': ['asksDocKbSuggest'],
  'feishu.search_docs': ['needsSearch'],
  'feishu.read_doc': ['directDocRead', 'needsContentRead'],
  'feishu.get_wiki_node': ['needsContentRead'],
  'feishu.meeting_candidates': ['asksMinutes', 'needsSearch'],
  'feishu.meeting_read': ['asksMinutes', 'needsContentRead'],
})

function feishuIntentFromContract(contract = {}) {
  const intent = { ...EMPTY_FEISHU_INTENT }
  const tools = [
    ...(Array.isArray(contract?.requiredTools) ? contract.requiredTools : []),
    ...(Array.isArray(contract?.requiredEvidence) ? contract.requiredEvidence.map(rule => rule?.tool) : []),
    ...(Array.isArray(contract?.completionConditions) ? contract.completionConditions.map(rule => rule?.tool) : []),
  ]
  for (const value of tools) {
    const tool = typeof value === 'string' ? value.trim() : ''
    if (!tool.startsWith('feishu.')) continue
    intent.mentioned = true
    for (const flag of FEISHU_TOOL_INTENTS[tool] || []) intent[flag] = true
  }
  return intent
}

function resolveFeishuExecutionIntent({ conversationMode, executionContract, prompt = '' } = {}) {
  return conversationMode === 'expert-execution'
    ? feishuIntentFromContract(executionContract)
    : detectFeishuIntent(prompt)
}

module.exports = { resolveFeishuExecutionIntent, feishuIntentFromContract }
