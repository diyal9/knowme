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
  const target = Math.max(1, Math.floor(text.length * (limit / estimateTokens(text))))
  const left = Math.max(1, Math.floor((target - marker.length) * 0.65))
  const right = Math.max(1, target - marker.length - left)
  return `${text.slice(0, left)}${marker}${text.slice(-right)}`
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
  return estimateTokens(message?.content) +
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
  const system = source[0]?.role === 'system' ? source[0] : null
  const rest = system ? source.slice(1) : source

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
  if (system) {
    const content = fitText(system.content, Math.min(remaining, 8000))
    head.push({ ...system, content })
    remaining -= estimateTokens(content)
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
    (system ? estimateTokens(head[0].content) : 0)
  let tailBudget = budgetLeftForTail
  const fitted = flat.map((message, index) => {
    const isLast = index === flat.length - 1
    const allowed = Math.min(tailBudget, isLast ? 6000 : 4000)
    const content = fitText(message.content, Math.max(1, allowed))
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
