const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  DEFAULT_MESSAGES,
  isAuthErrorCode,
  extractDaemonErrorCode,
  extractDaemonErrorMessage,
  parseDaemonError,
} = require('../src/lib/workbench-daemon-errors')

describe('workbench daemon error envelope', () => {
  it('reads detail.code and detail.message from v1 envelope', () => {
    const body = { detail: { code: 'task_not_found', message: '任务不存在：demo-x' } }
    assert.equal(extractDaemonErrorCode(body), 'task_not_found')
    assert.equal(extractDaemonErrorMessage(body, 'fallback'), '任务不存在：demo-x')
    const parsed = parseDaemonError(body, 404)
    assert.equal(parsed.code, 'task_not_found')
    assert.equal(parsed.message, '任务不存在：demo-x')
    assert.equal(parsed.status, 404)
  })

  it('falls back to catalog default when message missing', () => {
    const parsed = parseDaemonError({ detail: { code: 'slug_invalid' } }, 422)
    assert.equal(parsed.code, 'slug_invalid')
    assert.equal(parsed.message, DEFAULT_MESSAGES.slug_invalid)
  })

  it('normalizes unauthorized to auth_required and keeps daemonCode', () => {
    const parsed = parseDaemonError({
      detail: { code: 'unauthorized', message: '授权失败，请重新登录' },
    }, 401)
    assert.equal(parsed.code, 'auth_required')
    assert.equal(parsed.daemonCode, 'unauthorized')
    assert.equal(isAuthErrorCode('unauthorized'), true)
  })

  it('does not rewrite permission codes to auth_required', () => {
    for (const code of ['task_forbidden', 'tenant_forbidden', 'forbidden']) {
      const parsed = parseDaemonError({
        detail: { code, message: DEFAULT_MESSAGES[code] },
      }, 403)
      assert.equal(parsed.code, code)
    }
  })

  it('supports legacy string detail and top-level code', () => {
    const legacy = parseDaemonError({ detail: '需要授权码登录' }, 403, 'fallback', {
      isAuthFailure: () => true,
    })
    assert.equal(legacy.code, 'auth_required')
    assert.match(legacy.message, /授权/)

    const top = parseDaemonError({ code: 'ingest_required', message: '缺材料' }, 422)
    assert.equal(top.code, 'ingest_required')
    assert.equal(top.message, '缺材料')
  })
})
