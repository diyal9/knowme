'use strict'
/* 工作台编辑器 pane：复用便签 MD 编辑内核，去窗口控制/托盘/OKF 收录/智能分类。
   通过 location.hash 传入 noteId；版本对比与最终提示词交给父窗口右侧面板。 */

function mountAllIcons(root) { if (window.StickyIcons) StickyIcons.mount(root || document) }
mountAllIcons()

let note = null, saveTimer = null, chatHistory = []
let titleManual = false, titleTimer = null, titleReq = 0
let editorMode = 'md', mdView = 'edit'
/** 父工作区模式：agent | edit（由 workspace 下发） */
let parentWorkspaceMode = 'edit'

const pane = document.getElementById('pane')
const editor = document.getElementById('editor')
const editorWrap = document.getElementById('editorWrap')
const previewPane = document.getElementById('previewPane')
const caretMirror = document.getElementById('caretMirror')
const mdSlashMenu = document.getElementById('mdSlashMenu')
const selBubble = document.getElementById('selBubble')
const inpProj = document.getElementById('inpProject')
const inpCategory = document.getElementById('inpCategory')
const inpOkfTags = document.getElementById('inpOkfTags')
const btnReadingView = document.getElementById('btnReadingView')
const btnMore = document.getElementById('btnMore')
const moreMenu = document.getElementById('moreMenu')
const toastWrap = document.getElementById('toastWrap')
const toastEl = document.getElementById('toast')
const tokenEst = document.getElementById('tokenEst')
const verDisp = document.getElementById('verDisplay')
const verInput = document.getElementById('verInput')
const btnStar = document.getElementById('btnStar')
const cntEl = document.getElementById('cnt')
const wordCntEl = document.getElementById('wordCnt')
const editModeIco = document.getElementById('editModeIco')
const footerM = document.getElementById('footerMeta')
const saveTime = document.getElementById('saveTime')
const varBar = document.getElementById('varBar')
const varChips = document.getElementById('varChips')
const aiClose = document.getElementById('aiClose')
const chatLog = document.getElementById('chatLog')
const aiInput = document.getElementById('aiInput')
const aiSend = document.getElementById('aiSend')
const aiComposer = document.getElementById('aiComposer')
const aiQuickBtn = document.getElementById('aiQuickBtn')
const aiQuickMenu = document.getElementById('aiQuickMenu')
const aiMoreBtn = document.getElementById('aiMoreBtn')
const aiMoreMenu = document.getElementById('aiMoreMenu')
const chatImageViewer = document.getElementById('chatImageViewer')
const chatImageViewerImg = document.getElementById('chatImageViewerImg')
const chatImageViewerClose = document.getElementById('chatImageViewerClose')

const toast = window.UIKit.createToast({ wrap: toastWrap, text: toastEl, defaultMs: 3200 })

function postToParent(msg) {
  try { window.parent && window.parent.postMessage(Object.assign({ paneId: PANE_ID }, msg), '*') } catch {}
}
function notifyMeta() {
  if (!note) return
  postToParent({
    type: 'note-meta',
    id: note.id,
    title: inpProj.value.trim(),
    project: inpCategory.value.trim(),
    category: inpCategory.value.trim(),
    favorite: !!note.favorite,
    version: note.version || '0.1',
  })
}

const PANE_ID = new URLSearchParams(location.search).get('pane') || 'p1'

function estimateTokens(text) { const len = (text || '').length; return len ? Math.max(1, Math.ceil(len / 3)) : 0 }
function getActiveContent() { return editor.value }
function renderPreview() {
  const html = marked.parse(editor.value || '', { breaks: true, gfm: true })
  previewPane.innerHTML = DOMPurify.sanitize(html)
}
function isMdEditMode() { return editorMode === 'md' && mdView === 'edit' }
function applyParentWorkspaceMode() {
  pane.classList.add('ws-shell')
  pane.classList.remove('ai-open')
  pane.classList.toggle('mode-agent-preview', parentWorkspaceMode === 'agent')
  if (parentWorkspaceMode === 'agent') {
    if (editorMode !== 'md') setEditorMode('md')
    setMdView('preview')
  } else {
    pane.classList.remove('mode-agent-preview')
    if (editorMode === 'md' && mdView === 'preview') setMdView('edit')
  }
}
function applyEditorModeUI() {
  const inMd = editorMode === 'md'
  const preview = inMd && mdView === 'preview'
  editorWrap.classList.toggle('preview-mode', preview)
  if (btnReadingView) {
    const icoEl = btnReadingView.querySelector('[data-icon]')
    const nextIcon = preview ? 'pencilLine' : 'bookOpen'
    if (icoEl && icoEl.dataset.icon !== nextIcon) {
      icoEl.dataset.icon = nextIcon
      StickyIcons.mount(btnReadingView)
    }
    btnReadingView.classList.toggle('active', preview)
    btnReadingView.setAttribute('aria-pressed', preview ? 'true' : 'false')
    btnReadingView.title = preview ? '编辑模式' : '阅读视图'
    btnReadingView.setAttribute('aria-label', preview ? '编辑模式' : '阅读视图')
  }
  if (editModeIco) editModeIco.style.opacity = preview ? '0.35' : '0.7'
  if (preview) renderPreview()
  syncMoreMenuActive()
  hideSelBubble(); hideMdSlashMenu()
}
function syncMoreMenuActive() {
  if (!moreMenu) return
  const preview = editorMode === 'md' && mdView === 'preview'
  const source = editorMode === 'md' && mdView === 'edit'
  const plain = editorMode !== 'md'
  moreMenu.querySelectorAll('[data-act]').forEach(btn => {
    const act = btn.dataset.act
    let on = false
    if (act === 'reading') on = preview
    else if (act === 'source') on = source
    else if (act === 'plain') on = plain
    else if (act === 'favorite') on = !!note?.favorite
    btn.classList.toggle('active', on)
  })
}
function toggleReadingView() {
  if (parentWorkspaceMode === 'agent') {
    postToParent({ type: 'set-workspace-mode', mode: 'edit' })
    return
  }
  if (editorMode === 'md' && mdView === 'preview') setMdView('edit')
  else {
    if (editorMode !== 'md') setEditorMode('md')
    setMdView('preview')
  }
}
function hideMoreMenu() {
  if (!moreMenu) return
  moreMenu.classList.remove('show')
  if (btnMore) btnMore.setAttribute('aria-expanded', 'false')
}
function toggleMoreMenu() {
  if (!moreMenu) return
  const open = !moreMenu.classList.contains('show')
  if (open) syncMoreMenuActive()
  moreMenu.classList.toggle('show', open)
  if (btnMore) btnMore.setAttribute('aria-expanded', open ? 'true' : 'false')
}
function openVersions() { if (note) postToParent({ type: 'open-versions', id: note.id }) }
function openFinalPrompt() {
  if (note) postToParent({ type: 'open-final-prompt', id: note.id, content: editor.value, category: (note.project || note.category || inpCategory.value || '').trim() })
}
function runMoreAction(act) {
  hideMoreMenu()
  if (act === 'reading') toggleReadingView()
  else if (act === 'source') { setEditorMode('md'); setMdView('edit') }
  else if (act === 'plain') setEditorMode('plain')
  else if (act === 'versions') openVersions()
  else if (act === 'final-prompt') openFinalPrompt()
  else if (act === 'favorite') {
    if (!note) return
    const next = !note.favorite
    window.api.toggleFavorite(note.id)
    setFavorite(next)
  }
}
function setEditorMode(mode) {
  editorMode = mode === 'md' ? 'md' : 'plain'
  if (editorMode !== 'md') mdView = 'edit'
  applyEditorModeUI()
  if (note) { note.editorMode = editorMode; note.mdView = mdView; schedSave() }
}
function setMdView(mode) {
  if (editorMode !== 'md') return
  mdView = mode === 'preview' ? 'preview' : 'edit'
  applyEditorModeUI()
  if (note) { note.editorMode = editorMode; note.mdView = mdView; schedSave() }
}

