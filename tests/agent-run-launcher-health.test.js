'use strict'

/**
 * launcher：远程不健康时降级 local-executor，并把 SLO 挂到 diagnostics。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { AgentRunLauncher, BACKEND_LOCAL, BACKEND_CURSOR } = require('../src/lib/agent-run-launcher')
const { createWorkspaceBudget } = require('../src/lib/agent-workspace-budget')

describe('agent-run-launcher health degrade', () => {
  it('degrades to local-executor when remote probe fails', async () => {
    const events = []
    const launcher = new AgentRunLauncher()
    launcher.registerBackend(BACKEND_LOCAL, {
      probeHealth: async () => ({ ok: true }),
      launch: async (_spec, hooks) => {
        hooks.onTerminal?.({ terminal: 'done', text: 'local' })
        return { handle: { runPromise: Promise.resolve() }, backend: BACKEND_LOCAL }
      },
      cancel: async () => ({ ok: true }),
    })
    launcher.registerBackend(BACKEND_CURSOR, {
      probeHealth: async () => ({ ok: false, code: 'timeout', timeout: true }),
      launch: async () => {
        throw new Error('remote must not launch')
      },
      cancel: async () => ({ ok: true }),
    })
    const launched = await launcher.launch({ runId: 'run-degrade-1', backend: BACKEND_CURSOR }, {
      onEvent: (event) => events.push(event),
    })
    assert.equal(launched.backend, BACKEND_LOCAL)
    assert.ok(events.some((event) => event.type === 'backend.degraded'))
    const diag = launcher.getDiagnostics()
    assert.ok(diag.slo)
    assert.equal(typeof diag.slo.successRate, 'number')
  })

  it('rejects register when workspace budget is exhausted', () => {
    const budget = createWorkspaceBudget({ maxCostUsd: 1 })
    budget.record({}, { costUsd: 2 })
    const { AgentRunScheduler } = require('../src/lib/agent-run-scheduler')
    const scheduler = new AgentRunScheduler({ workspaceBudget: budget })
    const result = scheduler.register({ runId: 'run-budget-1' })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'workspace_budget_cost')
  })
})
