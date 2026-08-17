'use strict'

/**
 * llm-usage — 真实用量核对与自适应轮次预算（纯逻辑，可单测）。
 */

/**
 * 核对用量：provider 真实 usage 优先，缺失时用估算兜底。
 * @param {number} estimatedTokens 估算的输入+输出 token
 * @param {object|null} usage provider 返回的 usage
 * @returns {{ promptTokens:number, completionTokens:number, totalTokens:number, source:'provider'|'estimate' }}
 */
function reconcileUsage(estimatedTokens, usage) {
  const est = Math.max(0, Math.round(Number(estimatedTokens) || 0))
  if (usage && typeof usage === 'object') {
    const prompt = Number(usage.prompt_tokens ?? usage.promptTokens)
    const completion = Number(usage.completion_tokens ?? usage.completionTokens)
    const total = Number(usage.total_tokens ?? usage.totalTokens)
    const hasAny = [prompt, completion, total].some(v => Number.isFinite(v) && v > 0)
    if (hasAny) {
      const p = Number.isFinite(prompt) ? prompt : 0
      const c = Number.isFinite(completion) ? completion : 0
      const t = Number.isFinite(total) && total > 0 ? total : p + c
      return { promptTokens: p, completionTokens: c, totalTokens: t, source: 'provider' }
    }
  }
  return { promptTokens: est, completionTokens: 0, totalTokens: est, source: 'estimate' }
}

/**
 * 累计多轮 usage（真实值累加，来源以是否出现过 provider 为准）。
 */
function accumulateUsage(base, usage) {
  const prev = base && typeof base === 'object'
    ? base
    : { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: 'estimate' }
  if (!usage || typeof usage !== 'object') return prev
  const reconciled = reconcileUsage(0, usage)
  if (reconciled.source !== 'provider') return prev
  return {
    promptTokens: prev.promptTokens + reconciled.promptTokens,
    completionTokens: prev.completionTokens + reconciled.completionTokens,
    totalTokens: prev.totalTokens + reconciled.totalTokens,
    source: 'provider',
  }
}

const TIER_BUDGETS = {
  chat: { maxRounds: 2, maxToolCalls: 2 },
  assist: { maxRounds: 4, maxToolCalls: 6 },
  retrieval: { maxRounds: 6, maxToolCalls: 10 },
}

const TIER_BUDGET_CAPS = {
  chat: { maxRounds: 2, maxToolCalls: 2 },
  assist: { maxRounds: 12, maxToolCalls: 20 },
  retrieval: { maxRounds: 16, maxToolCalls: 28 },
}

const DEFAULT_MAX_EXPANSIONS = 2
const EXPAND_ROUNDS_STEP = 2
const EXPAND_TOOL_CALLS_STEP = 4

// P1-1：在线 token 估算校准（进程内 EMA）
const tokenCalibrations = new Map()
const CALIBRATION_ALPHA = 0.2

function calibrationKey(provider, model) {
  return `${String(provider || 'unknown').toLowerCase()}:${String(model || 'unknown').toLowerCase()}`
}

function clampRatio(v) {
  if (!Number.isFinite(v) || v <= 0) return 1
  return Math.min(2.5, Math.max(0.5, v))
}

function getCalibration(key) {
  const k = String(key || '')
  const hit = tokenCalibrations.get(k)
  if (!hit) return { key: k, factor: 1, samples: 0, updatedAt: null }
  return { ...hit }
}

function applyCalibration(estimatedTokens, key) {
  const est = Math.max(0, Number(estimatedTokens) || 0)
  const c = getCalibration(key)
  return Math.round(est * c.factor)
}

function learnCalibration(key, estimatedPromptTokens, realPromptTokens) {
  const k = String(key || '')
  const est = Number(estimatedPromptTokens)
  const real = Number(realPromptTokens)
  if (!k || !Number.isFinite(est) || est <= 0 || !Number.isFinite(real) || real <= 0) {
    return getCalibration(k)
  }
  const ratio = clampRatio(real / est)
  const prev = getCalibration(k)
  const factor = prev.samples === 0
    ? ratio
    : Number((prev.factor * (1 - CALIBRATION_ALPHA) + ratio * CALIBRATION_ALPHA).toFixed(4))
  const next = { key: k, factor, samples: prev.samples + 1, updatedAt: new Date().toISOString() }
  tokenCalibrations.set(k, next)
  while (tokenCalibrations.size > 64) {
    tokenCalibrations.delete(tokenCalibrations.keys().next().value)
  }
  return next
}

