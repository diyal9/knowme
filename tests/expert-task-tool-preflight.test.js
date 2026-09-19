'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { normalizeTask } = require('../src/lib/workbench-task-store')
const agentRun = require('../src/lib/agent-run')
const { preflightExpertTools } = require('../src/lib/expert-task-tool-preflight')

test('RQA04 confirmed union matches real resolver projection and execution with unchanged ACL', async () => {
  const { resolveToolSurfaceForRun } = require('../src/lib/tool-surface-builder')
  const { buildCalculationTools } = require('../src/lib/agent-calculation-tools')
  const agentTools = require('../src/lib/agent-tools')
  const savedMode = process.env.KNOWME_TOOL_SURFACE
  process.env.KNOWME_TOOL_SURFACE = 'v1'
  const owners = { lookup: 'a', save: 'b' }
  const requiredTools = ['lookup', 'save', 'calculate']
  try {
    for (const allowlist of [requiredTools, ['lookup', 'calculate'], []]) {
      const snapshot = { bindings: { connectors: ['a', 'b'] }, capabilityManifest: { permissions: {
        tools: { allowlist }, connectors: { allowedConnectorIds: ['a', 'b'] }, network: false, write: false,
      } } }
      const preflight = await preflightExpertTools({ snapshot, connectorIds: ['a', 'b'], requiredTools,
        getConnectorsApi: () => ({ getConnectorStatus: async id => ({ ok: true, connector: {
          id, enabled: true, agentVisible: true, status: { ok: true, projectedAllowlist: Object.keys(owners).filter(name => owners[name] === id) },
        } }) }),
      })
      const calls = []
      const resolved = await resolveToolSurfaceForRun({
        permissions: snapshot.capabilityManifest.permissions, expertSnapshot: snapshot,
        allowedConnectorIds: snapshot.bindings.connectors, requiredTools,
        extraTools: buildCalculationTools(),
        connectorBuild: async ({ registry }) => {
          for (const [name, connectorId] of Object.entries(owners)) {
            const contract = { source: 'connector', connectorId, capability: 'fixture', risk: 'read', sideEffects: false,
              requiresApproval: false, scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false }
            registry.registerTool({ type: 'function', function: { name, description: 'isolated fixture', parameters: { type: 'object', properties: {} } }, _knowme: contract }, contract,
              async () => { calls.push(connectorId); return { ok: true, text: connectorId } })
          }
          return { surface: agentTools.createToolSurface(), close: async () => {} }
        },
      })
      try {
        assert.equal(preflight.ok, requiredTools.every(name => resolved.surface.isAllowedTool(name)))
        assert.deepEqual(resolved.governancePolicy.allowlist, allowlist)
        const executor = resolved.surface.createToolExecutor()
        for (const name of requiredTools) {
          const result = await executor.executeToolCall({ name,
            arguments: JSON.stringify(name === 'calculate' ? { calculations: [{ expression: '6*7' }] } : {}),
          })
          assert.equal(result.ok, allowlist.includes(name), name)
          if (result.ok && name === 'calculate') assert.equal(result.meta.results[0].value, 42)
        }
        assert.deepEqual(calls, Object.keys(owners).filter(name => allowlist.includes(name)).map(name => owners[name]))
      } finally { await resolved.close() }
    }
  } finally {
    if (savedMode === undefined) delete process.env.KNOWME_TOOL_SURFACE
    else process.env.KNOWME_TOOL_SURFACE = savedMode
  }
})

