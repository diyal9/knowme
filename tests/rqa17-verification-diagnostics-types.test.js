'use strict'

// Separate frozen adversarial supplement: diagnostics are data, not authority.
// No model/API calls or changes to the original 26 diagnostics tests.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeVerificationDiagnostics } = require('../src/lib/agent-verification-diagnostics')
const { normalizeExecutionEvidence } = require('../src/lib/workbench-task-store')

const hash = 'a'.repeat(64)
const raw = () => ({ version: 1, runId: 'rqa17-types', taskId: 'task-types',
  candidateHash: hash, candidateChars: 10, materialSnapshotHash: hash, materialCount: 1,
  scope: 'execution_receipts_and_labelled_fields_not_semantic_truth', fieldCheckCount: 1,
  fieldChecks: [{ label: '结论', valueHash: hash, support: 'unresolved' }] })

const targets = [
  ['candidateHash', (value, malformed) => { value.candidateHash = malformed }],
  ['materialSnapshotHash', (value, malformed) => { value.materialSnapshotHash = malformed }],
  ['fieldChecks.valueHash', (value, malformed) => { value.fieldChecks[0].valueHash = malformed }],
]
const malformedValues = [
  ['single-element array', () => [hash]],
  ['plain object', () => ({ value: hash })],
  ['hash-coercible object', () => ({ toString: () => hash })],
  ['null-prototype object', () => Object.create(null)],
]

for (const [field, set] of targets) {
  for (const [kind, make] of malformedValues) {
    it(`RQA17 types: rejects ${field} ${kind} without throwing or coercing it`, () => {
      const value = raw()
      set(value, make())
      let normalized
      assert.doesNotThrow(() => {
        normalized = normalizeVerificationDiagnostics(value, { runId: 'rqa17-types' })
      })
      assert.equal(normalized, null, 'only primitive string hashes may cross the diagnostic boundary')
    })
  }
}

it('RQA17 types: primitive string hashes remain valid and string-typed', () => {
  const normalized = normalizeVerificationDiagnostics(raw(), { runId: 'rqa17-types' })
  assert.deepEqual(normalized, raw())
  for (const value of [normalized.candidateHash, normalized.materialSnapshotHash, normalized.fieldChecks[0].valueHash]) {
    assert.equal(typeof value, 'string')
  }
})

it('RQA17 types: null material snapshot remains the explicit no-material representation', () => {
  const value = { ...raw(), materialSnapshotHash: null, materialCount: 0 }
  assert.deepEqual(normalizeVerificationDiagnostics(value, { runId: 'rqa17-types' }), value)
})

for (const [field, set] of targets) {
  it(`RQA17 types: task evidence ingestion discards array ${field} without changing blocked status`, () => {
    const value = raw()
    set(value, [hash])
    const [evidence] = normalizeExecutionEvidence([{ runId: 'rqa17-types', gateStatus: 'blocked',
      verificationPassed: false, verificationDiagnostics: value,
      violations: [{ code: 'ungrounded_external_fact', message: 'unsupported field' }] }])
    assert.equal(evidence.gateStatus, 'blocked')
    assert.equal(evidence.verificationPassed, false)
    assert.equal(evidence.violations[0].code, 'ungrounded_external_fact')
    assert.ok(evidence.verificationDiagnostics == null, 'malformed diagnostic is not retained on ingestion')
  })
}
