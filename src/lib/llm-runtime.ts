'use strict'

const modelCatalog = require('./llm-model-catalog')

/**
 * LLM 请求运行时：模型能力、保守 Token 估算和上下文预算。
 * 不依赖具体 Provider，便于单测和兼容 OpenAI 风格接口。
 */

const DEFAULT_CONTEXT_WINDOW = 32768
const MAX_SAFE_INPUT_TOKENS = 64000
const OUTPUT_RESERVE = 4000

const MODEL_PROFILES = [
  { match: /gpt-4o|gpt-4\.1|o[134]/i, contextWindow: 128000, maxOutput: 8192 },
  { match: /claude|sonnet|opus|haiku/i, contextWindow: 200000, maxOutput: 8192 },
  { match: /gemini/i, contextWindow: 1000000, maxOutput: 8192 },
  { match: /deepseek/i, contextWindow: 64000, maxOutput: 8192 },
  { match: /qwen|通义/i, contextWindow: 32768, maxOutput: 8192 },
]

function estimateTokens(value) {
  const text = String(value || '')
  if (!text) return 0
  let cjk = 0
  for (const char of text) {
    if (/[\u2e80-\u9fff\uf900-\ufaff]/.test(char)) cjk++
  }
  const other = text.length - cjk
  return Math.ceil(cjk / 1.5 + other / 4)
}

function contentText(content) {
  if (Array.isArray(content)) {
    return content.filter(item => item?.type === 'text').map(item => item.text || '').join('\n')
  }
  return String(content || '')
}

function getModelProfile(model, explicitProfile = {}) {
  const name = String(model || '').trim()
  const match = MODEL_PROFILES.find(profile => profile.match.test(name))
  const contextWindow = Number(explicitProfile.contextWindow) ||
    match?.contextWindow || DEFAULT_CONTEXT_WINDOW
  const maxOutput = Number(explicitProfile.maxOutput) ||
    match?.maxOutput || 4096
  const inputBudget = Math.max(
    4000,
    Math.min(MAX_SAFE_INPUT_TOKENS, contextWindow - maxOutput - OUTPUT_RESERVE),
  )
  return {
    model: name || 'unknown',
    contextWindow,
    maxOutput,
    inputBudget,
    parameter: explicitProfile.parameter ||
      (/o[134]|reasoning/i.test(name) ? 'max_completion_tokens' : 'max_tokens'),
    supportsTools: explicitProfile.supportsTools !== false,
  }
}

function clampTemperature(value, fallback = 0.7) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(2, Math.max(0, n))
}

function getRequestPolicy({
  model,
  tier = 'chat',
  temperature = 0.7,
  requestedOutput = 2000,
  profile: explicitProfile,
} = {}) {
  const profile = getModelProfile(
    model,
    explicitProfile || modelCatalog.resolveProfile({ model }),
  )
  const configured = clampTemperature(temperature)
  const factual = tier === 'assist' || tier === 'retrieval'
  const policyTemperature = factual ? Math.min(configured, 0.4) : configured
  const minimumOutput = tier === 'retrieval' ? 3200 : tier === 'assist' ? 2600 : 1200
  const outputTokens = Math.min(
    profile.maxOutput,
    Math.max(minimumOutput, Number(requestedOutput) || minimumOutput),
  )
  return {
    ...profile,
    temperature: policyTemperature,
    outputTokens,
    inputBudget: Math.max(4000, Math.min(
      profile.inputBudget,
      profile.contextWindow - outputTokens - OUTPUT_RESERVE,
    )),
  }
}

function fitText(value, maxTokens, marker = '\n…（上下文已按预算裁剪）…\n') {
  const text = String(value || '')
  const limit = Math.max(1, Number(maxTokens) || 1)
  if (estimateTokens(text) <= limit) return text

  // Small budgets can be narrower than the truncation marker itself. Binary
  // search guarantees the returned text never exceeds the declared budget.
  const prefixWithinBudget = () => {
    let low = 0
    let high = text.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (estimateTokens(text.slice(0, mid)) <= limit) low = mid
      else high = mid - 1
    }
    return text.slice(0, Math.max(1, low))
  }
  if (estimateTokens(marker) >= limit) return prefixWithinBudget()

  let low = 0
  let high = text.length
  let fitted = marker
  while (low <= high) {
    const retained = Math.floor((low + high) / 2)
    const left = Math.ceil(retained * 0.65)
    const right = Math.max(0, retained - left)
    const candidate = `${text.slice(0, left)}${marker}${right ? text.slice(-right) : ''}`
    if (estimateTokens(candidate) <= limit) {
      fitted = candidate
      low = retained + 1
    } else {
      high = retained - 1
    }
  }
  return fitted
}

