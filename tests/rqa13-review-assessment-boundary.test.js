'use strict'

// Independent desired-behavior regressions. No expert ID, model, API or QA data.
// The RR01 string below is the sample reported by main, not a recreated QA run.
// This finite field gate does not certify review quality or semantic truth.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')

const verify = (text, extra = {}) => verifyClaims({ text, ...extra })
const outputGate = (text, verification) => applyOutputGate({ text, verification, regenUsed: true })

for (const [name, text] of [
  ['reported RR01 sample', '评审结论：阻塞（需修改）'],
  ['existing bare verdict', '结论：需修改。'],
  ['bare finite verdict combination', '结论：阻塞（需修改）。'],
  ['current review title', '本次评审结论：阻塞（需修改）。'],
  ['current round review title', '本轮评审结论：有条件通过（待补充）。'],
  ['this review title', '本评审结论：需修改。'],
  ['Markdown title and ASCII parentheses', '## 评审结论：阻塞(需修改)'],
  ['numbered Markdown review title', '## 一、评审结论：当前规则可同时成立。'],
  ['numeric Markdown review title', '### 1. 本次评审结论：P1 与 P2 不直接冲突。'],
  ['local assessment with explanatory parenthesis', '结论：有条件通过（需补充字段权限与性能阈值）。'],
]) {
  it(`allows an assessment without external evidence: ${name}`, () => {
    const result = verify(text)
    assert.equal(result.passed, true, JSON.stringify(result))
    assert.deepEqual(result.metadata.fieldChecks, [])
    assert.equal(outputGate(text, result).allowed, true)
  })
}

for (const text of ['会议评审结论：阻塞（需修改）。', '客户评审结论：通过。', '## 一、客户评审结论：通过。']) {
  it(`retains evidence checking for attributed events: ${text}`, () => {
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.metadata.fieldChecks.some(field => field.label === '结论' && field.support === 'unresolved'))
    assert.equal(outputGate(text, result).allowed, false)
  })
}

it('an attributed exact source excerpt remains allowed, not an unconditional attribution ban', () => {
  const text = '[R1] 客户评审结论：通过。'
  const result = verify(text, { providedMaterials: { items: [{ id: 'R1', text: '客户评审结论：通过。' }] } })
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.deepEqual(result.metadata.fieldChecks[0].sourceIds, ['R1'])
})

it('local review conclusions are assessments while attributed conclusions still need a source', () => {
  assert.equal(verify('评审结论：系统支持离线同步。').passed, true)
  assert.equal(verify('本次评审结论：当前规则之间不存在直接冲突。').passed, true)
  assert.equal(verify('总体结论：R5 不阻塞独立权限规则。').passed, true)
  assert.equal(verify('结论：当前规则之间不存在直接冲突。').passed, true)
  const attributed = verify('本次评审结论：通过且客户已批准上线。')
  assert.equal(attributed.passed, false, JSON.stringify(attributed))
  assert.ok(attributed.violations.some(item => item.code === 'ungrounded_external_fact'))
})

it('parentheses must contain only finite assessments, not facts or factual fields', () => {
  for (const text of [
    '评审结论：阻塞（客户已批准上线）。',
    '评审结论：通过（负责人：赵强）。',
    '评审结论：需修改（日期：2099-12-31）。',
  ]) {
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.metadata.fieldChecks.some(field => field.support === 'unresolved'))
  }
})

it('an assessment cannot exempt unreceipted execution, inside parentheses or afterwards', () => {
  for (const text of [
    '评审结论：通过（我已发送通知）。',
    '评审结论：阻塞（需修改）。我已发送通知。',
    '评审结论：需修改。\n我已运行测试，全部通过。',
  ]) {
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.violations.some(v => v.code === 'unsupported_execution_claim'))
    assert.equal(outputGate(text, result).allowed, false)
  }
})

it('adjacent owner and date fields remain checked independently of the assessment', () => {
  for (const separator of ['，', '；', '\n', ' | ']) {
    const text = `评审结论：阻塞（需修改）${separator}负责人：赵强${separator}日期：2099-12-31。`
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    for (const label of ['负责人', '日期']) {
      assert.ok(result.metadata.fieldChecks.some(field => field.label === label && field.support === 'unresolved'))
    }
  }
})

