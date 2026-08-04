'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const agentVerify = require('../src/lib/agent-verify')

describe('agent-verify', () => {
  it('skips when there is no plan', () => {
    const r = agentVerify.evaluatePlanCompletion(null)
    assert.equal(r.action, 'finalize')
    assert.equal(r.reason, 'no_plan')
    assert.equal(agentVerify.buildPartialFinalizeNote(r), '')
  })

  it('finalizes when all items are done', () => {
    const r = agentVerify.evaluatePlanCompletion({
      items: [
        { id: 'a', title: 'A', status: 'done', evidence: 'ok' },
        { id: 'b', title: 'B', status: 'done' },
      ],
    })
    assert.equal(r.action, 'finalize')
    assert.equal(r.reason, 'plan_complete')
  })

  it('continues within budget and expands when allowed', () => {
    const plan = {
      items: [
        { id: 'a', title: 'A', status: 'done' },
        { id: 'b', title: 'B', status: 'pending' },
      ],
    }
    const cont = agentVerify.evaluatePlanCompletion(plan, { budgetExhausted: false })
    assert.equal(cont.action, 'continue')
    const expand = agentVerify.evaluatePlanCompletion(plan, { canExpand: true, budgetExhausted: true })
    assert.equal(expand.action, 'expand')
    const exhausted = agentVerify.evaluatePlanCompletion(plan, { canExpand: false, budgetExhausted: true })
    assert.equal(exhausted.action, 'finalize')
    assert.equal(exhausted.reason, 'plan_incomplete_exhausted')
    assert.ok(agentVerify.buildPartialFinalizeNote(exhausted).includes('计划尚未全部完成'))
  })

  it('reports blocked items on finalize', () => {
    const r = agentVerify.evaluatePlanCompletion({
      items: [
        { id: 'a', title: 'A', status: 'done' },
        { id: 'b', title: 'B', status: 'blocked', evidence: '需要审批' },
      ],
    }, { budgetExhausted: true })
    assert.equal(r.action, 'finalize')
    assert.equal(r.reason, 'plan_blocked')
    assert.ok(r.partialReport.includes('blocked'))
  })
})
