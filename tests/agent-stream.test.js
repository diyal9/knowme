'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  createStreamAccumulator,
  feedSse,
  flushSse,
  applySsePayload,
  applyCompletionJson,
  getStreamSnapshot,
} = require('../src/lib/agent-stream')

function sseLine(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`
}

describe('agent-stream', () => {
  it('accumulates content deltas from SSE chunks', () => {
    const acc = createStreamAccumulator()
    feedSse(acc, sseLine({ choices: [{ delta: { content: '你' } }] }))
    feedSse(acc, sseLine({ choices: [{ delta: { content: '好' } }] }))
    const snap = getStreamSnapshot(acc)
    assert.equal(snap.content, '你好')
    assert.equal(snap.hasReasoning, false)
  })

  it('sets hasReasoning without exposing reasoning text', () => {
    const acc = createStreamAccumulator()
    feedSse(acc, sseLine({ choices: [{ delta: { reasoning_content: 'secret chain' } }] }))
    feedSse(acc, sseLine({ choices: [{ delta: { content: 'answer' } }] }))
    const snap = getStreamSnapshot(acc)
    assert.equal(snap.hasReasoning, true)
    assert.equal(snap.content, 'answer')
    assert.equal(JSON.stringify(snap).includes('secret chain'), false)
  })

  it('recognizes reasoning field alias', () => {
    const acc = createStreamAccumulator()
    applySsePayload(acc, { choices: [{ delta: { reasoning: 'hidden' } }] })
    assert.equal(getStreamSnapshot(acc).hasReasoning, true)
  })

  it('captures finish_reason and usage', () => {
    const acc = createStreamAccumulator()
    feedSse(acc, sseLine({ choices: [{ delta: { content: 'done' }, finish_reason: 'stop' }] }))
    feedSse(acc, sseLine({ usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 } }))
    const snap = getStreamSnapshot(acc)
    assert.equal(snap.finishReason, 'stop')
    assert.deepEqual(snap.usage, { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 })
  })

  it('merges fragmented tool_calls by index', () => {
    const acc = createStreamAccumulator()
    feedSse(acc, sseLine({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_abc',
            function: { name: 'search_', arguments: '{"query":"' },
          }],
        },
      }],
    }))
    feedSse(acc, sseLine({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { name: 'knowledge', arguments: '报销流程"}' },
          }],
        },
      }],
    }))
    feedSse(acc, sseLine({
      choices: [{
        delta: {
          tool_calls: [{
            index: 1,
            id: 'call_xyz',
            function: { name: 'search_knowledge', arguments: '{"query":"wiki"}' },
          }],
        },
      }],
    }))
    const snap = getStreamSnapshot(acc)
    assert.equal(snap.toolCalls.length, 2)
    assert.equal(snap.toolCalls[0].id, 'call_abc')
    assert.equal(snap.toolCalls[0].name, 'search_knowledge')
    assert.deepEqual(JSON.parse(snap.toolCalls[0].arguments), { query: '报销流程' })
    assert.equal(snap.toolCalls[1].id, 'call_xyz')
    assert.deepEqual(JSON.parse(snap.toolCalls[1].arguments), { query: 'wiki' })
  })

  it('handles split SSE lines across feedSse calls', () => {
    const acc = createStreamAccumulator()
    const payload = sseLine({ choices: [{ delta: { content: 'partial' } }] })
    feedSse(acc, payload.slice(0, 8))
    feedSse(acc, payload.slice(8))
    flushSse(acc)
    assert.equal(getStreamSnapshot(acc).content, 'partial')
  })

  it('applyCompletionJson supports non-SSE full response', () => {
    const acc = createStreamAccumulator()
    applyCompletionJson(acc, {
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: '',
          tool_calls: [{
            id: 'call_full',
            function: { name: 'search_knowledge', arguments: '{"query":"完整"}' },
          }],
        },
      }],
      usage: { total_tokens: 10 },
    })
    const snap = getStreamSnapshot(acc)
    assert.equal(snap.finishReason, 'tool_calls')
    assert.equal(snap.toolCalls.length, 1)
    assert.deepEqual(JSON.parse(snap.toolCalls[0].arguments), { query: '完整' })
    assert.equal(snap.usage.total_tokens, 10)
  })

  it('throws on provider error payload', () => {
    const acc = createStreamAccumulator()
    assert.throws(
      () => applySsePayload(acc, { error: { message: 'bad key' } }),
      (err) => err.message.includes('bad key')
    )
  })
})
