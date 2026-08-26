'use strict'

/**
 * 兼容 facade：内置提示词正文已迁移到 context-engine/prompts。
 * 新代码优先使用 buildCoreContextBlocks；旧调用继续使用 assembleCorePrompt。
 */

const { getPromptBlock, listPromptBlocks } = require('./context-engine/prompts/registry')

const CORE_BLOCK_IDS = Object.freeze(['core.runtime', 'core.conversation', 'core.integrity', 'core.output'])
const TOOL_BLOCK_IDS = Object.freeze(['tool.web', 'tool.feishu', 'ui.suggestion'])

const IDENTITY = getPromptBlock('core.runtime', 'zh-CN').content
const HARD_RULES = getPromptBlock('core.integrity', 'zh-CN').content
const OUTPUT_RULES = getPromptBlock('core.output', 'zh-CN').content
const TOOL_WEB = getPromptBlock('tool.web', 'zh-CN').content
const TOOL_FEISHU = getPromptBlock('tool.feishu', 'zh-CN').content
const SUGGESTION_RULES = getPromptBlock('ui.suggestion', 'zh-CN').content

const USER_PREF_MAX = Object.freeze({
  chat: 400,
  assist: 1200,
  retrieval: 2000,
})

function normalizeTier(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return USER_PREF_MAX[value] ? value : 'assist'
}

function capabilitySet(value) {
  return new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean))
}

function hasCapability(set, patterns) {
  if (!set.size) return true
  return [...set].some(value => patterns.some(pattern => pattern.test(value)))
}

function corePromptBlockIds({ tier = 'assist', toolsEnabled = true, capabilityIds = [] } = {}) {
  const tierId = normalizeTier(tier)
  const ids = [...CORE_BLOCK_IDS]
  if (!toolsEnabled || tierId === 'chat') return ids
  const capabilities = capabilitySet(capabilityIds)
  if (hasCapability(capabilities, [/web/, /search_web/, /fetch_web/])) ids.push('tool.web')
  if (hasCapability(capabilities, [/feishu/, /lark/])) ids.push('tool.feishu')
  if (hasCapability(capabilities, [/suggestion/, /structured-choice/, /ui/])) ids.push('ui.suggestion')
  return ids
}

function buildCoreContextBlocks(options = {}) {
  return listPromptBlocks(corePromptBlockIds(options), options.locale || 'zh-CN')
}

function assembleCorePrompt(options = {}) {
  return buildCoreContextBlocks(options).map(block => block.content).join('\n\n')
}

/** 产品规则全集；仅用于兼容导出与默认设置迁移，不代表每轮都会加载。 */
const ASSISTANT_BASE_PROMPT = assembleCorePrompt({ tier: 'assist', toolsEnabled: true })

function capPromptText(text, maxChars) {
  const value = String(text || '').trim()
  const limit = Math.max(0, Number(maxChars) || 0)
  if (!limit || value.length <= limit) return value
  return `${value.slice(0, limit)}\n…（用户偏好已按预算截断）`
}

function userPrefBudget(tier) {
  return USER_PREF_MAX[normalizeTier(tier)]
}

module.exports = {
  IDENTITY,
  HARD_RULES,
  TOOL_WEB,
  TOOL_FEISHU,
  SUGGESTION_RULES,
  OUTPUT_RULES,
  CORE_BLOCK_IDS,
  TOOL_BLOCK_IDS,
  USER_PREF_MAX,
  ASSISTANT_BASE_PROMPT,
  normalizeTier,
  corePromptBlockIds,
  buildCoreContextBlocks,
  assembleCorePrompt,
  capPromptText,
  userPrefBudget,
}
