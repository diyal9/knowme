'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const {
  assertSafeUserData,
  environmentBlock,
  lifecycleCheck,
  loadSuite,
  readCursorMcpServer,
  retryWhenIdle,
  parseArgs,
  suiteConnectorConfigurations,
  suiteSourceConnectorIds,
  suiteConnectorConfigurationIssues,
  statusAfterRunError,
  selectCases,
  toAgentEvalResults,
  qualificationEnvironmentBlock,
  seedEncryptedProviderSettings,
  blockedQualificationRow,
  reviewEvidenceFromSession,
  inheritedImageMaterials,
} = require('../scripts/expert-qualification-live')

test('reopen qualification inherits only selected image artifacts inside isolated userData', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-image-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const imagePath = path.join(root, 'generated-images', 'original.png')
  fs.mkdirSync(path.dirname(imagePath), { recursive: true })
  fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const materials = inheritedImageMaterials({ run: { artifacts: [
    { id: 'selected', type: 'image', title: '原图', targetPath: imagePath },
    { id: 'ignored', type: 'image', title: '其他图', targetPath: imagePath },
  ] } }, ['session#selected'], root)
  assert.equal(materials.length, 1)
  assert.equal(materials[0].kind, 'image')
  assert.equal(materials[0].sourceArtifactId, 'selected')
  assert.match(materials[0].dataUrl, /^data:image\/png;base64,/)
})

test('live qualification CLI parses repeatable cases without starting Electron', () => {
  const parsed = parseArgs(['node', 'script', '--suite', 'suite.json', '--case', 'A,B', '--case', 'C', '--user-data', 'qa-data', '--source-user-data', 'production-data', '--out', 'out.json', '--allow-development-data', '--max-wait-seconds', '360'])
  assert.deepEqual(parsed.cases, ['A', 'B', 'C'])
  assert.equal(parsed.suite, 'suite.json')
  assert.equal(parsed.userData, 'qa-data')
  assert.equal(parsed.sourceUserData, 'production-data')
  assert.equal(parsed.output, 'out.json')
  assert.equal(parsed.allowDevelopmentData, true)
  assert.equal(parsed.maxWaitSeconds, 360)
})

test('live qualification CLI bounds explicit wait overrides', () => {
  assert.throws(() => parseArgs(['node', 'script', '--max-wait-seconds', '9']), /10 to 1800/)
  assert.throws(() => parseArgs(['node', 'script', '--max-wait-seconds', '1801']), /10 to 1800/)
  assert.throws(() => parseArgs(['node', 'script', '--max-wait-seconds', '12.5']), /10 to 1800/)
})

test('qualification seeds only encrypted provider settings into isolated userData', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-provider-source-'))
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-provider-qa-'))
  fs.writeFileSync(path.join(source, 'settings.json'), JSON.stringify({
    llmProvider: 'dashscope',
    model: 'qwen3.8-flash',
    apiEndpoint: 'https://dashscope.example/v1/chat/completions',
    apiKeyEnc: 'encrypted-value',
    apiKey: 'plaintext-must-not-copy',
  }))
  fs.writeFileSync(path.join(source, 'Local State'), JSON.stringify({
    os_crypt: { audit_enabled: true, encrypted_key: 'encrypted-master-key' },
    unrelatedBrowserState: { mustNotCopy: true },
  }))
  fs.writeFileSync(path.join(target, 'settings.json'), JSON.stringify({ temperature: 0.2 }))
  fs.writeFileSync(path.join(target, 'Local State'), JSON.stringify({
    os_crypt: { encrypted_key: 'wrong-test-key' },
    targetState: { keep: true },
  }))
  fs.writeFileSync(path.join(source, 'connector-secrets.json'), JSON.stringify({
    version: 1,
    connectors: {
      'thinkingdata-analysis-mcp': { THINKINGDATA_ACCESS_TOKEN: 'encrypted-test-token' },
      'unrelated-connector': { ACCESS_TOKEN: 'must-not-copy' },
    },
  }))

  const result = seedEncryptedProviderSettings(source, target, ['thinkingdata-analysis-mcp'])
  const settings = JSON.parse(fs.readFileSync(path.join(target, 'settings.json'), 'utf8'))
  const localState = JSON.parse(fs.readFileSync(path.join(target, 'Local State'), 'utf8'))
  const connectorSecrets = JSON.parse(fs.readFileSync(path.join(target, 'connector-secrets.json'), 'utf8'))
  assert.deepEqual(result, {
    requested: true,
    copied: true,
    source: 'encrypted_settings_and_key_metadata',
    encryptedProviderConfigured: true,
    encryptedKeyMetadataCopied: true,
    encryptedConnectorIds: ['thinkingdata-analysis-mcp'],
  })
  assert.equal(settings.apiKeyEnc, 'encrypted-value')
  assert.equal(Object.hasOwn(settings, 'apiKey'), false)
  assert.equal(settings.temperature, 0.2)
  assert.deepEqual(localState.os_crypt, {
    audit_enabled: true,
    encrypted_key: 'encrypted-master-key',
  })
  assert.deepEqual(localState.targetState, { keep: true })
  assert.equal(Object.hasOwn(localState, 'unrelatedBrowserState'), false)
  assert.deepEqual(connectorSecrets.connectors['thinkingdata-analysis-mcp'], {
    THINKINGDATA_ACCESS_TOKEN: 'encrypted-test-token',
  })
  assert.equal(Object.hasOwn(connectorSecrets.connectors, 'unrelated-connector'), false)
})

