'use strict'

/**
 * tool-surface-builder — 从 Registry 投影完整 v1 工具面（feature flag 感知）。
 */

const agentTools = require('./agent-tools')
const agentFileTools = require('./agent-file-tools')
const agentProcessTools = require('./agent-process-tools')
const agentArtifactTools = require('./agent-artifact-tools')
const agentOrchestration = require('./agent-orchestration')
const {
  createRegistry,
  validateContract,
  isToolSurfaceV1,
  normalizeRunGovernancePolicy,
  filterDefinitionsForGovernance,
  bindRunRuntimeContext,
  unbindRunRuntimeContext,
} = require('./tool-contract-registry')

const BUILTIN_CONTRACT = {
  read: {
    source: 'builtin',
    capability: 'file-read',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'content-source',
    timeoutMs: 30000,
    idempotencySupported: false,
    rollbackSupported: false,
  },
  write: {
    source: 'builtin',
    capability: 'file-write',
    risk: 'write',
    sideEffects: true,
    requiresApproval: true,
    scope: 'content-source',
    timeoutMs: 45000,
    idempotencySupported: true,
    rollbackSupported: true,
  },
  process: {
    source: 'builtin',
    capability: 'process',
    risk: 'network',
    sideEffects: true,
    requiresApproval: false,
    scope: 'sandbox',
    timeoutMs: 120000,
    idempotencySupported: false,
    rollbackSupported: false,
  },
  artifact: {
    source: 'builtin',
    capability: 'artifact',
    risk: 'write',
    sideEffects: true,
    requiresApproval: false,
    scope: 'ephemeral',
    timeoutMs: 60000,
    idempotencySupported: false,
    rollbackSupported: false,
  },
  orchestration: {
    source: 'builtin',
    capability: 'orchestration',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'external',
    timeoutMs: 180000,
    idempotencySupported: true,
    rollbackSupported: false,
  },
}

function attachKnowmeContract(def, contract) {
  return { ...def, _knowme: { ...contract } }
}

function registerBundle(registry, bundle, contract) {
  if (!bundle?.definitions) return
  for (const def of bundle.definitions) {
    const name = def?.function?.name
    if (!name) continue
    const c = def._knowme || contract
    registry.registerTool(def, c, bundle.handlers?.[name])
  }
}

function extractExpertToolNames(expertSnapshot) {
  if (!expertSnapshot || typeof expertSnapshot !== 'object') return null
  if (Array.isArray(expertSnapshot.toolNames) && expertSnapshot.toolNames.length) {
    return expertSnapshot.toolNames.map(String)
  }
  if (Array.isArray(expertSnapshot.tools) && expertSnapshot.tools.length) {
    return expertSnapshot.tools.map(String)
  }
  if (Array.isArray(expertSnapshot.bindings?.tools) && expertSnapshot.bindings.tools.length) {
    return expertSnapshot.bindings.tools.map(String)
  }
  const manifestTools = expertSnapshot.capabilityManifest?.permissions?.tools
  if (Array.isArray(manifestTools) && manifestTools.length) {
    return manifestTools.map(String)
  }
  return null
}

function extractOrchestrationPolicy(expertSnapshot, permissions = {}) {
  const orch = expertSnapshot?.orchestration || expertSnapshot?.frontmatter?.orchestration || {}
  const permOrch = permissions.orchestration || {}
  const allowDelegate = orch.allowDelegate ?? permOrch.allowDelegate ?? expertSnapshot?.orchestrationEnabled
  return {
    allowDelegate: allowDelegate !== false,
    allowedSubExperts: Array.isArray(orch.allowedSubExperts)
      ? orch.allowedSubExperts.map(String)
      : (Array.isArray(orch.allowedExperts)
        ? orch.allowedExperts.map(String)
        : (Array.isArray(permOrch.allowedSubExperts) ? permOrch.allowedSubExperts.map(String) : null)),
    maxParallel: Number.isFinite(Number(orch.maxParallel)) ? Number(orch.maxParallel) : permOrch.maxParallel,
    maxSubRuns: Number.isFinite(Number(orch.maxSubRuns)) ? Number(orch.maxSubRuns) : permOrch.maxSubRuns,
  }
}

/**
 * per-Run 治理策略：allowlist/denylist ∩ Connector 授权 ∩ Expert bindings 交集投影。
 */
