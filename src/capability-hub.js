'use strict'

;(function initCapabilityHub() {
  const TAB_KIND = { experts: 'expert', skills: 'skill', connectors: 'connector' }
  const TAB_CATEGORIES = {
    experts: ['全部', '办公', '写作', '研发', '知识'],
    skills: ['全部', '写作', '飞书', '研发', '效率'],
    connectors: ['全部', '飞书', 'MCP', '知识库', '自定义'],
  }
  const TAB_ICONS = { expert: 'users', skill: 'optimize', connector: 'network' }
  const TAB_COPY = {
    experts: {
      title: '专家',
      catalog: '全部专家',
      unit: '位专家',
      description: '选择一个懂你工作方式的专业伙伴，组合技能与连接器完成任务。',
      featured: '从常用工作场景开始，找到适合你的长期工作伙伴。',
      empty: '还没有符合条件的专家。你可以调整筛选，或添加自己的专家。',
    },
    skills: {
      title: '技能',
      catalog: '全部技能',
      unit: '项技能',
      description: '把成熟的方法变成可复用能力，让每次协作都有稳定的质量。',
      featured: '把高频工作方法装进 KnowMe，需要时随时调用。',
      empty: '还没有符合条件的技能。你可以调整筛选，或导入一个 SKILL.md。',
    },
    connectors: {
      title: 'MCP 连接器',
      catalog: '全部连接器',
      unit: '个连接器',
      description: '安全连接工作中的服务与数据，让伙伴基于真实上下文行动。',
      featured: '连接你信任的服务，在明确授权范围内补齐工作上下文。',
      empty: '还没有符合条件的连接器。你可以调整筛选，或添加 MCP 配置。',
    },
  }

  const MOCK_CATALOG = [
    { id: 'office-partner', kind: 'expert', name: '办公搭档', description: '会议总结、日程优先级与文档协作的一站式专家 persona。', version: '1.0.0', source: 'curated', category: '办公', featured: true, tags: ['办公', '飞书'], status: 'available', enabled: false, dependencies: ['feishu-connector'] },
    { id: 'writing-coach', kind: 'expert', name: '写作教练', description: '结构化提纲、润色与多版本输出，适合邮件与汇报。', version: '1.0.0', source: 'curated', category: '写作', featured: true, tags: ['写作'], status: 'installed', enabled: true, dependencies: [] },
    { id: 'kb-steward', kind: 'expert', name: '知识管家', description: 'Wiki 整理、OKF 升格与健康检查引导。', version: '0.9.0', source: 'curated', category: '知识', featured: false, tags: ['知识库'], status: 'available', enabled: false, dependencies: [] },
    { id: 'meeting-summary', kind: 'skill', name: '会议总结', description: '从飞书妙记与日程拉取最近会议并输出结构化摘要。', version: '1.2.0', source: 'curated', category: '飞书', featured: true, tags: ['飞书', '会议'], status: 'installed', enabled: true, dependencies: ['feishu-connector'] },
    { id: 'doc-polish', kind: 'skill', name: '文档润色', description: '保持原意的前提下优化语气、结构与可读性。', version: '1.0.1', source: 'curated', category: '写作', featured: true, tags: ['写作'], status: 'available', enabled: false, dependencies: [] },
    { id: 'code-review-lite', kind: 'skill', name: '代码审查 Lite', description: '针对 diff 给出风险点、测试建议与最小修复方案。', version: '0.8.0', source: 'curated', category: '研发', featured: false, tags: ['研发'], status: 'available', enabled: false, dependencies: [] },
    { id: 'legacy-okf-slash', kind: 'skill', name: 'Legacy OKF Slash', description: '旧版知识库 slash 技能双轨映射，可一键迁移为标准 SKILL.md。', version: 'legacy', source: 'legacy-okf', category: '效率', featured: false, tags: ['迁移', 'OKF'], status: 'installed', enabled: true, legacy: true, dependencies: [] },
    { id: 'feishu-connector', kind: 'connector', name: '飞书连接器', description: '日程、文档、IM 与妙记的 JIT 授权读写能力。', version: '2.1.0', source: 'curated', category: '飞书', featured: true, tags: ['飞书'], status: 'installed', enabled: true, health: 'green', dependencies: [] },
    { id: 'mcp-generic', kind: 'connector', name: 'MCP 通用模板', description: 'stdio MCP 服务器配置模板，支持 allowlist 与多实例并行。', version: '1.0.0', source: 'curated', category: 'MCP', featured: true, tags: ['MCP'], status: 'available', enabled: false, health: 'unknown', dependencies: [] },
    { id: 'remote-rag', kind: 'connector', name: '远程知识库 RAG', description: '通过 MCP 检索企业知识库并注入 Agent 上下文。', version: '0.5.0', source: 'curated', category: '知识库', featured: false, tags: ['RAG'], status: 'available', enabled: false, health: 'unknown', dependencies: [] },
  ]

  const esc = (s) => (window.UIKit?.escapeHtml ? UIKit.escapeHtml(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
  const sourceLabel = (source) => ({
    curated: '精选',
    local: '本地',
    'local-repo': 'Cursor 仓库',
    zip: 'ZIP',
    https: '远程',
    custom: '自定义',
    'legacy-okf': '旧版 OKF',
  })[source] || source || '—'

  function getBridge() {
    const parentApi = (window.parent && window.parent !== window && window.parent.api) ? window.parent.api : null
    const api = window.api || parentApi
    const knowme = window.knowme || (window.parent && window.parent.knowme) || {}
    const cap = knowme.capability || api?.capability || null
    const expert = knowme.expert || api?.expert || null
    const skill = knowme.skill || api?.skill || null
    const connector = knowme.connector || api?.connector || null
    return { api, cap, expert, skill, connector }
  }

  function callBridge(method, ...args) {
    const { cap, expert, api } = getBridge()
    const fn = cap?.[method] || api?.[`capability${method.charAt(0).toUpperCase()}${method.slice(1)}`]
    if (typeof fn === 'function') return fn(...args)
    return null
  }

  const state = {
    tab: 'experts',
    query: '',
    category: '全部',
    installedOnly: false,
    items: [],
    selected: null,
    loadError: '',
    offline: false,
    addMode: 'local',
    repoPreview: null,
    loading: false,
  }

  const el = {
    app: document.getElementById('hubApp'),
    search: document.getElementById('hubSearch'),
    chips: document.getElementById('hubChips'),
    grid: document.getElementById('hubGrid'),
    pageTitle: document.getElementById('hubPageTitle'),
    pageDesc: document.getElementById('hubPageDesc'),
    totalCount: document.getElementById('hubTotalCount'),
    catalogTitle: document.getElementById('hubCatalogTitle'),
    resultCount: document.getElementById('hubResultCount'),
    featuredHint: document.getElementById('hubFeaturedHint'),
    featured: document.getElementById('hubFeatured'),
    featuredRow: document.getElementById('hubFeaturedRow'),
    installedOnly: document.getElementById('hubInstalledOnly'),
    drawer: document.getElementById('hubDrawer'),
    drawerBackdrop: document.getElementById('hubDrawerBackdrop'),
    drawerTitle: document.getElementById('hubDrawerTitle'),
    drawerBody: document.getElementById('hubDrawerBody'),
    addDialog: document.getElementById('hubAddDialog'),
    addConfirm: document.getElementById('hubAddConfirm'),
    repoPreview: document.getElementById('hubRepoPreview'),
    toast: document.getElementById('hubToast'),
  }

  function parseInitialTab() {
    try {
      const q = new URLSearchParams(window.location.search)
      const tab = String(q.get('tab') || '').trim()
      if (tab === 'experts' || tab === 'skills' || tab === 'connectors') return tab
    } catch { /* noop */ }
    return 'experts'
  }

  function notifyParentTab(tab) {
    try { window.parent.postMessage({ type: 'capability-hub-tab', tab }, '*') } catch { /* noop */ }
  }

  function closeHub() {
    try { window.parent.postMessage({ type: 'capability-hub-close' }, '*') } catch { /* noop */ }
  }

  function toast(msg, type = 'info') {
    if (!el.toast) return
    el.toast.textContent = msg
    el.toast.className = 'hub-toast show' + (type === 'error' ? ' error' : '')
    clearTimeout(toast._t)
    toast._t = setTimeout(() => { el.toast.className = 'hub-toast' }, 2400)
  }

  async function loadCatalog() {
    state.loading = true
    state.loadError = ''
    state.offline = false
    render()
    const kind = TAB_KIND[state.tab]
    const { cap, api } = getBridge()
    try {
      let rows = null
      if (cap && typeof cap.list === 'function') {
        rows = await cap.list({ kind })
      } else if (api && typeof api.capabilityList === 'function') {
        rows = await api.capabilityList({ kind })
      }
      if (rows && Array.isArray(rows.items || rows)) {
        state.items = (rows.items || rows).map(normalizeItem)
      } else {
        state.offline = !cap && !api?.capabilityList
        state.items = MOCK_CATALOG.filter(it => it.kind === kind).map(normalizeItem)
      }
    } catch (e) {
      state.loadError = e?.message || String(e)
      state.items = MOCK_CATALOG.filter(it => it.kind === TAB_KIND[state.tab]).map(normalizeItem)
    } finally {
      state.loading = false
      render()
    }
  }

  function normalizeItem(raw) {
    return {
      id: String(raw.id || ''),
      kind: String(raw.kind || 'skill'),
      name: String(raw.name || raw.title || raw.id || '未命名'),
      description: String(raw.description || raw.summary || ''),
      version: String(raw.version || '—'),
      source: String(raw.source || 'curated'),
      category: String(raw.category || '全部'),
      featured: !!raw.featured,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      status: String(raw.status || 'available'),
      enabled: raw.enabled !== false && (raw.status === 'installed' || raw.status === 'enabled'),
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : [],
      contentHash: raw.contentHash || '',
      installedAt: raw.installedAt || '',
      legacy: !!raw.legacy,
      health: raw.health || '',
      sourceAvailable: raw.sourceAvailable !== false,
      repositoryId: raw.repositoryId || '',
    }
  }

  function filteredItems() {
    const q = state.query.trim().toLowerCase()
    return state.items.filter(it => {
      if (state.installedOnly && !['installed', 'enabled', 'disabled'].includes(it.status)) return false
      if (state.category !== '全部' && it.category !== state.category) return false
      if (!q) return true
      const hay = [it.name, it.description, it.category, ...(it.tags || [])].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }

  function featuredItems() {
    return filteredItems().filter(it => it.featured).slice(0, 4)
  }

  function renderPageMeta() {
    const copy = TAB_COPY[state.tab] || TAB_COPY.experts
    const resultLength = filteredItems().length
    el.app.dataset.tab = state.tab
    if (el.pageTitle) el.pageTitle.textContent = copy.title
    if (el.pageDesc) el.pageDesc.textContent = copy.description
    if (el.catalogTitle) el.catalogTitle.textContent = state.query || state.installedOnly || state.category !== '全部' ? '筛选结果' : copy.catalog
    if (el.totalCount) el.totalCount.textContent = `${state.items.length} ${copy.unit}`
    if (el.resultCount) el.resultCount.textContent = `${resultLength} 个结果`
    if (el.featuredHint) el.featuredHint.textContent = copy.featured
    document.title = `KnowMe — ${copy.title}`
  }

  function renderChips() {
    const cats = TAB_CATEGORIES[state.tab] || ['全部']
    el.chips.innerHTML = cats.map(cat => {
      const active = cat === state.category ? ' active' : ''
      return `<button type="button" class="hub-chip${active}" data-cat="${esc(cat)}" aria-pressed="${active ? 'true' : 'false'}">${esc(cat)}</button>`
    }).join('')
  }

  function renderFeatured() {
    const items = featuredItems()
    if (!items.length || state.query || state.installedOnly) {
      el.featured.classList.remove('visible')
      el.featuredRow.innerHTML = ''
      return
    }
    el.featured.classList.add('visible')
    el.featuredRow.innerHTML = items.map((it, index) => `
      <article class="hub-featured-card" data-id="${esc(it.id)}" tabindex="0" style="--index:${index}">
        <div class="hub-featured-icon"><span class="ico" data-icon="${TAB_ICONS[it.kind] || 'optimize'}"></span></div>
        <strong>${esc(it.name)}</strong>
        <span>${esc(it.description)}</span>
        <div class="hub-featured-meta">${esc(it.category)} · v${esc(it.version)}</div>
        <div class="hub-featured-arrow" aria-hidden="true"><span class="ico" data-icon="chevronRight"></span></div>
      </article>`).join('')
    if (window.StickyIcons) StickyIcons.mount(el.featuredRow)
  }

  function statusBadge(it) {
    const parts = []
    if (it.legacy) parts.push('<span class="hub-badge legacy">Legacy</span>')
    if (['installed', 'enabled', 'disabled'].includes(it.status)) parts.push('<span class="hub-badge installed">已安装</span>')
    if (state.offline) parts.push('<span class="hub-badge offline">预览</span>')
    if (it.health === 'green') parts.push('<span class="hub-badge installed">健康</span>')
    if (!it.sourceAvailable) parts.push('<span class="hub-badge legacy">来源不可用</span>')
    return parts.join('') || '<span class="hub-badge">精选</span>'
  }

  function renderGrid() {
    const items = filteredItems()
    el.app.classList.toggle('hub-loading', state.loading)
    if (state.loading) {
      el.grid.innerHTML = Array.from({ length: 4 }, (_, index) =>
        `<div class="hub-skeleton" aria-hidden="true" style="--index:${index}"></div>`).join('')
      return
    }
    if (state.loadError && !items.length) {
      el.grid.innerHTML = `<div class="hub-state error"><div class="hub-state-icon"><span class="ico" data-icon="refresh"></span></div><strong>能力目录暂时不可用</strong><p>${esc(state.loadError)}</p><div class="hub-state-actions"><button type="button" class="hub-btn primary" data-retry>重新加载</button></div></div>`
      if (window.StickyIcons) StickyIcons.mount(el.grid)
      return
    }
    if (!items.length) {
      const copy = TAB_COPY[state.tab] || TAB_COPY.experts
      const filtered = state.query || state.installedOnly || state.category !== '全部'
      const offlineHint = state.offline ? '当前展示离线预览数据，连接服务后会自动同步真实目录。' : copy.empty
      el.grid.innerHTML = `<div class="hub-state${state.offline ? ' offline' : ''}"><div class="hub-state-icon"><span class="ico" data-icon="${filtered ? 'searchLine' : TAB_ICONS[TAB_KIND[state.tab]]}"></span></div><strong>${filtered ? '没有找到匹配能力' : `还没有${copy.title}`}</strong><p>${esc(offlineHint)}</p><div class="hub-state-actions">${filtered ? '<button type="button" class="hub-btn" data-clear-filters>清除筛选</button>' : ''}<button type="button" class="hub-btn primary" id="hubEmptyAdd">添加能力</button></div></div>`
      if (window.StickyIcons) StickyIcons.mount(el.grid)
      return
    }
    el.grid.innerHTML = items.map((it, index) => `
      <article class="hub-card" data-id="${esc(it.id)}" tabindex="0" style="--index:${index}">
        <div class="hub-card-head">
          <div class="hub-card-icon"><span class="ico" data-icon="${TAB_ICONS[it.kind] || 'optimize'}"></span></div>
          <div class="hub-card-meta">
            <div class="hub-card-title">${esc(it.name)}</div>
            <div class="hub-card-sub">${esc(it.category)} · ${esc(sourceLabel(it.source))}</div>
          </div>
        </div>
        <div class="hub-card-desc">${esc(it.description)}</div>
        <div class="hub-card-foot">
          <div class="hub-badges">${statusBadge(it)}</div>
          <span class="hub-card-version">v${esc(it.version)}</span>
        </div>
      </article>`).join('')
    if (window.StickyIcons) StickyIcons.mount(el.grid)
  }

  function renderTabs() {
    document.querySelectorAll('.hub-tab').forEach(btn => {
      const on = btn.dataset.tab === state.tab
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
  }

  function renderDrawer() {
    const it = state.selected
    if (!it) {
      el.drawer.classList.remove('open')
      el.drawerBackdrop.classList.remove('open')
      el.drawer.setAttribute('aria-hidden', 'true')
      el.drawerBackdrop.setAttribute('aria-hidden', 'true')
      return
    }
    el.drawer.classList.add('open')
    el.drawerBackdrop.classList.add('open')
    el.drawer.setAttribute('aria-hidden', 'false')
    el.drawerBackdrop.setAttribute('aria-hidden', 'false')
    el.drawerTitle.textContent = it.name
    const installed = ['installed', 'enabled', 'disabled'].includes(it.status)
    const deps = (it.dependencies || []).length
      ? `<ul>${it.dependencies.map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
      : '<p>无依赖</p>'
    const isLegacySkill = it.kind === 'skill' && (it.legacy || it.source === 'legacy-okf')
    el.drawerBody.innerHTML = `
      <div class="hub-drawer-hero">
        <div class="hub-card-icon"><span class="ico" data-icon="${TAB_ICONS[it.kind] || 'optimize'}"></span></div>
        <strong>${esc(it.category)} · ${esc(sourceLabel(it.source))}</strong>
        <p>${esc(it.description)}</p>
        <div class="hub-badges">${statusBadge(it)}</div>
      </div>
      <div class="hub-drawer-section"><h3>元信息</h3>
        <dl class="hub-kv">
          <dt>版本</dt><dd>v${esc(it.version)}</dd>
          <dt>来源</dt><dd>${esc(sourceLabel(it.source))}</dd>
          <dt>分类</dt><dd>${esc(it.category)}</dd>
          <dt>状态</dt><dd>${esc(it.status)}</dd>
          ${it.sourceAvailable ? '' : '<dt>仓库</dt><dd>来源路径不可用，请重新导入或卸载</dd>'}
          ${it.contentHash ? `<dt>Hash</dt><dd>${esc(it.contentHash.slice(0, 12))}…</dd>` : ''}
          ${it.installedAt ? `<dt>安装于</dt><dd>${esc(it.installedAt)}</dd>` : ''}
        </dl>
      </div>
      <div class="hub-drawer-section"><h3>依赖</h3>${deps}</div>
      ${it.kind === 'connector' && installed ? '<div class="hub-drawer-section" id="hubConnectorExtras"><p class="hub-muted">正在加载连接器状态…</p></div>' : ''}
      ${installed ? `<div class="hub-drawer-section"><div class="hub-toggle-row"><label for="hubEnableToggle">在新会话中使用</label><label class="hub-filter-toggle"><input type="checkbox" id="hubEnableToggle"${it.enabled ? ' checked' : ''}><span class="hub-toggle-track" aria-hidden="true"><span></span></span><span>${it.enabled ? '已启用' : '已停用'}</span></label></div></div>` : ''}
      <div class="hub-drawer-section hub-drawer-actions">
        ${installed
    ? `<button type="button" class="hub-btn" data-act="update">更新</button>
           <button type="button" class="hub-btn" data-act="uninstall">卸载</button>`
    : `<button type="button" class="hub-btn primary" data-act="install">安装</button>`}
        ${it.kind === 'expert' ? `<button type="button" class="hub-btn${installed ? ' primary' : ''}" data-act="tryChat">试聊专家</button>` : ''}
        ${isLegacySkill ? '<button type="button" class="hub-btn" data-act="migrateLegacy">迁移为标准技能</button>' : ''}
      </div>`
    if (window.StickyIcons) StickyIcons.mount(el.drawerBody)
    if (it.kind === 'connector' && installed) loadConnectorDrawerExtras(it)
  }

  async function loadConnectorDrawerExtras(it) {
    const host = document.getElementById('hubConnectorExtras')
    if (!host || state.selected?.id !== it.id) return
    const { connector, api } = getBridge()
    const healthFn = connector?.health || api?.connectorHealth
    const previewFn = connector?.toolsPreview || api?.connectorToolsPreview
    const saveFn = connector?.saveAllowlist || api?.connectorSaveAllowlist
    if (!healthFn && !previewFn) {
      host.innerHTML = '<p class="hub-muted">连接器预览（预览模式，待后端接入）</p>'
      return
    }
    try {
      const [health, preview] = await Promise.all([
        healthFn ? healthFn({ connectorId: it.id }) : Promise.resolve(null),
        previewFn ? previewFn({ connectorId: it.id }) : Promise.resolve(null),
      ])
      const healthState = health?.state || health?.status || (it.enabled ? 'enabled' : 'disabled')
      const tools = Array.isArray(preview?.tools) ? preview.tools : []
      const allowlist = Array.isArray(preview?.allowlist) ? preview.allowlist : (it.allowlist || [])
      const toolLines = tools.length
        ? `<ul class="hub-tool-list">${tools.slice(0, 12).map(t => `<li><code>${esc(t.projectedName || t.rawName || t.name || '')}</code></li>`).join('')}${tools.length > 12 ? `<li>…共 ${tools.length} 个工具</li>` : ''}</ul>`
        : '<p class="hub-muted">暂无工具预览（未连接或未配置 MCP）</p>'
      host.innerHTML = `
        <h3>连接器状态</h3>
        <p>健康：<strong>${esc(String(healthState))}</strong>${health?.toolsCount != null ? ` · 工具 ${esc(String(health.toolsCount))}` : ''}</p>
        <h3>工具预览</h3>${toolLines}
        <h3>Allowlist</h3>
        <textarea id="hubAllowlistInput" rows="3" placeholder="逗号分隔工具名">${esc(allowlist.join(', '))}</textarea>
        <div class="hub-drawer-actions"><button type="button" class="hub-btn" id="hubAllowlistSave">保存 Allowlist</button></div>`
      document.getElementById('hubAllowlistSave')?.addEventListener('click', async () => {
        if (!saveFn) { toast('保存 Allowlist（预览模式）'); return }
        const raw = document.getElementById('hubAllowlistInput')?.value || ''
        const next = raw.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        try {
          await saveFn({ connectorId: it.id, allowlist: next })
          toast('Allowlist 已保存')
        } catch (e) {
          toast(e?.message || '保存失败', 'error')
        }
      })
    } catch (e) {
      host.innerHTML = `<p class="hub-muted">连接器详情加载失败：${esc(e?.message || '未知错误')}</p>`
    }
  }

  function render() {
    renderTabs()
    renderPageMeta()
    renderChips()
    renderFeatured()
    renderGrid()
    renderDrawer()
  }

  function setTab(tab) {
    if (tab !== 'experts' && tab !== 'skills' && tab !== 'connectors') return
    state.tab = tab
    state.category = '全部'
    state.selected = null
    notifyParentTab(tab)
    loadCatalog()
  }

  function openDrawer(id) {
    state.selected = state.items.find(it => it.id === id) || null
    renderDrawer()
  }

  function closeDrawer() {
    state.selected = null
    renderDrawer()
  }

  async function runAction(act) {
    const it = state.selected
    if (!it) return
    const { cap, expert, api } = getBridge()
    try {
      if (act === 'install') {
        const fn = cap?.install || api?.capabilityInstall
        if (fn) await fn({ id: it.id, kind: it.kind })
        else { it.status = 'installed'; it.enabled = true }
        toast('已安装')
      } else if (act === 'uninstall') {
        const fn = cap?.uninstall || api?.capabilityUninstall
        if (fn) await fn({ id: it.id })
        else state.items = state.items.filter(x => x.id !== it.id)
        closeDrawer()
        toast('已卸载')
      } else if (act === 'update') {
        const fn = cap?.update || api?.capabilityUpdate
        if (fn) await fn({ id: it.id })
        toast('已更新')
      } else if (act === 'tryChat') {
        const fn = expert?.tryChat || api?.expertTryChat
        if (fn) await fn({ expertId: it.id })
        else toast('试聊会话已请求（待后端接入）')
      } else if (act === 'migrateLegacy') {
        const { skill } = getBridge()
        const targetId = window.prompt('新标准技能 ID（留空则自动生成）', `${it.id}-skill`) || ''
        const fn = skill?.migrateLegacy || api?.skillMigrateLegacy
        if (fn) {
          const r = await fn({ legacySkillId: it.id, targetId: targetId.trim() || undefined })
          toast(r?.path ? `已导出 SKILL.md：${r.path}` : '迁移完成')
        } else {
          toast('迁移向导（预览模式，待后端接入）')
        }
      }
      await loadCatalog()
      if (act !== 'uninstall') openDrawer(it.id)
    } catch (e) {
      toast(e?.message || '操作失败', 'error')
    }
  }

  async function toggleEnabled(enabled) {
    const it = state.selected
    if (!it) return
    const { cap, api } = getBridge()
    try {
      const fn = enabled ? (cap?.enable || api?.capabilityEnable) : (cap?.disable || api?.capabilityDisable)
      if (fn) await fn({ id: it.id })
      it.enabled = enabled
      toast(enabled ? '已启用' : '已禁用')
      renderDrawer()
    } catch (e) {
      toast(e?.message || '切换失败', 'error')
    }
  }

  function openAddDialog() {
    state.addMode = 'local'
    state.repoPreview = null
    renderRepoPreview()
    syncAddPanels()
    el.addDialog.hidden = false
  }

  function closeAddDialog() {
    el.addDialog.hidden = true
  }

  function syncAddPanels() {
    document.querySelectorAll('.hub-add-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.add === state.addMode)
    })
    document.querySelectorAll('.hub-add-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.addPanel === state.addMode)
    })
    if (el.addConfirm) {
      el.addConfirm.hidden = state.addMode === 'local' || state.addMode === 'zip'
      el.addConfirm.disabled = state.addMode === 'cursor-repo' && !state.repoPreview
      el.addConfirm.textContent = state.addMode === 'cursor-repo' ? '确认注册' : '导入'
    }
  }

  function renderRepoPreview() {
    if (!el.repoPreview) return
    const preview = state.repoPreview
    if (!preview) {
      el.repoPreview.hidden = true
      el.repoPreview.innerHTML = ''
      return
    }
    const counts = preview.counts || {}
    const warnings = Array.isArray(preview.warnings) ? preview.warnings : []
    el.repoPreview.hidden = false
    el.repoPreview.innerHTML = `
      <strong>${esc(preview.name || 'Cursor 仓库')}</strong>
      <div class="hub-repo-path">${esc(preview.root || '')}</div>
      <div class="hub-repo-counts">
        <span class="hub-repo-count">专家 ${esc(String(counts.experts || 0))}</span>
        <span class="hub-repo-count">技能 ${esc(String(counts.skills || 0))}</span>
        <span class="hub-repo-count">连接器 ${esc(String(counts.connectors || 0))}</span>
        ${counts.blocked ? `<span class="hub-repo-count">已阻止 ${esc(String(counts.blocked))}</span>` : ''}
      </div>
      ${warnings.length
    ? `<ul class="hub-repo-warnings">${warnings.slice(0, 8).map(item => `<li>${esc(item.message || item.code || '')}</li>`).join('')}</ul>`
    : '<div class="hub-hint">扫描完成。确认后注册能力；不会复制整个仓库。</div>'}`
    syncAddPanels()
  }

  function assertBridgeResult(result, fallback = '操作失败') {
    if (result && result.ok === false) {
      const error = new Error(result.error || result.message || fallback)
      error.result = result
      throw error
    }
    return result
  }

  async function importWithTrust(importFn, payload) {
    let result = await importFn(payload)
    if (result?.needsTrust || result?.code === 'trust_required') {
      const accepted = window.confirm(`${result.error || '未知来源需要确认信任。'}\n\n仅在确认来源可信时继续。`)
      if (!accepted) return { ok: false, canceled: true }
      result = await importFn({ ...payload, trustConfirmed: true })
    }
    return assertBridgeResult(result)
  }

  async function confirmImport() {
    const { cap, api } = getBridge()
    const importFn = cap?.import || api?.capabilityImport
    if (state.addMode === 'cursor-repo') {
      const repoImportFn = cap?.importCursorRepository || api?.capabilityImportCursorRepository
      if (!repoImportFn || !state.repoPreview?.previewToken) {
        toast('请先选择并扫描 Cursor 仓库', 'error')
        return
      }
      try {
        const result = await repoImportFn({
          previewToken: state.repoPreview.previewToken,
          trustConfirmed: true,
        })
        if (result?.code === 'preview_stale' && result.preview) {
          state.repoPreview = result.preview
          renderRepoPreview()
          toast(result.error || '仓库已变化，请重新确认', 'error')
          return
        }
        assertBridgeResult(result, 'Cursor 仓库注册失败')
        closeAddDialog()
        await loadCatalog()
        const counts = result?.counts || {}
        toast(`已注册 ${counts.installed || 0} 项${counts.skipped ? `，跳过 ${counts.skipped} 项` : ''}${counts.failed ? `，失败 ${counts.failed} 项` : ''}`)
      } catch (e) {
        toast(e?.message || 'Cursor 仓库注册失败', 'error')
      }
      return
    }
    const payload = { source: state.addMode }
    if (state.addMode === 'https') {
      payload.url = document.getElementById('hubHttpsUrl')?.value.trim() || ''
      if (!/^https:\/\//i.test(payload.url)) {
        toast('仅支持 HTTPS URL', 'error')
        return
      }
    }
    if (state.addMode === 'custom') {
      payload.kind = document.getElementById('hubCustomKind')?.value || 'skill'
      payload.id = document.getElementById('hubCustomId')?.value.trim() || ''
      payload.name = document.getElementById('hubCustomName')?.value.trim() || ''
      payload.description = document.getElementById('hubCustomDesc')?.value.trim() || ''
      if (!payload.id || !payload.name) {
        toast('请填写 ID 与名称', 'error')
        return
      }
    }
    try {
      if (importFn) {
        const result = await importWithTrust(importFn, payload)
        if (result?.canceled) return
      }
      else toast('导入已记录（预览模式，待后端接入）')
      closeAddDialog()
      await loadCatalog()
    } catch (e) {
      toast(e?.message || '导入失败', 'error')
    }
  }

  async function pickLocal() {
    const { cap, api } = getBridge()
    const fn = cap?.pickLocalFolder || api?.capabilityPickLocalFolder
    if (fn) {
      try {
        const r = assertBridgeResult(await fn())
        if (r?.path) {
          const importFn = cap?.import || api?.capabilityImport
          if (importFn) {
            const result = await importWithTrust(importFn, { source: 'local', path: r.path })
            if (result?.canceled) return
          }
          closeAddDialog()
          await loadCatalog()
          toast('本地能力已导入')
        }
      } catch (e) {
        toast(e?.message || '本地能力导入失败', 'error')
      }
      return
    }
    toast('选择文件夹（预览模式）')
  }

  async function pickZip() {
    const { cap, api } = getBridge()
    const fn = cap?.pickZipFile || api?.capabilityPickZipFile
    if (fn) {
      try {
        const r = assertBridgeResult(await fn())
        if (r?.path) {
          const importFn = cap?.import || api?.capabilityImport
          if (importFn) {
            const result = await importWithTrust(importFn, { source: 'zip', path: r.path })
            if (result?.canceled) return
          }
          closeAddDialog()
          await loadCatalog()
          toast('ZIP 能力包已导入')
        }
      } catch (e) {
        toast(e?.message || 'ZIP 能力包导入失败', 'error')
      }
      return
    }
    toast('选择 ZIP（预览模式）')
  }

  async function pickCursorRepository() {
    const { cap, api } = getBridge()
    const pickFn = cap?.pickCursorRepository || api?.capabilityPickCursorRepository
    const scanFn = cap?.scanCursorRepository || api?.capabilityScanCursorRepository
    if (!pickFn || !scanFn) {
      toast('Cursor 仓库导入暂不可用', 'error')
      return
    }
    try {
      const picked = assertBridgeResult(await pickFn())
      if (!picked?.path) return
      if (el.repoPreview) {
        el.repoPreview.hidden = false
        el.repoPreview.innerHTML = '<span class="hub-hint">正在扫描仓库能力…</span>'
      }
      state.repoPreview = assertBridgeResult(
        await scanFn({ path: picked.path }),
        'Cursor 仓库扫描失败',
      )
      renderRepoPreview()
    } catch (e) {
      state.repoPreview = null
      renderRepoPreview()
      toast(e?.message || 'Cursor 仓库扫描失败', 'error')
    }
  }

  function bindEvents() {
    document.querySelectorAll('.hub-tab').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab))
    })
    el.search?.addEventListener('input', () => {
      state.query = el.search.value || ''
      renderPageMeta()
      renderFeatured()
      renderGrid()
    })
    el.installedOnly?.addEventListener('change', () => {
      state.installedOnly = !!el.installedOnly.checked
      renderPageMeta()
      renderFeatured()
      renderGrid()
    })
    el.chips?.addEventListener('click', e => {
      const chip = e.target.closest('.hub-chip')
      if (!chip) return
      state.category = chip.dataset.cat || '全部'
      renderPageMeta()
      renderChips()
      renderFeatured()
      renderGrid()
    })
    el.grid?.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { loadCatalog(); return }
      if (e.target.closest('#hubEmptyAdd')) { openAddDialog(); return }
      if (e.target.closest('[data-clear-filters]')) {
        state.query = ''
        state.category = '全部'
        state.installedOnly = false
        if (el.search) el.search.value = ''
        if (el.installedOnly) el.installedOnly.checked = false
        render()
        return
      }
      const card = e.target.closest('.hub-card,[data-id]')
      const id = card?.dataset?.id
      if (id) openDrawer(id)
    })
    el.featuredRow?.addEventListener('click', e => {
      const card = e.target.closest('[data-id]')
      if (card?.dataset?.id) openDrawer(card.dataset.id)
    })
    el.drawerBackdrop?.addEventListener('click', closeDrawer)
    document.getElementById('hubDrawerClose')?.addEventListener('click', closeDrawer)
    el.drawerBody?.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]')
      if (btn) runAction(btn.dataset.act)
    })
    el.drawerBody?.addEventListener('change', e => {
      if (e.target.id === 'hubEnableToggle') toggleEnabled(!!e.target.checked)
    })
    document.getElementById('hubBtnAdd')?.addEventListener('click', openAddDialog)
    document.getElementById('hubBtnClose')?.addEventListener('click', closeHub)
    document.getElementById('hubAddCancel')?.addEventListener('click', closeAddDialog)
    document.querySelector('[data-dialog-close]')?.addEventListener('click', closeAddDialog)
    document.getElementById('hubAddConfirm')?.addEventListener('click', confirmImport)
    document.getElementById('hubPickLocal')?.addEventListener('click', pickLocal)
    document.getElementById('hubPickZip')?.addEventListener('click', pickZip)
    document.getElementById('hubPickCursorRepo')?.addEventListener('click', pickCursorRepository)
    document.querySelectorAll('.hub-add-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.addMode = btn.dataset.add || 'local'
        syncAddPanels()
      })
    })
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        el.search?.focus()
        el.search?.select()
        return
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.hub-card[data-id], .hub-featured-card[data-id]')) {
        e.preventDefault()
        openDrawer(e.target.dataset.id)
        return
      }
      if (e.key === 'Escape') {
        if (!el.addDialog.hidden) { closeAddDialog(); return }
        if (state.selected) { closeDrawer(); return }
        closeHub()
      }
    })
  }

  function boot() {
    document.body.classList.toggle('hub-embedded', new URLSearchParams(location.search).get('embedded') === '1')
    if (window.StickyIcons) StickyIcons.mount(document)
    state.tab = parseInitialTab()
    bindEvents()
    setTab(state.tab)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