test('qualification requires an explicit suite opt-in before seeding connector secrets', () => {
  const suite = {
    setup: {
      configureConnectors: [
        { id: 'thinkingdata-analysis-mcp', seedSecretsFromSource: true },
        { id: 'pango-image-mcp' },
      ],
    },
  }

  assert.deepEqual(suiteSourceConnectorIds(suite), ['thinkingdata-analysis-mcp'])
  assert.equal(Object.hasOwn(suiteConnectorConfigurations(suite)[0], 'seedSecretsFromSource'), false)
})

test('qualification retry follows the replacement task created for a cancelled run', async () => {
  const calls = []
  const page = {
    evaluate: async (_fn, taskId) => {
      calls.push(taskId)
      if (calls.length === 1) return { ok: false, error: '任务仍在清理' }
      return { ok: true, started: true, task: { id: 'replacement-task', status: 'starting' } }
    },
  }

  const result = await retryWhenIdle(page, 'cancelled-task', 2000)
  assert.equal(result.task.id, 'replacement-task')
  assert.deepEqual(calls, ['cancelled-task', 'cancelled-task'])
})

test('live qualification rejects production and unmarked userData paths', () => {
  const appData = path.join(os.tmpdir(), 'qualification-guard-appdata')
  assert.throws(() => assertSafeUserData(path.join(appData, 'KnowMe'), { APPDATA: appData }), /production KnowMe/)
  assert.throws(() => assertSafeUserData(path.join(os.tmpdir(), 'ordinary-user-data'), { APPDATA: appData }), /must contain/)
  assert.equal(
    assertSafeUserData(path.join(os.tmpdir(), 'knowme-qualification-run'), { APPDATA: appData }),
    path.resolve(os.tmpdir(), 'knowme-qualification-run'),
  )
})

test('live qualification permits only the exact development profile after explicit opt-in', () => {
  const env = { APPDATA: path.join('C:', 'Users', 'qa', 'AppData', 'Roaming') }
  const development = path.join(env.APPDATA, 'KnowMe')
  assert.throws(() => assertSafeUserData(development, env), /Refusing to use production/)
  assert.equal(assertSafeUserData(development, env, { allowDevelopmentData: true }), path.resolve(development))
  assert.throws(
    () => assertSafeUserData(path.join(development, 'nested'), env, { allowDevelopmentData: true }),
    /Refusing to use production/,
  )
  assert.throws(
    () => assertSafeUserData(path.join('D:', 'qualification'), env, { allowDevelopmentData: true }),
    /only permits the exact/,
  )
})

test('suite validation freezes lifecycle contracts and case selection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-suite-'))
  const file = path.join(dir, 'evals.json')
  fs.writeFileSync(file, JSON.stringify({
    suite: 'TEST',
    evals: [
      { id: 'A', expertId: 'product-manager', prompt: 'deliver', lifecycle: 'create' },
      { id: 'B', expertId: 'product-manager', prompt: 'revise', lifecycle: 'request_changes', reviewComment: 'change it' },
    ],
  }))
  const suite = loadSuite(file)
  assert.deepEqual(selectCases(suite, ['B']).map(item => item.id), ['B'])
  assert.throws(() => selectCases(suite, ['missing']), /Unknown eval/)
})

