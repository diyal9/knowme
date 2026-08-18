'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createWorkspaceBudget } = require('../src/lib/agent-workspace-budget')

describe('agent-workspace-budget', () => {
  it('trips when cost exceeds threshold', () => {
    const budget = createWorkspaceBudget({ maxCostUsd: 1 })
    budget.record({ workspaceId: 'w1' }, { costUsd: 1.2, ok: true })
    const check = budget.check({ workspaceId: 'w1' })
    assert.equal(check.ok, false)
    assert.equal(check.code, 'workspace_budget_cost')
  })

  it('exempts p0 and reports slo', () => {
    const budget = createWorkspaceBudget({ maxCostUsd: 0.1 })
    budget.record({ workspaceId: 'w1' }, { costUsd: 9, ok: false, timeout: true, recoveryMs: 400 })
    assert.equal(budget.check({ workspaceId: 'w1', priority: 'p0' }).ok, true)
    const slo = budget.slo({ workspaceId: 'w1' })
    assert.equal(slo.timeoutRate, 1)
    assert.ok(slo.recoveryDelayMs >= 400)
  })
})
