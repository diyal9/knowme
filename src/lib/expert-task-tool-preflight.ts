'use strict'

const agentTools = require('./agent-tools')
const { buildHostBuiltinDefinitions } = require('./agent-host-builtin-tools')
const { ARTIFACT_TOOL_DEFS } = require('./agent-artifact-tools')
const { READ_TOOL_DEFS, WRITE_TOOL_DEFS } = require('./agent-file-tools')
const { PROCESS_TOOL_DEFS } = require('./agent-process-tools-policy')
const { SKILL_TOOL_DEFINITIONS } = require('./agent-skill-tools')
const { IMAGE_PROVIDER_ADAPTER } = require('./agent-provider-tool-contracts')
const { createRegistry } = require('./tool-contract-registry')
const { BUILTIN_CONTRACT, buildRunGovernancePolicy, buildToolSurfaceFromRegistry } = require('./tool-surface-builder')
const { createPreflightWait } = require('./expert-task-preflight-wait')

const names = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]

/** A status projection is already allowlist-filtered. A configured raw allowlist is not discovery. */
async function connectorProjection(api, connector, adapters, waitContext) {
  const projected = connector.status?.projectedAllowlist
  if (Array.isArray(projected)) return names(projected)
  if (typeof api.getConnectorTools !== 'function') return null
  const discovered = await waitContext.wait(() => api.getConnectorTools(connector.id), 'tools', connector.id)
  if (!discovered?.ok) return null
  const selected = (discovered.availableTools || []).filter(tool => tool?.selected === true)
  const tools = Array.isArray(discovered.projectedAllowlist) ? names(discovered.projectedAllowlist)
    : Array.isArray(discovered.availableTools) ? names(selected.map(tool => tool.projectedName).filter(Boolean)) : null
  if (tools === null) return null
  // The adapter calls the raw MCP name. Only an actually discovered AND selected
  // tool of its declared provider can establish that alias, never a guessed prefix.
  for (const adapter of adapters.filter(item => item.connectorId === connector.id)) {
    for (const def of adapter.definitions) {
      if (selected.some(tool => tool.rawName === def.function.name && tools.includes(tool.projectedName))) tools.push(def.function.name)
    }
  }
  return names(tools)
}

/** Metadata-only descriptors; no handler is installed or executed by preflight. */
function connectorToolDefinition(name, connectorId) {
  return {
    type: 'function',
    function: { name, description: 'Confirmed connector projection', parameters: { type: 'object', properties: {} } },
    _knowme: {
      source: 'connector', connectorId, capability: 'connector', risk: 'external', sideEffects: true,
      requiresApproval: true, scope: 'external', timeoutMs: 30000,
      idempotencySupported: false, rollbackSupported: false,
    },
  }
}

/**
 * Check the union of confirmed providers with the same registry/governance projection as execution.
 * Always-present builtins are explicit real definitions. Conditional tools require provider discovery;
 * readiness or a package's claimed tool names alone never establishes availability.
 * This does not perform tools, create artifacts, open sessions, or change authorization.
 */