test('live qualification validates only explicitly selected cases for a mixed legacy suite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-selected-suite-'))
  const file = path.join(dir, 'evals.json')
  fs.writeFileSync(file, JSON.stringify({
    evals: [
      { id: 'legacy', expert: 'research-analyst', prompt: '' },
      { id: 'current', expertId: 'research-analyst', prompt: 'valid prompt' },
    ],
  }))
  const suite = loadSuite(file, ['current'])
  assert.deepEqual(suite.evals.map(item => item.id), ['current'])
})

test('qualification refuses incomplete declared connector configuration before launching Electron', () => {
  const suite = {
    setup: {
      configureConnectors: [{
        id: 'pango-image-mcp',
        type: 'mcp',
        mcp: { transport: 'streamable-http', urlFromEnv: 'KNOWME_PANGO_MCP_URL' },
      }],
    },
  }
  assert.deepEqual(suiteConnectorConfigurationIssues(suite, {}), [{
    id: 'pango-image-mcp',
    code: 'missing_endpoint',
    field: 'KNOWME_PANGO_MCP_URL',
    message: '连接器 pango-image-mcp 需要设置环境变量 KNOWME_PANGO_MCP_URL',
  }])
  assert.deepEqual(suiteConnectorConfigurationIssues(suite, { KNOWME_PANGO_MCP_URL: 'http://127.0.0.1:8787/mcp' }), [])
})

test('qualification can resolve an explicitly declared Cursor MCP endpoint and secret without logging it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-cursor-'))
  const cursorDir = path.join(home, '.cursor')
  fs.mkdirSync(cursorDir, { recursive: true })
  fs.writeFileSync(path.join(cursorDir, 'mcp.json'), `\uFEFF${JSON.stringify({
    mcpServers: {
      'fixture-pango': {
        url: 'https://fixture.invalid/mcp',
        headers: { Authorization: 'Bearer fixture-secret' },
      },
    },
  })}`)
  const suite = {
    setup: {
      configureConnectors: [{
        id: 'pango-image-mcp',
        type: 'mcp',
        enabled: true,
        mcp: { transport: 'streamable-http', urlFromCursorServer: 'fixture-pango' },
        secretsFromCursorHeaders: { PANGO_ACCESS_TOKEN: 'Authorization' },
      }],
    },
  }
  assert.deepEqual(readCursorMcpServer('fixture-pango', { USERPROFILE: home }), {
    url: 'https://fixture.invalid/mcp',
    headers: { Authorization: 'Bearer fixture-secret' },
  })
  assert.deepEqual(suiteConnectorConfigurationIssues(suite, { USERPROFILE: home }), [])
  assert.deepEqual(suiteConnectorConfigurations(suite, { USERPROFILE: home }), [{
    id: 'pango-image-mcp',
    type: 'mcp',
    enabled: true,
    mcp: { transport: 'streamable-http', url: 'https://fixture.invalid/mcp' },
    qualificationSecrets: { PANGO_ACCESS_TOKEN: 'fixture-secret' },
  }])
})

test('suite validation supports expected failure outcomes for tool and artifact regressions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-failure-suite-'))
  const file = path.join(dir, 'evals.json')
  fs.writeFileSync(file, JSON.stringify({
    suite: 'FAILURE',
    evals: [{
      id: 'IMG-FAIL', expertId: 'image-producer', prompt: '生成图片，但工具不返回图片时应明确失败',
      lifecycle: 'create', expectedStatus: 'needs_input', expectedAttentionKind: 'artifact_missing',
      expectedHasDeliverable: false,
      deliverables: [{ id: 'primary', title: '生成图片', type: 'image', required: true }],
    }],
  }))
  const suite = loadSuite(file)
  assert.equal(suite.evals[0].expectedStatus, 'needs_input')
})

