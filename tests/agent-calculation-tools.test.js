'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

function calculationModule() {
  return require('../src/lib/agent-calculation-tools')
}

async function calculate(...expressions) {
  return calculationModule().buildCalculationTools().handlers.calculate({
    calculations: expressions.map(expression => ({ expression })),
  })
}

for (const [expression, value] of [
  ['2+3*4', 14], ['(2+3)*4', 20], ['8/4/2', 1], ['10-3-2', 5],
  ['-2^2', -4], ['(-2)**2', 4], ['2^-3', 0.125], ['2**3**2', 512],
  ['2^3^2', 512], ['-2**-2', -0.25], ['--2 + +3', 5], ['2*-3', -6],
  ['.5 + 1. + 2.5e-1 + 1E+2', 101.75], ['sqrt(9)+abs(-2)', 5],
  ['min(3, max(2, 5), -1)', -1], ['0^0', 1],
]) {
  test(`calculate precedence and literals: ${expression}`, async () => {
    const result = await calculate(expression)
    assert.equal(result.ok, true)
    assert.deepEqual(result.meta.results, [{ expression, ok: true, value }])
    assert.deepEqual(JSON.parse(result.text).results, result.meta.results)
  })
}

test('recomputes a pooled two-proportion z statistic and weighted decomposition', async () => {
  const result = await calculate(
    '(120/1000-90/1000)/sqrt(((120+90)/(1000+1000))*(1-(120+90)/(1000+1000))*(1/1000+1/1000))',
    '(0.7*0.12+0.3*0.2)-(0.6*0.1+0.4*0.18)',
    '0.6*(0.12-0.1)+0.4*(0.2-0.18)',
    '(0.7-0.6)*0.12+(0.3-0.4)*0.2',
  )
  assert.equal(result.ok, true)
  const values = result.meta.results.map(row => row.value)
  assert.ok(Math.abs(values[0] - 2.1882658846227234) < 1e-12)
  assert.ok(Math.abs(values[1] - 0.012) < 1e-15)
  assert.ok(Math.abs(values[1] - values[2] - values[3]) < 1e-15)
})

test('documents binary64 rounding, safe integer boundary, subnormals and underflow', async () => {
  const result = await calculate('0.1+0.2', '9007199254740991', '9007199254740992+1', '5e-324', '1e-324')
  assert.equal(result.ok, true)
  assert.deepEqual(result.meta.results.map(row => row.value), [0.30000000000000004, Number.MAX_SAFE_INTEGER, 9007199254740992, Number.MIN_VALUE, 0])
  assert.match(result.meta.precision, /IEEE-754.*binary64/)
  assert.match(result.meta.precision, /9007199254740991/)
  assert.match(calculationModule().CALCULATE_TOOL.function.description, /round|precision/i)
})

test('preserves labels, raw expressions and successful siblings on partial failure', async () => {
  const args = { calculations: [
    { label: '原式', expression: ' 2 + 3 ' },
    { label: '坏式', expression: '1/0' },
    { expression: 'sqrt(16)' },
  ] }
  const before = JSON.stringify(args)
  const result = await calculationModule().buildCalculationTools().handlers.calculate(args)
  assert.equal(JSON.stringify(args), before)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'calculation_failed')
  assert.deepEqual(result.meta.results[0], { ...args.calculations[0], ok: true, value: 5 })
  assert.equal(result.meta.results[1].expression, '1/0')
  assert.equal(result.meta.results[1].code, 'division_by_zero')
  assert.equal(typeof result.meta.results[1].error, 'string')
  assert.equal(Object.hasOwn(result.meta.results[1], 'value'), false)
  assert.equal(result.meta.results[2].value, 4)
  assert.equal(JSON.parse(result.text).ok, false)
})

