'use strict'

/**
 * launcher 切片共享常量与远程辅助函数。
 * remote / adapters / port 都从这里取，避免互相 require 空袋。
 */

const crypto = require('crypto')

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
  isTerminalStatus,
  handoffByteSize,
  validateHandoffPayload,
  isFakeSpawnResult,
  createMessageId,
  normalizeRemoteError,
  withRemoteTimeout,
}
