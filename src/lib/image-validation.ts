'use strict'

const MAX_IMAGE_BYTES = 24 * 1024 * 1024
const MAX_IMAGE_PIXELS = 32 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 8192
const MAX_IMAGE_FRAMES = 100
const IMAGE_MIME_EXTENSIONS = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/avif': '.avif',
}
const IMAGE_ERRORS = {
  image_invalid: '图片字节损坏、截断或无法完整解码，未保存该图片。',
  image_mime_mismatch: '图片声明类型与实际格式不一致，未保存该图片。',
  image_format_unsupported: '支持预算内的静态 PNG、JPEG、GIF、WebP、AVIF；APNG、SVG 不接受，动图须通过全帧校验。',
  image_budget_exceeded: '图片超过大小、尺寸或动画解码预算，未保存该图片。',
  image_decoder_unavailable: '图片校验组件不可用，请修复应用安装后重试。',
  image_decoder_busy: '图片校验队列已满，请稍后重试。',
  image_cancelled: '图片处理已取消，未保存该图片。',
  image_save_failed: '图片已通过校验，但本地保存失败，请检查磁盘和目录权限。',
  image_download_failed: '图片下载失败，请检查网络后重试。',
  image_download_timeout: '图片下载超时，未保存该图片，请稍后重试。',
  image_download_blocked: '图片链接指向不安全地址或重定向不符合安全限制，已拒绝下载。',
  image_background_not_detected: '未能安全识别足够的边界连通背景，未应用纯色归一化，也未保存该图片。',
  image_background_normalization_failed: '纯色背景归一化未能完成，未保存未经核验的图片。',
}

function imageFailure(code) {
  return { ok: false, code, message: IMAGE_ERRORS[code] || IMAGE_ERRORS.image_invalid }
}

// This is only a format allowlist / container boundary check, never the decoder.
// In particular SVG is rejected before libvips can parse any active/external content.
function sniffImageMime(bytes) {
  if (bytes.length < 12) return ''
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset)
      const end = offset + size + 12
      if (end > bytes.length) return ''
      // libvips' PNG loader validates only the default frame, not APNG animation.
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') return ''
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'IEND') {
        return size === 0 && end === bytes.length ? 'image/png' : ''
      }
      offset = end
    }
    return ''
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217 ? 'image/jpeg' : ''
  }
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) {
    return bytes[bytes.length - 1] === 0x3b ? 'image/gif' : ''
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return bytes.readUInt32LE(4) + 8 === bytes.length ? 'image/webp' : ''
  }
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    const headerEnd = bytes.readUInt32BE(0)
    if (headerEnd < 16 || headerEnd > bytes.length) return ''
    const brands = [bytes.toString('ascii', 8, 12)]
    for (let i = 16; i + 4 <= headerEnd; i += 4) brands.push(bytes.toString('ascii', i, i + 4))
    if (!brands.some(brand => brand === 'avif' || brand === 'avis')) return ''
    let offset = 0
    while (offset + 8 <= bytes.length) {
      const size = bytes.readUInt32BE(offset)
      // Large/EOF-sized boxes are deliberately outside the bounded accepted subset.
      if (size < 8 || offset + size > bytes.length) return ''
      offset += size
    }
    return offset === bytes.length ? 'image/avif' : ''
  }
  return ''
}

let decoderQueue = Promise.resolve()
let pendingDecodes = 0

async function decodeImage(bytes, mimeType, signal) {
  let sharp
  try { sharp = require('sharp') } catch { return imageFailure('image_decoder_unavailable') }
  // No retained libvips image cache; only one validation job is active process-wide.
  sharp.cache(false)
  const decoder = sharp(bytes, {
    animated: true, failOn: 'warning', unlimited: false,
    limitInputPixels: MAX_IMAGE_PIXELS, limitInputChannels: 4,
  }).timeout({ seconds: 5 })
  try {
    // sharp 0.35.4 metadata/OpenInput has no timeout hook. The 5s setting only
    // guards cooperative pixel evaluation, NOT headers, metadata or total elapsed time.
    const metadata = await decoder.metadata()
    const pages = metadata.pages || 1
    const height = metadata.pageHeight || metadata.height
    // GIF loaders may report frame content bounds smaller than the display canvas.
    // Budget the larger dimensions so saving the original does not undercount them.
    const budgetWidth = mimeType === 'image/gif' ? Math.max(metadata.width, bytes.readUInt16LE(6)) : metadata.width
    const budgetHeight = mimeType === 'image/gif' ? Math.max(height, bytes.readUInt16LE(8)) : height
    if (!metadata.width || !height || budgetWidth > MAX_IMAGE_DIMENSION || budgetHeight > MAX_IMAGE_DIMENSION
      || pages > MAX_IMAGE_FRAMES || budgetWidth * budgetHeight * pages > MAX_IMAGE_PIXELS) {
      return imageFailure('image_budget_exceeded')
    }
    const expected = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'heif' }
    if (metadata.format !== expected[mimeType]) return imageFailure('image_mime_mismatch')
    if (signal?.aborted) return imageFailure('image_cancelled')
    // Force full raster decoding (all frames), not just metadata inspection.
    await decoder.toColourspace('srgb').ensureAlpha().raw().toBuffer()
    if (signal?.aborted) return imageFailure('image_cancelled')
    const swapsAxes = metadata.orientation >= 5 && metadata.orientation <= 8
    return { ok: true, mimeType, width: metadata.width, height, pages,
      displayWidth: swapsAxes ? budgetHeight : budgetWidth,
      displayHeight: swapsAxes ? budgetWidth : budgetHeight }
  } catch {
    return imageFailure(signal?.aborted ? 'image_cancelled' : 'image_invalid')
  } finally {
    decoder.destroy()
  }
}

async function validateImageBytes(bytes, declaredMime, opts = {}) {
  if (opts.signal?.aborted) return imageFailure('image_cancelled')
  if (!Buffer.isBuffer(bytes) || !bytes.length) return imageFailure('image_invalid')
  if (bytes.length > MAX_IMAGE_BYTES) return imageFailure('image_budget_exceeded')
  const declared = String(declaredMime || '').split(';')[0].trim().toLowerCase()
  if (declared === 'image/svg+xml') return imageFailure('image_format_unsupported')
  const mimeType = sniffImageMime(bytes)
  if (!mimeType) return imageFailure('image_invalid')
  // Absent / octet-stream Content-Type is permitted only when the caller opts in (CDN).
  if (declared !== mimeType && !(opts.allowUndeclared && (!declared || declared === 'application/octet-stream'))) {
    return imageFailure('image_mime_mismatch')
  }
  if (pendingDecodes >= 4) return imageFailure('image_decoder_busy')
  pendingDecodes += 1
  const run = decoderQueue.then(() => opts.signal?.aborted
    ? imageFailure('image_cancelled') : decodeImage(bytes, mimeType, opts.signal))
  decoderQueue = run.then(() => {}, () => {})
  try { return await run } finally { pendingDecodes -= 1 }
  // No Promise.race: abort does not release the slot while native CPU work continues.
}

module.exports = { validateImageBytes, imageFailure, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, IMAGE_MIME_EXTENSIONS }
