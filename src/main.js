const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  globalShortcut, nativeImage, shell, clipboard, screen, dialog
} = require('electron')
const path = require('path')
const fs   = require('fs')
const https = require('https')
const http  = require('http')
const productKnowledge = require('./lib/product-knowledge')
const productMemory = require('./lib/product-memory')
const settingsSecure = require('./lib/settings-secure')
const notesBackup = require('./lib/notes-backup')
const { createAppIconPng, createTrayIconPng } = require('./lib/app-icon')
const { initAutoUpdate, checkForUpdatesManual } = require('./lib/auto-update')

// ── 路径 ─────────────────────────────────────────────────────────────────────
const DATA_DIR      = path.join(app.getPath('userData'), 'notes')
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
const KNOWLEDGE_DIR = path.join(app.getPath('userData'), 'knowledge')
const MEMORY_DIR    = path.join(app.getPath('userData'), 'memory')
const KNOWLEDGE_SEED = path.join(__dirname, 'assets', 'knowledge-seed')
const PROMPT_SPACE_DIR = process.env.STICKY_PROMPT_SPACE_DIR || ''
const PROMPT_SPACE_IMPORT_FLAG = path.join(app.getPath('userData'), 'prompt_space_imported.flag')
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-notes.json')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aispace.sticky-notes')
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// ── 默认设置 ──────────────────────────────────────────────────────────────────
const loadSettings  = () => settingsSecure.load(SETTINGS_FILE)
const saveSettings_ = s  => settingsSecure.save(SETTINGS_FILE, s)

// ── 应用图标（任务栏 / 托盘 / 跳转列表统一便签造型）────────────────────────
const ICON_DIR = path.join(__dirname, 'assets')
const ICON_PNG = path.join(ICON_DIR, 'icon.png')
let appIconImage = null
let jumpIconPath = process.execPath

function getAppIconImage() {
  if (!appIconImage || appIconImage.isEmpty()) {
    appIconImage = nativeImage.createFromBuffer(createAppIconPng(256))
  }
  return appIconImage
}

function ensureBrandIcons() {
  try {
    if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true })
    if (!fs.existsSync(ICON_PNG)) fs.writeFileSync(ICON_PNG, createAppIconPng(256))
    const jumpPng = path.join(app.getPath('userData'), 'jump-icon.png')
    fs.writeFileSync(jumpPng, createAppIconPng(32))
    jumpIconPath = jumpPng
  } catch {
    jumpIconPath = fs.existsSync(ICON_PNG) ? ICON_PNG : process.execPath
  }
}

const makeTrayIcon = () => nativeImage.createFromBuffer(createTrayIconPng(32))

// ── 状态 ─────────────────────────────────────────────────────────────────────
const noteWins   = new Map()
const delPending = new Set()
let tray = null, settingsWin = null, listWin = null
const taskbarHooked = new WeakSet()

function isAnyWindowVisible() {
  const wins = [settingsWin, listWin, ...noteWins.values()]
  return wins.some(w => w && !w.isDestroyed() && w.isVisible())
}

function restoreAppWindows() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  const notes = loadAllNotes()
  const visibleNote = [...noteWins.values()].find(w => !w.isDestroyed() && w.isVisible())
  if (visibleNote) {
    visibleNote.focus()
    return
  }
  if (listWin && !listWin.isDestroyed() && listWin.isVisible()) {
    listWin.focus()
    return
  }

  if (notes.length > 1) {
    if (!listWin || listWin.isDestroyed()) toggleListWin(true)
    else { listWin.show(); listWin.focus() }
  } else if (notes.length === 1) {
    showNote(notes[0].id)
  } else {
    newNote()
  }
  updateTaskbarAnchor()
  updateTray()
}

function hideAllWindows() {
  noteWins.forEach(w => { if (!w.isDestroyed()) w.hide() })
  if (listWin && !listWin.isDestroyed()) listWin.hide()
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide()
  updateTray()
}

function toggleAppVisibility() {
  if (isAnyWindowVisible()) hideAllWindows()
  else restoreAppWindows()
}

function hookTaskbarRestore(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed() || taskbarHooked.has(win)) return
  taskbarHooked.add(win)
  // WM_INITMENU — 任务栏图标被点击时触发（窗口处于 hide 状态时）
  win.hookWindowMessage(278, () => {
    if (!win.isDestroyed() && !isAnyWindowVisible()) restoreAppWindows()
  })
}

