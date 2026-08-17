'use strict'

/**
 * 工具契约审计落盘。红敏与 auditId 本地实现，避免与 governance 循环 require。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const REDACT_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential/i

function createAuditId() {
  return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

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

function readLastAuditHash(file) {
  try {
    if (!fs.existsSync(file)) return ''
    const content = fs.readFileSync(file, 'utf8').trim()
    if (!content) return ''
    const lastLine = content.split('\n').pop()
    const parsed = JSON.parse(lastLine)
    return String(parsed.recordHash || '')
  } catch {
    return ''
  }
}

let lastAuditWriteError = null

function getLastAuditWriteError() {
  return lastAuditWriteError
}

function appendAuditLog(userData, entry = {}) {
  if (!userData) return { ok: false, code: 'no_user_data' }
  const dir = path.join(String(userData), 'audit')
  const file = path.join(dir, 'tool-audit.jsonl')
  try {
    fs.mkdirSync(dir, { recursive: true })
    const prevHash = readLastAuditHash(file)
    const body = redactSensitiveFields({
      auditId: entry.auditId || createAuditId(),
      toolName: entry.toolName || '',
      runId: entry.runId || '',
      parentRunId: entry.parentRunId || '',
      subRunId: entry.subRunId || '',
      sessionId: entry.sessionId || '',
      approverId: entry.approverId || '',
      draftId: entry.draftId || '',
      timestamp: entry.timestamp || new Date().toISOString(),
      outcome: entry.outcome || 'unknown',
      target: String(entry.target || '').slice(0, 500),
      idempotencyKey: entry.idempotencyKey || null,
      prevHash,
    })
    const canonical = JSON.stringify(body)
    const recordHash = crypto.createHash('sha256').update(`${prevHash}|${canonical}`).digest('hex')
    const line = JSON.stringify({ ...body, recordHash })
    fs.appendFileSync(file, `${line}\n`, 'utf8')
    lastAuditWriteError = null
    return { ok: true, auditId: body.auditId, recordHash }
  } catch (err) {
    lastAuditWriteError = String(err?.message || err)
    console.error('[tool-audit] append failed:', lastAuditWriteError)
    return { ok: false, code: 'audit_write_failed', message: lastAuditWriteError }
  }
}

function resolveAuditOutcome(envelope, contract = {}) {
  if (!envelope.ok) return envelope.code === 'timeout' ? 'timeout' : 'failed'
  if (envelope.requiresApproval || contract.requiresApproval) return 'pending_review'
  if (contract.sideEffects) return 'executed'
  return 'executed'
}

function recordIdempotencyReceipt(ctx = {}, payload = {}) {
  // 延迟取 governance，避免 audit ↔ governance 顶层环
  const { getRunRuntimeContext } = require('./tool-contract-governance')
  const runtimeCtx = ctx.runId ? getRunRuntimeContext(ctx.runId) : null
  const hook = ctx.recordReceipt || runtimeCtx?.recordReceipt
  if (typeof hook !== 'function') return null
  try {
    return hook(payload)
  } catch {
    return null
  }
}

module.exports = {
  readLastAuditHash,
  getLastAuditWriteError,
  appendAuditLog,
  resolveAuditOutcome,
  recordIdempotencyReceipt,
}
