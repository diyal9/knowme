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

class AgentRunStore {
  /**
   * @param {object} opts
   * @param {string} opts.rootDir - injected persistence root (e.g. agent-runs/)
   * @param {object} [opts.fs]
   * @param {object} [opts.path]
   * @param {boolean} [opts.strictSecrets]
   * @param {number} [opts.terminalTtlMs]
   * @param {number} [opts.maxRuns]
   * @param {number} [opts.receiptTtlMs]
   */
  constructor(opts = {}) {
    if (!opts.rootDir) throw new Error('AgentRunStore requires rootDir')
    this.rootDir = String(opts.rootDir)
    this.fs = opts.fs || fs
    this.path = opts.path || path
    this.strictSecrets = Boolean(opts.strictSecrets)
    this.terminalTtlMs = Number.isFinite(opts.terminalTtlMs) ? opts.terminalTtlMs : DEFAULT_TERMINAL_TTL_MS
    this.maxRuns = Number.isFinite(opts.maxRuns) ? opts.maxRuns : DEFAULT_MAX_RUNS
    this.receiptTtlMs = Number.isFinite(opts.receiptTtlMs) ? opts.receiptTtlMs : DEFAULT_RECEIPT_TTL_MS
    this.metrics = opts.metrics || createAgentRuntimeMetrics()
    this._seqCache = new Map()
    this._lastHashCache = new Map()
  }

  runDir(runId) {
    return this.path.join(this.rootDir, String(runId))
  }

  eventsPath(runId) {
    return this.path.join(this.runDir(runId), EVENT_LOG)
  }

  statePath(runId) {
    return this.path.join(this.runDir(runId), STATE_FILE)
  }

  checkpointPath(runId, checkpointId) {
    return this.path.join(this.runDir(runId), 'checkpoints', `${checkpointId}.json`)
  }

  receiptPath(runId, operationKey) {
    const safe = String(operationKey).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
    return this.path.join(this.runDir(runId), 'receipts', `${safe}.json`)
  }

  rootIndexPath(rootRunId) {
    return this.path.join(this.rootDir, 'index', 'by-root', `${rootRunId}.json`)
  }

