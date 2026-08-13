'use strict'

/**
 * Game studio / requirement / workbench handoff IPC.
 * capability-pack-* stays in main (interleaved; migrate separately).
 * Helpers injected via deps.
 */
function registerGameIpc(ipcMain, deps) {
  const {
    ensureCapabilityPackRuntime,
    gameStudio,
    gameRequirement,
    gameWorkbenchHandoff,
    loadWorkbenchDaemonOverview,
    workbenchRepo,
    loadSourcesStore,
    getWorkbenchDaemonClient,
  } = deps

  // ── Cluster: game-studio-scenes (before capability-pack) ───────────────────
  ipcMain.handle('game-studio-scenes', () => {
    ensureCapabilityPackRuntime()
    return {
      ok: true,
      scenes: gameStudio.listScenesForUi(),
      packEnabled: gameStudio.listScenesForUi().length > 0,
    }
  })

  // ── Cluster: requirement + handoff (after capability-pack) ─────────────────
  ipcMain.handle('game-requirement-build', (_e, payload = {}) => {
    const markdown = String(payload.markdown || '').trim()
    const title = String(payload.title || '').trim()
    const doc = markdown
      ? gameRequirement.parseFromMarkdown(markdown, title)
      : gameRequirement.emptyDoc(title)
    if (payload.source) {
      return { ok: true, doc: gameRequirement.attachSource(doc, payload.source) }
    }
    return { ok: true, doc, validation: gameRequirement.validate(doc) }
  })

  ipcMain.handle('game-requirement-approve', (_e, payload = {}) => {
    const doc = payload.doc
    if (!doc) return { ok: false, error: '缺少需求案' }
    const result = gameRequirement.approve(doc)
    if (!result.ok) {
      return { ok: false, error: '需求案未通过校验', validation: result.validation }
    }
    return {
      ok: true,
      doc: result.doc,
      artifact: gameRequirement.buildArtifact(result.doc),
    }
  })

  ipcMain.handle('game-workbench-handoff', async (_e, payload = {}) => {
    try {
      const daemon = await loadWorkbenchDaemonOverview()
      const scene = gameStudio.getScene(payload.sceneId || 'game-dev')
      const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
      const handoff = gameWorkbenchHandoff.buildHandoff({
        requirementDoc: payload.requirement || payload.doc,
        daemonOverview: daemon,
        scene,
        workflowId: payload.workflowId,
        repo: repo.ok ? repo.source : null,
        executorReady: payload.executorReady,
      })
      if (!handoff.ok) return handoff
      if (payload.start === true && !handoff.blocked) {
        const started = await getWorkbenchDaemonClient().createAndRun({
          workflow: handoff.workflow,
          slug: handoff.slug,
          intent: handoff.intent,
          context: handoff.context,
        })
        return { ...handoff, start: started }
      }
      return handoff
    } catch (error) {
      return { ok: false, error: (error && error.message) || '交接失败' }
    }
  })
}

module.exports = { registerGameIpc }
