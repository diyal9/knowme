/**
 * note-minimize-to-tray — 顶栏最小化到托盘 + 恢复优先编辑窗
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('note-minimize-to-tray', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8')
  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')
  const icons = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-icons.js'), 'utf8')

  it('main minimizes to tray and restores last editing note first', () => {
    assert.ok(main.includes('function minimizeNoteToTray'), 'minimize helper')
    assert.ok(main.includes("ipcMain.on('note-minimize-tray'"), 'IPC channel')
    assert.ok(main.includes('minimizeNoteToTray(id)'), 'IPC wires helper')
    const minBody = main.match(/function minimizeNoteToTray\([\s\S]*?\n\}/)
    assert.ok(minBody, 'minimize body')
    assert.ok(minBody[0].includes('hideAllWindows'), 'hides all to tray')
    assert.ok(minBody[0].includes('lastClosedNoteId'), 'records session note')
    assert.ok(!minBody[0].includes('resumeAfterNoteHide'), 'does not open overview')

    assert.ok(main.includes('function restoreAppWindows'), 'restoreAppWindows present')
    const restoreIdx = main.indexOf('function restoreAppWindows')
    const restoreSlice = main.slice(restoreIdx, restoreIdx + 900)
    assert.ok(restoreSlice.includes('lastClosedNoteId'), 'prefers last note')
    assert.ok(restoreSlice.includes('showNote(lastClosedNoteId)'), 'showNote first')
    // 设置窗仅在可见时抢焦点，避免隐藏设置劫持托盘恢复
    assert.ok(restoreSlice.includes('settingsWin.isVisible()'), 'settings only if visible')
  })

  it('note toolbar uses minimize icon wired to minimizeToTray', () => {
    assert.ok(icons.includes('minimize:'), 'minimize glyph exists')
    assert.ok(noteHtml.includes('id="btnMin"'), 'btnMin')
    assert.ok(noteHtml.includes('data-icon="minimize"'), 'minimize icon')
    assert.ok(noteHtml.includes('最小化到托盘'), 'tooltip')
    assert.ok(noteHtml.includes('minimizeToTray'), 'click handler')
    assert.ok(!noteHtml.includes('id="btnDel"'), 'old delete toolbar gone')
    assert.ok(preload.includes('minimizeToTray'), 'preload API')
    assert.ok(preload.includes('note-minimize-tray'), 'preload channel')
  })

  it('settings copy no longer points delete at top-bar trash', () => {
    assert.ok(settingsHtml.includes('最小化'), 'mentions minimize')
    assert.ok(!settingsHtml.includes('删除请点垃圾桶'), 'old trash delete copy removed')
  })
})
