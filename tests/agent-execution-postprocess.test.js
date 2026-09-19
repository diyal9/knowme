'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const grounding = require('../src/lib/agent-grounding-runtime')
const feishu = require('../src/lib/feishu-grounding')
const adapter = require('../src/lib/agent-grounding-feishu-adapter')
const { RunPhase } = require('../src/lib/agent-run-ports')

const frozenInput = JSON.parse(fs.readFileSync(path.join(__dirname,
  '../openspec/changes/production-qualify-all-experts/evidence/professional-batch2-inputs.json'), 'utf8'))
  .cases.find(item => item.id === 'MS01').content
const answer = '仅依据提供的材料，整理已确认事项与待确认事项。'
const emptyContract = { requiredTools: [], requiredEvidence: [], completionConditions: [] }
const readContract = {
  requiredTools: ['feishu.read_doc'],
  requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.read_doc', minChars: 80, forbidTruncated: true }],
  completionConditions: [{ type: 'tool_success', tool: 'feishu.read_doc' }],
}
const read = { toolName: 'feishu.read_doc', status: 'done', toolCallId: 'read-1',
  text: JSON.stringify({ content: '该产品版本支持本地文件整理与资料归档。'.repeat(8) }) }
const candidates = { toolName: 'feishu.meeting_candidates', status: 'done', toolCallId: 'pick-1',
  text: '会议候选：\n【1】产品评审\n请回复序号选择。',
  meta: { candidates: [{ title: '产品评审', url: 'https://fixture.feishu.cn/docx/product' }] } }
const pendingState = () => adapter.applyMeetingCandidatesToReferenceState(grounding.createReferenceState(), candidates)

function loadActual(relative, overrides) {
  const filename = path.join(__dirname, '../src/lib', relative + '.ts')
  const nativeRequire = createRequire(filename)
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process,
    require: id => Object.hasOwn(overrides, id) ? overrides[id] : nativeRequire(id),
  }, { filename })
  return module.exports
}

// Real execute hook AND real GROUND/PERSIST phase. No model, connector, app,
// profile or disk persistence: all environmental ports are in-memory fakes.
async function runCase({ groundMode = 'runtime', mode = 'expert-execution',
  prompt = frozenInput, displayPrompt = '整理会议纪要', workbenchTaskId = 'fixture-task',
  contract = emptyContract, toolMessages = [], referenceState = grounding.createReferenceState(),
  text = answer, planPartial = '', effectivePrompt = prompt, connector = {} } = {}) {
  const input = { prompt, displayPrompt, conversationMode: mode, workbenchTaskId,
    executionContract: structuredClone(contract), runId: 'postprocess-fixture' }
  const originalInput = JSON.stringify(input)
  let session = { id: 'fixture-session', referenceState, run: {}, messages: [
    { id: 'prior-user', role: 'user', text: '上轮用户锚点' },
    { id: 'current-user', role: 'user', text: prompt },
  ] }
  let committed = null
  let persisted = null
  let probes = 0
  const phases = []
  const groundPhase = loadActual('agent-run-executor/phases-ground-persist', {
    '../agent-run-ports': { resolveGroundingRuntimeMode: () => groundMode },
  }).runGroundAndPersist
  const prepared = { session, s: {}, url: 'https://fixture.invalid', routedModel: {}, policy: {},
    tokenCalBefore: { samples: 0 }, modelProfile: { supportsTools: true }, tier: 'assist', prompt,
    executionPolicy: 'tools-allowed', contextDraft: { prompt: effectivePrompt },
    effectivePersonalization: { applied: [], omitted: [] },
    groundingTaskFrame: structuredClone(contract), contextInfo: {}, apiMessages: [] }
  const surface = { session, groundingTaskFrame: prepared.groundingTaskFrame, contextInfo: {}, apiMessages: [],
    resolvedSurface: {}, connectorRuntime: { close: async () => {} },
    feishuIntent: feishu.detectFeishuIntent(effectivePrompt), systemFeishuEnabled: false,
    teamRuntime: { manager: { completeAdoptedRun() {}, cancelAllChildren: async () => {} } } }
  const libs = {
    resolveAgentExecutorMode: () => 'kernel', resolveGroundingRuntimeMode: () => groundMode,
    groundingRuntime: grounding, feishuGrounding: feishu, feishuGroundingAdapter: adapter,
    agentVerify: { evaluatePlanCompletion: () => ({}), buildPartialFinalizeNote: () => planPartial },
    productMemory: {}, agentProcessTools: {},
    contextEngine: { isToolExecutionAllowed: () => true, recordContextOutcome() {} },
    buildProductionRunPorts: opts => ({ hooks: { postProcess: opts.postProcessHooks },
      clock: { now: () => 100 }, grounding: { getReferenceState: () => referenceState },
      session: { set: next => { session = next }, persist: async value => { persisted = value } } }),
    AgentRunExecutor: { run: async (_input, ports) => groundPhase({
      input, ports, runStartedAt: 0, RunPhase, OUTPUT_PROTOCOL_VERSION: 2,
      enterPhase: phase => phases.push(phase), stage() {}, emitV2() {}, emitTerminal() {},
      commitCanonicalAnswer: value => { committed = value; return { text: value, hash: 'fixture-hash' } },
      buildResult: value => value, runPhases: phases, metrics: {}, setTerminal() {}, trace: [],
      ctxBundle: { taskFrame: prepared.groundingTaskFrame }, fullText: text, session,
      toolMessages, toolCallCount: toolMessages.length, streamed: false, artifactRefs: [],
      referenceState, evidenceLedger: grounding.createEvidenceLedger(), toolLedger: grounding.createToolLedger(),
      finalizeResponse: async () => assert.fail('no model repair call in this fixture'),
      loopState: { finalizationUsed: true }, modelRound: 1,
    }) },
  }
  const execute = loadActual('agent-generate-execute', {
    './agent-generate-libs': libs,
    './agent-generate-prepare': { prepareAgentGenerate: async () => prepared },
    './agent-generate-tool-surface': { buildRunToolSurface: async () => surface },
    './agent-generate-child-ports': { createChildRunPortFactory: () => ({}), makeOrchestrationPort: () => () => ({}) },
  }).executeAgentGenerate
  const result = await execute({ payload: input, runId: input.runId, metrics: {}, runStartedAt: 0,
    stage() {}, emit() {}, fail: error => ({ error: String(error?.message || error) }),
    deps: { agentRuntimePortFactories: new Map(), agentRuntimeOutputBridges: new Map(), activeAgentRuns: new Map(),
      getFeishuGroundingContext: async () => { probes++; return { connectorEnabled: true, authReady: true, ...connector } },
      hasPriorFeishuFacts: () => false } })
  assert.equal(JSON.stringify(input), originalInput, 'do not rewrite current input or contract')
  return { result, committed, persisted, probes, session }
}

