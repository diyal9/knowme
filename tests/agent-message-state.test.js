'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  PROTOCOL_VERSION,
  createMessageState,
  reduceMessageEvent,
  applyStateToMessage,
} = require('../src/lib/agent-message-state')

function evt(seq, type, payload = {}, extra = {}) {
  return {
    version: PROTOCOL_VERSION,
    runId: 'run_test',
    seq,
    lane: extra.lane || 'progress',
    type,
    payload,
    phase: extra.phase || 'MODEL',
    round: extra.round ?? 1,
  }
}

describe('agent-message-state', () => {
  it('creates preparing state for a run', () => {
    const state = createMessageState('run_a')
    assert.equal(state.runId, 'run_a')
    assert.equal(state.status, 'preparing')
    assert.equal(state.lastSeq, 0)
    assert.equal(state.answer.committed, false)
  })

  it('applies monotonic progress and tool timeline updates', () => {
    let state = createMessageState('run_test')
    let r = reduceMessageEvent(state, evt(1, 'stage', { id: 'stage_prepare', title: '准备', status: 'pending' }))
    assert.equal(r.changed, true)
    state = r.state
    r = reduceMessageEvent(state, evt(2, 'tool.started', {
      id: 'tool_c1',
      toolCallId: 'c1',
      toolName: 'search_knowledge',
      title: '搜索知识库',
      status: 'pending',
    }, { lane: 'tool' }))
    state = r.state
    assert.equal(state.timeline.length, 2)
    assert.equal(state.activity, '搜索知识库')

    r = reduceMessageEvent(state, evt(3, 'tool.completed', {
      id: 'tool_c1',
      toolCallId: 'c1',
      toolName: 'search_knowledge',
      title: '搜索知识库',
      status: 'done',
    }, { lane: 'tool' }))
    state = r.state
    assert.equal(state.timeline.find(t => t.id === 'tool_c1').status, 'done')
  })

  it('commits answer once and accepts ui lane', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'answer.committed', { text: '你好', hash: 'abc' }, { lane: 'answer' })).state
    state = reduceMessageEvent(state, evt(2, 'choice.ready', {
      ui: [{ kind: 'choice', title: '下一步', items: [{ label: '继续', action: 'send', payload: 'go' }] }],
    }, { lane: 'ui' })).state
    assert.equal(state.answer.committed, true)
    assert.equal(state.answer.text, '你好')
    assert.equal(state.ui.length, 1)

    const dup = reduceMessageEvent(state, evt(2, 'answer.committed', { text: '覆盖', hash: 'zzz' }, { lane: 'answer' }))
    assert.equal(dup.changed, false)
    assert.equal(state.answer.text, '你好')
  })

  it('ignores duplicate and late seq events', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'stage', { id: 's1', title: 'A', status: 'pending' })).state
    state = reduceMessageEvent(state, evt(2, 'stage', { id: 's2', title: 'B', status: 'pending' })).state
    const dup = reduceMessageEvent(state, evt(2, 'stage', { id: 's2b', title: 'B2', status: 'pending' }))
    assert.equal(dup.changed, false)
    assert.equal(state.counters.duplicate, 1)
    const late = reduceMessageEvent(state, evt(1, 'stage', { id: 's0', title: 'Z', status: 'pending' }))
    assert.equal(late.changed, false)
    assert.equal(state.counters.late, 1)
  })

  it('records seq gap without rejecting the next event', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'stage', { id: 's1', title: 'A', status: 'pending' })).state
    const gap = reduceMessageEvent(state, evt(3, 'stage', { id: 's3', title: 'C', status: 'pending' }))
    assert.equal(gap.changed, true)
    assert.equal(gap.state.counters.gap, 1)
    assert.equal(gap.state.lastSeq, 3)
  })

  it('freezes after terminal and rejects unsupported version', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'run.completed', { title: '完成' }, { lane: 'terminal' })).state
    assert.equal(state.frozen, true)
    assert.equal(state.status, 'completed')
    const ignored = reduceMessageEvent(state, evt(2, 'stage', { id: 'late', title: '晚到', status: 'pending' }))
    assert.equal(ignored.changed, false)

    state = createMessageState('run_bad')
    const bad = reduceMessageEvent(state, { version: 1, runId: 'run_bad', seq: 1, type: 'stage', payload: {} })
    assert.equal(bad.state.frozen, true)
    assert.equal(bad.state.status, 'failed')
  })

  it('keeps pending review actionable after terminal', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'tool.completed', {
      id: 'tool_write',
      title: '写入文件',
      status: 'done',
      requiresApproval: true,
      draftId: 'draft_1',
      draftStatus: 'pending_review',
    }, { lane: 'tool' })).state
    state = reduceMessageEvent(state, evt(2, 'run.completed', { title: '完成' }, { lane: 'terminal' })).state
    const row = state.timeline.find(item => item.id === 'tool_write')
    assert.equal(row.requiresApproval, true)
    assert.equal(row.draftId, 'draft_1')
    assert.equal(row.draftStatus, 'pending_review')
    assert.equal(row.status, 'done')
  })

  it('maps reducer state onto chat message fields', () => {
    let state = createMessageState('run_test')
    state = reduceMessageEvent(state, evt(1, 'answer.committed', { text: '正文', hash: 'h1' }, { lane: 'answer' })).state
    const message = { role: 'assistant', text: '', streaming: true }
    applyStateToMessage(message, state)
    assert.equal(message.text, '正文')
    assert.equal(message.answerHash, 'h1')
    assert.equal(message.v2AnswerCommitted, true)
  })
})