test('RQA79 optional connector does not block a required image provider', async () => {
  const statusCalls = []
  const result = await preflightExpertTools({
    snapshot: {
      bindings: { connectors: ['pango-image-mcp', 'photoshop-mcp'] },
      capabilityManifest: {
        dependencies: [
          { id: 'pango-image-mcp', kind: 'connector', required: true },
          { id: 'photoshop-mcp', kind: 'connector', required: false },
        ],
        permissions: { connectors: { allowedConnectorIds: ['pango-image-mcp', 'photoshop-mcp'] }, tools: { allowlist: ['generate_image'] } },
      },
    },
    connectorIds: ['pango-image-mcp'],
    requiredTools: ['generate_image'],
    getConnectorsApi: () => ({
      getConnectorStatus: async (id) => {
        statusCalls.push(id)
        if (id === 'photoshop-mcp') return { ok: false, message: '可选连接器未启用' }
        return { ok: true, connector: {
          id, enabled: true, agentVisible: true,
          status: { ok: true, projectedAllowlist: ['generate_image'] },
        } }
      },
    }),
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.issues, [])
  assert.ok(statusCalls.includes('pango-image-mcp'))
})

test('RQA150 image failure does not report an unrelated optional connector', async () => {
  const result = await preflightExpertTools({
    snapshot: {
      bindings: { connectors: ['pango-image-mcp', 'photoshop-mcp'] },
      capabilityManifest: {
        dependencies: [
          { id: 'pango-image-mcp', kind: 'connector', required: true },
          { id: 'photoshop-mcp', kind: 'connector', required: false },
        ],
        permissions: { connectors: { allowedConnectorIds: ['pango-image-mcp', 'photoshop-mcp'] }, tools: { allowlist: ['generate_image'] } },
      },
    },
    connectorIds: ['pango-image-mcp'],
    requiredTools: ['generate_image'],
    getConnectorsApi: () => ({
      getConnectorStatus: async id => id === 'photoshop-mcp'
        ? { ok: false, message: '可选连接器未启用' }
        : { ok: true, connector: { id, enabled: true, agentVisible: true, status: { ok: false, state: 'offline', message: 'Pango 离线' } } },
    }),
  })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some(issue => issue.id === 'pango-image-mcp'))
  assert.equal(result.issues.some(issue => issue.id === 'photoshop-mcp'), false)
})

