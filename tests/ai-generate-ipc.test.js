'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { registerAiGenerateIpc, AI_GENERATE_REQUIRED_DEPS } = require('../src/ipc/ai-generate')

function fakeDeps(overrides = {}) {
  const deps = {}
  for (const key of AI_GENERATE_REQUIRED_DEPS) {
    deps[key] = () => ({})
  }
  deps.activeAgentRuns = new Map()
  deps.agentRuntimePortFactories = new Map()
  deps.agentRuntimeOutputBridges = new Map()
  deps.KNOWLEDGE_DIR = '/tmp/knowme-kb'
  deps.MEMORY_DIR = '/tmp/knowme-mem'
  deps.loadSettings = () => ({})
  Object.assign(deps, overrides)
  return deps
}

describe('ai-generate ipc shell', () => {
  it('registers handle and projects prepare failure without kernel', async () => {
    const handlers = {}
    registerAiGenerateIpc({
      handle(channel, fn) { handlers[channel] = fn },
    }, fakeDeps())
    assert.equal(typeof handlers['ai-generate'], 'function')
    const result = await handlers['ai-generate'](
      { sender: { isDestroyed: () => true, send() {} } },
      { prompt: 'hello', runId: 'run_test_ipc' },
    )
    assert.equal(result.runId, 'run_test_ipc')
    assert.equal(typeof result.error, 'string')
    assert.match(String(result.error), /API Key|API Endpoint/)
  })
})
