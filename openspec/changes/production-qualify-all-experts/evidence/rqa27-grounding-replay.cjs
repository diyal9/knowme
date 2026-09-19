'use strict'
// Read-only reproduction, not a fix or a professional-quality assertion.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { verifyClaims } = require('../../../../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../../../../src/lib/provided-materials')
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'rqa27-r27-kc-n01-actual.json'), 'utf8')).data
const observed = JSON.parse(fs.readFileSync(path.join(__dirname, 'rqa27-verification-observed.json'), 'utf8'))
const row = observed.rows.filter(item => item.label === 'R27-KC-D01-retry').at(-1)
assert.ok(row, 'Separate diagnostic retry must exist; do not substitute for N01')
assert.match(baseline.task.goal, /2026-09-01起生效/)
assert.equal(row.input.providedMaterials.items.length, 1)
assert.equal(row.input.providedMaterials.items[0].id, 'user-confirmation')
const original = verifyClaims(row.input)
const replayMaterials = createProvidedMaterialsSnapshot({
  taskId: row.input.providedMaterials.taskId,
  runId: row.input.providedMaterials.runId,
  materials: [
    ...row.input.providedMaterials.items.map(item => ({ id: item.id, title: item.title, content: item.text })),
    { id: 'diagnostic-user-goal', title: 'Exact user goal, no extraction or normalization', content: baseline.task.goal },
  ],
})
const goalIncluded = verifyClaims({ ...row.input, providedMaterials: replayMaterials })
assert.equal(original.passed, false)
assert.equal(goalIncluded.passed, false)
assert.ok(original.metadata.fieldChecks.some(field => field.label === '日期' && field.value === '2026-09-01' && field.support === 'unresolved'))
assert.ok(goalIncluded.metadata.fieldChecks.some(field => field.label === '日期' && field.value === '2026-09-01' && field.support === 'unresolved'))
console.log(JSON.stringify({
  scope: 'Captured KC diagnostic retry candidate replay only; not original N01 or a new model run',
  original: { passed: original.passed, fields: original.metadata.fieldChecks },
  rawGoalAddedInMemory: { passed: goalIncluded.passed, fields: goalIncluded.metadata.fieldChecks },
  conclusion: 'Original source projection omits the user goal. Adding the exact goal alone does not resolve the labelled-field vs prose mismatch. No gate or stored task changed.',
}, null, 2))
