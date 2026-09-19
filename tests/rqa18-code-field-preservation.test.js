'use strict'

// Projection must not erase a labelled fact just because its spelling is code.
// These fixed facts do not exercise any broad hypothetical/analysis exemption.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const source = createProvidedMaterialsSnapshot({
  taskId: 'code-field-task', runId: 'code-field-run',
  materials: [{ id: 'R1', content: '负责人：李明。日期：2026-09-10。' }],
})

function expectField(text, label, value, supported, providedMaterials = source) {
  const verification = verifyClaims({ text, providedMaterials })
  const fields = verification.metadata.fieldChecks.filter(field => field.label === label)
  assert.equal(fields.length, 1, 'projection must retain exactly this field: ' + JSON.stringify(verification))
  assert.equal(fields[0].value, value)
  assert.equal(fields[0].support, supported ? 'source_excerpt' : 'unresolved')
  assert.equal(verification.passed, supported)
  assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, supported)
  if (!supported) assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
}

const styles = [
  ['inline value', (label, value) => `${label}：\`${value}\`。`],
  ['whole inline field', (label, value) => `\`${label}：${value}\`。`],
  ['backtick fenced field', (label, value) => `\`\`\`text\n${label}：${value}。\n\`\`\``],
  ['tilde fenced field', (label, value) => `~~~text\n${label}：${value}。\n~~~`],
  ['HTML code value', (label, value) => `${label}：<code>${value}</code>。`],
  ['HTML pre/code field', (label, value) => `<pre><code>${label}：${value}。</code></pre>`],
]

for (const [label, known, fake] of [['负责人', '李明', '赵强'], ['日期', '2026-09-10', '2099-12-31']]) {
  for (const [style, render] of styles) {
    for (const [value, supported] of [[known, true], [fake, false]]) {
      it(`RQA18 retains ${supported ? 'supported' : 'fabricated'} ${label} in ${style}`, () => {
        expectField(render(label, value), label, value, supported)
      })
    }
  }
}

for (const [name, text, value, supported] of [
  ['inline tag inside supported owner', '负责人：李<span>明</span>。', '李明', true],
  ['inline tag inside fabricated owner', '负责人：赵<span>强</span>。', '赵强', false],
  ['inline tag between label and colon, supported', '负责人<span>：</span>李明。', '李明', true],
  ['inline tag between label and colon, fabricated', '负责人<span>：</span>赵强。', '赵强', false],
]) {
  it(`RQA18 HTML boundary preserves ${name}`, () => expectField(text, '负责人', value, supported))
}

it('RQA18 HTML markup inside a supported date must not invent whitespace', () => {
  expectField('日期：2026-<span>09</span>-10。', '日期', '2026-09-10', true)
})

it('RQA18 source-side inline code supports the same plain labelled fact', () => {
  const providedMaterials = createProvidedMaterialsSnapshot({
    taskId: 'code-field-task', runId: 'code-field-run',
    materials: [{ id: 'R1', content: '负责人：`李明`。日期：`2026-09-10`。' }],
  })
  expectField('负责人：李明。', '负责人', '李明', true, providedMaterials)
  expectField('日期：2026-09-10。', '日期', '2026-09-10', true, providedMaterials)
})

it('RQA18 retaining code fields does not promote code source IDs to citations', () => {
  assert.deepEqual(explicitSourceIds('`[MISSING]`\n\n```text\n[MISSING]\n```'), [])
})

it('RQA18 a factual code field still cannot satisfy required tools', () => {
  const verification = verifyClaims({ text: '负责人：`李明`。', providedMaterials: source,
    taskFrame: { requiredTools: ['read_file'] },
  })
  assert.equal(verification.metadata.fieldChecks[0].support, 'source_excerpt')
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'missing_required_tools'))
})
