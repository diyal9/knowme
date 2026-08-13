'use strict'
/* 工作台壳：项目/文件树 + 标签页 + 分屏（editor-pane.html iframe）+ 一级整页与居中二级弹窗。 */

function mountIcons(root) { if (window.StickyIcons) StickyIcons.mount(root || document) }

const treeEl = document.getElementById('tree')
const searchEl = document.getElementById('search')
const drawer = document.getElementById('drawer')
const drawerBackdrop = document.getElementById('drawerBackdrop')
const drawerTitle = document.getElementById('drawerTitle')
const drawerBody = document.getElementById('drawerBody')
const drawerSurfaceTabs = document.getElementById('drawerSurfaceTabs')
const toastWrap = document.getElementById('toastWrap')
const toastEl = document.getElementById('toast')

let data = {
  notes: [],
  groups: [],
  state: null,
  sources: [],
  activeSourceId: null,
  fileTree: null,
  generatedArtifacts: [],
}
let collapsed = new Set()
/** 内容源目录折叠状态；键为 sourceId:path，避免不同源的同名目录冲突 */
let sourceCollapsed = new Set()
/** 已按需加载过子项的目录；键为 sourceId:path（根层用 sourceId:） */
let sourceLoadedDirs = new Set()
/** 单层子项加载中，避免重复请求 */
let sourceLoadingDirs = new Set()
/** 目录层截断提示：sourceId:path -> true */
let sourceTruncatedDirs = new Set()
/** 已展开的版本链（存链根 id） */
let expandedChains = new Set()
/** 聚焦的项目 key；null = 显示全部项目 */
let focusedProject = null
/** 侧栏模式：sources（内容源文件）| notes（遗留便签） */
let treeMode = 'sources'
/** 文件中心分层：hub（源中心）| tree（当前源文件树） */
let fileCenterLayer = 'tree'
/** 左侧文件栏是否收起（Obsidian ribbon 开关）；Agent 模式默认收起 */
let sideCollapsed = true
/** 工作区模式：agent（默认）| edit */
let workspaceMode = 'agent'
/** 工作台模式：一级首页全宽，任务启动后进入协作工作间 */
let workbenchOn = false
/** 自动化中心：独立于工作台首页/任务工作间 */
let workbenchAutomationOn = false
let workbenchTaskActive = false
let workbenchPage = 'home'
let workbenchTaskContextKind = ''
/** 共用面板类型：'', 'secondary', 'knowledge', 'settings', 'capability-hub' */
let drawerKind = ''
let drawerReturnFocus = null
/** Capability Hub 当前 Tab：experts | skills | connectors */
let capabilityHubTab = 'experts'
/** 关闭专家库后保留 iframe，避免二次打开冷启动 */
let capabilityHubPark = null
const KNOWLEDGE_SURFACE_TABS = [
  { id: 'status', label: '我的知识' },
  { id: 'review', label: '待我确认' },
  { id: 'connect', label: '来源' },
]
const KNOWLEDGE_SURFACE_PRIMARY_TAB_IDS = new Set(KNOWLEDGE_SURFACE_TABS.map(tab => tab.id))
const KNOWLEDGE_SURFACE_ROUTE_ALIASES = {
  sources: 'connect',
}
const KNOWLEDGE_SURFACE_SECONDARY_ROUTES = new Set([
  'browse',
  'health',
  'organize',
  'retrieve',
  'fabric',
  'governance',
])
function normalizeKnowledgeSurfaceRoute(tab) {
  const key = String(tab || '').trim()
  if (!key) return 'status'
  if (KNOWLEDGE_SURFACE_PRIMARY_TAB_IDS.has(key)) return key
  const aliased = KNOWLEDGE_SURFACE_ROUTE_ALIASES[key]
  if (aliased) return aliased
  if (KNOWLEDGE_SURFACE_SECONDARY_ROUTES.has(key)) return key
  return 'status'
}
function primaryKnowledgeSurfaceTab(route) {
  const normalized = normalizeKnowledgeSurfaceRoute(route)
  if (KNOWLEDGE_SURFACE_PRIMARY_TAB_IDS.has(normalized)) return normalized
  if (normalized === 'browse') return 'status'
  if (normalized === 'health' || normalized === 'organize') return 'status'
  if (normalized === 'fabric' || normalized === 'retrieve' || normalized === 'governance') return 'status'
  return 'status'
}
const SETTINGS_SURFACE_TABS = [
  { id: 'sources', label: '内容源' },
  { id: 'ai', label: 'AI 接口' },
  { id: 'assistant', label: '助手模式' },
  { id: 'system', label: '系统配置' },
  { id: 'connectors', label: '连接器' },
  { id: 'memory', label: '我的记忆' },
  { id: 'about', label: '关于' },
]
const SETTINGS_SURFACE_TAB_IDS = new Set(SETTINGS_SURFACE_TABS.map(tab => tab.id))
let settingsSurfaceTab = 'sources'
/** 进入 Agent 前文件栏是否收起（切回编辑时恢复） */
let sideCollapsedBeforeAgent = false
let splitOn = false
let activePane = 'left'
const panes = {
  left: { tabs: [], active: null, iframe: null, ready: false, pending: null },
  right: { tabs: [], active: null, iframe: null, ready: false, pending: null },
}

window.addEventListener('error', (event) => {
  try {
    console.error('[workspace-runtime-error]', event?.message || 'unknown', `${event?.filename || 'unknown'}:${event?.lineno || 0}`)
  } catch { /* noop */ }
})
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event?.reason
    console.error('[workspace-unhandled-rejection]', reason?.stack || reason?.message || String(reason || 'unknown'))
  } catch { /* noop */ }
})

function toast(msg, type = 'info', ms = 2600) {
  toastEl.textContent = msg
  toastWrap.className = 'toast-wrap show' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => { toastWrap.className = 'toast-wrap' }, ms)
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function noteById(id) { return data.notes.find(n => n.id === id) }
function fileLabel(n) {
  return (n.title || '').trim() || (n.preview || '').trim() || (n.project || '').trim() || '未命名'
}
function projectKeyOf(n) {
  return (n && (n.project || '').trim()) || '__uncat__'
}
function relTime(iso) {
  const t = new Date(iso || 0).getTime()
  if (!t) return ''
  const d = Date.now() - t
  if (d < 60e3) return '刚刚'
  if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前'
  if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前'
  if (d < 2 * 86400e3) return '昨天'
  if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + ' 天前'
  try { return new Date(t).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) } catch { return '' }
}

