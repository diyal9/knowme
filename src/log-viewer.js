'use strict'

const kmApi = window.api || {}
const grouping = window.LogGrouping || {
  groupLogEntries: entries => (entries || []).map(entry => ({ type: 'entry', entry })),
  roundOf: () => null,
}
const GROUP_PREF_KEY = 'knowme.log-viewer.group-runs'

const CATEGORY_LABELS = {
  '': '全部',
  operation: '操作',
  llm: 'LLM',
  'system-prompt': '系统提示词',
  mcp: 'MCP',
  api: 'API',
  system: '软件运行',
}
const CATEGORY_ORDER = ['', 'operation', 'llm', 'system-prompt', 'mcp', 'api', 'system']
const LOAD_TIMEOUT_MS = 8000
const RENDER_BATCH_SIZE = 60
const LARGE_TEXT_LIMIT = 40000

const state = {
  category: '',
  date: '',
  level: '',
  search: '',
  counts: {},
  quickMode: 'all',
  lastLoadMs: 0,
  lastError: '',
  warnPlusCount: 0,
  groupRuns: true,
  groupCount: 0,
}

try {
  const saved = window.localStorage && window.localStorage.getItem(GROUP_PREF_KEY)
  if (saved != null) state.groupRuns = saved !== '0'
} catch {
  // localStorage 不可用时保持默认合并视图
}

const els = {
  tabs: document.getElementById('tabs'),
  list: document.getElementById('list'),
  date: document.getElementById('date'),
  level: document.getElementById('level'),
  search: document.getElementById('search'),
  refresh: document.getElementById('refresh'),
  opendir: document.getElementById('opendir'),
  clear: document.getElementById('clear'),
  stat: document.getElementById('stat'),
  statTotal: document.getElementById('stat-total'),
  statLlm: document.getElementById('stat-llm'),
  statSystem: document.getElementById('stat-system'),
  statErrors: document.getElementById('stat-errors'),
  statLatency: document.getElementById('stat-latency'),
  health: document.getElementById('health'),
  healthDot: document.getElementById('health-dot'),
  healthText: document.getElementById('health-text'),
  quickAll: document.getElementById('quick-all'),
  quickLlm: document.getElementById('quick-llm'),
  quickSystem: document.getElementById('quick-system'),
  groupToggle: document.getElementById('group-toggle'),
}

let loadSeq = 0
const uiLogDebounce = new Map()

function withTimeout(promise, ms, message) {
  let timer = null
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer) }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || '请求超时')), ms)
    }),
  ])
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtTime(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso || '')
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function stringifyWithLimit(value, limit = LARGE_TEXT_LIMIT) {
  try {
    const json = JSON.stringify(value, null, 2)
    if (json.length <= limit) return json
    return `${json.slice(0, limit)}\n...[truncated ${json.length - limit} chars]`
  } catch {
    return String(value)
  }
}

function updateQuickButtons() {
  const map = [
    [els.quickAll, 'all'],
    [els.quickLlm, 'llm'],
    [els.quickSystem, 'system'],
  ]
  for (const [el, mode] of map) {
    if (!el) continue
    el.classList.toggle('active', state.quickMode === mode)
  }
}

function updateOverview() {
  if (els.statTotal) els.statTotal.textContent = String(state.counts.total || 0)
  if (els.statLlm) els.statLlm.textContent = String((state.counts.llm || 0) + (state.counts['system-prompt'] || 0))
  if (els.statSystem) els.statSystem.textContent = String(state.counts.system || 0)
  if (els.statErrors) els.statErrors.textContent = String(state.warnPlusCount || 0)
  if (els.statLatency) els.statLatency.textContent = `${Math.max(0, Number(state.lastLoadMs) || 0)}ms`
}

function updateHealthBar() {
  if (!els.healthText || !els.healthDot) return
  const hasError = !!state.lastError
  const slow = state.lastLoadMs >= 1800
  const warn = !hasError && (slow || state.warnPlusCount > 0)
  els.healthDot.classList.remove('warn', 'error')
  if (hasError) {
    els.healthDot.classList.add('error')
    els.healthText.textContent = `监控状态：异常 · ${state.lastError}`
    return
  }
  if (warn) {
    els.healthDot.classList.add('warn')
    const parts = []
    if (slow) parts.push(`加载偏慢 ${state.lastLoadMs}ms`)
    if (state.warnPlusCount > 0) parts.push(`当前 WARN+ ${state.warnPlusCount}`)
    els.healthText.textContent = `监控状态：关注 · ${parts.join(' · ')}`
    return
  }
  els.healthText.textContent = `监控状态：正常 · 最近加载 ${state.lastLoadMs}ms`
}

