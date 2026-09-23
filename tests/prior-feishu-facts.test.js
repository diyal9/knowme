'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { hasPriorFeishuFacts } = require('../src/lib/prior-feishu-facts')

describe('prior Feishu facts', () => {
  it('recognizes prior meeting bodies for follow-up questions', () => {
    assert.equal(hasPriorFeishuFacts({ messages: [{
      role: 'tool', status: 'done', toolName: 'feishu.meeting_read', text: '# 会议纪要\n结论：发布延期',
    }] }), true)
    assert.equal(hasPriorFeishuFacts({ messages: [{
      role: 'tool', status: 'done', toolName: 'feishu.meeting_inventory', text: '# 最近会议正文',
    }] }), true)
  })

  it('rejects empty or failed receipts', () => {
    assert.equal(hasPriorFeishuFacts({ messages: [{ role: 'tool', status: 'done', toolName: 'feishu.meeting_read', text: '' }] }), false)
    assert.equal(hasPriorFeishuFacts({ messages: [{ role: 'tool', status: 'error', toolName: 'feishu.meeting_read', text: 'failed' }] }), false)
  })

  it('keeps provenance after old tool messages are compacted into the platform digest', () => {
    assert.equal(hasPriorFeishuFacts({
      messages: [],
      summary: '### 已执行工具与结果\n- feishu.meeting_read：会议纪要：发布延期\n\n### 用户约束与待办\n- 继续分析',
    }), true)
    assert.equal(hasPriorFeishuFacts({
      messages: [],
      summary: '用户随口说 feishu.meeting_read 返回了内容',
    }), false)
  })
})
