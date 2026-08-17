'use strict'

/**
 * Workbench launch intent + context stores IPC.
 */
function registerWorkbenchLaunchIpc(ipcMain, deps) {
  const {
    getWorkbenchContextStore,
    getWorkbenchLaunchStores,
    buildWorkbenchLaunchFacts,
    resolveLaunchPackageItem,
    workbenchLaunchController,
  } = deps

  ipcMain.handle('workbench-context-get', () => getWorkbenchContextStore().get())
  ipcMain.handle('workbench-context-save', (_e, patch = {}) =>
    getWorkbenchContextStore().save(patch || {}))
  ipcMain.handle('workbench-context-clear', () => getWorkbenchContextStore().clear())

  ipcMain.handle('workbench-launch-assess', (_e, payload = {}) => {
    const intent = payload.intent || payload
    const packageItem = resolveLaunchPackageItem(intent?.resourceId)
    return workbenchLaunchController.assessIntent(intent, {
      facts: buildWorkbenchLaunchFacts(payload),
      packageItem,
    })
  })

  ipcMain.handle('workbench-launch-save', (_e, payload = {}) => {
    const stores = getWorkbenchLaunchStores()
    const patch = payload.patch || payload
    const options = {
      persist: payload.persist || 'both',
      saveOptions: payload.options || {},
      facts: buildWorkbenchLaunchFacts(payload),
      packageItem: resolveLaunchPackageItem(patch?.resourceId || stores.draft?.launchIntent?.resourceId),
    }
    return workbenchLaunchController.saveIntent(stores, patch, options)
  })

  ipcMain.handle('workbench-launch-start', (_e, payload = {}) => {
    const stores = getWorkbenchLaunchStores()
    const intent = payload.intent || payload
    const packageItem = resolveLaunchPackageItem(intent?.resourceId)
    return workbenchLaunchController.prepareStart(stores, intent, {
      allowRelaunch: payload.allowRelaunch === true,
      facts: buildWorkbenchLaunchFacts(payload),
      packageItem,
    })
  })

  ipcMain.handle('workbench-launch-complete', (_e, payload = {}) => {
    const stores = getWorkbenchLaunchStores()
    const refs = payload.refs || payload
    return workbenchLaunchController.completeStart(stores, refs)
  })
}

module.exports = { registerWorkbenchLaunchIpc }
