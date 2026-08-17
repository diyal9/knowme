'use strict'

const { AgentRunStore, createRunId, createOperationKey } = require('./agent-run-store')
const { AgentMessageBus, BUS_VERSION } = require('./agent-message-bus')
const { AgentRunScheduler } = require('./agent-run-scheduler')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')

const RUN_STATUSES = Object.freeze([
  'created',
  'queued',
  'running',
  'waiting',
  'blocked',
  'terminalizing',
  'done',
  'error',
  'cancelled',
  'recovering',
  'interrupted',
])

const TERMINAL_STATUSES = new Set(['done', 'error', 'cancelled'])
const ACTIVE_STATUSES = new Set(['created', 'queued', 'running', 'waiting', 'blocked', 'terminalizing', 'recovering'])

const VALID_TRANSITIONS = Object.freeze({
  created: new Set(['queued', 'cancelled']),
  queued: new Set(['running', 'blocked', 'cancelled']),
  running: new Set(['waiting', 'blocked', 'terminalizing', 'error', 'cancelled']),
  waiting: new Set(['running', 'terminalizing', 'error', 'cancelled', 'recovering']),
  blocked: new Set(['queued', 'running', 'cancelled', 'error']),
  recovering: new Set(['running', 'waiting', 'error', 'cancelled']),
  interrupted: new Set(['recovering', 'error', 'cancelled']),
  terminalizing: new Set(['done', 'error', 'cancelled']),
  done: new Set(),
  error: new Set(),
  cancelled: new Set(),
})

const CANCEL_BUDGET_MS = 3000

function defaultIdGen() {
  return createRunId()
}

function cloneRun(record) {
  return JSON.parse(JSON.stringify(record))
}

class AgentRunManager {
  /**
   * @param {object} opts
   * @param {import('./agent-run-store').AgentRunStore} [opts.runStore]
   * @param {import('./agent-message-bus').AgentMessageBus} [opts.messageBus]
   * @param {import('./agent-run-scheduler').AgentRunScheduler} [opts.scheduler]
   * @param {object} [opts.launcher] - { launch, cancel, probeHealth }
   * @param {() => string} [opts.idGen]
   * @param {() => number} [opts.now]
   * @param {(event: object) => void} [opts.emit]
   * @param {number} [opts.maxDepth]
   * @param {number} [opts.cancelBudgetMs]
   */
  constructor(opts = {}) {
    this.runStore = opts.runStore || null
    this.messageBus = opts.messageBus || null
    this.scheduler = opts.scheduler || null
    this.launcher = opts.launcher || null
    this.idGen = typeof opts.idGen === 'function' ? opts.idGen : defaultIdGen
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now()
    this.emit = typeof opts.emit === 'function' ? opts.emit : () => {}
    this.maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 2
    this.cancelBudgetMs = Number.isFinite(opts.cancelBudgetMs) ? opts.cancelBudgetMs : CANCEL_BUDGET_MS
    this.authorizeChild = typeof opts.authorizeChild === 'function' ? opts.authorizeChild : null
    this.metrics = opts.metrics || this.runStore?.metrics || createAgentRuntimeMetrics({ now: this.now })

    /** @type {Map<string, object>} */
    this.runs = new Map()
    /** @type {Map<string, object>} */
    this.launches = new Map()
    this.launchSpecs = new Map()
    this.abortControllers = new Map()
    this.waiters = new Map()
    this._cancelPromises = new Map()
    this._terminalEmitted = new Set()
    this._eventListeners = new Set()

    if (this.messageBus) {
      this.messageBus.subscribeGlobal((msg) => this._onBusMessage(msg))
    }
    if (this.scheduler && !opts.scheduler?.onLaunch) {
      this.scheduler.onLaunch = (item) => this._launchFromScheduler(item)
    }
  }

  _transition(run, nextStatus, patch = {}) {
    const current = String(run.status || 'created')
    const target = String(nextStatus)
    const allowed = VALID_TRANSITIONS[current]
    if (!allowed || (!allowed.has(target) && current !== target)) {
      return { ok: false, code: 'invalid_transition', message: `${current} → ${target} 不允许` }
    }
    run.status = target
    Object.assign(run, patch)
    run.updatedAt = new Date(this.now()).toISOString()
    return { ok: true, run }
  }

