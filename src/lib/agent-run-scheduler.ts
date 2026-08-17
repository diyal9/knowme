'use strict'

const {
  DEFAULT_MAX_PARALLEL,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_CHILDREN,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
  DEFAULT_WALL_BUDGET_MS,
  DEFAULT_MAX_TOOL_CALLS,
  RETRIABLE_CODES,
  NON_RETRIABLE_CODES,
  QUEUES,
  sleepMs,
} = require('./agent-run-scheduler-policy')

class AgentRunScheduler {
  /**
   * @param {object} opts
   * @param {number} [opts.maxParallel]
   * @param {number} [opts.maxDepth]
   * @param {number} [opts.maxChildren]
   * @param {number} [opts.maxAttempts]
   * @param {number} [opts.baseBackoffMs]
   * @param {number} [opts.maxBackoffMs]
   * @param {object} [opts.budget]
   * @param {() => number} [opts.now]
   * @param {(item: object) => void} [opts.onLaunch]
   * @param {(parentRunId: string, result: object) => void} [opts.onJoinComplete]
   */
  constructor(opts = {}) {
    this.maxParallel = Number.isFinite(opts.maxParallel) ? opts.maxParallel : DEFAULT_MAX_PARALLEL
    this.maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : DEFAULT_MAX_DEPTH
    this.maxChildren = Number.isFinite(opts.maxChildren) ? opts.maxChildren : DEFAULT_MAX_CHILDREN
    this.maxAttempts = Number.isFinite(opts.maxAttempts) ? opts.maxAttempts : DEFAULT_MAX_ATTEMPTS
    this.baseBackoffMs = Number.isFinite(opts.baseBackoffMs) ? opts.baseBackoffMs : DEFAULT_BASE_BACKOFF_MS
    this.maxBackoffMs = Number.isFinite(opts.maxBackoffMs) ? opts.maxBackoffMs : DEFAULT_MAX_BACKOFF_MS
    this.budget = {
      maxWallMs: opts.budget?.maxWallMs ?? DEFAULT_WALL_BUDGET_MS,
      maxToolCalls: opts.budget?.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS,
      maxCostUsd: opts.budget?.maxCostUsd ?? null,
    }
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now()
    this.onLaunch = typeof opts.onLaunch === 'function' ? opts.onLaunch : null
    this.onJoinComplete = typeof opts.onJoinComplete === 'function' ? opts.onJoinComplete : null

    /** @type {Map<string, object>} */
    this.items = new Map()
    /** @type {Record<string, string[]>} */
    this.queues = { ready: [], waiting: [], blocked: [], retry: [] }
    this.runningByParent = new Map()
    this.childrenByParent = new Map()
    this.joinWaits = new Map()
    this._tickScheduled = false
  }

  _queueOf(runId) {
    for (const name of QUEUES) {
      if (this.queues[name].includes(runId)) return name
    }
    return null
  }

  _removeFromQueues(runId) {
    for (const name of QUEUES) {
      this.queues[name] = this.queues[name].filter((id) => id !== runId)
    }
  }

  _enqueue(queue, runId, { fair = true } = {}) {
    this._removeFromQueues(runId)
    if (fair) {
      this.queues[queue].push(runId)
    } else {
      this.queues[queue].unshift(runId)
    }
  }

  register(item = {}) {
    const runId = String(item.runId || '')
    if (!runId) return { ok: false, code: 'missing_run_id' }

    const record = {
      runId,
      parentRunId: item.parentRunId ? String(item.parentRunId) : null,
      rootRunId: item.rootRunId ? String(item.rootRunId) : runId,
      depth: Number.isFinite(item.depth) ? item.depth : 0,
      status: item.status || 'queued',
      joinStrategy: item.joinStrategy || 'all',
      continueOnChildError: Boolean(item.continueOnChildError),
      attempt: Number.isFinite(item.attempt) ? item.attempt : 1,
      enqueuedAt: this.now(),
      startedAt: null,
      endedAt: null,
      budget: { ...this.budget, ...(item.budget || {}) },
      meta: item.meta || {},
    }
    this.items.set(runId, record)

    if (record.parentRunId) {
      const siblings = this.childrenByParent.get(record.parentRunId) || []
      if (!siblings.includes(runId)) siblings.push(runId)
      this.childrenByParent.set(record.parentRunId, siblings)
    }

    this._enqueue('ready', runId)
    this.scheduleTick()
    return { ok: true, item: record }
  }