function updateTaskbarAnchor() {
  const notes = loadAllNotes()
  let anchor = null
  const visibleList = listWin && !listWin.isDestroyed() && listWin.isVisible() ? listWin : null
  const visibleNotes = [...noteWins.values()].filter(w => !w.isDestroyed() && w.isVisible())

  if (visibleList) anchor = listWin
  else if (visibleNotes.length === 1) anchor = visibleNotes[0]
  else if (listWin && !listWin.isDestroyed() && notes.length > 1) anchor = listWin
  else if (notes.length === 1) anchor = noteWins.get(notes[0].id) || null
  else if (noteWins.size === 1) anchor = [...noteWins.values()][0]

  noteWins.forEach(w => { if (!w.isDestroyed()) w.setSkipTaskbar(w !== anchor) })
  if (listWin && !listWin.isDestroyed()) listWin.setSkipTaskbar(listWin !== anchor)
  if (anchor && !anchor.isDestroyed()) hookTaskbarRestore(anchor)
}

function loadRecentIds() {
  try {
    const data = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'))
    return Array.isArray(data.ids) ? data.ids : []
  } catch { return [] }
}

function saveRecentIds(ids) {
  fs.writeFileSync(RECENT_FILE, JSON.stringify({ ids: ids.slice(0, 12) }), 'utf8')
}

function getRecentNotes() {
  const map = new Map(loadAllNotes().map(n => [n.id, n]))
  const ids = loadRecentIds()
  const ordered = ids.map(id => map.get(id)).filter(Boolean)
  if (ordered.length) return ordered
  return loadAllNotes().slice(0, 8)
}

function touchRecentNote(id) {
  if (!id || !readNote(id)) return
  const ids = loadRecentIds().filter(x => x !== id)
  ids.unshift(id)
  saveRecentIds(ids)
}

function jumpListArgs(extra) {
  return process.defaultApp ? `. ${extra}` : extra
}

function parseLaunchArgs(argv) {
  const args = (argv || process.argv).filter(a => typeof a === 'string')
  const openArg = args.find(a => a.startsWith('--open-note='))
  if (openArg) return { action: 'open-note', id: openArg.slice('--open-note='.length) }
  if (args.includes('--new-note')) return { action: 'new-note' }
  if (args.includes('--open-list')) return { action: 'open-list' }
  return null
}

function handleLaunchArgs(argv) {
  const launch = parseLaunchArgs(argv)
  if (!launch) return false
  if (launch.action === 'open-note' && launch.id) { showNote(launch.id); return true }
  if (launch.action === 'new-note') { newNote(); return true }
  if (launch.action === 'open-list') { toggleListWin(true); return true }
  return false
}

function updateJumpList() {
  if (process.platform !== 'win32') return
  const iconPath = jumpIconPath
  const recentItems = getRecentNotes().slice(0, 8).map(n => ({
    type: 'task',
    title: (n.project?.trim() || '未命名').slice(0, 64),
    description: (n.content?.split('\n')[0]?.trim() || '(空)').slice(0, 128),
    program: process.execPath,
    args: jumpListArgs(`--open-note=${n.id}`),
    iconPath,
    iconIndex: 0,
  }))
  const categories = []
  if (recentItems.length) {
    categories.push({ type: 'custom', name: '最近使用', items: recentItems })
  }
  categories.push({
    type: 'tasks',
    items: [
      { type: 'task', title: '新建提示词', program: process.execPath, args: jumpListArgs('--new-note'), iconPath, iconIndex: 0 },
      { type: 'task', title: '总览列表', program: process.execPath, args: jumpListArgs('--open-list'), iconPath, iconIndex: 0 },
    ],
  })
  try { app.setJumpList(categories) } catch {}
}

// ── 持久化 ────────────────────────────────────────────────────────────────────
const notePath     = id => path.join(DATA_DIR, `${id}.json`)
const saveNote     = note => { note.updatedAt = new Date().toISOString(); fs.writeFileSync(notePath(note.id), JSON.stringify(note, null, 2), 'utf8') }
const readNote     = id  => { try { return JSON.parse(fs.readFileSync(notePath(id), 'utf8')) } catch { return null } }
const deleteNoteF  = id  => { try { fs.unlinkSync(notePath(id)) } catch {} }

const loadAllNotes = () => {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => {
    try {
      const n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
      let dirty = false
      if (n.project   === undefined) { n.project   = '';    dirty = true }
      if (n.version   === undefined) { n.version   = '0.1'; dirty = true }
      if (n.favorite  === undefined) { n.favorite  = false; dirty = true }
      if (n.tags      === undefined) { n.tags      = [];    dirty = true }
      if (n.copyCount === undefined) { n.copyCount = 0;     dirty = true }
      if (n.projectManual === undefined) { n.projectManual = !!n.project?.trim(); dirty = true }
      if (dirty) saveNote(n)
      return n
    } catch { return null }
  }).filter(Boolean).sort((a, b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0))
}

function walkPromptFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkPromptFiles(full, acc)
    else {
      const ext = path.extname(name).toLowerCase()
      if (['.txt', '.md'].includes(ext) || !ext) acc.push(full)
    }
  }
  return acc
}

function getImportedPromptMeta(file) {
  const rel = path.relative(PROMPT_SPACE_DIR, file)
  const parts = rel.split(path.sep)
  const base = path.basename(file, path.extname(file))
  const parent = parts.length > 1 ? parts[parts.length - 2] : ''
  const versionMatch = base.match(/^v(\d+(?:\.\d+)*)/i)
  const version = versionMatch ? versionMatch[1] : '0.1'
  const name = versionMatch && parent ? parent : base
  return {
    name,
    version,
    group: parts.slice(0, -1).join('/'),
    tags: parts.slice(0, Math.max(1, parts.length - 1)).filter(Boolean),
    rel
  }
}

function importPromptSpace() {
  if (!PROMPT_SPACE_DIR || !fs.existsSync(PROMPT_SPACE_DIR)) {
    return { ok: false, error: PROMPT_SPACE_DIR
      ? `目录不存在：${PROMPT_SPACE_DIR}`
      : '未配置 STICKY_PROMPT_SPACE_DIR 环境变量' }
  }

  const existing = new Set(loadAllNotes().map(n => n.sourcePath).filter(Boolean).map(p => path.normalize(p).toLowerCase()))
  const files = walkPromptFiles(PROMPT_SPACE_DIR)
  let imported = 0, skipped = 0, failed = 0

  for (const file of files) {
    const key = path.normalize(file).toLowerCase()
    if (existing.has(key)) { skipped++; continue }
    try {
      const content = fs.readFileSync(file, 'utf8')
      const meta = getImportedPromptMeta(file)
      const id = `n_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
      const pos = getNewNotePos(imported)
      const note = {
        id,
        content,
        project: meta.name,
        version: meta.version,
        favorite: false,
        tags: meta.tags,
        promptGroup: meta.group,
        sourcePath: file,
        sourceRelPath: meta.rel,
        copyCount: 0,
        ...pos,
        w: 360,
        h: 490,
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      saveNote(note)
      existing.add(key)
      imported++
    } catch {
      failed++
    }
  }

  updateTray()
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  productMemory.capture(MEMORY_DIR, {
    kind: 'workflow',
    summary: `导入 prompt_space：${imported} 张卡片`,
    meta: { action: 'import-prompt-space', imported, skipped, failed },
  })
  return { ok: true, imported, skipped, failed, total: files.length }
}

// ── 主显示器中心位置 ──────────────────────────────────────────────────────────
function getNewNotePos(idx = 0) {
  const d = screen.getPrimaryDisplay()
  const { x: wx, y: wy, width: ww, height: wh } = d.workArea
  const offset = (idx % 12) * 26
  return {
    x: wx + Math.round(ww * 0.18) + offset,
    y: wy + Math.round(wh * 0.14) + offset
  }
}

// ── 托盘菜单 ──────────────────────────────────────────────────────────────────
function updateTray() {
  if (!tray) return
  const notes = loadAllNotes()
  const noteItems = notes.length
    ? notes.slice(0, 12).map(n => {
        const label = ((n.project ? `[${n.project}] ` : '') + (n.content?.split('\n')[0]?.trim() || '(空)')).substring(0, 32)
        const win = noteWins.get(n.id)
        return { label: `${win && !win.isDestroyed() && win.isVisible() ? '● ' : '○ '}${label}`, click: () => showNote(n.id) }
      })
    : [{ label: '暂无卡片', enabled: false }]

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '新建提示词',  accelerator: 'CmdOrCtrl+Alt+N', click: newNote },
    { label: '总览…',       accelerator: 'CmdOrCtrl+Alt+L', click: toggleListWin },
    { type: 'separator' },
    ...noteItems,
    { type: 'separator' },
    { label: '显示全部', click: () => { restoreAppWindows() } },
    { label: '隐藏全部', click: () => { hideAllWindows() } },
    { type: 'separator' },
    { label: '设置…', click: openSettings },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]))
  updateJumpList()
}

// ── 便签窗口 ──────────────────────────────────────────────────────────────────
function createNoteWindow(note) {
  const win = new BrowserWindow({
    x: Math.max(0, note.x ?? 240), y: Math.max(0, note.y ?? 160),
    width: note.w ?? 360, height: note.h ?? 490,
    minWidth: 280, minHeight: 260,
    frame: false, transparent: true,
    alwaysOnTop: note.pinned !== false,
    skipTaskbar: true, resizable: true, hasShadow: false,
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  })
  win.loadFile(path.join(__dirname, 'note.html'))
  win.webContents.on('did-finish-load', () => {
    const n = readNote(note.id)
    if (n) applyNoteLayout(win, n)
    win.webContents.send('init-note', n || note)
  })

  const saveGeo = () => {
    if (layoutApplying.has(win)) return
    const n = readNote(note.id); if (!n) return
    const [x,y] = win.getPosition(), [w,h] = win.getSize()
    Object.assign(n, {x,y,w,h}); saveNote(n)
  }
  win.on('moved', saveGeo); win.on('resized', saveGeo)
  win.on('show', () => {
    const n = readNote(note.id)
    if (n) applyNoteLayout(win, n)
  })
  win.on('close', e => { if (!delPending.has(note.id)) { e.preventDefault(); win.hide(); updateTray() } })
  win.on('closed', () => { noteWins.delete(note.id); delPending.delete(note.id); updateTray() })
  noteWins.set(note.id, win)
  updateTaskbarAnchor()
  return win
}

const layoutApplying = new WeakSet()

const LAYOUT = {
  compact:      { w: 360, h: 490 },
  compactLarge: { w: 440, h: 580 },
  aiSplit:      { w: 1000, h: 620 },
  aiSplitLarge: { w: 1200, h: 680 },
}

function layoutSize(aiOpen, expanded) {
  if (aiOpen) return expanded ? LAYOUT.aiSplitLarge : LAYOUT.aiSplit
  return expanded ? LAYOUT.compactLarge : LAYOUT.compact
}

function applyNoteLayout(win, n) {
  const size = layoutSize(!!n.aiOpen, !!n.expanded)
  if (win.isDestroyed()) return { ...size, expanded: !!n.expanded, aiOpen: !!n.aiOpen }
  layoutApplying.add(win)
  win.setMinimumSize(n.aiOpen ? 800 : 280, n.aiOpen ? 500 : 260)
  win.setSize(size.w, size.h, false)
  n.w = size.w
  n.h = size.h
  saveNote(n)
  setImmediate(() => layoutApplying.delete(win))
  const state = { expanded: !!n.expanded, aiOpen: !!n.aiOpen, w: size.w, h: size.h }
  win.webContents.send('layout-changed', state)
  return state
}

ipcMain.handle('note-toggle-expand', (e, id, aiOpen) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const n = readNote(id)
  if (!win || !n || win.isDestroyed()) return { ok: false }
  n.aiOpen = !!aiOpen
  n.expanded = !n.expanded
  const state = applyNoteLayout(win, n)
  return { ok: true, ...state }
})

ipcMain.handle('note-set-ai-mode', (e, id, aiOpen) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const n = readNote(id)
  if (!win || !n || win.isDestroyed()) return { ok: false }
  n.aiOpen = !!aiOpen
  const state = applyNoteLayout(win, n)
  return { ok: true, ...state }
})

function newNote() {
  const id = `n_${Date.now()}`
  const pos = getNewNotePos(noteWins.size)
  const note = { id, content:'', project:'', version:'0.1', favorite:false, tags:[], copyCount:0, ...pos, w:360, h:490, pinned:true, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function newVersion(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const parts = (orig.version||'0.1').split('.').map(Number)
  parts[parts.length - 1] += 1
  const id = `n_${Date.now()}`
  const pos = getNewNotePos(noteWins.size)
  const note = { ...orig, id, version: parts.join('.'), ...pos, x: orig.x+24, y: orig.y+24, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function duplicateNote(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const id = `n_${Date.now()}`
  const note = { ...orig, id, x:orig.x+32, y:orig.y+32, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function showNote(id) {
  const n = readNote(id)
  if (!n) return
  touchRecentNote(id)
  const win = noteWins.get(id)
  if (win && !win.isDestroyed()) { win.show(); win.focus() }
  else {
    const created = createNoteWindow(n)
    created.show()
    created.focus()
  }
  updateTaskbarAnchor()
  updateJumpList()
  updateTray()
}

// ── 设置窗口 ──────────────────────────────────────────────────────────────────
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return }
  settingsWin = new BrowserWindow({ width:520, height:720, minWidth:480, minHeight:560,
    title:'Sticky-Notes — 设置', center:true, resizable:true,
    frame:true, autoHideMenuBar:true, backgroundColor:'#f8f7f4',
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  settingsWin.loadFile(path.join(__dirname,'settings.html'))
  settingsWin.webContents.on('did-finish-load', () => settingsWin.webContents.send('init-settings', loadSettings()))
  settingsWin.on('closed', () => { settingsWin = null })
}

// ── 总览面板 ──────────────────────────────────────────────────────────────────
function toggleListWin(forceShow = false) {
  if (listWin && !listWin.isDestroyed()) {
    if (forceShow) { listWin.show(); listWin.focus(); updateTaskbarAnchor(); return }
    listWin.isVisible() ? listWin.hide() : (listWin.show(), listWin.focus())
    updateTray()
    return
  }
  const d = screen.getPrimaryDisplay()
  const { x:wx, y:wy, width:ww, height:wh } = d.workArea
  listWin = new BrowserWindow({
    x: wx + ww - 430, y: wy + 60,
    width:410, height:580,
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:false, resizable:true,
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  listWin.loadFile(path.join(__dirname,'list.html'))
  listWin.webContents.on('did-finish-load', () => listWin.webContents.send('init-list', loadAllNotes()))
  listWin.on('close', e => { e.preventDefault(); listWin.hide(); updateTray() })
  listWin.on('closed', () => { listWin = null; updateTaskbarAnchor() })
  updateTaskbarAnchor()
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('note-update', (_e, data) => {
  const n = readNote(data.id); if (!n) return
  Object.assign(n, data); saveNote(n); updateTray()
  // 通知总览更新
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
})
ipcMain.on('note-delete', (_e, id) => {
  const n = readNote(id)
  const label = ((n?.project ? `[${n.project}] ` : '') + (n?.content?.split('\n')[0]?.trim() || '便签')).substring(0, 48)
  const parent = BrowserWindow.getFocusedWindow() || [...noteWins.values()].find(w => w && !w.isDestroyed()) || null
  const choice = dialog.showMessageBoxSync(parent, {
    type: 'warning',
    title: '删除便签',
    message: `确定删除「${label}」？`,
    detail: '此操作不可恢复。可在设置 → 系统 中先导出便签备份。',
    buttons: ['删除', '取消'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })
  if (choice !== 0) return
  delPending.add(id); deleteNoteF(id)
  const w = noteWins.get(id)
  if (w && !w.isDestroyed()) w.close()
  else { noteWins.delete(id); delPending.delete(id) }
  updateTray()
})
ipcMain.on('note-hide',       (_e, id) => { const w=noteWins.get(id); if(w&&!w.isDestroyed())w.hide(); updateTray() })
ipcMain.on('note-pin-toggle', (_e, id) => {
  const w=noteWins.get(id), n=readNote(id); if(!w||!n)return
  n.pinned=!n.pinned; saveNote(n); w.setAlwaysOnTop(n.pinned); w.webContents.send('pin-changed', n.pinned)
})
ipcMain.on('new-note',        newNote)
ipcMain.on('new-version',     (_e, id) => newVersion(id))
ipcMain.on('duplicate-note',  (_e, id) => duplicateNote(id))
ipcMain.on('focus-note', (_e, id) => {
  showNote(id)
  if (listWin && !listWin.isDestroyed()) listWin.hide()
  updateTaskbarAnchor()
})
ipcMain.on('close-list',      () => { if(listWin&&!listWin.isDestroyed())listWin.hide() })
ipcMain.handle('save-settings', (_e, s) => saveSettings_(s))
ipcMain.on('get-settings',    e => { e.returnValue = loadSettings() })

ipcMain.on('copy-to-clipboard', (_e, text) => clipboard.writeText(text))
ipcMain.on('open-data-dir',    ()  => shell.openPath(DATA_DIR))
ipcMain.on('open-prompt-space', () => {
  if (PROMPT_SPACE_DIR) shell.openPath(PROMPT_SPACE_DIR)
})
ipcMain.on('set-autostart',    (_e, v) => app.setLoginItemSettings({ openAtLogin: !!v }))
ipcMain.on('get-autostart',    e  => { e.returnValue = app.getLoginItemSettings().openAtLogin })
ipcMain.handle('import-prompt-space', () => importPromptSpace())

ipcMain.on('note-toggle-favorite', (_e, id) => {
  const n = readNote(id); if (!n) return
  n.favorite = !n.favorite; saveNote(n)
  productMemory.capture(MEMORY_DIR, {
    kind: 'habit',
    summary: `${n.favorite ? '收藏' : '取消收藏'}：${n.project || '未命名'}`,
    meta: { noteId: id, action: 'favorite' },
  })
  const w = noteWins.get(id)
  if (w && !w.isDestroyed()) w.webContents.send('favorite-changed', n.favorite)
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  updateTray()
})

ipcMain.on('note-increment-copy', (_e, id) => {
  const n = readNote(id); if (!n) return
  n.copyCount = (n.copyCount || 0) + 1; saveNote(n)
  productMemory.capture(MEMORY_DIR, {
    kind: 'habit',
    summary: `复制提示词：${(n.project || '未命名')} v${n.version || '0.1'}`,
    meta: { noteId: id, action: 'copy' },
  })
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
})

ipcMain.on('show-context-menu', (event, noteId) => {
  const n = readNote(noteId)
  const isFav = n?.favorite
  const menu = Menu.buildFromTemplate([
    { label: '复制全文',                        click: () => event.sender.send('cmd-copy') },
    { type: 'separator' },
    { label: isFav ? '★ 取消收藏' : '☆ 添加收藏', click: () => {
        const nn=readNote(noteId); if(!nn)return; nn.favorite=!nn.favorite; saveNote(nn)
        event.sender.send('favorite-changed', nn.favorite)
        if(listWin&&!listWin.isDestroyed())listWin.webContents.send('init-list',loadAllNotes())
        updateTray()
      }
    },
    { type: 'separator' },
    { label: '迭代新版本  ↑',  click: () => newVersion(noteId) },
    { label: '复制卡片',       click: () => duplicateNote(noteId) },
    { type: 'separator' },
    { label: '删除',           click: () => event.sender.send('cmd-delete') }
  ])
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
})

function normalizeChatEndpoint(endpoint) {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (/\/chat\/completions(\?|$)/.test(trimmed)) return trimmed
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return trimmed
}

function parseSseLines(buffer, onDelta) {
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const j = JSON.parse(payload)
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).substring(0, 200))
      const delta = j.choices?.[0]?.delta?.content
      if (delta) onDelta(delta)
    } catch (e) {
      if (e.message && !e.message.includes('Unexpected')) throw e
    }
  }
  return remainder
}

function extractChatText(json) {
  return json.choices?.[0]?.message?.content || ''
}

function cleanSuggestedTitle(raw) {
  return (raw || '')
    .trim()
    .replace(/^["'「『【《]|["'」』】》]$/g, '')
    .replace(/^(标题|Title)[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function localTitleFromParagraph(para) {
  const line = para.split('\n').map(l => l.trim()).find(Boolean) || para
  return cleanSuggestedTitle(line.replace(/^#+\s*/, ''))
}

function chatCompletionOnce(s, messages, maxTokens = 80) {
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  let url
  try { url = new URL(endpoint) } catch { return Promise.resolve({ error: `Endpoint 格式错误: ${s.apiEndpoint}` }) }

  const body = JSON.stringify({
    model: s.model || 'gpt-4o-mini',
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
    stream: false,
  })

  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const req = lib.request({
      hostname: url.hostname, port, method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const j = JSON.parse(data)
            resolve({ error: j.error?.message || j.message || `HTTP ${res.statusCode}` })
          } catch {
            resolve({ error: `HTTP ${res.statusCode}: ${data.substring(0, 120)}` })
          }
          return
        }
        try {
          const j = JSON.parse(data)
          if (j.error) resolve({ error: j.error.message || 'API 错误' })
          else resolve({ text: extractChatText(j) })
        } catch {
          resolve({ error: '响应解析失败' })
        }
      })
    })
    req.setTimeout(20000, () => { req.destroy(); resolve({ error: '请求超时' }) })
    req.on('error', e => resolve({ error: e.message }))
    req.write(body)
    req.end()
  })
}

ipcMain.handle('ai-suggest-title', async (_e, { content }) => {
  const trimmed = (content || '').trim()
  if (trimmed.length < 8) return { title: '' }

  const blank = trimmed.search(/\n\s*\n/)
  const para = (blank >= 0 ? trimmed.slice(0, blank) : trimmed).trim().slice(0, 600)
  if (para.length < 8) return { title: '' }

  const s = loadSettings()
  if (!s.apiKey || !s.apiEndpoint) {
    return { title: localTitleFromParagraph(para), local: true }
  }

  const result = await chatCompletionOnce(s, [
    {
      role: 'system',
      content: '根据用户提供的内容第一段，提炼一个简洁标题（不超过20字）。语言与内容一致。只输出标题本身，不要引号、标点装饰或解释。',
    },
    { role: 'user', content: para },
  ], 60)

  if (result.error || !result.text) {
    return { title: localTitleFromParagraph(para), local: true, error: result.error }
  }
  return { title: cleanSuggestedTitle(result.text) }
})

ipcMain.handle('ai-generate', async (e, { prompt, context }) => {
  const webContents = e.sender
  const s = loadSettings()
  if (!s.apiKey)      return { error: '未填写 API Key，请托盘右键 → API 设置' }
  if (!s.apiEndpoint) return { error: '未填写 API Endpoint，请托盘右键 → API 设置' }

  let url
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  try { url = new URL(endpoint) } catch { return { error: `Endpoint 格式错误: ${s.apiEndpoint}` } }

  const userMsg = context
    ? `当前提示词内容：\n"""\n${context}\n"""\n\n需求：${prompt}`
    : prompt

  const kbSnippet = productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
  const memCtx = productMemory.getContextForAI(MEMORY_DIR, kbSnippet)
  const systemContent = memCtx
    ? `${s.systemPrompt}\n\n---\n${memCtx}`
    : s.systemPrompt

  const body = JSON.stringify({
    model: s.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user',   content: userMsg }
    ],
    max_tokens: 2000,
    temperature: 0.7,
    stream: true
  })

  const pushChunk = (fullText) => {
    if (!webContents.isDestroyed()) {
      webContents.send('ai-stream-chunk', { text: fullText })
    }
  }

  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const req = lib.request({
      hostname: url.hostname, port, method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${s.apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = ''
      let sseBuf = ''
      let fullText = ''
      let streamed = false

      const finish = (result) => {
        if (result.text) {
          productMemory.capture(MEMORY_DIR, {
            kind: 'workflow',
            summary: `AI 生成：${prompt.slice(0, 120)}`,
            meta: { action: 'ai-generate' },
          })
        }
        resolve(result)
      }

      if (res.statusCode !== 200) {
        res.on('data', c => { raw += c })
        res.on('end', () => {
          try {
            const j = JSON.parse(raw)
            const msg = j.error?.message || j.message || JSON.stringify(j).substring(0, 200)
            finish({ error: `HTTP ${res.statusCode}: ${msg}` })
          } catch {
            finish({ error: `HTTP ${res.statusCode}: ${raw.substring(0, 200)}` })
          }
        })
        return
      }

      res.on('data', chunk => {
        const piece = chunk.toString()
        raw += piece
        try {
          sseBuf = parseSseLines(sseBuf + piece, delta => {
            fullText += delta
            streamed = true
            pushChunk(fullText)
          })
        } catch (err) {
          req.destroy()
          finish({ error: err.message || '流式响应解析失败' })
        }
      })

      res.on('end', () => {
        if (sseBuf.trim()) {
          try {
            parseSseLines(sseBuf + '\n', delta => {
              fullText += delta
              streamed = true
              pushChunk(fullText)
            })
          } catch (err) {
            finish({ error: err.message || '流式响应解析失败' })
            return
          }
        }

        if (!fullText) {
          try {
            const j = JSON.parse(raw)
            if (j.error) {
              finish({ error: j.error.message || JSON.stringify(j.error).substring(0, 200) })
              return
            }
            fullText = extractChatText(j)
            if (fullText && !streamed) pushChunk(fullText)
          } catch {
            const lines = raw.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'))
            if (lines.length > 0) {
              try {
                fullText = lines.map(l => JSON.parse(l.slice(6))?.choices?.[0]?.delta?.content || '').join('')
                if (fullText && !streamed) pushChunk(fullText)
              } catch {}
            }
          }
        }

        if (!fullText) {
          finish({ error: `响应格式异常 (${res.statusCode}): ${raw.substring(0, 200)}` })
          return
        }
        finish({ text: fullText, streamed })
      })
    })
    req.setTimeout(120000, () => { req.destroy(); resolve({ error: '请求超时（120s），请检查网络或 Endpoint' }) })
    req.on('error', e => resolve({ error: `连接失败: ${e.message}` }))
    req.write(body)
    req.end()
  })
})

// ── 产品知识库 OKF / Memory（用户数据目录，非仓库 brain/）────────────────────
ipcMain.handle('notes-export', async () => {
  const parent = BrowserWindow.getFocusedWindow() || settingsWin
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择便签备份导出目录',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
    ...(parent && !parent.isDestroyed() ? { browserWindow: parent } : {}),
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const dest = path.join(filePaths[0], `sticky-notes-backup-${new Date().toISOString().slice(0, 10)}`)
  const result = notesBackup.exportBundle(DATA_DIR, dest)
  if (result.ok) shell.showItemInFolder(dest)
  return result
})

ipcMain.handle('notes-import', async () => {
  const parent = BrowserWindow.getFocusedWindow() || settingsWin
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择便签备份文件夹',
    properties: ['openDirectory'],
    ...(parent && !parent.isDestroyed() ? { browserWindow: parent } : {}),
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const result = notesBackup.importBundle(DATA_DIR, filePaths[0])
  if (result.ok) updateTray()
  return result
})

ipcMain.handle('app-info', () => {
  const pkg = require('../package.json')
  return {
    version: app.getVersion() || pkg.version,
    isPackaged: app.isPackaged,
    name: pkg.productName || pkg.name,
  }
})

ipcMain.handle('check-for-updates', () => checkForUpdatesManual())

ipcMain.handle('knowledge-status', () => {
  const lint = productKnowledge.lint(KNOWLEDGE_DIR)
  return {
    path: KNOWLEDGE_DIR,
    concepts: lint.concepts,
    ok: lint.ok,
    errors: lint.errors.length,
    items: productKnowledge.listConcepts(KNOWLEDGE_DIR, 20),
  }
})

ipcMain.handle('knowledge-export', async () => {
  const parent = BrowserWindow.getFocusedWindow() || settingsWin
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择导出目标文件夹',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
    ...(parent && !parent.isDestroyed() ? { browserWindow: parent } : {}),
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const dest = path.join(filePaths[0], `sticky-notes-knowledge-${new Date().toISOString().slice(0, 10)}`)
  const result = productKnowledge.exportBundle(KNOWLEDGE_DIR, dest)
  if (result.ok) shell.showItemInFolder(dest)
  return result
})

ipcMain.handle('knowledge-import', async () => {
  const parent = BrowserWindow.getFocusedWindow() || settingsWin
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择要导入的 OKF 知识包文件夹',
    properties: ['openDirectory'],
    ...(parent && !parent.isDestroyed() ? { browserWindow: parent } : {}),
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const result = productKnowledge.importBundle(KNOWLEDGE_DIR, filePaths[0])
  if (!result.ok) {
    const lintErr = result.lint?.errors
    const first = Array.isArray(lintErr) && lintErr[0]
      ? (lintErr[0].message || lintErr[0])
      : null
    result.error = first || result.error || '知识包校验失败，请确认文件夹含 index.md 与概念文件'
  }
  return result
})

ipcMain.on('open-knowledge-dir', () => shell.openPath(KNOWLEDGE_DIR))
ipcMain.on('open-memory-dir', () => shell.openPath(MEMORY_DIR))
ipcMain.handle('memory-status', () => productMemory.status(MEMORY_DIR))

// ── 启动 ──────────────────────────────────────────────────────────────────────
if (gotSingleInstanceLock) {
  app.on('second-instance', (_e, commandLine) => {
    if (!handleLaunchArgs(commandLine)) restoreAppWindows()
  })
  app.on('activate', () => restoreAppWindows())

  app.whenReady().then(() => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    ensureBrandIcons()
    if (process.platform === 'darwin' && app.dock) app.dock.setIcon(getAppIconImage())
    productKnowledge.ensureKnowledge(KNOWLEDGE_DIR, KNOWLEDGE_SEED)
    productMemory.ensureMemory(MEMORY_DIR)
    tray = new Tray(makeTrayIcon())
    tray.setToolTip('Sticky-Notes  左键显示/隐藏 · 右键菜单')
    tray.on('click', toggleAppVisibility)
    tray.on('double-click', () => restoreAppWindows())
    updateTray()
    globalShortcut.register('CmdOrCtrl+Alt+N', newNote)
    globalShortcut.register('CmdOrCtrl+Alt+L', toggleListWin)
    settingsSecure.stripPlaintextApiKey(SETTINGS_FILE)
    if (process.argv.includes('--dev') && PROMPT_SPACE_DIR && !fs.existsSync(PROMPT_SPACE_IMPORT_FLAG)) {
      const result = importPromptSpace()
      try { fs.writeFileSync(PROMPT_SPACE_IMPORT_FLAG, JSON.stringify(result, null, 2), 'utf8') } catch {}
    }
    const notes = loadAllNotes()
    if (!handleLaunchArgs(process.argv)) {
      if (!notes.length) newNote()
      else if (notes.length === 1) createNoteWindow(notes[0])
      else toggleListWin(true)
    }
    updateTaskbarAnchor()
    updateJumpList()
    initAutoUpdate()
  })
}
app.on('window-all-closed', () => {})
app.on('will-quit', () => globalShortcut.unregisterAll())

process.on('uncaughtException', err => {
  console.error('[fatal]', err?.stack || err)
})
process.on('unhandledRejection', err => {
  console.error('[unhandled]', err?.stack || err)
})