  ensureRunDir(runId) {
    const dir = this.runDir(runId)
    this.fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  readLastEventHash(runId) {
    const cached = this._lastHashCache.get(runId)
    if (cached != null) return cached
    const inspected = this.inspectEventLog(runId, { tolerateTruncatedTail: true })
    if (!inspected.ok) return ''
    const hash = String(inspected.events.at(-1)?.recordHash || '')
    this._lastHashCache.set(runId, hash)
    return hash
  }

  readMaxSeq(runId) {
    const cached = this._seqCache.get(runId)
    if (Number.isFinite(cached)) return cached
    const inspected = this.inspectEventLog(runId, { tolerateTruncatedTail: true })
    if (!inspected.ok) return 0
    const max = inspected.lastGoodSeq
    this._seqCache.set(runId, max)
    return max
  }

  inspectEventLog(runId, opts = {}) {
    const file = this.eventsPath(runId)
    if (!this.fs.existsSync(file)) {
      return { ok: true, events: [], lastGoodSeq: 0, tailTruncated: false }
    }

    let content
    try {
      content = this.fs.readFileSync(file, 'utf8')
    } catch (err) {
      this.metrics.increment('run_store_rejections_total', 1, { code: 'event_log_read_failed' })
      return {
        ok: false,
        code: 'event_log_read_failed',
        message: String(err?.message || err),
        events: [],
        lastGoodSeq: 0,
      }
    }

    const physicalLines = content.split('\n')
    const nonEmpty = physicalLines
      .map((line, index) => ({ line, index }))
      .filter(item => item.line.trim())
    const lastNonEmptyIndex = nonEmpty.at(-1)?.index ?? -1
    const events = []
    let expectedSeq = 1
    let previousHash = ''
    let tailTruncated = false

    for (const item of nonEmpty) {
      let event
      try {
        event = JSON.parse(item.line)
      } catch {
        const isTruncatedTail = opts.tolerateTruncatedTail !== false
          && item.index === lastNonEmptyIndex
        if (isTruncatedTail) {
          tailTruncated = true
          this.metrics.increment('run_store_truncated_tail_total')
          break
        }
        this.metrics.increment('run_store_rejections_total', 1, { code: 'event_log_corrupt' })
        return {
          ok: false,
          code: 'event_log_corrupt',
          message: `Event log 第 ${item.index + 1} 行不是有效 JSON`,
          events,
          lastGoodSeq: expectedSeq - 1,
          corruptLine: item.index + 1,
        }
      }

      const seq = Number(event.seq)
      if (seq !== expectedSeq) {
        this.metrics.increment('run_store_rejections_total', 1, { code: 'event_seq_corrupt' })
        return {
          ok: false,
          code: 'event_seq_corrupt',
          message: `Event log seq 不连续：期望 ${expectedSeq}，收到 ${event.seq}`,
          events,
          lastGoodSeq: expectedSeq - 1,
          corruptLine: item.index + 1,
        }
      }

      if (!event.recordHash || event.prevHash == null) {
        if (opts.allowLegacyUnchained === true) {
          events.push(event)
          expectedSeq += 1
          previousHash = String(event.recordHash || '')
          continue
        }
        this.metrics.increment('run_store_rejections_total', 1, { code: 'event_hash_missing' })
        return {
          ok: false,
          code: 'event_hash_missing',
          message: `Event log seq=${seq} 缺少 hash chain`,
          events,
          lastGoodSeq: expectedSeq - 1,
        }
      }

      if (String(event.prevHash) !== previousHash) {
        this.metrics.increment('run_store_rejections_total', 1, { code: 'event_hash_chain_mismatch' })
        return {
          ok: false,
          code: 'event_hash_chain_mismatch',
          message: `Event log seq=${seq} prevHash 不匹配`,
          events,
          lastGoodSeq: expectedSeq - 1,
        }
      }

      const { prevHash, recordHash, ...body } = event
      const expectedHash = hashRecord(previousHash, body)
      if (String(recordHash) !== expectedHash) {
        this.metrics.increment('run_store_rejections_total', 1, { code: 'event_hash_mismatch' })
        return {
          ok: false,
          code: 'event_hash_mismatch',
          message: `Event log seq=${seq} recordHash 不匹配`,
          events,
          lastGoodSeq: expectedSeq - 1,
        }
      }

      events.push(event)
      previousHash = String(recordHash)
      expectedSeq += 1
    }

    return {
      ok: true,
      events,
      lastGoodSeq: expectedSeq - 1,
      lastHash: previousHash,
      tailTruncated,
    }
  }

  readEvents(runId, opts = {}) {
    const inspected = this.inspectEventLog(runId, {
      tolerateTruncatedTail: opts.tolerantTail !== false,
      allowLegacyUnchained: opts.allowLegacyUnchained === true,
    })
    if (!inspected.ok) {
      const error = new Error(inspected.message || inspected.code)
      error.code = inspected.code
      error.integrity = inspected
      throw error
    }
    return inspected.events
  }

  replay(runId, opts = {}) {
    const inspected = this.inspectEventLog(runId, {
      tolerateTruncatedTail: opts.tolerantTail !== false,
      allowLegacyUnchained: opts.allowLegacyUnchained === true,
    })
    if (!inspected.ok) {
      return {
        ...inspected,
        state: null,
        eventCount: inspected.events?.length || 0,
      }
    }
    const events = inspected.events
    let state = readJsonFile(this.statePath(runId), this.fs)
    const fromSeq = Number(opts.fromSeq) || 0
    let lastGoodSeq = state?.lastSeq || 0
    const applied = []

    for (const event of events) {
      const seq = Number(event.seq)
      if (!Number.isFinite(seq) || seq <= fromSeq || seq <= lastGoodSeq) continue
      if (lastGoodSeq && seq !== lastGoodSeq + 1) {
        if (opts.strictSeq) break
      }
      if (typeof opts.onEvent === 'function') {
        state = opts.onEvent(state, event) || state
      } else if (event.type === 'run.state' && event.payload?.state) {
        state = { ...event.payload.state, lastSeq: seq }
      } else if (state) {
        state = { ...state, lastSeq: seq }
      } else {
        state = { runId, lastSeq: seq }
      }
      lastGoodSeq = seq
      applied.push(event)
    }

    if (state && state.lastSeq !== lastGoodSeq) {
      state.lastSeq = lastGoodSeq
    }

    return {
      ok: true,
      state,
      events,
      appliedEvents: applied,
      lastSeq: lastGoodSeq,
      eventCount: events.length,
      tailTruncated: inspected.tailTruncated,
    }
  }

  appendEvent(runId, event = {}) {
    const type = String(event.type || '')
    if (!type) return { ok: false, code: 'missing_event_type', message: '事件缺少 type' }

    this.ensureRunDir(runId)
    const existing = this.inspectEventLog(runId, { tolerateTruncatedTail: true })
    if (!existing.ok) return existing
    if (existing.tailTruncated) {
      return {
        ok: false,
        code: 'event_log_tail_truncated',
        message: 'Event log 尾部截断，须恢复/修复后才能继续追加',
      }
    }
    const expectedSeq = (this.readMaxSeq(runId) || 0) + 1
    const seq = Number.isFinite(event.seq) ? Number(event.seq) : expectedSeq
    if (seq !== expectedSeq) {
      return {
        ok: false,
        code: 'seq_mismatch',
        message: `期望 seq=${expectedSeq}，收到 seq=${seq}`,
        expectedSeq,
        receivedSeq: seq,
      }
    }

    const sanitized = sanitizePayload(event.payload, { strict: this.strictSecrets })
    if (!sanitized.ok) return sanitized

    const prevHash = this.readLastEventHash(runId)
    const ts = event.ts || new Date().toISOString()
    const body = {
      v: STORE_VERSION,
      seq,
      ts,
      type,
      runId: String(runId),
      parentRunId: event.parentRunId ? String(event.parentRunId) : null,
      rootRunId: event.rootRunId ? String(event.rootRunId) : String(runId),
      payload: sanitized.payload,
    }
    if (sanitized.redactedFields?.length) {
      body.redactedFields = sanitized.redactedFields
    }
    const recordHash = hashRecord(prevHash, body)
    const record = { ...body, prevHash, recordHash }

    const line = `${JSON.stringify(record)}\n`
    const file = this.eventsPath(runId)
    try {
      const stat = this.fs.existsSync(file) ? this.fs.statSync(file) : null
      if (stat && stat.size + line.length > MAX_EVENT_LOG_BYTES) {
        return { ok: false, code: 'log_truncated_cap', message: 'Event log 已达上限' }
      }
      this.fs.appendFileSync(file, line, 'utf8')
    } catch (err) {
      return { ok: false, code: 'append_failed', message: String(err?.message || err) }
    }

    this._seqCache.set(runId, seq)
    this._lastHashCache.set(runId, recordHash)
    return { ok: true, seq, recordHash, record }
  }

  readState(runId) {
    const stateFile = this.statePath(runId)
    const state = readJsonFile(this.statePath(runId), this.fs)
    if (!state) {
      return this.fs.existsSync(stateFile)
        ? { ok: false, code: 'state_corrupt', message: 'Run 状态 JSON 损坏' }
        : { ok: false, code: 'not_found', message: 'Run 状态不存在或已清理' }
    }
    const inspected = this.inspectEventLog(runId, { tolerateTruncatedTail: true })
    if (!inspected.ok) return inspected
    const replaySeq = inspected.lastGoodSeq
    if (Number.isFinite(state.lastSeq) && replaySeq && state.lastSeq > replaySeq) {
      return { ok: false, code: 'state_corrupt', message: 'state lastSeq 与事件日志不一致' }
    }
    return { ok: true, state, tailTruncated: inspected.tailTruncated }
  }

  writeState(runId, state = {}) {
    this.ensureRunDir(runId)
    const payload = {
      v: STORE_VERSION,
      ...state,
      runId: String(runId),
      lastSeq: Number.isFinite(state.lastSeq) ? state.lastSeq : (Number(state.seq) || 0),
      updatedAt: new Date().toISOString(),
    }
    const sanitized = sanitizePayload(payload, { strict: this.strictSecrets })
    if (!sanitized.ok) return sanitized

    const renamed = atomicWriteJson(this.statePath(runId), sanitized.payload, this.fs)
    if (!renamed.ok) {
      return { ok: false, code: 'state_write_failed', message: String(renamed.error?.message || renamed.error) }
    }

    const snapshotHash = crypto.createHash('sha256').update(JSON.stringify(sanitized.payload)).digest('hex')
    return { ok: true, snapshotHash, state: sanitized.payload }
  }

  saveCheckpoint(runId, checkpointId, data = {}) {
    const lastSeq = this.readMaxSeq(runId)
    if (Number.isFinite(data.lastSeq) && data.lastSeq > lastSeq) {
      return { ok: false, code: 'checkpoint_stale', message: 'checkpoint lastSeq 大于事件日志' }
    }
    const checkpointPayload = {
      referenceState: data.referenceState || null,
      evidenceLedger: data.evidenceLedger || null,
      toolLedger: data.toolLedger || null,
      runtime: data.runtime || null,
      sessionId: data.sessionId || null,
      phase: data.phase || null,
      metadata: data.metadata || null,
    }
    const sanitized = sanitizePayload(checkpointPayload, { strict: false })
    const checkpoint = {
      v: STORE_VERSION,
      checkpointId: String(checkpointId),
      runId: String(runId),
      lastSeq: Number.isFinite(data.lastSeq) ? data.lastSeq : lastSeq,
      pendingNodes: Array.isArray(data.pendingNodes) ? data.pendingNodes : [],
      completedNodes: Array.isArray(data.completedNodes) ? data.completedNodes : [],
      idemReceipts: Array.isArray(data.idemReceipts) ? data.idemReceipts : [],
      joinState: data.joinState || null,
      data: sanitized.payload,
      redactedFields: sanitized.redactedFields || [],
      createdAt: new Date().toISOString(),
    }
    const renamed = atomicWriteJson(this.checkpointPath(runId, checkpointId), checkpoint, this.fs)
    if (!renamed.ok) {
      return { ok: false, code: 'checkpoint_write_failed', message: String(renamed.error?.message || renamed.error) }
    }
    return { ok: true, checkpoint }
  }

  loadCheckpoint(runId, checkpointId) {
    const checkpoint = readJsonFile(this.checkpointPath(runId, checkpointId), this.fs)
    if (!checkpoint) {
      return { ok: false, code: 'not_found', message: 'checkpoint 不存在' }
    }
    const lastSeq = this.readMaxSeq(runId)
    if (Number.isFinite(checkpoint.lastSeq) && checkpoint.lastSeq > lastSeq) {
      return { ok: false, code: 'checkpoint_stale', message: 'checkpoint 与 Event Log 不一致' }
    }
    return { ok: true, checkpoint }
  }

  readReceipt(runId, operationKey) {
    const receipt = readJsonFile(this.receiptPath(runId, operationKey), this.fs)
    if (!receipt) return { ok: false, code: 'not_found' }
    if (receipt.expiresAt && Date.now() > Date.parse(receipt.expiresAt)) {
      return { ok: false, code: 'expired' }
    }
    return { ok: true, receipt }
  }

  writeReceipt(runId, operationKey, receipt = {}) {
    const existing = readJsonFile(this.receiptPath(runId, operationKey), this.fs)
    if (existing && !receipt.force) {
      return { ok: true, duplicate: true, receipt: existing }
    }
    if (existing && receipt.expectedResultHash && existing.resultHash !== receipt.expectedResultHash) {
      return { ok: false, code: 'receipt_conflict', message: 'receipt CAS 冲突' }
    }

    const body = {
      v: STORE_VERSION,
      operationKey: String(operationKey),
      runId: String(runId),
      timestamp: receipt.timestamp || new Date().toISOString(),
      resultHash: receipt.resultHash || hashRecord('', receipt.result || {}),
      result: redactSensitiveFields(receipt.result || {}),
      expiresAt: receipt.expiresAt || new Date(Date.now() + this.receiptTtlMs).toISOString(),
    }
    const renamed = atomicWriteJson(this.receiptPath(runId, operationKey), body, this.fs)
    if (!renamed.ok) {
      return { ok: false, code: 'receipt_write_failed', message: String(renamed.error?.message || renamed.error) }
    }
    return { ok: true, receipt: body }
  }

  getOrCreateReceipt(runId, operationKey, factory) {
    const hit = this.readReceipt(runId, operationKey)
    if (hit.ok) return { ok: true, duplicate: true, receipt: hit.receipt }
    const created = typeof factory === 'function' ? factory() : {}
    return this.writeReceipt(runId, operationKey, created)
  }

  updateTreeIndex(rootRunId, node = {}) {
    const file = this.rootIndexPath(rootRunId)
    const current = readJsonFile(file, this.fs) || {
      v: STORE_VERSION,
      rootRunId: String(rootRunId),
      nodes: {},
      updatedAt: null,
    }
    const runId = String(node.runId || '')
    if (!runId) return { ok: false, code: 'missing_run_id' }

    current.nodes[runId] = {
      runId,
      parentRunId: node.parentRunId ? String(node.parentRunId) : null,
      rootRunId: String(rootRunId),
      status: node.status || 'created',
      depth: Number.isFinite(node.depth) ? node.depth : 0,
      terminal: Boolean(node.terminal),
      updatedAt: new Date().toISOString(),
    }
    current.updatedAt = new Date().toISOString()

    const renamed = atomicWriteJson(file, current, this.fs)
    if (!renamed.ok) {
      return { ok: false, code: 'index_write_failed', message: String(renamed.error?.message || renamed.error) }
    }
    return { ok: true, index: current }
  }

  getRunTree(rootRunId) {
    const file = this.rootIndexPath(rootRunId)
    const index = readJsonFile(file, this.fs)
    if (!index?.nodes) {
      return { ok: false, code: 'not_found', message: 'Run 树不存在或已清理' }
    }
    const nodes = Object.values(index.nodes)
    const byId = new Map(nodes.map((n) => [n.runId, { ...n, children: [] }]))
    let root = null
    for (const node of byId.values()) {
      if (node.runId === String(rootRunId)) root = node
      if (node.parentRunId && byId.has(node.parentRunId)) {
        byId.get(node.parentRunId).children.push(node.runId)
      }
    }
    return { ok: true, rootRunId: String(rootRunId), root, nodes: Object.fromEntries(byId) }
  }

  listRootRunIds() {
    const dir = this.path.join(this.rootDir, 'index', 'by-root')
    if (!this.fs.existsSync(dir)) return []
    try {
      return this.fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => entry.name.slice(0, -5))
        .filter(Boolean)
        .sort()
    } catch {
      return []
    }
  }

