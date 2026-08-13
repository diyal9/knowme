'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { humanizeAgentError } = require('../src/lib/agent-error-humanize')
const { assertRequiredDeps } = require('../src/lib/ipc-assert-deps')
const { mergeExtraTools } = require('../src/lib/merge-extra-tools')

describe('agent-error-humanize', () => {
  it('strips Electron IPC wrapper and ReferenceError for chat UI', () => {
    const raw = "Error invoking remote method 'ai-generate': ReferenceError: buildTemporalAnchorContext is not defined"
    assert.equal(humanizeAgentError(raw), '暂时无法完成回复，请重试')
  })

  it('keeps product-facing Chinese guidance', () => {
    assert.equal(
      humanizeAgentError('未填写 API Key，请托盘右键 → API 设置'),
      '未填写 API Key，请托盘右键 → API 设置',
    )
  })

  it('maps network failures', () => {
    assert.equal(humanizeAgentError(new Error('fetch failed: ETIMEDOUT')), '网络异常，请检查连接后重试')
  })
})

describe('ipc-assert-deps', () => {
  it('passes when all required deps exist', () => {
    assert.equal(assertRequiredDeps({ a: 1, b: () => {} }, ['a', 'b'], 'test'), true)
  })

  it('throws listing missing keys', () => {
    assert.throws(
      () => assertRequiredDeps({ a: 1 }, ['a', 'b', 'c'], 'ai-generate'),
      /\[ai-generate\] missing required deps: b, c/,
    )
  })
})

describe('merge-extra-tools', () => {
  it('keeps first definition on name conflict', () => {
    const first = {
      definitions: [{ function: { name: 'foo' } }],
      handlers: { foo: () => 'a' },
    }
    const second = {
      definitions: [{ function: { name: 'foo' } }, { function: { name: 'bar' } }],
      handlers: { foo: () => 'b', bar: () => 'c' },
    }
    const merged = mergeExtraTools(first, second)
    assert.equal(merged.definitions.length, 2)
    assert.equal(merged.handlers.foo(), 'a')
    assert.equal(merged.handlers.bar(), 'c')
  })
})
