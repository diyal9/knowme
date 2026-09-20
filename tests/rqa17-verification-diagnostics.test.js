'use strict'

// Diagnostics only: real verifier/executor/store, synthetic model responses.
// No decision mocks, API, installed package access or user profile IO.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')
const grounding = require('../src/lib/agent-grounding-ledger')
const { formatViolationForUser } = require('../src/lib/agent-grounding-labels')
const { createStore, normalizeExecutionEvidence } = require('../src/lib/workbench-task-store')

const scope = 'execution_receipts_and_labelled_fields_not_semantic_truth'
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex')
const safeLabel = /^[\p{L}\p{N} -]{1,24}$/u
// Lazy import allows the old-source run to exercise independent integration
// and compatibility controls rather than fail the entire file on one import.
const diagnostics = () => require('../src/lib/agent-verification-diagnostics')
const source = (runId = 'rqa17-run', taskId = 'rqa17-task') => createProvidedMaterialsSnapshot({
  runId, taskId, materials: [{ id: 'R1', content: '负责人：李明。结论：材料中的事实。' }],
})
const rawDiagnostic = () => ({ version: 1, runId: 'rqa17-run', taskId: 'rqa17-task',
  candidateHash: sha('负责人：私有值。'), candidateChars: '负责人：私有值。'.length,
  materialSnapshotHash: source().snapshotHash, materialCount: 1, scope,
  fieldChecks: [{ label: '负责人', valueHash: sha('私有值'), support: 'unresolved' }], fieldCheckCount: 1 })

function assertShape(value) {
  assert.ok(value)
  assert.deepEqual(Object.keys(value).sort(), ['version', 'runId', 'taskId', 'candidateHash',
    'candidateChars', 'materialSnapshotHash', 'materialCount', 'scope', 'fieldChecks', 'fieldCheckCount'].sort())
  assert.equal(value.version, 1)
  assert.equal(value.scope, scope)
  assert.match(value.candidateHash, /^[a-f0-9]{64}$/i)
  if (value.materialSnapshotHash !== null) assert.match(value.materialSnapshotHash, /^[a-f0-9]{64}$/i)
  for (const key of ['candidateChars', 'materialCount', 'fieldCheckCount']) {
    assert.ok(Number.isSafeInteger(value[key]) && value[key] >= 0, key)
  }
  assert.ok(value.runId.length <= 256 && (value.taskId == null || value.taskId.length <= 256))
  assert.ok(value.fieldChecks.length <= 16)
  for (const field of value.fieldChecks) {
    assert.deepEqual(Object.keys(field).sort(), ['label', 'valueHash', 'support'].sort())
    assert.match(field.label, safeLabel)
    assert.match(field.valueHash, /^[a-f0-9]{64}$/i)
    assert.ok(['source_excerpt', 'unresolved'].includes(field.support))
  }
}

it('RQA17 builder hashes exact checked text and uses the validated current material snapshot', () => {
  const text = ' 负责人：私有值。\n'
  const materials = source()
  const verification = grounding.verifyClaims({ text, providedMaterials: materials })
  const before = JSON.stringify({ verification, materials })
  const built = diagnostics().buildVerificationDiagnostics({ text, verification, providedMaterials: materials,
    runId: 'rqa17-run', taskId: 'rqa17-task' })
  assertShape(built)
  assert.equal(built.candidateHash, sha(text))
  assert.equal(built.candidateChars, text.length)
  assert.equal(built.materialSnapshotHash, materials.snapshotHash)
  assert.equal(built.materialCount, 1)
  assert.deepEqual(built.fieldChecks, [{ label: '负责人', valueHash: sha('私有值'), support: 'unresolved' }])
  assert.equal(built.fieldCheckCount, 1)
  assert.doesNotMatch(JSON.stringify(built), /私有值|李明/)
  assert.equal(JSON.stringify({ verification, materials }), before)
})