  canLaunch(parentRunId = null, depth = 0) {
    if (depth >= this.maxDepth) {
      return { ok: false, code: 'orchestration_depth_exceeded', message: '编排深度超限' }
    }
    if (parentRunId) {
      const children = this.childrenByParent.get(String(parentRunId)) || []
      const activeChildren = children.filter((id) => {
        const item = this.items.get(id)
        return item && !['done', 'error', 'cancelled', 'failed'].includes(item.status)
      })
      if (activeChildren.length >= this.maxChildren) {
        return { ok: false, code: 'orchestration_depth_exceeded', message: '子 Run 预算已用尽' }
      }
      const running = this.runningByParent.get(String(parentRunId)) || 0
      if (running >= this.maxParallel) {
        return { ok: false, code: 'parallel_cap_exceeded', message: '并行子 Run 已达上限' }
      }
    }
    return { ok: true }
  }

  _parentRunningCount(parentRunId) {
    return this.runningByParent.get(String(parentRunId)) || 0
  }

  _incParentRunning(parentRunId) {
    if (!parentRunId) return
    const key = String(parentRunId)
    this.runningByParent.set(key, this._parentRunningCount(key) + 1)
  }

  _decParentRunning(parentRunId) {
    if (!parentRunId) return
    const key = String(parentRunId)
    this.runningByParent.set(key, Math.max(0, this._parentRunningCount(key) - 1))
  }

  dequeueReady() {
    const now = this.now()
    const retryReady = this.queues.retry.filter((id) => {
      const item = this.items.get(id)
      return item && (!item.retryAt || item.retryAt <= now)
    })
    if (retryReady.length) {
      const runId = retryReady[0]
      this._removeFromQueues(runId)
      return this.items.get(runId) || null
    }

    for (let i = 0; i < this.queues.ready.length; i++) {
      const runId = this.queues.ready[i]
      const item = this.items.get(runId)
      if (!item) {
        this.queues.ready.splice(i, 1)
        i -= 1
        continue
      }
      const gate = this.canLaunch(item.parentRunId, item.depth)
      if (!gate.ok) continue
      this.queues.ready.splice(i, 1)
      return item
    }
    return null
  }

