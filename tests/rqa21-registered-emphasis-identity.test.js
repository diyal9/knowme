'use strict'

// Frozen independent RQA21 identity contract, 2026-09-06. A registered raw
// bracket ID wins over Markdown decoration; registration is not field support.
// Uses only existing public APIs, no proposed projection options or product IO.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const dual = createProvidedMaterialsSnapshot({
  taskId: 'rqa21-registered-task', runId: 'rqa21-registered-run',
  materials: [
    { id: '__R1__', content: '负责人：李明。' },
    { id: 'R1', content: '负责人：赵强。' },
  ],
})
const single = createProvidedMaterialsSnapshot({
  taskId: 'rqa21-registered-task', runId: 'rqa21-registered-run',
  materials: [{ id: '__R1__', content: '负责人：李明。' }],
})

for (const [name, registry] of [
  ['only raw ID', ['__R1__']],
  ['both IDs array', ['__R1__', 'R1']],
  ['both IDs Set', new Set(['__R1__', 'R1'])],
]) {
  it(`RQA21 exact registered emphasis identity: ${name}`, () => {
    assert.deepEqual(explicitSourceIds('材料[__R1__]。', registry), ['__R1__'])
  })
}

it('RQA21 unregistered decoration may still represent the visible R1 citation', () => {
  assert.deepEqual(explicitSourceIds('材料[__R1__]。', ['R1']), ['R1'])
})

for (const [id, owner, allowed] of [
  ['__R1__', '李明', true],
  ['__R1__', '赵强', false],
  ['R1', '赵强', true],
  ['R1', '李明', false],
]) {
  for (const position of ['prefix', 'suffix']) {
    it(`RQA21 dual registry ${position} [${id}] supports only its own ${owner} field`, () => {
      const text = position === 'prefix' ? `[${id}] 负责人：${owner}。` : `负责人：${owner} [${id}]。`
      const verification = verifyClaims({ text, providedMaterials: dual })
      assert.equal(verification.passed, allowed, JSON.stringify(verification))
      const gate = applyOutputGate({ text, verification, regenUsed: true })
      assert.equal(gate.allowed, allowed)
      if (allowed) assert.equal(gate.text, text)
      assert.deepEqual(explicitSourceIds(text, ['__R1__', 'R1']), [id])
      assert.equal(verification.metadata.fieldChecks.length, 1)
      const field = verification.metadata.fieldChecks[0]
      assert.equal(field.label, '负责人')
      assert.equal(field.value, owner)
      assert.equal(field.support, allowed ? 'source_excerpt' : 'unresolved')
      assert.deepEqual(field.sourceIds, allowed ? [id] : [])
      assert.equal(verification.violations.some(item => item.code === 'unresolved_source_citation'), false)
      if (!allowed) assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
    })
  }
}

for (const [owner, allowed] of [['李明', true], ['赵强', false]]) {
  it(`RQA21 lone raw registration does not become a missing visible ID for ${owner}`, () => {
    const text = `[__R1__] 负责人：${owner}。`
    const verification = verifyClaims({ text, providedMaterials: single })
    assert.equal(verification.passed, allowed, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, allowed)
    assert.equal(verification.violations.some(item => item.code === 'unresolved_source_citation'), false)
    assert.equal(verification.metadata.fieldChecks.length, 1)
    assert.equal(verification.metadata.fieldChecks[0].support, allowed ? 'source_excerpt' : 'unresolved')
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, allowed ? ['__R1__'] : [])
  })
}

for (const [firstOwner, allowed] of [['李明', true], ['赵强', false]]) {
  it(`RQA21 cross-clause R1 support cannot change __R1__ attribution for ${firstOwner}`, () => {
    const text = `[__R1__] 负责人：${firstOwner}。\n[R1] 负责人：赵强。`
    const verification = verifyClaims({ text, providedMaterials: dual })
    assert.equal(verification.passed, allowed, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, allowed)
    const fields = verification.metadata.fieldChecks
    assert.equal(fields.length, 2)
    assert.equal(fields[0].support, allowed ? 'source_excerpt' : 'unresolved')
    assert.deepEqual(fields[0].sourceIds, allowed ? ['__R1__'] : [])
    assert.equal(fields[1].support, 'source_excerpt')
    assert.deepEqual(fields[1].sourceIds, ['R1'])
  })
}

for (const text of ['材料[**MISSING**]。', '材料[__MISSING__]。']) {
  it(`RQA21 raw registration cannot hide an unrelated decorated unknown: ${text}`, () => {
    assert.deepEqual(explicitSourceIds(text, ['__R1__', 'R1']), ['MISSING'])
    const verification = verifyClaims({ text, providedMaterials: dual })
    assert.equal(verification.passed, false)
    assert.deepEqual(verification.violations.find(item =>
      item.code === 'unresolved_source_citation')?.missingSourceIds, ['MISSING'])
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

it('RQA21 registered ID preservation cannot preserve decoration outside a field label', () => {
  const text = '[__R1__] **负责人**：赵强。'
  const verification = verifyClaims({ text, providedMaterials: dual })
  assert.equal(verification.passed, false, JSON.stringify(verification))
  assert.equal(verification.metadata.fieldChecks.length, 1)
  const field = verification.metadata.fieldChecks[0]
  assert.equal(field.label, '负责人')
  assert.equal(field.value, '赵强')
  assert.equal(field.support, 'unresolved')
  assert.deepEqual(field.sourceIds, [])
  assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
})

it('RQA21 source and candidate projection agree on decorated fields and raw IDs', () => {
  const providedMaterials = createProvidedMaterialsSnapshot({
    taskId: 'rqa21-registered-task', runId: 'rqa21-registered-run',
    materials: [
      { id: '__R1__', content: '[__R1__] **负责人**：李明。' },
      { id: 'R1', content: '[R1] *负责人*：赵强。' },
    ],
  })
  const text = '[__R1__] **负责人**：李明。'
  const verification = verifyClaims({ text, providedMaterials })
  assert.equal(verification.passed, true, JSON.stringify(verification))
  assert.equal(verification.metadata.fieldChecks.length, 1)
  assert.equal(verification.metadata.fieldChecks[0].support, 'source_excerpt')
  assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, ['__R1__'])
  const gate = applyOutputGate({ text, verification, regenUsed: true })
  assert.equal(gate.allowed, true)
  assert.equal(gate.text, text)
})

for (const syntax of ['**`[__R1__]`**', '**[__R1__](https://example.invalid)**']) {
  it(`RQA21 registered raw ID in excluded syntax cannot override visible citation: ${syntax}`, () => {
    const text = `${syntax}\n\n[R1] 负责人：赵强。`
    assert.deepEqual(explicitSourceIds(text, ['__R1__', 'R1']), ['R1'])
    const verification = verifyClaims({ text, providedMaterials: dual })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.equal(verification.metadata.fieldChecks.length, 1)
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, ['R1'])
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, true)
  })
}
