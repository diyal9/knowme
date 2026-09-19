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
const policy = require('../src/lib/context-engine/policy')

const batch = JSON.parse(fs.readFileSync(path.join(__dirname,
  '../openspec/changes/production-qualify-all-experts/evidence/professional-batch2-inputs.json'), 'utf8'))
const meetingInput = batch.cases.find(item => item.id === 'MS01').content
const neutralContract = { requiredTools: [], requiredEvidence: [], completionConditions: [] }
const asPlain = value => JSON.parse(JSON.stringify(value))

// Execute the actual prepare and surface bodies. Environment-bound services
// are in-memory fakes; the intent, contract merge, reference binding, message
// identity and grounding evidence evaluators remain production code.
function loadEntry(name, libs) {
  const filename = path.join(__dirname, '../src/lib', name + '.ts')
  const nativeRequire = createRequire(filename)
  const module = { exports: {} }
  const overrides = {
    './agent-generate-libs': libs,
    './personal-agent-runtime-profile': { resolvePersonalAgentSettings: settings => settings },
    './workflow-react-prompt': { shouldForceWorkflowReact: () => false },
    './agent-context-finalize': { finalizeAgentContext: ({ prepared }) => ({
      apiMessages: prepared.apiMessages, contextInfo: prepared.contextInfo, capabilityIds: [],
    }) },
  }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, URL, setImmediate, process,
    require: id => Object.hasOwn(overrides, id) ? overrides[id] : nativeRequire(id),
  }, { filename })
  return module.exports
}

