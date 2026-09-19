'use strict'

const { taskCapabilityIdentity, sameTaskCapabilityIdentity } = require('./agent-task-capability-grants')
const { isToolAllowedByGovernance } = require('./tool-contract-governance')
const { connectorIdForTool, connectorToolEnabled } = require('./agent-connector-tool-scope')

function createCapabilityExecutionCheck(options) {
  const identity = taskCapabilityIdentity(options.session)
  return request => {
    const session = options.getSession()
    const denied = reason => ({ ok: false, code: 'scope_denied', reason,
      text: '任务身份、运行状态或能力授权已改变，请重新执行。' })
    if (!session || !sameTaskCapabilityIdentity(identity, taskCapabilityIdentity(session))) return denied('session_identity_changed')
    if (options.signal?.aborted) return denied('run_aborted')
    if (session.run?.id !== options.runId) return denied('run_identity_changed')
    if (['cancelled', 'canceled', 'failed'].includes(session.run?.status)) return denied('run_terminal')
    if (request.runId !== options.runId || request.sessionId !== identity.sessionId) return denied('request_identity_changed')
    const task = options.getTask?.(identity.taskId)
    if (options.session.taskRef?.id && !task) return denied('task_missing')
    if (task && (task.execRef?.id !== session.id || task.expertId !== identity.agentId
      || ['cancelled', 'archived'].includes(task.status))) return denied('task_identity_changed')
    const state = options.getState()
    if (!state?.scope || state.scope.noTools
      || !isToolAllowedByGovernance(request.toolName, request.contract, state.governancePolicy)) return denied('tool_governance_denied')
    const connectorId = connectorIdForTool(request.toolName, request.contract)
    if (connectorId && (!state.scope.decision('connectors', connectorId).allowed
      || !connectorToolEnabled(request.toolName, request.contract, options.getConnectors()))) return denied('connector_scope_denied')
    return { ok: true, governancePolicy: state.governancePolicy }
  }
}

module.exports = { createCapabilityExecutionCheck }
