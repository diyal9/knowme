'use strict'

/**
 * Knowledge Steward task / proposal IPC + wiki.lint artifact bridge.
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerKnowledgeStewardIpc(ipcMain, deps) {
  const {
    app,
    knowledgeOs,
    knowledgeStewardStore,
    agentRun,
    contextCache,
    kosSourcesCtx,
    loadAgentStore,
    saveAgentStore,
  } = deps

  function stewardEntriesForScope(scope = {}) {
    const list = knowledgeOs.listEntries(app.getPath('userData'), kosSourcesCtx())
    const entries = Array.isArray(list.wiki) ? list.wiki : []
    const mode = scope.mode || 'changed'
    if (mode === 'selected') {
      const selected = new Set((scope.paths || []).map(item => String(item || '').replace(/\\/g, '/')))
      return entries.filter(entry => selected.has(entry.path))
    }
    if (mode === 'topic' && scope.topic) {
      const q = String(scope.topic).toLowerCase()
      return entries.filter(entry => `${entry.title} ${entry.path}`.toLowerCase().includes(q))
    }
    return entries
  }

  function runStewardOrganizationTask(task) {
    const userData = app.getPath('userData')
    const scope = task.scope || {}
    const entries = stewardEntriesForScope(scope)
    const scanning = knowledgeStewardStore.updateTask(userData, task.id, 'scanning', {
      total: entries.length,
      scanned: 0,
      analyzed: 0,
      currentPath: '',
      error: '',
    })
    if (!scanning.ok) return scanning
    const analyzing = knowledgeStewardStore.updateTask(userData, task.id, 'analyzing', {
      scanned: entries.length,
      analyzed: entries.length,
    })
    if (!analyzing.ok) return analyzing
    const drafts = knowledgeOs.promoteToOkfDrafts(userData, {
      wikiPaths: entries.map(entry => entry.path),
    }, kosSourcesCtx())
    const proposals = (drafts.artifacts || []).map(artifact => ({
      ...artifact,
      type: 'knowledge_proposal',
      proposedContent: artifact.body,
      taskId: task.id,
      diff: {
        beforeLines: 0,
        afterLines: String(artifact.body || '').split(/\r?\n/).length,
        lineDelta: String(artifact.body || '').split(/\r?\n/).length,
      },
    }))
    return knowledgeStewardStore.addProposals(userData, task.id, proposals)
  }

  ipcMain.handle('knowledge-steward-task-list', () => {
    try {
      const data = knowledgeStewardStore.load(app.getPath('userData'))
      return { ok: true, tasks: data.tasks, proposals: data.proposals }
    } catch (e) {
      return { ok: false, tasks: [], proposals: [], error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-task-create', (_e, payload = {}) => {
    try {
      const task = knowledgeStewardStore.createTask(app.getPath('userData'), {
        scope: payload.scope || { mode: 'changed' },
      })
      const result = runStewardOrganizationTask(task)
      if (!result.ok) return result
      const data = knowledgeStewardStore.load(app.getPath('userData'))
      return {
        ok: true,
        task: result.task,
        proposals: data.proposals.filter(item => item.taskId === task.id),
      }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-task-cancel', (_e, taskId) => {
    try {
      return knowledgeStewardStore.updateTask(app.getPath('userData'), String(taskId || ''), 'cancelled')
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-task-retry', (_e, taskId) => {
    try {
      const userData = app.getPath('userData')
      const task = knowledgeStewardStore.getTask(userData, String(taskId || ''))
      if (!task) return { ok: false, error: '整理任务不存在' }
      const reset = knowledgeStewardStore.updateTask(userData, task.id, 'scanning', { error: '' })
      if (!reset.ok) return reset
      return runStewardOrganizationTask(reset.task)
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-proposal-accept', (_e, payload = {}) => {
    try {
      const userData = app.getPath('userData')
      const proposalId = typeof payload === 'string' ? payload : payload.id
      const proposal = knowledgeStewardStore.listProposals(userData)
        .find(item => item.id === String(proposalId || ''))
      if (!proposal) return { ok: false, error: '整理提案不存在' }
      const content = typeof payload === 'object' && payload.content != null
        ? String(payload.content)
        : ''
      const candidate = content
        ? { ...proposal, body: content, proposedContent: content }
        : proposal
      const written = knowledgeOs.acceptWrite(userData, candidate, kosSourcesCtx())
      if (!written.ok) return written
      const updated = knowledgeStewardStore.updateProposal(userData, proposal.id, {
        status: 'accepted',
        ...(content ? { body: content, proposedContent: content } : {}),
      })
      const lint = knowledgeOs.lintWiki(userData, kosSourcesCtx())
      contextCache.invalidate('kb:')
      return { ok: true, written: written.rel, proposal: updated.proposal, lint }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-proposal-reject', (_e, proposalId) => {
    try {
      return knowledgeStewardStore.updateProposal(app.getPath('userData'), String(proposalId || ''), {
        status: 'rejected',
      })
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-steward-proposal-snooze', (_e, proposalId) => {
    try {
      return knowledgeStewardStore.updateProposal(app.getPath('userData'), String(proposalId || ''), {
        status: 'snoozed',
      })
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })

  ipcMain.handle('knowledge-os-steward-lint', (_e, sessionId) => {
    const lint = knowledgeOs.lintWiki(app.getPath('userData'), kosSourcesCtx())
    const art = agentRun.healthReportArtifact(lint)
    const { sessions, ui } = loadAgentStore()
    let session = sessions.find(s => s.id === sessionId)
    if (!session) return { ok: false, error: 'Session 不存在', lint }
    session = agentRun.recordTool(session, 'wiki.lint')
    session = agentRun.addArtifact(session, art)
    const idx = sessions.findIndex(s => s.id === sessionId)
    sessions[idx] = session
    saveAgentStore(sessions, ui)
    return { ok: true, lint, artifact: art, session }
  })
}

module.exports = { registerKnowledgeStewardIpc }