function fixture({ prompt = meetingInput, conversationMode = 'expert-execution',
  contract = neutralContract, capabilityContract, referenceState, history = [] } = {}) {
  let persisted = [{ id: 'intent-test', agentId: 'custom-agent', expertId: 'arbitrary-expert',
    summary: '上轮上下文锚点：只核对已经提供的原文', referenceState, run: {}, messages: history }]
  let closed = 0
  const allowed = new Set()
  const noBundle = () => null
  const toolSurface = {
    getToolRecords: () => [...allowed].map(name => ({ type: 'function', function: { name }, _knowme: { connectorId: 'feishu' } })),
    getToolDefinitions: () => [...allowed].map(name => ({ type: 'function', function: { name } })),
    isAllowedTool: name => allowed.has(name), createToolExecutor: () => ({}),
  }
  const hub = {
    resolveSessionRetrievalScope: () => ({ mode: 'none', providers: [] }),
    assembleContextForSession: () => ({ groundingContract: capabilityContract, contextBlocks: [] }),
    expertRuntime: () => ({ getSessionPersona: () => ({ ok: true }) }),
    buildSkillToolsForSession: noBundle,
  }
  const libs = {
    path, app: { getPath: () => __dirname },
    promptRouter: { normalizeMode: () => 'general', resolveScene: () => 'work',
      buildScenePrompt: () => 'test scene', buildUserPrompt: () => '', buildSkillPrompt: () => '' },
    contextEngine: { ...policy,
      resolveContextPolicy: input => input,
      prepareContextSemanticSelection: async () => ({ telemetry: {}, vectorScores: {} }),
      recordContextSemanticTelemetry() {}, semanticRuntimeStats: () => ({}),
    },
    productKnowledge: { parseSlashTokens: () => [], normalizeSlash: value => value },
    productMemory: { buildContextItems: () => [],
      buildEffectivePersonalization: () => ({ applied: [], omitted: [] }) },
    conversationGrounding: { buildGrounding: () => ({ active: false }), roleGuidance: () => '' },
    agentSessions: { compactSession: session => ({ session, compacted: false }),
      contextMessages: (session, opts) => session.messages.filter(item => !opts.excludeMessageIds.includes(item.id)) },
    agentRun: { ...require('../src/lib/agent-run'), formatPlanChecklist: () => '' }, groundingRuntime: grounding,
    feishuGrounding: feishu, feishuGroundingAdapter: adapter,
    researchRouting: { selectResearchPrompt: ({ displayPrompt, prompt }) => displayPrompt || prompt,
      reconcileResearchTaskFrame: frame => frame, buildResearchRoute: () => ({ active: false }),
      classifyResearchIntent: () => ({ active: false }) },
    llmUsage: { importCalibrations() {}, calibrationKey: () => 'test', getCalibration: () => ({ factor: 1 }) },
    llmModelCatalog: { resolveRuntimeModel: () => ({ profile: { model: 'test', supportsTools: true }, model: 'test' }) },
    llmRuntime: { getRequestPolicy: () => ({ inputBudget: 12000 }), getCacheControlPolicy: () => ({}) },
    chatIntent: { classifyIntent: () => 'chat' },
    contextOrchestrator: { buildMemoryPolicy: () => ({}), buildDynamicContext: () => ({ memoryPolicy: {}, sections: [] }) },
    contextPacketLib: { buildContextPacket: ({ items }) => ({ items, omitted: 0 }), formatForPrompt: () => '' },
    buildTemporalAnchorContext: () => '', resolveGroundingRuntimeMode: () => 'runtime',
    createKnowledgeTools: () => ({ queryKnowledge: async () => ({ hits: [] }) }),
    agentTools: { createToolSurface: () => toolSurface },
    isToolSurfaceV1: () => true,
    resolveToolSurfaceForRun: async () => ({ surface: toolSurface, close: async () => { closed++ } }),
    mergeExtraTools: () => null, agentSandbox: { normalizeSandboxPermissions: () => ({}) },
    agentPlanTools: { buildPlanTools: noBundle }, agentWebTools: { buildWebTools: noBundle },
    agentArtifactTools: { buildArtifactTools: noBundle }, agentImageTools: {},
    agentCapabilityImportTools: { IMPORT_EXPERT_ID: 'not-this-expert' },
    getSessionCapabilityBindings: () => ({ allowedConnectorIds: ['feishu'], decision: (kind, id) => ({ allowed: kind === 'connectors' && id === 'feishu' }) }),
    logger: { systemPrompt() {} },
  }
  const env = {
    payload: { prompt, displayPrompt: '整理给定材料', conversationMode,
      executionContract: structuredClone(contract), sessionId: 'intent-test',
      context: '本轮用户材料锚点', history },
    runId: 'rqa10-isolated-test', metrics: {}, stage() {}, emit() {}, fail: error => ({ error }),
    signal: new AbortController().signal,
    deps: {
      loadSettings: () => ({ apiKey: 'fake-not-used', apiEndpoint: 'https://fixture.invalid', agentScriptsEnabled: false }),
      ensureAgentSession: () => ({ session: persisted[0] }),
      loadAgentSessions: () => persisted, saveAgentSessions: next => { persisted = next },
      ensureCapabilityHub: () => hub, buildEmbedFn: () => null,
      normalizeChatEndpoint: value => value, loadSourcesStore: () => ({ sources: [] }),
      KNOWLEDGE_DIR: __dirname, MEMORY_DIR: __dirname, activeAgentRuns: new Map(),
      ensureAgentTeamRuntime: () => ({ enabled: false, manager: {
        adoptRunningRun() {}, completeAdoptedRun() {},
      }, store: { writeReceipt: () => assert.fail('no external execution') } }),
      getActiveSourceRoot: () => null, buildActiveSourceFileTools: noBundle,
    },
  }
  return { env, libs, hub, allowed, saved: () => persisted, closed: () => closed,
    prepare: () => loadEntry('agent-generate-prepare', libs).prepareAgentGenerate(env),
    surface: prepared => loadEntry('agent-generate-tool-surface', libs).buildRunToolSurface(env, prepared) }
}

test('RQA10 frozen full input reaches the model boundary without an inferred external tool', async () => {
  assert.equal(feishu.detectFeishuIntent(meetingInput).asksRelatedChats, true, 'reproduce the original keyword collision')
  const run = fixture()
  const prepared = await run.prepare()
  assert.equal(prepared.early, undefined)
  assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), [])
  const surface = await run.surface(prepared)
  assert.equal(surface.early, undefined)
  assert.equal(surface.feishuIntent.mentioned, false)
})

for (const conversationMode of ['expert-planning', 'expert-discussion']) test(`${conversationMode} cannot trigger retrieval from an existing selected knowledge source`, async () => {
  const run = fixture({ conversationMode, prompt: '请用已经选择的知识库整理一个执行计划' })
  run.hub.resolveSessionRetrievalScope = () => ({ mode: 'selected', degraded: false,
    providers: [{ id: 'selected', kind: 'remote-rag', collectionIds: ['docs'] }] })
  let queried = 0
  run.libs.createKnowledgeTools = () => ({ queryKnowledge: async () => { queried++; return { hits: [] } } })
  const prepared = await run.prepare()
  assert.equal(queried, 0)
  assert.equal(prepared.tier, 'chat')
  assert.equal(prepared.executionPolicy, 'no-tools')
})

