const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  globalShortcut, nativeImage, shell, clipboard, screen, dialog, safeStorage
} = require('electron')
const path = require('path')
const fs   = require('fs')
const crypto = require('crypto')
const https = require('https')
const http  = require('http')
const { spawn } = require('child_process')

// 知我 KnowMe：独立 userData，不迁移旧版应用数据
app.setName('KnowMe')
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'KnowMe'))
} catch { /* path may already be locked */ }
if (process.platform === 'win32') {
  app.setAppUserModelId('com.aispace.knowme')
  const isRemoteDesktop = /^RDP-Tcp/i.test(String(process.env.SESSIONNAME || ''))
  if (isRemoteDesktop) {
    // RDP + Chromium GPU sandbox is a common source of renderer white screens on Windows.
    app.commandLine.appendSwitch('in-process-gpu')
    app.commandLine.appendSwitch('use-angle', 'swiftshader')
  }
  // Some Windows GPUs intermittently fail composition and show a blank white window.
  // Disable hardware acceleration to keep renderer output stable.
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.disableHardwareAcceleration()
}

const logger = require('./lib/logger')
const productKnowledge = require('./lib/product-knowledge')
const productMemory = require('./lib/product-memory')
const settingsSecure = require('./lib/settings-secure')
const { createRemoteConfigClient } = require('./lib/remote-config-client')
const { mergeOrgPublicConfig, normalizeRemoteConfig } = require('./lib/remote-config-merge')
const promptRouter = require('./lib/assistant-prompt-router')
const {
  buildSystemContent,
  buildChatMessages,
} = require('./lib/ai-assistant-context')
const { normalizeAssistantOutput } = require('./lib/assistant-output-style')
const notesBackup = require('./lib/notes-backup')
const noteId = require('./lib/note-id')
const promptSections = require('./lib/prompt-sections')
const conversationGrounding = require('./lib/conversation-grounding')
const noteDiff = require('./lib/note-diff')
const noteVersions = require('./lib/note-versions')
const noteClassify = require('./lib/note-classify')
const agentSessions = require('./lib/agent-sessions')
const agentRun = require('./lib/agent-run')
const agentStream = require('./lib/agent-stream')
const agentTools = require('./lib/agent-tools')
const agentFileTools = require('./lib/agent-file-tools')
const semanticIndex = require('./lib/semantic-index')
const agentLoop = require('./lib/agent-loop')
const agentRecovery = require('./lib/agent-recovery')
const { buildToolFailureHint } = require('./lib/agent-tool-failure-hint')
const agentSandbox = require('./lib/agent-sandbox')
const agentPlanTools = require('./lib/agent-plan-tools')
const agentWebTools = require('./lib/agent-web-tools')
const agentVerify = require('./lib/agent-verify')
const llmRuntime = require('./lib/llm-runtime')
const llmModelCatalog = require('./lib/llm-model-catalog')
const llmUsage = require('./lib/llm-usage')
const workbenchModel = require('./lib/workbench-model')
const knowledgeOs = require('./lib/knowledge-os')
const obsidianBridge = require('./lib/obsidian-bridge')
const knowledgeProvider = require('./lib/knowledge-provider')
const chatIntent = require('./lib/chat-intent')
const contextCache = require('./lib/context-cache')
const contextOrchestrator = require('./lib/agent-context-orchestrator')
const contextPacketLib = require('./lib/context-packet')
const feishuGrounding = require('./lib/feishu-grounding')
const feishuLink = require('./lib/feishu-link')
const writingWorkflow = require('./lib/writing-workflow')
const gameStudio = require('./lib/game-studio-scenes')
const gameRequirement = require('./lib/game-requirement')
const gameWorkbenchHandoff = require('./lib/game-workbench-handoff')
const connectorsLib = require('./lib/connectors-stub')
const connectorToolRuntime = require('./lib/connectors/tool-runtime')
const feishuCli = require('./lib/connectors/feishu-cli')
const feishuAuth = require('./lib/connectors/feishu-auth')
const workbenchAutomationStore = require('./lib/workbench-automation-store')
const workbenchTodoStore = require('./lib/workbench-todo-store')
function getConnectorsApi() {
  return connectorsLib.bindUserData(() => app.getPath('userData'))
}

const CATALOG_ROOT = path.join(__dirname, 'catalog')
let capabilityHub = null

function ensureCapabilityHub() {
  if (!capabilityHub) {
    capabilityHub = createCapabilityHubService({
      getUserData: () => app.getPath('userData'),
      getKnowledgeDir: () => KNOWLEDGE_DIR,
      getConnectorsApi,
      loadAgentStore,
      bundledRoot: CATALOG_ROOT,
    })
  }
  return capabilityHub
}
const sourcesLib = require('./lib/sources')
const workbenchRepo = require('./lib/workbench-repo')
const workbenchDaemon = require('./lib/workbench-daemon-client')
const workbenchAuth = require('./lib/workbench-auth')
const workbenchBootstrap = require('./lib/workbench-bootstrap')
const workbenchTaskProjection = require('./lib/workbench-task-projection')
const gitlabSource = require('./lib/gitlab-source')
const webSource = require('./lib/web-source')
const { initAutoUpdate, checkForUpdatesManual } = require('./lib/auto-update')
const { createCapabilityHubService } = require('./lib/capability-hub-service')
const { getSessionCapabilityBindings } = require('./lib/agent-context-assembly')

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

// ── 路径 ─────────────────────────────────────────────────────────────────────
const DATA_DIR      = path.join(app.getPath('userData'), 'notes')
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
const KNOWLEDGE_DIR = path.join(app.getPath('userData'), 'knowledge')
const MEMORY_DIR    = path.join(app.getPath('userData'), 'memory')
const KNOWLEDGE_SEED = path.join(__dirname, 'assets', 'knowledge-seed')
const PROMPT_SPACE_DIR = process.env.STICKY_PROMPT_SPACE_DIR || ''
const PROMPT_SPACE_IMPORT_FLAG = path.join(app.getPath('userData'), 'prompt_space_imported.flag')
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-notes.json')
const AGENT_SESSIONS_FILE = path.join(app.getPath('userData'), 'agent-sessions.json')
const WORKBENCH_AUTOMATIONS_FILE = path.join(app.getPath('userData'), 'workbench-automations.json')
const WORKBENCH_TODOS_FILE = path.join(app.getPath('userData'), 'workbench-todos.json')
const SEMANTIC_INDEX_CACHE_DIR = path.join(app.getPath('userData'), 'semantic-index-cache')
const activeAgentRuns = new Map()
const SOURCES_FILE = path.join(app.getPath('userData'), 'sources.json')
const LOGS_DIR = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// 统一日志：主进程唯一落盘点，渲染进程通过 app-log 上报。
try {
  logger.init({
    dir: LOGS_DIR,
    level: process.env.KNOWME_LOG_LEVEL || 'info',
    mirrorConsole: process.argv.includes('--dev') || !app.isPackaged,
  })
  logger.system('app-start', 'KnowMe 主进程启动', { version: app.getVersion(), platform: process.platform })
} catch { /* logging must never crash startup */ }

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// ── 默认设置 ──────────────────────────────────────────────────────────────────
const loadSettings  = () => settingsSecure.load(SETTINGS_FILE)
const saveSettings_ = s  => settingsSecure.save(SETTINGS_FILE, s)

