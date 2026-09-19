'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const knowledgeOs = require('../src/lib/knowledge-os')
const packs = require('../src/lib/bundled-knowledge-packs')

function withTempDir(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-'))
  try { return run(root) } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

describe('bundled knowledge packs', () => {
  it('updates managed files but preserves user-edited RAG content', () => withTempDir(root => {
    const packRoot = path.join(root, 'pack')
    const wikiRoot = path.join(root, 'wiki')
    fs.mkdirSync(path.join(packRoot, 'kb', 'okf'), { recursive: true })
    const source = path.join(packRoot, 'kb', 'okf', 'metric.md')
    fs.writeFileSync(source, '# 指标\n\n[定义](/semantic/metrics/dau.md)\n', 'utf8')

    const first = packs.syncBundledKnowledgePack({ packId: 'test-pack', version: '1.0.0', packRoot, wikiRoot })
    assert.equal(first.created.length, 1)
    const target = path.join(first.targetRoot, 'kb', 'okf', 'metric.md')
    assert.match(fs.readFileSync(target, 'utf8'), /\/raw\/packs\/test-pack\/kb\/okf\/semantic\/metrics\/dau\.md/)

    fs.writeFileSync(source, '# 指标 v2\n', 'utf8')
    const second = packs.syncBundledKnowledgePack({ packId: 'test-pack', version: '1.1.0', packRoot, wikiRoot })
    assert.deepEqual(second.updated, ['kb/okf/metric.md'])

    fs.writeFileSync(target, '# 用户修订\n', 'utf8')
    fs.writeFileSync(source, '# 指标 v3\n', 'utf8')
    const third = packs.syncBundledKnowledgePack({ packId: 'test-pack', version: '1.2.0', packRoot, wikiRoot })
    assert.deepEqual(third.conflicts, ['kb/okf/metric.md'])
    assert.equal(fs.readFileSync(target, 'utf8'), '# 用户修订\n')
  }))

  it('ships the th-BI OKF corpus and makes it retrievable through Knowledge OS', () => withTempDir(userData => {
    const packRoot = path.join(__dirname, '..', 'src', 'assets', 'knowledge-packs', 'th-bi-operations-analytics')
    const markdownFiles = packs.listMarkdownFiles(packRoot)
    assert.ok(markdownFiles.length >= 100, `expected complete corpus, got ${markdownFiles.length}`)
    const paths = knowledgeOs.ensureDirs(userData)
    const synced = packs.syncBundledKnowledgePack({
      packId: 'th-bi-operations-analytics',
      version: '1.0.0',
      packRoot,
      wikiRoot: paths.wiki,
    })
    assert.ok(synced.created.length >= 100)
    knowledgeOs.refreshIndex(userData)
    const result = knowledgeOs.query(userData, 'D1 次日留存')
    assert.equal(result.ok, true)
    assert.ok(result.hits.length > 0)
    assert.ok(result.hits.some(hit => String(hit.path || '').includes('th-bi-operations-analytics')))
  }))
})