  _baseRunRecord(spec = {}) {
    const runId = String(spec.runId || this.idGen())
    return {
      runId,
      parentRunId: spec.parentRunId ? String(spec.parentRunId) : null,
      rootRunId: spec.rootRunId ? String(spec.rootRunId) : runId,
      depth: Number.isFinite(spec.depth) ? spec.depth : 0,
      status: 'created',
      phase: spec.phase || null,
      terminal: false,
      packageRef: spec.packageRef || null,
      expertSnapshotId: spec.expertSnapshotId || null,
      permissions: spec.permissions || {},
      childRunIds: [],
      joinStrategy: spec.joinStrategy || 'all',
      continueOnChildError: Boolean(spec.continueOnChildError),
      createdAt: new Date(this.now()).toISOString(),
      updatedAt: new Date(this.now()).toISOString(),
      startedAt: null,
      endedAt: null,
      cancelReason: null,
      stopReason: null,
      idempotencyKey: spec.idempotencyKey || null,
      seq: 0,
      sessionId: spec.sessionId || null,
      budget: spec.budget || {},
      governanceEnvelope: spec.governanceEnvelope || {},
      packageSnapshotHash: spec.packageSnapshotHash || null,
      meta: {
        ...(spec.meta || {}),
        expertId: spec.expertId || spec.meta?.expertId || null,
        builderId: spec.builderId || spec.backend || spec.meta?.builderId || 'knowme-local',
        backend: spec.backend || spec.meta?.backend || 'local-executor',
      },
    }
  }

  _persistRun(run, eventType, payload = {}) {
    if (!this.runStore) return { ok: true, skipped: true }
    const append = this.runStore.appendEvent(run.runId, {
      type: eventType,
      parentRunId: run.parentRunId,
      rootRunId: run.rootRunId,
      payload: { ...payload, status: run.status, phase: run.phase },
    })
    if (append.ok) {
      run.seq = append.seq
    }
    const stateWrite = this.runStore.writeState(run.runId, run)
    if (stateWrite.ok && append.ok) {
      this.runStore.updateTreeIndex(run.rootRunId, {
        runId: run.runId,
        parentRunId: run.parentRunId,
        status: run.status,
        depth: run.depth,
        terminal: run.terminal,
      })
    }
    return append.ok ? append : stateWrite
  }

  _broadcast(event) {
    for (const listener of this._eventListeners) {
      try { listener(event) } catch { /* ignore */ }
    }
    this.emit(event)
  }

  onEvent(listener) {
    this._eventListeners.add(listener)
    return () => this._eventListeners.delete(listener)
  }

  _emitTerminalOnce(run, terminalPayload = {}) {
    if (this._terminalEmitted.has(run.runId)) {
      this.metrics.increment('duplicate_terminal_total', 1, { outcome: run.status })
      return { ok: true, duplicate: true }
    }
    this._terminalEmitted.add(run.runId)
    run.terminal = true
    run.endedAt = run.endedAt || new Date(this.now()).toISOString()

    const event = {
      type: 'run.terminal',
      runId: run.runId,
      rootRunId: run.rootRunId,
      status: run.status,
      payload: terminalPayload,
      ts: run.endedAt,
    }
    this._broadcast(event)
    this._persistRun(run, 'run.terminal', terminalPayload)

    if (this.messageBus) {
      this.messageBus.publish({
        version: BUS_VERSION,
        runId: run.runId,
        parentRunId: run.parentRunId,
        rootRunId: run.rootRunId,
        type: 'run.terminal',
        payload: {
          terminal: run.status === 'done' ? 'completed' : run.status,
          stopReason: run.stopReason || run.cancelReason || null,
          metrics: terminalPayload.metrics || {},
          outputPayload: terminalPayload.outputPayload || null,
          summary: terminalPayload.summary || run.meta?.summary || '',
          artifactRefs: terminalPayload.artifactRefs || run.artifactRefs || [],
          evidenceRefs: terminalPayload.evidenceRefs || run.evidenceRefs || [],
        },
      })
    }
    return { ok: true }
  }

  _checkIdempotency(idempotencyKey) {
    if (!idempotencyKey || !this.runStore) return null
    for (const run of this.runs.values()) {
      if (run.idempotencyKey === idempotencyKey && ACTIVE_STATUSES.has(run.status)) {
        return { ok: true, duplicate: true, runId: run.runId, status: run.status }
      }
    }
    const key = createOperationKey({ idempotencyKey })
    const receipt = this.runStore.readReceipt('__global__', key)
    if (receipt.ok && receipt.receipt?.result?.runId) {
      return { ok: true, duplicate: true, runId: receipt.receipt.result.runId, status: receipt.receipt.result.status }
    }
    return null
  }

