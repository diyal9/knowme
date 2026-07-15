/**
 * note-close-resume — 关窗续编冒烟（结构/IPC 标记）
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('note-close-resume', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
  const listHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.html'), 'utf8')
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8')

  it('main tracks lastClosedNoteId and resumeAfterNoteHide', () => {
    assert.ok(main.includes('lastClosedNoteId'), 'memory id')
    assert.ok(main.includes('function resumeAfterNoteHide'), 'resume helper')
    assert.ok(main.includes('hasOtherVisibleNotes'), 'multi-note guard')
    assert.ok(main.includes('sendListHighlight'), 'list highlight IPC')
    assert.ok(main.includes('继续编辑：'), 'tray resume label')
    assert.ok(main.includes('resumeAfterNoteHide(note.id)'), 'close→hide path')
    assert.ok(main.includes("ipcMain.on('note-hide'"), 'note-hide handler')
    const hideAllBody = main.match(/function hideAllWindows\(\)\s*\{[\s\S]*?\n\}/)
    assert.ok(hideAllBody, 'hideAllWindows present')
    assert.ok(!hideAllBody[0].includes('resumeAfterNoteHide'), 'hide-all skips resume')
  })

  it('preload and list wire list-highlight flash', () => {
    assert.ok(preload.includes('onListHighlight'), 'preload API')
    assert.ok(preload.includes('list-highlight'), 'IPC channel')
    assert.ok(listHtml.includes('onListHighlight'), 'list listens')
    assert.ok(listHtml.includes('card-row.flash'), 'flash style')
    assert.ok(listHtml.includes('applyHighlight'), 'scroll+flash helper')
    assert.ok(listHtml.includes('pendingHighlightId'), 'pending id')
  })

  it('close button copy mentions overview resume', () => {
    assert.ok(noteHtml.includes('无其它便签时回总览'), 'btnHide title')
  })
})
