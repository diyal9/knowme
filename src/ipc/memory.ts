'use strict'

/**
 * Product memory IPC (OKF memory / learning).
 */
function registerMemoryIpc(ipcMain, deps) {
  const {
    shell,
    MEMORY_DIR,
    productMemory,
    loadSettings,
  } = deps

  ipcMain.on('open-memory-dir', () => shell.openPath(MEMORY_DIR))
  ipcMain.handle('memory-status', () => productMemory.status(MEMORY_DIR))
  ipcMain.handle('memory-overview', () => productMemory.overview(MEMORY_DIR))
  ipcMain.handle('memory-consolidate', () => productMemory.consolidateWorkMemory(MEMORY_DIR))
  ipcMain.handle('memory-global-upsert', (_e, payload = {}) => productMemory.upsertGlobalMemory(MEMORY_DIR, payload))
  ipcMain.handle('memory-global-remove', (_e, id) => productMemory.removeGlobalMemory(MEMORY_DIR, id))
  ipcMain.handle('memory-insights', (_e, payload = {}) => {
    const s = loadSettings()
    const userProfile = {
      userProfile: s.userProfile,
      userPrompt: s.userPrompt,
      industry: s.industry,
      ...(payload.userProfile || {}),
    }
    const consolidated = productMemory.getWorkMemorySummary(MEMORY_DIR, {
      consolidate: payload.consolidate !== false,
    })
    const insights = productMemory.buildMemoryInsights(MEMORY_DIR, userProfile)
    const effectivePersonalization = productMemory.buildEffectivePersonalization(MEMORY_DIR, userProfile, {
      limit: 4,
    })
    const workHints = payload.workContext
      ? productMemory.buildWorkHints(MEMORY_DIR, {
          ...payload.workContext,
          userProfile,
        })
      : null
    return { ok: true, insights, effectivePersonalization, workHints, consolidated }
  })
  ipcMain.handle('memory-set-learning', (_e, enabled) => ({
    ok: true,
    config: productMemory.saveConfig(MEMORY_DIR, { learningEnabled: enabled === true }),
  }))
  ipcMain.handle('memory-review-pattern', (_e, payload = {}) => {
    const result = productMemory.reviewPattern(
      MEMORY_DIR,
      String(payload.id || ''),
      payload.action,
      payload.summary
    )
    const summary = String(payload.summary || result.pattern?.summary || '').trim()
    if (
      result.ok &&
      payload.action === 'accepted' &&
      summary &&
      productMemory.isPatternEligible({ kind: 'preference', summary })
    ) {
      productMemory.capture(MEMORY_DIR, {
        kind: 'telemetry',
        summary: `确认长期协作记忆：${summary.slice(0, 260)}`,
        meta: { source: 'memory-review', patternId: String(payload.id || '') },
      })
    }
    return result
  })
  ipcMain.handle('memory-clear', () => productMemory.clear(MEMORY_DIR))
}

module.exports = { registerMemoryIpc }
