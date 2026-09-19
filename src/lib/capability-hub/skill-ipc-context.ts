'use strict'

const { getSessionCapabilityBindings } = require('../agent-context-assembly')

/** Only the host UI IPC adapters use this route; model tools retain model invocation. */
function resolveSkillIpcContext(deps, payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, code: 'invalid_args', message: '技能请求必须为对象' }
  }
  const skillId = String(payload.skillId || payload.id || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!skillId) return { ok: false, code: 'invalid_args', message: '需要非空 skillId' }
  const sessionId = String(payload.sessionId || '').trim()
  const options = { invocation: 'explicit-user', taskId: String(payload.taskId || '').trim() }
  if (!sessionId) {
    // Settings/package inspection has no run. This is a direct user action;
    // enabled state and package boundaries are still checked by the runtime.
    return { ok: true, skillId, options, permissions: payload.permissions || {} }
  }
  if (typeof deps.loadAgentStore !== 'function') {
    return { ok: false, code: 'session_unavailable', message: '无法读取会话权限；请重新打开会话后重试。' }
  }
  try {
    const store = deps.loadAgentStore()
    const session = store?.sessions?.find(item => item.id === sessionId)
    if (!session) return { ok: false, code: 'session_not_found', message: '会话不存在；请重新选择会话，不能按无会话权限继续。' }
    const scope = getSessionCapabilityBindings(session, deps.expertRuntime(), { userData: deps.getUserData?.() })
    const decision = scope.decision('skills', skillId)
    if (!decision.allowed) {
      return { ok: false, code: 'not_allowed', message: `当前会话不能访问技能 ${skillId}：${decision.reason}`, reason: decision.reason }
    }
    if (Array.isArray(scope.allowedSkillIds)) options.allowedIds = scope.allowedSkillIds
    return { ok: true, skillId, options, permissions: session.run?.permissions || {} }
  } catch {
    return { ok: false, code: 'session_unavailable', message: '会话权限读取失败；请重新打开会话后重试。' }
  }
}

module.exports = { resolveSkillIpcContext }
