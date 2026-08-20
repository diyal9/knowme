'use strict'

/**
 * KnowMe 统一日志模块（主进程唯一落盘点）。
 *
 * 设计要点：
 * - 不依赖 electron，便于单测；主进程通过 init({ dir }) 注入日志目录。
 * - 落盘格式为 JSONL（每行一条 JSON），便于机器检索与二级窗口格式化展示。
 * - 分类（category）：operation / llm / system-prompt / mcp / api / system。
 * - 自动脱敏 apiKey / token / authorization 等敏感字段。
 * - 单文件超过阈值自动切分；按天保留，过期自动清理。
 * - init 之前的日志先进内存环形缓冲，init 后一次性回放落盘。
 */

const fs = require('fs')
const path = require('path')

const CATEGORIES = ['operation', 'llm', 'system-prompt', 'mcp', 'api', 'system']
const LEVELS = ['debug', 'info', 'warn', 'error']
const LEVEL_RANK = { debug: 10, info: 20, warn: 30, error: 40 }

const FILE_PREFIX = 'knowme-'
const FILE_EXT = '.jsonl'
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_RETENTION_DAYS = 7
const DEFAULT_MAX_FILES = 10
const DEFAULT_MAX_TOTAL_BYTES = 150 * 1024 * 1024

const SENSITIVE_KEY_RE = /^(api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|token|secret|password|cookie|bearer|client[_-]?secret|app[_-]?secret)$/i
const SENSITIVE_VALUE_RE = /(sk-[A-Za-z0-9]{6,})|(Bearer\s+[A-Za-z0-9._-]{6,})|([A-Za-z0-9._-]{24,})/g

let state = {
  dir: '',
  ready: false,
  minLevel: 'info',
  maxBytes: DEFAULT_MAX_BYTES,
  retentionDays: DEFAULT_RETENTION_DAYS,
  maxFiles: DEFAULT_MAX_FILES,
  maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
  totalBytes: 0,
  mirrorConsole: true,
  brokenPipes: { stdout: false, stderr: false },
}
const pending = []
const MAX_PENDING = 500

function normalizeCategory(category) {
  const c = String(category || '').trim().toLowerCase()
  return CATEGORIES.includes(c) ? c : 'operation'
}

function normalizeLevel(level) {
  const l = String(level || '').trim().toLowerCase()
  return LEVELS.includes(l) ? l : 'info'
}

function maskString(value) {
  const s = String(value)
  if (s.length <= 8) return s
  return s.slice(0, 3) + '***' + s.slice(-2)
}

/** 递归脱敏：敏感 key 直接打码，字符串里的疑似密钥做替换。 */
function redact(value, depth = 0) {
  if (value == null) return value
  if (depth > 6) return '[depth-limit]'
  if (typeof value === 'string') {
    return value.length > 4000
      ? value.slice(0, 4000).replace(SENSITIVE_VALUE_RE, m => maskString(m)) + '…[truncated]'
      : value.replace(SENSITIVE_VALUE_RE, m => maskString(m))
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 100).map(v => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = typeof v === 'string' ? maskString(v) : '***'
        continue
      }
      out[k] = redact(v, depth + 1)
    }
    return out
  }
  return String(value)
}

function dateStamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeStamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function currentFile(date = dateStamp()) {
  return path.join(state.dir, `${FILE_PREFIX}${date}${FILE_EXT}`)
}

function ensureDir() {
  if (!state.dir) return false
  try {
    if (!fs.existsSync(state.dir)) fs.mkdirSync(state.dir, { recursive: true })
    return true
  } catch {
    return false
  }
}

function nextRolledFile() {
  const base = `${FILE_PREFIX}${dateStamp()}-${timeStamp()}-${String(Date.now() % 1000).padStart(3, '0')}`
  let candidate = path.join(state.dir, `${base}${FILE_EXT}`)
  let suffix = 1
  while (fs.existsSync(candidate)) candidate = path.join(state.dir, `${base}-${suffix++}${FILE_EXT}`)
  return candidate
}

function rotateIfNeeded(file, incomingBytes = 0) {
  try {
    const stat = fs.statSync(file)
    if (stat.size + incomingBytes <= state.maxBytes) return false
    fs.renameSync(file, nextRolledFile())
    return true
  } catch { return false /* file may not exist yet */ }
}

function listLogFiles() {
  if (!state.dir) return
  let names
  try { names = fs.readdirSync(state.dir) } catch { return [] }
  const files = []
  for (const name of names) {
    if (!name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_EXT)) continue
    const full = path.join(state.dir, name)
    try {
      const stat = fs.statSync(full)
      if (stat.isFile()) files.push({ full, name, mtimeMs: stat.mtimeMs, size: stat.size })
    } catch { /* file disappeared while scanning */ }
  }
  return files
}