function formatDateTime(iso) {
  const t = new Date(iso || 0).getTime()
  if (!t) return ''
  try {
    return new Date(t).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function sourceWorkspaceAddress(src) {
  if (!src) return ''
  if (src.type === 'gitlab') {
    if (src.remoteUrl) return src.remoteUrl.replace(/\.git$/i, '')
    if (src.host && src.projectPath) return `${String(src.host).replace(/\/+$/, '')}/${String(src.projectPath).replace(/^\/+/, '')}`
  }
  if (src.type === 'github') return src.remoteUrl ? src.remoteUrl.replace(/\.git$/i, '') : ''
  if (src.type === 'web') return src.pageUrl || src.remoteUrl || ''
  return src.rootPath || ''
}

function sourceWorkspaceOpenTarget(src) {
  if (!src) return ''
  const addr = sourceWorkspaceAddress(src)
  if ((src.type === 'gitlab' || src.type === 'github' || src.type === 'web') && /^https?:\/\//i.test(addr)) return addr
  return src.rootPath || ''
}

function sourceKindLabel(src) {
  if (!src) return ''
  if (src.type === 'gitlab') return 'GitLab 仓库'
  if (src.type === 'github') return 'GitHub 仓库'
  if (src.type === 'web') return '网页资料'
  return '本地目录'
}

function artifactStatusLabel(status) {
  return window.FileCenterModel?.artifactStatusLabel?.(status)
    || ({ draft: '待确认', accepted: '已接受', rejected: '已拒绝' }[status] || '草稿')
}

async function hydrateGeneratedArtifacts() {
  if (!window.api?.agentSessionList) return
  try {
    const result = await window.api.agentSessionList()
    data.generatedArtifacts = window.FileCenterModel?.collectGeneratedArtifacts
      ? window.FileCenterModel.collectGeneratedArtifacts(result?.sessions || [], 8)
      : []
  } catch {
    data.generatedArtifacts = []
  }
}

async function openGeneratedArtifact(sessionId, artifactId) {
  openAgentChat()
  const opened = await window.WorkspaceAgent?.openArtifact?.(sessionId, artifactId)
  if (!opened) toast('无法打开该生成产物，请从助手历史中查看', 'error')
}

function sourceWorkspaceOpenHint(src) {
  if (!src) return '打开工作空间'
  if (src.type === 'gitlab') return '打开 GitLab 仓库'
  if (src.type === 'github') return '打开 GitHub 仓库'
  if (src.type === 'web') return '打开原网页'
  return '打开本地目录'
}

// ── 版本链折叠 ──────────────────────────────────────────────
function buildChains(items) {
  const byId = new Map(items.map(n => [n.id, n]))
  const rootOf = (n) => {
    let cur = n, guard = 0
    while (cur.parentNoteId && byId.has(cur.parentNoteId) && guard++ < 50) cur = byId.get(cur.parentNoteId)
    return cur.id
  }
  const chains = new Map()
  for (const n of items) {
    const r = rootOf(n)
    if (!chains.has(r)) chains.set(r, [])
    chains.get(r).push(n)
  }
  const out = []
  for (const [, arr] of chains) {
    arr.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    out.push(arr)
  }
  out.sort((a, b) => new Date(b[0].updatedAt || 0) - new Date(a[0].updatedAt || 0))
  return out
}

/** 全量笔记中找版本链根（跨分组打开时也能展开） */
function chainRootId(note) {
  if (!note) return null
  const byId = new Map(data.notes.map(n => [n.id, n]))
  let cur = note, guard = 0
  while (cur.parentNoteId && byId.has(cur.parentNoteId) && guard++ < 50) cur = byId.get(cur.parentNoteId)
  return cur.id
}

function toggleChainExpand(rootId) {
  if (!rootId) return
  if (expandedChains.has(rootId)) expandedChains.delete(rootId)
  else expandedChains.add(rootId)
  saveState()
  renderTree()
}

function renderChainRow(chain) {
  const head = chain[0]
  const rootId = chainRootId(head) || head.id
  const multi = chain.length > 1
  const isOpen = multi && expandedChains.has(rootId)
  const anyActive = chain.some(c => isTabActiveAnywhere(c.id))
  const headIsActive = isTabActiveAnywhere(head.id)
  let headCls = ''
  if (isOpen) {
    if (anyActive) headCls = ' current'
  } else if (headIsActive) {
    headCls = ' active'
  } else if (anyActive) {
    headCls = ' current'
  }
  const star = head.favorite ? '<span class="ico file-star" data-icon="starLine" title="已收藏"></span>' : ''
  const ver = `<span class="file-ver"${multi ? ` data-twist-ver="${esc(rootId)}" title="展开版本"` : ''}>v${esc(head.version || '0.1')}</span>`
  const twist = multi
    ? `<button type="button" class="tree-twist" data-twist="${esc(rootId)}" aria-expanded="${isOpen ? 'true' : 'false'}" title="${isOpen ? '收起版本' : '展开版本'}">
        <span class="ico chev" data-icon="chevronTree"></span>
      </button>`
    : '<span class="tree-gutter" aria-hidden="true"></span>'

  let html = `<div class="file-chain${isOpen ? ' open' : ''}${multi ? ' multi' : ''}" data-root="${esc(rootId)}">
    <div class="file head${headCls}" data-id="${head.id}">
      ${twist}
      <span class="ico file-ico" data-icon="file"></span>
      <span class="file-name">${esc(fileLabel(head))}</span>
      ${star}${ver}
    </div>`

  if (multi && isOpen) {
    html += `<div class="file-vers" role="group" aria-label="版本列表">` + chain.map(c => {
      const a = isTabActiveAnywhere(c.id) ? ' active' : ''
      const time = relTime(c.updatedAt)
      return `<div class="file ver${a}" data-id="${c.id}">
        <span class="tree-gutter" aria-hidden="true"></span>
        <span class="ver-label">v${esc(c.version || '0.1')}</span>
        ${time ? `<span class="ver-time">${esc(time)}</span>` : ''}
      </div>`
    }).join('') + `</div>`
  }
  return html + `</div>`
}

function renderTree() {
  if (treeMode === 'sources') {
    renderSourceTree()
    return
  }
  const q = (searchEl.value || '').trim().toLowerCase()
  const match = (n) => !q || (fileLabel(n).toLowerCase().includes(q) || (n.preview || '').toLowerCase().includes(q) || String(n.version || '').toLowerCase().includes(q) || (n.project || '').toLowerCase().includes(q))
  const groups = []
  const inFocus = (n) => !focusedProject || projectKeyOf(n) === focusedProject

  if (!focusedProject) {
    const favItems = data.notes.filter(n => n.favorite && match(n))
    if (favItems.length) groups.push({ key: '__fav__', label: '收藏', items: favItems, fav: true })
  }
  for (const g of data.groups) {
    if (focusedProject && g.key !== focusedProject) continue
    const items = g.items.filter(n => match(n) && inFocus(n))
    if (items.length || focusedProject === g.key) groups.push({ key: g.key, label: g.label, items, fav: false })
  }
  updateProjectChrome()
  if (!groups.length) {
    treeEl.innerHTML = q
      ? '<div class="tree-empty">没有匹配的文件。<br>试试其他关键词。</div>'
      : focusedProject
        ? '<div class="tree-empty">该项目还没有文件。<br>点右上角 + 新建一个。</div>'
        : '<div class="tree-empty">还没有内容源。<br>打开设置 → 内容源，添加本地文件夹或 GitLab。</div>'
    return
  }

  treeEl.innerHTML = groups.map(g => {
    const isCol = !focusedProject && collapsed.has(g.key)
    const chains = buildChains(g.items)
    const rows = chains.map(renderChainRow).join('')
    const count = chains.length
    return `<div class="grp${isCol ? ' collapsed' : ''}${g.fav ? ' fav' : ''}${focusedProject === g.key ? ' focused' : ''}" data-key="${esc(g.key)}">
      <div class="grp-head" data-grp="${esc(g.key)}" title="展开 / 折叠">
        <span class="ico chev" data-icon="chevronTree" aria-hidden="true"></span>
        <span class="ico grp-folder" data-icon="${g.fav ? 'starLine' : 'folder'}" aria-hidden="true"></span>
        <span class="grp-label">${esc(g.label)}</span>
        <span class="grp-count">${count}</span>
      </div>
      <div class="grp-items">${rows || '<div class="tree-empty tiny">暂无文件</div>'}</div>
    </div>`
  }).join('')
  mountIcons(treeEl)
}

function activeSource() {
  return (data.sources || []).find(s => s.id === data.activeSourceId) || data.sources?.[0] || null
}

function sourceDirKey(sourceId, relPath) {
  return `${sourceId}:${relPath}`
}

function sourceAncestorPaths(relPath) {
  const parts = String(relPath || '').split('/').filter(Boolean)
  const out = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

function isUnderSourcePath(parentPath, childPath) {
  if (!parentPath) return !!childPath
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`)
}

function seedUnloadedDirsCollapsed(sourceId, nodes) {
  for (const node of nodes || []) {
    if (node.type !== 'dir') continue
    const key = sourceDirKey(sourceId, node.path)
    if (!sourceLoadedDirs.has(key)) sourceCollapsed.add(key)
  }
}

function mergeSourceChildren(sourceId, parentPath, children, truncated) {
  if (!data.fileTree) data.fileTree = { ok: true, nodes: [], lazy: true, truncated: false }
  const parent = String(parentPath || '')
  if (!parent) {
    data.fileTree.nodes = Array.isArray(children) ? children.slice() : []
  } else {
    const next = (data.fileTree.nodes || []).filter(n => n.path === parent || !isUnderSourcePath(parent, n.path))
    const idx = next.findIndex(n => n.path === parent)
    const insertAt = idx >= 0 ? idx + 1 : next.length
    next.splice(insertAt, 0, ...(children || []))
    data.fileTree.nodes = next
  }
  data.fileTree.lazy = true
  const truncKey = sourceDirKey(sourceId, parent)
  if (truncated) sourceTruncatedDirs.add(truncKey)
  else sourceTruncatedDirs.delete(truncKey)
  data.fileTree.truncated = sourceTruncatedDirs.size > 0
  seedUnloadedDirsCollapsed(sourceId, children)
}

async function ensureSourceDirLoaded(sourceId, relPath) {
  const key = sourceDirKey(sourceId, relPath || '')
  if (sourceLoadedDirs.has(key) || sourceLoadingDirs.has(key)) return
  if (!window.api?.sourcesTreeChildren) return
  sourceLoadingDirs.add(key)
  try {
    const res = await window.api.sourcesTreeChildren({ sourceId, path: relPath || '' })
    if (!res || !res.ok) {
      toast((res && res.error) || '加载目录失败', 'error')
      return
    }
    if (data.activeSourceId !== sourceId) return
    mergeSourceChildren(sourceId, relPath || '', res.nodes || [], !!res.truncated)
    sourceLoadedDirs.add(key)
    renderTree()
  } catch (e) {
    toast(e.message || '加载目录失败', 'error')
  } finally {
    sourceLoadingDirs.delete(key)
  }
}

function resetSourceLazyState(fileTree, sourceId) {
  sourceLoadedDirs = new Set()
  sourceLoadingDirs = new Set()
  sourceTruncatedDirs = new Set()
  if (sourceId) sourceLoadedDirs.add(sourceDirKey(sourceId, ''))
  if (fileTree?.truncated && sourceId) sourceTruncatedDirs.add(sourceDirKey(sourceId, ''))
  if (sourceId && fileTree?.lazy) seedUnloadedDirsCollapsed(sourceId, fileTree.nodes)
}

function showFileCenterHub() {
  fileCenterLayer = 'hub'
  renderTree()
}

function showFileCenterTree() {
  fileCenterLayer = 'tree'
  renderTree()
}

function resolveFileCenterLayer(src) {
  if (!src) return 'hub'
  return fileCenterLayer === 'hub' ? 'hub' : 'tree'
}

function openActiveWorkspace() {
  const src = activeSource()
  if (!src) return
  const target = sourceWorkspaceOpenTarget(src)
  if (/^https?:\/\//i.test(target)) {
    window.api.openExternal(target).catch(() => {})
    return
  }
  window.api.sourcesOpenRoot(src.id).catch(() => {})
}

function syncFileCenterChrome(layer, src) {
  const setHidden = (id, hidden) => {
    const el = document.getElementById(id)
    if (el) el.hidden = !!hidden
  }
  const inSources = treeMode === 'sources'
  const onTree = inSources && layer === 'tree' && !!src
  const onHub = inSources && layer === 'hub'
  setHidden('btnOpenWorkspace', !onTree)
  setHidden('btnSwitchSource', !onTree)
  setHidden('btnAddSource', !onHub)
  setHidden('btnSourceSettings', !onHub)
  setHidden('btnRefreshSources', !inSources)
  setHidden('btnCollapseAll', true)
  setHidden('fileActionsWrap', true)
  const openBtn = document.getElementById('btnOpenWorkspace')
  if (openBtn && src) {
    openBtn.title = sourceWorkspaceOpenHint(src)
  }
}

function renderSourceTree() {
  const src = activeSource()
  const layer = resolveFileCenterLayer(src)
  const titleEl = document.getElementById('sideTitle')
  const backBtn = document.getElementById('btnProjectBack')
  const q = (searchEl.value || '').trim().toLowerCase()
  if (searchEl) searchEl.placeholder = layer === 'hub' ? '搜索源或生成…' : '搜索文件...'
  if (titleEl) {
    titleEl.textContent = layer === 'hub' ? '我的空间' : ''
  }
  if (backBtn) {
    const showBack = layer === 'tree' && !!src
    backBtn.hidden = !showBack
    backBtn.title = '返回我的空间'
    backBtn.setAttribute('aria-label', '返回我的空间')
  }
  syncFileCenterChrome(layer, src)

  const workspaceAddress = sourceWorkspaceAddress(src)
  const workspaceMeta = src
    ? `${sourceKindLabel(src)}${src.branch ? ` · ${src.branch}` : ''}`
    : ''
  const allSources = data.sources || []
  const matchSource = s => !q
    || String(s.displayName || '').toLowerCase().includes(q)
    || String(s.rootPath || '').toLowerCase().includes(q)
    || sourceKindLabel(s).toLowerCase().includes(q)
  const gitSources = allSources.filter(s => (s.type === 'gitlab' || s.type === 'github') && matchSource(s))
  const webSources = allSources.filter(s => s.type === 'web' && matchSource(s))
  const workspaceSources = allSources.filter(s => s.type === 'local' && matchSource(s))
  const renderSourceRows = (sources, emptyText) => {
    if (!sources.length) return `<div class="source-empty">${esc(emptyText)}</div>`
    return sources.map(s => {
      const on = src && s.id === src.id
      const kind = sourceKindLabel(s)
      const meta = (s.type === 'gitlab' || s.type === 'github')
        ? `${kind}${s.branch ? ` · ${s.branch}` : ''}`
        : kind
      return `<div class="file head source-pick-row${on ? ' active' : ''}" data-source-pick="${esc(s.id)}" title="${esc(s.rootPath)}">
        <span class="tree-gutter" aria-hidden="true"></span>
        <span class="ico file-ico" data-icon="folder"></span>
        <span class="file-name">${esc(s.displayName)}</span>
        <span class="file-meta">${esc(meta)}</span>
      </div>`
    }).join('')
  }
  const generatedItems = (data.generatedArtifacts || []).filter(item => {
    if (!q) return true
    const hay = [item.title, item.sessionTitle, item.targetPath].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
  const generatedRows = generatedItems.length
    ? generatedItems.map(item => {
        const meta = window.FileCenterModel?.artifactMetaLabel?.(item) || artifactStatusLabel(item.status)
        const updated = relTime(item.updatedAt)
        const suffix = updated ? ` · ${updated}` : ''
        const title = [item.sessionTitle, item.targetPath].filter(Boolean).join('\n')
        return `<div class="file head generated-artifact-row" data-generated-session="${esc(item.sessionId)}" data-generated-id="${esc(item.id)}" title="${esc(title)}">
          <span class="tree-gutter" aria-hidden="true"></span>
          <span class="ico file-ico" data-icon="file"></span>
          <span class="file-name">${esc(item.title)}</span>
          <span class="file-meta">${esc(meta + suffix)}</span>
        </div>`
      }).join('')
    : `<div class="source-empty">${q ? '没有匹配的生成产物' : '暂无生成产物'}</div>`

  if (layer === 'hub') {
    const sourcesBar = `<div class="grp source-top source-hub" style="margin-bottom:6px">
      <div class="source-section file-center-section">
        <div class="source-section-head">
          <span class="source-section-title">个人知识库</span>
        </div>
        <button type="button" class="file head source-entry" data-open-knowledge-center title="打开本地卡帕西 Wiki">
          <span class="tree-gutter" aria-hidden="true"></span>
          <span class="ico file-ico" data-icon="bookOpen"></span>
          <span class="file-name">本地知识库</span>
          <span class="file-meta">第二大脑</span>
        </button>
      </div>
      <div class="source-section">
        <div class="source-section-head">
          <span class="source-section-title">代码仓库</span>
          <button type="button" class="source-manage-btn" data-open-source-settings="sources">管理</button>
        </div>
        <div class="grp-items source-pick-list">${renderSourceRows(gitSources, q ? '没有匹配的仓库' : '暂无 GitLab / GitHub 仓库')}</div>
      </div>
      <div class="source-section">
        <div class="source-section-head">
          <span class="source-section-title">网页资料</span>
        </div>
        <div class="grp-items source-pick-list">${renderSourceRows(webSources, q ? '没有匹配的网页资料' : '暂无网页资料')}</div>
      </div>
      <div class="source-section">
        <div class="source-section-head">
          <span class="source-section-title">其他本地目录</span>
        </div>
        <div class="grp-items source-pick-list">${renderSourceRows(workspaceSources, q ? '没有匹配的本地目录' : '暂无本地目录')}</div>
      </div>
      <div class="source-section">
        <div class="source-section-head">
          <span class="source-section-title">AI 生成</span>
          <span class="source-section-caption">最近 8 项</span>
        </div>
        <div class="grp-items source-pick-list">${generatedRows}</div>
      </div>
    </div>`
    const guide = src
      ? ''
      : '<div class="tree-empty">当前没有选中的内容源。<br>可从代码仓库、网页资料或本地目录中选择。</div>'
    treeEl.innerHTML = sourcesBar + guide
    mountIcons(treeEl)
    return
  }

  const switcher = `<div class="source-switcher" title="${esc(workspaceAddress || src.displayName || '')}">
    <div class="source-switcher-text">
      <span class="source-switcher-name">${esc(src.displayName || '未命名目录')}</span>
      <span class="source-switcher-meta">${esc(workspaceMeta)}</span>
    </div>
  </div>`

  const nodes = (data.fileTree && data.fileTree.nodes) || []
  let searchPaths = null
  if (q) {
    searchPaths = new Set()
    for (const node of nodes) {
      if (!node.path.toLowerCase().includes(q) && !node.name.toLowerCase().includes(q)) continue
      searchPaths.add(node.path)
      for (const ancestor of sourceAncestorPaths(node.path)) searchPaths.add(ancestor)
    }
  }
  const visibleNodes = nodes.filter(node => {
    if (searchPaths) return searchPaths.has(node.path)
    return !sourceAncestorPaths(node.path).some(path => sourceCollapsed.has(sourceDirKey(src.id, path)))
  })
  if (!visibleNodes.length) {
    treeEl.innerHTML = switcher + (q
      ? '<div class="tree-empty">没有匹配的文件。</div>'
      : '<div class="tree-empty">此源下暂无文本文件。<br>可在资源管理器中放入 Markdown 等。</div>')
    mountIcons(treeEl)
    return
  }

  const rows = visibleNodes.map(node => {
    const pad = Math.min(node.depth || 0, 8) * 12
    if (node.type === 'dir') {
      const isOpen = q || !sourceCollapsed.has(sourceDirKey(src.id, node.path))
      return `<div class="file source-dir${isOpen ? ' open' : ''}" data-src-dir="${esc(node.path)}" data-source-id="${esc(src.id)}" style="padding-left:${pad}px" title="${esc(node.path)}">
        <button type="button" class="tree-twist" aria-expanded="${isOpen ? 'true' : 'false'}" title="${isOpen ? '收起目录' : '展开目录'}">
          <span class="ico chev" data-icon="chevronTree"></span>
        </button>
        <span class="ico file-ico" data-icon="folder"></span>
        <span class="file-name">${esc(node.name)}</span>
      </div>`
    }
    const id = `fs:${src.id}:${node.path}`
    const active = isTabActiveAnywhere(id) ? ' active' : ''
    return `<div class="file head${active}" data-fs-id="${esc(id)}" data-source-id="${esc(src.id)}" data-rel="${esc(node.path)}" style="padding-left:${pad}px" title="${esc(node.path)}">
      <span class="tree-gutter" aria-hidden="true"></span>
      <span class="ico file-ico" data-icon="file"></span>
      <span class="file-name">${esc(node.name)}</span>
    </div>`
  }).join('')

  const trunc = data.fileTree?.truncated ? '<div class="tree-empty tiny">部分目录子项过多，已截断</div>' : ''
  treeEl.innerHTML = `${switcher}<div class="grp source-tree-list"><div class="grp-items">${rows}</div>${trunc}</div>`
  mountIcons(treeEl)
}

function updateProjectChrome() {
  const titleEl = document.getElementById('sideTitle')
  const backBtn = document.getElementById('btnProjectBack')
  if (!titleEl || !backBtn) return
  if (focusedProject) {
    const g = data.groups.find(x => x.key === focusedProject)
    titleEl.textContent = g ? g.label : (focusedProject === '__uncat__' ? '未分类' : focusedProject)
    backBtn.hidden = false
  } else {
    titleEl.textContent = ''
    backBtn.hidden = true
  }
}

function focusProject(key) {
  if (!key || key === '__fav__') return
  focusedProject = key
  collapsed.delete(key)
  saveState()
  renderTree()
}

function clearProjectFocus() {
  focusedProject = null
  saveState()
  renderTree()
}

function isTabActiveAnywhere(id) {
  return (panes.left.active === id) || (splitOn && panes.right.active === id)
}

treeEl.addEventListener('click', e => {
  const hubSwitch = e.target.closest('[data-file-center-hub]')
  if (hubSwitch) {
    e.preventDefault()
    e.stopPropagation()
    showFileCenterHub()
    return
  }
  const knowledgeEntry = e.target.closest('[data-open-knowledge-center]')
  if (knowledgeEntry) {
    e.preventDefault()
    e.stopPropagation()
    openKnowledgeOsPanel()
    return
  }
  const generatedArtifact = e.target.closest('[data-generated-session][data-generated-id]')
  if (generatedArtifact) {
    e.preventDefault()
    e.stopPropagation()
    openGeneratedArtifact(
      generatedArtifact.dataset.generatedSession,
      generatedArtifact.dataset.generatedId,
    )
    return
  }
  const workspaceOpen = e.target.closest('[data-open-workspace]')
  if (workspaceOpen) {
    e.preventDefault()
    e.stopPropagation()
    const target = String(workspaceOpen.dataset.openWorkspace || '')
    const sourceId = String(workspaceOpen.dataset.sourceId || '')
    if (/^https?:\/\//i.test(target)) {
      window.api.openExternal(target).catch(() => {})
    } else if (sourceId) {
      window.api.sourcesOpenRoot(sourceId).catch(() => {})
    }
    return
  }
  const openSourceSettings = e.target.closest('[data-open-source-settings]')
  if (openSourceSettings) {
    e.preventDefault()
    e.stopPropagation()
    openSettingsPanel(String(openSourceSettings.dataset.openSourceSettings || 'sources'))
    return
  }
  const srcPick = e.target.closest('[data-source-pick]')
  if (srcPick && srcPick.dataset.sourcePick) {
    fileCenterLayer = 'tree'
    window.api.sourcesSetActive(srcPick.dataset.sourcePick).then(() => reload())
    return
  }
  const sourceDir = e.target.closest('[data-src-dir]')
  if (sourceDir) {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = sourceDir.dataset.sourceId
    const rel = sourceDir.dataset.srcDir || ''
    const key = sourceDirKey(sourceId, rel)
    if (sourceCollapsed.has(key)) {
      sourceCollapsed.delete(key)
      saveState()
      renderTree()
      ensureSourceDirLoaded(sourceId, rel)
    } else {
      sourceCollapsed.add(key)
      saveState()
      renderTree()
    }
    return
  }
  const fsRow = e.target.closest('[data-fs-id]')
  if (fsRow) {
    openFsFile(fsRow.dataset.fsId, fsRow.dataset.sourceId, fsRow.dataset.rel, activePane)
    return
  }
  const twist = e.target.closest('[data-twist], [data-twist-ver]')
  if (twist) {
    e.preventDefault()
    e.stopPropagation()
    toggleChainExpand(twist.dataset.twist || twist.dataset.twistVer)
    return
  }
  const grp = e.target.closest('[data-grp]')
  if (grp) {
    // Obsidian：点文件夹只就地展开/折叠，不进入「单项目」第二层
    if (focusedProject) clearProjectFocus()
    const k = grp.dataset.grp
    if (collapsed.has(k)) collapsed.delete(k)
    else collapsed.add(k)
    saveState()
    renderTree()
    return
  }
  const file = e.target.closest('.file[data-id]')
  if (file) openFile(file.dataset.id, activePane)
})
searchEl.addEventListener('input', renderTree)
document.getElementById('btnProjectBack')?.addEventListener('click', () => {
  if (treeMode === 'sources') {
    showFileCenterHub()
    return
  }
  clearProjectFocus()
})
document.getElementById('btnSwitchSource')?.addEventListener('click', () => {
  showFileCenterHub()
})
document.getElementById('btnOpenWorkspace')?.addEventListener('click', () => {
  openActiveWorkspace()
})
document.getElementById('btnAddSource')?.addEventListener('click', () => openSettingsPanel('sources'))
document.getElementById('btnSourceSettings')?.addEventListener('click', () => openSettingsPanel('sources'))
document.getElementById('btnRefreshSources')?.addEventListener('click', async e => {
  const btn = e.currentTarget
  if (btn.disabled) return
  btn.disabled = true
  try {
    await reload()
    await hydrateGeneratedArtifacts()
    renderTree()
    toast('文件中心已刷新', 'success')
  } finally {
    btn.disabled = false
  }
})
const fileActionMenu = document.getElementById('editorFileActions')
document.getElementById('btnFileActions')?.addEventListener('click', e => {
  e.stopPropagation()
  const open = fileActionMenu?.hidden
  if (!fileActionMenu) return
  fileActionMenu.hidden = !open
  e.currentTarget.setAttribute('aria-expanded', String(open))
})
document.addEventListener('click', e => {
  if (!e.target.closest('.side-action-menu-wrap')) {
    if (fileActionMenu) fileActionMenu.hidden = true
    document.getElementById('btnFileActions')?.setAttribute('aria-expanded', 'false')
  }
})
document.getElementById('btnCollapseAll')?.addEventListener('click', () => {
  if (treeMode === 'sources') {
    const src = activeSource()
    if (src) {
      for (const node of (data.fileTree?.nodes || [])) {
        if (node.type === 'dir') sourceCollapsed.add(sourceDirKey(src.id, node.path))
      }
    }
    saveState()
    renderTree()
    return
  }
  for (const g of data.groups) collapsed.add(g.key)
  collapsed.add('__fav__')
  expandedChains.clear()
  if (focusedProject) focusedProject = null
  saveState()
  renderTree()
})

function applySideCollapsed() {
  const shell = document.getElementById('appShell')
  const btn = document.getElementById('btnToggleSide')
  if (shell) shell.classList.toggle('side-collapsed', sideCollapsed)
  if (btn) {
    btn.classList.toggle('active', !sideCollapsed)
    btn.setAttribute('aria-pressed', sideCollapsed ? 'false' : 'true')
    btn.title = sideCollapsed ? '展开文件列表' : '收起文件列表'
  }
}

function syncAgentDocumentSurface() {
  const shell = document.getElementById('appShell')
  if (!shell) return
  const hasOpenDocument = Boolean(panes.left.active || (splitOn && panes.right.active))
  shell.classList.toggle('agent-has-document', hasOpenDocument)
}

document.getElementById('btnToggleSide')?.addEventListener('click', () => {
  sideCollapsed = !sideCollapsed
  applySideCollapsed()
  saveState()
})

function syncRailNavigation() {
  ensureShellLayoutInvariant()
  healBlankCenterSurface()
  const agentBtn = document.getElementById('btnRailAi')
  const workbenchBtn = document.getElementById('btnRailWorkbench')
  const automationBtn = document.getElementById('btnRailAutomation')
  const settingsBtn = document.getElementById('btnSettings')
  const knowledgeBtn = document.getElementById('btnKnowledgeOs')
  const capabilitiesBtn = document.getElementById('btnRailCapabilities')
  const capabilityHubOn = drawerKind === 'capability-hub' && drawer.classList.contains('open')
  const knowledgeOn = drawerKind === 'knowledge' && drawer.classList.contains('open')
  const settingsOn = drawerKind === 'settings' && drawer.classList.contains('open')
  const overlayOn = knowledgeOn || settingsOn || capabilityHubOn
  const agentOn = workspaceMode === 'agent' && !workbenchOn && !overlayOn
  const workbenchActive = workbenchOn && !workbenchAutomationOn && !overlayOn
  const automationActive = workbenchOn && workbenchAutomationOn && !overlayOn
  agentBtn?.classList.toggle('active', agentOn)
  agentBtn?.setAttribute('aria-pressed', agentOn ? 'true' : 'false')
  workbenchBtn?.classList.toggle('active', workbenchActive)
  workbenchBtn?.setAttribute('aria-pressed', workbenchActive ? 'true' : 'false')
  automationBtn?.classList.toggle('active', automationActive)
  automationBtn?.setAttribute('aria-pressed', automationActive ? 'true' : 'false')
  knowledgeBtn?.classList.toggle('active', knowledgeOn)
  knowledgeBtn?.setAttribute('aria-pressed', knowledgeOn ? 'true' : 'false')
  settingsBtn?.classList.toggle('active', settingsOn)
  settingsBtn?.setAttribute('aria-pressed', settingsOn ? 'true' : 'false')
  capabilitiesBtn?.classList.toggle('active', capabilityHubOn)
  capabilitiesBtn?.setAttribute('aria-pressed', capabilityHubOn ? 'true' : 'false')
  document.querySelectorAll('[data-capability-hub-tab]').forEach((tab) => {
    const active = capabilityHubOn && tab.dataset.capabilityHubTab === capabilityHubTab
    tab.classList.toggle('active', active)
    tab.setAttribute('aria-selected', active ? 'true' : 'false')
  })
}

function syncWorkbenchRailFromPage(page) {
  workbenchPage = page === 'tasks' || page === 'automation' ? page : 'home'
  workbenchAutomationOn = workbenchPage === 'automation'
  const shell = document.getElementById('appShell')
  const taskRoom = workbenchOn && !workbenchAutomationOn && workbenchTaskActive && workbenchPage === 'tasks'
  shell?.classList.toggle('workbench-task-active', taskRoom)
  if (shell) {
    shell.dataset.workbenchLayout = taskRoom ? 'task-room' : 'overview'
    shell.dataset.workbenchTaskKind = taskRoom ? String(workbenchTaskContextKind || '') : ''
  }
  syncRailNavigation()
}

function setWorkbenchTaskView(active, context = {}, meta = {}) {
  const wasActive = workbenchTaskActive
  const layout = meta && meta.layout === 'task-room' ? 'task-room' : 'overview'
  workbenchTaskActive = layout === 'task-room' ? true : !!active
  workbenchTaskContextKind = workbenchTaskActive ? String(context?.kind || '') : ''
  const shell = document.getElementById('appShell')
  const taskRoom = workbenchOn && !workbenchAutomationOn && workbenchTaskActive && workbenchPage === 'tasks'
  shell?.classList.toggle('workbench-task-active', taskRoom)
  if (shell) {
    shell.dataset.workbenchLayout = taskRoom ? 'task-room' : 'overview'
    shell.dataset.workbenchTaskKind = taskRoom ? String(workbenchTaskContextKind || '') : ''
  }
  if (workbenchTaskActive && !wasActive) {
    // 专家/工作流对话房自管 Session，勿再套一层「工作台 ·」指挥会话
    if (!['expert-chat', 'workflow-chat'].includes(workbenchTaskContextKind)) {
      window.WorkspaceAgent?.enterWorkbenchTask?.(context)
    }
  } else if (workbenchTaskActive) {
    if (!['expert-chat', 'workflow-chat'].includes(workbenchTaskContextKind)) {
      window.WorkspaceAgent?.updateWorkbenchTaskContext?.(context)
    }
  } else window.WorkspaceAgent?.exitWorkbenchTask?.()
}

async function startExpertTaskChat({ task, expertId, goal, knowledgeRefs = [] } = {}) {
  try {
    const result = await window.WorkspaceAgent?.startExpertChat?.({
      expertId,
      goal,
      knowledgeRefs,
      surface: 'workbench',
      taskRef: task?.id ? { kind: 'workbench-task', id: task.id } : null,
    })
    if (!result?.ok) return result || { ok: false, error: '无法创建专家对话' }
    return result
  } catch (error) {
    return { ok: false, error: error?.message || '无法创建专家对话' }
  }
}

async function resumeExpertTaskChat({ sessionId } = {}) {
  try {
    await window.WorkspaceAgent?.setSurfaceMode?.('workbench')
    const resumed = await window.WorkspaceAgent?.resumeSession?.(sessionId)
    if (!resumed) return { ok: false, error: '原专家对话不存在或无法恢复' }
    const result = await window.api?.agentSessionGet?.(sessionId)
    return result?.ok
      ? { ok: true, session: result.session }
      : { ok: false, error: result?.error || '无法读取专家对话' }
  } catch (error) {
    return { ok: false, error: error?.message || '无法恢复专家对话' }
  }
}

/** 工作台：首页全宽；任务工作间显示专属协作对话。 */
function applyWorkbench() {
  const shell = document.getElementById('appShell')
  const inWorkbench = workbenchOn && !workbenchAutomationOn
  const inAutomation = workbenchOn && workbenchAutomationOn
  if (shell) {
    shell.classList.toggle('mode-workbench', inWorkbench)
    shell.classList.toggle('mode-automation', inAutomation)
    const taskRoom = inWorkbench && workbenchTaskActive && workbenchPage === 'tasks'
    shell.classList.toggle('workbench-task-active', taskRoom)
    shell.dataset.workbenchLayout = taskRoom ? 'task-room' : 'overview'
    shell.dataset.workbenchTaskKind = taskRoom ? String(workbenchTaskContextKind || '') : ''
  }
  // 工作台开启（含专家/工作流对话房、Daemon 任务间）一律走 workbench surface，
  // 避免任务 Session 泄漏进助理 Tab。
  if (window.WorkspaceAgent?.setSurfaceMode) {
    window.WorkspaceAgent.setSurfaceMode(workbenchOn ? 'workbench' : 'agent')
  }
  syncRailNavigation()
  if (workbenchOn && window.Workbench) window.Workbench.ensureLoaded()
}

function openWorkbenchHome() {
  workbenchOn = true
  workbenchPage = 'home'
  workbenchAutomationOn = false
  setWorkbenchTaskView(false)
  // 进入工作台需保证左侧对话列可见（agent 语义，非 edit）
  if (workspaceMode === 'edit') {
    sideCollapsedBeforeAgent = sideCollapsed
    workspaceMode = 'agent'
    applyWorkspaceMode()
  }
  applyWorkbench()
  window.Workbench?.openPage?.('home')
  saveState()
}

function applyWorkspaceMode() {
  const shell = document.getElementById('appShell')
  if (shell) {
    shell.classList.toggle('mode-agent', workspaceMode === 'agent')
    shell.classList.toggle('mode-edit', workspaceMode === 'edit')
  }
  // Agent 模式：文件列表默认收起，把宽度留给 Agent ↔ 文件预览等分
  if (workspaceMode === 'agent') {
    // Agent 已经占据左侧主区，文件区只保留一个 pane；避免引用文件时
    // 再开启编辑区内分屏，导致文件被推到右侧且左侧出现空白 pane。
    if (splitOn) {
      splitOn = false
      document.querySelector('[data-pane="right"]')?.classList.add('hidden')
      document.getElementById('btnSplit')?.classList.remove('active')
      activePane = 'left'
    }
    sideCollapsed = true
    applySideCollapsed()
  } else if (!sideCollapsedBeforeAgent) {
    // 切回编辑：若进入 Agent 前是展开的，则恢复展开
    sideCollapsed = false
    applySideCollapsed()
  }
  syncRailNavigation()
  for (const pane of ['left', 'right']) {
    postToPane(pane, { type: 'workspace-mode', mode: workspaceMode })
  }
}

function toggleWorkspaceMode() {
  if (workspaceMode === 'edit') {
    sideCollapsedBeforeAgent = sideCollapsed
    workspaceMode = 'agent'
  } else {
    workspaceMode = 'edit'
  }
  applyWorkspaceMode()
  saveState()
  if (workspaceMode === 'agent') {
    const pane = activePane === 'right' && splitOn ? 'right' : 'left'
    if (panes[pane].active) postToPane(pane, { type: 'load-note', id: panes[pane].active })
  }
}

function openAgentChat() {
  if (isCenterSurface() || drawer.classList.contains('open')) closeDrawer()
  if (workspaceMode !== 'agent') sideCollapsedBeforeAgent = sideCollapsed
  workspaceMode = 'agent'
  workbenchOn = false
  workbenchAutomationOn = false
  // 离开工作台进入助理：退出 task-room / 清 Daemon 过程投影，避免与助理空态叠层
  setWorkbenchTaskView(false)
  applyWorkbench()
  applyWorkspaceMode()
  saveState()
  requestAnimationFrame(() => document.getElementById('agentInput')?.focus())
}

document.getElementById('btnRailAi')?.addEventListener('click', openAgentChat)

document.getElementById('btnRailWorkbench')?.addEventListener('click', () => {
  if (isCenterSurface() || drawer.classList.contains('open')) closeDrawer()
  openWorkbenchHome()
})

document.getElementById('btnRailAutomation')?.addEventListener('click', () => {
  if (isCenterSurface() || drawer.classList.contains('open')) closeDrawer()
  if (workspaceMode !== 'agent') sideCollapsedBeforeAgent = sideCollapsed
  workspaceMode = 'agent'
  workbenchOn = true
  workbenchAutomationOn = true
  setWorkbenchTaskView(false)
  applyWorkspaceMode()
  applyWorkbench()
  window.Workbench?.openPage?.('automation')
  saveState()
})

/** 向活动 editor iframe 请求正文上下文（Agent 对话用） */
function requestEditorContext(pane) {
  return new Promise(resolve => {
    const p = panes[pane]
    if (!p.active || !p.iframe?.contentWindow) {
      resolve({ ok: false, error: '请先打开一个文件' })
      return
    }
    const reqId = 'ctx-' + Date.now()
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg)
      resolve({ ok: false, error: '读取文件超时' })
    }, 3000)
    function onMsg(e) {
      const d = e.data || {}
      if (d.type !== 'editor-context' || d.reqId !== reqId) return
      clearTimeout(timer)
      window.removeEventListener('message', onMsg)
      resolve(d)
    }
    window.addEventListener('message', onMsg)
    p.iframe.contentWindow.postMessage({ type: 'get-editor-context', reqId }, '*')
  })
}

async function getActiveEditorContext() {
  const pane = activePane === 'right' && splitOn ? 'right' : 'left'
  if (!panes[pane].active) return { ok: true, noteId: null, content: '', category: '' }
  return requestEditorContext(pane)
}

function getAgentFileCatalog() {
  return data.notes || []
}

function openAgentReferencedFile(id) {
  if (!id) return false
  // Agent 与文件预览已经是工作台的两列，不要在文件预览区再次分屏。
  if (splitOn) {
    splitOn = false
    document.querySelector('[data-pane="right"]')?.classList.add('hidden')
    document.getElementById('btnSplit')?.classList.remove('active')
  }
  activePane = 'left'
  openFile(id, 'left')
  return true
}

function applyToActiveEditor(text, mode) {
  const pane = activePane === 'right' && splitOn ? 'right' : 'left'
  postToPane(pane, { type: 'apply-content', text, mode })
}

// ── 文件右键菜单 / 文件级操作 ───────────────────────────────
const ctxMenu = document.getElementById('ctxMenu')
function hideCtx() { ctxMenu.classList.remove('show'); ctxMenu.innerHTML = '' }
function showCtx(x, y, items) {
  ctxMenu.innerHTML = items.map(it => it.sep
    ? '<div class="ctx-sep"></div>'
    : `<button class="ctx-item${it.danger ? ' danger' : ''}" data-act="${it.act}"><span class="ico" data-icon="${it.icon}"></span>${esc(it.label)}</button>`).join('')
  mountIcons(ctxMenu)
  ctxMenu.classList.add('show')
  const mw = ctxMenu.offsetWidth || 180, mh = ctxMenu.offsetHeight || 240
  ctxMenu.style.left = Math.min(x, window.innerWidth - mw - 8) + 'px'
  ctxMenu.style.top = Math.min(y, window.innerHeight - mh - 8) + 'px'
  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => btn.addEventListener('click', () => { hideCtx(); items.find(i => i.act === btn.dataset.act)?.run() }))
}
treeEl.addEventListener('contextmenu', e => {
  const file = e.target.closest('.file[data-id]')
  if (!file) return
  e.preventDefault()
  const id = file.dataset.id
  const n = noteById(id); if (!n) return
  const otherPane = activePane === 'left' ? 'right' : 'left'
  showCtx(e.clientX, e.clientY, [
    { act: 'open', icon: 'note', label: '打开', run: () => openFile(id, activePane) },
    { act: 'side', icon: 'columns', label: '在分屏打开', run: () => { if (!splitOn) toggleSplit(); openFile(id, otherPane); activePane = otherPane } },
    { sep: true },
    { act: 'rename', icon: 'edit', label: '重命名', run: () => renameFile(id) },
    { act: 'version', icon: 'newVersion', label: '新建版本', run: () => makeVersion(id) },
    { act: 'dup', icon: 'copy', label: '复制副本', run: () => duplicateFile(id) },
    { act: 'fav', icon: 'star', label: n.favorite ? '取消收藏' : '收藏', run: () => toggleFav(id) },
    { sep: true },
    { act: 'del', icon: 'trash', label: '删除', danger: true, run: () => deleteFile(id) },
  ])
})
document.addEventListener('click', e => { if (!ctxMenu.contains(e.target)) hideCtx() })
document.addEventListener('scroll', hideCtx, true)
window.addEventListener('blur', hideCtx)
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtx() })

function renameFile(id) {
  const row = treeEl.querySelector(`.file[data-id="${id}"]`)
  const nameEl = row && row.querySelector('.file-name')
  const n = noteById(id)
  if (!nameEl || !n) return
  const input = document.createElement('input')
  input.className = 'file-rename-input'
  input.value = (n.title || '').trim() || (fileLabel(n) === '未命名' ? '' : fileLabel(n))
  input.placeholder = '文件名'
  nameEl.replaceWith(input)
  input.focus(); input.select()
  let done = false
  const commit = (save) => {
    if (done) return; done = true
    const v = input.value.trim()
    if (save) {
      n.title = v
      window.api.updateNote({ id, title: v, project: n.project || '', projectManual: true, version: n.version || '0.1', category: n.category || '' })
      for (const pane of ['left', 'right']) if (panes[pane].active === id) postToPane(pane, { type: 'load-note', id })
    }
    renderTree()
  }
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(true) }
    else if (ev.key === 'Escape') { ev.preventDefault(); commit(false) }
  })
  input.addEventListener('blur', () => commit(true))
}
async function makeVersion(id) {
  const r = await window.api.workspaceNewVersion(id)
  if (!r.ok) { toast(r.error || '新建版本失败', 'error'); return }
  await reload(); openFile(r.note.id, activePane)
  toast('已创建新版本 v' + r.note.version, 'success')
}
async function duplicateFile(id) {
  const r = await window.api.workspaceDuplicateNote(id)
  if (!r.ok) { toast(r.error || '复制失败', 'error'); return }
  await reload(); openFile(r.note.id, activePane)
  toast('已复制副本', 'success')
}
function toggleFav(id) {
  const n = noteById(id); if (!n) return
  n.favorite = !n.favorite
  window.api.toggleFavorite(id)
  renderTabs('left'); renderTabs('right'); renderTree()
}
async function deleteFile(id) {
  const n = noteById(id); if (!n) return
  if (!window.confirm(`永久删除「${fileLabel(n)}」？此操作不可恢复。`)) return
  const r = await window.api.workspaceDeleteNote(id)
  if (!r.ok) { toast(r.error || '删除失败', 'error'); return }
  for (const pane of ['left', 'right']) {
    const p = panes[pane]
    const idx = p.tabs.findIndex(t => t.id === id)
    if (idx >= 0) closeTab(pane, id)
  }
  await reload(); renderTabs('left'); renderTabs('right'); renderTree(); saveState()
  toast('已删除', 'success')
}

// ── 标签页 & pane ──────────────────────────────────────────
function ensureIframe(pane) {
  const p = panes[pane]
  if (p.iframe) return p.iframe
  const body = document.querySelector(`[data-body="${pane}"]`)
  const empty = body.querySelector('.pane-empty')
  const ifr = document.createElement('iframe')
  ifr.src = `editor-pane.html?pane=${pane}`
  body.appendChild(ifr)
  if (empty) empty.style.display = 'none'
  p.iframe = ifr
  return ifr
}
function postToPane(pane, msg) {
  const p = panes[pane]
  const ifr = ensureIframe(pane)
  if (p.ready && ifr.contentWindow) ifr.contentWindow.postMessage(msg, '*')
  else p.pending = msg
}
function renderTabs(pane) {
  const p = panes[pane]
  const bar = document.querySelector(`[data-tabs="${pane}"]`)
  bar.innerHTML = p.tabs.map(t => {
    let label = '未命名'
    if (String(t.id).startsWith('fs:')) {
      label = t.relPath || t.id.split(':').slice(2).join(':') || '文件'
      const base = String(label).split('/').pop()
      label = base || label
    } else {
      const n = noteById(t.id)
      label = n ? fileLabel(n) : '未命名'
    }
    return `<div class="tab${p.active === t.id ? ' active' : ''}" data-id="${t.id}">
      <span class="tab-name">${esc(label)}</span>
      <button class="tab-close" data-close="${t.id}" title="关闭标签">×</button>
    </div>`
  }).join('')
}
function ensureExpandedForOpen(id) {
  const n = noteById(id)
  const root = chainRootId(n)
  if (!n || !root) return
  const members = data.notes.filter(x => chainRootId(x) === root)
  if (members.length < 2) return
  members.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  // 打开的不是最新版 → 自动展开，让用户看到当前是哪一版
  if (members[0].id !== id) expandedChains.add(root)
}

function openFsFile(fsId, sourceId, relPath, pane) {
  if (workbenchOn) {
    workbenchOn = false
    workbenchAutomationOn = false
    applyWorkbench()
  }
  activePane = pane
  const p = panes[pane]
  if (!p.tabs.find(t => t.id === fsId)) p.tabs.push({ id: fsId, kind: 'fs', sourceId, relPath })
  p.active = fsId
  renderTabs(pane)
  postToPane(pane, { type: 'load-fs-file', id: fsId, sourceId, path: relPath })
  syncAgentDocumentSurface()
  renderTree()
  saveState()
}

function openFile(id, pane) {
  if (String(id || '').startsWith('fs:')) {
    const rest = id.slice(3)
    const i = rest.indexOf(':')
    if (i > 0) {
      openFsFile(id, rest.slice(0, i), rest.slice(i + 1), pane)
      return
    }
  }
  activePane = pane
  const p = panes[pane]
  if (!p.tabs.find(t => t.id === id)) p.tabs.push({ id })
  p.active = id
  ensureExpandedForOpen(id)
  renderTabs(pane)
  postToPane(pane, { type: 'load-note', id })
  syncAgentDocumentSurface()
  renderTree()
  saveState()
}
function closeTab(pane, id) {
  const p = panes[pane]
  const idx = p.tabs.findIndex(t => t.id === id)
  if (idx < 0) return
  p.tabs.splice(idx, 1)
  if (p.active === id) {
    const next = p.tabs[idx] || p.tabs[idx - 1] || null
    p.active = next ? next.id : null
    if (p.active) openFile(p.active, pane)
    else postToPane(pane, { type: 'load-note', id: null })
  }
  renderTabs(pane); syncAgentDocumentSurface(); renderTree(); saveState()
}
document.querySelectorAll('.tabs').forEach(bar => {
  const pane = bar.dataset.tabs
  bar.addEventListener('click', e => {
    const close = e.target.closest('[data-close]')
    if (close) { e.stopPropagation(); closeTab(pane, close.dataset.close); return }
    const tab = e.target.closest('.tab[data-id]')
    if (tab) { openFile(tab.dataset.id, pane) }
  })
  // 中键关闭标签
  bar.addEventListener('auxclick', e => {
    if (e.button !== 1) return
    const tab = e.target.closest('.tab[data-id]')
    if (tab) { e.preventDefault(); closeTab(pane, tab.dataset.id) }
  })
  document.querySelector(`[data-pane="${pane}"]`).addEventListener('mousedown', () => { activePane = pane })
})

// ── 键盘快捷键（工作台获得焦点时生效；编辑器 iframe 内有各自快捷键）──
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return
  const k = String(e.key || '').toLowerCase()
  if (k === 'n') { e.preventDefault(); newFile(currentGroupCategory()) }
  else if (k === 'w') { const a = panes[activePane].active; if (a) { e.preventDefault(); closeTab(activePane, a) } }
  else if (k === 'f') { e.preventDefault(); searchEl.focus(); searchEl.select() }
  else if (k === '\\') { e.preventDefault(); toggleSplit() }
})

function toggleSplit() {
  splitOn = !splitOn
  const rightCol = document.querySelector('[data-pane="right"]')
  const btn = document.getElementById('btnSplit')
  rightCol.classList.toggle('hidden', !splitOn)
  btn.classList.toggle('active', splitOn)
  if (splitOn && !panes.right.active && panes.left.active) {
    // 右侧默认打开当前文件，方便对照
    openFile(panes.left.active, 'right')
    activePane = 'right'
  }
  saveState()
}
document.getElementById('btnSplit').addEventListener('click', toggleSplit)

// ── 新建 / 新建版本 ────────────────────────────────────────
async function newFile(project) {
  const r = await window.api.workspaceNewNote({ project: project || focusedProjectKey() || '' })
  if (!r.ok) { toast('新建失败', 'error'); return }
  await reload()
  openFile(r.note.id, activePane)
}
document.getElementById('btnNewFile').addEventListener('click', () => newFile(currentGroupProject()))
function focusedProjectKey() {
  return focusedProject && focusedProject !== '__uncat__' ? focusedProject : (focusedProject === '__uncat__' ? '' : null)
}
function currentGroupProject() {
  if (focusedProject) return focusedProject === '__uncat__' ? '' : focusedProject
  const n = panes[activePane].active ? noteById(panes[activePane].active) : null
  return n ? (n.project || '') : ''
}
document.getElementById('btnNewVersion').addEventListener('click', async () => {
  const id = panes[activePane].active
  if (!id) { toast('请先打开一个文件'); return }
  const r = await window.api.workspaceNewVersion(id)
  if (!r.ok) { toast(r.error || '新建版本失败', 'error'); return }
  await reload()
  openFile(r.note.id, activePane)
  toast('已创建新版本 v' + r.note.version, 'success')
})
document.getElementById('btnBarVersions').addEventListener('click', () => {
  const id = panes[activePane].active
  if (!id) { toast('请先打开一个文件'); return }
  openVersions(id)
})
document.getElementById('btnBarFinalPrompt')?.addEventListener('click', async () => {
  const id = panes[activePane].active
  if (!id) { toast('请先打开一个文件'); return }
  const n = noteById(id) || {}
  let content = n.preview || ''
  try {
    const full = await window.api.getNote(id)
    if (full) content = full.content || ''
  } catch { /* use brief */ }
  openFinalPrompt({ id, content, category: n.category || n.project || '' })
})

// ── 居中二级弹窗 / 一级整页面板（知识库·设置·专家库） ──
function isCenterSurface() {
  return document.getElementById('appShell')?.classList.contains('mode-center-surface')
}
function isSecondaryDialogOpen() {
  return document.getElementById('appShell')?.classList.contains('mode-secondary-dialog')
    && drawer?.classList.contains('open')
}
function isKnowledgeFullpage() {
  return isCenterSurface() && drawerKind === 'knowledge'
}
function setKnowledgeFullpage() {
  syncRailNavigation()
}
function ensureShellLayoutInvariant() {
  const shell = document.getElementById('appShell')
  if (!shell || !drawer) return
  if (shell.classList.contains('mode-knowledge')) shell.classList.remove('mode-knowledge')
}
function clearCenterOverlayStyles() {
  if (!drawer) return
  drawer.style.position = ''
  drawer.style.left = ''
  drawer.style.top = ''
  drawer.style.right = ''
  drawer.style.bottom = ''
  drawer.style.zIndex = ''
  drawer.style.flex = ''
  drawer.style.flexBasis = ''
  drawer.style.width = ''
  drawer.style.minWidth = ''
  drawer.style.maxWidth = ''
  drawer.style.height = ''
  drawer.style.opacity = ''
  drawer.style.visibility = ''
  drawer.style.background = ''
  drawer.style.borderLeft = ''
  drawer.style.boxShadow = ''
}
function railWidthCssValue(shell = document.getElementById('appShell')) {
  const value = shell ? getComputedStyle(shell).getPropertyValue('--rail-width').trim() : ''
  return value || '120px'
}
/** 中间面板打开后若仍被 width:0 / 布局冲掉，强制恢复 fixed 覆盖层 */
function healBlankCenterSurface() {
  if (!drawer) return
  const shell = document.getElementById('appShell')
  const centerKinds = drawerKind === 'knowledge' || drawerKind === 'settings'
  const shouldCenter = centerKinds && drawer.classList.contains('open')
  if (!shouldCenter) {
    if (shell?.classList.contains('mode-center-surface') && !drawer.classList.contains('open')) {
      shell.classList.remove('mode-center-surface')
      clearCenterOverlayStyles()
    }
    return
  }
  shell?.classList.add('mode-center-surface')
  shell?.classList.remove('mode-knowledge')
  const rect = drawer.getBoundingClientRect()
  const centerLeft = railWidthCssValue(shell)
  const broken = rect.width < 80 || rect.height < 80
    || getComputedStyle(drawer).position !== 'fixed'
    || getComputedStyle(drawer).left !== centerLeft
  if (broken) {
    drawer.style.position = 'fixed'
    drawer.style.left = centerLeft
    drawer.style.top = '0'
    drawer.style.right = '0'
    drawer.style.bottom = '0'
    drawer.style.zIndex = '220'
    drawer.style.flex = 'none'
    drawer.style.flexBasis = 'auto'
    drawer.style.width = 'auto'
    drawer.style.minWidth = '0'
    drawer.style.maxWidth = 'none'
    drawer.style.height = 'auto'
    drawer.style.opacity = '1'
    drawer.style.visibility = 'visible'
    drawer.style.background = '#f5f3ef'
    drawer.style.borderLeft = '1px solid rgba(0,0,0,0.08)'
    console.error('[center-surface] healed blank surface', JSON.stringify({
      w: Math.round(rect.width), h: Math.round(rect.height), kind: drawerKind,
    }))
  }
}
function applyDrawerFallbackLayout(opts = {}) {
  if (!drawer) return
  const center = !!opts.center
  const settings = (opts.kind || '') === 'settings'
  if (center) return
  drawer.style.flex = ''
  drawer.style.minWidth = ''
  if (settings) {
    drawer.style.flexBasis = 'min(560px, 62vw)'
    drawer.style.width = 'min(560px, 62vw)'
  } else {
    drawer.style.flexBasis = '380px'
    drawer.style.width = '380px'
  }
}
function centerSurfaceTabsFor(kind) {
  if (kind === 'knowledge') return KNOWLEDGE_SURFACE_TABS
  if (kind === 'settings') return SETTINGS_SURFACE_TABS
  return []
}
function activeCenterSurfaceTab(kind) {
  if (kind === 'knowledge') return primaryKnowledgeSurfaceTab(knowledgeUi.page)
  if (kind === 'settings') return settingsSurfaceTab
  return ''
}
function clearCenterSurfaceTabs() {
  drawerSurfaceTabs?.replaceChildren()
  drawerSurfaceTabs?.setAttribute('aria-hidden', 'true')
  drawerBody?.removeAttribute('role')
  drawerBody?.removeAttribute('aria-labelledby')
}
function syncCenterSurfaceTabs(kind, activeTab) {
  if (!drawerSurfaceTabs) return
  const definitions = centerSurfaceTabsFor(kind)
  const active = definitions.some(tab => tab.id === activeTab) ? activeTab : definitions[0]?.id
  let activeButton = null
  drawerSurfaceTabs.querySelectorAll('[data-center-surface-tab]').forEach(button => {
    const selected = button.dataset.centerSurfaceTab === active
    button.classList.toggle('active', selected)
    button.setAttribute('aria-selected', selected ? 'true' : 'false')
    button.tabIndex = selected ? 0 : -1
    if (selected) activeButton = button
  })
  if (activeButton && drawerBody) {
    drawerBody.setAttribute('role', 'tabpanel')
    drawerBody.setAttribute('aria-labelledby', activeButton.id)
  }
}
function renderCenterSurfaceTabs(kind, activeTab) {
  if (!drawerSurfaceTabs) return
  const definitions = centerSurfaceTabsFor(kind)
  drawerSurfaceTabs.replaceChildren()
  if (!definitions.length) {
    clearCenterSurfaceTabs()
    return
  }
  drawerSurfaceTabs.setAttribute('aria-label', kind === 'knowledge' ? '知识库页面' : '设置页面')
  drawerSurfaceTabs.setAttribute('aria-hidden', 'false')
  for (const tab of definitions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'drawer-surface-tab'
    button.id = `drawerSurfaceTab-${kind}-${tab.id}`
    button.dataset.centerSurfaceKind = kind
    button.dataset.centerSurfaceTab = tab.id
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', 'drawerBody')
    button.textContent = tab.label
    drawerSurfaceTabs.appendChild(button)
  }
  syncCenterSurfaceTabs(kind, activeTab)
}
drawerSurfaceTabs?.addEventListener('click', event => {
  const button = event.target.closest('[data-center-surface-tab]')
  if (!button) return
  const kind = button.dataset.centerSurfaceKind
  const tab = button.dataset.centerSurfaceTab
  if (kind !== drawerKind) return
  if (kind === 'knowledge') openKnowledgeOsPanel(undefined, tab)
  if (kind === 'settings') openSettingsPanel(tab)
})
drawerSurfaceTabs?.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = [...drawerSurfaceTabs.querySelectorAll('[data-center-surface-tab]')]
  const current = buttons.indexOf(document.activeElement)
  if (current < 0 || !buttons.length) return
  event.preventDefault()
  let next = current
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = buttons.length - 1
  else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next].focus()
  buttons[next].click()
})
function openCenterSurface(title, kind) {
  if (!drawer || !drawerTitle) return
  const shell = document.getElementById('appShell')
  drawerReturnFocus = null
  shell?.classList.remove('mode-secondary-dialog')
  shell?.classList.remove('mode-knowledge')
  shell?.classList.add('mode-center-surface')
  drawerBackdrop?.classList.remove('open')
  drawerBackdrop?.setAttribute('aria-hidden', 'true')
  drawerKind = kind || ''
  drawer.classList.remove('secondary-dialog', 'drawer-capability-hub-detail')
  drawer.classList.toggle('drawer-settings', drawerKind === 'settings')
  drawer.classList.toggle('drawer-capability-hub', drawerKind === 'capability-hub')
  drawer.classList.toggle('drawer-tabbed-surface', drawerKind === 'knowledge' || drawerKind === 'settings')
  drawer.classList.add('open')
  drawer.removeAttribute('role')
  drawer.removeAttribute('aria-modal')
  drawer.removeAttribute('aria-labelledby')
  drawer.setAttribute('aria-hidden', 'false')
  // 固定覆盖层：盖住主区，不依赖 flex 展开，彻底避免白屏
  drawer.style.position = 'fixed'
  drawer.style.left = railWidthCssValue(shell)
  drawer.style.top = '0'
  drawer.style.right = '0'
  drawer.style.bottom = '0'
  drawer.style.zIndex = '220'
  drawer.style.flex = 'none'
  drawer.style.flexBasis = 'auto'
  drawer.style.width = 'auto'
  drawer.style.minWidth = '0'
  drawer.style.maxWidth = 'none'
  drawer.style.height = 'auto'
  drawer.style.opacity = '1'
  drawer.style.visibility = 'visible'
  drawer.style.background = '#f5f3ef'
  drawer.style.borderLeft = '1px solid rgba(0,0,0,0.08)'
  drawer.style.boxShadow = 'none'
  drawerTitle.textContent = title
  drawerTitle.hidden = true
  if (drawer.classList.contains('drawer-tabbed-surface')) renderCenterSurfaceTabs(drawerKind, activeCenterSurfaceTab(drawerKind))
  else clearCenterSurfaceTabs()
  console.debug('[center-surface] open-fixed', JSON.stringify({
    title,
    kind: drawerKind,
    open: drawer.classList.contains('open'),
    rect: (() => {
      const r = drawer.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }
    })(),
  }))
  ensureShellLayoutInvariant()
  syncRailNavigation()
}
function openDrawer(title, opts = {}) {
  if (!drawer || !drawerTitle) return
  if (opts.kind === 'knowledge' || opts.kind === 'settings' || opts.kind === 'capability-hub' || opts.center || opts.fullpage) {
    openCenterSurface(title, opts.kind || (opts.fullpage ? 'knowledge' : ''))
    return
  }
  // 二级弹窗会覆写 drawerBody；先 park 专家库，避免误销毁
  parkCapabilityHubFrame()
  const shell = document.getElementById('appShell')
  drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  shell?.classList.remove('mode-center-surface')
  shell?.classList.remove('mode-knowledge')
  shell?.classList.add('mode-secondary-dialog')
  clearCenterOverlayStyles()
  drawerKind = opts.kind || 'secondary'
  drawer.classList.remove('drawer-settings', 'drawer-capability-hub', 'drawer-tabbed-surface')
  clearCenterSurfaceTabs()
  drawer.classList.add('secondary-dialog')
  drawer.classList.add('open')
  drawer.setAttribute('role', 'dialog')
  drawer.setAttribute('aria-modal', 'true')
  drawer.setAttribute('aria-labelledby', 'drawerTitle')
  drawer.setAttribute('aria-hidden', 'false')
  drawerBackdrop?.classList.add('open')
  drawerBackdrop?.setAttribute('aria-hidden', 'false')
  drawerTitle.textContent = title
  drawerTitle.hidden = false
  ensureShellLayoutInvariant()
  syncRailNavigation()
  requestAnimationFrame(() => document.getElementById('drawerClose')?.focus())
}
function closeDrawer() {
  if (!drawer) return
  if (drawerKind === 'knowledge' && !confirmDiscardKnowledgeRawEdit()) return
  if (drawerKind === 'knowledge') clearKnowledgeRawEditorState()
  if (isCapabilityHubDrawerKind()) parkCapabilityHubFrame()
  const shell = document.getElementById('appShell')
  const closedKind = drawerKind
  const wasSecondary = isSecondaryDialogOpen() || drawerKind === 'capability-hub-detail'
  const returnFocus = drawerReturnFocus
  drawerReturnFocus = null
  drawer.classList.remove('open')
  drawer.classList.remove('drawer-settings')
  drawer.classList.remove('drawer-capability-hub')
  drawer.classList.remove('drawer-capability-hub-detail')
  drawer.classList.remove('drawer-tabbed-surface')
  drawer.classList.remove('secondary-dialog')
  drawer.setAttribute('aria-hidden', 'true')
  drawer.removeAttribute('role')
  drawer.removeAttribute('aria-modal')
  drawer.removeAttribute('aria-labelledby')
  drawerBackdrop?.classList.remove('open')
  drawerBackdrop?.setAttribute('aria-hidden', 'true')
  drawerTitle.hidden = false
  clearCenterSurfaceTabs()
  clearCenterOverlayStyles()
  drawerKind = ''
  shell?.classList.remove('mode-center-surface')
  shell?.classList.remove('mode-knowledge')
  shell?.classList.remove('mode-secondary-dialog')
  ensureShellLayoutInvariant()
  syncRailNavigation()
  if (wasSecondary && returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus())
  try {
    window.dispatchEvent(new CustomEvent('knowme-drawer-closed', { detail: { kind: closedKind } }))
  } catch { /* ignore */ }
}
document.getElementById('drawerClose').addEventListener('click', closeDrawer)
drawerBackdrop?.addEventListener('click', () => {
  if (isSecondaryDialogOpen()) closeDrawer()
})

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label || '请求超时')), ms)
    Promise.resolve(promise)
      .then((value) => { clearTimeout(timer); resolve(value) })
      .catch((err) => { clearTimeout(timer); reject(err) })
  })
}

async function openVersions(id) {
  openDrawer('版本对比')
  const versions = await window.api.getNoteVersions(id)
  if (!versions.length) { drawerBody.innerHTML = '<div class="hint">该文件暂无其它版本。用顶部「新建版本」派生 v2。</div>'; return }
  let selected = []
  const render = () => {
    drawerBody.innerHTML = `<div class="hint">选择两个版本查看差异。</div>
      <div class="ver-list">${versions.map(v => `
        <div class="ver-item${selected.includes(v.id) ? ' sel' : ''}" data-id="${v.id}">
          <span class="vtag">v${esc(v.version)}</span><span>${esc((v.title || '').trim() || (v.project || '').trim() || '未命名')}</span>
        </div>`).join('')}</div>
      <div id="diffArea"></div>`
    drawerBody.querySelectorAll('.ver-item').forEach(el => el.addEventListener('click', async () => {
      const vid = el.dataset.id
      if (selected.includes(vid)) selected = selected.filter(x => x !== vid)
      else { selected.push(vid); if (selected.length > 2) selected.shift() }
      render()
      if (selected.length === 2) {
        const d = await window.api.getNoteDiff(selected[0], selected[1])
        const area = document.getElementById('diffArea')
        if (d.ok) area.innerHTML = `<div class="pp-label">差异</div><div class="diff-box">${d.html}</div>`
        else area.innerHTML = `<div class="hint">${esc(d.error || '无法对比')}</div>`
      }
    }))
  }
  render()
}

async function openFinalPrompt(payload) {
  openDrawer('最终提示词预览')
  drawerBody.innerHTML = '<div class="hint">拼接中…</div>'
  const r = await window.api.buildFinalPrompt({ noteId: payload.id, content: payload.content, category: payload.category })
  if (!r.ok) { drawerBody.innerHTML = `<div class="hint">${esc(r.error || '拼接失败')}</div>`; return }
  const sys = r.systemContent || ''
  const userMsg = (r.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n\n')
  const refs = (r.skillRefs || [])
  drawerBody.innerHTML = `
    <div class="hint">这是发送给助手的完整内容（系统提示 + 上下文 + 你的需求）。${refs.length ? '已注入片段：' + refs.map(s => '/' + esc(s)).join(' ') : ''}</div>
    <div class="pp-section"><div class="pp-label">System</div><div class="prompt-box">${esc(sys)}</div></div>
    <div class="pp-section"><div class="pp-label">User（上下文 + 需求）</div><div class="prompt-box">${esc(userMsg)}</div></div>
    <div class="drawer-actions"><button id="ppCopy">复制最终提示词</button></div>`
  document.getElementById('ppCopy').addEventListener('click', () => {
    const full = `# System\n${sys}\n\n# User\n${userMsg}`
    window.api.copyToClipboard(full)
    toast('已复制最终提示词', 'success')
  })
}

const knowledgeUi = {
  page: 'status',
  filter: 'all',
  query: '',
  selectedPath: null,
  entries: [],
  providers: [],
  activeId: null,
  localList: null,
  activeProvider: null,
  collapsedDirs: new Set(),
  seededCollapse: false,
  taskSnapshot: { tasks: [], proposals: [] },
  selectedProposalId: null,
  fabricSnapshot: null,
  fabricQuery: '',
  fabricHits: [],
  fabricRoute: null,
  fabricSearchAttempted: false,
  weaveProposals: [],
  governanceReport: null,
  governanceProposals: [],
  rawEditorPath: null,
  rawEditorHash: null,
  rawEditorDirty: false,
}
let knowledgeOpenSequence = 0

function knowledgeBasename(relPath) {
  const parts = String(relPath || '').split('/').filter(Boolean)
  return parts[parts.length - 1] || relPath || ''
}

function knowledgeAncestorDirs(relPath) {
  const parts = String(relPath || '').split('/').filter(Boolean)
  const out = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

function knowledgeSeedCollapsedDirs(entries) {
  if (knowledgeUi.seededCollapse) return
  const dirs = new Set()
  for (const item of entries || []) {
    for (const dir of knowledgeAncestorDirs(item.path)) dirs.add(dir)
  }
  // Keep top-level folders expanded; collapse deeper nests by default.
  knowledgeUi.collapsedDirs = new Set([...dirs].filter(dir => dir.includes('/')))
  knowledgeUi.seededCollapse = true
}

function knowledgeBuildTree(entries) {
  const root = { name: '', path: '', type: 'dir', children: new Map(), entry: null }
  for (const item of entries) {
    const parts = String(item.path || '').split('/').filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path,
          type: isFile ? 'file' : 'dir',
          children: new Map(),
          entry: null,
        })
      }
      const child = node.children.get(part)
      if (isFile) {
        child.type = 'file'
        child.entry = item
        child.name = item.title || part
      } else {
        child.type = 'dir'
      }
      node = child
    }
  }
  return root
}