test('rejects malicious text, unsupported syntax and non-finite intermediates', async () => {
  const expressions = [
    'process.exit()', 'globalThis', 'Math.sqrt(4)', 'sqrt.constructor("return process")()',
    'require("fs")', 'fetch("https://example.com")', 'x=1', '1;2', '"2"', '`2`',
    '[]', '{}', '1/*x*/+2', '1//2', '2(3)', '2 3', '0x10', '1_000', 'NaN', 'Infinity',
    '1e309', '1e308*1e308/1e308', 'sqrt(-1)', '(-1)^.5', '0^-1', '1/(-0)', '0/0',
    '1e', '.', '1..2', 'sqrt()', 'sqrt(1,2)', 'min()', 'max(1,)', '(1+2', '1+2)', '1+',
  ]
  for (const expression of expressions) {
    const result = await calculate(expression)
    assert.equal(result.ok, false, expression)
    assert.equal(result.meta.results[0].ok, false, expression)
    assert.ok(result.meta.results[0].code, expression)
    assert.ok(result.meta.results[0].error, expression)
  }
})

test('enforces item count, expression/aggregate length, token and recursive budgets', async () => {
  const { CALCULATION_LIMITS: limits, buildCalculationTools } = calculationModule()
  const handler = buildCalculationTools().handlers.calculate
  assert.equal((await calculate(...Array(limits.maxCalculations).fill('1'))).ok, true)
  const tooMany = await calculate(...Array(limits.maxCalculations + 1).fill('1'))
  assert.equal(tooMany.code, 'batch_limit')
  assert.deepEqual(tooMany.meta.results, [])
  assert.equal((await calculate('1'.padEnd(limits.maxExpressionLength))).ok, true)
  assert.equal((await calculate('1'.padEnd(limits.maxExpressionLength + 1))).meta.results[0].code, 'expression_too_long')
  const total = await calculate(...Array(limits.maxCalculations).fill('1'.padEnd(limits.maxExpressionLength)))
  assert.equal(total.code, 'batch_limit')
  assert.deepEqual(total.meta.results, [])
  assert.equal((await calculate(Array(129).fill('1').join('+'))).meta.results[0].code, 'token_limit')
  assert.equal((await calculate(Array(128).fill('1').join('+'))).meta.results[0].value, 128)
  for (const expression of [
    '('.repeat(limits.maxDepth + 1) + '1' + ')'.repeat(limits.maxDepth + 1),
    '-'.repeat(limits.maxDepth + 1) + '1',
    Array(limits.maxDepth + 3).fill('1').join('^'),
    'sqrt('.repeat(limits.maxDepth + 1) + '1' + ')'.repeat(limits.maxDepth + 1),
  ]) assert.equal((await calculate(expression)).meta.results[0].code, 'depth_limit')
  assert.equal((await calculate('('.repeat(limits.maxDepth) + '1' + ')'.repeat(limits.maxDepth))).ok, true)
  assert.equal((await handler({ calculations: [{ label: 'a'.repeat(limits.maxLabelLength + 1), expression: '1' }] })).ok, false)
})

test('validates raw handler inputs without coercion and reports per-item errors', async () => {
  const handler = calculationModule().buildCalculationTools().handlers.calculate
  for (const args of [undefined, null, {}, [], { calculations: [] }, { calculations: '1+2' }]) {
    assert.equal((await handler(args)).ok, false)
  }
  const result = await handler({ calculations: [null, {}, { expression: 2 }, { expression: '' }, { expression: '3' }] })
  assert.equal(result.ok, false)
  assert.deepEqual(result.meta.results.map(row => row.ok), [false, false, false, false, true])
})

test('calculation implementation contains no code execution or I/O dependencies', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/agent-calculation-tools.ts'), 'utf8')
  assert.doesNotMatch(source, /\b(?:eval|Function|require|import)\s*\(|\b(?:process|globalThis|fetch|XMLHttpRequest)\b/)
})

