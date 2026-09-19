'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { approvalRecoveryContext } = require('../src/lib/agent-run-executor/approval-recovery')

const receipt = patch => ({ draftId: 'draft', runId: 'old-run', sessionId: 'session', toolName: 'write_asset',
  outcome: 'executed', result: { ok: true, text: 'Asset saved by the approved host operation', truncated: true }, ...patch })

function makePorts(row) {
  const fixture = { session: { id: 'session', messages: [], run: {} },
    input: { prompt: 'Continue the approved write_asset operation without replaying it', tier: 'assist',
      executionContract: { requiredTools: ['write_asset'] } },
    toolRecords: [{ type: 'function', function: { name: 'write_asset', description: 'Save asset', parameters: { type: 'object', properties: {} } },
      _knowme: { risk: 'write', sideEffects: true, requiresApproval: true } }],
    llmScript: [{ response: { text: 'The approved operation is complete.' } }] }
  const ports = createMockRunPorts(fixture)
  ports.tools.surface.getExecutionApprovalReceipts = async () => [row]
  return { input: fixture.input, ports }
}

test('approval resume seeds prior executed receipt and avoids replay to satisfy required operation', async () => {
  const { input, ports } = makePorts(receipt())
  let executions = 0
  ports.tools.execute = async () => { executions++; throw new Error('must not replay') }
  const complete = ports.llm.complete
  ports.llm.complete = request => {
    assert.equal(request.forceToolCall, false)
    assert.ok(request.messages.some(message => message.role === 'user' && message.content.includes('approval_execution_result')))
    assert.ok(!request.messages.some(message => message.role === 'system' && message.content.includes('Asset saved')))
    return complete(request)
  }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(executions, 0)
  assert.equal(result.terminal, 'DONE', result.error)
  assert.equal(result.metrics.recoveredApprovalReceipts, 1)
  assert.ok(result.executionEvidence.toolCalls.some(call => call.name === 'write_asset' && call.status === 'ok'))
})

test('uncertain approval outcome blocks before provider or tools and never becomes success evidence', async () => {
  const { input, ports } = makePorts(receipt({ outcome: 'uncertain', result: { ok: false, text: 'Timeout' } }))
  let calls = 0
  ports.llm.complete = async () => { calls++; throw new Error('must not request model') }
  ports.tools.execute = async () => { calls++; throw new Error('must not execute') }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(calls, 0)
  assert.equal(result.attention.kind, 'operation_status_unknown')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

test('revoked recovery scope blocks before exposing previous result to model', async () => {
  const { input, ports } = makePorts(receipt())
  ports.tools.surface.getExecutionApprovalReceipts = async () => { throw Object.assign(new Error('Scope revoked'), { code: 'scope_denied' }) }
  ports.llm.complete = async () => { throw new Error('private prior result must not reach provider') }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.attention.kind, 'approval_recovery_blocked')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

test('raw session approvals are not execution evidence and missing tool contract still fails', async () => {
  const { input, ports } = makePorts(receipt())
  delete ports.tools.surface.getExecutionApprovalReceipts
  ports.session.get().toolExecutionApprovals = [receipt()]
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.terminal, 'ERROR')
  assert.equal(result.executionEvidence.verificationPassed, false)
})

test('receipt summaries cannot satisfy full-body evidence and not-executed cannot satisfy required call', () => {
  assert.equal(approvalRecoveryContext([receipt()], 'session').messages[0].truncated, true)
  assert.equal(approvalRecoveryContext([receipt({ outcome: 'not_executed' })], 'session').messages[0].status, 'error')
  assert.throws(() => approvalRecoveryContext([receipt()], 'other'), /会话/)
  assert.throws(() => approvalRecoveryContext(Array(33).fill(receipt()), 'session'), /预算/)
})

test('second approval recovery retains ancestor operation evidence rather than replaying the first operation', async () => {
  const { input, ports } = makePorts(receipt())
  input.executionContract = { requiredTools: ['write_asset', 'publish_asset'] }
  ports.tools.surface.getExecutionApprovalReceipts = async () => [receipt(), receipt({
    draftId: 'second-draft', runId: 'second-run', recoveryRunId: 'old-run', toolName: 'publish_asset',
    result: { ok: true, text: 'Asset published once by host approval', truncated: true },
  })]
  let executed = 0
  ports.tools.execute = async () => { executed++; throw new Error('Neither approved operation may be replayed') }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.terminal, 'DONE', result.error)
  assert.equal(result.metrics.recoveredApprovalReceipts, 2)
  assert.equal(executed, 0)
  assert.deepEqual(new Set(result.executionEvidence.toolCalls.filter(call => call.status === 'ok').map(call => call.name)),
    new Set(['write_asset', 'publish_asset']))
})
