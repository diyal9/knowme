'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Path security: lstat (no follow), realpath parent validation, Windows junction negative cases.
 * 不负责：内容源策略、工具草稿编排。
 */

function isSymlinkOrJunction(absPath) {
  try {
    const st = fs.lstatSync(absPath)
    return st.isSymbolicLink()
  } catch {
    return false
  }
}

function realpathSafe(absPath) {
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(absPath) : fs.realpathSync(absPath)
  } catch {
    return null
  }
}

/** 比较前把 root 也 realpath，避免 junction/symlink 导致路径误判「穿透」。 */
function isPathInsideRoot(resolved, rootPath) {
  if (!rootPath || !resolved) return false
  const root = realpathSafe(rootPath) || path.resolve(rootPath)
  const target = realpathSafe(resolved) || path.resolve(resolved)
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * Validate a relative path under content root before write/move/mkdir.
 * @returns {{ ok: boolean, code?: string, text?: string }}
 */
function validateContentPath(rel, rootPath, opts = {}) {
  const relNorm = String(rel || '').replace(/\\/g, '/').trim()
  if (!relNorm) return { ok: false, code: 'invalid_args', text: '路径为空' }
  if (relNorm.split('/').some((s) => s === '..')) {
    return { ok: false, code: 'scope_denied', text: '路径 traversal 被拒绝' }
  }
  const abs = path.resolve(rootPath, relNorm)
  const parent = path.dirname(abs)

  if (opts.checkTarget !== false && fs.existsSync(abs)) {
    if (isSymlinkOrJunction(abs)) {
      return { ok: false, code: 'scope_denied', text: '目标为符号链接或 junction，已拦截' }
    }
    const resolved = realpathSafe(abs)
    if (resolved && !isPathInsideRoot(resolved, rootPath)) {
      return { ok: false, code: 'scope_denied', text: '符号链接/junction 指向内容源外' }
    }
  }

  if (fs.existsSync(parent)) {
    if (isSymlinkOrJunction(parent)) {
      return { ok: false, code: 'scope_denied', text: '父路径为符号链接或 junction，已拦截' }
    }
    const parentResolved = realpathSafe(parent)
    if (parentResolved && !isPathInsideRoot(parentResolved, rootPath)) {
      return { ok: false, code: 'scope_denied', text: '父路径 junction 指向内容源外' }
    }
  } else {
    const segments = relNorm.split('/').filter(Boolean)
    let walk = rootPath
    for (let i = 0; i < segments.length - 1; i++) {
      walk = path.join(walk, segments[i])
      if (!fs.existsSync(walk)) break
      if (isSymlinkOrJunction(walk)) {
        return { ok: false, code: 'scope_denied', text: '路径组件含符号链接/junction' }
      }
      const rp = realpathSafe(walk)
      if (rp && !isPathInsideRoot(rp, rootPath)) {
        return { ok: false, code: 'scope_denied', text: '路径组件 junction 穿透内容源' }
      }
    }
  }

  return { ok: true, abs }
}

function canMkdirDirect(rel, rootPath, adapter = {}) {
  const v = validateContentPath(rel, rootPath, { checkTarget: false })
  if (!v.ok) return { ok: false, reason: v.text, code: v.code }
  const abs = v.abs
  if (fs.existsSync(abs)) {
    return { ok: false, reason: '目标已存在', code: 'patch_conflict' }
  }
  const parent = path.dirname(abs)
  if (!fs.existsSync(parent)) {
    return { ok: false, reason: '父目录不存在', code: 'parent_missing' }
  }
  if (typeof adapter.statPath === 'function') {
    const st = adapter.statPath(rel)
    if (st?.exists) return { ok: false, reason: '目标已存在', code: 'patch_conflict' }
  }
  return { ok: true, abs }
}

module.exports = {
  isSymlinkOrJunction,
  realpathSafe,
  isPathInsideRoot,
  validateContentPath,
  canMkdirDirect,
}