function syncCaretMirrorStyles() {
  const cs = getComputedStyle(editor)
  caretMirror.style.width = editor.clientWidth + 'px'
  caretMirror.style.font = cs.font
  caretMirror.style.lineHeight = cs.lineHeight
  caretMirror.style.letterSpacing = cs.letterSpacing
  caretMirror.style.padding = cs.padding
  caretMirror.style.border = cs.border
  caretMirror.style.boxSizing = cs.boxSizing
  caretMirror.style.whiteSpace = 'pre-wrap'
  caretMirror.style.wordWrap = 'break-word'
}
function getCaretCoords() {
  syncCaretMirrorStyles()
  const pos = editor.selectionStart
  caretMirror.textContent = editor.value.substring(0, pos)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  caretMirror.appendChild(marker)
  const editorRect = editor.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = caretMirror.getBoundingClientRect()
  caretMirror.textContent = ''
  return {
    left: editorRect.left + (markerRect.left - mirrorRect.left) - editor.scrollLeft,
    top: editorRect.top + (markerRect.top - mirrorRect.top) - editor.scrollTop,
  }
}

const SLASH_ITEMS = [
  { id: 'h1', group: '基础', icon: 'note', label: '一级标题', keywords: '标题 h1', insert: '# ' },
  { id: 'h2', group: '基础', icon: 'note', label: '二级标题', keywords: '标题 h2', insert: '## ' },
  { id: 'h3', group: '基础', icon: 'note', label: '三级标题', keywords: '标题 h3', insert: '### ' },
  { id: 'ol', group: '基础', icon: 'listOrdered', label: '有序列表', keywords: '列表 ol', insert: '1. ' },
  { id: 'ul', group: '基础', icon: 'list', label: '无序列表', keywords: '列表 ul', insert: '- ' },
  { id: 'code', group: '基础', icon: 'code', label: '代码块', keywords: '代码 code', insert: '```\n\n```\n', cursorOffset: -4 },
  { id: 'quote', group: '基础', icon: 'quote', label: '引用', keywords: '引用 quote', insert: '> ' },
  { id: 'hr', group: '基础', icon: 'hr', label: '分割线', keywords: '分割 hr', insert: '---\n' },
  { id: 'link', group: '常用', icon: 'link', label: '链接', keywords: '链接 link', insert: '[文字](url)' },
  { id: 'task', group: '常用', icon: 'check', label: '任务列表', keywords: '任务 todo', insert: '- [ ] ' },
  { id: 'table', group: '常用', icon: 'table', label: '表格 3×2', keywords: '表格 table', insert: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n' },
]
let mdSlashOpen = false, mdSlashStart = 0, mdSlashQuery = '', mdSlashActiveIdx = 0, mdSlashFiltered = []
function hideMdSlashMenu() { mdSlashOpen = false; mdSlashMenu.classList.remove('show') }
function getMdSlashLineInfo() {
  const pos = editor.selectionStart
  const beforeCaret = editor.value.slice(0, pos)
  const m = beforeCaret.match(/\/([^\s/]*)$/)
  if (!m) return null
  const query = m[1] || ''
  return { slashStart: pos - query.length - 1, query }
}
function filterMdSlashItems(q) {
  const qq = (q || '').toLowerCase().trim()
  if (!qq) return SLASH_ITEMS.slice()
  return SLASH_ITEMS.filter(it => ((it.label + ' ' + (it.keywords || '')).toLowerCase().includes(qq) || it.id.includes(qq)))
}
function renderMdSlashMenu(items) {
  mdSlashFiltered = items
  mdSlashActiveIdx = Math.min(mdSlashActiveIdx, Math.max(0, items.length - 1))
  let lastGroup = ''
  mdSlashMenu.innerHTML = items.map((it, i) => {
    const groupHtml = it.group && it.group !== lastGroup ? `<div class="slash-group">${it.group}</div>` : ''
    lastGroup = it.group || lastGroup
    const iconHtml = `<span class="ico ico-sm" data-icon="${it.icon}"></span>`
    return `${groupHtml}<button type="button" class="slash-item${i === mdSlashActiveIdx ? ' active' : ''}" data-idx="${i}">${iconHtml}<span class="slash-label">${it.label}</span></button>`
  }).join('')
  StickyIcons.mount(mdSlashMenu)
}
function positionMdSlashMenu() {
  const coords = getCaretCoords()
  const menuH = mdSlashMenu.offsetHeight || 200
  let top = coords.top + 22, left = coords.left
  if (top + menuH > window.innerHeight - 8) top = coords.top - menuH - 6
  if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268
  mdSlashMenu.style.left = Math.max(8, left) + 'px'
  mdSlashMenu.style.top = Math.max(8, top) + 'px'
}
function showMdSlashMenu(info) {
  mdSlashOpen = true; mdSlashStart = info.slashStart; mdSlashQuery = info.query; mdSlashActiveIdx = 0
  const items = filterMdSlashItems(mdSlashQuery)
  if (!items.length) { hideMdSlashMenu(); return }
  renderMdSlashMenu(items)
  mdSlashMenu.classList.add('show')
  requestAnimationFrame(positionMdSlashMenu)
}
function applyMdSlashItem(item) {
  const end = editor.selectionStart
  editor.focus()
  editor.setSelectionRange(mdSlashStart, end)
  document.execCommand('insertText', false, item.insert)
  if (item.cursorOffset) { const p = editor.selectionStart + item.cursorOffset; editor.setSelectionRange(p, p) }
  hideMdSlashMenu(); updateCounts(); updateVarBar(editor.value)
  if (note) { note.content = editor.value; schedSave() }
}
function insertTextAtSelection(text, selStart, selEnd) {
  editor.focus(); editor.setSelectionRange(selStart, selEnd)
  document.execCommand('insertText', false, text)
}
function wrapSelection(before, after, placeholder) {
  const start = editor.selectionStart, end = editor.selectionEnd
  const selected = editor.value.slice(start, end)
  const inner = selected || placeholder || '文字'
  insertTextAtSelection(before + inner + after, start, end)
  if (!selected && placeholder) { const p = start + before.length; editor.setSelectionRange(p, p + inner.length) }
}
function applyMdAction(action) {
  switch (action) {
    case 'bold': wrapSelection('**', '**', '文字'); break
    case 'italic': wrapSelection('*', '*', '文字'); break
    case 'code': wrapSelection('`', '`', 'code'); break
    case 'strike': wrapSelection('~~', '~~', '文字'); break
    case 'link': wrapSelection('[', '](url)', '文字'); break
  }
  updateCounts(); updateVarBar(editor.value)
  if (note) { note.content = editor.value; schedSave() }
  hideSelBubble()
}
function hideSelBubble() { selBubble.classList.remove('show') }
function updateSelBubble() {
  if (!isMdEditMode()) { hideSelBubble(); return }
  const start = editor.selectionStart, end = editor.selectionEnd
  if (start === end || document.activeElement !== editor) { hideSelBubble(); return }
  const rect = editor.getBoundingClientRect()
  const selStart = editor.selectionStart, savedEnd = editor.selectionEnd
  const coords = getCaretCoords()
  editor.setSelectionRange(selStart, savedEnd)
  const bubbleW = selBubble.offsetWidth || 160
  let left = coords.left - bubbleW / 2, top = coords.top - 36
  if (top < rect.top) top = coords.top + 20
  if (left < 8) left = 8
  if (left + bubbleW > window.innerWidth - 8) left = window.innerWidth - bubbleW - 8
  selBubble.style.left = left + 'px'; selBubble.style.top = top + 'px'
  selBubble.classList.add('show')
}
function handleSmartEnter(e) {
  const start = editor.selectionStart, val = editor.value
  const lineStart = val.lastIndexOf('\n', start - 1) + 1
  const line = val.slice(lineStart, start)
  const taskM = line.match(/^(\s*)- \[([ xX])\] (.*)$/)
  if (taskM && !taskM[3].trim()) { e.preventDefault(); insertTextAtSelection('\n', start - line.length + taskM[1].length, start); return true }
  if (taskM) { e.preventDefault(); insertTextAtSelection('\n' + taskM[1] + '- [ ] ', start, start); return true }
  const bulletM = line.match(/^(\s*)([-*+]|\d+\.) (.*)$/)
  if (bulletM && !bulletM[3].trim()) { e.preventDefault(); insertTextAtSelection('\n', start - line.length + bulletM[1].length, start); return true }
  if (bulletM) {
    e.preventDefault()
    const marker = /^\d+\./.test(bulletM[2]) ? `${parseInt(bulletM[2], 10) + 1}. ` : '- '
    insertTextAtSelection('\n' + bulletM[1] + marker, start, start)
    return true
  }
  return false
}
function handleListTab(e, outdent) {
  const start = editor.selectionStart, val = editor.value
  const lineStart = val.lastIndexOf('\n', start - 1) + 1
  const lineEnd = val.indexOf('\n', start)
  const end = lineEnd === -1 ? val.length : lineEnd
  const line = val.slice(lineStart, end)
  if (outdent) {
    if (line.startsWith('  ')) { e.preventDefault(); insertTextAtSelection(line.slice(2), lineStart, end) }
    else if (line.startsWith('\t')) { e.preventDefault(); insertTextAtSelection(line.slice(1), lineStart, end) }
  } else if (/^(\s*)([-*+]|\d+\.|- \[ \]) /.test(line) || line.match(/^\s/)) {
    e.preventDefault(); insertTextAtSelection('  ' + line, lineStart, end); editor.setSelectionRange(start + 2, start + 2)
  }
}
function countWords(text) {
  const s = String(text || '')
  const cjk = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const latin = (s.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return cjk + latin
}
function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US')
}
function updateCounts() {
  const text = getActiveContent()
  const chars = text.length
  const words = countWords(text)
  if (cntEl) cntEl.textContent = `${formatCount(chars)} 个字符`
  if (wordCntEl) wordCntEl.textContent = `${formatCount(words)} 个词`
  if (tokenEst) tokenEst.textContent = ''
}
const relTime = window.UIKit.relativeTimeCompact
function detectVars(text) {
  const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)]
  return [...new Set(matches.map(m => m[1].trim()))].filter(Boolean)
}
function updateVarBar(text) {
  const vars = detectVars(text)
  if (!vars.length) { varBar.classList.remove('visible'); return }
  varBar.classList.add('visible')
  varChips.innerHTML = vars.map(v => `<span class="var-chip">{{${v}}}</span>`).join('')
}
function markDirty() { footerM.className = 'footer-meta dirty'; saveTime.textContent = '编辑中…' }
function markSaved() {
  footerM.className = 'footer-meta saved'; saveTime.textContent = '已保存'
  setTimeout(() => { footerM.className = 'footer-meta'; saveTime.textContent = relTime(note?.updatedAt) }, 1800)
}
function schedSave() {
  markDirty(); clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!note) return
    const content = editor.value
    if (note.fsSourceId && note.fsPath) {
      window.api.sourcesWriteFile({
        sourceId: note.fsSourceId,
        path: note.fsPath,
        content,
      }).then(r => {
        if (!r?.ok) toast(r?.error || '保存失败', 'error')
        else {
          note.content = content
          note.updatedAt = new Date().toISOString()
          markSaved()
        }
      })
      return
    }
    const okfTags = inpOkfTags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    window.api.updateNote({
      id: note.id, content,
      title: inpProj.value.trim(),
      project: inpCategory.value.trim(),
      projectManual: titleManual,
      version: note.version || '0.1',
      category: inpCategory.value.trim(),
      okfTags, sections: null, editorMode, mdView,
    })
    note.content = content
    note.title = inpProj.value.trim()
    note.project = inpCategory.value.trim()
    note.category = inpCategory.value.trim()
    note.okfTags = okfTags
    note.sections = null
    note.editorMode = editorMode
    note.mdView = mdView
    note.updatedAt = new Date().toISOString()
    markSaved()
    notifyMeta()
  }, 700)
}
function getFirstParagraph(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return ''
  const blank = trimmed.search(/\n\s*\n/)
  return (blank >= 0 ? trimmed.slice(0, blank) : trimmed).trim()
}
function shouldAutoTitle() { return !titleManual && !inpProj.value.trim() }
function applyAutoTitle(title) {
  const t = (title || '').trim().slice(0, 40)
  if (!t || !shouldAutoTitle()) return
  inpProj.value = t
  if (note) note.title = t
  schedSave()
}
function scheduleAutoTitle(delay = 1500) {
  if (!shouldAutoTitle()) return
  clearTimeout(titleTimer)
  titleTimer = setTimeout(maybeAutoTitle, delay)
}
async function maybeAutoTitle() {
  if (!note || !shouldAutoTitle()) return
  const para = getFirstParagraph(editor.value)
  if (para.length < 10) return
  const req = ++titleReq
  inpProj.classList.add('generating')
  const prevPh = inpProj.placeholder
  inpProj.placeholder = '提炼标题中…'
  try {
    const result = await window.api.aiSuggestTitle({ content: editor.value })
    if (req !== titleReq || !shouldAutoTitle()) return
    if (result.title) applyAutoTitle(result.title)
  } finally {
    if (req === titleReq) { inpProj.classList.remove('generating'); inpProj.placeholder = prevPh }
  }
}

