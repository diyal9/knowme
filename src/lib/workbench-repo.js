'use strict'

const fs = require('fs')
const path = require('path')
const sources = require('./sources')

function resolveActiveRepo(store) {
  const current = store && Array.isArray(store.sources)
    ? store.sources.find(source => source.id === store.activeSourceId)
    : null
  if (!current) return { ok: false, error: '请先添加并激活一个 Git 仓库内容源' }

  const root = sources.normalizeRoot(current.rootPath)
  if (!root) return { ok: false, error: '当前仓库目录不存在', source: current }
  if (!fs.existsSync(path.join(root, '.git'))) {
    return { ok: false, error: '当前内容源不是 Git 仓库', source: current, root }
  }

  const workflowsDir = path.join(root, '.cursor', 'workflows')

  return {
    ok: true,
    root,
    source: current,
    agentsDir: path.join(root, '.cursor', 'agents'),
    workflowsDir,
  }
}

function resolveWorkflowFile(root, relPath) {
  const rel = String(relPath || '').trim()
  if (!rel || path.isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel)) return null
  const workflowsDir = path.join(root, '.cursor', 'workflows')
  const file = sources.resolveUnderRoot(workflowsDir, rel)
  if (!file || path.extname(file).toLowerCase() !== '.json') return null
  return file
}

function resolveAgentDir(root, relPath, agentId) {
  const fallback = path.join('.cursor', 'agents', String(agentId || ''))
  const rel = String(relPath || fallback).trim()
  if (!rel || path.isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel)) return null
  return sources.resolveUnderRoot(root, rel)
}

/**
 * 解析产物打开路径：绝对路径直用；相对路径须落在激活仓库根内且拒绝穿越。
 * @returns {{ ok:true, target:string, relative?:boolean } | { ok:false, reason:string, error?:string }}
 */
function resolveArtifactOpenPath(filePath, store) {
  const target = String(filePath || '').trim()
  if (!target) return { ok: false, reason: 'missing', error: '缺少产物路径' }

  if (path.isAbsolute(target) || /^[a-zA-Z]:[\\/]/.test(target)) {
    if (!fs.existsSync(target)) {
      return { ok: false, reason: 'not-generated', error: '该产物尚未生成或未同步' }
    }
    return { ok: true, target, relative: false }
  }

  const repo = resolveActiveRepo(store)
  if (!repo.ok) {
    return { ok: false, reason: 'not-generated', error: repo.error || '无法解析激活仓库' }
  }
  const resolved = sources.resolveUnderRoot(repo.root, target)
  if (!resolved) {
    return { ok: false, reason: 'invalid', error: '非法产物路径' }
  }
  if (!fs.existsSync(resolved)) {
    return { ok: false, reason: 'not-generated', error: '该产物尚未生成或未同步' }
  }
  return { ok: true, target: resolved, relative: true, root: repo.root }
}

module.exports = {
  resolveActiveRepo,
  resolveWorkflowFile,
  resolveAgentDir,
  resolveArtifactOpenPath,
}
