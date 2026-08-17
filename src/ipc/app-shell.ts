'use strict'

/**
 * Desktop shell IPC: settings window, clipboard, data dirs, autostart, prompt-space import.
 */
function registerAppShellIpc(ipcMain, deps) {
  const {
    app,
    shell,
    clipboard,
    DATA_DIR,
    PROMPT_SPACE_DIR,
    openSettings,
    openSettingsWindow,
    openMemoryPanel,
    importPromptSpace,
  } = deps

  ipcMain.on('open-settings', (_e, tab) => openSettings(String(tab || '')))
  ipcMain.on('open-settings-window', (_e, tab) => openSettingsWindow(String(tab || '')))
  ipcMain.on('open-memory-panel', () => openMemoryPanel())

  ipcMain.on('copy-to-clipboard', (_e, text) => clipboard.writeText(text))
  ipcMain.on('open-data-dir', () => shell.openPath(DATA_DIR))
  ipcMain.on('open-prompt-space', () => {
    if (PROMPT_SPACE_DIR) shell.openPath(PROMPT_SPACE_DIR)
  })
  ipcMain.on('set-autostart', (_e, v) => app.setLoginItemSettings({ openAtLogin: !!v }))
  ipcMain.on('get-autostart', e => { e.returnValue = app.getLoginItemSettings().openAtLogin })
  ipcMain.handle('import-prompt-space', () => importPromptSpace())
}

module.exports = { registerAppShellIpc }
