'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const sharp = require('sharp')
const { buildImageTools } = require('../src/lib/agent-image-tools')
const { buildMediaObservation } = require('../src/lib/agent-media-resources')
const { describeImageMetadata } = require('../src/lib/image-artifact-metadata')
const { normalizeArtifact } = require('../src/lib/agent-run')
const { imageFixture, mockImageRequest } = require('./helpers/image-fixtures')

function setup(t, content, extra = {}) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-metadata-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  return buildImageTools({ userData, runId: 'metadata',
    config: { url: 'https://provider.example.test/mcp' },
    fetchImpl: async () => ({ ok: true, json: async () => ({ result: { content } }) }),
    ...extra,
  }).handlers.generate_image
}

for (const format of ['png', 'jpeg', 'gif', 'webp', 'avif']) {
  test(`RQA25 ${format}: receipt uses decoded pixels, not requested or provider-claimed dimensions`, async t => {
    const bytes = await imageFixture(format, { width: 31, height: 47 })
    const generate = setup(t, [
      { type: 'text', text: 'size=1080x1440; width=1080; height=1440' },
      { type: 'image', mimeType: `image/${format}`, data: bytes.toString('base64'), width: 1080, height: 1440 },
    ])
    const result = await generate({ prompt: 'test', size: '1080x1440' })
    assert.equal(result.ok, true)
    const artifact = result.artifactRefs[0]
    assert.deepEqual(artifact.meta.image, {
      protocol: 'knowme.image-metadata/v1', source: 'decoded-file',
      width: 31, height: 47, frames: 1, mimeType: `image/${format}`, byteLength: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    })
    assert.deepEqual(fs.readFileSync(artifact.targetPath), bytes, 'do not rescale the output to claim compliance')
    assert.match(result.text, /实际图片.*31 × 47 px/)
    assert.match(result.text, /不代表画面内容已通过验收/)
    assert.deepEqual(result.receipt.images, [{ artifactId: artifact.id, ...artifact.meta.image }])
    assert.deepEqual(normalizeArtifact(artifact).meta.image, artifact.meta.image, 'metadata survives generic artifact normalization')
    for (const supportsVision of [false, true]) {
      const observed = await buildMediaObservation([normalizeArtifact(artifact)], { supportsVision })
      assert.match(observed.filter(item => item.type === 'text').map(item => item.text).join('\n'), /31 × 47 px/)
      assert.equal(observed.some(item => item.type === 'image_url'), supportsVision)
    }
  })
}

test('RQA25 downloaded image metadata has the same contract as inline bytes', async t => {
  const bytes = await imageFixture('jpeg', { width: 1088, height: 1440 })
  const generate = setup(t, [{ type: 'text', text: 'https://cdn.example.test/output.jpg' }], {
    imageDownload: {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      requestImpl: mockImageRequest([{ bytes, headers: { 'content-type': 'image/jpeg' } }]),
    },
  })
  const result = await generate({ prompt: 'test', size: '1080x1440' })
  assert.equal(result.ok, true)
  assert.equal(result.artifactRefs[0].meta.image.width, 1088)
  assert.match(result.text, /1088 × 1440 px/)
  assert.doesNotMatch(result.text, /https:\/\//)
})

test('RQA25 EXIF rotation reports displayed dimensions without altering original bytes', async t => {
  const bytes = await sharp(await imageFixture('jpeg', { width: 31, height: 47 }))
    .withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const result = await setup(t, [{ type: 'image', mimeType: 'image/jpeg', data: bytes.toString('base64') }])({ prompt: 'test' })
  assert.equal(result.ok, true)
  assert.equal(result.artifactRefs[0].meta.image.width, 47)
  assert.equal(result.artifactRefs[0].meta.image.height, 31)
  assert.deepEqual(fs.readFileSync(result.artifactRefs[0].targetPath), bytes)
})

test('RQA25 animation reports logical canvas and frame count, not stacked decoder height', async t => {
  const bytes = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]),
    { raw: { width: 1, height: 2, channels: 3, pageHeight: 1 } }).gif().toBuffer()
  bytes.writeUInt16LE(5, 6)
  bytes.writeUInt16LE(7, 8)
  const result = await setup(t, [{ type: 'image', mimeType: 'image/gif', data: bytes.toString('base64') }])({ prompt: 'test' })
  assert.equal(result.ok, true)
  assert.equal(result.artifactRefs[0].meta.image.width, 5)
  assert.equal(result.artifactRefs[0].meta.image.height, 7)
  assert.equal(result.artifactRefs[0].meta.image.frames, 2)
  assert.match(result.text, /2 帧/)
})

test('RQA25 malformed bytes never yield a metadata receipt; partial batch includes only saved outputs', async t => {
  const invalid = { type: 'image', mimeType: 'image/png', data: Buffer.from('not-an-image').toString('base64'), width: 1080, height: 1440 }
  const failed = await setup(t, [invalid])({ prompt: 'test' })
  assert.equal(failed.ok, false)
  assert.equal(failed.receipt, undefined)
  assert.equal(failed.artifactRefs, undefined)
  const bytes = await imageFixture()
  const partial = await setup(t, [invalid, { type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }])({ prompt: 'test' })
  assert.equal(partial.artifactRefs.length, 1)
  assert.equal(partial.receipt.images.length, 1)
  assert.match(partial.text, /1 张图片因校验/)
  assert.match(partial.text, /3 × 2 px/)
  assert.doesNotMatch(partial.text, /1080/)
})

test('RQA25 legacy or malformed metadata is not promoted to measured dimensions', async () => {
  for (const image of [undefined, { width: 1080, height: 1440 },
    { protocol: 'knowme.image-metadata/v1', source: 'provider', width: 1080, height: 1440 },
    { protocol: 'knowme.image-metadata/v1', source: 'decoded-file', width: -1, height: Infinity }]) {
    const observed = await buildMediaObservation([{ id: 'legacy', type: 'image', meta: { image } }])
    const text = observed.map(item => item.text).join('\n')
    assert.doesNotMatch(text, /实际图片|1080 × 1440|Infinity/)
    assert.match(text, /不能声称已核对画面/)
  }
})

test('RQA25 JSON metadata with array/object MIME, hash or resource ID is rejected without coercion', async () => {
  const image = { protocol: 'knowme.image-metadata/v1', source: 'decoded-file',
    width: 31, height: 47, frames: 1, byteLength: 100, mimeType: 'image/png', sha256: 'a'.repeat(64) }
  for (const field of ['mimeType', 'sha256', 'id']) {
    for (const value of [[field === 'mimeType' ? 'image/png' : 'a'.repeat(64)], {}, { toString: null }]) {
      const artifact = { id: 'test', type: 'image', meta: { image: { ...image } } }
      if (field === 'id') artifact.id = value
      else artifact.meta.image[field] = value
      assert.equal(describeImageMetadata(artifact), '')
      for (const supportsVision of [false, true]) {
        const observation = await buildMediaObservation([artifact], { supportsVision })
        assert.doesNotMatch(observation.map(item => item.text).join('\n'), /实际图片/)
      }
    }
  }
})
