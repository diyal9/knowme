'use strict'

const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const engine = require('../src/lib/context-engine')

const fixturePath = path.join(__dirname, 'fixtures', 'context-engine-golden.json')
const golden = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

describe('context-engine golden evaluation gate', () => {
  for (const testCase of golden.cases) {
    it(testCase.id, () => {
      const policy = engine.resolveContextPolicy(testCase.policy || {})
      const blocks = (testCase.blocks || []).map(engine.normalizeContextBlock).filter(Boolean)
      const result = engine.assembleContext({
        policy,
        blocks,
        query: testCase.query || '',
        optionalTopK: testCase.topK || 8,
      })

      if (testCase.kind === 'trust') {
        const systems = result.messages.filter(message => message.role === 'system')
        const data = result.messages.filter(message => message.role === 'user')
        assert.equal(systems.some(message => message.content.includes(testCase.attackMarker)), false)
        assert.equal(data.some(message => message.content.includes(testCase.attackMarker)), true)
        assert.equal(result.manifest.included.find(item => item.id === 'attack').projectedRole, 'user')
      }
      if (testCase.expectedIdentity) assert.equal(result.manifest.identity, testCase.expectedIdentity)
      if (testCase.expectedExecutionPolicy) assert.equal(result.manifest.executionPolicy, testCase.expectedExecutionPolicy)
      if (testCase.expectedIncluded) {
        assert.deepEqual(result.manifest.included.map(item => item.id), testCase.expectedIncluded)
      }
      if (testCase.expectedOmitted) {
        assert.deepEqual(result.manifest.omitted.map(item => item.id), testCase.expectedOmitted)
      }
    })
  }

  it('contains enough adversarial coverage to remain a meaningful gate', () => {
    assert.equal(golden.version, 1)
    assert.ok(golden.cases.filter(item => item.kind === 'trust').length >= 3)
    assert.ok(golden.cases.some(item => item.kind === 'identity'))
    assert.ok(golden.cases.some(item => item.kind === 'policy'))
    assert.ok(golden.cases.some(item => item.kind === 'selection'))
  })
})
