const { describe, it } = require('node:test')
const assert = require('node:assert')
const gameReq = require('../src/lib/game-requirement')

describe('game requirement doc', () => {
  it('parses markdown sections', () => {
    const md = `# 赛季活动需求

## 背景
Q3 拉新

## 目标
提升 7 日留存

## 玩法
三消 + 排行

## 验收标准
- 活动可配置
- 埋点齐全
`
    const doc = gameReq.parseFromMarkdown(md)
    assert.equal(doc.title, '赛季活动需求')
    assert.match(doc.sections.background, /Q3/)
    assert.match(doc.sections.acceptance, /埋点/)
  })

  it('validates required sections', () => {
    const doc = gameReq.emptyDoc('测试')
    doc.sections.background = '有背景'
    doc.sections.goals = '有目标'
    doc.sections.gameplay = '有玩法'
    doc.sections.acceptance = '有验收'
    const v = gameReq.validate(doc)
    assert.equal(v.ok, true)
  })

  it('approve rejects incomplete doc', () => {
    const doc = gameReq.emptyDoc('不完整')
    const result = gameReq.approve(doc)
    assert.equal(result.ok, false)
  })

  it('builds artifact with feishu draft meta', () => {
    const doc = gameReq.emptyDoc('完整需求')
    doc.sections.background = 'b'
    doc.sections.goals = 'g'
    doc.sections.gameplay = 'p'
    doc.sections.acceptance = 'a'
    const approved = gameReq.approve(doc)
    const art = gameReq.buildArtifact(approved.doc)
    assert.equal(art.meta.workspaceAction, 'game_requirement_review')
    assert.equal(art.meta.allowFeishuDraft, true)
  })
})