function emitUiLog(payload, minIntervalMs = 1500) {
  if (!kmApi.log || !payload || !payload.event) return
  const dedupeKey = String(payload.dedupeKey || payload.event)
  const now = Date.now()
  const prev = uiLogDebounce.get(dedupeKey) || 0
  if (now - prev < minIntervalMs) return
  uiLogDebounce.set(dedupeKey, now)
  try {
    kmApi.log({
      category: payload.category || 'operation',
      level: payload.level || 'info',
      event: payload.event,
      message: payload.message || '',
      source: 'log-viewer',
      meta: payload.meta || {},
    })
  } catch {
    // 日志上报失败不影响主流程
  }
}

function renderTabs() {
  if (!els.tabs) return
  els.tabs.innerHTML = ''
  for (const cat of CATEGORY_ORDER) {
    const tab = document.createElement('button')
    tab.className = 'tab' + (state.category === cat ? ' active' : '')
    const label = CATEGORY_LABELS[cat]
    const count = cat === '' ? (state.counts.total || 0) : (state.counts[cat] || 0)
    tab.innerHTML = `<span>${esc(label)}</span><span class="count">${count}</span>`
    tab.addEventListener('click', () => {
      state.category = cat
      state.quickMode = cat === 'llm' ? 'llm' : cat === 'system' ? 'system' : 'all'
      renderTabs()
      updateQuickButtons()
      load()
    })
    els.tabs.appendChild(tab)
  }
}

async function refreshCounts(date, seq) {
  if (!kmApi.logsCounts) return
  try {
    const cnt = await withTimeout(kmApi.logsCounts(date), LOAD_TIMEOUT_MS, '分类统计超时')
    // 丢弃过期请求结果，避免旧请求覆盖新筛选状态
    if (seq !== loadSeq) return
    if (cnt && cnt.ok) {
      state.counts = cnt.counts || {}
      renderTabs()
      updateOverview()
    }
  } catch {
    // 统计失败不影响主列表展示
  }
}

function renderPromptBody(e) {
  const meta = e.meta || {}
  let html = ''
  if (meta.model) html += `<div class="prompt-label">模型</div><div class="prompt-block">${esc(meta.model)}</div>`
  if (meta.systemContent) html += `<div class="prompt-label">System Prompt</div><div class="prompt-block">${esc(meta.systemContent)}</div>`
  if (meta.dynamicContext) html += `<div class="prompt-label">动态上下文</div><div class="prompt-block">${esc(meta.dynamicContext)}</div>`
  if (Array.isArray(meta.skillRefs) && meta.skillRefs.length) {
    html += `<div class="prompt-label">技能引用</div><div class="prompt-block">${esc(meta.skillRefs.join(', '))}</div>`
  }
  if (!html) html = `<pre>${esc(JSON.stringify(meta, null, 2))}</pre>`
  return html
}

function renderGeneralBody(e) {
  const detail = { ...e }
  delete detail.meta
  let html = ''
  if (e.runId || e.scope) {
    html += `<pre><span class="kv">runId</span>: ${esc(e.runId || '-')}   <span class="kv">scope</span>: ${esc(e.scope || '-')}</pre>`
  }
  if (e.meta !== undefined) {
    html += `<pre>${esc(stringifyWithLimit(e.meta))}</pre>`
  } else {
    html += `<pre>${esc(stringifyWithLimit(detail))}</pre>`
  }
  return html
}

function renderBodyLazy(body, entry) {
  if (!body || body.dataset.loaded === '1') return
  body.innerHTML = '<div class="body-loading">正在加载详情...</div>'
  setTimeout(() => {
    body.innerHTML = entry.category === 'system-prompt'
      ? renderPromptBody(entry)
      : renderGeneralBody(entry)
    body.dataset.loaded = '1'
  }, 0)
}

