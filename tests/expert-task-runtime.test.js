const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const agentRun = require('../src/lib/agent-run')
const { buildQualificationContext, createExpertTaskRuntime, linkedPreviousVersionId } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')

it('links a cross-task expert revision to the accepted parent artifact version', () => {
  const store = {
    get: id => ({
      ok: id === 'parent-task',
      task: {
        deliverables: [{
          acceptanceStatus: 'accepted',
          artifactRefs: ['parent-session#image-original'],
        }],
      },
    }),
  }
  assert.equal(linkedPreviousVersionId(store, {
    taskRef: { id: 'parent-task', kind: 'expert-revision' },
  }), 'image-original')
  assert.equal(linkedPreviousVersionId(store, {
    taskRef: { id: 'parent-task', kind: 'expert-task' },
  }), '')
})

for (const scenario of ['exhausted', 'corrected', 'missing', 'approval']) it(`RQA06 real executor ${scenario} does not turn platform failure into an answer artifact`, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa06-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createStore(path.join(directory, 'tasks.json'))
  const created = store.create({ expertId: 'generic-qa', status: 'starting', goal: '根据完整材料分析',
    brief: { goal: '根据完整材料分析', materials: [{ title: '数据', content: '收入100到120' }],
      deliverables: [{ id: 'primary', title: '分析', type: 'answer', required: true }] },
    execRef: { kind: 'session', id: 'rqa06-session' },
  })
  let session = { id: 'rqa06-session', messages: [], run: agentRun.createEmptyRun() }
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: sessions => { session = sessions[0] },
    runAgentGenerate: async (_deps, input) => {
      const { createMockRunPorts } = require('../src/lib/agent-run-ports')
      const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
      const fixture = { input: { ...input, tier: 'assist', forceTools: true },
        llmScript: scenario === 'corrected' ? [
          { response: { toolCalls: [{ name: 'analysis_skill', arguments: '{}' }] } },
          { response: { text: '收入从100到120，增长20%，可直接由已给数据计算。' } },
        ] : [0, 1, 2].map(n => ({ response: { toolCalls: [{ name: `analysis_${n}`, arguments: '{}' }] } })),
      }
      const ports = createMockRunPorts(fixture)
      ports.tools.execute = async () => scenario === 'approval'
        ? { ok: true, requiresApproval: true, code: 'approval_required', draftId: 'approval-qa', text: '等待审批' }
        : { ok: false, executionStarted: false, code: scenario === 'missing' ? 'missing_resource' : 'unknown_tool',
          text: scenario === 'missing' ? 'ENOENT: no such file' : '未注册工具: analysis_skill' }
      return AgentRunExecutor.run(fixture.input, ports, () => {})
    },
    agentRun,
  })
  const result = await runtime.execute(created.task.id)
  assert.equal(result.task.status, scenario === 'corrected' ? 'review' : scenario === 'exhausted' ? 'failed' : 'needs_input')
  assert.equal(session.run.artifacts.length, scenario === 'corrected' ? 1 : 0)
  if (scenario === 'corrected') assert.match(session.run.artifacts[0].body, /增长20%/)
  assert.equal(result.task.deliverables.some(item => item.version > 0), scenario === 'corrected')
  if (scenario === 'missing' || scenario === 'approval') assert.equal(result.task.attention.action, 'provide_input')
})

it('does not complete a document deliverable when the expert only returns dialogue text', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-document-artifact-gate-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createStore(path.join(directory, 'tasks.json'))
  const created = store.create({
    expertId: 'custom-document-expert', status: 'starting', goal: '输出评审报告',
    brief: { goal: '输出评审报告', deliverables: [{ id: 'primary', title: '评审报告', type: 'document', required: true }] },
    execRef: { kind: 'session', id: 'document-artifact-gate-session' },
  })
  let session = { id: 'document-artifact-gate-session', expertId: 'custom-document-expert', messages: [], run: agentRun.createEmptyRun() }
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test/v1/chat/completions' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: sessions => { session = sessions[0] },
    runAgentGenerate: async (_deps, payload) => ({
      runId: payload.runId,
      text: '# 评审报告\n\n这只是对话正文，没有成果物引用。',
      artifactRefs: [],
      executionEvidence: { gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [] },
    }),
    agentRun,
  })

  const result = await runtime.execute(created.task.id)
  assert.equal(result.task.status, 'needs_input')
  assert.equal(result.task.attention.kind, 'artifact_missing')
  assert.equal(result.task.deliverables.length, 0)
  assert.equal(session.run.artifacts.length, 0)
})

it('does not call the model when the running transition cannot be persisted', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-running-transition-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createStore(path.join(directory, 'tasks.json'))
  const created = store.create({
    expertId: 'product-manager', status: 'starting', goal: '输出方案',
    brief: { goal: '输出方案', deliverables: [{ id: 'primary', title: '方案', type: 'answer', required: true }] },
    execRef: { kind: 'session', id: 'running-transition-session' },
  })
  const guardedStore = {
    ...store,
    update(id, patch) {
      if (patch?.status === 'running') return { ok: false, code: 'write_failed', error: '任务状态保存失败' }
      return store.update(id, patch)
    },
  }
  let generated = false
  const session = { id: 'running-transition-session', expertId: 'product-manager', messages: [], run: agentRun.createEmptyRun() }
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => guardedStore,
    loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test/v1/chat/completions' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    runAgentGenerate: async () => { generated = true; return { text: '不应执行' } },
    agentRun,
  })

  const result = await runtime.execute(created.task.id)

  assert.equal(result.ok, false)
  assert.equal(result.code, 'write_failed')
  assert.equal(generated, false)
})

it('turns a background runtime initialization error into a retryable task state', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-background-start-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createStore(path.join(directory, 'tasks.json'))
  const created = store.create({
    expertId: 'product-manager', status: 'failed', goal: '继续输出方案',
    brief: { goal: '继续输出方案', deliverables: [{ id: 'primary', title: '方案', type: 'answer', required: true }] },
    events: [],
  })
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store })

  const retried = runtime.retry(created.task.id)

  assert.equal(retried.ok, true)
  assert.equal(retried.started, true)
  const failed = await waitFor(() => {
    const current = store.get(created.task.id)
    return current.ok && current.task.status === 'failed' ? current.task : null
  })
  assert.equal(failed.attention.action, 'retry')
  assert.equal(failed.attention.title, '本次执行未启动')
})

it('does not require a hash for an explicitly absent optional skill when restoring qualification identity', () => {
  const context = buildQualificationContext({
    expertId: 'software-engineer',
    assignmentSnapshot: {
      agentId: 'software-engineer',
      agentVersion: '2.4.0',
      agentHash: 'expert-hash',
      optionalSkillIds: ['code-review'],
      bindings: { skills: ['code-review'], connectors: [] },
      hashes: { expert: 'expert-hash', skills: { 'code-review': '' }, connectors: {} },
    },
  }, null, { provider: 'custom', model: 'gpt-4o-mini' })
  assert.equal(context.complete, true)
  assert.deepEqual(context.missing, [])
  assert.match(context.configurationId, /^expert-config-v2:[a-f0-9]{64}$/)
})

it('distinguishes a saved but locked Provider key from missing AI configuration', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-locked-provider-'))
  const store = createStore(path.join(directory, 'tasks.json'))
  const created = store.create({
    expertId: 'product-manager',
    status: 'starting',
    goal: '输出一份可执行方案',
    brief: { goal: '输出一份可执行方案', deliverables: [{ id: 'answer', title: '方案', type: 'answer', required: true }] },
  })
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    ensureCapabilityHub: () => ({
      expertRuntime: () => ({ readSessionSnapshot: () => ({}) }),
    }),
    loadSettings: () => ({
      apiKey: '',
      apiEndpoint: 'https://example.test/v1/chat/completions',
      credentialStatus: {
        apiKey: { configured: true, available: false, state: 'secure_storage_unavailable' },
      },
    }),
  })

  const result = await runtime.execute(created.task.id)
  assert.equal(result.task.status, 'needs_input')
  assert.equal(result.task.attention.item, '系统安全存储')
  assert.equal(result.task.attention.title, '需要解锁 AI 配置')
  assert.match(result.task.attention.detail, /API Key 已保存/)
})

async function waitFor(check, timeoutMs = 1500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for expert task runtime')
}

