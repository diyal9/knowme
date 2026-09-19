'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')
const { buildProductionRunPorts } = require('../src/lib/agent-run-kernel-adapter')
const { unbindRunRuntimeContext } = require('../src/lib/tool-contract-registry')
const agentRun = require('../src/lib/agent-run')
const { createProvidedMaterialsSnapshot, validateProvidedMaterials, providedMaterialsFromInput } = require('../src/lib/provided-materials')

it('expert execution supplies only current brief text, not persona/history/artifacts', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa12-flow-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const store = createStore(path.join(dir, 'tasks.json'))
  const created = store.create({ expertId: 'generic-reviewer', status: 'starting', goal: '静态评审',
    execRef: { kind: 'session', id: 'rqa12-session' },
    brief: { goal: '静态评审', materials: [
      { id: 'M1', title: '文本', content: '用户材料全文\nR1保留原文' },
      { id: 'link', title: '链接标题不能充当正文', ref: 'https://example.test/source' },
      { id: 'image', title: '图片', kind: 'image', dataUrl: 'data:image/png;base64,eA==', content: '不把图片说明作为文字证据' },
    ], deliverables: [{ id: 'primary', type: 'answer', title: '评审', required: true }] },
  })
  let session = { id: 'rqa12-session', messages: [{ role: 'assistant', runId: 'old-run', text: 'OLD_HISTORY' }],
    run: { ...agentRun.createEmptyRun(), artifacts: [{ id: 'old', body: 'OLD_ARTIFACT' }] } }
  let captured
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({
      persona: { systemPrompt: 'SYSTEM_ONLY', sop: 'SOP_ONLY' }, capabilityManifest: {},
    }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: sessions => { session = sessions[0] },
    runAgentGenerate: async (_deps, payload) => { captured = payload; return { text: '静态评审完成', runId: payload.runId } },
    agentRun,
  })
  const result = await runtime.execute(created.task.id)
  assert.equal(result.task.status, 'review')
  assert.ok(captured.providedMaterials, 'expert runtime must supply the material snapshot')
  assert.equal(captured.providedMaterials.taskId, created.task.id)
  assert.equal(captured.providedMaterials.runId, captured.runId)
  assert.deepEqual(captured.providedMaterials.items.map(item => item.text), ['用户材料全文\nR1保留原文'])
  assert.equal(captured.providedMaterials.items[0].completeness, 'unknown')
  assert.equal(captured.providedMaterials.items[0].contentHash,
    crypto.createHash('sha256').update('用户材料全文\nR1保留原文').digest('hex'))
  assert.doesNotMatch(JSON.stringify(captured.providedMaterials), /SOP_ONLY|SYSTEM_ONLY|OLD_HISTORY|OLD_ARTIFACT/)
})

