'use strict'

/**
 * Agent 工具循环的无副作用状态辅助函数。
 * 负责预算/重复调用判断，不负责网络请求或工具执行。
 */

function stableJson(value) {
  if (value == null) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function toolCallKey(name, rawArguments) {
  let args = rawArguments
  if (typeof rawArguments === 'string') {
    try { args = JSON.parse(rawArguments) } catch { args = rawArguments }
  }
  return `${String(name || '').trim()}:${stableJson(args)}`
}

function createLoopState() {
  return {
    callCache: new Map(),
    finalizationUsed: false,
  }
}

function canUseTools({ toolsEnabled, round, maxRounds, toolCallCount, callCount, maxToolCalls }) {
  return Boolean(toolsEnabled) &&
    round <= maxRounds &&
    toolCallCount + Math.max(1, Number(callCount) || 0) <= maxToolCalls
}

function shouldFinalize({ round, maxRounds, toolCallCount, maxToolCalls, repeatedCall = false }) {
  return repeatedCall || round >= maxRounds || toolCallCount >= maxToolCalls
}

module.exports = {
  stableJson,
  toolCallKey,
  createLoopState,
  canUseTools,
  shouldFinalize,
}
