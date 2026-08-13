'use strict'

const crypto = require('crypto')
const { AgentRunExecutor } = require('./agent-run-executor')
const { RunPhase } = require('./agent-run-ports')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')

const CANCEL_BUDGET_MS = 3000
const HANDOFF_MAX_BYTES = 32 * 1024
const BUS_VERSION = 1
const SUPPORTED_PROTOCOL_VERSION = 1

const BACKEND_LOCAL = 'local-executor'
const BACKEND_CURSOR = 'cursor-package'
const BACKEND_CLAUDE = 'claude-package'
const BACKEND_DAEMON = 'daemon-agent'

const TERMINAL_STATUSES = new Set(['done', 'completed', 'error', 'failed', 'cancelled'])
const REQUIRED_REMOTE_CAPABILITIES = Object.freeze(['executeAgentRun', 'cancelRun', 'fetchRunStatus'])

function mapTerminalToStatus(terminal) {
  const t = String(terminal || '').toUpperCase()
  if (t === RunPhase.DONE || t === 'COMPLETED') return 'completed'
  if (t === RunPhase.CANCELLED || t === 'CANCELLED') return 'cancelled'
  if (t === RunPhase.ERROR || t === 'FAILED') return 'failed'
  return 'running'
}

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(String(status || '').toLowerCase())
}

function handoffByteSize(handoff) {
  if (handoff == null) return 0
  try {
    return Buffer.byteLength(JSON.stringify(handoff), 'utf8')
  } catch {
    return HANDOFF_MAX_BYTES + 1
  }
}

function validateHandoffPayload(handoff) {
  const size = handoffByteSize(handoff)
  if (size > HANDOFF_MAX_BYTES) {
    return {
      ok: false,
      code: 'handoff_payload_too_large',
      text: `handoff 超过 ${HANDOFF_MAX_BYTES} 字节限制`,
      message: `handoff 超过 ${HANDOFF_MAX_BYTES} 字节限制`,
    }
  }
  return { ok: true, size }
}

function isFakeSpawnResult(result) {
  if (!result || result.ok === false) return false
  if (result.registeredOnly === true || result.fakeRegister === true) return true
  const text = String(result.text || '')
  if (/已登记/.test(text) && !result.launched && !result.report?.runPhases?.length) return true
  if (result.ok === true && result.launched !== true && !result.report && /子 Run.*已登记/.test(text)) return true
  return false
}

