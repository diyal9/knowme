'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  PNG_BASE64,
  PNG_HEIGHT,
  PNG_VARIANTS,
  PNG_WIDTH,
  chatCompletion,
  mcpResult,
} = require('../scripts/qualification-image-fixture-server')

test('image qualification fixture returns a visible-sized deterministic PNG', () => {
  const bytes = Buffer.from(PNG_BASE64, 'base64')
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(bytes.readUInt32BE(16), PNG_WIDTH)
  assert.equal(bytes.readUInt32BE(20), PNG_HEIGHT)
  assert.equal(PNG_WIDTH, 256)
  assert.equal(PNG_HEIGHT, 256)
  assert.notEqual(PNG_VARIANTS[0], PNG_VARIANTS[1], 'revision fixture must produce a distinct version')
})

test('image qualification fixture keeps tool-first generation and revision references', () => {
  const first = chatCompletion({ messages: [{ role: 'user', content: '生成一张图片' }] })
  assert.equal(first.choices[0].finish_reason, 'tool_calls')
  assert.equal(first.choices[0].message.tool_calls[0].function.name, 'generate_image')

  const revised = chatCompletion({
    messages: [
      { role: 'user', content: '上一版 artifact:image_01，请只修改背景' },
    ],
  })
  const args = JSON.parse(revised.choices[0].message.tool_calls[0].function.arguments)
  assert.deepEqual(args.reference_images, ['artifact:image_01'])
})

test('image qualification fixture returns a real image block and preserves no-image failure', () => {
  const result = mcpResult({ method: 'tools/call', params: { name: 'generate_image', arguments: {} } })
  assert.equal(result.content[0].type, 'image')
  assert.equal(result.content[0].mimeType, 'image/png')
  assert.equal(result.content[0].data, PNG_BASE64)

  const failed = mcpResult({ method: 'tools/call', params: { name: 'generate_image', arguments: { prompt: '不返回图片' } } })
  assert.equal(failed.content.some(item => item.type === 'image'), false)
  assert.match(failed.content[0].text, /不返回图片数据/)
})
