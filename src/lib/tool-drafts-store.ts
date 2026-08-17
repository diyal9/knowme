'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DRAFTS_V2 = 2
const MAX_DRAFTS = 100
const STATUS_PENDING = 'pending_review'
const STATUS_APPLYING = 'applying'
const STATUS_APPLIED = 'applied'
const STATUS_REJECTED = 'rejected'
const STATUS_FAILED = 'failed'

const applyMutex = new Map()

function draftsPath(userData) {
  return path.join(String(userData || ''), 'tool-drafts.json')
}

function legacyDraftsPath(userData) {
  return path.join(String(userData || ''), 'connector-drafts.json')
}

function createDraftId() {
  return `draft_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function renameWithRetry(src, dest, retries = 3) {
  const delays = [50, 100, 200]
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      fs.renameSync(src, dest)
      return { ok: true }
    } catch (err) {
      lastErr = err
      if (err.code === 'EPERM' && i < retries) {
        const start = Date.now()
        while (Date.now() - start < delays[i]) { /* spin */ }
        continue
      }
      break
    }
  }
  return { ok: false, error: lastErr }
}

function migrateFromLegacy(raw) {
  if (!raw || !Array.isArray(raw.drafts)) return []
  return raw.drafts.map((d) => ({
    ...d,
    kind: d.kind || (d.action?.startsWith('create_') || d.action === 'apply_minute_permission' ? 'feishu' : 'feishu'),
    version: DRAFTS_V2,
    idempotencyKey: d.idempotencyKey || null,
    rollbackPlan: d.rollbackPlan || null,
  }))
}

function loadDrafts(userData) {
  const v2File = draftsPath(userData)
  try {
    const raw = JSON.parse(fs.readFileSync(v2File, 'utf8'))
    if (Array.isArray(raw?.drafts)) return raw.drafts
  } catch { /* fall through */ }
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyDraftsPath(userData), 'utf8'))
    const migrated = migrateFromLegacy(legacy)
    if (migrated.length) saveDrafts(userData, migrated)
    return migrated
  } catch {
    return []
  }
}

function saveDrafts(userData, drafts) {
  const file = draftsPath(userData)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  const payload = { version: DRAFTS_V2, drafts: drafts.slice(-MAX_DRAFTS) }
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8')
  const renamed = renameWithRetry(tmp, file)
  if (!renamed.ok) {
    try { fs.copyFileSync(tmp, file); fs.unlinkSync(tmp) } catch { /* last resort */ }
  }
  try {
    const legacy = legacyDraftsPath(userData)
    const legacyTmp = `${legacy}.${process.pid}.tmp`
    fs.writeFileSync(legacyTmp, JSON.stringify({ version: 1, drafts: payload.drafts }, null, 2), 'utf8')
    renameWithRetry(legacyTmp, legacy)
  } catch { /* optional */ }
  return payload.drafts
}

function inferDraftKind(draft = {}) {
  if (draft.kind) return draft.kind
  const action = String(draft.action || '')
  if (action === 'create_doc' || action === 'apply_minute_permission' || action.startsWith('draft_')) return 'feishu'
  if (['write_file', 'create_file', 'apply_patch', 'move_path', 'copy_path', 'delete_path', 'mkdir'].includes(action)) return 'file'
  return 'feishu'
}

function rememberDraft(userData, draft) {
  const drafts = loadDrafts(userData)
  const entry = {
    id: draft.id || createDraftId(),
    kind: inferDraftKind(draft),
    status: draft.status || STATUS_PENDING,
    createdAt: draft.createdAt || new Date().toISOString(),
    preview: draft.preview || '',
    idempotencyKey: draft.idempotencyKey || null,
    rollbackPlan: draft.rollbackPlan || null,
    runId: draft.runId || null,
    ...draft,
  }
  if (entry.idempotencyKey) {
    const dup = drafts.find((d) => d.idempotencyKey === entry.idempotencyKey && d.status === STATUS_PENDING)
    if (dup) return dup
  }
  drafts.push(entry)
  saveDrafts(userData, drafts)
  return entry
}

function getDraft(userData, draftId) {
  return loadDrafts(userData).find((d) => d.id === String(draftId || '')) || null
}

function markDraft(userData, draftId, patch) {
  const drafts = loadDrafts(userData)
  const idx = drafts.findIndex((d) => d.id === String(draftId || ''))
  if (idx < 0) return null
  drafts[idx] = { ...drafts[idx], ...patch }
  saveDrafts(userData, drafts)
  return drafts[idx]
}

/**
 * CAS: pending_review → applying. Returns { ok, draft, code }.
 */
function casBeginApply(userData, draftId) {
  const id = String(draftId || '')
  if (applyMutex.get(id)) {
    return { ok: false, code: 'not_pending', message: '草稿正在处理中' }
  }
  applyMutex.set(id, Date.now())
  try {
    const drafts = loadDrafts(userData)
    const idx = drafts.findIndex((d) => d.id === id)
    if (idx < 0) return { ok: false, code: 'not_found', message: '草稿不存在' }
    const current = drafts[idx]
    if (current.status === STATUS_APPLIED) {
      return { ok: false, code: 'duplicate_apply', message: '草稿已执行' }
    }
    if (current.status === STATUS_REJECTED) {
      return { ok: false, code: 'not_pending', message: '草稿已拒绝，不能再次写入' }
    }
    if (current.status === STATUS_APPLYING) {
      return { ok: false, code: 'not_pending', message: '草稿正在应用中' }
    }
    if (current.status !== STATUS_PENDING) {
      return { ok: false, code: 'not_pending', message: `草稿状态不可批准: ${current.status}` }
    }
    drafts[idx] = { ...current, status: STATUS_APPLYING, applyingAt: new Date().toISOString() }
    saveDrafts(userData, drafts)
    return { ok: true, draft: drafts[idx] }
  } finally {
    applyMutex.delete(id)
  }
}

function finishApply(userData, draftId, patch = {}) {
  return markDraft(userData, draftId, {
    status: patch.failed ? STATUS_FAILED : STATUS_APPLIED,
    reviewedAt: new Date().toISOString(),
    ...patch,
  })
}

function listPendingDrafts(userData) {
  return loadDrafts(userData).filter((d) => d.status === STATUS_PENDING)
}

function rejectDraft(userData, draftId) {
  const draft = getDraft(userData, draftId)
  if (!draft) return { ok: false, code: 'not_found' }
  if (draft.status !== STATUS_PENDING) {
    return { ok: false, code: 'not_pending', message: '草稿已处理' }
  }
  markDraft(userData, draftId, { status: STATUS_REJECTED, reviewedAt: new Date().toISOString() })
  return { ok: true, rejected: true }
}

function applyDraftMark(userData, draftId, applyResult = {}) {
  return finishApply(userData, draftId, {
    applyResult: String(applyResult.text || applyResult.message || '').slice(0, 2000),
  })
}

module.exports = {
  DRAFTS_V2,
  STATUS_PENDING,
  STATUS_APPLYING,
  STATUS_APPLIED,
  STATUS_REJECTED,
  STATUS_FAILED,
  draftsPath,
  createDraftId,
  loadDrafts,
  saveDrafts,
  rememberDraft,
  getDraft,
  markDraft,
  casBeginApply,
  finishApply,
  listPendingDrafts,
  rejectDraft,
  applyDraftMark,
  migrateFromLegacy,
  renameWithRetry,
}
