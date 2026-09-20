'use strict'

// Follow-up to the frozen 32+30 tests. Actual parser and verifier only.
// HTML prose must not become an answer-wide citation exemption; Markdown
// definitions must retain full-answer context during labelled-field checks.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const providedMaterials = createProvidedMaterialsSnapshot({
  taskId: 'rqa18-context-task', runId: 'rqa18-context-run',
  materials: [
    { id: 'R1', content: '负责人：李明。日期：2026-09-10。' },
    { id: 'R2', content: '负责人：王芳。日期：2026-09-11。' },
  ],
})

const check = (text, extra = {}) => verifyClaims({ text, providedMaterials, ...extra })

for (const [name, text] of [
  ['HTML div prose', '<div>材料[R1][MISSING]</div>'],
  ['HTML paragraph prose', '<p>材料[R1][MISSING]</p>'],
  ['HTML table cell prose', '<table><tr><td>材料[R1][MISSING]</td></tr></table>'],
  ['HTML details summary prose', '<details><summary>材料[R1][MISSING]</summary></details>'],
  ['inline HTML span prose control', '<span>材料[R1][MISSING]</span>'],
]) {
  it(`RQA18 context checks visible ${name}`, () => {
    assert.ok(explicitSourceIds(text).includes('MISSING'))
    const verification = check(text)
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'unresolved_source_citation'))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

for (const [name, text] of [
  ['HTML comment', '<!-- [MISSING] -->'],
  ['HTML attribute, not prose', '<div data-ref="[MISSING]">材料说明</div>'],
  ['HTML pre/code literal', '<pre><code>[MISSING]</code></pre>'],
  ['Markdown fenced literal containing HTML', '```html\n<div>[MISSING]</div>\n```'],
]) {
  it(`RQA18 context does not promote ${name} to a citation`, () => {
    assert.deepEqual(explicitSourceIds(text), [])
    assert.equal(check(text).passed, true)
  })
}

for (const [name, text] of [
  ['full reference definition after owner', '[guide][LINK] 负责人：李明。\n\n[LINK]: https://example.invalid'],
  ['full reference definition before owner', '[LINK]: https://example.invalid\n\n[guide][LINK] 负责人：李明。'],
  ['reference link and explicit supported owner citation', '[guide][LINK] 负责人：李明 [R1]。\n\n[LINK]: https://example.invalid'],
  ['reference link trailing the owner value', '负责人：李明 [guide][LINK]。\n\n[LINK]: https://example.invalid'],
  ['shortcut link definition outside the owner clause', '[LINK] 负责人：李明 [R1]。\n\n[LINK]: https://example.invalid'],
  ['a link URL containing another source ID is not source attribution', '[guide](https://example.invalid/R2) 负责人：李明。'],
]) {
  it(`RQA18 field scope preserves ${name}`, () => {
    const verification = check(text)
    assert.equal(verification.passed, true, JSON.stringify(verification))
    const field = verification.metadata.fieldChecks.find(item => item.label === '负责人')
    assert.ok(field)
    assert.equal(field.support, 'source_excerpt')
    assert.deepEqual(field.sourceIds, ['R1'])
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).text, text)
  })
}

it('RQA18 full-answer link context cannot approve a fabricated owner', () => {
  const verification = check('[guide][LINK] 负责人：赵强 [R1]。\n\n[LINK]: https://example.invalid')
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
})

it('RQA18 full-answer link context cannot substitute a different source for explicit R2', () => {
  const verification = check('[guide][LINK] 负责人：李明 [R2]。\n\n[LINK]: https://example.invalid')
  assert.equal(verification.passed, false)
  assert.equal(verification.metadata.fieldChecks[0].support, 'unresolved')
})

it('RQA18 known citation in a different clause cannot override explicit local attribution', () => {
  const verification = check('材料[R1]。负责人：李明 [R2]。')
  assert.equal(verification.passed, false)
  assert.equal(verification.metadata.fieldChecks[0].support, 'unresolved')
})

it('RQA18 legitimate reference link does not suppress a separate actual missing citation', () => {
  const verification = check('[guide][LINK] 负责人：李明 [R1][MISSING]。\n\n[LINK]: https://example.invalid')
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'unresolved_source_citation'))
})

it('RQA18 HTML presentation cannot waive required tools and evidence', () => {
  const verification = check('<div>材料[R1]</div>', { taskFrame: {
    requiredTools: ['read_file'], requiredEvidence: [{ tool: 'read_file', kind: 'tool_result' }],
  } })
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'missing_required_tools'))
  assert.ok(verification.violations.some(item => item.code === 'missing_required_evidence'))
})

it('RQA18 HTML presentation cannot provide a successful sending receipt', () => {
  const verification = check('<div>我已发送通知。</div>')
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'unsupported_execution_claim'))
})

it('RQA18 source identity remains exact and case-sensitive, unlike Markdown reference labels', () => {
  const verification = check('材料[r1]。')
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'unresolved_source_citation'))
})

it('RQA18 does not mistake attached JavaScript index expressions for source citations', () => {
  assert.deepEqual(explicitSourceIds('缓存读取 cache[key]，并检查 rows[index] 与 matrix[i][j]。'), [])
  assert.deepEqual(explicitSourceIds('材料[r1]。'), ['r1'])
  assert.deepEqual(explicitSourceIds('参见[R1][MISSING]。'), ['R1', 'MISSING'])
})