const IMAGE_SKILLS = ['th-art-intake', 'th-art-prompt-enrich', 'th-art-pango-generate']
function imageConnectorsApi() {
  return {
    getConnectorStatus: async id => ({ ok: true, connector: {
      id, enabled: id === 'pango-image-mcp', agentVisible: true,
      status: { ok: id === 'pango-image-mcp', state: id === 'pango-image-mcp' ? 'ready' : 'offline' },
    } }),
    getConnectorTools: async () => ({ ok: true,
      projectedAllowlist: ['mcp.pango-image-mcp.generate_image'],
      availableTools: [{ rawName: 'generate_image', projectedName: 'mcp.pango-image-mcp.generate_image', selected: true }],
    }),
  }
}

// Evidence-gate unit tests still need a real preflight provider contract.
function declaredTestTool(name) {
  return {
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({
      bindings: { connectors: ['test-provider'] },
      capabilityManifest: { permissions: { tools: { allowlist: [name] }, connectors: { allowedConnectorIds: ['test-provider'] } } },
    }) }) }),
    getConnectorsApi: () => ({ getConnectorStatus: async id => ({ ok: true,
      connector: { id, enabled: true, agentVisible: true, status: { ok: true, projectedAllowlist: [name] } },
    }) }),
  }
}

function imageCapabilityHub(options = {}) {
  const minArtifacts = Math.max(1, Number(options.minArtifacts) || 1)
  const snapshot = {
    expertId: 'image-producer',
    bindings: { skills: IMAGE_SKILLS, connectors: ['pango-image-mcp', 'photoshop-mcp'] },
    capabilityManifest: {
      version: '3.1.0',
      permissions: {
        tools: { allowlist: ['list_paint_models', 'generate_image'] },
        connectors: { allowedConnectorIds: ['pango-image-mcp', 'photoshop-mcp'] },
      },
      dependencies: [
        ...IMAGE_SKILLS.map(id => ({ id, kind: 'skill', required: true })),
        { id: 'pango-image-mcp', kind: 'connector', required: false },
        { id: 'photoshop-mcp', kind: 'connector', required: false },
      ],
      metadata: { knowme: { execution: {
        strategy: 'confirm-then-generate',
        deliverables: [{
          id: 'generated-image', title: '生成图片', type: 'image', required: true,
          requiredSkills: IMAGE_SKILLS,
          requiredTools: ['generate_image'],
          requiredEvidence: [{ kind: 'tool_result', tool: 'generate_image' }],
          requiredArtifacts: [{ type: 'image' }], minArtifacts,
          completionConditions: [{ type: 'tool_success', tool: 'generate_image' }, { type: 'artifact_present' }],
        }],
      } } },
    },
  }
  return {
    expertRuntime: () => ({ readSessionSnapshot: () => snapshot }),
    skillRuntime: () => ({
      findSkillRecord: id => IMAGE_SKILLS.includes(id) ? { id } : null,
      isSkillEnabled: () => true,
    }),
  }
}

function successfulImageEvidence() {
  return {
    gateStatus: 'verified',
    verificationPassed: true,
    toolCalls: [{ name: 'generate_image', status: 'ok' }],
    evidence: [{ status: 'ok', provenance: { kind: 'tool_result', tool: 'generate_image' } }],
    violations: [],
  }
}

