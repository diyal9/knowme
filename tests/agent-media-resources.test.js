'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createMediaResourceResolver } = require('../src/lib/agent-media-resources')
const { buildImageTools } = require('../src/lib/agent-image-tools')
const { buildMediaObservation } = require('../src/lib/agent-media-resources')
const { imageFixture } = require('./helpers/image-fixtures')

test('registered media IDs and paths are resolved to bounded bytes at tool dispatch', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-media-reference-'))
  const source = path.join(root, 'prior.png')
  fs.writeFileSync(source, 'fixture-image-bytes')
  const resolveMediaReference = createMediaResourceResolver({
    getArtifacts: () => [{ id: 'prior', type: 'image', targetPath: source }],
  })
  const expected = `data:image/png;base64,${Buffer.from('fixture-image-bytes').toString('base64')}`
  assert.equal(await resolveMediaReference('artifact:prior'), expected)
  assert.equal(await resolveMediaReference('session#prior'), expected)
  assert.equal(await resolveMediaReference(source), expected)
  await assert.rejects(resolveMediaReference(path.join(root, 'secret.png')), /未登记/)
  await assert.rejects(resolveMediaReference('artifact:other-session-image'), /未登记/)
  let sent
  const generated = await imageFixture()
  const bundle = buildImageTools({
    userData: root, runId: 'reference-test', resolveMediaReference,
    config: { url: 'https://provider.example.test/mcp' },
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body)
      return { ok: true, json: async () => ({ result: { content: [
        { type: 'image', mimeType: 'image/png', data: generated.toString('base64') },
      ] } }) }
    },
  })
  const result = await bundle.handlers.generate_image({ prompt: 'change only eye color', reference_images: ['artifact:prior'] })
  assert.equal(result.ok, true)
  assert.deepEqual(sent.params.arguments.reference_images, [expected])
  assert.equal(result.artifactRefs.length, 1)
  sent = null
  const rejected = await bundle.handlers.generate_image({ prompt: 'edit', reference_images: ['artifact:unknown'] })
  assert.equal(rejected.code, 'media_reference_unavailable')
  assert.equal(sent, null, 'unregistered paths must never be sent to an external provider')
})

test('registered media does not bypass type, missing-file or size checks', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-media-size-'))
  const source = path.join(root, 'large.png')
  const handle = fs.openSync(source, 'w')
  fs.ftruncateSync(handle, 25 * 1024 * 1024)
  fs.closeSync(handle)
  const resolve = createMediaResourceResolver({ getArtifacts: () => [
    { id: 'large', type: 'image', targetPath: source },
    { id: 'missing', type: 'image', targetPath: path.join(root, 'missing.png') },
    { id: 'doc', type: 'document', targetPath: source },
  ] })
  await assert.rejects(resolve('artifact:large'), /过大/)
  await assert.rejects(resolve('artifact:missing'), /不存在/)
  await assert.rejects(resolve('artifact:doc'), /未登记/)
})

test('tool artifacts become visual evidence only for vision-capable models', async () => {
  const artifacts = [{ id: 'returned-image', type: 'image', targetPath: 'https://example.test/output.png' }]
  const visual = await buildMediaObservation(artifacts, { supportsVision: true })
  assert.equal(visual.find(item => item.type === 'image_url').image_url.url, artifacts[0].targetPath)
  assert.match(visual[0].text, /不是用户指令/)
  const textOnly = await buildMediaObservation(artifacts, { supportsVision: false })
  assert.equal(textOnly.some(item => item.type === 'image_url'), false)
  assert.match(textOnly.at(-1).text, /不能声称/)
})