/** 启动时执行：按天数、文件数、总字节数三重约束清理，均保留最新文件。 */
function pruneOldFiles() {
  let files = listLogFiles()
  if (!files) return
  const cutoff = Date.now() - state.retentionDays * 86400 * 1000
  for (const file of files) {
    if (file.mtimeMs >= cutoff) continue
    try {
      fs.unlinkSync(file.full)
    } catch { /* ignore */ }
  }
  files = (listLogFiles() || []).sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
  let total = files.reduce((sum, file) => sum + file.size, 0)
  for (let i = files.length - 1; i >= 0; i -= 1) {
    const file = files[i]
    if (i < state.maxFiles && total <= state.maxTotalBytes) continue
    try {
      fs.unlinkSync(file.full)
      total -= file.size
    } catch { /* ignore */ }
  }
  state.totalBytes = total
}

function writeEntry(entry) {
  const file = currentFile()
  const line = JSON.stringify(entry) + '\n'
  const lineBytes = Buffer.byteLength(line, 'utf8')
  const rotated = rotateIfNeeded(file, lineBytes)
  fs.appendFileSync(file, line, 'utf8')
  state.totalBytes += lineBytes
  // 文件数只会在轮转时增长；总量则每次写入都必须执行硬限制。
  if (rotated || state.totalBytes > state.maxTotalBytes) pruneOldFiles()
}

function isBrokenPipe(error) {
  return error?.code === 'EPIPE' || /broken pipe/i.test(String(error?.message || error || ''))
}

function disableBrokenPipe(streamName) {
  if (streamName === 'stdout' || streamName === 'stderr') state.brokenPipes[streamName] = true
}

let pipeGuardsInstalled = false
function installPipeGuards() {
  if (pipeGuardsInstalled) return
  pipeGuardsInstalled = true
  for (const [name, stream] of [['stdout', process.stdout], ['stderr', process.stderr]]) {
    stream?.on?.('error', error => {
      if (isBrokenPipe(error)) disableBrokenPipe(name)
    })
  }
}

function mirror(entry) {
  if (!state.mirrorConsole) return
  const line = `${entry.ts} ${entry.level.toUpperCase()} ${entry.category}/${entry.event}` +
    (entry.runId ? ` [${entry.runId}]` : '') +
    (entry.msg ? ` ${entry.msg}` : '')
  const streamName = entry.level === 'error' || entry.level === 'warn' ? 'stderr' : 'stdout'
  if (state.brokenPipes[streamName]) return
  try {
    if (entry.level === 'error') console.error(line)
    else if (entry.level === 'warn') console.warn(line)
    else console.log(line)
  } catch (error) {
    if (isBrokenPipe(error)) disableBrokenPipe(streamName)
  }
}

/** 构造一条日志记录（已脱敏）。 */
function buildEntry(category, level, event, msg, meta, extra) {
  const entry = {
    ts: new Date().toISOString(),
    level: normalizeLevel(level),
    category: normalizeCategory(category),
    event: String(event || 'event').slice(0, 120),
    msg: msg == null ? '' : String(msg).slice(0, 2000),
  }
  if (extra && typeof extra === 'object') {
    if (extra.scope) entry.scope = String(extra.scope).slice(0, 60)
    if (extra.runId) entry.runId = String(extra.runId).slice(0, 80)
    if (extra.durationMs != null) entry.durationMs = Number(extra.durationMs) || 0
  }
  if (meta !== undefined) entry.meta = redact(meta)
  return entry
}

function emit(entry) {
  if (LEVEL_RANK[entry.level] < LEVEL_RANK[state.minLevel]) return
  mirror(entry)
  if (!state.ready || !state.dir) {
    pending.push(entry)
    if (pending.length > MAX_PENDING) pending.shift()
    return
  }
  try { writeEntry(entry) } catch { /* never throw from logging */ }
}

/** 初始化：注入落盘目录。可多次调用（覆盖配置）。 */
function init(opts = {}) {
  if (opts.dir) state.dir = String(opts.dir)
  if (opts.level) state.minLevel = normalizeLevel(opts.level)
  if (Number.isFinite(opts.maxBytes)) state.maxBytes = opts.maxBytes
  if (Number.isFinite(opts.retentionDays)) state.retentionDays = opts.retentionDays
  if (Number.isFinite(opts.maxFiles)) state.maxFiles = Math.max(1, opts.maxFiles)
  if (Number.isFinite(opts.maxTotalBytes)) state.maxTotalBytes = Math.max(state.maxBytes, opts.maxTotalBytes)
  if (opts.mirrorConsole != null) state.mirrorConsole = !!opts.mirrorConsole
  installPipeGuards()
  if (!ensureDir()) return false
  state.ready = true
  pruneOldFiles()
  const backlog = pending.splice(0, pending.length)
  for (const entry of backlog) {
    try { writeEntry(entry) } catch { /* ignore */ }
  }
  return true
}

function setLevel(level) { state.minLevel = normalizeLevel(level) }
function getLogDir() { return state.dir }

/** 通用写入。 */
function log(category, level, event, msg, meta, extra) {
  emit(buildEntry(category, level, event, msg, meta, extra))
}