test('expected failure outcomes are evidence when the declared lifecycle reaches them', () => {
  const result = lifecycleCheck({
    lifecycle: 'create', expectedStatus: 'needs_input', expectedAttentionKind: 'artifact_missing', expectedHasDeliverable: false,
  }, {
    status: 'needs_input', attention: { kind: 'artifact_missing' }, deliverables: [], events: [],
  }, {})
  assert.equal(result.passed, true)
  assert.equal(result.blocked, false)
  const report = toAgentEvalResults({ suite: 'TEST', generatedAt: '2026-01-01T00:00:00.000Z', tasks: [{
    expertId: 'image-producer', taskId: 'img-fail', evalId: 'IMG-FAIL', scenario: 'edge', status: 'needs_input',
    expectedStatus: 'needs_input', assertions: ['x'], configuration: { configurationId: 'config-a' }, lifecycleEvidence: result,
  }] })
  assert.equal(report.agents[0].tasks[0].hardFailure, false)
})

test('lifecycle evidence is structural and never implies semantic certification', () => {
  const task = {
    status: 'review',
    events: [{ type: 'changes_requested' }],
    deliverables: [{ deliverableId: 'primary', version: 2, previousVersionId: 'primary#v1' }],
  }
  const result = lifecycleCheck({ lifecycle: 'request_changes' }, task, { initialVersion: 1 })
  assert.equal(result.passed, true)
  assert.equal(result.checks.previousVersionLinked, true)
})

test('reopen lifecycle accepts an immutable completed task followed by a linked commission', () => {
  const task = {
    status: 'review',
    taskRef: { id: 'accepted-task' },
    events: [{ type: 'created' }],
    deliverables: [{ deliverableId: 'primary', version: 1 }],
  }
  const result = lifecycleCheck({ lifecycle: 'accept_then_reopen' }, task, {
    acceptedStatus: 'completed',
    acceptedTaskId: 'accepted-task',
    reopenedTaskId: 'follow-up-task',
  })
  assert.equal(result.passed, true)
  assert.equal(result.checks.previousVersionLinked, true)
})

test('qualification report exports the canonical text candidate for independent review', () => {
  const evidence = reviewEvidenceFromSession({
    run: {
      artifacts: [
        {
          id: 'answer-1', type: 'answer', title: 'PRD', body: '完整候选正文',
          status: 'draft', meta: { taskId: 'task-1' },
        },
        {
          id: 'image-1', type: 'image', title: '图片', body: 'data:image/png;base64,secret',
          status: 'draft', meta: { taskId: 'task-1' }, targetPath: 'C:/qa/image.png',
        },
      ],
    },
  }, {
    id: 'task-1',
    deliverables: [{ artifactRef: 'session#answer-1' }],
  })
  assert.deepEqual(evidence.artifacts, [
    {
      id: 'answer-1', title: 'PRD', type: 'answer', status: 'draft',
      bodyChars: 6, truncated: false, body: '完整候选正文',
    },
    {
      id: 'image-1', title: '图片', type: 'image', status: 'draft',
      bodyChars: 28, truncated: false, targetPath: 'C:/qa/image.png',
    },
  ])
})

test('lifecycle evidence requires the declared execution route to be selected', () => {
  const task = {
    status: 'review',
    events: [],
    deliverables: [{ deliverableId: 'primary', version: 1 }],
    executionEvidence: [{ executionRoute: 'architecture-decision' }],
  }
  const result = lifecycleCheck({ lifecycle: 'create', routeId: 'architecture-decision' }, task, {})
  assert.equal(result.passed, true)
  assert.equal(result.checks.executionRouteSelected, true)
  assert.deepEqual(result.executionRoutes, ['architecture-decision'])

  const mismatch = lifecycleCheck({ lifecycle: 'create', routeId: 'quality-verification' }, task, {})
  assert.equal(mismatch.passed, false)
  assert.equal(mismatch.checks.executionRouteSelected, false)
})

