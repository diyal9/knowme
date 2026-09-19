'use strict'
const { connectorIdForTool, connectorToolEnabled } = require('./agent-connector-tool-scope')

/** Recheck host state for every catalog read and immediately before dispatch. */
function guardCapabilityToolSurface(surface, getState) {
  const seenNames = new Set()
  // Registry activation may add tools after this guard and its executor were created.
  // Keep names for revoked-tool errors, but never retain old contracts as authority.
  const readRecords = () => {
    const records = new Map((surface.getToolRecords?.() || surface.getToolDefinitions()).map(def => [def.function.name, def]))
    for (const name of records.keys()) seenNames.add(name)
    return records
  }
  readRecords()
  const allowedIn = (name, records, state) => {
    if (!state?.scope || state.scope.noTools) return false
    const def = records.get(name)
    if (!def || !surface.isAllowedTool(name)) return false
    const policy = state.governancePolicy || {}
    if (policy.denylist?.includes(name)) return false
    if (Array.isArray(policy.allowlist) && !policy.allowlist.includes(name)) return false
    if (Array.isArray(policy.expertToolNames) && !policy.expertToolNames.includes(name)) return false
    const connectorId = connectorIdForTool(name, def._knowme)
    if (!connectorToolEnabled(name, def._knowme, state.connectors)) return false
    if (connectorId && Array.isArray(state.availableConnectorIds) && !state.availableConnectorIds.includes(connectorId)) return false
    return !connectorId || state.scope.decision('connectors', connectorId).allowed
  }
  const allowed = name => allowedIn(name, readRecords(), getState())
  const mayDispatch = name => {
    const records = readRecords()
    // Unknown names still use the underlying validator; newly activated names must
    // pass the host guard even when first encountered through direct execution.
    return !seenNames.has(name) || allowedIn(name, records, getState())
  }
  const denied = name => ({ ok: false, code: 'scope_denied', message: `工具授权已失效: ${name}`, text: `工具授权已失效: ${name}`, executionStarted: false })
  return {
    ...surface,
    getToolRecords: () => {
      const records = readRecords()
      const state = getState()
      return [...records.values()].filter(def => allowedIn(def.function.name, records, state))
    },
    getToolDefinitions: () => {
      const records = readRecords()
      const state = getState()
      return surface.getToolDefinitions().filter(def => allowedIn(def.function.name, records, state))
    },
    isAllowedTool: allowed,
    validateToolCall: (name, args) => mayDispatch(name) ? surface.validateToolCall(name, args) : denied(name),
    createToolExecutor: deps => {
      const executor = surface.createToolExecutor(deps)
      return {
        ...executor,
        isAllowedTool: allowed,
        validateToolCall: (name, args) => mayDispatch(name) ? executor.validateToolCall(name, args) : denied(name),
        executeToolCall: call => {
          const name = call?.name || call?.function?.name
          return mayDispatch(name) ? executor.executeToolCall(call) : Promise.resolve(denied(name))
        },
      }
    },
  }
}

module.exports = { guardCapabilityToolSurface }
