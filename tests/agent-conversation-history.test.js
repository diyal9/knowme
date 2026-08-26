'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  reconcileConversationLog,
  resolveTurnIdentity,
  upsertConversationMessage,
} = require('../src/lib/agent-conversation-log')

describe('agent conversation log', () => {
  it('preserves repeated identical turns when their IDs differ', () => {
    const canonical = [
      { id: 'u1', role: 'user', text: 'hi' },
      { id: 'a1', role: 'assistant', text: '第一次回答' },
      { id: 'u2', role: 'user', text: 'hi' },
      { id: 'a2', role: 'assistant', text: '第二次回答' },
    ]
    const recovery = [...canonical, { id: 'u3', role: 'user', text: 'hi' }]
    const merged = reconcileConversationLog(canonical, recovery, { sessionId: 's1' })
    assert.deepEqual(merged.map(item => item.id), ['u1', 'a1', 'u2', 'a2', 'u3'])
    assert.equal(merged.filter(item => item.role === 'user' && item.text === 'hi').length, 3)
  })

  it('appends a renderer turn when disk persistence is behind', () => {
    const merged = reconcileConversationLog(
      [{ id: 'u1', role: 'user', text: '第一轮' }, { id: 'a1', role: 'assistant', text: '答复' }],
      [
        { id: 'u1', role: 'user', text: '第一轮' },
        { id: 'a1', role: 'assistant', text: '答复' },
        { id: 'u2', role: 'user', text: '第二轮' },
      ],
      { sessionId: 's1' },
    )
    assert.deepEqual(merged.map(item => item.id), ['u1', 'a1', 'u2'])
  })

  it('treats the same ID as an idempotent update and keeps canonical content', () => {
    const canonical = [{ id: 'a1', role: 'assistant', text: '已提交答复', answerHash: 'h1' }]
    const recovery = [{ id: 'a1', role: 'assistant', text: '流式旧片段', runId: 'run_1' }]
    const merged = reconcileConversationLog(canonical, recovery, { sessionId: 's1' })
    assert.equal(merged.length, 1)
    assert.equal(merged[0].text, '已提交答复')
    assert.equal(merged[0].answerHash, 'h1')
    assert.equal(merged[0].runId, 'run_1')
  })

  it('isolates text-overlap recovery to legacy payloads without IDs', () => {
    const canonical = [
      { id: 'u1', role: 'user', text: 'hi' },
      { id: 'a1', role: 'assistant', text: '第一次回答' },
      { id: 'u2', role: 'user', text: 'hi' },
    ]
    const legacyRecovery = [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '第一次回答' },
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '第二次回答' },
    ]
    const merged = reconcileConversationLog(canonical, legacyRecovery, { sessionId: 's1' })
    assert.equal(merged.length, 4)
    assert.equal(merged[3].text, '第二次回答')
    assert.match(merged[3].id, /^legacy_/)
  })

  it('upserts current messages by ID and derives stable retry IDs from runId', () => {
    const turn = resolveTurnIdentity({}, 'run_same', '2026-08-26T00:00:00.000Z')
    assert.equal(turn.userMessageId, 'msg_run_same_user')
    assert.equal(turn.assistantMessageId, 'msg_run_same_assistant')
    const once = upsertConversationMessage([], { id: turn.userMessageId, role: 'user', text: 'hi' })
    const twice = upsertConversationMessage(once, { id: turn.userMessageId, role: 'user', text: 'hi（重试）' })
    assert.equal(twice.length, 1)
    assert.equal(twice[0].text, 'hi（重试）')
  })

  it('enforces distinct turn IDs and immutable message roles', () => {
    const turn = resolveTurnIdentity({
      turn: { userMessageId: 'same', assistantMessageId: 'same' },
    }, 'run_conflict')
    assert.equal(turn.userMessageId, 'same')
    assert.equal(turn.assistantMessageId, 'msg_run_conflict_assistant')
    assert.throws(() => upsertConversationMessage(
      [{ id: 'm1', role: 'user', text: 'hi' }],
      { id: 'm1', role: 'assistant', text: '冲突' },
    ), /conversation_message_role_conflict/)
  })
})