  createRun(spec = {}) {
    const dup = spec.idempotencyKey ? this._checkIdempotency(spec.idempotencyKey) : null
    if (dup) return dup

    const run = this._baseRunRecord(spec)
    this.launchSpecs.set(run.runId, {
      prompt: spec.prompt,
      expertId: spec.expertId,
      agentPackageId: spec.agentPackageId,
      backend: spec.backend,
      builderId: spec.builderId,
      handoff: spec.handoff || spec.handoffContext,
      governanceEnvelope: spec.governanceEnvelope,
      packageSnapshotHash: spec.packageSnapshotHash,
      budget: spec.budget,
      tier: spec.tier,
      session: spec.session,
      parentSignal: spec.parentSignal,
      onEmit: spec.onEmit,
      onTerminal: spec.onTerminal,
    })
    this._transition(run, 'queued')
    this.runs.set(run.runId, run)
    this.metrics.gauge('active_runs', this._activeRunCount())
    this._persistRun(run, 'run.created', { packageRef: run.packageRef })
    this._broadcast({ type: 'run.created', runId: run.runId, run: cloneRun(run) })

    if (this.scheduler && spec.autoLaunch !== false) {
      this.scheduler.register({
        runId: run.runId,
        parentRunId: run.parentRunId,
        rootRunId: run.rootRunId,
        depth: run.depth,
        joinStrategy: run.joinStrategy,
        budget: spec.budget,
        meta: spec.meta,
      })
    }

    if (spec.idempotencyKey && this.runStore) {
      const key = createOperationKey({ idempotencyKey: spec.idempotencyKey })
      this.runStore.writeReceipt('__global__', key, {
        result: { runId: run.runId, status: run.status },
      })
    }

    return { ok: true, runId: run.runId, run: cloneRun(run) }
  }

  adoptRunningRun(spec = {}) {
    const existing = spec.runId ? this.runs.get(String(spec.runId)) : null
    const created = existing ? { ok: true, runId: existing.runId, run: cloneRun(existing) } : this.createRun({
      ...spec,
      autoLaunch: false,
    })
    if (!created.ok) return created
    const run = this.runs.get(created.runId)
    if (!run) return { ok: false, code: 'run_not_found' }
    if (run.status === 'created' || run.status === 'queued') {
      this._transition(run, 'running', {
        startedAt: run.startedAt || new Date(this.now()).toISOString(),
        phase: 'RUNNING',
      })
      this._persistRun(run, 'run.started', { adopted: true })
      this._broadcast({ type: 'run.started', runId: run.runId, status: run.status, adopted: true })
    }
    if (spec.abortController) this.abortControllers.set(run.runId, spec.abortController)
    return { ok: true, runId: run.runId, run: cloneRun(run) }
  }

  completeAdoptedRun(runId, result = {}) {
    return this._finalizeTerminal(runId, result)
  }

  createChildRun(parentRunId, spec = {}) {
    const parent = this.getRun(parentRunId)
    if (!parent.ok) return parent

    const depth = (parent.run.depth || 0) + 1
    if (depth > this.maxDepth) {
      return { ok: false, code: 'orchestration_depth_exceeded', message: '编排深度超限' }
    }

    const parentEnvelope = parent.run.governanceEnvelope || {}
    const parentOrchestration = parentEnvelope.orchestration
      || parentEnvelope.permissions?.orchestration
      || parent.run.permissions?.orchestration
      || {}
    const allowedSubExperts = parentOrchestration.allowedSubExperts || parentOrchestration.allowedExperts
    if (Array.isArray(allowedSubExperts) && allowedSubExperts.length && !allowedSubExperts.includes(spec.expertId)) {
      return { ok: false, code: 'scope_denied', message: `子专家未授权: ${spec.expertId}` }
    }
    if (this.authorizeChild) {
      const authorization = this.authorizeChild(spec, parent.run)
      if (authorization !== true && authorization?.ok !== true) {
        return {
          ok: false,
          code: authorization?.code || 'unknown_agent',
          message: authorization?.message || `未知或不可用 Agent: ${spec.expertId || spec.agentPackageId || ''}`,
        }
      }
    }

    if (this.scheduler) {
      const gate = this.scheduler.canLaunch(parentRunId, depth)
      if (!gate.ok) return gate
    }

    const childSpec = {
      ...spec,
      runId: spec.runId || spec.subRunId || this.idGen(),
      parentRunId: String(parentRunId),
      rootRunId: parent.run.rootRunId || String(parentRunId),
      depth,
      joinStrategy: spec.joinStrategy || parent.run.joinStrategy,
      permissions: spec.permissions || parent.run.permissions,
      governanceEnvelope: spec.governanceEnvelope || parentEnvelope,
      budget: spec.budget || parent.run.budget,
    }
    const created = this.createRun({ ...childSpec, autoLaunch: spec.autoLaunch !== false })
    if (!created.ok) return created

    const parentRun = this.runs.get(String(parentRunId))
    if (parentRun) {
      parentRun.childRunIds = [...(parentRun.childRunIds || []), created.runId]
      this._persistRun(parentRun, 'run.child.spawned', { childRunId: created.runId })
    }

    if (this.messageBus) {
      this.messageBus.publish({
        version: BUS_VERSION,
        runId: created.runId,
        parentRunId: String(parentRunId),
        rootRunId: childSpec.rootRunId,
        targetRunId: created.runId,
        type: 'task.assign',
        payload: {
          targetAgentPackageId: spec.agentPackageId || spec.expertId || null,
          prompt: spec.prompt || '',
          handoffContext: spec.handoff || spec.handoffContext || {},
          inputSchemaRef: spec.inputSchemaRef || null,
          correlationId: spec.correlationId || created.runId,
        },
      })
    }

    return created
  }

