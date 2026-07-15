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
const {
  buildSystemContent,
  buildChatMessages,
} = require('./lib/ai-assistant-context')
const notesBackup = require('./lib/notes-backup')
const promptSections = require('./lib/prompt-sections')
const promptOkf = require('./lib/prompt-okf')
const noteDiff = require('./lib/note-diff')
const noteVersions = require('./lib/note-versions')
const noteClassify = require('./lib/note-classify')
const skillPack = require('./lib/skill-pack')
const { createAppIconPng, createTrayIconPng, createAppIcoBuffer } = require('./lib/app-icon')
const { initAutoUpdate, checkForUpdatesManual } = require('./lib/auto-update')

const THEME_LABELS = {
  nine_center: '活动中心',
  nine_skills: '技能包',
  tools: '工具',
  workbench: '工作台',
  daemon: 'Daemon',
  webui: 'WebUI',
}

function themeDisplayLabel(theme) {
  return THEME_LABELS[theme] || theme
}

function broadcastSkillPackSuggest() {
  const suggestions = skillPack.scanSuggestions(
    loadAllNotes(),
    MEMORY_DIR,
    themeDisplayLabel
  )
  if (!suggestions.length) return
  const payload = suggestions[0]
  for (const [, w] of noteWins) {
    if (w && !w.isDestroyed()) w.webContents.send('skill-pack-suggest', payload)
  }
  if (listWin && !listWin.isDestroyed()) {
    listWin.webContents.send('skill-pack-suggest', payload)
  }
}

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
// Windows 任务栏（尤其透明无边框窗口）需要多尺寸 .ico，单尺寸 PNG 会回退到系统默认图标。
// 释放到 userData（asar 外）后再用 createFromPath 加载，避免读取 asar 内文件失败。
let winIcoPath = null

function getAppIconImage() {
  if (!appIconImage || appIconImage.isEmpty()) {
    if (process.platform === 'win32' && winIcoPath && fs.existsSync(winIcoPath)) {
      appIconImage = nativeImage.createFromPath(winIcoPath)
    }
    if (!appIconImage || appIconImage.isEmpty()) {
      appIconImage = nativeImage.createFromBuffer(createAppIconPng(256))
    }
  }
  return appIconImage
}

function ensureBrandIcons() {
  try {
    if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true })
    if (!fs.existsSync(ICON_PNG)) fs.writeFileSync(ICON_PNG, createAppIconPng(256))
    const userData = app.getPath('userData')
    if (process.platform === 'win32') {
      const ico = path.join(userData, 'app-icon.ico')
      fs.writeFileSync(ico, createAppIcoBuffer())
      winIcoPath = ico
      appIconImage = null
    }
    const jumpPng = path.join(userData, 'jump-icon.png')
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
let tray = null, settingsWin = null, listWin = null, memoryWin = null
const taskbarHooked = new WeakSet()
const APP_DISPLAY_NAME = 'Sticky-Notes'
let isQuitting = false
/** 最近一次用户有意关闭（隐藏）的便签，供托盘「继续编辑」 */
let lastClosedNoteId = null

function noteLabelForMenu(n) {
  if (!n) return '未命名'
  const title = (n.project || '').trim()
  if (title) return title.slice(0, 28)
  const line = (n.content || '').split('\n')[0].trim()
  return (line || '未命名').slice(0, 28)
}

function hasOtherVisibleNotes(exceptId) {
  for (const [id, w] of noteWins) {
    if (exceptId && id === exceptId) continue
    if (w && !w.isDestroyed() && w.isVisible()) return true
  }
  return false
}

function sendListHighlight(noteId) {
  if (!listWin || listWin.isDestroyed() || !noteId) return
  const push = () => {
    if (!listWin || listWin.isDestroyed()) return
    listWin.webContents.send('init-list', loadAllNotes())
    listWin.webContents.send('list-highlight', noteId)
  }
  if (listWin.webContents.isLoading()) {
    listWin.webContents.once('did-finish-load', push)
  } else {
    push()
  }
}

/** 用户关闭单张便签后的续编路径（隐藏全部 / 退出不走这里） */
function resumeAfterNoteHide(noteId) {
  if (!noteId || delPending.has(noteId)) return
  const n = readNote(noteId)
  if (!n || isNoteEmpty(n)) {
    if (lastClosedNoteId === noteId) lastClosedNoteId = null
    updateTray()
    return
  }
  lastClosedNoteId = noteId
  updateTray()
  if (hasOtherVisibleNotes(noteId)) return
  toggleListWin(true)
  setImmediate(() => sendListHighlight(noteId))
}

function isAnyWindowVisible() {
  const wins = [settingsWin, listWin, ...noteWins.values()]
  return wins.some(w => w && !w.isDestroyed() && w.isVisible())
}