function buildTemporalAnchorContext(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][current.getDay()]
  const pad = n => String(n).padStart(2, '0')
  const localDate = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
  const localTime = `${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return [
    '【当前本地时间锚点】',
    `本地日期: ${localDate} (${weekday})`,
    `本地时间: ${localTime}`,
    `时区: ${tzName}`,
    `ISO时间: ${current.toISOString()}`,
    '规则: 解释“昨天/今天/明天/上周”等相对时间时，必须严格基于以上锚点换算；不允许猜测年份。',
  ].join('\n')
}

function loadAgentStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(AGENT_SESSIONS_FILE, 'utf8'))
    return agentSessions.migrateStore(raw)
  } catch {
    return agentSessions.migrateStore({ sessions: [], ui: {} })
  }
}

/** @deprecated 兼容旧调用：仅返回 sessions 数组 */
function loadAgentSessions() {
  return loadAgentStore().sessions
}

function saveAgentStore(sessions, ui) {
  const normalized = sessions.map((s, i) => agentSessions.normalizeSession(s, i + 1))
  const nextUi = agentSessions.normalizeUi(ui, normalized)
  fs.writeFileSync(
    AGENT_SESSIONS_FILE,
    JSON.stringify({ sessions: normalized, ui: nextUi }, null, 2),
    'utf8'
  )
  return { sessions: normalized, ui: nextUi }
}

function saveAgentSessions(sessions) {
  const { ui } = loadAgentStore()
  saveAgentStore(sessions, ui)
}

function ensureAgentSession(sessionId, agentId = 'general') {
  const { sessions, ui } = loadAgentStore()
  let session = sessions.find(s => s.id === sessionId)
  if (!session) {
    session = agentSessions.createSession(agentId, sessions.filter(s => s.agentId === agentId).length + 1)
    sessions.unshift(session)
    const open = [...(ui.openSessionIds || [])]
    if (!open.includes(session.id)) open.unshift(session.id)
    saveAgentStore(sessions, { ...ui, openSessionIds: open, activeSessionId: session.id })
  }
  return { session, sessions }
}

// ── 应用图标（主图标与托盘图标分离，优先保证小尺寸识别度）─────────────────
const ICON_DIR = path.join(__dirname, 'assets')
const ICON_PNG = path.join(ICON_DIR, 'icon.png')
const TRAY_ICON_PNG = path.join(ICON_DIR, 'tray-icon.png')
const ICON_ICO = path.join(ICON_DIR, 'icon.ico')
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
      appIconImage = nativeImage.createFromPath(ICON_PNG)
    }
    if (!appIconImage || appIconImage.isEmpty()) {
      appIconImage = nativeImage.createFromPath(process.execPath)
    }
  }
  return appIconImage
}

/** BrowserWindow icon：win32 传 .ico 路径让系统按 DPI 选多尺寸表示；其它场景仍用 nativeImage。 */
function getWindowIconOption() {
  if (process.platform === 'win32' && winIcoPath && fs.existsSync(winIcoPath)) {
    return winIcoPath
  }
  return getAppIconImage()
}

function ensureBrandIcons() {
  try {
    if (!fs.existsSync(ICON_PNG)) throw new Error(`Missing brand icon: ${ICON_PNG}`)
    const userData = app.getPath('userData')
    if (process.platform === 'win32') {
      if (!fs.existsSync(ICON_ICO)) throw new Error(`Missing Windows brand icon: ${ICON_ICO}`)
      const ico = path.join(userData, 'app-icon.ico')
      fs.copyFileSync(ICON_ICO, ico)
      winIcoPath = ico
      appIconImage = null
      jumpIconPath = ico
    } else {
      jumpIconPath = ICON_PNG
    }
  } catch {
    jumpIconPath = fs.existsSync(ICON_PNG) ? ICON_PNG : process.execPath
  }
}

const makeTrayIcon = () => {
  const icon = nativeImage.createFromPath(TRAY_ICON_PNG)
  if (!icon.isEmpty()) {
    if (process.platform === 'win32') return icon.resize({ width: 16, height: 16, quality: 'best' })
    return icon.resize({ width: 32, height: 32, quality: 'best' })
  }
  // 托盘图缺失时回退到主图标，避免系统托盘变成空白占位。
  if (process.platform === 'win32') {
    const ico = nativeImage.createFromPath(ICON_ICO)
    if (!ico.isEmpty()) return ico.resize({ width: 16, height: 16, quality: 'best' })
  }
  const appIcon = getAppIconImage()
  if (appIcon && !appIcon.isEmpty()) {
    if (process.platform === 'win32') return appIcon.resize({ width: 16, height: 16, quality: 'best' })
    return appIcon.resize({ width: 32, height: 32, quality: 'best' })
  }
  return nativeImage.createEmpty()
}

// ── 状态 ─────────────────────────────────────────────────────────────────────
const noteWins   = new Map()
const delPending = new Set()
let tray = null, settingsWin = null, listWin = null, memoryWin = null, workspaceWin = null, logViewerWin = null
const taskbarHooked = new WeakSet()
const APP_DISPLAY_NAME = 'KnowMe'
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
  const wins = [workspaceWin, settingsWin, listWin, ...noteWins.values()]
  return wins.some(w => w && !w.isDestroyed() && w.isVisible())
}

function restoreAppWindows() {
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    if (!workspaceWin.isVisible()) workspaceWin.show()
    workspaceWin.focus()
    return
  }
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
    bringSettingsToFront()
    return
  }
  createWorkspaceWindow()
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
  if (workspaceWin && !workspaceWin.isDestroyed()) workspaceWin.hide()
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
  if (launch.action === 'open-list') { createWorkspaceWindow(); return true }
  return false
}

function updateJumpList() {
  if (process.platform !== 'win32') return
  const iconPath = jumpIconPath
  const recentItems = getRecentNotes().slice(0, 8).map(n => ({
    type: 'task',
    title: ((n.title || n.project || '').trim() || '未命名').slice(0, 64),
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
      { type: 'task', title: '新建文件', program: process.execPath, args: jumpListArgs('--new-note'), iconPath, iconIndex: 0 },
      { type: 'task', title: '显示工作台', program: process.execPath, args: jumpListArgs('--open-list'), iconPath, iconIndex: 0 },
    ],
  })
  try { app.setJumpList(categories) } catch {}
}

// ── 持久化 ────────────────────────────────────────────────────────────────────
const notePath     = id => noteId.resolveNoteFile(DATA_DIR, id)
const saveNote     = note => {
  if (!note || !noteId.isSafeNoteId(note.id)) return false
  const file = notePath(note.id)
  if (!file) return false
  note.updatedAt = new Date().toISOString()
  fs.writeFileSync(file, JSON.stringify(note, null, 2), 'utf8')
  return true
}
const readNote     = id => {
  const file = notePath(id)
  if (!file) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}
const deleteNoteF  = id => {
  const file = notePath(id)
  if (!file) return
  try { fs.unlinkSync(file) } catch {}
}

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
    if (!noteId.isSafeNoteFileName(f)) continue
    const id = f.slice(0, -'.json'.length)
    if (noteWins.has(id)) continue
    let n = null
    try { n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')) } catch { continue }
    if (isNoteEmpty(n)) { deleteNoteF(id); removed++ }
  }
  return removed
}

const loadAllNotes = () => {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs.readdirSync(DATA_DIR).filter(f => noteId.isSafeNoteFileName(f)).map(f => {
    try {
      const n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
      let dirty = false
      if (n.project   === undefined) { n.project   = '';    dirty = true }
      if (n.version   === undefined) { n.version   = '0.1'; dirty = true }
      if (n.favorite  === undefined) { n.favorite  = false; dirty = true }
      if (n.tags      === undefined) { n.tags      = [];    dirty = true }
      if (n.copyCount === undefined) { n.copyCount = 0;     dirty = true }
      if (n.projectManual === undefined) { n.projectManual = !!n.project?.trim(); dirty = true }
      // 工作台模型：title=文件名；project=项目分组；旧 category → project（仅当 project 空）
      if (n.title === undefined) {
        n.title = String(n.project || '').trim()
        const cat = String(n.category || '').trim()
        n.project = cat || ''
        dirty = true
      } else if ((n.category || '').trim() && !(n.project || '').trim()) {
        n.project = String(n.category).trim()
        dirty = true
      }
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
    kind: 'telemetry',
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
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示工作台', click: () => { createWorkspaceWindow() } },
    { type: 'separator' },
    { label: '设置…', click: () => openSettings() },
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
    icon: getWindowIconOption(),
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

function notifyWorkspaceRefresh() {
  if (workspaceWin && !workspaceWin.isDestroyed()) workspaceWin.webContents.send('workspace-refresh')
}

function notifyWorkbenchAuthChanged(auth) {
  if (!workspaceWin || workspaceWin.isDestroyed()) return
  workspaceWin.webContents.send('workbench-auth-changed', auth || null)
}

function openWorkspaceNote(noteId) {
  createWorkspaceWindow()
  const send = () => {
    if (workspaceWin && !workspaceWin.isDestroyed() && noteId) {
      workspaceWin.webContents.send('workspace-open-note', noteId)
    }
  }
  if (workspaceWin.webContents.isLoading()) workspaceWin.webContents.once('did-finish-load', send)
  else send()
}

function newNote() {
  const id = `n_${Date.now()}`
  const note = {
    id, content: '', title: '', project: '', version: '0.1', favorite: false, tags: [], copyCount: 0,
    category: '', okfTags: [], okfConceptId: null, parentNoteId: null,
    sections: null, editorMode: 'md', mdView: 'edit',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function newVersion(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const parts = (orig.version || '0.1').split('.').map(Number)
  parts[parts.length - 1] += 1
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id,
    version: parts.join('.'),
    parentNoteId: orig.id,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function duplicateNote(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id, favorite: false, parentNoteId: null, copyCount: 0,
    title: orig.title ? `${orig.title} 副本` : '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function showNote(id) {
  const n = readNote(id)
  if (!n) return
  touchRecentNote(id)
  openWorkspaceNote(id)
  updateJumpList()
  updateTray()
}

// ── 工作台窗口（单窗口文件编辑器）────────────────────────────────────────────
function createWorkspaceWindow() {
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    if (!workspaceWin.isVisible()) workspaceWin.show()
    workspaceWin.focus()
    return workspaceWin
  }
  const d = screen.getPrimaryDisplay()
  const { width: ww, height: wh } = d.workArea
  workspaceWin = new BrowserWindow({
    width: Math.min(1280, ww - 80), height: Math.min(820, wh - 60),
    minWidth: 900, minHeight: 560, center: true,
    frame: true, autoHideMenuBar: true, backgroundColor: '#f8f7f4',
    title: APP_DISPLAY_NAME,
    icon: getWindowIconOption(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      // 编辑器 pane 以 iframe 承载，需让 preload 在子框架内也注入，否则 iframe 里 window.api 为 undefined
      nodeIntegrationInSubFrames: true,
      // 右侧文档预览使用内嵌 webview 打开外链
      webviewTag: true,
    },
  })
  workspaceWin.loadFile(path.join(__dirname, 'workspace.html'))
  workspaceWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    const target = String(url || 'workspace.html')
    console.error('[workspace-load-fail]', { code, desc, url: target })
    const html = [
      '<!doctype html><meta charset="utf-8">',
      '<title>KnowMe 启动失败</title>',
      '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f6f5f2;color:#1f2937;padding:24px}h1{font-size:20px;margin:0 0 10px}pre{white-space:pre-wrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px}</style>',
      '<h1>页面加载失败</h1>',
      '<p>请重启应用；若仍失败，把下方信息发给开发同学。</p>',
      `<pre>code: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${target}</pre>`,
    ].join('')
    void workspaceWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
  workspaceWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const text = String(message || '')
    if (level >= 2 || text.includes('[kb-debug]') || text.includes('[settings-debug]') || text.includes('[center-surface]')) {
      console.log(`[workspace-console:${level}] ${text} (${sourceId || 'workspace'}:${line || 0})`)
    }
  })
  workspaceWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('[workspace-render-gone]', details)
    if (details?.reason === 'clean-exit') return
    setTimeout(() => {
      try {
        if (!workspaceWin || workspaceWin.isDestroyed()) return
        workspaceWin.webContents.reloadIgnoringCache()
      } catch (err) {
        console.error('[workspace-render-reload-fail]', err?.message || err)
      }
    }, 280)
  })
  workspaceWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    workspaceWin.hide()
    updateTray()
  })
  workspaceWin.on('closed', () => { workspaceWin = null })
  return workspaceWin
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

function openSettings(tab = '') {
  // 托盘 MenuItem.click 会传入 (menuItem, browserWindow, event)，不能当 tab 用
  const tabId = typeof tab === 'string' ? tab : ''
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    workspaceWin.show()
    workspaceWin.focus()
    workspaceWin.webContents.send('workspace-open-settings', tabId)
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close()
    return
  }
  openSettingsWindow(tabId)
}

function openSettingsWindow(tab = '') {
  const tabId = typeof tab === 'string' ? tab : ''
  if (settingsWin && !settingsWin.isDestroyed()) {
    bringSettingsToFront()
    if (tabId) settingsWin.webContents.send('select-settings-tab', tabId)
    return
  }
  settingsWin = new BrowserWindow({ width:520, height:720, minWidth:480, minHeight:560,
    title:'KnowMe — 设置', center:true, resizable:true,
    frame:true, autoHideMenuBar:true, backgroundColor:'#f8f7f4',
    alwaysOnTop:true,
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  settingsWin.loadFile(path.join(__dirname,'settings.html'))
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin.webContents.send('init-settings', JSON.parse(JSON.stringify(settingsSecure.publicSettings(loadSettings()))))
    if (tabId) settingsWin.webContents.send('select-settings-tab', tabId)
  })
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
    icon: getWindowIconOption(),
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
    icon: getWindowIconOption(),
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

// ── 日志查看窗口 ──────────────────────────────────────────────────────────────
function openLogViewer() {
  if (logViewerWin && !logViewerWin.isDestroyed()) {
    if (logViewerWin.isMinimized()) logViewerWin.restore()
    logViewerWin.show()
    logViewerWin.focus()
    return logViewerWin
  }
  const d = screen.getPrimaryDisplay()
  const { width: ww, height: wh } = d.workArea
  logViewerWin = new BrowserWindow({
    width: Math.min(1080, ww - 80), height: Math.min(760, wh - 80),
    minWidth: 760, minHeight: 480, center: true,
    frame: true, autoHideMenuBar: true, backgroundColor: '#0f1419',
    title: 'KnowMe - 日志中心',
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })
  logViewerWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    const message = `日志页面加载失败\ncode: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${String(url || 'log-viewer.html')}`
    console.error('[log-viewer-load-fail]', message)
    const html = [
      '<!doctype html><meta charset="utf-8">',
      '<title>KnowMe 日志中心</title>',
      '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0e1420;color:#e7edf7;padding:28px}h1{font-size:20px}pre{white-space:pre-wrap;background:#161f2e;border:1px solid #2b3951;border-radius:8px;padding:14px;color:#f4b549}</style>',
      '<h1>日志中心加载失败</h1>',
      '<p>日志文件仍然保存在 KnowMe\\logs 目录。</p>',
      `<pre>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    ].join('')
    void logViewerWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
  logViewerWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[log-viewer-console:${level}] ${String(message || '')} (${sourceId || 'log-viewer'}:${line || 0})`)
    }
  })
  logViewerWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('[log-viewer-render-gone]', details)
  })
  logViewerWin.loadFile(path.join(__dirname, 'log-viewer.html'))
  logViewerWin.on('closed', () => { logViewerWin = null })
  logger.operation('open-log-viewer', '打开日志中心窗口')
  return logViewerWin
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('note-update', (_e, data) => {
  if (!data || !noteId.isSafeNoteId(data.id)) return
  const n = readNote(data.id); if (!n) return
  const patch = { ...data }
  delete patch.id
  Object.assign(n, patch)
  saveNote(n)
  updateTray()
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  notifyWorkspaceRefresh()
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
ipcMain.on('new-note',        newNote)
ipcMain.on('new-version',     (_e, id) => newVersion(id))
ipcMain.on('duplicate-note',  (_e, id) => duplicateNote(id))
ipcMain.handle('get-note-versions', (_e, noteId) => {
  const all = loadAllNotes()
  return noteVersions.getNoteVersions(noteId, all, readNote).map(n => ({
    id: n.id, title: n.title || '', project: n.project, version: n.version,
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
// ── 工作台 IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('get-note', (_e, id) => readNote(id))

function workspaceNoteBrief(n) {
  return {
    id: n.id,
    title: n.title || '',
    project: n.project || '',
    category: n.category || '',
    version: n.version,
    favorite: !!n.favorite,
    parentNoteId: n.parentNoteId || null,
    okfTags: n.okfTags || [],
    updatedAt: n.updatedAt,
    preview: (n.content || '').split('\n').find(l => l.trim())?.slice(0, 80) || '',
  }
}

function groupNotesByProject(notes) {
  const groups = new Map()
  for (const n of notes) {
    const key = (n.project || '').trim() || '__uncat__'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key === '__uncat__' ? '未分类' : key,
        items: [],
      })
    }
    groups.get(key).items.push(workspaceNoteBrief(n))
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === '__uncat__') return 1
    if (b.key === '__uncat__') return -1
    return String(a.label).localeCompare(String(b.label), 'zh-CN')
  })
}

ipcMain.handle('workspace-init', () => {
  const notes = loadAllNotes()
  const srcStore = sourcesLib.loadStore(SOURCES_FILE)
  const active = srcStore.sources.find(s => s.id === srcStore.activeSourceId) || null
  let fileTree = null
  if (active) {
    fileTree = sourcesLib.listTree(active.rootPath, { maxDepth: 0 })
  }
  return {
    notes: notes.map(workspaceNoteBrief),
    groups: groupNotesByProject(notes),
    state: loadSettings().workspaceState || null,
    sources: srcStore.sources,
    activeSourceId: srcStore.activeSourceId,
    fileTree,
  }
})

function loadSourcesStore() {
  return sourcesLib.loadStore(SOURCES_FILE)
}

function saveSourcesStore(store) {
  return sourcesLib.saveStore(SOURCES_FILE, store)
}

function findSource(id) {
  return loadSourcesStore().sources.find(s => s.id === id) || null
}

// 语义索引缓存：cacheKey(root+embed profile) -> { stamp, index }，按目录 mtime 失效，进程内有界。
const semanticIndexCache = new Map()
const SEMANTIC_INDEX_MAX_ROOTS = 8
const SEMANTIC_INDEX_DISK_MAX_FILES = 32

function hashKey(text = '') {
  return crypto.createHash('sha1').update(String(text)).digest('hex')
}

function semanticDiskCacheFile(cacheKey) {
  const name = `${hashKey(cacheKey)}.json`
  return path.join(SEMANTIC_INDEX_CACHE_DIR, name)
}

function loadSemanticIndexFromDisk(cacheKey, stamp) {
  try {
    const file = semanticDiskCacheFile(cacheKey)
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!raw || raw.stamp !== stamp || !raw.index) return null
    return raw.index
  } catch {
    return null
  }
}

function saveSemanticIndexToDisk(cacheKey, stamp, index) {
  try {
    fs.mkdirSync(SEMANTIC_INDEX_CACHE_DIR, { recursive: true })
    const file = semanticDiskCacheFile(cacheKey)
    fs.writeFileSync(file, JSON.stringify({
      stamp,
      index,
      savedAt: new Date().toISOString(),
    }), 'utf8')
    const files = fs.readdirSync(SEMANTIC_INDEX_CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        name: f,
        full: path.join(SEMANTIC_INDEX_CACHE_DIR, f),
        mtime: (() => {
          try { return fs.statSync(path.join(SEMANTIC_INDEX_CACHE_DIR, f)).mtimeMs } catch { return 0 }
        })(),
      }))
      .sort((a, b) => b.mtime - a.mtime)
    for (const stale of files.slice(SEMANTIC_INDEX_DISK_MAX_FILES)) {
      try { fs.unlinkSync(stale.full) } catch { /* ignore */ }
    }
  } catch {
    // 磁盘缓存失败不影响主流程
  }
}

/**
 * 基于当前活跃内容源构建 Agent 文件工具（read_file / list_dir / grep_files）。
 * 提供 embed 时额外投影 semantic_search（向量语义检索）。
 * 无活跃源时返回 null（不投影文件工具）。全部经 sources.js 路径安全校验。
 */
function decodeWorkspaceFsTabId(id) {
  const raw = String(id || '')
  if (!raw.startsWith('fs:')) return null
  const rest = raw.slice(3)
  const sep = rest.indexOf(':')
  if (sep <= 0) return null
  return { sourceId: rest.slice(0, sep), relPath: rest.slice(sep + 1) }
}

/**
 * 从 workspaceState 提取“活跃/最近打开”的内容源文件权重：
 * - active fs tab 权重更高
 * - 其他 fs tabs 按新近顺序衰减
 */
function buildRecentSourceFileWeights(workspaceState = {}, activeSourceId = '') {
  const map = new Map()
  const st = workspaceState && typeof workspaceState === 'object' ? workspaceState : {}
  const panes = [st.left, st.right].filter(Boolean)
  const activeIds = panes.map((p) => p.active).filter(Boolean)
  for (const id of activeIds) {
    const decoded = decodeWorkspaceFsTabId(id)
    if (!decoded) continue
    if (activeSourceId && decoded.sourceId !== activeSourceId) continue
    map.set(decoded.relPath, Math.max(map.get(decoded.relPath) || 1, 1.35))
  }
  for (const pane of panes) {
    const tabs = Array.isArray(pane.tabs) ? pane.tabs : []
    const fsTabs = tabs.map(decodeWorkspaceFsTabId).filter(Boolean)
      .filter((x) => !activeSourceId || x.sourceId === activeSourceId)
    const maxN = Math.max(1, fsTabs.length)
    fsTabs.forEach((tab, i) => {
      const recency = 1.2 - (i / maxN) * 0.25
      map.set(tab.relPath, Math.max(map.get(tab.relPath) || 1, recency))
    })
  }
  return map
}

/** 合并多组 { definitions, handlers } 额外工具，name 冲突时先注册者优先。 */
function mergeExtraTools(...groups) {
  const definitions = []
  const handlers = {}
  const seen = new Set()
  for (const group of groups) {
    if (!group || !Array.isArray(group.definitions)) continue
    for (const def of group.definitions) {
      const name = def?.function?.name
      if (!name || seen.has(name)) continue
      seen.add(name)
      definitions.push(def)
      const handler = group.handlers?.[name]
      if (typeof handler === 'function') handlers[name] = handler
    }
  }
  return definitions.length ? { definitions, handlers } : null
}

function buildActiveSourceFileTools(embed, opts = {}) {
  const store = loadSourcesStore()
  const active = store.sources.find(s => s.id === store.activeSourceId)
    || store.sources[0]
    || null
  if (!active?.rootPath) return null
  const root = active.rootPath
  const recentWeights = buildRecentSourceFileWeights(opts.workspaceState, active.id)
  // grep 索引缓存：文件清单按根目录 mtime 缓存（短 TTL），内容走 mtime 校验的读缓存，
  // 避免每次 grep 重新遍历目录树 + 全量重读文件。
  const rootStamp = () => contextCache.statMtimeMs(root)
  const listFiles = () => contextCache.cached(
    `grepindex:${root}`,
    rootStamp(),
    () => (sourcesLib.listTree(root, {}).nodes || [])
      .filter((n) => n.type === 'file')
      .map((n) => ({ ...n, weight: recentWeights.get(n.path) || 1 })),
  )
  const readCached = (rel) => {
    const abs = sourcesLib.resolveUnderRoot(root, rel)
    return abs ? contextCache.readFileCached(abs) : null
  }
  const adapter = {
    readFile: (rel) => sourcesLib.readFileUnder(root, rel),
    listDir: (rel) => sourcesLib.listChildren(root, rel || ''),
    grep: (query) => agentFileTools.grepFiles(query, {
      files: listFiles(),
      readFile: readCached,
      maxMatches: agentFileTools.MAX_GREP_MATCHES,
    }),
  }
  const base = agentFileTools.buildFileTools(adapter)

  // 语义检索工具：仅在提供 embed（用户启用向量重排/embeddings）时投影。
  if (typeof embed === 'function') {
    const cacheKey = `semantic:${root}:${String(embed.cacheKey || 'default')}`
    const getIndex = async () => {
      const stamp = rootStamp()
      const cached = semanticIndexCache.get(cacheKey)
      if (cached && cached.stamp === stamp) {
        if (opts.runMetrics) opts.runMetrics.semanticIndexMemoryHit = (opts.runMetrics.semanticIndexMemoryHit || 0) + 1
        return cached.index
      }
      const disk = loadSemanticIndexFromDisk(cacheKey, stamp)
      if (disk) {
        semanticIndexCache.set(cacheKey, { stamp, index: disk })
        if (opts.runMetrics) opts.runMetrics.semanticIndexDiskHit = (opts.runMetrics.semanticIndexDiskHit || 0) + 1
        return disk
      }
      const buildStartedAt = Date.now()
      const index = await semanticIndex.buildEmbeddedIndex({
        files: listFiles(),
        readFile: readCached,
        embed,
        maxChunks: semanticIndex.DEFAULT_MAX_CHUNKS,
      })
      if (opts.runMetrics) {
        opts.runMetrics.semanticIndexBuildMs = Date.now() - buildStartedAt
        opts.runMetrics.semanticIndexChunkCount = Array.isArray(index?.chunks) ? index.chunks.length : 0
      }
      semanticIndexCache.set(cacheKey, { stamp, index })
      saveSemanticIndexToDisk(cacheKey, stamp, index)
      while (semanticIndexCache.size > SEMANTIC_INDEX_MAX_ROOTS) {
        semanticIndexCache.delete(semanticIndexCache.keys().next().value)
      }
      return index
    }
    base.definitions = base.definitions.concat(semanticIndex.SEMANTIC_SEARCH_DEF)
    base.handlers.semantic_search = async (args = {}) => {
      const q = String(args.query || '').trim()
      if (!q) return { ok: false, code: 'invalid_args', text: 'semantic_search 需要非空 query' }
      try {
        const queryStartedAt = Date.now()
        const index = await getIndex()
        const detailed = await semanticIndex.queryDetailed(index, embed, q, {
          topK: semanticIndex.DEFAULT_TOPK,
          maxPerFile: semanticIndex.DEFAULT_MAX_PER_FILE,
        })
        const hits = detailed.hits || []
        const meta = {
          ...(detailed.meta || {}),
          queryMs: Date.now() - queryStartedAt,
          hitCount: hits.length,
        }
        if (opts.runMetrics) {
          opts.runMetrics.semanticQueryMs = meta.queryMs
          opts.runMetrics.semanticHitCount = meta.hitCount
          opts.runMetrics.semanticDedupeDropped = Number(meta.droppedDedup || 0)
          opts.runMetrics.semanticClusterCount = Number(meta.clusterCount || 0)
        }
        return { ok: true, text: semanticIndex.formatSemanticMatches(q, hits), meta }
      } catch (err) {
        return { ok: false, code: 'semantic_failed', text: `语义检索失败：${String(err?.message || err).slice(0, 200)}` }
      }
    }
  }
  return base
}

ipcMain.handle('sources-list', () => {
  const store = loadSourcesStore()
  return { ok: true, ...store, gitAvailable: gitlabSource.gitAvailable() }
})

ipcMain.handle('sources-set-active', (_e, id) => {
  const cur = loadSourcesStore()
  const r = sourcesLib.setActive(cur, id)
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, ...saved }
})

ipcMain.handle('sources-add-local', async (e) => {
  const parent = BrowserWindow.fromWebContents(e.sender)
  const opts = {
    title: '选择本地内容文件夹',
    properties: ['openDirectory'],
  }
  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, opts)
    : await dialog.showOpenDialog(opts)
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true }
  const cur = loadSourcesStore()
  const r = sourcesLib.addLocal(cur, filePaths[0])
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, source: r.source, ...saved }
})

ipcMain.handle('sources-add-gitlab', async (_e, payload = {}) => {
  const s = loadSettings()
  const host = gitlabSource.normalizeHost(payload.host || s.gitlabHost)
  const token = String(payload.token != null ? payload.token : s.gitlabToken || '').trim()
  const projectPath = String(payload.projectPath || '').trim()
  const branch = String(payload.branch || 'main').trim() || 'main'
  if (!host || !projectPath) return { ok: false, error: '请填写 GitLab 地址与项目路径' }
  if (payload.token != null || payload.host) {
    saveSettings_({ ...s, gitlabHost: host, gitlabToken: payload.token != null ? token : s.gitlabToken })
  }
  const cloned = gitlabSource.cloneProject({
    userData: app.getPath('userData'),
    host,
    projectPath,
    branch,
    token: token || loadSettings().gitlabToken,
  })
  if (!cloned.ok) return cloned
  const cur = loadSourcesStore()
  const r = sourcesLib.addGitlab(cur, {
    rootPath: cloned.rootPath,
    displayName: projectPath,
    remoteUrl: cloned.remoteUrl,
    projectPath,
    branch,
    host,
    lastSyncAt: new Date().toISOString(),
  })
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, source: r.source, reused: !!cloned.reused, ...saved }
})

ipcMain.handle('sources-add-github', async (_e, payload = {}) => {
  const s = loadSettings()
  const remoteUrl = String(payload.remoteUrl || '').trim().replace(/\.git$/i, '')
  const branch = String(payload.branch || 'main').trim() || 'main'
  const token = String(payload.token != null ? payload.token : s.githubToken || '').trim()
  if (!/^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(remoteUrl)) {
    return { ok: false, error: '请填写 GitHub 仓库地址，例如 https://github.com/org/repo' }
  }
  if (payload.token != null) saveSettings_({ ...s, githubToken: token })
  const ownerRepo = remoteUrl
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
  const cloned = gitlabSource.cloneRemoteRepo({
    userData: app.getPath('userData'),
    remoteUrl: `${remoteUrl}.git`,
    branch,
    token: token || loadSettings().githubToken,
    provider: 'github',
  })
  if (!cloned.ok) return cloned
  const cur = loadSourcesStore()
  const r = sourcesLib.addGithub(cur, {
    rootPath: cloned.rootPath,
    displayName: ownerRepo,
    remoteUrl: cloned.remoteUrl,
    ownerRepo,
    branch,
    host: 'https://github.com',
    lastSyncAt: new Date().toISOString(),
  })
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, source: r.source, reused: !!cloned.reused, ...saved }
})

ipcMain.handle('sources-add-web', async (_e, payload = {}) => {
  const pageUrl = String(payload.pageUrl || '').trim()
  if (!pageUrl) return { ok: false, error: '请填写网页地址' }
  let snapshot
  try {
    snapshot = await webSource.fetchPageSnapshot({ userData: app.getPath('userData'), pageUrl })
  } catch (err) {
    return { ok: false, error: String(err?.message || err || '网页抓取失败') }
  }
  if (!snapshot?.ok) return snapshot
  const cur = loadSourcesStore()
  const r = sourcesLib.addWeb(cur, {
    rootPath: snapshot.rootPath,
    pageUrl: snapshot.pageUrl,
    title: snapshot.title,
    lastSyncAt: new Date().toISOString(),
  })
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, source: r.source, ...saved }
})

ipcMain.handle('sources-remove', (_e, id) => {
  const cur = loadSourcesStore()
  const r = sourcesLib.removeSource(cur, id)
  if (!r.ok) return r
  const saved = saveSourcesStore(r.store)
  notifyWorkspaceRefresh()
  return { ok: true, ...saved }
})

ipcMain.handle('sources-sync', async (_e, id) => {
  const src = findSource(id)
  if (!src) return { ok: false, error: '源不存在' }
  const settings = loadSettings()
  let syncResult = { ok: true }
  if (src.type === 'gitlab') {
    syncResult = gitlabSource.pullRepo(src.rootPath, settings.gitlabToken || '')
  } else if (src.type === 'github') {
    syncResult = gitlabSource.pullRemoteRepo(src.rootPath, {
      token: settings.githubToken || '',
      provider: 'github',
    })
  } else if (src.type === 'web') {
    try {
      syncResult = await webSource.fetchPageSnapshot({
        userData: app.getPath('userData'),
        pageUrl: src.pageUrl || src.remoteUrl,
      })
    } catch (err) {
      syncResult = { ok: false, error: String(err?.message || err || '网页刷新失败') }
    }
  } else {
    return { ok: false, error: '当前内容源不支持同步' }
  }
  if (!syncResult.ok) return syncResult
  const cur = loadSourcesStore()
  const sources = cur.sources.map(s => (
    s.id === id
      ? {
          ...s,
          rootPath: src.type === 'web' ? (syncResult.rootPath || s.rootPath) : s.rootPath,
          remoteUrl: src.type === 'web' ? (syncResult.pageUrl || s.remoteUrl) : s.remoteUrl,
          pageUrl: src.type === 'web' ? (syncResult.pageUrl || s.pageUrl) : s.pageUrl,
          displayName: src.type === 'web' ? (syncResult.title || s.displayName) : s.displayName,
          lastSyncAt: new Date().toISOString(),
        }
      : s
  ))
  const saved = saveSourcesStore({ ...cur, sources })
  notifyWorkspaceRefresh()
  return { ok: true, ...saved }
})

ipcMain.handle('sources-tree', (_e, sourceId) => {
  const src = findSource(sourceId || loadSourcesStore().activeSourceId)
  if (!src) return { ok: false, error: '未选择内容源', nodes: [] }
  return sourcesLib.listTree(src.rootPath, { maxDepth: 0 })
})

ipcMain.handle('sources-tree-children', (_e, payload = {}) => {
  const src = findSource(payload.sourceId || loadSourcesStore().activeSourceId)
  if (!src) return { ok: false, error: '未选择内容源', nodes: [] }
  return sourcesLib.listChildren(src.rootPath, payload.path || '')
})

ipcMain.handle('sources-read-file', (_e, payload = {}) => {
  const src = findSource(payload.sourceId)
  if (!src) return { ok: false, error: '源不存在' }
  return sourcesLib.readFileUnder(src.rootPath, payload.path)
})

ipcMain.handle('sources-write-file', (_e, payload = {}) => {
  const src = findSource(payload.sourceId)
  if (!src) return { ok: false, error: '源不存在' }
  const r = sourcesLib.writeFileUnder(src.rootPath, payload.path, payload.content)
  if (r.ok) notifyWorkspaceRefresh()
  return r
})

ipcMain.handle('sources-open-root', (_e, id) => {
  const src = findSource(id)
  if (!src) return { ok: false, error: '源不存在' }
  if (src.type === 'web' && /^https?:\/\//i.test(src.pageUrl || src.remoteUrl || '')) {
    shell.openExternal(src.pageUrl || src.remoteUrl)
    return { ok: true }
  }
  shell.openPath(src.rootPath)
  return { ok: true }
})

ipcMain.handle('workspace-new-note', (_e, payload = {}) => {
  const id = `n_${Date.now()}`
  const project = String(payload.project || payload.category || '').trim()
  const note = {
    id, content: '', title: '', project, version: '0.1', favorite: false, tags: [], copyCount: 0,
    category: project, okfTags: [], okfConceptId: null, parentNoteId: null,
    sections: null, editorMode: 'md', mdView: 'edit',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  return { ok: true, note }
})

ipcMain.handle('workspace-new-version', (_e, noteId) => {
  const orig = readNote(noteId)
  if (!orig) return { ok: false, error: '原始笔记不存在' }
  const parts = (orig.version || '0.1').split('.').map(Number)
  parts[parts.length - 1] += 1
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id, version: parts.join('.'), parentNoteId: orig.id,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  return { ok: true, note }
})

ipcMain.handle('workspace-delete-note', (_e, noteId) => {
  const n = readNote(noteId)
  if (!n) return { ok: false, error: '文件不存在' }
  deleteNoteF(noteId)
  if (lastClosedNoteId === noteId) lastClosedNoteId = null
  notifyWorkspaceRefresh()
  return { ok: true }
})

ipcMain.handle('workspace-duplicate-note', (_e, noteId) => {
  const orig = readNote(noteId)
  if (!orig) return { ok: false, error: '文件不存在' }
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id, favorite: false, parentNoteId: null, copyCount: 0,
    title: orig.title ? `${orig.title} 副本` : (orig.project ? `${orig.project} 副本` : '未命名 副本'),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  return { ok: true, note }
})

ipcMain.handle('build-final-prompt', (_e, payload = {}) => {
  const s = loadSettings()
  const promptMode = promptRouter.normalizeMode(payload.role || payload.agentId || 'general')
  const content = payload.content != null ? String(payload.content) : (readNote(payload.noteId)?.content || '')
  const theme = String(payload.category || '').trim()
  const slashRefs = productKnowledge.parseSlashTokens(content)
  const previewPrompt = String(payload.prompt || '')
  const previewTier = chatIntent.classifyIntent({
    prompt: previewPrompt,
    hasNoteContext: !!content.trim(),
    slashRefs,
    role: promptMode,
  })
  const scene = promptRouter.resolveScene({
    mode: promptMode,
    tier: previewTier,
    role: promptMode,
    hasNoteContext: !!content.trim(),
    industry: s.industry,
    prompt: previewPrompt,
  })
  const kbSnippet = productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
  const skillCtx = productKnowledge.getSkillContext(KNOWLEDGE_DIR, { category: theme, slashRefs })
  const dynamic = [kbSnippet, skillCtx].filter(Boolean).join('\n\n')
  const systemContent = buildSystemContent({
    scenePrompt: promptRouter.buildScenePrompt({ scene, mode: promptMode }),
    userPrompt: promptRouter.buildUserPrompt(s, promptMode),
    skillPrompt: promptRouter.buildSkillPrompt(slashRefs),
    dynamicContext: dynamic,
  })
  const messages = buildChatMessages({
    systemContent, history: [],
    prompt: payload.prompt || '（此处为你稍后要发给助手的对话需求）',
    noteContext: content,
  })
  return { ok: true, systemContent, messages, skillRefs: slashRefs }
})

ipcMain.handle('get-workspace-state', () => loadSettings().workspaceState || null)
ipcMain.on('save-workspace-state', (_e, state) => {
  try { const s = loadSettings(); s.workspaceState = state; saveSettings_(s) } catch { /* ignore */ }
})

// Agent Session：会话由主进程持久化；UI 维护打开的 Tab 集合。
ipcMain.handle('agent-session-list', () => {
  let { sessions, ui } = loadAgentStore()
  sessions = sessions.filter(s => s.ephemeral !== true)
  if (!sessions.length) {
    const session = agentSessions.createSession('general', 1)
    sessions = [session]
    ui = { openSessionIds: [session.id], activeSessionId: session.id }
    saveAgentStore(sessions, ui)
  } else if (!ui.openSessionIds?.length) {
    const migrated = agentSessions.normalizeUi(ui, sessions)
    ui = migrated
    saveAgentStore(sessions, ui)
  }
  const hub = ensureCapabilityHub()
  return {
    agents: agentSessions.AGENTS,
    sessions: sessions.map(s => {
      const dto = hub.sessionDto(s)
      return {
        ...dto,
        messages: undefined,
        displayTitle: agentSessions.sessionDisplayTitle(dto),
        messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
        resume: agentSessions.buildResumeProjection(dto),
      }
    }),
    ui,
  }
})

ipcMain.handle('agent-session-get', (_e, sessionId) => {
  const { sessions } = loadAgentStore()
  const session = sessions.find(s => s.id === sessionId)
  return session ? { ok: true, session } : { ok: false, error: 'Session 不存在' }
})

ipcMain.handle('agent-session-new', (_e, agentIdOrOpts = 'general') => {
  const { sessions, ui } = loadAgentStore()
  const opts = typeof agentIdOrOpts === 'object' && agentIdOrOpts
    ? agentIdOrOpts
    : { agentId: agentIdOrOpts }
  const agentId = opts.agentId || 'general'
  const expertId = String(opts.expertId || '').trim()
  const session = agentSessions.createSession(agentId, sessions.length + 1, {
    goal: opts.goal || '',
    role: opts.role || (agentId === 'steward' ? 'steward' : undefined),
    expertId,
    ephemeral: opts.ephemeral === true,
  })
  if (expertId) {
    const hub = ensureCapabilityHub()
    const snap = hub.expertRuntime().createSessionSnapshot(session.id, expertId)
    if (snap.ok) {
      session.expertId = expertId
      session.snapshotPath = snap.path
      session.capabilitySnapshotId = `${session.id}:${expertId}`
    }
  }
  sessions.unshift(session)
  const openSessionIds = [session.id, ...(ui.openSessionIds || []).filter(id => id !== session.id)]
    .slice(0, agentSessions.MAX_OPEN_TABS)
  const next = saveAgentStore(sessions, { openSessionIds, activeSessionId: session.id })
  if (String(opts.goal || '').trim()) {
    productMemory.capture(MEMORY_DIR, {
      kind: 'workflow_choice',
      summary: `选择工作入口：${String(opts.goal).trim().slice(0, 120)}`,
      meta: { agentId, source: 'agent-session-new' },
    })
  }
  return { ok: true, session, ui: next.ui }
})

ipcMain.handle('agent-run-update', (_e, payload = {}) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === payload.sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  const next = agentRun.ensureRun(session, {
    goal: payload.goal != null ? payload.goal : session.run?.goal,
    role: payload.role != null ? payload.role : session.run?.role,
    status: payload.status != null ? payload.status : session.run?.status,
  })
  if (Array.isArray(payload.toolsUsed)) {
    next.run = agentRun.normalizeRun({
      ...next.run,
      toolsUsed: [...new Set([...(next.run.toolsUsed || []), ...payload.toolsUsed.map(String)])],
    })
  }
  if (payload.permissions && typeof payload.permissions === 'object') {
    const prev = session.run?.permissions || {}
    next.run = {
      ...next.run,
      permissions: agentSandbox.normalizeSandboxPermissions({
        ...prev,
        ...payload.permissions,
      }),
    }
  }
  const idx = sessions.findIndex(s => s.id === session.id)
  sessions[idx] = next
  saveAgentStore(sessions, ui)
  return { ok: true, session: next }
})

ipcMain.handle('agent-artifact-add', (_e, payload = {}) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === payload.sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  const next = agentRun.addArtifact(session, payload.artifact)
  const idx = sessions.findIndex(s => s.id === session.id)
  sessions[idx] = next
  saveAgentStore(sessions, ui)
  return { ok: true, session: next, artifact: next.run.artifacts.slice(-1)[0] }
})

ipcMain.handle('agent-artifact-accept', (_e, payload = {}) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === payload.sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  const art = (session.run?.artifacts || []).find(a => a.id === payload.artifactId)
  if (!art) return { ok: false, error: '产物不存在' }
  if (art.type === 'health_report' || art.type === 'editor_patch') {
    let next = agentRun.setArtifactStatus(session, art.id, 'accepted')
    if (art.type === 'editor_patch') {
      const mode = art.meta?.mode || 'replace'
      next = agentRun.recordApply(next, {
        action: mode === 'append' || mode === 'insert' ? mode : 'replace',
        detail: art.title || '已应用到编辑器',
        noteId: art.meta?.noteId,
      })
    }
    const idx = sessions.findIndex(s => s.id === session.id)
    sessions[idx] = next
    saveAgentStore(sessions, ui)
    return {
      ok: true,
      session: next,
      editorPatch: art.type === 'editor_patch',
      applyMode: art.meta?.mode || 'replace',
      body: art.type === 'editor_patch' ? art.body : undefined,
    }
  }
  const written = knowledgeOs.acceptWrite(app.getPath('userData'), art)
  if (!written.ok) return written
  contextCache.invalidate('skill:')
  contextCache.invalidate('kb:')
  const next = agentRun.setArtifactStatus(session, art.id, 'accepted')
  const idx = sessions.findIndex(s => s.id === session.id)
  sessions[idx] = next
  saveAgentStore(sessions, ui)
  return { ok: true, session: next, written: written.rel }
})

ipcMain.handle('agent-artifact-reject', (_e, payload = {}) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === payload.sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  const art = (session.run?.artifacts || []).find(a => a.id === payload.artifactId)
  let next = agentRun.setArtifactStatus(session, payload.artifactId, 'rejected')
  if (art?.type === 'editor_patch') {
    next = agentRun.recordApply(next, {
      action: 'reject',
      detail: art.title || '已拒绝写入编辑器',
      noteId: art.meta?.noteId,
    })
  }
  const idx = sessions.findIndex(s => s.id === session.id)
  sessions[idx] = next
  saveAgentStore(sessions, ui)
  return { ok: true, session: next }
})

ipcMain.handle('agent-apply-log', (_e, payload = {}) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === payload.sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  const next = agentRun.recordApply(session, {
    action: payload.action,
    detail: payload.detail,
    noteId: payload.noteId,
  })
  const idx = sessions.findIndex(s => s.id === session.id)
  sessions[idx] = next
  saveAgentStore(sessions, ui)
  return { ok: true, session: next }
})

function kosSourcesCtx() {
  try {
    return sourcesLib.loadStore(SOURCES_FILE)
  } catch {
    return { sources: [] }
  }
}

ipcMain.handle('knowledge-os-list', () => {
  try {
    knowledgeOs.ensureDirs(app.getPath('userData'))
    return { ok: true, ...knowledgeOs.listEntries(app.getPath('userData'), kosSourcesCtx()) }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-refresh', () => {
  try {
    const index = knowledgeOs.refreshIndex(app.getPath('userData'), kosSourcesCtx())
    return { ok: true, scanned: index.entries?.length || 0 }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

function currentWikiRoot() {
  return knowledgeOs.resolveWikiRoot(app.getPath('userData'), kosSourcesCtx())
}

ipcMain.handle('obsidian-status', () => {
  try {
    return { ok: true, ...obsidianBridge.getStatus(currentWikiRoot()) }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('obsidian-install', async () => {
  try {
    await shell.openExternal(obsidianBridge.OFFICIAL_DOWNLOAD_URL)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || '无法打开 Obsidian 官方下载页' }
  }
})

ipcMain.handle('obsidian-bridge-install', () => {
  try {
    const wikiRoot = currentWikiRoot()
    obsidianBridge.ensureVaultRegistered(wikiRoot)
    return {
      ...obsidianBridge.installKnowMeBridge(wikiRoot),
      wikiRoot,
    }
  } catch (e) {
    return { ok: false, error: e.message || '无法安装 KnowMe Bridge' }
  }
})

ipcMain.handle('obsidian-open', async () => {
  try {
    const state = obsidianBridge.prepareOpen(currentWikiRoot())
    if (!state.ok) return state
    try {
      await shell.openExternal(state.openUri)
      return {
        ok: true,
        directGraph: state.directGraph,
        wikiRoot: state.wikiRoot,
        vaultCreated: !!state.vaultCreated,
      }
    } catch (uriError) {
      if (!state.executablePath) throw uriError
      const child = spawn(state.executablePath, [state.wikiRoot], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      })
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      child.unref()
      return {
        ok: true,
        directGraph: false,
        fallback: true,
        wikiRoot: state.wikiRoot,
        vaultCreated: !!state.vaultCreated,
      }
    }
  } catch (e) {
    return { ok: false, error: e.message || '无法打开 Obsidian' }
  }
})

ipcMain.handle('knowledge-os-query', (_e, queryText) => {
  try {
    return knowledgeOs.query(app.getPath('userData'), queryText, kosSourcesCtx())
  } catch (e) {
    return { ok: false, hits: [], error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-ingest', (_e, payload = {}) => {
  try {
    return knowledgeOs.ingest(app.getPath('userData'), payload, kosSourcesCtx())
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-lint', () => {
  try {
    return knowledgeOs.lintWiki(app.getPath('userData'), kosSourcesCtx())
  } catch (e) {
    return { ok: false, error: e.message || String(e), issues: [] }
  }
})

ipcMain.handle('knowledge-os-promote', (_e, payload = {}) => {
  try {
    return knowledgeOs.promoteToOkfDraft(app.getPath('userData'), payload, kosSourcesCtx())
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-read', (_e, payload = {}) => {
  try {
    return knowledgeOs.readEntry(app.getPath('userData'), payload.kind || 'wiki', payload.path, kosSourcesCtx())
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-config', (_e, patch) => {
  try {
    if (patch && typeof patch === 'object') {
      return { ok: true, config: knowledgeOs.saveConfig(app.getPath('userData'), patch) }
    }
    return { ok: true, config: knowledgeOs.loadConfig(app.getPath('userData')) }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

// ── 知识库 Provider：本地 / 远程 RAG ───────────────────────────────
function encProviderKey(plain) {
  if (!plain) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(String(plain)).toString('base64')
    }
  } catch { /* ignore */ }
  return null
}
function decProviderKey(encB64) {
  if (!encB64) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encB64, 'base64')).toString('utf8')
    }
  } catch { /* ignore */ }
  return ''
}

// 本地默认 provider（不落库，随本地 Wiki 绑定）
function localDefaultProvider() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  return {
    id: 'local-default',
    kind: 'local',
    displayName: '本地知识库',
    spaceSourceId: cfg.spaceSourceId || null,
    subDir: cfg.subDir || '',
  }
}

function listProvidersRedacted() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const stored = Array.isArray(cfg.providers) ? cfg.providers : []
  const providers = [localDefaultProvider(), ...stored].map((p) =>
    knowledgeProvider.redactProvider(p)
  )
  const activeProviderId = cfg.activeProviderId || 'local-default'
  return { providers, activeProviderId }
}

// 取活跃 provider 定义（remote 的 apiKey 解密为明文，仅内存使用）
function resolveActiveProvider() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const activeId = cfg.activeProviderId || 'local-default'
  if (activeId === 'local-default') return localDefaultProvider()
  const stored = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p) => p.id === activeId)
  if (!stored) return localDefaultProvider()
  if (stored.kind === 'remote-rag') {
    return { ...stored, apiKey: decProviderKey(stored.apiKeyEnc) }
  }
  return stored
}

ipcMain.handle('knowledge-provider-list', () => {
  try {
    return { ok: true, ...listProvidersRedacted() }
  } catch (e) {
    return { ok: false, error: e.message || String(e), providers: [], activeProviderId: null }
  }
})

ipcMain.handle('knowledge-provider-save', (_e, payload = {}) => {
  try {
    const userData = app.getPath('userData')
    const cfg = knowledgeOs.loadConfig(userData)
    const providers = Array.isArray(cfg.providers) ? [...cfg.providers] : []
    const kind = payload.kind === 'remote-rag' ? 'remote-rag' : 'local'
    const id = payload.id && payload.id !== 'local-default'
      ? String(payload.id)
      : `kp_${Date.now().toString(36)}`

    if (kind === 'local') {
      // 本地知识库 = 绑定空间 + 子目录（写入 knowledge-os 顶层配置）
      knowledgeOs.saveConfig(userData, {
        spaceSourceId: payload.spaceSourceId || null,
        subDir: String(payload.subDir || ''),
      })
      return { ok: true, ...listProvidersRedacted() }
    }

    // remote-rag：加密 apiKey
    const idx = providers.findIndex((p) => p.id === id)
    const prev = idx >= 0 ? providers[idx] : {}
    const rawKey = payload.apiKey != null ? String(payload.apiKey) : null
    const apiKeyEnc = rawKey ? encProviderKey(rawKey) : (prev.apiKeyEnc || null)
    if (rawKey && !apiKeyEnc) {
      return { ok: false, error: '当前系统无法安全加密 API Key，未保存密钥' }
    }
    const rec = {
      id,
      kind: 'remote-rag',
      displayName: String(payload.displayName || '远程 RAG 知识库').slice(0, 60),
      endpoint: String(payload.endpoint || ''),
      collection: String(payload.collection || ''),
      topK: Number.isFinite(payload.topK) ? payload.topK : knowledgeProvider.DEFAULT_TOPK,
      apiKeyEnc,
    }
    if (idx >= 0) providers[idx] = rec
    else providers.push(rec)
    knowledgeOs.saveConfig(userData, { providers })
    return { ok: true, id, ...listProvidersRedacted() }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-provider-remove', (_e, id) => {
  try {
    const userData = app.getPath('userData')
    const cfg = knowledgeOs.loadConfig(userData)
    const providers = (Array.isArray(cfg.providers) ? cfg.providers : []).filter((p) => p.id !== id)
    const patch = { providers }
    if (cfg.activeProviderId === id) patch.activeProviderId = 'local-default'
    knowledgeOs.saveConfig(userData, patch)
    return { ok: true, ...listProvidersRedacted() }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-provider-set-active', (_e, id) => {
  try {
    knowledgeOs.saveConfig(app.getPath('userData'), { activeProviderId: id || 'local-default' })
    return { ok: true, ...listProvidersRedacted() }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-provider-query', async (_e, queryText) => {
  try {
    const provider = resolveActiveProvider()
    return await knowledgeProvider.queryProvider(provider, queryText, {
      userData: app.getPath('userData'),
      ...kosSourcesCtx(),
    })
  } catch (e) {
    return { ok: false, hits: [], message: e.message || String(e) }
  }
})

ipcMain.handle('knowledge-os-steward-lint', (_e, sessionId) => {
  const lint = knowledgeOs.lintWiki(app.getPath('userData'), kosSourcesCtx())
  const art = agentRun.healthReportArtifact(lint)
  const { sessions, ui } = loadAgentStore()
  let session = sessions.find(s => s.id === sessionId)
  if (!session) return { ok: false, error: 'Session 不存在', lint }
  session = agentRun.recordTool(session, 'wiki.lint')
  session = agentRun.addArtifact(session, art)
  const idx = sessions.findIndex(s => s.id === sessionId)
  sessions[idx] = session
  saveAgentStore(sessions, ui)
  return { ok: true, lint, artifact: art, session }
})

ipcMain.handle('connectors-list', () => getConnectorsApi().listConnectors())
ipcMain.handle('connectors-status', (_e, id) => getConnectorsApi().getConnectorStatus(id))
ipcMain.handle('connectors-feishu-auth-start', (_e, options = {}) =>
  feishuAuth.startFeishuAuth(app.getPath('userData'), {
    force: Boolean(options?.force),
    full: Boolean(options?.full),
    // Runtime-discovered scopes for just-in-time incremental re-authorization.
    scopes: Array.isArray(options?.scopes)
      ? options.scopes.map((s) => String(s || '').trim()).filter(Boolean)
      : [],
  })
)
ipcMain.handle('connectors-upsert', (_e, patch) => getConnectorsApi().upsertConnector(patch || {}))
ipcMain.handle('connectors-set-allowlist', (_e, id, allowlist) =>
  getConnectorsApi().setAllowlist(id, allowlist))
ipcMain.handle('connectors-drafts', () => ({
  ok: true,
  drafts: connectorToolRuntime.loadDrafts(app.getPath('userData')),
}))
ipcMain.handle('connectors-create-doc-draft', (_e, payload = {}) => {
  const built = feishuCli.buildDraftWrite({
    title: payload.title,
    body: payload.body,
  })
  if (!built.ok) return built
  const extraMeta = payload.sourceArtifactId
    ? { sourceArtifactId: String(payload.sourceArtifactId).slice(0, 120) }
    : {}
  const draft = connectorToolRuntime.rememberDraft(app.getPath('userData'), {
    ...built.draft,
    meta: extraMeta,
  })
  return {
    ok: true,
    draft,
    text: built.text,
    requiresApproval: true,
  }
})
ipcMain.handle('connectors-approve-draft', (_e, payload = {}) =>
  connectorToolRuntime.approveFeishuDraft(app.getPath('userData'), payload.draftId, {
    reject: Boolean(payload.reject),
    dryRun: Boolean(payload.dryRun),
  }))

// ── Workbench：读取当前激活 Git 仓库（只读） ───────────────────────────────────
function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function readTextSafe(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return '' }
}

function loadWorkbenchAgents(repo) {
  if (!repo || !repo.ok) return []
  const { root, agentsDir } = repo
  const registry = readJsonSafe(path.join(root, 'tools', 'workflow_runner', 'agents_registry.json'))
  let agentEntries = []
  if (registry && Array.isArray(registry.agents)) {
    agentEntries = registry.agents.map(a => ({ id: a.id, title: a.title, rel: a.path }))
  } else if (fs.existsSync(agentsDir)) {
    try {
      agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'))
        .map(d => ({ id: d.name, title: d.name, rel: `.cursor/agents/${d.name}` }))
    } catch { agentEntries = [] }
  }
  const agents = []
  for (const entry of agentEntries) {
    const dir = workbenchRepo.resolveAgentDir(root, entry.rel, entry.id)
    if (!dir) continue
    const manifest = readJsonSafe(path.join(dir, 'agent.manifest.json'))
    const fm = workbenchModel.parseAgentFrontmatter(readTextSafe(path.join(dir, 'AGENT.md')))
    if (!manifest && !fm.description) continue
    const agent = workbenchModel.parseAgentManifest(manifest || { id: entry.id, title: entry.title }, {
      id: entry.id,
      title: entry.title,
      description: fm.description,
      path: entry.rel || '',
    })
    if (!agent.persona.role && fm.persona.role) agent.persona.role = fm.persona.role
    if (!agent.model && fm.model) agent.model = fm.model
    agents.push(agent)
  }
  return agents
}

function loadWorkflowDefinition(repo, workflowId) {
  if (!repo || !repo.ok || !workflowId) return null
  const wfIndex = readJsonSafe(path.join(repo.workflowsDir, 'index.json'))
  const entry = wfIndex && Array.isArray(wfIndex.workflows)
    ? wfIndex.workflows.find(w => w.id === workflowId)
    : null
  if (!entry || !entry.path) return null
  const file = workbenchRepo.resolveWorkflowFile(repo.root, entry.path)
  if (!file) return null
  const json = readJsonSafe(file)
  if (!json) return null
  return workbenchModel.parseWorkflow(json, {
    id: entry.id,
    name: entry.name,
    description: entry.description || '',
    tags: entry.tags,
    path: entry.path,
  })
}

function projectDaemonTask(raw, repo) {
  const agents = loadWorkbenchAgents(repo)
  const workflowId = String(raw.workflow || raw.task && raw.task.workflow || '').trim()
  const workflow = loadWorkflowDefinition(repo, workflowId)
  const projection = workbenchTaskProjection.projectTaskRoom({
    task: raw,
    workflow,
    agents,
    intent: raw.intent,
    status: raw.state,
    workflowId,
    workflowName: workflow && workflow.name,
  })
  return {
    ...projection,
    graph: undefined,
  }
}

function getWorkbenchDaemonClient() {
  const settings = loadSettings()
  const token = workbenchAuth.resolveToken(settings)
  const endpoint = (settings.workbenchAuth && settings.workbenchAuth.endpoint)
    || process.env.KNOWME_WORKBENCH_URL
  return workbenchDaemon.createClient({ endpoint, token })
}

function publicWorkbenchAuthStatus(settings, health = null) {
  return workbenchAuth.mergeAuthFromHealth(
    workbenchAuth.publicStatus(settings),
    health
  )
}

function getWorkbenchAutomationStore() {
  return workbenchAutomationStore.createStore(WORKBENCH_AUTOMATIONS_FILE)
}

function getWorkbenchTodoStore() {
  return workbenchTodoStore.createStore(WORKBENCH_TODOS_FILE)
}

function normalizeAutomationTargetName(item = {}, fallback) {
  return String(
    item.name ||
    item.chat_name ||
    item.localized_name ||
    item.en_name ||
    fallback ||
    ''
  ).trim()
}

const FEISHU_FACT_TOOLS = ['feishu.related_chats', 'feishu.today_priority', 'feishu.doc_kb_suggest']

/** Earlier rounds already put Feishu facts on screen, so a follow-up may re-slice them. */
function hasPriorFeishuFacts(session) {
  const list = Array.isArray(session?.messages) ? session.messages : []
  return list.some(item => item
    && item.role === 'tool'
    && item.status === 'done'
    && FEISHU_FACT_TOOLS.includes(item.toolName))
}

/** Unknown status counts as ready: never invent an auth problem the user cannot verify. */
async function getFeishuGroundingContext() {
  try {
    const result = await getConnectorsApi().getConnectorStatus('feishu')
    const connector = result?.connector || null
    const status = connector?.status || {}
    return {
      authReady: status.state === 'auth_required' ? false : status.userReady !== false,
      connectorEnabled: connector ? connector.enabled === true : null,
      allowlist: Array.isArray(connector?.allowlist) ? connector.allowlist.slice() : null,
      projectedAllowlist: Array.isArray(status?.projectedAllowlist) ? status.projectedAllowlist.slice() : null,
    }
  } catch {
    return {
      authReady: true,
      connectorEnabled: null,
      allowlist: null,
      projectedAllowlist: null,
    }
  }
}

function ensureFeishuConnectorReady(connector) {
  if (!connector || connector.enabled !== true) {
    return { ok: false, code: 'feishu_disabled', error: '飞书连接器未启用，请先在设置中启用并授权' }
  }
  const status = connector.status || {}
  if (status.state === 'auth_required' || status.userReady === false) {
    return { ok: false, code: 'feishu_auth_required', error: '飞书用户身份未授权，请先在设置中完成飞书登录授权' }
  }
  return { ok: true }
}

function toTargetItems(list = [], kind = 'chat') {
  return (Array.isArray(list) ? list : [])
    .map(item => {
      const id = String(
        kind === 'chat'
          ? (item.id || item.chat_id || '')
          : (item.id || item.open_id || item.user_id || '')
      ).trim()
      if (!id) return null
      return {
        id,
        name: normalizeAutomationTargetName(item, id),
      }
    })
    .filter(Boolean)
}

async function loadWorkbenchDaemonOverview() {
  const settings = loadSettings()
  try {
    const result = await getWorkbenchDaemonClient().overview()
    const auth = publicWorkbenchAuthStatus(settings, result.health || null)
    const bootstrapStatus = workbenchBootstrap.buildPublicStatus(settings, {
      daemonOverview: result,
      tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
    })
    return { ...result, auth, bootstrap: bootstrapStatus }
  } catch (error) {
    const bootstrapStatus = workbenchBootstrap.buildPublicStatus(settings, {
      tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
    })
    return {
      ...workbenchDaemon.normalizeError(error),
      online: false,
      workflows: [],
      tasks: [],
      auth: publicWorkbenchAuthStatus(settings),
      bootstrap: bootstrapStatus,
      hint: '请检查 Workbench 服务地址、网络连接和授权状态',
    }
  }
}

ipcMain.handle('workbench-auth-status', async () => {
  const settings = loadSettings()
  let health = null
  try {
    health = await getWorkbenchDaemonClient().overview().then(res => res.health || null)
  } catch {
    health = null
  }
  return { ok: true, auth: publicWorkbenchAuthStatus(settings, health) }
})

ipcMain.handle('workbench-auth-login', async (_e, payload = {}) => {
  const endpoint = String(payload.endpoint || loadSettings().workbenchAuth?.endpoint || '').trim()
    || 'http://127.0.0.1:8010'
  const result = await workbenchAuth.login({
    endpoint,
    key: payload.key,
    tenantId: payload.tenantId,
  })
  if (!result.ok) return result
  const current = loadSettings()
  const saved = saveSettings_({
    ...current,
    workbenchToken: result.token,
    workbenchAuth: {
      ...(current.workbenchAuth || {}),
      endpoint,
      tenantId: result.tenantId || '',
      tier: result.tier || '',
      user: result.user || '',
      configuredAt: new Date().toISOString(),
    },
  })
  if (!saved.ok) {
    return { ok: false, code: 'storage_unavailable', error: saved.warning || '无法安全保存 Workbench 授权' }
  }
  const auth = publicWorkbenchAuthStatus(loadSettings(), { auth_enabled: true })
  notifyWorkbenchAuthChanged(auth)
  return { ok: true, auth }
})

ipcMain.handle('workbench-auth-logout', () => {
  const current = loadSettings()
  const patch = workbenchAuth.clearedAuthPatch()
  saveSettings_({ ...current, ...patch })
  const auth = publicWorkbenchAuthStatus(loadSettings())
  notifyWorkbenchAuthChanged(auth)
  return { ok: true, auth }
})

ipcMain.handle('workbench-daemon-overview', async () => {
  try {
    const daemon = await loadWorkbenchDaemonOverview()
    return { ok: true, daemon }
  } catch (error) {
    return { ok: false, error: (error && error.message) || '无法读取工作服务' }
  }
})

ipcMain.handle('workbench-bootstrap-status', async () => {
  const settings = loadSettings()
  let daemonOverview = null
  try {
    daemonOverview = await getWorkbenchDaemonClient().overview()
  } catch {
    daemonOverview = null
  }
  const status = workbenchBootstrap.buildPublicStatus(settings, {
    daemonOverview,
    tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
  })
  return { ok: true, status }
})

ipcMain.handle('workbench-bootstrap-run', async (_e, payload = {}) => {
  const current = loadSettings()
  const installPath = String(payload.installPath || current.workbenchInstall?.path || '').trim()
  if (payload.saveInstallPath !== false && installPath) {
    saveSettings_({
      ...current,
      workbenchInstall: {
        ...(current.workbenchInstall || {}),
        path: installPath,
      },
    })
  }
  const settings = loadSettings()
  const result = workbenchBootstrap.runBootstrap(settings, {
    installPath: installPath || undefined,
    deploy: payload.deploy !== false,
    applyCompat: payload.applyCompat === true,
  })
  const next = loadSettings()
  saveSettings_({
    ...next,
    workbenchInstall: {
      ...(next.workbenchInstall || {}),
      path: result.installPath || installPath || next.workbenchInstall?.path || '',
      lastBootstrapAt: new Date().toISOString(),
      lastBootstrapOk: result.ok,
    },
  })
  return result
})

ipcMain.handle('game-studio-scenes', () => ({
  ok: true,
  industry: loadSettings().industry || 'general',
  scenes: gameStudio.listScenesForUi(),
}))

ipcMain.handle('game-requirement-build', (_e, payload = {}) => {
  const markdown = String(payload.markdown || '').trim()
  const title = String(payload.title || '').trim()
  const doc = markdown
    ? gameRequirement.parseFromMarkdown(markdown, title)
    : gameRequirement.emptyDoc(title)
  if (payload.source) {
    return { ok: true, doc: gameRequirement.attachSource(doc, payload.source) }
  }
  return { ok: true, doc, validation: gameRequirement.validate(doc) }
})

ipcMain.handle('game-requirement-approve', (_e, payload = {}) => {
  const doc = payload.doc
  if (!doc) return { ok: false, error: '缺少需求案' }
  const result = gameRequirement.approve(doc)
  if (!result.ok) {
    return { ok: false, error: '需求案未通过校验', validation: result.validation }
  }
  return {
    ok: true,
    doc: result.doc,
    artifact: gameRequirement.buildArtifact(result.doc),
  }
})

ipcMain.handle('game-workbench-handoff', async (_e, payload = {}) => {
  try {
    const daemon = await loadWorkbenchDaemonOverview()
    const scene = gameStudio.getScene(payload.sceneId || 'game-dev')
    const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
    const handoff = gameWorkbenchHandoff.buildHandoff({
      requirementDoc: payload.requirement || payload.doc,
      daemonOverview: daemon,
      scene,
      workflowId: payload.workflowId,
      repo: repo.ok ? repo.source : null,
      executorReady: payload.executorReady,
    })
    if (!handoff.ok) return handoff
    if (payload.start === true && !handoff.blocked) {
      const started = await getWorkbenchDaemonClient().createAndRun({
        workflow: handoff.workflow,
        slug: handoff.slug,
        intent: handoff.intent,
        context: handoff.context,
      })
      return { ...handoff, start: started }
    }
    return handoff
  } catch (error) {
    return { ok: false, error: (error && error.message) || '交接失败' }
  }
})

ipcMain.handle('workbench-load', async () => {
  const daemon = await loadWorkbenchDaemonOverview()
  const automation = getWorkbenchAutomationStore().list()
  const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
  if (!repo.ok) {
    return {
      ok: true,
      root: '',
      repo: null,
      repoError: repo.error || '当前仓库不可用',
      agents: [],
      workflows: [],
      daemon,
      automation,
    }
  }
  const { root, agentsDir, workflowsDir, source } = repo

  // 1) Agent 注册表（优先）+ 目录扫描兜底
  const registry = readJsonSafe(path.join(root, 'tools', 'workflow_runner', 'agents_registry.json'))
  let agentEntries = []
  if (registry && Array.isArray(registry.agents)) {
    agentEntries = registry.agents.map(a => ({ id: a.id, title: a.title, rel: a.path }))
  } else if (fs.existsSync(agentsDir)) {
    try {
      agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'))
        .map(d => ({ id: d.name, title: d.name, rel: `.cursor/agents/${d.name}` }))
    } catch { agentEntries = [] }
  }
  const agents = []
  for (const entry of agentEntries) {
    const dir = workbenchRepo.resolveAgentDir(root, entry.rel, entry.id)
    if (!dir) continue
    const manifest = readJsonSafe(path.join(dir, 'agent.manifest.json'))
    const fm = workbenchModel.parseAgentFrontmatter(readTextSafe(path.join(dir, 'AGENT.md')))
    if (!manifest && !fm.description) continue
    const agent = workbenchModel.parseAgentManifest(manifest || { id: entry.id, title: entry.title }, {
      id: entry.id,
      title: entry.title,
      description: fm.description,
      path: entry.rel || '',
    })
    if (!agent.persona.role && fm.persona.role) agent.persona.role = fm.persona.role
    if (!agent.model && fm.model) agent.model = fm.model
    agents.push(agent)
  }
  // 2) 工作流索引
  const wfIndex = readJsonSafe(path.join(workflowsDir, 'index.json'))
  let workflows = []
  if (wfIndex && Array.isArray(wfIndex.workflows)) {
    workflows = wfIndex.workflows.map(w => ({
      id: w.id, name: w.name, summary: w.summary || w.purpose || '', description: w.description || '',
      tags: Array.isArray(w.tags) ? w.tags : [], path: w.path || '',
    }))
  }
  return {
    ok: true,
    root,
    repo: { id: source.id, name: source.displayName, type: source.type },
    agents,
    workflows,
    repoError: '',
    daemon,
    automation,
  }
})

ipcMain.handle('workbench-workflow', (_e, payload = {}) => {
  const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
  if (!repo.ok) return repo
  const rel = String(payload.path || '').trim()
  if (!rel) return { ok: false, error: '缺少工作流路径' }
  const file = workbenchRepo.resolveWorkflowFile(repo.root, rel)
  if (!file) return { ok: false, error: '非法工作流路径' }
  const json = readJsonSafe(file)
  if (!json) return { ok: false, error: `无法读取工作流：${rel}` }
  const workflow = workbenchModel.parseWorkflow(json, { id: payload.id, name: payload.name, path: rel })
  return { ok: true, repo: { id: repo.source.id, name: repo.source.displayName }, workflow }
})

ipcMain.handle('workbench-daemon-start', async (_e, payload = {}) => {
  try {
    return await getWorkbenchDaemonClient().createAndRun(payload)
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-daemon-launch-context', async (_e, workflowId) => {
  try {
    return await getWorkbenchDaemonClient().launchContext(workflowId)
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-daemon-task', async (_e, slug) => {
  try {
    const raw = await getWorkbenchDaemonClient().task(slug)
    if (!raw.ok) return raw
    const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
    return {
      ...raw,
      projection: projectDaemonTask(raw, repo),
    }
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-daemon-artifacts', async (_e, slug) => {
  try {
    return await getWorkbenchDaemonClient().artifacts(slug)
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-daemon-artifact-open', async (_e, filePath) => {
  const resolved = workbenchRepo.resolveArtifactOpenPath(filePath, loadSourcesStore())
  if (!resolved.ok) {
    return {
      ok: false,
      reason: resolved.reason || 'not-generated',
      error: resolved.error || '该产物尚未生成或未同步',
    }
  }
  try {
    const err = await shell.openPath(resolved.target)
    if (err) return { ok: false, reason: 'open-failed', error: err }
    return { ok: true, path: resolved.target }
  } catch (error) {
    return { ok: false, reason: 'open-failed', error: error.message || String(error) }
  }
})

ipcMain.handle('workbench-daemon-gate', async (_e, slug, payload = {}) => {
  try {
    return await getWorkbenchDaemonClient().decide(slug, payload)
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-daemon-clarify', async (_e, slug, payload = {}) => {
  try {
    return await getWorkbenchDaemonClient().clarify(slug, payload)
  } catch (error) {
    return workbenchDaemon.normalizeError(error)
  }
})

ipcMain.handle('workbench-todo-list', () => getWorkbenchTodoStore().list())

ipcMain.handle('workbench-todo-add', (_e, text) =>
  getWorkbenchTodoStore().add(String(text || '')))

ipcMain.handle('workbench-todo-toggle', (_e, id) =>
  getWorkbenchTodoStore().toggle(String(id || '')))

ipcMain.handle('workbench-todo-remove', (_e, id) =>
  getWorkbenchTodoStore().remove(String(id || '')))

ipcMain.handle('workbench-todo-clear-done', () => getWorkbenchTodoStore().clearDone())

ipcMain.handle('workbench-todo-import-legacy', (_e, items) =>
  getWorkbenchTodoStore().importLegacy(Array.isArray(items) ? items : []))

ipcMain.handle('workbench-automation-list', () => getWorkbenchAutomationStore().list())

ipcMain.handle('workbench-automation-create', (_e, payload = {}) =>
  getWorkbenchAutomationStore().create(payload))

ipcMain.handle('workbench-automation-update', (_e, id, patch = {}) =>
  getWorkbenchAutomationStore().update(String(id || ''), patch))

ipcMain.handle('workbench-automation-delete', (_e, id) =>
  getWorkbenchAutomationStore().remove(String(id || '')))

ipcMain.handle('workbench-automation-toggle', (_e, id, enabled) =>
  getWorkbenchAutomationStore().toggle(String(id || ''), enabled === true))

ipcMain.handle('workbench-automation-feishu-targets', async (_e, payload = {}) => {
  const mode = String(payload.mode || 'chat').trim() === 'user' ? 'user' : 'chat'
  const query = String(payload.query || '').trim()
  const limit = Math.max(1, Math.min(30, Number(payload.limit || 20)))
  const statusRes = await getConnectorsApi().getConnectorStatus('feishu')
  if (!statusRes || !statusRes.ok) {
    return { ok: false, error: '读取飞书连接器状态失败' }
  }
  const gate = ensureFeishuConnectorReady(statusRes.connector)
  if (!gate.ok) return gate
  if (mode === 'user') {
    const res = await feishuCli.listFeishuUsers({ query, page_size: limit })
    if (!res.ok) {
      const msg = String(res.message || '').trim()
      if (/权限不足|forbidden|unauthorized|401|403|scope|permission/i.test(msg)) {
        return { ok: false, error: '飞书权限不足，无法获取用户列表。请补齐通讯录读取权限并重新授权。' }
      }
      return { ok: false, error: msg || '读取飞书联系人失败' }
    }
    return { ok: true, mode, items: toTargetItems(res.items, 'user') }
  }
  const res = await feishuCli.listFeishuChats({ query, page_size: limit })
  if (!res.ok) {
    const msg = String(res.message || '').trim()
    if (/权限不足|forbidden|unauthorized|401|403|scope|permission/i.test(msg)) {
      return { ok: false, error: '飞书权限不足，无法获取群会话列表。请补齐会话列表读取权限并重新授权。' }
    }
    return { ok: false, error: msg || '读取飞书群列表失败' }
  }
  return { ok: true, mode, items: toTargetItems(res.items, 'chat') }
})

ipcMain.handle('workbench-automation-run-now', (_e, id) =>
  getWorkbenchAutomationStore().runNow(String(id || '')))

ipcMain.handle('agent-session-set-ui', (_e, patch = {}) => {
  const { sessions, ui } = loadAgentStore()
  const next = saveAgentStore(sessions, { ...ui, ...patch })
  return { ok: true, ui: next.ui }
})

ipcMain.handle('agent-session-rename', (_e, sessionId, title) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  session.title = String(title || '').trim().slice(0, 80) || agentSessions.DEFAULT_TITLE
  session.updatedAt = new Date().toISOString()
  saveAgentStore(sessions, ui)
  return { ok: true, session: { ...session, messages: undefined, displayTitle: agentSessions.sessionDisplayTitle(session) } }
})

ipcMain.handle('agent-session-fork', (_e, sessionId) => {
  const { sessions, ui } = loadAgentStore()
  const source = sessions.find(s => s.id === sessionId)
  if (!source) return { ok: false, error: 'Session 不存在' }
  const session = agentSessions.forkSession(source)
  sessions.unshift(session)
  const openSessionIds = [session.id, ...(ui.openSessionIds || []).filter(id => id !== session.id)]
    .slice(0, agentSessions.MAX_OPEN_TABS)
  const next = saveAgentStore(sessions, { openSessionIds, activeSessionId: session.id })
  return { ok: true, session, ui: next.ui }
})

ipcMain.handle('agent-session-summary', (_e, sessionId) => {
  const { sessions } = loadAgentStore()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  return { ok: true, text: agentSessions.buildSummaryText(session) }
})

ipcMain.handle('agent-session-transcript', (_e, sessionId) => {
  const { sessions } = loadAgentStore()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  return { ok: true, text: agentSessions.buildTranscriptText(session) }
})

ipcMain.handle('agent-session-pin', (_e, sessionId, pinned) => {
  const { sessions, ui } = loadAgentStore()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return { ok: false, error: 'Session 不存在' }
  session.pinned = !!pinned
  session.updatedAt = new Date().toISOString()
  const openSessionIds = agentSessions.sortOpenSessionIds(ui.openSessionIds || [], sessions)
  const next = saveAgentStore(sessions, { ...ui, openSessionIds })
  return {
    ok: true,
    session: {
      ...session,
      messages: undefined,
      displayTitle: agentSessions.sessionDisplayTitle(session),
      pinned: session.pinned,
    },
    ui: next.ui,
  }
})

ipcMain.handle('agent-session-close-tab', (_e, sessionId) => {
  const store = loadAgentStore()
  let { sessions } = store
  const ui = store.ui
  let openSessionIds = (ui.openSessionIds || []).filter(id => id !== sessionId)
  let activeSessionId = ui.activeSessionId
  let createdSessionId = null
  if (activeSessionId === sessionId) {
    activeSessionId = openSessionIds[0] || ''
  }
  if (!openSessionIds.length) {
    const session = agentSessions.createSession('general', sessions.length + 1)
    sessions = [session, ...sessions]
    openSessionIds = [session.id]
    activeSessionId = session.id
    createdSessionId = session.id
  }
  const next = saveAgentStore(sessions, { openSessionIds, activeSessionId })
  return { ok: true, ui: next.ui, createdSessionId }
})

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
      kind: 'telemetry',
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
ipcMain.handle('remote-config-save-prefs', (_e, prefs = {}) => {
  const s = loadSettings()
  const rc = normalizeRemoteConfig({ ...s.remoteConfig, ...prefs })
  const next = { ...s, remoteConfig: rc }
  if (!rc.enabled) next.orgManaged = false
  saveSettings_(next)
  return { ok: true, remoteConfig: rc, orgManaged: next.orgManaged === true }
})
ipcMain.handle('remote-config-pull', async () => {
  const s = loadSettings()
  const rc = normalizeRemoteConfig(s.remoteConfig)
  if (!rc.enabled) {
    return { ok: false, code: 'disabled', remoteConfig: rc }
  }
  const client = createRemoteConfigClient({ enabled: true, endpoint: rc.endpoint })
  const result = await client.fetchPublic()
  const now = new Date().toISOString()
  if (!result.ok) {
    const nextRc = { ...rc, lastOk: false, lastError: result.error || '拉取失败', fetchedAt: now }
    saveSettings_({ ...s, remoteConfig: nextRc, orgManaged: false })
    return { ok: false, error: result.error, remoteConfig: nextRc }
  }
  const merged = mergeOrgPublicConfig(s, result.config)
  const nextRc = {
    ...rc,
    lastOk: true,
    lastError: '',
    updatedAt: result.updatedAt || now,
    fetchedAt: now,
  }
  saveSettings_({ ...merged, remoteConfig: nextRc, orgManaged: true })
  return { ok: true, remoteConfig: nextRc, settings: settingsSecure.publicSettings(loadSettings()) }
})
ipcMain.handle('llm-profile', () => llmModelCatalog.publicProfile(loadSettings()))
ipcMain.handle('llm-models', () => llmModelCatalog.listCatalog(loadSettings()))
ipcMain.handle('llm-set-model', (_e, payload = {}) => {
  const settings = loadSettings()
  const model = String(payload.model || '').trim()
  if (!model) return { ok: false, error: '模型不能为空' }
  const provider = String(payload.provider || settings.llmProvider || '').trim()
  const preset = llmModelCatalog.getPreset(provider, model)
  const next = {
    ...settings,
    model,
    llmProvider: provider || settings.llmProvider,
    llmProfile: preset
      ? {
          contextWindow: preset.contextWindow,
          maxOutput: preset.maxOutput,
          supportsTools: preset.supportsTools !== false,
          parameter: preset.parameter || 'max_tokens',
        }
      : null,
  }
  saveSettings_(next)
  return { ok: true, profile: llmModelCatalog.publicProfile(next) }
})
ipcMain.on('get-settings', e => { e.returnValue = settingsSecure.publicSettings(loadSettings()) })
ipcMain.on('open-settings',   (_e, tab) => openSettings(String(tab || '')))
ipcMain.on('open-settings-window', (_e, tab) => openSettingsWindow(String(tab || '')))

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
    kind: 'telemetry',
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
    kind: 'telemetry',
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

function normalizeEmbeddingsEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/embeddings(\?|$)/.test(trimmed)) return trimmed
  if (/\/chat\/completions$/.test(trimmed)) return trimmed.replace(/\/chat\/completions$/, '/embeddings')
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) return `${trimmed}/embeddings`
  return `${trimmed}/embeddings`
}

/**
 * 构建 embeddings 调用函数用于向量语义重排。
 * 仅当 settings.semanticRerank === true 且具备 apiKey/端点时启用，否则返回 null（走词面排序）。
 * 失败/超时抛错，由 knowledge-os.queryRanked 捕获回退，绝不阻断检索。
 */
function buildEmbedFn(settings) {
  if (!settings || settings.semanticRerank !== true || !settings.apiKey) return null
  const endpoint = normalizeEmbeddingsEndpoint(settings.apiEndpoint)
  if (!endpoint || typeof fetch !== 'function') return null
  const apiKey = settings.apiKey
  const model = String(settings.embeddingModel || '').trim()
    || (settings.llmProvider === 'dashscope' ? 'text-embedding-v3' : 'text-embedding-3-small')
  const embed = async (texts) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`embeddings ${res.status}`)
      const json = await res.json()
      const data = Array.isArray(json?.data) ? json.data : []
      const ordered = [...data].sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0))
      const vectors = ordered.map((d) => d.embedding)
      if (vectors.length !== texts.length) {
        throw new Error(`embeddings count mismatch: ${vectors.length}/${texts.length}`)
      }
      return vectors
    } finally {
      clearTimeout(timer)
    }
  }
  embed.cacheKey = `${endpoint}|${model}`
  return embed
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

function requestAgentCompletion({ url, settings, body, onSnapshot, signal }) {
  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const payload = JSON.stringify(body)
    let req
    let settled = false
    let abortHandler
    const finish = result => {
      if (settled) return
      settled = true
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      resolve(result)
    }
    req = lib.request({
      hostname: url.hostname,
      port,
      method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let raw = ''
      let sawSse = String(res.headers['content-type'] || '').includes('text/event-stream')
      let lastContent = ''
      let reasoningReported = false
      const accumulator = agentStream.createStreamAccumulator()
      const publishSnapshot = () => {
        if (signal?.aborted || settled) return
        const snapshot = agentStream.getStreamSnapshot(accumulator)
        if (snapshot.hasReasoning && !reasoningReported) {
          reasoningReported = true
          onSnapshot?.({ ...snapshot, reasoningStarted: true })
        }
        if (snapshot.content !== lastContent) {
          lastContent = snapshot.content
          onSnapshot?.(snapshot)
        }
      }

      res.on('data', chunk => {
        if (signal?.aborted || settled) return
        const piece = chunk.toString()
        raw += piece
        if (!sawSse && (raw.startsWith('data:') || piece.includes('\ndata:'))) sawSse = true
        if (!sawSse) return
        try {
          agentStream.feedSse(accumulator, piece)
          publishSnapshot()
        } catch (err) {
          req.destroy()
          finish({ error: err.message || '流式响应解析失败', status: res.statusCode })
        }
      })

      res.on('end', () => {
        if (settled) return
        if (res.statusCode !== 200) {
          let message = raw.substring(0, 300)
          try {
            const parsed = JSON.parse(raw)
            message = parsed.error?.message || parsed.message || message
          } catch { /* keep response preview */ }
          finish({ error: `HTTP ${res.statusCode}: ${message}`, status: res.statusCode })
          return
        }
        try {
          if (sawSse) {
            agentStream.flushSse(accumulator)
          } else {
            agentStream.applyCompletionJson(accumulator, JSON.parse(raw))
          }
          publishSnapshot()
          finish({ snapshot: agentStream.getStreamSnapshot(accumulator), streamed: sawSse })
        } catch (err) {
          finish({ error: err.message || '响应格式异常', status: res.statusCode })
        }
      })
    })
    abortHandler = () => {
      req.destroy()
      finish({ error: '请求已取消', cancelled: true })
    }
    if (signal?.aborted) return abortHandler()
    signal?.addEventListener('abort', abortHandler, { once: true })
    req.setTimeout(120000, () => {
      req.destroy()
      finish({ error: '请求超时（120s），请检查网络或 Endpoint', timedOut: true })
    })
    req.on('error', err => {
      if (signal?.aborted) return finish({ error: '请求已取消', cancelled: true })
      finish({ error: `连接失败: ${err.message}` })
    })
    req.write(payload)
    req.end()
  })
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
  const promptForRoute = (Array.isArray(messages) ? messages : [])
    .map(item => typeof item?.content === 'string' ? item.content : '')
    .join('\n')
    .slice(0, 5000)
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier: 'assist',
    prompt: promptForRoute,
    history: messages,
  })

  const body = JSON.stringify({
    model: routedModel.model || 'gpt-4o-mini',
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

ipcMain.handle('ai-cancel-run', (_e, runId = '') => {
  const controller = activeAgentRuns.get(String(runId || ''))
  if (!controller) return { ok: false, code: 'run_not_found' }
  controller.abort()
  return { ok: true }
})

function extractResourceHintTarget(args = {}) {
  if (!args || typeof args !== 'object') return ''
  const candidates = [
    '_file_path',
    'file_path',
    'filePath',
    'filepath',
    'path',
    'url',
    'doc_token',
    'node_token',
    'space_id',
  ]
  for (const key of candidates) {
    const value = String(args[key] || '').trim()
    if (value) return value.slice(0, 240)
  }
  return ''
}

function isMissingResourceText(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return false
  return /(enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源)/i.test(raw)
}

function buildMissingResourceHint(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  const failed = [...list].reverse().find(item =>
    item?.status === 'error' && isMissingResourceText(item?.text)
  )
  if (!failed) return ''
  const target = extractResourceHintTarget(failed.args)
  if (target) {
    return `我尝试读取目标内容，但未找到该资源：\`${target}\`。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。`
  }
  return '我尝试读取目标内容，但未找到对应资源。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。'
}

