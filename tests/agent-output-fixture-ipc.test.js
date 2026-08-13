'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { VERSION, EventType } = require('../src/lib/agent-output-protocol')
const {
  MAX_FIXTURE_EVENTS,
  validateFixtureRunPayload,
} = require('../src/lib/agent-output-fixture-handler')

function evt(seq, type, payload = {}, extra = {}) {
  return {
    version: VERSION,
    runId: 'run_fixture_ipc',
    seq,
    lane: extra.lane || 'progress',
    type,
    payload,
    phase: extra.phase || 'MODEL',
    round: extra.round ?? 1,
  }
}

describe('agent-output-fixture-handler', () => {
  it('accepts clone-safe v2 events with matching runId', () => {
    const events = [
      evt(1, EventType.STAGE, { id: 's1', title: '准备', status: 'pending' }),
      evt(2, EventType.ANSWER_COMMITTED, { text: 'hi', hash: 'abc' }, { lane: 'answer' }),
    ]
    const parsed = validateFixtureRunPayload({ runId: 'run_fixture_ipc', events })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.events.length, 2)
    assert.doesNotThrow(() => structuredClone(parsed.events))
  })

  it('rejects runId mismatch, invalid events, and batches over max', () => {
    assert.equal(validateFixtureRunPayload(null).error, 'invalid_payload')
    assert.equal(validateFixtureRunPayload({ runId: 'run_a', events: [] }).error, 'events_required')
    assert.equal(
      validateFixtureRunPayload({
        runId: 'run_a',
        events: [{ ...evt(1, EventType.STAGE, { id: 's1', title: 'A', status: 'pending' }), runId: 'run_b' }],
      }).error,
      'run_id_mismatch',
    )
    const tooMany = Array.from({ length: MAX_FIXTURE_EVENTS + 1 }, (_, index) =>
      evt(index + 1, EventType.STAGE, { id: `s${index}`, title: 'x', status: 'pending' }),
    )
    assert.equal(
      validateFixtureRunPayload({ runId: 'run_fixture_ipc', events: tooMany }).error,
      'too_many_events',
    )
    const badLane = evt(1, EventType.ANSWER_COMMITTED, { text: 'x', hash: 'h' }, { lane: 'progress' })
    assert.equal(
      validateFixtureRunPayload({ runId: 'run_fixture_ipc', events: [badLane] }).error,
      'type answer.committed requires lane answer',
    )
  })
})
