'use strict'

const PRESENCE_STORAGE_KEY = 'knowme.agent.presence.enabled.v1'
const IDLE_MIN_MS = 30 * 1000
const IDLE_MAX_MS = 90 * 1000
const ONCE_STATES = new Set(['calm-support', 'success', 'error'])
const STATES = new Set(['idle', 'idle-burst', 'typing', 'thinking', 'calm-support', 'success', 'error', 'disabled'])

function normalizeState(value) {
  const state = String(value || '').trim().toLowerCase()
  return STATES.has(state) ? state : 'idle'
}

function classifyInputState(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return 'idle'
  if (/(卡住|卡死|报错|报错了|失败|不工作|崩溃|着急|来不及|赶时间|很急|焦虑|烦死|救命|阻塞)/i.test(value)) {
    return 'calm-support'
  }
  return 'typing'
}

function nextIdleDelay(random = Math.random) {
  const sample = Number(random())
  const ratio = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5
  return Math.round(IDLE_MIN_MS + ratio * (IDLE_MAX_MS - IDLE_MIN_MS))
}

function readEnabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(PRESENCE_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writeEnabled(enabled, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PRESENCE_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // localStorage may be unavailable in private or test contexts.
  }
}

function createPresenceController({
  root,
  button,
  storage = globalThis.localStorage,
  random = Math.random,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  now = () => Date.now(),
  reducedMotion = () => {
    try {
      return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  },
} = {}) {
  let enabled = readEnabled(storage)
  let idleTimer = 0
  let onceTimer = 0
  let state = enabled ? 'idle' : 'disabled'

  const clearTimers = () => {
    if (idleTimer) clearTimeoutFn(idleTimer)
    if (onceTimer) clearTimeoutFn(onceTimer)
    idleTimer = 0
    onceTimer = 0
  }

  const canIdleAnimate = () => (
    enabled
    && !reducedMotion()
    && !globalThis.document?.hidden
    && !root?.classList.contains('open')
    && !root?.classList.contains('dragging')
  )

  const apply = next => {
    state = enabled ? normalizeState(next) : 'disabled'
    if (!root) return state
    root.dataset.presenceState = state
    root.classList.toggle('presence-disabled', !enabled)
    root.setAttribute('data-presence-enabled', enabled ? 'true' : 'false')
    if (button) {
      button.setAttribute('data-presence-state', state)
      button.setAttribute('aria-label', state === 'thinking' ? 'KnowMe 助理，正在处理' : 'KnowMe 助理')
    }
    return state
  }

  const scheduleIdle = () => {
    if (idleTimer) clearTimeoutFn(idleTimer)
    idleTimer = 0
    if (!canIdleAnimate()) return
    idleTimer = setTimeoutFn(() => {
      idleTimer = 0
      if (canIdleAnimate() && state === 'idle') {
        root?.classList.remove('presence-once')
        // Force a fresh animation cycle without changing layout.
        if (root) void root.offsetWidth
        root?.classList.add('presence-once')
        apply('idle-burst')
        onceTimer = setTimeoutFn(() => {
          root?.classList.remove('presence-once')
          apply('idle')
          onceTimer = 0
          scheduleIdle()
        }, 1200)
      } else {
        scheduleIdle()
      }
    }, nextIdleDelay(random))
  }

  const setState = next => {
    if (!enabled) return apply('disabled')
    const normalized = normalizeState(next)
    if (ONCE_STATES.has(normalized) && normalized === state) return state
    if (ONCE_STATES.has(normalized) && !reducedMotion()) {
      clearTimeoutFn(onceTimer)
      onceTimer = 0
      root?.classList.remove('presence-once')
      if (root) void root.offsetWidth
      root?.classList.add('presence-once')
      apply(normalized)
      onceTimer = setTimeoutFn(() => {
        root?.classList.remove('presence-once')
        apply('idle')
        onceTimer = 0
        scheduleIdle()
      }, 1200)
      return normalized
    }
    apply(normalized)
    scheduleIdle()
    return normalized
  }

  const setEnabled = value => {
    enabled = !!value
    writeEnabled(enabled, storage)
    clearTimers()
    apply(enabled ? 'idle' : 'disabled')
    if (enabled) scheduleIdle()
    return enabled
  }

  const controller = {
    get enabled() { return enabled },
    get state() { return state },
    setState,
    setEnabled,
    scheduleIdle,
    destroy() {
      clearTimers()
      root?.classList.remove('presence-once')
    },
    debug: {
      now,
      storageKey: PRESENCE_STORAGE_KEY,
    },
  }

  apply(state)
  scheduleIdle()
  return controller
}

// 作为经典脚本加载时与页面共享顶层词法作用域，名字必须唯一
const agentPresenceApi = {
  PRESENCE_STORAGE_KEY,
  IDLE_MIN_MS,
  IDLE_MAX_MS,
  STATES,
  normalizeState,
  classifyInputState,
  nextIdleDelay,
  readEnabled,
  writeEnabled,
  createPresenceController,
}

if (typeof window !== 'undefined') window.KnowMeAgentPresenceLib = agentPresenceApi
if (typeof module !== 'undefined') module.exports = agentPresenceApi
