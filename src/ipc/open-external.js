'use strict'

const { spawn } = require('child_process')
const { fileURLToPath } = require('url')
const feishuLink = require('../lib/feishu-link')

const schemeHandlerProbes = new Map()

/**
 * Only hand a URL to a client scheme when the OS has a registered handler;
 * otherwise Windows shows a "no app" dialog instead of opening anything.
 */
function hasSchemeHandler(scheme) {
  if (process.platform !== 'win32') return Promise.resolve(false)
  if (schemeHandlerProbes.has(scheme)) return schemeHandlerProbes.get(scheme)
  const probe = new Promise(resolve => {
    let child
    try {
      child = spawn('reg', ['query', `HKEY_CLASSES_ROOT\\${scheme}\\shell\\open\\command`, '/ve'], {
        windowsHide: true,
      })
    } catch {
      resolve(false)
      return
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      resolve(false)
    }, 2000)
    child.on('error', () => { clearTimeout(timer); resolve(false) })
    child.on('close', code => { clearTimeout(timer); resolve(code === 0) })
  })
  schemeHandlerProbes.set(scheme, probe)
  return probe
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ shell: import('electron').Shell }} deps
 */
function registerOpenExternalIpc(ipcMain, deps) {
  const { shell } = deps

  ipcMain.handle('open-external', async (_e, url) => {
    const raw = String(url || '').trim()
    let parsed
    try { parsed = new URL(raw) } catch { return { ok: false, message: '无效链接' } }
    if (parsed.protocol === 'file:') {
      let filePath = ''
      try { filePath = fileURLToPath(raw) } catch { return { ok: false, message: '无效本地路径' } }
      try {
        const err = await shell.openPath(filePath)
        return err ? { ok: false, message: err || '无法打开本地文件' } : { ok: true, viaPath: true }
      } catch (err) {
        return { ok: false, message: err.message || '无法打开本地文件' }
      }
    }
    const allowed = new Set(['http:', 'https:', 'mailto:'])
    if (!allowed.has(parsed.protocol)) return { ok: false, message: '不允许的协议' }
    // An AppLink https page exists only to hand off to the desktop client, so the
    // browser tab is a visible detour. Go straight to the client when it is installed.
    const clientUrl = feishuLink.buildFeishuClientUrl(raw)
    if (clientUrl && await hasSchemeHandler(clientUrl.slice(0, clientUrl.indexOf(':')))) {
      try {
        await shell.openExternal(clientUrl)
        return { ok: true, viaClient: true }
      } catch { /* fall back to the https page below */ }
    }
    try {
      await shell.openExternal(raw)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err.message || '无法打开链接' }
    }
  })
}

module.exports = {
  registerOpenExternalIpc,
  hasSchemeHandler,
}