function setVersion(v) { if (note) note.version = v; verDisp.textContent = `v${v}` }
verDisp.addEventListener('click', () => {
  verInput.value = note?.version || '0.1'
  verDisp.classList.add('hidden'); verInput.classList.add('visible')
  verInput.focus(); verInput.select()
})
function commitVer() {
  const v = verInput.value.trim() || '0.1'
  setVersion(v)
  verDisp.classList.remove('hidden'); verInput.classList.remove('visible'); schedSave()
}
verInput.addEventListener('blur', commitVer)
verInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); commitVer() }
  if (e.key === 'Escape') { verDisp.classList.remove('hidden'); verInput.classList.remove('visible') }
})

editor.addEventListener('input', () => {
  updateCounts(); updateVarBar(editor.value)
  if (note) { note.content = editor.value; schedSave() }
  scheduleAutoTitle()
  if (isMdEditMode()) {
    const slashInfo = getMdSlashLineInfo()
    if (slashInfo) showMdSlashMenu(slashInfo); else hideMdSlashMenu()
  } else hideMdSlashMenu()
  if (editorMode === 'md' && mdView === 'preview') renderPreview()
})
editor.addEventListener('keyup', () => requestAnimationFrame(updateSelBubble))
editor.addEventListener('mouseup', () => requestAnimationFrame(updateSelBubble))
editor.addEventListener('scroll', () => { hideSelBubble(); if (mdSlashOpen) positionMdSlashMenu() })
editor.addEventListener('blur', () => setTimeout(hideSelBubble, 120))
editor.addEventListener('keydown', e => {
  if (!isMdEditMode()) return
  if (mdSlashOpen) {
    if (e.key === 'ArrowDown') { e.preventDefault(); mdSlashActiveIdx = Math.min(mdSlashActiveIdx + 1, mdSlashFiltered.length - 1); renderMdSlashMenu(mdSlashFiltered); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); mdSlashActiveIdx = Math.max(mdSlashActiveIdx - 1, 0); renderMdSlashMenu(mdSlashFiltered); return }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mdSlashFiltered[mdSlashActiveIdx]) applyMdSlashItem(mdSlashFiltered[mdSlashActiveIdx]); return }
    if (e.key === 'Escape') { e.preventDefault(); hideMdSlashMenu(); return }
  }
  if (e.key === 'Escape') { hideSelBubble(); return }
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) { if (handleSmartEnter(e)) return }
  if (e.key === 'Tab') { handleListTab(e, e.shiftKey); return }
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); applyMdAction('bold'); return }
    if (k === 'i') { e.preventDefault(); applyMdAction('italic'); return }
    if (k === 'k') { e.preventDefault(); applyMdAction('link'); return }
  }
})
inpCategory.addEventListener('input', () => { if (note) schedSave() })
inpOkfTags.addEventListener('input', () => { if (note) schedSave() })
btnReadingView?.addEventListener('click', () => toggleReadingView())
btnMore?.addEventListener('click', e => { e.stopPropagation(); toggleMoreMenu() })
moreMenu?.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return
  e.stopPropagation()
  runMoreAction(btn.dataset.act)
})
document.addEventListener('click', e => {
  if (!moreMenu?.classList.contains('show')) return
  if (btnMore?.contains(e.target) || moreMenu.contains(e.target)) return
  hideMoreMenu()
})
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMoreMenu() })
mdSlashMenu.addEventListener('mousedown', e => e.preventDefault())
mdSlashMenu.addEventListener('click', e => {
  const btn = e.target.closest('.slash-item'); if (!btn) return
  const idx = parseInt(btn.dataset.idx, 10)
  if (mdSlashFiltered[idx]) applyMdSlashItem(mdSlashFiltered[idx])
})
selBubble.querySelectorAll('button[data-md]').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault())
  btn.addEventListener('click', () => applyMdAction(btn.dataset.md))
})
StickyIcons.mount(selBubble)

