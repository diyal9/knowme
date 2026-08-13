'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  sanitizeDiagnosticEntry,
  sanitizeOutputDiagnostics,
  assertNoSensitiveFields,
  collectSensitiveKeys,
} = require('../src/lib/agent-output-metrics')

describe('agent-output-metrics', () => {
  it('keeps only allowed diagnostic keys', () => {
    const entry = sanitizeDiagnosticEntry({
      code: 'buffered_draft_discarded',
      runId: 'run_a',
      round: 2,
      phase: 'TOOL',
      length: 128,
      count: 1,
      text: 'must not leak',
      reasoning: 'hidden',
      apiKey: 'sk-test-should-not-appear',
    })
    assert.equal(entry.code, 'buffered_draft_discarded')
    assert.equal(entry.runId, 'run_a')
    assert.equal(entry.length, 128)
    assert.equal(entry.text, undefined)
    assert.equal(entry.reasoning, undefined)
    assert.equal(entry.apiKey, undefined)
  })

  it('drops forbidden string values from diagnostics', () => {
    const out = sanitizeOutputDiagnostics([{
      code: 'invalid_suggestion_stripped',
      hash: 'abc123',
      type: 'stage',
      lane: 'progress',
      seq: 3,
      summary: '```suggestion {"title":"x"}',
    }])
    assert.equal(out.length, 1)
    assert.equal(out[0].summary, undefined)
    assert.equal(out[0].hash, 'abc123')
  })

  it('detects sensitive keys in nested metrics payloads', () => {
    const hits = collectSensitiveKeys({
      runId: 'run_x',
      outputDiagnostics: [{ code: 'answer_committed', hash: 'deadbeef' }],
      nested: { toolResult: 'full payload' },
    })
    assert.ok(hits.some(hit => hit.includes('toolResult')))
  })

  it('assertNoSensitiveFields passes for sanitized executor metrics shape', () => {
    assert.doesNotThrow(() => assertNoSensitiveFields({
      rounds: 2,
      toolCalls: 1,
      firstTokenMs: 120,
      bufferedDraftsDiscarded: 1,
      answerCommitMs: 900,
      bufferMs: 780,
      outputDiagnostics: sanitizeOutputDiagnostics([
        { code: 'buffered_draft_discarded', runId: 'run_a', round: 1, length: 42, count: 1 },
        { code: 'answer_committed', hash: 'abc123', timingMs: 900, count: 2 },
      ]),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, source: 'estimate' },
    }))
  })

  it('assertNoSensitiveFields rejects api key-like strings', () => {
    assert.throws(
      () => assertNoSensitiveFields({ token: 'sk-abcdefghijklmnopqrstuvwxyz' }),
      /sensitive fields detected/,
    )
  })
})