/** 让折叠标题行可点击也可键盘操作（Enter / Space），并同步 aria-expanded。 */
function bindDisclosure(head, wrap, onOpen) {
  head.setAttribute('role', 'button')
  head.setAttribute('tabindex', '0')
  head.setAttribute('aria-expanded', 'false')
  const toggle = () => {
    const open = wrap.classList.toggle('open')
    head.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) onOpen()
  }
  head.addEventListener('click', toggle)
  head.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return
    ev.preventDefault()
    toggle()
  })
}

function renderEntry(e) {
  const wrap = document.createElement('div')
  wrap.className = 'entry'
  const head = document.createElement('div')
  head.className = 'entry-head'
  const dur = e.durationMs != null ? `<span class="dur">${e.durationMs}ms</span>` : ''
  head.innerHTML =
    `<span class="lvl ${esc(e.level)}">${esc(e.level)}</span>` +
    `<span class="cat">${esc(CATEGORY_LABELS[e.category] || e.category)}</span>` +
    `<span class="ev">${esc(e.event)}</span>` +
    `<span class="msg">${esc(e.msg)}</span>` +
    dur +
    `<span class="ts">${esc(fmtTime(e.ts))}</span>`
  const body = document.createElement('div')
  body.className = 'entry-body'
  bindDisclosure(head, wrap, () => renderBodyLazy(body, e))
  wrap.appendChild(head)
  wrap.appendChild(body)
  return wrap
}

