'use strict'

const mcpHost = require('./mcp-host')
const normalize = require('./connectors/normalize')
const runtimeConfig = require('./connectors/runtime-config')

const MCP_DEFINITION_TTL_MS = 5 * 60 * 1000
const mcpDefinitionCache = new Map()

function mcpDefinitionCacheKey(connectorId, mcp) {
  return `${String(connectorId || '')}::${mcpHost.mcpConfigKey(mcp)}::${JSON.stringify(mcp?.allowlist || [])}`
}

function listEnabledMcpConnectors(connectors = []) {
  return (connectors || []).filter(
    (c) => c
      && c.type === 'mcp'
      && c.enabled
      && c.agentVisible !== false
      && (String(c.mcp?.command || '').trim() || String(c.mcp?.url || '').trim()),
  )
}

function detectSanitizedIdCollisions(connectors) {
  const bySanitized = new Map()
  const conflicts = []
  for (const conn of connectors) {
    const sanitized = mcpHost.sanitizeConnectorId(conn.id)
    const prev = bySanitized.get(sanitized)
    if (prev && prev !== conn.id) {
      conflicts.push({
        code: 'sanitized_id_conflict',
        message: `连接器 ID "${prev}" 与 "${conn.id}" 规范化后均为 "${sanitized}"，Agent 工具命名空间冲突`,
        sanitizedConnectorId: sanitized,
        connectorIds: [prev, conn.id],
      })
    } else {
      bySanitized.set(sanitized, conn.id)
    }
  }
  return conflicts
}

function detectProjectedNameCollisions(projectedDefinitions) {
  const seen = new Map()
  const conflicts = []
  for (const def of projectedDefinitions) {
    const name = def?.function?.name
    if (!name) continue
    const prev = seen.get(name)
    const connectorId = def?._knowme?.connectorId || ''
    if (prev) {
      conflicts.push({
        code: 'tool_name_conflict',
        message: `Agent 工具名 "${name}" 被多个连接器投影（${prev} 与 ${connectorId}）`,
        agentToolName: name,
        connectorIds: [prev, connectorId],
      })
    } else {
      seen.set(name, connectorId)
    }
  }
  return conflicts
}

function publicMcpConfigView(mcp = {}) {
  return {
    transport: mcp.transport || (mcp.url ? 'streamable-http' : 'stdio'),
    command: mcp.command || '',
    url: mcp.url || '',
    args: [...(mcp.args || [])],
    cwd: mcp.cwd || '',
    envKeys: [...(mcp.envKeys || [])],
  }
}

/**
 * Ephemeral health probe — does not keep client in registry.
 */
async function probeMcpHealth(mcpConfig = {}, opts = {}) {
  const transport = mcpConfig.transport || (mcpConfig.url ? 'streamable-http' : 'stdio')
  const configured = transport === 'stdio'
    ? String(mcpConfig.command || '').trim()
    : String(mcpConfig.url || '').trim()
  if (!configured) {
    return {
      ok: false,
      state: 'unconfigured',
      message: transport === 'stdio' ? '请填写 MCP Server 启动命令' : '请填写 MCP Server URL',
      toolsCount: 0,
    }
  }
  const session = mcpHost.createMcpSessionForTransport(mcpConfig, opts)
  try {
    const listed = await session.listTools()
    if (!listed.ok) {
      return {
        ok: false,
        state: 'error',
        message: listed.message || 'MCP 健康检查失败',
        code: listed.code || 'mcp_error',
        toolsCount: 0,
      }
    }
    return {
      ok: true,
      state: 'online',
      message: `MCP 在线，发现 ${listed.tools.length} 个工具`,
      toolsCount: listed.tools.length,
    }
  } finally {
    await session.close()
  }
}

/**
 * Tools preview DTO for Hub drawer — same projection rules as Agent surface.
 */