inpProj.addEventListener('input', () => {
  const v = inpProj.value.trim()
  titleManual = v.length > 0
  if (note) { note.title = v; note.projectManual = titleManual; schedSave() }
})
editor.addEventListener('keydown', e => {
  if (e.defaultPrevented) return
  if (e.key === 'Tab') { e.preventDefault(); const s = editor.selectionStart; editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(editor.selectionEnd); editor.selectionStart = editor.selectionEnd = s + 2; schedSave() }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); clearTimeout(saveTimer); if (note) { schedSave(); markSaved() } }
  if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); copyContent() }
})

function copyContent() {
  const text = editor.value.trim(); if (!text) return
  const done = () => {
    if (note) { window.api.incrementCopy(note.id); note.copyCount = (note.copyCount || 0) + 1 }
    toast('已复制', 'success', 1400)
  }
  navigator.clipboard.writeText(text).then(done).catch(() => { window.api.copyToClipboard(text); done() })
}

function setFavorite(v) {
  if (note) note.favorite = v
  btnStar?.classList.toggle('on', v)
  syncMoreMenuActive()
  notifyMeta()
}
btnStar.addEventListener('click', () => {
  if (!note) return
  const next = !note.favorite
  window.api.toggleFavorite(note.id)
  setFavorite(next)
})
if (window.api.favoriteChanged) window.api.favoriteChanged(v => setFavorite(v))