function knowledgeBuildRootIndex(entries) {
  const root = knowledgeBuildTree(entries)
  for (const dir of ['raw', 'concepts']) {
    if (!root.children.has(dir)) {
      root.children.set(dir, {
        name: dir,
        path: dir,
        type: 'dir',
        children: new Map(),
        entry: null,
      })
    }
  }
  return root
}

function knowledgeSortTreeNodes(nodes) {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return String(a.name).localeCompare(String(b.name), 'zh-CN')
  })
}

function knowledgeTreeFileCount(node) {
  if (node.type === 'file') return 1
  let total = 0
  for (const child of node.children.values()) total += knowledgeTreeFileCount(child)
  return total
}

function knowledgeRootDirectoryLabel(node) {
  if (node.path === 'raw') return '资料'
  if (node.path === 'concepts') return '已整理知识'
  if (node.path === 'inbox') return '待整理资料'
  return node.name
}

function knowledgeRootIndexHtml(entries) {
  const tree = knowledgeBuildRootIndex(entries)
  const renderNode = (node, depth) => {
    if (node.type === 'file' && node.entry) {
      const item = node.entry
      const updated = item.updatedAt
        ? new Date(item.updatedAt).toLocaleDateString('zh-CN')
        : ''
      return `<button type="button" class="knowledge-index-entry" data-knowledge-index-entry="${esc(item.path)}" data-knowledge-index-kind="${esc(item.kind)}" style="--index-depth:${depth}" title="${esc(item.path)}">
        <span class="knowledge-index-entry-mark" aria-hidden="true"></span>
        <span class="knowledge-index-entry-copy">
          <strong>${esc(item.title || knowledgeBasename(item.path))}</strong>
          <small>${esc(updated || (item.kind === 'okf' ? '已整理知识' : '资料'))}</small>
        </span>
        <span class="knowledge-index-entry-type">${item.kind === 'okf' ? '知识' : item.editable ? '可编辑' : '资料'}</span>
      </button>`
    }
    const children = knowledgeSortTreeNodes(node.children.values())
    const count = knowledgeTreeFileCount(node)
    const label = depth === 0 ? knowledgeRootDirectoryLabel(node) : node.name
    const emptyCopy = node.path === 'raw'
      ? '还没有资料'
      : node.path === 'concepts'
        ? '还没有已确认的知识'
        : '目录为空'
    return `<details class="knowledge-index-directory" data-knowledge-index-dir="${esc(node.path)}" style="--index-depth:${depth}"${depth <= 1 ? ' open' : ''}>
      <summary>
        <span class="knowledge-index-directory-twist" aria-hidden="true"></span>
        <span class="knowledge-index-directory-icon" aria-hidden="true"></span>
        <strong>${esc(label)}</strong>
        <span>${count}</span>
      </summary>
      <div class="knowledge-index-directory-children">
        ${children.length
          ? children.map(child => renderNode(child, depth + 1)).join('')
          : `<div class="knowledge-index-directory-empty" style="--index-depth:${depth + 1}">
              <span>${emptyCopy}</span>
              ${node.path === 'raw' ? '<button type="button" id="indexEmptyAdd">添加第一份资料</button>' : ''}
            </div>`}
      </div>
    </details>`
  }
  const rootPriority = new Map([['raw', 0], ['concepts', 1]])
  const roots = knowledgeSortTreeNodes(tree.children.values()).sort((a, b) => {
    const pa = rootPriority.has(a.path) ? rootPriority.get(a.path) : 2
    const pb = rootPriority.has(b.path) ? rootPriority.get(b.path) : 2
    return pa - pb
  })
  return `<div class="knowledge-index-tree" aria-label="真实知识目录">
    <div class="knowledge-index-root">
      <span class="knowledge-index-root-icon" aria-hidden="true"></span>
      <div><strong>我的知识</strong><small>本机根目录</small></div>
      <b>${entries.length}</b>
    </div>
    <div class="knowledge-index-root-children">${roots.map(node => renderNode(node, 0)).join('')}</div>
  </div>`
}

