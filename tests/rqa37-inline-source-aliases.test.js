'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const grounding = require('../src/lib/agent-grounding-ledger')

function verify(text, items) {
  return grounding.verifyClaims({
    text,
    providedMaterials: { items },
    evidenceLedger: grounding.createEvidenceLedger(),
    toolLedger: grounding.createToolLedger(),
  })
}

describe('RQA37 inline source aliases', () => {
  it('allows a unique rule label declared inside one provided material', () => {
    const result = verify('依据 [R1]，访客规则覆盖成员规则。', [{
      id: 'provided-context',
      text: 'R1：成员可读。\nR2：访客不可读。',
    }])
    assert.equal(result.passed, true, JSON.stringify(result))
  })

  it('still rejects an undeclared inline label', () => {
    const result = verify('依据 [R3]，访客规则覆盖成员规则。', [{
      id: 'provided-context',
      text: 'R1：成员可读。\nR2：访客不可读。',
    }])
    assert.equal(result.passed, false)
    assert.ok(result.violations.some(item => item.code === 'unresolved_source_citation'))
  })

  it('does not resolve an alias that is ambiguous across materials', () => {
    const result = verify('依据 [R1]。', [
      { id: 'document-a', text: 'R1：甲规则。' },
      { id: 'document-b', text: 'R1：乙规则。' },
    ])
    assert.equal(result.passed, false)
    assert.ok(result.violations.some(item => item.code === 'unresolved_source_citation'))
  })
})
