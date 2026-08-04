'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { buildToolFailureHint } = require('../src/lib/agent-tool-failure-hint')

describe('buildToolFailureHint', () => {
  it('returns empty when there are no error entries', () => {
    assert.equal(buildToolFailureHint([]), '')
    assert.equal(buildToolFailureHint([{ status: 'done', text: 'ok' }]), '')
  })

  it('humanizes Feishu Internal error JSON instead of dumping log_id', () => {
    const raw = JSON.stringify({
      ok: false,
      identity: 'user',
      error: {
        type: 'api',
        subtype: 'unknown',
        code: 1,
        message: 'Internal error. Please retry.',
        log_id: '20260803081835B1DF3557B80',
      },
    })
    const hint = buildToolFailureHint([{ status: 'error', text: raw }])
    assert.match(hint, /飞书接口暂时故障/)
    assert.equal(/log_id|Internal error|"ok"\s*:\s*false/.test(hint), false)
    assert.equal(/请根据报错修正后重试/.test(hint), false)
  })

  it('keeps auth failures distinct from transient API faults', () => {
    const hint = buildToolFailureHint([{ status: 'error', text: '飞书用户身份未授权：请先完成 user 授权' }])
    assert.match(hint, /权限或身份不足/)
  })
})
