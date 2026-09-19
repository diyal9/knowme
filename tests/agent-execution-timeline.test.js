'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { userStatusLabel } = require('../src/domain/agent-execution-timeline')

describe('agent execution timeline failures', () => {
  it('surfaces a failed single-step tool instead of saying it is still running', () => {
    assert.equal(userStatusLabel('调用工具：mcp.demo.search', 'error'), '处理未完成')
  })
})
