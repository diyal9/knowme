'use strict'

const { parseMcpAgentToolName, sanitizeConnectorId } = require('./mcp-host-names')
const { connectorToolEnabled } = require('./agent-connector-tool-scope')

/** A permitted schema dependency is not an available operation or execution receipt. */
function pendingRequiredMcpSchema(toolName, surface, state) {
  const target = parseMcpAgentToolName(toolName)
  if (!target || !state?.scope || state.scope.noTools) return null
  const policy = state.governancePolicy || {}
  if (policy.denylist?.includes(toolName)
    || (Array.isArray(policy.allowlist) && !policy.allowlist.includes(toolName))
    || (Array.isArray(policy.expertToolNames) && !policy.expertToolNames.includes(toolName))) return null
  for (const record of surface.getToolRecords()) {
    const contract = record._knowme || {}
    const id = contract.connectorId
    const loaderToolName = record.function.name
    if (!id || contract.source !== 'mcp' || contract.mcpSchemaLoader !== true
      || contract.capability !== `mcp-schema:${id}` || contract.rawToolName
      || contract.risk !== 'read' || contract.sideEffects !== false || contract.requiresApproval !== false
      || sanitizeConnectorId(id) !== target.sanitizedConnectorId
      || loaderToolName !== `mcp_load_${sanitizeConnectorId(id)}`) continue
    const connector = state.connectors?.find(row => row.id === id && row.type === 'mcp')
    if (!connector || !Array.isArray(connector.allowlist) || !connector.allowlist.includes(target.rawToolName)
      || !connectorToolEnabled(loaderToolName, contract, state.connectors)
      || !state.scope.decision('connectors', id).allowed
      || !surface.isAllowedTool(loaderToolName)) continue
    return { toolName, loaderToolName, connectorId: id, status: 'schema_required' }
  }
  return null
}

module.exports = { pendingRequiredMcpSchema }
