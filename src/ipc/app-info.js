'use strict'

/**
 * App metadata + manual update check IPC.
 */
function registerAppInfoIpc(ipcMain, deps) {
  const { app, checkForUpdatesManual } = deps

  ipcMain.handle('app-info', () => {
    const pkg = require('../../package.json')
    return {
      version: app.getVersion() || pkg.version,
      isPackaged: app.isPackaged,
      name: pkg.productName || pkg.name,
    }
  })

  ipcMain.handle('check-for-updates', () => checkForUpdatesManual())
}

module.exports = { registerAppInfoIpc }
