'use strict'

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

/**
 * Load Vite/React renderer. Never loads page-level src/*.html.
 * @param {import('electron').BrowserWindow} win
 * @param {{ viteEntry: string, viteDevPath?: string }} opts
 */
async function loadRendererEntry(win, opts) {
  const isDev = !app.isPackaged && process.argv.includes('--dev')
  if (isDev) {
    const base = String(process.env.KNOWME_VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
    const devPath = opts.viteDevPath || `/${opts.viteEntry}/`
    try {
      await win.loadURL(`${base}${devPath}`)
      return
    } catch (err) {
      console.warn('[renderer] vite dev URL failed, trying dist', err)
    }
  }
  const built = path.join(__dirname, '..', '..', 'dist', 'renderer', opts.viteEntry, 'index.html')
  if (fs.existsSync(built)) {
    await win.loadFile(built)
    return
  }
  const html = [
    '<!doctype html><meta charset="utf-8">',
    '<title>KnowMe 启动失败</title>',
    '<p>未找到 React 渲染产物。请先运行 npm run renderer:build 或 npm run renderer:dev。</p>',
    `<pre>${built}</pre>`,
  ].join('')
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

module.exports = { loadRendererEntry }
