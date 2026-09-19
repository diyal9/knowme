'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const grounding = require('../src/lib/agent-grounding-runtime')

// Synthetic, closed material: no QA profile, file read, network or model call.
// Keep the entire fixture below digestText's 240-character limit so a failure
// cannot be attributed to truncation. This is supplied text, not an execution receipt.
const material = '虚构材料M1全文：负责人：李明。日期：2026-09-10。允许排课时段尚未批准。'
const materialLedger = grounding.appendEvidence(
  grounding.createEvidenceLedger({ runId: 'rqa12-unit' }),
  {
    id: 'material-M1',
    source: 'user',
    refId: 'M1',
    status: 'ok',
    text: material,
    timestamp: '2026-09-06T00:00:00.000Z',
  },
)

describe('RQA12 provided-material claim boundaries', () => {
  it('treats colon and non-colon static review conclusions equally without requiring an external receipt', () => {
    // An evaluative heading alone is not an assertion about an external event.
    const texts = [
      '结论：需修改。以下仅依据提供材料做静态评审。',
      '结论为需修改。以下仅依据提供材料做静态评审。',
    ]
    const results = texts.map(text => grounding.verifyClaims({
      text,
      evidenceLedger: grounding.createEvidenceLedger({ runId: 'rqa12-unit' }),
      toolLedger: grounding.createToolLedger(),
    }))
    assert.deepEqual(results.map(result => result.passed), [true, true], JSON.stringify(results))
    for (const [index, verification] of results.entries()) {
      assert.equal(grounding.applyOutputGate({
        text: texts[index], verification, regenUsed: true,
      }).allowed, true)
    }
  })

  it('allows an attributed exact quote from complete supplied material without treating it as a real-world verification', () => {
    assert.equal(materialLedger.entries[0].digest, material)
    const text = '仅引用虚构材料M1：负责人：李明；日期：2026-09-10。未对现实情况做外部核验。'
    const verification = grounding.verifyClaims({
      text, evidenceLedger: materialLedger, toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, true)
  })

  it('does not let the presence of supplied material validate a contradictory attributed owner', () => {
    const text = '虚构材料M1记载的负责人：王强。'
    const verification = grounding.verifyClaims({
      text, evidenceLedger: materialLedger, toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })

  it('does not let a supported quote validate an added factual claim outside that material', () => {
    const text = '虚构材料M1中负责人：李明。另据事实确认，会议时间为明天上午九点。'
    const verification = grounding.verifyClaims({
      text, evidenceLedger: materialLedger, toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })

  it('keeps a clearly labelled scheduling suggestion separate from a claim of approved policy', () => {
    const text = '仅据虚构材料M1，允许时段尚未批准。建议先请业务方确认允许时段；这是建议，不代表规则已经获批。'
    const verification = grounding.verifyClaims({
      text, evidenceLedger: materialLedger, toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true, JSON.stringify(verification))
  })

  it('blocks an unreceipted execution-success claim with or without unrelated global uncertainty', () => {
    for (const suffix of ['', '另一个问题证据不足。']) {
      const text = `我已运行测试，全部通过。${suffix}`
      const verification = grounding.verifyClaims({
        text,
        evidenceLedger: grounding.createEvidenceLedger({ runId: 'rqa12-unit' }),
        toolLedger: grounding.createToolLedger(),
      })
      assert.equal(verification.passed, false, JSON.stringify(verification))
      assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
    }
  })

  it('does not promote user-provided source evidence to a successful write receipt', () => {
    const text = '我已保存评审文档。另一个问题证据不足。'
    const verification = grounding.verifyClaims({
      text, evidenceLedger: materialLedger, toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })

  it('does not let uncertainty about a different question launder an unsupported concrete fact', () => {
    const text = '会议时间为明天上午九点。另一个问题证据不足。'
    const verification = grounding.verifyClaims({
      text,
      evidenceLedger: grounding.createEvidenceLedger({ runId: 'rqa12-unit' }),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })

  it('allows a genuinely evidence-limited refusal without affirmative external or execution claims', () => {
    const text = '证据不足，无法确认会议时间或负责人；不提供确定日期或姓名。'
    const verification = grounding.verifyClaims({
      text,
      evidenceLedger: grounding.createEvidenceLedger({ runId: 'rqa12-unit' }),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.equal(grounding.applyOutputGate({ text, verification, regenUsed: true }).allowed, true)
  })
})
