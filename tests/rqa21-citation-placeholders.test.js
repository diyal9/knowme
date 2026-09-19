'use strict'

// RQA21 frozen desired behavior. Generic forms, outlines and tables, not a
// ticket/expert-specific exception. Run with scripts/register-ts.js.
// Backward-compatible API: explicitSourceIds(text, knownSourceIds = []).
// knownSourceIds accepts string[] or Set<string>. Only UNREGISTERED tokens
// composed exclusively of _, . and - are placeholders. Registered IDs retain
// exact identity and local source binding. This does not certify semantic truth
// or change existing Markdown code/link/footnote syntax or operation receipts.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const baseMaterials = [
  { id: 'M1', content: '负责人：李明。' },
  { id: 'source-1', content: '负责人：李明。' },
  { id: '1', content: '负责人：李明。' },
  { id: 'R2', content: '负责人：赵强。' },
]

function check(text, materials = baseMaterials, extra = {}) {
  const providedMaterials = createProvidedMaterialsSnapshot({
    taskId: 'rqa21-placeholder-task', runId: 'rqa21-placeholder-run', materials,
  })
  const verification = verifyClaims({ text, providedMaterials, ...extra })
  const gate = applyOutputGate({ text, verification, regenUsed: true })
  return { verification, gate }
}

function assertAllowed(text, materials) {
  const result = check(text, materials)
  assert.equal(result.verification.passed, true, JSON.stringify(result.verification))
  assert.equal(result.gate.allowed, true)
  assert.equal(result.gate.text, text)
  return result.verification
}

function assertBlocked(text, code, materials, extra) {
  const result = check(text, materials, extra)
  assert.equal(result.verification.passed, false, JSON.stringify(result.verification))
  assert.equal(result.gate.allowed, false)
  assert.ok(result.verification.violations.some(item => item.code === code), JSON.stringify(result.verification))
  return result.verification
}

for (const token of ['____', '---', '...']) {
  it(`RQA21 ignores unregistered [${token}] in ordinary template prose`, () => {
    const text = `草拟表单：记录编号[${token}]，空白由使用者后续填写。`
    assertAllowed(text)
    assert.deepEqual(explicitSourceIds(text), [])
  })

  it(`RQA21 ignores unregistered [${token}] in a Markdown table`, () => {
    const text = `| 项目 | 填写区 |\n| --- | --- |\n| 样品编号 | [${token}] |`
    assertAllowed(text)
    assert.deepEqual(explicitSourceIds(text), [])
  })
}

for (const [kind, known] of [
  ['array', ['____', '...']],
  ['Set', new Set(['____', '...'])],
]) {
  it(`RQA21 optional ${kind} registry retains only registered punctuation identities`, () => {
    assert.deepEqual(explicitSourceIds('材料[____][---][...][M1][MISSING][____]。', known),
      ['____', '...', 'M1', 'MISSING'])
    // The existing public verifier receives the same knowledge through its
    // materials snapshot, not a model-controlled options override.
    assertAllowed('材料[____][---][...][M1]。', [
      ...baseMaterials,
      { id: '____', content: '负责人：李明。' },
      { id: '...', content: '负责人：李明。' },
    ])
  })
}

for (const id of ['M1', 'source-1', '1']) {
  it(`RQA21 preserves legal ${id} citation and exact field support`, () => {
    const text = `负责人：李明 [${id}]。`
    assert.deepEqual(explicitSourceIds(text), [id])
    const verification = assertAllowed(text)
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, [id])
    assert.equal(verification.metadata.fieldChecks[0].support, 'source_excerpt')
  })
}

for (const id of ['M9', 'source-9', '9']) {
  it(`RQA21 unknown alphanumeric ${id} stays blocked beside placeholders and a real source`, () => {
    const text = `模板[____][---][...]。另参见[M1][${id}]。`
    const verification = assertBlocked(text, 'unresolved_source_citation')
    assert.deepEqual(verification.violations.find(item => item.code === 'unresolved_source_citation').missingSourceIds, [id])
    assert.deepEqual(explicitSourceIds(text), ['M1', id])
  })
}

it('RQA21 mixed punctuation placeholders are not restricted to three example spellings', () => {
  const text = '预留记录编号[_-.--_]，另见[M1]。'
  assertAllowed(text)
  assert.deepEqual(explicitSourceIds(text), ['M1'])
})

