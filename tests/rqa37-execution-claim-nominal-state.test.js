'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const grounding = require('../src/lib/agent-grounding-ledger')

function verify(text, taskFrame = null) {
  return grounding.verifyClaims({
    text,
    evidenceLedger: grounding.createEvidenceLedger(),
    toolLedger: grounding.createToolLedger(),
    taskFrame,
  })
}

describe('RQA37 nominal deleted-state boundary', () => {
  it('does not turn deleted-state requirements into unreceipted delete operations', () => {
    for (const text of [
      'R4：已删除文档的正文不可读取。该规则可独立验收。',
      '文档进入“已删除”状态后，仅保留审计字段。',
      '如果文档已删除，业务角色不得读取正文。',
      '即使文档已删除了，业务角色仍不得读取正文。',
      '| 状态 | 已删除 | 正文不可见 |',
    ]) {
      const result = verify(text)
      assert.equal(result.passed, true, JSON.stringify(result))
    }
  })

  it('still blocks actual delete-completion claims without tool receipts', () => {
    for (const text of ['我已删除文档。', '我们已经删除记录。', '本次操作已删除数据。']) {
      const result = verify(text)
      assert.equal(result.passed, false, text)
      assert.ok(result.violations.some(item => item.code === 'unsupported_execution_claim'), text)
    }
  })

  it('still enforces a declared delete-tool contract for implicit result wording', () => {
    const result = verify('文档已删除。', { requiredTools: ['delete_document'] })
    assert.equal(result.passed, false)
    assert.ok(result.violations.some(item => item.code === 'missing_required_tools'))
  })

  it('does not confuse third-party lifecycle states with Agent tool execution', () => {
    for (const text of [
      '服务端已删除旧授权后，客户端必须拒绝缓存命中。',
      '客户端已保存的许可过期后，不得继续打开正文。',
      '如果迁移已执行，回退也不能恢复旧授权。',
      '```text\n系统已删除授权\n```\n以上只是失效时序示例。',
    ]) {
      const result = verify(text)
      assert.equal(result.passed, true, JSON.stringify(result))
    }
  })

  it('still blocks explicit first-person completion claims in analytical prose', () => {
    for (const text of ['我已执行迁移。', '我们已保存配置。', '本次操作已删除授权。']) {
      const result = verify(text)
      assert.equal(result.passed, false, text)
      assert.ok(result.violations.some(item => item.code === 'false_execution_claim'), text)
    }
  })

  it('does not turn planned preflight or test conditions into current execution receipts', () => {
    for (const text of [
      '预检：确认依赖已安装，再进入导出步骤。',
      '执行前检查是否已创建目标目录，否则停止并报告。',
      '测试前置条件：已保存草稿；动作：模拟请求超时。',
      '可观察结果：重试脚本已执行一次，且没有第二次调用。',
    ]) {
      const result = verify(text)
      assert.equal(result.passed, true, JSON.stringify(result))
    }
  })

  it('still blocks first-person verification of completed operations without receipts', () => {
    for (const text of [
      '我已经确认依赖已安装。',
      '我们本次检查后确认已创建目录。',
    ]) {
      const result = verify(text)
      assert.equal(result.passed, false, text)
      assert.ok(result.violations.some(item => item.code === 'false_execution_claim'), text)
    }
  })
})