it('RQA17 builder preserves full field count while bounding and sanitizing diagnostic fields', () => {
  const fieldChecks = Array.from({ length: 30 }, (_, i) => ({ label: i ? '结论' : '<bad>\n' + 'L'.repeat(40),
    value: 'PRIVATE_VALUE_' + i, support: i % 2 ? 'unresolved' : 'source_excerpt', text: 'SECRET_TEXT', extra: 'SECRET_EXTRA' }))
  const built = diagnostics().buildVerificationDiagnostics({ text: 'Checked body',
    verification: { metadata: { fieldChecks } }, runId: 'rqa17-run', taskId: 'rqa17-task' })
  assertShape(built)
  assert.equal(built.fieldCheckCount, 30)
  assert.ok(built.fieldChecks.length > 0 && built.fieldChecks.length <= 16)
  assert.equal(built.materialSnapshotHash, null)
  assert.equal(built.materialCount, 0)
  assert.doesNotMatch(JSON.stringify(built), /PRIVATE_VALUE|SECRET_TEXT|SECRET_EXTRA/)
})

for (const kind of ['other-run', 'other-task', 'tampered']) {
  it(`RQA17 builder cannot certify a ${kind} material snapshot`, () => {
    const { buildVerificationDiagnostics } = diagnostics()
    const supplied = JSON.parse(JSON.stringify(source(kind === 'other-run' ? 'old-run' : 'rqa17-run',
      kind === 'other-task' ? 'other-task' : 'rqa17-task')))
    if (kind === 'tampered') supplied.items[0].text = 'TAMPERED_PRIVATE'
    let value
    try { value = buildVerificationDiagnostics({ text: 'body', verification: {}, providedMaterials: supplied,
      runId: 'rqa17-run', taskId: 'rqa17-task' }) }
    catch (error) { assert.doesNotMatch(error.message, /TAMPERED_PRIVATE/); return }
    assert.ok(value == null || value.materialSnapshotHash === null)
    if (value) assert.equal(value.materialCount, 0)
  })
}

it('RQA17 normalizer preserves a valid envelope and strips unknown/plaintext fields at every level', () => {
  const raw = rawDiagnostic()
  raw.text = 'PRIVATE_BODY'; raw.candidateText = 'PRIVATE_BODY'; raw.extra = { nested: 'PRIVATE_BODY' }
  raw.fieldChecks[0].value = 'PRIVATE_VALUE'; raw.fieldChecks[0].text = 'PRIVATE_BODY'
  const normalized = diagnostics().normalizeVerificationDiagnostics(raw, { runId: 'rqa17-run' })
  assertShape(normalized)
  assert.deepEqual(normalized, rawDiagnostic())
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE_BODY|PRIVATE_VALUE/)
})

for (const [name, patch] of [
  ['version', { version: 2 }], ['candidate hash', { candidateHash: 'not-a-hash' }],
  ['snapshot hash', { materialSnapshotHash: 'not-a-hash' }], ['run mismatch', { runId: 'old-run' }],
  ['field value hash', { fieldChecks: [{ label: '结论', support: 'unresolved', valueHash: 'not-a-hash' }] }],
]) {
  it(`RQA17 normalizer rejects invalid ${name}`, () => {
    assert.equal(diagnostics().normalizeVerificationDiagnostics({ ...rawDiagnostic(), ...patch },
      { runId: 'rqa17-run' }), null)
  })
}

it('RQA17 normalizer bounds arrays/counts/IDs and never preserves unsafe field payloads', () => {
  const raw = { ...rawDiagnostic(), taskId: 'T'.repeat(10000), candidateChars: Infinity,
    fieldCheckCount: 1e100, materialCount: -10,
    fieldChecks: Array.from({ length: 100 }, () => ({ label: '<script>\n' + 'Z'.repeat(100),
      valueHash: sha('PRIVATE'), support: 'unresolved', value: 'PRIVATE' })) }
  const value = diagnostics().normalizeVerificationDiagnostics(raw, { runId: 'rqa17-run' })
  if (value !== null) { assertShape(value); assert.doesNotMatch(JSON.stringify(value), /PRIVATE|<|>/) }
})