it('RQA21 a supported labelled field survives same-clause unregistered placeholders', () => {
  const verification = assertAllowed('负责人：李明 [____][---][...][M1]。')
  assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, ['M1'])
})

it('RQA21 placeholders cannot hide a real wrong citation or borrow a different source', () => {
  const verification = assertBlocked('负责人：赵强 [---][M1]。', 'ungrounded_external_fact')
  assert.equal(verification.metadata.fieldChecks[0].support, 'unresolved')
  assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, [])
  assert.equal(verification.violations.some(item => item.code === 'unresolved_source_citation'), false)
})

for (const id of ['____', '---', '...']) {
  const registered = [...baseMaterials, { id, content: '负责人：李明。' }]

  it(`RQA21 registered [${id}] supports its own exact field before the label`, () => {
    const verification = assertAllowed(`[${id}] 负责人：李明。`, registered)
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, [id])
  })

  it(`RQA21 registered [${id}] supports its own exact field after the value`, () => {
    const verification = assertAllowed(`负责人：李明 [${id}]。`, registered)
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, [id])
  })

  it(`RQA21 registered [${id}] cannot borrow Zhao from uncited R2`, () => {
    const verification = assertBlocked(`[${id}] 负责人：赵强。`, 'ungrounded_external_fact', registered)
    assert.equal(verification.metadata.fieldChecks[0].support, 'unresolved')
    assert.deepEqual(verification.metadata.fieldChecks[0].sourceIds, [])
    assert.equal(verification.violations.some(item => item.code === 'unresolved_source_citation'), false,
      'the source exists; failure must be the cited field, not missing identity')
  })
}

it('RQA21 a punctuation ID registration is exact, not a shared punctuation bucket', () => {
  const registered = [...baseMaterials, { id: '____', content: '负责人：李明。' }]
  assert.deepEqual(explicitSourceIds('材料[____][___][---]。', ['____']), ['____'])
  assertAllowed('材料[____][___][---]。', registered)
})

const markdownContexts = [
  ['code literals', '`[MISSING][____]`\n\n```text\n[MISSING][---]\n```'],
  ['inline and reference links', '[MISSING](https://example.invalid) [guide][LINK]\n\n[LINK]: https://example.invalid'],
  ['footnote marker and definition', '解释见[^note]。\n\n[^note]: 这是普通注释。'],
]

for (const [name, syntax] of markdownContexts) {
  it(`RQA21 preserves ${name} without interpreting syntax as a source`, () => {
    const text = `${syntax}\n\n模板[____]。材料[M1]。`
    assertAllowed(text)
    assert.deepEqual(explicitSourceIds(text), ['M1'])
  })

  it(`RQA21 ${name} does not suppress a separate actual unknown citation`, () => {
    const text = `${syntax}\n\n材料[M1][MISSING]。`
    const verification = assertBlocked(text, 'unresolved_source_citation')
    assert.deepEqual(verification.violations.find(item => item.code === 'unresolved_source_citation').missingSourceIds, ['MISSING'])
  })
}

it('RQA21 real source citation in footnote prose is still checked', () => {
  // Keep this as visible prose in the installed Markdown parser, not a
  // whitespace-free reference-definition destination. No new footnote parser.
  const text = '解释见[^note]。\n\n[^note]: 注释内容包含 [MISSING]。'
  assertBlocked(text, 'unresolved_source_citation')
  assert.deepEqual(explicitSourceIds(text), ['MISSING'])
})

it('RQA21 code and links remain syntax even when their punctuation ID is registered', () => {
  const text = '`[____]`。链接[____](https://example.invalid)。'
  assert.deepEqual(explicitSourceIds(text, ['____']), [])
  assertAllowed(text, [{ id: '____', content: '负责人：李明。' }])
})

it('RQA21 a template placeholder cannot waive an unsupported completed operation', () => {
  assertBlocked('记录编号[____]。我已发送通知。', 'unsupported_execution_claim')
})

it('RQA21 a template placeholder cannot waive required tools or evidence', () => {
  const verification = assertBlocked('模板编号[---]。', 'missing_required_tools', baseMaterials, {
    taskFrame: { requiredTools: ['read_file'], requiredEvidence: [{ tool: 'read_file', kind: 'tool_result' }] },
  })
  assert.ok(verification.violations.some(item => item.code === 'missing_required_evidence'))
})
