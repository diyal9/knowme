const assert = require('node:assert/strict')
const { test } = require('node:test')
const { getHostExecutionApprovalRecoveryRunId } = require('../src/lib/agent-execution-approval-recovery')

test('approval recovery requires an exact own-task host pointer and never infers parent or session-wide replay', () => {
  const pointer = { taskId: 'task', runId: 'approved-run', draftId: 'approved-draft' }
  assert.equal(getHostExecutionApprovalRecoveryRunId({ taskRef: { id: 'task' }, expertTaskApprovalRecovery: pointer }), 'approved-run')
  for (const session of [null, {}, { taskRef: { id: 'task' } },
    { expertTaskApprovalRecovery: pointer },
    { taskRef: { id: 'child-task' }, expertTaskApprovalRecovery: pointer },
    { taskRef: { id: 'task' }, expertTaskApprovalRecovery: { ...pointer, draftId: '' } },
    { taskRef: { id: 'task' }, expertTaskApprovalRecovery: { ...pointer, runId: '' } }]) {
    assert.equal(getHostExecutionApprovalRecoveryRunId(session), undefined)
  }
})