test('tool-surface independently respects the formal contract instead of rescanning SOP text', async () => {
  const run = fixture()
  const surface = await run.surface({ session: run.saved()[0], s: { agentScriptsEnabled: false },
    slashRefs: [], tier: 'assist',
    executionPolicy: policy.resolveExecutionPolicy({ conversationMode: 'expert-execution', toolsEnabled: true }),
    apiMessages: [], prompt: meetingInput,
    groundingTaskFrame: structuredClone(neutralContract) })
  assert.equal(surface.early, undefined)
  assert.equal(surface.feishuIntent.mentioned, false)
})

test('formal contract keeps earlier context, current input anchors and persisted user messages', async () => {
  const history = [{ id: 'prior-u', role: 'user', text: '上轮用户输入锚点' },
    { id: 'prior-a', role: 'assistant', text: '上轮答复锚点' }]
  const run = fixture({ history })
  const prepared = await run.prepare()
  assert.deepEqual(asPlain(prepared.contextDraft.history), history)
  assert.equal(prepared.contextDraft.prompt, meetingInput)
  assert.equal(prepared.contextDraft.noteContext, '本轮用户材料锚点')
  const saved = run.saved()[0]
  assert.equal(saved.messages.filter(item => item.role === 'user' && item.text === meetingInput).length, 1)
  assert.equal(saved.messages.find(item => item.id === 'prior-u').text, history[0].text)
  assert.equal(saved.messages.find(item => item.id === 'prior-a').text, history[1].text)
})

test('formal execution replaces an earlier task obligation without deleting reference anchors', async () => {
  const referenceState = grounding.createReferenceState({
    refs: [{ id: 'ref-old', kind: 'document', label: '上轮文档锚点', payload: { url: 'https://fixture.feishu.cn/docx/old' } }],
    activeRefId: 'ref-old', taskFrame: { requiredTools: ['feishu.related_chats'] },
  })
  const run = fixture({ referenceState })
  const prepared = await run.prepare()
  assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), [])
  assert.equal(prepared.session.referenceState.refs[0].id, 'ref-old')
  assert.equal(prepared.session.referenceState.activeRefId, 'ref-old')
})

test('explicit required tool stays mandatory even when the material says not to send messages', async () => {
  const run = fixture({ contract: { requiredTools: ['feishu.related_chats'],
    completionConditions: [{ type: 'tool_success', tool: 'feishu.related_chats' }] } })
  const prepared = await run.prepare()
  const unavailable = await run.surface(prepared)
  assert.match(unavailable.early.error, /所需工具不可用.*feishu.related_chats/)
  assert.equal(run.closed(), 1)
  run.allowed.add('feishu.related_chats')
  const surface = await run.surface(prepared)
  assert.equal(surface.feishuIntent.asksRelatedChats, true)
  assert.equal(grounding.evaluateRequiredTools(surface.groundingTaskFrame, grounding.createToolLedger()).satisfied, false)
  assert.equal(grounding.evaluateCompletionConditions(surface.groundingTaskFrame,
    grounding.createToolLedger(), grounding.createEvidenceLedger()).satisfied, false)
})

test('evidence-only and completion-only contracts survive preparation and still fail without receipts', async () => {
  for (const contract of [
    { requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.read_doc', minChars: 40, forbidTruncated: true }] },
    { completionConditions: [{ type: 'tool_success', tool: 'feishu.read_doc' }] },
  ]) {
    const run = fixture({ prompt: '仅核对已经给定的材料', contract })
    const prepared = await run.prepare()
    assert.ok(prepared.groundingTaskFrame)
    assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), [], 'do not invent a tool requirement')
    assert.equal(grounding.verifyClaims({ text: '核对完成', taskFrame: prepared.groundingTaskFrame }).passed, false)
    const surface = await run.surface(prepared)
    assert.equal(surface.feishuIntent.needsContentRead, true)
  }
})