function knowledgeTopbarHtml({ name, kind, root, stats = {}, remote = false }) {
  return `<header class="knowledge-topbar">
    <div class="knowledge-heading">
      <div class="knowledge-heading-row"><h2>${esc(name)}</h2><span class="knowledge-kind">${remote ? '外部来源' : '本地保存'}</span></div>
      <div class="knowledge-root" title="${esc(root || '')}">${remote ? '只检索命中内容，不同步原始文件' : '资料保存在本机，可随时打开编辑'}</div>
    </div>
    ${remote ? '' : `<div class="knowledge-stats">
      <div class="knowledge-stat"><strong>${stats.total || 0}</strong><span>条目</span></div>
      <div class="knowledge-stat"><strong>${stats.wiki || 0}</strong><span>资料</span></div>
      <div class="knowledge-stat"><strong>${stats.okf || 0}</strong><span>已整理</span></div>
    </div>`}
    <div class="knowledge-toolbar">
      <button type="button" class="knowledge-btn" id="kbSourcesOpen">来源</button>
      ${remote
        ? '<button type="button" class="knowledge-btn" id="ragConfigure">配置来源</button>'
        : `<button type="button" class="knowledge-btn" id="kosRefresh">重新读取</button>
          <details class="knowledge-more">
            <summary aria-label="更多知识操作">更多</summary>
            <div class="knowledge-more-menu">
              <button type="button" id="kosLint">检查问题</button>
              <button type="button" id="obsidianOpen">用 Obsidian 打开</button>
            </div>
          </details>`}
    </div>
  </header>`
}

function renderKnowledgeMarkdown(src) {
  const inline = text => esc(text)
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  let list = null
  let inCode = false
  let code = []
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = []; inCode = false }
      else { closeList(); inCode = true }
      continue
    }
    if (inCode) { code.push(line); continue }
    if (!line.trim()) { closeList(); continue }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) { closeList(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) { closeList(); out.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`); continue }
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ordered) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' } out.push(`<li>${inline(ordered[1])}</li>`); continue }
    if (unordered) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' } out.push(`<li>${inline(unordered[1])}</li>`); continue }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  if (inCode) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
  closeList()
  return out.join('')
}

function knowledgeEntryListHtml() {
  const q = knowledgeUi.query.toLowerCase()
  const filtered = knowledgeUi.entries.filter(item => {
    if (knowledgeUi.filter !== 'all' && item.kind !== knowledgeUi.filter) return false
    return !q || `${item.title} ${item.path}`.toLowerCase().includes(q)
  })
  if (!filtered.length) {
    return `<div class="knowledge-empty">${knowledgeUi.entries.length
      ? '没有匹配的条目<br>试试更短的关键词或切换筛选'
      : '这里还没有知识资料<br>绑定一个资料目录，或让 AI 帮你开始整理'}</div>`
  }

  knowledgeSeedCollapsedDirs(knowledgeUi.entries)
  const searching = !!q
  const keepPaths = searching ? new Set() : null
  if (searching) {
    for (const item of filtered) {
      keepPaths.add(item.path)
      for (const dir of knowledgeAncestorDirs(item.path)) keepPaths.add(dir)
    }
  }

  const tree = knowledgeBuildTree(filtered)
  const renderNode = (node, depth) => {
    if (node.type === 'file' && node.entry) {
      const item = node.entry
      const fileName = knowledgeBasename(item.path)
      return `<button type="button" class="knowledge-tree-row knowledge-tree-file${item.path === knowledgeUi.selectedPath ? ' active' : ''}" data-kos-kind="${esc(item.kind)}" data-path="${esc(item.path)}" style="--kos-depth:${depth}" title="${esc(item.path)}">
        <span class="knowledge-tree-gutter" aria-hidden="true"></span>
        <span class="knowledge-tree-ico knowledge-tree-ico-file" aria-hidden="true"></span>
        <span class="knowledge-tree-label">${esc(item.title || fileName)}</span>
        <span class="knowledge-tree-badge">${item.kind === 'okf' ? '已整理' : item.editable || String(item.path || '').startsWith('raw/') ? '可编辑' : '资料'}</span>
      </button>`
    }
    const children = knowledgeSortTreeNodes(node.children.values())
      .filter(child => !keepPaths || keepPaths.has(child.path))
    if (!children.length) return ''
    const open = searching || !knowledgeUi.collapsedDirs.has(node.path)
    const label = depth === 0 ? knowledgeRootDirectoryLabel(node) : node.name
    const countFiles = node => {
      if (node.type === 'file') return 1
      let total = 0
      for (const child of node.children.values()) total += countFiles(child)
      return total
    }
    const count = countFiles(node)
    return `<div class="knowledge-tree-dir${open ? ' open' : ''}" data-kos-dir="${esc(node.path)}">
      <button type="button" class="knowledge-tree-row knowledge-tree-folder" data-kos-toggle-dir="${esc(node.path)}" style="--kos-depth:${depth}" title="${esc(node.path)}" aria-expanded="${open ? 'true' : 'false'}">
        <span class="knowledge-tree-twist" aria-hidden="true">${open ? '▾' : '▸'}</span>
        <span class="knowledge-tree-ico knowledge-tree-ico-folder" aria-hidden="true"></span>
        <span class="knowledge-tree-label">${esc(label)}</span>
        <span class="knowledge-tree-count">${count}</span>
      </button>
      ${open ? `<div class="knowledge-tree-children">${children.map(child => renderNode(child, depth + 1)).join('')}</div>` : ''}
    </div>`
  }

  const roots = knowledgeSortTreeNodes(tree.children.values())
    .filter(child => !keepPaths || keepPaths.has(child.path))
  const rootFiles = roots.filter(n => n.type === 'file')
  const rootDirs = roots.filter(n => n.type === 'dir')
  return `<div class="knowledge-tree" id="kosTree">
    ${rootDirs.map(node => renderNode(node, 0)).join('')}
    ${rootFiles.length ? `<div class="knowledge-tree-section">${rootFiles.map(node => renderNode(node, 0)).join('')}</div>` : ''}
  </div>`
}

function knowledgeBrowserHtml() {
  const stats = {
    wiki: knowledgeUi.entries.filter(item => item.kind === 'wiki').length,
    okf: knowledgeUi.entries.filter(item => item.kind === 'okf').length,
  }
  return `<section class="knowledge-browser">
    <div class="knowledge-browser-head">
      <input class="knowledge-search" id="kosSearch" value="${esc(knowledgeUi.query)}" placeholder="搜索标题或路径…">
      <div class="knowledge-filters">
        <button type="button" class="knowledge-filter${knowledgeUi.filter === 'all' ? ' active' : ''}" data-kos-filter="all">全部 ${knowledgeUi.entries.length}</button>
        <button type="button" class="knowledge-filter${knowledgeUi.filter === 'wiki' ? ' active' : ''}" data-kos-filter="wiki">资料 ${stats.wiki}</button>
        <button type="button" class="knowledge-filter${knowledgeUi.filter === 'okf' ? ' active' : ''}" data-kos-filter="okf">已整理 ${stats.okf}</button>
      </div>
    </div>
    <div class="knowledge-entry-list" id="kosEntryList">${knowledgeEntryListHtml()}</div>
  </section>`
}

function wireKnowledgeTree(onFileClick, onFileDblClick) {
  const list = document.getElementById('kosEntryList')
  if (!list) return
  list.querySelectorAll('[data-kos-toggle-dir]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const dir = button.dataset.kosToggleDir
      if (!dir) return
      if (knowledgeUi.collapsedDirs.has(dir)) knowledgeUi.collapsedDirs.delete(dir)
      else knowledgeUi.collapsedDirs.add(dir)
      refreshKnowledgeEntryList(onFileClick, onFileDblClick)
    })
  })
  list.querySelectorAll('[data-kos-kind]').forEach(el => {
    el.addEventListener('click', () => onFileClick?.(el.dataset.kosKind, el.dataset.path))
    if (onFileDblClick) el.addEventListener('dblclick', () => onFileDblClick(el.dataset.kosKind, el.dataset.path))
  })
}

function wireKnowledgeEntries() {
  wireKnowledgeTree((kind, entryPath) => openKnowledgeEntry(kind, entryPath))
}

function refreshKnowledgeEntryList(onFileClick, onFileDblClick) {
  const list = document.getElementById('kosEntryList')
  if (!list) return
  list.innerHTML = knowledgeEntryListHtml()
  if (onFileClick) wireKnowledgeTree(onFileClick, onFileDblClick)
  else wireKnowledgeEntries()
}

function confirmDiscardKnowledgeRawEdit(nextPath = '') {
  if (!knowledgeUi.rawEditorDirty) return true
  if (nextPath && nextPath === knowledgeUi.rawEditorPath) return true
  return window.confirm('当前资料有未保存修改。放弃修改并继续吗？')
}

function clearKnowledgeRawEditorState() {
  knowledgeUi.rawEditorPath = null
  knowledgeUi.rawEditorHash = null
  knowledgeUi.rawEditorDirty = false
}

function renderKnowledgeRawEditor(reader, result, meta = {}) {
  let savedContent = String(result.content || '')
  let currentHash = result.hash || ''
  knowledgeUi.rawEditorPath = result.path
  knowledgeUi.rawEditorHash = currentHash
  knowledgeUi.rawEditorDirty = false
  const updated = result.updatedAt
    ? new Date(result.updatedAt).toLocaleString('zh-CN')
    : meta.updatedAt
      ? new Date(meta.updatedAt).toLocaleString('zh-CN')
      : '未知'
  reader.innerHTML = `<article class="knowledge-reader-inner knowledge-raw-document">
    <header class="knowledge-doc-head knowledge-raw-head">
      <div>
        <div class="knowledge-panel-kicker">可编辑资料</div>
        <h1>${esc(result.title || meta.title || '未命名资料')}</h1>
        <div class="knowledge-doc-path">${esc(result.path)}</div>
        <div class="knowledge-doc-meta"><span>保存在本机</span><span>${Number(result.bytes || savedContent.length).toLocaleString()} 字节</span><span>更新于 ${esc(updated)}</span></div>
        ${knowledgeDocActionsHtml({ editable: true })}
      </div>
      <div class="knowledge-raw-actions">
        <span class="knowledge-save-state" id="kosRawSaveState">已保存</span>
        <button type="button" class="knowledge-btn primary" id="kosRawSave" disabled>保存</button>
      </div>
    </header>
    <div class="knowledge-raw-editor-grid">
      <section class="knowledge-raw-editor-pane">
        <label for="kosRawEditor">正文</label>
        <textarea class="knowledge-raw-editor" id="kosRawEditor" spellcheck="true">${esc(savedContent)}</textarea>
      </section>
      <section class="knowledge-raw-preview-pane">
        <span>预览</span>
        <div class="knowledge-markdown" id="kosRawPreview">${renderKnowledgeMarkdown(savedContent)}</div>
      </section>
    </div>
  </article>`
  const editor = reader.querySelector('#kosRawEditor')
  const preview = reader.querySelector('#kosRawPreview')
  const saveButton = reader.querySelector('#kosRawSave')
  const saveState = reader.querySelector('#kosRawSaveState')
  const syncDirtyState = () => {
    const dirty = editor.value !== savedContent
    knowledgeUi.rawEditorDirty = dirty
    saveButton.disabled = !dirty
    saveState.textContent = dirty ? '未保存' : '已保存'
    saveState.classList.toggle('dirty', dirty)
    saveState.classList.remove('error')
    preview.innerHTML = renderKnowledgeMarkdown(editor.value)
  }
  const save = async () => {
    if (!knowledgeUi.rawEditorDirty || saveButton.disabled) return
    saveButton.disabled = true
    saveButton.textContent = '保存中…'
    saveState.textContent = '正在安全保存'
    const response = await window.api.knowledgeOsSaveRaw({
      path: result.path,
      content: editor.value,
      expectedHash: currentHash,
    })
    saveButton.textContent = '保存'
    if (!response?.ok) {
      saveButton.disabled = false
      saveState.textContent = response?.code === 'stale_content'
        ? '磁盘内容已变化，请重新载入'
        : (response?.error || '保存失败')
      saveState.classList.add('error')
      toast(response?.error || '资料保存失败', 'error')
      return
    }
    savedContent = editor.value
    currentHash = response.hash
    knowledgeUi.rawEditorHash = currentHash
    knowledgeUi.rawEditorDirty = false
    saveButton.disabled = true
    saveState.textContent = '已安全保存'
    saveState.classList.remove('dirty', 'error')
    toast('资料已保存并更新搜索', 'success', 1500)
  }
  wireKnowledgeDocActions(reader)
  editor.addEventListener('input', syncDirtyState)
  editor.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      save()
    }
  })
  saveButton.addEventListener('click', save)
}

async function openKnowledgeEntry(kind, entryPath) {
  if (!confirmDiscardKnowledgeRawEdit(entryPath)) return
  if (knowledgeUi.rawEditorPath !== entryPath) clearKnowledgeRawEditorState()
  knowledgeUi.selectedPath = entryPath
  refreshKnowledgeEntryList()
  const reader = document.getElementById('kosReader')
  if (!reader) return
  reader.innerHTML = '<div class="knowledge-reader-inner"><div class="knowledge-reader-empty"><p>正在读取条目…</p></div></div>'
  const r = await window.api.knowledgeOsRead({ kind, path: entryPath })
  if (!r?.ok) {
    reader.innerHTML = `<div class="knowledge-reader-inner"><div class="knowledge-result error">${esc(r?.error || '读取失败')}</div></div>`
    return
  }
  const meta = knowledgeUi.entries.find(item => item.path === entryPath) || {}
  if (r.editable || meta.editable || String(entryPath || '').startsWith('raw/')) {
    renderKnowledgeRawEditor(reader, r, meta)
    return
  }
  clearKnowledgeRawEditorState()
  const updated = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('zh-CN') : '未知'
  reader.innerHTML = `<article class="knowledge-reader-inner">
    <header class="knowledge-doc-head">
      <h1>${esc(r.title || meta.title || '未命名条目')}</h1>
      <div class="knowledge-doc-path">${esc(entryPath)}</div>
      <div class="knowledge-doc-meta"><span>${kind === 'okf' ? '已整理知识' : '知识资料'}</span><span>${Number(meta.chars || String(r.content || '').length).toLocaleString()} 字符</span><span>更新于 ${esc(updated)}</span><span>只读阅读</span></div>
      ${knowledgeDocActionsHtml({ editable: knowledgeEntryEditable(meta) })}
    </header>
    <div class="knowledge-markdown">${renderKnowledgeMarkdown(r.content || '')}</div>
  </article>`
  wireKnowledgeDocActions(reader)
}

function renderKnowledgeWelcome() {
  const reader = document.getElementById('kosReader')
  if (!reader) return
  clearKnowledgeRawEditorState()
  const materialCount = knowledgeUi.entries.filter(item => item.kind === 'wiki').length
  const organizedCount = knowledgeUi.entries.filter(item => item.kind === 'okf').length
  reader.innerHTML = `<div class="knowledge-reader-inner llmwiki-welcome">
    <div class="knowledge-reader-empty">
      <div class="knowledge-reader-empty-mark" aria-hidden="true">W</div>
      <h3>${knowledgeUi.entries.length ? '从左侧选择一份资料' : '你的 LLMWiki 还没有资料'}</h3>
      <p>${knowledgeUi.entries.length
        ? '阅读已整理知识，或打开 raw 资料继续编辑。'
        : '把文件放进资料目录，或直接添加第一份资料。'}</p>
      <div class="knowledge-home-actions">
        <button type="button" class="knowledge-btn primary" id="welcomeAdd">添加资料</button>
        <span class="llmwiki-welcome-count">${materialCount} 份资料 · ${organizedCount} 条已整理知识</span>
      </div>
    </div>
  </div>`
  reader.querySelector('#welcomeAdd')?.addEventListener('click', openKnowledgeAddModal)
}

function knowledgeEntryEditable(item) {
  return Boolean(item?.editable || String(item?.path || '').startsWith('raw/'))
}

/** 条目动作行：跟着文档头走，不再单独占一栏。 */
function knowledgeDocActionsHtml({ editable = false } = {}) {
  return `<div class="knowledge-doc-actions">
    <button type="button" class="knowledge-doc-action" id="kosDocOrganize">交给 AI 整理</button>
    <button type="button" class="knowledge-doc-action" id="kosDocReview">查看提案</button>
    ${editable ? '<button type="button" class="knowledge-doc-action" id="kosDocHealth">检查问题</button>' : ''}
  </div>`
}

function wireKnowledgeDocActions(host) {
  if (!host) return
  host.querySelector('#kosDocOrganize')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'organize'))
  host.querySelector('#kosDocReview')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'review'))
  host.querySelector('#kosDocHealth')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
}

function knowledgeIssueLabel(type) {
  return ({
    empty: '内容为空',
    duplicate_title: '标题可能重复',
    broken_link: '链接已经失效',
    unreadable: '文件无法读取',
    limit: '资料较多，未全部检查',
    missing_directory: '资料目录缺失',
    missing_manifest: '资料空间信息缺失',
    invalid_manifest: '资料空间信息损坏',
    unsupported_schema: '资料空间版本不兼容',
    unsupported_file_type: '文件类型不支持',
    symlink_forbidden: '链接目录不安全',
    scan_limit: '资料较多，未全部检查',
    harness_unavailable: '知识保护未连接',
  })[type] || '需要关注'
}

async function renderHealthPanel(trigger) {
  const reader = document.getElementById('kosReader')
  if (!reader) return
  const originalText = trigger?.textContent || ''
  if (trigger) { trigger.disabled = true; trigger.textContent = '正在体检…' }
  reader.innerHTML = '<div class="knowledge-reader-inner"><div class="knowledge-reader-empty"><p>正在检查空内容、重复标题和失效链接…</p></div></div>'
  const r = await (window.api.knowledgeCheck || window.api.knowledgeOsLint)()
  if (trigger) { trigger.disabled = false; trigger.textContent = originalText }
  if (!r?.ok) {
    reader.innerHTML = `<div class="knowledge-reader-inner"><div class="knowledge-result error">${esc(r?.error || '知识体检失败')}</div></div>`
    return
  }
  const issues = r.issues || []
  reader.innerHTML = `<div class="knowledge-reader-inner"><section class="knowledge-panel">
    <div class="knowledge-panel-kicker">Knowledge checkup</div><h2>${r.healthy ? '知识状态良好' : `发现 ${r.issueCount} 个需要关注的地方`}</h2>
    <p class="knowledge-panel-desc">已检查 ${r.scanned} 份资料。你可以先查看建议，再决定是否让 AI 协助整理。</p>
    <div class="knowledge-result ${r.healthy ? 'ok' : ''}">${issues.length
      ? issues.map((i, index) => `<div class="knowledge-issue"><button type="button" class="knowledge-issue-open" data-kos-issue-index="${index}" data-kos-issue-path="${esc(i.path || '')}"><strong>${esc(knowledgeIssueLabel(i.type))}</strong> · ${esc(i.path || '整个知识库')}</button><span>${esc(i.message)}</span></div>`).join('')
      : '暂未发现空内容、重复标题或失效链接。'}</div>
    ${issues.length ? '<div class="knowledge-form-actions"><button type="button" class="knowledge-btn primary" id="healthAskAi">让 AI 给出整理方案</button><button type="button" class="knowledge-btn" id="healthBackHome">返回整理首页</button></div>' : '<div class="knowledge-form-actions"><button type="button" class="knowledge-btn" id="healthBackHome">返回整理首页</button></div>'}
  </section></div>`
  reader.querySelectorAll('[data-kos-issue-path]').forEach(button => {
    button.addEventListener('click', () => {
      const issuePath = button.dataset.kosIssuePath
      if (!issuePath) return
      knowledgeUi.selectedPath = issuePath
      openKnowledgeOsPanel(undefined, 'browse')
    })
  })
  reader.querySelector('#healthBackHome')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'status'))
  reader.querySelector('#healthAskAi')?.addEventListener('click', () => {
    openAgentChat()
    requestAnimationFrame(() => {
      const input = document.getElementById('agentInput')
      if (!input) return
      input.value = `知识体检发现 ${r.issueCount} 个问题。请根据当前知识库给出整理方案，先解释影响和建议，任何文件修改都先让我预览并确认。`
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
    })
  })
}

function closeKnowledgeModal() {
  document.getElementById('knowledgeModalBackdrop')?.remove()
}

function openKnowledgeModal(title, bodyHtml) {
  closeKnowledgeModal()
  const workspace = drawerBody.querySelector('.knowledge-workspace')
  if (!workspace) return null
  workspace.insertAdjacentHTML('beforeend', `<div class="knowledge-modal-backdrop" id="knowledgeModalBackdrop">
    <section class="knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="knowledgeModalTitle">
      <header class="knowledge-modal-head"><h2 id="knowledgeModalTitle">${esc(title)}</h2><button type="button" class="knowledge-modal-close" id="knowledgeModalClose" aria-label="关闭">×</button></header>
      <div class="knowledge-modal-body">${bodyHtml}</div>
    </section>
  </div>`)
  const backdrop = document.getElementById('knowledgeModalBackdrop')
  backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeKnowledgeModal() })
  backdrop?.querySelector('#knowledgeModalClose')?.addEventListener('click', closeKnowledgeModal)
  return backdrop
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('knowledgeModalBackdrop')) closeKnowledgeModal()
})

function knowledgeProviderRowsHtml() {
  return knowledgeUi.providers.map(provider => {
    const remote = provider.kind === 'remote-rag'
    const active = provider.id === knowledgeUi.activeId
    return `<button type="button" class="knowledge-provider${active ? ' active' : ''}" data-knowledge-provider="${esc(provider.id)}">
      <span class="knowledge-provider-icon">${remote ? 'R' : 'W'}</span>
      <span class="knowledge-provider-copy">
        <span class="knowledge-provider-name">${esc(provider.displayName || (remote ? 'AI 检索源' : '本地知识库'))}${active ? ' · 当前' : ''}</span>
        <span class="knowledge-provider-type">${remote ? 'AI 检索源 · RAG' : '本地知识资料'}</span>
      </span>
      <span aria-hidden="true">${active ? '✓' : '›'}</span>
    </button>`
  }).join('')
}

function resetKnowledgeBrowseState() {
  knowledgeUi.selectedPath = null
  knowledgeUi.selectedProposalId = null
  knowledgeUi.query = ''
  knowledgeUi.filter = 'all'
  knowledgeUi.seededCollapse = false
  knowledgeUi.collapsedDirs = new Set()
  knowledgeUi.wikiRoot = null
}

function wireKnowledgeProviderRows(root) {
  root?.querySelectorAll('[data-knowledge-provider]').forEach(button => {
    button.addEventListener('click', async () => {
      const provider = knowledgeUi.providers.find(item => item.id === button.dataset.knowledgeProvider)
      if (!provider) return
      if (provider.id === knowledgeUi.activeId) {
        closeKnowledgeModal()
        if (provider.kind === 'remote-rag') renderRemoteRagModal(provider)
        else renderLocalConfigModal()
        return
      }
      button.disabled = true
      const result = await window.api.knowledgeProviderSetActive(provider.id)
      if (!result?.ok) { toast(result?.error || '切换失败', 'error'); button.disabled = false; return }
      closeKnowledgeModal()
      resetKnowledgeBrowseState()
      openKnowledgeOsPanel(undefined, knowledgeUi.page)
    })
  })
}

function renderKnowledgeSourcesPage() {
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    <main class="knowledge-page-main">
      <div class="knowledge-reader-inner">
        <section class="knowledge-panel">
          <div class="knowledge-panel-kicker">可选扩展</div>
          <h2>资料来源</h2>
          <p class="knowledge-panel-desc">“我的知识”始终可用。只有需要搜索其他系统时，才在这里添加外部来源。</p>
          <div class="knowledge-source-list">${knowledgeProviderRowsHtml()}</div>
          <div class="knowledge-form-actions" style="margin-top:18px">
            <button type="button" class="knowledge-btn primary" id="pageAddRemote">添加外部搜索来源</button>
            <button type="button" class="knowledge-btn" id="pageManageLocal">高级目录设置</button>
          </div>
        </section>
      </div>
    </main>
  </div>`
  wireKnowledgeProviderRows(drawerBody)
  drawerBody.querySelector('#pageAddRemote')?.addEventListener('click', () => renderRemoteRagModal(null))
  drawerBody.querySelector('#pageManageLocal')?.addEventListener('click', renderLocalConfigModal)
}

async function renderKnowledgeHealthWorkspace(active, list) {
  const stats = {
    total: (list.wiki?.length || 0) + (list.okf?.length || 0),
    wiki: list.wiki?.length || 0,
    okf: list.okf?.length || 0,
  }
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: '检查问题', kind: '安全检查', root: list.wikiRoot, stats })}
    <main class="knowledge-page-main">
      <div class="knowledge-reader-inner knowledge-panel">
        <div class="knowledge-panel-kicker">正在检查</div>
        <h2>查看资料是否可以安全读取和整理</h2>
        <div class="knowledge-result">正在检查目录、文件、重复标题和失效链接…</div>
      </div>
    </main>
  </div>`
  const [lint, harness] = await Promise.all([
    (window.api.knowledgeCheck || window.api.knowledgeOsLint)?.(),
    loadKnowledgeHarnessStatus(),
  ])
  const issues = Array.isArray(lint?.issues) ? [...lint.issues] : []
  if (harness?.unavailable) {
    issues.unshift({
      type: 'harness_unavailable',
      path: '',
      message: harness.error || '知识保护状态暂不可用，请重启 KnowMe',
    })
  }
  const healthy = lint?.ok && harness?.ok === true && !issues.length
  const main = drawerBody.querySelector('.knowledge-page-main')
  if (!main) return
  main.innerHTML = `<div class="knowledge-reader-inner knowledge-panel">
    <div class="knowledge-panel-kicker">${healthy ? '检查完成' : '发现需要处理的内容'}</div>
    <h2>${healthy ? '你的知识空间状态正常' : `发现 ${issues.length || harness?.issues?.length || 1} 个问题`}</h2>
    <p class="knowledge-panel-desc">${healthy
      ? '资料路径、可编辑边界和知识内容检查均已通过。'
      : 'KnowMe 不会自动覆盖有问题的文件。你可以先打开资料确认，再决定如何处理。'}</p>
    <div class="knowledge-form-actions">
      <button type="button" class="knowledge-btn primary" id="healthBackHome">返回我的知识</button>
      <button type="button" class="knowledge-btn" id="healthRunAgain">重新检查</button>
    </div>
    <div class="knowledge-health-list">
      ${healthy
        ? '<div class="knowledge-result ok">没有发现空内容、重复标题、失效链接或目录安全问题。</div>'
        : issues.map(issue => `<article class="knowledge-health-item">
            <span>${esc(knowledgeIssueLabel(issue.type))}</span>
            <strong>${esc(issue.path || '资料空间')}</strong>
            <p>${esc(issue.message || '需要检查')}</p>
            ${issue.path ? `<button type="button" data-health-entry="${esc(issue.path)}">打开资料</button>` : ''}
          </article>`).join('')}
    </div>
  </div>`
  main.querySelector('#healthBackHome')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'status'))
  main.querySelector('#healthRunAgain')?.addEventListener('click', () => renderKnowledgeHealthWorkspace(active, list))
  main.querySelectorAll('[data-health-entry]').forEach(button => {
    button.addEventListener('click', () => {
      knowledgeUi.selectedPath = button.dataset.healthEntry
      openKnowledgeOsPanel(undefined, 'browse')
    })
  })
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#kosRefresh')?.addEventListener('click', () => renderKnowledgeHealthWorkspace(active, list))
  drawerBody.querySelector('#kosLint')?.addEventListener('click', () => renderKnowledgeHealthWorkspace(active, list))
}

function governanceCategoryLabel(cat) {
  return ({
    wiki_lint: 'Wiki 体检',
    okf_lint: 'OKF 体检',
    broken_anchor: '悬空锚点',
    stale_anchor: '待重织',
    conflict: '概念冲突',
    duplicate_title: '重复标题',
  }[cat] || cat)
}

function governanceIssueActionLabel(action) {
  return ({
    locate: '定位来源',
    propose_cleanup: '清理提案',
    propose_relocate: '重定位提案',
    propose_reconcile: '调和提案',
    propose_fix: '修复提案',
    reweave: '重织',
    ignore: '忽略',
  }[action] || action)
}

function governanceHealthBar(score) {
  const pct = Math.round((Number(score) || 0) * 100)
  const cls = pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad'
  return `<div class="knowledge-gov-health-bar ${cls}" role="meter" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><strong>${pct}%</strong>`
}

function governanceIssueRowsHtml(issues = []) {
  if (!issues.length) return ''
  return issues.slice(0, 80).map((issue, idx) => {
    const actions = (issue.actions || []).map(act => `<button type="button" class="knowledge-btn knowledge-btn-sm" data-gov-action="${esc(act)}" data-gov-issue-index="${idx}">${esc(governanceIssueActionLabel(act))}</button>`).join('')
    return `<article class="knowledge-gov-issue ${esc(issue.severity || 'warn')}" data-gov-issue-index="${idx}">
      <header><span class="knowledge-gov-issue-cat">${esc(governanceCategoryLabel(issue.category))}</span><strong>${esc(issue.title || issue.path || issue.nodeId || '问题')}</strong></header>
      <p>${esc(issue.message || '')}</p>
      <div class="knowledge-form-actions knowledge-gov-issue-actions">${actions}</div>
    </article>`
  }).join('')
}

function governanceProposalRowsHtml(proposals = []) {
  const pending = proposals.filter(p => p.status === 'pending')
  if (!pending.length) return '<p class="knowledge-muted">暂无待审治理提案</p>'
  return pending.map(p => `<div class="knowledge-fabric-proposal" data-gov-proposal-id="${esc(p.id)}">
    <strong>${esc(p.title)}</strong><span class="knowledge-fabric-tag">${esc(p.type)}</span>
    <p>${esc(p.rationale || '')}</p>
    <div class="knowledge-form-actions">
      <button type="button" class="knowledge-btn primary knowledge-btn-sm" data-gov-proposal-apply="${esc(p.id)}">确认</button>
      <button type="button" class="knowledge-btn knowledge-btn-sm" data-gov-proposal-reject="${esc(p.id)}">拒绝</button>
    </div>
  </div>`).join('')
}

async function renderKnowledgeGovernanceWorkspace(active, list) {
  const { stats } = applyLocalKnowledgeWorkspaceState(active, list)
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: active.displayName || '本地知识库', kind: '知识治理', root: list.wikiRoot, stats })}
    <main class="knowledge-page-main knowledge-governance-page" id="knowledgeGovernanceMain">
      <section class="knowledge-panel">
        <div class="knowledge-panel-kicker">Fabric governance</div>
        <h2>联合体检</h2>
        <p class="knowledge-panel-desc">跨库 lint、悬空锚点、新鲜度、冲突与 SSOT 重复，一键扫描并生成可执行提案。</p>
        <div class="knowledge-form-actions">
          <button type="button" class="knowledge-btn primary" id="govRunCheckup">运行体检</button>
          <button type="button" class="knowledge-btn" id="govProcessReweave">处理重织队列</button>
          <button type="button" class="knowledge-btn" id="govOpenConnect">连接更多库</button>
        </div>
        <div class="knowledge-gov-ssot-mode">
          <label for="govSsotMode">SSOT 强度</label>
          <select class="knowledge-select" id="govSsotMode">
            <option value="mark">允许但标记冲突</option>
            <option value="block">阻断重复入库</option>
          </select>
        </div>
      </section>
      <div id="govReportHost"><div class="knowledge-reader-empty"><p>尚未运行体检。点击「运行体检」开始扫描。</p></div></div>
    </main>
  </div>`
  const cfg = await window.api.fabricGovernanceConfig?.()
  const modeSel = drawerBody.querySelector('#govSsotMode')
  if (modeSel && cfg?.config?.ssotMode) modeSel.value = cfg.config.ssotMode
  modeSel?.addEventListener('change', async () => {
    await window.api.fabricGovernanceConfig?.({ ssotMode: modeSel.value })
    toast('已更新 SSOT 策略', 'success', 1400)
  })
  drawerBody.querySelector('#govOpenConnect')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#govProcessReweave')?.addEventListener('click', e => {
    runAsyncKnowledgeButton(e.currentTarget, { busyLabel: '重织中…', idleLabel: '处理重织队列' }, async () => {
      const r = await window.api.fabricReweaveRun?.({ max: 2 })
      if (!r?.ok) { toast(r?.error || '重织失败', 'error'); return }
      toast(r.processed?.length ? `已处理 ${r.processed.length} 个库的重织` : '重织队列为空', 'success')
      await refreshGovernanceReport()
    })
  })
  drawerBody.querySelector('#govRunCheckup')?.addEventListener('click', e => {
    runAsyncKnowledgeButton(e.currentTarget, { busyLabel: '体检中…', idleLabel: '运行体检' }, refreshGovernanceReport)
  })
  wireGovernanceReportActions(drawerBody)
  if (knowledgeUi.governanceReport?.ok) renderGovernanceReportHost(knowledgeUi.governanceReport)
}

