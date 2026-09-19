'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { requiresFeishuToolSurface } = require('../src/lib/agent-generate-prepare')

describe('Feishu workflow tool-surface routing', () => {
  it('projects the tool surface for fact-only Feishu workflows', () => {
    for (const intent of [
      { mentioned: true, asksRelatedChats: true },
      { mentioned: true, asksTodayPriority: true },
      { mentioned: true, asksDocKbSuggest: true },
    ]) {
      assert.equal(requiresFeishuToolSurface(intent), true)
    }
  })

  it('projects the connector for a corrective Feishu fetch follow-up', () => {
    assert.equal(requiresFeishuToolSurface({ mentioned: true, asksRelatedChats: true }), true)
  })

  it('does not project Feishu tools for unrelated chat', () => {
    assert.equal(requiresFeishuToolSurface({ mentioned: false, asksRelatedChats: true }), false)
    assert.equal(requiresFeishuToolSurface({ mentioned: true }), false)
  })
})
