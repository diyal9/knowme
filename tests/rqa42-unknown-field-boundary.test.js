'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')

const verify = (text, materials = []) => verifyClaims({
  text,
  providedMaterials: { items: materials },
})

function assertAllowed(text) {
  const result = verify(text)
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.equal(result.metadata.fieldChecks.length, 0, JSON.stringify(result.metadata.fieldChecks))
  assert.equal(applyOutputGate({ text, verification: result, regenUsed: true }).allowed, true)
}

function assertBlocked(text, label) {
  const result = verify(text)
  assert.equal(result.passed, false, JSON.stringify(result))
  assert.ok(result.metadata.fieldChecks.some(field => field.label === label && field.support === 'unresolved'))
  assert.ok(result.violations.some(item => item.code === 'ungrounded_external_fact'))
  assert.equal(applyOutputGate({ text, verification: result, regenUsed: true }).allowed, false)
}

describe('RQA42 bounded unknown-field grammar', () => {
  it('allows common date wording that explicitly keeps the value unresolved', () => {
    for (const text of [
      '上线日期：尚未确定。',
      '日期：目前尚未明确。',
      '日期：待双方确认。',
      '日期：还没定。',
      '日期：尚未确定，待第三方接口验收通过后另行确认。',
    ]) assertAllowed(text)
  })

  it('allows an unresolved owner instead of demanding a fabricated assignment', () => {
    for (const text of [
      '责任人：尚未明确。',
      '负责人：待业务方指定。',
      '责任人：目前无法确认，请相关方补充。',
    ]) assertAllowed(text)
  })

  it('still blocks concrete dates hidden behind a pending prefix', () => {
    assertBlocked('日期：待确认后于2099-12-31上线。', '日期')
    assertBlocked('日期：尚未确定，但暂定2099年12月31日。', '日期')
  })

  it('still blocks a concrete owner hidden behind an unresolved prefix', () => {
    assertBlocked('责任人：尚未明确，暂由赵强负责。', '责任人')
    assertBlocked('负责人：待确认，当前由王芳跟进。', '负责人')
  })

  it('still blocks ordinary fabricated owner and date fields', () => {
    assertBlocked('负责人：赵强。', '负责人')
    assertBlocked('日期：2099-12-31。', '日期')
  })

  it('does not weaken execution receipt checks', () => {
    const result = verify('上线日期：尚未确定。我已发送延期通知。')
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.violations.some(item => item.code === 'unsupported_execution_claim'))
  })
})