function restoreAppWindows() {
  const visibleNote = [...noteWins.values()].find(w => !w.isDestroyed() && w.isVisible())
  if (visibleNote) {
    visibleNote.focus()
    return
  }
  if (listWin && !listWin.isDestroyed() && listWin.isVisible()) {
    listWin.focus()
    return
  }
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
    bringSettingsToFront()
    return
  }

  // 任务栏 / 托盘恢复：优先回到最近编辑（含最小化到托盘）的便签
  if (lastClosedNoteId && readNote(lastClosedNoteId)) {
    showNote(lastClosedNoteId)
    updateTaskbarAnchor()
    updateTray()
    return
  }

  const notes = loadAllNotes()
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

/** 顶栏「最小化到托盘」：隐藏全部窗口，恢复时优先打开该编辑窗 */
function minimizeNoteToTray(noteId) {
  if (noteId && readNote(noteId)) {
    lastClosedNoteId = noteId
    updateTray()
  }
  hideAllWindows()
  updateTaskbarAnchor()
}

function hideAllWindows() {
  noteWins.forEach(w => { if (!w.isDestroyed()) w.hide() })
  if (listWin && !listWin.isDestroyed()) listWin.hide()
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide()
  if (memoryWin && !memoryWin.isDestroyed()) memoryWin.hide()
  updateTray()
}

function toggleAppVisibility() {
  if (isAnyWindowVisible()) hideAllWindows()
  else restoreAppWindows()
}

function requestAppQuit() {
  isQuitting = true
  app.quit()
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
  if (anchor && !anchor.isDestroyed()) {
    // 透明无边框窗口在任务栏偶发回退到默认图标，显式重设品牌图标
    try { anchor.setIcon(getAppIconImage()) } catch { /* noop */ }
    hookTaskbarRestore(anchor)
  }
}

function clampNoteToWorkArea(note) {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const fallback = {
    x: primary.workArea.x + Math.round(primary.workArea.width * 0.18),
    y: primary.workArea.y + Math.round(primary.workArea.height * 0.14),
  }
  let x = Number.isFinite(note?.x) ? note.x : fallback.x
  let y = Number.isFinite(note?.y) ? note.y : fallback.y
  const w = Number.isFinite(note?.w) ? note.w : 360
  const h = Number.isFinite(note?.h) ? note.h : 490
  const target = displays.find(d => {
    const wa = d.workArea
    return x >= wa.x && x <= wa.x + wa.width && y >= wa.y && y <= wa.y + wa.height
  }) || primary
  const wa = target.workArea
  const maxX = wa.x + Math.max(0, wa.width - Math.min(w, wa.width))
  const maxY = wa.y + Math.max(0, wa.height - Math.min(h, wa.height))
  const clampedX = Math.min(Math.max(x, wa.x), maxX)
  const clampedY = Math.min(Math.max(y, wa.y), maxY)
  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    changed: Math.round(clampedX) !== x || Math.round(clampedY) !== y,
  }
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
      { type: 'task', title: '新建笔记', program: process.execPath, args: jumpListArgs('--new-note'), iconPath, iconIndex: 0 },
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

// 空便签：无正文、无项目名、无结构化分段、未收藏 → 不值得保存
function isNoteEmpty(n) {
  if (!n) return false
  if (n.favorite) return false
  if ((n.content || '').trim()) return false
  if ((n.project || '').trim()) return false
  return true
}

// 清理无窗口打开的空便签（打开/刷新列表、启动时调用）
function purgeEmptyClosedNotes() {
  if (!fs.existsSync(DATA_DIR)) return 0
  let removed = 0
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!f.endsWith('.json')) continue
    const id = f.replace(/\.json$/, '')
    if (noteWins.has(id)) continue
    let n = null
    try { n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')) } catch { continue }
    if (isNoteEmpty(n)) { deleteNoteF(id); removed++ }
  }
  return removed
}

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
      if (promptSections.migrateNoteFields(n)) dirty = true
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
        w: 440,
        h: 580,
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

  const closed = lastClosedNoteId ? readNote(lastClosedNoteId) : null
  if (lastClosedNoteId && !closed) lastClosedNoteId = null
  const resumeItems = lastClosedNoteId && closed
    ? [
        { label: `继续编辑：${noteLabelForMenu(closed)}`, click: () => showNote(lastClosedNoteId) },
        { type: 'separator' },
      ]
    : []

  tray.setContextMenu(Menu.buildFromTemplate([
    ...resumeItems,
    { label: '新建笔记',  accelerator: 'CmdOrCtrl+Alt+N', click: newNote },
    { label: '总览…',       accelerator: 'CmdOrCtrl+Alt+L', click: toggleListWin },
    { label: '使用记忆…',   click: openMemoryPanel },
    { type: 'separator' },
    ...noteItems,
    { type: 'separator' },
    { label: '显示全部', click: () => { restoreAppWindows() } },
    { label: '隐藏全部', click: () => { hideAllWindows() } },
    { type: 'separator' },
    { label: '设置…', click: openSettings },
    { type: 'separator' },
    { label: '退出', click: requestAppQuit }
  ]))
  updateJumpList()
}

