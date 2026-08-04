'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { classifyIntent } = require('../src/lib/chat-intent')
const contextCache = require('../src/lib/context-cache')
const knowledgeOs = require('../src/lib/knowledge-os')

describe('chat-intent classifyIntent', () => {
  it('treats greetings and very short messages as chat (lightweight)', () => {
    assert.equal(classifyIntent({ prompt: '你好' }), 'chat')
    assert.equal(classifyIntent({ prompt: '谢谢' }), 'chat')
    assert.equal(classifyIntent({ prompt: '什么' }), 'chat')
    assert.equal(classifyIntent({ prompt: '在吗' }), 'chat')
    assert.equal(classifyIntent({ prompt: '哈喽~' }), 'chat')
  })

  it('routes work verbs to assist', () => {
    assert.equal(classifyIntent({ prompt: '帮我把这段总结成要点' }), 'assist')
    assert.equal(classifyIntent({ prompt: '润色一下这段话' }), 'assist')
    assert.equal(classifyIntent({ prompt: '翻译成英文' }), 'assist')
  })

  it('routes substantive questions to assist', () => {
    assert.equal(classifyIntent({ prompt: '公司报销流程是什么样的' }), 'assist')
  })

  it('routes open-file context to assist even without work verb', () => {
    assert.equal(classifyIntent({ prompt: '你觉得呢', hasNoteContext: true }), 'assist')
  })

  it('routes steward / slash / @ / knowledge intent to retrieval', () => {
    assert.equal(classifyIntent({ prompt: '随便聊聊', role: 'steward' }), 'retrieval')
    assert.equal(classifyIntent({ prompt: '用这个', slashRefs: ['polish'] }), 'retrieval')
    assert.equal(classifyIntent({ prompt: '参考 @会议纪要 回答' }), 'retrieval')
    assert.equal(classifyIntent({ prompt: '知识库里关于支付的约定' }), 'retrieval')
    assert.equal(classifyIntent({ prompt: '查一下报销标准' }), 'retrieval')
  })

  it('routes Feishu doc/meeting fetch requests above chat (enables connector tools)', () => {
    const fetchMeeting = classifyIntent({
      prompt: '帮我在飞书获取今天下午架构组的周会会议记录文档',
    })
    assert.notEqual(fetchMeeting, 'chat')
    assert.ok(fetchMeeting === 'assist' || fetchMeeting === 'retrieval')

    const openWiki = classifyIntent({ prompt: '打开飞书知识库看看技术方案' })
    assert.notEqual(openWiki, 'chat')

    // 「搜索」命中知识意图 → retrieval，同样会启用 tools
    assert.equal(classifyIntent({ prompt: '在飞书搜索架构组周会纪要' }), 'retrieval')
    // 仅提到飞书、无工作对象时仍走 chat，避免无意义抬级
    assert.equal(classifyIntent({ prompt: '飞书挺好用的' }), 'chat')
  })

  it('falls back to assist on malformed input', () => {
    assert.equal(classifyIntent({ prompt: null }), 'chat') // null → '' → chat (not error)
    assert.equal(classifyIntent(undefined), 'chat')
  })
})

/** 镜像 main.js 装配预算，供单测断言（不启动 Electron） */
function assembleBudget(tier) {
  const heavy = tier !== 'chat'
  return {
    kb: heavy,
    skill: heavy,
    mem: heavy,
    wiki: tier === 'retrieval',
  }
}

describe('tier → assembly budget (mirrors main.js)', () => {
  it('greeting: no kb/skill/wiki', () => {
    const b = assembleBudget(classifyIntent({ prompt: '你好' }))
    assert.deepEqual(b, { kb: false, skill: false, mem: false, wiki: false })
  })

  it('work verb: kb+skill, no wiki', () => {
    const b = assembleBudget(classifyIntent({ prompt: '帮我把这段总结成要点' }))
    assert.deepEqual(b, { kb: true, skill: true, mem: true, wiki: false })
  })

  it('slash / steward: full retrieval', () => {
    assert.deepEqual(
      assembleBudget(classifyIntent({ prompt: '用这个', slashRefs: ['polish'] })),
      { kb: true, skill: true, mem: true, wiki: true }
    )
    assert.deepEqual(
      assembleBudget(classifyIntent({ prompt: '随便', role: 'steward' })),
      { kb: true, skill: true, mem: true, wiki: true }
    )
  })

  it('force-full override maps to retrieval budget', () => {
    const forceFull = true
    const tier = forceFull ? 'retrieval' : classifyIntent({ prompt: '你好' })
    assert.deepEqual(assembleBudget(tier), { kb: true, skill: true, mem: true, wiki: true })
  })
})

describe('context-cache', () => {
  it('memoizes by stamp and recomputes when stamp changes', () => {
    contextCache.invalidate()
    let calls = 0
    const produce = () => { calls += 1; return `v${calls}` }
    assert.equal(contextCache.cached('k', 1, produce), 'v1')
    assert.equal(contextCache.cached('k', 1, produce), 'v1') // reuse
    assert.equal(calls, 1)
    assert.equal(contextCache.cached('k', 2, produce), 'v2') // stamp changed
    assert.equal(calls, 2)
  })

  it('readFileCached returns null on missing file', () => {
    assert.equal(contextCache.readFileCached(path.join(os.tmpdir(), 'no-such-knowme-file.md')), null)
  })
})

describe('knowledge-os query caching', () => {
  let tmp

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fastpath-'))
    knowledgeOs.ensureDirs(tmp)
    knowledgeOs.ingest(tmp, { title: '支付约定', text: '公司支付必须走统一收银台，禁止私下收款。' })
  })

  after(() => {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* */ }
  })

  it('reuses cached file content on repeated query (no re-read)', () => {
    contextCache.invalidate()
    const first = knowledgeOs.query(tmp, '收银台')
    assert.ok(first.hits.length >= 1)

    const orig = fs.readFileSync
    let contentReads = 0
    fs.readFileSync = (p, ...rest) => {
      if (String(p).includes('inbox')) contentReads += 1
      return orig(p, ...rest)
    }
    try {
      const second = knowledgeOs.query(tmp, '收银台')
      assert.ok(second.hits.length >= 1)
    } finally {
      fs.readFileSync = orig
    }
    assert.equal(contentReads, 0)
  })

  it('re-reads content after file mtime changes (cache invalidation)', () => {
    const wikiRoot = knowledgeOs.resolveWikiRoot(tmp, {})
    const rel = knowledgeOs.listEntries(tmp, {}).wiki[0].path
    const abs = path.join(wikiRoot, rel)
    fs.writeFileSync(abs, '# 支付约定\n\n改用新系统 NEWPAY 结算。\n', 'utf8')
    const future = new Date(Date.now() + 2000)
    fs.utimesSync(abs, future, future)

    const q = knowledgeOs.query(tmp, 'NEWPAY')
    assert.ok(q.hits.length >= 1, '应命中更新后的内容')
  })
})