ipcMain.handle('ai-generate', async (e, payload = {}) => {
  const {
    prompt, displayPrompt, context, history, noteId, category, skillRefs, sessionId, agentId, contentGrounding,
    memoryToggles,
  } = payload
  const webContents = e.sender
  const runId = String(payload.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const controller = new AbortController()
  const signal = controller.signal
  activeAgentRuns.set(runId, controller)
  const runStartedAt = Date.now()
  const metrics = { rounds: 0, toolCalls: 0, firstTokenMs: null }
  const trace = []
  const toolMessages = []
  const emit = event => {
    if (!webContents.isDestroyed()) webContents.send('ai-stream-event', { runId, sessionId, ...event })
  }
  const upsertTrace = event => {
    const index = trace.findIndex(item => item.id === event.id)
    const next = {
      id: event.id,
      kind: event.kind === 'tool' ? 'tool' : 'stage',
      title: event.title,
      status: event.status || 'done',
      summary: event.summary || '',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      durationMs: event.durationMs,
    }
    if (index >= 0) trace[index] = { ...trace[index], ...next }
    else trace.push(next)
  }
  const stage = (id, title, status = 'pending', extra = {}) => {
    const event = { id, type: extra.fallback ? 'fallback' : 'stage', kind: 'stage', title, status, ...extra }
    upsertTrace(event)
    emit(event)
  }
  const fail = error => {
    activeAgentRuns.delete(runId)
    stage('stage_generate', '生成失败', 'error', { summary: String(error || '未知错误').slice(0, 500) })
    emit({ type: 'error', title: '生成失败', summary: String(error || '').slice(0, 500) })
    return { error, runId }
  }
  const cancelled = () => {
    activeAgentRuns.delete(runId)
    stage('stage_generate', '已停止生成', 'done')
    emit({ type: 'cancelled', title: '已停止生成', summary: '本次 Agent Run 已取消' })
    return { error: '请求已取消', cancelled: true, runId }
  }

  stage('stage_prepare', '正在准备上下文…')
  const s = loadSettings()
  llmUsage.importCalibrations(s.tokenCalibrations || {})
  if (!s.apiKey) return fail('未填写 API Key，请托盘右键 → API 设置')
  if (!s.apiEndpoint) return fail('未填写 API Endpoint，请托盘右键 → API 设置')

  let url
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  try { url = new URL(endpoint) } catch { return fail(`Endpoint 格式错误: ${s.apiEndpoint}`) }

  let theme = String(category || '').trim()
  if (!theme && noteId) {
    const n = readNote(noteId)
    if (n) theme = String(n.category || '').trim()
  }
  const fromPrompt = productKnowledge.parseSlashTokens(prompt)
  const slashRefs = [
    ...new Set([
      ...(Array.isArray(skillRefs) ? skillRefs.map(productKnowledge.normalizeSlash) : []),
      ...fromPrompt,
    ].filter(Boolean)),
  ]
  const ensured = ensureAgentSession(sessionId, agentId)
  let session = ensured.session
  const prepared = agentSessions.compactSession(session)
  session = prepared.session
  if (prepared.compacted) {
    saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
  }

  const ctxRole = (session?.run?.role === 'steward' || session?.agentId === 'steward')
    ? 'steward'
    : String(session?.run?.role || session?.agentId || 'general')
  const grounding = contentGrounding && typeof contentGrounding === 'object'
    ? contentGrounding
    : conversationGrounding.buildGrounding({ prompt, displayPrompt, context })
  const writingTask = ctxRole === 'writing'
    ? writingWorkflow.classifyWritingTask(prompt, displayPrompt, grounding)
    : null
  const forceFullCtx = process.env.KNOWME_CTX_FULL === '1' || s.chatContextTier === 'full'
  const tier = (forceFullCtx || (ctxRole === 'writing' && !!writingTask)) ? 'retrieval' : chatIntent.classifyIntent({
    prompt,
    hasNoteContext: !!String(context || '').trim(),
    slashRefs,
    role: ctxRole,
  })
  const todayPriorityFactsOnly = /(今日优先级|今天优先级|今日优先|优先级助手|feishu\.today_priority)/i.test(String(prompt || ''))
  const heavyCtx = tier !== 'chat' && !todayPriorityFactsOnly
  const kbSnippet = heavyCtx
    ? contextCache.cached(
        `kb:${KNOWLEDGE_DIR}`,
        contextCache.statMtimeMs(path.join(KNOWLEDGE_DIR, 'index.md')),
        () => productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
      )
    : ''
  const skillCtx = heavyCtx
    ? contextCache.cached(
        `skill:${KNOWLEDGE_DIR}:${theme}:${slashRefs.join(',')}`,
        contextCache.statMtimeMs(KNOWLEDGE_DIR),
        () => productKnowledge.getSkillContext(KNOWLEDGE_DIR, { category: theme, slashRefs })
      )
    : ''
  const baseMemCtx = heavyCtx
    ? contextCache.cached(
        `mem:${MEMORY_DIR}:${theme}:${slashRefs.join(',')}`,
        contextCache.statMtimeMs(path.join(MEMORY_DIR, 'working', 'recent.jsonl')) ||
          contextCache.statMtimeMs(MEMORY_DIR),
        () => productMemory.getContextForAI(MEMORY_DIR, [kbSnippet, skillCtx].filter(Boolean).join('\n\n'))
      )
    : ''
  const embedFn = buildEmbedFn(s)

  const queryKnowledge = async (query, querySignal) => {
    const provider = resolveActiveProvider()
    return knowledgeProvider.queryProvider(provider, query, {
      userData: app.getPath('userData'),
      signal: querySignal,
      embed: embedFn,
      ...kosSourcesCtx(),
    })
  }

  let wikiCtx = ''
  if (tier === 'retrieval' && !todayPriorityFactsOnly && String(prompt || '').trim()) {
    const startedAt = Date.now()
    stage('stage_retrieval', '正在检索知识库…')
    try {
      const q = await queryKnowledge(prompt)
      metrics.retrievalMs = Date.now() - startedAt
      metrics.retrievalHitCount = Array.isArray(q.hits) ? q.hits.length : 0
      metrics.retrievalReranked = !!q.reranked
      if (q.hits?.length) {
        wikiCtx = knowledgeOs.formatQueryContext(q.hits)
        const provider = resolveActiveProvider()
        session = agentRun.recordTool(session, provider.kind === 'remote-rag' ? 'rag.query' : 'wiki.query')
      }
      stage('stage_retrieval', '知识检索完成', 'done', {
        summary: q.hits?.length ? `命中 ${q.hits.length} 条` : (q.message || '未命中'),
        durationMs: Date.now() - startedAt,
      })
    } catch (err) {
      metrics.retrievalMs = Date.now() - startedAt
      stage('stage_retrieval', '知识检索失败', 'error', {
        summary: String(err?.message || '检索失败').slice(0, 300),
        durationMs: Date.now() - startedAt,
      })
    }
  }
  if (signal.aborted) return cancelled()

  const sessionHistory = agentSessions.contextMessages(session)
  const sessionSummary = session.summary ? `## 当前 Session 历史摘要\n${session.summary}` : ''
  const userProfile = {
    userProfile: s.userProfile,
    userPrompt: s.userPrompt,
    industry: s.industry,
  }
  const workContext = {
    topic: [
      grounding.goal,
      session?.title,
      prompt,
    ].filter(Boolean).join(' ').slice(0, 240),
    label: session?.title || ctxRole,
    project: theme,
  }
  const contextItems = productMemory.buildContextItems(MEMORY_DIR, {
    userProfile,
    workContext,
    sessionSummary,
  })
  const effectivePersonalization = productMemory.buildEffectivePersonalization(MEMORY_DIR, userProfile, {
    limit: 4,
    includeUserPrompt: memoryToggles?.collaborationPrefs !== false,
  })
  const lightPacket = contextPacketLib.buildContextPacket({
    items: [
      ...contextItems.filter(item => (
        item.type === 'preference' && item.confidence === 'confirmed'
      )),
      // 手填协作偏好也进入 light 包，避免只靠 system 段、dynamic 段空着
      ...(effectivePersonalization.applied
        .filter(item => item.kind === 'user_prompt')
        .map(item => ({
          id: item.id,
          type: 'preference',
          text: item.text,
          confidence: 'explicit',
          scope: 'global',
          source: item.source,
          reason: 'user_prompt',
        }))),
    ],
    mode: 'light',
    maxItems: 4,
  })
  const workPacket = contextPacketLib.buildContextPacket({
    items: contextItems.filter(item => item.type === 'work_memory'),
    mode: 'work',
    maxItems: 8,
  })
  // 统一短摘要优先；若为空再回落到 light packet 格式化结果
  const personalizationContext = effectivePersonalization.promptBlock
    || contextPacketLib.formatForPrompt(lightPacket)
  const workMemoryContext = contextPacketLib.formatForPrompt(workPacket)
  const memCtx = [baseMemCtx, workMemoryContext].filter(Boolean).join('\n\n')
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier,
    prompt,
    history: sessionHistory.length ? sessionHistory : history,
  })
  const modelProfile = routedModel.profile
  const tokenCalKey = llmUsage.calibrationKey(routedModel.provider, routedModel.model || 'gpt-4o-mini')
  const tokenCalBefore = llmUsage.getCalibration(tokenCalKey)
  if (routedModel.autoRouted) {
    stage('stage_prepare', `Auto 已选择模型：${routedModel.profile.label}`, 'done', {
      summary: `路由规则：${routedModel.autoReason || 'default'}`,
    })
  }
  const policy = llmRuntime.getRequestPolicy({
    model: routedModel.model || 'gpt-4o-mini',
    tier,
    temperature: s.temperature,
    requestedOutput: 2000,
    profile: modelProfile,
  })
  const promptCachePolicy = llmRuntime.getCacheControlPolicy({
    enabled: s.promptCacheControl === true || process.env.KNOWME_PROMPT_CACHE === '1',
    provider: routedModel.provider,
    model: routedModel.model,
    endpoint: s.apiEndpoint,
  })
  const memoryPolicy = contextOrchestrator.buildMemoryPolicy({
    tier,
    memoryContext: memCtx,
    disableMemory: process.env.KNOWME_DISABLE_MEMORY_CONTEXT === '1' || s.disableMemoryContext === true,
  })
  // dynamic sections are still budgeted by priority via llmRuntime.fitSections (inside orchestrator)
  const dynamicContextPack = contextOrchestrator.buildDynamicContext({
    policy: { inputBudget: policy.inputBudget, tier },
    roleGuidance: conversationGrounding.roleGuidance(ctxRole),
    timeAnchor: buildTemporalAnchorContext(),
    groundingText: grounding.text,
    sessionSummary,
    retrievalContext: wikiCtx,
    memoryContext: memCtx,
    personalizationContext,
    planContext: agentRun.formatPlanChecklist(session?.run?.plan),
    memoryPolicy,
  })
  const srcStoreForWriting = loadSourcesStore()
  const activeSourceRecord = srcStoreForWriting.sources.find(
    (s) => s.id === srcStoreForWriting.activeSourceId,
  ) || null
  const writingPromptContext = writingTask
    ? writingWorkflow.buildWritingPromptContext({
      prompt,
      displayPrompt,
      context,
      grounding,
      activeSource: activeSourceRecord,
    })
    : ''
  const capAssembly = ensureCapabilityHub().assembleContextForSession(
    session,
    prompt,
    slashRefs,
    tier,
    skillCtx,
  )
  const dynamicContext = [
    dynamicContextPack.dynamicContext,
    writingPromptContext,
    capAssembly.dynamicCapabilityContext,
  ].filter(Boolean).join('\n\n')
  const sceneId = promptRouter.resolveScene({
    mode: ctxRole,
    tier,
    role: ctxRole,
    hasNoteContext: !!String(context || '').trim(),
    industry: s.industry,
    prompt,
  })
  const systemContent = buildSystemContent({
    scenePrompt: promptRouter.buildScenePrompt({ scene: sceneId, mode: ctxRole }),
    userPrompt: promptRouter.buildUserPrompt(s, ctxRole, {
      includeUserPrompt: memoryToggles?.collaborationPrefs !== false,
    }),
    skillPrompt: promptRouter.buildSkillPrompt(slashRefs),
    dynamicContext: '',
  })
  const rawMessages = buildChatMessages({
    systemContent,
    contextMessage: dynamicContext,
    history: sessionHistory.length ? sessionHistory : history,
    prompt,
    noteContext: context,
  })
  const fittedConversation = llmRuntime.fitConversation(rawMessages, policy.inputBudget)
  let apiMessages = fittedConversation.messages
  try {
    logger.systemPrompt('llm-system-prompt', '构建系统提示词', {
      model: modelProfile.model,
      agentId: session?.agentId || agentId || 'general',
      sessionId: session?.id || sessionId || '',
      skillRefs: slashRefs,
      systemContent,
      dynamicContext: String(dynamicContext || '').slice(0, 8000),
    }, { runId, scope: 'ai-generate' })
  } catch { /* ignore */ }
  const contextInfo = {
    usedTokens: fittedConversation.usedTokens,
    contextWindow: modelProfile.contextWindow,
    inputBudget: policy.inputBudget,
    omittedTurns: fittedConversation.omittedTurns,
    omittedMessages: fittedConversation.omittedMessages,
    model: modelProfile.model,
    label: modelProfile.label,
    requestedModel: routedModel.requestedModel,
    autoRouted: routedModel.autoRouted,
    autoReason: routedModel.autoReason,
    promptCache: promptCachePolicy.enabled,
    sectionUsage: dynamicContextPack.sectionUsage,
    sectionOmitted: dynamicContextPack.sectionOmitted,
    memoryPolicy: dynamicContextPack.memoryPolicy,
    contextPacket: {
      version: 1,
      mode: dynamicContextPack.memoryPolicy.mode || 'off',
      itemCount: contextItems.length,
      includedTypes: [...new Set(
        [
          ...lightPacket.items,
          ...workPacket.items,
        ].map(item => item.type)
      )],
      omitted: lightPacket.omitted + workPacket.omitted,
    },
  }
  session.messages.push({ role: 'user', text: String(prompt || '').slice(0, 12000) })
  if (grounding.active) {
    session.displayTitle = String(grounding.title || '').slice(0, 80)
    session.labels = Array.isArray(grounding.labels) ? grounding.labels.slice(0, 3) : []
    session.grounding = String(grounding.text || '').slice(0, 3000)
  }
  session.updatedAt = new Date().toISOString()
  saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
  stage('stage_prepare', '上下文准备完成', 'done', { contextInfo })

  const needsConnectorTools = tier !== 'chat' || slashRefs.length > 0
  const fileTools = needsConnectorTools
    ? buildActiveSourceFileTools(embedFn, {
      workspaceState: s.workspaceState || null,
      runMetrics: metrics,
    })
    : null
  // 临时工作区脚本沙箱（run_python / run_shell）：默认开启，破坏性/外联命令拦截并要求确认。
  const sandboxEnabled = needsConnectorTools && s.agentScriptsEnabled !== false
  const sandboxWorkdir = path.join(app.getPath('userData'), 'agent-sandbox', runId)
  const sandboxPermissions = agentSandbox.normalizeSandboxPermissions(
    payload.permissions || session?.run?.permissions,
    { allowNetwork: s.agentScriptsAllowNetwork === true },
  )
  if (!session.run || typeof session.run !== 'object') session.run = {}
  session.run.permissions = sandboxPermissions
  const sandboxTools = sandboxEnabled
    ? agentSandbox.buildSandboxTools({
      workdir: sandboxWorkdir,
      permissions: sandboxPermissions,
    })
    : null
  const planTools = needsConnectorTools
    ? agentPlanTools.buildPlanTools({
      getSession: () => session,
      setSession: (next) => { session = next },
    })
    : null
  const webTools = needsConnectorTools ? agentWebTools.buildWebTools({ signal }) : null
  const skillTools = needsConnectorTools
    ? ensureCapabilityHub().buildSkillToolsForSession(session, sandboxPermissions)
    : null
  const extraTools = mergeExtraTools(fileTools, sandboxTools, planTools, webTools, skillTools)
  const sessionConnectorBindings = getSessionCapabilityBindings(session, ensureCapabilityHub().expertRuntime())
  const connectorRuntime = needsConnectorTools
    ? await connectorToolRuntime.buildConnectorToolSurface(app.getPath('userData'), {
      extraTools,
      allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds || undefined,
    })
    : { surface: agentTools.createToolSurface(), async close() {} }
  const toolSurface = connectorRuntime.surface
  const toolExecutor = toolSurface.createToolExecutor({ searchKnowledge: queryKnowledge, signal })
  let budget = llmUsage.adaptiveBudget(tier)
  let maxRounds = budget.maxRounds
  let maxToolCalls = budget.maxToolCalls
  let budgetExpansions = 0
  let lastPlanCheckpointAt = 0
  const checkpointSession = (force = false) => {
    const now = Date.now()
    if (!force && now - lastPlanCheckpointAt < 800) return
    lastPlanCheckpointAt = now
    try {
      saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? session : item))
      const plan = session?.run?.plan
      if (plan?.items?.length) {
        emit({
          type: 'plan.updated',
          plan: {
            version: plan.version,
            updatedAt: plan.updatedAt,
            items: plan.items,
            remaining: agentRun.countPlanRemaining(plan),
          },
        })
      }
    } catch { /* ignore */ }
  }
  const tryExpandBudget = (reason) => {
    const remaining = agentRun.countPlanRemaining(session?.run?.plan)
    const expanded = llmUsage.expandBudget(
      { maxRounds, maxToolCalls },
      {
        tier,
        planRemaining: remaining,
        repeatedCall: repeatedToolCall,
        expansionsUsed: budgetExpansions,
        reason,
      },
    )
    if (!expanded.expanded) return false
    maxRounds = expanded.maxRounds
    maxToolCalls = expanded.maxToolCalls
    budgetExpansions = expanded.expansionsUsed
    metrics.budgetExpansions = budgetExpansions
    stage('stage_generate', `计划未完成，扩展执行预算（第 ${budgetExpansions} 次）…`, 'pending', {
      summary: `rounds≤${maxRounds} · tools≤${maxToolCalls}`,
    })
    return true
  }
  let toolCallCount = 0
  metrics.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: 'estimate' }
  let toolsEnabled = tier !== 'chat' && modelProfile.supportsTools !== false
  let fullText = ''
  let lastModelText = ''
  let streamed = false
  const feishuIntent = feishuGrounding.detectFeishuIntent(prompt)
  const suppressStreamForFeishuGuard = !!(
    feishuIntent &&
    feishuIntent.mentioned &&
    (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
  )
  const loopState = agentLoop.createLoopState()
  let repeatedToolCall = false
  let recoveryUsed = 0
  const MAX_RECOVERY_ROUNDS = 2
  let onSnapshot = () => {}

  try {
  const finalizeResponse = async reason => {
    if (loopState.finalizationUsed) return { error: '最终答复收敛请求已使用' }
    loopState.finalizationUsed = true
    const title = reason === 'repeated'
      ? '正在整理已有结果…'
      : '正在整理最终答复…'
    stage('stage_generate', title)
    const finalMessages = apiMessages.concat({
      role: 'user',
      content: '请基于当前对话和已经返回的工具结果，直接给出最终答复。不要再调用工具，不要解释执行预算或内部流程；如果信息不足，请明确说明缺少什么。',
    })
    const finalOutboundMessages = llmRuntime.applyCacheControlMessages(finalMessages, promptCachePolicy)
    const completion = await requestAgentCompletion({
      url,
      settings: s,
      signal,
      body: {
        model: routedModel.model || 'gpt-4o-mini',
        messages: finalOutboundMessages,
        [policy.parameter]: Math.min(policy.maxOutput, 2400),
        temperature: policy.temperature,
        stream: true,
      },
      onSnapshot,
    })
    if (completion.cancelled || signal.aborted) return cancelled()
    if (completion.error) return completion
    const snapshot = completion.snapshot || {}
    if (snapshot.content?.trim()) {
      fullText = snapshot.content
      streamed = streamed || completion.streamed
    } else if (lastModelText.trim()) {
      fullText = lastModelText
    }
    return { ...completion, snapshot }
  }

  for (let round = 1; round <= maxRounds; round++) {
    if (signal.aborted) return cancelled()
    metrics.rounds++
    const roundTitle = round === 1 ? '正在等待模型响应…' : `正在继续生成（第 ${round} 轮）…`
    stage('stage_generate', roundTitle)
    const roundStartedAt = Date.now()
    const waitTicker = setInterval(() => {
      const elapsedSec = Math.max(1, Math.floor((Date.now() - roundStartedAt) / 1000))
      stage('stage_generate', roundTitle, 'pending', { summary: `已等待 ${elapsedSec}s` })
    }, 1000)
    const requestBody = {
      model: routedModel.model || 'gpt-4o-mini',
      messages: llmRuntime.applyCacheControlMessages(apiMessages, promptCachePolicy),
      [policy.parameter]: policy.outputTokens,
      temperature: policy.temperature,
      stream: true,
      ...(toolsEnabled ? { tools: toolSurface.getToolDefinitions(), tool_choice: 'auto' } : {}),
    }
    let reasoningSeen = false
    let previousVisibleText = ''
    onSnapshot = snapshot => {
      if (snapshot.reasoningStarted && !reasoningSeen) {
        reasoningSeen = true
        stage('stage_generate', '正在分析并规划回答…')
      }
      if (snapshot.content) {
        fullText = snapshot.content
        lastModelText = snapshot.content
        const visibleText = normalizeAssistantOutput(snapshot.content)
        const delta = visibleText.startsWith(previousVisibleText)
          ? visibleText.slice(previousVisibleText.length)
          : visibleText
        previousVisibleText = visibleText
        if (metrics.firstTokenMs == null) metrics.firstTokenMs = Date.now() - runStartedAt
        if (!suppressStreamForFeishuGuard) {
          streamed = true
          if (!webContents.isDestroyed()) webContents.send('ai-stream-chunk', { text: visibleText, delta, runId })
          emit({ type: 'content', text: visibleText, delta })
        }
      }
    }
    try {
      logger.llm('llm-request', `请求模型（第 ${round} 轮）`, {
        model: requestBody.model,
        endpoint: url.host + url.pathname,
        round,
        tier,
        messages: apiMessages.length,
        toolsEnabled,
        outputTokens: policy.outputTokens,
        temperature: policy.temperature,
      }, { runId, scope: 'ai-generate' })
    } catch { /* ignore */ }
    let completion
    try {
      completion = await requestAgentCompletion({ url, settings: s, body: requestBody, onSnapshot, signal })
      if (completion.error && toolsEnabled && [400, 404, 422].includes(completion.status)) {
        toolsEnabled = false
        stage('stage_compatibility', '当前模型不支持工具，已切换普通对话', 'done', {
          fallback: true,
          summary: String(completion.error).slice(0, 300),
        })
        completion = await requestAgentCompletion({
          url,
          settings: s,
          body: { ...requestBody, tools: undefined, tool_choice: undefined },
          onSnapshot,
          signal,
        })
      }
    } finally {
      clearInterval(waitTicker)
    }
    if (completion.cancelled || signal.aborted) return cancelled()
    if (completion.error) {
      try {
        logger.llm('llm-error', `模型请求失败（第 ${round} 轮）`, {
          model: requestBody.model,
          status: completion.status,
          error: String(completion.error).slice(0, 800),
        }, { runId, scope: 'ai-generate', level: 'error', durationMs: Date.now() - roundStartedAt })
      } catch { /* ignore */ }
      return fail(completion.error)
    }

    const snapshot = completion.snapshot
    streamed = streamed || completion.streamed
    metrics.usage = llmUsage.accumulateUsage(metrics.usage, snapshot?.usage)
    try {
      const toolCallsThisRound = Array.isArray(snapshot?.toolCalls) ? snapshot.toolCalls.length : 0
      logger.llm('llm-response', `模型响应（第 ${round} 轮）`, {
        model: requestBody.model,
        usage: snapshot?.usage || null,
        toolCalls: toolCallsThisRound,
        contentChars: (snapshot?.content || '').length,
        streamed: !!completion.streamed,
      }, { runId, scope: 'ai-generate', durationMs: Date.now() - roundStartedAt })
    } catch { /* ignore */ }
    const providerPromptTokens = Number(snapshot?.usage?.prompt_tokens ?? snapshot?.usage?.promptTokens)
    if (Number.isFinite(providerPromptTokens) && providerPromptTokens > 0) {
      const estimatedPrompt = llmRuntime.estimateTokens(JSON.stringify(requestBody.messages))
      const cal = llmUsage.learnCalibration(tokenCalKey, estimatedPrompt, providerPromptTokens)
      metrics.tokenCalibFactor = cal.factor
      metrics.tokenCalibSamples = cal.samples
    }
    const calls = Array.isArray(snapshot?.toolCalls) ? snapshot.toolCalls : []
    if (!calls.length) {
      fullText = snapshot?.content || fullText
      const planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: false,
        budgetExhausted: false,
      })
      if (planEval.action === 'continue' && toolsEnabled && !repeatedToolCall) {
        const expanded = tryExpandBudget('plan_continue_no_tools')
        const stillWithin = !agentLoop.shouldFinalize({
          round,
          maxRounds,
          toolCallCount,
          maxToolCalls,
          repeatedCall: repeatedToolCall,
        })
        if (expanded || stillWithin) {
          const checklist = agentRun.formatPlanChecklist(session?.run?.plan) || ''
          apiMessages.push({
            role: 'user',
            content: [
              '计划仍有未完成项。请继续用工具推进，并用 update_plan 更新状态；不要提前宣称完成。',
              '写入文件仍须走 artifact 审批，不可声称已落盘。',
              checklist,
            ].filter(Boolean).join('\n'),
          })
          stage('stage_generate', `计划未完成，继续执行（剩余 ${planEval.remaining} 项）…`, 'pending')
          fullText = ''
          continue
        }
      }
      if (!fullText.trim()) return fail('模型返回空响应')
      const exhaustedNote = agentVerify.buildPartialFinalizeNote(
        agentVerify.evaluatePlanCompletion(session?.run?.plan, {
          canExpand: false,
          budgetExhausted: true,
        }),
      )
      if (exhaustedNote) {
        fullText = `${fullText.trim()}\n\n---\n${exhaustedNote}`
      }
      stage('stage_generate', '回答生成完成', 'done')
      checkpointSession(true)
      break
    }

    if (toolCallCount + calls.length > maxToolCalls) {
      if (tryExpandBudget('tool_call_cap') && toolCallCount + calls.length <= maxToolCalls) {
        // expanded enough to execute this batch — fall through
      } else {
        const finalized = await finalizeResponse('budget')
        if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
        if (!fullText.trim()) fullText = lastModelText
        const partialNote = agentVerify.buildPartialFinalizeNote(
          agentVerify.evaluatePlanCompletion(session?.run?.plan, {
            canExpand: false,
            budgetExhausted: true,
          }),
        )
        if (partialNote) {
          fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
        }
        checkpointSession(true)
        break
      }
    }
    apiMessages.push({
      role: 'assistant',
      content: snapshot.content || null,
      tool_calls: calls.map(call => ({
        id: call.id || `call_${round}_${toolCallCount + 1}`,
        type: 'function',
        function: { name: call.name, arguments: call.arguments || '{}' },
      })),
    })
    const roundToolMessages = []

    for (const [index, call] of calls.entries()) {
      if (signal.aborted) return cancelled()
      toolCallCount++
      metrics.toolCalls = toolCallCount
      const callId = call.id || `call_${round}_${index + 1}`
      const toolName = call.name || 'unknown_tool'
      const startedAt = Date.now()
      const cacheKey = agentLoop.toolCallKey(toolName, call.arguments)
      const validation = toolSurface.validateToolCall(toolName, call.arguments)
      const argsSummary = validation.ok ? agentTools.summarizeToolArgs(toolName, validation.args) : ''
      const title = toolName === 'search_knowledge' ? '搜索知识库'
        : toolName === 'fetch_web_page' ? '读取网页'
        : toolName.startsWith('feishu.') ? `飞书：${toolName.replace(/^feishu\./, '')}`
        : `调用工具：${toolName}`
      const runningEvent = {
        id: `tool_${callId}`,
        type: 'tool.started',
        kind: 'tool',
        title,
        status: 'pending',
        summary: argsSummary,
        toolCallId: callId,
        toolName,
      }
      upsertTrace(runningEvent)
      emit(runningEvent)
      const cached = loopState.callCache.get(cacheKey)
      if (cached) repeatedToolCall = true
      const TOOL_EXEC_TIMEOUT_MS = 45000
      const makeToolTimeoutResult = () => ({
        ok: false,
        code: 'tool_timeout',
        message: `工具执行超时（${Math.round(TOOL_EXEC_TIMEOUT_MS / 1000)}s）`,
        text: `工具执行超时（${Math.round(TOOL_EXEC_TIMEOUT_MS / 1000)}s），请缩小查询范围或检查连接器状态后重试。`,
        preview: `工具执行超时（${Math.round(TOOL_EXEC_TIMEOUT_MS / 1000)}s）`,
      })
      // 单次执行：带等待心跳、超时与取消守卫。可被 planRetry 多次调用（网络/超时类）。
      const executeToolOnce = (attemptLabel = '') => {
        let waitTicker = 0
        let timeoutTimer = 0
        let abortListener = null
        let settled = false
        const clearToolGuards = () => {
          if (waitTicker) clearInterval(waitTicker)
          if (timeoutTimer) clearTimeout(timeoutTimer)
          if (abortListener) signal.removeEventListener('abort', abortListener)
        }
        waitTicker = setInterval(() => {
          if (settled || signal.aborted) return
          const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
          const base = argsSummary ? `${argsSummary} · 已等待 ${elapsedSec}s` : `已等待 ${elapsedSec}s`
          const summary = attemptLabel ? `${base} · ${attemptLabel}` : base
          const waitEvent = {
            id: `tool_${callId}`,
            type: 'tool.started',
            kind: 'tool',
            title,
            status: 'pending',
            summary,
            toolCallId: callId,
            toolName,
          }
          upsertTrace(waitEvent)
          emit(waitEvent)
        }, 1000)
        return Promise.race([
          toolExecutor.executeToolCall({ name: toolName, arguments: call.arguments }),
          new Promise(resolve => {
            timeoutTimer = setTimeout(() => {
              settled = true
              resolve(makeToolTimeoutResult())
            }, TOOL_EXEC_TIMEOUT_MS)
          }),
          new Promise(resolve => {
            if (!signal) return
            const onAbort = () => {
              settled = true
              resolve({
                ok: false,
                code: 'cancelled',
                message: '工具执行已取消',
                text: '工具执行已取消',
                preview: '工具执行已取消',
              })
            }
            if (signal.aborted) { onAbort(); return }
            abortListener = onAbort
            signal.addEventListener('abort', abortListener, { once: true })
          }),
        ]).then(r => { settled = true; clearToolGuards(); return r })
      }
      let result
      if (cached) {
        result = cached
      } else {
        // 可恢复错误（网络/超时）有限次指数退避重试；其余错误交给反思轮。
        let attempt = 0
        // eslint-disable-next-line no-constant-condition
        while (true) {
          result = await executeToolOnce(attempt ? `第 ${attempt} 次重试` : '')
          if (signal.aborted) break
          const category = agentRecovery.classifyToolError(result)
          const plan = agentRecovery.planRetry({ category, attempt, maxRetries: 2 })
          if (!plan.retry) break
          attempt += 1
          metrics.toolRetries = (metrics.toolRetries || 0) + 1
          await new Promise(resolve => setTimeout(resolve, plan.delayMs))
          if (signal.aborted) break
        }
      }
      if (signal.aborted) return cancelled()
      if (!cached) loopState.callCache.set(cacheKey, result)
      const durationMs = Date.now() - startedAt
      const needsPermission = agentSandbox.parseSandboxPermissionNeed(result)
      const resultEvent = {
        id: `tool_${callId}`,
        type: result.ok ? 'tool.completed' : 'tool.failed',
        kind: 'tool',
        title,
        status: result.ok ? 'done' : 'error',
        summary: result.preview || result.text,
        sources: Array.isArray(result.sources) ? result.sources : [],
        toolCallId: callId,
        toolName,
        durationMs,
        needsPermission: needsPermission || undefined,
      }
      if (toolName === 'semantic_search' && result?.meta && typeof result.meta === 'object') {
        metrics.semanticCandidateCount = Number(result.meta.candidateCount || 0)
        metrics.semanticClusterCount = Number(result.meta.clusterCount || 0)
        metrics.semanticDedupeDropped = Number(result.meta.droppedDedup || 0)
        metrics.semanticPerFileDropped = Number(result.meta.droppedPerFile || 0)
      }
      upsertTrace(resultEvent)
      emit(resultEvent)
      try {
        const isMcp = toolName.includes('.') && !toolName.startsWith('feishu.')
          ? true
          : (call && call._source === 'mcp')
        const isFeishu = toolName.startsWith('feishu.')
        const cat = isMcp ? 'mcp' : (isFeishu ? 'api' : 'operation')
        logger[isMcp ? 'mcp' : (isFeishu ? 'api' : 'operation')](
          `tool-${result.ok ? 'ok' : 'fail'}`,
          `${result.ok ? '工具完成' : '工具失败'}：${toolName}`,
          {
            tool: toolName,
            category: cat,
            code: result.code || '',
            args: validation.ok ? validation.args : null,
            preview: String(result.preview || result.text || '').slice(0, 600),
          },
          { runId, scope: 'ai-tool', level: result.ok ? 'info' : 'warn', durationMs },
        )
      } catch { /* ignore */ }
      toolMessages.push({
        role: 'tool',
        text: result.text,
        toolCallId: callId,
        toolName,
        status: result.ok ? 'done' : 'error',
        durationMs,
        args: validation.ok ? validation.args : null,
        // Preserve the authoritative missing-scope signal for just-in-time auth grounding.
        code: result.code,
        missingScopes: Array.isArray(result.missingScopes) ? result.missingScopes : undefined,
      })
      roundToolMessages.push({
        text: result.text,
        toolName,
        code: result.code,
        status: result.ok ? 'done' : 'error',
        args: validation.ok ? validation.args : null,
      })
      const modelToolText = llmRuntime.fitText(result.text, 6000, '\n…（工具结果已压缩）…\n')
      apiMessages.push({ role: 'tool', tool_call_id: callId, content: modelToolText })
      session = agentRun.upsertStep(session, resultEvent)
      if (result.ok) session = agentRun.recordTool(session, toolName)
    }

    const allRoundToolsErrored = roundToolMessages.length > 0 &&
      roundToolMessages.every(item => item.status === 'error')

    // 反思轮：本轮工具全败但错误可恢复时，注入反思提示并继续循环，
    // 让模型 Reason→Act→Observe→Reflect（修正参数 / 换工具 / 如实说明），
    // 而不是一失败就结束。预算受 MAX_RECOVERY_ROUNDS 与重复调用收敛双重保护。
    if (
      allRoundToolsErrored &&
      round < maxRounds &&
      toolCallCount < maxToolCalls &&
      agentRecovery.shouldAttemptRecovery({
        failures: roundToolMessages,
        recoveryUsed,
        maxRecovery: MAX_RECOVERY_ROUNDS,
        repeatedCall: repeatedToolCall,
      })
    ) {
      recoveryUsed += 1
      metrics.recoveryRounds = recoveryUsed
      const reflectionNote = agentRecovery.buildReflectionNote(roundToolMessages)
      if (reflectionNote) {
        apiMessages.push({ role: 'user', content: reflectionNote })
      }
      stage('stage_generate', '正在反思工具失败并尝试自我修正…', 'pending', {
        summary: `第 ${recoveryUsed} 次自我修正`,
      })
      fullText = ''
      continue
    }

    const roundMissingHint = buildMissingResourceHint(roundToolMessages)
    if (roundMissingHint && allRoundToolsErrored) {
      fullText = roundMissingHint
      stage('stage_generate', '已返回缺失资源提示', 'done', {
        fallback: true,
        summary: '工具未找到目标资源，已提示用户检查路径与产物',
      })
      break
    }
    const roundToolFailureHint = buildToolFailureHint(roundToolMessages)
    if (
      roundToolFailureHint &&
      roundToolMessages.length > 0 &&
      roundToolMessages.every(item => item.status === 'error')
    ) {
      fullText = roundToolFailureHint
      stage('stage_generate', '已返回工具失败提示', 'done', {
        fallback: true,
        summary: '工具全部失败，已直接返回纠错指引',
      })
      break
    }

    checkpointSession()
    // 仅在超预算时再压缩，尽量保持前缀稳定，提高 provider 端提示缓存命中。
    const tokensNow = llmUsage.applyCalibration(
      llmRuntime.estimateTokens(JSON.stringify(apiMessages)),
      tokenCalKey,
    )
    if (tokensNow > policy.inputBudget) {
      apiMessages = llmRuntime.fitConversation(apiMessages, policy.inputBudget).messages
      metrics.contextCompactions = (metrics.contextCompactions || 0) + 1
    }
    if (agentLoop.shouldFinalize({
      round,
      maxRounds,
      toolCallCount,
      maxToolCalls,
      repeatedCall: repeatedToolCall,
    })) {
      const planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: true,
        budgetExhausted: true,
      })
      if (planEval.action === 'expand' && tryExpandBudget('plan_incomplete')) {
        fullText = ''
        continue
      }
      const finalized = await finalizeResponse(repeatedToolCall ? 'repeated' : 'budget')
      if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
      if (!fullText.trim()) fullText = lastModelText
      const partialNote = agentVerify.buildPartialFinalizeNote(
        agentVerify.evaluatePlanCompletion(session?.run?.plan, {
          canExpand: false,
          budgetExhausted: true,
        }),
      )
      if (partialNote) {
        fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
      }
      checkpointSession(true)
      break
    }
    fullText = ''
  }

  if (!fullText.trim()) {
    const missingHint = buildMissingResourceHint(toolMessages)
    if (missingHint) {
      fullText = missingHint
      stage('stage_generate', '已返回缺失资源提示', 'done', {
        fallback: true,
        summary: '工具未找到目标资源，已提示用户检查路径与产物',
      })
    } else {
      const toolFailureHint = buildToolFailureHint(toolMessages)
      if (toolFailureHint) {
        fullText = toolFailureHint
        stage('stage_generate', '已返回工具失败提示', 'done', {
          fallback: true,
          summary: '工具失败，已提示用户修正授权或参数',
        })
      } else {
        return fail('模型未能生成可交付答复，请重试')
      }
    }
  }
  const feishuGroundingContext = await getFeishuGroundingContext()
  const feishuHint = feishuGrounding.buildFeishuGroundingHint(prompt, toolMessages, fullText, {
    ...feishuGroundingContext,
    priorFeishuFacts: hasPriorFeishuFacts(session),
  })
  if (feishuHint) {
    fullText = feishuHint
    stage('stage_generate', '已返回飞书证据校验提示', 'done', {
      fallback: true,
      summary: '缺少飞书读取证据，已阻止无依据结论',
    })
  }
  const planPartial = agentVerify.buildPartialFinalizeNote(
    agentVerify.evaluatePlanCompletion(session?.run?.plan, {
      canExpand: false,
      budgetExhausted: true,
    }),
  )
  if (planPartial && !String(fullText).includes('计划尚未全部完成')) {
    fullText = `${String(fullText || '').trim()}\n\n---\n${planPartial}`.trim()
  }
  fullText = normalizeAssistantOutput(fullText)
  if (ctxRole === 'writing' && writingWorkflow.shouldCreateWritingArtifact(fullText, writingTask)) {
    session = agentRun.addArtifact(session, writingWorkflow.buildWritingArtifact(fullText, writingTask))
  }
  for (const item of trace) session = agentRun.upsertStep(session, item)
  session.messages.push(...toolMessages, {
    role: 'assistant',
    text: fullText.slice(0, 12000),
    trace,
  })
  session.updatedAt = new Date().toISOString()
  const compacted = agentSessions.compactSession(session).session
  saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? compacted : item))
  try {
    const plan = compacted?.run?.plan
    if (plan?.items?.length) {
      emit({
        type: 'plan.updated',
        plan: {
          version: plan.version,
          updatedAt: plan.updatedAt,
          items: plan.items,
          remaining: agentRun.countPlanRemaining(plan),
        },
      })
    }
  } catch { /* ignore */ }
  productMemory.capture(MEMORY_DIR, {
    kind: 'telemetry',
    summary: '完成一次 AI 对话',
    meta: { action: 'ai-generate', toolCalls: toolCallCount },
  })
  metrics.toolCalls = toolCallCount
  const estimatedContextTokens = llmUsage.applyCalibration(
    llmRuntime.estimateTokens(JSON.stringify(apiMessages)),
    tokenCalKey,
  )
  const calNow = llmUsage.getCalibration(tokenCalKey)
  metrics.tokenCalibFactor = calNow.factor
  metrics.tokenCalibSamples = calNow.samples
  if (calNow.samples > tokenCalBefore.samples) {
    try {
      const latest = loadSettings()
      saveSettings_({
        ...latest,
        tokenCalibrations: llmUsage.exportCalibrations(),
      })
    } catch { /* ignore calibration persistence errors */ }
  }
  metrics.usage = llmUsage.reconcileUsage(estimatedContextTokens, metrics.usage?.source === 'provider' ? metrics.usage : null)
  metrics.contextTokens = metrics.usage.source === 'provider' ? metrics.usage.promptTokens : estimatedContextTokens
  metrics.totalMs = Date.now() - runStartedAt
  emit({ type: 'done', title: '执行完成', toolCalls: toolCallCount, metrics })
  return {
    text: fullText,
    streamed,
    runId,
    sessionId: session.id,
    artifacts: compacted?.run?.artifacts || [],
    toolCalls: toolCallCount,
    compacted: compacted.summary !== session.summary,
    metrics,
    personalization: {
      applied: effectivePersonalization.applied.map(item => ({
        id: item.id,
        kind: item.kind,
        text: item.text,
      })),
      omitted: effectivePersonalization.omitted,
    },
  }
  } finally {
    activeAgentRuns.delete(runId)
    try { await connectorRuntime.close() } catch { /* ignore */ }
  }
})

