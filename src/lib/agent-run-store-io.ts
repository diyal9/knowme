'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { redactSensitiveFields } = require('./tool-contract-registry')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')

const STORE_VERSION = 1
const EVENT_LOG = 'events.jsonl'
const STATE_FILE = 'state.json'
const DEFAULT_TERMINAL_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_MAX_RUNS = 500
const DEFAULT_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_EVENT_LOG_BYTES = 50 * 1024 * 1024
const RENAME_DELAYS_MS = [50, 100, 200]

const SECRET_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential|bearer/i

const TERMINAL_STATUSES = new Set(['done', 'error', 'cancelled', 'completed', 'failed'])

function createRunId() {
  return `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createOperationKey(parts = {}) {
  const blob = JSON.stringify(parts)
  return crypto.createHash('sha256').update(blob).digest('hex').slice(0, 32)
}

function renameWithRetry(src, dest, fsImpl = fs, retries = 3) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      fsImpl.renameSync(src, dest)
      return { ok: true }
    } catch (err) {
      lastErr = err
      if (['EPERM', 'EACCES', 'EBUSY'].includes(err.code) && i < retries) {
        const start = Date.now()
        while (Date.now() - start < RENAME_DELAYS_MS[i]) { /* spin */ }
        continue
      }
      break
    }
  }
  try {
    fsImpl.copyFileSync(src, dest)
    fsImpl.unlinkSync(src)
    return { ok: true }
  } catch (copyErr) {
    return { ok: false, error: copyErr || lastErr }
  }
}

function atomicWriteJson(filePath, data, fsImpl = fs) {
  const dir = path.dirname(filePath)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fsImpl.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return renameWithRetry(tmp, filePath, fsImpl)
}

function scanForSecrets(obj, depth = 0) {
  if (depth > 8 || obj == null) return []
  const hits = []
  if (typeof obj === 'string') {
    if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(obj)) hits.push('bearer_token')
    return hits
  }
  if (Array.isArray(obj)) {
    for (const item of obj) hits.push(...scanForSecrets(item, depth + 1))
    return hits
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_KEY_PATTERN.test(k) && v != null && v !== '[REDACTED]') {
        hits.push(k)
      } else {
        hits.push(...scanForSecrets(v, depth + 1))
      }
    }
  }
  return hits
}

function sanitizePayload(payload, { strict = false } = {}) {
  const redacted = redactSensitiveFields(payload == null ? {} : payload)
  const secretHits = scanForSecrets(payload)
  if (strict && secretHits.length) {
    return {
      ok: false,
      code: 'persist_secret_blocked',
      message: '持久化 payload 含未脱敏敏感字段',
      redactedFields: secretHits,
    }
  }
  return {
    ok: true,
    payload: redacted,
    redactedFields: secretHits.length ? secretHits : undefined,
  }
}

function hashRecord(prevHash, body) {
  const canonical = JSON.stringify(body)
  return crypto.createHash('sha256').update(`${prevHash}|${canonical}`).digest('hex')
}

function readJsonFile(filePath, fsImpl = fs) {
  try {
    return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

module.exports = {
  createRunId,
  createOperationKey,
  renameWithRetry,
  atomicWriteJson,
  scanForSecrets,
  sanitizePayload,
  hashRecord,
  readJsonFile,
}