// AI 助写（pane 内 CSS 分栏，无窗口 resize）
const escHtml = window.UIKit.escapeHtml
function openImageViewer(src, alt = '') {
  const safeSrc = String(src || '').trim()
  if (!safeSrc || !chatImageViewer || !chatImageViewerImg) return
  chatImageViewerImg.src = safeSrc
  chatImageViewerImg.alt = String(alt || '图片预览')
  chatImageViewer.classList.add('show')
  chatImageViewer.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}
function closeImageViewer() {
  if (!chatImageViewer || !chatImageViewerImg) return
  chatImageViewer.classList.remove('show')
  chatImageViewer.setAttribute('aria-hidden', 'true')
  chatImageViewerImg.removeAttribute('src')
  document.body.style.overflow = ''
}
function renderMarkdown(src) {
  return window.MarkdownLite.render(src)
}

function traceStatusIcon(status) {
  if (status === 'error') return '!'
  if (status === 'pending') return '<span class="trace-pulse" aria-hidden="true"></span>'
  return '✓'
}

function renderExecutionTimeline(m) {
  const trace = Array.isArray(m.trace) ? m.trace : []
  if (!trace.length) return ''
  const toolCount = trace.filter(item => item.kind === 'tool').length
  const errorCount = trace.filter(item => item.status === 'error').length
  const pending = trace.some(item => item.status === 'pending')
  const summary = pending
    ? '深度思考'
    : `思考过程 · ${trace.length} 步${toolCount ? ` · ${toolCount} 个工具` : ''}${errorCount ? ` · ${errorCount} 个失败` : ''}`
  const rows = trace.map(item => {
    const status = item.status === 'error' ? 'error' : item.status === 'pending' ? 'pending' : 'done'
    const duration = Number.isFinite(item.durationMs) && item.durationMs > 0
      ? `<span class="trace-time">${item.durationMs < 1000 ? `${Math.round(item.durationMs)}ms` : `${(item.durationMs / 1000).toFixed(1)}s`}</span>`
      : ''
    return `<div class="trace-row ${status}">
      <span class="trace-mark">${traceStatusIcon(status)}</span>
      <span class="trace-title">${escHtml(item.title || '执行步骤')}</span>
      ${duration}
    </div>`
  }).join('')
  return `<details class="chat-execution${pending ? ' is-running' : ''}"${pending || m.streaming ? ' open' : ''}>
    <summary class="chat-execution-summary">${pending ? '<span class="chat-execution-orb" aria-hidden="true"></span>' : ''}<span>${escHtml(summary)}</span></summary>
    <div class="chat-execution-list" role="log" aria-live="polite">${rows}</div>
  </details>`
}

function upsertAssistantTrace(message, event) {
  if (!message || !event?.id) return
  const trace = Array.isArray(message.trace) ? message.trace : []
  const index = trace.findIndex(item => item.id === event.id)
  const next = {
    id: String(event.id),
    kind: event.kind === 'tool' ? 'tool' : 'stage',
    title: String(event.title || '执行步骤'),
    status: event.status === 'error' ? 'error' : event.status === 'pending' ? 'pending' : 'done',
    durationMs: Number.isFinite(event.durationMs) ? event.durationMs : undefined,
  }
  if (index >= 0) trace[index] = { ...trace[index], ...next }
  else trace.push(next)
  message.trace = trace.slice(-40)
}

