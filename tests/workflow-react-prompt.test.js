'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const agentRun = require('../src/lib/agent-run')
const {
  shouldForceWorkflowReact,
  ensureWorkflowPlanSeed,
  classifyWorkflowComplexity,
  resolveWorkflowReactInstructions,
  REACT_INSTRUCTIONS,
} = require('../src/lib/workflow-react-prompt')

describe('workflow-react-prompt', () => {
  it('gates ReAct on workflow taskRef only', () => {
    assert.equal(shouldForceWorkflowReact({ taskRef: { id: 'wf1', kind: 'workflow' } }), true)
    assert.equal(shouldForceWorkflowReact({ taskRef: { id: 'e1', kind: 'expert' } }), false)
    assert.equal(shouldForceWorkflowReact({}), false)
    assert.match(REACT_INSTRUCTIONS, /ReAct/)
  })

  it('seeds pending plan items without marking done', () => {
    const session = ensureWorkflowPlanSeed({ taskRef: { id: 'wf', kind: 'workflow' }, run: {} }, agentRun)
    const items = session.run.plan.items
    assert.ok(items.length >= 3)
    assert.ok(items.every((item) => item.status === 'pending'))
    const again = ensureWorkflowPlanSeed(session, agentRun)
    assert.equal(again.run.plan.items.length, items.length)
  })

  it('adapts plan depth to task complexity without filler steps', () => {
    assert.equal(classifyWorkflowComplexity({}, '改一下标题'), 'simple')
    assert.equal(classifyWorkflowComplexity({}, '端到端重构发布流程并完成风险审计与验收'), 'complex')
    assert.match(resolveWorkflowReactInstructions({}, '改一下标题'), /1–2/)
    assert.match(resolveWorkflowReactInstructions({}, '端到端重构发布流程并验收'), /3–6/)

    const simple = ensureWorkflowPlanSeed({
      taskRef: { id: 'wf-simple', kind: 'workflow' }, goal: '改一下标题', run: {},
    }, agentRun)
    assert.equal(simple.run.plan.items.length, 2)
  })
})
