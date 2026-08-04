'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const knowledgeOs = require('../src/lib/knowledge-os')

describe('knowledge-space-wiki · space + subDir root binding', () => {
  let tmp
  let space

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-ksw-'))
    space = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-space-'))
    fs.mkdirSync(path.join(space, 'docs', 'kb'), { recursive: true })
    fs.writeFileSync(path.join(space, 'docs', 'kb', 'note.md'), '# 报销规则\n\n单笔超过 500 需审批。\n', 'utf8')
  })

  after(() => {
    for (const d of [tmp, space]) {
      try { fs.rmSync(d, { recursive: true, force: true }) } catch { /* */ }
    }
  })

  const ctx = () => ({ sources: [{ id: 'sp1', type: 'local', rootPath: space }] })

  it('binds wiki root to a space subdirectory', () => {
    knowledgeOs.ensureDirs(tmp)
    knowledgeOs.saveConfig(tmp, { spaceSourceId: 'sp1', subDir: 'docs/kb' })
    const root = knowledgeOs.resolveWikiRoot(tmp, ctx())
    assert.equal(path.resolve(root), path.resolve(path.join(space, 'docs', 'kb')))

    const hit = knowledgeOs.query(tmp, '报销', ctx())
    assert.equal(hit.ok, true)
    assert.ok(hit.hits.length >= 1)
  })

  it('rejects path traversal in subDir and falls back to default', () => {
    knowledgeOs.saveConfig(tmp, { spaceSourceId: 'sp1', subDir: '../../Windows' })
    const root = knowledgeOs.resolveWikiRoot(tmp, ctx())
    const def = knowledgeOs.defaultPaths(tmp).wiki
    assert.equal(path.resolve(root), path.resolve(def))
  })

  it('falls back to default wiki when no binding', () => {
    knowledgeOs.saveConfig(tmp, { spaceSourceId: null, subDir: '' })
    const root = knowledgeOs.resolveWikiRoot(tmp, ctx())
    assert.equal(path.resolve(root), path.resolve(knowledgeOs.defaultPaths(tmp).wiki))
  })

  it('falls back when bound source no longer exists', () => {
    knowledgeOs.saveConfig(tmp, { spaceSourceId: 'gone', subDir: 'docs/kb' })
    const root = knowledgeOs.resolveWikiRoot(tmp, ctx())
    assert.equal(path.resolve(root), path.resolve(knowledgeOs.defaultPaths(tmp).wiki))
  })

  it('migrates legacy wikiSourceId to spaceSourceId', () => {
    const cfg = knowledgeOs.saveConfig(tmp, { spaceSourceId: null, subDir: '' })
    // 写入旧字段模拟历史 config
    const p = knowledgeOs.defaultPaths(tmp).configFile
    fs.writeFileSync(p, JSON.stringify({ ...cfg, wikiSourceId: 'sp1', spaceSourceId: undefined }), 'utf8')
    const loaded = knowledgeOs.loadConfig(tmp)
    assert.equal(loaded.spaceSourceId, 'sp1')
  })

  it('lists a single knowledge root (okf = concepts/ within wiki root)', () => {
    knowledgeOs.saveConfig(tmp, { spaceSourceId: null, subDir: '' })
    const wiki = knowledgeOs.resolveWikiRoot(tmp)
    fs.mkdirSync(path.join(wiki, 'concepts'), { recursive: true })
    fs.mkdirSync(path.join(wiki, 'inbox'), { recursive: true })
    fs.writeFileSync(path.join(wiki, 'concepts', 'c1.md'), '# 概念一\n\nx\n', 'utf8')
    fs.writeFileSync(knowledgeOs.resolveUnderRoot(wiki, 'inbox/w1.md'), '# 维基一\n\ny\n', 'utf8')
    knowledgeOs.refreshIndex(tmp)
    const list = knowledgeOs.listEntries(tmp)
    assert.ok(list.okf.some((e) => e.path === 'concepts/c1.md'))
    assert.ok(list.wiki.some((e) => e.path === 'inbox/w1.md'))
  })
})
