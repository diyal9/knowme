'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const rank = require('../src/lib/knowledge-rank')

describe('knowledge-rank', () => {
  it('tokenizes latin words and CJK bigrams', () => {
    const tokens = rank.tokenize('Electron 便签 IPC')
    assert.ok(tokens.includes('electron'))
    assert.ok(tokens.includes('ipc'))
    assert.ok(tokens.includes('便签'))
  })

  it('ranks documents matching more terms higher', () => {
    const docs = [
      { title: '无关', path: 'a.md', content: '这是一段与查询无关的内容' },
      { title: 'IPC 指南', path: 'ipc.md', content: 'Electron 主进程与渲染进程通过 IPC 通信，便签数据同步依赖 IPC' },
      { title: '便签', path: 'note.md', content: '便签的基础用法说明' },
    ]
    const hits = rank.rankHits('Electron IPC 便签', docs)
    assert.equal(hits[0].path, 'ipc.md')
  })

  it('boosts title and full phrase matches', () => {
    const docs = [
      { title: '正文提及上下文预算', path: 'b.md', content: '文中偶尔提到上下文预算这个词一次' },
      { title: '上下文预算', path: 'a.md', content: '关于上下文预算的完整说明与上下文预算策略' },
    ]
    const hits = rank.rankHits('上下文预算', docs)
    assert.equal(hits[0].path, 'a.md')
  })

  it('selects the most relevant line as snippet', () => {
    const docs = [
      { title: 'doc', path: 'd.md', content: '第一行无关\n关键：这里讲的是取消机制 AbortController\n结尾无关' },
    ]
    const hits = rank.rankHits('取消机制 AbortController', docs)
    assert.match(hits[0].snippet, /取消机制/)
  })

  it('returns nothing for an empty query', () => {
    assert.deepEqual(rank.rankHits('', [{ title: 't', path: 'p', content: 'c' }]), [])
  })

  it('computes cosine similarity with zero-vector safety', () => {
    assert.equal(rank.cosineSimilarity([1, 0], [1, 0]), 1)
    assert.ok(Math.abs(rank.cosineSimilarity([1, 0], [0, 1])) < 1e-9)
    assert.equal(rank.cosineSimilarity([0, 0], [1, 1]), 0)
    assert.equal(rank.cosineSimilarity([1, 2, 3], [1, 2]), 0)
  })

  it('blends lexical and semantic scores and re-sorts', () => {
    const hits = [
      { title: 'a', path: 'a', snippet: '', score: 10 },
      { title: 'b', path: 'b', snippet: '', score: 1 },
    ]
    // b is far more semantically similar → should overtake with low alpha
    const out = rank.blendScores(hits, [0.1, 0.95], 0.2)
    assert.equal(out[0].path, 'b')
    assert.ok(out[0].rerankScore >= out[1].rerankScore)
  })

  it('reranks candidates via an injected embed function', async () => {
    const hits = [
      { title: '错的', path: 'wrong', snippet: '', score: 9 },
      { title: '对的', path: 'right', snippet: '', score: 2 },
    ]
    const embed = async (texts) => texts.map((t) => (/对|right/.test(t) ? [1, 0] : [0, 1]))
    const out = await rank.rerankHits(hits, { embed, queryText: '对的', alpha: 0.1 })
    assert.equal(out[0].path, 'right')
  })

  it('returns candidates unchanged when embed is absent', async () => {
    const hits = [{ title: 'a', path: 'a', snippet: '', score: 3 }, { title: 'b', path: 'b', snippet: '', score: 2 }]
    const out = await rank.rerankHits(hits, { queryText: 'x' })
    assert.deepEqual(out, hits)
  })
})
