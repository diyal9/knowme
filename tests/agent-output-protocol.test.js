'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  VERSION,
  Lane,
  EventType,
  stableHash,
  validateEvent,
  createRunEmitter,
  mapLegacyEvent,
  mapLegacyType,
  redactSensitiveFields,
} = require('../src/lib/agent-output-protocol')

describe('agent-output-protocol', () => {
  it('exposes version 2 lane and type constants', () => {
    assert.equal(VERSION, 2)
    assert.equal(Lane.ANSWER, 'answer')
    assert.equal(EventType.ANSWER_COMMITTED, 'answer.committed')
    assert.equal(EventType.RUN_COMPLETED, 'run.completed')
  })

  it('creates monotonic run-scoped events', () => {
    const emitter = createRunEmitter('run_1')
    const events = []
    const first = emitter.emit(EventType.STAGE, { title: '准备' }, { phase: 'PREPARE', round: 0 }, (e) => events.push(e))
    const second = emitter.emit(EventType.TOOL_STARTED, { title: '工具' }, { phase: 'TOOL', round: 1 }, (e) => events.push(e))
    assert.equal(first.seq, 1)
    assert.equal(second.seq, 2)
    assert.equal(events[0].runId, 'run_1')
    assert.equal(events[1].lane, Lane.TOOL)
    assert.doesNotThrow(() => structuredClone(events[0]))
  })

  it('emits only one terminal event per run', () => {
    const emitter = createRunEmitter('run_terminal')
    const events = []
    const emit = (e) => events.push(e)
    emitter.emit(EventType.RUN_COMPLETED, { title: '完成' }, { phase: 'DONE' }, emit)
    const ignoredStage = emitter.emit(EventType.STAGE, { title: 'late' }, { phase: 'MODEL' }, emit)
    const ignoredFailed = emitter.emit(EventType.RUN_FAILED, { title: '失败' }, { phase: 'ERROR' }, emit)
    assert.equal(events.length, 1)
    assert.equal(events[0].type, EventType.RUN_COMPLETED)
    assert.equal(ignoredStage, null)
    assert.equal(ignoredFailed, null)
  })

  it('validates envelope shape and clone safety', () => {
    const ok = validateEvent({
      version: 2,
      runId: 'run_a',
      seq: 1,
      lane: Lane.ANSWER,
      type: EventType.ANSWER_COMMITTED,
      payload: { text: 'hi', hash: stableHash('hi') },
      round: 1,
      phase: 'PERSIST',
    })
    assert.equal(ok.ok, true)

    const bad = validateEvent({
      version: 1,
      runId: 'run_a',
      seq: 0,
      lane: Lane.ANSWER,
      type: EventType.ANSWER_COMMITTED,
      payload: { text: 'hi' },
    })
    assert.equal(bad.ok, false)

    const wrongLane = validateEvent({
      version: 2,
      runId: 'run_a',
      seq: 2,
      lane: Lane.TOOL,
      type: EventType.ANSWER_COMMITTED,
      payload: { text: 'hi', hash: stableHash('hi') },
    })
    assert.equal(wrongLane.ok, false)
  })

  it('maps legacy events without exposing content stream', () => {
    assert.equal(mapLegacyType({ type: 'content' }), null)
    assert.equal(mapLegacyType({ type: 'done' }), EventType.RUN_COMPLETED)
    assert.equal(mapLegacyType({ type: 'cancelled' }), EventType.RUN_CANCELLED)

    const mapped = mapLegacyEvent({
      type: 'tool.completed',
      title: '搜索知识库',
      toolName: 'search_knowledge',
      runPhase: 'TOOL',
      requiresApproval: true,
      draftId: 'draft_1',
      draftStatus: 'pending_review',
    }, { runId: 'run_legacy', seq: 3 })
    assert.equal(mapped.type, EventType.TOOL_COMPLETED)
    assert.equal(mapped.lane, Lane.TOOL)
    assert.equal(mapped.runId, 'run_legacy')
    assert.equal(mapped.seq, 3)
    assert.equal(mapped.payload.requiresApproval, true)
    assert.equal(mapped.payload.draftId, 'draft_1')
    assert.equal(mapped.payload.draftStatus, 'pending_review')
  })

  it('stableHash is deterministic', () => {
    assert.equal(stableHash('hello'), stableHash('hello'))
    assert.notEqual(stableHash('hello'), stableHash('hello!'))
  })

  it('redactSensitiveFields masks token keys without unbound REDACT_KEY_PATTERN', () => {
    const out = redactSensitiveFields({ token: 'abc', title: 'ok' })
    assert.equal(out.token, '[REDACTED]')
    assert.equal(out.title, 'ok')
  })
})
