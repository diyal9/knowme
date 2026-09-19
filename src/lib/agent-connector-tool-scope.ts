'use strict'

const { projectedToolNames } = require('./connectors/normalize')
const { sanitizeConnectorId } = require('./mcp-host-names')

function connectorIdForTool(toolName, contract = {}) {
  // Older Feishu contracts predate connectorId; their namespace still belongs to Feishu.
  if (contract.source === 'feishu' || String(toolName).startsWith('feishu.')) return 'feishu'
  return String(contract.connectorId || contract.mcpConnectorId || '')
}

function connectorToolEnabled(toolName, contract, connectors) {
  const id = connectorIdForTool(toolName, contract)
  if (!id) return !['connector', 'mcp'].includes(contract?.source)
  if (!Array.isArray(connectors)) return true
  const connector = connectors.find(row => row.id === id)
  if (!connector || connector.enabled === false || connector.agentVisible === false) return false
  // This exact host-only namespace/contract is not a remote operation. Remote MCP
  // records are rebuilt under mcp.<id>.<rawName> with rawToolName by projectMcpTools.
  if (connector.type === 'mcp' && contract?.source === 'mcp' && contract.mcpSchemaLoader === true
    && toolName === `mcp_load_${sanitizeConnectorId(id)}` && contract.capability === `mcp-schema:${id}`
    && !contract.rawToolName && contract.risk === 'read' && contract.sideEffects === false
    && contract.requiresApproval === false) {
    return Array.isArray(connector.allowlist) && connector.allowlist.length > 0
  }
  if (id === 'feishu' && Array.isArray(connector.allowlist)) {
    return projectedToolNames({ ...connector, enabled: true }).includes(toolName)
  }
  if (connector.type === 'mcp' && Array.isArray(connector.allowlist)) {
    return connector.allowlist.includes(contract?.rawToolName || toolName)
      || connector.allowlist.includes(toolName)
  }
  return true
}

module.exports = { connectorIdForTool, connectorToolEnabled }