function renderChat() {
  if (!chatHistory.length) { chatLog.innerHTML = '<div class="chat-empty">描述需求，助手帮你写</div>'; return }
  chatLog.innerHTML = chatHistory.map((m, i) => {
    if (m.role === 'loading') return `<div class="chat-bubble assistant loading">${escHtml(m.text)}</div>`
    if (m.role === 'error') return `<div class="chat-bubble assistant err">${escHtml(m.text)}</div>`
    if (m.role === 'user') return `<div class="chat-bubble user">${escHtml(m.text)}</div>`
    const streamCls = m.streaming ? ' streaming' : ''
    const waiting = m.streaming && !String(m.text || '').trim()
    if (waiting) {
      const hasTrace = Array.isArray(m.trace) && m.trace.length > 0
      const status = hasTrace
        ? ''
        : `<span class="thinking-status" role="status"><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>${escHtml(m.activity || '思考中…')}</span>`
      return `<div class="chat-bubble assistant streaming thinking${hasTrace ? ' has-execution' : ''}" data-idx="${i}" aria-busy="true">${renderExecutionTimeline(m)}${status}</div>`
    }
    const cursor = m.streaming ? '<span class="stream-cursor">▍</span>' : ''
    const actions = (!m.streaming && m.text) ? `<div class="chat-actions">
      <button class="chat-act" data-act="copy" data-idx="${i}">复制</button>
      <button class="chat-act subtle" data-act="insert" data-idx="${i}">插入光标</button>
      <button class="chat-act subtle" data-act="append" data-idx="${i}">追加文末</button>
      <button class="chat-act subtle" data-act="replace" data-idx="${i}">替换全文…</button>
    </div>` : ''
    const body = m.streaming ? `<span class="chat-text">${escHtml(m.text)}</span>` : `<div class="chat-text md">${renderMarkdown(m.text)}</div>`
    return `<div class="chat-bubble assistant${streamCls}" data-idx="${i}">${renderExecutionTimeline(m)}${body}${cursor}${actions}</div>`
  }).join('')
  chatLog.scrollTop = chatLog.scrollHeight
}
function updateStreamText(idx) {
  const bubble = chatLog.querySelector(`[data-idx="${idx}"]`)
  const m = chatHistory[idx]
  if (!bubble || !m) { renderChat(); return }
  const textEl = bubble.querySelector('.chat-text')
  if (textEl) textEl.textContent = m.text
  else { renderChat(); return }
  chatLog.scrollTop = chatLog.scrollHeight
}
const TYPEWRITER_MS = 12
async function revealTypewriter(idx, fullText) {
  chatHistory[idx].streaming = true; chatHistory[idx].text = ''
  renderChat()
  for (const ch of Array.from(fullText)) {
    chatHistory[idx].text += ch
    updateStreamText(idx)
    await new Promise(r => setTimeout(r, TYPEWRITER_MS))
  }
}
function applyAssistantText(text, mode) {
  if (!text) return
  if (mode === 'replace') {
    editor.value = text
  } else if (mode === 'insert') {
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const before = editor.value.slice(0, start)
    const after = editor.value.slice(end)
    editor.value = before + text + after
    const pos = start + text.length
    editor.setSelectionRange(pos, pos)
  } else {
    const sep = editor.value.trim() ? '\n\n---\n' : ''
    editor.value += sep + text
  }
  updateCounts()
  updateVarBar(editor.value)
  if (editorMode === 'md' && mdView === 'preview') renderPreview()
  if (note) { note.content = editor.value; schedSave() }
  scheduleAutoTitle(400)
}
chatLog.addEventListener('click', e => {
  const zoomable = e.target.closest('[data-zoom-src]')
  if (zoomable) {
    e.preventDefault()
    openImageViewer(zoomable.dataset.zoomSrc || '', zoomable.dataset.zoomAlt || '')
    return
  }
  const btn = e.target.closest('[data-act]'); if (!btn) return
  const m = chatHistory[+btn.dataset.idx]
  if (!m || m.role !== 'assistant') return
  const act = btn.dataset.act
  if (act === 'copy') {
    try { navigator.clipboard.writeText(m.text) } catch { window.api.copyToClipboard(m.text) }
    toast('已复制')
    return
  }
  if (act === 'replace') {
    if (!window.confirm('将用助手内容替换当前文件全文，是否允许？')) return
  }
  applyAssistantText(m.text, act === 'replace' ? 'replace' : act === 'insert' ? 'insert' : 'append')
  toast(act === 'replace' ? '已替换全文' : act === 'insert' ? '已插入光标处' : '已追加到文末')
})
previewPane?.addEventListener('click', e => {
  const img = e.target.closest('img')
  if (!img) return
  openImageViewer(img.currentSrc || img.src || '', img.alt || '')
})
chatImageViewerClose?.addEventListener('click', closeImageViewer)
chatImageViewer?.addEventListener('click', e => {
  if (e.target === chatImageViewer) closeImageViewer()
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && chatImageViewer?.classList.contains('show')) closeImageViewer()
})
function setAiOpen(open) {
  if (pane.classList.contains('ws-shell')) {
    postToParent({ type: 'request-workspace-mode', mode: open ? 'agent' : 'edit' })
    return
  }
  pane.classList.toggle('ai-open', !!open)
  if (open) setTimeout(() => aiInput.focus(), 120)
}
aiClose.addEventListener('click', () => setAiOpen(false))
function setQuickMenuOpen(open) {
  const next = !!open
  aiQuickMenu?.classList.toggle('show', next)
  aiQuickMenu?.setAttribute('aria-hidden', String(!next))
  aiQuickBtn?.setAttribute('aria-expanded', String(next))
}
function hideAiMenus() { setQuickMenuOpen(false); aiMoreMenu?.classList.remove('show') }
let quickActive = 0
function quickItems() { return aiQuickMenu ? Array.from(aiQuickMenu.querySelectorAll('[data-p]')) : [] }
function renderQuickActive() {
  const items = quickItems(); if (!items.length) return
  if (quickActive < 0) quickActive = items.length - 1
  if (quickActive >= items.length) quickActive = 0
  items.forEach((item, idx) => item.classList.toggle('active', idx === quickActive))
}
function applyQuickPrompt(prompt) {
  const text = String(prompt || '').trim(); if (!text) return
  aiInput.value = text; aiInput.dispatchEvent(new Event('input')); aiInput.focus(); hideAiMenus()
}
async function runQuickShortcut(prompt) {
  if (aiSend?.disabled) { toast('当前助手正在生成，请稍候'); return }
  const text = String(prompt || '').trim(); if (!text) return
  hideAiMenus()
  await runAI({ promptText: text, displayPrompt: '快捷操作' })
}
function showQuickMenu() {
  if (!aiQuickMenu) return
  aiMoreMenu?.classList.remove('show'); setQuickMenuOpen(true)
  quickActive = 0; renderQuickActive(); aiInput.focus()
}
if (aiQuickBtn && aiQuickMenu) aiQuickBtn.addEventListener('click', e => { e.stopPropagation(); if (aiQuickMenu.classList.contains('show')) setQuickMenuOpen(false); else showQuickMenu() })
if (aiMoreBtn && aiMoreMenu) aiMoreBtn.addEventListener('click', e => { e.stopPropagation(); setQuickMenuOpen(false); aiMoreMenu.classList.toggle('show') })
if (aiQuickMenu) {
  aiQuickMenu.addEventListener('click', e => { const btn = e.target.closest('[data-p]'); if (btn) void runQuickShortcut(btn.dataset.p || '') })
  aiQuickMenu.addEventListener('mousemove', e => {
    const btn = e.target.closest('[data-p]'); if (!btn) return
    const idx = quickItems().indexOf(btn)
    if (idx < 0 || idx === quickActive) return
    quickActive = idx; renderQuickActive()
  })
}
if (aiComposer) aiComposer.addEventListener('keydown', e => { if (e.key === 'Escape' && (aiQuickMenu?.classList.contains('show') || aiMoreMenu?.classList.contains('show'))) { e.preventDefault(); hideAiMenus() } })
document.addEventListener('click', e => { if (!aiComposer?.contains(e.target)) hideAiMenus() })
function clearChat() {
  if (!chatHistory.length) { toast('对话已为空'); return }
  chatHistory = []; renderChat(); toast('已清空对话', 'success')
}
const aiClearChat = document.getElementById('aiClearChat')
if (aiClearChat) aiClearChat.addEventListener('click', e => { e.stopPropagation(); hideAiMenus(); clearChat() })
aiInput.addEventListener('input', () => { aiInput.style.height = 'auto'; aiInput.style.height = Math.min(aiInput.scrollHeight, 88) + 'px'; updateSlashMenu() })

