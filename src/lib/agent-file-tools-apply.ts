'use strict'

const { createDraftId } = require('./tool-drafts-store')
const pathSecurity = require('./path-security')
const fileBackup = require('./file-backup')
const { isTraversalPath, simpleDiffPreview, truncate, formatReadResult, formatListResult, formatGrepResult, grepFiles, buildWriteDraft, checkPath } = require('./agent-file-tools-format')

async function applyFileDraft(draft, adapter = {}) {
  if (!draft || draft.kind !== 'file') {
    return { ok: false, code: 'invalid_draft', text: '无效文件草稿' }
  }
  const action = draft.action
  const payload = draft
  if (typeof adapter.backupBefore === 'function') {
    await adapter.backupBefore(draft)
  }
  try {
    if (action === 'write_file' || action === 'create_file' || action === 'apply_patch') {
      if (typeof adapter.writeFile !== 'function') return { ok: false, code: 'tool_unavailable', text: '写入不可用' }
      const rel = draft.path
      const content = payload.content ?? draft.content
      const r = await adapter.writeFile(rel, content)
      if (r?.ok === false) {
        if (typeof adapter.rollbackFromBackup === 'function') await adapter.rollbackFromBackup(draft)
        return { ok: false, code: 'write_failed', text: String(r.error || '写入失败') }
      }
      return { ok: true, text: `已写入 ${rel}` }
    }
    if (action === 'move_path') {
      if (typeof adapter.movePath !== 'function') return { ok: false, code: 'tool_unavailable', text: '移动不可用' }
      const from = payload.from || draft.from
      const to = payload.to || draft.to
      const r = await adapter.movePath(from, to)
      if (r?.ok === false) {
        if (adapter.rootPath && adapter.runId) {
          fileBackup.rollbackMove(adapter.rootPath, adapter.runId, from, to)
        } else if (typeof adapter.rollbackFromBackup === 'function') {
          await adapter.rollbackFromBackup(draft)
        }
        return { ok: false, code: 'move_failed', text: String(r.error || '移动失败') }
      }
      return { ok: true, text: `已移动 ${from} → ${to}` }
    }
    if (action === 'copy_path') {
      if (typeof adapter.copyPath !== 'function') return { ok: false, code: 'tool_unavailable', text: '复制不可用' }
      const r = await adapter.copyPath(payload.from || draft.from, payload.to || draft.to)
      if (r?.ok === false) return { ok: false, code: 'copy_failed', text: String(r.error || '复制失败') }
      return { ok: true, text: `已复制 ${payload.from} → ${payload.to}` }
    }
    if (action === 'delete_path' || action === 'mkdir') {
      if (action === 'delete_path' && typeof adapter.deletePath === 'function') {
        const r = await adapter.deletePath(payload.path || draft.path)
        if (r?.ok === false) return { ok: false, code: 'delete_failed', text: String(r.error || '删除失败') }
        return { ok: true, text: `已删除 ${draft.path}` }
      }
      if (action === 'mkdir' && typeof adapter.mkdir === 'function') {
        const r = await adapter.mkdir(payload.path || draft.path)
        if (r?.ok === false) return { ok: false, code: 'mkdir_failed', text: String(r.error || '建目录失败') }
        return { ok: true, text: `已创建目录 ${draft.path}` }
      }
    }
    return { ok: false, code: 'invalid_draft', text: `未知文件操作: ${action}` }
  } catch (err) {
    if (typeof adapter.rollbackFromBackup === 'function') {
      try { await adapter.rollbackFromBackup(draft) } catch { /* ignore */ }
    }
    return { ok: false, code: 'apply_failed', text: String(err?.message || err).slice(0, 500) }
  }
}

async function rollbackFileDraft(draft, adapter = {}) {
  if (typeof adapter.rollbackFromBackup !== 'function') {
    return { ok: false, code: 'rollback_unavailable', text: '回滚不可用' }
  }
  return adapter.rollbackFromBackup(draft)
}

module.exports = {
  applyFileDraft,
  rollbackFileDraft,
}
