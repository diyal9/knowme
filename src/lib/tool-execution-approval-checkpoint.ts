'use strict'

const drafts = require('./tool-drafts-store')
const { listToolExecutionReceipts, writeToolExecutionReceipt } = require('./tool-execution-receipts')

/** Record the operation, not completion of the whole task. Never launch a run here. */
function resolveToolExecutionApprovalCheckpoint(userData, draft, result, deps) {
  const isTaskOperation = draft && draft.kind !== 'capability-access'
    && Boolean(draft.sessionId) && Boolean(draft.runId)
  if (!isTaskOperation || result.dryRun) return result
  let receipt = listToolExecutionReceipts(userData, draft.sessionId, { runId: draft.runId })
    .find(row => row.draftId === draft.id)
  // Generic tool approvals persist their own receipt. File and connector drafts do
  // not, so record their host result here before advancing the task checkpoint.
  // Never replace an existing completed/uncertain receipt on duplicate IPC calls.
  if (!receipt) {
    const outcome = result.rejected || result.executionStarted === false
      ? 'not_executed'
      : result.ok === true ? 'executed' : 'uncertain'
    receipt = writeToolExecutionReceipt(userData, draft, result, outcome)
  }
  if (!receipt) return result
  const sessions = deps.loadAgentSessions?.() || []
  const session = sessions.find(row => row.id === draft.sessionId)
  const store = deps.getWorkbenchTaskStore?.()
  const task = session?.taskRef?.id ? store?.get(session.taskRef.id)?.task : null
  const response = { ...result, executed: receipt.outcome === 'executed',
    executionOutcome: receipt.outcome, resumeRequired: false, receipt }
  if (!session || session.run?.id !== draft.runId || !task || task.execRef?.id !== session.id
    || task.expertId !== (session.expertId || session.agentId)
    || ['cancelled', 'canceled', 'failed'].includes(session.run?.status)
    || ['cancelled', 'archived'].includes(task.status)) return response
  const success = receipt.outcome === 'executed'
  const uncertain = receipt.outcome === 'uncertain'
  const exactCheckpoint = task.status === 'needs_input' && task.attention?.kind === 'approval_required'
    && task.attention?.draftId === draft.id
    && (!task.attention.runId || task.attention.runId === draft.runId)
  const otherPending = drafts.listPendingDrafts(userData).some(row => row.id !== draft.id
    && (row.sessionId || row.meta?.sessionId) === session.id && row.runId === draft.runId)
  const title = success ? '操作已执行，等待继续' : uncertain ? '需要核对操作结果' : '操作未执行，可重新申请'
  const detail = success ? '基于已保存的执行结果继续；不要重复执行已完成的操作。'
    : uncertain ? '操作可能已产生副作用，请先核对外部结果，禁止自动重放。'
      : '此操作没有执行；继续后会重新检查权限并生成新的审批。'
  const evidenceId = `tool-approval:${draft.id}`
  const evidence = { runId: draft.runId, gateStatus: 'blocked', verificationPassed: false,
    toolCalls: [{ id: evidenceId, name: draft.action, status: success ? 'ok' : 'fail',
      resultRef: evidenceId, error: success ? '' : receipt.result.code }],
    evidence: [{ id: evidenceId, status: receipt.outcome, digest: receipt.result.text,
      provenance: { source: 'host-tool-approval', draftId: draft.id, invocationHash: draft.invocationHash } }],
    violations: success ? [] : [{ code: uncertain ? 'operation_status_unknown' : (receipt.result.code || 'not_executed'), message: detail }],
    createdAt: receipt.completedAt }
  const existing = task.executionEvidence || []
  const recorded = existing.some(item => item.evidence?.some(row => row.id === evidenceId))
  const updated = store.update(task.id, {
    executionEvidence: recorded ? existing : [...existing, evidence],
    ...(exactCheckpoint && !otherPending ? { attention: {
      kind: success ? 'tool_execution_completed' : uncertain ? 'operation_status_unknown' : 'tool_approval_expired',
      action: uncertain ? 'provide_input' : 'retry', title, detail, draftId: draft.id, runId: draft.runId,
    } } : {}),
  })
  return { ...response, task: updated.task || task,
    resumeRequired: Boolean(updated.ok && exactCheckpoint && !otherPending && success) }
}

module.exports = { resolveToolExecutionApprovalCheckpoint }
