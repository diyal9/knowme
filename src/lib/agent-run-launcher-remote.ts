'use strict'

/**
 * 远程 Agent 服务适配器。常量与超时/错误规范化见 launcher-shared。
 */

const { AgentRunExecutor } = require('./agent-run-executor')
const { RunPhase } = require('./agent-run-ports')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')
const {
  BACKEND_DAEMON,
  CANCEL_BUDGET_MS,
  SUPPORTED_PROTOCOL_VERSION,
  REQUIRED_REMOTE_CAPABILITIES,
  isTerminalStatus,
  withRemoteTimeout,
  normalizeRemoteError,
} = require('./agent-run-launcher-shared')

class RemoteAgentServiceAdapter {
  constructor(opts = {}) {
    this.id = opts.id || BACKEND_DAEMON
    this.builderId = opts.builderId || this.id
    this.client = opts.client || null
    this.protocolVersion = opts.protocolVersion ?? SUPPORTED_PROTOCOL_VERSION
    this.serviceTimeoutMs = opts.serviceTimeoutMs || 30000
    this.metrics = opts.metrics || createAgentRuntimeMetrics()
  }

  async handshake() {
    if (!this.client || typeof this.client.handshake !== 'function') {
      return { ok: false, code: 'remote_unavailable', message: `${this.id} client 未配置` }
    }
    let result
    try {
      result = await withRemoteTimeout(this.client.handshake({
        protocolVersion: this.protocolVersion,
        builderId: this.builderId,
        supportedCapabilities: [...REQUIRED_REMOTE_CAPABILITIES, 'resumeRun'],
      }), this.serviceTimeoutMs, `${this.id} handshake`)
    } catch (error) {
      const normalized = normalizeRemoteError(error)
      this.metrics.increment('protocol_rejection_total', 1, { code: normalized.code, backend: this.id })
      return { ok: false, ...normalized }
    }
    if (!result || result.protocolVersion > SUPPORTED_PROTOCOL_VERSION) {
      this.metrics.increment('protocol_rejection_total', 1, {
        code: 'protocol_version_unsupported',
        backend: this.id,
      })
      return { ok: false, code: 'protocol_version_unsupported', message: '远程协议版本不兼容' }
    }
    const capabilities = [...new Set(result.capabilities || result.supportedCapabilities || [])]
    const missingCapabilities = REQUIRED_REMOTE_CAPABILITIES.filter(item => !capabilities.includes(item))
    if (missingCapabilities.length) {
      this.metrics.increment('protocol_rejection_total', 1, { code: 'capability_missing', backend: this.id })
      return {
        ok: false,
        code: 'capability_missing',
        message: `远程后端缺少能力: ${missingCapabilities.join(', ')}`,
        missingCapabilities,
      }
    }
    const negotiated = Math.min(result.protocolVersion ?? SUPPORTED_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSION)
    return { ok: true, status: 'READY', negotiatedVersion: negotiated, capabilities }
  }

  async probeHealth() {
    if (!this.client) return { ok: false, code: 'remote_unavailable', message: `${this.id} 不可用` }
    return this.handshake()
  }

  async launch(runSpec, hooks = {}) {
    const hs = await this.handshake()
    if (!hs.ok) throw new Error(hs.message || hs.code)

    if (!this.client || typeof this.client.executeAgentRun !== 'function') {
      throw new Error(`${this.id} executeAgentRun 未实现`)
    }

    const runId = String(runSpec.runId || runSpec.subRunId || '')
    let task
    try {
      task = await withRemoteTimeout(this.client.executeAgentRun({
        runId,
        agentPackageId: runSpec.expertId || runSpec.agentPackageId,
        packageSnapshotHash: runSpec.packageSnapshotHash,
        governanceEnvelope: runSpec.governanceEnvelope || {},
        inputPayload: {
          prompt: runSpec.prompt,
          handoff: runSpec.handoff,
          executionContract: runSpec.executionContract,
        },
        hooks: {
          onProgress: (msg) => hooks.emit?.(msg, { runId, backend: this.id }),
          onTerminal: (info) => hooks.onTerminal?.({ ...info, runId, backend: this.id }),
        },
      }), this.serviceTimeoutMs, `${this.id} executeAgentRun`)
    } catch (error) {
      const normalized = normalizeRemoteError(error, 'remote_execute_failed')
      const wrapped = new Error(normalized.message)
      wrapped.code = normalized.code
      throw wrapped
    }

    const handle = {
      runId,
      backend: this.id,
      remoteTaskId: task?.taskId || task?.remoteTaskId || runId,
      remoteStatus: task?.status || task?.terminal || 'running',
      client: this.client,
      startedAt: Date.now(),
      abort: () => {
        if (this.client?.cancelRun) this.client.cancelRun(runId).catch(() => {})
      },
    }

    if (task?.terminal && isTerminalStatus(task.terminal)) {
      hooks.onTerminal?.({
        runId,
        backend: this.id,
        terminal: task.terminal,
        text: task.summary || task.text,
        ok: task.terminal !== 'failed' && task.terminal !== 'cancelled',
        artifactRefs: task.artifactRefs || task.artifacts || [],
        evidenceRefs: task.evidenceRefs || [],
        executionEvidence: task.executionEvidence,
      })
    }

    return { handle, backend: this.id }
  }

  async cancel(handle, reason) {
    const startedAt = Date.now()
    if (!handle?.client?.cancelRun) {
      handle?.abort?.()
      return { withinBudgetMs: true, reason: reason || 'cancelled' }
    }
    try {
      await withRemoteTimeout(
        handle.client.cancelRun(handle.runId, { reason }),
        Math.min(CANCEL_BUDGET_MS, this.serviceTimeoutMs),
        `${this.id} cancelRun`,
      )
    } catch (error) {
      const normalized = normalizeRemoteError(error, 'remote_cancel_failed')
      handle?.abort?.()
      return {
        withinBudgetMs: false,
        reason: reason || 'cancelled',
        code: normalized.code,
        message: normalized.message,
      }
    }
    handle?.abort?.()
    return { withinBudgetMs: Date.now() - startedAt <= CANCEL_BUDGET_MS, reason: reason || 'cancelled' }
  }

  async getStatus(handle) {
    if (!handle?.client?.fetchRunStatus) {
      return { ok: false, code: 'capability_missing', message: 'fetchRunStatus 不可用' }
    }
    try {
      const status = await withRemoteTimeout(
        handle.client.fetchRunStatus(handle.runId),
        this.serviceTimeoutMs,
        `${this.id} fetchRunStatus`,
      )
      return { ok: true, ...status, runId: handle.runId, durationMs: Date.now() - (handle.startedAt || Date.now()) }
    } catch (error) {
      return { ok: false, ...normalizeRemoteError(error, 'remote_status_failed'), runId: handle.runId }
    }
  }

  async resume(handle, checkpointRef) {
    if (!handle?.client?.resumeRun) {
      return { ok: false, code: 'resume_invalid', message: 'resumeRun 不可用' }
    }
    try {
      const result = await withRemoteTimeout(
        handle.client.resumeRun(handle.runId, { checkpointRef }),
        this.serviceTimeoutMs,
        `${this.id} resumeRun`,
      )
      if (!result?.ok) return { ok: false, code: result?.code || 'resume_invalid', message: result?.message || '恢复失败' }
      return { ok: true, ...result }
    } catch (err) {
      return { ok: false, ...normalizeRemoteError(err, 'resume_invalid') }
    }
  }
}

module.exports = {
  RemoteAgentServiceAdapter,
}