async function previewMcpTools(connector, opts = {}) {
  const conn = connector || {}
  const allowlist = normalize.clampAllowlist(conn.allowlist)
  const mcpView = publicMcpConfigView(conn.mcp || {})
  const base = {
    ok: true,
    connectorId: conn.id,
    allowlist: [...allowlist],
    mcp: mcpView,
    tools: [],
    projectedAllowlist: [],
  }

  const transport = conn.mcp?.transport || (conn.mcp?.url ? 'streamable-http' : 'stdio')
  if (!(transport === 'stdio' ? String(conn.mcp?.command || '').trim() : String(conn.mcp?.url || '').trim())) {
    return {
      ...base,
      ok: false,
      code: 'unconfigured',
      message: transport === 'stdio' ? '请填写 MCP Server 启动命令' : '请填写 MCP Server URL',
    }
  }

  const listed = opts.cachedTools
    ? { ok: true, tools: opts.cachedTools }
    : await (async () => {
      const session = mcpHost.createMcpSessionForTransport(conn.mcp, opts)
      try {
        return await session.listTools()
      } finally {
        await session.close()
      }
    })()

  if (!listed.ok) {
    return {
      ...base,
      ok: false,
      code: listed.code || 'mcp_error',
      message: listed.message || '无法列出 MCP 工具',
    }
  }

  const projected = mcpHost.projectMcpTools(listed.tools, allowlist, conn.id)
  const projectedAllowlist = projected.map((d) => d.function.name)
  const allow = new Set(allowlist)
  const tools = (listed.tools || []).slice(0, 64).map((t) => {
    const rawName = String(t?.name || '')
    const projectedName = mcpHost.buildMcpAgentToolName(conn.id, rawName)
    return {
      rawName,
      projectedName,
      description: String(t?.description || rawName).slice(0, 500),
      allowlisted: allow.size > 0 && allow.has(rawName),
      projected: allow.size > 0 && allow.has(rawName),
      policy: runtimeConfig.resolveToolPolicy(conn, rawName),
    }
  })

  return {
    ...base,
    tools,
    projectedAllowlist,
    allToolCount: listed.tools.length,
  }
}

/**
 * Allowlist editor DTO — available tools + current selection, no secrets.
 */
async function buildMcpAllowlistDto(connector, opts = {}) {
  const preview = await previewMcpTools(connector, opts)
  if (!preview.ok) return preview
  return {
    ok: true,
    connectorId: preview.connectorId,
    allowlist: preview.allowlist,
    projectedAllowlist: preview.projectedAllowlist,
    mcp: preview.mcp,
    availableTools: preview.tools.map((t) => ({
      rawName: t.rawName,
      projectedName: t.projectedName,
      description: t.description,
      selected: preview.allowlist.includes(t.rawName),
    })),
  }
}

async function getCachedOrListedTools(connectorId, conn, session, opts = {}) {
  const cacheKey = mcpDefinitionCacheKey(connectorId, {
    ...conn.mcp,
    allowlist: conn.allowlist,
  })
  const cached = mcpDefinitionCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < MCP_DEFINITION_TTL_MS) {
    return { ok: true, tools: cached.tools, fromCache: true }
  }
  const listed = await session.listTools()
  if (listed.ok) {
    mcpDefinitionCache.set(cacheKey, { createdAt: Date.now(), tools: listed.tools })
    while (mcpDefinitionCache.size > 48) {
      const oldest = mcpDefinitionCache.keys().next().value
      mcpDefinitionCache.delete(oldest)
    }
  }
  return listed
}

/**
 * Project all enabled MCP connectors into Agent tool definitions + handlers.
 */
