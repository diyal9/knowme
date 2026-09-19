'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  safeCreateAuditSnapshot,
  createAuditSnapshotRoot,
  collectRequiredDependencies,
  collectConditionalRouteRequirements,
  collectVerifiedRouteEvidence,
  collectHistoricalTaskEvidence,
  collectHistoricalRunEvidence,
  collectQualificationReadiness,
  hasIndependentProfessionalReview,
  buildExpertReadinessMatrix,
  readQualificationReport,
  buildProductionSummary,
  createRuntime,
  parseArgs,
} = require('../scripts/audit-production-capabilities.js')

test('production capability audit defaults snapshots outside KnowMe user data', () => {
  const root = createAuditSnapshotRoot()
  assert.match(root, /knowme-production-audit-/)
  assert.notEqual(root, path.join(process.env.APPDATA || '', 'KnowMe'))
})

test('read-only production audit runtime does not install default packs', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-audit-read-only-'))
  createRuntime(userData, path.resolve(__dirname, '..', 'src', 'catalog'), '', { ensureDefaults: false })
  assert.equal(fs.existsSync(path.join(userData, 'capabilities', 'install-store.json')), false)
})

test('production capability audit accepts an isolated snapshot root without changing defaults', () => {
  assert.deepEqual(parseArgs([
    'node',
    'audit-production-capabilities.js',
    '--user-data',
    'C:\\KnowMe-data',
    '--snapshot-root',
    'C:\\KnowMe-audit-snapshots',
    '--strict',
    '--probe-connectors',
  ]), {
    userData: 'C:\\KnowMe-data',
    snapshotRoot: 'C:\\KnowMe-audit-snapshots',
    qualificationReport: '',
    apply: false,
    strict: true,
    probeConnectors: true,
  })
})

test('production capability audit requires an explicit complete qualification gate', () => {
  const productionExpertIds = new Set(['product-manager', 'image-producer'])
  const missing = collectQualificationReadiness(null, productionExpertIds)
  assert.equal(missing.complete, false)
  assert.equal(missing.status, 'not_provided')
  assert.deepEqual(missing.missingExpertIds, ['image-producer', 'product-manager'])

  const summary = buildProductionSummary({
    skills: [],
    connectors: [],
    experts: [],
    routes: [],
    taskCatalog: { issues: [] },
    qualification: missing,
  }, collectRequiredDependencies([]))
  assert.equal(summary.executionReady, true)
  assert.equal(summary.productionReady, false)
  assert.equal(summary.qualificationGatePassed, false)
})