it('production context retains the bound snapshot while leaving execution ledgers empty', async t => {
  const runId = 'rqa12-ports'
  t.after(() => unbindRunRuntimeContext(runId))
  // Construct the proposed wire shape independently; this initially fails on
  // the existing adapter's missing field, not a missing future-module import.
  const item = { id: 'M1', title: '材料', text: '完整用户材料',
    contentHash: crypto.createHash('sha256').update('完整用户材料').digest('hex'),
    origin: 'user_material', completeness: 'unknown' }
  const body = { version: 1, kind: 'provided_materials', taskId: 'task-flow', runId, items: [item] }
  const providedMaterials = { ...body, snapshotHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex') }
  const ports = buildProductionRunPorts({ runId, taskRef: { id: 'task-flow' },
    session: { id: 's', messages: [] }, apiMessages: [], ctxBundle: { providedMaterials } })
  const context = await ports.context.build({ runId, taskRef: { id: 'task-flow' } })
  assert.deepEqual(context.providedMaterials, providedMaterials)
  assert.deepEqual(ports.grounding.getEvidenceLedger().entries, [])
  assert.deepEqual(ports.grounding.getToolLedger().calls, [])
})

it('keeps long text byte-for-byte and binds immutable copies to the current run', () => {
  const materials = [{ id: 'M1', title: '正文', content: ` 前缀\n${'材料'.repeat(7000)}\n尾部 `,
    source: 'tool', status: 'ok', completeness: 'complete', provenance: { tool: 'write_file' } }]
  const first = createProvidedMaterialsSnapshot({ taskId: 't', runId: 'r1', materials })
  const second = createProvidedMaterialsSnapshot({ taskId: 't', runId: 'r2', materials })
  const clone = validateProvidedMaterials(JSON.parse(JSON.stringify(first)), { taskId: 't', runId: 'r1' })
  assert.equal(first.items[0].text, materials[0].content)
  assert.equal(first.items[0].contentHash, second.items[0].contentHash)
  assert.notEqual(first.snapshotHash, second.snapshotHash)
  assert.equal(clone.snapshotHash, first.snapshotHash)
  assert.equal(clone.items[0].completeness, 'unknown')
  assert.equal(clone.items[0].origin, 'user_material')
  assert.equal(clone.items[0].source, undefined)
  assert.equal(clone.items[0].status, undefined)
  assert.equal(clone.items[0].provenance, undefined)
  assert.ok(Object.isFrozen(clone) && Object.isFrozen(clone.items) && Object.isFrozen(clone.items[0]))
  materials[0].content = '后续修改'
  assert.notEqual(first.items[0].text, materials[0].content)
})

it('rejects identity mismatch, tampering and self-declared completeness without echoing material text', () => {
  const original = createProvidedMaterialsSnapshot({ taskId: 't', runId: 'r', materials: [{ content: 'PRIVATE_MATERIAL' }] })
  for (const identity of [{ taskId: 'other', runId: 'r' }, { taskId: 't', runId: 'old' }, {}]) {
    assert.throws(() => validateProvidedMaterials(original, identity), { code: 'provided_materials_invalid' })
  }
  for (const change of [
    value => { value.items[0].text = 'CHANGED_SECRET' },
    value => { value.items[0].title = 'tampered title' },
    value => { value.items[0].origin = 'tool' },
    value => { value.items[0].completeness = 'complete' },
    value => { value.snapshotHash = '0'.repeat(64) },
    value => { value.items.push(value.items[0]) },
  ]) {
    const input = JSON.parse(JSON.stringify(original))
    change(input)
    assert.throws(() => validateProvidedMaterials(input, { taskId: 't', runId: 'r' }), error => {
      assert.equal(error.code, 'provided_materials_invalid')
      assert.doesNotMatch(error.message, /PRIVATE_MATERIAL|CHANGED_SECRET/)
      return true
    })
  }
  assert.throws(() => providedMaterialsFromInput({ runId: 'r', taskRef: { id: 't' }, workbenchTaskId: 'other',
    providedMaterials: original }), { code: 'provided_materials_invalid' })
})

it('enforces count and UTF-8 byte budgets explicitly instead of clipping material', () => {
  const identity = { taskId: 't', runId: 'r' }
  assert.throws(() => createProvidedMaterialsSnapshot({ ...identity,
    materials: Array.from({ length: 33 }, (_, i) => ({ id: String(i), content: 'x' })) }), { code: 'provided_materials_invalid' })
  assert.throws(() => createProvidedMaterialsSnapshot({ ...identity,
    materials: [{ content: '中'.repeat(350000) }] }), { code: 'provided_materials_invalid' })
  const limit = createProvidedMaterialsSnapshot({ ...identity, materials: [{ content: 'x'.repeat(1024 * 1024) }] })
  assert.equal(validateProvidedMaterials(limit, identity).items[0].text.length, 1024 * 1024)
  assert.throws(() => createProvidedMaterialsSnapshot({ ...identity,
    materials: [{ id: 'a', content: 'x'.repeat(600000) }, { id: 'b', content: 'x'.repeat(600000) }] }),
  { code: 'provided_materials_invalid' })
})

it('keeps absent snapshots optional and refuses reuse of production ports under a different task/run', async t => {
  assert.equal(validateProvidedMaterials(undefined), null)
  assert.equal(providedMaterialsFromInput({ prompt: 'SOP mixed with old history' }), null)
  const runId = 'rqa12-reuse'
  t.after(() => unbindRunRuntimeContext(runId))
  const providedMaterials = createProvidedMaterialsSnapshot({ taskId: 't', runId, materials: [{ content: '正文' }] })
  const ports = buildProductionRunPorts({ runId, taskRef: { id: 't' }, session: { id: 's' },
    ctxBundle: { providedMaterials }, apiMessages: [] })
  await assert.rejects(ports.context.build({ runId, taskRef: { id: 'other' } }), { code: 'provided_materials_invalid' })
  await assert.rejects(ports.context.build({ runId: 'other', taskRef: { id: 't' } }), { code: 'provided_materials_invalid' })
  const oldPorts = buildProductionRunPorts({ session: { id: 'old' }, apiMessages: [], ctxBundle: {} })
  assert.equal((await oldPorts.context.build({})).providedMaterials, null)
})

it('real prepare rejects a stale snapshot before settings/profile access', async () => {
  const { prepareAgentGenerate } = require('../src/lib/agent-generate-prepare')
  let settingsReads = 0
  const providedMaterials = createProvidedMaterialsSnapshot({ taskId: 't', runId: 'old', materials: [{ content: '正文' }] })
  await assert.rejects(prepareAgentGenerate({
    deps: { loadSettings: () => { settingsReads++; throw new Error('unexpected settings access') } },
    payload: { taskRef: { id: 't' }, runId: 'new', providedMaterials }, runId: 'new', stage: () => {},
  }), { code: 'provided_materials_invalid' })
  assert.equal(settingsReads, 0)
})

it('production execute projects the validated prepared snapshot to real kernel context and executor input', async t => {
  const vm = require('node:vm')
  const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
  const llmRuntime = require('../src/lib/llm-runtime')
  const llmUsage = require('../src/lib/llm-usage')
  const runId = 'rqa12-execute'
  t.after(() => unbindRunRuntimeContext(runId))
  const taskRef = { id: 'task-execute', kind: 'expert-task' }
  const providedMaterials = createProvidedMaterialsSnapshot({ taskId: taskRef.id, runId, materials: [{ content: '当前材料' }] })
  let session = { id: 'execute-session', messages: [], run: agentRun.createEmptyRun() }
  const apiMessages = [{ role: 'user', content: '当前材料' }]
  const policy = llmRuntime.getRequestPolicy({ model: 'gpt-4o-mini', tier: 'chat' })
  const prepared = { session, s: { apiKey: 'fixture', apiEndpoint: 'https://example.test' }, tier: 'chat', policy, promptCachePolicy: {}, tokenCalKey: 'rqa12:test',
    routedModel: { model: 'gpt-4o-mini' }, modelProfile: { model: 'gpt-4o-mini' }, prompt: '当前材料',
    effectivePersonalization: { applied: [], omitted: [] }, tokenCalBefore: { samples: 0 }, providedMaterials }
  const surface = { session, apiMessages, resolvedSurface: {}, connectorRuntime: { close: async () => {} },
    teamRuntime: { manager: { completeAdoptedRun: () => {}, cancelAllChildren: async () => {}, saveCheckpoint: () => {} },
      store: { writeReceipt: () => {} } } }
  let observed = false
  const modules = {
    './agent-generate-libs': { AgentRunExecutor: { run: async (input, ports, emit) => {
      const context = await ports.context.build(input)
      assert.equal(input.providedMaterials.snapshotHash, providedMaterials.snapshotHash)
      assert.equal(context.providedMaterials.snapshotHash, providedMaterials.snapshotHash)
      assert.ok(Object.isFrozen(context.providedMaterials.items[0]))
      assert.deepEqual(ports.grounding.getEvidenceLedger().entries, [])
      observed = true
      return AgentRunExecutor.run(input, ports, emit)
    } }, buildProductionRunPorts, llmUsage, resolveAgentExecutorMode: () => 'kernel',
      resolveGroundingRuntimeMode: () => 'runtime', agentVerify: require('../src/lib/agent-verify'),
      productMemory: { capture: () => {} }, agentProcessTools: { cancelProcessesForRun: () => {} },
      contextEngine: { isToolExecutionAllowed: () => false, recordContextOutcome: () => {} }, logger: { error: () => {} } },
    // External context/tool discovery is isolated. Real prepare's validation
    // rejection is tested above; this tests its output's production consumer.
    './agent-generate-prepare': { prepareAgentGenerate: async () => prepared },
    './agent-generate-tool-surface': { buildRunToolSurface: async () => surface },
    './agent-generate-child-ports': { createChildRunPortFactory: () => ({}), makeOrchestrationPort: () => () => ({}) },
  }
  const loaded = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/lib/agent-generate-execute.ts'), 'utf8'), {
    module: loaded, exports: loaded.exports,
    require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name] },
  })
  const result = await loaded.exports.executeAgentGenerate({
    deps: { loadAgentSessions: () => [session], saveAgentSessions: values => { session = values[0] },
      requestAgentCompletion: async () => ({ snapshot: { content: '评审交付', toolCalls: [] } }),
      agentRuntimePortFactories: new Map(), agentRuntimeOutputBridges: new Map(), activeAgentRuns: new Map() },
    // Raw input cannot overwrite the validated prepared snapshot downstream.
    payload: { runId, taskRef, conversationMode: 'expert-execution', prompt: '当前材料', providedMaterials: { invalid: true } }, runId,
    signal: new AbortController().signal, stage: () => {}, emit: () => {}, fail: error => ({ error: String(error) }),
    metrics: {}, runStartedAt: Date.now(),
  })
  assert.equal(result.error, undefined)
  assert.equal(observed, true)
  assert.equal(result.text, '评审交付')
  assert.equal(result.toolCalls, 0)
})
