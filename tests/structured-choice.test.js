const { describe, it } = require('node:test')
const assert = require('node:assert')
const structuredChoice = require('../src/lib/structured-choice')

describe('structured-choice', () => {
  it('treats fill action as input-required choice', () => {
    const yes = structuredChoice.needsUserInput({ action: 'fill', label: '补充信息', payload: '' })
    assert.equal(yes, true)
  })

  it('treats supplement wording as input-required even when action is send', () => {
    const yes = structuredChoice.needsUserInput({
      action: 'send',
      label: '补充工作任务到日程',
      description: '先补充要点',
      payload: '请补充今天任务',
    })
    assert.equal(yes, true)
  })

  it('renders structured choice container and input flag', () => {
    const html = structuredChoice.render({
      title: '下一步建议',
      items: [
        { action: 'send', label: '导出今日日程', payload: '导出今日日程' },
        { action: 'fill', label: '补充工作任务到日程', payload: '[在此输入任务]' },
      ],
    }, {
      payloadNeedsUserEdit: (payload) => /\[.+\]/.test(payload),
    })
    assert.ok(html.includes('structured-choice'), 'uses structured choice class')
    assert.ok(html.includes('data-needs-input="0"'), 'send item keeps non-input flag')
    assert.ok(html.includes('data-needs-input="1"'), 'fill item is input-required')
  })

  it('parses selection payload and needsInput from dataset', () => {
    const button = {
      dataset: {
        suggestAct: 'send',
        payload: encodeURIComponent('测试内容'),
        needsInput: '1',
      },
    }
    const parsed = structuredChoice.parseSelectionButton(button)
    assert.equal(parsed.action, 'send')
    assert.equal(parsed.payload, '测试内容')
    assert.equal(parsed.needsInput, true)
  })
})
