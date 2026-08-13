'use strict'

/**
 * Agent session tab / UI IPC (set-ui, rename, fork, summary, transcript, pin, close-tab).
 */
function registerAgentSessionUiIpc(ipcMain, deps) {
  const {
    loadAgentStore,
    saveAgentStore,
    agentSessions,
  } = deps

  ipcMain.handle('agent-session-set-ui', (_e, patch = {}) => {
    const { sessions, ui } = loadAgentStore()
    const next = saveAgentStore(sessions, { ...ui, ...patch })
    return { ok: true, ui: next.ui }
  })

  ipcMain.handle('agent-session-rename', (_e, sessionId, title) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    session.title = String(title || '').trim().slice(0, 80) || agentSessions.DEFAULT_TITLE
    session.updatedAt = new Date().toISOString()
    saveAgentStore(sessions, ui)
    return { ok: true, session: { ...session, messages: undefined, displayTitle: agentSessions.sessionDisplayTitle(session) } }
  })

  ipcMain.handle('agent-session-fork', (_e, sessionId) => {
    const { sessions, ui } = loadAgentStore()
    const source = sessions.find(s => s.id === sessionId)
    if (!source) return { ok: false, error: 'Session 不存在' }
    const session = agentSessions.forkSession(source)
    sessions.unshift(session)
    const openSessionIds = [session.id, ...(ui.openSessionIds || []).filter(id => id !== session.id)]
      .slice(0, agentSessions.MAX_OPEN_TABS)
    const next = saveAgentStore(sessions, { openSessionIds, activeSessionId: session.id })
    return { ok: true, session, ui: next.ui }
  })

  ipcMain.handle('agent-session-summary', (_e, sessionId) => {
    const { sessions } = loadAgentStore()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    return { ok: true, text: agentSessions.buildSummaryText(session) }
  })

  ipcMain.handle('agent-session-transcript', (_e, sessionId) => {
    const { sessions } = loadAgentStore()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    return { ok: true, text: agentSessions.buildTranscriptText(session) }
  })

  ipcMain.handle('agent-session-pin', (_e, sessionId, pinned) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    session.pinned = !!pinned
    session.updatedAt = new Date().toISOString()
    const openSessionIds = agentSessions.sortOpenSessionIds(ui.openSessionIds || [], sessions)
    const next = saveAgentStore(sessions, { ...ui, openSessionIds })
    return {
      ok: true,
      session: {
        ...session,
        messages: undefined,
        displayTitle: agentSessions.sessionDisplayTitle(session),
        pinned: session.pinned,
      },
      ui: next.ui,
    }
  })

  ipcMain.handle('agent-session-close-tab', (_e, sessionId) => {
    const store = loadAgentStore()
    let { sessions } = store
    const ui = store.ui
    let openSessionIds = (ui.openSessionIds || []).filter(id => id !== sessionId)
    let activeSessionId = ui.activeSessionId
    let createdSessionId = null
    if (activeSessionId === sessionId) {
      activeSessionId = openSessionIds[0] || ''
    }
    if (!openSessionIds.length) {
      const session = agentSessions.createSession('general', sessions.length + 1)
      sessions = [session, ...sessions]
      openSessionIds = [session.id]
      activeSessionId = session.id
      createdSessionId = session.id
    }
    const next = saveAgentStore(sessions, { openSessionIds, activeSessionId })
    return { ok: true, ui: next.ui, createdSessionId }
  })
}

module.exports = { registerAgentSessionUiIpc }