  getRun(runId) {
    const id = String(runId || '')
    const cached = this.runs.get(id)
    if (cached) return { ok: true, run: cloneRun(cached), source: 'memory' }

    if (this.runStore) {
      const query = this.runStore.queryRun(id)
      if (query.ok) {
        this.runs.set(id, query.state)
        return { ok: true, run: cloneRun(query.state), source: query.source }
      }
      return { ok: false, code: query.code || 'not_found', message: query.message || 'Run 不存在或已清理' }
    }

    return { ok: false, code: 'not_found', message: 'Run 不存在或已清理' }
  }

  getRunTree(rootRunId) {
    const id = String(rootRunId || '')
    if (this.runStore) {
      const tree = this.runStore.getRunTree(id)
      if (tree.ok) {
        const nodes = {}
        let resumeAvailable = false
        for (const [runId, indexed] of Object.entries(tree.nodes || {})) {
          const hit = this.getRun(runId)
          const run = hit.ok ? hit.run : {}
          const status = run.status || indexed.status
          if (status === 'interrupted' || status === 'recovering') resumeAvailable = true
          nodes[runId] = {
            ...indexed,
            ...run,
            children: indexed.children || run.childRunIds || [],
            artifacts: run.artifactRefs || [],
            evidence: run.evidenceRefs || [],
            summary: run.meta?.summary || '',
            metrics: run.meta?.metrics || {},
            expertId: run.meta?.expertId || null,
            builderId: run.meta?.builderId || run.meta?.backend || 'knowme-local',
            terminal: run.terminal
              ? (status === 'done' ? 'completed' : status === 'error' ? 'failed' : status)
              : null,
          }
        }
        return {
          ...tree,
          nodes,
          root: nodes[id] || tree.root,
          resumeAvailable,
        }
      }
    }

    const nodes = {}
    for (const run of this.runs.values()) {
      if (run.rootRunId === id || run.runId === id) {
        nodes[run.runId] = { ...run, children: run.childRunIds || [] }
      }
    }
    if (!Object.keys(nodes).length) {
      return { ok: false, code: 'not_found', message: 'Run 树不存在' }
    }
    return { ok: true, rootRunId: id, nodes, root: nodes[id] || null }
  }

  async launchRun(runId) {
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const run = this.runs.get(String(runId))
    if (!['queued', 'recovering', 'interrupted'].includes(run.status)) {
      return { ok: false, code: 'invalid_state', message: `无法 launch 状态=${run.status}` }
    }

    this._transition(run, 'running', { startedAt: run.startedAt || new Date(this.now()).toISOString() })
    this._persistRun(run, 'run.phase', { phase: run.phase || 'PREPARE' })
    this._broadcast({ type: 'run.started', runId: run.runId, run: cloneRun(run) })

    if (!this.launcher) {
      return { ok: true, runId: run.runId, launched: false, reason: 'launcher_not_configured' }
    }

    try {
      const launchSpec = this.launchSpecs.get(run.runId) || {}
      const abortController = new AbortController()
      this.abortControllers.set(run.runId, abortController)
      if (launchSpec.parentSignal?.aborted) abortController.abort(launchSpec.parentSignal.reason)
      else launchSpec.parentSignal?.addEventListener?.(
        'abort',
        () => abortController.abort(launchSpec.parentSignal.reason),
        { once: true },
      )
      const handle = await this.launcher.launch(
        { ...cloneRun(run), ...launchSpec },
        {
          emit: (evt) => {
            launchSpec.onEmit?.(evt)
            this._broadcast({ ...evt, runId: run.runId })
          },
          onTerminal: (result) => {
            launchSpec.onTerminal?.(result)
            this._finalizeTerminal(run.runId, result)
          },
          signal: abortController.signal,
        },
      )
      this.launches.set(run.runId, handle)
      return { ok: true, runId: run.runId, launched: true, handle }
    } catch (err) {
      this._transition(run, 'error', { stopReason: String(err?.message || err) })
      this._emitTerminalOnce(run, { terminal: 'failed', stopReason: run.stopReason })
      if (this.scheduler) this.scheduler.onTerminal(runId, {
        status: 'error',
        terminal: 'failed',
        code: 'launch_failed',
        message: run.stopReason,
      })
      this.launches.delete(runId)
      this.abortControllers.delete(runId)
      this._notifyWaiters(runId)
      return { ok: false, code: 'launch_failed', message: String(err?.message || err) }
    }
  }

  async _launchFromScheduler(item) {
    return this.launchRun(item.runId)
  }