// Load the actual production entry with only environment-bound services stubbed.
// Registry, policy, bundle merge, projection, argument parsing and executor stay real.
async function buildProductionSurface({ mode = 'v1', tier = 'assist', expertId, conversationMode = '', sessionPolicy, permissions = {}, requiredTools = [], importHub = {} } = {}) {
  const agentTools = require('../src/lib/agent-tools')
  const builder = require('../src/lib/tool-surface-builder')
  const contextEngine = require('../src/lib/context-engine/policy')
  const emptyBundle = () => null
  const libs = {
    app: { getPath: () => __dirname }, path, agentTools, contextEngine,
    isToolSurfaceV1: builder.isToolSurfaceV1,
    resolveToolSurfaceForRun: builder.resolveToolSurfaceForRun,
    mergeExtraTools: require('../src/lib/merge-extra-tools').mergeExtraTools,
    agentSandbox: { normalizeSandboxPermissions: () => ({}) },
    agentPlanTools: { buildPlanTools: emptyBundle }, agentWebTools: { buildWebTools: emptyBundle },
    agentArtifactTools: { buildArtifactTools: emptyBundle }, agentImageTools: {},
    agentCapabilityImportTools: require('../src/lib/agent-capability-import-tools'),
    getSessionCapabilityBindings: () => ({ allowedConnectorIds: [] }),
    researchRouting: { classifyResearchIntent: () => ({}), buildResearchRoute: () => ({ active: false }) },
    feishuGrounding: { detectFeishuIntent: () => ({}) }, logger: { systemPrompt: () => {} },
    connectorToolRuntime: { buildConnectorToolSurface: async (_root, opts) => ({
      surface: agentTools.createToolSurface({ extraDefinitions: opts.extraTools?.definitions, handlers: opts.extraTools?.handlers }),
      close: async () => {},
    }) },
  }
  const libsId = require.resolve('../src/lib/agent-generate-libs')
  const surfaceId = require.resolve('../src/lib/agent-generate-tool-surface')
  const savedLibs = require.cache[libsId]
  const savedSurface = require.cache[surfaceId]
  const savedMode = process.env.KNOWME_TOOL_SURFACE
  process.env.KNOWME_TOOL_SURFACE = mode
  require.cache[libsId] = { id: libsId, filename: libsId, loaded: true, exports: libs }
  delete require.cache[surfaceId]
  try {
    const { buildRunToolSurface } = require(surfaceId)
    return await buildRunToolSurface({
      deps: {
        ensureCapabilityHub: () => ({ ...importHub, expertRuntime: () => ({ getSessionPersona: () => ({ ok: true }) }), buildSkillToolsForSession: emptyBundle }),
        ensureAgentTeamRuntime: () => ({ enabled: false, manager: { adoptRunningRun() {} }, store: { writeReceipt() { assert.fail('math must not write receipts') } } }),
        getActiveSourceRoot: () => null, buildActiveSourceFileTools: emptyBundle,
      },
      payload: { permissions }, runId: `calculate-${mode}-${tier}`, metrics: {},
      fail: error => ({ error }),
    }, {
      session: { id: 'calculate-session', expertId, executionPolicy: sessionPolicy, run: {} },
      s: { agentScriptsEnabled: false }, slashRefs: [], tier, prompt: '计算数值',
      groundingTaskFrame: requiredTools.length ? { requiredTools } : null,
      executionPolicy: contextEngine.resolveExecutionPolicy({ conversationMode, toolsEnabled: true }),
      apiMessages: [],
    })
  } finally {
    if (savedLibs) require.cache[libsId] = savedLibs
    else delete require.cache[libsId]
    if (savedSurface) require.cache[surfaceId] = savedSurface
    else delete require.cache[surfaceId]
    if (savedMode === undefined) delete process.env.KNOWME_TOOL_SURFACE
    else process.env.KNOWME_TOOL_SURFACE = savedMode
  }
}

