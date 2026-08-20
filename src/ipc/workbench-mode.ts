'use strict'

/**
 * Workbench mode bind/select IPC.
 */
function registerWorkbenchModeIpc(ipcMain, deps) {
  const {
    refreshWorkbenchModeProjections,
    getWorkbenchModeStore,
    modeNameFromDto,
    isExpertAvailableForWorkbench,
  } = deps

  ipcMain.handle('workbench-mode-list', async () => {
    return refreshWorkbenchModeProjections()
  })

  ipcMain.handle('workbench-mode-select', async (_e, modeId) => {
    await refreshWorkbenchModeProjections()
    const result = getWorkbenchModeStore().select(String(modeId || ''))
    if (!result.ok) return result
    return {
      ...result,
      modeId: result.activeModeId,
      modeName: modeNameFromDto(result, result.activeModeId),
    }
  })

  ipcMain.handle('workbench-mode-bind-expert', async (_e, payload = {}) => {
    const expertId = String(payload.expertId || '').trim()
    const modes = await refreshWorkbenchModeProjections()
    if (!modes.ok) return modes
    if (!isExpertAvailableForWorkbench(expertId)) {
      return { ok: false, error: '该 Expert 尚未安装并启用，请先在专家库完成准备' }
    }
    const result = getWorkbenchModeStore().bindExpert(expertId, {
      modeId: String(payload.modeId || modes.activeModeId || '').trim(),
    })
    if (!result.ok) return result
    return {
      ...result,
      modeName: modeNameFromDto(result, result.modeId),
    }
  })

  ipcMain.handle('workbench-mode-unbind-expert', async (_e, payload = {}) => {
    await refreshWorkbenchModeProjections()
    const result = payload.everywhere === true
      ? getWorkbenchModeStore().unbindExpertEverywhere(String(payload.expertId || ''))
      : getWorkbenchModeStore().unbindExpert(String(payload.expertId || ''), {
          modeId: String(payload.modeId || '').trim() || undefined,
        })
    if (!result.ok) return result
    return {
      ...result,
      modeName: payload.everywhere === true ? '工作台常用专家' : modeNameFromDto(result, result.modeId),
    }
  })
}

module.exports = { registerWorkbenchModeIpc }
