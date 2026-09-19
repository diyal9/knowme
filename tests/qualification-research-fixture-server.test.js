'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { completion, researchCandidate } = require('../scripts/qualification-research-fixture-server')

test('research fixture keeps incomparable adoption measures separate', () => {
  const content = researchCandidate('官方公告说覆盖100家客户，第三方调研说80家付费客户，访谈覆盖6家公司。不要联网。', 'provided-material', '', false)
  assert.match(content, /不可直接合并/)
  assert.match(content, /不能计算统一采用率/)
  assert.match(content, /样本选择/)
  assert.match(content, /未联网/)
})

test('research fixture requires search then source reads before public conclusions', () => {
  const prompt = '本轮 SOP 路由：public-web-research。请联网搜索两家指定厂商的官方产品能力和当前公开价格。'
  const first = completion({ messages: [{ role: 'user', content: prompt }] })
  assert.equal(first.choices[0].finish_reason, 'tool_calls')
  assert.equal(first.choices[0].message.tool_calls[0].function.name, 'search_web')

  const second = completion({
    messages: [
      { role: 'user', content: prompt },
      first.choices[0].message,
      { role: 'tool', content: 'search results' },
    ],
  })
  assert.equal(second.choices[0].message.tool_calls[0].function.name, 'fetch_web_page')

  const final = researchCandidate(prompt, 'public-web-research', 'Vendor A official page; Vendor B official page', false)
  assert.match(final, /来源事实/)
  assert.match(final, /搜索摘要.*原文/s)
  assert.match(final, /访问日期/)
})

test('research fixture keeps a failed official source as pending review', () => {
  const content = researchCandidate('根据已读取的官方页面比较两家厂商。', 'public-web-research', '404', true)
  assert.match(content, /404/)
  assert.match(content, /待复核/)
  assert.match(content, /没有用搜索摘要替代/)
})
