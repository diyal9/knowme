'use strict'

const store = require('./store')
const normalize = require('./normalize')
const { probeFeishuStatus } = require('./feishu-status')
const { planFeishuScopeRequest, summarizeFeishuCapabilityReadiness } = require('./feishu-auth')

function createConnectorsApi(deps = {}) {
  const getUserData = typeof deps.getUserData === 'function'
    ? deps.getUserData
    : () => ''
  const probeFeishu = typeof deps.probeFeishu === 'function'
    ? deps.probeFeishu
    : probeFeishuStatus

  function listConnectors() {
    const connectors = store.loadConnectors(getUserData())
    return {
      ok: true,
      connectors: connectors.map((c) => normalize.publicConnectorView(c)),
      note: 'Connector SDK：只读工具按白名单执行；平台写入必须经草稿人审确认',
    }
  }

  async function getConnectorStatus(connectorId) {
    const connectors = store.loadConnectors(getUserData())
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
        connector: normalize.publicConnectorView(conn, adjusted),
      }
    }

    if (conn.type === 'mcp') {
      const cmd = conn.mcp?.command || ''
      const status = cmd
        ? {
            ok: true,
            state: conn.enabled ? 'configured' : 'disabled',
            message: conn.enabled ? '已配置 MCP 命令（Host Story 负责拉起）' : '已配置但未启用',
            command: cmd,
          }
        : {
            ok: false,
            state: 'unconfigured',
            message: '请填写 MCP Server 启动命令',
            command: '',
          }
      return { ok: true, connector: normalize.publicConnectorView(conn, status) }
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
    const list = store.upsertConnector(getUserData(), patch)
    return { ok: true, connectors: list.map((c) => normalize.publicConnectorView(c)) }
  }

  function setAllowlist(connectorId, allowlist) {
    const result = store.setAllowlist(getUserData(), connectorId, allowlist)
    return {
      ...result,
      connectors: (result.connectors || []).map((c) => normalize.publicConnectorView(c)),
    }
  }

  function getProjectedAllowlist() {
    const connectors = store.loadConnectors(getUserData())
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
    getProjectedAllowlist,
    loadConnectors: () => store.loadConnectors(getUserData()),
  }
}

module.exports = {
  createConnectorsApi,
  store,
  normalize,
  probeFeishuStatus,
}