  _finalizeTerminal(runId, result = {}) {
    const run = this.runs.get(String(runId))
    if (!run) return { ok: false, code: 'not_found' }
    if (run.terminal) {
      this.metrics.increment('duplicate_terminal_total', 1, { outcome: run.status })
      return { ok: true, duplicate: true }
    }

    const status = String(result.status || result.terminal || 'done').toLowerCase()
    const mapped = ['completed', 'done'].includes(status) ? 'done'
      : status === 'failed' ? 'error'
        : status === 'cancelled' ? 'cancelled' : 'error'
    run.artifactRefs = Array.isArray(result.artifactRefs) ? result.artifactRefs.slice(0, 32) : (run.artifactRefs || [])
    run.evidenceRefs = Array.isArray(result.evidenceRefs) ? result.evidenceRefs.slice(0, 32) : (run.evidenceRefs || [])
    run.meta = {
      ...(run.meta || {}),
      summary: String(result.text || result.summary || run.meta?.summary || '').slice(0, 4000),
      metrics: result.metrics || result.report?.metrics || run.meta?.metrics || {},
    }

    this._transition(run, 'terminalizing')
    this._transition(run, mapped, {
      stopReason: result.stopReason || result.message || null,
      phase: result.phase || run.phase,
    })

    this._emitTerminalOnce(run, {
      ...result,
      summary: run.meta.summary,
      metrics: run.meta.metrics,
      artifactRefs: run.artifactRefs,
      evidenceRefs: run.evidenceRefs,
    })
    if (this.scheduler) this.scheduler.onTerminal(runId, { status: mapped, ...result })
    this.launches.delete(runId)
    this.abortControllers.delete(runId)
    this._notifyWaiters(runId)
    this.metrics.gauge('active_runs', this._activeRunCount())
    return { ok: true, status: mapped }
  }

  _notifyWaiters(runId) {
    const id = String(runId)
    const list = this.waiters.get(id) || []
    if (!list.length) return
    this.waiters.delete(id)
    this.metrics.gauge('waiter_count', this._waiterCount())
    const status = this.getRunStatus(id)
    for (const waiter of list) {
      clearTimeout(waiter.timer)
      waiter.resolve(status)
    }
  }

  async cancelRun(runId, reason = 'user_cancel') {
    const id = String(runId || '')
    const inFlight = this._cancelPromises.get(id)
    if (inFlight) {
      this.metrics.increment('duplicate_cancel_total')
      return inFlight
    }
    const operation = this._cancelRunInternal(id, reason)
    this._cancelPromises.set(id, operation)
    try {
      return await operation
    } finally {
      this._cancelPromises.delete(id)
    }
  }

  async _cancelRunInternal(runId, reason = 'user_cancel') {
    const startedAt = this.now()
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const run = this.runs.get(String(runId))

    if (TERMINAL_STATUSES.has(run.status)) {
      return { ok: true, alreadyTerminal: true, runId: run.runId, status: run.status }
    }

    run.cancelReason = reason
    this.abortControllers.get(run.runId)?.abort(reason)

    const childIds = [...(run.childRunIds || [])]
    const cancelledChildren = []
    for (const childId of childIds) {
      const res = await this.cancelRun(childId, reason)
      if (res.ok) cancelledChildren.push(childId)
    }

    if (this.scheduler) this.scheduler.cancel(runId)
    if (this.launcher) {
      const handle = this.launches.get(run.runId)
      if (handle) {
        try { await this.launcher.cancel(run.runId, reason) } catch { /* best effort */ }
      }
    }
    if (TERMINAL_STATUSES.has(run.status)) {
      const elapsedMs = this.now() - startedAt
      this.metrics.increment('cancel_total', 1, { outcome: run.status })
      this.metrics.observe('cancel_latency_ms', elapsedMs)
      return {
        ok: true,
        alreadyTerminal: true,
        runId: run.runId,
        status: run.status,
        cancelledChildren,
        elapsedMs,
        withinBudgetMs: elapsedMs <= this.cancelBudgetMs,
      }
    }

    this._transition(run, 'terminalizing')
    this._transition(run, 'cancelled')
    this._emitTerminalOnce(run, { terminal: 'cancelled', stopReason: reason })
    this.launches.delete(run.runId)
    this.abortControllers.delete(run.runId)
    this._notifyWaiters(run.runId)

    const elapsedMs = this.now() - startedAt
    this.metrics.increment('cancel_total', 1, { outcome: run.status })
    this.metrics.observe('cancel_latency_ms', elapsedMs)
    this.metrics.gauge('active_runs', this._activeRunCount())
    return {
      ok: true,
      runId: run.runId,
      cancelledChildren,
      elapsedMs,
      withinBudgetMs: elapsedMs <= this.cancelBudgetMs,
    }
  }

