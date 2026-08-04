'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const recovery = require('../src/lib/agent-recovery')

describe('agent-recovery classifyToolError', () => {
  it('returns null for successful results', () => {
    assert.equal(recovery.classifyToolError({ ok: true, text: 'fine' }), null)
    assert.equal(recovery.classifyToolError({}), null)
  })

  it('detects per-minute ACL as minute_permission', () => {
    assert.equal(
      recovery.classifyToolError({ ok: false, text: 'No read permission for minute obcn4y6i54a' }),
      'minute_permission',
    )
  })

  it('detects auth/permission errors', () => {
    assert.equal(recovery.classifyToolError({ ok: false, text: '飞书用户身份未授权：请先完成 user 授权' }), 'permission')
    assert.equal(recovery.classifyToolError({ ok: false, text: 'HTTP 403 forbidden' }), 'permission')
  })

  it('detects invalid args', () => {
    assert.equal(recovery.classifyToolError({ ok: false, code: 'invalid_args', message: '需要非空 query' }), 'invalid_args')
  })

  it('detects timeout and network', () => {
    assert.equal(recovery.classifyToolError({ ok: false, code: 'tool_timeout', text: '工具执行超时' }), 'timeout')
    assert.equal(recovery.classifyToolError({ ok: false, text: 'connect ECONNREFUSED 127.0.0.1' }), 'network')
    assert.equal(
      recovery.classifyToolError({
        ok: false,
        text: '{"ok":false,"error":{"code":1,"message":"Internal error. Please retry.","log_id":"x"}}',
      }),
      'network',
    )
  })

  it('detects missing resource and empty result', () => {
    assert.equal(recovery.classifyToolError({ ok: false, text: 'ENOENT: no such file' }), 'missing_resource')
    assert.equal(recovery.classifyToolError({ ok: false, code: 'not_meeting_document', text: '拒绝总结无关文档' }), 'empty_result')
  })
})

describe('agent-recovery retry policy', () => {
  it('only retries network/timeout categories', () => {
    assert.equal(recovery.isRetryable('network'), true)
    assert.equal(recovery.isRetryable('timeout'), true)
    assert.equal(recovery.isRetryable('permission'), false)
    assert.equal(recovery.isRetryable('invalid_args'), false)
  })

  it('produces exponential backoff with a cap', () => {
    assert.equal(recovery.retryDelayMs(0, { base: 400, cap: 4000 }), 400)
    assert.equal(recovery.retryDelayMs(1, { base: 400, cap: 4000 }), 800)
    assert.equal(recovery.retryDelayMs(2, { base: 400, cap: 4000 }), 1600)
    assert.equal(recovery.retryDelayMs(20, { base: 400, cap: 4000 }), 4000)
  })

  it('stops retrying after maxRetries', () => {
    assert.deepEqual(recovery.planRetry({ category: 'network', attempt: 0, maxRetries: 2 }), { retry: true, delayMs: 400 })
    assert.equal(recovery.planRetry({ category: 'network', attempt: 2, maxRetries: 2 }).retry, false)
    assert.equal(recovery.planRetry({ category: 'permission', attempt: 0, maxRetries: 2 }).retry, false)
  })
})

describe('agent-recovery alternative tool + param correction', () => {
  it('routes a blocked meeting_read to the permission draft tool', () => {
    assert.equal(
      recovery.suggestAlternativeTool('feishu.meeting_read', 'minute_permission'),
      'feishu.draft_minute_permission',
    )
    assert.equal(recovery.suggestAlternativeTool('feishu.meeting_read', 'network'), null)
    assert.equal(recovery.suggestAlternativeTool('search_knowledge', 'minute_permission'), null)
  })

  it('trims overly long queries and drops empty params on invalid_args', () => {
    const long = 'x'.repeat(90)
    const fixed = recovery.suggestParamCorrection('feishu.search_docs', { query: long, doc_token: '' }, 'invalid_args')
    assert.ok(fixed)
    assert.equal(fixed.query.length, 60)
    assert.equal('doc_token' in fixed, false)
  })

  it('returns null when there is nothing to correct', () => {
    assert.equal(recovery.suggestParamCorrection('x', { query: 'short' }, 'invalid_args'), null)
    assert.equal(recovery.suggestParamCorrection('x', { query: 'anything' }, 'network'), null)
  })
})

describe('agent-recovery reflection loop control', () => {
  const failNet = { status: 'error', toolName: 'a', code: 'network', text: 'ECONNRESET' }
  const failPerm = { status: 'error', toolName: 'feishu.meeting_read', text: 'No read permission for minute z' }

  it('attempts recovery on recoverable failures within budget', () => {
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failNet], recoveryUsed: 0, maxRecovery: 2 }), true)
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failPerm], recoveryUsed: 0, maxRecovery: 2 }), true)
  })

  it('does not recover when budget exhausted or call repeated', () => {
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failNet], recoveryUsed: 2, maxRecovery: 2 }), false)
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failNet], recoveryUsed: 0, maxRecovery: 2, repeatedCall: true }), false)
  })

  it('does not recover when there are no error entries', () => {
    assert.equal(recovery.shouldAttemptRecovery({ failures: [{ status: 'done' }], recoveryUsed: 0 }), false)
    assert.equal(recovery.shouldAttemptRecovery({ failures: [], recoveryUsed: 0 }), false)
  })

  it('builds a reflection note that names the tool, category and alternative', () => {
    const note = recovery.buildReflectionNote([failPerm])
    assert.match(note, /feishu\.meeting_read/)
    assert.match(note, /minute_permission/)
    assert.match(note, /feishu\.draft_minute_permission/)
    assert.match(note, /不要用相同参数机械重试/)
  })

  it('returns an empty note when nothing failed', () => {
    assert.equal(recovery.buildReflectionNote([{ status: 'done' }]), '')
  })
})
