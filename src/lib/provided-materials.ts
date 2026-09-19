'use strict'

const { createHash } = require('node:crypto')
const { isTaskControlMaterial } = require('./task-material-kind')

// Admission limits, not model token budgets. Never silently truncate content.
const MAX_MATERIALS = 32
const MAX_TEXT_BYTES = 1024 * 1024

/**
 * @typedef {{id:string,title:string,text:string,contentHash:string,
 * origin:'user_material',completeness:'unknown'}} ProvidedMaterial
 * @typedef {{version:1,kind:'provided_materials',taskId:string,runId:string,
 * items:ReadonlyArray<ProvidedMaterial>,snapshotHash:string}} ProvidedMaterialsSnapshot
 * Hashes establish content/binding integrity, NOT authority or factual truth.
 * This is separate from tool/effect evidence. No I/O is performed.
 */
function invalidMaterials(reason) {
  const error = new Error(`用户材料快照校验失败（${reason}），请重新发起本轮任务。`)
  error.code = 'provided_materials_invalid'
  return error
}

function materialHash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function requireIdentity(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 256) {
    throw invalidMaterials('identity')
  }
  return value
}

function sealSnapshot(taskId, runId, items) {
  const body = { version: 1, kind: 'provided_materials', taskId, runId, items }
  const snapshotHash = materialHash(JSON.stringify(body))
  for (const item of items) Object.freeze(item)
  Object.freeze(items)
  return Object.freeze({ ...body, snapshotHash })
}

/** Only pass the executing task's brief.materials, never a mixed prompt/history. */
function createProvidedMaterialsSnapshot({ taskId, runId, materials = [] } = {}) {
  requireIdentity(taskId)
  requireIdentity(runId)
  if (!Array.isArray(materials) || materials.length > MAX_MATERIALS) throw invalidMaterials('count')
  let bytes = 0
  const ids = new Set()
  const items = []
  for (const [index, item] of materials.entries()) {
    if (!item || typeof item !== 'object') throw invalidMaterials('item')
    if (isTaskControlMaterial(item)) continue
    // URLs/titles and image descriptions cannot impersonate available text.
    if (item.kind === 'image' || item.type === 'image' || /^image\//i.test(String(item.mimeType || '')) || item.dataUrl) continue
    if (item.content == null || item.content === '') continue
    if (typeof item.content !== 'string') throw invalidMaterials('text')
    if (item.content.length > MAX_TEXT_BYTES) throw invalidMaterials('size')
    bytes += Buffer.byteLength(item.content, 'utf8')
    if (bytes > MAX_TEXT_BYTES) throw invalidMaterials('size')
    if (!item.content.trim()) continue
    const id = item.id == null || item.id === '' ? `material-${index + 1}` : requireIdentity(item.id)
    if (ids.has(id)) throw invalidMaterials('duplicate_id')
    ids.add(id)
    const title = item.title == null ? '' : item.title
    if (typeof title !== 'string' || title.length > 256) throw invalidMaterials('title')
    items.push({ id, title, text: item.content, contentHash: materialHash(item.content),
      origin: 'user_material', completeness: 'unknown' })
  }
  // Stored materials lack pre-truncation provenance. Do not infer completeness
  // from length or accept source/status/completeness supplied by a material.
  return sealSnapshot(taskId, runId, items)
}

/** Missing -> null; invalid -> safe error; valid -> fresh frozen copy. */
function validateProvidedMaterials(snapshot, { taskId, runId } = {}) {
  if (snapshot == null) return null
  requireIdentity(taskId)
  requireIdentity(runId)
  if (snapshot.version !== 1 || snapshot.kind !== 'provided_materials'
    || snapshot.taskId !== taskId || snapshot.runId !== runId) throw invalidMaterials('binding')
  if (!Array.isArray(snapshot.items) || snapshot.items.length > MAX_MATERIALS) throw invalidMaterials('count')
  const items = []
  const ids = new Set()
  let bytes = 0
  for (const item of snapshot.items) {
    if (!item || typeof item !== 'object') throw invalidMaterials('item')
    const id = requireIdentity(item.id)
    if (ids.has(id)) throw invalidMaterials('duplicate_id')
    ids.add(id)
    if (item.origin !== 'user_material' || item.completeness !== 'unknown') throw invalidMaterials('source_scope')
    if (typeof item.title !== 'string' || item.title.length > 256) throw invalidMaterials('title')
    if (typeof item.text !== 'string' || item.text.length > MAX_TEXT_BYTES) throw invalidMaterials('text')
    bytes += Buffer.byteLength(item.text, 'utf8')
    if (bytes > MAX_TEXT_BYTES) throw invalidMaterials('size')
    if (!item.text.trim() || item.contentHash !== materialHash(item.text)) throw invalidMaterials('content_hash')
    items.push({ id, title: item.title, text: item.text, contentHash: item.contentHash,
      origin: 'user_material', completeness: 'unknown' })
  }
  const normalized = sealSnapshot(taskId, runId, items)
  if (snapshot.snapshotHash !== normalized.snapshotHash) throw invalidMaterials('snapshot_hash')
  return normalized
}

/** Compare to execution identity, not to the snapshot's own declared IDs. */
function providedMaterialsFromInput(input = {}, runId = input.runId) {
  if (input.providedMaterials == null) return null
  if (input.runId != null && input.runId !== runId) throw invalidMaterials('run_identity')
  const taskId = input.taskRef?.id || input.workbenchTaskId
  if (input.taskRef?.id != null && input.workbenchTaskId != null
    && input.taskRef.id !== input.workbenchTaskId) throw invalidMaterials('task_identity')
  return validateProvidedMaterials(input.providedMaterials, { taskId, runId })
}

module.exports = { createProvidedMaterialsSnapshot, validateProvidedMaterials, providedMaterialsFromInput }