// ── Workbench 编排派单：无 Session 副作用的一次性 LLM 调用 ──────────────────────
ipcMain.handle('workbench-dispatch', async (e, payload = {}) => {
  const webContents = e.sender
  const s = loadSettings()
  if (!s.apiKey)      return { error: '未填写 API Key，请托盘右键 → API 设置' }
  if (!s.apiEndpoint) return { error: '未填写 API Endpoint，请托盘右键 → API 设置' }
  const prompt = String(payload.prompt || '').trim()
  if (!prompt) return { error: '空派单内容' }
  const dispatchId = String(payload.dispatchId || '')
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier: 'assist',
    prompt,
  })

  let url
  try { url = new URL(normalizeChatEndpoint(s.apiEndpoint)) } catch { return { error: `Endpoint 格式错误: ${s.apiEndpoint}` } }

  const messages = [
    { role: 'system', content: '你是 AgentTeams 工作流编排中的执行体（Worker）。严格按用户给出的角色人设与工作流节点规格产出该节点的成果，结构清晰、可执行；不越权、不臆造未提供的事实。' },
    { role: 'user', content: prompt.slice(0, 12000) },
  ]
  const chatTemp = (() => {
    const n = Number(s.temperature)
    if (!Number.isFinite(n)) return 0.6
    return Math.min(2, Math.max(0, n))
  })()
  const body = JSON.stringify({
    model: routedModel.model || 'gpt-4o-mini',
    messages,
    max_tokens: 2000,
    temperature: chatTemp,
    stream: true,
  })

  const pushChunk = (fullText) => {
    if (!webContents.isDestroyed()) webContents.send('workbench-stream-chunk', { dispatchId, text: fullText })
  }

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
      let raw = ''
      let sseBuf = ''
      let fullText = ''
      let streamed = false
      if (res.statusCode !== 200) {
        res.on('data', c => { raw += c })
        res.on('end', () => {
          try {
            const j = JSON.parse(raw)
            resolve({ error: `HTTP ${res.statusCode}: ${j.error?.message || j.message || raw.slice(0, 200)}` })
          } catch { resolve({ error: `HTTP ${res.statusCode}: ${raw.slice(0, 200)}` }) }
        })
        return
      }
      res.on('data', chunk => {
        const piece = chunk.toString()
        raw += piece
        try {
          sseBuf = parseSseLines(sseBuf + piece, delta => { fullText += delta; streamed = true; pushChunk(fullText) })
        } catch (err) { req.destroy(); resolve({ error: err.message || '流式响应解析失败' }) }
      })
      res.on('end', () => {
        if (sseBuf.trim()) {
          try { parseSseLines(sseBuf + '\n', delta => { fullText += delta; streamed = true; pushChunk(fullText) }) } catch {}
        }
        if (!fullText) {
          try {
            const j = JSON.parse(raw)
            if (j.error) { resolve({ error: j.error.message || '响应异常' }); return }
            fullText = extractChatText(j)
            if (fullText && !streamed) pushChunk(fullText)
          } catch {}
        }
        if (!fullText) { resolve({ error: `响应格式异常 (${res.statusCode})` }); return }
        resolve({ text: fullText, streamed })
      })
    })
    req.setTimeout(120000, () => { req.destroy(); resolve({ error: '请求超时（120s）' }) })
    req.on('error', err => resolve({ error: `连接失败: ${err.message}` }))
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
  const dest = path.join(filePaths[0], `knowme-backup-${new Date().toISOString().slice(0, 10)}`)
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