async function preflightExpertTools({ snapshot, connectorIds = [], requiredTools = [], hostCapabilities = {}, getConnectorsApi, signal, timeoutMs, probeTimeoutMs } = {}) {
  if (signal?.aborted) return { ok: false, cancelled: true, issues: [] }
  const required = names(requiredTools)
  const mandatoryIds = names(connectorIds)
  const boundIds = names(snapshot?.bindings?.connectors)
  const permissions = snapshot?.capabilityManifest?.permissions || {}
  const permittedIds = permissions.connectors?.allowedConnectorIds
  const allowedIds = boundIds.filter(id => !Array.isArray(permittedIds) || permittedIds.includes(id))
  const issues = mandatoryIds.filter(id => !allowedIds.includes(id)).map(id => ({
    id, code: 'scope_denied', message: boundIds.includes(id) ? '连接器未获得当前任务权限' : '连接器未绑定到当前专家',
  }))
  if (issues.length) return { ok: false, issues }

  const registry = createRegistry()
  const adapters = [IMAGE_PROVIDER_ADAPTER].filter(adapter => required.includes(adapter.requiredTool) && allowedIds.includes(adapter.connectorId))
  // Only mandatory connectors and declared provider adapters can explain why a
  // required route is unavailable. Other bound connectors are optional
  // capabilities; surfacing their health here makes a focused failure look as
  // if unrelated tools (for example Photoshop) are also required.
  const relevantProviderIds = new Set([
    ...mandatoryIds,
    ...adapters.map(adapter => adapter.connectorId),
  ])
  // Host-owned builtins are shared with the production run surface. A research
  // expert must not be rejected before the actual tool surface is built.
  const { definitions: builtinDefinitions } = buildHostBuiltinDefinitions({
    signal,
    requiredTools: required,
  })
  for (const def of builtinDefinitions) registry.registerTool(def, def._knowme)
  for (const def of ARTIFACT_TOOL_DEFS) registry.registerTool(def, BUILTIN_CONTRACT.artifact)
  const fileReadAvailable = hostCapabilities.fileRead === true
  const fileWriteAvailable = hostCapabilities.fileWrite === true
  const processAvailable = hostCapabilities.process === true
  if (fileReadAvailable) {
    for (const def of READ_TOOL_DEFS) registry.registerTool(def, BUILTIN_CONTRACT.read)
  }
  if (fileWriteAvailable) {
    for (const def of WRITE_TOOL_DEFS) registry.registerTool(def, BUILTIN_CONTRACT.write)
  }
  if (processAvailable) {
    for (const def of PROCESS_TOOL_DEFS) registry.registerTool(def, BUILTIN_CONTRACT.process)
  }
  // Skill tools are host-owned runtime capabilities. Register the same
  // definitions that the production run surface exposes so a required skill
  // script is not mistaken for an unowned connector tool during preflight.
  const skillDefinitions = (SKILL_TOOL_DEFINITIONS || [])
    .filter(def => required.includes(def?.function?.name))
  for (const def of skillDefinitions) registry.registerTool(def, def._knowme)
  const builtinNames = new Set([
    ...agentTools.createToolSurface().getToolDefinitions(), ...builtinDefinitions, ...skillDefinitions,
  ].map(def => def.function.name))
  const conditionalHostNames = new Set([
    ...READ_TOOL_DEFS, ...WRITE_TOOL_DEFS, ...PROCESS_TOOL_DEFS,
  ].map(def => def.function.name))
  // Optional bindings can own a required tool without being mandatory dependencies.
  // An unrelated offline optional connector must not veto a complete union.
  const candidateIds = names([...mandatoryIds, ...(required.some(name => !builtinNames.has(name) && !conditionalHostNames.has(name)) ? allowedIds : [])])
  const providerIssues = []
  if (candidateIds.length) {
    const api = typeof getConnectorsApi === 'function' ? getConnectorsApi() : null
    if (!api || typeof api.getConnectorStatus !== 'function') {
      return { ok: false, issues: [{ id: candidateIds[0], code: 'tool_projection_unavailable', message: '连接器检查服务不可用，请稍后重试' }] }
    }
    const waitContext = createPreflightWait({ signal, timeoutMs, probeTimeoutMs })
    let providers
    try {
      providers = await Promise.all(candidateIds.map(async id => {
        try {
          const result = await waitContext.wait(() => api.getConnectorStatus(id), 'status', id)
          const connector = result?.connector
          const status = connector?.status || {}
          let message = ''
          if (!result?.ok || !connector || connector.id !== id) message = result?.message || '连接器不存在或身份不匹配'
          else if (connector.enabled !== true || connector.agentVisible === false) message = '连接器未启用'
          else if (status.state === 'auth_required' || status.userReady === false) message = '连接器尚未完成用户授权'
          else if (status.ok === false || ['offline', 'error'].includes(String(status.state || '').toLowerCase())) message = status.message || '连接器当前不可用'
          if (message) return { issue: { id, code: 'connector_unavailable', message } }
          const tools = required.length ? await connectorProjection(api, connector, adapters, waitContext) : []
          if (tools === null) return { issue: { id, code: 'tool_projection_unavailable', message: '无法确认连接器实际工具投影，请重新检查连接器工具权限' } }
          return { id, tools }
        } catch (error) {
          if (error?.code === 'preflight_cancelled') throw error
          if (error?.code === 'preflight_timeout') return { issue: {
            id, code: error.code, stage: error.stage, retryable: true, message: error.message,
          } }
          return { issue: { id, code: 'connector_unavailable', message: String(error?.message || error || '连接器状态检查失败').slice(0, 180) } }
        }
      }))
      if (waitContext.signal.aborted) {
        const reason = waitContext.signal.reason
        if (reason?.code === 'preflight_cancelled') return { ok: false, cancelled: true, issues: [] }
        return { ok: false, issues: [{ id: 'preflight', code: reason.code, stage: 'overall', retryable: true, message: reason.message }] }
      }
    } catch (error) {
      if (error?.code === 'preflight_cancelled') return { ok: false, cancelled: true, issues: [] }
      throw error
    } finally { waitContext.close() }
    for (const provider of providers) {
      if (provider.issue) { providerIssues.push(provider.issue); continue }
      for (const name of provider.tools) {
        // A connector cannot impersonate an always-present builtin.
        if (builtinNames.has(name)) continue
        const adapterDef = adapters.find(adapter => adapter.connectorId === provider.id)?.definitions.find(def => def.function.name === name)
        const def = adapterDef
          ? { ...adapterDef, _knowme: { ...adapterDef._knowme, connectorId: provider.id } }
          : connectorToolDefinition(name, provider.id)
        registry.registerTool(def, def._knowme)
      }
    }
  }
  issues.push(...providerIssues.filter(issue => mandatoryIds.includes(issue.id) && issue.code !== 'tool_projection_unavailable'))
  const governancePolicy = buildRunGovernancePolicy({ permissions, expertSnapshot: snapshot, allowedConnectorIds: allowedIds })
  const { surface } = buildToolSurfaceFromRegistry(registry, { governancePolicy, requiredTools: required })
  const unavailable = required.filter(name => !surface.isAllowedTool(name))
  issues.push(...unavailable.map(name => {
    if (conditionalHostNames.has(name) && !registry.has(name)) {
      const writeRequired = WRITE_TOOL_DEFS.some(def => def.function.name === name)
        || PROCESS_TOOL_DEFS.some(def => def.function.name === name)
      return {
        id: name,
        code: writeRequired && fileReadAvailable ? 'workspace_read_only' : 'workspace_unavailable',
        message: writeRequired && fileReadAvailable
          ? `「${name}」是 KnowMe 内置工具，但当前项目目录不可写`
          : `「${name}」是 KnowMe 内置工具，请先选择可用的项目目录`,
      }
    }
    return {
      id: name, code: registry.has(name) ? 'scope_denied' : 'required_tool_unavailable',
      message: registry.has(name) ? `必需工具未获得当前任务权限：${name}` : `联合工具面未提供必需工具：${name}`,
    }
  }))
  if (unavailable.length) {
    issues.push(...providerIssues.filter(issue => relevantProviderIds.has(issue.id) && !issues.includes(issue)))
  }
  issues.push(...registry.getRegistrationIssues().filter(issue => required.includes(issue.name)).map(issue => ({
    id: issue.name, code: issue.code, message: `必需工具存在重复归属：${issue.name}`,
  })))
  return { ok: issues.length === 0, issues }
}

module.exports = { preflightExpertTools }