function buildRunGovernancePolicy(runCtx = {}) {
  const permissions = runCtx.permissions || runCtx.deps?.permissions || runCtx.session?.run?.permissions || {}
  const expertSnapshot = runCtx.expertSnapshot || runCtx.deps?.expertSnapshot || null
  const tools = permissions.tools && typeof permissions.tools === 'object' ? permissions.tools : {}
  return normalizeRunGovernancePolicy({
    allowlist: runCtx.toolAllowlist || tools.allowlist || permissions.toolAllowlist || null,
    denylist: runCtx.toolDenylist || tools.denylist || permissions.toolDenylist || [],
    allowedConnectorIds: runCtx.allowedConnectorIds
      || permissions.connectors?.allowedConnectorIds
      || runCtx.deps?.allowedConnectorIds
      || null,
    expertToolNames: extractExpertToolNames(expertSnapshot),
    orchestration: extractOrchestrationPolicy(expertSnapshot, permissions),
    budget: runCtx.budget || permissions.budget || null,
  })
}

function buildV1Registry(opts = {}) {
  const registry = createRegistry()
  const fileTools = agentFileTools.buildFileTools(opts.fileAdapter || {}, {
    includeWrite: opts.includeWrite !== false,
  })
  for (const def of fileTools.definitions) {
    const name = def.function.name
    const isWrite = agentFileTools.WRITE_TOOL_DEFS.some((d) => d.function.name === name)
    const contract = isWrite ? BUILTIN_CONTRACT.write : BUILTIN_CONTRACT.read
    registry.registerTool(def, contract, fileTools.handlers[name])
  }

  if (opts.processTools) registerBundle(registry, opts.processTools, BUILTIN_CONTRACT.process)
  if (opts.artifactTools) registerBundle(registry, opts.artifactTools, BUILTIN_CONTRACT.artifact)
  if (opts.orchestrationTools && opts.governancePolicy?.orchestration?.allowDelegate !== false) {
    registerBundle(registry, opts.orchestrationTools, BUILTIN_CONTRACT.orchestration)
  }
  if (opts.extraTools) registerBundle(registry, opts.extraTools, opts.extraContract || BUILTIN_CONTRACT.read)

  return registry
}

function buildToolSurfaceFromRegistry(registry, deps = {}) {
  const governancePolicy = deps.governancePolicy || buildRunGovernancePolicy(deps)
  const ctx = {
    userData: deps.userData,
    runId: deps.runId,
    sessionId: deps.sessionId,
    approverId: deps.approverId,
    parentRunId: deps.parentRunId || null,
    subRunId: deps.subRunId || null,
    governancePolicy,
    getRemainingTimeoutMs: deps.getRemainingTimeoutMs,
    recordReceipt: deps.recordReceipt,
    signal: deps.signal,
  }
  const projected = registry.projectToSurface(agentTools.parseToolArguments, ctx)
  const surface = agentTools.createToolSurface({
    extraDefinitions: projected.definitions,
    handlers: projected.handlers,
    requiredTools: deps.requiredTools,
    toolBudget: deps.toolBudget,
    deps,
  })
  const baseValidate = surface.validateToolCall.bind(surface)
  surface.validateToolCall = (name, rawArgs) => {
    const entry = registry.get(name)
    if (entry && !filterDefinitionsForGovernance([entry.definition], governancePolicy).length) {
      return { ok: false, code: 'scope_denied', message: `工具未授权: ${name}` }
    }
    return baseValidate(name, rawArgs)
  }
  const baseAllowed = surface.isAllowedTool.bind(surface)
  surface.isAllowedTool = (name) => {
    const entry = registry.get(name)
    if (entry && !filterDefinitionsForGovernance([entry.definition], governancePolicy).length) return false
    return baseAllowed(name)
  }
  return { surface, governancePolicy, projected }
}

const LEGACY_WRITE_ORCHESTRATION = new Set([
  'write_file', 'create_file', 'apply_patch', 'move_path', 'copy_path', 'delete_path', 'mkdir',
  'run_task', 'start_process', 'cancel_task', 'task_status', 'task_logs',
  'create_artifact', 'update_artifact', 'export_artifact_csv', 'export_artifact_pdf',
  'delegate_to_expert', 'spawn_sub_run', 'handoff_artifact',
  'feishu.draft_write_doc', 'feishu.draft_minute_permission',
])

function filterLegacyExtraTools(extraTools) {
  if (!extraTools?.definitions) return extraTools
  const definitions = []
  const handlers = {}
  for (const def of extraTools.definitions) {
    const name = def?.function?.name
    if (!name || LEGACY_WRITE_ORCHESTRATION.has(name)) continue
    definitions.push(def)
    if (extraTools.handlers?.[name]) handlers[name] = extraTools.handlers[name]
  }
  return definitions.length ? { definitions, handlers } : null
}