test('RQA04 declared import builtin is projected and executable for an arbitrary expert, with ACL intact', async () => {
  let previews = 0
  const run = await buildProductionSurface({
    expertId: 'custom-import-fixture', requiredTools: ['preview_external_project'],
    permissions: { tools: { allowlist: ['preview_external_project'] } },
    importHub: { scanCursorRepositoryForHub: async () => { previews += 1; return { ok: true, previewToken: 'fixture-token' } } },
  })
  try {
    assert.equal(run.early, undefined)
    assert.equal(run.toolSurface.isAllowedTool('preview_external_project'), true)
    assert.equal(run.toolSurface.isAllowedTool('import_external_project'), false)
    const result = await run.toolExecutor.executeToolCall({ name: 'preview_external_project', arguments: '{"path":"fixture-only"}' })
    assert.equal(result.ok, true)
    assert.equal(previews, 1)
  } finally { await run.connectorRuntime.close() }
  const denied = await buildProductionSurface({
    expertId: 'custom-import-fixture', requiredTools: ['preview_external_project'], permissions: { tools: { allowlist: [] } },
  })
  assert.match(denied.early.error, /preview_external_project/)
  assert.equal(previews, 1)
})

for (const mode of ['v1', 'legacy']) {
  test(`production ${mode} surface registers and executes calculate for generic and arbitrary agents`, async () => {
    for (const expertId of [undefined, 'custom-expert-any-id']) {
      const run = await buildProductionSurface({ mode, expertId })
      try {
        assert.equal(run.early, undefined)
        assert.equal(run.toolSurface.getToolDefinitions().filter(def => def.function.name === 'calculate').length, 1)
        const record = run.toolSurface.getToolRecords().find(def => def.function.name === 'calculate')
        assert.equal(record._knowme.source, 'builtin')
        assert.equal(record._knowme.capability, 'math')
        assert.equal(record._knowme.risk, 'read')
        assert.equal(record._knowme.sideEffects, false)
        assert.equal(record._knowme.requiresApproval, false)
        if (mode === 'v1') assert.deepEqual(run.resolvedSurface.registry.getRegistrationIssues(), [])
        const result = await run.toolExecutor.executeToolCall({ function: {
          name: 'calculate', arguments: JSON.stringify({ calculations: [{ expression: '2+sqrt(9)' }, { expression: '1/0' }] }),
        } })
        assert.equal(result.ok, false)
        assert.equal(result.code, 'calculation_failed')
        assert.equal(result.meta.results[0].value, 5)
        assert.equal(result.meta.results[1].code, 'division_by_zero')
        assert.deepEqual(JSON.parse(result.text).results, result.meta.results)
        assert.equal(result.requiresApproval, false)
        assert.deepEqual(result.artifactRefs, [])
        const fixed = await run.toolExecutor.executeToolCall({ name: 'calculate', arguments: '{"calculations":[{"expression":"1/2"}]}' })
        assert.equal(fixed.ok, true)
        assert.equal(fixed.meta.results[0].value, 0.5)
      } finally { await run.connectorRuntime.close() }
    }
  })
}

test('minimal tools-enabled chat surface can calculate', async () => {
  const run = await buildProductionSurface({ tier: 'chat' })
  try {
    assert.equal(run.resolvedSurface.mode, 'minimal')
    assert.equal(run.toolSurface.isAllowedTool('calculate'), true)
    const result = await run.toolExecutor.executeToolCall({ name: 'calculate', arguments: '{"calculations":[{"expression":"6*7"}]}' })
    assert.equal(result.meta.results[0].value, 42)
  } finally { await run.connectorRuntime.close() }
})

test('production executor reproduces mainline registration and D7 pooled z baselines', async () => {
  const calculations = [
    { label: 'registration pooled z (B-A)', expression: '(1200/10000-800/10000)/sqrt(((800+1200)/(10000+10000))*(1-(800+1200)/(10000+10000))*(1/10000+1/10000))' },
    { label: 'D7 pooled z (B-A, visitor denominator)', expression: '(720/10000-400/10000)/sqrt(((400+720)/(10000+10000))*(1-(400+720)/(10000+10000))*(1/10000+1/10000))' },
  ]
  const run = await buildProductionSurface()
  try {
    const result = await run.toolExecutor.executeToolCall({ name: 'calculate', arguments: JSON.stringify({ calculations }) })
    assert.equal(result.ok, true)
    for (const [index, expected] of [9.42809041582063, 9.841356626102455].entries()) {
      assert.ok(Math.abs(result.meta.results[index].value - expected) < 1e-12)
      assert.equal(result.meta.results[index].expression, calculations[index].expression)
      assert.equal(result.meta.results[index].label, calculations[index].label)
    }
  } finally { await run.connectorRuntime.close() }
})

