'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex').slice(0, 16)
}

function backupDirForRun(rootPath, runId) {
  return path.join(String(rootPath || ''), '.knowme', 'backups', String(runId || 'unknown'))
}

function ensureBackupDir(rootPath, runId) {
  const dir = backupDirForRun(rootPath, runId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function backupFile(rootPath, runId, relPath, readFileFn) {
  const backupRoot = ensureBackupDir(rootPath, runId)
  const safeRel = String(relPath || '').replace(/\\/g, '/').replace(/\.\./g, '_')
  const dest = path.join(backupRoot, safeRel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const existing = readFileFn(relPath)
  if (existing?.ok) {
    fs.writeFileSync(dest, String(existing.content ?? ''), 'utf8')
    return { ok: true, backupPath: dest, hadContent: true }
  }
  fs.writeFileSync(dest + '.missing', '', 'utf8')
  return { ok: true, backupPath: dest, hadContent: false }
}

function rollbackFromBackup(rootPath, runId, relPath) {
  const backupRoot = backupDirForRun(rootPath, runId)
  const safeRel = String(relPath || '').replace(/\\/g, '/').replace(/\.\./g, '_')
  const src = path.join(backupRoot, safeRel)
  const missing = `${src}.missing`
  const targetAbs = path.join(String(rootPath || ''), safeRel)
  if (fs.existsSync(missing)) {
    if (fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs)
    return { ok: true, text: '已回滚（原文件不存在，已删除）' }
  }
  if (!fs.existsSync(src)) {
    return { ok: false, code: 'rollback_unavailable', text: '备份不存在' }
  }
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true })
  fs.copyFileSync(src, targetAbs)
  return { ok: true, text: `已从备份恢复 ${relPath}` }
}

function backupMovePaths(rootPath, runId, fromRel, toRel, readFileFn) {
  backupFile(rootPath, runId, fromRel, readFileFn)
  backupFile(rootPath, runId, toRel, readFileFn)
}

function rollbackMove(rootPath, runId, fromRel, toRel) {
  const toResult = rollbackFromBackup(rootPath, runId, toRel)
  const fromResult = rollbackFromBackup(rootPath, runId, fromRel)
  const ok = toResult.ok !== false && fromResult.ok !== false
  return {
    ok,
    text: ok ? `已回滚移动 ${fromRel} → ${toRel}` : '移动回滚部分失败',
    results: [{ path: toRel, ...toResult }, { path: fromRel, ...fromResult }],
  }
}

function buildFileWriteAdapter(rootPath, sourcesLib, opts = {}) {
  const runId = opts.runId || 'unknown'
  const rememberDraft = opts.rememberDraft
  const backupRoot = ensureBackupDir(rootPath, runId)

  return {
    backupDir: backupRoot,
    runId,
    rootPath,
    rememberDraft,
    hashContent,
    validatePath(rel) {
      const abs = sourcesLib.resolveUnderRoot(rootPath, rel)
      if (!abs) return { ok: false, error: '非法路径' }
      return { ok: true, abs }
    },
    async readFile(rel) {
      return sourcesLib.readFileUnder(rootPath, rel)
    },
    async listDir(rel) {
      return sourcesLib.listChildren(rootPath, rel || '')
    },
    async statPath(rel) {
      const abs = sourcesLib.resolveUnderRoot(rootPath, rel)
      if (!abs) return { exists: false }
      return { exists: fs.existsSync(abs) }
    },
    async writeFile(rel, content) {
      return sourcesLib.writeFileUnder(rootPath, rel, content)
    },
    async mkdir(rel) {
      const abs = sourcesLib.resolveUnderRoot(rootPath, rel)
      if (!abs) return { ok: false, error: '非法路径' }
      try {
        fs.mkdirSync(abs, { recursive: true })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e.message }
      }
    },
    async deletePath(rel) {
      const abs = sourcesLib.resolveUnderRoot(rootPath, rel)
      if (!abs) return { ok: false, error: '非法路径' }
      try {
        fs.rmSync(abs, { recursive: true, force: true })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e.message }
      }
    },
    async movePath(from, to) {
      const absFrom = sourcesLib.resolveUnderRoot(rootPath, from)
      const absTo = sourcesLib.resolveUnderRoot(rootPath, to)
      if (!absFrom || !absTo) return { ok: false, error: '非法路径' }
      try {
        fs.mkdirSync(path.dirname(absTo), { recursive: true })
        fs.renameSync(absFrom, absTo)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e.message }
      }
    },
    async copyPath(from, to) {
      const absFrom = sourcesLib.resolveUnderRoot(rootPath, from)
      const absTo = sourcesLib.resolveUnderRoot(rootPath, to)
      if (!absFrom || !absTo) return { ok: false, error: '非法路径' }
      try {
        fs.mkdirSync(path.dirname(absTo), { recursive: true })
        fs.copyFileSync(absFrom, absTo)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e.message }
      }
    },
    async backupBefore(draft) {
      const rel = draft.path || draft.payload?.path
      if (!rel) return
      const readFn = (r) => sourcesLib.readFileUnder(rootPath, r)
      if (draft.action === 'move_path') {
        const from = draft.from || draft.payload?.from
        const to = draft.to || draft.payload?.to || rel
        if (from && to) backupMovePaths(rootPath, runId, from, to, readFn)
        return
      }
      backupFile(rootPath, runId, rel, readFn)
      if (draft.action === 'copy_path') {
        const from = draft.from || draft.payload?.from
        if (from) backupFile(rootPath, runId, from, readFn)
      }
    },
    async rollbackFromBackup(draft) {
      if (draft.action === 'move_path') {
        const from = draft.from || draft.payload?.from
        const to = draft.to || draft.payload?.to || draft.path
        return rollbackMove(rootPath, runId, from, to)
      }
      const rel = draft.path || draft.payload?.path
      return rollbackFromBackup(rootPath, runId, rel)
    },
  }
}

module.exports = {
  hashContent,
  backupDirForRun,
  ensureBackupDir,
  backupFile,
  backupMovePaths,
  rollbackFromBackup,
  rollbackMove,
  buildFileWriteAdapter,
}