const slashMenu = document.getElementById('slashMenu')
let skillCatalog = [], slashOpen = false, slashActive = 0, slashQuery = ''
async function ensureSkillCatalog() {
  if (!window.api.listSkills) return []
  try { const r = await window.api.listSkills(); skillCatalog = r.ok ? (r.skills || []) : [] } catch { skillCatalog = [] }
  return skillCatalog
}
function getSlashContext() {
  const val = aiInput.value, caret = aiInput.selectionStart ?? val.length
  const before = val.slice(0, caret)
  const m = before.match(/(^|\s)\/([a-zA-Z0-9\-]*)$/)
  if (!m) return null
  return { start: caret - m[2].length - 1, end: caret, query: m[2].toLowerCase() }
}
function hideSlashMenu() { slashOpen = false; slashMenu.classList.remove('show'); slashMenu.innerHTML = '' }
function filteredSkills() {
  const q = slashQuery
  return skillCatalog.filter(s => { const hay = `${s.slash} ${s.title} ${s.description || ''}`.toLowerCase(); return !q || hay.includes(q) }).slice(0, 8)
}
function renderSlashMenu() {
  const items = filteredSkills()
  if (!slashOpen) return
  if (!skillCatalog.length) { slashMenu.innerHTML = '<div class="slash-empty">暂无可用技能。可在设置 → 知识库管理概念后使用 / 引用。</div>'; slashMenu.classList.add('show'); return }
  if (!items.length) { slashMenu.innerHTML = `<div class="slash-empty">没有匹配「/${slashQuery}」的片段</div>`; slashMenu.classList.add('show'); return }
  if (slashActive >= items.length) slashActive = 0
  slashMenu.innerHTML = items.map((s, i) =>
    `<button type="button" class="slash-item${i === slashActive ? ' active' : ''}" data-idx="${i}" role="option">
      <span class="slash-cmd">/${s.slash}</span><span class="slash-title">${s.title || s.id}</span>
    </button>`).join('')
  slashMenu.classList.add('show')
  slashMenu.querySelectorAll('.slash-item').forEach(btn => btn.addEventListener('mousedown', e => { e.preventDefault(); pickSlashSkill(items[+btn.dataset.idx]) }))
}
async function updateSlashMenu() {
  const ctx = getSlashContext()
  if (!ctx) { hideSlashMenu(); return }
  slashQuery = ctx.query; slashOpen = true
  await ensureSkillCatalog(); renderSlashMenu()
}
function pickSlashSkill(skill) {
  if (!skill) return
  const ctx = getSlashContext(); if (!ctx) return
  const before = aiInput.value.slice(0, ctx.start), after = aiInput.value.slice(ctx.end)
  const insert = `/${skill.slash} `
  aiInput.value = before + insert + after
  const pos = (before + insert).length
  aiInput.setSelectionRange(pos, pos)
  hideSlashMenu(); aiInput.focus(); aiInput.dispatchEvent(new Event('input'))
}
async function runAI(options = {}) {
  const shortcutPrompt = String(options?.promptText || '').trim()
  const prompt = shortcutPrompt || aiInput.value.trim()
  if (!prompt || !note) return
  if (slashOpen) hideSlashMenu()
  if (!pane.classList.contains('ws-shell')) setAiOpen(true)
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  chatHistory.push({ role: 'user', text: shortcutPrompt ? String(options?.displayPrompt || '快捷操作') : prompt })
  chatHistory.push({ role: 'assistant', text: '', streaming: true, runId, activity: '正在准备上下文…', trace: [] })
  const assistantIdx = chatHistory.length - 1
  renderChat()
  aiSend.disabled = true; aiInput.value = ''; aiInput.style.height = 'auto'
  let gotStream = false
  let streamUpdateCount = 0
  const offEvent = window.api.onAiStreamEvent
    ? window.api.onAiStreamEvent(event => {
        if (!event || event.runId !== runId) return
        const message = chatHistory[assistantIdx]
        if (!message) return
        if (event.type === 'content') {
          gotStream = true
          streamUpdateCount++
          message.text = String(event.text || '')
          message.activity = '正在生成回答…'
          updateStreamText(assistantIdx)
          return
        }
        if (event.type === 'stage' || event.type === 'fallback') {
          message.activity = String(event.title || event.activity || '正在处理…')
          upsertAssistantTrace(message, {
            id: event.id || `stage_${event.stage || 'working'}`,
            kind: 'stage',
            title: event.title || event.activity || '执行步骤',
            status: event.status || 'pending',
            durationMs: event.durationMs,
          })
          renderChat()
          return
        }
        if (event.type === 'tool.started' || event.type === 'tool.completed' || event.type === 'tool.failed') {
          const pending = event.type === 'tool.started'
          const failed = event.type === 'tool.failed'
          message.activity = pending ? String(event.title || '正在调用工具…') : message.activity
          upsertAssistantTrace(message, {
            id: event.id || event.toolCallId,
            kind: 'tool',
            title: event.title || event.toolName || '工具调用',
            status: pending ? 'pending' : failed ? 'error' : 'done',
            durationMs: event.durationMs,
          })
          renderChat()
          return
        }
        if (event.type === 'done' || event.type === 'error') {
          message.activity = ''
          for (const item of message.trace || []) {
            if (item.status === 'pending') item.status = event.type === 'error' ? 'error' : 'done'
          }
          renderChat()
        }
      })
    : () => {}
  const offChunk = window.api.onAiStreamChunk(({ text }) => { gotStream = true; streamUpdateCount++; chatHistory[assistantIdx].text = text; updateStreamText(assistantIdx) })
  const priorHistory = chatHistory.slice(0, -2)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.text && !m.streaming)
    .map(m => ({ role: m.role, text: m.text }))
  const skillRefs = [...prompt.matchAll(/(^|\s)\/([a-z0-9][a-z0-9\-]{0,31})\b/gi)].map(m => m[2].toLowerCase())
  try {
    const result = await window.api.aiGenerate({
      prompt, context: editor.value.trim() || null, history: priorHistory,
      noteId: note.id, category: (note.category || inpCategory.value || '').trim(), skillRefs, runId,
    })
    offEvent()
    offChunk()
    if (result.error) { chatHistory.splice(assistantIdx, 1); chatHistory.push({ role: 'error', text: result.error }); renderChat(); return }
    const finalText = (result.text || '').trim()
    const streamedButSingleFlush = !!result.streamed && streamUpdateCount <= 1
    if ((!gotStream || streamedButSingleFlush) && finalText) await revealTypewriter(assistantIdx, finalText)
    else chatHistory[assistantIdx].text = finalText
    chatHistory[assistantIdx].streaming = false
    chatHistory[assistantIdx].activity = ''
    renderChat()
  } catch (err) {
    offEvent(); offChunk(); chatHistory.splice(assistantIdx, 1)
    chatHistory.push({ role: 'error', text: err.message || '生成失败' }); renderChat()
  } finally { offEvent(); aiSend.disabled = false }
}
aiSend.addEventListener('click', runAI)
aiInput.addEventListener('keydown', e => {
  if (aiQuickMenu?.classList.contains('show')) {
    const items = quickItems()
    if (e.key === 'ArrowDown') { e.preventDefault(); quickActive = (quickActive + 1) % Math.max(items.length, 1); renderQuickActive(); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); quickActive = (quickActive - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1); renderQuickActive(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const active = items[quickActive] || items[0]; if (active) void runQuickShortcut(active.dataset.p || ''); return }
    if (e.key === 'Escape') { e.preventDefault(); hideAiMenus(); return }
  }
  if (slashOpen) {
    const items = filteredSkills()
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { slashActive = (slashActive + 1) % items.length; renderSlashMenu() } return }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { slashActive = (slashActive - 1 + items.length) % items.length; renderSlashMenu() } return }
    if (e.key === 'Enter' && !e.shiftKey && items.length) { e.preventDefault(); pickSlashSkill(items[slashActive] || items[0]); return }
    if (e.key === 'Tab' && items.length) { e.preventDefault(); pickSlashSkill(items[slashActive] || items[0]); return }
    if (e.key === 'Escape') { e.preventDefault(); hideSlashMenu(); return }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAI() }
  if (e.key === 'Escape' && pane.classList.contains('ai-open')) setAiOpen(false)
})
aiInput.addEventListener('blur', () => setTimeout(hideSlashMenu, 120))
if (window.api.listSkills) ensureSkillCatalog()
document.addEventListener('keydown', async e => {
  if (e.defaultPrevented) return
  if (aiQuickMenu?.classList.contains('show')) {
    const items = quickItems()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      quickActive = (quickActive + 1) % Math.max(items.length, 1)
      renderQuickActive()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      quickActive = (quickActive - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)
      renderQuickActive()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const active = items[quickActive] || items[0]
      if (active) void runQuickShortcut(active.dataset.p || '')
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      hideAiMenus()
      return
    }
  }
  if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') {
    if (e.target === editor && isMdEditMode()) return
    if (pane.classList.contains('ws-shell')) return
    e.preventDefault()
    if (aiQuickMenu?.classList.contains('show')) {
      setQuickMenuOpen(false)
      return
    }
    setAiOpen(true)
    showQuickMenu()
    return
  }
})

