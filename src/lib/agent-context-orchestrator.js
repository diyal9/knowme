'use strict'

const llmRuntime = require('./llm-runtime')

function buildMemoryPolicy({
  tier = 'chat',
  memoryContext = '',
  disableMemory = false,
} = {}) {
  if (disableMemory) {
    return { enabled: false, mode: 'off', reason: 'disabled_by_setting', source: 'none' }
  }
  if (!String(memoryContext || '').trim()) {
    return {
      enabled: false,
      mode: tier === 'chat' ? 'light' : 'work',
      reason: 'empty_memory',
      source: 'product-memory',
    }
  }
  if (tier === 'chat') {
    return { enabled: false, mode: 'light', reason: 'chat_tier', source: 'product-memory' }
  }
  return { enabled: true, mode: 'work', reason: 'enabled', source: 'product-memory' }
}

function buildDynamicContext({
  policy,
  roleGuidance = '',
  timeAnchor = '',
  groundingText = '',
  sessionSummary = '',
  retrievalContext = '',
  memoryContext = '',
  personalizationContext = '',
  planContext = '',
  memoryPolicy,
} = {}) {
  const memPolicy = memoryPolicy || buildMemoryPolicy({
    tier: policy?.tier,
    memoryContext,
  })
  const sections = [
    { key: 'role', text: roleGuidance ? `【工作方式】\n${roleGuidance}` : '', priority: 100, maxTokens: 1200 },
    { key: 'time_anchor', text: timeAnchor, priority: 98, maxTokens: 420 },
    { key: 'grounding', text: groundingText ? `【本轮内容理解】\n${groundingText}` : '', priority: 95, maxTokens: 1800 },
    { key: 'plan', text: String(planContext || '').trim(), priority: 92, maxTokens: 800 },
    { key: 'session', text: sessionSummary, priority: 90, maxTokens: 3000 },
    {
      key: 'personalization',
      text: memPolicy.mode === 'light' || memPolicy.mode === 'work'
        ? String(personalizationContext || '')
        : '',
      priority: 82,
      maxTokens: 500,
    },
    { key: 'retrieval', text: retrievalContext, priority: 70, maxTokens: 6000 },
    {
      key: 'memory',
      text: memPolicy.enabled ? String(memoryContext || '') : '',
      priority: 45,
      maxTokens: 3500,
    },
  ]
  const fitBudget = Math.min(16000, Math.floor((policy?.inputBudget || 0) * 0.45))
  const fitted = llmRuntime.fitSections(sections, fitBudget)
  return {
    dynamicContext: fitted.text,
    sectionUsage: fitted.allocations,
    sectionOmitted: fitted.omitted,
    memoryPolicy: memPolicy,
    personalizationIncluded: Boolean(
      personalizationContext &&
      (memPolicy.mode === 'light' || memPolicy.mode === 'work')
    ),
  }
}

module.exports = {
  buildMemoryPolicy,
  buildDynamicContext,
}