test('production capability audit only accepts current, independently reviewed complete expert suites', () => {
  const report = {
    schemaVersion: 2,
    tasks: [
      { expertId: 'image-producer', scenario: 'normal', lifecycle: 'create', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
      { expertId: 'image-producer', scenario: 'normal', lifecycle: 'create', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
      { expertId: 'image-producer', scenario: 'edge', lifecycle: 'create', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
      { expertId: 'image-producer', scenario: 'retry', lifecycle: 'cancel_then_retry', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
      { expertId: 'image-producer', scenario: 'revision', lifecycle: 'request_changes', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
      { expertId: 'image-producer', scenario: 'reopen', lifecycle: 'accept_then_reopen', lifecycleEvidence: { passed: true }, semanticReview: 'passed', hardAssertionsPassed: true, certificationEligible: true, configuration: { qualificationContext: { agent: { id: 'image-producer', version: '4.0.0', hash: 'fixture-hash' } } } },
    ],
  }
  const ready = collectQualificationReadiness(
    {
      ...report,
      tasks: report.tasks.map(task => ({
        ...task,
        professionalReview: {
          reviewer: { kind: 'model', id: 'independent-reviewer', independent: true },
          pass: true,
          userRequirements: { pass: true },
          checks: [{ pass: true, evidence: 'assistant output section', evidenceAnchor: 'assistant_message' }],
        },
      })),
    },
    new Set(['image-producer']),
    new Map([['image-producer', { version: '4.0.0', hash: '' }]]),
  )
  assert.equal(ready.complete, true)
  assert.deepEqual(ready.qualifiedExpertIds, ['image-producer'])
  assert.equal(ready.experts[0].state, 'qualified')
})

test('production qualification never trusts a passed flag without independent review evidence', () => {
  assert.equal(hasIndependentProfessionalReview({
    semanticReview: 'passed',
    professionalReview: { reviewer: { kind: 'model', id: 'reviewer', independent: true }, pass: true, userRequirements: { pass: true }, checks: [{ pass: true, evidence: 'x', evidenceAnchor: 'assistant_message' }] },
  }), true)
  assert.equal(hasIndependentProfessionalReview({
    semanticReview: 'passed',
    hardAssertionsPassed: true,
    certificationEligible: true,
  }), false)
})

test('qualification audit can merge per-expert reports and rejects duplicate evaluations', () => {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-reports-'))
  try {
    fs.writeFileSync(path.join(reportDir, 'image-producer.json'), JSON.stringify({
      generatedAt: '2026-09-09T10:00:00.000Z',
      tasks: [{ evalId: 'image-1', expertId: 'image-producer' }],
    }))
    fs.writeFileSync(path.join(reportDir, 'product-manager.json'), JSON.stringify({
      generatedAt: '2026-09-09T11:00:00.000Z',
      tasks: [{ evalId: 'product-1', expertId: 'product-manager' }],
    }))

    const merged = readQualificationReport(reportDir)
    assert.equal(merged.error, '')
    assert.equal(merged.report.suite, 'merged-qualification-reports')
    assert.equal(merged.report.generatedAt, '2026-09-09T11:00:00.000Z')
    assert.deepEqual(merged.report.tasks.map(task => task.evalId), ['image-1', 'product-1'])

    fs.writeFileSync(path.join(reportDir, 'duplicate.json'), JSON.stringify({
      tasks: [{ evalId: 'image-1', expertId: 'image-producer' }],
    }))
    const duplicate = readQualificationReport(reportDir)
    assert.equal(duplicate.report, null)
    assert.match(duplicate.error, /重复 evalId：image-1/)
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true })
  }
})

test('production capability audit keeps snapshot permission failures observable', () => {
  const result = safeCreateAuditSnapshot(
    {
      createSessionSnapshot() {
        throw new Error('EPERM: operation not permitted, mkdir')
      },
    },
    { ok: true },
    { id: 'office-partner' },
    'audit-office-partner',
  )

  assert.equal(result.snapshot.ok, false)
  assert.equal(result.snapshot.code, 'snapshot_failed')
  assert.match(result.snapshot.message, /EPERM/)
  assert.deepEqual(result.snapshot.issues, [
    {
      code: 'snapshot_failed',
      message: 'EPERM: operation not permitted, mkdir',
    },
  ])
})

test('production capability audit does not create a snapshot for an unloaded expert', () => {
  let called = false
  const result = safeCreateAuditSnapshot(
    {
      createSessionSnapshot() {
        called = true
        return { ok: true }
      },
    },
    { ok: false, code: 'load_failed' },
    { id: 'broken-expert' },
    'audit-broken-expert',
  )

  assert.equal(called, false)
  assert.deepEqual(result.snapshot, { ok: false, code: 'load_failed' })
  assert.equal(result.snapshotError, '')
})

test('production capability audit treats optional dependencies as non-blocking', () => {
  const required = collectRequiredDependencies([
    {
      id: 'image-producer',
      dependencies: [
        { id: 'visual-brief-prompt', kind: 'skill', required: true },
        { id: 'photoshop-mcp', kind: 'connector', required: false },
      ],
    },
  ])
  const summary = buildProductionSummary({
    skills: [
      { id: 'visual-brief-prompt', installed: true, enabled: true, required: true },
    ],
    connectors: [
      { id: 'photoshop-mcp', installed: false, enabled: false, required: false },
    ],
    experts: [],
    taskCatalog: { issues: [] },
  }, required)

  assert.equal(summary.packageReady, true)
  assert.equal(summary.productionReady, false)
  assert.equal(summary.qualificationGatePassed, false)
  assert.deepEqual(summary.requiredSkills, ['visual-brief-prompt'])
  assert.deepEqual(summary.requiredConnectors, [])
  assert.deepEqual(summary.unavailableSkills, [])
  assert.deepEqual(summary.unavailableConnectors, [])
  assert.deepEqual(summary.optionalUnavailableConnectors, ['photoshop-mcp'])
})

test('production capability audit blocks a missing required connector', () => {
  const required = collectRequiredDependencies([
    {
      id: 'image-producer',
      dependencies: [{ id: 'pango-image-mcp', kind: 'connector', required: true }],
    },
  ])
  const summary = buildProductionSummary({
    skills: [],
    connectors: [
      { id: 'pango-image-mcp', installed: false, enabled: false, required: true },
    ],
    experts: [],
    taskCatalog: { issues: [] },
  }, required)

  assert.equal(summary.productionReady, false)
  assert.deepEqual(summary.unavailableConnectors, ['pango-image-mcp'])
})

test('production capability audit records conditional route tools without treating declarations as receipts', () => {
  const routes = collectConditionalRouteRequirements([
    {
      id: 'research-analyst',
      kind: 'expert',
      manifest: {
        metadata: {
          knowme: {
            execution: {
              routes: [
                { id: 'provided-material', requiredTools: [] },
                { id: 'public-web-research', requiredTools: ['search_web', 'fetch_web_page'], requiredSkills: ['research-synthesis-method'] },
              ],
            },
          },
        },
      },
    },
  ])

  assert.deepEqual(routes, [{
    expertId: 'research-analyst',
    routeId: 'public-web-research',
    requiredTools: ['search_web', 'fetch_web_page'],
    requiredSkills: ['research-synthesis-method'],
    readiness: 'task-runtime-probe-required',
    note: '工具是否进入最终执行面，必须在对应任务路由中实时确认；静态能力审计不把声明当成回执。',
  }])
})

test('production capability audit includes a route skillId in its readiness contract', () => {
  const routes = collectConditionalRouteRequirements([{
    id: 'office-partner',
    kind: 'expert',
    manifest: {
      metadata: {
        knowme: {
          execution: {
            routes: [{
              id: 'today-priority',
              skillId: 'feishu-today-priority',
              requiredTools: ['feishu.today_priority'],
            }],
          },
        },
      },
    },
  }])

  assert.deepEqual(routes[0].requiredSkills, ['feishu-today-priority'])
})

test('production capability audit includes a route connectorId in its readiness contract', () => {
  const routes = collectConditionalRouteRequirements([{
    id: 'office-partner',
    kind: 'expert',
    manifest: {
      metadata: {
        knowme: {
          execution: {
            routes: [{
              id: 'today-priority',
              skillId: 'feishu-today-priority',
              connectorId: 'feishu',
              requiredTools: ['feishu.today_priority'],
            }],
          },
        },
      },
    },
  }])

  assert.deepEqual(routes[0].requiredConnectorIds, ['feishu'])
})

test('production capability audit keeps static package readiness separate from live route readiness', () => {
  const required = collectRequiredDependencies([])
  const summary = buildProductionSummary({
    skills: [],
    connectors: [],
    experts: [],
    routes: [{
      expertId: 'research-analyst',
      routeId: 'public-web-research',
      requiredTools: ['search_web', 'fetch_web_page'],
      requiredSkills: ['research-synthesis-method'],
      requiredSkillsReady: true,
      readiness: 'task-runtime-probe-required',
    }],
    taskCatalog: { issues: [] },
  }, required)

  assert.equal(summary.packageReady, true)
  assert.equal(summary.executionReady, false)
  assert.equal(summary.productionReady, false)
  assert.deepEqual(summary.unverifiedConditionalRoutes.map(route => route.routeId), ['public-web-research'])
})

test('production capability audit reports missing skills for selected conditional routes', () => {
  const summary = buildProductionSummary({
    skills: [{ id: 'research-synthesis-method', installed: false, enabled: false, groundingOk: false }],
    connectors: [],
    experts: [],
    routes: [{
      expertId: 'research-analyst',
      routeId: 'public-web-research',
      requiredSkills: ['research-synthesis-method'],
      requiredSkillsReady: false,
      readiness: 'task-runtime-probe-required',
    }],
    taskCatalog: { issues: [] },
  }, collectRequiredDependencies([]))

  assert.deepEqual(summary.unavailableSkills, [])
  assert.deepEqual(summary.conditionalUnavailableSkills, [{
    id: 'research-synthesis-method',
    routes: ['research-analyst:public-web-research'],
  }])
})

test('production capability audit reports missing connectors for selected conditional routes', () => {
  const summary = buildProductionSummary({
    skills: [],
    connectors: [],
    experts: [],
    routes: [{
      expertId: 'office-partner',
      routeId: 'today-priority',
      requiredTools: ['feishu.today_priority'],
      requiredSkills: ['feishu-today-priority'],
      requiredConnectorIds: ['feishu'],
      requiredSkillsReady: true,
      requiredConnectorsReady: false,
      readiness: 'task-runtime-probe-required',
    }],
    taskCatalog: { issues: [] },
  }, collectRequiredDependencies([]))

  assert.deepEqual(summary.conditionalUnavailableConnectors, [{
    id: 'feishu',
    routes: ['office-partner:today-priority'],
  }])
  assert.equal(summary.executionReady, false)
})

test('production capability audit reports probed unhealthy connectors without changing static package readiness', () => {
  const summary = buildProductionSummary({
    skills: [],
    connectors: [{
      id: 'pango-image-mcp',
      installed: true,
      enabled: true,
      operational: false,
      liveProbe: { attempted: true, operational: false, state: 'offline' },
    }],
    experts: [],
    routes: [],
    taskCatalog: { issues: [] },
  }, collectRequiredDependencies([]))

  assert.equal(summary.packageReady, true)
  assert.deepEqual(summary.unhealthyConnectors, ['pango-image-mcp'])
  assert.equal(summary.connectorHealthProbed, true)
})

test('production capability audit distinguishes historical connector evidence from an inconclusive sandbox probe', () => {
  const summary = buildProductionSummary({
    skills: [],
    connectors: [{
      id: 'feishu',
      installed: true,
      enabled: true,
      operational: false,
      liveProbe: { attempted: true, operational: false, state: 'auth_required' },
    }],
    historicalRunEvidence: [{
      connectorId: 'feishu',
      successfulRunCount: 2,
      runIds: ['run-old-1', 'run-old-2'],
      latestAt: '2026-09-09T06:27:23.176Z',
      evidenceKind: 'completed_run_tool_surface',
    }],
    experts: [],
    routes: [],
    taskCatalog: { issues: [] },
  }, collectRequiredDependencies([]))

  assert.deepEqual(summary.unhealthyConnectors, [])
  assert.deepEqual(summary.connectorHealthInconclusive, [{
    id: 'feishu',
    state: 'auth_required',
    reason: '当前进程无法读取或复现连接器状态，但历史完成运行曾加载过该连接器工具面；需要在正常 KnowMe 运行环境重新验证。',
    historicalEvidence: {
      evidenceKind: 'completed_run_tool_surface',
      successfulRunCount: 2,
      successfulToolCallCount: 0,
      failedToolCallCount: 0,
      runIds: ['run-old-1', 'run-old-2'],
      runIdsWithSuccessfulCalls: [],
      successfulToolNames: [],
      failedToolNames: [],
    },
  }])
  assert.equal(summary.productionReady, false)
  assert.equal(summary.executionReady, false)
})

test('production capability audit does not report ready conditional skills as missing', () => {
  const summary = buildProductionSummary({
    skills: [{ id: 'research-synthesis-method', installed: true, enabled: true, groundingOk: true }],
    connectors: [],
    experts: [],
    routes: [{
      expertId: 'research-analyst',
      routeId: 'public-web-research',
      requiredSkills: ['research-synthesis-method'],
      requiredSkillsReady: true,
      readiness: 'verified',
    }],
    taskCatalog: { issues: [] },
  }, collectRequiredDependencies([]))

  assert.deepEqual(summary.conditionalUnavailableSkills, [])
})

test('production capability audit includes tool contracts declared on deliverables', () => {
  const routes = collectConditionalRouteRequirements([{
    id: 'image-producer',
    kind: 'expert',
    manifest: {
      metadata: {
        knowme: {
          execution: {
            deliverables: [{
              id: 'generated-image',
              executionRoute: 'pango-generate',
              requiredTools: ['generate_image'],
              requiredSkills: ['th-art-pango-generate'],
            }],
          },
        },
      },
    },
  }])

  assert.deepEqual(routes, [{
    expertId: 'image-producer',
    routeId: 'pango-generate',
    requiredTools: ['generate_image'],
    requiredSkills: ['th-art-pango-generate'],
    readiness: 'task-runtime-probe-required',
    note: '工具是否进入最终执行面，必须在对应任务路由中实时确认；静态能力审计不把声明当成回执。',
  }])
})

test('production capability audit carries deliverable connector requirements into the route contract', () => {
  const routes = collectConditionalRouteRequirements([{
    id: 'image-producer',
    kind: 'expert',
    manifest: {
      metadata: {
        knowme: {
          execution: {
            deliverables: [{
              id: 'generated-image',
              executionRoute: 'pango-generate',
              requiredTools: ['generate_image'],
              requiredSkills: ['th-art-pango-generate'],
              requiredConnectorIds: ['pango-image-mcp'],
            }],
          },
        },
      },
    },
  }])

  assert.deepEqual(routes[0].requiredConnectorIds, ['pango-image-mcp'])
})

test('production capability audit promotes a route only from persisted verified execution evidence', () => {
  const routes = [{
    expertId: 'image-producer',
    routeId: 'pango-generate',
    requiredTools: ['generate_image'],
    requiredSkills: ['th-art-pango-generate'],
  }]
  const evidence = collectVerifiedRouteEvidence([{
    kind: 'expert',
    expertId: 'image-producer',
    executionEvidence: [{
      runId: 'run-1',
      executionRoute: 'pango-generate',
      gateStatus: 'verified',
      verificationPassed: true,
      qualificationContext: {
        complete: true,
        agent: { version: '4.0.0', hash: 'agent-hash' },
        skills: [{ id: 'th-art-pango-generate' }],
      },
      toolCalls: [{ name: 'generate_image', status: 'ok' }],
      violations: [],
    }],
  }], routes, new Map([
    ['image-producer', { version: '4.0.0', hash: 'agent-hash' }],
  ]))

  assert.deepEqual(evidence.get('image-producer:pango-generate'), {
    evidenceCount: 1,
    runIds: ['run-1'],
  })
})

test('production capability audit rejects verified evidence from an old expert version', () => {
  const evidence = collectVerifiedRouteEvidence([{
    kind: 'expert',
    expertId: 'image-producer',
    executionEvidence: [{
      runId: 'old-run',
      executionRoute: 'pango-generate',
      gateStatus: 'verified',
      verificationPassed: true,
      qualificationContext: {
        complete: true,
        agent: { version: '3.0.0', hash: 'old-hash' },
        skills: [{ id: 'th-art-pango-generate' }],
      },
      toolCalls: [{ name: 'generate_image', status: 'ok' }],
      violations: [],
    }],
  }], [{
    expertId: 'image-producer',
    routeId: 'pango-generate',
    requiredTools: ['generate_image'],
    requiredSkills: ['th-art-pango-generate'],
  }], new Map([
    ['image-producer', { version: '4.0.0', hash: 'new-hash' }],
  ]))

  assert.equal(evidence.has('image-producer:pango-generate'), false)
})

test('production capability audit ignores blocked, incomplete, and partial route evidence', () => {
  const routes = [{
    expertId: 'research-analyst',
    routeId: 'public-web-research',
    requiredTools: ['search_web', 'fetch_web_page'],
    requiredSkills: ['research-synthesis-method'],
  }]
  const evidence = collectVerifiedRouteEvidence([{
    kind: 'expert',
    expertId: 'research-analyst',
    executionEvidence: [{
      runId: 'blocked',
      executionRoute: 'public-web-research',
      gateStatus: 'blocked',
      verificationPassed: false,
      qualificationContext: { complete: true, skills: [{ id: 'research-synthesis-method' }] },
      toolCalls: [{ name: 'search_web', status: 'ok' }, { name: 'fetch_web_page', status: 'ok' }],
    }, {
      runId: 'partial',
      executionRoute: 'public-web-research',
      gateStatus: 'verified',
      verificationPassed: true,
      qualificationContext: { complete: true, skills: [{ id: 'research-synthesis-method' }] },
      toolCalls: [{ name: 'search_web', status: 'ok' }],
    }, {
      runId: 'incomplete',
      executionRoute: 'public-web-research',
      gateStatus: 'verified',
      verificationPassed: true,
      qualificationContext: { complete: false, skills: [{ id: 'research-synthesis-method' }] },
      toolCalls: [{ name: 'search_web', status: 'ok' }, { name: 'fetch_web_page', status: 'ok' }],
    }],
  }], routes)

  assert.equal(evidence.has('research-analyst:public-web-research'), false)
})

test('production capability audit exposes accepted historical artifacts without promoting stale versions', () => {
  const history = collectHistoricalTaskEvidence([{
    kind: 'expert',
    id: 'task-image-1',
    expertId: 'image-producer',
    updatedAt: '2026-09-05T10:21:23.045Z',
    assignmentSnapshot: {
      agentVersion: '3.2.0',
      agentHash: 'old-hash',
    },
    deliverables: [{
      deliverableId: 'generated-image',
      evidenceStatus: 'verified',
      acceptanceStatus: 'accepted',
      artifactRef: 'artifact:image-1',
      executionRef: 'agent-run:run-image-1',
    }],
  }], new Map([
    ['image-producer', { version: '4.0.0', hash: 'new-hash' }],
  ]))

  assert.deepEqual(history, [{
    expertId: 'image-producer',
    acceptedDeliverableCount: 1,
    taskIds: ['task-image-1'],
    runIds: ['run-image-1'],
    latestAt: '2026-09-05T10:21:23.045Z',
    currentVersionEvidenceCount: 0,
    staleVersionEvidenceCount: 1,
  }])
})

test('production capability audit exposes completed historical connector tool surfaces separately', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-audit-run-history-'))
  const runRoot = path.join(userData, 'agent-runs', 'run-feishu-history')
  fs.mkdirSync(runRoot, { recursive: true })
  fs.writeFileSync(path.join(runRoot, 'events.jsonl'), [
    JSON.stringify({ type: 'run.started', payload: { status: 'running' } }),
    JSON.stringify({
      type: 'run.terminal',
      ts: '2026-09-09T06:27:23.176Z',
      payload: {
        terminal: 'completed',
        ok: true,
        report: { toolSurface: { loadedNames: ['feishu.meeting_candidates', 'load_skill'] } },
      },
    }),
  ].join('\n'))

  assert.deepEqual(collectHistoricalRunEvidence(userData), [{
    connectorId: 'feishu',
    successfulRunCount: 1,
    runIds: ['run-feishu-history'],
    latestAt: '2026-09-09T06:27:23.176Z',
    evidenceKind: 'completed_run_tool_surface',
    successfulToolCallCount: 0,
    failedToolCallCount: 0,
    successfulToolNames: [],
    failedToolNames: [],
    runIdsWithSuccessfulCalls: [],
  }])
})

test('production capability audit upgrades historical evidence when checkpoint calls succeeded', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-audit-run-call-history-'))
  const runRoot = path.join(userData, 'agent-runs', 'run-pango-history')
  fs.mkdirSync(path.join(runRoot, 'checkpoints'), { recursive: true })
  fs.writeFileSync(path.join(runRoot, 'events.jsonl'), JSON.stringify({
    type: 'run.terminal',
    ts: '2026-09-09T06:27:23.176Z',
    payload: {
      terminal: 'completed',
      ok: true,
      report: { toolSurface: { loadedNames: ['mcp_load_pango_image_mcp'] } },
    },
  }))
  fs.writeFileSync(path.join(runRoot, 'checkpoints', 'latest.json'), JSON.stringify({
    data: {
      toolLedger: {
        calls: [
          { name: 'list_paint_models', status: 'ok' },
          { name: 'generate_image', status: 'failed' },
          { name: 'generate_image', status: 'ok' },
        ],
      },
    },
  }))

  assert.deepEqual(collectHistoricalRunEvidence(userData), [{
    connectorId: 'pango-image-mcp',
    successfulRunCount: 1,
    runIds: ['run-pango-history'],
    latestAt: '2026-09-09T06:27:23.176Z',
    evidenceKind: 'completed_run_tool_calls',
    successfulToolCallCount: 2,
    failedToolCallCount: 1,
    successfulToolNames: ['generate_image', 'list_paint_models'],
    failedToolNames: ['generate_image'],
    runIdsWithSuccessfulCalls: ['run-pango-history'],
  }])
})

test('production capability audit explains readiness blockers per retained expert', () => {
  const matrix = buildExpertReadinessMatrix({
    experts: [
      { id: 'product-manager', installed: true, enabled: true, loadOk: true, snapshotOk: true, version: '2.5.0' },
      { id: 'office-partner', installed: true, enabled: true, loadOk: true, snapshotOk: true, version: '2.4.0' },
    ],
    routes: [{
      expertId: 'office-partner',
      routeId: 'today-priority',
      readiness: 'task-runtime-probe-required',
      requiredSkillsReady: true,
      requiredConnectorsReady: false,
      requiredConnectorIds: ['feishu'],
    }],
    connectors: [{
      id: 'feishu',
      installed: true,
      enabled: true,
      operational: false,
      liveProbe: { attempted: true, state: 'auth_required' },
    }],
    connectorHealthInconclusive: [{ id: 'feishu', state: 'auth_required' }],
    conditionalUnavailableSkills: [],
    qualification: {
      experts: [
        { expertId: 'product-manager', state: 'not_provided', qualified: false, sampleCount: 0, issues: ['qualification_report_missing'] },
        { expertId: 'office-partner', state: 'not_provided', qualified: false, sampleCount: 0, issues: ['qualification_report_missing'] },
      ],
    },
  }, ['office-partner', 'product-manager'])

  assert.deepEqual(matrix.map(item => [item.expertId, item.status]), [
    ['office-partner', 'environment_blocked'],
    ['product-manager', 'qualification_pending'],
  ])
  assert.deepEqual(matrix[0].routes.inconclusiveConnectors, [{ id: 'feishu', state: 'auth_required' }])
  assert.equal(matrix[0].blockers.some(item => item.code === 'route_execution_evidence_missing'), true)
  assert.equal(matrix[1].routes.total, 0)
  assert.equal(matrix[1].qualification.qualified, false)
})
