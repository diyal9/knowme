'use strict'

/**
 * Launcher 本地执行适配器 + 从 shared/remote 再导出。
 * 常量与远程辅助函数以 agent-run-launcher-shared 为准。
 */

const { AgentRunExecutor } = require('./agent-run-executor')
const { RunPhase } = require('./agent-run-ports')
const {
  CANCEL_BUDGET_MS,
  HANDOFF_MAX_BYTES,
  BUS_VERSION,
  SUPPORTED_PROTOCOL_VERSION,
  BACKEND_LOCAL,
  BACKEND_CURSOR,
  BACKEND_CLAUDE,
  BACKEND_DAEMON,
  TERMINAL_STATUSES,
  REQUIRED_REMOTE_CAPABILITIES,
  isTerminalStatus,
  handoffByteSize,
  validateHandoffPayload,
  isFakeSpawnResult,
  createMessageId,
  normalizeRemoteError,
  withRemoteTimeout,
} = require('./agent-run-launcher-shared')

function mapTerminalToStatus(terminal) {
  const t = String(terminal || '').toUpperCase()
  if (t === RunPhase.DONE || t === 'COMPLETED') return 'completed'
  if (t === RunPhase.CANCELLED || t === 'CANCELLED') return 'cancelled'
  if (t === RunPhase.ERROR || t === 'FAILED') return 'failed'
  return 'running'
}

class LocalExecutorAdapter {
  constructor(opts = {}) {
    this.id = BACKEND_LOCAL
    this.buildPorts = typeof opts.buildPorts === 'function' ? opts.buildPorts : null
    this.Executor = opts.Executor || AgentRunExecutor
  }

  probeHealth() {
    if (!this.buildPorts) {
      return { ok: false, code: 'build_ports_missing', message: 'LocalExecutorAdapter 未配置 buildPorts' }
    }
    return { ok: true, code: 'ready', message: 'local-executor ready' }
  }

  async launch(runSpec, hooks = {}) {
    if (!this.buildPorts) {
      throw new Error('LocalExecutorAdapter requires buildPorts')
    }
    const runId = String(runSpec.runId || runSpec.subRunId || '')
    if (!runId) throw new Error('launch requires runId')

    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
    const childSignal = abortController?.signal || { aborted: false }
    const parentSignal = hooks.signal
    if (parentSignal && abortController) {
      if (parentSignal.aborted) abortController.abort()
      else parentSignal.addEventListener('abort', () => abortController.abort(), { once: true })
    }

    const ports = await this.buildPorts({
      runId,
      parentRunId: runSpec.parentRunId,
      rootRunId: runSpec.rootRunId || runSpec.parentRunId,
      signal: childSignal,
      expertId: runSpec.expertId,
      prompt: runSpec.prompt,
      handoff: runSpec.handoff,
      tier: runSpec.tier || 'agent',
      depth: runSpec.depth,
      session: runSpec.session,
      evidence: runSpec.evidence,
      parentState: runSpec.parentState,
    })

    const input = {
      runId,
      prompt: String(runSpec.prompt || ''),
      expertId: runSpec.expertId,
      handoff: runSpec.handoff,
      tier: runSpec.tier || 'agent',
      parentRunId: runSpec.parentRunId,
    }

    const emit = (event) => {
      hooks.emit?.(event, { runId, backend: this.id })
    }

    const runPromise = this.Executor.run(input, ports, emit)
      .then((result) => {
        hooks.onTerminal?.({
          runId,
          backend: this.id,
          terminal: result.report?.terminal || result.terminal || RunPhase.DONE,
          text: result.text,
          report: result.report,
          metrics: result.metrics || result.report?.metrics || {},
          artifactRefs: Array.isArray(result.artifactRefs) ? result.artifactRefs : [],
          evidenceRefs: Array.isArray(result.evidenceRefs) ? result.evidenceRefs : [],
          cancelled: result.cancelled === true,
          ok: result.report?.terminal !== RunPhase.ERROR && result.ok !== false,
        })
        return result
      })
      .catch((err) => {
        hooks.onTerminal?.({
          runId,
          backend: this.id,
          terminal: RunPhase.ERROR,
          text: String(err?.message || err).slice(0, 500),
          error: String(err?.message || err),
          ok: false,
        })
        throw err
      })
      .finally(async () => {
        if (typeof ports._dispose === 'function') {
          try { await ports._dispose() } catch { /* best effort cleanup */ }
        }
      })

    return {
      handle: {
        runId,
        backend: this.id,
        abort: () => abortController?.abort(),
        signal: childSignal,
        runPromise,
        startedAt: Date.now(),
      },
      backend: this.id,
    }
  }

  async cancel(handle, reason) {
    const startedAt = Date.now()
    handle?.abort?.()
    if (handle?.runPromise) {
      let timer
      try {
        await Promise.race([
          handle.runPromise.catch(() => {}),
          new Promise((resolve) => {
            timer = setTimeout(resolve, CANCEL_BUDGET_MS)
            timer.unref?.()
          }),
        ])
      } catch { /* ignore */ }
      finally { if (timer) clearTimeout(timer) }
    }
    return {
      withinBudgetMs: Date.now() - startedAt <= CANCEL_BUDGET_MS,
      reason: reason || 'cancelled',
    }
  }

  async getStatus(handle) {
    if (!handle) return { ok: false, code: 'not_found' }
    const aborted = handle.signal?.aborted === true
    if (aborted) {
      return { ok: true, status: 'cancelled', phase: RunPhase.CANCELLED, runId: handle.runId }
    }
    return { ok: true, status: 'running', phase: RunPhase.MODEL, runId: handle.runId, durationMs: Date.now() - (handle.startedAt || Date.now()) }
  }

  async resume(_handle, _checkpointRef) {
    return { ok: false, code: 'resume_invalid', message: 'local-executor 不支持远程 resume' }
  }
}

const { RemoteAgentServiceAdapter } = require('./agent-run-launcher-remote')

module.exports = {
  CANCEL_BUDGET_MS,
  HANDOFF_MAX_BYTES,
  BUS_VERSION,
  SUPPORTED_PROTOCOL_VERSION,
  BACKEND_LOCAL,
  BACKEND_CURSOR,
  BACKEND_CLAUDE,
  BACKEND_DAEMON,
  TERMINAL_STATUSES,
  REQUIRED_REMOTE_CAPABILITIES,
  mapTerminalToStatus,
  isTerminalStatus,
  handoffByteSize,
  validateHandoffPayload,
  isFakeSpawnResult,
  createMessageId,
  normalizeRemoteError,
  withRemoteTimeout,
  LocalExecutorAdapter,
  RemoteAgentServiceAdapter,
}
