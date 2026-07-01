const zlib = require('zlib')

const ACCENT = { r: 85, g: 88, b: 232 }
const WHITE = { r: 255, g: 255, b: 255, a: 255 }

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const cc = Buffer.alloc(4)
  cc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, cc])
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4)
    raw[row] = 0
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function setPx(buf, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const p = (y * size + x) * 4
  const a = color.a ?? 255
  if (a >= 255) {
    buf[p] = color.r
    buf[p + 1] = color.g
    buf[p + 2] = color.b
    buf[p + 3] = 255
    return
  }
  const ia = a / 255
  buf[p] = Math.round(color.r * ia + buf[p] * (1 - ia))
  buf[p + 1] = Math.round(color.g * ia + buf[p + 1] * (1 - ia))
  buf[p + 2] = Math.round(color.b * ia + buf[p + 2] * (1 - ia))
  buf[p + 3] = Math.min(255, buf[p + 3] + Math.round(a * (1 - buf[p + 3] / 255)))
}

function inRoundRect(x, y, x1, y1, x2, y2, cr) {
  if (x < x1 || x > x2 || y < y1 || y > y2) return false
  const dx = Math.min(x - x1, x2 - x)
  const dy = Math.min(y - y1, y2 - y)
  if (dx < cr && dy < cr && Math.hypot(cr - dx, cr - dy) > cr) return false
  return true
}

/** 便签线稿：圆角矩形 + 三条横线 */
function drawNoteGlyph(buf, size, { fg, bg = null, fold = false }) {
  const pad = Math.max(2, Math.round(size * 0.14))
  const x1 = pad
  const y1 = pad
  const x2 = size - pad - 1
  const y2 = size - pad - 1
  const cr = Math.max(2, Math.round(size * 0.14))
  const lw = Math.max(1, Math.round(size * 0.075))
  const lx1 = x1 + Math.round(size * 0.16)
  const lx2 = x2 - Math.round(size * 0.16)
  const lineYs = [0.40, 0.54, 0.68].map(t => Math.round(y1 + (y2 - y1) * t))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundRect(x, y, x1, y1, x2, y2, cr)) continue
      if (bg) setPx(buf, size, x, y, bg)

      const onBorder = x <= x1 + lw || x >= x2 - lw || y <= y1 + lw || y >= y2 - lw
      const onLine = lineYs.includes(y) && x >= lx1 && x <= lx2
      if (fold) {
        const fx = x2 - Math.round(size * 0.18)
        const fy = y1 + Math.round(size * 0.18)
        if (x >= fx && y <= fy && x + y <= fx + fy + lw) {
          setPx(buf, size, x, y, fg)
          continue
        }
      }
      if (onBorder || onLine) setPx(buf, size, x, y, fg)
    }
  }
}

/** 任务栏 / 窗口：品牌紫底 + 白色便签 */
function createAppIconPng(size = 256) {
  const buf = Buffer.alloc(size * size * 4)
  const pad = Math.max(1, Math.round(size * 0.06))
  const cr = Math.max(3, Math.round(size * 0.18))
  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      if (inRoundRect(x, y, pad, pad, size - pad - 1, size - pad - 1, cr)) {
        setPx(buf, size, x, y, ACCENT)
      }
    }
  }
  drawNoteGlyph(buf, size, { fg: WHITE, fold: size >= 48 })
  return encodePng(buf, size)
}

/** 系统托盘：透明底 + 白色便签线稿 */
function createTrayIconPng(size = 32) {
  const buf = Buffer.alloc(size * size * 4)
  drawNoteGlyph(buf, size, { fg: { ...WHITE, a: 220 } })
  return encodePng(buf, size)
}

module.exports = { createAppIconPng, createTrayIconPng }
