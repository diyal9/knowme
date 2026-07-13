const { app, dialog, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let lastCheckMessage = ''

function parentWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

function initAutoUpdate() {
  if (!app.isPackaged) return

  autoUpdater.on('checking-for-update', () => {
    lastCheckMessage = '正在检查更新…'
    console.log('[update] checking…')
  })

  autoUpdater.on('update-available', info => {
    lastCheckMessage = `发现新版本 ${info.version}，正在下载…`
    console.log('[update] available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    lastCheckMessage = '当前已是最新版本'
    console.log('[update] up to date')
  })

  autoUpdater.on('error', err => {
    lastCheckMessage = err?.message || String(err)
    console.warn('[update] error:', lastCheckMessage)
  })

  autoUpdater.on('download-progress', p => {
    lastCheckMessage = `下载中 ${Math.round(p.percent)}%`
    console.log(`[update] download ${Math.round(p.percent)}%`)
  })

  autoUpdater.on('update-downloaded', info => {
    const win = parentWindow()
    const choice = dialog.showMessageBoxSync(win, {
      type: 'info',
      title: '发现新版本',
      message: `Sticky-Notes ${info.version} 已下载完成`,
      detail: '关闭应用后将自动安装更新，也可以立即重启安装。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })
    if (choice === 0) autoUpdater.quitAndInstall(false, true)
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.warn('[update] check failed:', err?.message || err)
    })
  }, 8000)
}

async function checkForUpdatesManual() {
  if (!app.isPackaged) {
    return { ok: false, message: '开发模式不支持检查更新，请使用已安装的正式版。' }
  }
  try {
    lastCheckMessage = '正在检查更新…'
    const result = await autoUpdater.checkForUpdates()
    if (result?.updateInfo?.version && result?.downloadPromise) {
      return { ok: true, message: lastCheckMessage || `发现新版本 ${result.updateInfo.version}` }
    }
    return { ok: true, message: lastCheckMessage || '当前已是最新版本' }
  } catch (err) {
    const msg = err?.message || String(err)
    lastCheckMessage = msg
    return { ok: false, message: msg }
  }
}

module.exports = { initAutoUpdate, checkForUpdatesManual, autoUpdater }