  retryRun(runId, opts = {}) {
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const prev = hit.run

    if (!opts.force && !['error', 'cancelled'].includes(prev.status)) {
      return { ok: false, code: 'not_retriable', message: '仅 error/cancelled 可重试' }
    }
    if (prev.idempotencyKey && !opts.force && !opts.newIdempotencyKey) {
      return { ok: false, code: 'idempotency_required', message: '需新 idempotencyKey 或 force' }
    }

    const priorLaunch = this.launchSpecs.get(prev.runId) || {}
    const spec = {
      ...priorLaunch,
      packageRef: prev.packageRef,
      expertSnapshotId: prev.expertSnapshotId,
      permissions: prev.permissions,
      governanceEnvelope: prev.governanceEnvelope,
      budget: prev.budget,
      parentRunId: prev.parentRunId,
      rootRunId: prev.rootRunId,
      depth: prev.depth,
      joinStrategy: prev.joinStrategy,
      idempotencyKey: opts.newIdempotencyKey || null,
      sessionId: prev.sessionId,
      meta: { ...prev.meta, retriedFrom: prev.runId, attempt: (prev.meta?.attempt || 1) + 1 },
      autoLaunch: opts.autoLaunch !== false,
    }
    return prev.parentRunId
      ? this.createChildRun(prev.parentRunId, spec)
      : this.createRun(spec)
  }

  resumeRun(runId, opts = {}) {
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const run = this.runs.get(String(runId))

    if (this.runStore && opts.checkpointId) {
      const cp = this.runStore.loadCheckpoint(runId, opts.checkpointId)
      if (!cp.ok) return cp
      if (cp.checkpoint.lastSeq > (run.seq || 0)) {
        return { ok: false, code: 'resume_unsafe', message: 'checkpoint 与 Event Log 不一致' }
      }
    }

    if (this.runStore) {
      const replay = this.runStore.replay(runId, {
        tolerantTail: true,
        onEvent: (state, event) => {
          if (event.type === 'run.state' && event.payload?.state) return event.payload.state
          return state
        },
      })
      if (!replay.ok) {
        this.metrics.increment('recovery_rejected_total', 1, { code: replay.code })
        return {
          ok: false,
          code: replay.code || 'event_log_corrupt',
          message: replay.message || 'Run 持久化数据损坏，无法安全恢复',
        }
      }
      if (replay.state) {
        Object.assign(run, replay.state)
      }
    }

    const resumable = ['waiting', 'recovering', 'interrupted', 'blocked', 'queued']
    if (!resumable.includes(run.status) && !opts.force) {
      return { ok: false, code: 'resume_unsafe', message: `状态 ${run.status} 不可自动恢复` }
    }

    const action = opts.action || 'continue'
    if (action === 'abandon') {
      return this.cancelRun(runId, 'abandoned')
    }
    if (action === 'retry') {
      return this.retryRun(runId, opts)
    }

    if (run.status === 'blocked') this._transition(run, 'queued')
    else if (run.status !== 'queued') this._transition(run, 'recovering')
    this._persistRun(run, 'run.resumed', { action })
    this._broadcast({ type: 'run.resumed', runId: run.runId, action })
    this.metrics.increment('resume_total', 1, { outcome: action })

    if (opts.launch !== false) {
      return this.launchRun(runId)
    }
    this._transition(run, 'running')
    return { ok: true, runId: run.runId, run: cloneRun(run) }
  }

  queryEvents(runId, opts = {}) {
    if (!this.runStore) return { ok: false, code: 'store_unavailable' }
    let events
    try {
      events = this.runStore.readEvents(String(runId), { tolerantTail: true })
    } catch (error) {
      return {
        ok: false,
        code: error.code || 'event_log_corrupt',
        message: String(error.message || error),
      }
    }
    const fromSeq = Number(opts.fromSeq) || 0
    const filtered = events.filter((e) => Number(e.seq) > fromSeq)
    return { ok: true, events: filtered, lastSeq: events.reduce((m, e) => Math.max(m, Number(e.seq) || 0), 0) }
  }

  attachSession(runId, sessionId) {
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const run = this.runs.get(String(runId))
    run.sessionId = String(sessionId)
    run.updatedAt = new Date(this.now()).toISOString()
    this._persistRun(run, 'run.session.attached', { sessionId: run.sessionId })
    return { ok: true, runId: run.runId, sessionId: run.sessionId }
  }

  markWaiting(runId, reason = 'join') {
    const run = this.runs.get(String(runId))
    if (!run) return { ok: false, code: 'not_found' }
    this._transition(run, 'waiting', { waitReason: reason })
    this._persistRun(run, 'run.waiting', { reason })
    if (this.scheduler) this.scheduler.markWaiting(runId, reason)
    return { ok: true, run: cloneRun(run) }
  }