// 分类便捷方法：(event, msg, meta, extra)
function operation(event, msg, meta, extra) { log('operation', (extra && extra.level) || 'info', event, msg, meta, extra) }
function llm(event, msg, meta, extra) { log('llm', (extra && extra.level) || 'info', event, msg, meta, extra) }
function systemPrompt(event, msg, meta, extra) { log('system-prompt', (extra && extra.level) || 'info', event, msg, meta, extra) }
function mcp(event, msg, meta, extra) { log('mcp', (extra && extra.level) || 'info', event, msg, meta, extra) }
function api(event, msg, meta, extra) { log('api', (extra && extra.level) || 'info', event, msg, meta, extra) }
function system(event, msg, meta, extra) { log('system', (extra && extra.level) || 'info', event, msg, meta, extra) }

// 级别便捷方法：(category, event, msg, meta, extra)
function info(category, event, msg, meta, extra) { log(category, 'info', event, msg, meta, extra) }
function warn(category, event, msg, meta, extra) { log(category, 'warn', event, msg, meta, extra) }
function error(category, event, msg, meta, extra) { log(category, 'error', event, msg, meta, extra) }
function debug(category, event, msg, meta, extra) { log(category, 'debug', event, msg, meta, extra) }

function listDatesForDir() {
  if (!state.dir) return []
  let files
  try { files = fs.readdirSync(state.dir) } catch { return [] }
  const dates = new Set()
  for (const name of files) {
    if (!name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_EXT)) continue
    const stripped = name.slice(FILE_PREFIX.length, -FILE_EXT.length)
    const m = stripped.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) dates.add(m[1])
  }
  return [...dates].sort().reverse()
}

function readFilesForDate(date) {
  if (!state.dir) return []
  let files
  try { files = fs.readdirSync(state.dir) } catch { return [] }
  return files
    .filter(n => n.startsWith(`${FILE_PREFIX}${date}`) && n.endsWith(FILE_EXT))
    .map(n => path.join(state.dir, n))
}

/**
 * 查询日志用于二级窗口展示。
 * @param {object} opts { date, category, level, search, limit, offset }
 * @returns {{ entries: object[], total: number, date: string, dates: string[] }}
 */
function query(opts = {}) {
  const dates = listDatesForDir()
  const date = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : (dates[0] || dateStamp())
  const category = opts.category && CATEGORIES.includes(opts.category) ? opts.category : ''
  const level = opts.level && LEVELS.includes(opts.level) ? opts.level : ''
  const search = String(opts.search || '').trim().toLowerCase()
  const limit = Math.min(2000, Math.max(1, Number(opts.limit) || 500))
  const offset = Math.max(0, Number(opts.offset) || 0)

  const entries = []
  for (const file of readFilesForDate(date)) {
    let text
    try { text = fs.readFileSync(file, 'utf8') } catch { continue }
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      let obj
      try { obj = JSON.parse(t) } catch { continue }
      entries.push(obj)
    }
  }
  entries.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
  const filtered = entries.filter(e => {
    if (category && e.category !== category) return false
    if (level && LEVEL_RANK[e.level] < LEVEL_RANK[level]) return false
    if (search) {
      const hay = `${e.event} ${e.msg} ${e.scope || ''} ${e.runId || ''} ${JSON.stringify(e.meta || '')}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
    date,
    dates,
    categories: CATEGORIES,
    levels: LEVELS,
  }
}

/** 统计各分类数量（用于面板角标）。 */
function counts(date) {
  const res = query({ date, limit: 2000 })
  const out = { total: res.total }
  for (const c of CATEGORIES) out[c] = 0
  for (const e of res.entries) {
    if (out[e.category] != null) out[e.category] += 1
  }
  return { date: res.date, dates: res.dates, counts: out }
}

function clear(date) {
  const files = date ? readFilesForDate(date) : (state.dir ? readFilesForDate('') : [])
  let removed = 0
  const targets = date
    ? files
    : (() => {
        try {
          return fs.readdirSync(state.dir)
            .filter(n => n.startsWith(FILE_PREFIX) && n.endsWith(FILE_EXT))
            .map(n => path.join(state.dir, n))
        } catch { return [] }
      })()
  for (const f of targets) {
    try { fs.unlinkSync(f); removed++ } catch { /* ignore */ }
  }
  return { ok: true, removed }
}

/** 测试辅助：重置内部状态。 */
function _reset() {
  state = {
    dir: '',
    ready: false,
    minLevel: 'info',
    maxBytes: DEFAULT_MAX_BYTES,
    retentionDays: DEFAULT_RETENTION_DAYS,
    maxFiles: DEFAULT_MAX_FILES,
    maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
    totalBytes: 0,
    mirrorConsole: true,
    brokenPipes: { stdout: false, stderr: false },
  }
  pending.length = 0
}

module.exports = {
  CATEGORIES,
  LEVELS,
  init,
  setLevel,
  getLogDir,
  log,
  operation,
  llm,
  systemPrompt,
  mcp,
  api,
  system,
  info,
  warn,
  error,
  debug,
  query,
  counts,
  clear,
  redact,
  isBrokenPipe,
  disableBrokenPipe,
  _reset,
}
