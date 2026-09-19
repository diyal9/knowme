'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const snapshot = content => createProvidedMaterialsSnapshot({
  taskId: 'html-local-task', runId: 'html-local-run', materials: [{ id: 'R1', content }],
})
const materials = snapshot('负责人：李明。日期：2026-09-10。')

it('RQA18 default inline HTML code excludes a literal missing ID', () => {
  const text = '格式示例：<code>[MISSING]</code>。'
  assert.deepEqual(explicitSourceIds(text), [])
  assert.equal(verifyClaims({ text, providedMaterials: materials }).passed, true)
})

for (const [name, text] of [
  ['same-paragraph closing tag', '<code>[HIDDEN]</code>材料[MISSING]。'],
  ['missing reference before literal code', '材料[MISSING]。<code>[HIDDEN]</code>'],
  ['pre/code block followed by prose', '<pre><code>[HIDDEN]</code></pre>\n材料[MISSING]。'],
  ['standalone code opening and closing across paragraphs', '<code>\n\n[HIDDEN]\n\n</code>\n\n材料[MISSING]。'],
  ['inline opening and a closing tag inside the next paragraph', '开始<code>[HIDDEN]\n\n</code>材料[MISSING]。'],
]) {
  it(`RQA18 code exclusion remains local: ${name}`, () => {
    const textIds = explicitSourceIds(text)
    assert.deepEqual(textIds, ['MISSING'])
    const verification = verifyClaims({ text, providedMaterials: materials })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'unresolved_source_citation'))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

it('RQA18 unclosed code state cannot leak to the next independent answer', () => {
  explicitSourceIds('开始<code>[HIDDEN]')
  assert.deepEqual(explicitSourceIds('材料[MISSING]。'), ['MISSING'])
})

for (const [name, text] of [
  ['paragraphs', '<p>负责人：李明</p><p>日期：2026-09-10</p>'],
  ['divisions', '<div>负责人：李明</div><div>日期：2026-09-10</div>'],
  ['line break', '负责人：李明<br>日期：2026-09-10'],
  ['table cells', '<table><tr><td>负责人：李明</td><td>日期：2026-09-10</td></tr></table>'],
]) {
  it(`RQA18 block-separated fields remain distinct: ${name}`, () => {
    const verification = verifyClaims({ text, providedMaterials: materials })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.deepEqual(verification.metadata.fieldChecks.map(field => [field.label, field.value, field.support]), [
      ['负责人', '李明', 'source_excerpt'], ['日期', '2026-09-10', 'source_excerpt'],
    ])
  })
}

it('RQA18 separate HTML blocks cannot merge a real owner with a fabricated date', () => {
  const verification = verifyClaims({ text: '<p>负责人：李明</p><p>日期：2099-12-31</p>', providedMaterials: materials })
  assert.equal(verification.passed, false)
  assert.deepEqual(verification.metadata.fieldChecks.map(field => field.support), ['source_excerpt', 'unresolved'])
})

for (const text of ['日期：2026-09-10。', '日期：2026-<span>09</span>-10。', '日期：`2026-09-10`。']) {
  it(`RQA18 HTML source date parity: ${text}`, () => {
    const verification = verifyClaims({ text, providedMaterials: snapshot('<p>日期：2026-<span>09</span>-10</p>') })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.equal(verification.metadata.fieldChecks[0].value, '2026-09-10')
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, ['R1'])
  })
}

it('RQA18 HTML source formatting cannot support a different date', () => {
  const verification = verifyClaims({ text: '日期：2099-12-31。', providedMaterials: snapshot('<p>日期：2026-<span>09</span>-10</p>') })
  assert.equal(verification.passed, false)
  assert.equal(verification.metadata.fieldChecks[0].support, 'unresolved')
})
