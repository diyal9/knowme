'use strict'

const { normalizeLocale: normalizePromptLocale } = require('./prompts/registry')

const NO_TOOL_COLLABORATION_MODES = new Set(['expert-planning', 'expert-discussion'])
const COLLABORATION_MODES = new Set([...NO_TOOL_COLLABORATION_MODES, 'expert-execution'])
const PROMPT_SURFACES = new Set([
  'partner-chat',
  'partner-work',
  'assistant-chat',
  'assistant-work',
  'expert-planning',
  'expert-discussion',
  'expert-execution',
  'workflow',
])

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase()
  return ['chat', 'assist', 'retrieval'].includes(tier) ? tier : 'chat'
}

function normalizeLocale(value) {
  return normalizePromptLocale(value)
}

function resolveExecutionPolicy({ conversationMode = '', toolsEnabled = false } = {}) {
  if (NO_TOOL_COLLABORATION_MODES.has(String(conversationMode || ''))) return 'no-tools'
  return toolsEnabled ? 'tools-allowed' : 'no-tools'
}

function resolvePromptSurface({
  conversationMode = '',
  workflowConversation = false,
  personalSession = false,
  tier = 'chat',
} = {}) {
  const mode = String(conversationMode || '').trim()
  if (COLLABORATION_MODES.has(mode)) return mode
  if (workflowConversation) return 'workflow'
  const light = normalizeTier(tier) === 'chat'
  if (personalSession) return light ? 'partner-chat' : 'partner-work'
  return light ? 'assistant-chat' : 'assistant-work'
}

/**
 * Keep prompt layers aligned with the active product surface. Generic partner
 * operating rules must not leak into experts or workflows, while a casual
 * partner turn only needs personality/style rather than work-domain context.
 */
function resolvePromptLayerPolicy(input = {}) {
  const resolved = resolvePromptSurface(input)
  const surface = PROMPT_SURFACES.has(resolved) ? resolved : 'assistant-chat'
  if (surface === 'partner-chat') {
    return {
      surface,
      includeUserPrompt: false,
      includeWorkProfile: false,
      agentPersonaScope: 'style',
    }
  }
  if (surface === 'partner-work') {
    return {
      surface,
      includeUserPrompt: true,
      includeWorkProfile: true,
      agentPersonaScope: 'full',
    }
  }
  if (surface.startsWith('expert-') || surface === 'workflow') {
    return {
      surface,
      includeUserPrompt: true,
      includeWorkProfile: true,
      agentPersonaScope: 'none',
    }
  }
  return {
    surface,
    includeUserPrompt: surface === 'assistant-work',
    includeWorkProfile: surface === 'assistant-work',
    agentPersonaScope: 'none',
  }
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
    : conversationMode === 'expert-execution'
      ? 'execution'
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
  NO_TOOL_COLLABORATION_MODES,
  PROMPT_SURFACES,
  normalizeTier,
  normalizeLocale,
  resolveExecutionPolicy,
  resolvePromptSurface,
  resolvePromptLayerPolicy,
  isToolExecutionAllowed,
  shouldProjectToolSurface,
  resolveContextPolicy,
  isBlockApplicable,
}