test('planning, discussion and session no-tools policy never expose or execute calculate', async () => {
  for (const opts of [{ conversationMode: 'expert-planning' }, { conversationMode: 'expert-discussion' }, { sessionPolicy: 'no-tools' }]) {
    const run = await buildProductionSurface(opts)
    try {
      assert.equal(run.noTools, true)
      assert.equal(run.toolSurface.isAllowedTool('calculate'), false)
      assert.equal(run.toolSurface.getToolDefinitions().length, 0)
      const result = await run.toolExecutor.executeToolCall({ name: 'calculate', arguments: '{"calculations":[{"expression":"1"}]}' })
      assert.equal(result.ok, false)
    } finally { await run.connectorRuntime.close() }
  }
})

test('calculate respects explicit run tool restrictions in the real registry', async () => {
  const run = await buildProductionSurface({ permissions: { tools: { denylist: ['calculate'] } } })
  try {
    assert.equal(run.toolSurface.isAllowedTool('calculate'), false)
    const result = await run.toolExecutor.executeToolCall({ name: 'calculate', arguments: '{"calculations":[{"expression":"1"}]}' })
    assert.equal(result.ok, false)
  } finally { await run.connectorRuntime.close() }
})

// Build the real three-skill business snapshot without touching catalog/user data.
// Only snapshot persistence is in memory; expert loading/normalization stays real.
function businessCalculationSnapshot() {
  const memory = new Map()
  const fsImpl = {
    ...fs,
    existsSync: file => memory.has(file) || fs.existsSync(file),
    readFileSync: (file, encoding) => memory.has(file) ? memory.get(file) : fs.readFileSync(file, encoding),
    mkdirSync() {},
    writeFileSync: (file, content) => memory.set(file, content),
    renameSync: (from, to) => { memory.set(to, memory.get(from)); memory.delete(from) },
  }
  const runtime = require('../src/lib/expert-runtime').createExpertRuntime({
    capabilitiesRoot: path.resolve(__dirname, '../src/catalog'), fsImpl,
  })
  const created = runtime.createSessionSnapshot('calculate-permission-repro', 'data-analyst')
  assert.equal(created.ok, true)
  const snapshot = runtime.getSessionPersona('calculate-permission-repro', 'data-analyst')
  assert.equal(snapshot.source, 'snapshot')
  assert.deepEqual(snapshot.bindings.skills, [
    'data-analysis-method', 'business-metrics-analysis', 'business-cause-analysis',
    'business-insight-report', 'data-report-method', 'writing-polish',
  ])
  assert.deepEqual(snapshot.bindings.connectors, [])
  return snapshot
}

test('canonical business package grants calculate through snapshot permissions without test overrides', async () => {
  const { buildFullToolSurface } = require('../src/lib/tool-surface-builder')
  const snapshot = businessCalculationSnapshot()
  const permissions = snapshot.capabilityManifest.permissions
  assert.deepEqual(permissions.tools.allowlist, ['calculate'])
  assert.equal(permissions.network, false)
  assert.equal(permissions.write, false)
  assert.equal(permissions.externalWrite, false)
  const { surface, registry, governancePolicy } = buildFullToolSurface({
    forceV1: true,
    expertSnapshot: snapshot,
    permissions,
    extraTools: calculationModule().buildCalculationTools(),
  })
  assert.deepEqual(governancePolicy.allowlist, ['calculate'])
  assert.deepEqual(registry.getRegistrationIssues(), [])
  assert.deepEqual(surface.getToolDefinitions().map(def => def.function.name),
    ['calculate'])
  const result = await surface.createToolExecutor().executeToolCall({
    name: 'calculate', arguments: '{"calculations":[{"label":"package permission regression","expression":"6*7"}]}',
  })
  assert.equal(result.ok, true)
  assert.equal(result.meta.results[0].value, 42)
  assert.equal(result.requiresApproval, false)
  assert.deepEqual(result.artifactRefs, [])
})

