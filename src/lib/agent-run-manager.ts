/**
 * agent-run-manager — Agent Run 编排入口（组合根）。
 * 子模块：constants / transitions / lifecycle / children / recovery。
 * 不负责：具体状态机与 IPC 实现细节。
 */
'use strict'

const { createRunId } = require('./agent-run-store')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')
const {
  RUN_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  VALID_TRANSITIONS,
  CANCEL_BUDGET_MS,
  defaultIdGen,
} = require('./agent-run-manager/constants')
const t = require('./agent-run-manager/transitions')
const lifecycle = require('./agent-run-manager/lifecycle')
const children = require('./agent-run-manager/children')
const recovery = require('./agent-run-manager/recovery')

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
      this.messageBus.subscribeGlobal((msg) => t.onBusMessage(this, msg))
    }
    if (this.scheduler && !opts.scheduler?.onLaunch) {
      this.scheduler.onLaunch = (item) => lifecycle.launchFromScheduler(this, item)
    }
  }

  onEvent(listener) {
    this._eventListeners.add(listener)
    return () => this._eventListeners.delete(listener)
  }

  _transition(run, nextStatus, patch) { return t.transitionRun(this, run, nextStatus, patch) }
  _baseRunRecord(spec) { return t.baseRunRecord(this, spec) }
  _persistRun(run, eventType, payload) { return t.persistRun(this, run, eventType, payload) }
  _broadcast(event) { return t.broadcast(this, event) }
  _emitTerminalOnce(run, terminalPayload) { return t.emitTerminalOnce(this, run, terminalPayload) }
  _checkIdempotency(idempotencyKey) { return t.checkIdempotency(this, idempotencyKey) }
  async _launchFromScheduler(item) { return lifecycle.launchFromScheduler(this, item) }
  _finalizeTerminal(runId, result) { return lifecycle.finalizeTerminal(this, runId, result) }
  _notifyWaiters(runId) { return lifecycle.notifyWaiters(this, runId) }
  async _cancelRunInternal(runId, reason) { return lifecycle.cancelRunInternal(this, runId, reason) }
  _onBusMessage(msg) { return t.onBusMessage(this, msg) }
  _activeRunCount() { return t.activeRunCount(this) }
  _waiterCount() { return t.waiterCount(this) }

  createRun(spec) { return lifecycle.createRun(this, spec) }
  adoptRunningRun(spec) { return lifecycle.adoptRunningRun(this, spec) }
  completeAdoptedRun(runId, result) { return lifecycle.completeAdoptedRun(this, runId, result) }
  async launchRun(runId) { return lifecycle.launchRun(this, runId) }
  createChildRun(parentRunId, spec) { return children.createChildRun(this, parentRunId, spec) }
  getRun(runId) { return lifecycle.getRun(this, runId) }
  getRunTree(rootRunId) { return lifecycle.getRunTree(this, rootRunId) }
  async cancelRun(runId, reason) { return lifecycle.cancelRun(this, runId, reason) }
  retryRun(runId, opts) { return lifecycle.retryRun(this, runId, opts) }
  resumeRun(runId, opts) { return recovery.resumeRun(this, runId, opts) }
  queryEvents(runId, opts) { return lifecycle.queryEvents(this, runId, opts) }
  attachSession(runId, sessionId) { return lifecycle.attachSession(this, runId, sessionId) }
  markWaiting(runId, reason) { return lifecycle.markWaiting(this, runId, reason) }
  saveCheckpoint(runId, checkpointId, data) { return lifecycle.saveCheckpoint(this, runId, checkpointId, data) }
  async createAndLaunchChild(spec) { return children.createAndLaunchChild(this, spec) }
  getRunStatus(runId) { return lifecycle.getRunStatus(this, runId) }
  awaitRun(runId, timeoutMs) { return children.awaitRun(this, runId, timeoutMs) }
  async cancelAllChildren(parentRunId, reason) { return children.cancelAllChildren(this, parentRunId, reason) }
  sendMessage(message) { return lifecycle.sendMessage(this, message) }
  loadFromStore(rootRunId) { return recovery.loadFromStore(this, rootRunId) }
  recoverAllFromStore() { return recovery.recoverAllFromStore(this) }
  getDiagnostics() { return lifecycle.getDiagnostics(this) }
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
