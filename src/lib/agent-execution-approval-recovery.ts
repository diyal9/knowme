'use strict'

/** Read only from the persisted host session, never model arguments or a parent session. */
function getHostExecutionApprovalRecoveryRunId(session) {
  const recovery = session?.expertTaskApprovalRecovery
  if (!session?.taskRef?.id || recovery?.taskId !== session.taskRef.id
    || typeof recovery.runId !== 'string' || !recovery.runId.trim()
    || typeof recovery.draftId !== 'string' || !recovery.draftId.trim()) return undefined
  return recovery.runId
}

module.exports = { getHostExecutionApprovalRecoveryRunId }
