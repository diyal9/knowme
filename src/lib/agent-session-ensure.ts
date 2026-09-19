'use strict'

const { createSession } = require('./agent-sessions')

function isWorkbenchLaneId(id) {
  return /^(wb-expert-|wb-run-)/.test(String(id || ''))
}

function taskRefForLane(sessionId, fallbackRole) {
  const value = String(sessionId || '')
  if (value.startsWith('wb-expert-')) return { id: value.slice('wb-expert-'.length) || fallbackRole, kind: 'expert-chat' }
  if (value.startsWith('wb-run-')) return { id: value.slice('wb-run-'.length) || fallbackRole, kind: 'workflow-chat' }
  return undefined
}

function ensureSessionInStore(sessions, ui, sessionId, opts = {}) {
  const list = Array.isArray(sessions) ? sessions.slice() : []
  const laneId = String(sessionId || '').trim()
  const found = laneId ? list.find((item) => item.id === laneId) : null
  const nextUi = ui && typeof ui === 'object' ? { ...ui } : {}
  const collaborationOnly = opts.conversationMode === 'expert-planning'
    || opts.conversationMode === 'expert-discussion'
  const requestedProjectId = String(opts.projectId || '').trim().slice(0, 100)
  if (found) {
    if (collaborationOnly) {
      const personaExpertId = String(
        opts.personaExpertId || opts.expertId || found.personaExpertId || found.expertId || '',
      ).trim()
      const upgraded = {
        ...found,
        agentId: 'general',
        expertId: '',
        personaExpertId,
        executionPolicy: 'no-tools',
        taskRef: opts.taskRef || found.taskRef,
        projectId: found.projectId || requestedProjectId || null,
        referenceState: undefined,
      }
      const index = list.findIndex(item => item.id === found.id)
      list[index] = upgraded
      return { session: upgraded, sessions: list, ui: nextUi, created: false, upgraded: true }
    }
    const workbench = isWorkbenchLaneId(laneId) || opts.ephemeral === true || opts.surface === 'workbench'
    if (!workbench && !found.profileId) {
      const upgraded = {
        ...found,
        sessionKind: 'personal-topic',
        profileId: 'my-knowme',
        contextId: String(opts.contextId || found.contextId || '').trim(),
        projectId: found.projectId || requestedProjectId || null,
      }
      const index = list.findIndex(item => item.id === found.id)
      list[index] = upgraded
      return { session: upgraded, sessions: list, ui: nextUi, created: true, upgraded: true }
    }
    if (requestedProjectId && !found.projectId) {
      const upgraded = { ...found, projectId: requestedProjectId }
      const index = list.findIndex(item => item.id === found.id)
      list[index] = upgraded
      return { session: upgraded, sessions: list, ui: nextUi, created: false, upgraded: true }
    }
    return { session: found, sessions: list, ui: nextUi, created: false }
  }

  const workbench = isWorkbenchLaneId(laneId) || opts.ephemeral === true || opts.surface === 'workbench'
  const role = String(opts.role || opts.agentId || 'general')
  const session = createSession(role, list.filter((item) => item.agentId === role).length + 1, {
    ephemeral: workbench,
    expertId: collaborationOnly ? '' : (opts.expertId || ''),
    personaExpertId: collaborationOnly
      ? String(opts.personaExpertId || opts.expertId || '').trim()
      : String(opts.personaExpertId || '').trim(),
    executionPolicy: collaborationOnly ? 'no-tools' : String(opts.executionPolicy || '').trim(),
    role,
    taskRef: opts.taskRef || (workbench ? taskRefForLane(laneId, role) : undefined),
    goal: workbench ? '当前工作' : opts.goal,
    sessionKind: workbench
      ? (String(opts.taskRef?.kind || '').includes('workflow') ? 'workflow-run' : 'expert-task')
      : 'personal-topic',
    profileId: workbench ? String(opts.profileId || '') : 'my-knowme',
    contextId: opts.contextId,
    projectId: requestedProjectId || null,
  })
  if (laneId) session.id = laneId
  list.unshift(session)
  if (workbench) return { session, sessions: list, ui: nextUi, created: true }

  const open = [...(nextUi.openSessionIds || [])]
  if (!open.includes(session.id)) open.unshift(session.id)
  return {
    session,
    sessions: list,
    ui: { ...nextUi, openSessionIds: open, activeSessionId: session.id },
    created: true,
  }
}

module.exports = { ensureSessionInStore }
