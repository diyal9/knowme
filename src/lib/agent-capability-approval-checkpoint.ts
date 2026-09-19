'use strict'

const drafts = require('./tool-drafts-store')

/** Advance only the matching approval checkpoint, never a request for task input. */
function resolveCapabilityApprovalCheckpoint(userData, session, draft, deps) {
  const store = deps.getWorkbenchTaskStore?.()
  if (!store || !session.taskRef?.id) return
  const current = store.get(session.taskRef.id)?.task
  if (!current || current.id !== draft.meta?.taskId || current.execRef?.id !== session.id
    || current.expertId !== draft.meta?.agentId || current.status !== 'needs_input'
    || current.attention?.kind !== 'approval_required') return
  const otherPending = drafts.listPendingDrafts(userData).some(row => row.id !== draft.id
    && (row.meta?.sessionId || row.sessionId) === session.id)
  if (otherPending) return
  store.update(current.id, {
    attention: {
      kind: 'authorization_required', action: 'open_capability',
      title: '已授权本任务，等待重新执行', detail: '请重新执行；执行前会再次检查当前能力授权。',
    },
  })
}

module.exports = { resolveCapabilityApprovalCheckpoint }
