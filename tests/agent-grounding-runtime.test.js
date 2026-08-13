'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const grounding = require('../src/lib/agent-grounding-runtime')

describe('agent-grounding-runtime', () => {
  it('binds numeric selection 1-based to pendingSelection option', () => {
    let state = grounding.createReferenceState()
    state = grounding.setPendingSelection(state, [
      { id: 'c1', label: 'A', payload: { minute_token: 'a' }, boundTool: 'feishu.meeting_read' },
      { id: 'c2', label: 'B', payload: { minute_token: 'b' }, boundTool: 'feishu.meeting_read' },
    ])
    const result = grounding.bindNumericSelection(state, '2')
    assert.equal(result.bound, true)
    assert.equal(result.option.id, 'c2')
    assert.equal(result.index, 2)
  })

  it('fail-closed when numeric input without pendingSelection', () => {
    const result = grounding.bindNumericSelection(grounding.createReferenceState(), '2')
    assert.equal(result.bound, false)
    assert.equal(result.ambiguous, true)
  })

  it('clears pendingSelection on task switch', () => {
    let state = grounding.setPendingSelection(grounding.createReferenceState(), [{ id: 'c1', label: 'A' }])
    state = grounding.clearStaleOnTaskSwitch(state, { workflowId: 'new' })
    assert.equal(state.pendingSelection, null)
    assert.equal(state.refs.every(r => r.stale), true)
  })

  it('marks title-only tool body as truncated', () => {
    const q = grounding.classifyToolResultQuality('feishu.meeting_read', {
      ok: true,
      text: '{"title":"某会议"}',
    })
    assert.equal(q.status, 'truncated')
  })

  it('blocks false execution claims via OutputGate', () => {
    const verification = grounding.verifyClaims({
      text: '已读取会议内容，议题：发布。',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
      taskFrame: { requiredTools: ['feishu.meeting_read'] },
    })
    assert.equal(verification.passed, false)
    const gate = grounding.applyOutputGate({ text: '已读取会议内容，议题：发布。', verification, regenUsed: true })
    assert.equal(gate.blocked, true)
    assert.match(gate.text, /尚未|不能|需要先|证据不足|没有成功/)
  })

  it('allows plain chat without grounding violations', () => {
    const verification = grounding.verifyClaims({
      text: '你好，有什么可以帮你？',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true)
  })

  it('serializes and deserializes ReferenceState', () => {
    let state = grounding.setPendingSelection(grounding.createReferenceState(), [{ id: 'x', label: 'X' }])
    const raw = grounding.serializeReferenceState(state)
    const restored = grounding.deserializeReferenceState(raw)
    assert.equal(restored.pendingSelection.options[0].id, 'x')
  })
})
