'use strict'

const { createHash } = require('node:crypto')
const { MAX_IMAGE_BYTES } = require('./image-validation')

// A reference identifies bytes already supplied by the user, not a filesystem
// grant or proof of image validity. Model-visible labels and dispatch share it.
function imageAttachmentResource(item) {
  if (!item || item.kind !== 'image' || typeof item.dataUrl !== 'string') return null
  const source = item.dataUrl.trim()
  if (source.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 128) return null
  const match = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(source)
  if (!match || match[2].length % 4 !== 0) return null
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return null
  return {
    reference: `attachment:image_${createHash('sha256').update(bytes).digest('hex')}`,
    dataUrl: source,
    name: String(item.name || item.title || '图片附件').slice(0, 160),
  }
}

function imageAttachmentResources(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter(item => item && item.kind === 'image' && item.dataUrl)
    .slice(0, 3).map(imageAttachmentResource).filter(Boolean)
}

module.exports = { imageAttachmentResource, imageAttachmentResources }
