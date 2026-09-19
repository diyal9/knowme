const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { resolveChildCapabilityState } = require('../src/lib/agent-child-capability-scope')
const { recordTaskCapabilityGrant } = require('../src/lib/agent-task-capability-grants')
const { buildChildKnowledgeTools } = require('../src/lib/agent-child-knowledge-tools')

test('child scope preserves parent hard connector/tool restrictions without inheriting parent task grants', t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-child-scope-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const parentSession = { id: 'p', expertId: 'parent', run: { permissions: { connectors: { allowedConnectorIds: ['a'] } } } }
  const childSession = { id: 'c', expertId: 'child' }
  const expertRuntime = { getSessionPersona: (_id, expertId) => ({ ok: true,
    bindings: { skills: [], connectors: expertId === 'parent' ? ['a'] : ['a', 'b'] } }) }
  recordTaskCapabilityGrant(userData, parentSession, 'connectors', 'b', 'parent-approved')
  const state = resolveChildCapabilityState({ parentSession, childSession, expertRuntime, userData,
    parentPolicy: { denylist: ['send_doc'] } })
  assert.deepEqual(state.scope.allowedConnectorIds, ['a'])
  assert.equal(state.scope.decision('connectors', 'b').allowed, false)
  assert.ok(state.governancePolicy.denylist.includes('send_doc'))
  assert.equal(state.scope.grants.length, 0)
  const noTools = resolveChildCapabilityState({ parentSession, childSession, expertRuntime, userData, noTools: true })
  assert.deepEqual(noTools.governancePolicy.allowlist, [])
})

test('child knowledge creates an independent scope and project guard and observes later parent denial', () => {
  let state = { scope: { allowedKnowledgeIds: ['rag:p:a'], deniedKnowledgeIds: [], noTools: false } }
  const session = { id: 'child', projectId: 'project-child', knowledgeRefs: [{ id: 'p' }], run: {} }
  let built
  buildChildKnowledgeTools({
    libs: { app: {}, fabricRetrieval: {}, createKnowledgeTools: options => { built = options; return {} } },
    deps: { ensureCapabilityHub: () => ({ resolveSessionRetrievalScope: input => ({ mode: 'selected',
      providers: [{ id: 'p', collectionIds: input.knowledgeRefs.map(ref => ref.id.split(':').pop()) }] }) }) },
    prepared: {}, getSession: () => session, getState: () => state,
  })
  assert.equal(built.projectId, 'project-child')
  assert.deepEqual(built.retrievalScope.providers[0].collectionIds, ['a'])
  assert.deepEqual(built.knowledgePolicy.providers[0].collectionIds, ['a'])
  state = null
  assert.equal(built.getCurrentScope(), null)
  assert.deepEqual(session.knowledgeRefs, [{ id: 'p' }])
})

test('production child port factory persists isolated run and propagates parent denial plus deferred host check', async t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-child-ports-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const parent = { id: 'parent-session', expertId: 'parent', run: { id: 'parent-run', permissions: {} } }
  let sessions = [parent]
  let builtContext
  const noop = () => null
  const tool = { type: 'function', function: { name: 'read_doc' }, _knowme: { connectorId: 'a' } }
  const rawSurface = { getToolRecords: () => [tool], getToolDefinitions: () => [tool], isAllowedTool: () => true,
    createToolExecutor: () => ({ executeToolCall: async () => ({ ok: true }), validateToolCall: () => ({ ok: true }) }) }
  const expertRuntime = { getSessionPersona: () => ({ ok: true, bindings: { skills: [], connectors: ['a', 'b'] } }),
    loadExpert: () => ({ ok: true }) }
  const libs = {
    app: { getPath: () => userData }, path,
    agentSessions: { createSession: (_id, _max, opts) => ({ id: 'child-session', ...opts, run: {} }) },
    agentProcessTools: { buildProcessTools: noop }, agentArtifactTools: { buildArtifactTools: noop },
    agentOrchestration: { buildOrchestrationTools: noop }, agentPlanTools: { buildPlanTools: noop },
    agentWebTools: { buildWebTools: noop }, agentSandbox: {}, mergeExtraTools: noop,
    createKnowledgeTools: () => ({ queryKnowledge: noop, kbQueryTool: noop, kbGetTool: noop }),
    resolveToolSurfaceForRun: async context => { builtContext = context; return { surface: rawSurface, governancePolicy: context.governancePolicy, close: async () => {} } },
    buildProductionRunPorts: options => options,
  }
  const filename = path.resolve(__dirname, '../src/lib/agent-generate-child-ports.ts')
  const nativeRequire = createRequire(filename)
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports,
    require: name => name === './agent-generate-libs' ? libs : nativeRequire(name) }, { filename })
  const hub = { expertRuntime: () => expertRuntime, buildSkillToolsForSession: noop,
    resolveSessionRetrievalScope: () => ({ mode: 'default', providers: [] }) }
  const factory = module.exports.createChildRunPortFactory({ runId: 'parent-run', deps: {
    ensureCapabilityHub: () => hub, loadAgentSessions: () => sessions, saveAgentSessions: rows => { sessions = rows },
    getConnectorsApi: () => ({ loadConnectors: () => [{ id: 'a', enabled: true }, { id: 'b', enabled: true }] }),
    agentRuntimeOutputBridges: new Map(),
  } }, { s: {}, modelProfile: { supportsTools: true } }, {
    session: parent, runPermissions: { connectors: { allowedConnectorIds: ['a'] } }, sandboxPermissions: {},
    userDataPath: userData, apiMessages: [], resolvedSurface: { governancePolicy: { allowedConnectorIds: ['a'], denylist: ['send_doc'] } },
    teamRuntime: { manager: { getRun: () => ({ run: { budget: {} } }) }, store: {} },
  })
  const ports = await factory({ runId: 'child-run', expertId: 'child', prompt: 'read authorized evidence' })
  assert.equal(sessions.find(item => item.id === 'child-session').run.id, 'child-run')
  assert.deepEqual([...builtContext.allowedConnectorIds], ['a'])
  assert.ok(builtContext.governancePolicy.denylist.includes('send_doc'))
  assert.equal(typeof builtContext.validateExecutionApproval, 'function')
  assert.equal(ports.toolSurface.isAllowedTool('read_doc'), true)
  parent.run.permissions = { connectors: { allowedConnectorIds: [] } }
  assert.equal(ports.toolSurface.isAllowedTool('read_doc'), false)
})
