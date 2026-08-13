'use strict'

/**
 * Workbench bootstrap status + run IPC.
 */
function registerWorkbenchBootstrapIpc(ipcMain, deps) {
  const {
    loadSettings,
    saveSettings_,
    getWorkbenchDaemonClient,
    workbenchBootstrap,
    workbenchAuth,
  } = deps

  ipcMain.handle('workbench-bootstrap-status', async () => {
    const settings = loadSettings()
    let daemonOverview = null
    try {
      daemonOverview = await getWorkbenchDaemonClient().overview()
    } catch {
      daemonOverview = null
    }
    const status = workbenchBootstrap.buildPublicStatus(settings, {
      daemonOverview,
      tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
    })
    return { ok: true, status }
  })

  ipcMain.handle('workbench-bootstrap-run', async (_e, payload = {}) => {
    const current = loadSettings()
    const installPath = String(payload.installPath || current.workbenchInstall?.path || '').trim()
    if (payload.saveInstallPath !== false && installPath) {
      saveSettings_({
        ...current,
        workbenchInstall: {
          ...(current.workbenchInstall || {}),
          path: installPath,
        },
      })
    }
    const settings = loadSettings()
    const result = workbenchBootstrap.runBootstrap(settings, {
      installPath: installPath || undefined,
      deploy: payload.deploy !== false,
      applyCompat: payload.applyCompat === true,
    })
    const next = loadSettings()
    saveSettings_({
      ...next,
      workbenchInstall: {
        ...(next.workbenchInstall || {}),
        path: result.installPath || installPath || next.workbenchInstall?.path || '',
        lastBootstrapAt: new Date().toISOString(),
        lastBootstrapOk: result.ok,
      },
    })
    return result
  })
}

module.exports = { registerWorkbenchBootstrapIpc }