  queryRun(runId) {
    const stateResult = this.readState(runId)
    if (!stateResult.ok) {
      const replay = this.replay(runId)
      if (replay.state) {
        return { ok: true, state: replay.state, source: 'replay' }
      }
      return stateResult
    }
    return { ok: true, state: stateResult.state, source: 'state' }
  }

  evictTerminalRuns(now = Date.now()) {
    if (!this.fs.existsSync(this.rootDir)) return { evicted: [] }
    const entries = this.fs.readdirSync(this.rootDir, { withFileTypes: true })
    const evicted = []
    const candidates = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const runId = entry.name
      if (runId === 'index') continue
      const stateResult = this.readState(runId)
      const state = stateResult.ok ? stateResult.state : null
      const active = state && !TERMINAL_STATUSES.has(String(state.status || '').toLowerCase())
      if (active) continue
      const endedAt = Date.parse(state?.endedAt || state?.updatedAt || 0) || 0
      candidates.push({ runId, endedAt, pinned: Boolean(state?.pinned) })
    }

    candidates.sort((a, b) => a.endedAt - b.endedAt)
    const overCapacity = candidates.length > this.maxRuns
    for (const item of candidates) {
      const age = now - (item.endedAt || 0)
      const ttlExpired = item.endedAt > 0 && age > this.terminalTtlMs
      if (!item.pinned && (ttlExpired || overCapacity)) {
        try {
          this.fs.rmSync(this.runDir(item.runId), { recursive: true, force: true })
          evicted.push(item.runId)
          this._seqCache.delete(item.runId)
          this._lastHashCache.delete(item.runId)
        } catch { /* skip */ }
      }
    }
    return { evicted, count: evicted.length }
  }
}

module.exports = {
  AgentRunStore,
  STORE_VERSION,
  EVENT_LOG,
  STATE_FILE,
  DEFAULT_TERMINAL_TTL_MS,
  DEFAULT_MAX_RUNS,
  createRunId,
  createOperationKey,
  sanitizePayload,
  renameWithRetry,
  atomicWriteJson,
}
