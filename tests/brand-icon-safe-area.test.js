const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ICON_PNG_PATH = path.join(__dirname, '..', 'src', 'assets', 'icon.png')
const ICON_PATH = path.join(__dirname, '..', 'src', 'assets', 'icon.ico')
const TRAY_ICON_PATH = path.join(__dirname, '..', 'src', 'assets', 'tray-icon.png')
const SVG_PATH = path.join(__dirname, '..', 'assets', 'brand-src', 'knowme-icon.svg')
const { readMainEntryBundle } = require('./helpers/main-ipc-bundle')
const MAIN_PATH = path.join(__dirname, '..', 'src', 'main.js')
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const BRAND_COLORS = {
  ivory: [244, 239, 231],
  navy: [23, 37, 53],
  coral: [240, 93, 78],
}
const LEGACY_SLATE = [58, 80, 104]

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decodeRgbaPng(png) {
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE), 'ICO frame must use PNG encoding')
  let offset = 8
  let width = 0
  let height = 0
  const idat = []

  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assert.equal(data[8], 8, 'icon PNG must use 8-bit channels')
      assert.equal(data[9], 6, 'icon PNG must use RGBA color')
      assert.equal(data[12], 0, 'icon PNG must not be interlaced')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += length + 12
  }

  const packed = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rgba = Buffer.alloc(stride * height)
  let packedOffset = 0

  for (let y = 0; y < height; y++) {
    const filter = packed[packedOffset++]
    const rowOffset = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = packed[packedOffset++]
      const left = x >= 4 ? rgba[rowOffset + x - 4] : 0
      const up = y > 0 ? rgba[rowOffset - stride + x] : 0
      const upLeft = y > 0 && x >= 4 ? rgba[rowOffset - stride + x - 4] : 0
      let value = raw
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += Math.floor((left + up) / 2)
      else if (filter === 4) value += paeth(left, up, upLeft)
      else assert.equal(filter, 0, `unsupported PNG filter ${filter}`)
      rgba[rowOffset + x] = value & 0xff
    }
  }

  return { width, height, rgba }
}

function alphaBounds(frame) {
  const { width, height, rgba } = decodeRgbaPng(frame)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let visiblePixels = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue
      visiblePixels++
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  return { width, height, minX, minY, maxX, maxY, visiblePixels }
}

function countNearColor(frame, target, tolerance = 32) {
  const { rgba } = decodeRgbaPng(frame)
  let count = 0
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] === 0) continue
    if (
      Math.abs(rgba[offset] - target[0]) <= tolerance
      && Math.abs(rgba[offset + 1] - target[1]) <= tolerance
      && Math.abs(rgba[offset + 2] - target[2]) <= tolerance
    ) count++
  }
  return count
}

function readIcoFrames() {
  const ico = fs.readFileSync(ICON_PATH)
  assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field')
  assert.equal(ico.readUInt16LE(2), 1, 'ICO image type')
  const count = ico.readUInt16LE(4)
  const frames = new Map()

  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16
    const width = ico[entry] || 256
    const height = ico[entry + 1] || 256
    assert.equal(width, height, 'brand icon frames must be square')
    const length = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)
    frames.set(width, ico.subarray(offset, offset + length))
  }

  return frames
}

