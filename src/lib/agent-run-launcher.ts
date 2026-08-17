'use strict'

const crypto = require('crypto')
const { AgentRunExecutor } = require('./agent-run-executor')
const { RunPhase } = require('./agent-run-ports')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')

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
} = require('./agent-run-launcher-shared')

const { mapTerminalToStatus, isTerminalStatus, handoffByteSize, validateHandoffPayload, isFakeSpawnResult, createMessageId, normalizeRemoteError, withRemoteTimeout, LocalExecutorAdapter, RemoteAgentServiceAdapter } = require('./agent-run-launcher-adapters')

class AgentRunLauncher {
  constructor(opts = {}) {
    this.backends = new Map()
    this.activeLaunches = new Map()
    this.buildPorts = typeof opts.buildPorts === 'function' ? opts.buildPorts : null
    this.Executor = opts.Executor || AgentRunExecutor
    this.defaultBackend = opts.defaultBackend || BACKEND_LOCAL
    this.metrics = opts.metrics || createAgentRuntimeMetrics()
    this.registerBackend(BACKEND_LOCAL, new LocalExecutorAdapter({
      buildPorts: this.buildPorts,
      Executor: this.Executor,
    }))
  }

  registerBackend(name, adapter) {
    this.backends.set(String(name), adapter)
    return this
  }

  registerRemoteBackends(clients = {}) {
    if (clients.cursor) {
      this.registerBackend(BACKEND_CURSOR, new RemoteAgentServiceAdapter({
        id: BACKEND_CURSOR,
        builderId: 'cursor',
        client: clients.cursor,
        metrics: this.metrics,
      }))
    }
    if (clients.claude) {
      this.registerBackend(BACKEND_CLAUDE, new RemoteAgentServiceAdapter({
        id: BACKEND_CLAUDE,
        builderId: 'claude',
        client: clients.claude,
        metrics: this.metrics,
      }))
    }
    if (clients.daemon) {
      this.registerBackend(BACKEND_DAEMON, new RemoteAgentServiceAdapter({
        id: BACKEND_DAEMON,
        builderId: 'daemon',
        client: clients.daemon,
        metrics: this.metrics,
      }))
    }
    return this
  }

  resolveBackend(backendId) {
    const id = String(backendId || this.defaultBackend)
    const adapter = this.backends.get(id)
    if (!adapter) throw new Error(`Unknown launcher backend: ${id}`)
    return adapter
  }

  async probeHealth(backendId) {
    try {
      const adapter = this.resolveBackend(backendId)
      return await adapter.probeHealth?.() || { ok: true, status: 'READY' }
    } catch (err) {
      return { ok: false, code: 'backend_missing', message: String(err?.message || err) }
    }
  }

  async launch(runSpec, hooks = {}) {
    const runId = String(runSpec.runId || runSpec.subRunId || '')
    if (!runId) throw new Error('launch requires runId')

    const handoffCheck = validateHandoffPayload(runSpec.handoff)
    if (!handoffCheck.ok) {
      const err = new Error(handoffCheck.message)
      err.code = handoffCheck.code
      throw err
    }

    const backendId = runSpec.backend || this.defaultBackend
    const adapter = this.resolveBackend(backendId)

    const launchEntry = {
      handle: null,
      backend: backendId,
      parentRunId: runSpec.parentRunId || null,
      startedAt: Date.now(),
      status: 'running',
      terminalDelivered: false,
    }
    this.activeLaunches.set(runId, launchEntry)

    const wrappedHooks = {
      ...hooks,
      onTerminal: (info) => {
        const entry = this.activeLaunches.get(runId)
        if (!entry || entry.terminalDelivered) {
          this.metrics.increment('duplicate_terminal_callback_total', 1, { backend: backendId })
          return
        }
        entry.terminalDelivered = true
        entry.status = mapTerminalToStatus(info.terminal)
        entry.endedAt = Date.now()
        entry.terminal = info.terminal
        entry.summary = info.text
        if (isTerminalStatus(entry.status)) {
          this.activeLaunches.delete(runId)
        }
        hooks.onTerminal?.(info)
      },
    }

    let launched
    try {
      launched = await adapter.launch(runSpec, wrappedHooks)
    } catch (error) {
      this.activeLaunches.delete(runId)
      this.metrics.increment('remote_launch_rejection_total', 1, {
        code: error.code || 'launch_failed',
        backend: backendId,
      })
      throw error
    }
    const { handle, backend } = launched
    launchEntry.handle = handle
    launchEntry.backend = backend

    if (handle?.runPromise) {
      handle.runPromise.catch(() => {}).finally(() => {
        const entry = this.activeLaunches.get(runId)
        if (entry && entry.status === 'running') {
          entry.status = 'completed'
          entry.endedAt = Date.now()
          this.activeLaunches.delete(runId)
        }
      })
    }

    return { handle, backend, runId }
  }

