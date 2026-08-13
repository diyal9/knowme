'use strict'

const path = require('path')

/**
 * Notes backup import/export IPC.
 */
function registerNotesBackupIpc(ipcMain, deps) {
  const {
    shell,
    app,
    path: pathMod = path,
    DATA_DIR,
    notesBackup,
    showOpenDialogFor,
    updateTray,
  } = deps

  ipcMain.handle('notes-export', async (e) => {
    const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
      title: '选择便签备份导出目录',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled || !filePaths?.length) return { ok: false, canceled: true }
    const dest = pathMod.join(filePaths[0], `knowme-backup-${new Date().toISOString().slice(0, 10)}`)
    const result = notesBackup.exportBundle(DATA_DIR, dest)
    if (result.ok) shell.showItemInFolder(dest)
    return result
  })

  ipcMain.handle('notes-import', async (e) => {
    const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
      title: '选择便签备份文件夹',
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths?.length) return { ok: false, canceled: true }
    const result = notesBackup.importBundle(DATA_DIR, filePaths[0])
    if (result.ok) updateTray()
    return result
  })
}

module.exports = { registerNotesBackupIpc }