function fitSections(sections, budget) {
  const list = (Array.isArray(sections) ? sections : [])
    .map((section, index) => ({
      key: section?.key || `section-${index}`,
      text: String(section?.text || '').trim(),
      priority: Number(section?.priority) || 0,
      maxTokens: Number(section?.maxTokens) || Infinity,
      index,
    }))
    .filter(section => section.text)
  let remaining = Math.max(1, Number(budget) || 1)
  const selected = new Map()
  for (const section of [...list].sort((a, b) => b.priority - a.priority || a.index - b.index)) {
    if (remaining <= 0) break
    const allowed = Math.min(remaining, section.maxTokens)
    const text = fitText(section.text, allowed)
    const used = estimateTokens(text)
    if (!used) continue
    selected.set(section.index, { ...section, text })
    remaining -= used
  }
  return {
    text: list
      .filter(section => selected.has(section.index))
      .map(section => selected.get(section.index).text)
      .join('\n\n'),
    usedTokens: Number(budget) - remaining,
    omitted: list.filter(section => !selected.has(section.index)).map(section => section.key),
    allocations: list
      .filter(section => selected.has(section.index))
      .map(section => ({
        key: section.key,
        usedTokens: estimateTokens(selected.get(section.index).text),
      })),
    sections: list
      .filter(section => selected.has(section.index))
      .map(section => ({
        key: section.key,
        text: selected.get(section.index).text,
        priority: section.priority,
        maxTokens: section.maxTokens,
        usedTokens: estimateTokens(selected.get(section.index).text),
      })),
  }
}

function fitMessages(messages, budget) {
  const source = Array.isArray(messages) ? messages : []
  if (!source.length) return { messages: [], usedTokens: 0, omitted: 0 }
  const system = source[0]?.role === 'system' ? source[0] : null
  const tail = system ? source.slice(1) : source
  const latestIndex = tail.length - 1
  let remaining = Math.max(1, Number(budget) || 1)
  const picked = new Map()

  if (system) {
    const content = fitText(system.content, Math.min(remaining, 8000))
    picked.set(0, { ...system, content })
    remaining -= estimateTokens(content)
  }

  for (let i = latestIndex; i >= 0 && remaining > 0; i--) {
    const message = tail[i]
    const allowed = Math.min(remaining, i === latestIndex ? 6000 : 3500)
    const content = fitText(message.content, allowed)
    const used = estimateTokens(content)
    if (!used) continue
    picked.set(i + (system ? 1 : 0), { ...message, content })
    remaining -= used
  }

  const result = [...picked.keys()].sort((a, b) => a - b).map(index => picked.get(index))
  return {
    messages: result,
    usedTokens: Number(budget) - remaining,
    omitted: Math.max(0, source.length - result.length),
  }
}

function messageTokens(message) {
  return estimateTokens(contentText(message?.content)) +
    (Array.isArray(message?.content) ? message.content.filter(item => item?.type === 'image_url').length * 1000 : 0) +
    (Array.isArray(message?.tool_calls)
      ? estimateTokens(JSON.stringify(message.tool_calls))
      : 0)
}

/**
 * 按「完整对话轮次」压缩：以 user 消息为界切轮，assistant/tool 归入当前轮。
 * 预算不足时整轮丢弃，绝不拆散一轮，工具调用与其结果天然成组保留。
 */