// ── 便签窗口 ──────────────────────────────────────────────────────────────────
function createNoteWindow(note) {
  const pos = clampNoteToWorkArea(note)
  if (pos.changed) {
    note.x = pos.x
    note.y = pos.y
    saveNote(note)
  }
  const win = new BrowserWindow({
    x: pos.x, y: pos.y,
    width: note.w ?? 440, height: note.h ?? 580,
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
  win.on('close', e => {
    // 空便签直接删除，不落盘（含退出场景）
    if (!delPending.has(note.id) && isNoteEmpty(readNote(note.id))) {
      deleteNoteF(note.id)
      return
    }
    if (isQuitting) return
    if (!delPending.has(note.id)) {
      e.preventDefault()
      win.hide()
      resumeAfterNoteHide(note.id)
    }
  })
  win.on('closed', () => {
    noteWins.delete(note.id)
    delPending.delete(note.id)
    if (lastClosedNoteId === note.id && !readNote(note.id)) lastClosedNoteId = null
    updateTray()
  })
  noteWins.set(note.id, win)
  updateTaskbarAnchor()
  return win
}

const layoutApplying = new WeakSet()

const LAYOUT = {
  note:    { w: 440, h: 580 },
  aiSplit: { w: 1280, h: 760 },
}

function layoutSize(aiOpen) {
  return aiOpen ? LAYOUT.aiSplit : LAYOUT.note
}

function applyNoteLayout(win, n) {
  const size = layoutSize(!!n.aiOpen)
  if (win.isDestroyed()) return { ...size, aiOpen: !!n.aiOpen }
  layoutApplying.add(win)
  win.setMinimumSize(n.aiOpen ? 800 : 280, n.aiOpen ? 500 : 260)
  win.setSize(size.w, size.h, false)
  n.w = size.w
  n.h = size.h
  n.expanded = true
  saveNote(n)
  setImmediate(() => layoutApplying.delete(win))
  const state = { aiOpen: !!n.aiOpen, w: size.w, h: size.h }
  win.webContents.send('layout-changed', state)
  return state
}

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
  const note = {
    id, content:'', project:'', version:'0.1', favorite:false, tags:[], copyCount:0,
    category:'', okfTags:[], okfConceptId:null, parentNoteId:null,
    sections:null, editorMode:'plain', mdView:'edit',
    ...pos, w:440, h:580, pinned:true,
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function newVersion(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const parts = (orig.version||'0.1').split('.').map(Number)
  parts[parts.length - 1] += 1
  const id = `n_${Date.now()}`
  const pos = getNewNotePos(noteWins.size)
  const note = {
    ...orig, id,
    version: parts.join('.'),
    parentNoteId: orig.id,
    ...pos, x: orig.x+24, y: orig.y+24,
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function duplicateNote(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const id = `n_${Date.now()}`
  const note = { ...orig, id, x:orig.x+32, y:orig.y+32, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  saveNote(note); const win = createNoteWindow(note); win.focus(); updateTray()
}

function bringNoteToFront(win, pinned) {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  // 从总览打开时强制置顶一瞬，避免被其它窗口挡住
  win.setAlwaysOnTop(true)
  win.show()
  win.focus()
  win.moveTop()
  // 恢复用户置顶偏好（未置顶则稍后取消 alwaysOnTop）
  const keepPinned = pinned !== false
  if (!keepPinned) {
    setTimeout(() => {
      if (!win.isDestroyed()) win.setAlwaysOnTop(false)
    }, 120)
  }
}

function showNote(id) {
  const n = readNote(id)
  if (!n) return
  const pos = clampNoteToWorkArea(n)
  if (pos.changed) {
    n.x = pos.x
    n.y = pos.y
    saveNote(n)
  }
  touchRecentNote(id)
  productMemory.capture(MEMORY_DIR, {
    kind: 'habit',
    summary: `打开提示词：${n.project || '未命名'} v${n.version || '0.1'}`,
    meta: { noteId: id, action: 'open' },
  })
  const win = noteWins.get(id)
  if (win && !win.isDestroyed()) {
    win.setPosition(n.x, n.y, false)
    bringNoteToFront(win, n.pinned)
  }
  else {
    const created = createNoteWindow(n)
    bringNoteToFront(created, n.pinned)
  }
  updateTaskbarAnchor()
  updateJumpList()
  updateTray()
}

// ── 设置窗口 ──────────────────────────────────────────────────────────────────
function bringSettingsToFront() {
  if (!settingsWin || settingsWin.isDestroyed()) return
  // 便签 / 总览默认 alwaysOnTop，设置窗必须临时抬升才能盖过它们
  settingsWin.setAlwaysOnTop(true)
  if (settingsWin.isMinimized()) settingsWin.restore()
  settingsWin.show()
  settingsWin.focus()
  settingsWin.moveTop()
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { bringSettingsToFront(); return }
  settingsWin = new BrowserWindow({ width:520, height:720, minWidth:480, minHeight:560,
    title:'Sticky-Notes — 设置', center:true, resizable:true,
    frame:true, autoHideMenuBar:true, backgroundColor:'#f8f7f4',
    alwaysOnTop:true,
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  settingsWin.loadFile(path.join(__dirname,'settings.html'))
  settingsWin.webContents.on('did-finish-load', () => settingsWin.webContents.send('init-settings', loadSettings()))
  settingsWin.on('closed', () => { settingsWin = null })
  bringSettingsToFront()
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
    x: wx + ww - 580, y: wy + 50,
    width:560, height:600,
    minWidth:480, minHeight:420,
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:false, resizable:true,
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  listWin.loadFile(path.join(__dirname,'list.html'))
  listWin.webContents.on('did-finish-load', () => { purgeEmptyClosedNotes(); listWin.webContents.send('init-list', loadAllNotes()) })
  listWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    listWin.hide()
    updateTray()
  })
  listWin.on('closed', () => { listWin = null; updateTaskbarAnchor() })
  updateTaskbarAnchor()
}

// ── 记忆面板 ──────────────────────────────────────────────────────────────────
function openMemoryPanel() {
  if (memoryWin && !memoryWin.isDestroyed()) {
    memoryWin.show()
    memoryWin.focus()
    memoryWin.webContents.send('init-memory', productMemory.getRecent(MEMORY_DIR, 50))
    return
  }
  const d = screen.getPrimaryDisplay()
  const { x:wx, y:wy, width:ww } = d.workArea
  memoryWin = new BrowserWindow({
    x: wx + ww - 440, y: wy + 80,
    width:400, height:520,
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:false, resizable:true,
    icon: getAppIconImage(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true },
  })
  memoryWin.loadFile(path.join(__dirname,'memory.html'))
  memoryWin.webContents.on('did-finish-load', () => {
    memoryWin.webContents.send('init-memory', productMemory.getRecent(MEMORY_DIR, 50))
  })
  memoryWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    memoryWin.hide()
  })
  memoryWin.on('closed', () => { memoryWin = null })
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('note-update', (_e, data) => {
  const n = readNote(data.id); if (!n) return
  Object.assign(n, data); saveNote(n); updateTray()
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  try { broadcastSkillPackSuggest() } catch { /* ignore */ }
})
ipcMain.on('note-delete', (_e, id) => {
  const n = readNote(id)
  const title = (n?.project || '').trim()
  const preview = (n?.content?.split('\n')[0]?.trim() || '').substring(0, 40)
  const label = title || preview || '未命名便签'
  const parent = noteWins.get(id) || BrowserWindow.getFocusedWindow() || null
  // Windows 下按钮横向排列：明确区分「仅关闭」与「永久删除」
  const choice = dialog.showMessageBoxSync(parent, {
    type: 'warning',
    title: '删除便签？',
    message: `永久删除「${label}」？`,
    detail:
      '右上角最小化到托盘或 ✕ 关闭都不会删内容。\n' +
      '删除将从本机移除该便签，不可恢复。\n' +
      '建议先在「设置 → 系统配置」导出备份。',
    buttons: ['永久删除', '仅关闭窗口', '取消'],
    defaultId: 2,
    cancelId: 2,
    noLink: false,
  })
  if (choice === 1) {
    const w = noteWins.get(id)
    if (w && !w.isDestroyed()) w.hide()
    resumeAfterNoteHide(id)
    return
  }
  if (choice !== 0) return
  delPending.add(id); deleteNoteF(id)
  if (lastClosedNoteId === id) lastClosedNoteId = null
  const w = noteWins.get(id)
  if (w && !w.isDestroyed()) w.close()
  else { noteWins.delete(id); delPending.delete(id) }
  updateTray()
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
})
ipcMain.on('note-minimize-tray', (_e, id) => { minimizeNoteToTray(id) })
ipcMain.on('note-hide',       (_e, id) => {
  const w = noteWins.get(id)
  const n = readNote(id)
  if (isNoteEmpty(n)) {
    delPending.add(id); deleteNoteF(id)
    if (lastClosedNoteId === id) lastClosedNoteId = null
    if (w && !w.isDestroyed()) w.close()
    else { noteWins.delete(id); delPending.delete(id) }
    updateTray()
    if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
    return
  }
  if (w && !w.isDestroyed()) w.hide()
  resumeAfterNoteHide(id)
})
ipcMain.on('note-pin-toggle', (_e, id) => {
  const w=noteWins.get(id), n=readNote(id); if(!w||!n)return
  n.pinned=!n.pinned; saveNote(n); w.setAlwaysOnTop(n.pinned); w.webContents.send('pin-changed', n.pinned)
})
ipcMain.on('new-note',        newNote)
ipcMain.on('new-version',     (_e, id) => newVersion(id))
ipcMain.on('duplicate-note',  (_e, id) => duplicateNote(id))
ipcMain.on('focus-note', (_e, id) => {
  // 先打开便签并置顶，再收起总览，避免列表 alwaysOnTop 抢走焦点导致「关掉了却看不到便签」
  showNote(id)
  setImmediate(() => {
    if (listWin && !listWin.isDestroyed() && listWin.isVisible()) listWin.hide()
    const win = noteWins.get(id)
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
      win.moveTop()
    }
    updateTaskbarAnchor()
  })
})
ipcMain.on('close-list',      () => { if(listWin&&!listWin.isDestroyed())listWin.hide() })
ipcMain.on('open-memory-panel', () => openMemoryPanel())
ipcMain.handle('memory-recent', (_e, limit) => productMemory.getRecent(MEMORY_DIR, limit || 50))
ipcMain.handle('get-note-versions', (_e, noteId) => {
  const all = loadAllNotes()
  return noteVersions.getNoteVersions(noteId, all, readNote).map(n => ({
    id: n.id, project: n.project, version: n.version,
    updatedAt: n.updatedAt, parentNoteId: n.parentNoteId,
  }))
})
ipcMain.handle('get-note-diff', (_e, idA, idB) => {
  const a = readNote(idA)
  const b = readNote(idB)
  if (!a || !b) return { ok: false, error: '卡片不存在' }
  const hunks = noteDiff.diffLines(a.content || '', b.content || '')
  return { ok: true, hunks, html: noteDiff.diffToHtml(hunks) }
})
ipcMain.handle('promote-to-okf', (_e, noteId) => {
  const n = readNote(noteId)
  if (!n) return { ok: false, error: '卡片不存在' }
  const result = promptOkf.promoteNoteToConcept(KNOWLEDGE_DIR, n)
  if (result.ok) {
    n.okfConceptId = result.conceptId
    saveNote(n)
    productMemory.capture(MEMORY_DIR, {
      kind: 'workflow',
      summary: `收录到知识库：${n.project || '未命名'}`,
      meta: { noteId, action: 'promote-okf', conceptId: result.conceptId },
    })
  }
  return result
})
ipcMain.handle('instantiate-from-okf', async (_e, conceptId) => {
  const result = promptOkf.instantiateConcept(KNOWLEDGE_DIR, conceptId)
  if (!result.ok) return result
  const id = `n_${Date.now()}`
  const pos = getNewNotePos(noteWins.size)
  const note = {
    id, ...result.note, ...pos, w:440, h:580, pinned:true, favorite:false, copyCount:0,
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  }
  saveNote(note)
  const win = createNoteWindow(note)
  win.focus()
  updateTray()
  productMemory.capture(MEMORY_DIR, {
    kind: 'workflow',
    summary: `从知识库实例化：${note.project || '未命名'}`,
    meta: { noteId: id, action: 'instantiate-okf', conceptId },
  })
  return { ok: true, noteId: id }
})
ipcMain.handle('list-okf-concepts', () => productKnowledge.listConcepts(KNOWLEDGE_DIR, 100))
ipcMain.handle('notes-batch-classify', async (_e, opts = {}) => {
  const mode = opts.mode === 'ai' ? 'ai' : 'heuristic'
  const notes = loadAllNotes()
  const targets = notes.filter((n) => noteClassify.needsClassify(n))
  if (!targets.length) {
    return {
      ok: true, updated: 0, skipped: notes.length, failed: 0, mode, samples: [],
      message: '没有需要分类的旧数据',
    }
  }

  if (mode === 'heuristic') {
    const report = noteClassify.batchHeuristic(notes)
    const byId = new Map(notes.map((n) => [n.id, n]))
    for (const id of report.changedIds) {
      const n = byId.get(id)
      if (n) saveNote(n)
    }
    if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
    productMemory.capture(MEMORY_DIR, {
      kind: 'workflow',
      summary: `本地整理旧数据分类：更新 ${report.updated} 张`,
      meta: { action: 'batch-classify', mode, updated: report.updated },
    })
    return {
      ok: true,
      mode,
      updated: report.updated,
      skipped: report.skipped,
      failed: 0,
      samples: report.samples,
      message: `已整理 ${report.updated} 张（跳过 ${report.skipped}）`,
    }
  }

  const s = loadSettings()
  if (!s.apiKey || !s.apiEndpoint) {
    return { ok: false, error: '未配置 API Key，请改用「智能整理（本地）」或先配置 AI', mode }
  }
  let updated = 0
  let skipped = 0
  let failed = 0
  const samples = []
  for (const n of targets) {
    const beforeCat = (n.category || '').trim()
    const beforeTags = JSON.stringify(n.okfTags || [])
    const h = noteClassify.heuristicClassify(n)
    if (noteClassify.needsCategory(n) && h.category) n.category = h.category
    if (noteClassify.needsTags(n) && h.okfTags.length) n.okfTags = h.okfTags

    if ((noteClassify.needsCategory(n) || noteClassify.needsTags(n)) && (n.content || '').trim().length >= 20) {
      try {
        const result = await chatCompletionOnce(s, [
          {
            role: 'system',
            content: '根据提示词内容，建议一个 category（英文小写单词，如 coding/writing/review）和 1-3 个 okfTags（英文小写）。只输出 JSON：{"category":"...","okfTags":["..."]}',
          },
          {
            role: 'user',
            content: `项目名：${n.project || '未命名'}\n路径：${n.promptGroup || ''}\n\n${String(n.content || '').slice(0, 1500)}`,
          },
        ], 120)
        if (result.text) {
          const m = result.text.match(/\{[\s\S]*\}/)
          const parsed = JSON.parse(m ? m[0] : result.text)
          if (noteClassify.needsCategory(n) && parsed.category) {
            n.category = String(parsed.category).slice(0, 32)
          }
          if (noteClassify.needsTags(n) && Array.isArray(parsed.okfTags) && parsed.okfTags.length) {
            n.okfTags = parsed.okfTags.map((t) => String(t).slice(0, 24)).slice(0, 5)
          }
        }
      } catch {
        failed++
      }
    }

    const changed =
      (n.category || '').trim() !== beforeCat || JSON.stringify(n.okfTags || []) !== beforeTags
    if (changed) {
      if (!Array.isArray(n.tags) || !n.tags.length) n.tags = [...(n.okfTags || [])]
      saveNote(n)
      updated++
      if (samples.length < 8) {
        samples.push({ id: n.id, project: n.project || '', category: n.category, okfTags: n.okfTags })
      }
    } else {
      skipped++
    }
  }
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  return {
    ok: true,
    mode,
    updated,
    skipped,
    failed,
    samples,
    message: `AI 整理完成：更新 ${updated}，跳过 ${skipped}，失败 ${failed}`,
  }
})
ipcMain.handle('suggest-classification', async (_e, { content, project }) => {
  const text = (content || '').trim()
  if (text.length < 20) return { ok: false, error: '内容太短，无法建议分类' }
  const s = loadSettings()
  if (!s.apiKey || !s.apiEndpoint) {
    return { ok: false, error: '未配置 API Key，请手动设置分类', local: true }
  }
  const result = await chatCompletionOnce(s, [
    {
      role: 'system',
      content: '根据提示词内容，建议一个 category（英文小写单词，如 coding/writing/review）和 1-3 个 okfTags（英文小写）。只输出 JSON：{"category":"...","okfTags":["..."]}',
    },
    { role: 'user', content: `项目名：${project || '未命名'}\n\n${text.slice(0, 1500)}` },
  ], 120)
  if (result.error || !result.text) {
    return { ok: false, error: result.error || '建议失败', local: true }
  }
  try {
    const m = result.text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : result.text)
    return {
      ok: true,
      category: String(parsed.category || '').slice(0, 32),
      okfTags: Array.isArray(parsed.okfTags) ? parsed.okfTags.map(t => String(t).slice(0, 24)).slice(0, 5) : [],
    }
  } catch {
    return { ok: false, error: '无法解析 AI 返回', local: true }
  }
})
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
    { label: '收录到知识库',   click: async () => {
        const r = await promptOkf.promoteNoteToConcept(KNOWLEDGE_DIR, n)
        if (r.ok) {
          n.okfConceptId = r.conceptId
          saveNote(n)
          productMemory.capture(MEMORY_DIR, {
            kind: 'workflow',
            summary: `收录到知识库：${n.project || '未命名'}`,
            meta: { noteId, action: 'promote-okf', conceptId: r.conceptId },
          })
          dialog.showMessageBoxSync({
            type: 'info', title: '已收录',
            message: `已收录为 OKF Concept：${r.conceptId}`,
          })
        } else {
          dialog.showMessageBoxSync({
            type: 'error', title: '收录失败',
            message: r.error || 'OKF lint 未通过',
          })
        }
      }
    },
    { type: 'separator' },
    { label: '关闭窗口（隐藏）', click: () => {
        const w = noteWins.get(noteId)
        if (w && !w.isDestroyed()) w.hide()
        resumeAfterNoteHide(noteId)
      }
    },
    { label: '删除便签…',       click: () => event.sender.send('cmd-delete') }
  ])
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
})