it('global suggestion language does not waive affirmative factual fields in the answer', () => {
  const text = '以下仅为建议。\n评审结论：阻塞（需修改）。\n负责人：赵强。日期：2099-12-31。'
  const result = verify(text)
  assert.equal(result.passed, false, JSON.stringify(result))
  assert.ok(result.metadata.fieldChecks.some(field => field.label === '负责人' && field.support === 'unresolved'))
  assert.ok(result.metadata.fieldChecks.some(field => field.label === '日期' && field.support === 'unresolved'))
})

it('an explicit source citation must not disappear into the local assessment exemption', () => {
  for (const text of ['[MISSING] 评审结论：阻塞（需修改）。', '评审结论：阻塞（需修改） [MISSING]。']) {
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.metadata.fieldChecks.some(field => field.label === '结论' && field.support === 'unresolved'))
  }
})

it('an explicit citation can quote the same assessment retained in its source', () => {
  const providedMaterials = { items: [{ id: 'R1', text: '评审结论：通过。' }] }
  for (const text of ['[R1] 评审结论：通过。', '评审结论：通过 [R1]。']) {
    const result = verify(text, { providedMaterials })
    assert.equal(result.passed, true, JSON.stringify(result))
    assert.equal(result.metadata.fieldChecks.length, 1, 'a citation is checked, not locally exempted')
    assert.equal(result.metadata.fieldChecks[0].support, 'source_excerpt')
    assert.deepEqual(result.metadata.fieldChecks[0].sourceIds, ['R1'])
  }
  const result = verify('[R1] 评审结论：通过。我已发送通知。', { providedMaterials })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(v => v.code === 'unsupported_execution_claim'))
})

it('an explicit assessment citation cannot contradict or borrow a different source', () => {
  const providedMaterials = { items: [
    { id: 'R1', text: '评审结论：不通过。' },
    { id: 'R2', text: '评审结论：通过。' },
  ] }
  for (const text of ['[R1] 评审结论：通过。', '评审结论：通过 [R1]。']) {
    const result = verify(text, { providedMaterials })
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.metadata.fieldChecks.some(field => field.label === '结论' && field.support === 'unresolved'))
    assert.equal(outputGate(text, result).allowed, false)
  }
})

it('a pure assessment cannot satisfy an unmet required-tool contract', () => {
  const text = '评审结论：阻塞（需修改）。'
  const result = verify(text, { taskFrame: { requiredTools: ['read_file'] } })
  assert.equal(result.passed, false, JSON.stringify(result))
  assert.ok(result.violations.some(v => v.code === 'missing_required_tools'))
  assert.equal(outputGate(text, result).allowed, false)
})

it('passing the finite field checker is not a semantic truth certification', () => {
  const result = verify('这只是静态评审意见。')
  assert.equal(result.metadata.verificationScope, 'execution_receipts_and_labelled_fields_not_semantic_truth')
})

it('source extraction retains bare and parenthesized assessments for real quotations', () => {
  for (const assessment of ['结论：通过', '本次评审结论：阻塞（需修改）']) {
    const text = `[R1] ${assessment}。`
    const result = verify(text, { providedMaterials: { items: [{ id: 'R1', text: assessment + '。' }] } })
    assert.equal(result.passed, true, JSON.stringify(result))
    assert.equal(result.metadata.fieldChecks.length, 1, 'citation must be verified rather than exempted')
    assert.equal(result.metadata.fieldChecks[0].support, 'source_excerpt')
    assert.deepEqual(result.metadata.fieldChecks[0].sourceIds, ['R1'])
  }
})

it('finite verdict grammar rejects nested, mismatched, empty or factual parenthesis extensions', () => {
  for (const value of [
    '阻塞（需修改（待补充））',
    '阻塞（需修改)',
    '阻塞(需修改）',
    '阻塞（）',
    '阻塞（需修改）（待补充）',
    '阻塞（需修改）且客户已批准上线',
  ]) {
    const text = `评审结论：${value}。`
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.metadata.fieldChecks.some(field => field.label === '结论' && field.support === 'unresolved'))
    assert.equal(outputGate(text, result).allowed, false)
  }
})
