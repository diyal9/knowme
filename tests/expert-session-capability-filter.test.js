'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  assembleCapabilityContext,
  getSessionCapabilityBindings,
} = require('../src/lib/agent-context-assembly')

describe('expert session capability filtering', () => {
  const expertRuntime = {
    getSessionPersona: () => ({
      ok: true,
      persona: { name: 'Persona', systemPrompt: 'Use the expert method.' },
      bindings: { skills: [], connectors: [] },
    }),
  }

  it('keeps empty expert bindings as an explicit deny-all projection', () => {
    const bindings = getSessionCapabilityBindings(
      { id: 'session-1', expertId: 'persona-only' },
      expertRuntime,
    )
    assert.deepEqual(bindings.allowedSkillIds, [])
    assert.deepEqual(bindings.allowedConnectorIds, [])
  })

  it('passes an empty skill allowlist into context assembly', () => {
    let received = null
    const result = assembleCapabilityContext({
      session: { id: 'session-1', expertId: 'persona-only', snapshotPath: 'snapshot.json' },
      prompt: 'help',
      tier: 'agent',
      expertRuntime,
      skillRuntime: {
        autoMatchSkills: (_prompt, options) => {
          received = options
          return []
        },
      },
    })
    assert.deepEqual(received.allowedIds, [])
    assert.match(result.expertBlock, /Use the expert method/)
    assert.deepEqual(result.bindings.skills, [])
  })
})
