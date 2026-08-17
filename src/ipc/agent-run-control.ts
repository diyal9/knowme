'use strict'

/**
 * Agent Team Runtime control IPC (tree / status / cancel / retry / resume).
 * Session-scoped agent-run-update stays in main.
 */
function registerAgentRunControlIpc(ipcMain, deps) {
  const {
    getAgentTeamRuntime,
    workbenchAgentGateWaiters,
    agentRuntimePortFactories,
  } = deps

  ipcMain.handle('agent-run-tree', (_e, payload = {}) => {
    const rootRunId = String(payload.rootRunId || '')
    const agentTeamRuntime = getAgentTeamRuntime()
    if (!rootRunId || !agentTeamRuntime) return { ok: false, code: 'run_not_found' }
    const tree = agentTeamRuntime.manager.getRunTree(rootRunId)
    return tree.ok ? { ok: true, tree } : tree
  })

  ipcMain.handle('agent-run-status', (_e, payload = {}) => {
    const runId = String(payload.runId || '')
    const agentTeamRuntime = getAgentTeamRuntime()
    if (!runId || !agentTeamRuntime) return { ok: false, code: 'run_not_found' }
    return agentTeamRuntime.manager.getRunStatus(runId)
  })

  ipcMain.handle('agent-run-cancel', async (_e, payload = {}) => {
    const runId = String(payload.runId || '')
    const agentTeamRuntime = getAgentTeamRuntime()
    if (!runId || !agentTeamRuntime) return { ok: false, code: 'run_not_found' }
    const result = agentTeamRuntime.manager.cancelRun(runId, 'user_cancelled')
    for (const [key, waiter] of workbenchAgentGateWaiters.entries()) {
      if (waiter.rootRunId !== runId) continue
      workbenchAgentGateWaiters.delete(key)
      waiter.resolve({ approved: false, reason: 'user_cancelled' })
    }
    return result
  })

  ipcMain.handle('agent-run-retry', async (_e, payload = {}) => {
    const runId = String(payload.runId || '')
    const agentTeamRuntime = getAgentTeamRuntime()
    if (!runId || !agentTeamRuntime) return { ok: false, code: 'run_not_found' }
    return agentTeamRuntime.manager.retryRun(runId, {
      newIdempotencyKey: payload.idempotencyKey || `retry:${runId}:${Date.now()}`,
      force: payload.force === true,
    })
  })

  ipcMain.handle('agent-run-resume', async (_e, payload = {}) => {
    const runId = String(payload.runId || '')
    const agentTeamRuntime = getAgentTeamRuntime()
    if (!runId || !agentTeamRuntime) return { ok: false, code: 'run_not_found' }
    const status = agentTeamRuntime.manager.getRunStatus(runId)
    const rootRunId = status.ok ? String(status.rootRunId || runId) : runId
    if (!agentRuntimePortFactories.has(rootRunId)) {
      return {
        ok: false,
        code: 'resume_requires_reprompt',
        message: '该 Run 来自已结束的进程；为避免重复副作用，请在原会话中确认任务上下文后重新发起。',
      }
    }
    return agentTeamRuntime.manager.resumeRun(runId, {
      action: String(payload.action || 'continue'),
    })
  })
}

module.exports = { registerAgentRunControlIpc }
