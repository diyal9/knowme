'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { buildToolFailureHint } = require('../src/lib/agent-tool-failure-hint')

describe('buildToolFailureHint', () => {
  it('does not expose unknown diagnostics or claim that a mentioned draft exists', () => {
    for (const text of ['upstream failed Authorization: Bearer private-key', '保存草稿失败：private-path', 'unexpected https://private.test/?token=secret']) {
      const hint = buildToolFailureHint([{ status: 'error', code: 'unknown', text }])
      assert.doesNotMatch(hint, /private|secret|已生成预览草稿/)
    }
  })
  it('keeps canonical transient failures distinct from permissions mentioned in prose', () => {
    const hint = buildToolFailureHint([{ status: 'error', code: 'tool_timeout', text: '检查权限后请求超时' }])
    assert.match(hint, /网络或服务/)
    assert.doesNotMatch(hint, /权限或身份不足|补充文档/)
  })
  it('does not blame missing user tokens for an unregistered Skill-shaped tool', () => {
    const hint = buildToolFailureHint([{ status: 'error', code: 'unknown_tool', text: '未注册工具: analysis_skill' }])
    assert.match(hint, /未注册|不可调用/)
    assert.doesNotMatch(hint, /补充文档 token|明确目标对象与参数/)
  })
  it('returns empty when there are no error entries', () => {
    assert.equal(buildToolFailureHint([]), '')
    assert.equal(buildToolFailureHint([{ status: 'done', text: 'ok' }]), '')
  })

  it('explains file argument failures without sending users to capability center', () => {
    const hint = buildToolFailureHint([{ status: 'error', code: 'invalid_args', toolName: 'create_file', text: '缺少必填参数: path' }])
    assert.match(hint, /文件工具 create_file/)
    assert.match(hint, /无需前往能力中心安装/)
    assert.doesNotMatch(hint, /文档 token|查询关键词/)
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
    assert.match(hint, /上游服务暂时故障/)
    assert.equal(/log_id|Internal error|"ok"\s*:\s*false/.test(hint), false)
    assert.equal(/请根据报错修正后重试/.test(hint), false)
  })

  it('keeps auth failures distinct from transient API faults', () => {
    const hint = buildToolFailureHint([{ status: 'error', text: '飞书用户身份未授权：请先完成 user 授权' }])
    assert.match(hint, /权限或身份不足/)
  })
})