function fmtSpan(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`
}

function renderGroupChildren(body, item) {
  if (!body || body.dataset.loaded === '1') return
  body.dataset.loaded = '1'
  const frag = document.createDocumentFragment()
  let lastRound
  for (const entry of item.entries) {
    const round = grouping.roundOf(entry)
    if (round !== lastRound) {
      lastRound = round
      const sep = document.createElement('div')
      sep.className = 'round-sep'
      sep.innerHTML = `<span class="round-tag">${round ? `第 ${round} 轮` : '运行上下文'}</span>`
      frag.appendChild(sep)
    }
    frag.appendChild(renderEntry(entry))
  }
  const note = document.createElement('div')
  note.className = 'run-footnote'
  note.textContent = `runId ${item.summary.runId}`
  frag.appendChild(note)
  body.appendChild(frag)
}

function renderRunGroup(item) {
  const s = item.summary
  const wrap = document.createElement('div')
  wrap.className = 'run-group' + (s.errorCount ? ' has-error' : '')
  const head = document.createElement('div')
  head.className = 'run-head'
  const chips = []
  if (s.rounds > 0) chips.push({ text: `${s.rounds} 轮`, alert: false })
  chips.push({ text: `${s.count} 条`, alert: false })
  if (s.errorCount) chips.push({ text: `${s.errorCount} 错误`, alert: true })
  else if (s.warnCount) chips.push({ text: `${s.warnCount} 警告`, alert: true })
  const sideInfo = s.model || s.categories.map(c => CATEGORY_LABELS[c] || c).join(' · ')
  head.innerHTML =
    '<span class="run-caret">▶</span>' +
    `<span class="lvl ${esc(s.level)}">${esc(s.level)}</span>` +
    `<span class="run-title">${esc(s.title)}</span>` +
    chips.map(c => `<span class="run-chip${c.alert ? ' alert' : ''}">${esc(c.text)}</span>`).join('') +
    `<span class="run-meta">${esc(sideInfo)}</span>` +
    `<span class="dur">${esc(fmtSpan(s.spanMs))}</span>` +
    `<span class="ts">${esc(fmtTime(s.startTs))} → ${esc(fmtTime(s.endTs))}</span>`
  const body = document.createElement('div')
  body.className = 'run-body'
  bindDisclosure(head, wrap, () => renderGroupChildren(body, item))
  head.setAttribute('aria-label', `${s.title}，${s.rounds} 轮，${s.count} 条日志`)
  wrap.appendChild(head)
  wrap.appendChild(body)
  return wrap
}

async function renderItemsChunked(items, seq) {
  if (!els.list) return
  const frag = document.createDocumentFragment()
  for (let i = 0; i < items.length; i++) {
    if (seq !== loadSeq) return
    const item = items[i]
    frag.appendChild(item.type === 'group' ? renderRunGroup(item) : renderEntry(item.entry))
    if ((i + 1) % RENDER_BATCH_SIZE === 0) {
      els.list.appendChild(frag)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  }
  els.list.appendChild(frag)
}

function applyQuickMode(mode) {
  state.quickMode = mode
  if (mode === 'llm') state.category = 'llm'
  else if (mode === 'system') state.category = 'system'
  else state.category = ''
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-quick-mode',
    message: `切换快捷筛选：${mode}`,
    meta: { mode },
    dedupeKey: `quick-${mode}`,
  })
  renderTabs()
  updateQuickButtons()
  load()
}

async function load() {
  const seq = ++loadSeq
  const startedAt = Date.now()
  try {
    if (!els.list || !els.stat) return
    if (!kmApi.logsQuery) {
      els.list.innerHTML = '<div class="empty">日志接口不可用</div>'
      els.stat.textContent = '日志接口不可用'
      state.lastError = '日志接口不可用'
      updateHealthBar()
      return
    }

    els.list.innerHTML = '<div class="skeleton" aria-hidden="true"><div class="line lg"></div><div class="line"></div><div class="line sm"></div></div>'
    els.stat.textContent = '加载中...'
    const res = await withTimeout(
      kmApi.logsQuery({
        category: state.category,
        date: state.date,
        level: state.level,
        search: state.search,
        limit: 1000,
      }),
      LOAD_TIMEOUT_MS,
      '日志查询超时，请点击刷新重试',
    )
    if (seq !== loadSeq) return
    if (!res || !res.ok) {
      els.list.innerHTML = `<div class="empty">加载失败：${esc(res && res.error)}</div>`
      els.stat.textContent = '加载失败'
      return
    }

    state.date = res.date || state.date
    if (els.date && Array.isArray(res.dates)) {
      const cur = els.date.value
      els.date.innerHTML = res.dates.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('') || `<option value="${esc(res.date)}">${esc(res.date)}</option>`
      els.date.value = state.date
      if (cur && res.dates.includes(cur)) els.date.value = cur
    }

    els.list.innerHTML = ''
    const entries = res.entries || []
    state.warnPlusCount = entries.reduce((acc, e) => {
      const rank = e && (e.level === 'error' || e.level === 'warn')
      return rank ? acc + 1 : acc
    }, 0)
    if (!entries.length) {
      const hasFilter = !!(state.category || state.level || state.search)
      els.list.innerHTML =
        '<div class="empty">' +
        `<div class="empty-title">${hasFilter ? '没有匹配的日志' : '暂无日志记录'}</div>` +
        `<div class="empty-desc">${hasFilter ? '可尝试清空筛选条件或缩短关键词。' : '触发一次 AI 对话、操作或系统行为后会显示在这里。'}</div>` +
        '</div>'
      state.groupCount = 0
    } else {
      const items = grouping.groupLogEntries(entries, { enabled: state.groupRuns })
      state.groupCount = items.filter(it => it.type === 'group').length
      await renderItemsChunked(items, seq)
    }
    state.lastLoadMs = Date.now() - startedAt
    state.lastError = ''
    updateOverview()
    updateHealthBar()
    const groupHint = state.groupRuns && state.groupCount ? ` · ${state.groupCount} 组对话` : ''
    els.stat.textContent = `${entries.length} / ${res.total} 条${groupHint} · ${state.date}`
    emitUiLog({
      category: 'system',
      level: state.lastLoadMs >= 1800 ? 'warn' : 'info',
      event: 'log-viewer-load-ok',
      message: `日志加载完成（${entries.length}/${res.total}）`,
      meta: {
        durationMs: state.lastLoadMs,
        date: state.date,
        category: state.category || 'all',
        level: state.level || 'all',
        search: state.search || '',
        warnPlusCount: state.warnPlusCount,
      },
      dedupeKey: `load-ok-${state.date}-${state.category || 'all'}-${state.level || 'all'}-${state.search || ''}`,
    }, 500)

    // 计数异步刷新，避免大日志量时阻塞主内容显示
    refreshCounts(state.date, seq)
  } catch (err) {
    if (seq !== loadSeq) return
    state.lastLoadMs = Date.now() - startedAt
    state.lastError = String(err && err.message ? err.message : err)
    updateOverview()
    updateHealthBar()
    if (els.list) {
      els.list.innerHTML =
        '<div class="empty">' +
        '<div class="empty-title">日志加载失败</div>' +
        `<div class="empty-desc">${esc(err && err.message ? err.message : err)}</div>` +
        '</div>'
    }
    if (els.stat) els.stat.textContent = '加载异常'
    emitUiLog({
      category: 'system',
      level: 'error',
      event: 'log-viewer-load-failed',
      message: '日志加载失败',
      meta: {
        durationMs: state.lastLoadMs,
        error: state.lastError,
        date: state.date,
        category: state.category || 'all',
        level: state.level || 'all',
        search: state.search || '',
      },
      dedupeKey: `load-failed-${state.date}-${state.category || 'all'}-${state.level || 'all'}-${state.search || ''}`,
    }, 500)
  }
}

function debounce(fn, ms) {
  let t = 0
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

if (els.date) els.date.addEventListener('change', () => {
  state.date = els.date.value
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-filter-date',
    message: `切换日期：${state.date}`,
    meta: { date: state.date },
    dedupeKey: `date-${state.date}`,
  })
  load()
})
if (els.level) els.level.addEventListener('change', () => {
  state.level = els.level.value
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-filter-level',
    message: `切换级别：${state.level || 'all'}`,
    meta: { level: state.level || 'all' },
    dedupeKey: `level-${state.level || 'all'}`,
  })
  load()
})
if (els.search) els.search.addEventListener('input', debounce(() => {
  state.search = els.search.value.trim()
  emitUiLog({
    category: 'operation',
    level: 'debug',
    event: 'log-viewer-filter-search',
    message: `搜索关键词：${state.search || '(empty)'}`,
    meta: { search: state.search || '' },
    dedupeKey: `search-${state.search || '(empty)'}`,
  }, 400)
  load()
}, 250))
if (els.refresh) els.refresh.addEventListener('click', () => {
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-refresh',
    message: '手动刷新日志列表',
  })
  load()
})
if (els.opendir) els.opendir.addEventListener('click', () => {
  try { kmApi.openLogsDir && kmApi.openLogsDir() } catch {}
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-open-dir',
    message: '打开日志目录',
  })
})
if (els.clear) els.clear.addEventListener('click', async () => {
  if (!kmApi.logsClear) return
  if (!confirm(`确定清空 ${state.date} 的全部日志？`)) return
  const res = await kmApi.logsClear(state.date)
  emitUiLog({
    category: 'operation',
    level: res && res.ok ? 'warn' : 'error',
    event: 'log-viewer-clear',
    message: res && res.ok ? '清空日志成功' : '清空日志失败',
    meta: { date: state.date, removed: res && res.removed, error: res && res.error },
  })
  load()
})
function updateGroupToggle() {
  if (!els.groupToggle) return
  els.groupToggle.classList.toggle('active', state.groupRuns)
  els.groupToggle.setAttribute('aria-pressed', state.groupRuns ? 'true' : 'false')
  els.groupToggle.title = state.groupRuns ? '已按对话合并，点击改为逐条平铺' : '当前逐条平铺，点击按对话合并'
}
if (els.groupToggle) els.groupToggle.addEventListener('click', () => {
  state.groupRuns = !state.groupRuns
  try {
    if (window.localStorage) window.localStorage.setItem(GROUP_PREF_KEY, state.groupRuns ? '1' : '0')
  } catch {
    // 存储失败仅影响下次打开时的默认值
  }
  updateGroupToggle()
  emitUiLog({
    category: 'operation',
    level: 'info',
    event: 'log-viewer-group-toggle',
    message: `切换合并视图：${state.groupRuns ? 'on' : 'off'}`,
    meta: { enabled: state.groupRuns },
    dedupeKey: `group-${state.groupRuns ? 'on' : 'off'}`,
  })
  load()
})
if (els.quickAll) els.quickAll.addEventListener('click', () => applyQuickMode('all'))
if (els.quickLlm) els.quickLlm.addEventListener('click', () => applyQuickMode('llm'))
if (els.quickSystem) els.quickSystem.addEventListener('click', () => applyQuickMode('system'))

renderTabs()
updateQuickButtons()
updateGroupToggle()
updateOverview()
updateHealthBar()
load()
