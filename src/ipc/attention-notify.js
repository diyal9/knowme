'use strict'

const { normalizeAttentionPayload } = require('../lib/attention-payload')

/**
 * Desktop attention toast + focus routing.
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerAttentionNotifyIpc(ipcMain, deps) {
  const {
    BrowserWindow,
    path: pathMod,
    screen,
    getWorkspaceWin,
    createWorkspaceWindow,
    getWindowIconOption,
  } = deps

  let toastWin = null
  let lastPayload = null

  function workspaceForeground() {
    const win = typeof getWorkspaceWin === 'function' ? getWorkspaceWin() : null
    if (!win || win.isDestroyed()) return false
    try {
      return !!(win.isVisible() && win.isFocused())
    } catch {
      return false
    }
  }

  function focusState() {
    const win = typeof getWorkspaceWin === 'function' ? getWorkspaceWin() : null
    const alive = !!(win && !win.isDestroyed())
    return {
      ok: true,
      workspaceVisible: alive ? !!win.isVisible() : false,
      workspaceFocused: alive ? !!win.isFocused() : false,
      foreground: workspaceForeground(),
    }
  }

  function closeToast() {
    if (toastWin && !toastWin.isDestroyed()) {
      try { toastWin.close() } catch { /* ignore */ }
    }
    toastWin = null
  }

  function activateFromToast() {
    const payload = lastPayload
    closeToast()
    try {
      if (typeof createWorkspaceWindow === 'function') createWorkspaceWindow()
    } catch { /* ignore */ }
    const win = typeof getWorkspaceWin === 'function' ? getWorkspaceWin() : null
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send('attention-open', payload || null)
      } catch { /* ignore */ }
    }
  }

  function showDesktopToast(payload) {
    lastPayload = payload
    const display = screen.getPrimaryDisplay()
    const wa = display.workArea
    const width = 340
    const height = 88
    const x = Math.round(wa.x + wa.width - width - 16)
    const y = Math.round(wa.y + wa.height - height - 16)

    if (toastWin && !toastWin.isDestroyed()) {
      try {
        toastWin.setBounds({ x, y, width, height })
        toastWin.webContents.send('attention-toast-init', payload)
        toastWin.showInactive()
      } catch { /* ignore */ }
      return
    }

    toastWin = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      show: false,
      hasShadow: true,
      icon: typeof getWindowIconOption === 'function' ? getWindowIconOption() : undefined,
      webPreferences: {
        preload: pathMod.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    toastWin.setAlwaysOnTop(true, 'screen-saver')
    toastWin.loadFile(pathMod.join(__dirname, '..', 'attention-toast.html'))
    toastWin.webContents.on('did-finish-load', () => {
      try { toastWin.webContents.send('attention-toast-init', payload) } catch { /* ignore */ }
    })
    toastWin.once('ready-to-show', () => {
      if (!toastWin || toastWin.isDestroyed()) return
      toastWin.showInactive()
    })
    toastWin.on('closed', () => { toastWin = null })
  }

  ipcMain.handle('attention-focus-state', async () => focusState())

  ipcMain.handle('attention-notify', async (_e, raw) => {
    const payload = normalizeAttentionPayload(raw)
    if (!payload) return { ok: false, error: 'invalid_payload' }
    if (workspaceForeground()) {
      return { ok: true, routed: 'in-app', focus: focusState() }
    }
    showDesktopToast(payload)
    return { ok: true, routed: 'desktop', focus: focusState() }
  })

  ipcMain.handle('attention-toast-dismiss', async () => {
    closeToast()
    return { ok: true }
  })

  ipcMain.on('attention-toast-activate', () => {
    activateFromToast()
  })
}

module.exports = { registerAttentionNotifyIpc }