ipcMain.handle('open-external', async (_e, url) => {
  const raw = String(url || '').trim()
  let parsed
  try { parsed = new URL(raw) } catch { return { ok: false, message: '无效链接' } }
  const allowed = new Set(['http:', 'https:', 'mailto:', 'file:'])
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
  const res = productKnowledge.writeConcept(KNOWLEDGE_DIR, {
    id,
    title,
    body,
    frontmatter: payload.frontmatter || {},
  })
  contextCache.invalidate('skill:')
  contextCache.invalidate('kb:')
  return res
})

ipcMain.handle('list-skills', () => {
  try {
    const legacy = productKnowledge.listSkills(KNOWLEDGE_DIR)
    const hub = ensureCapabilityHub()
    const stdItems = hub.skillRuntime().listSlashPickerItems({ includeLegacy: true })
    const bySlash = new Map()
    for (const item of stdItems) {
      const slash = String(item.slash || item.id || '').trim()
      if (!slash) continue
      bySlash.set(slash, {
        id: item.id,
        title: item.name || item.id,
        slash,
        description: item.description || '',
        source: item.source,
        legacy: item.legacy === true,
      })
    }
    for (const item of legacy) {
      const slash = String(item.slash || '').trim()
      if (!slash || bySlash.has(slash)) continue
      bySlash.set(slash, item)
    }
    return { ok: true, skills: [...bySlash.values()] }
  } catch (e) {
    return { ok: false, error: e.message || String(e), skills: [] }
  }
})

