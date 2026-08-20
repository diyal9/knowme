/**
 * Logger module — JSONL 落盘、分类、脱敏、查询。
 */
const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const os = require('os')
const fs = require('fs')
const logger = require('../src/lib/logger')

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-log-'))
}

describe('logger', () => {
  let dir
  let tempDirs
  beforeEach(() => {
    logger._reset()
    tempDirs = []
    dir = tmpDir(); tempDirs.push(dir)
    logger.init({ dir, level: 'debug', mirrorConsole: false })
  })
  afterEach(() => {
    logger._reset()
    for (const tempDir of tempDirs) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes JSONL entries that can be queried by category', () => {
    logger.operation('note-create', '新建便签', { id: 'n_1' })
    logger.llm('llm-request', '调用模型', { model: 'gpt-4o' })
    const res = logger.query({ category: 'llm' })
    assert.equal(res.total, 1)
    assert.equal(res.entries[0].category, 'llm')
    assert.equal(res.entries[0].event, 'llm-request')
    assert.equal(res.entries[0].meta.model, 'gpt-4o')
  })

  it('redacts sensitive keys and secret-like strings', () => {
    logger.api('api-call', '飞书请求', {
      apiKey: 'sk-abcdef123456789',
      authorization: 'Bearer supersecrettoken123456',
      nested: { token: 'zzzzzzzzzzzzzz' },
      safe: 'hello',
    })
    const res = logger.query({ category: 'api' })
    const meta = res.entries[0].meta
    assert.notEqual(meta.apiKey, 'sk-abcdef123456789')
    assert.ok(meta.apiKey.includes('***'))
    assert.ok(meta.nested.token.includes('***'))
    assert.notEqual(meta.nested.token, 'zzzzzzzzzzzzzz')
    assert.equal(meta.safe, 'hello')
  })

  it('filters by level and search', () => {
    logger.system('boot', '启动')
    logger.error('system', 'fatal', '崩溃了', { stack: 'x' })
    const errors = logger.query({ level: 'error' })
    assert.equal(errors.total, 1)
    assert.equal(errors.entries[0].event, 'fatal')
    const searched = logger.query({ search: '启动' })
    assert.equal(searched.total, 1)
  })

  it('buffers pre-init logs and flushes after init', () => {
    logger._reset()
    logger.operation('early', '初始化前')
    const d2 = tmpDir(); tempDirs.push(d2)
    logger.init({ dir: d2, level: 'debug', mirrorConsole: false })
    const res = logger.query({})
    assert.ok(res.total >= 1)
    assert.ok(res.entries.some(e => e.event === 'early'))
  })

  it('prunes expired logs and enforces file-count and total-size limits on init', () => {
    logger._reset()
    const now = Date.now()
    for (let i = 0; i < 6; i += 1) {
      const file = path.join(dir, `knowme-2026-08-${String(10 + i).padStart(2, '0')}-${i}.jsonl`)
      fs.writeFileSync(file, 'x'.repeat(64), 'utf8')
      fs.utimesSync(file, new Date(now - i * 1000), new Date(now - i * 1000))
    }
    const expired = path.join(dir, 'knowme-2020-01-01.jsonl')
    fs.writeFileSync(expired, 'old', 'utf8')
    fs.utimesSync(expired, new Date(0), new Date(0))

    logger.init({
      dir,
      mirrorConsole: false,
      retentionDays: 7,
      maxFiles: 3,
      maxBytes: 128,
      maxTotalBytes: 192,
    })

    const files = fs.readdirSync(dir).filter(name => name.startsWith('knowme-'))
    const total = files.reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0)
    assert.ok(files.length <= 3)
    assert.ok(total <= 192)
    assert.equal(fs.existsSync(expired), false)
  })

  it('rotates before a write would exceed the configured per-file limit', () => {
    logger._reset()
    logger.init({ dir, level: 'debug', mirrorConsole: false, maxBytes: 300 })
    for (let i = 0; i < 10; i += 1) logger.operation(`event-${i}`, 'x'.repeat(80))
    const sizes = fs.readdirSync(dir)
      .filter(name => name.startsWith('knowme-'))
      .map(name => fs.statSync(path.join(dir, name)).size)
    assert.ok(sizes.length > 1)
    assert.ok(sizes.every(size => size <= 300))
  })

  it('recognizes broken pipes so the failing console stream can be disabled', () => {
    assert.equal(logger.isBrokenPipe({ code: 'EPIPE' }), true)
    assert.equal(logger.isBrokenPipe(new Error('broken pipe, write')), true)
    assert.equal(logger.isBrokenPipe(new Error('disk full')), false)
    assert.doesNotThrow(() => logger.disableBrokenPipe('stderr'))
  })

  it('reports category counts', () => {
    logger.operation('a', 'x')
    logger.operation('b', 'y')
    logger.mcp('c', 'z')
    const c = logger.counts()
    assert.equal(c.counts.operation, 2)
    assert.equal(c.counts.mcp, 1)
    assert.equal(c.counts.total, 3)
  })

  it('clears logs', () => {
    logger.operation('a', 'x')
    const r = logger.clear()
    assert.ok(r.ok)
    assert.equal(logger.query({}).total, 0)
  })
})
