const { test } = require('node:test')
const assert = require('node:assert/strict')
const { classifyIntent } = require('../src/lib/chat-intent')
const { resolveExecutionPolicy } = require('../src/lib/context-engine/policy')

for (const prompt of ['发给张三', '打开刚才那个', '帮我订明天的会议室', '把它存到飞书', '用Photoshop修一下', '把这张图发出去', '从能力中心找工具', 'upload this image']) {
  test(`capability request retains discovery: ${prompt}`, () => {
    assert.equal(classifyIntent({ prompt }), 'assist')
  })
}

test('continuation uses host pending state, not a blanket tool upgrade for pleasantries', () => {
  assert.equal(classifyIntent({ prompt: '继续' }), 'chat')
  assert.equal(classifyIntent({ prompt: '继续', hasPendingWork: true }), 'assist')
  assert.equal(classifyIntent({ prompt: '谢谢', hasPendingWork: true }), 'chat')
  assert.equal(classifyIntent({ prompt: '', hasImage: true }), 'assist')
})

test('planning and discussion remain no-tools despite executable intent', () => {
  for (const conversationMode of ['expert-planning', 'expert-discussion']) {
    assert.equal(resolveExecutionPolicy({ conversationMode, toolsEnabled: true }), 'no-tools')
  }
})
