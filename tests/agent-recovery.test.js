'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const recovery = require('../src/lib/agent-recovery')

describe('agent-recovery classifyToolError', () => {
  it('keeps canonical failure codes authoritative over conflicting prose', () => {
    for (const text of ['参数已发送，但连接超时', 'permission cancelled argument', '已取消，请调整参数']) {
      assert.equal(recovery.classifyToolError({ ok: false, code: 'tool_timeout', text }), 'timeout')
      assert.equal(recovery.classifyToolError({ ok: false, code: 'ECONNRESET', text }), 'network')
      assert.equal(recovery.classifyToolError({ ok: false, code: 'cancelled', text }), 'cancelled')
    }
  })

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
    assert.equal(
      recovery.classifyToolError({ ok: false, code: 'pango_no_image', text: '生图工具未返回图片' }),
      'empty_result',
    )
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

  it('uses longer exponential backoff for timeout category', () => {
    assert.deepEqual(recovery.planRetry({ category: 'timeout', attempt: 0, maxRetries: 2 }), { retry: true, delayMs: 2000 })
    assert.deepEqual(recovery.planRetry({ category: 'timeout', attempt: 1, maxRetries: 2 }), { retry: true, delayMs: 4000 })
    assert.deepEqual(recovery.planRetry({ category: 'network', attempt: 1, maxRetries: 2 }), { retry: true, delayMs: 800 })
  })

  it('formats timeout and retry summaries for timeline', () => {
    assert.match(recovery.formatToolTimeoutSummary({ argsSummary: '{cwd}', timeoutSec: 45 }), /超时（45s）/)
    assert.match(
      recovery.formatToolRetrySummary({ argsSummary: '{cwd}', attempt: 1, delayMs: 2000, reason: 'timeout' }),
      /超时，2s 后第 1 次重试/,
    )
  })

  it('planRetry respects explicit base/cap overrides', () => {
    assert.deepEqual(
      recovery.planRetry({ category: 'timeout', attempt: 0, maxRetries: 2, base: 100, cap: 500 }),
      { retry: true, delayMs: 100 },
    )
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

  it('normalizes common file-tool aliases without guessing values', () => {
    assert.deepEqual(
      recovery.suggestParamCorrection('create_file', {
        file_path: 'landing/index.html',
        html: '<main>KnowMe</main>',
      }, 'invalid_args'),
      { path: 'landing/index.html', content: '<main>KnowMe</main>' },
    )
    assert.deepEqual(
      recovery.suggestParamCorrection('write_file', {
        file: { path: 'landing/app.js', body: 'console.log("ready")' },
      }, 'invalid_args'),
      { path: 'landing/app.js', content: 'console.log("ready")' },
    )
  })

  it('creates an automatic repair plan only for unexecuted safe argument failures', () => {
    const plan = recovery.buildRecoveryPlan({
      toolName: 'feishu.search_docs',
      result: { ok: false, code: 'invalid_args', executionStarted: false, text: '参数错误' },
      rawArgs: { query: 'x'.repeat(90), doc_token: '' },
      contract: { risk: 'read', sideEffects: false },
    })
    assert.equal(plan.action, 'repair_args')
    assert.equal(plan.automatic, true)
    assert.equal(plan.correctedArgs.query.length, 60)

    const writePlan = recovery.buildRecoveryPlan({
      toolName: 'write_doc',
      result: { ok: false, code: 'tool_timeout', executionStarted: true, text: '超时' },
      contract: { risk: 'write', sideEffects: true },
    })
    assert.equal(writePlan.retry, false)
    assert.equal(writePlan.action, 'verify_result')
    assert.equal(writePlan.failureKind, 'execution_uncertain')
  })
})

describe('agent-recovery reflection loop control', () => {
  it('reflects on unknown tools without mechanically retrying them or asking for missing arguments', () => {
    const failure = { status: 'error', toolName: 'analysis_skill', code: 'unknown_tool', text: '工具不存在，需要检查参数' }
    assert.equal(recovery.classifyToolError(failure), 'unknown_tool')
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failure] }), true)
    assert.equal(recovery.shouldAttemptRecovery({ failures: [failure], recoveryUsed: 2 }), false)
    assert.equal(recovery.planRetry({ category: 'unknown_tool' }).retry, false)
    assert.match(recovery.buildReflectionNote([failure]), /Skill/)
    assert.match(recovery.buildReflectionNote([failure]), /不是|不等于|≠/)
  })
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