  saveCheckpoint(runId, checkpointId, data = {}) {
    if (!this.runStore) return { ok: false, code: 'store_unavailable' }
    const run = this.runs.get(String(runId))
    if (run) {
      data = {
        ...data,
        pendingNodes: data.pendingNodes || run.childRunIds?.filter((id) => {
          const child = this.runs.get(id)
          return child && !TERMINAL_STATUSES.has(child.status)
        }),
        completedNodes: data.completedNodes || run.childRunIds?.filter((id) => {
          const child = this.runs.get(id)
          return child && TERMINAL_STATUSES.has(child.status)
        }),
      }
    }
    return this.runStore.saveCheckpoint(runId, checkpointId, data)
  }

  async createAndLaunchChild(spec = {}) {
    const parentRunId = String(spec.parentRunId || '')
    if (!parentRunId) return { ok: false, code: 'invalid_args', text: '缺少 parentRunId' }
    const created = this.createChildRun(parentRunId, spec)
    if (!created.ok) return { ...created, text: created.message || created.code }
    return {
      ok: true,
      launched: true,
      runId: created.runId,
      subRunId: created.runId,
      status: 'queued',
      text: `子 Run ${created.runId} 已进入执行队列`,
      meta: {
        subRunId: created.runId,
        expertId: spec.expertId || null,
        builderId: spec.builderId || spec.backend || 'knowme-local',
        status: 'queued',
      },
    }
  }

  getRunStatus(runId) {
    const hit = this.getRun(runId)
    if (!hit.ok) return hit
    const run = hit.run
    const started = run.startedAt ? Date.parse(run.startedAt) : this.now()
    const ended = run.endedAt ? Date.parse(run.endedAt) : this.now()
    return {
      ok: true,
      runId: run.runId,
      parentRunId: run.parentRunId,
      rootRunId: run.rootRunId,
      status: run.status,
      phase: run.phase,
      terminal: run.terminal ? run.status : null,
      stopReason: run.stopReason || run.cancelReason || null,
      durationMs: Math.max(0, ended - started),
      expertId: this.launchSpecs.get(run.runId)?.expertId || run.meta?.expertId || null,
      builderId: this.launchSpecs.get(run.runId)?.builderId || this.launchSpecs.get(run.runId)?.backend || run.meta?.builderId || 'knowme-local',
      summary: run.meta?.summary || '',
      metrics: run.meta?.metrics || {},
    }
  }

