'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { imageFixture } = require('./helpers/image-fixtures')
const { validateImageBytes, MAX_IMAGE_BYTES } = require('../src/lib/image-validation')

for (const format of ['png', 'jpeg', 'gif', 'webp', 'avif']) {
  test(`real ${format} decodes; wrong MIME and truncated bytes fail`, async () => {
    const bytes = await imageFixture(format)
    const result = await validateImageBytes(bytes, `image/${format}`)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.width, 3)
    assert.equal(result.height, 2)
    assert.equal((await validateImageBytes(bytes, 'text/html')).code, 'image_mime_mismatch')
    assert.equal((await validateImageBytes(bytes, format === 'png' ? 'image/jpeg' : 'image/png')).code, 'image_mime_mismatch')
    assert.equal((await validateImageBytes(bytes.subarray(0, bytes.length - 8), `image/${format}`)).ok, false)
  })
}

test('HTML, SVG, signature-only and corrupt pixel data never pass decoding', async () => {
  for (const bytes of [Buffer.from('<html>secret</html>'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://localhost/secret"/></svg>'), Buffer.from('89504e470d0a1a0a', 'hex')]) {
    assert.equal((await validateImageBytes(bytes, 'image/png')).ok, false)
  }
  const bytes = await imageFixture()
  const idat = bytes.indexOf(Buffer.from('IDAT'))
  bytes[idat + 6] ^= 255
  assert.equal((await validateImageBytes(bytes, 'image/png')).ok, false)
  assert.equal((await validateImageBytes(Buffer.from('<svg/>'), 'image/svg+xml')).code, 'image_format_unsupported')
  const { imageFailure } = require('../src/lib/image-validation')
  assert.match(imageFailure('image_format_unsupported').message, /静态 PNG/)
  assert.match(imageFailure('image_format_unsupported').message, /APNG.*不接受/)
})

test('input bytes, dimensions, total pixels and cancellation are gated before saving', async () => {
  assert.equal((await validateImageBytes(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png')).code, 'image_budget_exceeded')
  const wide = await imageFixture('png', { width: 8193, height: 1 })
  assert.equal((await validateImageBytes(wide, 'image/png')).code, 'image_budget_exceeded')
  const bomb = await imageFixture('png', { width: 6000, height: 6000 })
  assert.equal((await validateImageBytes(bomb, 'image/png')).ok, false)
  const controller = new AbortController()
  controller.abort()
  assert.equal((await validateImageBytes(await imageFixture(), 'image/png', { signal: controller.signal })).code, 'image_cancelled')
})

test('GIF and WebP validate every animation frame and reject excessive frame counts', async () => {
  const sharp = require('sharp')
  for (const format of ['gif', 'webp']) {
    const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255])
    const bytes = await sharp(pixels, { raw: { width: 1, height: 3, channels: 3, pageHeight: 1 } }).toFormat(format).toBuffer()
    const result = await validateImageBytes(bytes, `image/${format}`)
    assert.equal(result.ok, true)
    assert.equal(result.pages, 3)
  }
  const pixels = Buffer.alloc(101 * 3)
  for (let frame = 0; frame < 101; frame += 1) pixels[frame * 3 + (frame % 2)] = 255
  const many = await sharp(pixels, { raw: { width: 1, height: 101, channels: 3, pageHeight: 1 } }).gif().toBuffer()
  assert.equal((await sharp(many, { animated: true }).metadata()).pages, 101)
  assert.equal((await validateImageBytes(many, 'image/gif')).code, 'image_budget_exceeded')
  const limit = await sharp(pixels.subarray(0, 100 * 3), { raw: { width: 1, height: 100, channels: 3, pageHeight: 1 } }).gif().toBuffer()
  const accepted = await validateImageBytes(limit, 'image/gif')
  assert.equal(accepted.ok, true)
  assert.equal(accepted.pages, 100)
})

test('animation budget counts the canvas of every frame, not only the per-frame size', async () => {
  const sharp = require('sharp')
  const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255])
  const bytes = await sharp(pixels, { raw: { width: 1, height: 3, channels: 3, pageHeight: 1 } }).gif().toBuffer()
  // Legal GIF: 3 tiny frame rectangles on a 4096x4096 logical canvas.
  bytes.writeUInt16LE(4096, 6)
  bytes.writeUInt16LE(4096, 8)
  const metadata = await sharp(bytes, { animated: true, limitInputPixels: false }).metadata()
  assert.equal(metadata.width, 1, 'sharp may shrink the logical canvas to frame content')
  assert.equal(metadata.pageHeight, 1)
  assert.equal(metadata.pages, 3)
  const { MAX_IMAGE_PIXELS } = require('../src/lib/image-validation')
  const canvasPixels = bytes.readUInt16LE(6) * bytes.readUInt16LE(8)
  assert.ok(canvasPixels <= MAX_IMAGE_PIXELS)
  assert.ok(canvasPixels * metadata.pages > MAX_IMAGE_PIXELS)
  assert.equal((await validateImageBytes(bytes, 'image/gif')).ok, false)
})

test('APNG is rejected rather than claiming the PNG decoder checked later frames', async () => {
  const png = await imageFixture()
  const animation = Buffer.alloc(20)
  animation.writeUInt32BE(8, 0)
  animation.write('acTL', 4)
  animation.writeUInt32BE(2, 8)
  const bytes = Buffer.concat([png.subarray(0, 33), animation, png.subarray(33)])
  assert.equal((await validateImageBytes(bytes, 'image/png')).ok, false)
})

test('decode admission is bounded and cancellation does not leave the queue wedged', async () => {
  const bytes = await imageFixture()
  const controller = new AbortController()
  const pending = Array.from({ length: 5 }, () => validateImageBytes(bytes, 'image/png', { signal: controller.signal }))
  controller.abort()
  const results = await Promise.all(pending)
  assert.equal(results.filter(result => result.code === 'image_decoder_busy').length, 1)
  assert.equal(results.filter(result => result.code === 'image_cancelled').length, 4)
  assert.equal((await validateImageBytes(bytes, 'image/png')).ok, true)
})

test('one active decoder plus three queued jobs retain their slots until active metadata returns after abort', async t => {
  const sharp = require('sharp')
  const bytes = await imageFixture()
  const originalMetadata = sharp.prototype.metadata
  const originalDestroy = sharp.prototype.destroy
  const instances = new WeakSet()
  let active = 0
  let maxActive = 0
  let calls = 0
  let release
  let started
  const held = new Promise(resolve => { release = resolve })
  const entered = new Promise(resolve => { started = resolve })
  t.mock.method(sharp.prototype, 'metadata', async function (...args) {
    instances.add(this)
    active += 1
    calls += 1
    maxActive = Math.max(maxActive, active)
    const metadata = await originalMetadata.apply(this, args)
    if (calls === 1) { started(); await held }
    return metadata
  })
  t.mock.method(sharp.prototype, 'destroy', function (...args) {
    if (instances.delete(this)) active -= 1
    return originalDestroy.apply(this, args)
  })
  const controller = new AbortController()
  const first = validateImageBytes(bytes, 'image/png', { signal: controller.signal })
  try {
    await entered
    const queued = Array.from({ length: 3 }, () => validateImageBytes(bytes, 'image/png'))
    assert.equal((await validateImageBytes(bytes, 'image/png')).code, 'image_decoder_busy')
    controller.abort()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls, 1, 'aborting an active native operation must not admit another decoder early')
    assert.equal((await validateImageBytes(bytes, 'image/png')).code, 'image_decoder_busy')
    release()
    assert.equal((await first).code, 'image_cancelled')
    assert.ok((await Promise.all(queued)).every(result => result.ok))
    assert.equal(calls, 4)
    assert.equal(maxActive, 1)
    assert.equal(active, 0)
  } finally { release(); await first }
})