test('RQA108 research manifest treats web search and fetch as host builtins', async () => {
  const snapshot = {
    bindings: { connectors: [] },
    capabilityManifest: {
      id: 'research-analyst',
      permissions: {
        connectors: { allowedConnectorIds: [] },
        tools: { allowlist: ['search_web', 'fetch_web_page'] },
        network: true,
      },
    },
  }
  const result = await preflightExpertTools({
    snapshot,
    connectorIds: [],
    requiredTools: ['search_web', 'fetch_web_page'],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.issues, [])
})

test('artifact creation is recognized as a host builtin during expert preflight', async () => {
  const result = await preflightExpertTools({
    snapshot: {
      bindings: { connectors: [] },
      capabilityManifest: {
        permissions: {
          connectors: { allowedConnectorIds: [] },
          tools: { allowlist: ['create_artifact'] },
        },
      },
    },
    connectorIds: [],
    requiredTools: ['create_artifact'],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.issues, [])
})

test('file writing is a conditional KnowMe builtin instead of an installable capability', async () => {
  const snapshot = {
    bindings: { connectors: [] },
    capabilityManifest: { permissions: {
      connectors: { allowedConnectorIds: [] },
      tools: { allowlist: ['write_file'] },
      write: true,
    } },
  }
  const ready = await preflightExpertTools({
    snapshot,
    connectorIds: [],
    requiredTools: ['write_file'],
    hostCapabilities: { fileRead: true, fileWrite: true, process: true },
  })
  assert.equal(ready.ok, true)
  assert.deepEqual(ready.issues, [])

  const missingWorkspace = await preflightExpertTools({
    snapshot,
    connectorIds: [],
    requiredTools: ['write_file'],
    hostCapabilities: { fileRead: false, fileWrite: false, process: false },
  })
  assert.equal(missingWorkspace.ok, false)
  assert.deepEqual(missingWorkspace.issues, [{
    id: 'write_file',
    code: 'workspace_unavailable',
    message: '「write_file」是 KnowMe 内置工具，请先选择可用的项目目录',
  }])
})

function fixture({ requiredTools, providers = {}, permissions, bindings, requiredConnectorIds = Object.keys(providers), discover } = {}) {
  const output = { id: 'primary', title: '联合工具结果', type: 'answer', required: true, requiredTools, requiredConnectorIds }
  const snapshot = {
    bindings: { skills: [], connectors: bindings || Object.keys(providers) },
    capabilityManifest: { version: 'rqa04', permissions: permissions || {
      tools: { allowlist: requiredTools }, connectors: { allowedConnectorIds: Object.keys(providers) },
    }, metadata: { knowme: { execution: { deliverables: [output] } } } },
  }
  let state = normalizeTask({ id: 'rqa04', expertId: 'any-custom-agent', status: 'starting',
    goal: '联合完成任务', brief: { goal: '联合完成任务', deliverables: [output] },
    execRef: { kind: 'session', id: 'rqa04-session' }, assignmentSnapshot: { agentVersion: 'rqa04' },
  })
  const store = {
    get: () => ({ ok: true, task: structuredClone(state) }),
    update: (_id, patch) => { state = normalizeTask({ ...state, ...patch }); return store.get() },
    list: () => ({ ok: true, tasks: [structuredClone(state)] }),
  }
  let session = { id: 'rqa04-session', messages: [], run: agentRun.createEmptyRun() }
  const payloads = []
  const statusCalls = []
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture-only', apiEndpoint: 'https://not-contacted.invalid' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => snapshot, createSessionSnapshot: () => ({ ok: true, snapshot }) }) }),
    getConnectorsApi: () => ({
      getConnectorStatus: async id => {
        statusCalls.push(id)
        return { ok: true, connector: { id, enabled: true, agentVisible: true, ...providers[id],
          status: { ok: true, state: 'ready', ...providers[id]?.status } } }
      },
      ...(discover ? { getConnectorTools: discover } : {}),
    }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: rows => { session = rows[0] },
    runAgentGenerate: async (_deps, payload) => {
      payloads.push(payload)
      return { runId: payload.runId, text: '预检后生成的隔离测试结果',
        executionEvidence: { gateStatus: 'verified', verificationPassed: true,
          toolCalls: requiredTools.map(name => ({ name, status: 'ok' })),
          evidence: requiredTools.map(tool => ({ status: 'ok', provenance: { kind: 'tool_result', tool } })),
        },
      }
    },
    agentRun,
  })
  return { runtime, store, payloads, statusCalls, output, snapshot }
}

const provider = (...tools) => ({ status: { projectedAllowlist: tools } })

for (const entry of ['execute', 'createStart']) {
  for (const scenario of [
    { name: 'two connector union', requiredTools: ['a.read', 'b.write'], providers: { a: provider('a.read'), b: provider('b.write') }, allowed: true },
    { name: 'one missing tool', requiredTools: ['a.read', 'b.write'], providers: { a: provider('a.read'), b: provider() }, allowed: false },
    { name: 'tool permission denied', requiredTools: ['a.read', 'b.write'], providers: { a: provider('a.read'), b: provider('b.write') }, permissions: { tools: { allowlist: ['a.read'] } }, allowed: false },
    { name: 'connector and builtin calculate', requiredTools: ['a.read', 'calculate'], providers: { a: provider('a.read') }, allowed: true },
    { name: 'builtin without connectors', requiredTools: ['calculate'], providers: {}, allowed: true },
    { name: 'builtin web tools without connectors', requiredTools: ['search_web', 'fetch_web_page'], providers: {}, allowed: true },
    { name: 'builtin web tools empty allowlist denied', requiredTools: ['search_web', 'fetch_web_page'], providers: {}, permissions: { tools: { allowlist: [] } }, allowed: false },
    { name: 'declared import builtins without connectors', requiredTools: ['preview_external_project', 'design_external_workflow_import'], providers: {}, allowed: true },
    { name: 'declared import builtins empty allowlist denied', requiredTools: ['import_external_project'], providers: {}, permissions: { tools: { allowlist: [] } }, allowed: false },
    { name: 'builtin empty allowlist denied', requiredTools: ['calculate'], providers: {}, permissions: { tools: { allowlist: [] } }, allowed: false },
    { name: 'single connector unchanged', requiredTools: ['a.read'], providers: { a: provider('a.read') }, allowed: true },
    { name: 'missing projection is not proof', requiredTools: ['a.read'], providers: { a: {} }, allowed: false },
    { name: 'configured raw allowlist is not projection', requiredTools: ['a.read'], providers: { a: { allowlist: ['a.read'] } }, allowed: false },
    { name: 'connector permission denied', requiredTools: ['a.read'], providers: { a: provider('a.read') }, permissions: { tools: { allowlist: ['a.read'] }, connectors: { allowedConnectorIds: [] } }, allowed: false },
    { name: 'required connector unbound', requiredTools: ['a.read'], providers: { a: provider('a.read') }, bindings: [], allowed: false },
    { name: 'ownership comes from provider not name prefix', requiredTools: ['lookup', 'save'], providers: { a: provider('lookup'), b: provider('save') }, allowed: true },
    { name: 'unregistered tool without connectors', requiredTools: ['invented_builtin'], providers: {}, allowed: false },
    { name: 'authoritative discovery fallback', requiredTools: ['mcp.a.read'], providers: { a: {} }, discover: async () => ({ ok: true, projectedAllowlist: ['mcp.a.read'] }), allowed: true },
    { name: 'discovery unselected tool denied', requiredTools: ['mcp.a.read'], providers: { a: {} }, discover: async () => ({ ok: true, availableTools: [{ projectedName: 'mcp.a.read', selected: false }] }), allowed: false },
    { name: 'tool denylist wins', requiredTools: ['a.read'], providers: { a: provider('a.read') }, permissions: { tools: { allowlist: ['a.read'], denylist: ['a.read'] } }, allowed: false },
    { name: 'optional bound owner supplies required tool', requiredTools: ['a.read'], providers: { a: provider('a.read'), b: { enabled: false } }, requiredConnectorIds: [], allowed: true },
    { name: 'mandatory offline provider still blocks', requiredTools: ['a.read'], providers: { a: provider('a.read'), b: { enabled: false } }, allowed: false },
    { name: 'unknown projection adds nothing to already confirmed union', requiredTools: ['a.read'], providers: { a: provider('a.read'), b: {} }, allowed: true },
    { name: 'explicit empty projection never falls back to claimed discovery', requiredTools: ['a.read'], providers: { a: provider() }, discover: async () => ({ ok: true, projectedAllowlist: ['a.read'] }), allowed: false },
    { name: 'connector cannot launder denied builtin', requiredTools: ['calculate'], providers: { a: provider('calculate') }, permissions: { tools: { allowlist: [] } }, allowed: false },
    { name: 'conflicting provider ownership denied', requiredTools: ['lookup'], providers: { a: provider('lookup'), b: provider('lookup') }, allowed: false },
    { name: 'provider identity mismatch denied', requiredTools: ['a.read'], providers: { a: { ...provider('a.read'), id: 'other' } }, allowed: false },
    { name: 'image adapter aliases discovered selected raw tool', requiredTools: ['generate_image'], providers: { 'pango-image-mcp': {} }, discover: async () => ({ ok: true, projectedAllowlist: ['mcp.pango-image-mcp.generate_image'], availableTools: [{ rawName: 'generate_image', projectedName: 'mcp.pango-image-mcp.generate_image', selected: true }] }), allowed: true },
    { name: 'image adapter missing projection denied', requiredTools: ['generate_image'], providers: { 'pango-image-mcp': {} }, allowed: false },
    { name: 'image adapter unselected raw tool denied', requiredTools: ['generate_image'], providers: { 'pango-image-mcp': {} }, discover: async () => ({ ok: true, projectedAllowlist: [], availableTools: [{ rawName: 'generate_image', projectedName: 'mcp.pango-image-mcp.generate_image', selected: false }] }), allowed: false },
  ]) {
    test(`RQA04 ${entry}: ${scenario.name}`, async () => {
      const f = fixture(scenario)
      const result = entry === 'execute'
        ? await f.runtime.execute('rqa04')
        : await f.runtime.createStart({ taskId: 'rqa04', expertId: 'any-custom-agent', brief: { goal: '联合完成任务', deliverables: [f.output] } })
      // createStart schedules execute; settle the local microtask chain, no API calls.
      if (entry === 'createStart' && result.started) {
        for (let count = 0; count < 30 && f.runtime.controllers.size; count += 1) await new Promise(resolve => setImmediate(resolve))
      }
      assert.equal(f.payloads.length, scenario.allowed ? 1 : 0, JSON.stringify(f.store.get().task.attention))
      if (scenario.allowed) {
        assert.equal(f.store.get().task.status, 'review')
        assert.deepEqual(f.payloads[0].executionContract.requiredTools, scenario.requiredTools)
        assert.deepEqual(f.payloads[0].permissions.tools, f.snapshot.capabilityManifest.permissions.tools)
      } else {
        assert.equal(f.store.get().task.status, 'needs_input')
        if (entry === 'execute') assert.equal(f.store.get().task.events.some(event => event.type === 'preflight_failed'), true)
        else assert.equal(result.started, false)
        assert.ok(f.store.get().task.attention?.detail)
      }
      assert.equal(f.runtime.controllers.size, 0)
    })
  }
}
