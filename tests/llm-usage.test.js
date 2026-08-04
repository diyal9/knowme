'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const usage = require('../src/lib/llm-usage')

describe('llm-usage', () => {
  it('calibrates estimated prompt tokens online with provider usage', () => {
    usage._resetCalibrationsForTest()
    const key = usage.calibrationKey('openai', 'gpt-4o-mini')
    const c1 = usage.learnCalibration(key, 1000, 1200)
    assert.ok(c1.factor > 1)
    const c2 = usage.learnCalibration(key, 1000, 800)
    assert.ok(c2.samples >= 2)
    const adjusted = usage.applyCalibration(1000, key)
    assert.ok(adjusted > 800 && adjusted < 1200)
  })

  it('keeps a neutral factor for unknown calibration keys', () => {
    usage._resetCalibrationsForTest()
    const key = usage.calibrationKey('x', 'y')
    assert.equal(usage.applyCalibration(1000, key), 1000)
    const c = usage.getCalibration(key)
    assert.equal(c.factor, 1)
    assert.equal(c.samples, 0)
  })

  it('imports and exports calibration snapshots', () => {
    usage._resetCalibrationsForTest()
    usage.importCalibrations({
      'openai:gpt-4o-mini': { factor: 1.13, samples: 12, updatedAt: '2026-01-01T00:00:00Z' },
      bad: { factor: -1, samples: 'x' },
    })
    const c = usage.getCalibration('openai:gpt-4o-mini')
    assert.equal(c.samples, 12)
    assert.ok(c.factor > 1)
    const exported = usage.exportCalibrations()
    assert.ok(exported['openai:gpt-4o-mini'])
  })

  it('prefers provider usage over estimate', () => {
    const r = usage.reconcileUsage(1000, { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 })
    assert.equal(r.source, 'provider')
    assert.equal(r.promptTokens, 800)
    assert.equal(r.totalTokens, 1000)
  })

  it('falls back to estimate when usage is missing', () => {
    const r = usage.reconcileUsage(1234, null)
    assert.equal(r.source, 'estimate')
    assert.equal(r.totalTokens, 1234)
  })

  it('derives total from prompt+completion when total absent', () => {
    const r = usage.reconcileUsage(0, { prompt_tokens: 300, completion_tokens: 100 })
    assert.equal(r.totalTokens, 400)
  })

  it('accumulates provider usage across rounds', () => {
    let acc = { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: 'estimate' }
    acc = usage.accumulateUsage(acc, { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    acc = usage.accumulateUsage(acc, { prompt_tokens: 200, completion_tokens: 60, total_tokens: 260 })
    assert.equal(acc.source, 'provider')
    assert.equal(acc.totalTokens, 410)
  })

  it('scales tool budget by tier', () => {
    assert.ok(usage.adaptiveBudget('chat').maxRounds < usage.adaptiveBudget('assist').maxRounds)
    assert.ok(usage.adaptiveBudget('retrieval').maxToolCalls > usage.adaptiveBudget('assist').maxToolCalls)
    assert.deepEqual(usage.adaptiveBudget('unknown'), usage.adaptiveBudget('assist'))
  })

  it('expands assist/retrieval budgets with hard caps; chat never expands', () => {
    const chat = usage.expandBudget(usage.adaptiveBudget('chat'), {
      tier: 'chat',
      planRemaining: 3,
      expansionsUsed: 0,
    })
    assert.equal(chat.expanded, false)
    assert.equal(chat.reason, 'chat_no_expand')

    const base = usage.adaptiveBudget('assist')
    const once = usage.expandBudget(base, {
      tier: 'assist',
      planRemaining: 2,
      expansionsUsed: 0,
    })
    assert.equal(once.expanded, true)
    assert.ok(once.maxRounds > base.maxRounds)
    assert.ok(once.maxToolCalls > base.maxToolCalls)

    const noPlan = usage.expandBudget(base, {
      tier: 'assist',
      planRemaining: 0,
      expansionsUsed: 0,
    })
    assert.equal(noPlan.expanded, false)

    const repeated = usage.expandBudget(base, {
      tier: 'assist',
      planRemaining: 2,
      repeatedCall: true,
      expansionsUsed: 0,
    })
    assert.equal(repeated.expanded, false)

    let cur = { ...base }
    let expansions = 0
    for (let i = 0; i < 8; i++) {
      const next = usage.expandBudget(cur, {
        tier: 'assist',
        planRemaining: 1,
        expansionsUsed: expansions,
        maxExpansions: 2,
      })
      if (!next.expanded) break
      cur = { maxRounds: next.maxRounds, maxToolCalls: next.maxToolCalls }
      expansions = next.expansionsUsed
    }
    assert.ok(cur.maxRounds <= usage.TIER_BUDGET_CAPS.assist.maxRounds)
    assert.ok(cur.maxToolCalls <= usage.TIER_BUDGET_CAPS.assist.maxToolCalls)
    assert.ok(expansions <= 2)
  })
})
