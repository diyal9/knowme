'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { buildTextCandidate, completion, lastUserPrompt } = require('../scripts/qualification-text-fixture-server')

test('text qualification fixture returns deterministic structured text', () => {
  const prompt = '请完成一份分析报告，并明确区分已知事实与未知项。'
  const result = completion({ messages: [{ role: 'user', content: prompt }] })
  const content = result.choices[0].message.content

  assert.equal(result.object, 'chat.completion')
  assert.equal(result.choices[0].finish_reason, 'stop')
  assert.match(content, /结构化交付/)
  assert.match(content, /未提供的事实/)
  assert.equal(lastUserPrompt([{ role: 'user', content: prompt }]), prompt)
})

test('text qualification fixture gives product tasks a reviewable PRD instead of a placeholder', () => {
  const content = buildTextCandidate([
    '请作为产品经理，直接在对话中交付一份可评审的访客申请功能 PRD。',
    '已知事实：员工填写访客姓名和到访时间；前台审批后生成二维码；网络超时不得重复创建申请。',
  ].join('\n'))

  assert.match(content, /背景与目标/)
  assert.match(content, /范围与非目标/)
  assert.match(content, /申请中.*待审批.*已批准/s)
  assert.match(content, /网络超时/)
  assert.match(content, /WHEN.*THEN/s)
  assert.doesNotMatch(content, /已根据当前任务材料完成一轮结构化处理/)
})

test('text qualification fixture gives data tasks reproducible calculations and evidence limits', () => {
  const content = buildTextCandidate([
    '请作为数据分析师直接在对话中分析以下虚构数据。',
    '上周搜索访客900、注册90；展示访客100、注册2。',
    '本周搜索访客100、注册12；展示访客900、注册27。',
  ].join('\n'))

  assert.match(content, /92\/1000=9\.2%/)
  assert.match(content, /39\/1000=3\.9%/)
  assert.match(content, /因果证明/)
  assert.match(content, /费用、收入、留存/)
  assert.match(content, /最小验证/)
})

test('text qualification fixture honors the data-analysis tool contract before answering', () => {
  const prompt = [
    '你是组织内专业 Agent「data-analyst」。',
    '本轮 SOP 路由：data-analysis-method。',
    '请作为数据分析师分析上周搜索访客900、注册90；展示访客100、注册2。',
  ].join('\n')
  const toolRequest = completion({
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'function', function: { name: 'calculate' } }],
  })

  assert.equal(toolRequest.choices[0].finish_reason, 'tool_calls')
  assert.equal(toolRequest.choices[0].message.tool_calls[0].function.name, 'calculate')
  assert.match(toolRequest.choices[0].message.tool_calls[0].function.arguments, /92\/1000/)

  const final = completion({
    messages: [
      { role: 'user', content: prompt },
      toolRequest.choices[0].message,
      { role: 'tool', content: '{"ok":true,"results":[{"value":0.092}]}' },
    ],
    tools: [{ type: 'function', function: { name: 'calculate' } }],
  })
  assert.equal(final.choices[0].finish_reason, 'stop')
  assert.match(final.choices[0].message.content, /92\/1000=9\.2%/)
})

test('text qualification fixture gives software tasks an implementation-shaped answer', () => {
  const content = buildTextCandidate([
    '请作为软件工程师实现 JavaScript 函数 runPool(tasks, limit)。',
    '任意时刻最多 limit 个任务运行；结果保持输入顺序；首个任务失败后不得启动新任务。',
  ].join('\n'))

  assert.match(content, /function runPool/)
  assert.match(content, /INVALID_ARGUMENT/)
  assert.match(content, /峰值并发/)
  assert.match(content, /未真实运行/)
})

test('text qualification fixture implements the quality-audit JSON contract', () => {
  const prompt = [
    '只返回一行严格 JSON',
    '候选稿：已完成交付。',
    '1. 必须覆盖用户目标',
    '2. 必须说明证据边界',
  ].join('\n')
  const result = completion({ messages: [{ role: 'user', content: prompt }] })
  const audit = JSON.parse(result.choices[0].message.content)

  assert.equal(audit.pass, true)
  assert.equal(audit.userRequirements.pass, true)
  assert.equal(audit.checks.length, 2)
  assert.deepEqual(audit.checks.map(check => check.criterion), [1, 2])
  assert.ok(audit.checks.every(check => check.pass === true))
})
