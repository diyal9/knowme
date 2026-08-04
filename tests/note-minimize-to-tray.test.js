/**
 * 单窗口工作台 — 托盘与旧浮窗入口
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('note-minimize-to-tray', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')

  it('托盘恢复只显示工作台', () => {
    assert.ok(main.includes('function restoreAppWindows'), 'restoreAppWindows present')
    assert.ok(main.includes('createWorkspaceWindow()'), 'workspace restore')
    assert.ok(main.includes("label: '显示工作台'"), 'tray label')
    assert.ok(!main.includes("ipcMain.on('note-minimize-tray'"), 'legacy IPC removed')
  })

  it('设置仍保留备份但不暴露浮窗分类入口', () => {
    assert.ok(settingsHtml.includes('便签备份'), 'backup remains')
    assert.ok(!preload.includes('minimizeToTray'), 'legacy preload removed')
    assert.ok(!preload.includes('notesBatchClassify'), 'classification API removed')
  })

  it('settings copy no longer points delete at top-bar trash', () => {
    assert.ok(settingsHtml.includes('最小化'), 'mentions minimize')
    assert.ok(!settingsHtml.includes('删除请点垃圾桶'), 'old trash delete copy removed')
  })
})
