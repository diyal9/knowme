'use strict'

const { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, IMAGE_MIME_EXTENSIONS } = require('./image-validation')

/** Facts decoded from saved bytes, independent of provider claims or visual QA.
 * width/height are the displayed canvas after EXIF orientation, per frame.
 * This is a data contract, not an authorization token or proof of visual quality.
 */
function describeImageMetadata(artifact) {
  const image = artifact?.meta?.image
  if (image?.protocol !== 'knowme.image-metadata/v1' || image.source !== 'decoded-file') return ''
  if (typeof artifact.id !== 'string' || !artifact.id.trim()
    || typeof image.mimeType !== 'string' || typeof image.sha256 !== 'string') return ''
  const positive = value => Number.isSafeInteger(value) && value > 0
  if (![image.width, image.height, image.frames, image.byteLength].every(positive)
    || image.width > 8192 || image.height > 8192 || image.frames > 100
    || image.width * image.height * image.frames > MAX_IMAGE_PIXELS
    || image.byteLength > MAX_IMAGE_BYTES || !Object.hasOwn(IMAGE_MIME_EXTENSIONS, image.mimeType)
    || !/^[a-f0-9]{64}$/.test(image.sha256)) return ''
  return `实际图片 ${String(artifact.id || '').slice(0, 100)}：${image.width} × ${image.height} px，${image.mimeType}，${image.frames} 帧，${image.byteLength} 字节。`
}

module.exports = { describeImageMetadata }