// ── 加载指定 note ────────────────────────────────────────────────
function loadNote(n) {
  note = n
  if (!n) { pane.classList.add('no-note'); return }
  pane.classList.remove('no-note')
  editor.value = n.content || ''
  inpProj.value = n.title || ''
  inpCategory.value = n.project || n.category || ''
  inpOkfTags.value = (n.okfTags || []).join(', ')
  titleManual = n.projectManual ?? !!n.title?.trim()
  setVersion(n.version || '0.1')
  setFavorite(n.favorite || false)
  if (n.editorMode === 'preview') { editorMode = 'md'; mdView = 'preview' }
  else if (n.editorMode === 'edit') { editorMode = 'md'; mdView = 'edit' }
  else { editorMode = n.editorMode === 'md' ? 'md' : 'plain'; mdView = n.mdView === 'preview' ? 'preview' : 'edit' }
  applyEditorModeUI()
  updateCounts()
  saveTime.textContent = relTime(n.updatedAt || n.createdAt)
  updateVarBar(editor.value)
  const empty = !n.content?.trim(), noName = !n.title?.trim()
  if (n.content?.trim() && !n.title?.trim()) scheduleAutoTitle(600)
  if (empty && noName) setTimeout(() => inpProj.focus(), 80)
  else if (empty && parentWorkspaceMode !== 'agent') setTimeout(() => editor.focus(), 80)
  mountAllIcons()
  notifyMeta()
  applyParentWorkspaceMode()
}

async function openById(id) {
  if (!id) { loadNote(null); return }
  try {
    const n = await window.api.getNote(id)
    loadNote(n || null)
  } catch { loadNote(null) }
}

async function openFsFile(msg) {
  const sourceId = msg.sourceId
  const relPath = msg.path
  if (!sourceId || !relPath) { loadNote(null); return }
  try {
    const r = await window.api.sourcesReadFile({ sourceId, path: relPath })
    if (!r?.ok) {
      toast(r?.error || '读取失败', 'error')
      loadNote(null)
      return
    }
    const base = String(relPath).split('/').pop() || relPath
    loadNote({
      id: msg.id || `fs:${sourceId}:${relPath}`,
      content: r.content || '',
      title: base,
      project: '',
      category: '',
      version: 'file',
      favorite: false,
      okfTags: [],
      editorMode: 'md',
      mdView: 'edit',
      updatedAt: new Date().toISOString(),
      fsSourceId: sourceId,
      fsPath: relPath,
    })
  } catch (e) {
    toast(e.message || '读取失败', 'error')
    loadNote(null)
  }
}

// 父窗口通过 postMessage 指派要打开的 note
window.addEventListener('message', e => {
  const d = e.data || {}
  if (d.type === 'load-note') openById(d.id)
  if (d.type === 'load-fs-file') openFsFile(d)
  if (d.type === 'workspace-mode') {
    parentWorkspaceMode = d.mode === 'edit' ? 'edit' : 'agent'
    applyParentWorkspaceMode()
  }
  if (d.type === 'get-editor-context') {
    postToParent({
      type: 'editor-context',
      reqId: d.reqId,
      ok: !!note,
      noteId: note?.id,
      content: editor.value,
      category: (note?.category || note?.project || inpCategory.value || '').trim(),
    })
  }
  if (d.type === 'apply-content') {
    const mode = d.mode === 'replace' ? 'replace' : d.mode === 'insert' ? 'insert' : 'append'
    applyAssistantText(d.text, mode)
  }
})
setInterval(() => { if (note && footerM.className === 'footer-meta') saveTime.textContent = relTime(note.updatedAt || note.createdAt) }, 20000)

// 初始 id 可来自 hash
const initId = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
if (initId) openById(initId)
postToParent({ type: 'pane-ready' })