async function runCandidate({ first = '负责人：候选一私值。', second = '议题：候选二私值。',
  finish = 'stop', stale = false, contract } = {}) {
  const runId = 'rqa17-' + randomUUID(), taskId = 'task-rqa17'
  const materials = source(stale ? 'prior-run' : runId, taskId)
  const input = { runId, taskRef: { id: taskId }, prompt: '只分析提供材料。', tier: 'chat',
    conversationMode: 'expert-execution', executionContract: contract }
  const ports = createMockRunPorts({ input })
  const build = ports.context.build
  ports.context.build = async (...args) => ({ ...await build(...args), providedMaterials: materials })
  let modelCalls = 0
  ports.llm.complete = async () => {
    modelCalls++
    const expectedMaxCalls = finish === 'length' ? 3 : 2
    assert.ok(modelCalls <= expectedMaxCalls, `no more than ${expectedMaxCalls} model requests`)
    return { snapshot: { content: modelCalls === 1 ? first : second,
      finishReason: modelCalls === 1 ? finish : 'stop', toolCalls: [] } }
  }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  return { result, runId, taskId, materials, modelCalls, first, second }
}

for (const finish of ['stop', 'length']) {
  it(`RQA17 executor fingerprints last checked candidate after initial ${finish}, not draft or refusal`, async () => {
    const run = await runCandidate({ finish })
    assert.equal(run.modelCalls, finish === 'length' ? 3 : 2)
    assert.equal(run.result.executionEvidence.gateStatus, 'blocked')
    assert.equal(run.result.executionEvidence.verificationPassed, false)
    const diag = run.result.executionEvidence.verificationDiagnostics
    assertShape(diag)
    assert.equal(diag.candidateHash, sha(run.second))
    assert.notEqual(diag.candidateHash, sha(run.first))
    assert.notEqual(diag.candidateHash, sha(run.result.text))
    assert.equal(diag.candidateChars, run.second.length)
    assert.equal(diag.runId, run.runId)
    assert.equal(diag.taskId, run.taskId)
    assert.equal(diag.materialSnapshotHash, run.materials.snapshotHash)
    assert.equal(diag.materialCount, 1)
    assert.deepEqual(diag.fieldChecks, [{ label: '议题', valueHash: sha('候选二私值'), support: 'unresolved' }])
    const violation = run.result.executionEvidence.violations.find(item => item.code === 'ungrounded_external_fact')
    assert.deepEqual(violation.claimLabels, ['议题'])
    assert.doesNotMatch(JSON.stringify({ diag, violation }), /候选一私值|候选二私值/)
  })
}

it('RQA17 successful repair also describes candidate2 and its source excerpt', async () => {
  const run = await runCandidate({ second: '负责人：李明。' })
  assert.equal(run.modelCalls, 2)
  assert.equal(run.result.executionEvidence.gateStatus, 'verified')
  const diag = run.result.executionEvidence.verificationDiagnostics
  assertShape(diag)
  assert.equal(diag.candidateHash, sha(run.second))
  assert.equal(diag.materialSnapshotHash, run.materials.snapshotHash)
  assert.equal(diag.fieldChecks[0].support, 'source_excerpt')
})

it('RQA17 stale snapshot remains rejected, never reported as validated evidence', async () => {
  const run = await runCandidate({ stale: true, first: '负责人：李明。' })
  assert.notEqual(run.result.executionEvidence?.gateStatus, 'verified')
  assert.notEqual(run.result.executionEvidence?.verificationDiagnostics?.materialSnapshotHash, run.materials.snapshotHash)
})

it('RQA17 phase violations preserve only unique bounded safe claim labels', async () => {
  const text = '负责人：私值。日期：2099。结论：私值。'.repeat(20)
  const run = await runCandidate({ first: text, second: text })
  const violation = run.result.executionEvidence.violations.find(item => item.code === 'ungrounded_external_fact')
  assert.deepEqual([...violation.claimLabels].sort(), ['负责人', '日期'].sort())
  assert.ok(violation.claimLabels.length <= 8)
  violation.claimLabels.forEach(label => assert.match(label, safeLabel))
  assert.equal(Object.hasOwn(violation, 'claims'), false)
  assert.equal(run.result.executionEvidence.verificationDiagnostics.fieldCheckCount, 40)
  assert.equal(run.result.executionEvidence.verificationDiagnostics.fieldChecks.length, 16)
})

it('RQA17 required tool failure still blocks a supported supplied field', async () => {
  const run = await runCandidate({ first: '负责人：李明。', second: '负责人：李明。',
    contract: { requiredTools: ['read_file'], requiredEvidence: [{ tool: 'read_file', kind: 'tool_result' }] } })
  assert.equal(run.result.executionEvidence.gateStatus, 'blocked')
  assert.ok(run.result.executionEvidence.violations.some(item => item.code === 'missing_required_tools'))
  assert.ok(run.result.executionEvidence.violations.some(item => item.code === 'missing_required_evidence'))
})

