'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const { readArtifactPreviewSource } = require('../src/lib/artifact-preview-source')

test('artifact preview resolves a local image as a renderer-safe data URL', async () => {
  const fs = {
    promises: {
      stat: async () => ({ isFile: () => true, size: 4 }),
      readFile: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    },
  }
  const result = await readArtifactPreviewSource(fs, path.win32, 'C:\\KnowMe\\generated-images\\robot.png')
  assert.equal(result.ok, true)
  assert.equal(result.source, 'data:image/png;base64,iVBORw==')
})

test('artifact preview rejects non-image paths and oversized files', async () => {
  const fs = {
    promises: {
      stat: async () => ({ isFile: () => true, size: 9 }),
      readFile: async () => Buffer.from('ignored'),
    },
  }
  assert.deepEqual(
    await readArtifactPreviewSource(fs, path.win32, 'C:\\KnowMe\\secret.txt'),
    { ok: false, error: '该文件类型不支持图片预览' },
  )
  assert.deepEqual(
    await readArtifactPreviewSource(fs, path.win32, 'C:\\KnowMe\\large.png', 8),
    { ok: false, error: '图片过大，无法直接预览' },
  )
})

