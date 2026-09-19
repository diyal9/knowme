'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { buildChatMessages } = require('../src/lib/ai-assistant-context')
const { createMediaResourceResolver } = require('../src/lib/agent-media-resources')
const { normalizeBrief } = require('../src/lib/workbench-task-store')
const { imageFixture } = require('./helpers/image-fixtures')

test('user attachment exposes a stable reference resolving exactly the same bytes after task reopen', async () => {
  const bytes = await imageFixture()
  const image = { kind: 'image', name: 'original.png', title: 'original.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
  const reference = `attachment:image_${crypto.createHash('sha256').update(bytes).digest('hex')}`
  const messages = buildChatMessages({ prompt: 'Only edit the background', imageAttachments: [image] })
  const content = messages.at(-1).content
  assert.match(content.filter(x => x.type === 'text').map(x => x.text).join('\n'), new RegExp(reference))
  assert.equal(content.find(x => x.type === 'image_url').image_url.url, image.dataUrl)
  const reloaded = normalizeBrief(JSON.parse(JSON.stringify({ brief: { materials: [image] } })))
  const resolve = createMediaResourceResolver({ getAttachments: () => reloaded.materials })
  assert.equal(await resolve(reference), image.dataUrl)
  await assert.rejects(createMediaResourceResolver()(reference), /未登记/)
  await assert.rejects(resolve('original.png'), /未登记/, 'filename is not authority')
  await assert.rejects(resolve('D:/private/original.png'), /未登记/, 'attachment cannot authorize arbitrary local paths')
})

test('multiple attachments pair each visible image with its own reference, never by a shared filename', async () => {
  const a = await imageFixture('png', { width: 2, height: 3 })
  const b = await imageFixture('png', { width: 3, height: 2 })
  const images = [a, b].map(bytes => ({ kind: 'image', name: 'same.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }))
  const content = buildChatMessages({ prompt: 'Compare these', imageAttachments: images }).at(-1).content
  const resolve = createMediaResourceResolver({ getAttachments: () => images })
  for (const [i, bytes] of [a, b].entries()) {
    const ref = `attachment:image_${crypto.createHash('sha256').update(bytes).digest('hex')}`
    const index = content.findIndex(x => x.type === 'text' && x.text.includes(ref))
    assert.ok(index >= 0)
    assert.equal(content[index + 1].type, 'image_url')
    assert.equal(content[index + 1].image_url.url, images[i].dataUrl)
    assert.equal(await resolve(ref), images[i].dataUrl)
  }
})

test('text-only messages retain the existing content without attachment metadata', () => {
  const messages = buildChatMessages({ prompt: 'Hello', history: [{ role: 'user', text: 'Earlier' }] })
  assert.equal(messages.at(-1).content, 'Hello')
  assert.equal(messages.at(-2).content, 'Earlier')
})

test('changed, malformed, oversized, omitted and non-image attachments cannot reuse an input reference', async () => {
  const { imageAttachmentResource, imageAttachmentResources } = require('../src/lib/image-attachment-resources')
  const { MAX_IMAGE_BYTES } = require('../src/lib/image-validation')
  const bytes = await imageFixture()
  const image = { kind: 'image', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
  const ref = imageAttachmentResource(image).reference
  for (const bad of [
    { ...image, kind: 'document' },
    { ...image, dataUrl: 'file:///private/picture.png' },
    { ...image, dataUrl: 'data:image/png;base64,AB==' },
    { ...image, dataUrl: `data:image/png;base64,${'A'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 128)}` },
  ]) {
    assert.equal(imageAttachmentResource(bad), null)
    await assert.rejects(createMediaResourceResolver({ getAttachments: () => [bad] })(ref), /未登记/)
  }
  const other = { ...image, dataUrl: `data:image/png;base64,${(await imageFixture('png', { width: 5, height: 7 })).toString('base64')}` }
  const firstThree = [other, other, other, image]
  assert.equal(imageAttachmentResources(firstThree).length, 3)
  await assert.rejects(createMediaResourceResolver({ getAttachments: () => firstThree })(ref), /未登记/)
  await assert.rejects(createMediaResourceResolver({ getAttachments: () => [other] })(ref), /未登记/)
})

test('actual context finalization and token fitting retain the reference beside its image', async () => {
  const { finalizeAgentContext } = require('../src/lib/agent-context-finalize')
  const bytes = await imageFixture()
  const image = { kind: 'image', name: 'reference.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
  const result = finalizeAgentContext({ prepared: {
    modelProfile: { model: 'test-model', contextWindow: 32000, supportsTools: true },
    contextDraft: { version: 2, tier: 'retrieval', executionPolicy: 'tools-allowed',
      staticCapabilityIds: [], policyInput: { tier: 'retrieval', scene: 'expert-collaboration', phase: 'execution' },
      blocks: [], query: 'Edit this reference', contextBudget: 6000, inputBudget: 8000,
      history: [], prompt: 'Edit this reference', imageAttachments: [image], infoBase: {},
    },
  }, toolRecords: [] })
  const content = result.apiMessages.at(-1).content
  const ref = `attachment:image_${crypto.createHash('sha256').update(bytes).digest('hex')}`
  const index = content.findIndex(x => x.type === 'text' && x.text.includes(ref))
  assert.ok(index >= 0)
  assert.equal(content[index + 1].image_url.url, image.dataUrl)
})
