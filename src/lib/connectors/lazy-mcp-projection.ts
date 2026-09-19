'use strict'

const mcpHost = require('../mcp-host')
const caps = require('../connector-capabilities')
const runtimeConfig = require('./runtime-config')
const { snapshotToolArgs, executionFingerprint } = require('../tool-execution-approval')
const { fetchConnectorHttp } = require('./http-boundary')
const { sanitizeConnectorId } = require('../mcp-host-names')

const schemaCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

function clearLazyMcpSchemaCache() { schemaCache.clear() }

async function boundedDiscovery(action, timeoutMs) {
  let timer
  try {
    return await Promise.race([action(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('MCP 工具发现超时'), { code: 'mcp_timeout' })), timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}

/** Cold connectors expose metadata loaders only; selection is the first I/O. */
async function buildLazyMcpProjection(connectors = [], opts = {}) {
  const enabled = caps.listEnabledMcpConnectors(connectors)
  const conflicts = caps.detectSanitizedIdCollisions(enabled)
  const conflictingIds = new Set(conflicts.flatMap(item => item.connectorIds))
  const partialErrors = conflicts.map(item => ({ ...item, connectorId: item.connectorIds.join(',') }))
  const projected = await Promise.all(enabled.filter(conn => !conflictingIds.has(conn.id)).map(async original => {
    const conn = snapshotToolArgs(original)
    if (!Array.isArray(conn.allowlist) || !conn.allowlist.length) return null
    let session = null
    let connecting = null
    let released = false
    let abandoned = false
    let loading = null
    const ephemeral = opts.ephemeralSessions === true
    // Runtime credentials are not part of the legacy global registry's key.
    // A private registry prevents reusing another run's authenticated client.
    const registry = opts.registry || mcpHost.createMcpHostRegistry()
    const close = async () => {
      released = true
      const current = session
      session = null
      if (current) {
        if (ephemeral) await current.close()
        else await registry.disconnect(conn.id)
      }
    }
    try {
      const runtime = opts.resolveRuntimeOptions?.(conn) || {}
      // Hash secrets and permission policy; never cache or expose their values.
      const env = Object.fromEntries((conn.mcp?.envKeys || []).map(key => [key, process.env[key] || '']))
      const key = executionFingerprint({ userData: opts.userData || '', connector: conn, runtime, env })
      const assertCurrent = () => {
        const latest = opts.resolveCurrentConnector?.(conn.id)
        if (opts.resolveCurrentConnector && (!latest || !latest.enabled || latest.agentVisible === false
          || executionFingerprint(latest) !== executionFingerprint(conn))) {
          throw Object.assign(new Error('连接器配置或权限已改变'), { code: 'connector_configuration_changed' })
        }
        const currentRuntime = opts.resolveRuntimeOptions?.(conn) || {}
        if (executionFingerprint({ userData: opts.userData || '', connector: conn, runtime: currentRuntime,
          env: Object.fromEntries((conn.mcp?.envKeys || []).map(key => [key, process.env[key] || ''])) }) !== key) {
          throw Object.assign(new Error('连接器配置或凭据已改变，请刷新工具列表'), { code: 'connector_configuration_changed' })
        }
      }
      const connect = async () => {
        assertCurrent()
        const currentRuntime = opts.resolveRuntimeOptions?.(conn) || {}
        if (session) return session
        if (!connecting) connecting = (async () => {
          const sessionOptions = { ...opts, ...currentRuntime,
            ...(conn.mcp?.url ? { fetchImpl: (target, init) => fetchConnectorHttp(conn.mcp.url, target, init, opts.fetchImpl) } : {}) }
          session = ephemeral
            ? mcpHost.createMcpSessionForTransport(conn.mcp, sessionOptions)
            : await registry.connect(conn.id, conn.mcp, sessionOptions)
          if (abandoned) {
            await close()
            throw Object.assign(new Error('MCP 工具发现已结束'), { code: 'mcp_timeout' })
          }
          return session
        })().finally(() => { connecting = null })
        return connecting
      }
      const project = tools => {
        const definitions = mcpHost.projectMcpTools(snapshotToolArgs(tools), conn.allowlist, conn.id)
        if (caps.detectProjectedNameCollisions(definitions).length) {
          throw Object.assign(new Error('MCP 工具名称冲突'), { code: 'tool_name_conflict' })
        }
        const handlers = {}
        for (const def of definitions) {
          const rawName = def._knowme.rawToolName
          def._knowme = { ...def._knowme, ...runtimeConfig.toolContractFor(conn, rawName), executionTarget: key, mcpSchemaLoader: false }
          handlers[def.function.name] = async (args, signal) => {
            try {
              if (signal?.aborted) return { ok: false, code: 'cancelled', text: 'MCP 调用已取消。' }
              const active = await connect()
              if (signal?.aborted) return { ok: false, code: 'cancelled', text: 'MCP 调用已取消。' }
              return await active.callTool(rawName, args)
            } catch (error) {
              return { ok: false, code: error?.code || 'mcp_unavailable', text: 'MCP 连接器调用失败，请检查连接后重试。' }
            } finally {
              // A user may approve a pending call after its model surface closes.
              if (released || signal?.aborted) await close()
            }
          }
        }
        return { definitions, handlers }
      }
      let cached = schemaCache.get(key)
      if (cached && Date.now() - cached.createdAt >= CACHE_TTL_MS) { schemaCache.delete(key); cached = null }
      const bundle = cached ? project(cached.tools) : { definitions: [], handlers: {} }
      if (!cached) {
        const name = `mcp_load_${sanitizeConnectorId(conn.id)}`
        const contract = { source: 'mcp', capability: `mcp-schema:${conn.id}`, connectorId: conn.id,
          mcpSchemaToolNames: conn.allowlist.map(String),
          mcpSchemaLoader: true, executionTarget: key, risk: 'read', sideEffects: false, requiresApproval: false,
          scope: 'external', timeoutMs: Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 15000,
          idempotencySupported: false, rollbackSupported: false }
        bundle.definitions.push({ type: 'function', function: { name,
          description: `加载 MCP 连接器 ${String(conn.name || conn.id).slice(0, 80)}（${conn.id}）：${conn.allowlist.slice(0, 8).join(', ').slice(0, 120)}。仅选中此入口才连接并加载已授权 schema，不执行远端操作；更多名称可 discover_tools 搜索。`,
          parameters: { type: 'object', properties: {}, additionalProperties: false } }, _knowme: contract })
        let loaded = null
        const checkScope = async (signal, ctx) => {
          if (signal?.aborted || ctx.signal?.aborted || released) throw Object.assign(new Error('MCP 加载已取消'), { code: 'cancelled' })
          assertCurrent()
          if (ctx.runId || ctx.sessionId) {
            const permitted = await ctx.validateExecutionApproval?.({ toolName: name, args: {}, contract,
              runId: ctx.runId || '', sessionId: ctx.sessionId || '' })
            if (permitted?.ok !== true) throw Object.assign(new Error('连接器范围已撤销'), {
              code: permitted?.code || 'scope_denied',
              scopeReason: permitted?.reason || 'unknown',
            })
          }
          if (signal?.aborted || released) throw Object.assign(new Error('MCP 加载已取消'), { code: 'cancelled' })
          assertCurrent()
        }
        bundle.handlers[name] = async (_args, signal, ctx = {}) => {
          try {
            await checkScope(signal, ctx)
            if (!loaded && !loading) loading = (async () => {
              let schema = schemaCache.get(key)
              if (!schema || Date.now() - schema.createdAt >= CACHE_TTL_MS) {
                const listed = await boundedDiscovery(async () => (await connect()).listTools(), contract.timeoutMs)
                if (!listed?.ok) throw Object.assign(new Error('无法列出工具'), { code: listed?.code || 'mcp_error' })
                schema = { tools: snapshotToolArgs(listed.tools || []), createdAt: Date.now() }
              }
              await checkScope(signal, ctx)
              const activated = project(schema.tools)
              const registered = opts.onToolsLoaded?.(activated)
              if (registered?.ok === false) throw Object.assign(new Error('工具注册失败'), { code: registered.code || 'tool_conflict' })
              schemaCache.set(key, schema)
              while (schemaCache.size > 48) schemaCache.delete(schemaCache.keys().next().value)
              bundle.definitions.push(...activated.definitions)
              Object.assign(bundle.handlers, activated.handlers)
              loaded = activated.definitions.map(def => def.function.name)
            })().finally(() => { loading = null })
            if (loading) await loading
            await checkScope(signal, ctx)
            const names = loaded.slice(0, 16)
            return { ok: true, text: `已加载 ${loaded.length} 个工具：${names.join(', ')}。下一轮可调用；更多工具请用 discover_tools 搜索或分页。`,
              meta: { connectorId: conn.id, loadedToolNames: names, totalTools: loaded.length } }
          } catch (error) {
            if (error?.code === 'mcp_timeout') abandoned = true
            try { await close() } catch { /* selected connector only */ }
            const failureCode = error?.code || 'mcp_unavailable'
            const scopeReason = String(error?.scopeReason || '')
            console.warn(`[lazy-mcp] schema loader failed connector=${conn.id} code=${failureCode}${scopeReason ? ` reason=${scopeReason}` : ''}`)
            return { ok: false, code: failureCode, text: '所选 MCP 连接器加载失败，请检查连接、配置或授权；其他连接器不受影响。',
              meta: { connectorId: conn.id, failureCode, ...(scopeReason ? { scopeReason } : {}) } }
          }
        }
      }
      return { ...bundle, session: { connectorId: conn.id, ephemeral: true, session: { close } } }
    } catch (error) {
      abandoned = true
      try { await close() } catch { /* isolate cleanup failures as well */ }
      partialErrors.push({ connectorId: conn.id, code: error?.code || 'mcp_unavailable', message: 'MCP 连接器发现失败，请检查配置或连接。' })
      return null
    }
  }))
  const successful = projected.filter(Boolean)
  const definitions = successful.flatMap(item => item.definitions)
  const handlers = Object.assign({}, ...successful.map(item => item.handlers))
  const sessions = successful.map(item => item.session)
  const nameConflicts = caps.detectProjectedNameCollisions(definitions)
  if (nameConflicts.length) {
    await caps.closeMcpSessions(sessions)
    return { ok: false, code: 'tool_name_conflict', message: 'MCP 工具名称冲突', conflicts: nameConflicts, definitions: [], handlers: {}, sessions: [], partialErrors }
  }
  return { ok: true, get definitions() { return successful.flatMap(item => item.definitions) },
    get handlers() { return Object.assign({}, ...successful.map(item => item.handlers)) }, sessions, partialErrors }
}

module.exports = { buildLazyMcpProjection, clearLazyMcpSchemaCache }
