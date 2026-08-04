'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const si = require('../src/lib/semantic-index')

describe('semantic-index', () => {
  it('chunks long text into overlapping windows', () => {
    const text = Array.from({ length: 50 }, (_, i) => `line ${i} content here`).join('\n')
    const chunks = si.chunkText(text, { maxChars: 300, overlap: 60 })
    assert.ok(chunks.length > 1, 'produces multiple chunks')
    // overlap: second chunk should start before the first chunk ends
    assert.ok(chunks[1].start < chunks[0].end)
  })

  it('returns no chunks for empty content', () => {
    assert.deepEqual(si.chunkText('   '), [])
  })

  it('chunks a document list and caps at maxChunks', () => {
    const files = [{ path: 'a.md', weight: 1.2 }, { path: 'b.md' }]
    const contents = { 'a.md': 'x'.repeat(3000), 'b.md': 'y'.repeat(3000) }
    const chunks = si.chunkDocuments(files, (rel) => contents[rel], { maxChars: 500, overlap: 0, maxChunks: 4 })
    assert.equal(chunks.length, 4)
    assert.equal(chunks[0].path, 'a.md')
    assert.equal(chunks[0].fileWeight, 1.2)
  })

  it('builds an embedded index and searches by cosine similarity', async () => {
    const files = [{ path: 'doc.md' }]
    // 两段足够长的内容（chunkText 有 200 字符下限），确保切成多块
    const paraA = '关于取消机制 AbortController 的详细说明。'.repeat(20)
    const paraB = '关于知识库检索排序策略的详细说明。'.repeat(20)
    const content = `${paraA}\n\n${paraB}`
    // fake embed: 含取消/Abort 的块 -> [1,0]，其余 -> [0,1]
    const embed = async (texts) => texts.map((t) => (/Abort|取消/.test(t) ? [1, 0] : [0, 1]))
    const index = await si.buildEmbeddedIndex({ files, readFile: () => content, embed, maxChars: 200, overlap: 0 })
    assert.ok(index.chunks.length >= 2)
    const hits = await si.query(index, embed, '取消 AbortController', { topK: 1 })
    assert.match(hits[0].text, /Abort|取消/)
  })

  it('returns nothing when embed is missing', async () => {
    const index = await si.buildEmbeddedIndex({ files: [{ path: 'a' }], readFile: () => 'x' })
    assert.deepEqual(index, { chunks: [], vectors: [] })
    assert.deepEqual(await si.query(index, null, 'q'), [])
  })

  it('formats semantic matches and honest misses', () => {
    assert.match(si.formatSemanticMatches('q', []), /未找到/)
    const out = si.formatSemanticMatches('q', [{ path: 'a.md', chunkIndex: 0, text: 'hello', score: 0.9 }])
    assert.match(out, /a\.md/)
    assert.match(out, /相似度 0\.9/)
    assert.match(out, /来自 1 个文件/)
  })

  it('boosts active/recent file chunks by fileWeight', () => {
    const index = {
      chunks: [
        { path: 'a.md', chunkIndex: 0, text: 'alpha', fileWeight: 1.35 },
        { path: 'b.md', chunkIndex: 0, text: 'beta', fileWeight: 1 },
      ],
      vectors: [
        [0.8, 0.2],
        [0.9, 0.1],
      ],
    }
    const q = [1, 0]
    const hits = si.searchChunks(index, q, { topK: 2 })
    assert.equal(hits[0].path, 'a.md')
  })

  it('deduplicates repeated chunks and limits hits per file', () => {
    const hits = [
      { path: 'a.md', chunkIndex: 1, text: 'same line', score: 0.9 },
      { path: 'a.md', chunkIndex: 2, text: 'same line', score: 0.88 },
      { path: 'a.md', chunkIndex: 3, text: 'another line', score: 0.87 },
      { path: 'a.md', chunkIndex: 4, text: 'third line', score: 0.86 },
      { path: 'b.md', chunkIndex: 0, text: 'other', score: 0.8 },
    ]
    const out = si.postProcessHits(hits, { maxPerFile: 2 })
    const a = out.filter(h => h.path === 'a.md')
    assert.equal(a.length, 2)
    assert.ok(out.some(h => h.path === 'b.md'))
  })

  it('returns meta for dedupe/clustering and applies MMR diversity', async () => {
    const index = {
      chunks: [
        { path: 'a.md', chunkIndex: 0, text: 'alpha topic', fileWeight: 1 },
        { path: 'a.md', chunkIndex: 1, text: 'alpha topic extended', fileWeight: 1 },
        { path: 'b.md', chunkIndex: 0, text: 'beta topic', fileWeight: 1 },
      ],
      vectors: [
        [1, 0],
        [0.99, 0.01],
        [0.75, 0.25],
      ],
    }
    const embed = async () => [[1, 0]]
    const detailed = await si.queryDetailed(index, embed, 'alpha', { topK: 2, maxPerFile: 2 })
    assert.ok(detailed.meta)
    assert.ok(typeof detailed.meta.clusterCount === 'number')
    assert.ok(typeof detailed.meta.candidateCount === 'number')
    assert.equal(detailed.hits.length, 2)
  })

  it('exposes a semantic_search tool definition', () => {
    assert.equal(si.SEMANTIC_SEARCH_DEF.function.name, 'semantic_search')
    assert.deepEqual(si.SEMANTIC_SEARCH_DEF.function.parameters.required, ['query'])
  })
})
