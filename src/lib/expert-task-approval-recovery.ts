'use strict'

/** Read only host-persisted operation receipts; a renderer retry cannot supply this scope. */
function readExpertApprovalRecovery(deps, task, session) {
  const recovery = session?.expertTaskApprovalRecovery
  if (!recovery) return { ok: true, receipts: [] }
  if (recovery.taskId !== task.id || session.id !== task.execRef?.id
    || session.expertId !== task.expertId || session.taskRef?.id !== task.id) {
    return { ok: false, error: '执行结果与当前任务不匹配，请先核对任务状态。' }
  }
  try {
    const userData = deps.app?.getPath('userData')
    if (!userData || !recovery.runId || !recovery.draftId) throw new Error('missing recovery binding')
    const { listToolExecutionReceipts } = require('./tool-execution-receipts')
    const receipts = listToolExecutionReceipts(userData, session.id, { runId: recovery.runId })
    if (!receipts.some(item => item.draftId === recovery.draftId && item.outcome === 'executed'
      && item.sessionId === session.id && item.runId === recovery.runId)) throw new Error('missing receipt')
    return { ok: true, recovery, receipts: receipts.filter(item => item.outcome === 'executed') }
  } catch {
    return { ok: false, error: '暂时无法核对已执行操作的结果；为避免重复执行，任务尚未继续。' }
  }
}

function prepareExpertApprovalRecovery(deps, task) {
  try {
    const ensured = deps.ensureAgentSession(task.execRef?.id, task.expertId)
    const session = { ...ensured.session, expertTaskApprovalRecovery: {
      taskId: task.id, draftId: task.attention?.draftId, runId: task.attention?.runId,
    } }
    const verified = readExpertApprovalRecovery(deps, task, session)
    if (!verified.ok) return verified
    deps.saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
    return verified
  } catch {
    return { ok: false, error: '执行结果恢复状态未能保存；请稍后继续，不要重复执行。' }
  }
}

module.exports = { readExpertApprovalRecovery, prepareExpertApprovalRecovery }
