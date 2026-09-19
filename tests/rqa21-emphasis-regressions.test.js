'use strict'

// Independent frozen desired behavior, 2026-09-06. No product mocks or IO.
// Keep the original 37 citation-placeholder tests immutable. These assertions
// cover visible formatting equivalence, NOT general semantic certification.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const providedMaterials = createProvidedMaterialsSnapshot({
  taskId: 'rqa21-emphasis-task', runId: 'rqa21-emphasis-run',
  materials: [{ id: 'R1', content: '负责人：李明。日期：2026-09-10。' }],
})

// Four demonstrated field bypasses and two demonstrated citation bypasses.
for (const [text, label, value] of [
  ['**负责人**：赵强。', '负责人', '赵强'],
  ['*负责人*：赵强。', '负责人', '赵强'],
  ['负责**人**：赵强。', '负责人', '赵强'],
  ['**日期**：2099-12-31。', '日期', '2099-12-31'],
]) {
  it(`RQA21 frozen field counterexample: ${text}`, () => {
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
    assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
    assert.equal(verification.metadata.fieldChecks.length, 1)
    const field = verification.metadata.fieldChecks[0]
    assert.equal(field.label, label)
    assert.equal(field.value, value)
    assert.equal(field.support, 'unresolved')
    assert.deepEqual(field.sourceIds, [])
  })
}

for (const text of ['材料[**MISSING**]。', '材料[*MISSING*]。']) {
  it(`RQA21 frozen citation counterexample: ${text}`, () => {
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, false, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
    assert.deepEqual(explicitSourceIds(text, ['R1']), ['MISSING'])
    assert.deepEqual(verification.violations.find(item =>
      item.code === 'unresolved_source_citation')?.missingSourceIds, ['MISSING'])
  })
}

for (const text of [
  '**负责人**：李明。', '*负责人*：李明。',
  '负责人：**李明**。', '**负责人：李明。**',
]) {
  it(`RQA21 supported field is checked, not silently skipped: ${text}`, () => {
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    const gate = applyOutputGate({ text, verification, regenUsed: true })
    assert.equal(gate.allowed, true)
    assert.equal(gate.text, text)
    assert.equal(verification.metadata.fieldChecks.length, 1)
    const field = verification.metadata.fieldChecks[0]
    assert.equal(field.label, '负责人')
    assert.equal(field.value, '李明')
    assert.equal(field.support, 'source_excerpt')
    assert.deepEqual(field.sourceIds, ['R1'])
  })
}

for (const [text, code] of [
  ['负责人：赵强。', 'ungrounded_external_fact'],
  ['负责人：**赵强**。', 'ungrounded_external_fact'],
  ['**负责人：赵强。**', 'ungrounded_external_fact'],
  ['**材料[MISSING]。**', 'unresolved_source_citation'],
]) {
  it(`RQA21 existing rejection control: ${text}`, () => {
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === code))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

for (const [name, syntax] of [
  ['inline code', '**`[MISSING][____]`**'],
  ['inline link', '**[MISSING](https://example.invalid)**'],
  ['reference link', '**[guide][LINK]**\n\n[LINK]: https://example.invalid'],
  ['HTML code', '**<code>[MISSING][____]</code>**'],
]) {
  it(`RQA21 emphasis recursively excludes ${name}, retaining an outside real citation`, () => {
    const text = `${syntax}\n\n材料[R1]。`
    assert.deepEqual(explicitSourceIds(text, ['R1', '____']), ['R1'])
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    const gate = applyOutputGate({ text, verification, regenUsed: true })
    assert.equal(gate.allowed, true)
    assert.equal(gate.text, text)
  })

  it(`RQA21 excluded ${name} cannot suppress an outside unknown citation`, () => {
    const text = `${syntax}\n\n材料[R1][MISSING]。`
    assert.deepEqual(explicitSourceIds(text, ['R1', '____']), ['R1', 'MISSING'])
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, false)
    assert.deepEqual(verification.violations.find(item =>
      item.code === 'unresolved_source_citation')?.missingSourceIds, ['MISSING'])
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

for (const [owner, allowed] of [['李明', true], ['赵强', false]]) {
  it(`RQA21 adjacent punctuation IDs keep exact local binding for ${owner}`, () => {
    const materials = createProvidedMaterialsSnapshot({
      taskId: 'rqa21-emphasis-task', runId: 'rqa21-emphasis-run',
      materials: [
        { id: '____', content: '负责人：李明。' },
        { id: 'R2', content: '负责人：赵强。' },
      ],
    })
    const text = `[____][___] 负责人：${owner}。`
    assert.deepEqual(explicitSourceIds(text, ['____', 'R2']), ['____'])
    const verification = verifyClaims({ text, providedMaterials: materials })
    assert.equal(verification.passed, allowed, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, allowed)
    assert.equal(verification.metadata.fieldChecks.length, 1)
    const field = verification.metadata.fieldChecks[0]
    assert.equal(field.support, allowed ? 'source_excerpt' : 'unresolved')
    assert.deepEqual(field.sourceIds, allowed ? ['____'] : [])
    assert.equal(verification.violations.some(item => item.code === 'unresolved_source_citation'), false)
  })
}
