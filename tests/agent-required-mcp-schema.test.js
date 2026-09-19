const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm')
const { createRequire } = require('node:module')
const policy = require('../src/lib/context-engine/policy')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')

const actualName = 'mcp.docs.search'
const loaderName = 'mcp_load_docs'
async function rootFixture(t, options = {}) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-required-schema-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const session = { id: 's', expertId: 'expert', run: { id: 'r', permissions: options.permissions || {} },
    ...(options.noTools ? { executionPolicy: 'no-tools' } : {}) }
  const connector = { id: 'docs', type: 'mcp', enabled: true, allowlist: ['search'], ...options.connector }
  const expertRuntime = { getSessionPersona: () => ({ ok: true, bindings: { connectors: options.unbound ? [] : ['docs'] },
    ...(options.expertToolNames ? { toolNames: options.expertToolNames } : {}) }) }
  const noop = () => null
  const records = new Map()
  let effects = 0, activations = 0
  const put = (name, metadata) => records.set(name, { type: 'function', function: { name, parameters: { type: 'object' } }, _knowme: metadata })
  const common = { source: 'mcp', connectorId: 'docs', risk: 'read', sideEffects: false, requiresApproval: false,
    scope: 'external', timeoutMs: 1000, idempotencySupported: true, rollbackSupported: false }
  put(loaderName, { ...common, capability: 'mcp-schema:docs', mcpSchemaLoader: options.trusted !== false })
  const validate = name => records.has(name) ? { ok: true } : { ok: false, code: 'unknown_tool' }
  const rawSurface = { getToolRecords: () => [...records.values()], getToolDefinitions: () => [...records.values()],
    isAllowedTool: name => records.has(name), validateToolCall: validate,
    createToolExecutor: () => ({ validateToolCall: validate, executeToolCall: async call => {
      if (!records.has(call.name)) return validate(call.name)
      if (call.name === loaderName) {
        activations++
        put(actualName, { ...common, capability: 'connector:docs', rawToolName: 'search', mcpSchemaLoader: false })
      } else effects++
      return { ok: true }
    } }) }
  const hub = { expertRuntime: () => expertRuntime, buildSkillToolsForSession: noop }
  const libs = { app: { getPath: () => userData }, path, contextEngine: policy,
    agentTools: { createToolSurface: () => rawSurface }, isToolSurfaceV1: () => true,
    resolveToolSurfaceForRun: async () => ({ surface: rawSurface, close: async () => {} }),
    getSessionCapabilityBindings: (current, runtime, opts) => resolveAgentCapabilityScope({ session: current, expertRuntime: runtime, ...opts }),
    agentSandbox: { normalizeSandboxPermissions: () => ({}) }, mergeExtraTools: noop,
    agentPlanTools: { buildPlanTools: noop }, agentWebTools: { buildWebTools: noop },
    agentArtifactTools: { buildArtifactTools: noop }, agentImageTools: {},
    agentCapabilityImportTools: { IMPORT_EXPERT_ID: 'other' },
    researchRouting: { buildResearchRoute: () => ({ active: false }), classifyResearchIntent: () => ({}) },
    logger: { systemPrompt() {} } }
  const filename = path.resolve(__dirname, '../src/lib/agent-generate-tool-surface.ts')
  const nativeRequire = createRequire(filename), module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports,
    require: name => name === './agent-generate-libs' ? libs : name === './agent-context-finalize'
      ? { finalizeAgentContext: ({ prepared }) => ({ apiMessages: prepared.apiMessages, contextInfo: {} }) } : nativeRequire(name) }, { filename })
  const contract = { requiredTools: [actualName], requiredEvidence: ['document-content'], completionConditions: ['cite-evidence'] }
  const before = JSON.stringify(contract)
  const run = await module.exports.buildRunToolSurface({ runId: 'r', payload: { sessionId: 's', conversationMode: 'expert-execution' },
    metrics: {}, fail: error => ({ error }), deps: {
      loadAgentSessions: () => [session], ensureCapabilityHub: () => hub,
      getConnectorsApi: () => ({ loadConnectors: () => [connector] }),
      getActiveSourceRoot: noop, buildActiveSourceFileTools: noop,
      ensureAgentTeamRuntime: () => ({ enabled: false, manager: { adoptRunningRun() {}, completeAdoptedRun() {} } }),
    } }, { session, s: { agentScriptsEnabled: false }, slashRefs: [], tier: 'assist', prompt: 'Find evidence', apiMessages: [],
    groundingTaskFrame: contract, executionPolicy: policy.resolveExecutionPolicy({ conversationMode: 'expert-execution', toolsEnabled: true }) })
  assert.equal(JSON.stringify(contract), before, 'preflight must not rewrite required or evidence obligations')
  return { run, effects: () => effects, activations: () => activations, contract }
}

test('root defers only schema availability: operation cannot execute before activation and appears next round', async t => {
  const f = await rootFixture(t, { permissions: { tools: { allowlist: [actualName, loaderName] } } })
  assert.equal(f.run.early, undefined)
  assert.equal(f.run.pendingRequiredToolSchemas[0].status, 'schema_required')
  assert.equal(f.run.pendingRequiredToolSchemas[0].loaderToolName, loaderName)
  assert.equal(f.run.toolSurface.isAllowedTool(actualName), false)
  assert.equal((await f.run.toolExecutor.executeToolCall({ name: actualName })).ok, false)
  assert.equal(f.effects(), 0)
  assert.equal((await f.run.toolExecutor.executeToolCall({ name: loaderName })).ok, true)
  assert.equal(f.activations(), 1)
  assert.equal(f.effects(), 0, 'schema activation is not the required operation')
  assert.ok(f.run.toolSurface.getToolDefinitions().some(def => def.function.name === actualName))
  assert.equal((await f.run.toolExecutor.executeToolCall({ name: actualName })).ok, true)
  assert.equal(f.effects(), 1)
  assert.equal(JSON.stringify(f.run.groundingTaskFrame), JSON.stringify(f.contract))
})

test('root rejects unavailable or denied loader dependencies without broadening hard tool or connector policies', async t => {
  for (const options of [
    { permissions: { tools: { allowlist: [actualName] } } },
    { permissions: { tools: { denylist: [loaderName] } } },
    { permissions: { tools: { denylist: [actualName] } } },
    { expertToolNames: [actualName] }, { noTools: true }, { unbound: true }, { trusted: false },
    { connector: { enabled: false } }, { connector: { allowlist: ['other'] } },
  ]) {
    const f = await rootFixture(t, options)
    if (options.noTools) {
      // Existing no-tools mode deliberately removes executable obligations for
      // the turn; it must remain inert, not become schema activation permission.
      assert.equal(f.run.noTools, true)
      assert.equal(f.run.toolSurface.getToolDefinitions().length, 0)
      assert.equal(f.run.toolSurface.isAllowedTool(loaderName), false)
      assert.equal(f.run.pendingRequiredToolSchemas.length, 0)
    } else {
      assert.match(f.run.early.error, /所需工具不可用/, JSON.stringify(options))
      assert.match(f.run.early.error, /schema 加载入口/)
    }
    assert.equal(f.activations(), 0)
    assert.equal(f.effects(), 0)
  }
})