ipcMain.handle('create-skill', (_e, payload = {}) => {
  try {
    const result = productKnowledge.createSkill(KNOWLEDGE_DIR, payload)
    if (result?.ok) {
      contextCache.invalidate('skill:')
      contextCache.invalidate('kb:')
    }
    return result
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
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
    ? `knowme-knowledge-${opts.categories.join('-')}-${stamp}`
    : `knowme-knowledge-${stamp}`
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
  } else {
    contextCache.invalidate('skill:')
    contextCache.invalidate('kb:')
    contextCache.invalidate('mem:')
  }
  return result
})

ipcMain.on('open-knowledge-dir', () => shell.openPath(KNOWLEDGE_DIR))
ipcMain.on('open-memory-dir', () => shell.openPath(MEMORY_DIR))
ipcMain.handle('memory-status', () => productMemory.status(MEMORY_DIR))
ipcMain.handle('memory-overview', () => productMemory.overview(MEMORY_DIR))
ipcMain.handle('memory-consolidate', () => productMemory.consolidateWorkMemory(MEMORY_DIR))
ipcMain.handle('memory-insights', (_e, payload = {}) => {
  const s = loadSettings()
  const userProfile = {
    userProfile: s.userProfile,
    userPrompt: s.userPrompt,
    industry: s.industry,
    ...(payload.userProfile || {}),
  }
  const consolidated = productMemory.getWorkMemorySummary(MEMORY_DIR, {
    consolidate: payload.consolidate !== false,
  })
  const insights = productMemory.buildMemoryInsights(MEMORY_DIR, userProfile)
  const effectivePersonalization = productMemory.buildEffectivePersonalization(MEMORY_DIR, userProfile, {
    limit: 4,
  })
  const workHints = payload.workContext
    ? productMemory.buildWorkHints(MEMORY_DIR, {
        ...payload.workContext,
        userProfile,
      })
    : null
  return { ok: true, insights, effectivePersonalization, workHints, consolidated }
})
ipcMain.handle('memory-set-learning', (_e, enabled) => ({
  ok: true,
  config: productMemory.saveConfig(MEMORY_DIR, { learningEnabled: enabled === true }),
}))
ipcMain.handle('memory-review-pattern', (_e, payload = {}) => {
  const result = productMemory.reviewPattern(
    MEMORY_DIR,
    String(payload.id || ''),
    payload.action,
    payload.summary
  )
  const summary = String(payload.summary || result.pattern?.summary || '').trim()
  if (
    result.ok &&
    payload.action === 'accepted' &&
    summary &&
    productMemory.isPatternEligible({ kind: 'preference', summary })
  ) {
    productMemory.capture(MEMORY_DIR, {
      kind: 'preference',
      summary: summary.slice(0, 300),
      meta: { source: 'memory-review', patternId: String(payload.id || '') },
    })
  }
  return result
})
ipcMain.handle('memory-clear', () => productMemory.clear(MEMORY_DIR))

