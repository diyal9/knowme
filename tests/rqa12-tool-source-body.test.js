'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const grounding = require('../src/lib/agent-grounding-ledger')

const message = { toolName: 'read_file', toolCallId: 'read-current', status: 'done',
  text: `${'完整记录背景。'.repeat(70)}负责人：李明。` }
const ledgers = grounding.mergeToolResultsIntoLedgers({ toolMessages: [message] })

it('checks a field in the complete current tool body beyond the persisted digest', () => {
  assert.doesNotMatch(ledgers.evidenceLedger.entries[0].digest, /负责人/)
  const verification = grounding.verifyClaims({ text: '负责人：李明。', ...ledgers, toolMessages: [message] })
  assert.equal(verification.passed, true)
  assert.equal(verification.metadata.fieldChecks[0].support, 'source_excerpt')
})

it('does not borrow a body from another call, another tool or a failed result', () => {
  for (const patch of [{ toolCallId: 'old-read' }, { toolName: 'different_tool' }, { status: 'error' }]) {
    const verification = grounding.verifyClaims({ text: '负责人：李明。', ...ledgers,
      toolMessages: [{ ...message, ...patch }] })
    assert.equal(verification.passed, false)
  }
})

it('full tool content still cannot validate an added unrelated field', () => {
  const verification = grounding.verifyClaims({ text: '负责人：李明。会议时间为明天九点。',
    ...ledgers, toolMessages: [message] })
  assert.equal(verification.passed, false)
})

it('a raw message without a supporting successful ledger entry is not evidence', () => {
  const verification = grounding.verifyClaims({ text: '负责人：李明。', toolMessages: [message] })
  assert.equal(verification.passed, false)
})

it('nested provider request/query echoes cannot become retrieved field evidence', () => {
  const nested = { toolName: 'fabric_search', toolCallId: 'nested', status: 'done',
    text: JSON.stringify({ ok: true, data: { request: { query: '负责人：赵强。' }, results: [], total: 0 } }) }
  const results = grounding.mergeToolResultsIntoLedgers({ toolMessages: [nested] })
  assert.equal(grounding.verifyClaims({ text: '负责人：赵强。', ...results, toolMessages: [nested] }).passed, false)
})

it('nested actual content supports its exact field but not sibling request metadata', () => {
  const nested = { toolName: 'read_file', toolCallId: 'nested-read', status: 'done',
    text: JSON.stringify({ data: { request: { query: '负责人：赵强。' }, content: '负责人：李明。' } }) }
  const results = grounding.mergeToolResultsIntoLedgers({ toolMessages: [nested] })
  assert.equal(grounding.verifyClaims({ text: '负责人：李明。', ...results, toolMessages: [nested] }).passed, true)
  assert.equal(grounding.verifyClaims({ text: '负责人：赵强。', ...results, toolMessages: [nested] }).passed, false)
})
