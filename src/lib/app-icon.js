const zlib = require('zlib')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const BRAND_PNG = path.join(__dirname, '..', 'assets', 'icon.png')
const BRAND_ICO = path.join(__dirname, '..', 'assets', 'icon.ico')
const TRAY_PNG = path.join(__dirname, '..', 'assets', 'tray-icon.png')

const WHITE = { r: 255, g: 255, b: 255, a: 255 }
/** 旧像素绘制辅助常量；生产图标直接读取统一的已提交品牌资源。 */
const ICON_BG = { r: 28, g: 32, b: 38 }
const ICON_FG = { r: 220, g: 224, b: 230, a: 255 }

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

function fillRoundRect(buf, size, x1, y1, x2, y2, cr, color) {
  for (let y = Math.max(0, y1); y <= Math.min(size - 1, y2); y++) {
    for (let x = Math.max(0, x1); x <= Math.min(size - 1, x2); x++) {
      if (inRoundRect(x, y, x1, y1, x2, y2, cr)) setPx(buf, size, x, y, color)
    }
  }
}

/**
 * 便签线稿：透明底 + 单色圆角矩形 + 三条横线（系统托盘专用）。
 * 托盘区为单色渲染，保留描边造型以便小尺寸清晰。
 */
function drawNoteGlyph(buf, size, { fg }) {
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
      const onBorder = x <= x1 + lw || x >= x2 - lw || y <= y1 + lw || y >= y2 - lw
      const onLine = lineYs.includes(y) && x >= lx1 && x <= lx2
      if (onBorder || onLine) setPx(buf, size, x, y, fg)
    }
  }
}

/** 应用 / 任务栏 / 窗口图标：统一的五节点连接品牌标志。 */
function createAppIconPng(size = 256) {
  void size
  return fs.readFileSync(BRAND_PNG)
}

/** 系统托盘：读取逐像素优化的 32 px / 2× 连接标志。 */
function createTrayIconPng(size = 32) {
  void size
  return fs.readFileSync(TRAY_PNG)
}

/**
 * Windows 多尺寸 .ico —— 任务栏/exe/开始菜单需要小尺寸表示，
 * 单尺寸 PNG 在透明无边框窗口上会回退到系统默认图标。
 */
function createAppIcoBuffer(sizes = [16, 24, 32, 48, 64, 128, 256]) {
  void sizes
  return fs.readFileSync(BRAND_ICO)
}

/**
 * Windows 会按图标路径缓存任务栏位图。内容变化时生成新路径，避免覆盖固定
 * app-icon.ico 后仍显示旧缓存；相同内容继续复用同一文件。
 */
function materializeWindowsIcon(sourcePath, userDataDir) {
  const bytes = fs.readFileSync(sourcePath)
  const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  const targetPath = path.join(userDataDir, `app-icon-${digest}.ico`)
  if (!fs.existsSync(targetPath)) fs.writeFileSync(targetPath, bytes)
  return targetPath
}

module.exports = {
  createAppIconPng,
  createTrayIconPng,
  createAppIcoBuffer,
  materializeWindowsIcon,
}