for (const groundMode of ['runtime', 'legacy']) {
  for (const options of [
    { label: 'frozen MS01 with meeting display label' },
    { label: 'neutral label without workbench ID', displayPrompt: '只整理给定材料', workbenchTaskId: null },
    { label: 'valid declared read with misleading SOP', contract: readContract, toolMessages: [read],
      prompt: '任务：整理产品资料。SOP示例：会议纪要。' },
    { label: 'candidate followed by qualified Docx read', contract: readContract,
      toolMessages: [candidates, read], referenceState: pendingState(),
      prompt: '读取飞书文档 https://fixture.feishu.cn/docx/product' },
  ]) test(`${groundMode}: formal ${options.label} keeps final answer`, async () => {
    const run = await runCase({ ...options, groundMode })
    assert.equal(run.result.error, undefined)
    assert.equal(run.committed, answer)
    assert.equal(run.persisted.fullText, answer)
    assert.equal(run.probes, 0, 'formal execution must not probe Feishu for keyword hints')
    assert.ok(run.session.messages.some(message => message.id === 'prior-user' && message.text === '上轮用户锚点'))
  })

  test(`${groundMode}: formal plan reminder survives without a Feishu probe`, async () => {
    const run = await runCase({ groundMode, planPartial: '计划尚未全部完成：复核仍待处理。' })
    assert.equal(run.probes, 0)
    assert.ok(run.committed.startsWith(answer))
    assert.match(run.committed, /计划尚未全部完成/)
  })

  for (const [label, contract] of [
    ['requiredTools', { requiredTools: ['feishu.read_doc'] }],
    ['evidence-only', { requiredEvidence: readContract.requiredEvidence }],
    ['conditions-only', { completionConditions: readContract.completionConditions }],
  ]) test(`${groundMode}: formal ${label} stays strict without receipts`, async () => {
    const run = await runCase({ groundMode, contract, prompt: '只核对给定材料', displayPrompt: '资料核对' })
    assert.ok(run.result.error || run.result.terminal === RunPhase.ERROR)
    assert.notEqual(run.committed, answer)
    assert.equal(run.probes, 0)
    if (groundMode === 'legacy') {
      assert.match(run.result.error, /缺少成功|必需执行证据|完成条件/)
      assert.equal(run.committed, null, 'legacy must stop before canonical commit')
      assert.equal(run.persisted, null)
    } else {
      assert.equal(run.result.executionEvidence.gateStatus, 'blocked')
    }
  })

  for (const contract of [
    { requiredEvidence: readContract.requiredEvidence },
    { completionConditions: readContract.completionConditions },
  ]) test(`${groundMode}: a partial explicit contract accepts qualified receipts`, async () => {
    const run = await runCase({ groundMode, contract, toolMessages: [read] })
    assert.equal(run.result.error, undefined)
    assert.equal(run.committed, answer)
    assert.equal(run.probes, 0)
  })

  for (const [label, receipt] of [
    ['empty', { ...read, text: '' }],
    ['truncated', { ...read, truncated: true }],
    ['failed', { ...read, status: 'error', text: '读取失败' }],
    ['wrong tool', { ...read, toolName: 'feishu.search_docs' }],
    ['wrong document', { ...read, args: { doc_token: 'wanted' }, text: JSON.stringify({ doc_token: 'other', content: '正文'.repeat(80) }) }],
  ]) test(`${groundMode}: formal qualified evidence rejects ${label}`, async () => {
    const run = await runCase({ groundMode, contract: readContract, toolMessages: [receipt],
      prompt: '资料核对', displayPrompt: '资料核对' })
    assert.ok(run.result.error || run.result.terminal === RunPhase.ERROR)
    assert.notEqual(run.committed, answer)
    if (groundMode === 'legacy') {
      assert.match(run.result.error, /缺少成功|必需执行证据|完成条件/)
      assert.equal(run.committed, null)
      assert.equal(run.persisted, null)
    } else {
      assert.equal(run.result.executionEvidence.gateStatus, 'blocked')
    }
  })

  test(`${groundMode}: ordinary waiting candidate is preserved, not invented conclusions`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null, prompt: '会议总结',
      toolMessages: [candidates], referenceState: pendingState(), text: '会议结论：明天发布。' })
    assert.equal(run.committed, candidates.text)
  })

  test(`${groundMode}: ordinary qualified Docx read wins over prior candidate`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '读取飞书文档 https://fixture.feishu.cn/docx/product',
      toolMessages: [candidates, read], referenceState: pendingState() })
    assert.equal(run.committed, answer)
  })

  test(`${groundMode}: unrelated ordinary chat cannot be overwritten by stale candidates`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null, prompt: '你好',
      toolMessages: [candidates], referenceState: pendingState() })
    assert.equal(run.committed, answer)
  })

  test(`${groundMode}: selected candidate with failed read shows failure, not the candidate list`, async () => {
    const state = grounding.bindNumericSelection(pendingState(), '1').state
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '读取飞书文档 https://fixture.feishu.cn/docx/product', referenceState: state,
      toolMessages: [candidates, { ...read, status: 'error', text: '读取失败：fixture ACL denied' }] })
    assert.notEqual(run.committed, candidates.text)
    assert.notEqual(run.committed, answer)
    assert.match(run.committed, /失败|权限|证据/)
  })

  test(`${groundMode}: explicit zero candidates stays an honest discovery result`, async () => {
    const zero = { ...candidates, text: '最近 3 个自然日内未找到你参与的会议记录。',
      meta: { workflow: 'meeting_candidates', candidates: [] } }
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '会议总结', toolMessages: [zero] })
    assert.equal(run.committed, zero.text)
  })

  test(`${groundMode}: candidate discovery failure keeps its actual reason`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '会议总结', toolMessages: [{ ...candidates, status: 'error', text: 'fixture discovery timeout' }] })
    assert.match(run.committed, /fixture discovery timeout/)
    assert.notEqual(run.committed, answer)
  })

  test(`${groundMode}: numeric selection uses the resolved locator without rewriting the input`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null, prompt: '1',
      effectivePrompt: '读取飞书文档 https://fixture.feishu.cn/docx/product',
      referenceState: grounding.bindNumericSelection(pendingState(), '1').state,
      toolMessages: [candidates, read] })
    assert.equal(run.committed, answer)
    assert.ok(run.session.messages.some(message => message.id === 'current-user' && message.text === '1'))
  })

  for (const [label, receipt] of [
    ['empty', { ...read, text: '' }],
    ['truncated', { ...read, truncated: true }],
    ['wrong document', { ...read, args: { doc_token: 'wanted' }, text: JSON.stringify({ doc_token: 'other', content: '正文'.repeat(80) }) }],
  ]) test(`${groundMode}: ordinary selected ${label} read cannot become evidence or a candidate answer`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '读取飞书文档 https://fixture.feishu.cn/docx/product',
      referenceState: grounding.bindNumericSelection(pendingState(), '1').state,
      toolMessages: [candidates, receipt] })
    assert.notEqual(run.committed, answer)
    assert.notEqual(run.committed, candidates.text)
    assert.match(run.committed, /证据|正文|失败|不一致/)
  })

  test(`${groundMode}: ordinary read 403 still provides authorization guidance`, async () => {
    const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null,
      prompt: '读取飞书文档 https://fixture.feishu.cn/docx/product',
      toolMessages: [{ ...read, status: 'error', text: '403 forbidden' }] })
    assert.match(run.committed, /knowme:\/\/feishu\/auth/)
  })

  for (const mode of ['expert-planning', 'expert-discussion']) {
    test(`${groundMode}: ${mode} stays outside Feishu postprocessing`, async () => {
      const run = await runCase({ groundMode, mode })
      assert.equal(run.probes, 0)
      assert.equal(run.committed, answer)
    })
  }

  for (const prompt of ['会议总结', '查询昨天消息并总结', '今日优先级', '查文档/知识库',
    '读取飞书文档 https://fixture.feishu.cn/docx/product']) {
    test(`${groundMode}: ordinary ${prompt} still requires real evidence`, async () => {
      const run = await runCase({ groundMode, mode: 'chat', workbenchTaskId: null, prompt })
      assert.equal(run.probes, 1)
      assert.notEqual(run.committed, answer)
      assert.match(run.committed, /工具|飞书|正文/)
    })
  }
}