test('structured capability declarations remain enforceable beside the execution contract', async () => {
  const run = fixture({ capabilityContract: { requiredTools: ['feishu.read_doc'],
    requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.read_doc', minChars: 80 }] } })
  const prepared = await run.prepare()
  assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), ['feishu.read_doc'])
  assert.equal(prepared.groundingTaskFrame.requiredEvidence[0].minChars, 80)
  const unavailable = await run.surface(prepared)
  assert.match(unavailable.early.error, /feishu.read_doc/)
})

test('successful declared read still requires matching, sufficiently long, non-truncated evidence', async () => {
  const run = fixture({ contract: {
    requiredTools: ['feishu.read_doc'],
    requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.read_doc', minChars: 80, forbidTruncated: true }],
    completionConditions: [{ type: 'tool_success', tool: 'feishu.read_doc' }],
  } })
  const prepared = await run.prepare()
  run.allowed.add('feishu.read_doc')
  const surface = await run.surface(prepared)
  assert.equal(surface.early, undefined)
  assert.deepEqual(asPlain(surface.groundingTaskFrame.requiredTools), ['feishu.read_doc'])
  assert.equal(surface.feishuIntent.asksRelatedChats, false)
  const toolLedger = grounding.recordToolCall(grounding.createToolLedger(), {
    name: 'feishu.read_doc', status: 'ok',
  })
  assert.equal(grounding.evaluateRequiredTools(surface.groundingTaskFrame, toolLedger).satisfied, true)
  const verify = evidenceLedger => grounding.verifyClaims({ text: '核对结果如下。',
    taskFrame: surface.groundingTaskFrame, toolLedger, evidenceLedger }).passed
  assert.equal(verify(grounding.createEvidenceLedger()), false)
  for (const [status, tool, digest] of [
    ['empty', 'feishu.read_doc', ''],
    ['truncated', 'feishu.read_doc', '正文'.repeat(50)],
    ['fail', 'feishu.read_doc', '正文'.repeat(50)],
    ['ok', 'feishu.search_docs', '正文'.repeat(50)],
    ['ok', 'feishu.read_doc', '只有标题'],
  ]) {
    const ledger = grounding.appendEvidence(grounding.createEvidenceLedger(), {
      source: 'tool', status, digest, provenance: { tool },
    })
    assert.equal(verify(ledger), false, `${status}/${tool}/${digest.length} is not qualified read evidence`)
  }
  const evidenceLedger = grounding.appendEvidence(grounding.createEvidenceLedger(), {
    source: 'tool', status: 'ok', digest: '经核对的正文内容。'.repeat(12),
    provenance: { tool: 'feishu.read_doc' },
  })
  assert.equal(verify(evidenceLedger), true)
})

test('a quoted document URL in a formal task cannot introduce a read obligation', async () => {
  const run = fixture({ prompt: '仅引用材料地址 https://fixture.feishu.cn/docx/quoted，不读取外部内容。' })
  const prepared = await run.prepare()
  assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), [])
  const surface = await run.surface(prepared)
  assert.equal(surface.early, undefined)
  assert.equal(surface.feishuIntent.directDocRead, false)
})

for (const [prompt, field] of [
  ['会议总结', 'asksMinutes'], ['查询昨天消息并总结', 'asksRelatedChats'],
  ['今日优先级', 'asksTodayPriority'], ['查文档/知识库', 'asksDocKbSuggest'],
  ['不对，从飞书获取', 'asksRelatedChats'],
  ['读取飞书文档 https://fixture.feishu.cn/docx/example', 'directDocRead'],
]) test(`ordinary chat preserves shortcut or locator: ${prompt}`, async () => {
  const run = fixture({ prompt, conversationMode: undefined })
  // Explicitly unset after fixture defaults; ordinary chat has no formal mode.
  delete run.env.payload.conversationMode
  delete run.env.payload.executionContract
  const prepared = await run.prepare()
  assert.equal(prepared.tier, 'retrieval')
  for (const tool of prepared.groundingTaskFrame?.requiredTools || []) run.allowed.add(tool)
  const surface = await run.surface(prepared)
  assert.equal(surface.feishuIntent[field], true)
  if (field === 'directDocRead') {
    assert.deepEqual(asPlain(prepared.groundingTaskFrame.requiredTools), ['feishu.read_doc'])
    assert.equal(prepared.groundingTaskFrame.requiredEvidence[0].forbidTruncated, true)
  }
})