async function refreshGovernanceReport() {
  const [report, proposals] = await Promise.all([
    window.api.fabricGovernanceCheckup?.(),
    window.api.fabricGovernanceProposals?.(),
  ])
  if (!report?.ok) { toast(report?.error || '体检失败', 'error'); return }
  knowledgeUi.governanceReport = report
  knowledgeUi.governanceProposals = proposals?.proposals || []
  renderGovernanceReportHost(report)
  wireGovernanceReportActions(drawerBody)
}

function renderGovernanceReportHost(report) {
  const host = document.getElementById('govReportHost')
  if (!host) return
  const categories = report.categories || {}
  const catChips = Object.entries(categories).map(([k, n]) => `<span class="knowledge-gov-chip">${esc(governanceCategoryLabel(k))} ${n}</span>`).join('')
  const kbHealth = report.kbHealth || {}
  const kbRows = Object.entries(kbHealth).map(([kbId, score]) => `<div class="knowledge-gov-kb-row"><span>${esc(kbId)}</span>${governanceHealthBar(score)}</div>`).join('')
  const emptyAction = report.healthy
    ? '<p class="knowledge-muted">知识织网状态良好。可定期运行体检或连接更多外挂库。</p>'
    : ''
  host.innerHTML = `<section class="knowledge-panel knowledge-gov-summary">
    <h2>${report.healthy ? '状态良好' : `发现 ${report.issueCount} 项需关注`}</h2>
    <p class="knowledge-panel-desc">整体健康 ${Math.round((report.overallHealth || 0) * 100)}% · Wiki 扫描 ${report.wikiScanned || 0} 份 · SSOT：${report.ssotMode === 'block' ? '阻断' : '标记'}</p>
    <div class="knowledge-gov-overall">${governanceHealthBar(report.overallHealth || 1)}</div>
    ${catChips ? `<div class="knowledge-gov-chips">${catChips}</div>` : ''}
    ${kbRows ? `<div class="knowledge-gov-kb-health"><h3>各库健康分</h3>${kbRows}</div>` : ''}
    ${emptyAction}
  </section>
  <section class="knowledge-panel"><h3>待审治理提案</h3>${governanceProposalRowsHtml(knowledgeUi.governanceProposals)}</section>
  <section class="knowledge-panel"><h3>问题清单</h3><div class="knowledge-gov-issues">${report.issues?.length
    ? governanceIssueRowsHtml(report.issues)
    : `<div class="knowledge-fabric-empty compact"><strong>暂无问题</strong><p>可连接更多资料库或定期运行体检。</p><button type="button" class="knowledge-btn" id="govEmptyConnect">连接资料</button></div>`}</div></section>`
  host.querySelector('#govEmptyConnect')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
}

function wireGovernanceReportActions(root = drawerBody) {
  root?.querySelectorAll('[data-gov-proposal-apply]').forEach(btn => {
    btn.addEventListener('click', () => runAsyncKnowledgeButton(btn, { busyLabel: '…', idleLabel: '确认' }, async () => {
      const r = await window.api.fabricGovernanceProposalApply?.(btn.dataset.govProposalApply)
      if (!r?.ok) { toast(r?.error || '应用失败', 'error'); return }
      toast('已应用治理提案', 'success')
      await refreshGovernanceReport()
    }))
  })
  root?.querySelectorAll('[data-gov-proposal-reject]').forEach(btn => {
    btn.addEventListener('click', () => runAsyncKnowledgeButton(btn, { busyLabel: '…', idleLabel: '拒绝' }, async () => {
      const r = await window.api.fabricGovernanceProposalReject?.(btn.dataset.govProposalReject)
      if (!r?.ok) { toast(r?.error || '拒绝失败', 'error'); return }
      toast('已拒绝提案', 'success')
      await refreshGovernanceReport()
    }))
  })
  root?.querySelectorAll('[data-gov-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.govIssueIndex)
      const issue = knowledgeUi.governanceReport?.issues?.[idx]
      const action = btn.dataset.govAction
      if (!issue) return
      if (action === 'locate') {
        if (issue.path) {
          knowledgeUi.selectedPath = issue.path
          openKnowledgeOsPanel(undefined, 'browse')
        } else if (issue.kbId) {
          openKnowledgeOsPanel(undefined, 'fabric')
        } else {
          toast('请从织网或整理页查看节点', 'info')
        }
        return
      }
      runAsyncKnowledgeButton(btn, { busyLabel: '…', idleLabel: btn.textContent }, async () => {
        const r = await window.api.fabricGovernanceAction?.({ issue, action })
        if (!r?.ok) { toast(r?.error || '操作失败', 'error'); return }
        toast(action === 'ignore' ? '已忽略该项' : '已生成提案', 'success')
        await refreshGovernanceReport()
      })
    })
  })
}

function renderKnowledgeSourcesModal() {
  const modal = openKnowledgeModal('知识源', `<section class="knowledge-panel">
    <p class="knowledge-panel-desc">选择当前对话和检索使用的知识库。目录与连接配置仅在需要时打开，不占用工作台空间。</p>
    <div class="knowledge-source-list">${knowledgeProviderRowsHtml()}</div>
    <div class="knowledge-form-actions" style="margin-top:18px">
      <button type="button" class="knowledge-btn" id="modalAddRemote">添加 AI 检索源</button>
      <button type="button" class="knowledge-btn" id="modalManageLocal">管理本地目录</button>
    </div>
  </section>`)
  if (!modal) return
  wireKnowledgeProviderRows(modal)
  modal.querySelector('#modalAddRemote')?.addEventListener('click', () => { closeKnowledgeModal(); renderRemoteRagModal(null) })
  modal.querySelector('#modalManageLocal')?.addEventListener('click', () => { closeKnowledgeModal(); renderLocalConfigModal() })
}

async function renderLocalConfigModal() {
  const modal = openKnowledgeModal('管理本地知识源', '<div class="knowledge-panel-desc">正在读取本地目录…</div>')
  if (!modal) return
  const [cfgRes, src] = await Promise.all([window.api.knowledgeOsConfig(), window.api.sourcesList()])
  const cfg = cfgRes?.config || {}
  const sources = src?.sources || []
  const options = ['<option value="">应用默认 Wiki 目录</option>']
    .concat(sources.map(s => `<option value="${esc(s.id)}"${s.id === cfg.spaceSourceId ? ' selected' : ''}>${esc(s.name || s.rootPath || s.id)}</option>`))
    .join('')
  const body = modal.querySelector('.knowledge-modal-body')
  if (!body) return
  body.innerHTML = `<section class="knowledge-panel">
    <div class="knowledge-panel-kicker">Local Source</div>
    <p class="knowledge-panel-desc">选择已有内容源中的 LLM Wiki 空间，或直接绑定一个本地文件夹并指定子目录。</p>
    <div class="knowledge-form">
      <div class="knowledge-form-row"><label for="locSpace">内容源空间</label><select class="knowledge-select" id="locSpace">${options}</select></div>
      <div class="knowledge-form-row"><label for="locSubDir">子目录（相对空间根，可留空）</label><input class="knowledge-input" id="locSubDir" value="${esc(cfg.subDir || '')}" placeholder="例如：wiki"></div>
      <div class="knowledge-form-actions">
        <button type="button" class="knowledge-btn primary" id="locSave">保存绑定</button>
        <button type="button" class="knowledge-btn" id="locPick">选择本地文件夹…</button>
      </div>
    </div>
    <div class="knowledge-result">目录安全：子目录不得越出空间根。绑定 LLM Wiki 根可同时浏览资料与已整理知识；只绑定聚焦目录可减少首次分析范围。</div>
  </section>`
  body.querySelector('#locSave')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true
    const r = await window.api.knowledgeProviderSave({
      kind: 'local',
      spaceSourceId: document.getElementById('locSpace').value || null,
      subDir: document.getElementById('locSubDir').value.trim(),
    })
    if (!r?.ok) { toast(r?.error || '保存失败', 'error'); e.currentTarget.disabled = false; return }
    knowledgeUi.selectedPath = null
    closeKnowledgeModal()
    toast('已更新本地知识库绑定', 'success')
    openKnowledgeOsPanel(undefined, knowledgeUi.page)
  })
  body.querySelector('#locPick')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true
    const added = await window.api.sourcesAddLocal()
    if (added?.canceled) { e.currentTarget.disabled = false; return }
    if (!added?.ok || !added.source?.id) { toast(added?.error || '添加本地目录失败', 'error'); e.currentTarget.disabled = false; return }
    const saved = await window.api.knowledgeProviderSave({ kind: 'local', spaceSourceId: added.source.id, subDir: '' })
    if (!saved?.ok) { toast(saved?.error || '绑定失败', 'error'); e.currentTarget.disabled = false; return }
    knowledgeUi.selectedPath = null
    closeKnowledgeModal()
    toast('已绑定所选知识资料目录', 'success')
    openKnowledgeOsPanel(undefined, knowledgeUi.page)
  })
}

async function renderObsidianBridgeModal() {
  const modal = openKnowledgeModal('在 Obsidian 中继续', '<div class="knowledge-panel-desc">正在检查 Obsidian 与当前知识库…</div>')
  if (!modal) return
  const result = await window.api.obsidianStatus()
  const body = modal.querySelector('.knowledge-modal-body')
  if (!body) return
  if (!result?.ok) {
    body.innerHTML = `<div class="knowledge-result error">${esc(result?.error || '无法检查 Obsidian 状态')}</div>`
    return
  }

  const installed = !!result.installed
  const directGraph = installed && !!result.directGraph
  const stateLabel = !installed ? '尚未安装' : directGraph ? '可直达图谱' : '已安装'
  const stateClass = installed ? ' ready' : ''
  const primaryLabel = !installed ? '下载 Obsidian' : directGraph ? '打开全局图谱' : '打开当前 Wiki'
  const graphSource = result.bridgeInstalled
    ? 'KnowMe Bridge 已启用'
    : result.advancedUriInstalled
      ? '已通过 Advanced URI 兼容'
      : '启用 KnowMe Bridge 后可一键进入图谱'
  body.innerHTML = `<section class="obsidian-handoff">
    <div class="obsidian-handoff-mark" aria-hidden="true">O</div>
    <div class="obsidian-handoff-copy">
      <div class="knowledge-panel-kicker">Editing handoff</div>
      <h2>把深度编辑与图谱交给 Obsidian</h2>
      <p>KnowMe 负责知识整理与 AI 使用；Obsidian 负责人工编辑、双链浏览和全局图谱。</p>
    </div>
    <div class="obsidian-handoff-root"><span>当前知识库</span><code title="${esc(result.wikiRoot || '')}">${esc(result.wikiRoot || '未绑定目录')}</code></div>
    <div class="obsidian-handoff-state${stateClass}">
      <span class="obsidian-state-dot"></span>
      <strong>${esc(stateLabel)}</strong>
      <span>${!installed
        ? '使用 Obsidian 官方安装包'
        : graphSource}</span>
    </div>
    <div class="knowledge-form-actions">
      <button type="button" class="knowledge-btn primary" id="obsidianPrimary">${esc(primaryLabel)}</button>
      ${installed && !directGraph ? '<button type="button" class="knowledge-btn" id="obsidianBridgeSetup">启用图谱直达</button>' : ''}
    </div>
    <div class="obsidian-handoff-boundary">
      <div><strong>KnowMe</strong><span>懂你的知识网 · AI 检索 · 冲突与长期维护</span></div>
      <div><strong>Obsidian</strong><span>人工编辑 · 双链浏览 · 全局图谱</span></div>
    </div>
  </section>`

  body.querySelector('#obsidianPrimary')?.addEventListener('click', async event => {
    const button = event.currentTarget
    button.disabled = true
    button.textContent = installed ? '正在打开…' : '正在前往官方下载…'
    const action = installed ? await window.api.obsidianOpen() : await window.api.obsidianInstall()
    button.disabled = false
    button.textContent = primaryLabel
    if (!action?.ok) {
      toast(action?.error || '操作失败', 'error')
      return
    }
    if (!installed) {
      toast('已打开 Obsidian 官方下载页；安装后返回这里重新检查', 'success')
      return
    }
    toast(
      action.directGraph
        ? '已在 Obsidian 打开全局图谱'
        : action.vaultCreated
          ? '已登记并打开当前 Wiki'
          : '已在 Obsidian 打开当前 Wiki',
      'success'
    )
  })
  body.querySelector('#obsidianBridgeSetup')?.addEventListener('click', () => {
    body.innerHTML = `<section class="obsidian-consent">
      <div class="knowledge-panel-kicker">One-time setup</div>
      <h2>启用 KnowMe 图谱桥接？</h2>
      <p>KnowMe 将为当前知识库安装一个本地小插件，只负责接收“打开全局图谱”指令。</p>
      <div class="obsidian-permission-list">
        <div><strong>会写入</strong><code>.obsidian/plugins/knowme-bridge/</code></div>
        <div><strong>会启用</strong><span>KnowMe Bridge</span></div>
        <div><strong>不会做</strong><span>读取正文、联网、修改其他插件</span></div>
      </div>
      <p class="obsidian-consent-note">安装后需重新加载或重启一次 Obsidian。取消不会修改任何文件。</p>
      <div class="knowledge-form-actions">
        <button type="button" class="knowledge-btn primary" id="obsidianBridgeConfirm">确认启用</button>
        <button type="button" class="knowledge-btn" id="obsidianBridgeCancel">取消</button>
      </div>
    </section>`
    body.querySelector('#obsidianBridgeCancel')?.addEventListener('click', renderObsidianBridgeModal)
    body.querySelector('#obsidianBridgeConfirm')?.addEventListener('click', async event => {
      const button = event.currentTarget
      button.disabled = true
      button.textContent = '正在启用…'
      const action = await window.api.obsidianBridgeInstall()
      if (!action?.ok) {
        button.disabled = false
        button.textContent = '确认启用'
        toast(action?.error || '启用失败', 'error')
        return
      }
      body.innerHTML = `<section class="obsidian-consent complete">
        <div class="obsidian-setup-check" aria-hidden="true">✓</div>
        <h2>图谱桥接已安装</h2>
        <p>请重新加载或重启一次 Obsidian。之后 KnowMe 会直接打开当前知识库的全局图谱。</p>
        <div class="knowledge-form-actions">
          <button type="button" class="knowledge-btn primary" id="obsidianSetupDone">我知道了</button>
        </div>
      </section>`
      body.querySelector('#obsidianSetupDone')?.addEventListener('click', renderObsidianBridgeModal)
    })
  })
}

function knowledgeLatestTask() {
  return [...(knowledgeUi.taskSnapshot?.tasks || [])]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null
}

function knowledgePendingProposals() {
  return (knowledgeUi.taskSnapshot?.proposals || []).filter(item => item.status === 'draft')
}

function knowledgeTaskStatusLabel(status) {
  return ({
    idle: '待开始',
    scanning: '扫描资料',
    analyzing: 'AI 分析中',
    review: '等待审核',
    committing: '正在写入',
    completed: '已完成',
    failed: '处理失败',
    cancelled: '已取消',
  })[status] || '待处理'
}

function knowledgeOrganizerHtml(active, list) {
  const latest = knowledgeLatestTask()
  const pending = knowledgePendingProposals()
  const wikiCount = list.wiki?.length || 0
  const okfCount = list.okf?.length || 0
  const nextTitle = pending.length
    ? `有 ${pending.length} 条整理提案等待确认`
    : latest?.status === 'completed'
      ? '继续整理新增或变更资料'
      : wikiCount
        ? '让 AI 先分析这份 LLM Wiki'
        : '先绑定一份 LLM Wiki'
  return `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({
      name: active.displayName || '本地 LLM Wiki',
      kind: 'AI 知识整理',
      root: list.wikiRoot,
      stats: { total: wikiCount + okfCount, wiki: wikiCount, okf: okfCount },
    })}
    <main class="knowledge-page-main">
      <div class="knowledge-reader-inner knowledge-organizer">
        <section class="knowledge-organizer-hero">
          <div class="knowledge-panel-kicker">AI knowledge steward</div>
          <h1>${esc(nextTitle)}</h1>
          <p>KnowMe 会读取 LLM Wiki，生成带来源的整理提案。原始资料不会被覆盖，只有你确认后才会写入正式知识。</p>
          <div class="knowledge-organizer-actions">
            ${pending.length
              ? '<button type="button" class="knowledge-btn primary" id="kosReviewPending">查看待审核提案</button>'
              : '<button type="button" class="knowledge-btn primary" id="kosStartAi">开始 AI 整理</button>'}
            <button type="button" class="knowledge-btn" id="kosBrowseMaterials">浏览资料</button>
            <button type="button" class="knowledge-btn" id="kosHealth">先做体检</button>
          </div>
        </section>
        <section class="knowledge-organizer-stats" aria-label="知识状态">
          <div><span>原始资料</span><strong>${wikiCount}</strong><small>来自当前 LLM Wiki</small></div>
          <div><span>已整理知识</span><strong>${okfCount}</strong><small>可稳定复用的概念</small></div>
          <div><span>待审核</span><strong class="${pending.length ? 'attention' : ''}">${pending.length}</strong><small>${pending.length ? '需要你的确认' : '暂无待处理提案'}</small></div>
        </section>
        <section class="knowledge-organizer-task">
          <div class="knowledge-organizer-section-head"><div><div class="knowledge-panel-kicker">Start a task</div><h2>选择整理范围</h2></div><span>默认只处理新增或变更资料</span></div>
          <div class="knowledge-scope-options" role="radiogroup" aria-label="整理范围">
            <label class="knowledge-scope-option active"><input type="radio" name="kosScope" value="changed" checked><strong>新增或变更</strong><span>优先处理最近更新的资料</span></label>
            <label class="knowledge-scope-option"><input type="radio" name="kosScope" value="all"><strong>全部资料</strong><span>重新分析当前 LLM Wiki</span></label>
            <label class="knowledge-scope-option"><input type="radio" name="kosScope" value="topic"><strong>指定主题</strong><span>按标题或目录筛选</span></label>
          </div>
          <input class="knowledge-input" id="kosTopic" placeholder="指定主题时输入关键词，例如：Agent Runtime" disabled>
          <div class="knowledge-form-actions"><button type="button" class="knowledge-btn primary" id="kosStartAiSecondary">开始整理</button><button type="button" class="knowledge-btn" id="kosSources">管理知识源</button></div>
        </section>
        <section class="knowledge-organizer-task-state" aria-live="polite">
          <div class="knowledge-organizer-section-head"><div><div class="knowledge-panel-kicker">Latest task</div><h2>最近一次整理</h2></div>${latest ? `<span class="knowledge-task-status ${latest.status}">${esc(knowledgeTaskStatusLabel(latest.status))}</span>` : '<span>尚未开始</span>'}</div>
          ${latest
          ? `<div class="knowledge-task-progress"><div class="knowledge-task-progress-row"><strong>${esc(knowledgeTaskStatusLabel(latest.status))}</strong><span>${latest.analyzed || 0}/${latest.total || 0} 份资料 · ${latest.proposalCount || 0} 条提案</span></div><div class="knowledge-progress-track"><i style="width:${latest.total ? Math.min(100, Math.round((latest.analyzed || 0) / latest.total * 100)) : latest.status === 'completed' ? 100 : 0}%"></i></div>${latest.error ? `<p class="knowledge-task-error">${esc(latest.error)}</p>` : ''}<div class="knowledge-form-actions">${['scanning', 'analyzing'].includes(latest.status) ? '<button type="button" class="knowledge-btn" id="kosCancelTask">取消任务</button>' : ''}${['failed', 'cancelled'].includes(latest.status) ? '<button type="button" class="knowledge-btn" id="kosRetryTask">继续任务</button>' : ''}${latest.status === 'review' ? '<button type="button" class="knowledge-btn" id="kosReviewTask">打开审核</button>' : ''}</div></div>`
            : '<div class="knowledge-task-empty">还没有整理任务。建议先从“新增或变更”开始。</div>'}
        </section>
      </div>
    </main>
  </div>`
}

async function loadKnowledgeTaskSnapshot() {
  const result = await window.api.knowledgeStewardTaskList?.()
  knowledgeUi.taskSnapshot = result?.ok
    ? { tasks: result.tasks || [], proposals: result.proposals || [] }
    : { tasks: [], proposals: [] }
  return knowledgeUi.taskSnapshot
}

async function loadKnowledgeHarnessStatus() {
  if (typeof window.api?.knowledgeOsHarnessStatus !== 'function') {
    return { ok: null, unavailable: true, error: '知识保护状态暂不可用，请重启 KnowMe' }
  }
  try {
    return await window.api.knowledgeOsHarnessStatus()
  } catch (error) {
    console.warn('[knowledge] harness status unavailable', error?.message || String(error))
    return { ok: null, unavailable: true, error: '知识保护状态暂不可用，请重启 KnowMe' }
  }
}