describe('Windows brand icon safe area', () => {
  const frames = readIcoFrames()

  it('keeps every native small-icon frame centered with a visible system-sized footprint', () => {
    for (const size of [16, 24, 32, 48]) {
      assert.ok(frames.has(size), `missing ${size}px ICO frame`)
      const bounds = alphaBounds(frames.get(size))
      const inset = Math.max(1, Math.round(size * (24 / 1024)))
      assert.ok(bounds.minX >= inset, `${size}px left safe area`)
      assert.ok(bounds.minY >= inset, `${size}px top safe area`)
      assert.ok(bounds.maxX <= size - inset - 1, `${size}px right safe area`)
      assert.ok(bounds.maxY <= size - inset - 1, `${size}px bottom safe area`)
      assert.ok(bounds.visiblePixels > size * size * 0.2, `${size}px KM mark remains visible`)
      assert.ok(bounds.maxX - bounds.minX + 1 >= size * 0.75, `${size}px visible width matches system icons`)
      assert.ok(bounds.maxY - bounds.minY + 1 >= size * 0.75, `${size}px visible height matches system icons`)
      assert.ok(Math.abs(bounds.minX - (size - 1 - bounds.maxX)) <= 1, `${size}px horizontal centering`)
      assert.ok(Math.abs(bounds.minY - (size - 1 - bounds.maxY)) <= 1, `${size}px vertical centering`)
    }
  })

  it('keeps transparent rounded corners and a centered carrier in large icon frames', () => {
    for (const size of [64, 128, 256]) {
      assert.ok(frames.has(size), `missing ${size}px ICO frame`)
      const bounds = alphaBounds(frames.get(size))
      const inset = Math.max(1, Math.round(size * (24 / 1024)))
      assert.ok(bounds.minX >= inset, `${size}px left transparent edge`)
      assert.ok(bounds.minY >= inset, `${size}px top transparent edge`)
      assert.ok(bounds.maxX <= size - inset - 1, `${size}px right transparent edge`)
      assert.ok(bounds.maxY <= size - inset - 1, `${size}px bottom transparent edge`)
      assert.ok(bounds.maxX - bounds.minX + 1 >= size * 0.85, `${size}px carrier remains visually full`)
      assert.ok(bounds.maxY - bounds.minY + 1 >= size * 0.85, `${size}px carrier remains visually full`)
    }
  })

  it('keeps only the connected-mark palette in every icon frame', () => {
    for (const size of [16, 24, 32, 48, 64, 128, 256]) {
      const frame = frames.get(size)
      for (const [name, color] of Object.entries(BRAND_COLORS)) {
        assert.ok(countNearColor(frame, color) > 0, `${size}px frame keeps ${name} region`)
      }
      assert.equal(countNearColor(frame, LEGACY_SLATE, 0), 0, `${size}px frame removes rear-card slate`)
      assert.ok(
        countNearColor(frame, BRAND_COLORS.coral) < countNearColor(frame, BRAND_COLORS.ivory),
        `${size}px frame reserves coral for the single origin`,
      )
    }
  })

  it('ships the 1024px connected master with transparent rounded corners', () => {
    const master = fs.readFileSync(ICON_PNG_PATH)
    const bounds = alphaBounds(master)
    assert.deepEqual([bounds.width, bounds.height], [1024, 1024])
    assert.ok(bounds.minX >= 24, 'master left transparent edge')
    assert.ok(bounds.minY >= 24, 'master top transparent edge')
    assert.ok(bounds.maxX <= 999, 'master right transparent edge')
    assert.ok(bounds.maxY <= 999, 'master bottom transparent edge')
    for (const [name, color] of Object.entries(BRAND_COLORS)) {
      assert.ok(countNearColor(master, color) > 0, `master keeps ${name} region`)
    }
    assert.equal(countNearColor(master, LEGACY_SLATE, 0), 0, 'master removes rear-card slate')
  })

  it('keeps the system tray source inside the same transparent safe area', () => {
    const tray = fs.readFileSync(TRAY_ICON_PATH)
    const bounds = alphaBounds(tray)
    const inset = 1
    assert.deepEqual([bounds.width, bounds.height], [32, 32])
    assert.ok(bounds.minX >= inset, 'tray left safe area')
    assert.ok(bounds.minY >= inset, 'tray top safe area')
    assert.ok(bounds.maxX <= bounds.width - inset - 1, 'tray right safe area')
    assert.ok(bounds.maxY <= bounds.height - inset - 1, 'tray bottom safe area')
    assert.ok(bounds.visiblePixels > bounds.width * bounds.height * 0.5, 'tray carrier remains visible')
    assert.ok(bounds.maxX - bounds.minX + 1 >= 24, 'tray visible width matches neighboring icons')
    assert.ok(bounds.maxY - bounds.minY + 1 >= 24, 'tray visible height matches neighboring icons')
    for (const [name, color] of Object.entries(BRAND_COLORS)) {
      assert.ok(countNearColor(tray, color) > 0, `tray keeps ${name} region`)
    }
    assert.equal(countNearColor(tray, LEGACY_SLATE, 0), 0, 'tray removes rear-card slate')
  })

  it('keeps the SVG master aligned with the approved five-node geometry', () => {
    const svg = fs.readFileSync(SVG_PATH, 'utf8')
    assert.match(svg, /<rect x="24" y="24" width="976" height="976" rx="196"[^>]*fill="#172535"/)
    assert.match(svg, /stroke="#F4EFE7"/)
    assert.match(svg, /stroke-width="68"/)
    assert.match(svg, /M173 190 L173 805 L559 508/)
    assert.match(svg, /M559 508 L850 181/)
    assert.match(svg, /M559 508 L850 813/)
    assert.match(svg, /fill="#F05D4E"/)
    assert.equal((svg.match(/<circle /g) || []).length, 5, 'SVG keeps exactly five nodes')
    assert.doesNotMatch(svg, /polygon|speech|back card/i)
  })

  it('loads the 32px tray source as a 2x high-DPI representation', () => {
    const mainSource = readMainEntryBundle()
    assert.match(mainSource, /nativeImage\.createFromBuffer\((?:scope\.|ctx\.)?fs\.readFileSync\((?:scope\.|ctx\.)?TRAY_ICON_PNG\)/)
    assert.match(mainSource, /\{\s*scaleFactor:\s*2\s*\}/)
  })
})
