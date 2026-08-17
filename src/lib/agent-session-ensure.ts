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
  if (found) return { session: found, sessions: list, ui: nextUi, created: false }

  const workbench = isWorkbenchLaneId(laneId) || opts.ephemeral === true || opts.surface === 'workbench'
  const role = String(opts.role || opts.agentId || 'general')
  const session = createSession(role, list.filter((item) => item.agentId === role).length + 1, {
    ephemeral: workbench,
    expertId: opts.expertId || '',
    role,
    taskRef: opts.taskRef || (workbench ? taskRefForLane(laneId, role) : undefined),
    goal: workbench ? '当前工作' : opts.goal,
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