async function startKnowledgeOrganization() {
  const selected = document.querySelector('input[name="kosScope"]:checked')?.value || 'changed'
  const topic = document.getElementById('kosTopic')?.value?.trim() || ''
  if (selected === 'topic' && !topic) {
    toast('请先输入要整理的主题', 'info')
    document.getElementById('kosTopic')?.focus()
    return
  }
  const buttons = [...drawerBody.querySelectorAll('#kosStartAi,#kosStartAiSecondary')]
  buttons.forEach(button => { button.disabled = true; button.textContent = '正在分析…' })
  const result = await window.api.knowledgeStewardTaskCreate?.({
    scope: { mode: selected, topic },
  })
  buttons.forEach(button => { button.disabled = false; button.textContent = button.id === 'kosStartAi' ? '开始 AI 整理' : '开始整理' })
  if (!result?.ok) {
    toast(result?.error || '整理任务启动失败', 'error')
    return
  }
  toast(result.proposals?.length ? `已生成 ${result.proposals.length} 条整理提案` : '整理任务已完成，暂无新提案', 'success')
  await openKnowledgeOsPanel(undefined, result.proposals?.length ? 'review' : 'organize')
}

function wireKnowledgeOrganizer() {
  drawerBody.querySelector('#kosStartAi')?.addEventListener('click', startKnowledgeOrganization)
  drawerBody.querySelector('#kosStartAiSecondary')?.addEventListener('click', startKnowledgeOrganization)
  drawerBody.querySelector('#kosReviewPending')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'review'))
  drawerBody.querySelector('#kosReviewTask')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'review'))
  drawerBody.querySelector('#kosBrowseMaterials')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'browse'))
  drawerBody.querySelector('#kosHealth')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
  drawerBody.querySelector('#kosSources')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#kosRetryTask')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    const latest = knowledgeLatestTask()
    const result = await window.api.knowledgeStewardTaskRetry?.(latest?.id)
    if (!result?.ok) toast(result?.error || '重试失败', 'error')
    await openKnowledgeOsPanel(undefined, result?.proposals?.length ? 'review' : 'organize')
  })
  drawerBody.querySelector('#kosCancelTask')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    const latest = knowledgeLatestTask()
    const result = await window.api.knowledgeStewardTaskCancel?.(latest?.id)
    if (!result?.ok) toast(result?.error || '取消失败', 'error')
    await openKnowledgeOsPanel(undefined, 'organize')
  })
  drawerBody.querySelectorAll('input[name="kosScope"]').forEach(input => {
    input.addEventListener('change', () => {
      drawerBody.querySelectorAll('.knowledge-scope-option').forEach(option => option.classList.toggle('active', option.querySelector('input') === input))
      const topic = document.getElementById('kosTopic')
      if (topic) {
        topic.disabled = input.value !== 'topic'
        if (input.value !== 'topic') topic.value = ''
      }
    })
  })
}

async function renderKnowledgeOrganizerWorkspace(active, list) {
  await loadKnowledgeTaskSnapshot()
  drawerBody.innerHTML = knowledgeOrganizerHtml(active, list)
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#kosRefresh')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'organize'))
  drawerBody.querySelector('#kosLint')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
  wireKnowledgeOrganizer()
}

function knowledgeProposalListHtml(proposals) {
  if (!proposals.length) return '<div class="knowledge-task-empty">没有等待确认的建议。AI 整理不会直接改写稳定知识。</div>'
  return proposals.map(item => `<button type="button" class="knowledge-proposal-row${item.id === knowledgeUi.selectedProposalId ? ' active' : ''}" data-kos-proposal="${esc(item.id)}">
    <span class="knowledge-proposal-main"><strong>${esc(item.title || '未命名提案')}</strong><small>${esc(item.sourcePath || '未知来源')}</small></span>
    <span class="knowledge-proposal-confidence">${Math.round((Number(item.confidence) || 0) * 100)}%</span>
  </button>`).join('')
}

function renderKnowledgeProposalReader(proposal) {
  const reader = document.getElementById('kosProposalReader')
  if (!reader) return
  if (!proposal) {
    reader.innerHTML = '<div class="knowledge-reader-empty"><h3>没有需要处理的内容</h3><p>AI 产生整理建议后，会先放在这里等你决定。</p></div>'
    return
  }
  reader.innerHTML = `<article class="knowledge-proposal-detail">
    <div class="knowledge-panel-kicker">整理建议</div>
    <h1>${esc(proposal.title || '未命名建议')}</h1>
    <div class="knowledge-proposal-meta"><span>来自：${esc(proposal.sourcePath || '未知资料')}</span><span>建议保存为：${esc(proposal.targetPath || '新知识')}</span><span>参考可信度：${Math.round((Number(proposal.confidence) || 0) * 100)}%</span></div>
    <p class="knowledge-proposal-rationale">${esc(proposal.rationale || '暂无说明')}</p>
    <details class="knowledge-proposal-source"><summary>查看来源条目</summary><pre id="kosSourcePreview">正在读取来源…</pre></details>
    <div class="knowledge-proposal-content"><label class="knowledge-proposal-edit-label" for="kosProposalDraft">整理后的知识内容，可在接受前编辑</label><textarea class="knowledge-textarea knowledge-proposal-editor" id="kosProposalDraft">${esc(proposal.proposedContent || proposal.body || '')}</textarea></div>
    <div class="knowledge-form-actions"><button type="button" class="knowledge-btn primary" id="kosAcceptProposal">接受并写入</button><button type="button" class="knowledge-btn" id="kosSnoozeProposal">稍后处理</button><button type="button" class="knowledge-btn" id="kosRejectProposal">拒绝</button><button type="button" class="knowledge-btn" id="kosOpenProposalSource">查看来源</button></div>
  </article>`
  window.api.knowledgeOsRead?.({ kind: 'wiki', path: proposal.sourcePath }).then(result => {
    const source = document.getElementById('kosSourcePreview')
    if (source) source.textContent = result?.ok ? result.content : (result?.error || '来源读取失败')
  }).catch(() => {
    const source = document.getElementById('kosSourcePreview')
    if (source) source.textContent = '来源读取失败'
  })
  reader.querySelector('#kosAcceptProposal')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    const result = await window.api.knowledgeStewardProposalAccept?.({
      id: proposal.id,
      content: document.getElementById('kosProposalDraft')?.value || '',
    })
    if (!result?.ok) {
      toast(result?.error || '提案写入失败', 'error')
      event.currentTarget.disabled = false
      return
    }
    toast('提案已接受并写入知识库', 'success')
    await openKnowledgeOsPanel(undefined, 'review')
  })
  reader.querySelector('#kosSnoozeProposal')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    const result = await window.api.knowledgeStewardProposalSnooze?.(proposal.id)
    if (!result?.ok) toast(result?.error || '暂存失败', 'error')
    await openKnowledgeOsPanel(undefined, 'review')
  })
  reader.querySelector('#kosRejectProposal')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    const result = await window.api.knowledgeStewardProposalReject?.(proposal.id)
    if (!result?.ok) toast(result?.error || '拒绝提案失败', 'error')
    await openKnowledgeOsPanel(undefined, 'review')
  })
  reader.querySelector('#kosOpenProposalSource')?.addEventListener('click', () => {
    knowledgeUi.selectedPath = proposal.sourcePath
    openKnowledgeOsPanel(undefined, 'browse')
  })
}

async function renderKnowledgeReviewWorkspace(active, list) {
  await loadKnowledgeTaskSnapshot()
  const proposals = knowledgePendingProposals()
  if (!knowledgeUi.selectedProposalId || !proposals.some(item => item.id === knowledgeUi.selectedProposalId)) {
    knowledgeUi.selectedProposalId = proposals[0]?.id || null
  }
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: '待我确认', kind: '整理建议', root: list.wikiRoot, stats: { total: (list.wiki?.length || 0) + (list.okf?.length || 0), wiki: list.wiki?.length || 0, okf: list.okf?.length || 0 } })}
    <div class="knowledge-review-grid">
      <section class="knowledge-proposal-list"><div class="knowledge-browser-head"><div class="knowledge-panel-kicker">AI 整理建议</div><h2>等待你的决定 <span>${proposals.length}</span></h2></div><div class="knowledge-entry-list" id="kosProposalList">${knowledgeProposalListHtml(proposals)}</div></section>
      <main class="knowledge-reader" id="kosProposalReader"></main>
    </div>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#kosRefresh')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'review'))
  drawerBody.querySelector('#kosLint')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
  drawerBody.querySelectorAll('[data-kos-proposal]').forEach(button => {
    button.addEventListener('click', () => {
      knowledgeUi.selectedProposalId = button.dataset.kosProposal
      drawerBody.querySelectorAll('[data-kos-proposal]').forEach(item => item.classList.toggle('active', item === button))
      renderKnowledgeProposalReader(proposals.find(item => item.id === knowledgeUi.selectedProposalId))
    })
  })
  renderKnowledgeProposalReader(proposals.find(item => item.id === knowledgeUi.selectedProposalId))
}

function applyLocalKnowledgeWorkspaceState(active, list) {
  const entries = [...(list.wiki || []).map(x => ({ ...x, kind: 'wiki' })), ...(list.okf || []).map(x => ({ ...x, kind: 'okf' }))]
  if (knowledgeUi.wikiRoot !== list.wikiRoot) {
    knowledgeUi.wikiRoot = list.wikiRoot
    knowledgeUi.seededCollapse = false
    knowledgeUi.collapsedDirs = new Set()
  }
  knowledgeUi.entries = entries
  knowledgeUi.localList = list
  knowledgeUi.activeProvider = active
  const stats = { total: entries.length, wiki: list.wiki?.length || 0, okf: list.okf?.length || 0 }
  return { entries, stats }
}

async function saveKnowledgeMaterial({ text, title } = {}) {
  const body = String(text || '').trim()
  if (!body) return { ok: false, error: '请输入内容' }
  const addMaterial = window.api.knowledgeAddMaterial || window.api.knowledgeOsIngest
  if (!addMaterial) return { ok: false, error: '无法保存资料' }
  const r = await addMaterial({ text: body, title: title ? String(title).trim() : undefined })
  if (r?.ok) await window.api.knowledgeOsRefresh?.()
  return r
}

function renderKnowledgeFirstTouchDone(host) {
  if (!host) { openKnowledgeOsPanel(undefined, 'status'); return }
  host.innerHTML = `<div class="knowledge-firsttouch-done">
    <span class="knowledge-firsttouch-check" aria-hidden="true"></span>
    <h2>已保存到你的知识</h2>
    <p>要我把它整理成知识吗？整理成什么样，都由你确认。</p>
    <div class="knowledge-firsttouch-actions">
      <button type="button" class="knowledge-btn primary" id="firstTouchOrganize">整理</button>
      <button type="button" class="knowledge-btn" id="firstTouchLater">以后再说</button>
    </div>
  </div>`
  host.querySelector('#firstTouchOrganize')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'organize'))
  host.querySelector('#firstTouchLater')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'status'))
}

function renderKnowledgeEmptyWelcome() {
  drawerBody.innerHTML = `<div class="knowledge-workspace knowledge-empty-workspace">
    <main class="knowledge-page-main">
      <section class="knowledge-firsttouch" id="knowledgeFirstTouch">
        <div class="knowledge-firsttouch-brand">
          <span class="knowledge-firsttouch-logo" aria-hidden="true"></span>
          <h1>你的知识网</h1>
        </div>
        <p class="knowledge-firsttouch-lede">把资料放进来，AI 帮你理成能查的知识，怎么整理，你说了算。</p>
        <ol class="knowledge-firsttouch-steps" aria-label="使用方式">
          <li><span class="knowledge-firsttouch-step-ico" aria-hidden="true"></span><strong>放进来</strong></li>
          <li aria-hidden="true" class="knowledge-firsttouch-arrow">→</li>
          <li><span class="knowledge-firsttouch-step-ico" aria-hidden="true"></span><strong>AI 整理</strong></li>
          <li aria-hidden="true" class="knowledge-firsttouch-arrow">→</li>
          <li><span class="knowledge-firsttouch-step-ico" aria-hidden="true"></span><strong>随时查</strong></li>
        </ol>
        <div class="knowledge-firsttouch-input">
          <textarea id="firstTouchBody" rows="4" placeholder="粘贴一段文字，或写点笔记…" aria-label="第一份资料内容"></textarea>
        </div>
        <div class="knowledge-firsttouch-actions">
          <button type="button" class="knowledge-btn primary" id="firstTouchAdd">+ 添加第一份资料</button>
          <button type="button" class="knowledge-btn" id="firstTouchPickFile">选择文件</button>
        </div>
        <button type="button" class="knowledge-firsttouch-connect" id="firstTouchConnect">已有飞书 / 文件夹？ 连接来源</button>
      </section>
    </main>
  </div>`
  const body = drawerBody.querySelector('#firstTouchBody')
  body?.focus()
  drawerBody.querySelector('#firstTouchPickFile')?.addEventListener('click', () => openKnowledgeAddModal('status'))
  drawerBody.querySelector('#firstTouchConnect')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#firstTouchAdd')?.addEventListener('click', e => {
    runAsyncKnowledgeButton(e.currentTarget, { busyLabel: '保存中…', idleLabel: '+ 添加第一份资料' }, async () => {
      const text = body?.value?.trim()
      if (!text) { toast('先粘贴或写一点内容', 'error'); body?.focus(); return }
      const r = await saveKnowledgeMaterial({ text })
      if (!r?.ok) { toast(r?.error || '写入失败', 'error'); return }
      renderKnowledgeFirstTouchDone(drawerBody.querySelector('#knowledgeFirstTouch'))
    })
  })
}

