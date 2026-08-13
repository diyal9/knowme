'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const llmwikiService = require('../src/lib/llmwiki-service')
const qmdEngine = require('../src/lib/qmd-engine')

describe('root LLM Wiki service', () => {
  function fakeKnowledgeOs() {
    return {
      loadQueryDocuments: () => ({
        wikiRoot: path.resolve('fixture-wiki'),
        docs: [{ title: '发布流程', path: 'raw/release.md', content: '先检查再发布' }],
      }),
      resolveWikiRoot: () => path.resolve('fixture-wiki'),
      ingest: () => ({ ok: true, created: [{ path: 'raw/new.md', title: '新资料' }] }),
      lintWiki: () => ({ ok: true, healthy: true, issueCount: 0, scanned: 1, issues: [] }),
      saveRaw: () => ({ ok: true, path: 'raw/release.md', hash: 'next' }),
      refreshIndex: () => ({ builtAt: '2026-08-10T00:00:00.000Z', entries: [{ path: 'raw/release.md' }] }),
    }
  }

  it('routes root query through qmd and returns one reusable envelope', async () => {
    let received = null
    const service = llmwikiService.createService({
      knowledgeOs: fakeKnowledgeOs(),
      qmdEngine: {
        queryCollection: async (collectionId, queryText, opts) => {
          received = { collectionId, queryText, opts }
          return {
            ok: true,
            engine: 'qmd',
            hits: [{ title: '发布流程', path: 'raw/release.md', snippet: '先检查再发布' }],
          }
        },
        syncCollection: async () => ({ ok: true, engine: 'qmd', collectionId: 'knowme-root-fixture' }),
        getEngineStatus: async () => ({ engine: 'qmd', probe: { available: true } }),
      },
    })

    const result = await service.query('userdata', '怎么发布')
    assert.equal(received.collectionId, 'root')
    assert.equal(received.queryText, '怎么发布')
    assert.equal(received.opts.docs.length, 1)
    assert.equal(received.opts.rootPath, path.resolve('fixture-wiki'))
    assert.equal(result.action, '查找知识')
    assert.equal(result.retrieval.actual, 'qmd')
    assert.equal(result.retrieval.degraded, false)
    assert.equal(result.hits[0].path, 'raw/release.md')
  })

  it('keeps ingest successful when qmd is unavailable and reports degradation', async () => {
    const service = llmwikiService.createService({
      knowledgeOs: fakeKnowledgeOs(),
      qmdEngine: {
        queryCollection: async () => ({ ok: true, engine: 'fallback', hits: [] }),
        syncCollection: async () => ({ ok: false, error: 'not_installed' }),
        getEngineStatus: async () => ({
          engine: 'fallback',
          probe: { available: false, reason: 'not_installed' },
        }),
      },
    })

    const result = await service.ingest('userdata', { title: '新资料', text: '正文' })
    assert.equal(result.ok, true)
    assert.equal(result.action, '添加资料')
    assert.equal(result.retrieval.actual, 'fallback')
    assert.equal(result.retrieval.degraded, true)
    assert.equal(result.retrieval.reason, 'not_installed')

    const report = await service.lint('userdata')
    assert.equal(report.action, '检查问题')
    assert.match(report.summary, /没有发现问题/)
  })
})

describe('qmd adapter contract', () => {
  it('uses the documented query argument order and maps qmd files', () => {
    assert.deepEqual(
      qmdEngine.buildQueryArgs('knowme-root-abc', '发布流程', 6),
      ['query', '发布流程', '--json', '-n', '6', '-c', 'knowme-root-abc']
    )
    const hits = qmdEngine.mapQmdHits([{
      docid: '#abc123',
      file: 'qmd://knowme-root-abc/raw/release.md',
      title: '发布流程',
      context: '版本发布',
      snippet: '先检查再发布',
      score: 0.88,
    }], 'knowme-root-abc', 5)
    assert.equal(hits[0].path, 'raw/release.md')
    assert.equal(hits[0].docId, '#abc123')
    assert.equal(hits[0].engine, 'qmd')
  })

  it('scopes collection names by canonical root path', () => {
    const first = qmdEngine.scopedCollectionName('root', path.resolve('wiki-a'))
    const same = qmdEngine.scopedCollectionName('root', path.resolve('wiki-a'))
    const other = qmdEngine.scopedCollectionName('root', path.resolve('wiki-b'))
    assert.equal(first, same)
    assert.notEqual(first, other)
    assert.match(first, /^knowme-root-[a-f0-9]{10}$/)
  })
})
