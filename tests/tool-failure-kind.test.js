'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { classifyToolFailure } = require('../src/lib/tool-failure-kind')
const { buildToolFailureHint } = require('../src/lib/agent-tool-failure-hint')
const { buildRecoveryPlan } = require('../src/lib/agent-recovery')

test('authentication, authorization, approval and uncertain execution are distinct', () => {
  for (const [code, kind] of Object.entries({ token_expired: 'authentication', scope_denied: 'authorization',
    approval_required: 'operation_approval', invalid_args: 'arguments', unknown_tool: 'capability_missing',
    tool_timeout: 'temporarily_unavailable', outcome_unknown: 'execution_uncertain', verification_failed: 'evidence_insufficient' })) {
    assert.equal(classifyToolFailure({ ok: false, code, text: '权限 参数 network' }), kind)
  }
  assert.equal(classifyToolFailure({ ok: true, code: 'token_expired' }), null)
})

test('uncertain writes verify before retry even when an idempotency flag was merely declared', () => {
  const result = { ok: false, code: 'tool_timeout', executionStarted: true }
  const plan = buildRecoveryPlan({ result, contract: { sideEffects: true, risk: 'write', idempotencySupported: true } })
  assert.equal(plan.action, 'verify_result')
  assert.equal(plan.retry, false)
  assert.equal(classifyToolFailure({ ...result, executionStarted: false }, { sideEffects: true }), 'temporarily_unavailable')
})

test('authentication and uncertainty show next steps without exposing raw diagnostics', () => {
  assert.match(buildToolFailureHint([{ status: 'error', code: 'token_expired', text: 'secret' }]), /重新认证/)
  const hint = buildToolFailureHint([{ status: 'error', code: 'execution_uncertain', text: 'secret' }])
  assert.match(hint, /不能直接重放/)
  assert.doesNotMatch(hint, /secret|补充文档/)
})
