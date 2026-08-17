'use strict'

const crypto = require('crypto')
const {
  stableHash,
  cloneSafe,
  resolveLane,
  validateEvent,
  createRunEmitter,
  mapLegacyType,
  mapLegacyPayload,
  mapLegacyEvent,
  isSubRunEventType,
  isSubRunTerminalType,
  normalizeSubRunTerminal,
  REDACT_KEY_PATTERN,
} = require('./agent-output-protocol-core')

function redactSensitiveValue(key, value) {
  if (REDACT_KEY_PATTERN.test(String(key || ''))) return '[REDACTED]'
  if (typeof value === 'string') {
    if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value)) return '[REDACTED]'
    if (/^t-[A-Za-z0-9]{10,}/.test(value)) return '[REDACTED]'
  }
  return value
}

function redactSensitiveFields(obj, depth = 0) {
  if (depth > 6 || obj == null) return obj
  if (Array.isArray(obj)) return obj.map((v) => redactSensitiveFields(v, depth + 1))
  if (typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]'
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitiveFields(v, depth + 1)
    } else {
      out[k] = redactSensitiveValue(k, v)
    }
  }
  return out
}

function stopReasonLabel(stopReason, code) {
  const key = String(stopReason || code || '').toLowerCase()
  const labels = {
    cancelled: '已取消',
    canceled: '已取消',
    error: '执行失败',
    failed: '执行失败',
    completed: '已完成',
    protocol_unsupported: '协议不兼容',
    scope_denied: '权限不足',
    timeout: '执行超时',
    interrupted: '执行中断，可恢复',
    recovering: '等待恢复',
  }
  return labels[key] || (key ? key : '已终止')
}

function builderLabel(builderId) {
  const id = String(builderId || '').toLowerCase()
  const labels = {
    'knowme-local': '本地',
    'local-executor': '本地',
    local: '本地',
    cursor: 'Cursor',
    'cursor-package': 'Cursor',
    claude: 'Claude',
    'claude-package': 'Claude',
    'daemon-agent': '管线服务',
    daemon: '管线服务',
    remote: '远程',
  }
  return labels[id] || (builderId ? String(builderId) : '本地')
}

function guidanceByStopReason(stopReason, code) {
  const key = String(stopReason || code || '').toLowerCase()
  if (key === 'timeout' || key === 'remote_timeout') {
    return {
      failureCategory: 'timeout',
      recommendedAction: 'retry',
      alternativeActions: ['switch_to_local', 'reduce_scope'],
      estimatedWait: '10-30s',
    }
  }
  if (key === 'scope_denied' || key === 'permission_denied') {
    return {
      failureCategory: 'permission',
      recommendedAction: 'open_permission_settings',
      alternativeActions: ['retry_after_approval'],
      estimatedWait: '1-3m',
    }
  }
  if (key === 'protocol_unsupported' || key === 'version_mismatch') {
    return {
      failureCategory: 'protocol',
      recommendedAction: 'switch_backend',
      alternativeActions: ['update_package', 'retry'],
      estimatedWait: '1-2m',
    }
  }
  if (key === 'evidence_blocked' || key === 'grounding_blocked') {
    return {
      failureCategory: 'evidence',
      recommendedAction: 'provide_more_context',
      alternativeActions: ['retry'],
      estimatedWait: '30-90s',
    }
  }
  if (key === 'cancelled' || key === 'canceled') {
    return {
      failureCategory: 'cancelled',
      recommendedAction: 'resume',
      alternativeActions: ['retry'],
      estimatedWait: '0-10s',
    }
  }
  return {
    failureCategory: 'unknown',
    recommendedAction: 'retry',
    alternativeActions: ['provide_more_context'],
    estimatedWait: '30-90s',
  }
}

function resolveBusType(envelope = {}) {
  return String(envelope.kind || envelope.type || '')
}

function resolveBusVersion(envelope = {}) {
  const version = envelope.busVersion ?? envelope.version
  return version == null ? null : Number(version)
}

/**
 * Map agent-message-bus envelope to parent-run v2 output event (progress/ui lane only).
 * @param {object} bus
 * @param {{ runId: string, seq: number, messageId?: string, causationId?: string }} ctx
 */

module.exports = {
  redactSensitiveValue,
  redactSensitiveFields,
  stopReasonLabel,
  builderLabel,
  guidanceByStopReason,
  resolveBusType,
  resolveBusVersion,
}
