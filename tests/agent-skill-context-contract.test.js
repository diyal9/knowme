'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const { buildSkillL0Block } = require('../src/lib/agent-context-assembly')

it('distinguishes method skills from callable functions and supplies the load identifier', () => {
  const text = buildSkillL0Block([{ id: 'sample-method', name: '示例方法', description: '核对输入', slash: 'sample' }])
  assert.match(text, /不是可直接调用的函数/)
  assert.match(text, /本轮工具列表.*load_skill/)
  assert.match(text, /skill_id=sample-method/)
  assert.match(text, /示例方法/)
  assert.match(text, /核对输入/)
  assert.doesNotMatch(text, /sample_method/)
})

it('does not invent available skills and retains the L0 size limit', () => {
  assert.equal(buildSkillL0Block([]), '')
  const text = buildSkillL0Block([{ id: 'long-method', description: '资料'.repeat(4000) }])
  assert.ok(text.length <= 2400)
  assert.match(text, /不是可直接调用的函数/)
})