async function renderKnowledgeStatusWorkspace(active, list) {
  const { entries, stats } = applyLocalKnowledgeWorkspaceState(active, list)
  drawerBody.innerHTML = `<div class="knowledge-workspace llmwiki-workspace">
    ${knowledgeTopbarHtml({ name: '我的知识', kind: '本地知识', root: list.wikiRoot, stats })}
    <main class="llmwiki-workbench" aria-label="我的知识工作台">
      <section class="llmwiki-pane llmwiki-tree-pane" aria-label="资料树">
        <header class="llmwiki-pane-head">
          <div><h1>我的资料</h1><span class="llmwiki-pane-eyebrow">${stats.total || 0} 个条目</span></div>
          <button type="button" class="knowledge-btn primary knowledge-btn-sm" id="llmwikiAddMaterial">添加</button>
        </header>
        ${knowledgeBrowserHtml()}
      </section>
      <main class="knowledge-reader llmwiki-reader-pane" id="kosReader" aria-label="阅读与编辑"></main>
    </main>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#kosRefresh')?.addEventListener('click', async e => {
    if (!confirmDiscardKnowledgeRawEdit()) return
    e.currentTarget.disabled = true
    e.currentTarget.textContent = '刷新中…'
    const r = await window.api.knowledgeOsRefresh()
    if (!r?.ok) {
      toast(r?.error || '重新读取失败', 'error')
      e.currentTarget.disabled = false
      e.currentTarget.textContent = '重新读取'
      return
    }
    toast(`已重新读取 ${r.scanned || 0} 个条目`, 'success')
    clearKnowledgeRawEditorState()
    openKnowledgeOsPanel(undefined, 'status')
  })
  drawerBody.querySelector('#kosLint')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
  drawerBody.querySelector('#llmwikiAddMaterial')?.addEventListener('click', () => openKnowledgeAddModal('status'))
  wireKnowledgeEntries()
  drawerBody.querySelector('#kosSearch')?.addEventListener('input', e => {
    knowledgeUi.query = e.target.value
    refreshKnowledgeEntryList()
  })
  drawerBody.querySelectorAll('[data-kos-filter]').forEach(el => {
    el.addEventListener('click', () => {
      knowledgeUi.filter = el.dataset.kosFilter
      drawerBody.querySelectorAll('[data-kos-filter]').forEach(btn => btn.classList.toggle('active', btn === el))
      refreshKnowledgeEntryList()
    })
  })
  if (knowledgeUi.selectedPath && entries.some(item => item.path === knowledgeUi.selectedPath)) {
    const item = entries.find(x => x.path === knowledgeUi.selectedPath)
    openKnowledgeEntry(item.kind, item.path)
  } else {
    knowledgeUi.selectedPath = null
    renderKnowledgeWelcome()
  }
}

function renderLocalKnowledgeWorkspace(active, providers, list) {
  const { entries, stats } = applyLocalKnowledgeWorkspaceState(active, list)
  const documentView = `${knowledgeBrowserHtml()}<main class="knowledge-reader" id="kosReader"></main>`
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: '我的知识', kind: '本地知识', root: list.wikiRoot, stats })}
    <div class="knowledge-grid">
      ${documentView}
    </div>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#kosRefresh')?.addEventListener('click', async e => {
    if (!confirmDiscardKnowledgeRawEdit()) return
    e.currentTarget.disabled = true
    e.currentTarget.textContent = '刷新中…'
    const r = await window.api.knowledgeOsRefresh()
    if (!r?.ok) { toast(r?.error || '重新读取失败', 'error'); e.currentTarget.disabled = false; e.currentTarget.textContent = '重新读取'; return }
    toast(`已重新读取 ${r.scanned || 0} 个条目`, 'success')
    clearKnowledgeRawEditorState()
    openKnowledgeOsPanel(undefined, 'browse')
  })
  drawerBody.querySelector('#kosLint')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'health'))
  wireKnowledgeEntries()
  drawerBody.querySelector('#kosSearch')?.addEventListener('input', e => { knowledgeUi.query = e.target.value; refreshKnowledgeEntryList() })
  drawerBody.querySelectorAll('[data-kos-filter]').forEach(el => {
    el.addEventListener('click', () => {
      knowledgeUi.filter = el.dataset.kosFilter
      drawerBody.querySelectorAll('[data-kos-filter]').forEach(btn => btn.classList.toggle('active', btn === el))
      refreshKnowledgeEntryList()
    })
  })
  if (knowledgeUi.selectedPath && entries.some(item => item.path === knowledgeUi.selectedPath)) {
    const item = entries.find(x => x.path === knowledgeUi.selectedPath)
    openKnowledgeEntry(item.kind, item.path)
  } else {
    knowledgeUi.selectedPath = null
    renderKnowledgeWelcome()
  }
}

function renderRemoteRagWorkspace(prov) {
  const p = prov
  knowledgeUi.activeProvider = p
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: p.displayName, kind: 'AI 检索源', root: p.endpoint, remote: true })}
    <div class="knowledge-grid">
      <section class="knowledge-browser">
        <div class="knowledge-browser-head"><div class="knowledge-section-label">连接信息</div></div>
        <div class="knowledge-entry-list">
          <div class="knowledge-group-title">状态</div>
          <div class="knowledge-entry active"><span class="knowledge-entry-title">${p.endpoint ? '端点已配置' : '等待配置端点'}</span><span class="knowledge-entry-meta"><span>${p.hasApiKey ? '凭据已加密保存' : '无凭据'}</span></span></div>
          <div class="knowledge-group-title">检索参数</div>
          <div class="knowledge-entry"><span class="knowledge-entry-title">${esc(p.collection || '默认集合')}</span><span class="knowledge-entry-meta"><span>TOP K ${Number(p.topK) || 5}</span></span></div>
        </div>
      </section>
      <main class="knowledge-reader" id="kosReader"><div class="knowledge-reader-inner"><section class="knowledge-panel">
        <div class="knowledge-panel-kicker">Remote Retrieval</div><h2>测试远程检索</h2>
        <p class="knowledge-panel-desc">输入问题验证当前知识源。连接配置与凭据管理位于二级弹窗中。</p>
        <div class="knowledge-form">
          <div class="knowledge-form-row"><label for="ragTestQ">测试查询</label><input class="knowledge-input" id="ragTestQ" placeholder="输入关键词验证连接…"></div>
          <div class="knowledge-form-actions"><button type="button" class="knowledge-btn primary" id="ragTest">测试检索</button><button type="button" class="knowledge-btn" id="ragReaderConfigure">配置知识源</button></div>
        </div>
        <div class="knowledge-result" id="ragTestOut">测试结果将在这里显示。</div>
      </section></div></main>
    </div>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#ragConfigure')?.addEventListener('click', () => renderRemoteRagModal(p))
  drawerBody.querySelector('#ragReaderConfigure')?.addEventListener('click', () => renderRemoteRagModal(p))
  drawerBody.querySelector('#ragTest')?.addEventListener('click', async e => {
    const out = document.getElementById('ragTestOut')
    e.currentTarget.disabled = true
    out.className = 'knowledge-result'
    out.textContent = '正在检索…'
    const r = await window.api.knowledgeProviderQuery(document.getElementById('ragTestQ')?.value?.trim() || '测试')
    e.currentTarget.disabled = false
    if (!r?.ok) { out.className = 'knowledge-result error'; out.textContent = `连接失败：${r?.message || r?.error || '未知错误'}`; return }
    out.className = 'knowledge-result ok'
    out.textContent = r.hits?.length
      ? r.hits.map((hit, index) => `${index + 1}. ${hit.title}\n${(hit.snippet || '').slice(0, 180)}`).join('\n\n')
      : (r.message || '连接成功，但没有命中结果。')
  })
}

function renderRemoteRagModal(prov) {
  const p = prov || { id: '', displayName: 'AI 检索源', endpoint: '', collection: '', topK: 5, hasApiKey: false }
  const modal = openKnowledgeModal(prov ? '配置 AI 检索源' : '添加 AI 检索源', `<section class="knowledge-panel">
    <div class="knowledge-panel-kicker">Remote Retrieval</div>
    <p class="knowledge-panel-desc">KnowMe 只发送查询并读取命中结果，不同步远程原文。API Key 使用系统安全存储加密。</p>
    <div class="knowledge-form">
      <div class="knowledge-form-row"><label for="ragName">知识库名称</label><input class="knowledge-input" id="ragName" value="${esc(p.displayName || '')}"></div>
      <div class="knowledge-form-row"><label for="ragEndpoint">检索端点（POST）</label><input class="knowledge-input" id="ragEndpoint" value="${esc(p.endpoint || '')}" placeholder="https://your-rag.example/query"></div>
      <div class="knowledge-form-row"><label for="ragCollection">Collection / Index（可选）</label><input class="knowledge-input" id="ragCollection" value="${esc(p.collection || '')}"></div>
      <div class="knowledge-form-row"><label for="ragApiKey">API Key${p.hasApiKey ? '（已保存，留空表示不修改）' : ''}</label><input class="knowledge-input" id="ragApiKey" type="password" placeholder="${p.hasApiKey ? '••••••（已加密）' : 'sk-…'}"></div>
      <div class="knowledge-form-row"><label for="ragTopK">返回条数</label><input class="knowledge-input" id="ragTopK" type="number" min="1" max="20" value="${Number(p.topK) || 5}"></div>
      <div class="knowledge-form-actions">
        <button type="button" class="knowledge-btn primary" id="ragSave">${prov ? '保存配置' : '创建并启用'}</button>
        ${prov ? '<button type="button" class="knowledge-btn danger" id="ragRemove">删除知识源</button>' : ''}
      </div>
    </div>
  </section>`)
  if (!modal) return
  const readForm = () => ({
    id: p.id || undefined,
    kind: 'remote-rag',
    displayName: document.getElementById('ragName').value.trim() || 'AI 检索源',
    endpoint: document.getElementById('ragEndpoint').value.trim(),
    collection: document.getElementById('ragCollection').value.trim(),
    topK: Number(document.getElementById('ragTopK').value) || 5,
    apiKey: document.getElementById('ragApiKey').value || null,
  })
  const save = async button => {
    const form = readForm()
    if (!form.endpoint) { toast('请填写检索端点', 'error'); return null }
    button.disabled = true
    const r = await window.api.knowledgeProviderSave(form)
    button.disabled = false
    if (!r?.ok) { toast(r?.error || '保存失败', 'error'); return null }
    if (r.id) await window.api.knowledgeProviderSetActive(r.id)
    return { ...r, form }
  }
  modal.querySelector('#ragSave')?.addEventListener('click', async e => {
    const r = await save(e.currentTarget)
    if (!r) return
    closeKnowledgeModal()
    toast('AI 检索源已保存', 'success')
    openKnowledgeOsPanel(undefined, knowledgeUi.page)
  })
  modal.querySelector('#ragRemove')?.addEventListener('click', async e => {
    if (!window.confirm(`删除远程知识源“${p.displayName}”？`)) return
    e.currentTarget.disabled = true
    const r = await window.api.knowledgeProviderRemove(p.id)
    if (!r?.ok) { toast(r?.error || '删除失败', 'error'); e.currentTarget.disabled = false; return }
    closeKnowledgeModal()
    toast('远程知识源已删除', 'success')
    openKnowledgeOsPanel(undefined, knowledgeUi.page)
  })
}

function fabricEdgeLabel(type) {
  return ({
    refines: '细化',
    coversTopic: '覆盖主题',
    relatesTo: '相关',
    contradicts: '冲突',
    alias: '别名',
    ownedBy: '归属',
  })[type] || type
}

/** 异步按钮：await 前缓存引用，finally 恢复，避免 DOM 重建后 currentTarget 为 null。 */
async function runAsyncKnowledgeButton(button, { busyLabel, idleLabel }, task) {
  if (!button || button.disabled) return
  const idle = idleLabel || button.textContent || ''
  button.disabled = true
  if (busyLabel) button.textContent = busyLabel
  try {
    await task()
  } finally {
    if (button.isConnected) {
      button.disabled = false
      if (idleLabel) button.textContent = idle
    }
  }
}

function fabricGraphListHtml(graph) {
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  if (!nodes.length) {
    return `<div class="knowledge-fabric-empty">
      <strong>知识织网还是空的</strong>
      <p>连接资料后会自动从 Wiki 生成概念节点；挂载外挂库后可一键织网。</p>
      <button type="button" class="knowledge-btn primary" id="fabricEmptyConnect">连接资料</button>
      <button type="button" class="knowledge-btn" id="fabricEmptyWeave">生成织网提案</button>
    </div>`
  }
  const conceptRows = nodes.filter(n => n.kind === 'concept').slice(0, 40).map(n => `
    <div class="knowledge-fabric-node concept">
      <span class="knowledge-fabric-node-kind">概念</span>
      <strong>${esc(n.title)}</strong>
      <span class="knowledge-fabric-node-meta">authority ${n.authority || 2}${n.path ? ` · ${esc(n.path)}` : ''}</span>
      ${n.summary ? `<p>${esc(n.summary.slice(0, 120))}${n.summary.length > 120 ? '…' : ''}</p>` : ''}
    </div>`).join('')
  const anchorRows = nodes.filter(n => n.kind === 'anchor').slice(0, 40).map(n => `
    <div class="knowledge-fabric-node anchor${n.stale ? ' stale' : ''}">
      <span class="knowledge-fabric-node-kind">锚点</span>
      <strong>${esc(n.title)}</strong>
      <span class="knowledge-fabric-node-meta">${esc(n.kbId || '')}${n.extRef ? ` · ${esc(n.extRef)}` : ''}${n.stale ? ' · 待重织' : ''}</span>
    </div>`).join('')
  const edgeRows = edges.slice(0, 60).map(e => {
    const from = nodes.find(n => n.id === e.from)
    const to = nodes.find(n => n.id === e.to)
    return `<div class="knowledge-fabric-edge"><span class="knowledge-fabric-edge-type">${esc(fabricEdgeLabel(e.type))}</span><span>${esc(from?.title || e.from)} → ${esc(to?.title || e.to)}</span></div>`
  }).join('')
  return `<div class="knowledge-fabric-graph">
    <section><h3>概念节点 ${nodes.filter(n => n.kind === 'concept').length}</h3>${conceptRows || '<p class="knowledge-muted">暂无概念</p>'}</section>
    <section><h3>外挂锚点 ${nodes.filter(n => n.kind === 'anchor').length}</h3>${anchorRows || '<p class="knowledge-muted">挂载外挂库后织网生成锚点</p>'}</section>
    <section><h3>关系边 ${edges.length}</h3>${edgeRows || '<p class="knowledge-muted">织网后会连接概念与锚点</p>'}</section>
  </div>`
}

function fabricHitRowsHtml(hits = [], opts = {}) {
  const searched = !!opts.searched
  if (!hits.length) {
    if (searched) {
      return `<div class="knowledge-fabric-empty compact" data-fabric-no-hit="1">
        <strong>未找到相关知识</strong>
        <p>试试更短或更通用的关键词，或先补充资料再检索。</p>
        <div class="knowledge-form-actions">
          <button type="button" class="knowledge-btn" id="fabricNoHitConnect">连接知识库</button>
          <button type="button" class="knowledge-btn" id="fabricNoHitIngest">吸收资料</button>
          <button type="button" class="knowledge-btn" id="fabricNoHitFabric">去织网整理</button>
        </div>
      </div>`
    }
    return `<div class="knowledge-fabric-empty compact">
      <strong>输入问题试试根优先检索</strong>
      <p>会先查根 Fabric，再按路由选择性召回外挂库。</p>
    </div>`
  }
  return hits.map((hit, i) => {
    const prov = hit.provenance || {}
    const kb = prov.kbId || hit.kbId || 'root'
    const auth = prov.authority ?? hit.authority ?? 2
    return `<article class="knowledge-fabric-hit">
      <header><span class="knowledge-fabric-hit-rank">${i + 1}</span><strong>${esc(hit.title || '未命名')}</strong>
        <span class="knowledge-fabric-tag">${esc(kb)}</span><span class="knowledge-fabric-tag authority" title="权威级 ${auth}/5">A${auth}</span></header>
      <div class="knowledge-fabric-hit-path">${esc(hit.path || hit.nodeId || '')}</div>
      ${hit.snippet ? `<p>${esc(hit.snippet)}</p>` : ''}
      ${hit.conflict?.message ? `<div class="knowledge-fabric-conflict">⚠ ${esc(hit.conflict.message)}</div>` : ''}
    </article>`
  }).join('')
}

function wireFabricRetrieveEmptyActions(root = drawerBody) {
  root?.querySelector('#fabricNoHitConnect')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  root?.querySelector('#fabricNoHitIngest')?.addEventListener('click', () => openFabricIngestModal())
  root?.querySelector('#fabricNoHitFabric')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'fabric'))
}

async function renderKnowledgeFabricWorkspace(active, list) {
  const { stats } = applyLocalKnowledgeWorkspaceState(active, list)
  const snap = await window.api.fabricGraph?.()
  knowledgeUi.fabricSnapshot = snap?.ok ? snap : null
  const weave = await window.api.fabricWeaveList?.()
  knowledgeUi.weaveProposals = weave?.proposals || []
  const engine = await window.api.fabricEngineStatus?.()
  const gstats = snap?.stats || {}
  const pendingWeave = knowledgeUi.weaveProposals.filter(p => p.status === 'pending')
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: active.displayName || '本地知识库', kind: '知识织网', root: list.wikiRoot, stats })}
    <main class="knowledge-page-main knowledge-fabric-page">
      <section class="knowledge-panel">
        <div class="knowledge-panel-kicker">Knowledge Fabric</div>
        <h2>结构总览</h2>
        <p class="knowledge-panel-desc">根 Fabric 维护概念、锚点与关系边。检索引擎：${esc(engine?.engine || 'fallback')}${engine?.qmdEnabled ? '（qmd 已启用）' : '（词面 fallback）'}。</p>
        <div class="knowledge-home-status fabric-stats">
          <div><span>概念</span><strong>${gstats.concepts || 0}</strong></div>
          <div><span>锚点</span><strong>${gstats.anchors || 0}</strong></div>
          <div><span>关系</span><strong>${gstats.edges || 0}</strong></div>
        </div>
        <div class="knowledge-form-actions">
          <button type="button" class="knowledge-btn primary" id="fabricWeaveRun">织入当前库</button>
          <button type="button" class="knowledge-btn" id="fabricRefreshGraph">刷新图谱</button>
          <button type="button" class="knowledge-btn" id="fabricOpenRetrieve">打开检索台</button>
        </div>
      </section>
      ${fabricGraphListHtml(snap?.graph)}
      <section class="knowledge-panel">
        <div class="knowledge-panel-kicker">Weave proposals</div>
        <h2>织网提案 ${pendingWeave.length ? `(${pendingWeave.length} 待审核)` : ''}</h2>
        ${pendingWeave.length
          ? pendingWeave.map(p => `<div class="knowledge-fabric-proposal">
              <strong>${esc(p.title)}</strong>
              <p>${esc(p.rationale || '')}</p>
              <div class="knowledge-form-actions">
                <button type="button" class="knowledge-btn primary" data-fabric-apply="${esc(p.id)}">确认织入</button>
                <button type="button" class="knowledge-btn" data-fabric-reject="${esc(p.id)}">拒绝</button>
              </div>
            </div>`).join('')
          : '<div class="knowledge-fabric-empty compact"><strong>暂无待审核织网提案</strong><p>点击「织入当前库」从资料抽取锚点并匹配概念。</p></div>'}
      </section>
    </main>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  drawerBody.querySelector('#fabricEmptyConnect')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#fabricEmptyWeave')?.addEventListener('click', () => drawerBody.querySelector('#fabricWeaveRun')?.click())
  drawerBody.querySelector('#fabricOpenRetrieve')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'retrieve'))
  drawerBody.querySelector('#fabricRefreshGraph')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'fabric'))
  drawerBody.querySelector('#fabricWeaveRun')?.addEventListener('click', e => {
    const btn = e.currentTarget
    runAsyncKnowledgeButton(btn, { busyLabel: '织网中…', idleLabel: '织入当前库' }, async () => {
      const r = await window.api.fabricWeaveRun?.({ kbId: active.id, autoApply: false })
      if (!r?.ok) { toast(r?.error || '织网失败', 'error'); return }
      toast('已生成织网提案，请审核后确认', 'success')
      await openKnowledgeOsPanel(undefined, 'fabric')
    })
  })
  drawerBody.querySelectorAll('[data-fabric-apply]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAsyncKnowledgeButton(btn, { busyLabel: '写入中…', idleLabel: '确认织入' }, async () => {
        const r = await window.api.fabricWeaveApply?.(btn.dataset.fabricApply)
        if (!r?.ok) { toast(r?.error || '应用失败', 'error'); return }
        toast('织网已写入 Fabric', 'success')
        await openKnowledgeOsPanel(undefined, 'fabric')
      })
    })
  })
  drawerBody.querySelectorAll('[data-fabric-reject]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAsyncKnowledgeButton(btn, { busyLabel: '处理中…', idleLabel: '拒绝' }, async () => {
        await window.api.fabricWeaveReject?.(btn.dataset.fabricReject)
        toast('已拒绝该提案', 'success', 1200)
        await openKnowledgeOsPanel(undefined, 'fabric')
      })
    })
  })
}

async function renderKnowledgeRetrieveWorkspace(active, list) {
  const { stats } = applyLocalKnowledgeWorkspaceState(active, list)
  drawerBody.innerHTML = `<div class="knowledge-workspace">
    ${knowledgeTopbarHtml({ name: active.displayName || '本地知识库', kind: '检索台', root: list.wikiRoot, stats })}
    <main class="knowledge-page-main knowledge-retrieve-page">
      <section class="knowledge-panel">
        <div class="knowledge-panel-kicker">Root-first retrieval</div>
        <h2>知识检索台</h2>
        <p class="knowledge-panel-desc">根优先命中 → 路由扇出 → 跨库融合。结果带来源库与 authority；冲突会单独提示。</p>
        <div class="knowledge-form">
          <div class="knowledge-form-row">
            <label for="fabricSearchQ">查询</label>
            <input class="knowledge-input" id="fabricSearchQ" value="${esc(knowledgeUi.fabricQuery)}" placeholder="例如：Electron IPC 便签同步">
          </div>
          <div class="knowledge-form-actions">
            <button type="button" class="knowledge-btn primary" id="fabricSearchRun">检索</button>
            <button type="button" class="knowledge-btn" id="fabricIngestOpen">吸收资料到 Wiki</button>
          </div>
        </div>
        <div class="knowledge-fabric-route" id="fabricRouteMeta">${knowledgeUi.fabricRoute
          ? `路由：${knowledgeUi.fabricRoute.shortCircuit ? '根覆盖短路' : knowledgeUi.fabricRoute.broadFanout ? '广扇出' : '选择性召回'} · 根覆盖 ${Number(knowledgeUi.fabricRoute.rootCoverage || 0).toFixed(1)}`
          : '等待检索…'}</div>
      </section>
      <div class="knowledge-fabric-hits" id="fabricHitList">${fabricHitRowsHtml(knowledgeUi.fabricHits, { searched: knowledgeUi.fabricSearchAttempted })}</div>
    </main>
  </div>`
  drawerBody.querySelector('#kbSourcesOpen')?.addEventListener('click', () => openKnowledgeOsPanel(undefined, 'connect'))
  drawerBody.querySelector('#obsidianOpen')?.addEventListener('click', renderObsidianBridgeModal)
  wireFabricRetrieveEmptyActions(drawerBody)
  const runSearch = async () => {
    const q = document.getElementById('fabricSearchQ')?.value?.trim() || ''
    knowledgeUi.fabricQuery = q
    if (!q) { toast('请输入查询词', 'error'); return }
    const btn = document.getElementById('fabricSearchRun')
    await runAsyncKnowledgeButton(btn, { busyLabel: '检索中…', idleLabel: '检索' }, async () => {
      const r = await window.api.fabricQuery?.(q)
      if (!r?.ok) { toast(r?.message || r?.error || '检索失败', 'error'); return }
      knowledgeUi.fabricSearchAttempted = true
      knowledgeUi.fabricHits = r.hits || []
      knowledgeUi.fabricRoute = r.route || null
      const routeEl = document.getElementById('fabricRouteMeta')
      if (routeEl && r.route) {
        routeEl.textContent = `路由：${r.route.shortCircuit ? '根覆盖短路' : r.route.broadFanout ? '广扇出' : '选择性召回'} · 根覆盖 ${Number(r.route.rootCoverage || 0).toFixed(1)} · 引擎 ${r.engine || 'fallback'}`
      } else if (routeEl) {
        routeEl.textContent = knowledgeUi.fabricHits.length ? '检索完成' : '未命中 · 可换关键词或补充资料'
      }
      const listEl = document.getElementById('fabricHitList')
      if (listEl) {
        listEl.innerHTML = fabricHitRowsHtml(knowledgeUi.fabricHits, { searched: true })
        wireFabricRetrieveEmptyActions(drawerBody)
      }
    })
  }
  drawerBody.querySelector('#fabricSearchRun')?.addEventListener('click', runSearch)
  drawerBody.querySelector('#fabricSearchQ')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runSearch() }
  })
  drawerBody.querySelector('#fabricIngestOpen')?.addEventListener('click', () => openFabricIngestModal())
}

function openKnowledgeAddModal(returnRoute = 'browse') {
  const modal = openKnowledgeModal('添加资料', `<section class="knowledge-panel">
    <div class="knowledge-panel-kicker">保存在我的知识</div>
    <h2>新建一份可编辑资料</h2>
    <p class="knowledge-panel-desc">粘贴 Markdown 或纯文本。保存后可以直接编辑、搜索，也可以交给 KnowMe 整理。</p>
    <div class="knowledge-form">
      <div class="knowledge-form-row"><label for="fabricIngestTitle">标题</label><input class="knowledge-input" id="fabricIngestTitle" placeholder="可选"></div>
      <div class="knowledge-form-row"><label for="fabricIngestBody">内容</label><textarea class="knowledge-input" id="fabricIngestBody" rows="8" placeholder="粘贴 Markdown 或纯文本…"></textarea></div>
      <div class="knowledge-form-actions"><button type="button" class="knowledge-btn primary" id="fabricIngestSave">保存资料</button></div>
    </div>
  </section>`)
  modal?.querySelector('#fabricIngestSave')?.addEventListener('click', e => {
    const saveBtn = e.currentTarget
    runAsyncKnowledgeButton(saveBtn, { busyLabel: '保存中…', idleLabel: '保存资料' }, async () => {
      const body = document.getElementById('fabricIngestBody')?.value?.trim()
      if (!body) { toast('请输入内容', 'error'); return }
      const title = document.getElementById('fabricIngestTitle')?.value?.trim()
      const r = await saveKnowledgeMaterial({ text: body, title })
      if (!r?.ok) { toast(r?.error || '写入失败', 'error'); return }
      closeKnowledgeModal()
      toast('资料已保存到我的知识', 'success')
      if (returnRoute === 'browse') {
        knowledgeUi.selectedPath = r.created?.[0]?.path || null
      }
      await openKnowledgeOsPanel(undefined, returnRoute)
    })
  })
}

function openFabricIngestModal() {
  openKnowledgeAddModal('fabric')
}

async function openKnowledgeOsPanel(title, tab = 'status') {
  const safeTab = normalizeKnowledgeSurfaceRoute(tab)
  if (safeTab !== 'browse' && !confirmDiscardKnowledgeRawEdit()) return
  if (safeTab !== 'browse') clearKnowledgeRawEditorState()
  const requestId = ++knowledgeOpenSequence
  knowledgeUi.page = safeTab
  const t0 = Date.now()
  console.debug('[kb-debug] open:start', {
    title: title || '我的知识',
    tab: safeTab,
    hasApi: !!window.api,
    drawerOpen: !!drawer?.classList?.contains('open'),
    center: isCenterSurface(),
  })
  openDrawer(title || '我的知识', { kind: 'knowledge', center: true })
  parkCapabilityHubFrame()
  drawerBody.innerHTML = '<div class="knowledge-workspace"><div class="knowledge-reader-empty"><p style="color:#1c1917;font-size:16px;font-weight:600">正在打开我的知识…</p><p style="margin-top:8px;font-size:12px;color:#57534e">加载中，请稍候</p></div></div>'
  try {
    if (!window.api?.knowledgeProviderList) throw new Error('知识库 API 不可用，请重启应用')
    const provs = await withTimeout(window.api.knowledgeProviderList(), 6000, '读取知识源超时')
    if (requestId !== knowledgeOpenSequence || drawerKind !== 'knowledge' || knowledgeUi.page !== safeTab) return
    console.debug('[kb-debug] providers:ok', {
      activeProviderId: provs?.activeProviderId || '',
      providerCount: provs?.providers?.length || 0,
      costMs: Date.now() - t0,
    })
    const providers = provs?.providers?.length ? provs.providers : [{ id: 'local-default', kind: 'local', displayName: '我的知识' }]
    const activeId = provs?.activeProviderId || 'local-default'
    const selectedProvider = providers.find(p => p.id === activeId) || providers[0]
    const active = providers.find(p => p.id === 'local-default' || p.kind === 'local') || providers[0]
    knowledgeUi.providers = providers
    knowledgeUi.activeId = selectedProvider.id
    knowledgeUi.activeProvider = selectedProvider
    if (safeTab === 'connect') {
      renderKnowledgeSourcesPage()
      toast('资料来源已打开', 'success', 1200)
      return
    }
    const list = await withTimeout(window.api.knowledgeOsList(), 6000, '读取知识条目超时')
    if (requestId !== knowledgeOpenSequence || drawerKind !== 'knowledge' || knowledgeUi.page !== safeTab) return
    console.debug('[kb-debug] list:ok', {
      ok: !!list?.ok,
      wiki: list?.wiki?.length || 0,
      okf: list?.okf?.length || 0,
      costMs: Date.now() - t0,
    })
    if (!list?.ok) {
      drawerBody.innerHTML = `<div class="knowledge-workspace"><div class="knowledge-reader-inner"><div class="knowledge-result error">${esc(list?.error || '知识库加载失败')}</div></div></div>`
      syncRailNavigation()
      return
    }
    if (safeTab === 'fabric') {
      await renderKnowledgeFabricWorkspace(active, list)
      return
    }
    if (safeTab === 'retrieve') {
      await renderKnowledgeRetrieveWorkspace(active, list)
      return
    }
    if (safeTab === 'health') {
      await renderKnowledgeHealthWorkspace(active, list)
      return
    }
    if (safeTab === 'governance') {
      await renderKnowledgeGovernanceWorkspace(active, list)
      return
    }
    if (safeTab === 'organize' || safeTab === 'review') {
      if (active.kind === 'remote-rag') {
        renderRemoteRagWorkspace(active)
      } else if (safeTab === 'review') {
        await renderKnowledgeReviewWorkspace(active, list)
      } else {
        await renderKnowledgeOrganizerWorkspace(active, list)
      }
      return
    }
    if (safeTab === 'status') {
      await renderKnowledgeStatusWorkspace(active, list)
      return
    }
    renderLocalKnowledgeWorkspace(active, providers, list)
    const shell = document.getElementById('appShell')
    const rect = drawer.getBoundingClientRect()
    const bodyRect = drawerBody.getBoundingClientRect()
    console.debug('[kb-debug] open:success', JSON.stringify({
      costMs: Date.now() - t0,
      shellClass: shell?.className || '',
      drawerClass: drawer.className,
      drawerW: Math.round(rect.width),
      drawerH: Math.round(rect.height),
      bodyW: Math.round(bodyRect.width),
      bodyH: Math.round(bodyRect.height),
      bodyHtmlLen: (drawerBody.innerHTML || '').length,
    }))
    toast('我的知识已打开', 'success', 1600)
  } catch (e) {
    console.error('[kb-debug] open:catch', e?.stack || e?.message || String(e))
    drawerBody.innerHTML = `<div class="knowledge-workspace"><div class="knowledge-reader-inner"><div class="knowledge-result error">${esc(e?.message || '知识库加载失败')}</div><div class="knowledge-form-actions" style="padding:12px 0 0"><button type="button" class="knowledge-btn" id="kbRetryOpen">重试打开</button></div></div></div>`
    document.getElementById('kbRetryOpen')?.addEventListener('click', () => openKnowledgeOsPanel(title, safeTab))
    syncRailNavigation()
  }
}

document.getElementById('btnKnowledgeOs')?.addEventListener('click', () => {
  console.debug('[kb-debug] click', {
    center: isCenterSurface(),
    drawerOpen: drawer.classList.contains('open'),
    drawerKind,
  })
  if (drawerKind === 'knowledge' && drawer.classList.contains('open')) {
    closeDrawer()
    return
  }
  openKnowledgeOsPanel()
})

function openSettingsPanel(tab = '') {
  const requestedTab = String(tab || '').trim()
  const safeTab = SETTINGS_SURFACE_TAB_IDS.has(requestedTab) ? requestedTab : 'sources'
  settingsSurfaceTab = safeTab
  console.debug('[settings-debug] open', { tab: safeTab })
  // 与知识库一致：在中间主区展示，而不是二级独立窗口
  openDrawer('设置', { kind: 'settings', center: true })
  parkCapabilityHubFrame()
  const src = `settings.html?embedded=1&tab=${encodeURIComponent(safeTab)}`
  drawerBody.innerHTML = `<iframe class="drawer-settings-frame" src="${src}" title="设置"></iframe>`
  syncRailNavigation()
}

document.getElementById('btnSettings')?.addEventListener('click', () => {
  if (drawerKind === 'settings' && drawer.classList.contains('open')) {
    closeDrawer()
    return
  }
  openSettingsPanel()
})

const CAPABILITY_HUB_TABS = new Set(['experts', 'skills', 'connectors'])

document.querySelectorAll('[data-capability-hub-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.capabilityHubTab
    if (CAPABILITY_HUB_TABS.has(tab)) openCapabilityHub(tab)
  })
})

function isCapabilityHubDrawerKind(kind = drawerKind) {
  return kind === 'capability-hub' || kind === 'capability-hub-detail'
}

function buildCapabilityHubSrc(tab, {
  expertId = '',
  surface = 'capability',
  presentation = 'hub',
} = {}) {
  const params = new URLSearchParams({
    embedded: '1',
    tab: CAPABILITY_HUB_TABS.has(tab) ? tab : 'experts',
    surface: surface === 'workbench' ? 'workbench' : 'capability',
    presentation: presentation === 'detail' ? 'detail' : 'hub',
  })
  const id = String(expertId || '').trim()
  if (id) params.set('expertId', id)
  return `capability-hub.html?${params.toString()}`
}

function ensureCapabilityHubPark() {
  if (capabilityHubPark?.isConnected) return capabilityHubPark
  const park = document.createElement('div')
  park.id = 'capabilityHubPark'
  park.hidden = true
  park.setAttribute('aria-hidden', 'true')
  park.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none'
  document.body.appendChild(park)
  capabilityHubPark = park
  return park
}

function parkCapabilityHubFrame() {
  const frame = drawerBody?.querySelector?.('.capability-hub-frame')
  if (!frame) return null
  ensureCapabilityHubPark().appendChild(frame)
  return frame
}

function getParkedCapabilityHubFrame() {
  const frame = capabilityHubPark?.querySelector?.('.capability-hub-frame')
    || document.querySelector('#capabilityHubPark .capability-hub-frame')
  if (!frame) return null
  if (!frame.contentWindow) {
    frame.remove()
    return null
  }
  return frame
}

function resumeCapabilityHubFrame(frame, {
  tab,
  expertId = '',
  surface = 'capability',
  presentation = 'hub',
} = {}) {
  if (!frame?.contentWindow) return
  try {
    frame.contentWindow.postMessage({
      type: 'capability-hub-resume',
      tab,
      expertId,
      surface,
      presentation: presentation === 'detail' ? 'detail' : 'hub',
    }, '*')
  } catch { /* noop */ }
}

function openCapabilityHubDetailSurface() {
  if (!drawer || !drawerTitle) return
  const shell = document.getElementById('appShell')
  drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  shell?.classList.remove('mode-center-surface', 'mode-knowledge', 'mode-secondary-dialog')
  drawerKind = 'capability-hub-detail'
  drawer.classList.remove('drawer-settings', 'drawer-tabbed-surface', 'secondary-dialog')
  drawer.classList.add('drawer-capability-hub', 'drawer-capability-hub-detail', 'open')
  clearCenterSurfaceTabs()
  drawerBackdrop?.classList.remove('open')
  drawerBackdrop?.setAttribute('aria-hidden', 'true')
  drawer.removeAttribute('role')
  drawer.removeAttribute('aria-modal')
  drawer.removeAttribute('aria-labelledby')
  drawer.setAttribute('aria-hidden', 'false')
  drawer.style.position = 'fixed'
  drawer.style.left = railWidthCssValue(shell)
  drawer.style.top = '0'
  drawer.style.right = '0'
  drawer.style.bottom = '0'
  drawer.style.zIndex = '240'
  drawer.style.flex = 'none'
  drawer.style.flexBasis = 'auto'
  drawer.style.width = 'auto'
  drawer.style.minWidth = '0'
  drawer.style.maxWidth = 'none'
  drawer.style.height = 'auto'
  drawer.style.opacity = '1'
  drawer.style.visibility = 'visible'
  drawer.style.background = 'transparent'
  drawer.style.borderLeft = 'none'
  drawer.style.boxShadow = 'none'
  drawerTitle.textContent = '专家详情'
  drawerTitle.hidden = true
  ensureShellLayoutInvariant()
  syncRailNavigation()
}

function capabilityHubSrcMismatch(frame, nextSrc) {
  if (!frame) return true
  try {
    const current = frame.getAttribute('src') || frame.dataset.hubSrc || ''
    if (!current) return true
    const a = new URL(current, window.location.href)
    const b = new URL(nextSrc, window.location.href)
    // park/reuse 后参数不一致时，仅靠 postMessage 在部分时序下会卡在 hub 目录页（工作台 detail 入口 → 整页专家库的错觉）
    return ['tab', 'surface', 'presentation', 'expertId'].some(
      key => (a.searchParams.get(key) || '') !== (b.searchParams.get(key) || ''),
    )
  } catch {
    return true
  }
}

function mountCapabilityHubFrame(nextSrc, { tab, expertId, surface, presentation }) {
  const resumeOpts = { tab, expertId, surface, presentation }
  const reloadIfMismatch = (frame) => {
    if (!frame || !capabilityHubSrcMismatch(frame, nextSrc)) return false
    frame.src = nextSrc
    frame.dataset.hubSrc = nextSrc
    return true
  }

  const activeFrame = drawerBody?.querySelector?.('.capability-hub-frame')
  if (activeFrame?.contentWindow && isCapabilityHubDrawerKind()) {
    if (!reloadIfMismatch(activeFrame)) {
      resumeCapabilityHubFrame(activeFrame, resumeOpts)
      activeFrame.dataset.hubSrc = nextSrc
    }
    syncRailNavigation()
    return
  }
  if (activeFrame && isCapabilityHubDrawerKind()) {
    activeFrame.src = nextSrc
    activeFrame.dataset.hubSrc = nextSrc
    syncRailNavigation()
    return
  }

  const reused = getParkedCapabilityHubFrame()
  if (reused) {
    while (drawerBody.firstChild) drawerBody.removeChild(drawerBody.firstChild)
    drawerBody.appendChild(reused)
    if (!reloadIfMismatch(reused)) {
      reused.dataset.hubSrc = nextSrc
      resumeCapabilityHubFrame(reused, resumeOpts)
    }
    syncRailNavigation()
    return
  }

  parkCapabilityHubFrame()
  drawerBody.innerHTML = `<iframe class="capability-hub-frame" src="${nextSrc}" title="专家库"></iframe>`
  syncRailNavigation()
}

function openCapabilityHub(tab = 'experts', opts = {}) {
  const options = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {}
  const expertId = String(options.expertId || '').trim()
  const surface = options.surface === 'workbench' ? 'workbench' : 'capability'
  const presentation = options.presentation === 'detail' ? 'detail' : 'hub'
  capabilityHubTab = CAPABILITY_HUB_TABS.has(tab) ? tab : 'experts'
  mountIcons(drawer)
  const nextSrc = buildCapabilityHubSrc(capabilityHubTab, { expertId, surface, presentation })
  const resumeOpts = { tab: capabilityHubTab, expertId, surface, presentation }

  if (presentation === 'detail') {
    if (drawerKind === 'capability-hub' && drawer.classList.contains('open')) {
      parkCapabilityHubFrame()
    }
    if (drawerKind !== 'capability-hub-detail' || !drawer.classList.contains('open')) {
      openCapabilityHubDetailSurface()
    }
    mountCapabilityHubFrame(nextSrc, resumeOpts)
    return
  }

  if (drawerKind === 'capability-hub-detail' && drawer.classList.contains('open')) {
    parkCapabilityHubFrame()
  }

  if (drawerKind === 'capability-hub' && drawer.classList.contains('open')) {
    mountCapabilityHubFrame(nextSrc, resumeOpts)
    return
  }

  openDrawer('专家库', { kind: 'capability-hub', center: true })
  mountCapabilityHubFrame(nextSrc, resumeOpts)
}

function toggleCapabilityHubRail() {
  if (drawerKind === 'capability-hub' && drawer.classList.contains('open')) {
    closeDrawer()
    return
  }
  openCapabilityHub('experts')
}

document.getElementById('btnRailCapabilities')?.addEventListener('click', toggleCapabilityHubRail)

window.openCapabilityHub = openCapabilityHub

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (isSecondaryDialogOpen() || (isCapabilityHubDrawerKind() && drawer.classList.contains('open'))) {
    e.preventDefault()
    closeDrawer()
  }
})

// ── 来自编辑器 iframe 的消息 ───────────────────────────────
window.addEventListener('message', async e => {
  const d = e.data || {}
  const capabilityFrame = isCapabilityHubDrawerKind()
    ? drawerBody.querySelector('.capability-hub-frame')
    : null
  const isCapabilityHubSource = !!capabilityFrame && e.source === capabilityFrame.contentWindow
  const settingsFrame = drawerKind === 'settings'
    ? drawerBody.querySelector('.drawer-settings-frame')
    : null
  const isSettingsSource = !!settingsFrame && e.source === settingsFrame.contentWindow
  if (d.type === 'capability-hub-close') {
    if (!isCapabilityHubSource) return
    // detail-dismiss：仅关闭工作台透明叠层；整页专家库内关详情不得连带退出专家库
    if (d.reason === 'detail-dismiss') {
      if (drawerKind === 'capability-hub-detail') closeDrawer()
      return
    }
    if (isCapabilityHubDrawerKind()) closeDrawer()
    return
  }
  if (d.type === 'capability-hub-tab' && CAPABILITY_HUB_TABS.has(d.tab)) {
    if (!isCapabilityHubSource) return
    capabilityHubTab = d.tab
    syncRailNavigation()
    return
  }
  if (d.type === 'capability-hub-start-expert') {
    if (!isCapabilityHubSource) return
    const requestId = String(d.requestId || '')
    const expertId = String(d.expertId || '').trim()
    const startSurface = String(d.surface || '').trim() === 'workbench'
      || drawerKind === 'capability-hub-detail'
      ? 'workbench'
      : 'capability'
    const reply = payload => {
      try {
        e.source?.postMessage({
          type: 'capability-hub-start-expert-result',
          requestId,
          ...payload,
        }, '*')
      } catch { /* Hub 可能已关闭 */ }
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(expertId)) {
      reply({ ok: false, error: '专家 ID 无效' })
      return
    }
    try {
      // 工作台启动 = 任务：铺开 task-room，写入最近任务；不与助理 Session Tab 混为同一入口
      if (startSurface === 'workbench') {
        if (typeof window.Workbench?.startExpertTaskDirect !== 'function') {
          throw new Error('工作台任务服务未就绪')
        }
        if (!workbenchOn) {
          workbenchOn = true
          workbenchAutomationOn = false
          workbenchPage = 'tasks'
          applyWorkbench()
        } else if (workbenchPage !== 'tasks') {
          workbenchPage = 'tasks'
          applyWorkbench()
        }
        const result = await window.Workbench.startExpertTaskDirect({ expertId })
        if (!result?.ok) throw new Error(result?.error || '无法创建专家任务对话')
        reply({ ok: true, sessionId: result.session?.id || '', taskId: result.task?.id || '' })
        if (drawerKind === 'capability-hub-detail' || isCapabilityHubDrawerKind()) closeDrawer()
        setTimeout(() => document.getElementById('agentInput')?.focus(), 150)
        return
      }
      const result = await window.WorkspaceAgent?.startExpertChat?.(expertId)
      if (!result?.ok) throw new Error(result?.error || '无法创建专家对话')
      reply({ ok: true, sessionId: result.session?.id || '' })
      if (drawerKind === 'capability-hub-detail') closeDrawer()
      setTimeout(openAgentChat, 0)
      setTimeout(() => document.getElementById('agentInput')?.focus(), 150)
    } catch (error) {
      reply({ ok: false, error: error?.message || '无法创建专家对话' })
    }
    return
  }
  if (d.type === 'capability-hub-start-skill') {
    if (!isCapabilityHubSource) return
    const requestId = String(d.requestId || '')
    const skillId = String(d.skillId || '').trim()
    const reply = payload => {
      try {
        e.source?.postMessage({
          type: 'capability-hub-start-skill-result',
          requestId,
          ...payload,
        }, '*')
      } catch { /* Hub 可能已关闭 */ }
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(skillId)) {
      reply({ ok: false, error: '技能 ID 无效' })
      return
    }
    try {
      const result = await window.WorkspaceAgent?.startSkillChat?.({
        skillId,
        prompt: String(d.prompt || '').slice(0, 4000),
        title: String(d.title || '').slice(0, 160),
      })
      if (!result?.ok) throw new Error(result?.error || '无法开始技能试用')
      reply({ ok: true, sessionId: result.session?.id || '' })
      setTimeout(openAgentChat, 0)
      setTimeout(() => document.getElementById('agentInput')?.focus(), 150)
    } catch (error) {
      reply({ ok: false, error: error?.message || '无法开始技能试用' })
    }
    return
  }
  if (d.type === 'capability-hub-add-expert-to-workbench') {
    if (!isCapabilityHubSource) return
    const requestId = String(d.requestId || '')
    const expertId = String(d.expertId || '').trim()
    const reply = payload => {
      try {
        e.source?.postMessage({
          type: 'capability-hub-add-expert-to-workbench-result',
          requestId,
          ...payload,
        }, '*')
      } catch { /* Hub 可能已关闭 */ }
    }
    if (!requestId || requestId.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(expertId)) {
      reply({ ok: false, error: '添加请求或专家 ID 无效' })
      return
    }
    try {
      if (!window.api?.workbenchModeBindExpert) throw new Error('工作模式服务暂不可用')
      const result = await window.api.workbenchModeBindExpert({ expertId })
      if (!result?.ok) throw new Error(result?.error || '无法添加到工作台')
      const refreshResult = await window.Workbench?.refreshModes?.()
      if (refreshResult?.ok === false) throw new Error(refreshResult.error || '已添加，但工作台刷新失败')
      reply({
        ok: true,
        modeId: result.modeId || result.activeModeId || '',
        modeName: result.modeName || '当前工作台',
        alreadyBound: result.alreadyBound === true,
      })
    } catch (error) {
      reply({ ok: false, error: error?.message || '无法添加到工作台' })
    }
    return
  }
  if (d.type === 'capability-hub-remove-expert-from-workbench') {
    if (!isCapabilityHubSource) return
    const requestId = String(d.requestId || '')
    const expertId = String(d.expertId || '').trim()
    const reply = payload => {
      try {
        e.source?.postMessage({
          type: 'capability-hub-remove-expert-from-workbench-result',
          requestId,
          ...payload,
        }, '*')
      } catch { /* Hub 可能已关闭 */ }
    }
    if (!requestId || requestId.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(expertId)) {
      reply({ ok: false, error: '撤回请求或专家 ID 无效' })
      return
    }
    try {
      if (!window.api?.workbenchModeUnbindExpert) throw new Error('工作模式服务暂不可用')
      const result = await window.api.workbenchModeUnbindExpert({ expertId })
      if (!result?.ok) throw new Error(result?.error || '无法从工作台撤回')
      const refreshResult = await window.Workbench?.refreshModes?.()
      if (refreshResult?.ok === false) throw new Error(refreshResult.error || '已撤回，但工作台刷新失败')
      try { await window.Workbench?.load?.() } catch { /* 可选刷新完整目录 */ }
      reply({
        ok: true,
        modeId: result.modeId || result.activeModeId || '',
        modeName: result.modeName || '当前工作台',
      })
    } catch (error) {
      reply({ ok: false, error: error?.message || '无法从工作台撤回' })
    }
    return
  }
  if (d.type === 'capability-hub-expert-uninstalled') {
    if (!isCapabilityHubSource) return
    // 专家卸载后主进程已清绑定；同步刷新工作台列表与模式，去掉幽灵快捷卡
    try {
      await window.Workbench?.refreshModes?.()
      await window.Workbench?.load?.()
    } catch { /* 工作台可能未挂载 */ }
    return
  }
  if (d.type === 'open-capability-hub') {
    closeDrawer()
    openCapabilityHub(String(d.tab || 'experts'))
    return
  }
  if (d.type === 'settings-tab-change' && SETTINGS_SURFACE_TAB_IDS.has(d.tab)) {
    if (!isSettingsSource) return
    settingsSurfaceTab = d.tab
    syncCenterSurfaceTabs('settings', settingsSurfaceTab)
    return
  }
  if (d.type === 'close-settings-inline') {
    if (!isSettingsSource) return
    if (drawerKind === 'settings') closeDrawer()
    return
  }
  const pane = d.paneId === 'right' ? 'right' : (d.paneId === 'left' ? 'left' : null)
  if (d.type === 'pane-ready' && pane) {
    panes[pane].ready = true
    if (panes[pane].pending) { const m = panes[pane].pending; panes[pane].pending = null; panes[pane].iframe.contentWindow.postMessage(m, '*') }
    else if (panes[pane].active) panes[pane].iframe.contentWindow.postMessage({ type: 'load-note', id: panes[pane].active }, '*')
    return
  }
  if (d.type === 'note-meta') {
    const n = noteById(d.id)
    if (n) {
      if (d.title != null) n.title = d.title
      n.project = d.project
      n.category = d.category
      n.favorite = d.favorite
      n.version = d.version
    }
    if (pane) renderTabs(pane)
    renderTree()
    return
  }
  if (d.type === 'open-versions') { openVersions(d.id); return }
  if (d.type === 'open-final-prompt') { openFinalPrompt(d); return }
  if (d.type === 'set-workspace-mode' || d.type === 'request-workspace-mode') {
    const next = d.mode === 'edit' ? 'edit' : 'agent'
    if (next === 'agent' && workspaceMode !== 'agent') sideCollapsedBeforeAgent = sideCollapsed
    workspaceMode = next
    applyWorkspaceMode()
    saveState()
    return
  }
})

// ── 状态持久化 ─────────────────────────────────────────────
function saveState() {
  const st = {
    split: splitOn,
    activePane,
    left: { tabs: panes.left.tabs.map(t => t.id), active: panes.left.active },
    right: { tabs: panes.right.tabs.map(t => t.id), active: panes.right.active },
    collapsed: [...collapsed],
    sourceCollapsed: [...sourceCollapsed],
    expandedChains: [...expandedChains],
    sideCollapsed,
    workspaceMode,
    workbenchOn,
    workbenchAutomationOn,
    // 不再持久化「进入单项目」；侧栏保持 Obsidian 式就地展开
  }
  window.api.saveWorkspaceState(st)
}
function restoreState(st) {
  if (!st) return
  collapsed = new Set(st.collapsed || [])
  sourceCollapsed = new Set(st.sourceCollapsed || [])
  workspaceMode = st.workspaceMode === 'edit' ? 'edit' : 'agent'
  workbenchOn = !!st.workbenchOn
  workbenchAutomationOn = !!st.workbenchAutomationOn && workbenchOn
  // Agent 模式强制收起文件栏；编辑模式尊重已保存状态
  sideCollapsed = workspaceMode === 'agent' ? true : !!st.sideCollapsed
  applySideCollapsed()
  const validIds = new Set(data.notes.map(n => n.id))
  expandedChains = new Set((st.expandedChains || []).filter(id => validIds.has(id)))
  const validProjects = new Set(data.groups.map(g => g.key))
  focusedProject = null // 废弃钻入单项目视图
  const restorePane = (pane, ps) => {
    if (!ps) return
    const ids = (ps.tabs || []).filter(id => validIds.has(id))
    panes[pane].tabs = ids.map(id => ({ id }))
    panes[pane].active = validIds.has(ps.active) ? ps.active : (ids[0] || null)
  }
  restorePane('left', st.left)
  restorePane('right', st.right)
  if (st.split) { splitOn = true; document.querySelector('[data-pane="right"]').classList.remove('hidden'); document.getElementById('btnSplit').classList.add('active') }
  activePane = st.activePane === 'right' && splitOn ? 'right' : 'left'
  for (const pane of ['left', 'right']) {
    if (panes[pane].active) ensureExpandedForOpen(panes[pane].active)
  }
  // 渲染 tabs 并加载激活项
  for (const pane of ['left', 'right']) {
    renderTabs(pane)
    if (panes[pane].active) postToPane(pane, { type: 'load-note', id: panes[pane].active })
  }
  syncAgentDocumentSurface()
}

// ── 初始化 ─────────────────────────────────────────────────
async function reload() {
  const r = await window.api.workspaceInit()
  data = {
    notes: r.notes || [],
    groups: r.groups || [],
    state: r.state || null,
    sources: r.sources || [],
    activeSourceId: r.activeSourceId || null,
    fileTree: r.fileTree || null,
    generatedArtifacts: data.generatedArtifacts || [],
  }
  // 文件中心始终是统一入口；没有本地源时仍展示知识库与 AI 生成分组。
  treeMode = 'sources'
  if (!data.activeSourceId) fileCenterLayer = 'hub'
  resetSourceLazyState(data.fileTree, data.activeSourceId)
  renderTree()
  if (workbenchOn && window.Workbench) window.Workbench.load()
  return r
}
async function hydrateOpenSourceDirs() {
  const src = activeSource()
  if (!src || !data.fileTree?.lazy) return
  const pending = (data.fileTree.nodes || []).filter(node => {
    if (node.type !== 'dir') return false
    const key = sourceDirKey(src.id, node.path)
    return !sourceCollapsed.has(key) && !sourceLoadedDirs.has(key)
  })
  for (const node of pending) {
    await ensureSourceDirLoaded(src.id, node.path)
  }
}

async function init() {
  mountIcons(document)
  initWorkSurfaceHost()
  if (window.WorkspaceAgent) {
    WorkspaceAgent.init({
      getEditorContext: getActiveEditorContext,
      applyToEditor: applyToActiveEditor,
      getFileCatalog: getAgentFileCatalog,
      openReferencedFile: openAgentReferencedFile,
      openKnowledgePanel: openKnowledgeOsPanel,
      toast,
      workSurface: workSurfaceHost,
    })
  }
  if (window.Workbench) window.Workbench.init({
    toast,
    onViewChange: setWorkbenchTaskView,
    onPageChange: syncWorkbenchRailFromPage,
    onExpertTaskStart: startExpertTaskChat,
    onExpertTaskResume: resumeExpertTaskChat,
  })
  const r = await reload()
  await hydrateGeneratedArtifacts()
  const hasSavedCollapse = r.state && Array.isArray(r.state.collapsed)
  const hasSavedSourceCollapse = r.state && Array.isArray(r.state.sourceCollapsed)
  restoreState(r.state)
  syncAgentDocumentSurface()
  // 无历史折叠态时：懒加载树保持「未加载目录默认折叠」（reload 已 seed，勿被空数组冲掉）
  if (!hasSavedSourceCollapse && data.fileTree?.lazy && data.activeSourceId) {
    seedUnloadedDirsCollapsed(data.activeSourceId, data.fileTree.nodes)
  }
  applyWorkspaceMode()
  applyWorkbench()
  if (workbenchOn && workbenchAutomationOn) window.Workbench?.openPage?.('automation')
  // 首次使用（无保存状态）：默认折叠所有非收藏分组，避免一屏塞满
  if (!hasSavedCollapse && !focusedProject) {
    collapsed = new Set(data.groups.map(g => g.key))
    const activeId = panes.left.active || panes.right.active
    if (activeId) { const n = noteById(activeId); if (n) collapsed.delete(projectKeyOf(n)) }
  }
  renderTree()
  await hydrateOpenSourceDirs()
  ensureShellLayoutInvariant()
  healBlankCenterSurface()
  setTimeout(() => { ensureShellLayoutInvariant(); healBlankCenterSurface(); syncRailNavigation() }, 0)
  setTimeout(() => { ensureShellLayoutInvariant(); healBlankCenterSurface(); syncRailNavigation() }, 300)
  setTimeout(() => { ensureShellLayoutInvariant(); healBlankCenterSurface(); syncRailNavigation() }, 1200)
}

/** 右栏 Work Surface：doc ↔ review */
const workSurfaceHost = (() => {
  const appShellEl = document.getElementById('appShell')
  const wrap = document.getElementById('workSurfaceWrap')
  const modePill = document.getElementById('workSurfaceModePill')
  const titleEl = document.getElementById('workSurfaceArtTitle')
  const bodyEl = document.getElementById('workReviewBody')
  const actionsEl = document.getElementById('workReviewActions')
  const btnBack = document.getElementById('btnBackToDoc')
  const btnFullscreen = document.getElementById('btnToggleLinkFullscreen')
  const btnOpenLinkExternal = document.getElementById('btnOpenLinkExternal')
  const btnCopyLinkTop = document.getElementById('btnCopyLinkTop')
  const surface = (window.WorkSurface && window.WorkSurface.createWorkSurface)
    ? window.WorkSurface.createWorkSurface()
    : null
  let artifactsRef = []
  let linkPreview = null
  let linkFullscreen = false
  let onAccept = null
  let onReject = null
  let onApplyEditor = null
  let onCreateFeishuDraft = null

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function applyLinkFullscreenChrome() {
    const active = Boolean(linkPreview) && linkFullscreen
    appShellEl?.classList.toggle('link-preview-fullscreen', active)
    if (!btnFullscreen) return
    btnFullscreen.setAttribute('aria-pressed', active ? 'true' : 'false')
    const title = active ? '退出全屏预览（Esc）' : '全屏打开预览'
    btnFullscreen.title = title
    btnFullscreen.setAttribute('aria-label', title)
  }

  function setLinkFullscreen(next) {
    linkFullscreen = Boolean(next && linkPreview)
    applyLinkFullscreenChrome()
  }

  function exitLinkFullscreen() {
    linkFullscreen = false
    applyLinkFullscreenChrome()
  }

  function applyBackButtonChrome() {
    if (!btnBack) return
    const title = linkPreview ? '关闭预览' : '返回文档'
    btnBack.title = title
    btnBack.setAttribute('aria-label', title)
  }

  function applyChrome() {
    if (!wrap || !surface) return
    const snap = surface.snapshot()
    wrap.classList.toggle('surface-review', snap.mode === 'review' && !linkPreview)
    wrap.classList.toggle('surface-link', Boolean(linkPreview))
    applyBackButtonChrome()
    if (linkPreview) {
      if (modePill) modePill.textContent = '预览'
      if (titleEl) titleEl.textContent = linkPreview.title
      renderLinkPreview(linkPreview)
      applyLinkFullscreenChrome()
      return
    }
    exitLinkFullscreen()
    if (modePill) modePill.textContent = '审阅'
    const art = surface.findArtifact(artifactsRef)
    if (titleEl) titleEl.textContent = art ? (art.title || art.type || '产物') : ''
    if (snap.mode === 'review' && art) renderReview(art)
  }

  function renderLinkPreview(link) {
    if (!bodyEl || !actionsEl) return
    const href = esc(link.href)
    const canEmbed = ['https:', 'http:'].includes(String(link.protocol || '').toLowerCase())
    const previewBody = canEmbed
      ? `<webview class="work-link-webview" src="${href}" partition="persist:knowme-preview"></webview>`
      : `<div class="work-link-preview-note">该链接不适合在应用内预览，请在系统浏览器或默认应用中打开。</div>`
    bodyEl.innerHTML = `
      <div class="work-link-preview">
        <section class="work-link-shell">
          <div class="work-link-viewport">${previewBody}</div>
        </section>
      </div>`
    const openLabel = link.protocol === 'mailto:'
      ? '使用邮箱打开'
      : (link.isFeishu ? '在飞书打开' : '在浏览器打开')
    if (btnOpenLinkExternal) {
      btnOpenLinkExternal.title = openLabel
      btnOpenLinkExternal.setAttribute('aria-label', openLabel)
    }
    if (btnCopyLinkTop) {
      btnCopyLinkTop.title = '复制链接'
      btnCopyLinkTop.setAttribute('aria-label', '复制链接')
    }
    actionsEl.innerHTML = ''
  }

  function renderReview(art) {
    if (!bodyEl || !actionsEl) return
    const isWritingDraft = art.type === 'text' && art.meta?.workspaceAction === 'writing_review'
    const typeLabel = ({
      knowledge_proposal: '知识提案',
      health_report: '健康报告',
      editor_patch: '编辑器写入',
      wiki_write: 'Wiki 写入',
      text: '文本',
    })[art.type] || art.type
    const pathLine = art.targetPath
      ? `目标路径：${esc(art.targetPath)}`
      : (art.type === 'editor_patch' ? '目标：当前打开的文件（确认后写入）' : '')
    const st = art.status || 'draft'
    bodyEl.innerHTML = `
      <div class="work-review-meta">${esc(typeLabel)} · ${st === 'draft' ? '待确认' : st}</div>
      <h2 class="work-review-title">${esc(art.title || '产物')}</h2>
      ${pathLine ? `<div class="work-review-meta">${pathLine}</div>` : ''}
      <div class="work-review-content">${esc(String(art.body || '').slice(0, 100000))}</div>`
    if (st === 'draft') {
      if (isWritingDraft) {
        actionsEl.innerHTML = `
          <button type="button" data-ws-act="apply-editor">写入当前编辑器</button>
          <button type="button" data-ws-act="feishu-draft">生成飞书文档草稿</button>
          <button type="button" class="subtle" data-ws-act="reject">拒绝</button>`
      } else {
        const acceptLabel = art.type === 'editor_patch' ? '允许写入' : '接受'
        actionsEl.innerHTML = `
          <button type="button" data-ws-act="accept">${acceptLabel}</button>
          <button type="button" class="subtle" data-ws-act="reject">拒绝</button>`
      }
    } else {
      actionsEl.innerHTML = `<div class="work-review-meta" style="margin:0">${st === 'accepted' ? '已接受' : '已拒绝'}</div>`
    }
  }

  function openReview(artifactId, artifacts) {
    if (artifacts) artifactsRef = artifacts
    if (!surface) return
    linkFullscreen = false
    linkPreview = null
    surface.openReview(artifactId)
    applyChrome()
  }

  function openLink(href, title = '飞书文档') {
    const parsed = window.FeishuLink?.parseOpenLink?.(href)
      || window.FeishuLink?.parseFeishuUrl?.(href)
    if (!parsed) return false
    linkPreview = {
      ...parsed,
      href: parsed.href,
      title: String(title || parsed.label || '链接').slice(0, 120),
    }
    linkFullscreen = false
    if (surface) surface.backToDoc()
    applyChrome()
    return true
  }

  function syncArtifacts(artifacts, { autoOpen = true } = {}) {
    artifactsRef = Array.isArray(artifacts) ? artifacts : []
    if (!surface) return
    surface.onArtifactsChanged(artifactsRef, { autoOpen })
    applyChrome()
  }

  function backToDoc() {
    linkFullscreen = false
    linkPreview = null
    if (!surface) return
    surface.backToDoc()
    applyChrome()
  }

  function initWorkSurfaceHost() {
    btnBack?.addEventListener('click', () => backToDoc())
    btnFullscreen?.addEventListener('click', () => {
      if (!linkPreview) return
      setLinkFullscreen(!linkFullscreen)
    })
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !linkFullscreen) return
      e.preventDefault()
      setLinkFullscreen(false)
    })
    btnOpenLinkExternal?.addEventListener('click', async () => {
      if (!linkPreview) return
      await window.api.openExternal(linkPreview.href)
    })
    btnCopyLinkTop?.addEventListener('click', () => {
      if (!linkPreview) return
      window.api.copyToClipboard(linkPreview.href)
    })
    actionsEl?.addEventListener('click', async e => {
      const linkBtn = e.target.closest('[data-ws-link-act]')
      if (linkBtn && linkPreview) {
        const action = linkBtn.dataset.wsLinkAct
        if (action === 'copy') {
          window.api.copyToClipboard(linkPreview.href)
        } else {
          await window.api.openExternal(linkPreview.href)
        }
        return
      }
      const btn = e.target.closest('[data-ws-act]')
      if (!btn || !surface) return
      const id = surface.getArtifactId()
      if (!id) return
      if (btn.dataset.wsAct === 'accept' && onAccept) await onAccept(id)
      if (btn.dataset.wsAct === 'reject' && onReject) await onReject(id)
      if (btn.dataset.wsAct === 'apply-editor' && onApplyEditor) await onApplyEditor(id)
      if (btn.dataset.wsAct === 'feishu-draft' && onCreateFeishuDraft) await onCreateFeishuDraft(id)
    })
  }

  return {
    init: initWorkSurfaceHost,
    openReview,
    syncArtifacts,
    backToDoc,
    openLink,
    setHandlers({ accept, reject, applyEditor, createFeishuDraft }) {
      onAccept = accept
      onReject = reject
      onApplyEditor = applyEditor
      onCreateFeishuDraft = createFeishuDraft
    },
    getMode: () => (surface ? surface.getMode() : 'doc'),
  }
})()

function initWorkSurfaceHost() {
  workSurfaceHost.init()
}
if (window.api.onWorkspaceRefresh) {
  window.api.onWorkspaceRefresh(async () => {
    const scrollActive = { left: panes.left.active, right: panes.right.active }
    await reload()
    await hydrateGeneratedArtifacts()
    // 保持标签与激活不变
    panes.left.active = scrollActive.left
    panes.right.active = scrollActive.right
    renderTabs('left'); renderTabs('right'); renderTree()
    syncAgentDocumentSurface()
  })
}
if (window.api.onWorkspaceOpenNote) {
  window.api.onWorkspaceOpenNote(async (id) => {
    if (!id) return
    await reload()
    openFile(id, activePane)
  })
}
if (window.api.onWorkspaceOpenSettings) {
  window.api.onWorkspaceOpenSettings((tab) => {
    openSettingsPanel(String(tab || ''))
  })
}
init()
