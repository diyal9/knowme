'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitClarificationRequest, resolveClarificationTurn } = require('../src/lib/agent-clarification-gate')

describe('explicit clarification gate', () => {
  it('stops before execution when the user explicitly says to confirm first', () => {
    const prompt = '请帮我盘点最近的会议。先确认时间范围，以及是否只读取已授权的会议来源，确认后列出主题和待办。'
    const request = explicitClarificationRequest(prompt)
    assert.ok(request)
    assert.match(request.question, /时间范围/)
    assert.match(request.question, /已授权/)
  })

  it('resumes the original instruction with the next confirmation answer', () => {
    const originalPrompt = '先确认时间范围，确认后读取会议。'
    const pending = explicitClarificationRequest(originalPrompt)
    const resolved = resolveClarificationTurn({ pendingClarification: pending }, '最近 7 天，只读取已授权来源')
    assert.equal(resolved.action, 'resume')
    assert.match(resolved.prompt, /先确认时间范围/)
    assert.match(resolved.prompt, /最近 7 天/)
  })

  it('does not interrupt ordinary requests', () => {
    assert.deepEqual(resolveClarificationTurn({}, '总结最近三天的会议'), {
      action: 'continue',
      prompt: '总结最近三天的会议',
    })
  })

  it('keeps a short explanation question in clarification instead of resuming', () => {
    const pending = explicitClarificationRequest('先确认时间范围，确认后读取会议。')
    const resolved = resolveClarificationTurn({ pendingClarification: pending }, '为什么要确认？')
    assert.equal(resolved.action, 'clarify')
  })
})