/**
 * Agent Run 唯一生产工具组装入口（H1）。
 * v1 → Registry 投影 + validate/envelope/audit；legacy → 只读 + 既有 Feishu draft 子集。
 */
async function resolveToolSurfaceForRun(runCtx = {}) {
  const {
    userData,
    runId,
    sessionId,
    fileAdapter,
    processTools,
    artifactTools,
    orchestrationTools,
    extraTools,
    connectorBuild,
    deps = {},
    permissions,
    expertSnapshot,
    allowedConnectorIds,
    signal,
    getRemainingTimeoutMs,
    recordReceipt,
    parentRunId,
    subRunId,
    requiredTools,
    toolBudget,
  } = runCtx

  const governancePolicy = runCtx.governancePolicy || buildRunGovernancePolicy(runCtx)
  const execCtx = {
    userData,
    runId,
    sessionId,
    parentRunId,
    subRunId,
    permissions,
    expertSnapshot,
    allowedConnectorIds,
    governancePolicy,
    requiredTools,
    toolBudget,
    signal,
    getRemainingTimeoutMs,
    recordReceipt,
    ...deps,
  }

  if (runId) {
    bindRunRuntimeContext(runId, {
      signal,
      getRemainingTimeoutMs,
      recordReceipt,
      parentRunId,
      subRunId,
      governancePolicy,
    })
  }

  if (!isToolSurfaceV1()) {
    if (runId) unbindRunRuntimeContext(runId)
    const legacyExtra = filterLegacyExtraTools(extraTools)
    const connectorRuntime = typeof connectorBuild === 'function'
      ? await connectorBuild({ extraTools: legacyExtra, legacy: true })
      : {
        surface: agentTools.createToolSurface({
          extraDefinitions: legacyExtra?.definitions,
          handlers: legacyExtra?.handlers,
          requiredTools,
          toolBudget,
        }),
        async close() {},
      }
    return { ...connectorRuntime, mode: 'legacy', registry: null, governancePolicy: null }
  }

  const registry = buildV1Registry({
    fileAdapter,
    includeWrite: true,
    extraTools: filterLegacyExtraTools(extraTools) || extraTools,
    processTools,
    artifactTools,
    orchestrationTools,
    governancePolicy,
  })

  const connectorRuntime = typeof connectorBuild === 'function'
    ? await connectorBuild({ registry, execCtx, legacy: false, governancePolicy })
    : null

  const built = buildToolSurfaceFromRegistry(registry, execCtx)
  return {
    surface: built.surface,
    registry,
    mode: 'v1',
    governancePolicy: built.governancePolicy,
    mcpProjectionError: connectorRuntime?.mcpProjectionError || null,
    close: async () => {
      if (runId) unbindRunRuntimeContext(runId)
      if (connectorRuntime?.close) await connectorRuntime.close()
    },
  }
}

function buildFullToolSurface(opts = {}) {
  if (!isToolSurfaceV1() && !opts.forceV1) {
    return agentTools.createToolSurface(opts.legacySurface || {})
  }
  const governancePolicy = opts.governancePolicy || buildRunGovernancePolicy(opts.deps || opts)
  const registry = buildV1Registry({ ...opts, governancePolicy })
  const built = buildToolSurfaceFromRegistry(registry, { ...(opts.deps || {}), governancePolicy })
  return { surface: built.surface, registry, mode: 'v1', governancePolicy: built.governancePolicy }
}

function contractCoverageReport(registry) {
  const tools = registry.list()
  const missing = tools.filter((t) => {
    const v = validateContract(t.contract)
    return !v.ok
  })
  return {
    total: tools.length,
    valid: tools.length - missing.length,
    coverage: tools.length ? (tools.length - missing.length) / tools.length : 1,
    missing: missing.map((t) => t.definition.function.name),
  }
}

module.exports = {
  BUILTIN_CONTRACT,
  attachKnowmeContract,
  registerBundle,
  buildV1Registry,
  buildRunGovernancePolicy,
  extractExpertToolNames,
  buildToolSurfaceFromRegistry,
  buildFullToolSurface,
  resolveToolSurfaceForRun,
  filterLegacyExtraTools,
  LEGACY_WRITE_ORCHESTRATION,
  contractCoverageReport,
  isToolSurfaceV1,
}