test('runtime or lifecycle failure becomes hard evidence while semantic-pending success does not self-certify', () => {
  const result = toAgentEvalResults({
    suite: 'TEST',
    generatedAt: '2026-01-01T00:00:00.000Z',
    tasks: [
      { expertId: 'product-manager', taskId: 'failed', evalId: 'A', scenario: 'normal', status: 'failed', assertions: ['x'], error: 'timeout', configuration: { configurationId: 'config-a' }, lifecycleEvidence: { passed: false } },
      { expertId: 'product-manager', taskId: 'pending', evalId: 'B', scenario: 'normal', status: 'review', assertions: ['x'], hardAssertionsPassed: null, configuration: { configurationId: 'config-a' }, lifecycleEvidence: { passed: true } },
    ],
  })
  assert.equal(result.agents[0].tasks[0].hardFailure, true)
  assert.equal(result.agents[0].tasks[0].hardAssertionsPassed, null)
  assert.equal(result.agents[0].tasks[1].hardFailure, false)
  assert.equal(result.agents[0].tasks[1].hardAssertionsPassed, null)
})

test('qualification evidence preserves a terminal needs_input instead of relabeling it as runtime failure', () => {
  assert.equal(statusAfterRunError({ status: 'needs_input' }), 'needs_input')
  assert.equal(statusAfterRunError({ status: 'cancelled' }), 'cancelled')
  assert.equal(statusAfterRunError({ status: 'running' }), 'failed')
  assert.equal(statusAfterRunError(null), 'failed')
})

test('configuration-required needs_input is blocked evidence, not a runtime failure', () => {
  const block = environmentBlock({
    status: 'needs_input',
    attention: {
      kind: 'configuration_required',
      action: 'configure_provider',
      item: 'model provider',
      detail: 'Configure a provider before retrying.',
    },
  })
  assert.deepEqual(block, {
    kind: 'configuration_required',
    action: 'configure_provider',
    item: 'model provider',
    detail: 'Configure a provider before retrying.',
  })
  assert.equal(environmentBlock({
    status: 'needs_input',
    attention: { kind: 'capability_unavailable', item: 'generate_image', detail: 'Enable the capability.' },
  }).kind, 'capability_unavailable')
  const blockedLifecycle = lifecycleCheck({ lifecycle: 'create' }, {
    status: 'needs_input',
    attention: { kind: 'capability_unavailable', item: 'generate_image' },
    events: [],
  }, {})
  assert.equal(blockedLifecycle.passed, false)
  assert.equal(blockedLifecycle.blocked, true)
  assert.equal(blockedLifecycle.blockedReason.kind, 'capability_unavailable')

  const result = toAgentEvalResults({
    suite: 'TEST',
    generatedAt: '2026-01-01T00:00:00.000Z',
    tasks: [{
      expertId: 'image-producer',
      taskId: 'blocked',
      evalId: 'A',
      scenario: 'normal',
      status: 'needs_input',
      assertions: ['x'],
      configuration: { configurationId: '' },
      lifecycleEvidence: { passed: false },
      environmentBlock: block,
    }],
  })
  const task = result.agents[0].tasks[0]
  assert.equal(task.status, 'blocked')
  assert.equal(task.hardFailure, false)
  assert.equal(task.blockedReason.kind, 'configuration_required')
  assert.match(task.summary, /Environment configuration blocked/)
})

test('secure-storage setup failure becomes explicit environment-blocked evidence', () => {
  const block = qualificationEnvironmentBlock('当前安全存储不可用，未保存任何明文密钥', {
    item: 'connector:pango-image-mcp secrets',
  })
  assert.deepEqual(block, {
    kind: 'configuration_required',
    code: 'secure_storage_unavailable',
    action: 'enable_secure_storage',
    item: 'connector:pango-image-mcp secrets',
    detail: '当前安全存储不可用，未保存任何明文密钥 未绕过安全存储，也未保存明文密钥；请在支持系统安全存储的环境中重试。',
  })

  const row = blockedQualificationRow({
    id: 'IP01',
    expertId: 'image-producer',
    title: '真实生成',
    scenario: 'normal',
    lifecycle: 'create',
    assertions: ['真实图片'],
  }, block, block.detail)
  assert.equal(row.status, 'needs_input')
  assert.equal(row.environmentBlock.action, 'enable_secure_storage')
  assert.equal(row.lifecycleEvidence.blocked, true)
  assert.equal(toAgentEvalResults({ tasks: [row] }).agents[0].tasks[0].status, 'blocked')
  assert.equal(toAgentEvalResults({ tasks: [row] }).agents[0].tasks[0].hardFailure, false)
})
