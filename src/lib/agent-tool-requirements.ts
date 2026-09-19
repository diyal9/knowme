'use strict'

// `write_file` is the host-level file delivery capability. A model may choose
// the more precise create/patch operation after inspecting the workspace; all
// three produce the same reviewable file artifact and satisfy that capability.
const WRITE_FILE_OPERATIONS = new Set(['write_file', 'create_file', 'apply_patch'])

function matchesRequiredTool(actualName, requiredName) {
  const actual = String(actualName || '').trim()
  const required = String(requiredName || '').trim()
  if (!actual || !required) return false
  if (actual === required) return true
  return required === 'write_file' && WRITE_FILE_OPERATIONS.has(actual)
}

module.exports = { matchesRequiredTool, WRITE_FILE_OPERATIONS }