it('RQA17 unrelated successful calculation still cannot validate a fabricated owner', () => {
  const toolMessages = [{ toolName: 'calculate', toolCallId: 'math-only', status: 'done', text: '{"result":2}' }]
  const verification = grounding.verifyClaims({ text: '负责人：捏造人。', providedMaterials: source(),
    ...grounding.mergeToolResultsIntoLedgers({ toolMessages }), toolMessages })
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
})

it('RQA17 completed-action label is operation-generic rather than falsely asserting a read', () => {
  const text = formatViolationForUser({ code: 'false_execution_claim' })
  assert.match(text, /操作|执行/)
  assert.doesNotMatch(text, /读取|会议|负责人|责任人/)
})

for (const payload of [{ claimLabels: ['结论'] }, { claims: [{ label: '结论', value: 'PRIVATE_VALUE' }] }]) {
  it(`RQA17 field label uses safe ${Object.hasOwn(payload, 'claimLabels') ? 'persisted labels' : 'transient claims'} without values`, () => {
    const text = formatViolationForUser({ code: 'ungrounded_external_fact', ...payload })
    assert.match(text, /结论/)
    assert.doesNotMatch(text, /PRIVATE_VALUE|议题|负责人|责任人/)
  })
}

it('RQA17 field mismatch with no labels uses generic field/source wording', () => {
  const text = formatViolationForUser({ code: 'ungrounded_external_fact' })
  assert.match(text, /字段|声明|来源|依据/)
  assert.doesNotMatch(text, /议题|负责人|责任人|会议/)
})

it('RQA17 field mismatch refusal does not demand fetching an already supplied source', () => {
  const text = grounding.buildHonestRefusal({ violations: [{ code: 'ungrounded_external_fact' }] })
  assert.doesNotMatch(text, /先获取|获取相应来源|先读取|联网/)
  assert.match(text, /字段|声明|来源|依据|核对/)
})

it('RQA17 store persists/reopens sanitized diagnostics and bounded claim labels', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa17-diagnostics-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'tasks.json'), store = createStore(file)
  const raw = rawDiagnostic()
  raw.text = 'PRIVATE_BODY'; raw.fieldChecks[0].value = 'PRIVATE_VALUE'
  const labels = ['结论', '结论', ...Array.from({ length: 15 }, (_, i) => 'Field-' + i), '<unsafe>\n']
  const created = store.create({ goal: 'Synthetic diagnostic persistence', executionEvidence: [{
    runId: 'rqa17-run', gateStatus: 'blocked', verificationPassed: false, verificationDiagnostics: raw,
    violations: [{ code: 'ungrounded_external_fact', message: 'field mismatch', claimLabels: labels,
      claims: [{ label: '结论', value: 'PRIVATE_VALUE' }] }],
  }] })
  assert.equal(created.ok, true)
  const reopened = createStore(file).get(created.task.id)
  assert.equal(reopened.ok, true)
  const evidence = reopened.task.executionEvidence[0]
  assert.deepEqual(evidence.verificationDiagnostics, rawDiagnostic())
  const kept = evidence.violations[0].claimLabels
  assert.ok(kept.includes('结论') && kept.length <= 8)
  assert.equal(new Set(kept).size, kept.length)
  kept.forEach(label => assert.match(label, safeLabel))
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /PRIVATE_BODY|PRIVATE_VALUE|<unsafe>/)
})

it('RQA17 old evidence remains usable and a mismatched diagnostic cannot attach to another run', () => {
  const evidence = normalizeExecutionEvidence([{ runId: 'legacy', gateStatus: 'blocked', verificationPassed: false },
    { runId: 'different-run', gateStatus: 'blocked', verificationPassed: false, verificationDiagnostics: rawDiagnostic() }])
  assert.equal(evidence.length, 2)
  assert.equal(evidence[0].runId, 'legacy')
  assert.equal(evidence[0].gateStatus, 'blocked')
  assert.equal(evidence[0].verificationPassed, false)
  assert.ok(evidence.every(item => item.verificationDiagnostics == null))
})
