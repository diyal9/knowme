'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { evaluateAgents, scoreRuntimeTasks } = require('./lib/agent-evals')

test('AgentEvals scores every bundled expert without product runtime dependencies', () => {
  const root = path.join(__dirname, '..')
  const report = evaluateAgents({
    expertsRoot: path.join(root, 'src', 'catalog', 'experts'),
    catalogPath: path.join(root, 'src', 'catalog', 'catalog.json'),
  })
  assert.ok(report.total >= 20)
  assert.equal(report.agents.some(item => item.agentId === 'developer'), false)
  assert.equal(report.agents.some(item => item.agentId === 'business-insight-analyst'), true)
  assert.ok(report.agents.every(item => item.designScore >= 0 && item.designScore <= 100))
})

test('AgentEvals shrinks small runtime samples toward the neutral prior', () => {
  const one = scoreRuntimeTasks([{ completion: 100, quality: 100, evidence: 100, efficiency: 100, fit: 100 }])
  const six = scoreRuntimeTasks(Array.from({ length: 6 }, () => ({ completion: 100, quality: 100, evidence: 100, efficiency: 100, fit: 100 })))
  assert.equal(one.rawScore, 100)
  assert.ok(one.displayScore < six.displayScore)
  assert.equal(one.confidence, 'low')
  assert.equal(six.confidence, 'high')
})

test('AgentEvals does not invent missing runtime dimensions', () => {
  const result = scoreRuntimeTasks([{ completion: 80 }])
  assert.equal(result.rawScore, 80)
  assert.deepEqual(result.missing.sort(), ['efficiency', 'evidence', 'fit', 'quality'])
})