  awaitRun(runId, timeoutMs = 60000) {
    const id = String(runId || '')
    const current = this.getRunStatus(id)
    if (!current.ok || TERMINAL_STATUSES.has(current.status)) return Promise.resolve(current)
    const timeout = Math.max(100, Math.min(Number(timeoutMs) || 60000, 30 * 60 * 1000))
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(id) || []
        this.waiters.set(id, list.filter(item => item.timer !== timer))
        this.metrics.gauge('waiter_count', this._waiterCount())
        resolve({ ok: false, code: 'subrun_timeout', text: `子 Run ${id} 等待超时`, runId: id })
      }, timeout)
      const list = this.waiters.get(id) || []
      list.push({ timer, resolve })
      this.waiters.set(id, list)
      this.metrics.gauge('waiter_count', this._waiterCount())
    })
  }

  async cancelAllChildren(parentRunId, reason = 'parent_cancelled') {
    const hit = this.getRun(parentRunId)
    if (!hit.ok) return hit
    const startedAt = this.now()
    const cancelled = []
    for (const childRunId of hit.run.childRunIds || []) {
      const result = await this.cancelRun(childRunId, reason)
      if (result.ok) cancelled.push(childRunId)
    }
    const elapsedMs = this.now() - startedAt
    return { ok: true, cancelled, elapsedMs, withinBudget: elapsedMs <= this.cancelBudgetMs }
  }

  sendMessage(message = {}) {
    if (!this.messageBus) return { ok: false, code: 'bus_unavailable', text: 'Message Bus 未配置' }
    const kindMap = {
      handoff: 'handoff.request',
      status: 'task.progress',
      terminal: 'run.terminal',
      artifact: 'artifact.publish',
      evidence: 'evidence.record',
    }
    const type = kindMap[message.kind] || message.type || message.kind
    return this.messageBus.publish({
      version: BUS_VERSION,
      runId: message.sourceRunId || message.runId,
      parentRunId: message.parentRunId || null,
      rootRunId: message.rootRunId || message.runId || message.sourceRunId,
      targetRunId: message.targetRunId,
      type,
      payload: message.payload || {},
      correlationId: message.correlationId,
      idempotencyKey: message.idempotencyKey,
    })
  }

  _onBusMessage(msg) {
    if (msg.type === 'run.terminal' && msg.parentRunId) {
      const parent = this.runs.get(msg.parentRunId)
      if (parent && parent.status === 'waiting') {
        const allTerminal = (parent.childRunIds || []).every((id) => {
          const child = this.runs.get(id)
          return child && TERMINAL_STATUSES.has(child.status)
        })
        if (allTerminal) {
          this._transition(parent, 'running')
          this._broadcast({ type: 'run.join.complete', runId: parent.runId, childRunId: msg.runId })
        }
      }
    }
    this._broadcast({ type: 'bus.message', message: msg })
  }

  loadFromStore(rootRunId) {
    if (!this.runStore) return { ok: false, code: 'store_unavailable' }
    const tree = this.runStore.getRunTree(rootRunId)
    if (!tree.ok) return tree

    const loaded = []
    for (const node of Object.values(tree.nodes)) {
      const replay = this.runStore.replay(node.runId, { tolerantTail: true })
      if (!replay.ok) {
        this.metrics.increment('recovery_rejected_total', 1, { code: replay.code })
        return {
          ok: false,
          code: replay.code || 'event_log_corrupt',
          message: replay.message || `Run ${node.runId} 无法安全恢复`,
          runId: node.runId,
          loaded,
        }
      }
      const state = replay.state || readFallbackState(this.runStore, node.runId)
      if (state) {
        const wasActive = ACTIVE_STATUSES.has(String(state.status))
        if (wasActive) {
          state.status = 'interrupted'
          state.phase = 'INTERRUPTED'
          state.stopReason = state.stopReason || 'process_restarted'
          state.interruptedAt = new Date(this.now()).toISOString()
          state.terminal = false
        }
        this.runs.set(node.runId, state)
        if (TERMINAL_STATUSES.has(String(state.status))) this._terminalEmitted.add(node.runId)
        if (wasActive) {
          this._persistRun(state, 'run.interrupted', {
            stopReason: state.stopReason,
            recoverable: true,
          })
          this.metrics.increment('recovery_interrupted_total')
        } else {
          this.metrics.increment('recovery_terminal_total')
        }
        loaded.push(node.runId)
      }
    }
    return { ok: true, loaded, rootRunId }
  }

  recoverAllFromStore() {
    if (!this.runStore || typeof this.runStore.listRootRunIds !== 'function') {
      return { ok: false, code: 'store_unavailable', recovered: [] }
    }
    const recovered = []
    const errors = []
    for (const rootRunId of this.runStore.listRootRunIds()) {
      const result = this.loadFromStore(rootRunId)
      if (result.ok) recovered.push(...result.loaded)
      else errors.push({ rootRunId, code: result.code || 'recovery_failed' })
    }
    const result = { ok: errors.length === 0, recovered: [...new Set(recovered)], errors }
    this.metrics.increment(
      errors.length ? 'recovery_failed_total' : 'recovery_success_total',
      1,
      { outcome: errors.length ? 'failed' : 'success' },
    )
    return result
  }

  _activeRunCount() {
    let count = 0
    for (const run of this.runs.values()) {
      if (ACTIVE_STATUSES.has(String(run.status))) count += 1
    }
    return count
  }

  _waiterCount() {
    let count = 0
    for (const list of this.waiters.values()) count += list.length
    return count
  }

  getDiagnostics() {
    const queues = this.scheduler?.queues || {}
    const queueDepth = Object.values(queues).reduce(
      (total, queue) => total + (Array.isArray(queue) ? queue.length : 0),
      0,
    )
    const activeLaunches = this.launcher?.activeLaunches?.size || 0
    const activeRuns = this._activeRunCount()
    const waiters = this._waiterCount()
    const abortControllers = this.abortControllers.size
    const resourceLeakCount = [...this.runs.values()].filter(run => (
      TERMINAL_STATUSES.has(String(run.status))
      && (
        this.launches.has(run.runId)
        || this.abortControllers.has(run.runId)
        || this.waiters.has(run.runId)
      )
    )).length
    if (resourceLeakCount) this.metrics.increment('resource_leak_detected_total', resourceLeakCount)
    return {
      ok: true,
      authority: 'AgentRunManager+AgentRunStore',
      resources: {
        activeRuns,
        activeLaunches,
        waiters,
        abortControllers,
        cancelOperations: this._cancelPromises.size,
        resourceLeakCount,
      },
      queues: {
        depth: queueDepth,
        ready: queues.ready?.length || 0,
        waiting: queues.waiting?.length || 0,
        blocked: queues.blocked?.length || 0,
        retry: queues.retry?.length || 0,
      },
      metrics: this.metrics.snapshot({
        active_runs: activeRuns,
        active_launches: activeLaunches,
        waiter_count: waiters,
        queue_depth: queueDepth,
        resource_leak_count: resourceLeakCount,
      }),
    }
  }
}

function readFallbackState(runStore, runId) {
  const hit = runStore.readState(runId)
  return hit.ok ? hit.state : null
}

module.exports = {
  AgentRunManager,
  RUN_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  VALID_TRANSITIONS,
  CANCEL_BUDGET_MS,
  createRunId,
}
