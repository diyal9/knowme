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
    assert.ok(fs.existsSync(path.join(p.wiki, 'raw')))
    assert.ok(fs.existsSync(path.join(p.wiki, 'concepts')))
    assert.ok(fs.existsSync(path.join(p.wiki, '.knowme', 'llmwiki.json')))
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

  it('routes new material through raw and refreshes search after a guarded save', () => {
    const ingested = knowledgeOs.ingest(tmp, {
      title: '可编辑资料',
      text: '初始关键词 alpha-root',
    })
    assert.equal(ingested.ok, true)
    assert.match(ingested.created[0].path, /^raw\//)

    const opened = knowledgeOs.readEntry(tmp, 'wiki', ingested.created[0].path)
    assert.equal(opened.ok, true)
    assert.equal(opened.editable, true)
    assert.ok(opened.hash)

    const saved = knowledgeOs.saveRaw(tmp, {
      path: opened.path,
      content: '# 可编辑资料\n\n保存后的关键词 beta-root\n',
      expectedHash: opened.hash,
    })
    assert.equal(saved.ok, true)
    assert.ok(saved.indexedAt)
    assert.ok(knowledgeOs.query(tmp, 'beta-root').hits.some(hit => hit.path === opened.path))

    const stale = knowledgeOs.saveRaw(tmp, {
      path: opened.path,
      content: '不应覆盖',
      expectedHash: opened.hash,
    })
    assert.equal(stale.code, 'stale_content')
    assert.match(knowledgeOs.readEntry(tmp, 'wiki', opened.path).content, /beta-root/)
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

  it('rejects ingest files outside the wiki or authorized source roots', () => {
    const wiki = knowledgeOs.resolveWikiRoot(tmp)
    const outside = path.join(os.tmpdir(), `knowme-outside-${Date.now()}.md`)
    fs.writeFileSync(outside, '# Outside\n', 'utf8')
    try {
      const result = knowledgeOs.ingest(tmp, { files: [{ absPath: outside }] })
      assert.equal(result.ok, false)
      assert.match(result.error, /不在知识库或授权内容源内/)

      const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-authorized-'))
      const sourceFile = path.join(sourceRoot, 'allowed.md')
      fs.writeFileSync(sourceFile, '# Allowed\n', 'utf8')
      const allowed = knowledgeOs.ingest(tmp, {
        files: [{ absPath: sourceFile }],
      }, { sources: [{ id: 'src', type: 'local', rootPath: sourceRoot }] })
      assert.equal(allowed.ok, true)
      assert.ok(fs.existsSync(knowledgeOs.resolveUnderRoot(wiki, allowed.created[0].path)))
      fs.rmSync(sourceRoot, { recursive: true, force: true })
    } finally {
      try { fs.unlinkSync(outside) } catch { /* cleanup */ }
    }
  })

  it('creates batch promote drafts and rejects stale source content', () => {
    knowledgeOs.ensureDirs(tmp)
    const wiki = knowledgeOs.resolveWikiRoot(tmp)
    const paths = ['inbox/batch-a.md', 'inbox/batch-b.md']
    for (const [index, rel] of paths.entries()) {
      const abs = knowledgeOs.resolveUnderRoot(wiki, rel)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, `# 批量 ${index}\n\n内容 ${index}\n`, 'utf8')
    }
    const batch = knowledgeOs.promoteToOkfDrafts(tmp, { wikiPaths: paths })
    assert.equal(batch.ok, true)
    assert.equal(batch.artifacts.length, 2)
    assert.equal(batch.artifacts[0].type, 'wiki_write')

    const sourceAbs = knowledgeOs.resolveUnderRoot(wiki, paths[0])
    fs.appendFileSync(sourceAbs, '\n已变化\n', 'utf8')
    const stale = knowledgeOs.acceptWrite(tmp, batch.artifacts[0])
    assert.equal(stale.ok, false)
    assert.equal(stale.code, 'source_changed')
  })
})
