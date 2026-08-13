'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const harness = require('../src/lib/llmwiki-harness')

describe('llmwiki-operation-harness', () => {
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-llmwiki-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true })
    } catch { /* cleanup */ }
  })

  it('initializes an empty versioned root idempotently without example facts', () => {
    const first = harness.ensureRoot(root)
    const second = harness.ensureRoot(root)

    assert.equal(first.ok, true)
    assert.equal(first.created, true)
    assert.equal(second.ok, true)
    assert.equal(second.created, false)
    assert.ok(fs.existsSync(path.join(root, 'raw')))
    assert.ok(fs.existsSync(path.join(root, 'concepts')))
    assert.ok(fs.existsSync(path.join(root, '.knowme', 'llmwiki.json')))
    assert.deepEqual(fs.readdirSync(path.join(root, 'raw')), [])
    assert.deepEqual(fs.readdirSync(path.join(root, 'concepts')), [])

    const report = harness.inspectRoot(root)
    assert.equal(report.ok, true)
    assert.equal(report.schemaVersion, harness.SCHEMA_VERSION)
    assert.deepEqual(report.stats, { rawFiles: 0, concepts: 0, scanned: 0 })
  })

  it('confines raw paths and rejects unsupported file types', () => {
    harness.ensureRoot(root)

    assert.equal(harness.writeRaw(root, {
      path: '../escape.md',
      content: 'no',
    }).code, 'raw_path_required')
    assert.equal(harness.writeRaw(root, {
      path: 'concepts/not-raw.md',
      content: 'no',
    }).code, 'raw_path_required')
    assert.equal(harness.writeRaw(root, {
      path: 'raw/binary.exe',
      content: 'no',
    }).code, 'unsupported_file_type')
    assert.equal(fs.existsSync(path.join(root, '..', 'escape.md')), false)
  })

  it('creates, reads and atomically updates raw content with optimistic concurrency', () => {
    const created = harness.createRaw(root, {
      title: '支付约定',
      content: '# 支付约定\n\n统一收银台。\n',
    })
    assert.equal(created.ok, true)
    assert.match(created.path, /^raw\/支付约定\.md$/)

    const read = harness.readRaw(root, created.path)
    assert.equal(read.ok, true)
    assert.equal(read.hash, created.hash)

    const missingHash = harness.writeRaw(root, {
      path: created.path,
      content: '# 修改\n',
    })
    assert.equal(missingHash.code, 'expected_hash_required')

    const stale = harness.writeRaw(root, {
      path: created.path,
      content: '# 错误覆盖\n',
      expectedHash: 'not-current',
    })
    assert.equal(stale.code, 'stale_content')
    assert.equal(harness.readRaw(root, created.path).content, read.content)

    const saved = harness.writeRaw(root, {
      path: created.path,
      content: '# 支付约定\n\n新的约定。\n',
      expectedHash: read.hash,
    })
    assert.equal(saved.ok, true)
    assert.notEqual(saved.hash, read.hash)
    assert.equal(harness.readRaw(root, created.path).content, '# 支付约定\n\n新的约定。\n')
    assert.equal(
      fs.readdirSync(path.join(root, 'raw')).some(name => name.includes('.knowme-')),
      false
    )
  })

  it('reports invalid files and symlinks as machine-readable issues', (t) => {
    harness.ensureRoot(root)
    fs.writeFileSync(path.join(root, 'raw', 'blocked.bin'), 'x')
    try {
      fs.symlinkSync(path.join(root, 'concepts'), path.join(root, 'raw', 'linked'), 'junction')
    } catch {
      t.diagnostic('symlink creation unavailable; file-type report still verified')
    }

    const report = harness.inspectRoot(root)
    assert.equal(report.ok, false)
    assert.ok(report.checkedAt)
    assert.ok(report.issues.some(issue => issue.type === 'unsupported_file_type'))
    if (fs.existsSync(path.join(root, 'raw', 'linked'))) {
      assert.ok(report.issues.some(issue => issue.type === 'symlink_forbidden'))
    }
  })

  it('rejects oversized raw content', () => {
    harness.ensureRoot(root)
    const result = harness.writeRaw(root, {
      path: 'raw/large.md',
      content: 'x'.repeat(harness.MAX_RAW_BYTES + 1),
    })
    assert.equal(result.code, 'content_too_large')
    assert.equal(fs.existsSync(path.join(root, 'raw', 'large.md')), false)
  })
})
