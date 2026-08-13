'use strict'

/**
 * Note window layout IPC (AI panel toggle).
 */
function registerNoteLayoutIpc(ipcMain, deps) {
  const { BrowserWindow, readNote, applyNoteLayout } = deps

  ipcMain.handle('note-set-ai-mode', (e, id, aiOpen) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const n = readNote(id)
    if (!win || !n || win.isDestroyed()) return { ok: false }
    n.aiOpen = !!aiOpen
    const state = applyNoteLayout(win, n)
    return { ok: true, ...state }
  })
}

module.exports = { registerNoteLayoutIpc }
