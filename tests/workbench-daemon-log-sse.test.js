'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const sse = require('../src/lib/workbench-daemon-log-sse')

describe('workbench-daemon-log-sse', () => {
  it('parses data lines and done events across chunk boundaries', () => {
    let state = sse.feedDaemonLogSse('', 'data: hello\n\n')
    assert.deepEqual(state.events, [{ type: 'line', data: 'hello' }])
    state = sse.feedDaemonLogSse(state.buffer, 'data: wor')
    assert.equal(state.events.length, 0)
    state = sse.feedDaemonLogSse(state.buffer, 'ld\n\nevent: done\ndata: end\n\n')
    assert.deepEqual(state.events, [
      { type: 'line', data: 'world' },
      { type: 'done', data: 'end' },
    ])
  })

  it('ignores comment pings', () => {
    const state = sse.feedDaemonLogSse('', ': ping\n\ndata: keep\n\n')
    assert.deepEqual(state.events, [{ type: 'line', data: 'keep' }])
  })

  it('detects near-bottom scroll', () => {
    assert.equal(sse.isNearBottom({ scrollHeight: 100, scrollTop: 60, clientHeight: 40 }, 48), true)
    assert.equal(sse.isNearBottom({ scrollHeight: 500, scrollTop: 0, clientHeight: 40 }, 48), false)
  })

  it('merges and appends log text without shrinking', () => {
    assert.equal(sse.appendLogLine('a\nb', 'c'), 'a\nb\nc')
    assert.equal(sse.mergeLogFullText('a\nb', 'a\nb\nc'), 'a\nb\nc')
    assert.equal(sse.mergeLogFullText('a\nb\nc', 'a\nb'), 'a\nb\nc')
    assert.equal(sse.countLogLines('a\n\nb\n'), 2)
  })

  it('builds stable review signatures', () => {
    const a = sse.reviewLogsSignature('p', 'l1\nl2')
    const b = sse.reviewLogsSignature('p\r\n', 'l1\r\nl2')
    assert.equal(a, b)
  })
})
