'use strict'

// Host-authored planning records provide instructions, not source evidence.
// Legacy tasks used type=text for these records, so retain their stable IDs.
const CONTROL_IDS = new Set(['clarification-record', 'confirmed-plan', 'user-plan-confirmation'])

function isTaskControlMaterial(item) {
  return Boolean(item && typeof item === 'object'
    && (CONTROL_IDS.has(item.id) || item.type === 'user_confirmation'))
}

module.exports = { isTaskControlMaterial }
