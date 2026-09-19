'use strict'

/**
 * Host-owned builtin tool contract.
 *
 * The task preflight and the production run surface must agree on which tools
 * are supplied by KnowMe itself. Keep the factory here so adding a host tool
 * does not silently create a second, stale registry in preflight.
 */

const agentWebTools = require('./agent-web-tools')
const { buildCalculationTools } = require('./agent-calculation-tools')
const {
  CAPABILITY_IMPORT_DEFINITIONS,
  requiresCapabilityImportTools,
} = require('./agent-provider-tool-contracts')

function buildHostBuiltinBundles({ signal, noTools = false, includeWeb = true } = {}) {
  return {
    calculationTools: noTools ? null : buildCalculationTools(),
    webTools: noTools || !includeWeb ? null : agentWebTools.buildWebTools({ signal }),
  }
}

function buildHostBuiltinDefinitions({ signal, requiredTools = [], noTools = false, includeWeb = true } = {}) {
  const bundles = buildHostBuiltinBundles({ signal, noTools, includeWeb })
  const definitions = [
    ...(bundles.calculationTools?.definitions || []),
    ...(bundles.webTools?.definitions || []),
    ...(requiresCapabilityImportTools(requiredTools) ? CAPABILITY_IMPORT_DEFINITIONS : []),
  ]
  return { ...bundles, definitions }
}

module.exports = {
  buildHostBuiltinBundles,
  buildHostBuiltinDefinitions,
}
