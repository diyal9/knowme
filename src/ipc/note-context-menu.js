'use strict'

/**
 * Note / list context menu IPC.
 */
function registerNoteContextMenuIpc(ipcMain, deps) {
  const {
    Menu,
    BrowserWindow,
    dialog,
    clipboard,
    readNote,
    saveNote,
    deleteNoteF,
    loadAllNotes,
    newVersion,
    duplicateNote,
    noteWins,
    delPending,
    resumeAfterNoteHide,
    clearLastClosedIf,
    updateTray,
    updateTaskbarAnchor,
    showNote,
    getListWin,
    productMemory,
    MEMORY_DIR,
  } = deps

  ipcMain.on('show-context-menu', (event, noteId) => {
    const n = readNote(noteId)
    const isFav = n?.favorite
    const listWin = getListWin()
    const menu = Menu.buildFromTemplate([
      { label: '复制全文', click: () => event.sender.send('cmd-copy') },
      { type: 'separator' },
      { label: isFav ? '★ 取消收藏' : '☆ 添加收藏', click: () => {
        const nn = readNote(noteId); if (!nn) return
        nn.favorite = !nn.favorite; saveNote(nn)
        event.sender.send('favorite-changed', nn.favorite)
        if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
        updateTray()
      } },
      { type: 'separator' },
      { label: '迭代新版本  ↑', click: () => newVersion(noteId) },
      { label: '复制卡片', click: () => duplicateNote(noteId) },
      { type: 'separator' },
      { label: '关闭窗口（隐藏）', click: () => {
        const w = noteWins.get(noteId)
        if (w && !w.isDestroyed()) w.hide()
        resumeAfterNoteHide(noteId)
      } },
      { label: '删除便签…', click: () => event.sender.send('cmd-delete') },
    ])
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
  })

  ipcMain.on('show-list-context-menu', (event, payload) => {
    const noteId = payload?.noteId
    const groupKey = payload?.groupKey || null
    const groupSize = Number(payload?.groupSize) || 0
    const n = readNote(noteId)
    if (!n) return
    const win = BrowserWindow.fromWebContents(event.sender)
    const listWin = getListWin()
    const isFav = !!n.favorite
    const items = [
      {
        label: '快捷复制全文',
        click: () => {
          const nn = readNote(noteId)
          if (!nn) return
          clipboard.writeText(String(nn.content || ''))
          nn.copyCount = (nn.copyCount || 0) + 1
          saveNote(nn)
          productMemory.capture(MEMORY_DIR, {
            kind: 'telemetry',
            summary: `复制提示词：${(nn.project || '未命名')} v${nn.version || '0.1'}`,
            meta: { noteId, action: 'copy' },
          })
          if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
        },
      },
      { type: 'separator' },
      {
        label: '打开',
        click: () => {
          showNote(noteId)
          setImmediate(() => {
            if (listWin && !listWin.isDestroyed() && listWin.isVisible()) listWin.hide()
            const nw = noteWins.get(noteId)
            if (nw && !nw.isDestroyed()) {
              nw.show()
              nw.focus()
              nw.moveTop()
            }
            updateTaskbarAnchor()
          })
        },
      },
      {
        label: isFav ? '★ 取消收藏' : '☆ 收藏',
        click: () => {
          const nn = readNote(noteId)
          if (!nn) return
          nn.favorite = !nn.favorite
          saveNote(nn)
          productMemory.capture(MEMORY_DIR, {
            kind: 'telemetry',
            summary: `${nn.favorite ? '收藏' : '取消收藏'}：${nn.project || '未命名'}`,
            meta: { noteId, action: 'favorite' },
          })
          const nw = noteWins.get(noteId)
          if (nw && !nw.isDestroyed()) nw.webContents.send('favorite-changed', nn.favorite)
          if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
          updateTray()
        },
      },
    ]
    if (groupSize > 1 && groupKey) {
      items.push({
        label: `查看全部 ${groupSize} 个版本`,
        click: () => event.sender.send('list-open-group', groupKey),
      })
    }
    items.push({ type: 'separator' })
    items.push({
      label: '删除…',
      click: () => {
        const title = (n.project || '').trim()
        const preview = (n.content?.split('\n')[0]?.trim() || '').substring(0, 40)
        const label = title || preview || '未命名便签'
        const choice = dialog.showMessageBoxSync(win || listWin, {
          type: 'warning',
          title: '删除便签？',
          message: `永久删除「${label}」？`,
          detail: '删除将从本机移除该便签，不可恢复。',
          buttons: ['永久删除', '取消'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        })
        if (choice !== 0) return
        delPending.add(noteId)
        deleteNoteF(noteId)
        clearLastClosedIf(noteId)
        const nw = noteWins.get(noteId)
        if (nw && !nw.isDestroyed()) nw.close()
        else { noteWins.delete(noteId); delPending.delete(noteId) }
        updateTray()
        if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
      },
    })
    Menu.buildFromTemplate(items).popup({ window: win })
  })
}

module.exports = { registerNoteContextMenuIpc }
