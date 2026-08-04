'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')

const { classifyIntent } = require('../src/lib/chat-intent')

describe('chat-intent', () => {
  it('keeps short pleasantries in chat tier', () => {
    assert.equal(classifyIntent({ prompt: '谢谢' }), 'chat')
    assert.equal(classifyIntent({ prompt: '你好呀' }), 'chat')
  })

  it('routes concrete writing work to assist tier', () => {
    assert.equal(classifyIntent({ prompt: '帮我写个周报' }), 'assist')
    assert.equal(classifyIntent({ prompt: '请回复这封邮件' }), 'assist')
  })

  it('routes knowledge lookup requests to retrieval tier', () => {
    assert.equal(classifyIntent({ prompt: '查一下项目知识库里怎么写的' }), 'retrieval')
    assert.equal(classifyIntent({ prompt: '@README 帮我找一下部署说明' }), 'retrieval')
  })

  it('routes feishu document work to assist tier', () => {
    assert.equal(classifyIntent({ prompt: '打开飞书文档并总结一下重点' }), 'assist')
  })
})
