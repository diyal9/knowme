'use strict'

// Independent RQA12 review. Desired-behavior assertions capture regressions;
// no mocks, API, QA profile, or source writes.
// Call the checker directly with complete synthetic material. This tests the
// finite labelled-field contract, NOT Pasteur's pending GROUND/task/run wiring.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const grounding = require('../src/lib/agent-grounding-ledger')
const { checkProvidedFieldClaims } = require('../src/lib/agent-claim-source-check')
const { buildCalculationTools } = require('../src/lib/agent-calculation-tools')

const sources = [
  { id: 'R1', text: '负责人：李明。日期：2026-09-10。' },
  { id: 'R10', text: '负责人：王芳。日期：2026-09-11。' },
]
const verify = (text, items = sources, extra = {}) => grounding.verifyClaims({
  text, providedMaterials: { items }, ...extra,
})
const ledgersFor = (name, payload) => grounding.mergeToolResultsIntoLedgers({
  toolMessages: [{ toolName: name, toolCallId: 'review-call', status: 'done',
    text: JSON.stringify(payload) }],
})
const gate = (text, verification) => grounding.applyOutputGate({
  text, verification, regenUsed: true,
})

it('control: exact source-prefix quote is supported without any external tool', () => {
  const result = verify('R10：负责人：王芳。')
  assert.equal(result.passed, true)
  assert.deepEqual(result.metadata.fieldChecks[0].sourceIds, ['R10'])
})

it('control: wrong owner is unresolved without an unrelated successful tool', () => {
  const result = verify('R10：负责人：赵强。')
  assert.equal(result.passed, false)
  assert.equal(result.metadata.fieldChecks[0].support, 'unresolved')
})

it('control: provided text cannot substitute for an execution receipt', () => {
  const result = verify('我已发送通知。', [{ id: 'R1', text: '通知已发送。' }])
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(v => v.code === 'unsupported_execution_claim'))
})

it('control: local uncertainty does not excuse a different affirmative field', () => {
  assert.equal(verify('负责人：未知。日期：2099-12-31。').passed, false)
})

it('control: plain review verdict is allowed, attributed meeting verdict is not', () => {
  assert.equal(verify('结论：需修改。').passed, true)
  assert.equal(verify('本次会议结论：通过。').passed, false)
})

it('P1: a real calculation cannot launder an unrelated unresolved owner through the output gate', async () => {
  const calculated = await buildCalculationTools().handlers.calculate({ calculations: [{ expression: '1+1' }] })
  assert.equal(calculated.ok, true)
  const ledgers = grounding.mergeToolResultsIntoLedgers({
    toolMessages: [{ toolName: 'calculate', toolCallId: 'math', status: 'done', text: calculated.text }],
  })
  const text = 'R10：负责人：赵强。'
  const result = verify(text, sources, ledgers)
  assert.equal(result.metadata.fieldChecks[0].support, 'unresolved')
  assert.equal(result.passed, false, 'successful math proves no owner: ' + JSON.stringify(result))
  assert.equal(gate(text, result).allowed, false)
})

it('P1: empty content search plus query/timing metadata is not substantive evidence', () => {
  const payload = { ok: true, query: '负责人', results: [], durationMs: 2 }
  const quality = grounding.classifyToolResultQuality('fabric_search', { ok: true, text: JSON.stringify(payload) })
  assert.equal(quality.status, 'empty', JSON.stringify(quality))
})

it('P1: empty content search cannot authorize a concrete owner claim', () => {
  const result = verify('负责人：赵强。', sources,
    ledgersFor('fabric_search', { ok: true, query: '负责人', results: [], durationMs: 2 }))
  assert.equal(result.metadata.fieldChecks[0].support, 'unresolved')
  assert.equal(result.passed, false, JSON.stringify(result))
})

it('P1: source R10 cannot borrow source R1 through substring identity matching', () => {
  const checked = checkProvidedFieldClaims('R10：负责人：李明。', sources)
  assert.equal(checked[0].support, 'unresolved', JSON.stringify(checked))
  assert.equal(verify('R10：负责人：李明。').passed, false)
})

it('P1: an explicitly bracketed missing source must not fall back to unrelated sources', () => {
  const checked = checkProvidedFieldClaims('[MISSING] 负责人：李明。', sources)
  assert.equal(checked[0].support, 'unresolved', JSON.stringify(checked))
})

it('P1: valid trailing source citation is not part of the field value', () => {
  const result = verify('负责人：李明 [R1]。')
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.deepEqual(result.metadata.fieldChecks[0].sourceIds, ['R1'])
})

it('P1: a Markdown heading does not turn the same static review verdict into an external fact', () => {
  const text = '## 结论：需修改'
  const result = verify(text)
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.equal(gate(text, result).allowed, true)
})

it('P1: explicit non-approval review verdict does not need an external event receipt', () => {
  const text = '结论：不建议整体通过。'
  const result = verify(text)
  assert.equal(result.passed, true, JSON.stringify(result))
})

it('P1: an explicitly marked owner suggestion is not an asserted assignment', () => {
  const text = '建议负责人：赵强。此项仅为建议，尚待决策。'
  assert.equal(verify(text).passed, true)
})

it('P1: comma-separated unsupported field members cannot be silently discarded', () => {
  const result = verify('R1：负责人：李明，赵强。')
  assert.equal(result.passed, false, JSON.stringify(result))
})

