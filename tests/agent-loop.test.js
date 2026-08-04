'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const loop = require('../src/lib/agent-loop')

describe('agent-loop', () => {
  it('creates the same key for reordered JSON arguments', () => {
    assert.equal(
      loop.toolCallKey('search_knowledge', '{"query":"x","page":1}'),
      loop.toolCallKey('search_knowledge', '{"page":1,"query":"x"}'),
    )
  })

  it('finalizes when a tool call repeats', () => {
    assert.equal(loop.shouldFinalize({
      round: 2,
      maxRounds: 4,
      toolCallCount: 2,
      maxToolCalls: 6,
      repeatedCall: true,
    }), true)
  })

  it('finalizes at the round or tool budget', () => {
    assert.equal(loop.shouldFinalize({
      round: 4,
      maxRounds: 4,
      toolCallCount: 1,
      maxToolCalls: 6,
    }), true)
    assert.equal(loop.shouldFinalize({
      round: 2,
      maxRounds: 4,
      toolCallCount: 6,
      maxToolCalls: 6,
    }), true)
  })
})
