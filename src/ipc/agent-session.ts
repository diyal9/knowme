'use strict'

/**
 * Agent session persistence IPC: list/get/new/context/run/artifacts/apply-log.
 */
function registerAgentSessionIpc(ipcMain, deps) {
  const {
    app,
    loadAgentStore,
    saveAgentStore,
    agentSessions,
    ensureCapabilityHub,
    productMemory,
    MEMORY_DIR,
    agentRun,
    agentSandbox,
    knowledgeOs,
    contextCache,
  } = deps

  ipcMain.handle('agent-session-list', () => {
    let { sessions, ui } = loadAgentStore()
    sessions = sessions.filter(s => s.ephemeral !== true)
    if (!sessions.length) {
      const session = agentSessions.createSession('general', 1)
      sessions = [session]
      ui = { openSessionIds: [session.id], activeSessionId: session.id }
      saveAgentStore(sessions, ui)
    } else if (!ui.openSessionIds?.length) {
      const migrated = agentSessions.normalizeUi(ui, sessions)
      ui = migrated
      saveAgentStore(sessions, ui)
    }
    const hub = ensureCapabilityHub()
    return {
      agents: agentSessions.AGENTS,
      sessions: sessions.map(s => {
        const dto = hub.sessionDto(s)
        return {
          ...dto,
          messages: undefined,
          displayTitle: agentSessions.sessionDisplayTitle(dto),
          messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
          resume: agentSessions.buildResumeProjection(dto),
        }
      }),
      ui,
    }
  })

  ipcMain.handle('agent-session-get', (_e, sessionId) => {
    const { sessions } = loadAgentStore()
    const session = sessions.find(s => s.id === sessionId)
    return session
      ? { ok: true, session: ensureCapabilityHub().sessionDto(session) }
      : { ok: false, error: 'Session 不存在' }
  })

  ipcMain.handle('agent-session-new', (_e, agentIdOrOpts = 'general') => {
    const { sessions, ui } = loadAgentStore()
    const opts = typeof agentIdOrOpts === 'object' && agentIdOrOpts
      ? agentIdOrOpts
      : { agentId: agentIdOrOpts }
    const agentId = opts.agentId || 'general'
    const expertId = String(opts.expertId || '').trim()
    const session = agentSessions.createSession(agentId, sessions.length + 1, {
      goal: opts.goal || '',
      role: opts.role || (agentId === 'steward' ? 'steward' : undefined),
      expertId,
      ephemeral: opts.ephemeral === true,
      taskRef: opts.taskRef,
      knowledgeRefs: opts.knowledgeRefs,
    })
    if (expertId) {
      const hub = ensureCapabilityHub()
      const snap = hub.expertRuntime().createSessionSnapshot(session.id, expertId)
      if (!snap.ok) return { ok: false, error: snap.error || snap.message || '专家快照创建失败', code: snap.code }
      session.expertId = expertId
      session.snapshotPath = snap.path
      session.capabilitySnapshotId = `${session.id}:${expertId}`
    }
    sessions.unshift(session)
    const openSessionIds = [session.id, ...(ui.openSessionIds || []).filter(id => id !== session.id)]
      .slice(0, agentSessions.MAX_OPEN_TABS)
    const next = saveAgentStore(sessions, { openSessionIds, activeSessionId: session.id })
    if (String(opts.goal || '').trim()) {
      productMemory.capture(MEMORY_DIR, {
        kind: 'workflow_choice',
        summary: `选择工作入口：${String(opts.goal).trim().slice(0, 120)}`,
        meta: { agentId, source: 'agent-session-new' },
      })
    }
    return { ok: true, session: ensureCapabilityHub().sessionDto(session), ui: next.ui }
  })

  ipcMain.handle('agent-session-context-update', (_e, sessionId, patch = {}) => {
    const id = String(sessionId || '').trim()
    if (!id) return { ok: false, error: '缺少 sessionId' }
    const hub = ensureCapabilityHub()
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === id)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const updated = hub.updateSessionKnowledgeContext(session, patch)
    if (!updated.ok) return updated
    const idx = sessions.findIndex(s => s.id === id)
    sessions[idx] = updated.session
    saveAgentStore(sessions, ui)
    return { ok: true, session: hub.sessionDto(updated.session) }
  })

  ipcMain.handle('agent-run-update', (_e, payload = {}) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === payload.sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const next = agentRun.ensureRun(session, {
      goal: payload.goal != null ? payload.goal : session.run?.goal,
      role: payload.role != null ? payload.role : session.run?.role,
      status: payload.status != null ? payload.status : session.run?.status,
    })
    if (Array.isArray(payload.toolsUsed)) {
      next.run = agentRun.normalizeRun({
        ...next.run,
        toolsUsed: [...new Set([...(next.run.toolsUsed || []), ...payload.toolsUsed.map(String)])],
      })
    }
    if (payload.permissions && typeof payload.permissions === 'object') {
      const prev = session.run?.permissions || {}
      next.run = {
        ...next.run,
        permissions: agentSandbox.normalizeSandboxPermissions({
          ...prev,
          ...payload.permissions,
        }),
      }
    }
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return { ok: true, session: next }
  })

  ipcMain.handle('agent-artifact-add', (_e, payload = {}) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === payload.sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const next = agentRun.addArtifact(session, payload.artifact)
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return { ok: true, session: next, artifact: next.run.artifacts.slice(-1)[0] }
  })

  ipcMain.handle('agent-artifact-accept', (_e, payload = {}) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === payload.sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const art = (session.run?.artifacts || []).find(a => a.id === payload.artifactId)
    if (!art) return { ok: false, error: '产物不存在' }
    if (art.type === 'health_report' || art.type === 'editor_patch') {
      let next = agentRun.setArtifactStatus(session, art.id, 'accepted')
      if (art.type === 'editor_patch') {
        const mode = art.meta?.mode || 'replace'
        next = agentRun.recordApply(next, {
          action: mode === 'append' || mode === 'insert' ? mode : 'replace',
          detail: art.title || '已应用到编辑器',
          noteId: art.meta?.noteId,
        })
      }
      const idx = sessions.findIndex(s => s.id === session.id)
      sessions[idx] = next
      saveAgentStore(sessions, ui)
      return {
        ok: true,
        session: next,
        editorPatch: art.type === 'editor_patch',
        applyMode: art.meta?.mode || 'replace',
        body: art.type === 'editor_patch' ? art.body : undefined,
      }
    }
    const written = knowledgeOs.acceptWrite(app.getPath('userData'), art)
    if (!written.ok) return written
    contextCache.invalidate('skill:')
    contextCache.invalidate('kb:')
    const next = agentRun.setArtifactStatus(session, art.id, 'accepted')
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return { ok: true, session: next, written: written.rel }
  })

  ipcMain.handle('agent-artifact-reject', (_e, payload = {}) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === payload.sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const art = (session.run?.artifacts || []).find(a => a.id === payload.artifactId)
    let next = agentRun.setArtifactStatus(session, payload.artifactId, 'rejected')
    if (art?.type === 'editor_patch') {
      next = agentRun.recordApply(next, {
        action: 'reject',
        detail: art.title || '已拒绝写入编辑器',
        noteId: art.meta?.noteId,
      })
    }
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return { ok: true, session: next }
  })

  ipcMain.handle('agent-apply-log', (_e, payload = {}) => {
    const { sessions, ui } = loadAgentStore()
    const session = sessions.find(s => s.id === payload.sessionId)
    if (!session) return { ok: false, error: 'Session 不存在' }
    const next = agentRun.recordApply(session, {
      action: payload.action,
      detail: payload.detail,
      noteId: payload.noteId,
    })
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return { ok: true, session: next }
  })
}

module.exports = { registerAgentSessionIpc }
