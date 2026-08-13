'use strict'

/**
 * Workspace UI state persistence IPC.
 */
function registerWorkspaceStateIpc(ipcMain, deps) {
  const { loadSettings, saveSettings_ } = deps

  ipcMain.handle('get-workspace-state', () => loadSettings().workspaceState || null)
  ipcMain.on('save-workspace-state', (_e, state) => {
    try { const s = loadSettings(); s.workspaceState = state; saveSettings_(s) } catch { /* ignore */ }
  })
}

module.exports = { registerWorkspaceStateIpc }
