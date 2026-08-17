'use strict'

const { RunPhase } = require('../agent-run-ports')

/** 将各阶段 partial 字段规范化为带 report 的 run 结果。 */

function buildResult(partial) {
  const durationMs = (partial.ports?.clock?.now?.() || Date.now()) - (partial.runStartedAt || Date.now())
  const result = { ...partial }
  delete result.ports
  delete result.runStartedAt
  const report = {
    terminal: partial.terminal || RunPhase.ERROR,
    runPhases: partial.runPhases || [],
    rounds: partial.metrics?.rounds || 0,
    toolCalls: partial.metrics?.toolCalls || partial.toolCallCount || 0,
    planEval: partial.planEval || null,
    durationMs,
    error: partial.errorInfo || (partial.error ? { message: String(partial.error) } : null),
    cancelled: partial.cancelled === true,
  }
  if (partial.answerHash) report.answerHash = partial.answerHash
  if (partial.protocolVersion) report.protocolVersion = partial.protocolVersion
  return {
    ...result,
    report,
  }
}

module.exports = {
  buildResult,
}
