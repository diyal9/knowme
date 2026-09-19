'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')

const { buildImageTools, resolvePangoMcpConfig } = require('../src/lib/agent-image-tools')
const { imageFixture, mockImageRequest } = require('./helpers/image-fixtures')

describe('agent image tools', () => {
  it('RQA05 rejects HTML declared as PNG without artifacts, save receipts or raw error content', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-invalid-'))
    const result = await buildImageTools({
      userData: root, config: { url: 'https://provider.example.test/mcp' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ result: { content: [
        { type: 'image', mimeType: 'image/png', data: Buffer.from('<html>not an image</html>').toString('base64') },
        { type: 'text', text: 'Authorization: Bearer secret-test-token' },
      ] } }) }),
    }).handlers.generate_image({ prompt: 'a robot' })
    assert.equal(result.ok, false)
    assert.equal(result.artifactRefs, undefined)
    assert.equal(result.receipt, undefined)
    assert.doesNotMatch(result.text, /secret-test-token|<html>/)
    assert.deepEqual(fs.readdirSync(root), [])
  })
  it('reuses an existing Cursor Pango MCP configuration without persisting credentials', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pango-config-'))
    const file = path.join(root, 'mcp.json')
    fs.writeFileSync(file, JSON.stringify({
      mcpServers: {
        'pango-skillsrv': {
          url: 'https://pango.example.test/mcp',
          headers: { Authorization: 'Bearer test-token' },
        },
      },
    }))

    const result = resolvePangoMcpConfig({ configFiles: [file] })

    assert.equal(result.ok, true)
    assert.equal(result.url, 'https://pango.example.test/mcp')
    assert.equal(result.headers.Authorization, 'Bearer test-token')
    assert.match(result.source, /^cursor:/)
  })

  it('prefers the enabled Capability Hub Pango connector and resolves its secure token at runtime', () => {
    const result = resolvePangoMcpConfig({
      connector: {
        id: 'pango-image-mcp',
        type: 'mcp',
        enabled: true,
        agentVisible: true,
        mcp: { url: 'https://pango-hub.example.test/mcp' },
      },
      runtimeOptions: { accessToken: 'hub-token' },
    })

    assert.equal(result.ok, true)
    assert.equal(result.source, 'connector:pango-image-mcp')
    assert.equal(result.url, 'https://pango-hub.example.test/mcp')
    assert.equal(result.headers.Authorization, 'Bearer hub-token')
  })

  it('persists inline MCP image content and returns real image artifact refs', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pango-image-'))
    const bytes = await imageFixture()
    const payload = bytes.toString('base64')
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          content: [
            { type: 'text', text: 'model=gpt-image-2; size=1K' },
            { type: 'image', mimeType: 'image/png', data: payload },
          ],
        },
      }),
    })
    const tools = buildImageTools({
      runId: 'run-image-test',
      userData,
      config: { url: 'https://pango.example.test/mcp', headers: { Authorization: 'Bearer test-token' } },
      fetchImpl,
    })

    const result = await tools.handlers.generate_image({ prompt: 'a clear product hero', aspect_ratio: '16:9' })

    assert.equal(result.ok, true)
    assert.equal(result.artifactRefs.length, 1)
    assert.equal(result.artifactRefs[0].type, 'image')
    assert.equal(result.artifactRefs[0].mimeType, 'image/png')
    assert.deepEqual(fs.readFileSync(result.artifactRefs[0].targetPath), bytes)
    assert.match(result.text, /已生成 1 张图片/)
  })

  it('does not accept a text-only generation response as an image result', async () => {
    const tools = buildImageTools({
      runId: 'run-no-image',
      userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pango-empty-')),
      config: { url: 'https://pango.example.test/mcp' },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: { content: [{ type: 'text', text: '稍后再生成' }] } }),
      }),
    })

    const result = await tools.handlers.generate_image({ prompt: 'a cat' })

    assert.equal(result.ok, false)
    assert.equal(result.code, 'pango_no_image')
    assert.equal(result.artifactRefs, undefined)
  })

  it('downloads and decodes a CDN image before saving and issuing a receipt', async () => {
    const imageUrl = 'https://base-gz-static.forevernine.com/cdn_url_path/pang-gen/build_prod/result-001.jpg'
    const bytes = await imageFixture('jpeg')
    const tools = buildImageTools({
      runId: 'run-image-url',
      userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pango-url-')),
      config: { url: 'https://pango.example.test/mcp' },
      imageDownload: {
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        requestImpl: mockImageRequest([{ bytes, headers: { 'content-type': 'image/jpeg' } }]),
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: { content: [{ type: 'text', text: `预览链接：${imageUrl}` }] } }),
      }),
    })

    const result = await tools.handlers.generate_image({ prompt: 'a robot icon' })

    assert.equal(result.ok, true)
    assert.equal(result.artifactRefs.length, 1)
    assert.equal(result.artifactRefs[0].type, 'image')
    assert.deepEqual(fs.readFileSync(result.artifactRefs[0].targetPath), bytes)
    assert.equal(result.artifactRefs[0].mimeType, 'image/jpeg')
    assert.deepEqual(result.receipt.effects, [{ type: 'save', target: result.artifactRefs[0].id }])
    assert.match(result.text, /预览已附在成果区/)
    assert.doesNotMatch(result.text, /forevernine\.com/)
  })

  it('mixed valid and invalid images only receipt successfully decoded saved files', async () => {
    const bytes = await imageFixture('webp')
    let calls = 0
    const result = await buildImageTools({
      userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-mixed-images-')),
      config: { url: 'https://pango.example.test/mcp' },
      fetchImpl: async () => {
        calls += 1
        return { ok: true, json: async () => ({ result: { content: [
          { type: 'image', mimeType: 'image/png', data: Buffer.from('<html/>').toString('base64') },
          { type: 'image', mimeType: 'image/webp', data: bytes.toString('base64') },
          { type: 'image', mimeType: 'image/png', data: '%%%%' },
        ] } }) }
      },
    }).handlers.generate_image({ prompt: 'robot', n: 3 })
    assert.equal(result.ok, true)
    assert.equal(calls, 1, 'validation failure never regenerates a side effect')
    assert.equal(result.artifactRefs.length, 1)
    assert.deepEqual(fs.readFileSync(result.artifactRefs[0].targetPath), bytes)
    assert.deepEqual(result.receipt.effects, [{ type: 'save', target: result.artifactRefs[0].id }])
    assert.equal(result.meta.rejectedImages.length, 2)
    assert.match(result.text, /2.*未保存/)
  })

  it('a URL returning HTML is not an artifact; invalid inline data cannot fall back to unchecked URLs', async () => {
    for (const inline of [false, true]) {
      const seen = []
      const result = await buildImageTools({
        userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-invalid-url-')),
        config: { url: 'https://pango.example.test/mcp' },
        imageDownload: { lookup: async () => [{ address: '93.184.216.34', family: 4 }], requestImpl: mockImageRequest([{ bytes: Buffer.from('<html/>') }], seen) },
        fetchImpl: async () => ({ ok: true, json: async () => ({ result: { content: [
          ...(inline ? [{ type: 'image', data: 'invalid' }] : []),
          { type: 'text', text: 'https://images.example.test/not-an-image.png' },
        ] } }) }),
      }).handlers.generate_image({ prompt: 'robot' })
      assert.equal(result.ok, false)
      assert.equal(result.artifactRefs, undefined)
      assert.equal(result.receipt, undefined)
      assert.equal(seen.length, inline ? 0 : 1)
    }
  })

  it('disk errors are safe and never issue receipts; corrupted cached files are not trusted', async () => {
    const { persistImageBlocks } = require('../src/lib/agent-image-tools')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-disk-'))
    const data = (await imageFixture()).toString('base64')
    const content = [{ type: 'image', mimeType: 'image/png', data }]
    const saved = await persistImageBlocks(content, { userData: root })
    fs.writeFileSync(saved.artifactRefs[0].targetPath, '<html/>')
    const corrupt = await persistImageBlocks(content, { userData: root })
    assert.equal(corrupt.ok, false)
    assert.equal(corrupt.code, 'image_save_failed')
    const badDir = path.join(root, 'private-secret-token')
    fs.writeFileSync(badDir, 'not a directory')
    const failed = await persistImageBlocks(content, { userData: badDir })
    assert.equal(failed.code, 'image_save_failed')
    assert.equal(failed.artifactRefs, undefined)
    assert.doesNotMatch(failed.message, /private-secret-token|ENOENT|ENOTDIR|stack/i)
  })

  it('bounds large base64 before decoding and safely rejects malformed padding and empty image blocks', async () => {
    const { persistImageBlocks } = require('../src/lib/agent-image-tools')
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-base64-'))
    for (const data of ['', 'AA=A', 'A'.repeat(1024 * 1024), 'A'.repeat(32 * 1024 * 1024 + 4)]) {
      const result = await persistImageBlocks([{ type: 'image', data, mimeType: 'image/png' }], { userData })
      assert.equal(result.ok, false)
      assert.equal(result.artifactRefs, undefined)
    }
    assert.deepEqual(fs.readdirSync(userData), [])
  })

  it('all accepted formats save their original decoded bytes; conflicting data-URL MIME is rejected', async () => {
    const { persistImageBlocks } = require('../src/lib/agent-image-tools')
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-formats-'))
    for (const format of ['png', 'jpeg', 'gif', 'webp', 'avif']) {
      const bytes = await imageFixture(format)
      const mimeType = `image/${format}`
      const data = `data:${mimeType};base64,${bytes.toString('base64')}`
      const result = await persistImageBlocks([{ type: 'image', mimeType, data }], { userData })
      assert.equal(result.ok, true, format)
      assert.equal(result.artifactRefs[0].mimeType, mimeType)
      assert.deepEqual(fs.readFileSync(result.artifactRefs[0].targetPath), bytes)
      const invalid = await persistImageBlocks([{ type: 'image', mimeType: 'image/other', data }], { userData })
      assert.equal(invalid.code, 'image_mime_mismatch')
      assert.equal(invalid.artifactRefs, undefined)
    }
  })
})