test('ordinary candidate selection still binds the earlier document and preserves user text', async () => {
  const url = 'https://fixture.feishu.cn/docx/chosen'
  const pending = grounding.meetingCandidatesToPendingSelection([{ title: '所选会议', url }])
  const referenceState = grounding.setPendingSelection(grounding.createReferenceState(), pending.options, pending.refSetId)
  const run = fixture({ prompt: '1', referenceState })
  delete run.env.payload.conversationMode
  delete run.env.payload.executionContract
  const prepared = await run.prepare()
  assert.equal(prepared.early, undefined)
  assert.ok(prepared.contextDraft.prompt.includes(url))
  assert.equal(prepared.session.referenceState.activeRefId, pending.options[0].id)
  assert.ok(run.saved()[0].messages.some(item => item.role === 'user' && item.text === '1'))
  const surface = await run.surface(prepared)
  assert.equal(surface.early, undefined)
  assert.equal(surface.feishuIntent.directDocRead, true)
})

test('formal staged selection adds the bound tool to the current turn contract', async () => {
  const url = 'https://fixture.feishu.cn/minutes/chosen'
  const pending = grounding.meetingCandidatesToPendingSelection([{ title: '客户端研发例会', url }])
  const referenceState = grounding.setPendingSelection(
    grounding.createReferenceState(),
    pending.options,
    pending.refSetId,
  )
  const run = fixture({
    prompt: '1',
    referenceState,
    contract: {
      requiredTools: ['feishu.meeting_candidates'],
      requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.meeting_candidates' }],
      completionConditions: [{ type: 'tool_success', tool: 'feishu.meeting_candidates' }],
    },
  })
  const prepared = await run.prepare()
  assert.equal(prepared.early, undefined)
  assert.match(prepared.contextDraft.prompt, /feishu\.meeting_read/)
  assert.deepEqual(
    asPlain(prepared.groundingTaskFrame.requiredTools).sort(),
    ['feishu.meeting_candidates', 'feishu.meeting_read'].sort(),
  )
  assert.ok(prepared.groundingTaskFrame.requiredEvidence.some(item => item.tool === 'feishu.meeting_read'))
  assert.ok(prepared.groundingTaskFrame.completionConditions.some(item => item.tool === 'feishu.meeting_read'))
})

test('formal intent depends only on typed declarations, never raw keywords, URLs or expert ID', () => {
  const { resolveFeishuExecutionIntent } = require('../src/lib/agent-execution-intent')
  for (const prompt of [meetingInput, '今天发送消息', '会议总结',
    'SOP: feishu.related_chats 今日优先级', 'https://fixture.feishu.cn/docx/quoted']) {
    const intent = resolveFeishuExecutionIntent({ conversationMode: 'expert-execution', prompt,
      expertId: 'anything', executionContract: neutralContract })
    assert.equal(intent.mentioned, false)
    assert.equal(resolveFeishuExecutionIntent({ conversationMode: 'expert-execution', prompt }).mentioned, false)
  }
})

test('declared Feishu operation mapping is specific and does not mutate or expand contracts', () => {
  const { resolveFeishuExecutionIntent } = require('../src/lib/agent-execution-intent')
  for (const [tool, field] of [
    ['feishu.related_chats', 'asksRelatedChats'], ['feishu.today_priority', 'asksTodayPriority'],
    ['feishu.doc_kb_suggest', 'asksDocKbSuggest'], ['feishu.search_docs', 'needsSearch'],
    ['feishu.read_doc', 'needsContentRead'], ['feishu.get_wiki_node', 'needsContentRead'],
    ['feishu.meeting_read', 'asksMinutes'], ['feishu.meeting_candidates', 'asksMinutes'],
  ]) {
    const contract = Object.freeze({ requiredTools: Object.freeze([tool]) })
    const intent = resolveFeishuExecutionIntent({ conversationMode: 'expert-execution',
      prompt: '今天不要发送消息', executionContract: contract })
    assert.equal(intent.mentioned, true)
    assert.equal(intent[field], true)
    assert.deepEqual(contract.requiredTools, [tool])
    if (tool !== 'feishu.related_chats') assert.equal(intent.asksRelatedChats, false)
  }
})
