'use strict'

/**
 * 动态上下文装配：按意图档位裁记忆，再把各段 fit 进输入预算。
 * 不负责会话压缩、检索本身。
 */

const llmRuntime = require('./llm-runtime')

/** 动态段最多占模型输入预算的比例。 */
const DYNAMIC_CONTEXT_BUDGET_RATIO = 0.45
/** 动态段绝对上限（token 当量），防止超大 inputBudget 灌爆。 */
const DYNAMIC_CONTEXT_BUDGET_CAP = 16000

/** chat 档不注入工作记忆；work 档且有正文才启用。 */
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

/** 按 priority 拼接动态段；超预算由 llmRuntime.fitSections 丢低优先级。 */
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
  // 各段 maxTokens 为软上限；总预算由 fitBudget 裁。
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
  const fitBudget = Math.min(
    DYNAMIC_CONTEXT_BUDGET_CAP,
    Math.floor((policy?.inputBudget || 0) * DYNAMIC_CONTEXT_BUDGET_RATIO),
  )
  const fitted = llmRuntime.fitSections(sections, fitBudget)
  return {
    dynamicContext: fitted.text,
    candidateSections: sections.filter(section => String(section.text || '').trim()),
    sections: fitted.sections,
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