async function buildMcpAgentProjection(connectors = [], opts = {}) {
  const registry = opts.registry || mcpHost.defaultRegistry
  const ephemeral = opts.ephemeralSessions === true
  const enabled = listEnabledMcpConnectors(connectors)
  const idConflicts = detectSanitizedIdCollisions(enabled)
  if (idConflicts.length) {
    return {
      ok: false,
      code: 'sanitized_id_conflict',
      message: idConflicts[0].message,
      conflicts: idConflicts,
      definitions: [],
      handlers: {},
      sessions: [],
    }
  }

  const definitions = []
  const handlers = {}
  const sessions = []
  const partialErrors = []

  for (const conn of enabled) {
    const allowlist = normalize.clampAllowlist(conn.allowlist)
    if (allowlist.length === 0) continue

    let session
    try {
      if (ephemeral) {
        const runtimeOptions = typeof opts.resolveRuntimeOptions === 'function'
          ? opts.resolveRuntimeOptions(conn)
          : {}
        session = mcpHost.createMcpSessionForTransport(conn.mcp, {
          ...opts,
          ...runtimeOptions,
        })
      } else {
        const runtimeOptions = typeof opts.resolveRuntimeOptions === 'function'
          ? opts.resolveRuntimeOptions(conn)
          : {}
        session = await registry.connect(conn.id, conn.mcp, {
          ...opts,
          ...runtimeOptions,
        })
      }
    } catch (err) {
      partialErrors.push({
        connectorId: conn.id,
        code: 'connect_failed',
        message: String(err?.message || err).slice(0, 400),
      })
      continue
    }

    sessions.push({ connectorId: conn.id, session, ephemeral })

    const listed = await getCachedOrListedTools(conn.id, conn, session, opts)
    if (!listed.ok) {
      partialErrors.push({
        connectorId: conn.id,
        code: listed.code || 'mcp_error',
        message: listed.message || '无法列出 MCP 工具',
      })
      continue
    }

    const projected = mcpHost.projectMcpTools(listed.tools, allowlist, conn.id)
    for (const def of projected) {
      def._knowme = {
        ...def._knowme,
        ...runtimeConfig.toolContractFor(conn, def._knowme.rawToolName),
      }
      definitions.push(def)
      const rawToolName = def._knowme.rawToolName
      const agentName = def.function.name
      handlers[agentName] = async (args) => session.callTool(rawToolName, args)
    }
  }

  const nameConflicts = detectProjectedNameCollisions(definitions)
  if (nameConflicts.length) {
    await closeMcpSessions(sessions, { registry, keepRegistry: !ephemeral })
    return {
      ok: false,
      code: 'tool_name_conflict',
      message: nameConflicts[0].message,
      conflicts: nameConflicts,
      definitions: [],
      handlers: {},
      sessions: [],
      partialErrors,
    }
  }

  return {
    ok: true,
    definitions,
    handlers,
    sessions,
    partialErrors,
  }
}

async function closeMcpSessions(sessions = [], opts = {}) {
  const registry = opts.registry || mcpHost.defaultRegistry
  const keepRegistry = opts.keepRegistry === true
  for (const entry of sessions) {
    if (entry.ephemeral || !keepRegistry) {
      try { await entry.session.close() } catch { /* ignore */ }
    }
  }
}

async function onConnectorEnabled(connectorId, mcpConfig = {}, opts = {}) {
  const registry = opts.registry || mcpHost.defaultRegistry
  const transport = mcpConfig.transport || (mcpConfig.url ? 'streamable-http' : 'stdio')
  const configured = transport === 'stdio'
    ? String(mcpConfig?.command || '').trim()
    : String(mcpConfig?.url || '').trim()
  if (!configured) return { ok: false, code: 'unconfigured' }
  await registry.connect(connectorId, mcpConfig, opts)
  return { ok: true }
}

async function onConnectorDisabled(connectorId, opts = {}) {
  const registry = opts.registry || mcpHost.defaultRegistry
  await registry.disconnect(connectorId)
  return { ok: true }
}

async function onConnectorRemoved(connectorId, opts = {}) {
  return onConnectorDisabled(connectorId, opts)
}

function clearMcpDefinitionCache() {
  mcpDefinitionCache.clear()
}

module.exports = {
  MCP_DEFINITION_TTL_MS,
  listEnabledMcpConnectors,
  detectSanitizedIdCollisions,
  detectProjectedNameCollisions,
  publicMcpConfigView,
  probeMcpHealth,
  previewMcpTools,
  buildMcpAllowlistDto,
  buildMcpAgentProjection,
  closeMcpSessions,
  onConnectorEnabled,
  onConnectorDisabled,
  onConnectorRemoved,
  clearMcpDefinitionCache,
}
