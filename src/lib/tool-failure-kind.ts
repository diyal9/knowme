'use strict'

/** Stable failure semantics; prose is not evidence of authorization or execution. */
function classifyToolFailure(result = {}, contract = {}) {
  if (result.ok !== false && result.status !== 'error') return null
  const code = String(result.code || '').toLowerCase()
  if (['approval_required', 'pending_review'].includes(code)) return 'operation_approval'
  if (['auth_expired', 'token_expired', 'invalid_token', 'authentication_required', 'unauthenticated', '401'].includes(code)) return 'authentication'
  if (['scope_denied', 'permission_denied', 'auth_required', 'capability_access_required', 'knowledge_scope_changed', 'knowledge_scope_denied', 'remote_query_denied'].includes(code)) return 'authorization'
  if (['invalid_args', 'invalid_params', 'validation_error'].includes(code)) return 'arguments'
  if (['unknown_tool', 'tool_unavailable', 'missing_tool_ref', 'connector_missing', 'rag_executor_missing'].includes(code)) return 'capability_missing'
  if (['execution_uncertain', 'outcome_unknown', 'empty_tool_result'].includes(code)) return 'execution_uncertain'
  if (['evidence_insufficient', 'verification_failed', 'missing_tool_evidence'].includes(code)) return 'evidence_insufficient'
  if (['network', 'network_error', 'tool_timeout', 'timeout', 'econnreset', 'econnrefused', 'enotfound', 'etimedout', 'service_unavailable'].includes(code)) {
    return contract.sideEffects === true && result.executionStarted !== false ? 'execution_uncertain' : 'temporarily_unavailable'
  }
  return null
}

module.exports = { classifyToolFailure }
