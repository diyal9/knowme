'use strict'

;(function initWorkbenchTaskLifecycle(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchTaskLifecycle = api
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function createWorkbenchTaskLifecycle() {
const SUCCESS_STATES = new Set(['finished', 'completed', 'done', 'success'])
const FAILURE_STATES = new Set(['failed', 'error', 'rejected'])
const CANCELLED_STATES = new Set(['cancelled', 'canceled'])
const RUN_WAITING_STATES = new Set([
  'waiting', 'blocked', 'gate', 'clarification', 'needs_input', 'needs-input', 'paused',
])
const RUN_ACTIVE_STATES = new Set([
  'queued', 'pending', 'running', 'started', 'preparing', 'created', 'starting', 'active',
])
const TERMINAL_DONE_STATES = new Set(['finished', 'completed', 'done', 'success'])
const TERMINAL_ANY_STATES = new Set([
  'finished', 'failed', 'cancelled', 'canceled', 'completed', 'done',
])

function normalizeState(value) {
  return String(value || '').trim().toLowerCase()
}

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

/**
 * Align with Daemon WebUI: pending clarify/gate ⇒ needs user, not done.
 */
function hasPendingHitl(source = {}) {
  const item = source && typeof source === 'object' ? source : {}
  if (item.waiting || item.gate || item.clarification) return true
  if (item.pendingGate || item.pendingClarification) return true
  if (asList(item.pending_gates).length || asList(item.pendingGates).length) return true
  if (asList(item.pending_clarifications).length || asList(item.pendingClarifications).length) {
    return true
  }
  return false
}

function pickRawRuntimeState(item = {}) {
  const status = item.status && typeof item.status === 'object' ? item.status : null
  const statusState = normalizeState(status && (status.state || status.status))
  const topState = normalizeState(item.state)
  const jobState = normalizeState(item.job && item.job.state)
  // WebUI / progress 以 status 为准；job.state 可能停在旧的 completed
  return statusState || topState || jobState || 'idle'
}

/**
 * @returns {{ state: string, hitl: boolean, terminal: boolean, kind: string }}
 */
function resolveDaemonRuntimeState(item = {}) {
  const hitl = hasPendingHitl(item)
  let state = pickRawRuntimeState(item)
  if (!state) state = 'idle'

  if (FAILURE_STATES.has(state)) {
    return { state, hitl, terminal: true, kind: 'failure' }
  }
  if (CANCELLED_STATES.has(state)) {
    return { state, hitl, terminal: true, kind: 'cancelled' }
  }
  if (hitl) {
    // idle / completed job leftovers with clarify → waiting (WebUI「待处理」)
    const waitState = RUN_WAITING_STATES.has(state) ? state : 'waiting'
    return { state: waitState, hitl: true, terminal: false, kind: 'waiting' }
  }
  if (TERMINAL_DONE_STATES.has(state)) {
    return { state, hitl: false, terminal: true, kind: 'success' }
  }
  if (TERMINAL_ANY_STATES.has(state)) {
    return { state, hitl: false, terminal: true, kind: FAILURE_STATES.has(state) ? 'failure' : 'cancelled' }
  }
  if (RUN_ACTIVE_STATES.has(state) || state === 'idle') {
    return { state: state === 'idle' ? 'idle' : state, hitl: false, terminal: false, kind: 'active' }
  }
  return { state, hitl: false, terminal: false, kind: 'unknown' }
}

function classifyTaskState(value, projection = {}) {
  const hitl = hasPendingHitl(projection)
    || hasPendingHitl({
      pending_gates: projection.pending_gates || projection.pendingGates,
      pending_clarifications: projection.pending_clarifications || projection.pendingClarifications,
      gate: projection.gate || projection.pendingGate,
      clarification: projection.clarification || projection.pendingClarification,
      waiting: projection.waiting,
    })
  const state = normalizeState(value) || 'idle'
  // HITL 优先于 success（对齐 WebUI；避免 job.completed 吞掉澄清）
  if (hitl && !FAILURE_STATES.has(state) && !CANCELLED_STATES.has(state)) return 'waiting'
  if (SUCCESS_STATES.has(state) && !hitl) return 'success'
  if (FAILURE_STATES.has(state)) return 'failure'
  if (CANCELLED_STATES.has(state)) return 'cancelled'
  if (projection.gate || projection.pendingGate || projection.clarification || projection.pendingClarification) {
    return 'waiting'
  }
  if (RUN_WAITING_STATES.has(state)) return 'waiting'
  if (RUN_ACTIVE_STATES.has(state) || state === 'idle') return 'active'
  return 'unknown'
}

function stateLabel(value, projection) {
  const kind = classifyTaskState(value, projection)
  if (kind === 'success') return '已完成'
  if (kind === 'failure') return '执行失败'
  if (kind === 'cancelled') return '已取消'
  if (kind === 'waiting') return '等待你的处理'
  if (kind === 'active') return '进行中'
  return '等待中'
}

function stateAction(value, projection) {
  const kind = classifyTaskState(value, projection)
  if (kind === 'success') return '查看结果'
  if (kind === 'failure') return '重新执行'
  if (kind === 'cancelled') return '重新启动'
  if (kind === 'waiting') return '处理下一步'
  if (kind === 'active') return '继续执行'
  return '查看详情'
}

function isTerminalKind(kind) {
  return kind === 'success' || kind === 'failure' || kind === 'cancelled'
}

function hitlKindFromProjection(projection = {}) {
  if (projection.clarification || asList(projection.pending_clarifications).length
    || asList(projection.pendingClarifications).length) {
    return 'clarification'
  }
  if (projection.gate || asList(projection.pending_gates).length
    || asList(projection.pendingGates).length) {
    return 'gate'
  }
  if (hasPendingHitl(projection)) return 'waiting'
  return 'none'
}

function resolveRunKind(input = {}) {
  const task = input.task && typeof input.task === 'object' ? input.task : null
  const rawStatus = normalizeState(input.rawStatus || input.status || input.terminalKind || '')
  const projection = {
    pending_gates: input.pendingGates || input.pending_gates,
    pending_clarifications: input.pendingClarifications || input.pending_clarifications,
    pendingGates: input.pendingGates || input.pending_gates,
    pendingClarifications: input.pendingClarifications || input.pending_clarifications,
    gate: input.gate,
    clarification: input.clarification,
    waiting: input.waiting,
    ...(task || {}),
  }

  if (task) {
    const resolved = resolveDaemonRuntimeState(task)
    if (resolved.kind === 'waiting') return 'waiting'
    if (resolved.kind === 'success') return 'success'
    if (resolved.kind === 'failure') return 'failure'
    if (resolved.kind === 'cancelled') return 'cancelled'
    if (resolved.kind === 'active') return 'active'
    return classifyTaskState(resolved.state, projection)
  }

  const terminalKind = normalizeState(input.terminalKind || '')
  if (terminalKind === 'success') return hasPendingHitl(projection) ? 'waiting' : 'success'
  if (terminalKind === 'failure') return 'failure'
  if (terminalKind === 'cancelled') return 'cancelled'
  return classifyTaskState(rawStatus || 'idle', projection)
}

/** L1 outcome pill copy (顶栏). */
function outcomeLabelFor(kind, hitlKind = 'none') {
  if (kind === 'waiting') return '等待你'
  if (kind === 'success') return '已完成'
  if (kind === 'failure') return '失败'
  if (kind === 'cancelled') return '已取消'
  if (kind === 'active') return '执行中'
  return '等待中'
}

/** Compact list / node meta copy. */
function compactLabelFor(kind, hitlKind = 'none', rawStatus = '') {
  const state = normalizeState(rawStatus)
  if (kind === 'waiting') {
    if (hitlKind === 'clarification') return '澄清'
    if (hitlKind === 'gate') return '待确认'
    return '待处理'
  }
  if (kind === 'success') return '已完成'
  if (kind === 'failure') return '执行失败'
  if (kind === 'cancelled') return '已取消'
  if (kind === 'active') {
    if (['queued', 'pending'].includes(state)) return '排队中'
    return '进行中'
  }
  if (state === 'pending') return '准备中'
  return '等待中'
}

function toneFor(kind) {
  if (kind === 'waiting') return 'waiting'
  if (kind === 'success') return 'done'
  if (kind === 'failure') return 'error'
  if (kind === 'cancelled') return 'muted'
  if (kind === 'active') return 'running'
  return 'muted'
}

function isRunCancellable(input = {}) {
  const kind = input.kind || resolveRunKind(input)
  if (isTerminalKind(kind)) return false
  if (kind === 'waiting' || kind === 'active') return true
  const state = normalizeState(input.rawStatus || input.status || '')
  return RUN_ACTIVE_STATES.has(state) || RUN_WAITING_STATES.has(state)
}

/**
 * Unified lifecycle projection for daemon + local-team/agent-graph.
 * @returns {{ kind: string, hitl: boolean, hitlKind: string, outcomeLabel: string, compactLabel: string, tone: string, cancellable: boolean, terminal: boolean }}
 */
function projectRunLifecycle(input = {}) {
  const rawStatus = normalizeState(input.rawStatus || input.status || '')
  const projection = {
    pending_gates: input.pendingGates || input.pending_gates,
    pending_clarifications: input.pendingClarifications || input.pending_clarifications,
    pendingGates: input.pendingGates || input.pending_gates,
    pendingClarifications: input.pendingClarifications || input.pending_clarifications,
    gate: input.gate,
    clarification: input.clarification,
    waiting: input.waiting,
    ...(input.task && typeof input.task === 'object' ? input.task : {}),
  }
  const kind = resolveRunKind(input)
  const hitl = kind === 'waiting' || hasPendingHitl(projection)
  const hitlKind = hitl ? hitlKindFromProjection(projection) : 'none'
  return {
    kind,
    hitl,
    hitlKind,
    outcomeLabel: outcomeLabelFor(kind, hitlKind),
    compactLabel: compactLabelFor(kind, hitlKind, rawStatus),
    tone: toneFor(kind),
    cancellable: isRunCancellable({ ...input, kind, rawStatus }),
    terminal: isTerminalKind(kind),
  }
}

return {
  SUCCESS_STATES,
  FAILURE_STATES,
  CANCELLED_STATES,
  WAITING_STATES: RUN_WAITING_STATES,
  ACTIVE_STATES: RUN_ACTIVE_STATES,
  TERMINAL_DONE_STATES,
  normalizeState,
  hasPendingHitl,
  pickRawRuntimeState,
  resolveDaemonRuntimeState,
  classifyTaskState,
  stateLabel,
  stateAction,
  isTerminalKind,
  hitlKindFromProjection,
  resolveRunKind,
  outcomeLabelFor,
  compactLabelFor,
  toneFor,
  isRunCancellable,
  projectRunLifecycle,
}
})
