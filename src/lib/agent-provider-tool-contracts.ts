'use strict'

const { PANGO_CONNECTOR_ID, IMAGE_TOOL_DEFS } = require('./agent-image-tools')
const importTools = require('./agent-capability-import-tools')

// Provider identity and public adapter names are shared by execution and preflight.
// This module only reads definitions; it never resolves credentials or calls a provider.
const IMAGE_PROVIDER_ADAPTER = {
  requiredTool: 'generate_image',
  connectorId: PANGO_CONNECTOR_ID,
  definitions: IMAGE_TOOL_DEFS,
}

const CAPABILITY_IMPORT_DEFINITIONS = [
  importTools.PREVIEW_EXTERNAL_PROJECT, importTools.DESIGN_EXTERNAL_WORKFLOW_IMPORT,
  importTools.IMPORT_EXTERNAL_PROJECT, importTools.VERIFY_IMPORTED_WORKFLOW,
]

function requiresCapabilityImportTools(requiredTools = []) {
  return CAPABILITY_IMPORT_DEFINITIONS.some(def => requiredTools.includes(def.function.name))
}

module.exports = { IMAGE_PROVIDER_ADAPTER, CAPABILITY_IMPORT_DEFINITIONS, requiresCapabilityImportTools }
