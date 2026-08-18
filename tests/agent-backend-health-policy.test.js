'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createBackendHealthPolicy } = require('../src/lib/agent-backend-health-policy')

describe('agent-backend-health-policy', () => {
  it('degrades remote after failed probe', () => {
    const policy = createBackendHealthPolicy()
    const decision = policy.decide('cursor', { ok: false, code: 'timeout', timeout: true })
    assert.equal(decision.degraded, true)
    assert.equal(decision.backend, 'local-executor')
    assert.equal(decision.from, 'cursor')
  })

  it('keeps local backend', () => {
    const policy = createBackendHealthPolicy()
    const decision = policy.decide('local-executor', { ok: false })
    assert.equal(decision.degraded, false)
    assert.equal(decision.backend, 'local-executor')
  })
})