function createMessageId() {
  return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function normalizeRemoteError(error, fallbackCode = 'remote_unavailable') {
  const rawCode = String(error?.code || '').toLowerCase()
  const message = String(error?.message || error || fallbackCode)
  if (rawCode === 'abort_err' || /timeout|timed out|aborted/i.test(message)) {
    return { code: 'remote_timeout', message }
  }
  if (/socket|econnreset|econnrefused|connection|fetch failed|disconnected/i.test(`${rawCode} ${message}`)) {
    return { code: 'remote_disconnected', message }
  }
  return { code: fallbackCode, message }
}

function withRemoteTimeout(operation, timeoutMs, label = 'remote operation') {
  let timer
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} timed out after ${timeoutMs}ms`)
        error.code = 'remote_timeout'
        reject(error)
      }, timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
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

function createLauncherRunManagerPort(launcher, opts = {}) {
  if (!launcher) throw new Error('createLauncherRunManagerPort requires launcher')

  const runs = opts.runs || new Map()
  const busMessages = opts.busMessages || new Map()
  const waiters = new Map()

  const notifyWaiters = (runId, record) => {
    const list = waiters.get(runId) || []
    waiters.delete(runId)
    for (const w of list) {
      clearTimeout(w.timer)
      w.resolve(record)
    }
  }

  const getRunRecord = (runId) => {
    const id = String(runId || '')
    return runs.get(id) || null
  }

  const buildStatusResponse = (record) => {
    if (!record) return { ok: false, code: 'not_found', message: '子 Run 不存在' }
    const durationMs = (record.endedAt || Date.now()) - (record.startedAt || Date.now())
    return {
      ok: true,
      runId: record.runId,
      status: record.status,
      phase: record.phase || record.terminal || 'PREPARE',
      terminal: record.terminal || null,
      stopReason: record.stopReason || null,
      durationMs,
      expertId: record.expertId,
      builderId: record.backend,
      summary: record.summary || record.text || '',
    }
  }

  return {
    runs,
    busMessages,

    async createAndLaunchChild(spec = {}) {
      const handoffCheck = validateHandoffPayload(spec.handoff)
      if (!handoffCheck.ok) return handoffCheck

      const runId = String(spec.runId || spec.subRunId || '')
      const parentRunId = String(spec.parentRunId || '')
      if (!runId) return { ok: false, code: 'invalid_args', text: '缺少 runId' }

      const backend = spec.backend || launcher.defaultBackend || BACKEND_LOCAL
      const record = {
        runId,
        parentRunId,
        rootRunId: spec.rootRunId || parentRunId,
        expertId: spec.expertId,
        status: 'pending',
        phase: RunPhase.PREPARE,
        backend,
        handoff: spec.handoff,
        startedAt: Date.now(),
        prompt: spec.prompt,
      }
      runs.set(runId, record)

      try {
        await launcher.launch({
          ...spec,
          runId,
          backend,
        }, {
          signal: spec.parentSignal,
          emit: spec.onEmit,
          onTerminal: (info) => {
            record.status = mapTerminalToStatus(info.terminal)
            record.phase = info.terminal
            record.terminal = info.terminal
            record.endedAt = Date.now()
            record.summary = info.text
            record.text = info.text
            record.report = info.report
            record.stopReason = info.error || null
            notifyWaiters(runId, buildStatusResponse(record))
            spec.onTerminal?.(info)
          },
        })
        if (!isTerminalStatus(record.status)) {
          record.status = 'running'
          record.phase = RunPhase.PREPARE
        }
        return {
          ok: true,
          launched: true,
          subRunId: runId,
          runId,
          status: 'running',
          text: `子 Run ${runId} 已启动`,
          meta: { subRunId: runId, expertId: spec.expertId, backend },
        }
      } catch (err) {
        record.status = 'failed'
        record.phase = RunPhase.ERROR
        record.terminal = RunPhase.ERROR
        record.endedAt = Date.now()
        record.stopReason = String(err?.message || err)
        notifyWaiters(runId, buildStatusResponse(record))
        return {
          ok: false,
          code: err.code || 'launch_failed',
          text: String(err?.message || err).slice(0, 500),
          meta: { subRunId: runId },
        }
      }
    },

    getRunStatus(runId) {
      const record = getRunRecord(runId)
      if (record) return buildStatusResponse(record)
      return launcher.getStatus(runId)
    },

    async awaitRun(runId, timeoutMs = 60000) {
      const id = String(runId || '')
      const existing = getRunRecord(id)
      if (existing && isTerminalStatus(existing.status)) {
        return { ok: true, ...buildStatusResponse(existing) }
      }

      const deadline = Math.max(1000, Number(timeoutMs) || 60000)
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const list = waiters.get(id) || []
          waiters.set(id, list.filter((w) => w.timer !== timer))
          resolve({
            ok: false,
            code: 'subrun_timeout',
            text: `子 Run ${id} 在 ${deadline}ms 内未达终态`,
            runId: id,
          })
        }, deadline)

        const list = waiters.get(id) || []
        list.push({
          timer,
          resolve: (record) => {
            resolve({ ok: true, ...record })
          },
        })
        waiters.set(id, list)

        const latest = getRunRecord(id)
        if (latest && isTerminalStatus(latest.status)) {
          clearTimeout(timer)
          waiters.set(id, list.filter((w) => w.timer !== timer))
          resolve({ ok: true, ...buildStatusResponse(latest) })
        }
      })
    },

    async cancelRun(runId, reason) {
      const id = String(runId || '')
      const record = getRunRecord(id)
      const result = await launcher.cancel(id, reason)
      if (record) {
        record.status = 'cancelled'
        record.phase = RunPhase.CANCELLED
        record.terminal = RunPhase.CANCELLED
        record.endedAt = Date.now()
        record.stopReason = reason || 'cancelled'
        notifyWaiters(id, buildStatusResponse(record))
      }
      return { ok: result.ok !== false, ...result, runId: id }
    },

    async cancelAllChildren(parentRunId, reason) {
      return launcher.cancelAllForParent(parentRunId, reason)
    },

    sendMessage(msg = {}) {
      const protocolVersion = msg.protocolVersion ?? msg.busVersion ?? BUS_VERSION
      if (protocolVersion !== BUS_VERSION) {
        return { ok: false, code: 'protocol_unsupported', text: `不支持的 bus 协议版本: ${protocolVersion}` }
      }

      const payload = msg.payload || {}
      const payloadCheck = validateHandoffPayload(payload)
      if (!payloadCheck.ok && (msg.kind === 'handoff' || msg.type === 'handoff.request')) {
        return payloadCheck
      }

      const envelope = {
        busVersion: BUS_VERSION,
        version: BUS_VERSION,
        messageId: msg.messageId || createMessageId(),
        correlationId: msg.correlationId || null,
        runId: msg.runId || msg.sourceRunId,
        sourceRunId: msg.sourceRunId || msg.runId,
        targetRunId: msg.targetRunId,
        parentRunId: msg.parentRunId || null,
        kind: msg.kind || msg.type || 'status',
        schemaRef: msg.schemaRef || null,
        payload,
        ts: new Date().toISOString(),
        idempotencyKey: msg.idempotencyKey || null,
      }

      const target = String(envelope.targetRunId || envelope.runId || '')
      const list = busMessages.get(target) || []
      list.push(envelope)
      busMessages.set(target, list)

      return { ok: true, envelope }
    },

    getMessages(runId) {
      return busMessages.get(String(runId || '')) || []
    },
  }
}

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
