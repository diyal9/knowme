'use strict'

// RQA18 citation half only. Real verifier and output gate; no semantic-review
// mock, model/API call, or changes to existing assessment expectations.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const grounding = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const materials = createProvidedMaterialsSnapshot({ taskId: 'rqa18-task', runId: 'rqa18-run', materials: [
  { id: 'R1', content: '负责人：李明。日期：2026-09-10。客户评审结论：不通过。' },
  { id: 'R2', content: '负责人：王芳。日期：2026-09-11。客户评审结论：通过。' },
] })

function check(text, extra = {}) {
  const result = grounding.verifyClaims({ text, providedMaterials: materials, ...extra })
  const gate = grounding.applyOutputGate({ text, verification: result, regenUsed: true })
  return { result, gate }
}

function assertBlocked(text, extra) {
  const { result, gate } = check(text, extra)
  assert.equal(result.passed, false, 'unresolved reference/fact must not pass: ' + JSON.stringify(result))
  assert.ok(result.violations.length > 0)
  assert.equal(gate.allowed, false)
}

function assertAllowed(text) {
  const { result, gate } = check(text)
  assert.equal(result.passed, true, JSON.stringify(result))
  assert.equal(gate.allowed, true)
  assert.equal(gate.text, text)
  // Passing this bounded gate is not a certification of semantic truth.
  assert.equal(result.metadata.verificationScope, 'execution_receipts_and_labelled_fields_not_semantic_truth')
}

for (const [name, text] of [
  ['unknown reference without any labelled field', '请核对材料[MISSING]。'],
  ['known then missing in ordinary prose', '请核对材料[R1][MISSING]。'],
  ['missing then known in ordinary prose', '请核对材料[MISSING][R1]。'],
  ['unknown reference in a separate sentence', '请核对材料[R1]。另参见[MISSING]。'],
  ['unknown reference on a separate line', '请核对材料[R1]。\n另参见[MISSING]。'],
  ['owner supported but a different prose reference is missing', '负责人：李明 [R1]。另参见[MISSING]。'],
  ['known and missing before owner field', '[R1][MISSING] 负责人：李明。'],
  ['missing and known before owner field', '[MISSING][R1] 负责人：李明。'],
  ['known and missing after owner field', '负责人：李明 [R1][MISSING]。'],
  ['prefix-similar missing reference in prose', '请核对材料[R10]。'],
  ['missing reference after many valid repetitions', '材料' + '[R1]'.repeat(24) + '[MISSING]。'],
]) {
  it(`RQA18 globally rejects ${name}`, () => assertBlocked(text))
}

for (const [name, text] of [
  ['known reference in ordinary prose', '请核对材料[R1]。'],
  ['two existing references without asserting identical contents', '请分别核对材料[R1][R2]。'],
  ['repeated known citation in prose', '请核对材料[R1][R1]。'],
  ['repeated known citation on exact owner field', '[R1][R1] 负责人：李明。'],
  ['exact owner and date with separate source bindings', '负责人：李明 [R1]。日期：2026-09-11 [R2]。'],
]) {
  it(`RQA18 accepts ${name}`, () => assertAllowed(text))
}

for (const [name, text] of [
  ['inline link', '参考 [MISSING](https://example.invalid/guide)。'],
  ['inline image', '示意图 ![MISSING](https://example.invalid/image.png)。'],
  ['reference-style link', '参考 [guide][LINK]。\n\n[LINK]: https://example.invalid/guide'],
  ['reference-style image', '示意图 ![diagram][IMAGE]。\n\n[IMAGE]: https://example.invalid/image.png'],
  ['task checkboxes', '- [ ] 核对材料\n- [x] 整理结构\n- [X] 保留边界'],
  ['link followed by a genuine supported owner citation', '[MISSING](https://example.invalid/guide)。负责人：李明 [R1]。'],
]) {
  it(`RQA18 does not reinterpret Markdown ${name} as a source citation`, () => assertAllowed(text))
}

for (const text of [
  '[guide](https://example.invalid/guide)。另参见[MISSING]。',
  '![diagram](https://example.invalid/image.png)。另参见[MISSING]。',
  '- [x] 整理结构\n另参见[MISSING]。',
]) {
  it(`RQA18 Markdown exclusion is local, not a whole-answer citation bypass: ${text}`, () => assertBlocked(text))
}

it('RQA18 missing citation is rejected even when unrelated calculation succeeded', () => {
  const toolLedger = grounding.recordToolCall(grounding.createToolLedger(), { name: 'calculate', status: 'ok' })
  assert.equal(toolLedger.calls[0].status, 'ok')
  assertBlocked('请核对材料[R1][MISSING]。', { toolLedger })
})

it('RQA18 resolving citations does not make a fabricated owner supported', () => {
  assertBlocked('负责人：赵强 [R1]。')
})

it('RQA18 explicit event attribution cannot borrow the conclusion of another source', () => {
  assertBlocked('[R1] 客户评审结论：通过。')
  assertAllowed('[R2] 客户评审结论：通过。')
})

it('RQA18 missing-only citation on an owner field remains blocked', () => {
  assertBlocked('[MISSING] 负责人：李明。')
})

it('RQA18 source R10 cannot borrow R1 by prefix identity', () => {
  assertBlocked('[R10] 负责人：李明。')
})

it('RQA18 valid citation does not provide a completed-action receipt', () => {
  const { result, gate } = check('材料[R1]。我已发送通知。')
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(item => item.code === 'unsupported_execution_claim'))
  assert.equal(gate.allowed, false)
})

it('RQA18 valid citations and owner cannot waive explicit required tools or evidence', () => {
  const { result, gate } = check('负责人：李明 [R1]。', { taskFrame: {
    requiredTools: ['read_file'], requiredEvidence: [{ tool: 'read_file', kind: 'tool_result' }],
  } })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(item => item.code === 'missing_required_tools'))
  assert.ok(result.violations.some(item => item.code === 'missing_required_evidence'))
  assert.equal(gate.allowed, false)
})

// Analytical derivation is intentionally NOT made a direct-verifyClaims
// passing assertion here. Its host-anchored reviewer interface is pending.
// See the separate RQA18 review report for the proposed integration matrix.
