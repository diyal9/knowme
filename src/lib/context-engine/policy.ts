'use strict'

const { normalizeLocale: normalizePromptLocale } = require('./prompts/registry')

const COLLABORATION_MODES = new Set(['expert-planning', 'expert-discussion'])

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase()
  return ['chat', 'assist', 'retrieval'].includes(tier) ? tier : 'chat'
}

function normalizeLocale(value) {
  return normalizePromptLocale(value)
}

function resolveExecutionPolicy({ conversationMode = '', toolsEnabled = false } = {}) {
  if (COLLABORATION_MODES.has(String(conversationMode || ''))) return 'no-tools'
  return toolsEnabled ? 'tools-allowed' : 'no-tools'
}

function isToolExecutionAllowed(executionPolicy) {
  return String(executionPolicy || '') === 'tools-allowed'
}

function shouldProjectToolSurface({ executionPolicy, tier = 'chat', slashRefs = [] } = {}) {
  return isToolExecutionAllowed(executionPolicy)
    && (String(tier || 'chat') !== 'chat' || (Array.isArray(slashRefs) && slashRefs.length > 0))
}

function resolveContextPolicy(input = {}) {
  const tier = normalizeTier(input.tier)
  const conversationMode = String(input.conversationMode || '').trim()
  const executionPolicy = String(input.executionPolicy || '').trim()
    || resolveExecutionPolicy({ conversationMode, toolsEnabled: input.toolsEnabled === true })
  const phase = conversationMode === 'expert-planning'
    ? 'planning'
    : conversationMode === 'expert-discussion' ? 'discussion' : String(input.phase || '').trim()
  const scene = COLLABORATION_MODES.has(conversationMode)
    ? 'expert-collaboration'
    : String(input.scene || '').trim() || (tier === 'retrieval' ? 'knowledge' : tier === 'assist' ? 'work' : 'assistant')
  const capabilities = [...new Set((Array.isArray(input.capabilityIds) ? input.capabilityIds : [])
    .map(item => String(item || '').trim())
    .filter(Boolean))]
  return {
    version: 1,
    tier,
    scene,
    phase,
    conversationMode,
    locale: normalizeLocale(input.locale),
    executionPolicy,
    toolsEnabled: executionPolicy === 'tools-allowed' && input.toolsEnabled === true,
    capabilityIds: capabilities,
    identity: String(input.identity || '').trim(),
    inputBudget: Math.max(1000, Number(input.inputBudget) || 8000),
  }
}

function matches(values, current) {
  return !values?.length || values.includes(current)
}

function isBlockApplicable(block, policy) {
  const applies = block?.appliesTo || {}
  if (!matches(applies.scenes, policy.scene)) return false
  if (!matches(applies.phases, policy.phase)) return false
  if (!matches(applies.tiers, policy.tier)) return false
  if (!matches(applies.executionPolicies, policy.executionPolicy)) return false
  if (applies.locales?.length && !applies.locales.includes(policy.locale)) return false
  if (applies.capabilityIds?.length) {
    const available = new Set(policy.capabilityIds || [])
    if (!applies.capabilityIds.some(id => available.has(id))) return false
  }
  if (block.kind === 'tool_contract' && !policy.toolsEnabled) return false
  return true
}

module.exports = {
  COLLABORATION_MODES,
  normalizeTier,
  normalizeLocale,
  resolveExecutionPolicy,
  isToolExecutionAllowed,
  shouldProjectToolSurface,
  resolveContextPolicy,
  isBlockApplicable,
}