describe('expert task runtime', () => {
  it('keeps an image generation proposal in dialogue until a real image artifact exists', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-proposal-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'starting',
      brief: { goal: '生成一张产品主视觉', deliverables: [{ id: 'preview', title: '候选图像与预览', type: 'document', required: true }] },
      execRef: { kind: 'session', id: 'session-image-proposal' },
    })
    const session = { id: 'session-image-proposal', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '建议采用低机位构图，以冷灰背景突出产品主体。确认后我再生成图片。',
        artifacts: [],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(session.run.artifacts.length, 0)
    assert.match(result.task.resultSummary, /低机位构图/)
    assert.match(result.task.events.at(-1).type, /execution_blocked|artifact_generation_missing/)
    assert.match(result.task.events.at(-1).summary, /成果|交付物/)
  })

  it('repairs a legacy placeholder goal from the confirmed plan at application recovery', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-goal-recovery-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '与生图执行专家协作（待填写目标）',
      expertId: 'image-producer',
      status: 'needs_input',
      brief: {
        goal: '与生图执行专家协作（待填写目标）',
        plan: { goal: '生成一个机器人主题的基础图标（Icon/Logo）。' },
        deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }],
      },
      execRef: { kind: 'session', id: 'session-goal-recovery' },
    })
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
    })

    await runtime.recoverQueuedTasks()
    const recovered = store.get(created.task.id)

    assert.equal(recovered.ok, true)
    assert.equal(recovered.task.goal, '生成一个机器人主题的基础图标（Icon/Logo）。')
    assert.equal(recovered.task.brief.goal, '生成一个机器人主题的基础图标（Icon/Logo）。')
  })

  it('promotes a newly generated image reference to a reviewable deliverable', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-result-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'starting',
      brief: { goal: '生成一张产品主视觉', deliverables: [{ id: 'preview', title: '候选图像与预览', type: 'document', required: true }] },
      execRef: { kind: 'session', id: 'session-image-result' },
    })
    let session = { id: 'session-image-result', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已按确认方案生成第一张候选图。',
        artifacts: [{ id: 'image-1', type: 'image', title: '主视觉候选 1', targetPath: 'D:\\outputs\\hero.png' }],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'review')
    assert.equal(result.task.deliverables.length, 1)
    assert.equal(result.task.deliverables[0].type, 'image')
    assert.equal(result.task.deliverables[0].title, '主视觉候选 1')
    assert.equal(result.task.deliverables[0].deliverableId, 'generated-image')
    assert.match(result.task.deliverables[0].artifactRef, /#image-1$/)
    assert.equal(session.run.artifacts[0].targetPath, 'D:\\outputs\\hero.png')
    assert.ok(result.task.events.some(event => event.type === 'tool_completed' && event.summary === '已完成：generate_image'))
  })

  it('RQA25 preserves decoded image metadata and receipt through execute promotion and session reopen', async t => {
    const { createHash } = require('node:crypto')
    const { imageFixture } = require('./helpers/image-fixtures')
    const { buildImageTools } = require('../src/lib/agent-image-tools')
    const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
    const { buildProductionRunPorts } = require('../src/lib/agent-run-kernel-adapter')
    const { createStreamAccumulator, applyCompletionJson, getStreamSnapshot } = require('../src/lib/agent-stream')
    const { normalizeSession } = require('../src/lib/agent-sessions')
    const { unbindRunRuntimeContext } = require('../src/lib/tool-contract-registry')
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa25-promotion-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const store = createStore(path.join(directory, 'tasks.json'))
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'starting',
      brief: { goal: '生成一张产品主视觉' },
      execRef: { kind: 'session', id: 'session-rqa25-promotion' },
    })
    const bytes = await imageFixture('png', { width: 31, height: 47 })
    const expectedImage = {
      protocol: 'knowme.image-metadata/v1', source: 'decoded-file', width: 31, height: 47,
      frames: 1, mimeType: 'image/png', byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    let session = { id: 'session-rqa25-promotion', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    let savedJson, decodedResult, executionRunId
    let providerCalls = 0, modelCalls = 0, promotionSaves = 0
    const requestBodies = []
    // The real adapter and expert runtime share this store seam. Serialize on
    // every save, so in-memory aliases cannot make metadata assertions pass.
    const saveSessions = sessions => {
      savedJson = JSON.stringify(sessions)
      session = normalizeSession(JSON.parse(savedJson)[0])
      if (session.run.artifacts.length) promotionSaves++
    }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'offline-fixture', apiEndpoint: 'https://offline.invalid/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: saveSessions,
      runAgentGenerate: async (_deps, payload) => {
        executionRunId = payload.runId
        const imageTools = buildImageTools({
          userData: directory, runId: payload.runId,
          config: { url: 'https://provider.example.test/mcp' },
          fetchImpl: async () => {
            providerCalls++
            return { ok: true, json: async () => ({ result: { content: [
              { type: 'image', mimeType: 'image/png', data: bytes.toString('base64'), width: 1080, height: 1440 },
            ] } }) }
          },
        })
        const definition = { type: 'function', function: { name: 'generate_image',
          description: 'Offline image fixture', parameters: { type: 'object', properties: {} } } }
        const ports = buildProductionRunPorts({
          runId: payload.runId, session, signal: new AbortController().signal,
          settings: { apiKey: 'offline-fixture', apiEndpoint: 'https://offline.invalid/v1/chat/completions' },
          url: 'https://offline.invalid/v1/chat/completions',
          routedModel: { model: 'offline-fixture' }, tier: 'assist', toolsEnabled: true,
          policy: { outputTokens: 2600, maxOutput: 8192, parameter: 'max_tokens', inputBudget: 12000, contextWindow: 32768, temperature: 0.4 },
          apiMessages: [{ role: 'user', content: payload.prompt }],
          ctxBundle: { taskFrame: { requiredTools: ['generate_image'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 } },
          promptCachePolicy: { enabled: false }, tokenCalKey: 'rqa25:offline-fixture',
          effectivePersonalization: { applied: [], omitted: 0 },
          toolSurface: {
            getToolDefinitions: () => [definition],
            getToolRecords: () => [{ ...definition, _knowme: { risk: 'write', sideEffects: true, timeoutMs: 1000 } }],
            validateToolCall: (_name, args) => ({ ok: true, args: JSON.parse(args || '{}') }),
          },
          toolExecutor: async call => {
            assert.equal(call.name, 'generate_image')
            decodedResult = await imageTools.handlers.generate_image(JSON.parse(call.arguments))
            return { ...decodedResult, executionStarted: true }
          },
          loadAgentSessions: () => [session], saveAgentSessions: saveSessions,
          requestAgentCompletion: async request => {
            requestBodies.push(structuredClone(request.body))
            assert.ok(++modelCalls <= 2, 'no extra completion or paid transport')
            const accumulator = createStreamAccumulator()
            applyCompletionJson(accumulator, { choices: [{ finish_reason: modelCalls === 1 ? 'tool_calls' : 'stop', message: modelCalls === 1
              ? { content: '', tool_calls: [{ id: 'rqa25-image-call', type: 'function', function: {
                name: 'generate_image', arguments: JSON.stringify({ prompt: 'offline fixture', size: '1080x1440' }),
              } }] }
              : { content: '候选图片已返回，请查看文件。' } }] })
            const snapshot = getStreamSnapshot(accumulator)
            request.onSnapshot?.(snapshot)
            return { snapshot, streamed: true }
          },
        })
        try { return await AgentRunExecutor.run(payload, ports, () => {}) }
        finally { unbindRunRuntimeContext(payload.runId) }
      },
      agentRun,
    })
    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'review', JSON.stringify(result.task.attention))
    assert.equal(providerCalls, 1)
    assert.equal(modelCalls, 2)
    assert.ok(promotionSaves > 0, 'runtime must save the promoted artifact')
    assert.match(JSON.stringify(requestBodies.at(-1).messages), /31 × 47 px/)
    assert.deepStrictEqual(decodedResult.artifactRefs[0].meta.image, expectedImage)
    const reopened = normalizeSession(JSON.parse(savedJson)[0])
    const artifactId = decodedResult.artifactRefs[0].id
    const artifact = reopened.run.artifacts.find(item => item.id === artifactId)
    assert.ok(artifact, 'new tool artifact must be promoted into the session run')
    assert.deepStrictEqual(artifact.meta, { image: expectedImage, taskId: created.task.id,
      deliverableId: 'generated-image', runId: executionRunId })
    assert.deepStrictEqual(fs.readFileSync(artifact.targetPath), bytes)
    const tool = reopened.messages.find(item => item.role === 'tool' && item.toolName === 'generate_image')
    assert.ok(tool, 'real executor tool receipt must survive production adapter save')
    assert.deepStrictEqual(tool.receipt, decodedResult.receipt)
    assert.deepStrictEqual(tool.receipt.images, [{ artifactId, ...expectedImage }])
    assert.deepStrictEqual(tool.artifactRefs[0].meta.image, expectedImage)
    const taskReopened = createStore(path.join(directory, 'tasks.json')).get(created.task.id)
    assert.equal(taskReopened.task.deliverables.length, 1)
    assert.equal(taskReopened.task.deliverables[0].artifactRef, `${reopened.id}#${artifactId}`)
  })

  it('keeps an artifact-backed task out of review when the declared artifact count is unmet', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-count-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成两张候选图', expertId: 'custom-visual-agent', status: 'starting',
      brief: { goal: '生成两张候选图' },
      execRef: { kind: 'session', id: 'session-image-count' },
    })
    const hub = imageCapabilityHub({ minArtifacts: 2 })
    let session = { id: 'session-image-count', expertId: 'custom-visual-agent', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => hub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已生成一张候选图。',
        artifacts: [{ id: 'only-image', type: 'image', targetPath: 'D:\\outputs\\only.png' }],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.match(result.task.attention.detail, /需要 2 项，实际 1 项/)
  })

  it('rejects an artifact whose type does not satisfy the declared output contract', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-type-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张候选图', expertId: 'custom-visual-agent', status: 'starting',
      brief: { goal: '生成一张候选图' },
      execRef: { kind: 'session', id: 'session-image-type' },
    })
    let session = { id: 'session-image-type', expertId: 'custom-visual-agent', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '返回了一份说明文档。',
        artifacts: [{ id: 'wrong-document', type: 'document', body: '这不是图片。' }],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.match(result.task.attention.detail, /需要 1 项，实际 0 项/)
    assert.ok(result.task.executionEvidence.at(-1).violations.some(item => item.code === 'required_artifact_unmet'))
  })

  it('accepts a trusted image tool artifactRef with a remote image URL as a reviewable image', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-url-result-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'starting',
      brief: { goal: '生成一张产品主视觉', deliverables: [{ id: 'preview', title: '候选图像与预览', type: 'image', required: true }] },
      execRef: { kind: 'session', id: 'session-image-url-result' },
    })
    let session = { id: 'session-image-url-result', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    const imageUrl = 'https://base-gz-static.forevernine.com/cdn_url_path/pang-gen/build_prod/result-001.jpg'
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已生成候选图，预览已附在成果区。',
        artifactRefs: [{ id: 'image-url-1', type: 'image', targetPath: imageUrl }],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'review')
    assert.equal(result.task.events.some(event => event.type === 'image_generation_missing'), false)
    assert.equal(result.task.deliverables[0].type, 'image')
    assert.equal(session.run.artifacts[0].targetPath, imageUrl)
    assert.match(session.run.artifacts[0].body, /^!\[/)
  })

  it('recovers a persisted image without rewriting a blocked execution verdict as verified', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-recovery-'))
    const file = path.join(root, 'tasks.json')
    const store = createStore(file)
    const runId = 'expert_image-recovery_01'
    const imageDir = path.join(root, 'generated-images', runId)
    fs.mkdirSync(imageDir, { recursive: true })
    const imagePath = path.join(imageDir, 'generated-01-recovered.png')
    fs.writeFileSync(imagePath, 'real-image')
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'needs_input',
      attention: { kind: 'retryable_failure', action: 'retry', title: '图片生成未返回结果' },
      brief: { goal: '生成一张产品主视觉', deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }] },
      execRef: { kind: 'session', id: 'session-image-recovery' },
      executionEvidence: [{
        runId,
        deliverableId: 'generated-image',
        gateStatus: 'blocked',
        verificationPassed: false,
        toolCalls: [{ name: 'generate_image', status: 'ok' }],
        evidence: [{ status: 'ok', provenance: { tool: 'generate_image' } }],
        violations: [{ code: 'unsupported_execution_claim', message: '写入声明没有对应的成功工具证据' }],
      }],
    })
    let session = { id: 'session-image-recovery', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      app: { getPath: () => root },
      fs,
      path,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      agentRun,
    })

    await runtime.recoverQueuedTasks()
    const result = runtime.get(created.task.id)

    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.attention.action, 'retry')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(session.run.artifacts.length, 0)
    assert.equal(result.task.executionEvidence.at(-1).verificationPassed, false)
    assert.equal(result.task.executionEvidence.at(-1).violations[0].code, 'unsupported_execution_claim')
    assert.equal(result.task.events.some(event => event.type === 'image_delivery_recovered'), false)
  })

  it('recovers the newest generated image when a failed revision still points at the prior version', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-revision-recovery-'))
    const store = createStore(path.join(root, 'tasks.json'))
    const oldRunId = 'expert_image_revision_old'
    const newRunId = 'expert_image_revision_new'
    const imageDir = path.join(root, 'generated-images', newRunId)
    fs.mkdirSync(imageDir, { recursive: true })
    const newImagePath = path.join(imageDir, 'generated-01-new.png')
    fs.writeFileSync(newImagePath, 'new-real-image')
    const created = store.create({
      goal: '重新生成产品主视觉', expertId: 'image-producer', status: 'needs_input',
      attention: { action: 'retry', title: '图片生成未返回结果' },
      brief: { goal: '重新生成产品主视觉', deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }] },
      execRef: { kind: 'session', id: 'session-image-revision-recovery' },
      deliverables: [{ deliverableId: 'generated-image', title: '生成图片', type: 'image', version: 1, artifactRef: 'session-image-revision-recovery#old-image', executionRef: `agent-run:${oldRunId}`, acceptanceStatus: 'changes_requested' }],
      executionEvidence: [oldRunId, newRunId].map(runId => ({
        ...successfulImageEvidence(), runId, deliverableId: 'generated-image',
      })),
    })
    let session = { id: 'session-image-revision-recovery', expertId: 'image-producer', messages: [], run: { ...agentRun.createEmptyRun(), artifacts: [{ id: 'old-image', type: 'image', targetPath: 'old.png' }] } }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      app: { getPath: () => root }, fs, path,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      agentRun,
    })

    await runtime.recoverQueuedTasks()
    const result = runtime.get(created.task.id)
    assert.equal(result.task.status, 'review')
    assert.equal(result.task.deliverables[0].version, 2)
    assert.equal(result.task.deliverables[0].executionRef, `agent-run:${newRunId}`)
    assert.equal(result.task.deliverables[0].previousVersionId, 'session-image-revision-recovery#old-image')
    assert.equal(session.run.artifacts.at(-1).targetPath, newImagePath)
  })

  it('keeps an optional Photoshop companion from blocking real image generation', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-optional-photoshop-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品主视觉', expertId: 'image-producer', status: 'starting',
      brief: { goal: '生成一张产品主视觉', deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }] },
      execRef: { kind: 'session', id: 'session-image-optional-photoshop' },
    })
    const session = { id: 'session-image-optional-photoshop', expertId: 'image-producer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: imageCapabilityHub,
      getConnectorsApi: imageConnectorsApi,
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已生成候选图。',
        artifacts: [{ id: 'image-optional', type: 'image', targetPath: 'D:\\outputs\\optional.png' }],
        executionEvidence: successfulImageEvidence(),
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'review')
    assert.equal(result.task.deliverables[0].type, 'image')
  })

  it('blocks task start until every bound connector passes live authorization preflight', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-preflight-')), 'tasks.json')
    const store = createStore(file)
    let generated = false
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      getConnectorsApi: () => ({
        getConnectorStatus: async () => ({
          ok: true,
          connector: { id: 'feishu', type: 'feishu', enabled: true, agentVisible: true, status: { ok: false, state: 'auth_required' } },
        }),
      }),
      ensureAgentSession: () => ({ session: { id: 'session-preflight' }, sessions: [] }),
      saveAgentSessions: () => {},
      ensureCapabilityHub: () => ({
        expertRuntime: () => ({
          createSessionSnapshot: () => ({
            ok: true,
            snapshot: {
              bindings: { skills: [], connectors: ['feishu'] }, persona: {},
              capabilityManifest: { version: '1.0.0', dependencies: [{ id: 'feishu', kind: 'connector', required: true }] },
            },
          }),
        }),
      }),
      runAgentGenerate: async () => { generated = true; return { text: '不应执行' } },
    })

    const started = await runtime.createStart({
      title: '飞书任务',
      expertId: 'office-partner',
      brief: {
        goal: '读取飞书内容',
        plan: { goal: '读取飞书内容', steps: ['读取消息', '整理结论'] },
        deliverables: [{ id: 'primary', title: '结果', required: true }],
      },
    })

    assert.equal(started.ok, true)
    assert.equal(started.started, false)
    assert.equal(started.task.status, 'needs_input')
    assert.match(started.task.events.at(-1).summary, /尚未完成用户授权/)
    assert.deepEqual(started.task.attention.issues, [{
      id: 'feishu', code: 'connector_unavailable', message: '连接器尚未完成用户授权',
    }])
    assert.deepEqual(started.task.assignmentSnapshot.plan.steps, ['读取消息', '整理结论'])
    assert.equal(generated, false)
  })

  it('retains the prior version and feedback when model context cannot fit the revision', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-budget-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      expertId: 'qa-generic', expertName: 'QA expert', status: 'revising', goal: '修改交付物',
      execRef: { kind: 'session', id: 'budget-session' },
      brief: {
        goal: '修改交付物',
        materials: [{ title: 'A', content: '材料'.repeat(4000) }, { title: 'B', content: '证据'.repeat(4000) }],
        deliverables: [{ id: 'primary', title: '结果', type: 'document', required: true }],
      },
      deliverables: [{ deliverableId: 'primary', version: 1, acceptanceStatus: 'changes_requested',
        artifactRef: 'budget-session#v1', comments: [{ body: '只调整负责人，不要修改其他条目' }] }],
    })
    let session = { id: 'budget-session', messages: [], run: { ...agentRun.createEmptyRun(),
      artifacts: [{ id: 'v1', type: 'document', title: '结果', body: '完整的上一版内容' }] } }
    let modelCalls = 0
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({}) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        require('../src/lib/agent-context-finalize').finalizeAgentContext({ prepared: {
          modelProfile: { model: 'test', supportsTools: true, contextWindow: 8000 },
          contextDraft: {
            tier: 'assist', executionPolicy: 'tools-allowed', blocks: [],
            policyInput: { tier: 'assist', scene: 'expert-collaboration', conversationMode: 'expert-execution' },
            contextBudget: 2000, inputBudget: 4000, history: [], prompt: payload.prompt,
          },
        } })
        modelCalls++
        return { text: '不应提交的下一版' }
      },
      agentRun,
    })
    const result = await runtime.execute(created.task.id)
    assert.equal(modelCalls, 0)
    assert.equal(result.task.status, 'failed')
    assert.match(result.task.attention.detail, /上下文预算/)
    assert.equal(result.task.deliverables[0].version, 1)
    assert.equal(result.task.deliverables[0].comments.at(-1).body, '只调整负责人，不要修改其他条目')
    assert.equal(session.run.artifacts.length, 1)
    assert.equal(session.run.artifacts[0].body, '完整的上一版内容')
    assert.equal(runtime.controllers.size, 0)
  })

  for (const materialSize of [0, 8000]) it(`sends review feedback and prior artifacts with ${materialSize}-character materials as version 2`, async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-runtime-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '整理飞书消息',
      title: '待处理消息清单',
      expertId: 'office-partner',
      expertName: '办公协作专家',
      status: 'review',
      brief: {
        goal: '整理飞书消息',
        materials: materialSize ? [
          { id: 'long-a', title: '来源 A', content: '甲'.repeat(materialSize - 6) + 'A_END!' },
          { id: 'long-b', title: '来源 B', content: '乙'.repeat(materialSize - 6) + 'B_END!' },
        ] : [],
        deliverables: [{ id: 'primary', title: '可直接审阅的同步稿', type: 'document', required: true }],
      },
      execRef: { kind: 'session', id: 'session-review' },
      resultSummary: '上一版摘要',
      deliverables: [{
        deliverableId: 'primary',
        title: '可直接审阅的同步稿',
        type: 'document',
        version: 1,
        required: true,
        artifactRef: 'session-review#artifact-v1',
        artifactRefs: ['session-review#artifact-v1', 'session-review#artifact-v1-b'],
        acceptanceStatus: 'pending',
      }],
      events: [{ type: 'deliverable_ready', summary: '已提交第一版' }],
    })
    let session = {
      id: 'session-review',
      agentId: 'personal',
      expertId: 'office-partner',
      messages: [],
      run: {
        ...agentRun.createEmptyRun(),
        artifacts: [{
          id: 'artifact-v1',
          type: 'document',
          title: '可直接审阅的同步稿',
          body: '上一版正文：只有消息内容，没有负责人。' + (materialSize ? '\n' + '丙'.repeat(6500) + '\nPREVIOUS_END' : ''),
          status: 'draft',
          meta: {},
        }, {
          id: 'artifact-v1-b',
          type: 'document',
          title: '行动项附件',
          body: '上一版附件：行动项尚未标注截止时间。',
          status: 'draft',
          meta: {},
        }],
      },
    }
    let capturedPrompt = ''
    let capturedPayload = null
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'test-key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({
        expertRuntime: () => ({ readSessionSnapshot: () => ({ persona: { systemPrompt: '你负责办公协作。' } }) }),
      }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        capturedPrompt = payload.prompt
        capturedPayload = payload
        session.messages.push(
          { role: 'user', text: payload.prompt },
          { role: 'assistant', text: '第二版正文：已补充负责人和截止时间。' },
        )
        return {
          runId: payload.runId,
          text: '第二版正文：已补充负责人和截止时间。',
          executionEvidence: { gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [] },
        }
      },
      agentRun,
    })

    const reviewed = runtime.reviewDeliverable({
      taskId: created.task.id,
      deliverableId: 'primary',
      action: 'changes_requested',
      comment: '请补充每条消息的负责人和截止时间。',
      attachments: [{
        name: '修改参考.png',
        kind: 'image',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
      }],
    })

    assert.equal(reviewed.ok, true)
    assert.equal(reviewed.started, true)
    assert.equal(reviewed.task.status, 'starting')
    assert.equal(reviewed.task.progress.phase, 'preflight')
    assert.ok(Date.now() - Date.parse(reviewed.task.progress.heartbeatAt) < 2000)
    const revised = await waitFor(() => {
      const current = store.get(created.task.id)
      return current.ok && current.task.status === 'review' && current.task.deliverables[0].version === 2
        ? current.task
        : null
    })

    assert.match(capturedPrompt, /请补充每条消息的负责人和截止时间/)
    assert.match(capturedPrompt, /上一版正文：只有消息内容，没有负责人/)
    assert.match(capturedPrompt, /上一版附件：行动项尚未标注截止时间/)
    assert.match(capturedPrompt, /是否生成文件由用户需求和 Agent 交付契约决定/)
    assert.match(capturedPrompt, /缺少事实时说明缺口，不得编造/)
    if (materialSize) {
      assert.match(capturedPrompt, /A_END!/)
      assert.match(capturedPrompt, /B_END!/)
      assert.ok(capturedPrompt.includes('PREVIOUS_END'), 'keep the complete prior artifact, not only its first 6000 characters')
      // Verify the real request-packing path as well, not just the task payload.
      const { finalizeAgentContext } = require('../src/lib/agent-context-finalize')
      const final = finalizeAgentContext({ prepared: {
        modelProfile: { model: 'test', supportsTools: true, contextWindow: 32768 },
        contextDraft: {
          tier: 'assist', executionPolicy: 'tools-allowed', blocks: [],
          policyInput: { tier: 'assist', scene: 'expert-collaboration', conversationMode: 'expert-execution' },
          contextBudget: 6000, inputBudget: 24000, history: [], prompt: capturedPrompt,
        },
      } })
      const sent = final.apiMessages.filter(message => message.role === 'user').map(message => message.content).join('\n')
      assert.ok(sent.includes(capturedPrompt), 'the model must receive the complete revision request')
      assert.match(sent, /请补充每条消息的负责人和截止时间/)
    }
    assert.equal(capturedPayload.surface, 'workbench')
    assert.equal(capturedPayload.conversationMode, 'expert-execution')
    assert.equal(capturedPayload.expertId, 'office-partner')
    assert.deepEqual(capturedPayload.attachments, [{
      name: '修改参考.png',
      kind: 'image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
    }])
    assert.equal(capturedPayload.taskId, undefined)
    assert.equal(capturedPayload.workbenchTaskId, created.task.id)
    assert.equal(capturedPayload.permissions.orchestration.allowDelegate, false)
    assert.equal(revised.deliverables[0].acceptanceStatus, 'pending')
    assert.equal(revised.deliverables[0].previousVersionId, 'artifact-v1')
    assert.equal(revised.deliverables[0].comments.at(-1).body, '请补充每条消息的负责人和截止时间。')
    assert.equal(revised.brief.materials.at(-1).title, '修改参考.png')
    assert.equal(revised.brief.materials.at(-1).dataUrl, 'data:image/png;base64,ZmFrZQ==')
    assert.ok(revised.events.some(event => event.type === 'revision_ready'))
    assert.equal(session.run.artifacts.at(-1).body, '第二版正文：已补充负责人和截止时间。')
  })

  it('runs every requested deliverable in sequence and does not complete on the first acceptance', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-multi-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '先预览再导入', expertId: 'importer', status: 'starting',
      brief: {
        goal: '先预览再导入', materials: [],
        deliverables: [
          { id: 'preview', title: '导入预览', required: true },
          { id: 'result', title: '导入结果', required: true },
        ],
      },
      execRef: { kind: 'session', id: 'session-multi' },
    })
    let session = { id: 'session-multi', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const payloads = []
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        payloads.push(payload)
        return { runId: payload.runId, text: payloads.length === 1 ? '预览正文' : '导入结果正文', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    await runtime.execute(created.task.id)
    const first = store.get(created.task.id).task
    assert.equal(first.deliverables.length, 1)
    assert.equal(first.deliverables[0].deliverableId, 'preview')
    const accepted = runtime.reviewDeliverable({ taskId: created.task.id, deliverableId: 'preview', action: 'accept', comment: '确认继续' })
    assert.equal(accepted.task.status, 'starting')
    assert.equal(accepted.started, true)
    const second = await waitFor(() => {
      const value = store.get(created.task.id).task
      return value.deliverables.some(item => item.deliverableId === 'result') ? value : null
    })
    assert.equal(second.deliverables.length, 2)
    assert.match(payloads[1].prompt, /确认继续/)
    const completed = runtime.reviewDeliverable({ taskId: created.task.id, deliverableId: 'result', action: 'accept' })
    assert.equal(completed.task.status, 'completed')
  })

  it('keeps a tool-backed deliverable out of review when the evidence gate blocks it', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-evidence-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'starting',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true, requiredTools: ['import_project'] }] },
      execRef: { kind: 'session', id: 'session-evidence' },
    })
    const session = { id: 'session-evidence', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ...declaredTestTool('import_project'),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已经导入完成',
        executionEvidence: {
          gateStatus: 'blocked', verificationPassed: false, toolCalls: [], evidence: [],
          violations: [{ code: 'missing_required_tools', message: '缺少必需工具调用', missingTools: ['import_project'] }],
        },
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(result.task.executionEvidence[0].gateStatus, 'blocked')
    assert.equal(result.task.events.at(-1).type, 'execution_blocked')
  })

  it('allows evidence-blocked tasks to retry without inventing extra input', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-retry-input-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'needs_input',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true }] },
      execRef: { kind: 'session', id: 'session-retry-input' },
      events: [{ type: 'execution_blocked', summary: '还缺少可核验结果' }],
    })
    const session = { id: 'session-retry-input', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已补齐导入结果',
        executionEvidence: { gateStatus: 'not_required', verificationPassed: true },
      }),
      agentRun,
    })

    const retry = runtime.retry(created.task.id)
    assert.equal(retry.ok, true)
    const finished = await waitFor(() => {
      const current = store.get(created.task.id)
      return current.ok && current.task.status === 'review' ? current.task : null
    })
    assert.equal(finished.deliverables[0].deliverableId, 'result')
  })

  it('independently blocks a required tool that failed even when the executor reports verified', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-failed-tool-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'starting',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true, requiredTools: ['import_project'] }] },
      execRef: { kind: 'session', id: 'session-failed-tool' },
    })
    const session = { id: 'session-failed-tool', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ...declaredTestTool('import_project'),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '导入已经完成',
        executionEvidence: {
          gateStatus: 'verified', verificationPassed: true,
          toolCalls: [{ id: 'call-1', name: 'import_project', status: 'fail', error: 'write failed' }],
          evidence: [], violations: [],
        },
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(result.task.executionEvidence[0].gateStatus, 'blocked')
    assert.deepEqual(result.task.executionEvidence[0].violations.at(-1).missingTools, ['import_project'])
  })

  it('keeps failed attempts as audit history when a corrected call satisfies the contract', async () => {
    const store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-retry-contract-')), 'tasks.json'))
    const created = store.create({
      goal: '导出报表', expertId: 'custom-reporter', status: 'starting',
      brief: { goal: '导出报表', deliverables: [{ id: 'report', title: '报表', type: 'document', required: true, requiredTools: ['export_report'] }] },
      execRef: { kind: 'session', id: 'retry-session' },
    })
    let session = { id: 'retry-session', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test' }),
      normalizeChatEndpoint: value => value,
      ...declaredTestTool('export_report'),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: values => { session = values[0] },
      runAgentGenerate: async (_deps, payload, hooks) => {
        hooks.emit({ type: 'trace', payload: { kind: 'tool', title: '调用工具：export_report', summary: '正在导出' } })
        assert.equal(store.get(created.task.id).task.progress.label, '调用工具：export_report')
        return {
          runId: payload.runId, text: '已修正参数并完成报表。',
          executionEvidence: { gateStatus: 'verified', verificationPassed: true,
            toolCalls: [{ id: 'bad', name: 'export_report', status: 'fail' }, { id: 'good', name: 'export_report', status: 'ok' }],
            evidence: [], violations: [] },
        }
      },
      agentRun,
    })
    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'review')
    assert.equal(result.task.executionEvidence.at(-1).toolCalls[0].status, 'fail')
    assert.equal(result.task.executionEvidence.at(-1).verificationPassed, true)
  })

  it('upgrades a legacy completed task contract and reopens false text-only completion', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-legacy-contract-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行完整导入', expertId: 'external-capability-importer', status: 'completed',
      brief: { goal: '执行完整导入', deliverables: [{ id: 'item-2', title: '实际导入与验证', required: true }] },
      assignmentSnapshot: { agentId: 'external-capability-importer', agentVersion: '' },
      execRef: { kind: 'session', id: 'session-legacy-contract' },
      deliverables: [{
        deliverableId: 'item-2', title: '实际导入与验证', required: true,
        evidenceStatus: 'verified', acceptanceStatus: 'accepted',
      }],
      executionEvidence: [{
        runId: 'legacy-run', deliverableId: 'item-2', gateStatus: 'verified', verificationPassed: true,
        toolCalls: [{ id: 'preview', name: 'preview_external_project', status: 'ok' }], evidence: [], violations: [],
      }],
    })
    const currentManifest = {
      version: '1.2.0',
      metadata: { knowme: { execution: { deliverables: { 'item-2': {
        requiredTools: ['import_external_project', 'verify_imported_workflow'],
      } } } } },
    }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({
        readSessionSnapshot: () => ({ capabilityManifest: {} }),
        createSessionSnapshot: () => ({
          ok: true,
          snapshot: { capabilityManifest: currentManifest, hashes: { expert: 'current-hash' } },
        }),
      }) }),
    })

    const reconciled = runtime.get(created.task.id)
    assert.equal(reconciled.ok, true)
    assert.equal(reconciled.task.status, 'needs_input')
    assert.equal(reconciled.task.assignmentSnapshot.agentVersion, '1.2.0')
    assert.deepEqual(reconciled.task.brief.deliverables[0].requiredTools, ['import_external_project', 'verify_imported_workflow'])
    assert.equal(reconciled.task.deliverables[0].evidenceStatus, 'blocked')
    assert.equal(reconciled.task.deliverables[0].acceptanceStatus, 'pending')
    assert.equal(reconciled.task.events.at(-1).type, 'execution_invalidated')
  })

  it('retries a failed expert task without treating its workbench id as a Skill task id', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-retry-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'failed',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true }] },
      execRef: { kind: 'session', id: 'session-retry' },
      events: [{ type: 'failed', summary: '旧入口校验失败' }],
    })
    const session = { id: 'session-retry', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    let payload = null
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, value) => {
        payload = value
        return { runId: value.runId, text: '导入完成', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    const retried = runtime.retry(created.task.id)
    assert.equal(retried.ok, true)
    assert.equal(retried.started, true)
    const reviewed = await waitFor(() => store.get(created.task.id).task.status === 'review' ? store.get(created.task.id).task : null)
    assert.equal(payload.taskId, undefined)
    assert.equal(payload.workbenchTaskId, created.task.id)
    assert.equal(reviewed.events.some(event => event.type === 'retried'), true)
  })

  it('does not accept chat text for a configuration block that requires settings', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-config-block-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品图', expertId: 'image-producer', status: 'needs_input',
      attention: {
        kind: 'configuration_required', action: 'open_settings', title: '需要配置模型',
        item: '模型 API', question: '请先配置模型 API。',
      },
      brief: { goal: '生成一张产品图', deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }] },
    })
    const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store })

    const result = runtime.provideInput({ taskId: created.task.id, note: '确认继续' })

    assert.equal(result.ok, false)
    assert.equal(result.task.status, 'needs_input')
    assert.match(result.error, /前往设置/)
  })

  it('rejects a generic confirmation when a specific answer is still required', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-specific-input-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '生成一张产品图', expertId: 'image-producer', status: 'needs_input',
      attention: {
        kind: 'missing_information', action: 'provide_input', item: '图片用途',
        question: '这张图主要用于哪个位置？', example: '例如：应用图标，1:1。',
      },
      brief: { goal: '生成一张产品图', deliverables: [{ id: 'generated-image', title: '生成图片', type: 'image', required: true }] },
    })
    const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store })

    const result = runtime.provideInput({ taskId: created.task.id, note: '确认' })

    assert.equal(result.ok, false)
    assert.equal(result.task.status, 'needs_input')
    assert.match(result.error, /主要用于哪个位置/)
    assert.match(result.error, /应用图标/)
  })

  it('keeps a real executor clarification as user input instead of mislabeling it as a failed tool', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-runtime-clarify-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '总结指定会议', expertId: 'summary-expert', status: 'starting',
      brief: { goal: '总结指定会议', deliverables: [{ id: 'primary', title: '会议总结', required: true }] },
      execRef: { kind: 'session', id: 'session-runtime-clarify' },
    })
    const session = { id: 'session-runtime-clarify', expertId: 'summary-expert', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async () => ({
        text: '找到两场同名会议，请选择。',
        attention: {
          kind: 'missing_information', action: 'provide_input', title: '需要确认会议',
          item: '会议', question: '你指的是上午 10 点还是下午 3 点的会议？',
          options: ['上午 10 点', '下午 3 点'],
        },
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)

    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.attention.action, 'provide_input')
    assert.match(result.task.attention.question, /上午 10 点还是下午 3 点/)
    assert.deepEqual(result.task.attention.options, ['上午 10 点', '下午 3 点'])
  })

  it('resumes a revising task left behind by an interrupted runtime', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-resume-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '补齐同步稿', expertId: 'office-partner', status: 'revising',
      brief: { goal: '补齐同步稿', deliverables: [{ id: 'primary', title: '同步稿', required: true }] },
      execRef: { kind: 'session', id: 'session-resume' },
      deliverables: [{
        deliverableId: 'primary', title: '同步稿', version: 1, required: true,
        acceptanceStatus: 'changes_requested', comments: [{ body: '补充负责人' }],
      }],
      events: [{ type: 'changes_requested', summary: '补充负责人' }],
    })
    const session = { id: 'session-resume', expertId: 'office-partner', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, value) => ({
        runId: value.runId,
        text: '已补充负责人的新版同步稿',
        executionEvidence: { gateStatus: 'not_required', verificationPassed: true },
      }),
      agentRun,
    })

    const resumed = runtime.retry(created.task.id)
    assert.equal(resumed.ok, true)
    assert.equal(resumed.started, true)
    const reviewed = await waitFor(() => store.get(created.task.id).task.status === 'review' ? store.get(created.task.id).task : null)
    assert.equal(reviewed.deliverables[0].version, 2)
    assert.equal(reviewed.events.some(event => event.type === 'resumed'), true)
  })

  it('queues a user supplement during execution and automatically continues after the active step', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-queued-input-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '整理项目同步稿', expertId: 'office-partner', status: 'starting',
      brief: { goal: '整理项目同步稿', deliverables: [{ id: 'primary', title: '项目同步稿', required: true }] },
      execRef: { kind: 'session', id: 'session-queued-input' },
    })
    let session = { id: 'session-queued-input', expertId: 'office-partner', messages: [], run: agentRun.createEmptyRun() }
    let releaseFirstRun
    const firstRun = new Promise(resolve => { releaseFirstRun = resolve })
    let runCount = 0
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        runCount += 1
        if (runCount === 1) await firstRun
        return {
          runId: payload.runId,
          text: runCount === 1 ? '第一轮同步稿。' : '已按照补充更新同步稿。',
          executionEvidence: { gateStatus: 'not_required', verificationPassed: true },
        }
      },
      agentRun,
    })

    void runtime.execute(created.task.id)
    await waitFor(() => runCount === 1)
    const queued = runtime.provideInput({ taskId: created.task.id, note: '补充风险负责人和截止时间', queue: true })
    assert.equal(queued.ok, true)
    assert.equal(queued.queued, true)
    assert.equal(store.get(created.task.id).task.inputQueue.pending, true)
    const queuedEvent = store.get(created.task.id).task.events.at(-1)
    assert.equal(queuedEvent.type, 'input_queued')
    assert.equal(queuedEvent.kind, 'message')
    assert.equal(queuedEvent.source, 'user')
    assert.equal(queuedEvent.actorId, 'user')

    releaseFirstRun()
    const reviewed = await waitFor(() => {
      const current = store.get(created.task.id)
      return current.ok && current.task.status === 'review' && runCount === 2 ? current.task : null
    })
    assert.equal(reviewed.events.some(event => event.type === 'queued_input_applied'), true)
    assert.equal(reviewed.brief.materials.at(-1).content, '补充风险负责人和截止时间')
    assert.equal(reviewed.inputQueue, null)
  })

  it('recovers persisted queued input for any expert after the application restarts', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-queued-recovery-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '更新项目同步稿', expertId: 'office-partner', status: 'running',
      brief: {
        goal: '更新项目同步稿',
        materials: [{ id: 'queued-note', type: 'text', title: '用户补充', content: '补充最终负责人' }],
        deliverables: [{ id: 'primary', title: '项目同步稿', required: true }],
      },
      inputQueue: { pending: true, count: 1, queuedAt: new Date().toISOString() },
      execRef: { kind: 'session', id: 'session-queued-recovery' },
    })
    let session = { id: 'session-queued-recovery', expertId: 'office-partner', messages: [], run: agentRun.createEmptyRun() }
    let runCount = 0
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        runCount += 1
        assert.match(payload.prompt, /补充最终负责人/)
        return { runId: payload.runId, text: '已恢复并更新同步稿。', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    const recovered = await runtime.recoverQueuedTasks()
    assert.deepEqual(recovered.recovered, [created.task.id])
    const reviewed = await waitFor(() => {
      const current = store.get(created.task.id)
      return current.ok && current.task.status === 'review' ? current.task : null
    })
    assert.equal(runCount, 1)
    assert.equal(reviewed.inputQueue, null)
    assert.equal(reviewed.events.some(event => event.type === 'queued_input_recovered'), true)
  })

  it('pauses an unmatched declared route before model execution and resumes after a route hint', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-route-fit-gate-')), 'tasks.json')
    const store = createStore(file)
    const snapshot = {
      bindings: { skills: [], connectors: [] },
      capabilityManifest: {
        version: '1.0.0',
        dependencies: [],
        metadata: { knowme: { execution: { routes: [{ id: 'calendar', keywords: ['日程'] }] } } },
      },
    }
    let session = { id: '', messages: [], run: agentRun.createEmptyRun() }
    let generated = 0
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({
        createSessionSnapshot: () => ({ ok: true, snapshot }),
        readSessionSnapshot: () => snapshot,
      }) }),
      ensureAgentSession: id => {
        session = { ...session, id }
        return { session, sessions: [session] }
      },
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        generated += 1
        assert.equal(payload.executionContract.executionRoute, 'calendar')
        return { runId: payload.runId, text: '已整理今日日程。', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    const blocked = await runtime.createStart({
      title: '设计一张海报', expertId: 'generic-agent',
      brief: { goal: '设计一张海报', deliverables: [{ id: 'primary', title: '方案', required: true }] },
    })
    assert.equal(blocked.ok, true)
    assert.equal(blocked.started, false)
    assert.equal(blocked.task.status, 'needs_input')
    assert.equal(blocked.task.attention.kind, 'capability_unavailable')
    assert.equal(blocked.task.attention.action, 'provide_input')
    assert.equal(generated, 0)

    const resumed = runtime.provideInput({ taskId: blocked.task.id, note: '只整理今日日程' })
    assert.equal(resumed.ok, true)
    assert.equal(resumed.started, true)
    const reviewed = await waitFor(() => {
      const current = store.get(blocked.task.id)
      return current.ok && ['review', 'needs_input', 'failed'].includes(current.task.status) ? current.task : null
    })
    assert.equal(generated, 1)
    assert.equal(reviewed.status, 'review', JSON.stringify({ status: reviewed.status, attention: reviewed.attention, events: reviewed.events.slice(-3) }))
    assert.equal(reviewed.brief.plan.steps.at(-1), '只整理今日日程')
  })

  it('routes an office Feishu message task to the matching skill and tool before producing review output', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-office-route-')), 'tasks.json')
    const store = createStore(file)
    let session = { id: 'session-office-route', expertId: 'office-partner', messages: [], run: agentRun.createEmptyRun() }
    let capturedPayload = null
    const snapshot = {
      bindings: { skills: ['feishu-related-chats'], connectors: ['feishu'] },
      persona: { systemPrompt: '你是办公协作专家。', sop: '先读取飞书消息，再整理交付物。' },
      capabilityManifest: { version: '1.0.0', dependencies: [
        { id: 'feishu-related-chats', kind: 'skill', required: true },
        { id: 'feishu', kind: 'connector', required: true },
      ], metadata: { knowme: { execution: { routes: [
        { id: 'related-chats', skillId: 'feishu-related-chats', connectorId: 'feishu', keywords: '飞书,消息,聊天', requiredTools: ['feishu.related_chats'], description: '先读取真实消息再整理。' },
      ] } } } },
    }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      getConnectorsApi: () => ({
        getConnectorStatus: async () => ({
          ok: true,
          connector: {
            id: 'feishu', enabled: true, agentVisible: true,
            status: { ok: true, state: 'ready', userReady: true, projectedAllowlist: ['feishu.related_chats'] },
          },
        }),
      }),
      ensureCapabilityHub: () => ({
        skillRuntime: () => ({
          findSkillRecord: () => ({ id: 'feishu-related-chats' }),
          isSkillEnabled: () => true,
          loadSkillGroundingContract: () => ({ ok: true, contract: { requiredTools: ['feishu.related_chats'] } }),
        }),
        expertRuntime: () => ({
          readSessionSnapshot: () => snapshot,
          createSessionSnapshot: () => ({ ok: true, snapshot }),
        }),
      }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        capturedPayload = payload
        return {
          runId: payload.runId,
          text: '今日消息重点：项目按计划推进。',
          executionEvidence: {
            gateStatus: 'verified',
            verificationPassed: true,
            toolCalls: [{ name: 'feishu.related_chats', status: 'ok' }],
            evidence: [{ status: 'ok', provenance: { kind: 'tool_result', tool: 'feishu.related_chats' }, digest: '真实消息结果' }],
          },
        }
      },
      agentRun,
    })

    const started = await runtime.createStart({
      title: '整理今天飞书消息',
      expertId: 'office-partner',
      brief: {
        goal: '帮我把今天飞书的消息总结一下',
        deliverables: [{ id: 'primary', title: '今日消息同步稿', required: true }],
      },
    })
    assert.equal(started.ok, true)
    assert.equal(started.started, true)
    const reviewed = await waitFor(() => {
      const current = store.get(started.task.id)
      return current.ok && current.task.status === 'review' ? current.task : null
    })
    assert.deepEqual(reviewed.brief.deliverables[0].requiredTools, ['feishu.related_chats'])
    assert.deepEqual(capturedPayload.executionContract.requiredTools, ['feishu.related_chats'])
    assert.match(capturedPayload.prompt, /本轮 SOP 路由：related-chats/)
    assert.match(capturedPayload.prompt, /依据当前 Agent 的 SOP 选择工具顺序/)
    assert.match(capturedPayload.prompt, /先读取飞书消息，再整理交付物/)
  })

  it('stops an office Feishu task when its route skill is unavailable', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-office-skill-')), 'tasks.json')
    const store = createStore(file)
    const snapshot = {
      bindings: { skills: ['feishu-related-chats'], connectors: ['feishu'] },
      persona: {},
      capabilityManifest: { version: '1.0.0', dependencies: [
        { id: 'feishu-related-chats', kind: 'skill', required: true },
        { id: 'feishu', kind: 'connector', required: true },
      ], metadata: { knowme: { execution: { routes: [
        { id: 'related-chats', skillId: 'feishu-related-chats', connectorId: 'feishu', keywords: '飞书,消息,聊天', requiredTools: ['feishu.related_chats'], description: '先读取真实消息再整理。' },
      ] } } } },
    }
    let generated = false
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      getConnectorsApi: () => ({
        getConnectorStatus: async () => ({
          ok: true,
          connector: { id: 'feishu', enabled: true, agentVisible: true, status: { ok: true, state: 'ready', userReady: true, projectedAllowlist: ['feishu.related_chats'] } },
        }),
      }),
      ensureAgentSession: () => ({ session: { id: 'session-office-skill' }, sessions: [] }),
      saveAgentSessions: () => {},
      ensureCapabilityHub: () => ({
        skillRuntime: () => ({ findSkillRecord: () => null, isSkillEnabled: () => false }),
        expertRuntime: () => ({ createSessionSnapshot: () => ({ ok: true, snapshot }), readSessionSnapshot: () => snapshot }),
      }),
      runAgentGenerate: async () => { generated = true; return { text: '不应执行' } },
    })

    const started = await runtime.createStart({
      title: '整理消息', expertId: 'office-partner',
      brief: { goal: '分析今天飞书的消息', deliverables: [{ id: 'primary', title: '结果', required: true }] },
    })
    assert.equal(started.ok, true)
    assert.equal(started.started, false)
    assert.equal(started.task.status, 'needs_input')
    assert.match(started.task.events.at(-1).summary, /技能未安装/)
    assert.equal(generated, false)
  })

  it('persists an immutable Agent Skill connector and model identity for qualification evidence', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-qualification-context-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const store = createStore(path.join(directory, 'tasks.json'))
    const snapshot = {
      bindings: { skills: ['architecture-decision'], connectors: ['local-tools'] },
      hashes: {
        expert: 'expert-hash-v2',
        skills: { 'architecture-decision': 'skill-hash-v4' },
        connectors: { 'local-tools': 'connector-hash-v1' },
      },
      capabilityManifest: { version: '2.0.0', dependencies: [] },
    }
    const created = store.create({
      goal: '评估撤权架构', expertId: 'solution-architect', status: 'starting',
      brief: { goal: '评估撤权架构', deliverables: [{ id: 'primary', title: '架构建议', type: 'answer', required: true }] },
      assignmentSnapshot: {
        agentId: 'solution-architect', agentVersion: '2.0.0', agentHash: 'expert-hash-v2',
        bindings: snapshot.bindings, hashes: snapshot.hashes,
      },
      execRef: { kind: 'session', id: 'qualification-session' },
    })
    let session = { id: 'qualification-session', expertId: 'solution-architect', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => snapshot }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload, hooks) => {
        hooks.emit({ payload: { contextInfo: {
          provider: 'dashscope', model: 'qwen3.8-max', requestedModel: 'qwen3.8-max', label: 'Qwen 3.8 Max',
        } } })
        return {
          runId: payload.runId,
          text: '已完成基于约束的架构评估。',
          metrics: { qualityReview: { enabled: true, passed: true, initialPassed: false, finalPassed: true, rewritten: true } },
          executionEvidence: { gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [] },
        }
      },
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'review')
    const evidence = createStore(path.join(directory, 'tasks.json')).get(created.task.id).task.executionEvidence.at(-1)
    assert.equal(evidence.qualificationContext.complete, true)
    assert.match(evidence.qualificationContext.configurationId, /^expert-config-v2:[a-f0-9]{64}$/)
    assert.match(evidence.qualificationContext.runtime.hash, /^[a-f0-9]{64}$/)
    assert.deepEqual(evidence.qualificationContext.agent, {
      id: 'solution-architect', version: '2.0.0', hash: 'expert-hash-v2',
    })
    assert.deepEqual(evidence.qualificationContext.skills, [{ id: 'architecture-decision', hash: 'skill-hash-v4' }])
    assert.deepEqual(evidence.qualificationContext.connectors, [{ id: 'local-tools', hash: 'connector-hash-v1' }])
    assert.equal(evidence.qualificationContext.model.provider, 'dashscope')
    assert.equal(evidence.qualificationContext.model.id, 'qwen3.8-max')
    assert.deepEqual(evidence.qualityGuardrail, {
      mode: 'same_model_guardrail', enabled: true, passed: true, rewritten: true, initialPassed: false, finalPassed: true,
    })
  })

  it('persists configuration-scoped qualification evidence when generation fails', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-failed-qualification-context-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const store = createStore(path.join(directory, 'tasks.json'))
    const snapshot = {
      bindings: { skills: ['software-change-verification'], connectors: [] },
      hashes: {
        expert: 'software-expert-hash-v2',
        skills: { 'software-change-verification': 'verification-skill-hash-v1' },
        connectors: {},
      },
      capabilityManifest: { version: '2.2.0', dependencies: [] },
    }
    const created = store.create({
      goal: '实现有界并发池', expertId: 'software-engineer', status: 'starting',
      brief: { goal: '实现有界并发池', deliverables: [{ id: 'primary', title: '代码答复', type: 'answer', required: true }] },
      assignmentSnapshot: {
        agentId: 'software-engineer', agentVersion: '2.2.0', agentHash: 'software-expert-hash-v2',
        bindings: snapshot.bindings, hashes: snapshot.hashes,
      },
      execRef: { kind: 'session', id: 'failed-qualification-session' },
    })
    const session = { id: 'failed-qualification-session', expertId: 'software-engineer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => snapshot }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload, hooks) => {
        hooks.emit({ payload: { contextInfo: {
          provider: 'dashscope', model: 'qwen3.8-max', requestedModel: 'qwen3.8-max', label: 'Qwen 3.8 Max',
        } } })
        return { runId: payload.runId, error: '模型未能返回完整答复' }
      },
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'failed')
    const evidence = createStore(path.join(directory, 'tasks.json')).get(created.task.id).task.executionEvidence.at(-1)
    assert.equal(evidence.gateStatus, 'failed')
    assert.equal(evidence.verificationPassed, false)
    assert.equal(evidence.qualificationContext.complete, true)
    assert.match(evidence.qualificationContext.configurationId, /^expert-config-v2:[a-f0-9]{64}$/)
    assert.match(evidence.qualificationContext.runtime.hash, /^[a-f0-9]{64}$/)
    assert.equal(evidence.qualificationContext.model.provider, 'dashscope')
    assert.equal(evidence.qualificationContext.model.id, 'qwen3.8-max')
    assert.deepEqual(evidence.violations, [{ code: 'execution_failed', message: '模型未能返回完整答复', missingTools: [] }])
  })

  it('persists actionable professional review findings when a run is rejected', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-review-findings-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const store = createStore(path.join(directory, 'tasks.json'))
    const snapshot = {
      bindings: { skills: ['product-definition-method'], connectors: [] },
      hashes: { expert: 'product-hash', skills: { 'product-definition-method': 'method-hash' }, connectors: {} },
      capabilityManifest: { version: '2.4.0', dependencies: [] },
    }
    const created = store.create({
      goal: '定义发布验收范围', expertId: 'product-manager', status: 'starting',
      brief: { goal: '定义发布验收范围', deliverables: [{ id: 'primary', title: '产品方案', type: 'answer', required: true }] },
      assignmentSnapshot: { agentId: 'product-manager', agentVersion: '2.4.0', agentHash: 'product-hash',
        bindings: snapshot.bindings, hashes: snapshot.hashes },
      execRef: { kind: 'session', id: 'review-findings-session' },
    })
    const session = { id: 'review-findings-session', expertId: 'product-manager', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.test/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => snapshot }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload, hooks) => {
        hooks.emit({ payload: { contextInfo: { provider: 'dashscope', model: 'qwen3.8-max' } } })
        return {
          runId: payload.runId,
          error: '专家答复未通过专业质量复核，需修正：补全验收边界。',
          code: 'professional_review_failed',
          metrics: { qualityReview: {
            enabled: true, passed: false, rewritten: false, initialPassed: false, budgetExhausted: true,
            initialIssues: [{ criterion: 2, problem: '没有定义失败状态', requiredChange: '补全失败状态和恢复入口' }],
          } },
        }
      },
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'failed')
    const evidence = createStore(path.join(directory, 'tasks.json')).get(created.task.id).task.executionEvidence.at(-1)
    assert.equal(evidence.qualityGuardrail.budgetExhausted, true)
    assert.equal(evidence.qualityGuardrail.rewritten, false)
    assert.deepEqual(evidence.qualityGuardrail.issues, [{
      criterion: 2,
      problem: '没有定义失败状态',
      requiredChange: '补全失败状态和恢复入口',
    }])
    assert.match(evidence.violations[0].message, /补全验收边界/)
  })
})