// ── 日志中心 IPC ─────────────────────────────────────────────────────────────
const RENDERER_LOG_CATEGORIES = new Set(logger.CATEGORIES)
const RENDERER_LOG_LEVELS = new Set(logger.LEVELS)
ipcMain.on('app-log', (_e, payload = {}) => {
  try {
    const category = RENDERER_LOG_CATEGORIES.has(payload.category) ? payload.category : 'operation'
    const level = RENDERER_LOG_LEVELS.has(payload.level) ? payload.level : 'info'
    logger.log(
      category,
      level,
      String(payload.event || 'ui-event').slice(0, 120),
      String(payload.message || '').slice(0, 2000),
      payload.meta,
      { scope: String(payload.source || 'renderer').slice(0, 40) },
    )
  } catch { /* never throw from log intake */ }
})
ipcMain.handle('logs-query', (_e, opts = {}) => {
  const startedAt = Date.now()
  try {
    const result = logger.query(opts || {})
    const durationMs = Date.now() - startedAt
    if (durationMs >= 1800) {
      logger.warn('system', 'logs-query-slow', '日志查询耗时偏高', {
        durationMs,
        date: result.date,
        total: result.total,
        category: opts?.category || 'all',
        level: opts?.level || 'all',
      })
    }
    return { ok: true, ...result }
  } catch (err) {
    logger.error('system', 'logs-query-failed', '日志查询失败', {
      error: String(err?.message || err),
      opts,
    })
    return { ok: false, error: String(err?.message || err) }
  }
})
ipcMain.handle('logs-counts', (_e, date) => {
  try { return { ok: true, ...logger.counts(date) } }
  catch (err) {
    logger.error('system', 'logs-counts-failed', '日志分类统计失败', {
      error: String(err?.message || err),
      date,
    })
    return { ok: false, error: String(err?.message || err) }
  }
})
ipcMain.handle('logs-clear', (_e, date) => {
  try {
    const res = logger.clear(date)
    logger.operation('logs-clear', '清空日志', { date: date || 'all', removed: res.removed })
    return res
  } catch (err) { return { ok: false, error: String(err?.message || err) } }
})
ipcMain.on('open-logs-window', () => {
  logger.operation('logs-window-open', '打开日志中心')
  openLogViewer()
})
ipcMain.on('open-logs-dir', () => {
  const dir = logger.getLogDir() || LOGS_DIR
  logger.operation('logs-dir-open', '打开日志目录', { dir })
  shell.openPath(dir)
})

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
    try {
      const hub = ensureCapabilityHub()
      hub.migrateConnectorsIfNeeded()
      hub.registerIpcHandlers({ showOpenDialog: showOpenDialogFor })
    } catch (err) {
      console.error('[capability-hub]', err?.stack || err)
    }
    try { knowledgeOs.ensureDirs(app.getPath('userData')) } catch { /* */ }
    productMemory.ensureMemory(MEMORY_DIR)
    purgeEmptyClosedNotes()
    tray = new Tray(makeTrayIcon())
    tray.setToolTip(`${APP_DISPLAY_NAME}  左键显示/隐藏 · 右键菜单`)
    tray.on('click', toggleAppVisibility)
    tray.on('double-click', () => restoreAppWindows())
    updateTray()
    globalShortcut.register('CmdOrCtrl+Alt+N', newNote)
    globalShortcut.register('CmdOrCtrl+Alt+L', () => createWorkspaceWindow())
    settingsSecure.stripPlaintextApiKey(SETTINGS_FILE)
    if (process.argv.includes('--dev') && PROMPT_SPACE_DIR && !fs.existsSync(PROMPT_SPACE_IMPORT_FLAG)) {
      const result = importPromptSpace()
      try { fs.writeFileSync(PROMPT_SPACE_IMPORT_FLAG, JSON.stringify(result, null, 2), 'utf8') } catch {}
    }
    if (!handleLaunchArgs(process.argv)) {
      createWorkspaceWindow()
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
  try { logger.error('system', 'uncaught-exception', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) }) } catch { /* ignore */ }
})
process.on('unhandledRejection', err => {
  console.error('[unhandled]', err?.stack || err)
  try { logger.error('system', 'unhandled-rejection', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) }) } catch { /* ignore */ }
})
app.on('child-process-gone', (_event, details) => {
  const type = String(details?.type || '')
  if (type === 'GPU' || type === 'Utility') {
    console.error('[child-process-gone]', details)
    try { logger.error('system', 'child-process-gone', `${type} 子进程退出`, { reason: details?.reason, exitCode: details?.exitCode }) } catch { /* ignore */ }
  }
})