function _resetCalibrationsForTest() {
  tokenCalibrations.clear()
}

function importCalibrations(payload) {
  const src = payload && typeof payload === 'object' ? payload : {}
  tokenCalibrations.clear()
  for (const [key, value] of Object.entries(src)) {
    if (!value || typeof value !== 'object') continue
    const factor = clampRatio(Number(value.factor))
    const samples = Math.max(0, Math.floor(Number(value.samples) || 0))
    tokenCalibrations.set(String(key), {
      key: String(key),
      factor,
      samples,
      updatedAt: value.updatedAt || null,
    })
    if (tokenCalibrations.size >= 64) break
  }
}

function exportCalibrations() {
  const out = {}
  for (const [key, value] of tokenCalibrations.entries()) {
    out[key] = {
      factor: Number(value.factor),
      samples: Number(value.samples) || 0,
      updatedAt: value.updatedAt || null,
    }
  }
  return out
}

/**
 * 按 tier 自适应工具轮次与调用上限。
 * @param {string} tier
 * @returns {{ maxRounds:number, maxToolCalls:number }}
 */
function adaptiveBudget(tier) {
  return { ...(TIER_BUDGETS[tier] || TIER_BUDGETS.assist) }
}

function budgetCap(tier) {
  return { ...(TIER_BUDGET_CAPS[tier] || TIER_BUDGET_CAPS.assist) }
}

/**
 * 在计划未完成时有限扩展预算；chat 永不扩展。
 */
function expandBudget(current, opts = {}) {
  const tier = String(opts.tier || 'assist')
  const fallback = adaptiveBudget(tier)
  const base = {
    maxRounds: Math.max(1, Number(current?.maxRounds) || fallback.maxRounds),
    maxToolCalls: Math.max(1, Number(current?.maxToolCalls) || fallback.maxToolCalls),
  }
  const expansionsUsed = Math.max(0, Math.floor(Number(opts.expansionsUsed) || 0))
  const maxExpansions = Math.max(0, Math.floor(Number(opts.maxExpansions) || DEFAULT_MAX_EXPANSIONS))
  const planRemaining = Math.max(0, Math.floor(Number(opts.planRemaining) || 0))
  const cap = budgetCap(tier)

  if (tier === 'chat') {
    return { ...base, expanded: false, expansionsUsed, reason: 'chat_no_expand' }
  }
  if (opts.repeatedCall) {
    return { ...base, expanded: false, expansionsUsed, reason: 'repeated_call' }
  }
  if (planRemaining <= 0) {
    return { ...base, expanded: false, expansionsUsed, reason: 'plan_complete' }
  }
  if (expansionsUsed >= maxExpansions) {
    return { ...base, expanded: false, expansionsUsed, reason: 'expansion_cap' }
  }
  if (base.maxRounds >= cap.maxRounds && base.maxToolCalls >= cap.maxToolCalls) {
    return { ...base, expanded: false, expansionsUsed, reason: 'hard_cap' }
  }

  const next = {
    maxRounds: Math.min(cap.maxRounds, base.maxRounds + EXPAND_ROUNDS_STEP),
    maxToolCalls: Math.min(cap.maxToolCalls, base.maxToolCalls + EXPAND_TOOL_CALLS_STEP),
  }
  if (next.maxRounds === base.maxRounds && next.maxToolCalls === base.maxToolCalls) {
    return { ...base, expanded: false, expansionsUsed, reason: 'hard_cap' }
  }
  return {
    ...next,
    expanded: true,
    expansionsUsed: expansionsUsed + 1,
    reason: String(opts.reason || 'plan_incomplete'),
  }
}

module.exports = {
  TIER_BUDGETS,
  TIER_BUDGET_CAPS,
  DEFAULT_MAX_EXPANSIONS,
  reconcileUsage,
  accumulateUsage,
  adaptiveBudget,
  budgetCap,
  expandBudget,
  calibrationKey,
  getCalibration,
  applyCalibration,
  learnCalibration,
  importCalibrations,
  exportCalibrations,
  _resetCalibrationsForTest,
}
