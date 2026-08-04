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
  beforeEach(() => {
    logger._reset()
    dir = tmpDir()
    logger.init({ dir, level: 'debug', mirrorConsole: false })
  })
  afterEach(() => {
    logger._reset()
    fs.rmSync(dir, { recursive: true, force: true })
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
    const d2 = tmpDir()
    logger.init({ dir: d2, level: 'debug', mirrorConsole: false })
    const res = logger.query({})
    assert.ok(res.total >= 1)
    assert.ok(res.entries.some(e => e.event === 'early'))
    fs.rmSync(d2, { recursive: true, force: true })
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