  async cancel(runId, reason) {
    const id = String(runId || '')
    const entry = this.activeLaunches.get(id)
    if (!entry) return { ok: false, code: 'not_found', withinBudgetMs: true }

    const adapter = this.resolveBackend(entry.backend)
    const startedAt = Date.now()
    const result = await adapter.cancel(entry.handle, reason)
    entry.status = 'cancelled'
    entry.endedAt = Date.now()
    this.activeLaunches.delete(id)
    this.metrics.increment('launcher_cancel_total', 1, { backend: entry.backend })
    this.metrics.observe('launcher_cancel_latency_ms', Date.now() - startedAt)
    return {
      ok: true,
      withinBudgetMs: result.withinBudgetMs !== false && (Date.now() - startedAt) <= CANCEL_BUDGET_MS,
      elapsedMs: Date.now() - startedAt,
    }
  }

  async cancelAllForParent(parentRunId, reason) {
    const parent = String(parentRunId || '')
    const startedAt = Date.now()
    const cancelled = []
    for (const [runId, entry] of this.activeLaunches.entries()) {
      if (entry.parentRunId === parent) {
        await this.cancel(runId, reason)
        cancelled.push(runId)
      }
    }
    return {
      cancelled,
      elapsedMs: Date.now() - startedAt,
      withinBudget: Date.now() - startedAt <= CANCEL_BUDGET_MS,
    }
  }

  getLaunchEntry(runId) {
    return this.activeLaunches.get(String(runId || '')) || null
  }

  async getStatus(runId) {
    const id = String(runId || '')
    const entry = this.activeLaunches.get(id)
    if (entry) {
      const adapter = this.resolveBackend(entry.backend)
      if (adapter.getStatus) {
        const status = await adapter.getStatus(entry.handle)
        return {
          ok: true,
          runId: id,
          status: status.status || entry.status || 'running',
          phase: status.phase || RunPhase.MODEL,
          durationMs: Date.now() - (entry.startedAt || Date.now()),
          backend: entry.backend,
          parentRunId: entry.parentRunId,
        }
      }
      return {
        ok: true,
        runId: id,
        status: entry.status || 'running',
        phase: RunPhase.MODEL,
        durationMs: Date.now() - (entry.startedAt || Date.now()),
        backend: entry.backend,
      }
    }
    return { ok: false, code: 'not_found', message: 'Run 未在 activeLaunches 中' }
  }

  async resume(runId, checkpointRef) {
    const id = String(runId || '')
    const entry = this.activeLaunches.get(id)
    if (!entry) return { ok: false, code: 'not_found' }
    const adapter = this.resolveBackend(entry.backend)
    if (!adapter.resume) return { ok: false, code: 'resume_invalid' }
    return adapter.resume(entry.handle, checkpointRef)
  }

  getDiagnostics() {
    return {
      activeLaunches: this.activeLaunches.size,
      launches: [...this.activeLaunches.entries()].map(([runId, entry]) => ({
        runId,
        backend: entry.backend,
        parentRunId: entry.parentRunId,
        status: entry.status,
      })),
    }
  }
}

const { createLauncherRunManagerPort } = require('./agent-run-launcher-port')

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
  AgentRunLauncher,
  LocalExecutorAdapter,
  RemoteAgentServiceAdapter,
  REQUIRED_REMOTE_CAPABILITIES,
  withRemoteTimeout,
  normalizeRemoteError,
  validateHandoffPayload,
  isFakeSpawnResult,
  isTerminalStatus,
  mapTerminalToStatus,
  createLauncherRunManagerPort,
  createMessageId,
}