/** 总览列表右键：打开 / 快捷复制全文 / 收藏 / 多版本展开 / 删除 */
ipcMain.on('show-list-context-menu', (event, payload) => {
  const noteId = payload?.noteId
  const groupKey = payload?.groupKey || null
  const groupSize = Number(payload?.groupSize) || 0
  const n = readNote(noteId)
  if (!n) return
  const win = BrowserWindow.fromWebContents(event.sender)
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
          kind: 'habit',
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
          kind: 'habit',
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
      if (lastClosedNoteId === noteId) lastClosedNoteId = null
      const nw = noteWins.get(noteId)
      if (nw && !nw.isDestroyed()) nw.close()
      else { noteWins.delete(noteId); delPending.delete(noteId) }
      updateTray()
      if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
    },
  })
  Menu.buildFromTemplate(items).popup({ window: win })
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

ipcMain.handle('ai-generate', async (e, { prompt, context, history, noteId, category, skillRefs }) => {
  const webContents = e.sender
  const s = loadSettings()
  if (!s.apiKey)      return { error: '未填写 API Key，请托盘右键 → API 设置' }
  if (!s.apiEndpoint) return { error: '未填写 API Endpoint，请托盘右键 → API 设置' }

  let url
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  try { url = new URL(endpoint) } catch { return { error: `Endpoint 格式错误: ${s.apiEndpoint}` } }

  let theme = String(category || '').trim()
  if (!theme && noteId) {
    const n = readNote(noteId)
    if (n) theme = skillPack.themeKey(n)
  }
  const fromPrompt = productKnowledge.parseSlashTokens(prompt)
  const slashRefs = [
    ...new Set([
      ...(Array.isArray(skillRefs) ? skillRefs.map(productKnowledge.normalizeSlash) : []),
      ...fromPrompt,
    ].filter(Boolean)),
  ]
  const kbSnippet = productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
  const skillCtx = productKnowledge.getSkillContext(KNOWLEDGE_DIR, {
    category: theme,
    slashRefs,
  })
  const memCtx = productMemory.getContextForAI(
    MEMORY_DIR,
    [kbSnippet, skillCtx].filter(Boolean).join('\n\n')
  )
  const systemContent = buildSystemContent({
    userPrompt: s.userPrompt,
    dynamicContext: memCtx,
  })
  const messages = buildChatMessages({
    systemContent,
    history,
    prompt,
    noteContext: context,
  })

  const body = JSON.stringify({
    model: s.model || 'gpt-4o-mini',
    messages,
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
/** 原生目录对话框：挂靠发起窗；alwaysOnTop 窗体需短暂取消置顶，否则系统框会被挡住 */
async function showOpenDialogFor(sender, options) {
  const parent =
    (sender && BrowserWindow.fromWebContents(sender)) ||
    (settingsWin && !settingsWin.isDestroyed() ? settingsWin : null) ||
    BrowserWindow.getFocusedWindow()
  if (!parent || parent.isDestroyed()) {
    return dialog.showOpenDialog(options)
  }
  const wasOnTop = parent.isAlwaysOnTop()
  if (wasOnTop) parent.setAlwaysOnTop(false)
  try {
    return await dialog.showOpenDialog(parent, options)
  } finally {
    if (wasOnTop && !parent.isDestroyed()) {
      parent.setAlwaysOnTop(true)
      parent.focus()
    }
  }
}

ipcMain.handle('notes-export', async (e) => {
  const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
    title: '选择便签备份导出目录',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const dest = path.join(filePaths[0], `sticky-notes-backup-${new Date().toISOString().slice(0, 10)}`)
  const result = notesBackup.exportBundle(DATA_DIR, dest)
  if (result.ok) shell.showItemInFolder(dest)
  return result
})

ipcMain.handle('notes-import', async (e) => {
  const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
    title: '选择便签备份文件夹',
    properties: ['openDirectory'],
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
  const categories = productKnowledge.listCategories(KNOWLEDGE_DIR)
  return {
    path: KNOWLEDGE_DIR,
    concepts: lint.concepts,
    ok: lint.ok,
    errors: lint.errors.length,
    categories,
    items: productKnowledge.listConcepts(KNOWLEDGE_DIR, 100),
  }
})

ipcMain.handle('knowledge-read-concept', (_e, conceptId) => {
  const c = productKnowledge.readConcept(KNOWLEDGE_DIR, conceptId)
  if (!c) return { ok: false, error: '概念不存在' }
  return {
    ok: true,
    title: c.title,
    type: c.type,
    body: c.body,
    rel: c.rel,
    frontmatter: c.frontmatter || {},
  }
})

ipcMain.handle('knowledge-write-concept', (_e, payload = {}) => {
  const id = payload.id || payload.conceptId
  if (!id) return { ok: false, error: '缺少概念 id' }
  const title = payload.title
  const body = payload.body
  if (body == null) return { ok: false, error: '缺少正文' }
  return productKnowledge.writeConcept(KNOWLEDGE_DIR, {
    id,
    title,
    body,
    frontmatter: payload.frontmatter || {},
  })
})

ipcMain.handle('skill-pack-check', () => {
  return {
    ok: true,
    suggestions: skillPack.scanSuggestions(loadAllNotes(), MEMORY_DIR, themeDisplayLabel),
  }
})

ipcMain.handle('list-skills', () => {
  try {
    return { ok: true, skills: productKnowledge.listSkills(KNOWLEDGE_DIR) }
  } catch (e) {
    return { ok: false, error: e.message || String(e), skills: [] }
  }
})

ipcMain.handle('create-skill', (_e, payload = {}) => {
  try {
    return productKnowledge.createSkill(KNOWLEDGE_DIR, payload)
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('skill-pack-dismiss', (_e, theme) => {
  const key = String(theme || '').trim()
  if (!key) return { ok: false, error: '缺少主题' }
  const notes = loadAllNotes().filter((n) => skillPack.isEligibleNote(n, key))
  skillPack.setThemeState(MEMORY_DIR, key, {
    state: 'dismissed',
    eligible_at_dismiss: notes.length,
  })
  return { ok: true }
})

ipcMain.handle('skill-pack-generate', async (_e, { theme } = {}) => {
  const key = String(theme || '').trim()
  if (!key) return { ok: false, error: '缺少主题' }
  const notes = loadAllNotes().filter((n) => skillPack.isEligibleNote(n, key))
  if (!notes.length) return { ok: false, error: '没有可封装的便签' }

  const s = loadSettings()
  const created = []
  const errors = []

  for (const n of notes) {
    let body = skillPack.localSkillBody(n, key)
    if (s.apiKey && s.apiEndpoint) {
      const ai = await chatCompletionOnce(s, [
        {
          role: 'system',
          content:
            '你是知识库编辑。将用户的提示词卡片整理为 OKF 技能文档正文（Markdown）。' +
            '必须包含：用途、适用场景、提示词模板、变量说明、注意事项。' +
            '不要输出 YAML frontmatter，不要用代码围栏包裹全文。语言与原文一致。',
        },
        {
          role: 'user',
          content:
            `主题: ${key}\n标题: ${(n.project || '').trim() || '未命名'}\n` +
            `标签: ${(n.okfTags || n.tags || []).join(', ')}\n\n` +
            `原文:\n${(n.content || '').slice(0, 6000)}`,
        },
      ], 1600)
      if (!ai.error && ai.text) {
        body = skillPack.stripAiFrontmatter(ai.text) || body
      }
    }

    const written = skillPack.writeSkillConcept(KNOWLEDGE_DIR, n, body, key)
    if (!written.ok) {
      errors.push({ noteId: n.id, error: written.error })
      continue
    }
    n.skillPackConceptId = written.conceptId
    n.okfConceptId = written.conceptId
    saveNote(n)
    created.push({ noteId: n.id, conceptId: written.conceptId })
    productMemory.capture(MEMORY_DIR, {
      kind: 'workflow',
      summary: `封装技能包：${(n.project || '').trim() || written.conceptId}`,
      meta: { action: 'skill-pack', theme: key, conceptId: written.conceptId },
    })
  }

  skillPack.setThemeState(MEMORY_DIR, key, {
    state: 'packed',
    packed_count: created.length,
    concept_ids: created.map((c) => c.conceptId),
  })

  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  for (const c of created) {
    const w = noteWins.get(c.noteId)
    if (w && !w.isDestroyed()) {
      const nn = readNote(c.noteId)
      if (nn) w.webContents.send('init-note', nn)
    }
  }

  if (!created.length) {
    return { ok: false, error: errors[0]?.error || '封装失败', errors }
  }
  return {
    ok: true,
    theme: key,
    label: themeDisplayLabel(key),
    created,
    errors,
    message: `已生成 ${created.length} 个技能文档`,
  }
})

ipcMain.handle('knowledge-export', async (e, opts = {}) => {
  const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
    title: '选择导出目标文件夹',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths?.length) return { ok: false, canceled: true }
  const stamp = new Date().toISOString().slice(0, 10)
  const partial = Array.isArray(opts.categories) && opts.categories.length
  const destName = partial
    ? `sticky-notes-knowledge-${opts.categories.join('-')}-${stamp}`
    : `sticky-notes-knowledge-${stamp}`
  const dest = path.join(filePaths[0], destName.slice(0, 80))
  const result = productKnowledge.exportBundle(KNOWLEDGE_DIR, dest, {
    categories: opts.categories,
  })
  if (result.ok) shell.showItemInFolder(dest)
  return result
})

ipcMain.handle('knowledge-import', async (e) => {
  const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
    title: '选择要导入的 OKF 知识包文件夹',
    properties: ['openDirectory'],
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
    app.setName(APP_DISPLAY_NAME)
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    ensureBrandIcons()
    if (process.platform === 'darwin' && app.dock) app.dock.setIcon(getAppIconImage())
    productKnowledge.ensureKnowledge(KNOWLEDGE_DIR, KNOWLEDGE_SEED)
    productMemory.ensureMemory(MEMORY_DIR)
    purgeEmptyClosedNotes()
    tray = new Tray(makeTrayIcon())
    tray.setToolTip(`${APP_DISPLAY_NAME}  左键显示/隐藏 · 右键菜单`)
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
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => globalShortcut.unregisterAll())

process.on('uncaughtException', err => {
  console.error('[fatal]', err?.stack || err)
})
process.on('unhandledRejection', err => {
  console.error('[unhandled]', err?.stack || err)
})
