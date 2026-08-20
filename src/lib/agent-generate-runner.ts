'use strict'

/**
 * Agent Generate 的非 UI 入口。IPC、专家任务和后续自动化必须共用该入口，
 * 以确保它们使用同一套 AgentRunExecutor、工具治理与证据门禁。
 */

const { humanizeAgentError } = require('./agent-error-humanize')
const { executeAgentGenerate } = require('./agent-generate-execute')

function createRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createAgentGenerateEnv(deps, payload = {}, options = {}) {
  const runId = String(payload.runId || options.runId || createRunId())
  const controller = options.controller || new AbortController()
  const signal = controller.signal
  const metrics = { rounds: 0, toolCalls: 0, firstTokenMs: null }
  const trace = []
  const emitExternal = typeof options.emit === 'function' ? options.emit : () => {}
  const emit = event => emitExternal({ runId, sessionId: payload.sessionId, ...event })
  const upsertTrace = event => {
    const index = trace.findIndex(item => item.id === event.id)
    const next = {
      id: event.id,
      kind: event.kind === 'tool' ? 'tool' : 'stage',
      title: event.title,
      status: event.status || 'done',
      summary: event.summary || '',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      durationMs: event.durationMs,
    }
    if (index >= 0) trace[index] = { ...trace[index], ...next }
    else trace.push(next)
  }
  const stage = (id, title, status = 'pending', extra = {}) => {
    const event = { id, type: extra.fallback ? 'fallback' : 'stage', kind: 'stage', title, status, ...extra }
    upsertTrace(event)
    emit(event)
  }
  let settleAdoptedRun = null
  const fail = error => {
    const message = humanizeAgentError(error, { fallback: '暂时无法完成回复，请重试' })
    deps.activeAgentRuns?.delete(runId)
    if (settleAdoptedRun) {
      const settle = settleAdoptedRun
      settleAdoptedRun = null
      try { settle(message) } catch { /* 终态收敛不阻断错误返回 */ }
    }
    stage('stage_generate', '生成失败', 'error', { summary: message.slice(0, 500) })
    emit({ type: 'error', title: '生成失败', summary: message.slice(0, 500) })
    return { error: message, runId }
  }
  deps.activeAgentRuns?.set(runId, controller)
  return {
    deps,
    payload: { ...payload, runId },
    runId,
    signal,
    controller,
    metrics,
    trace,
    runStartedAt: Date.now(),
    stage,
    emit,
    fail,
    get settleAdoptedRun() { return settleAdoptedRun },
    set settleAdoptedRun(value) { settleAdoptedRun = value },
  }
}

async function runAgentGenerate(deps, payload = {}, options = {}) {
  return executeAgentGenerate(createAgentGenerateEnv(deps, payload, options))
}

module.exports = { createAgentGenerateEnv, runAgentGenerate }
