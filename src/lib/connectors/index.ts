'use strict'

const store = require('./store')
const normalize = require('./normalize')
const { createUnifiedConnectorStore } = require('./unified-store')
const { probeFeishuStatus } = require('./feishu-status')
const { planFeishuScopeRequest, summarizeFeishuCapabilityReadiness } = require('./feishu-auth')
const { createConnectorSecretStore } = require('./secret-store')
const runtimeConfig = require('./runtime-config')
const connectorCaps = require('../connector-capabilities')
const { createCapabilityStore } = require('../capability-store')

function createConnectorsApi(deps = {}) {
  const getUserData = typeof deps.getUserData === 'function'
    ? deps.getUserData
    : () => ''
  const probeFeishu = typeof deps.probeFeishu === 'function'
    ? deps.probeFeishu
    : probeFeishuStatus
  const connectorStore = deps.connectorStore || createUnifiedConnectorStore({
    getUserData,
    mode: deps.storeMode,
  })
  const secretStore = deps.secretStore || createConnectorSecretStore({
    getUserData,
    safeStorage: deps.safeStorage,
  })
  const capabilityStore = deps.capabilityStore || createCapabilityStore({ getUserData })
  let migrated = false

  function ensureMigrated() {
    if (!migrated) {
      connectorStore.migrateLegacy()
      migrated = true
    }
  }

  function listConnectors() {
    ensureMigrated()
    const connectors = connectorStore.loadConnectors()
    return {
      ok: true,
      connectors: connectors.map((c) => normalize.publicConnectorView(c, null, secretStore.configuredKeys(c.id))),
      note: 'Connector SDK：只读工具按白名单执行；平台写入必须经草稿人审确认',
    }
  }

  async function getConnectorStatus(connectorId) {
    ensureMigrated()
    const connectors = connectorStore.loadConnectors()
    const conn = connectors.find((c) => c.id === String(connectorId || '').trim())
    if (!conn) return { ok: false, code: 'not_found', message: '连接器不存在' }

    if (conn.type === 'feishu') {
      const status = await probeFeishu()
      const projectedAllowlist = normalize.projectedToolNames(conn)
      const needsUserIdentity = projectedAllowlist.some((name) => normalize.feishuToolNeedsUserIdentity(name))
      const adjusted = { ...status }
      if (needsUserIdentity && !status.userReady) {
        adjusted.ok = false
        adjusted.state = 'auth_required'
        adjusted.message = '当前飞书能力需要用户身份授权（user）'
      }
      if (adjusted.permissions) {
        adjusted.capabilities = {
          docsKb: summarizeFeishuCapabilityReadiness(adjusted.permissions, 'docs_kb'),
          officeCore: summarizeFeishuCapabilityReadiness(adjusted.permissions, 'office_core'),
          todayPriority: summarizeFeishuCapabilityReadiness(adjusted.permissions, 'today_priority'),
        }
      }
      // The settings page runs in the renderer and cannot require this module,
      // so the authorization plan travels with the status payload.
      adjusted.permissionPlan = planFeishuScopeRequest(adjusted.permissions)
      adjusted.projectedAllowlist = projectedAllowlist
      return {
        ok: true,
        connector: normalize.publicConnectorView(conn, adjusted, secretStore.configuredKeys(conn.id)),
      }
    }

    if (conn.type === 'mcp') {
      const configuredKeys = secretStore.configuredKeys(conn.id)
      const readiness = runtimeConfig.configurationState(conn, configuredKeys)
      let status = { ok: readiness.ready, ...readiness }
      if (readiness.ready) {
        const secrets = secretStore.resolveSecrets(conn.id)
        const runtimeOptions = runtimeConfig.buildRuntimeOptions(conn, secrets)
        const live = await connectorCaps.probeMcpHealth(conn.mcp, {
          ...runtimeOptions,
          fetchImpl: deps.fetchImpl,
          spawnImpl: deps.spawnImpl,
          timeoutMs: deps.probeTimeoutMs || conn.healthCheck?.timeoutMs,
        })
        status = live.ok
          ? live
          : { ...live, state: 'offline', remediation: '确认服务已启动、地址/命令正确，然后重新测试连接' }
      }
      return { ok: true, connector: normalize.publicConnectorView(conn, status, configuredKeys) }
    }

    return {
      ok: true,
      connector: normalize.publicConnectorView(conn, {
        ok: false,
        state: 'unknown',
        message: '未知连接器类型',
      }),
    }
  }

  function upsertConnector(patch) {
    ensureMigrated()
    const list = connectorStore.upsertConnector(patch)
    if (!Array.isArray(list)) return list
    return { ok: true, connectors: list.map((c) => normalize.publicConnectorView(c, null, secretStore.configuredKeys(c.id))) }
  }

  function setAllowlist(connectorId, allowlist) {
    ensureMigrated()
    const result = connectorStore.setAllowlist(connectorId, allowlist)
    return {
      ...result,
      connectors: (result.connectors || []).map((c) => normalize.publicConnectorView(c, null, secretStore.configuredKeys(c.id))),
    }
  }

  async function setSecrets(connectorId, secrets) {
    ensureMigrated()
    const conn = connectorStore.loadConnectors().find((item) => item.id === String(connectorId || '').trim())
    if (!conn) return { ok: false, code: 'not_found', message: '连接器不存在' }
    const allowed = new Set((conn.secretSlots || []).map((slot) => slot.key))
    const filtered = {}
    for (const [key, value] of Object.entries(secrets || {})) {
      if (allowed.has(key)) filtered[key] = value
    }
    const result = secretStore.setSecrets(conn.id, filtered)
    if (!result.ok) return result
    await connectorCaps.onConnectorDisabled(conn.id)
    return {
      ok: true,
      connector: normalize.publicConnectorView(conn, null, result.configuredKeys),
    }
  }

  async function getConnectorTools(connectorId) {
    ensureMigrated()
    const conn = connectorStore.loadConnectors().find((item) => item.id === String(connectorId || '').trim())
    if (!conn) return { ok: false, code: 'not_found', message: '连接器不存在' }
    if (conn.type !== 'mcp') return { ok: false, code: 'unsupported', message: '该连接器不支持 MCP 工具发现' }
    const configuredKeys = secretStore.configuredKeys(conn.id)
    const readiness = runtimeConfig.configurationState(conn, configuredKeys)
    if (!readiness.ready) return { ok: false, code: readiness.state, message: readiness.message, tools: [] }
    const runtimeOptions = runtimeConfig.buildRuntimeOptions(conn, secretStore.resolveSecrets(conn.id))
    return connectorCaps.buildMcpAllowlistDto(conn, {
      ...runtimeOptions,
      fetchImpl: deps.fetchImpl,
      spawnImpl: deps.spawnImpl,
      timeoutMs: deps.probeTimeoutMs || conn.healthCheck?.timeoutMs,
    })
  }

  function listConnectorReferences(connectorId) {
    const id = String(connectorId || '').trim()
    const entries = capabilityStore.listEntries({ installedOnly: true }).entries || []
    const references = []
    for (const entry of entries) {
      if (entry.id === id) continue
      const dependencies = entry.manifest?.dependencies || entry.dependencies || []
      const dependency = dependencies.find((dep) => dep.kind === 'connector' && dep.id === id)
      if (dependency) references.push({ id: entry.id, kind: entry.kind, name: entry.name || entry.id, required: dependency.required !== false })
    }
    try {
      const workflows = deps.getWorkflowStore?.()?.list?.()?.packages || []
      for (const workflow of workflows) {
        const dependencies = [
          ...(Array.isArray(workflow.connectorDependencies) ? workflow.connectorDependencies : []),
          ...(Array.isArray(workflow.dependencies) ? workflow.dependencies.filter((dep) => dep?.kind === 'connector') : []),
        ]
        const dependency = dependencies.find((dep) => String(dep?.id || dep) === id)
        if (dependency) references.push({ id: workflow.id, kind: 'workflow', name: workflow.name || workflow.id, required: dependency.required !== false })
      }
    } catch { /* workflow store is optional during early boot */ }
    return { ok: true, connectorId: id, references }
  }

  function resolveRuntimeOptions(connector) {
    return runtimeConfig.buildRuntimeOptions(connector, secretStore.resolveSecrets(connector.id))
  }

  function getProjectedAllowlist() {
    ensureMigrated()
    const connectors = connectorStore.loadConnectors()
    const names = []
    for (const conn of connectors) {
      names.push(...normalize.projectedToolNames(conn))
    }
    return [...new Set(names)]
  }

  return {
    listConnectors,
    getConnectorStatus,
    upsertConnector,
    setAllowlist,
    setSecrets,
    getConnectorTools,
    listConnectorReferences,
    resolveRuntimeOptions,
    setEnabled: (id, enabled) => connectorStore.setEnabled(id, enabled),
    removeConnector: (id) => {
      const result = connectorStore.removeConnector(id)
      if (result.ok) secretStore.removeConnector(id)
      return result
    },
    migrateLegacy: () => connectorStore.migrateLegacy(),
    getProjectedAllowlist,
    loadConnectors: () => {
      ensureMigrated()
      return connectorStore.loadConnectors()
    },
    connectorStore,
    secretStore,
  }
}

module.exports = {
  createConnectorsApi,
  store,
  createUnifiedConnectorStore,
  normalize,
  probeFeishuStatus,
}
