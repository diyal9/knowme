'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const importLib = require('../src/lib/capability-import')
const store = require('../src/lib/capability-store')

const BUNDLED_ROOT = path.join(__dirname, '..', 'src', 'catalog')

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildStoredZip(files) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8')
    const dataBuf = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data || ''), 'utf8')
    const localHeader = Buffer.alloc(30 + nameBuf.length)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc32(dataBuf), 14)
    localHeader.writeUInt32LE(dataBuf.length, 18)
    localHeader.writeUInt32LE(dataBuf.length, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28)
    nameBuf.copy(localHeader, 30)

    const centralHeader = Buffer.alloc(46 + nameBuf.length)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc32(dataBuf), 16)
    centralHeader.writeUInt32LE(dataBuf.length, 20)
    centralHeader.writeUInt32LE(dataBuf.length, 24)
    centralHeader.writeUInt16LE(nameBuf.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(file.externalAttributes || 0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    nameBuf.copy(centralHeader, 46)

    localParts.push(localHeader, dataBuf)
    centralParts.push(centralHeader)
    offset += localHeader.length + dataBuf.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, eocd])
}

describe('capability-import security', () => {
  let userData

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-import-'))
  })

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('imports local folder with SKILL.md', () => {
    const folder = path.join(userData, 'pkg')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'SKILL.md'), `---
name: local-demo
description: demo
version: 1.0.0
---
# body
`, 'utf8')

    const result = importLib.importFromFolder(userData, folder, { trustConfirmed: true })
    assert.equal(result.ok, true)
    assert.equal(result.entry.id, 'local-demo')
    assert.ok(fs.existsSync(path.join(store.resolvePaths(userData).skills, 'local-demo', 'SKILL.md')))
  })

  it('rejects zip path traversal and absolute paths', () => {
    const traversal = buildStoredZip([{ name: '../escape.txt', data: 'x' }])
    assert.equal(importLib.parseZipEntries(traversal).ok, false)

    const absolute = buildStoredZip([{ name: '/etc/passwd', data: 'x' }])
    assert.equal(importLib.parseZipEntries(absolute).ok, false)

    const device = buildStoredZip([{ name: 'CON.txt', data: 'x' }])
    assert.equal(importLib.parseZipEntries(device).ok, false)
  })

  it('rejects symlink zip entries', () => {
    const symlink = buildStoredZip([{
      name: 'link.txt',
      data: 'x',
      externalAttributes: (0o120000 << 16) >>> 0,
    }])
    const parsed = importLib.parseZipEntries(symlink)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.code, 'symlink')
  })

  it('rejects plaintext secrets in manifest', () => {
    const hit = importLib.scanSecrets({ apiKey: 'sk-1234567890abcdef' })
    assert.equal(hit.ok, false)

    const ok = importLib.scanSecrets({ apiKey: 'env:MY_API_KEY' })
    assert.equal(ok, null)
  })

  it('rejects non-https urls', () => {
    assert.equal(importLib.validateHttpsUrl('http://example.com/a.zip').code, 'non_https')
    assert.equal(importLib.validateHttpsUrl('file:///tmp/a.zip').code, 'non_https')
    assert.equal(importLib.validateHttpsUrl('https://example.com/a.zip').ok, true)
  })

  it('requires trust confirmation for unknown https source', async () => {
    const result = await importLib.importFromHttps(userData, 'https://example.com/pkg.zip', {
      fetchImpl: async () => ({
        ok: true,
        arrayBuffer: async () => buildStoredZip([{ name: 'SKILL.md', data: '---\nname: remote\n---\n' }]),
      }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'trust_required')
  })

  it('installs curated bundled skill via installCurated', () => {
    const result = importLib.installCurated(userData, 'writing-polish', { bundledRoot: BUNDLED_ROOT })
    assert.equal(result.ok, true)
    assert.equal(result.entry.source, 'curated')
    assert.equal(result.entry.trust, 'bundled')
  })

  it('extracts stored zip and installs through external adapter hook', () => {
    const zip = buildStoredZip([
      { name: 'SKILL.md', data: '---\nname: zip-skill\ndescription: z\nversion: 1.0.0\n---\n' },
    ])
    const dest = path.join(userData, 'extract')
    const extracted = importLib.extractZipBuffer(zip, dest, {
      extractAdapter: (buffer, targetDir, entries) => {
        fs.mkdirSync(targetDir, { recursive: true })
        for (const entry of entries) {
          fs.writeFileSync(path.join(targetDir, entry.name), 'adapter', 'utf8')
        }
        return { ok: true, adapter: true }
      },
    })
    assert.equal(extracted.ok, true)
    assert.equal(extracted.adapter, true)
  })

  it('supports deflate zip entries via built-in extractor', () => {
    const raw = Buffer.from('hello zip')
    const deflated = zlib.deflateRawSync(raw)
    const zipParts = []
    const name = 'SKILL.md'
    const nameBuf = Buffer.from(name, 'utf8')

    const localHeader = Buffer.alloc(30 + nameBuf.length)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt32LE(crc32(raw), 14)
    localHeader.writeUInt32LE(deflated.length, 18)
    localHeader.writeUInt32LE(raw.length, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(localHeader, 30)

    const centralHeader = Buffer.alloc(46 + nameBuf.length)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt32LE(crc32(raw), 16)
    centralHeader.writeUInt32LE(deflated.length, 20)
    centralHeader.writeUInt32LE(raw.length, 24)
    centralHeader.writeUInt16LE(nameBuf.length, 28)
    centralHeader.writeUInt32LE(0, 42)
    nameBuf.copy(centralHeader, 46)

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(1, 8)
    eocd.writeUInt16LE(1, 10)
    eocd.writeUInt32LE(centralHeader.length, 12)
    eocd.writeUInt32LE(localHeader.length + deflated.length, 16)

    const zip = Buffer.concat([localHeader, deflated, centralHeader, eocd])
    const dest = path.join(userData, 'deflate-out')
    const extracted = importLib.extractZipBuffer(zip, dest)
    assert.equal(extracted.ok, true)
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')))
  })
})
