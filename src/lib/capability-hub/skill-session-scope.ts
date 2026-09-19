'use strict'

const { getSessionCapabilityBindings } = require('../agent-context-assembly')
const { taskCapabilityIdentity, sameTaskCapabilityIdentity } = require('../agent-task-capability-grants')

// Refresh persisted authority without losing a child run's live parent ceiling.
// A missing/failed host lookup must never fall back to the captured session.
function createSkillSessionScope({ session, sandboxPermissions, options, deps }) {
  const identity = taskCapabilityIdentity(session)
  const lookup = typeof options.getCurrentSession === 'function' ? options.getCurrentSession
    : typeof deps.getCurrentSession === 'function' ? () => deps.getCurrentSession(identity.sessionId) : null
  return () => {
    try {
      const parentState = typeof options.getCapabilityState === 'function' ? options.getCapabilityState() : undefined
      if (parentState !== undefined && !parentState?.scope) return null
      if (typeof options.getCapabilityState === 'function' && !parentState) return null
      const current = lookup ? lookup() : session
      if (!current || (lookup && !sameTaskCapabilityIdentity(identity, taskCapabilityIdentity(current)))) return null
      const resolve = value => getSessionCapabilityBindings(value, deps.expertRuntime(), {
        userData: deps.getUserData?.(), permissions: sandboxPermissions,
      })
      const scopes = [resolve(current), resolve(session)]
      if (parentState) scopes.push(parentState.scope)
      let allowedSkillIds = null
      for (const scope of scopes) {
        if (Array.isArray(scope.allowedSkillIds)) allowedSkillIds = allowedSkillIds === null
          ? scope.allowedSkillIds : allowedSkillIds.filter(id => scope.allowedSkillIds.includes(id))
      }
      const permissions = { ...(sandboxPermissions || current.run?.permissions || {}) }
      for (const key of ['network', 'write', 'dangerous']) {
        if (current.run?.permissions?.[key] === false || session.run?.permissions?.[key] === false) permissions[key] = false
        if (lookup && permissions[key] === true && current.run?.permissions?.[key] !== true) permissions[key] = false
      }
      return { allowedSkillIds, permissions, isAllowed: id => scopes.every(scope => scope.decision('skills', id).allowed) }
    } catch { return null }
  }
}

module.exports = { createSkillSessionScope }
