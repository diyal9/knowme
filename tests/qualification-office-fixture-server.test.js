'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { completion, officeCandidate } = require('../scripts/qualification-office-fixture-server')

test('office fixture preserves conflicts and does not invent a meeting decision', () => {
  const content = officeCandidate('记录A写9月12日上线，记录B写9月19日上线；接口验收状态分别为已通过和待补测。', '', '')
  assert.match(content, /9 月 12 日/)
  assert.match(content, /9 月 19 日/)
  assert.match(content, /冲突项/)
  assert.match(content, /待确认/)
  assert.match(content, /不发送/)
})

test('office fixture returns a complete revised draft instead of a patch', () => {
  const content = officeCandidate('延期说明；请于9月12日前确认新的联调窗口。', '', '')
  assert.match(content, /待发送草稿/)
  assert.match(content, /第三方接口尚未完成验收/)
  assert.match(content, /9 月 12 日前/)
  assert.match(content, /上线日期.*待确认/s)
})

test('office fixture tool routes preserve candidate-versus-body boundaries', () => {
  const first = completion({
    messages: [{ role: 'user', content: '本轮 SOP 路由：meeting-summary。请先给出飞书会议候选。' }],
  })
  assert.equal(first.choices[0].finish_reason, 'tool_calls')
  assert.equal(first.choices[0].message.tool_calls[0].function.name, 'feishu.meeting_candidates')

  const final = completion({
    messages: [
      { role: 'user', content: '本轮 SOP 路由：meeting-summary。请先给出飞书会议候选。' },
      first.choices[0].message,
      { role: 'tool', content: '{"items":[{"title":"研发例会"}]}' },
    ],
  })
  assert.equal(final.choices[0].finish_reason, 'stop')
  assert.match(final.choices[0].message.content, /候选/)
  assert.match(final.choices[0].message.content, /尚未读取.*正文/s)
})