it('inherited execution-regex boundary: quoted static precondition is not personal save success', () => {
  const text = '用例前置：“已保存文件”。操作：尝试打开。执行状态：未执行。'
  const result = verify(text)
  assert.equal(result.passed, true, 'static design is not an execution receipt claim: ' + JSON.stringify(result))
})

it('documented scope: free prose and split-header tables are not semantically certified by fieldChecks', () => {
  assert.deepEqual(checkProvidedFieldClaims('负责人是赵强。', sources), [])
  assert.deepEqual(checkProvidedFieldClaims('| 负责人 |\n| --- |\n| 赵强 |', sources), [])
  const result = verify('负责人是赵强。')
  assert.equal(result.metadata.verificationScope, 'execution_receipts_and_labelled_fields_not_semantic_truth')
  // No assertion that passing this finite check establishes factual truth.
})

it('full matching tool messages support exact tail fields beyond digest240, but not other owners', () => {
  const body = '背景说明。'.repeat(70) + '负责人：李明。'
  for (const text of [body, JSON.stringify({ doc_token: 'doc-A', body })]) {
    const toolMessages = [{ toolName: 'feishu.read_doc', toolCallId: 'tail-read',
      status: 'done', args: { doc_token: 'doc-A' }, text }]
    const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages })
    assert.equal(ledgers.evidenceLedger.entries[0].status, 'ok')
    assert.equal(ledgers.evidenceLedger.entries[0].digest.includes('李明'), false)
    const result = grounding.verifyClaims({ text: '负责人：李明。', ...ledgers, toolMessages })
    assert.equal(result.passed, true, JSON.stringify(result))
    assert.equal(grounding.verifyClaims({ text: '负责人：赵强。', ...ledgers, toolMessages }).passed, false)
    // A persisted digest alone does not prove the missing tail.
    assert.equal(grounding.verifyClaims({ text: '负责人：李明。', ...ledgers }).passed, false)
  }
})

it('full tool text preserves a newline field boundary even below digest240', () => {
  const text = '负责人：李明\n' + '其他说明'.repeat(25)
  assert.ok(text.length < 240)
  const toolMessages = [{ toolName: 'feishu.read_doc', toolCallId: 'newline-read', status: 'done', text }]
  const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages })
  assert.equal(ledgers.evidenceLedger.entries[0].digest.includes('\n'), false)
  const result = grounding.verifyClaims({ text: '负责人：李明。', ...ledgers, toolMessages })
  assert.equal(result.passed, true, JSON.stringify(result))
})

it('P1: an explicitly cited, verified tool resource identity can support its own exact field', () => {
  const toolMessages = [{ toolName: 'feishu.read_doc', toolCallId: 'bound-read', status: 'done',
    args: { doc_token: 'doc-A' },
    text: JSON.stringify({ doc_token: 'doc-A', body: '负责人：李明。' + '背景说明。'.repeat(20) }) }]
  const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages })
  const entry = ledgers.evidenceLedger.entries[0]
  assert.equal(entry.status, 'ok')
  assert.equal(entry.provenance.expectedSource.doc_token, 'doc-A')
  assert.equal(entry.provenance.actualSource.doc_token, 'doc-A')
  assert.equal(grounding.verifyClaims({ text: '负责人：李明。', ...ledgers, toolMessages }).passed, true)
  const result = grounding.verifyClaims({ text: '[doc-A] 负责人：李明。', ...ledgers, toolMessages })
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.ok(result.metadata.fieldChecks[0].sourceIds.includes('doc-A'))
  assert.equal(grounding.verifyClaims({ text: '[doc-B] 负责人：李明。', ...ledgers, toolMessages }).passed, false)
})

it('P1: zero-result search query echo is not retrieved owner evidence even with a numeric total', () => {
  const toolMessages = [{ toolName: 'fabric_search', toolCallId: 'empty-query', status: 'done',
    text: JSON.stringify({ ok: true, query: '负责人：赵强。', results: [], total: 0 }) }]
  const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages })
  const text = '负责人：赵强。'
  const result = grounding.verifyClaims({ text, ...ledgers, toolMessages })
  assert.equal(result.metadata.fieldChecks[0].support, 'unresolved', JSON.stringify(result))
  assert.equal(result.passed, false)
  assert.equal(gate(text, result).allowed, false)
})

it('full-body lookup cannot borrow a different tool call or a different tool name', () => {
  const body = '背景说明。'.repeat(70) + '负责人：李明。'
  const original = { toolName: 'feishu.read_doc', toolCallId: 'original', status: 'done', text: body }
  const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages: [original] })
  for (const message of [{ ...original, toolCallId: 'other' }, { ...original, toolName: 'fabric_search' }]) {
    const result = grounding.verifyClaims({ text: '负责人：李明。', ...ledgers, toolMessages: [message] })
    assert.equal(result.passed, false, JSON.stringify(result))
  }
})

it('quoted static precondition never exempts an additional actual execution claim', () => {
  for (const text of [
    '用例前置：“已保存文件”。我已发送通知。',
    '用例前置：“已保存文件”，我已发送通知。',
  ]) {
    const result = verify(text)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.violations.some(v => v.code === 'unsupported_execution_claim' && /发送/.test(v.message)))
  }
})
