'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildQualityAuditInstruction,
  buildQualityRewriteInstruction,
  parseQualityAudit,
} = require('../src/lib/agent-professional-review')

test('professional review cannot invent acceptance criteria outside the declared contract', () => {
  const prompt = buildQualityAuditInstruction(['检查用户要求中的事件订阅语义。'])
  assert.match(prompt, /审查边界只包括用户明示合同/)
  assert.match(prompt, /不得把未声明的实现偏好、额外测试、顺序、性能指标/)
  assert.match(prompt, /没有规定两个并发错误、取消或状态事件的相对优先级/)
})

test('professional review emits an exact audit row template for every criterion', () => {
  const prompt = buildQualityAuditInstruction(['标准一', '标准二', '标准三', '标准四'])
  assert.match(prompt, /checks 必须恰好有 4 项/)
  for (const criterion of [1, 2, 3, 4]) {
    assert.match(prompt, new RegExp(`"criterion":${criterion}`))
  }
})

test('professional review derives the aggregate verdict from validated rows', () => {
  const audit = parseQualityAudit(JSON.stringify({
    pass: false,
    userRequirements: { pass: true, evidence: '用户合同全部覆盖', reason: '逐项核对通过' },
    checks: [{ criterion: 1, pass: true, evidence: '实现覆盖标准一', reason: '反例推演通过' }],
  }), 1)
  assert.equal(audit.valid, true)
  assert.equal(audit.pass, true)
  assert.deepEqual(audit.issues, [])
})

test('professional review cannot hide a failed row behind a true aggregate flag', () => {
  const audit = parseQualityAudit(JSON.stringify({
    pass: true,
    userRequirements: { pass: true, evidence: '用户合同全部覆盖', reason: '逐项核对通过' },
    checks: [{
      criterion: 1,
      pass: false,
      evidence: '缺少失败分支',
      reason: '合同要求失败路径',
      requiredChange: '补充失败分支',
    }],
  }), 1)
  assert.equal(audit.valid, true)
  assert.equal(audit.pass, false)
  assert.equal(audit.issues.length, 1)
})

test('professional rewrite removes explicitly forbidden syntax from the full replacement', () => {
  const prompt = buildQualityRewriteInstruction(['修订稿不得残留旧语法。'], {
    valid: true,
    issues: [{ criterion: 1, problem: '仍使用 trim', requiredChange: '禁止 trim，改用 ASCII 捕获组' }],
  })
  assert.match(prompt, /逐条落实 requiredChange/)
  assert.match(prompt, /重新从头核对用户每一条明示合同/)
  assert.match(prompt, /字面扫描/)
  assert.match(prompt, /代码、注释、测试和结论中都已清除/)
})
