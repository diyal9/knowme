'use strict'

/**
 * context-cache — 进程内轻量缓存，仅服务主进程装配阶段的 TTFB 优化。
 *
 * 两类缓存共用一套模块级 API：
 *   - readFileCached(abs)          按 mtime 校验的文件读缓存（wiki.query 提速点）
 *   - cached(key, stamp, producer) 派生结果缓存（KB 摘要 / 技能包等），stamp 变化或过期即重算
 *   - invalidate(keyOrPrefix?)      失效：无参清空；传值删精确项，并按前缀删 memo 键
 *
 * 约束：仅内存，进程退出即弃；任何异常一律回退（返回 null / 直接重算），
 * 绝不因缓存导致漏内容。
 */

const fs = require('fs')

const DEFAULT_TTL_MS = 5000
const MAX_FILE_ENTRIES = 2000

const _memo = new Map() // key -> { stamp, at, value }
const _files = new Map() // abs -> { mtimeMs, content }

function statMtimeMs(p) {
  try {
    return fs.statSync(p).mtimeMs
  } catch {
    return -1
  }
}

/**
 * 派生上下文缓存。stamp 通常为相关文件的 mtime；变化或超过 TTL 即重算。
 * @param {string} key
 * @param {string|number} stamp
 * @param {() => any} producer
 * @param {number} [ttlMs]
 */
function cached(key, stamp, producer, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now()
  const hit = _memo.get(key)
  if (hit && hit.stamp === stamp && now - hit.at < ttlMs) {
    return hit.value
  }
  const value = producer()
  _memo.set(key, { stamp, at: now, value })
  return value
}

/**
 * 读文件内容，mtime 未变则复用缓存。异常返回 null（调用方回退直接读）。
 * @param {string} abs
 * @returns {string|null}
 */
function readFileCached(abs) {
  if (!abs) return null
  let mtimeMs
  try {
    mtimeMs = fs.statSync(abs).mtimeMs
  } catch {
    _files.delete(abs)
    return null
  }
  const hit = _files.get(abs)
  if (hit && hit.mtimeMs === mtimeMs) {
    // 触碰以近似 LRU
    _files.delete(abs)
    _files.set(abs, hit)
    return hit.content
  }
  let content
  try {
    content = fs.readFileSync(abs, 'utf8')
  } catch {
    _files.delete(abs)
    return null
  }
  _files.set(abs, { mtimeMs, content })
  while (_files.size > MAX_FILE_ENTRIES) {
    _files.delete(_files.keys().next().value)
  }
  return content
}

/**
 * 失效缓存。
 *   invalidate()          → 清空 memo 与文件缓存
 *   invalidate(abs)       → 删除该文件缓存项与同名 memo 键
 *   invalidate('kb:')     → 删除以该前缀开头的 memo 键（如 'kb:'、'skill:'）
 */
function invalidate(keyOrPrefix) {
  if (keyOrPrefix == null) {
    _memo.clear()
    _files.clear()
    return
  }
  _files.delete(keyOrPrefix)
  if (_memo.has(keyOrPrefix)) _memo.delete(keyOrPrefix)
  for (const key of _memo.keys()) {
    if (String(key).startsWith(keyOrPrefix)) _memo.delete(key)
  }
}

/** 仅清空文件读缓存（或指定 abs） */
function invalidateFiles(abs) {
  if (abs == null) _files.clear()
  else _files.delete(abs)
}

function stats() {
  return { memo: _memo.size, files: _files.size }
}

module.exports = {
  DEFAULT_TTL_MS,
  MAX_FILE_ENTRIES,
  statMtimeMs,
  cached,
  readFileCached,
  invalidate,
  invalidateFiles,
  stats,
}