test('permission reproduction: real business snapshot and connector runtime, empty versus calculate allowlist', async t => {
  const { resolveToolSurfaceForRun, extractExpertToolNames } = require('../src/lib/tool-surface-builder')
  const { buildConnectorToolSurface } = require('../src/lib/connectors/tool-runtime')
  const { deriveCapabilityIdsFromToolRecords } = require('../src/lib/context-engine/tool-capabilities')
  const snapshot = businessCalculationSnapshot()
  const savedMode = process.env.KNOWME_TOOL_SURFACE
  try {
    for (const mode of ['v1', 'legacy']) {
      process.env.KNOWME_TOOL_SURFACE = mode
      for (const allowlist of [[], ['calculate']]) {
        // Match expert-task-runtime's snapshot -> payload.permissions projection.
        const permissions = {
          ...snapshot.capabilityManifest.permissions,
          tools: { allowlist },
          orchestration: { allowDelegate: false, maxSubRuns: 0, maxParallel: 0 },
        }
        assert.equal(permissions.network, false)
        assert.equal(permissions.write, false)
        const resolved = await resolveToolSurfaceForRun({
          userData: __dirname, expertSnapshot: snapshot, permissions,
          allowedConnectorIds: snapshot.bindings.connectors,
          extraTools: calculationModule().buildCalculationTools(),
          connectorBuild: opts => buildConnectorToolSurface(__dirname, {
            extraTools: opts.extraTools, registry: opts.registry,
            allowedConnectorIds: snapshot.bindings.connectors,
            includeSystemFeishu: true,
            // Read-only store boundary; real collection/merging/projection runs.
            connectorStore: { migrateLegacy() {}, loadConnectors: () => [] },
            includeMcp: false,
          }),
        })
        try {
          const names = resolved.surface.getToolDefinitions().map(def => def.function.name)
          const visible = resolved.surface.isAllowedTool('calculate')
          if (mode === 'v1') {
            assert.equal(resolved.registry.has('calculate'), true, 'registration succeeds even when projection is denied')
            assert.deepEqual(resolved.registry.getRegistrationIssues(), [])
            assert.deepEqual(resolved.governancePolicy.allowlist, allowlist)
            assert.equal(extractExpertToolNames(snapshot), null, 'nested canonical tools object is not an expertToolNames list')
            assert.equal(visible, allowlist.includes('calculate'))
          }
          // RQA11: all modes now obey the same explicit tool permission boundary.
          assert.deepEqual(resolved.governancePolicy.allowlist, allowlist)
          assert.equal(visible, allowlist.includes('calculate'))
          assert.deepEqual(names, allowlist)
          assert.deepEqual(deriveCapabilityIdsFromToolRecords(resolved.surface.getToolRecords(), ['suggestion']), ['suggestion'])
          const result = await resolved.surface.createToolExecutor().executeToolCall({
            name: 'calculate', arguments: '{"calculations":[{"expression":"6*7"}]}',
          })
          assert.equal(result.ok, visible)
          if (visible) assert.equal(result.meta.results[0].value, 42)
          t.diagnostic(JSON.stringify({ mode, allowlist, registered: mode === 'v1' ? resolved.registry.has('calculate') : null,
            toolCount: names.length, calculateVisible: visible, executionCode: result.code, value: result.meta?.results?.[0]?.value }))
        } finally { await resolved.close() }
      }
    }
  } finally {
    if (savedMode === undefined) delete process.env.KNOWME_TOOL_SURFACE
    else process.env.KNOWME_TOOL_SURFACE = savedMode
  }
})