  markRunning(runId) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    item.status = 'running'
    item.startedAt = item.startedAt || this.now()
    this._incParentRunning(item.parentRunId)
    return { ok: true, item }
  }

  markWaiting(runId, reason = 'join') {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    item.status = 'waiting'
    item.waitReason = reason
    this._decParentRunning(item.parentRunId)
    this._enqueue('waiting', runId)
    return { ok: true, item }
  }

  markBlocked(runId, reason = 'approval') {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    item.status = 'blocked'
    item.blockReason = reason
    this._enqueue('blocked', runId)
    return { ok: true, item }
  }

  unblock(runId) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    item.status = 'queued'
    item.blockReason = null
    this._enqueue('ready', runId, { fair: false })
    this.scheduleTick()
    return { ok: true, item }
  }

  isRetriable(code) {
    const normalized = String(code || '').toLowerCase()
    if (NON_RETRIABLE_CODES.has(normalized)) return false
    return RETRIABLE_CODES.has(normalized)
  }

  scheduleRetry(runId, error = {}) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    const code = error.code || 'unknown'
    if (!this.isRetriable(code)) {
      return { ok: false, code: 'not_retriable', message: '错误不可重试' }
    }
    if (item.attempt >= this.maxAttempts) {
      return { ok: false, code: 'retry_exhausted', message: '重试次数已用尽' }
    }
    item.attempt += 1
    const delay = Math.min(this.maxBackoffMs, this.baseBackoffMs * (2 ** (item.attempt - 2)))
    item.retryAt = this.now() + delay
    item.status = 'retry'
    item.lastError = { code, message: error.message || '' }
    this._decParentRunning(item.parentRunId)
    this._enqueue('retry', runId)
    this.scheduleTick()
    return { ok: true, item, retryAt: item.retryAt, delayMs: delay }
  }

  waitForChildren(parentRunId, childRunIds = [], joinStrategy = 'all') {
    const key = String(parentRunId)
    this.joinWaits.set(key, {
      childRunIds: childRunIds.map(String),
      joinStrategy,
      resolved: new Map(),
    })
    return this.markWaiting(key, 'join')
  }

  onChildTerminal(parentRunId, childRunId, result = {}) {
    const key = String(parentRunId)
    const wait = this.joinWaits.get(key)
    if (!wait) return { ok: false, code: 'no_join_wait' }

    wait.resolved.set(String(childRunId), result)
    const allDone = wait.childRunIds.every((id) => wait.resolved.has(id))
    if (!allDone) return { ok: true, pending: true }

    const results = wait.childRunIds.map((id) => wait.resolved.get(id))
    const failed = results.filter((r) => r && ['failed', 'error', 'cancelled'].includes(String(r.status || r.terminal || '').toLowerCase()))
    let joinOk = true
    if (wait.joinStrategy === 'all' && failed.length) joinOk = false
    if (wait.joinStrategy === 'any') joinOk = results.some((r) => ['completed', 'done'].includes(String(r.status || r.terminal || '').toLowerCase()))

    this.joinWaits.delete(key)
    const parent = this.items.get(key)
    if (parent) {
      parent.status = joinOk ? 'queued' : 'error'
      parent.joinResult = { ok: joinOk, results, failedCount: failed.length }
      if (joinOk) this._enqueue('ready', key, { fair: false })
    }

    if (this.onJoinComplete) {
      this.onJoinComplete(key, { ok: joinOk, results, failed })
    }
    this.scheduleTick()
    return { ok: true, joinOk, results }
  }

  checkBudget(runId) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    const startedAt = item.startedAt || item.enqueuedAt || this.now()
    const elapsed = this.now() - startedAt
    if (elapsed > (item.budget?.maxWallMs ?? this.budget.maxWallMs)) {
      return { ok: false, code: 'budget_exceeded', message: 'wall-clock 预算耗尽' }
    }
    return { ok: true, elapsedMs: elapsed }
  }

  onTerminal(runId, result = {}) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    const status = String(result.status || result.terminal || 'done').toLowerCase()
    item.status = ['completed', 'done'].includes(status) ? 'done' : status
    item.endedAt = this.now()
    item.terminalResult = result
    this._decParentRunning(item.parentRunId)
    this._removeFromQueues(runId)

    if (item.parentRunId) {
      this.onChildTerminal(item.parentRunId, runId, result)
    }
    this.scheduleTick()
    return { ok: true, item }
  }

  cancel(runId) {
    const item = this.items.get(String(runId))
    if (!item) return { ok: false, code: 'not_found' }
    item.status = 'cancelled'
    item.endedAt = this.now()
    this._decParentRunning(item.parentRunId)
    this._removeFromQueues(runId)

    const children = this.childrenByParent.get(String(runId)) || []
    const cancelled = []
    for (const childId of children) {
      const child = this.items.get(childId)
      if (child && !['done', 'error', 'cancelled', 'failed'].includes(child.status)) {
        const res = this.cancel(childId)
        if (res.ok) cancelled.push(childId)
      }
    }
    this.scheduleTick()
    return { ok: true, runId: String(runId), cancelledChildren: cancelled }
  }

  scheduleTick() {
    if (this._tickScheduled) return
    this._tickScheduled = true
    setImmediate(() => {
      this._tickScheduled = false
      this.tick().catch(() => {})
    })
  }

  async tick() {
    const launched = []
    while (true) {
      const next = this.dequeueReady()
      if (!next) break
      const budget = this.checkBudget(next.runId)
      if (!budget.ok) {
        this.onTerminal(next.runId, { status: 'error', code: budget.code })
        continue
      }
      this.markRunning(next.runId)
      launched.push(next)
      if (this.onLaunch) {
        try {
          await this.onLaunch(next)
        } catch (err) {
          this.scheduleRetry(next.runId, { code: 'tool_unavailable', message: String(err?.message || err) })
        }
      }
      if (this.maxParallel <= 1) break
    }
    return { launched: launched.map((i) => i.runId) }
  }

  getState() {
    return {
      queues: { ...this.queues },
      runningByParent: Object.fromEntries(this.runningByParent),
      items: Object.fromEntries(this.items),
      joinWaits: [...this.joinWaits.entries()].map(([k, v]) => ({
        parentRunId: k,
        childRunIds: v.childRunIds,
        joinStrategy: v.joinStrategy,
        resolvedCount: v.resolved.size,
      })),
    }
  }
}

module.exports = {
  AgentRunScheduler,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_CHILDREN,
  DEFAULT_MAX_ATTEMPTS,
  RETRIABLE_CODES,
  NON_RETRIABLE_CODES,
  QUEUES,
  sleepMs,
}
