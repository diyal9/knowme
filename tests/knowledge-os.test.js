'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const knowledgeOs = require('../src/lib/knowledge-os')

describe('knowledge-os', () => {
  let tmp

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-kos-'))
  })

  after(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch { /* */ }
  })

  it('ensures dirs and rejects path escape on resolve', () => {
    const p = knowledgeOs.ensureDirs(tmp)
    assert.ok(fs.existsSync(p.wiki))
    assert.equal(knowledgeOs.resolveUnderRoot(p.wiki, '../secret'), null)
    assert.ok(knowledgeOs.resolveUnderRoot(p.wiki, 'a/b.md'))
  })

  it('ingests text, queries hits, and misses honestly', () => {
    knowledgeOs.ensureDirs(tmp)
    const ing = knowledgeOs.ingest(tmp, {
      title: '支付约定',
      text: '公司支付必须走统一收银台，禁止私下收款。',
    })
    assert.equal(ing.ok, true)
    assert.ok(ing.created.length >= 1)

    const hit = knowledgeOs.query(tmp, '收银台')
    assert.equal(hit.ok, true)
    assert.ok(hit.hits.length >= 1)
    assert.ok(hit.hits[0].path)

    const miss = knowledgeOs.query(tmp, '完全不存在的咒语xyzzy999')
    assert.equal(miss.ok, true)
    assert.equal(miss.hits.length, 0)
    assert.ok(miss.message)
  })

  it('lints empty and duplicate titles', () => {
    const wiki = knowledgeOs.resolveWikiRoot(tmp)
    const emptyRel = 'inbox/empty-test.md'
    const abs = knowledgeOs.resolveUnderRoot(wiki, emptyRel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, '   \n', 'utf8')
    fs.writeFileSync(
      knowledgeOs.resolveUnderRoot(wiki, 'inbox/dup-a.md'),
      '# 同标题\n\na\n',
      'utf8'
    )
    fs.writeFileSync(
      knowledgeOs.resolveUnderRoot(wiki, 'inbox/dup-b.md'),
      '# 同标题\n\nb\n',
      'utf8'
    )
    knowledgeOs.refreshIndex(tmp)
    const report = knowledgeOs.lintWiki(tmp)
    assert.equal(report.ok, true)
    assert.ok(report.issues.some((i) => i.type === 'empty'))
    assert.ok(report.issues.some((i) => i.type === 'duplicate_title'))
  })

  it('promote draft then accept writes under knowledge root only', () => {
    knowledgeOs.ensureDirs(tmp)
    const wiki = knowledgeOs.resolveWikiRoot(tmp)
    const rel = 'inbox/promo.md'
    fs.mkdirSync(path.dirname(knowledgeOs.resolveUnderRoot(wiki, rel)), { recursive: true })
    fs.writeFileSync(
      knowledgeOs.resolveUnderRoot(wiki, rel),
      '# 促销规则\n\n仅限内测用户。\n',
      'utf8'
    )
    const promo = knowledgeOs.promoteToOkfDraft(tmp, { wikiPath: rel })
    assert.equal(promo.ok, true)
    assert.equal(promo.artifact.type, 'wiki_write')
    assert.equal(promo.artifact.status, 'draft')

    const bad = knowledgeOs.acceptWrite(tmp, {
      ...promo.artifact,
      targetPath: '../outside.md',
    })
    assert.equal(bad.ok, false)

    const ok = knowledgeOs.acceptWrite(tmp, promo.artifact)
    assert.equal(ok.ok, true)
    assert.ok(fs.existsSync(ok.written))
  })
})
