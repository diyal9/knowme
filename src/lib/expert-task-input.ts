'use strict'

const { normalizeBrief } = require('./workbench-task-store')
const { imageAttachmentResource } = require('./image-attachment-resources')

const MAX_EXPERT_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_EXPERT_IMAGE_TOTAL_BYTES = 24 * 1024 * 1024

function imageBytes(item) {
  const resource = imageAttachmentResource({ ...item, kind: 'image' })
  if (!resource) return null
  return Buffer.from(resource.dataUrl.slice(resource.dataUrl.indexOf(',') + 1), 'base64').length
}

// Validate the complete submission before changing either the brief or queue.
// The store has bounded fields; accepting a truncated batch would lose input.
function validateExpertTaskInput(input, existingMaterials = []) {
  if (input.note != null && typeof input.note !== 'string') return { ok: false, error: '补充内容必须是文字。' }
  const note = (input.note || '').trim()
  if (note.length > 1000) return { ok: false, error: '补充文字超过 1000 字，请缩短后重新提交。' }
  if (input.materials != null && !Array.isArray(input.materials)) return { ok: false, error: '附件格式无效，请重新添加。' }
  const incoming = input.materials || []
  if (existingMaterials.length + incoming.length + (note ? 1 : 0) > 32) {
    return { ok: false, error: '任务材料超过 32 项，本次文字和附件均未提交。' }
  }
  const materials = []
  let totalImageBytes = existingMaterials.reduce((total, item) => total + (imageBytes(item) || 0), 0)
  for (const item of incoming) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: '附件格式无效，请重新添加。' }
    const content = item.content || item.text || ''
    if (typeof content !== 'string' || content.trim().length > 8000) return { ok: false, error: '附件正文无效或超过 8000 字，请调整后重新提交。' }
    const normalized = normalizeBrief({ brief: { materials: [item] } }).materials[0]
    if (item.kind === 'image' || item.type === 'image') {
      const bytes = imageBytes(item)
      if (bytes == null || !normalized.kind) {
        return { ok: false, error: '图片附件无效，请重新添加；本次文字和附件均未提交。' }
      }
      if (bytes > MAX_EXPERT_IMAGE_BYTES) {
        return { ok: false, error: '单张图片超过 10 MB，请压缩后重新添加；本次文字和附件均未提交。' }
      }
      totalImageBytes += bytes
      if (totalImageBytes > MAX_EXPERT_IMAGE_TOTAL_BYTES) {
        return { ok: false, error: '任务图片总量超过 24 MB，请分批或压缩后重新添加；本次文字和附件均未提交。' }
      }
      normalized.ref = imageAttachmentResource({ ...item, kind: 'image' }).reference
    } else if (!normalized.content && !normalized.ref) {
      return { ok: false, error: '附件没有可读取的正文或引用，请重新添加。' }
    }
    materials.push({ ...normalized, id: item.id || `user-material-${Date.now().toString(36)}-${materials.length + 1}` })
  }
  return { ok: true, note, materials }
}

module.exports = { validateExpertTaskInput, MAX_EXPERT_IMAGE_BYTES, MAX_EXPERT_IMAGE_TOTAL_BYTES }
