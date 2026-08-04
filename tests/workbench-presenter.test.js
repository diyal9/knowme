/**
 * Workbench 对外展示层：内部术语不得泄漏到用户界面
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const presenter = require('../src/lib/workbench-presenter')
const todoStore = require('../src/lib/workbench-todo-store')

describe('workbench presenter', () => {
  // 取自仓库真实 manifest，曾原样出现在专家卡片上
  const leaky = [
    '后端技术规划 Worker，s2-plan-backend 写 plan-backend.md +…',
    '前端架构师 Worker，读取 workflow-spec ingest 与上游制品，输出前端…',
    'F9 测试架构师，读 ingest/ 需求与上游制品，按 RAGFlow/本地领域知识…',
    '后端编码 Worker，s3-proto 按上批把 plan 落 proto/；s3-code-chunk 按…',
  ]

  it('rejects manifest descriptions that carry implementation details', () => {
    for (const raw of leaky) {
      assert.ok(presenter.looksInternal(raw), `should flag: ${raw}`)
    }
  })

  it('falls back to a role template when the description is developer-facing', () => {
    const summary = presenter.userFacingSummary({
      id: 'arch-be',
      title: '保守型后端架构师',
      description: leaky[0],
    }, '保守型后端架构师')
    assert.ok(!presenter.looksInternal(summary))
    assert.ok(summary.length <= presenter.SUMMARY_MAX)
    assert.match(summary, /接口|数据|服务端/)
  })

  it('prefers an author-provided user-facing summary', () => {
    const summary = presenter.userFacingSummary({
      title: '测试架构师',
      description: leaky[2],
      display: { summary: '从用户角度检验成果，给出可复现的问题与验收结论。' },
    }, '测试架构师')
    assert.strictEqual(summary, '从用户角度检验成果，给出可复现的问题与验收结论。')
  })

  it('turns skill slugs into readable capability tags', () => {
    const tags = presenter.capabilityTags({
      title: '前端架构师',
      skills: { required: ['team-developer'], optional: ['playwright-ui-verify'] },
    })
    assert.strictEqual(tags.length, 3)
    assert.ok(tags.includes('架构设计'))
    for (const tag of tags) assert.ok(!presenter.looksInternal(tag), tag)
  })

  it('honours author capability tags and drops unusable ones', () => {
    const tags = presenter.capabilityTags({
      title: '产品需求负责人',
      display: { capabilities: ['需求梳理', 's2-plan-backend', '验收标准'] },
    })
    assert.deepStrictEqual(tags, ['需求梳理', '验收标准'])
  })

  it('sanitizes chat suggestions that leak ingest input paths', () => {
    const cleaned = presenter.sanitizeChatSuggestion('可查看任务产物 ingest/brief.md')
    assert.doesNotMatch(cleaned, /ingest\/brief\.md/)
    assert.ok(cleaned.length > 0)
  })
})

describe('workbench todo store', () => {
  function tempStore() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-todo-'))
    return todoStore.createStore(path.join(dir, 'workbench-todos.json'))
  }

  it('persists items across store instances', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-todo-'))
    const file = path.join(dir, 'workbench-todos.json')
    const added = todoStore.createStore(file).add('写好今天的第一件事')
    assert.ok(added.ok)
    const reopened = todoStore.createStore(file).list()
    assert.strictEqual(reopened.items.length, 1)
    assert.strictEqual(reopened.items[0].text, '写好今天的第一件事')
  })

  it('toggles, removes and clears done items', () => {
    const store = tempStore()
    const id = store.add('一件事').items[0].id
    assert.strictEqual(store.toggle(id).items[0].done, true)
    assert.strictEqual(store.clearDone().items.length, 0)
    const next = store.add('另一件事').items[0].id
    assert.strictEqual(store.remove(next).items.length, 0)
  })

  it('imports legacy renderer todos without losing them', () => {
    const store = tempStore()
    const res = store.importLegacy([
      { id: 'a', text: '旧的待办', done: false },
      { text: '', done: false },
    ])
    assert.ok(res.ok)
    assert.strictEqual(res.items.length, 1)
    assert.strictEqual(res.items[0].text, '旧的待办')
  })
})