function fitConversation(messages, budget) {
  const source = Array.isArray(messages) ? messages : []
  if (!source.length) {
    return { messages: [], usedTokens: 0, omittedTurns: 0, omittedMessages: 0 }
  }
  let systemCount = 0
  while (source[systemCount]?.role === 'system') systemCount++
  const systems = source.slice(0, systemCount)
  const rest = source.slice(systemCount)

  const turns = []
  for (const message of rest) {
    if (message.role === 'user' || !turns.length) {
      turns.push([message])
    } else {
      turns[turns.length - 1].push(message)
    }
  }

  let remaining = Math.max(1, Number(budget) || 1)
  const head = []
  if (systems.length) {
    const systemCosts = systems.map(message => messageTokens(message))
    const totalSystemCost = systemCosts.reduce((sum, cost) => sum + cost, 0)
    const criticalCost = systems.reduce((sum, message, index) => (
      sum + (message?._contextCritical === true ? systemCosts[index] : 0)
    ), 0)
    const tailReserve = rest.length
      ? Math.min(512, Math.max(64, Math.floor((Number(budget) || 1) * 0.1)))
      : 0
    const criticalLimit = Math.min(8000, Math.max(0, remaining - tailReserve))
    if (criticalCost > criticalLimit) {
      const error = new Error('关键系统上下文超出模型预算，已停止请求以避免安全规则被截断')
      error.code = 'critical_context_budget_exceeded'
      error.details = { requiredTokens: criticalCost, budget: criticalLimit, blockIds: [] }
      throw error
    }
    const systemBudget = Math.min(
      Math.max(criticalCost, remaining - tailReserve),
      8000,
      Math.max(criticalCost, systems.length, Math.floor((Number(budget) || 1) * 0.45)),
    )
    const nonCriticalCost = Math.max(0, totalSystemCost - criticalCost)
    const nonCriticalBudget = Math.max(0, systemBudget - criticalCost)
    let remainingNonCriticalBudget = nonCriticalBudget
    for (let i = 0; i < systems.length; i++) {
      const critical = systems[i]?._contextCritical === true
      if (!critical && remainingNonCriticalBudget <= 0) continue
      const proportional = critical
        ? systemCosts[i]
        : nonCriticalCost > 0
          ? Math.max(1, Math.floor(nonCriticalBudget * (systemCosts[i] / nonCriticalCost)))
          : 1
      const allowed = critical ? proportional : Math.min(remainingNonCriticalBudget, proportional)
      const content = critical ? systems[i].content : fitText(systems[i].content, allowed)
      const { _contextCritical, _contextData, ...safeMessage } = systems[i]
      head.push({ ...safeMessage, content })
      const used = estimateTokens(content)
      remaining -= used
      if (!critical) remainingNonCriticalBudget -= used
    }
    remaining = Math.max(0, remaining)
  }

  const keptTurns = []
  let keptMessages = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]
    const cost = turn.reduce((sum, message) => sum + messageTokens(message), 0)
    // 最新一轮至少保留（可裁剪文本），其余轮次预算不足则整轮丢弃
    if (keptTurns.length && cost > remaining) break
    keptTurns.unshift(turn)
    remaining -= cost
    keptMessages += turn.length
    if (remaining <= 0) break
  }

  const flat = keptTurns.flat()
  // 若最新一轮超出剩余预算，对其消息文本做一次裁剪保底
  const budgetLeftForTail = Math.max(1, Number(budget) || 1) -
    head.reduce((sum, message) => sum + messageTokens(message), 0)
  let tailBudget = budgetLeftForTail
  const fitted = flat.map((message, index) => {
    const isLast = index === flat.length - 1
    const allowed = Math.min(tailBudget, isLast ? 6000 : 4000)
    const content = Array.isArray(message.content)
      ? message.content
      : fitText(message.content, Math.max(1, allowed))
    tailBudget -= estimateTokens(content)
    return { ...message, content }
  })

  const result = head.concat(fitted)
  const usedTokens = result.reduce((sum, message) => sum + messageTokens(message), 0)
  return {
    messages: result,
    usedTokens,
    omittedTurns: Math.max(0, turns.length - keptTurns.length),
    omittedMessages: Math.max(0, rest.length - keptMessages),
  }
}

/**
 * Provider 级 prompt-cache 能力门控。
 * 默认关闭；仅在显式开启且识别为兼容端点时启用，以避免不兼容 provider 报参错。
 */
function getCacheControlPolicy({
  enabled = false,
  provider = '',
  model = '',
  endpoint = '',
} = {}) {
  if (!enabled) return { enabled: false, reason: 'disabled' }
  const p = String(provider || '').toLowerCase()
  const m = String(model || '').toLowerCase()
  const e = String(endpoint || '').toLowerCase()
  const looksAnthropicStyle =
    p === 'custom' && (
      m.includes('claude') ||
      e.includes('anthropic.com') ||
      e.includes('openrouter.ai')
    )
  if (!looksAnthropicStyle) return { enabled: false, reason: 'provider_unsupported' }
  return { enabled: true, style: 'content_blocks_ephemeral' }
}

/**
 * 对高稳定前缀消息注入 cache_control（兼容门控）。
 * 仅转换前两条 system 前缀；其余消息保持原样。
 */
function applyCacheControlMessages(messages, policy = {}) {
  const list = Array.isArray(messages) ? messages : []
  if (!policy?.enabled || policy.style !== 'content_blocks_ephemeral') return list
  let taggedSystem = 0
  return list.map((msg) => {
    if (msg?.role !== 'system' || taggedSystem >= 2) return msg
    if (typeof msg.content !== 'string' || !msg.content.trim()) return msg
    taggedSystem++
    return {
      ...msg,
      content: [
        {
          type: 'text',
          text: msg.content,
          cache_control: { type: 'ephemeral' },
        },
      ],
    }
  })
}

module.exports = {
  DEFAULT_CONTEXT_WINDOW,
  MODEL_PROFILES,
  estimateTokens,
  getModelProfile,
  getRequestPolicy,
  fitText,
  fitSections,
  fitMessages,
  fitConversation,
  getCacheControlPolicy,
  applyCacheControlMessages,
}
