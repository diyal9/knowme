'use strict'

;(function initCapabilityHub() {
  const TAB_KIND = { experts: 'expert', skills: 'skill', connectors: 'connector' }
  const SEARCH_DEBOUNCE_MS = 120
  const FAVORITE_CATEGORY = '收藏'
  const TAB_CATEGORIES = {
    experts: ['全部', '收藏', '办公', '写作', '研发', '知识', '我的'],
    skills: ['全部', '收藏', '写作', '游戏', '研发', '办公'],
    connectors: ['全部', '收藏', '飞书', 'MCP', '知识库', '自定义'],
  }
  const MINE_EXPERT_CATEGORY = '我的'
  const TAB_ICONS = { expert: 'users', skill: 'optimize', connector: 'network' }
  const AGENTIC_TYPE_OPTIONS = [
    { id: 'react', label: 'ReAct（推理+行动）', hint: '思考 → 行动 → 观察循环，默认推荐。' },
    { id: 'reflection', label: '反射（Reflection）', hint: '产出后自检修订，适合质量要求高的交付。' },
    { id: 'tool_use', label: '工具使用（Tool use）', hint: '优先调用工具与连接器获取事实。' },
    { id: 'planning', label: '规划（Planning）', hint: '复杂目标先路线图再执行。' },
    { id: 'multi_agent', label: '多智能体（Multi-agent）', hint: '定义委派边界；完整团队请用工作流。' },
  ]
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

  const EXPERT_CARD_ENTER_MS = 400
  let expertCardEnterPlayed = false
  let expertCardEnterTimer = null

  function prefersReducedMotion() {
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
    } catch {
      return false
    }
  }

  /** 会话内首次真实出卡时减弱入场；后续重绘不再播放 */
  function maybeArmExpertCardEnter() {
    if (expertCardEnterPlayed || state.loading || prefersReducedMotion()) return
    const targets = []
    if (el.featuredRow?.querySelector('.hub-featured-card')) targets.push(el.featuredRow)
    if (el.grid?.querySelector('.hub-card')) targets.push(el.grid)
    if (!targets.length) return
    expertCardEnterPlayed = true
    targets.forEach((node) => node.classList.add('is-entering'))
    clearTimeout(expertCardEnterTimer)
    expertCardEnterTimer = setTimeout(() => {
      targets.forEach((node) => node.classList.remove('is-entering'))
      expertCardEnterTimer = null
    }, EXPERT_CARD_ENTER_MS)
  }

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

  function identityApi() {
    return window.AgentIdentity || (window.parent && window.parent !== window ? window.parent.AgentIdentity : null) || null
  }

  /** 专家卡片/抽屉头像：有预设图则出图，否则按工作域代表图标 */
  function expertAvatarMark(item, className = 'hub-card-icon', size = 36) {
    const identity = identityApi()
    const resolved = (window.CapabilityHubIcons && typeof window.CapabilityHubIcons.resolveCapabilityIcon === 'function')
      ? window.CapabilityHubIcons.resolveCapabilityIcon(item)
      : { icon: TAB_ICONS[item?.kind] || 'optimize', avatarPreferred: item?.kind === 'expert' && !!item?.avatar }
    const icon = resolved.icon || TAB_ICONS[item?.kind] || 'optimize'
    const px = Math.max(24, Number(size) || 36)
    if (item?.kind === 'expert') {
      const src = identity && typeof identity.identityAvatarSrc === 'function'
        ? identity.identityAvatarSrc(item)
        : ''
      if (src) {
        return `<div class="${className} has-photo"><img class="hub-avatar-photo" src="${esc(src)}" alt="" width="${px}" height="${px}" decoding="async"></div>`
      }
      const fallbackIcon = identity && typeof identity.identityIcon === 'function'
        ? identity.identityIcon(item)
        : icon
      return `<div class="${className}"><span class="ico" data-icon="${esc(fallbackIcon)}"></span></div>`
    }
    return `<div class="${className}"><span class="ico" data-icon="${esc(icon)}"></span></div>`
  }

  function favoriteButtonHtml(item) {
    const on = !!item.favorite
    return `<button type="button" class="hub-card-fav${on ? ' is-fav' : ''}" data-fav-id="${esc(item.id)}" data-fav-kind="${esc(item.kind)}" title="${on ? '取消收藏' : '收藏'}" aria-label="${on ? '取消收藏' : '收藏'}" aria-pressed="${on ? 'true' : 'false'}"><span class="ico ico-star" data-icon="star"></span></button>`
  }

  function suggestExpertAvatarKey(fields = {}) {
    const identity = identityApi()
    if (!identity || typeof identity.identityAvatarKey !== 'function') return 'other/partner'
    return identity.identityAvatarKey({
      id: fields.id,
      name: fields.name,
      description: fields.description,
      skills: fields.skills,
      avatar: '',
    })
  }

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
    importPrecheck: null,
    pendingImportPayload: null,
    loading: false,
    startingExpertId: '',
    addingExpertId: '',
    workbenchExpertIds: new Set(),
    expertEditor: null,
    catalogSkills: [],
    catalogConnectors: [],
    knowledgeProviders: [],
    skillTasks: [],
    localExperts: [],
    compositionLoaded: false,
    tryingSkillId: '',
    surface: 'capability',
    presentation: 'hub',
    pendingExpertId: '',
  }

  const PARENT_RESULT_ERRORS = {
    'capability-hub-start-expert-result': '无法打开专家对话',
    'capability-hub-add-expert-to-workbench-result': '无法添加到工作台',
    'capability-hub-remove-expert-from-workbench-result': '无法从工作台撤回',
    'capability-hub-start-skill-result': '无法开始技能试用',
  }
  const pendingParentRequests = new Map()
  let searchRenderTimer = null
  let drawerReturnFocus = null

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
    drawerActions: document.getElementById('hubDrawerActions'),
    drawerClose: document.getElementById('hubDrawerClose'),
    addDialog: document.getElementById('hubAddDialog'),
    addConfirm: document.getElementById('hubAddConfirm'),
    repoPreview: document.getElementById('hubRepoPreview'),
    importPrecheck: document.getElementById('hubImportPrecheck'),
    toast: document.getElementById('hubToast'),
    expertDialog: document.getElementById('hubExpertDialog'),
    expertDialogTitle: document.getElementById('hubExpertDialogTitle'),
    expertDialogDesc: document.getElementById('hubExpertDialogDesc'),
    expertDialogBody: document.getElementById('hubExpertDialogBody'),
    expertCancel: document.getElementById('hubExpertCancel'),
    expertSave: document.getElementById('hubExpertSave'),
    expertDelete: document.getElementById('hubExpertDelete'),
    expertSummary: document.getElementById('hubExpertSummary'),
    pickerDialog: document.getElementById('hubPickerDialog'),
    pickerTitle: document.getElementById('hubPickerTitle'),
    pickerDesc: document.getElementById('hubPickerDesc'),
    pickerBody: document.getElementById('hubPickerBody'),
    pickerSummary: document.getElementById('hubPickerSummary'),
    pickerCancel: document.getElementById('hubPickerCancel'),
    pickerApply: document.getElementById('hubPickerApply'),
    confirmDialog: document.getElementById('hubConfirmDialog'),
    confirmKicker: document.getElementById('hubConfirmKicker'),
    confirmTitle: document.getElementById('hubConfirmTitle'),
    confirmDesc: document.getElementById('hubConfirmDesc'),
    confirmBody: document.getElementById('hubConfirmBody'),
    confirmCancel: document.getElementById('hubConfirmCancel'),
    confirmOk: document.getElementById('hubConfirmOk'),
  }

  let confirmSession = null

  // 原生 confirm/prompt 会丢掉预检已经算出来的风险依据与依赖明细，也无法把焦点交还
  // 给触发它的按钮；这里用同一套 hub 弹窗承载，返回值 null 表示用户取消。
  function askConfirm({
    kicker = 'Confirm',
    title = '请确认',
    description = '',
    facts = [],
    notes = [],
    tone = '',
    input = null,
    confirmLabel = '确认',
    cancelLabel = '取消',
  } = {}) {
    if (!el.confirmDialog) return Promise.resolve(null)
    closeConfirm(null)
    const dialog = el.confirmDialog.querySelector('.hub-confirm-dialog')
    if (dialog) dialog.dataset.tone = tone || ''
    if (el.confirmKicker) el.confirmKicker.textContent = kicker
    if (el.confirmTitle) el.confirmTitle.textContent = title
    if (el.confirmDesc) {
      el.confirmDesc.textContent = description
      el.confirmDesc.hidden = !description
    }
    const factRows = facts.filter(Boolean).map(fact =>
      `<dt>${esc(fact.label)}</dt><dd${fact.tone ? ` class="hub-confirm-fact-${esc(fact.tone)}"` : ''}>${esc(fact.value)}</dd>`).join('')
    const noteRows = notes.filter(Boolean).map(note => `<li>${esc(note)}</li>`).join('')
    const inputBlock = input
      ? `<div class="hub-field">
          <label for="hubConfirmInput">${esc(input.label || '输入')}</label>
          <input id="hubConfirmInput" type="text" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" spellcheck="false">
          ${input.hint ? `<small>${esc(input.hint)}</small>` : ''}
        </div>`
      : ''
    if (el.confirmBody) {
      el.confirmBody.innerHTML = `
        ${factRows ? `<dl class="hub-confirm-facts">${factRows}</dl>` : ''}
        ${noteRows ? `<ul class="hub-confirm-notes">${noteRows}</ul>` : ''}
        ${inputBlock}`
    }
    if (el.confirmOk) el.confirmOk.textContent = confirmLabel
    if (el.confirmCancel) el.confirmCancel.textContent = cancelLabel
    el.confirmDialog.hidden = false
    return new Promise(resolve => {
      confirmSession = {
        resolve,
        hasInput: !!input,
        returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      }
      requestAnimationFrame(() => {
        const field = el.confirmBody?.querySelector('#hubConfirmInput')
        if (field) {
          field.focus()
          field.select()
        } else el.confirmOk?.focus()
      })
    })
  }

  function closeConfirm(result) {
    const session = confirmSession
    confirmSession = null
    if (el.confirmDialog) el.confirmDialog.hidden = true
    if (!session) return
    session.resolve(result)
    if (session.returnFocus?.isConnected) requestAnimationFrame(() => session.returnFocus.focus())
  }

  function resolveConfirm(accepted) {
    if (!confirmSession) return
    if (!accepted) {
      closeConfirm(null)
      return
    }
    if (confirmSession.hasInput) {
      closeConfirm(String(el.confirmBody?.querySelector('#hubConfirmInput')?.value || '').trim())
      return
    }
    closeConfirm(true)
  }

  function parseSurface(raw) {
    return String(raw || '').trim() === 'workbench' ? 'workbench' : 'capability'
  }

  function parsePresentation(raw) {
    return String(raw || '').trim() === 'detail' ? 'detail' : 'hub'
  }

  function applyPresentation(presentation) {
    state.presentation = parsePresentation(presentation)
    document.body.classList.toggle('hub-detail-only', state.presentation === 'detail')
  }

  /** 同步 URL 深链，避免 park/reuse 后 iframe 仍残留 expertId 导致冷启默认弹出详情 */
  function syncEmbeddedDeepLink({ expertId, surface, tab, presentation } = {}) {
    try {
      const url = new URL(window.location.href)
      const nextTab = (tab === 'experts' || tab === 'skills' || tab === 'connectors')
        ? tab
        : state.tab
      const nextSurface = surface != null && String(surface).trim() !== ''
        ? parseSurface(surface)
        : state.surface
      const nextPresentation = presentation != null && String(presentation).trim() !== ''
        ? parsePresentation(presentation)
        : state.presentation
      url.searchParams.set('tab', nextTab)
      url.searchParams.set('surface', nextSurface)
      url.searchParams.set('presentation', nextPresentation)
      const id = String(expertId || '').trim()
      if (id) url.searchParams.set('expertId', id)
      else url.searchParams.delete('expertId')
      if (url.search !== window.location.search || url.pathname !== window.location.pathname) {
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      }
    } catch { /* noop */ }
  }

  /** 专家库浏览态：关掉残留详情并复位 workbench surface（不关宿主整页） */
  function clearBrowseSelection({ syncUrl = true } = {}) {
    state.selected = null
    state.pendingExpertId = ''
    applyPresentation('hub')
    if (state.surface === 'workbench') state.surface = 'capability'
    if (syncUrl) {
      syncEmbeddedDeepLink({
        expertId: '',
        surface: state.surface,
        tab: state.tab,
        presentation: 'hub',
      })
    }
    renderDrawer()
  }

  function parseInitialTab() {
    try {
      const q = new URLSearchParams(window.location.search)
      const tab = String(q.get('tab') || '').trim()
      if (tab === 'experts' || tab === 'skills' || tab === 'connectors') return tab
    } catch { /* noop */ }
    return 'experts'
  }

  function parseInitialDeepLink() {
    try {
      const q = new URLSearchParams(window.location.search)
      state.surface = parseSurface(q.get('surface'))
      applyPresentation(q.get('presentation'))
      state.pendingExpertId = String(q.get('expertId') || '').trim()
    } catch {
      state.surface = 'capability'
      applyPresentation('hub')
      state.pendingExpertId = ''
    }
  }

  function applyExpertSelection({ expertId = '', surface, tab, presentation } = {}) {
    if (presentation != null && String(presentation).trim() !== '') {
      applyPresentation(presentation)
    }
    if (surface != null && String(surface).trim() !== '') {
      state.surface = parseSurface(surface)
    }
    const id = String(expertId || '').trim()
    const nextTab = (tab === 'experts' || tab === 'skills' || tab === 'connectors')
      ? tab
      : (id ? 'experts' : state.tab)
    if (nextTab !== state.tab) {
      if (id) state.pendingExpertId = id
      else {
        state.pendingExpertId = ''
        state.selected = null
      }
      setTab(nextTab)
      return
    }
    // 无 expertId = 目录浏览：必须关掉残留详情（工作台 detail 叠层切整页时最常见）
    if (!id) {
      if (state.presentation === 'hub') {
        clearBrowseSelection()
        return
      }
      renderDrawer()
      return
    }
    if (state.loading) {
      state.pendingExpertId = id
      syncEmbeddedDeepLink({ expertId: id, surface: state.surface, tab: state.tab, presentation: state.presentation })
      return
    }
    if (!state.items.some(item => item.id === id)) {
      toast('这项能力不在当前目录中，可能已被移除', 'error')
      if (state.presentation === 'detail') dismissDetailOverlay()
      return
    }
    syncEmbeddedDeepLink({ expertId: id, surface: state.surface, tab: state.tab, presentation: state.presentation })
    if (state.selected?.id === id) {
      renderDrawer()
      return
    }
    openDrawer(id)
  }

  function flushPendingExpertSelection() {
    const id = String(state.pendingExpertId || '').trim()
    if (!id) return
    state.pendingExpertId = ''
    if (!state.items.some(item => item.id === id)) {
      toast('这项能力不在当前目录中，可能已被移除', 'error')
      if (state.presentation === 'detail') dismissDetailOverlay()
      return
    }
    openDrawer(id)
  }

  function notifyParentTab(tab) {
    try { window.parent.postMessage({ type: 'capability-hub-tab', tab }, '*') } catch { /* noop */ }
  }

  function closeHub(options = {}) {
    const reason = String(options?.reason || '').trim()
    const payload = reason
      ? { type: 'capability-hub-close', reason }
      : { type: 'capability-hub-close' }
    try { window.parent.postMessage(payload, '*') } catch { /* noop */ }
  }

  function dismissDetailOverlay() {
    // 保持 presentation=detail 直至宿主关叠层，避免 close 异步间隙里壳层闪回完整专家库
    state.selected = null
    state.pendingExpertId = ''
    renderDrawer()
    closeHub({ reason: 'detail-dismiss' })
  }

  function requestParent(type, payload, { prefix, timeoutMessage }) {
    const requestId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingParentRequests.delete(requestId)
        reject(new Error(timeoutMessage))
      }, 15000)
      pendingParentRequests.set(requestId, {
        resolve: value => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        },
      })
      try {
        window.parent.postMessage({ type, requestId, ...payload }, '*')
      } catch (error) {
        clearTimeout(timer)
        pendingParentRequests.delete(requestId)
        reject(error)
      }
    })
  }

  function requestExpertStart(expertId) {
    const id = String(expertId || '').trim()
    if (!id) return Promise.reject(new Error('缺少专家 ID'))
    return requestParent('capability-hub-start-expert', {
      expertId: id,
      // 工作台开工 = 任务；能力/助理面 = 普通专家 Session
      surface: state.surface === 'workbench' ? 'workbench' : 'capability',
    }, {
      prefix: 'expert-start',
      timeoutMessage: '打开专家对话超时，请重试',
    })
  }

  function requestWorkbenchAdd(expertId) {
    const id = String(expertId || '').trim()
    if (!id) return Promise.reject(new Error('缺少专家 ID'))
    return requestParent('capability-hub-add-expert-to-workbench', { expertId: id }, {
      prefix: 'expert-workbench',
      timeoutMessage: '添加到工作台超时，请重试',
    })
  }

  function requestWorkbenchRemove(expertId) {
    const id = String(expertId || '').trim()
    if (!id) return Promise.reject(new Error('缺少专家 ID'))
    return requestParent('capability-hub-remove-expert-from-workbench', { expertId: id }, {
      prefix: 'expert-workbench-remove',
      timeoutMessage: '从工作台撤回超时，请重试',
    })
  }

  function requestSkillStart({ skillId, prompt, title }) {
    const id = String(skillId || '').trim()
    if (!id) return Promise.reject(new Error('缺少技能 ID'))
    return requestParent('capability-hub-start-skill', {
      skillId: id,
      prompt: String(prompt || '').slice(0, 4000),
      title: String(title || '').slice(0, 160),
    }, {
      prefix: 'skill-start',
      timeoutMessage: '打开技能对话超时，请重试',
    })
  }

  function toast(msg, type = 'info') {
    if (!el.toast) return
    el.toast.textContent = msg
    el.toast.className = 'hub-toast show' + (type === 'error' ? ' error' : '')
    clearTimeout(toast._t)
    toast._t = setTimeout(() => { el.toast.className = 'hub-toast' }, 2400)
  }

  async function refreshWorkbenchExpertIds() {
    const { api } = getBridge()
    if (typeof api?.workbenchModeList !== 'function') return
    try {
      const modeState = await api.workbenchModeList()
      const activeMode = Array.isArray(modeState?.modes)
        ? modeState.modes.find(mode => mode.id === modeState.activeModeId)
        : null
      state.workbenchExpertIds = new Set(
        (Array.isArray(activeMode?.bindings) ? activeMode.bindings : [])
          .map(binding => String(binding.expertId || binding.id || '').trim())
          .filter(Boolean),
      )
    } catch {
      // 能力目录仍可独立使用；工作台状态稍后由添加结果或下次刷新同步。
    }
  }

  let catalogAuxSeq = 0
  async function loadCatalogAuxiliaries() {
    const seq = ++catalogAuxSeq
    try {
      await Promise.all([
        loadExpertEditorCatalog(),
        loadCompositionIndex(),
        refreshWorkbenchExpertIds(),
      ])
    } catch {
      // 辅助数据失败不回退主目录
    }
    if (seq !== catalogAuxSeq || state.loading) return
    // 辅助数据只影响抽屉（工作台绑定等）；勿重绘网格以免入场动画重播
    renderDrawer()
  }

  async function loadCatalog(opts = {}) {
    const soft = !!opts.soft
    if (!soft) {
      state.loading = true
      state.loadError = ''
      state.offline = false
      render()
    }
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
        if (!soft) state.loadError = ''
      } else {
        state.offline = !cap && !api?.capabilityList
        state.items = soft ? state.items : []
      }
    } catch (e) {
      if (!soft) {
        state.loadError = e?.message || String(e)
        state.items = []
      }
    } finally {
      state.loading = false
      render()
      flushPendingExpertSelection()
    }
    // 主目录已可交互；编辑器 catalog / composition / 工作台绑定后台补齐
    void loadCatalogAuxiliaries()
  }

  function resumeFromHost({ expertId = '', surface, tab, presentation } = {}) {
    const nextTab = (tab === 'experts' || tab === 'skills' || tab === 'connectors')
      ? tab
      : state.tab
    const tabChanged = nextTab !== state.tab
    applyExpertSelection({ expertId, surface, tab, presentation })
    // Tab 切换已由 setTab → loadCatalog 拉主目录；同 Tab 复用只轻刷绑定，避免双次整格重绘
    if (tabChanged || state.loading) return
    void (async () => {
      await refreshWorkbenchExpertIds()
      renderDrawer()
    })()
  }

  function normalizeItem(raw) {
    return {
      id: String(raw.id || ''),
      kind: String(raw.kind || 'skill'),
      name: String(raw.name || raw.title || raw.id || '未命名'),
      originName: String(raw.originName || ''),
      nameSource: String(raw.nameSource || ''),
      description: String(raw.description || raw.summary || ''),
      version: String(raw.version || '—'),
      source: String(raw.source || 'curated'),
      category: String(raw.category || '全部'),
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      featured: !!raw.featured,
      favorite: !!raw.favorite,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      status: String(raw.status || 'available'),
      enabled: raw.enabled !== false && (raw.status === 'installed' || raw.status === 'enabled'),
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : [],
      permissions: raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {},
      inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
      outputs: Array.isArray(raw.outputs) ? raw.outputs : [],
      risk: raw.risk && typeof raw.risk === 'object' ? raw.risk : { level: 'low', reasons: [] },
      provenance: raw.provenance && typeof raw.provenance === 'object' ? raw.provenance : {},
      contentHash: raw.contentHash || '',
      installedAt: raw.installedAt || '',
      legacy: !!raw.legacy,
      health: raw.health || '',
      sourceAvailable: raw.sourceAvailable !== false,
      repositoryId: raw.repositoryId || '',
    }
  }

  function isCuratedExpert(it) {
    return it?.kind === 'expert' && ['curated', 'pack', 'official'].includes(String(it.source || ''))
  }

  function isLocalExpert(it) {
    return it?.kind === 'expert' && ['local', 'custom', 'zip', 'https', 'local-repo'].includes(String(it.source || ''))
  }

  /** 「我的」：仅用户新建/复制保存的自建专家，不含精选与 Cursor 仓库等外部导入 */
  function isUserCreatedExpert(it) {
    if (it?.kind !== 'expert') return false
    if (['curated', 'pack', 'official'].includes(String(it.source || ''))) return false
    if (!['local', 'custom'].includes(String(it.source || ''))) return false
    if (String(it.repositoryId || '').trim()) return false
    return true
  }

  function resolveEditorExpertItem(editor = state.expertEditor) {
    if (!editor) return null
    const id = String(editor.sourceId || editor.id || '').trim()
    if (!id) return null
    return state.items.find(it => it.kind === 'expert' && it.id === id) || null
  }

  /** 编辑弹窗是否可删：仅 tune 模式 + 自建专家 */
  function canDeleteEditedExpert(editor = state.expertEditor) {
    if (!editor || editor.mode !== 'tune') return false
    const item = resolveEditorExpertItem(editor)
    if (item) return isUserCreatedExpert(item)
    const source = String(
      editor.source
      || editor.detail?.source
      || editor.detail?.provenance?.source
      || 'custom',
    ).trim()
    if (['curated', 'pack', 'official'].includes(source)) return false
    return !source || ['local', 'custom'].includes(source)
  }

  function syncExpertDeleteButton() {
    if (!el.expertDelete) return
    el.expertDelete.hidden = !canDeleteEditedExpert()
  }

  function isMineFilterActive() {
    return state.tab === 'experts' && state.category === MINE_EXPERT_CATEGORY
  }

  function matchesCategoryFilter(it) {
    if (state.category === '全部') return true
    if (state.category === FAVORITE_CATEGORY) return !!it.favorite
    if (state.category === MINE_EXPERT_CATEGORY) return isUserCreatedExpert(it)
    if (it.category === state.category) return true
    const cats = Array.isArray(it.categories) ? it.categories : []
    return cats.some((cat) => String(cat) === state.category)
  }

  async function loadExpertEditorCatalog() {
    const { cap, api } = getBridge()
    try {
      const [skills, connectors, knowledge] = await Promise.all([
        cap?.list ? cap.list({ kind: 'skill' }) : (api?.capabilityList ? api.capabilityList({ kind: 'skill' }) : null),
        cap?.list ? cap.list({ kind: 'connector' }) : (api?.capabilityList ? api.capabilityList({ kind: 'connector' }) : null),
        api?.knowledgeProviderList ? api.knowledgeProviderList() : Promise.resolve({ providers: [] }),
      ])
      state.catalogSkills = Array.isArray(skills?.items || skills) ? (skills.items || skills).map(normalizeItem) : []
      state.catalogConnectors = Array.isArray(connectors?.items || connectors) ? (connectors.items || connectors).map(normalizeItem) : []
      state.knowledgeProviders = Array.isArray(knowledge?.providers) ? knowledge.providers : []
    } catch {
      state.catalogSkills = state.catalogSkills || []
      state.catalogConnectors = state.catalogConnectors || []
      state.knowledgeProviders = state.knowledgeProviders || []
    }
  }

  async function loadCompositionIndex() {
    const { api, skill, expert } = getBridge()
    const taskFn = skill?.tasks || api?.skillTaskList
    const expertFn = expert?.list || api?.expertList
    try {
      const [tasks, experts] = await Promise.all([
        taskFn ? taskFn() : Promise.resolve(null),
        expertFn ? expertFn() : Promise.resolve(null),
      ])
      state.skillTasks = Array.isArray(tasks?.tasks) ? tasks.tasks : []
      state.localExperts = Array.isArray(experts?.experts) ? experts.experts : []
      state.compositionLoaded = !!(tasks || experts)
    } catch {
      // 装配关系是详情里的补充信息，拿不到时退回说明文案，不影响目录本身。
      state.compositionLoaded = false
    }
  }

  function tasksForSkill(skillId) {
    const id = String(skillId || '')
    return state.skillTasks.filter(task => String(task.skillId || '') === id)
  }

  function expertsUsingSkill(skillId) {
    const id = String(skillId || '')
    return state.localExperts.filter(expert =>
      (Array.isArray(expert.skills) ? expert.skills : []).map(String).includes(id))
  }

  function localExpertById(expertId) {
    const id = String(expertId || '')
    return state.localExperts.find(expert => String(expert.id || '') === id) || null
  }

  function compositionChips(kind, ids) {
    return ids.map(rawId => {
      const id = String(rawId?.id || rawId || '')
      const label = String(rawId?.name || rawId?.id || rawId || '')
      return `<button type="button" class="hub-link-chip" data-hub-goto="${esc(kind)}" data-hub-goto-id="${esc(id)}">${esc(label)}</button>`
    }).join('')
  }

  function skillTaskSection(it) {
    const tasks = tasksForSkill(it.id)
    if (!tasks.length) {
      return `<div class="hub-drawer-section"><h3>可以做什么</h3>
        <p class="hub-muted">这项技能没有声明现成任务。你可以直接试用并描述需求，或把它装配给某位专家后在对话中调用。</p>
      </div>`
    }
    const rows = tasks.slice(0, 8).map(task => {
      // preflight 提前显示，避免用户点进对话才发现连接器没授权。
      const needs = task.preflight?.connector ? `<span class="hub-task-flag">需先授权 ${esc(task.preflight.connector)}</span>` : ''
      return `
      <li class="hub-task-row">
        <span class="hub-task-copy"><strong>${esc(task.title || task.id)}</strong>${task.subtitle ? `<em>${esc(task.subtitle)}</em>` : ''}${needs}</span>
        <button type="button" class="hub-btn" data-act="trySkill" data-task-id="${esc(task.id)}">试用</button>
      </li>`
    }).join('')
    return `<div class="hub-drawer-section"><h3>可以做什么</h3>
      <ul class="hub-task-list">${rows}</ul>
      ${tasks.length > 8 ? `<p class="hub-muted">另有 ${tasks.length - 8} 个任务可在对话中调用。</p>` : ''}
    </div>`
  }

  function skillUsageSection(it) {
    const experts = expertsUsingSkill(it.id)
    if (!experts.length) {
      return `<div class="hub-drawer-section"><h3>装配它的专家</h3>
        <p class="hub-muted">还没有专家装配这项技能。在专家编辑中勾选它，之后该专家就能调用。</p>
      </div>`
    }
    return `<div class="hub-drawer-section"><h3>装配它的专家</h3>
      <div class="hub-link-chips">${compositionChips('expert', experts)}</div>
      <p class="hub-muted">卸载这项技能会影响上面 ${experts.length} 位专家。</p>
    </div>`
  }

  function expertCompositionSection(it, installed) {
    const expert = localExpertById(it.id)
    if (!expert) {
      return `<div class="hub-drawer-section"><h3>装配</h3>
        <p class="hub-muted">${installed ? '暂时读不到这位专家的装配信息。' : '安装后可以查看它装配了哪些技能与连接器。'}</p>
      </div>`
    }
    const skills = Array.isArray(expert.skills) ? expert.skills : []
    const connectors = Array.isArray(expert.connectors) ? expert.connectors : []
    return `<div class="hub-drawer-section"><h3>装配</h3>
      <h4>技能 ${skills.length}</h4>
      ${skills.length ? `<div class="hub-link-chips">${compositionChips('skill', skills)}</div>` : '<p class="hub-muted">未装配技能，它只会依据 persona 回答。</p>'}
      <h4>连接器 ${connectors.length}</h4>
      ${connectors.length ? `<div class="hub-link-chips">${compositionChips('connector', connectors)}</div>` : '<p class="hub-muted">未装配连接器，它不会访问外部系统。</p>'}
    </div>`
  }

  const catalogPicker = () => window.CatalogPicker || globalThis.CatalogPicker || null
  let pickerSession = null

  function catalogFieldSpecs() {
    const editor = state.expertEditor || {}
    const detail = editor.detail || {}
    const knowledgeRefs = Array.isArray(editor.knowledgeRefs)
      ? editor.knowledgeRefs
      : (Array.isArray(editor.profile?.knowledgeRefs) ? editor.profile.knowledgeRefs : [])
    return [
      {
        name: 'hub-expert-skill',
        title: 'Skills',
        dialogTitle: '选择 Skills',
        hint: '专家可以调用的技能，决定它会做哪些事。',
        items: state.catalogSkills,
        selected: editor.skills || detail.skills || [],
        unit: 'Skill',
        selectLabel: '选择技能',
        emptyLabel: '请先安装技能，再选择要装配的能力。',
        emptyAction: { label: '去安装技能', tab: 'skills' },
        key: 'skills',
      },
      {
        name: 'hub-expert-connector',
        title: 'Tool 与连接器',
        dialogTitle: '选择连接器',
        hint: '允许专家访问的外部系统与工具。',
        items: state.catalogConnectors,
        selected: editor.connectors || detail.connectors || [],
        unit: '连接器',
        selectLabel: '选择连接器',
        emptyLabel: '请先添加连接器，再选择要授权的工具。',
        emptyAction: { label: '去添加连接器', tab: 'connectors' },
        key: 'connectors',
      },
      {
        name: 'hub-expert-knowledge',
        title: '知识库范围',
        dialogTitle: '选择知识来源',
        hint: '专家回答时可检索的知识来源。',
        items: state.knowledgeProviders,
        selected: knowledgeRefs,
        unit: '知识源',
        selectLabel: '选择知识源',
        emptyLabel: '请先在设置的「知识库与记忆」中添加来源，再回来选择。',
        key: 'knowledgeRefs',
      },
    ]
  }

  function catalogFieldSpec(name) {
    return catalogFieldSpecs().find(item => item.name === name) || null
  }

  function renderCatalogSummaries() {
    const picker = catalogPicker()
    if (!picker) return ''
    return catalogFieldSpecs().map(spec => picker.renderSummary(spec)).join('')
  }

  function refreshCatalogSummary(name) {
    const picker = catalogPicker()
    const spec = catalogFieldSpec(name)
    const section = el.expertDialogBody?.querySelector(`[data-catalog-field="${name}"]`)
    if (!picker || !spec || !section) return
    section.outerHTML = picker.renderSummary(spec)
    updateExpertEditorSelection()
  }

  function updatePickerFooter() {
    const picker = catalogPicker()
    if (!picker || !el.pickerBody || !pickerSession) return
    const ids = picker.selectedValues(el.pickerBody, pickerSession.name)
    if (el.pickerSummary) el.pickerSummary.textContent = `已选 ${ids.length} ${pickerSession.unit}`
  }

  function closeCatalogPicker() {
    pickerSession = null
    if (el.pickerDialog) el.pickerDialog.hidden = true
    if (el.pickerBody) {
      el.pickerBody.innerHTML = ''
      delete el.pickerBody.dataset.catalogPickerBound
    }
  }

  function openCatalogPicker(name) {
    const picker = catalogPicker()
    const spec = catalogFieldSpec(name)
    if (!picker || !spec || !el.pickerDialog) return
    if (!spec.items?.length) {
      toast(spec.emptyLabel || '暂无可选项', 'info')
      return
    }
    pickerSession = spec
    if (el.pickerTitle) el.pickerTitle.textContent = spec.dialogTitle
    if (el.pickerDesc) el.pickerDesc.textContent = spec.hint
    el.pickerBody.innerHTML = picker.renderPanel(spec)
    delete el.pickerBody.dataset.catalogPickerBound
    picker.bind(el.pickerBody, { onSelectionChange: updatePickerFooter })
    updatePickerFooter()
    el.pickerDialog.hidden = false
    if (window.StickyIcons) StickyIcons.mount(el.pickerBody)
  }

  function applyCatalogPicker() {
    const picker = catalogPicker()
    const editor = state.expertEditor
    if (!picker || !pickerSession || !editor) {
      closeCatalogPicker()
      return
    }
    const ids = picker.selectedValues(el.pickerBody, pickerSession.name)
    editor[pickerSession.key] = ids
    const name = pickerSession.name
    closeCatalogPicker()
    refreshCatalogSummary(name)
    if (name === 'hub-expert-skill' && !editor.avatarManual) autoMatchExpertAvatar()
  }

  function leaveEditorForCatalogTab(tab) {
    if (!tab || !TAB_COPY[tab]) return
    closeCatalogPicker()
    closeExpertEditor()
    setTab(tab)
    toast('安装完成后，再打开专家编辑进行选择', 'info')
  }

  function agenticConfigFieldsHtml(type, config = {}) {
    const cfg = config && typeof config === 'object' ? config : {}
    if (type === 'reflection') {
      return `
        <div class="hub-form-grid">
          <div class="hub-field">
            <label for="hubExpertReflectRounds">最大自检轮次</label>
            <input id="hubExpertReflectRounds" type="number" min="1" max="5" value="${esc(String(cfg.maxReflectionRounds || 2))}">
          </div>
        </div>
        <div class="hub-field">
          <label for="hubExpertAcceptChecklist">验收清单（可选）</label>
          <textarea id="hubExpertAcceptChecklist" rows="3" placeholder="交付前必须核对的要点">${esc(cfg.acceptanceChecklist || '')}</textarea>
        </div>`
    }
    if (type === 'tool_use') {
      return `
        <div class="hub-field">
          <label for="hubExpertToolPolicy">工具策略</label>
          <select id="hubExpertToolPolicy">
            <option value="prefer_tools"${(cfg.toolPolicy || 'prefer_tools') === 'prefer_tools' ? ' selected' : ''}>优先使用工具</option>
            <option value="tools_when_needed"${cfg.toolPolicy === 'tools_when_needed' ? ' selected' : ''}>需要时再用工具</option>
          </select>
        </div>
        <div class="hub-field">
          <label for="hubExpertConnectorHint">必选连接器提示（可选）</label>
          <input id="hubExpertConnectorHint" type="text" value="${esc(cfg.requiredConnectorHint || '')}" placeholder="例如：飞书文档">
        </div>`
    }
    if (type === 'planning') {
      return `
        <div class="hub-flag-row">
          <label class="hub-flag">
            <input type="checkbox" id="hubExpertPlanFirst"${cfg.planFirst !== false ? ' checked' : ''}>
            <span class="hub-check-box" aria-hidden="true"></span>
            <span class="hub-flag-text">复杂任务先输出计划</span>
          </label>
          <label class="hub-flag">
            <input type="checkbox" id="hubExpertPlanConfirm"${cfg.requirePlanConfirmation ? ' checked' : ''}>
            <span class="hub-check-box" aria-hidden="true"></span>
            <span class="hub-flag-text">计划需用户确认后再执行</span>
          </label>
        </div>`
    }
    if (type === 'multi_agent') {
      return `
        <div class="hub-field">
          <label for="hubExpertDelegation">委派条件与边界</label>
          <textarea id="hubExpertDelegation" rows="3" placeholder="何时把任务交给其他专家/工作流；本职与非本职边界">${esc(cfg.delegationHints || '')}</textarea>
          <small>不会自动拉起完整多 Agent 图；完整编排请用工作流 Studio。</small>
        </div>
        <div class="hub-field">
          <label for="hubExpertTeammates">可参考协作对象 ID（逗号分隔，可选）</label>
          <input id="hubExpertTeammates" type="text" value="${esc((cfg.teammateRefs || []).join(', '))}" placeholder="planner, reviewer">
        </div>`
    }
    // react default
    return `
      <div class="hub-flag-row">
        <label class="hub-flag">
          <input type="checkbox" id="hubExpertEnableTools"${cfg.enableTools !== false ? ' checked' : ''}>
          <span class="hub-check-box" aria-hidden="true"></span>
          <span class="hub-flag-text">允许使用工具</span>
        </label>
        <label class="hub-flag">
          <input type="checkbox" id="hubExpertEnableReflect"${cfg.enableReflection !== false ? ' checked' : ''}>
          <span class="hub-check-box" aria-hidden="true"></span>
          <span class="hub-flag-text">允许反思修订</span>
        </label>
      </div>`
  }

  function readAgenticConfigFromForm(type) {
    const body = el.expertDialogBody
    if (!body) return {}
    if (type === 'reflection') {
      return {
        maxReflectionRounds: Number(body.querySelector('#hubExpertReflectRounds')?.value || 2),
        acceptanceChecklist: body.querySelector('#hubExpertAcceptChecklist')?.value || '',
      }
    }
    if (type === 'tool_use') {
      return {
        toolPolicy: body.querySelector('#hubExpertToolPolicy')?.value || 'prefer_tools',
        requiredConnectorHint: body.querySelector('#hubExpertConnectorHint')?.value || '',
      }
    }
    if (type === 'planning') {
      return {
        planFirst: !!body.querySelector('#hubExpertPlanFirst')?.checked,
        requirePlanConfirmation: !!body.querySelector('#hubExpertPlanConfirm')?.checked,
      }
    }
    if (type === 'multi_agent') {
      const refs = String(body.querySelector('#hubExpertTeammates')?.value || '')
        .split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
      return {
        delegationHints: body.querySelector('#hubExpertDelegation')?.value || '',
        teammateRefs: refs,
      }
    }
    return {
      enableTools: !!body.querySelector('#hubExpertEnableTools')?.checked,
      enableReflection: !!body.querySelector('#hubExpertEnableReflect')?.checked,
    }
  }

  function syncExpertEditorDraftFromForm() {
    const editor = state.expertEditor
    const body = el.expertDialogBody
    if (!editor || !body) return editor
    const type = body.querySelector('#hubExpertAgenticType')?.value || editor.agenticType || 'react'
    editor.id = body.querySelector('#hubExpertId')?.value || editor.id
    editor.name = body.querySelector('#hubExpertName')?.value || editor.name
    editor.description = body.querySelector('#hubExpertDescription')?.value || editor.description
    editor.soul = body.querySelector('#hubExpertSoul')?.value || ''
    editor.sop = body.querySelector('#hubExpertSop')?.value || ''
    editor.agenticType = type
    editor.agenticConfig = readAgenticConfigFromForm(type)
    editor.skills = [...body.querySelectorAll('input[name="hub-expert-skill"]:checked')].map(input => input.value)
    editor.connectors = [...body.querySelectorAll('input[name="hub-expert-connector"]:checked')].map(input => input.value)
    editor.knowledgeRefs = [...body.querySelectorAll('input[name="hub-expert-knowledge"]:checked')].map(input => input.value)
    return editor
  }

  function renderAgenticConfigPanel() {
    const mount = el.expertDialogBody?.querySelector('[data-agentic-config]')
    const editor = state.expertEditor
    if (!mount || !editor) return
    const type = editor.agenticType || 'react'
    const opt = AGENTIC_TYPE_OPTIONS.find(item => item.id === type)
    mount.innerHTML = `
      <p class="hub-muted">${esc(opt?.hint || '')}</p>
      ${agenticConfigFieldsHtml(type, editor.agenticConfig || {})}`
  }

  async function loadExpertEditorDetail(expertId) {
    const { expert, api } = getBridge()
    const getFn = expert?.get || api?.expertGet
    if (!getFn || !expertId) return null
    const result = await getFn(expertId)
    const detail = result?.expert?.ok ? result.expert : (result?.expert || result)
    let profile = null
    if (api?.agentProfileList) {
      const profileResult = await api.agentProfileList(expertId)
      const profiles = profileResult?.profiles || []
      profile = profiles.find(item => item.provenance?.scope === 'default-agent') || profiles[0] || null
    }
    return { detail, profile }
  }

  function renderExpertEditorForm() {
    const editor = state.expertEditor
    if (!editor || !el.expertDialogBody) return
    const detail = editor.detail || {}
    const readonlyId = editor.mode === 'tune' || editor.mode === 'copy'
    el.expertDialogTitle.textContent = editor.mode === 'create'
      ? '添加自己的专家'
      : (editor.mode === 'copy' ? '复制为自建专家' : `编辑 · ${detail.name || editor.sourceId || ''}`)
    if (el.expertDialogDesc) {
      el.expertDialogDesc.textContent = editor.mode === 'copy'
        ? '基于官方专家创建可编辑的本地副本，再按需调整。'
        : '配置 Soul、SOP、AgenticType、Skill 与连接器；保存后可在工作台与各处专家协作中使用。'
    }
    const avatarKey = editor.avatar || detail.avatar || suggestExpertAvatarKey({
      id: editor.id || detail.id,
      name: editor.name || detail.name,
      description: editor.description || detail.description,
      skills: editor.skills || detail.skills,
    })
    editor.avatar = avatarKey
    const identity = identityApi()
    const presets = identity && typeof identity.listPresetAvatars === 'function'
      ? identity.listPresetAvatars()
      : []
    const avatarPicker = presets.length
      ? `<div class="hub-avatar-picker" role="radiogroup" aria-label="专家头像">
          ${presets.map(preset => `
            <button type="button" class="hub-avatar-option${preset.id === avatarKey ? ' selected' : ''}"
              data-avatar-id="${esc(preset.id)}" role="radio" aria-checked="${preset.id === avatarKey ? 'true' : 'false'}" title="${esc(preset.label)}">
              <img src="${esc(preset.src)}" alt="" width="44" height="44" decoding="async">
              <span>${esc(preset.label)}</span>
            </button>`).join('')}
        </div>`
      : '<p class="hub-muted">头像预设未加载，将使用通用搭档。</p>'
    el.expertDialogBody.innerHTML = `
      <section class="hub-expert-section">
        <header class="hub-expert-section-head">
          <div>
            <h3>基础信息</h3>
            <p>决定这个专家在工作台里的身份与调用方式。</p>
          </div>
        </header>
        <div class="hub-form-grid">
          <div class="hub-field" data-field="id">
            <label for="hubExpertId">专家 ID<span class="hub-req">必填</span></label>
            <input id="hubExpertId" type="text" value="${esc(editor.id || detail.id || '')}"${readonlyId && editor.mode === 'tune' ? ' readonly' : ''} placeholder="my-assistant" spellcheck="false">
            <small>小写字母、数字与连字符，保存后作为调用标识。</small>
          </div>
          <div class="hub-field" data-field="name">
            <label for="hubExpertName">名称<span class="hub-req">必填</span></label>
            <input id="hubExpertName" type="text" value="${esc(editor.name || detail.name || '')}" placeholder="用户看到的名称">
            <small>展示在专家列表与工作台编排中。</small>
          </div>
        </div>
        <div class="hub-field">
          <label for="hubExpertDescription">职责说明</label>
          <textarea id="hubExpertDescription" rows="2" placeholder="这位专家擅长什么、负责什么、交付什么">${esc(editor.description || detail.description || '')}</textarea>
        </div>
        <div class="hub-field hub-field-avatar">
          <label>头像</label>
          ${avatarPicker}
        </div>
      </section>
      <section class="hub-expert-section">
        <header class="hub-expert-section-head">
          <div>
            <h3>Soul · SOP · Agentic</h3>
            <p>Soul 定性格风格；SOP 定岗位职责；AgenticType 定智能体做事模式。</p>
          </div>
        </header>
        <div class="hub-field">
          <label for="hubExpertSoul">Soul（特性化与风格）</label>
          <textarea id="hubExpertSoul" rows="3" placeholder="性格、口吻、价值观、提问方式与表达禁忌">${esc(editor.soul || detail.soul || '')}</textarea>
        </div>
        <div class="hub-field">
          <label for="hubExpertSop">SOP（岗位职责）<span class="hub-req">建议填写</span></label>
          <textarea id="hubExpertSop" rows="5" placeholder="职责、步骤、交付标准、何时询问用户、何时自行推进">${esc(editor.sop || detail.sop || editor.systemPrompt || detail.systemPrompt || '')}</textarea>
        </div>
        <div class="hub-field">
          <label id="hubExpertAgenticTypeLabel">AgenticType</label>
          <div class="hub-select" data-hub-select>
            <input type="hidden" id="hubExpertAgenticType" value="${esc(editor.agenticType || detail.agenticType || 'react')}" aria-labelledby="hubExpertAgenticTypeLabel">
            <button type="button" class="hub-select-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span data-select-label>${esc((AGENTIC_TYPE_OPTIONS.find(o => o.id === (editor.agenticType || detail.agenticType || 'react')) || AGENTIC_TYPE_OPTIONS[0]).label)}</span>
              <span class="hub-select-caret" aria-hidden="true"></span>
            </button>
            <div class="hub-select-menu" role="listbox" hidden>
              ${AGENTIC_TYPE_OPTIONS.map((opt, i) => `${i ? '<div class="hub-select-sep" role="separator"></div>' : ''}
              <button type="button" class="hub-select-option${(editor.agenticType || detail.agenticType || 'react') === opt.id ? ' selected' : ''}" role="option" data-select-value="${esc(opt.id)}" aria-selected="${(editor.agenticType || detail.agenticType || 'react') === opt.id ? 'true' : 'false'}">${esc(opt.label)}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="hub-field" data-agentic-config>
          <p class="hub-muted">${esc((AGENTIC_TYPE_OPTIONS.find(o => o.id === (editor.agenticType || detail.agenticType || 'react')) || AGENTIC_TYPE_OPTIONS[0]).hint)}</p>
          ${agenticConfigFieldsHtml(editor.agenticType || detail.agenticType || 'react', editor.agenticConfig || detail.agenticConfig || {})}
        </div>
      </section>
      ${renderCatalogSummaries()}`
    if (window.StickyIcons) StickyIcons.mount(el.expertDialogBody)
    updateExpertEditorSelection()
    syncExpertDeleteButton()
  }

  function updateExpertEditorSelection() {
    const body = el.expertDialogBody
    if (!body) return
    const parts = catalogFieldSpecs().map(spec => {
      const total = (spec.items || []).length
      const picked = (Array.isArray(spec.selected) ? spec.selected : []).length
      const badge = body.querySelector(`[data-count-for="${spec.name}"]`)
      if (badge) {
        badge.textContent = `${picked}/${total}`
        badge.classList.toggle('active', picked > 0)
      }
      return `${picked} ${spec.unit}`
    })
    if (el.expertSummary) el.expertSummary.textContent = `已选 ${parts.join(' · ')}`
  }

  function markExpertFieldInvalid(field) {
    const body = el.expertDialogBody
    const wrap = body?.querySelector(`.hub-field[data-field="${field}"]`)
    if (!wrap) return
    wrap.classList.add('invalid')
    const input = wrap.querySelector('input')
    input?.focus()
    input?.addEventListener('input', () => wrap.classList.remove('invalid'), { once: true })
  }

  async function openExpertEditor(mode, sourceItem = null) {
    await loadExpertEditorCatalog()
    const base = sourceItem && typeof sourceItem === 'object' ? sourceItem : null
    let detail = null
    let profile = null
    if (mode === 'tune' && base?.id) {
      const loaded = await loadExpertEditorDetail(base.id)
      detail = loaded?.detail || null
      profile = loaded?.profile || null
    } else if (mode === 'copy' && base?.id) {
      const loaded = await loadExpertEditorDetail(base.id)
      detail = loaded?.detail || null
      profile = loaded?.profile || null
    }
    const seed = {
      id: mode === 'copy' ? `${String(base?.id || 'expert').replace(/-copy\d*$/, '')}-copy-${Date.now().toString(36).slice(-4)}` : (detail?.id || ''),
      name: mode === 'copy' ? `${base?.name || base?.id || '专家'}（我的）` : (detail?.name || ''),
      description: detail?.description || base?.description || '',
      skills: Array.isArray(detail?.skills) ? [...detail.skills] : [],
      avatar: detail?.avatar || base?.avatar || '',
    }
    const avatar = seed.avatar || suggestExpertAvatarKey(seed)
    state.expertEditor = {
      mode,
      sourceId: base?.id || '',
      source: base?.source || detail?.source || detail?.provenance?.source || '',
      id: seed.id,
      name: seed.name,
      description: seed.description,
      soul: detail?.soul || '',
      sop: detail?.sop || detail?.systemPrompt || '',
      agenticType: detail?.agenticType || 'react',
      agenticConfig: detail?.agenticConfig && typeof detail.agenticConfig === 'object' ? { ...detail.agenticConfig } : {},
      systemPrompt: detail?.systemPrompt || '',
      skills: seed.skills,
      connectors: Array.isArray(detail?.connectors) ? [...detail.connectors] : [],
      knowledgeRefs: Array.isArray(profile?.knowledgeRefs) ? [...profile.knowledgeRefs] : [],
      avatar,
      avatarManual: !!seed.avatar,
      detail,
      profile,
    }
    renderExpertEditorForm()
    if (el.expertDialog) el.expertDialog.hidden = false
  }

  function syncExpertAvatarSelection(avatarId, { manual = true } = {}) {
    const editor = state.expertEditor
    if (!editor || !avatarId) return
    editor.avatar = avatarId
    editor.avatarManual = manual
    el.expertDialogBody?.querySelectorAll('[data-avatar-id]').forEach(btn => {
      const on = btn.dataset.avatarId === avatarId
      btn.classList.toggle('selected', on)
      btn.setAttribute('aria-checked', on ? 'true' : 'false')
    })
  }

  function autoMatchExpertAvatar() {
    const body = el.expertDialogBody
    const editor = state.expertEditor
    if (!body || !editor) return
    const key = suggestExpertAvatarKey({
      id: body.querySelector('#hubExpertId')?.value || editor.id,
      name: body.querySelector('#hubExpertName')?.value || editor.name,
      description: body.querySelector('#hubExpertDescription')?.value || editor.description,
      skills: [...body.querySelectorAll('input[name="hub-expert-skill"]:checked')].map(input => input.value),
    })
    syncExpertAvatarSelection(key, { manual: false })
  }

  function closeHubSelects(except) {
    el.expertDialogBody?.querySelectorAll('[data-hub-select]').forEach(select => {
      if (except && select === except) return
      select.classList.remove('open')
      const menu = select.querySelector('.hub-select-menu')
      const trigger = select.querySelector('.hub-select-trigger')
      if (menu) menu.hidden = true
      trigger?.setAttribute('aria-expanded', 'false')
    })
  }

  function chooseHubSelectOption(select, value) {
    if (!select || value == null) return
    const hidden = select.querySelector('input[type="hidden"]')
    const label = select.querySelector('[data-select-label]')
    const opt = AGENTIC_TYPE_OPTIONS.find(item => item.id === value)
    if (hidden) {
      hidden.value = value
      hidden.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (label && opt) label.textContent = opt.label
    select.querySelectorAll('[data-select-value]').forEach(btn => {
      const on = btn.dataset.selectValue === value
      btn.classList.toggle('selected', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    closeHubSelects()
  }

  function closeExpertEditor() {
    closeCatalogPicker()
    closeHubSelects()
    state.expertEditor = null
    if (el.expertDialog) el.expertDialog.hidden = true
    if (el.expertDelete) el.expertDelete.hidden = true
  }

  async function deleteExpertEditor() {
    const editor = state.expertEditor
    if (!canDeleteEditedExpert(editor)) {
      toast('仅自建专家可删除', 'error')
      return
    }
    const id = String(editor.sourceId || editor.id || '').trim()
    if (!id) {
      toast('缺少专家 ID', 'error')
      return
    }
    const item = resolveEditorExpertItem(editor)
    const name = String(
      el.expertDialogBody?.querySelector('#hubExpertName')?.value
      || editor.name
      || item?.name
      || id,
    ).trim() || id
    const confirmed = await askConfirm({
      kicker: 'Delete',
      title: '删除专家？',
      description: `永久删除「${name}」？此操作不可恢复。`,
      tone: 'danger',
      facts: [
        { label: '专家', value: name },
        { label: 'ID', value: id },
        { label: '影响', value: '本机专家包、目录登记与工作台绑定将被移除', tone: 'danger' },
      ],
      notes: [
        '对话历史不会被此操作清空，但已绑定该专家的工作台卡片会消失。',
        '精选包不受影响；如需官方专家请从精选重新复制。',
      ],
      confirmLabel: '删除专家',
      cancelLabel: '取消',
    })
    if (!confirmed) return

    const { expert, api, cap } = getBridge()
    const deleteFn = expert?.delete || api?.expertDelete
    const uninstallFn = cap?.uninstall || api?.capabilityUninstall
    try {
      if (deleteFn) {
        assertBridgeResult(await deleteFn({ id, source: item?.source || 'custom' }), '删除专家失败')
      } else if (uninstallFn) {
        assertBridgeResult(await uninstallFn({ id }), '删除专家失败')
      } else {
        toast('专家删除暂不可用', 'error')
        return
      }
      if (api?.agentProfileList && api?.agentProfileRemove) {
        try {
          const profileResult = await api.agentProfileList(id)
          for (const profile of profileResult?.profiles || []) {
            if (profile?.id) await api.agentProfileRemove(profile.id)
          }
        } catch {
          /* profile cleanup best-effort */
        }
      }
      state.workbenchExpertIds?.delete?.(id)
      if (state.selected?.id === id) {
        state.selected = null
        if (el.drawer) el.drawer.hidden = true
      }
      closeExpertEditor()
      try {
        window.parent.postMessage({ type: 'capability-hub-expert-uninstalled', expertId: id }, '*')
      } catch { /* ignore */ }
      await loadCatalog()
      toast('专家已删除', 'success')
    } catch (e) {
      toast(e?.message || '删除专家失败', 'error')
    }
  }

  async function saveExpertEditor() {
    const editor = state.expertEditor
    if (!editor) return
    const { expert, api } = getBridge()
    const saveFn = expert?.save || api?.expertSave
    if (!saveFn) {
      toast('专家保存暂不可用', 'error')
      return
    }
    const body = el.expertDialogBody
    const id = String(body?.querySelector('#hubExpertId')?.value || '').trim()
    const name = String(body?.querySelector('#hubExpertName')?.value || '').trim()
    if (!id || !name) {
      markExpertFieldInvalid(id ? 'name' : 'id')
      toast('请填写专家 ID 与名称', 'error')
      return
    }
    const checked = (selector) => [...(body?.querySelectorAll(selector) || [])].filter(input => input.checked).map(input => input.value)
    const skills = checked('input[name="hub-expert-skill"]')
    const description = body?.querySelector('#hubExpertDescription')?.value || ''
    const soul = String(body?.querySelector('#hubExpertSoul')?.value || '').trim()
    const sop = String(body?.querySelector('#hubExpertSop')?.value || '').trim()
    const agenticType = String(body?.querySelector('#hubExpertAgenticType')?.value || 'react').trim()
    const agenticConfig = readAgenticConfigFromForm(agenticType)
    if (!soul && !sop) {
      toast('请至少填写 Soul 或 SOP', 'error')
      return
    }
    const avatar = String(editor.avatar || '').trim()
      || suggestExpertAvatarKey({ id, name, description, skills })
    const payload = {
      id,
      name,
      description,
      soul,
      sop,
      agenticType,
      agenticConfig,
      systemPrompt: sop || soul,
      avatar,
      skills,
      connectors: checked('input[name="hub-expert-connector"]'),
      source: 'local',
    }
    try {
      const saved = assertBridgeResult(await saveFn(payload), '保存专家失败')
      if (api?.agentProfileSave) {
        const profile = editor.profile || {}
        await api.agentProfileSave({
          profile: {
            ...profile,
            id: profile.id || `${id}-default`,
            agentId: id,
            name: `${name} 默认设置`,
            roleOverlay: profile.roleOverlay || name,
            promptOverlay: profile.promptOverlay || '',
            skillRefs: payload.skills,
            connectorRefs: payload.connectors,
            knowledgeRefs: editor.knowledgeRefs || checked('input[name="hub-expert-knowledge"]'),
            knowledgePolicy: profile.knowledgePolicy || { mode: 'selected', includeWorkMemory: false },
            provenance: { ...(profile.provenance || {}), scope: 'default-agent', source: 'capability-hub' },
          },
        })
      }
      closeExpertEditor()
      if (state.tab === 'experts') state.category = MINE_EXPERT_CATEGORY
      await loadCatalog()
      toast(saved?.contentHash ? '专家已保存' : '专家已保存')
      if (state.tab === 'experts') openDrawer(id)
    } catch (e) {
      toast(e?.message || '保存专家失败', 'error')
    }
  }

  function filteredItems() {
    const q = state.query.trim().toLowerCase()
    return state.items.filter(it => {
      if (state.installedOnly && !['installed', 'enabled', 'disabled'].includes(it.status)) return false
      if (!matchesCategoryFilter(it)) return false
      if (!q) return true
      const hay = [it.name, it.originName, it.id, it.description, it.category, ...(it.tags || [])].join(' ').toLowerCase()
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
    if (el.catalogTitle) {
      el.catalogTitle.textContent = isMineFilterActive()
        ? '我创建的专家'
        : (state.query || state.installedOnly || state.category !== '全部' ? '筛选结果' : copy.catalog)
    }
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
    if (!items.length || state.query || state.installedOnly || isMineFilterActive()) {
      el.featured.classList.remove('visible')
      el.featuredRow.innerHTML = ''
      return
    }
    el.featured.classList.add('visible')
    el.featuredRow.innerHTML = items.map((it, index) => `
      <article class="hub-featured-card${it.favorite ? ' is-fav' : ''}" data-id="${esc(it.id)}" tabindex="0" style="--index:${index}">
        ${favoriteButtonHtml(it)}
        ${expertAvatarMark(it, 'hub-featured-icon')}
        <strong>${esc(it.name)}</strong>
        <span>${esc(it.description)}</span>
        <div class="hub-featured-meta">${esc(it.category)} · v${esc(it.version)}</div>
        <div class="hub-featured-arrow" aria-hidden="true"><span class="ico" data-icon="chevronRight"></span></div>
      </article>`).join('')
    if (window.StickyIcons) StickyIcons.mount(el.featuredRow)
  }

  /** 原始标识：与展示名不同时才露出，用于回溯来源包并支持按 slug 搜索 */
  function originLabel(it) {
    const origin = String(it?.originName || '').trim()
    return origin && origin !== String(it?.name || '').trim() ? origin : ''
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

  /** 「我的」列表首位：虚线创建专家卡片（替代搜索栏新建按钮） */
  function createExpertCardHtml(index = 0) {
    return `<article class="hub-card hub-card-create" id="hubCreateExpertCard" data-create-expert tabindex="0" role="button" aria-label="创建专家" style="--index:${index}">
        <div class="hub-card-create-inner">
          <span class="hub-card-create-icon" aria-hidden="true"><span class="ico" data-icon="plusLine"></span></span>
          <strong>创建专家</strong>
        </div>
      </article>`
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
    // 「我的」无结果且未二次筛选：只展示创建卡片，避免再叠空状态主按钮
    if (!items.length && isMineFilterActive() && !state.query && !state.installedOnly && !state.offline) {
      el.grid.innerHTML = createExpertCardHtml(0)
      if (window.StickyIcons) StickyIcons.mount(el.grid)
      return
    }
    if (!items.length) {
      const copy = TAB_COPY[state.tab] || TAB_COPY.experts
      const filtered = state.query || state.installedOnly || state.category !== '全部'
      const offlineHint = state.offline
        ? '当前无法连接能力服务，请检查连接后重试。'
        : (isMineFilterActive()
          ? '还没有匹配的自建专家。可改关键词，或点「创建专家」新建。'
          : copy.empty)
      const expertEmpty = state.tab === 'experts' && (!filtered || isMineFilterActive())
        ? (isMineFilterActive()
          ? '<button type="button" class="hub-btn primary" id="hubEmptyAddExpert">创建专家</button>'
          : '<button type="button" class="hub-btn primary" id="hubEmptyAddExpert">新建专家</button>')
        : '<button type="button" class="hub-btn primary" id="hubEmptyAdd">添加能力</button>'
      const emptyTitle = isMineFilterActive()
        ? '没有匹配的专家'
        : (filtered ? '没有找到匹配能力' : `还没有${copy.title}`)
      el.grid.innerHTML = `<div class="hub-state${state.offline ? ' offline' : ''}"><div class="hub-state-icon"><span class="ico" data-icon="${filtered && !isMineFilterActive() ? 'searchLine' : TAB_ICONS[TAB_KIND[state.tab]]}"></span></div><strong>${emptyTitle}</strong><p>${esc(offlineHint)}</p><div class="hub-state-actions">${filtered && !isMineFilterActive() ? '<button type="button" class="hub-btn" data-clear-filters>清除筛选</button>' : ''}${expertEmpty}</div></div>`
      if (window.StickyIcons) StickyIcons.mount(el.grid)
      return
    }
    const offset = isMineFilterActive() ? 1 : 0
    const createCard = isMineFilterActive() ? createExpertCardHtml(0) : ''
    el.grid.innerHTML = createCard + items.map((it, index) => `
      <article class="hub-card${it.favorite ? ' is-fav' : ''}" data-id="${esc(it.id)}" tabindex="0" style="--index:${index + offset}">
        ${favoriteButtonHtml(it)}
        <div class="hub-card-head">
          ${expertAvatarMark(it, 'hub-card-icon')}
          <div class="hub-card-meta">
            <div class="hub-card-title">${esc(it.name)}</div>
            <div class="hub-card-sub">${esc(it.category)} · ${esc(sourceLabel(it.source))}${originLabel(it) ? ` · ${esc(originLabel(it))}` : ''}</div>
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
    renderAddButton()
  }

  function renderAddButton() {
    const btn = document.getElementById('hubBtnAdd')
    if (!btn) return
    // 专家：新建入口改到「我的」列表创建卡片，搜索栏不再显示「新建专家」
    const isExpert = state.tab === 'experts'
    btn.hidden = isExpert
    if (isExpert) return
    const labelEl = btn.querySelector('span:last-child')
    if (labelEl) labelEl.textContent = '添加能力'
    btn.setAttribute('aria-label', '添加能力')
    btn.title = '导入技能 / 连接器等能力'
  }

  function renderDrawer() {
    const it = state.selected
    if (!it) {
      el.drawer.classList.remove('open')
      el.drawerBackdrop.classList.remove('open')
      el.drawer.setAttribute('aria-hidden', 'true')
      el.drawerBackdrop.setAttribute('aria-hidden', 'true')
      if (el.drawerActions) el.drawerActions.innerHTML = ''
      return
    }
    el.drawer.classList.add('open')
    el.drawerBackdrop.classList.add('open')
    el.drawer.setAttribute('aria-hidden', 'false')
    el.drawerBackdrop.setAttribute('aria-hidden', 'false')
    el.drawerTitle.textContent = it.name
    const installed = ['installed', 'enabled', 'disabled'].includes(it.status)
    const expertStarting = it.kind === 'expert' && state.startingExpertId === it.id
    const expertAdding = it.kind === 'expert' && state.addingExpertId === it.id
    const expertInWorkbench = it.kind === 'expert' && state.workbenchExpertIds.has(it.id)
    const skillTrying = it.kind === 'skill' && state.tryingSkillId === it.id
    const expertCta = !installed
      ? '安装并开始'
      : (it.enabled ? '开始对话' : '启用并开始')
    const deps = (it.dependencies || []).length
      ? `<ul>${it.dependencies.map(d => {
        const dep = typeof d === 'string' ? { id: d, required: true } : d
        return `<li><strong>${esc(dep.id || '未知依赖')}</strong>${dep.kind ? ` · ${esc(dep.kind)}` : ''}${dep.required === false ? ' · 可选' : ' · 必需'}</li>`
      }).join('')}</ul>`
      : '<p>无依赖</p>'
    const permissionRows = Object.entries(it.permissions || {})
      .map(([key, value]) => `<li><strong>${esc(key)}</strong>：${esc(typeof value === 'string' ? value : JSON.stringify(value))}</li>`)
      .join('')
    const renderIo = (items) => items.length
      ? `<ul>${items.map(item => {
        const value = typeof item === 'string' ? item : `${item.name || item.id || item.type || '未命名'}${item.type ? ` · ${item.type}` : ''}`
        return `<li>${esc(value)}</li>`
      }).join('')}</ul>`
      : '<p>未声明</p>'
    const riskLevel = String(it.risk?.level || 'low')
    const riskReasons = Array.isArray(it.risk?.reasons) ? it.risk.reasons : []
    const provenance = it.provenance || {}
    const isLegacySkill = it.kind === 'skill' && (it.legacy || it.source === 'legacy-okf')
    el.drawerBody.innerHTML = `
      <div class="hub-drawer-hero">
        ${expertAvatarMark(it, 'hub-card-icon', 80)}
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
          ${originLabel(it) ? `<dt>原始标识</dt><dd>${esc(originLabel(it))}</dd>` : ''}
          ${it.sourceAvailable ? '' : '<dt>仓库</dt><dd>来源路径不可用，请重新导入或卸载</dd>'}
          ${it.contentHash ? `<dt>Hash</dt><dd>${esc(it.contentHash.slice(0, 12))}…</dd>` : ''}
          ${it.installedAt ? `<dt>安装于</dt><dd>${esc(it.installedAt)}</dd>` : ''}
        </dl>
      </div>
      ${it.kind === 'skill' ? skillTaskSection(it) : ''}
      ${it.kind === 'expert' ? expertCompositionSection(it, installed) : ''}
      ${it.kind === 'skill' ? skillUsageSection(it) : ''}
      <div class="hub-drawer-section"><h3>依赖</h3>${deps}</div>
      <div class="hub-drawer-section"><h3>权限</h3>${permissionRows ? `<ul>${permissionRows}</ul>` : '<p>未声明额外权限</p>'}</div>
      <div class="hub-drawer-section"><h3>输入 / 输出</h3>
        <h4>输入</h4>${renderIo(it.inputs || [])}
        <h4>输出</h4>${renderIo(it.outputs || [])}
      </div>
      <div class="hub-drawer-section"><h3>风险与来源</h3>
        <dl class="hub-kv">
          <dt>风险等级</dt><dd>${esc(riskLevel)}</dd>
          ${riskReasons.length ? `<dt>风险依据</dt><dd>${esc(riskReasons.join('；'))}</dd>` : ''}
          <dt>来源证据</dt><dd>${esc(provenance.ref || provenance.source || sourceLabel(it.source))}</dd>
          ${provenance.trust ? `<dt>信任状态</dt><dd>${esc(provenance.trust)}</dd>` : ''}
          ${provenance.adaptedFrom ? `<dt>兼容适配</dt><dd>${esc(provenance.adaptedFrom)}</dd>` : ''}
        </dl>
      </div>
      ${it.kind === 'connector' && installed ? '<div class="hub-drawer-section" id="hubConnectorExtras"><p class="hub-muted">正在加载连接器状态…</p></div>' : ''}
      ${installed ? `<div class="hub-drawer-section"><div class="hub-toggle-row"><label for="hubEnableToggle">在新会话中使用</label><label class="hub-filter-toggle"><input type="checkbox" id="hubEnableToggle"${it.enabled ? ' checked' : ''}><span class="hub-toggle-track" aria-hidden="true"><span></span></span><span>${it.enabled ? '已启用' : '已停用'}</span></label></div></div>` : ''}`
    const isCurated = isCuratedExpert(it)
    const canEdit = it.kind === 'expert' && (isLocalExpert(it) || ['installed', 'enabled', 'disabled'].includes(it.status))
    if (el.drawerActions) {
      const copyBtn = isCurated ? '<button type="button" class="hub-btn" data-act="copyExpert">复制为自建</button>' : ''
      const editBtn = canEdit && !isCurated ? '<button type="button" class="hub-btn" data-act="editExpert">编辑</button>' : ''
      // 专家本体不提供更新/卸载：只做工作台绑定/撤回与编辑
      // workbench 深链：仅「开始对话」；能力界面：绑定 ↔ 撤回 / 复制 / 编辑
      const expertActions = it.kind !== 'expert'
        ? ''
        : (state.surface === 'workbench'
          ? `<button type="button" class="hub-btn primary" data-act="startExpert"${expertStarting || expertAdding ? ' disabled aria-busy="true"' : ''}>${expertStarting ? '正在打开…' : expertCta}</button>`
          : `${expertInWorkbench
            ? `<button type="button" class="hub-btn" data-act="removeExpert"${expertAdding ? ' disabled aria-busy="true"' : ''}>${expertAdding ? '正在撤回…' : '工作台撤回'}</button>`
            : `<button type="button" class="hub-btn primary" data-act="addExpert"${expertStarting || expertAdding ? ' disabled' : ''}${expertAdding ? ' aria-busy="true"' : ''}>${expertAdding ? '正在添加…' : '添加到工作台'}</button>`}
       ${copyBtn}
       ${editBtn}`)
      el.drawerActions.innerHTML = `
        ${expertActions || `${it.kind === 'skill'
      ? `<button type="button" class="hub-btn primary" data-act="trySkill"${skillTrying ? ' disabled aria-busy="true"' : ''}>${skillTrying ? '正在打开…' : (installed ? '试用' : '安装并试用')}</button>`
      : ''}
       ${installed
    ? `<button type="button" class="hub-btn" data-act="update">更新</button>
           <button type="button" class="hub-btn" data-act="uninstall">卸载</button>`
    : `<button type="button" class="hub-btn${it.kind === 'skill' ? '' : ' primary'}" data-act="install">安装</button>`}`}
        ${isLegacySkill ? '<button type="button" class="hub-btn" data-act="migrateLegacy">迁移为标准技能</button>' : ''}`
    }
    if (window.StickyIcons) {
      StickyIcons.mount(el.drawerBody)
      StickyIcons.mount(el.drawerActions)
    }
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
      const isPlaywright = /playwright/i.test(String(it.id || it.name || '')) || /playwright/i.test(String(preview?.serverName || ''))
      const healthRed = /error|fail|red|offline|missing/i.test(String(healthState))
      const playwrightInstall = isPlaywright && healthRed
        ? `<p class="hub-playwright-install">Playwright MCP 未就绪。<a href="https://www.npmjs.com/package/@playwright/mcp" target="_blank" rel="noopener" data-hub-open-url="https://www.npmjs.com/package/@playwright/mcp">查看安装指引</a></p>`
        : ''
      const tools = Array.isArray(preview?.tools) ? preview.tools : []
      const allowlist = Array.isArray(preview?.allowlist) ? preview.allowlist : (it.allowlist || [])
      const toolLines = tools.length
        ? `<ul class="hub-tool-list">${tools.slice(0, 12).map(t => `<li><code>${esc(t.projectedName || t.rawName || t.name || '')}</code></li>`).join('')}${tools.length > 12 ? `<li>…共 ${tools.length} 个工具</li>` : ''}</ul>`
        : '<p class="hub-muted">暂无工具预览（未连接或未配置 MCP）</p>'
      host.innerHTML = `
        <h3>连接器状态</h3>
        <p>健康：<strong>${esc(String(healthState))}</strong>${health?.toolsCount != null ? ` · 工具 ${esc(String(health.toolsCount))}` : ''}</p>
        ${playwrightInstall}
        <h3>工具预览</h3>${toolLines}
        <h3>Allowlist</h3>
        <textarea id="hubAllowlistInput" rows="3" placeholder="逗号分隔工具名">${esc(allowlist.join(', '))}</textarea>
        <div class="hub-inline-actions"><button type="button" class="hub-btn" id="hubAllowlistSave">保存 Allowlist</button></div>`
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
    // detail 叠层：壳层被 CSS 隐藏，仍强制维持 class，防止中间态露出完整目录
    if (state.presentation === 'detail') {
      document.body.classList.add('hub-detail-only')
    }
    renderTabs()
    renderPageMeta()
    renderChips()
    renderFeatured()
    renderGrid()
    renderDrawer()
    maybeArmExpertCardEnter()
  }

  function scheduleSearchRender() {
    clearTimeout(searchRenderTimer)
    searchRenderTimer = setTimeout(() => {
      searchRenderTimer = null
      renderPageMeta()
      renderFeatured()
      renderGrid()
      maybeArmExpertCardEnter()
    }, SEARCH_DEBOUNCE_MS)
  }

  function setTab(tab) {
    if (tab !== 'experts' && tab !== 'skills' && tab !== 'connectors') return
    state.tab = tab
    state.category = '全部'
    state.selected = null
    notifyParentTab(tab)
    loadCatalog()
  }

  const KIND_TAB = { expert: 'experts', skill: 'skills', connector: 'connectors' }

  async function gotoCapability(kind, id) {
    const tab = KIND_TAB[String(kind || '')]
    const targetId = String(id || '').trim()
    if (!tab || !targetId) return
    if (state.tab !== tab) {
      state.tab = tab
      state.category = '全部'
      state.query = ''
      state.installedOnly = false
      if (el.search) el.search.value = ''
      if (el.installedOnly) el.installedOnly.checked = false
      state.selected = null
      notifyParentTab(tab)
      await loadCatalog()
    }
    if (!state.items.some(item => item.id === targetId)) {
      toast('这项能力不在当前目录中，可能已被移除', 'error')
      return
    }
    openDrawer(targetId)
  }

  function openDrawer(id) {
    drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    state.selected = state.items.find(it => it.id === id) || null
    renderDrawer()
    if (state.selected) requestAnimationFrame(() => el.drawerClose?.focus())
  }

  function closeDrawer() {
    const returnFocus = drawerReturnFocus
    drawerReturnFocus = null
    const dismissDetail = state.presentation === 'detail'
    state.selected = null
    if (dismissDetail) {
      // presentation=detail 下关详情 = 离场，不先切到 hub 目录页（否则叠层未关时会「跳」出整页专家库）
      dismissDetailOverlay()
      return
    }
    renderDrawer()
    if (returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus())
  }

  async function toggleFavoriteFromButton(btn) {
    const id = String(btn?.dataset?.favId || '').trim()
    const kind = String(btn?.dataset?.favKind || 'skill').trim() || 'skill'
    if (!id) return
    const { cap, api } = getBridge()
    const fn = cap?.favoriteToggle || api?.capabilityFavoriteToggle
    if (typeof fn !== 'function') {
      toast('收藏功能暂不可用', 'error')
      return
    }
    try {
      const result = assertBridgeResult(await fn({ id, kind }), '收藏失败')
      const next = result.favorite === true
      const item = state.items.find((it) => it.id === id && it.kind === kind)
      if (item) item.favorite = next
      if (state.selected?.id === id && state.selected?.kind === kind) state.selected.favorite = next
      renderPageMeta()
      renderChips()
      renderFeatured()
      renderGrid()
      maybeArmExpertCardEnter()
      if (state.selected) renderDrawer()
      toast(next ? '已收藏' : '已取消收藏')
    } catch (error) {
      toast(error?.message || '收藏失败', 'error')
    }
  }

  async function runAction(act, options = {}) {
    const it = state.selected
    if (!it) return
    const { cap, api } = getBridge()
    if (['startExpert', 'addExpert', 'removeExpert'].includes(act) && (state.startingExpertId || state.addingExpertId)) return
    if (act === 'trySkill' && state.tryingSkillId) return
    let capabilityPrepared = false
    const confirmInstallPrecheck = async () => {
      const fn = cap?.installPrecheck || api?.capabilityInstallPrecheck
      if (typeof fn !== 'function') return true
      const result = assertBridgeResult(await fn({ id: it.id }), '预检失败')
      const preview = result?.preview || {}
      const issues = Array.isArray(preview.dependencies?.requiredIssues) ? preview.dependencies.requiredIssues : []
      if (issues.length) {
        toast(issues[0]?.message || '依赖不满足，无法安装', 'error')
        return false
      }
      const risks = Array.isArray(preview.risk?.reasons) ? preview.risk.reasons : []
      const blocked = preview.compatibility?.status === 'blocked'
      const accepted = await askConfirm({
        kicker: 'Precheck',
        title: '安装前预检',
        description: '确认下面的检查结果后再继续安装。',
        facts: [
          { label: '能力', value: preview.name || it.name },
          { label: '风险', value: precheckRiskLabel(preview.risk?.level), tone: riskTone(preview.risk?.level) },
          { label: '兼容性', value: blocked ? (preview.compatibility?.reason || '不可安装') : '可安装', tone: blocked ? 'danger' : '' },
          preview.estimatedCost ? { label: '成本', value: precheckCostLabel(preview.estimatedCost) } : null,
        ],
        notes: risks.slice(0, 4),
        tone: blocked ? 'danger' : riskTone(preview.risk?.level),
        confirmLabel: '继续安装',
      })
      return accepted === true
    }
    try {
      if (act === 'editExpert' || act === 'tuneExpert') {
        closeDrawer()
        await openExpertEditor('tune', it)
        return
      }
      if (act === 'copyExpert') {
        closeDrawer()
        await openExpertEditor('copy', it)
        return
      }
      if (act === 'removeExpert') {
        state.addingExpertId = it.id
        renderDrawer()
        const result = await requestWorkbenchRemove(it.id)
        state.workbenchExpertIds.delete(it.id)
        toast(`已从${result.modeName || '当前工作台'}撤回“${it.name}”`)
      } else if (act === 'startExpert' || act === 'addExpert') {
        if (act === 'startExpert') state.startingExpertId = it.id
        else state.addingExpertId = it.id
        renderDrawer()
        if (!['installed', 'enabled', 'disabled'].includes(it.status)) {
          const precheckOk = await confirmInstallPrecheck()
          if (!precheckOk) return
          const fn = cap?.install || api?.capabilityInstall
          const requiresRiskConfirmation = ['high', 'critical'].includes(it.risk?.level)
          const riskConfirmed = requiresRiskConfirmation
            ? await confirmRiskyCapability(it, act === 'startExpert' ? '安装并开始使用' : '安装并添加到工作台') === true
            : false
          if (requiresRiskConfirmation && !riskConfirmed) return
          if (fn) assertBridgeResult(await fn({ id: it.id, kind: it.kind, riskConfirmed }), '安装专家失败')
          it.status = 'installed'
          it.enabled = true
          capabilityPrepared = true
        } else if (!it.enabled) {
          const fn = cap?.enable || api?.capabilityEnable
          if (fn) assertBridgeResult(await fn({ id: it.id }), '启用专家失败')
          it.status = 'enabled'
          it.enabled = true
          capabilityPrepared = true
        }
        if (act === 'startExpert') {
          await requestExpertStart(it.id)
          if (state.presentation === 'detail') {
            state.selected = null
            dismissDetailOverlay()
            return
          }
        } else {
          const result = await requestWorkbenchAdd(it.id)
          state.workbenchExpertIds.add(it.id)
          toast(result.alreadyBound
            ? `“${it.name}”已在${result.modeName || '当前工作台'}`
            : `已将“${it.name}”添加到${result.modeName || '当前工作台'}`)
        }
      } else if (act === 'trySkill') {
        state.tryingSkillId = it.id
        renderDrawer()
        if (!['installed', 'enabled', 'disabled'].includes(it.status)) {
          const precheckOk = await confirmInstallPrecheck()
          if (!precheckOk) return
          const fn = cap?.install || api?.capabilityInstall
          const requiresRiskConfirmation = ['high', 'critical'].includes(it.risk?.level)
          const riskConfirmed = requiresRiskConfirmation
            ? await confirmRiskyCapability(it, '安装并试用') === true
            : false
          if (requiresRiskConfirmation && !riskConfirmed) return
          if (fn) assertBridgeResult(await fn({ id: it.id, kind: it.kind, riskConfirmed }), '安装技能失败')
          it.status = 'installed'
          it.enabled = true
          capabilityPrepared = true
          await loadCompositionIndex()
        } else if (!it.enabled) {
          const fn = cap?.enable || api?.capabilityEnable
          if (fn) assertBridgeResult(await fn({ id: it.id }), '启用技能失败')
          it.status = 'enabled'
          it.enabled = true
          capabilityPrepared = true
          await loadCompositionIndex()
        }
        const tasks = tasksForSkill(it.id)
        const task = (options.taskId ? tasks.find(item => item.id === options.taskId) : tasks[0]) || null
        await requestSkillStart({
          skillId: it.id,
          // 预填而不直接发送：任务提示词是模板，用户通常还要补上自己的具体上下文。
          prompt: String(task?.prompt || '').trim() || `请用「${it.name}」帮我：`,
          title: task?.title || it.name,
        })
        if (task?.preflight?.connector) {
          toast(`这项任务需要先授权「${task.preflight.connector}」，未授权会执行失败`, 'error')
        }
      } else if (act === 'install') {
        const precheckOk = await confirmInstallPrecheck()
        if (!precheckOk) return
        const fn = cap?.install || api?.capabilityInstall
        const requiresRiskConfirmation = ['high', 'critical'].includes(it.risk?.level)
        const riskConfirmed = requiresRiskConfirmation
          ? await confirmRiskyCapability(it, '安装') === true
          : false
        if (requiresRiskConfirmation && !riskConfirmed) return
        if (fn) assertBridgeResult(await fn({ id: it.id, kind: it.kind, riskConfirmed }))
        else { it.status = 'installed'; it.enabled = true }
        toast('已安装')
      } else if (act === 'uninstall') {
        const fn = cap?.uninstall || api?.capabilityUninstall
        if (fn) await fn({ id: it.id })
        else state.items = state.items.filter(x => x.id !== it.id)
        // 通知宿主刷新工作台绑定，立即去掉快捷任务中的幽灵专家卡
        if (it.kind === 'expert') {
          try {
            window.parent.postMessage({ type: 'capability-hub-expert-uninstalled', expertId: it.id }, '*')
          } catch { /* Hub 可能已独立窗口 */ }
        }
        closeDrawer()
        toast('已卸载')
      } else if (act === 'update') {
        const fn = cap?.update || api?.capabilityUpdate
        if (fn) await fn({ id: it.id })
        toast('已更新')
      } else if (act === 'migrateLegacy') {
        const { skill } = getBridge()
        const targetId = await askConfirm({
          kicker: 'Migrate',
          title: '迁移为标准技能',
          description: `把“${it.name}”导出为标准 SKILL.md。`,
          input: {
            label: '新标准技能 ID',
            value: `${it.id}-skill`,
            placeholder: 'my-skill',
            hint: '留空则自动生成。原技能不会被删除。',
          },
          confirmLabel: '开始迁移',
        })
        if (targetId === null) return
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
      if (capabilityPrepared) {
        await loadCatalog()
        openDrawer(it.id)
      }
      toast(e?.message || '操作失败', 'error')
    } finally {
      if (act === 'startExpert' || act === 'addExpert' || act === 'removeExpert' || act === 'trySkill') {
        state.startingExpertId = ''
        state.addingExpertId = ''
        state.tryingSkillId = ''
        if (state.selected?.id === it.id) renderDrawer()
      }
    }
  }

  async function toggleEnabled(enabled) {
    const it = state.selected
    if (!it) return
    const { cap, api } = getBridge()
    try {
      const fn = enabled ? (cap?.enable || api?.capabilityEnable) : (cap?.disable || api?.capabilityDisable)
      const requiresRiskConfirmation = enabled && ['high', 'critical'].includes(it.risk?.level)
      const riskConfirmed = requiresRiskConfirmation
        ? await confirmRiskyCapability(it, '启用') === true
        : false
      if (requiresRiskConfirmation && !riskConfirmed) {
        renderDrawer()
        return
      }
      if (fn) assertBridgeResult(await fn({ id: it.id, riskConfirmed }))
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
    state.importPrecheck = null
    state.pendingImportPayload = null
    renderRepoPreview()
    renderImportPrecheck()
    syncAddPanels()
    el.addDialog.hidden = false
  }

  function closeAddDialog() {
    state.pendingImportPayload = null
    state.importPrecheck = null
    renderImportPrecheck()
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
      const hasLocalSelection = (state.addMode === 'local' || state.addMode === 'zip')
        ? Boolean(state.pendingImportPayload?.path)
        : true
      const blockedByPrecheck = state.importPrecheck?.compatibility?.status === 'blocked'
      el.addConfirm.hidden = false
      el.addConfirm.disabled = (state.addMode === 'cursor-repo' && !state.repoPreview) || !hasLocalSelection || blockedByPrecheck
      el.addConfirm.textContent = state.addMode === 'cursor-repo' ? '确认注册' : '确认导入'
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

  function precheckRiskLabel(level) {
    const key = String(level || 'low').toLowerCase()
    if (key === 'critical') return '高风险（关键）'
    if (key === 'high') return '高风险'
    if (key === 'medium') return '中风险'
    return '低风险'
  }

  function riskTone(level) {
    const key = String(level || 'low').toLowerCase()
    if (key === 'critical' || key === 'high') return 'danger'
    if (key === 'medium') return 'warn'
    return ''
  }

  function confirmRiskyCapability(it, actionLabel) {
    return askConfirm({
      kicker: 'Risk',
      title: `“${it.name}”被标记为高风险能力`,
      description: `确认后才会${actionLabel}。`,
      facts: [{ label: '风险等级', value: precheckRiskLabel(it.risk?.level), tone: riskTone(it.risk?.level) }],
      notes: (it.risk?.reasons || []).slice(0, 4).length
        ? it.risk.reasons.slice(0, 4)
        : ['它可能访问敏感系统或执行高影响操作。'],
      tone: 'danger',
      confirmLabel: `确认${actionLabel}`,
    })
  }

  function precheckCostLabel(cost = {}) {
    if (!cost || typeof cost !== 'object') return '预计较低'
    return `${cost.estimate || '预计较低'}（${cost.level || 'low'}）`
  }

  function renderImportPrecheck() {
    if (!el.importPrecheck) return
    const preview = state.importPrecheck
    if (!preview || typeof preview !== 'object') {
      el.importPrecheck.hidden = true
      el.importPrecheck.innerHTML = ''
      return
    }
    const dependencyIssues = Array.isArray(preview.dependencies?.requiredIssues) ? preview.dependencies.requiredIssues : []
    const dependencyWarnings = Array.isArray(preview.dependencies?.optionalWarnings) ? preview.dependencies.optionalWarnings : []
    const riskReasons = Array.isArray(preview.risk?.reasons) ? preview.risk.reasons : []
    const riskText = `${precheckRiskLabel(preview.risk?.level)}${riskReasons.length ? ` · ${riskReasons.slice(0, 2).join('；')}` : ''}`
    const trustText = preview.trust?.required
      ? '需要确认信任来源'
      : (preview.trust?.status ? String(preview.trust.status) : '已校验')
    const compatText = preview.compatibility?.status === 'blocked'
      ? `不可安装：${preview.compatibility?.reason || '依赖或协议不满足'}`
      : '兼容，可继续导入'
    const warningList = [
      ...dependencyIssues.map(item => item?.message).filter(Boolean),
      ...dependencyWarnings.map(item => item?.message).filter(Boolean),
    ].slice(0, 5)
    el.importPrecheck.hidden = false
    el.importPrecheck.innerHTML = `
      <h4>安装前预检</h4>
      <dl class="hub-import-precheck-grid">
        <dt>能力</dt><dd>${esc(preview.name || preview.id || '未命名')} (${esc(preview.kind || 'unknown')})</dd>
        <dt>版本</dt><dd>${esc(preview.version || '1.0.0')}</dd>
        <dt>来源</dt><dd>${esc(sourceLabel(preview.source))}</dd>
        <dt>信任</dt><dd>${esc(trustText)}</dd>
        <dt>风险</dt><dd>${esc(riskText)}</dd>
        <dt>兼容性</dt><dd>${esc(compatText)}</dd>
        <dt>成本</dt><dd>${esc(precheckCostLabel(preview.estimatedCost))}</dd>
      </dl>
      ${warningList.length
    ? `<ul class="hub-import-precheck-list">${warningList.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
    : '<ul class="hub-import-precheck-list safe"><li>未检测到阻断项，导入后可随时禁用或卸载。</li></ul>'}
    `
  }

  async function runImportPrecheck(payload = {}) {
    const { cap, api } = getBridge()
    const fn = cap?.importPrecheck || api?.capabilityImportPrecheck
    if (typeof fn !== 'function') {
      state.importPrecheck = null
      renderImportPrecheck()
      return { ok: true, preview: null }
    }
    const result = assertBridgeResult(await fn(payload), '预检失败')
    state.importPrecheck = result?.preview || null
    renderImportPrecheck()
    return result
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
    let nextPayload = { ...payload }
    let result = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await importFn(nextPayload)
      if (result?.needsTrust || result?.code === 'trust_required') {
        const accepted = await askConfirm({
          kicker: 'Trust',
          title: '来源需要确认信任',
          description: result.error || '这个来源尚未被标记为可信。',
          notes: ['仅在你确认来源可信时继续；导入后可随时禁用或卸载。'],
          tone: 'warn',
          confirmLabel: '信任并继续',
        })
        if (accepted !== true) return { ok: false, canceled: true }
        nextPayload = { ...nextPayload, trustConfirmed: true }
        continue
      }
      if (result?.needsRiskConfirmation || result?.code === 'risk_confirmation_required') {
        const reasons = Array.isArray(result.risk?.reasons) ? result.risk.reasons.slice(0, 4) : []
        const accepted = await askConfirm({
          kicker: 'Risk',
          title: '该能力被标记为高风险',
          description: result.error || '',
          facts: [{ label: '风险等级', value: precheckRiskLabel(result.risk?.level), tone: riskTone(result.risk?.level) }],
          notes: reasons.length ? reasons : ['它可能访问敏感系统或执行高影响操作。'],
          tone: 'danger',
          confirmLabel: '确认继续安装',
        })
        if (accepted !== true) return { ok: false, canceled: true }
        nextPayload = { ...nextPayload, riskConfirmed: true }
        continue
      }
      break
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
    const payload = state.pendingImportPayload
      ? { ...state.pendingImportPayload }
      : { source: state.addMode }
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
    if ((state.addMode === 'local' || state.addMode === 'zip') && !payload.path) {
      toast(state.addMode === 'local' ? '请先选择文件夹' : '请先选择 ZIP 文件', 'error')
      return
    }
    try {
      const precheck = await runImportPrecheck(payload)
      if (precheck?.preview?.compatibility?.status === 'blocked') {
        toast(precheck.preview.compatibility.reason || '预检未通过，无法导入', 'error')
        return
      }
      if (importFn) {
        const result = await importWithTrust(importFn, payload)
        if (result?.canceled) return
      }
      else toast('导入已记录（预览模式，待后端接入）')
      closeAddDialog()
      state.pendingImportPayload = null
      state.importPrecheck = null
      renderImportPrecheck()
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
          state.pendingImportPayload = { source: 'local', path: r.path }
          await runImportPrecheck(state.pendingImportPayload)
          syncAddPanels()
          toast('目录已选择，请确认导入')
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
          state.pendingImportPayload = { source: 'zip', path: r.path }
          await runImportPrecheck(state.pendingImportPayload)
          syncAddPanels()
          toast('ZIP 已选择，请确认导入')
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
    window.addEventListener('message', event => {
      if (event.source !== window.parent) return
      const data = event.data || {}
      if (data.type === 'capability-hub-resume') {
        resumeFromHost({
          expertId: data.expertId,
          surface: data.surface,
          tab: data.tab,
          presentation: data.presentation,
        })
        return
      }
      if (data.type === 'capability-hub-select-expert') {
        applyExpertSelection({
          expertId: data.expertId,
          surface: data.surface,
          tab: data.tab,
          presentation: data.presentation,
        })
        return
      }
      const fallbackError = PARENT_RESULT_ERRORS[data.type]
      if (!fallbackError) return
      const requestId = String(data.requestId || '')
      const pending = pendingParentRequests.get(requestId)
      if (!pending) return
      pendingParentRequests.delete(requestId)
      if (data.ok) pending.resolve(data)
      else pending.reject(new Error(data.error || fallbackError))
    })
    document.querySelectorAll('.hub-tab').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab))
    })
    el.search?.addEventListener('input', () => {
      state.query = el.search.value || ''
      scheduleSearchRender()
    })
    el.installedOnly?.addEventListener('change', () => {
      state.installedOnly = !!el.installedOnly.checked
      renderPageMeta()
      renderFeatured()
      renderGrid()
      maybeArmExpertCardEnter()
    })
    el.chips?.addEventListener('click', e => {
      const chip = e.target.closest('.hub-chip')
      if (!chip) return
      state.category = chip.dataset.cat || '全部'
      renderPageMeta()
      renderChips()
      renderFeatured()
      renderGrid()
      maybeArmExpertCardEnter()
    })
    el.grid?.addEventListener('click', e => {
      const favBtn = e.target.closest('[data-fav-id]')
      if (favBtn) {
        e.preventDefault()
        e.stopPropagation()
        void toggleFavoriteFromButton(favBtn)
        return
      }
      if (e.target.closest('[data-retry]')) { loadCatalog(); return }
      if (e.target.closest('[data-create-expert], #hubCreateExpertCard, #hubEmptyAddExpert')) {
        void openExpertEditor('create')
        return
      }
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
      const card = e.target.closest('.hub-card[data-id],[data-id]')
      const id = card?.dataset?.id
      if (id) {
        applyPresentation('hub')
        state.surface = 'capability'
        openDrawer(id)
      }
    })
    el.featuredRow?.addEventListener('click', e => {
      const favBtn = e.target.closest('[data-fav-id]')
      if (favBtn) {
        e.preventDefault()
        e.stopPropagation()
        void toggleFavoriteFromButton(favBtn)
        return
      }
      const card = e.target.closest('[data-id]')
      if (card?.dataset?.id) {
        applyPresentation('hub')
        state.surface = 'capability'
        openDrawer(card.dataset.id)
      }
    })
    el.drawerBackdrop?.addEventListener('click', closeDrawer)
    el.drawerClose?.addEventListener('click', closeDrawer)
    el.drawerActions?.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]')
      if (btn) runAction(btn.dataset.act, { taskId: btn.dataset.taskId || '' })
    })
    el.drawerBody?.addEventListener('click', e => {
      const goto = e.target.closest('[data-hub-goto]')
      if (goto) {
        void gotoCapability(goto.dataset.hubGoto, goto.dataset.hubGotoId)
        return
      }
      const link = e.target.closest('[data-hub-open-url]')
      if (link) {
        e.preventDefault()
        const url = link.dataset.hubOpenUrl || link.href
        const openFn = getBridge().api?.openExternal || window.api?.openExternal
        if (typeof openFn === 'function') openFn(url)
        else window.open(url, '_blank', 'noopener')
        return
      }
      const btn = e.target.closest('[data-act]')
      if (btn) runAction(btn.dataset.act, { taskId: btn.dataset.taskId || '' })
    })
    el.drawerBody?.addEventListener('change', e => {
      if (e.target.id === 'hubEnableToggle') toggleEnabled(!!e.target.checked)
    })
    document.getElementById('hubBtnAdd')?.addEventListener('click', () => {
      if (state.tab === 'experts') void openExpertEditor('create')
      else openAddDialog()
    })
    document.getElementById('hubBtnClose')?.addEventListener('click', closeHub)
    el.expertCancel?.addEventListener('click', closeExpertEditor)
    el.expertSave?.addEventListener('click', () => void saveExpertEditor())
    el.expertDelete?.addEventListener('click', () => void deleteExpertEditor())
    el.expertDialogBody?.addEventListener('click', e => {
      const avatarOpt = e.target.closest('[data-avatar-id]')
      if (avatarOpt) {
        syncExpertAvatarSelection(avatarOpt.dataset.avatarId, { manual: true })
        return
      }
      const emptyAction = e.target.closest('[data-picker-empty-action]')
      if (emptyAction) {
        leaveEditorForCatalogTab(emptyAction.dataset.pickerEmptyAction)
        return
      }
      const openPicker = e.target.closest('[data-open-picker]')
      if (openPicker) {
        openCatalogPicker(openPicker.dataset.openPicker)
        return
      }
      const option = e.target.closest('[data-select-value]')
      if (option) {
        chooseHubSelectOption(option.closest('[data-hub-select]'), option.dataset.selectValue)
        return
      }
      const trigger = e.target.closest('.hub-select-trigger')
      if (trigger) {
        const select = trigger.closest('[data-hub-select]')
        const willOpen = !select?.classList.contains('open')
        closeHubSelects()
        if (select && willOpen) {
          select.classList.add('open')
          const menu = select.querySelector('.hub-select-menu')
          if (menu) menu.hidden = false
          trigger.setAttribute('aria-expanded', 'true')
        }
      }
    })
    el.expertDialogBody?.addEventListener('input', e => {
      if (e.target?.id === 'hubExpertName' || e.target?.id === 'hubExpertDescription' || e.target?.id === 'hubExpertId') {
        if (!state.expertEditor?.avatarManual) autoMatchExpertAvatar()
      }
    })
    el.expertDialogBody?.addEventListener('change', e => {
      if (e.target?.id === 'hubExpertAgenticType') {
        syncExpertEditorDraftFromForm()
        renderAgenticConfigPanel()
        return
      }
      if (e.target?.type === 'checkbox') {
        updateExpertEditorSelection()
        if (!state.expertEditor?.avatarManual) autoMatchExpertAvatar()
      }
    })
    el.pickerApply?.addEventListener('click', applyCatalogPicker)
    el.pickerCancel?.addEventListener('click', closeCatalogPicker)
    document.querySelector('[data-picker-dialog-close]')?.addEventListener('click', closeCatalogPicker)
    el.pickerDialog?.addEventListener('click', e => {
      if (e.target === el.pickerDialog) closeCatalogPicker()
    })
    el.pickerBody?.addEventListener('click', e => {
      const emptyAction = e.target.closest('[data-picker-empty-action]')
      if (emptyAction) leaveEditorForCatalogTab(emptyAction.dataset.pickerEmptyAction)
    })
    document.addEventListener('click', e => {
      if (!e.target.closest?.('[data-hub-select]')) closeHubSelects()
    })
    el.confirmOk?.addEventListener('click', () => resolveConfirm(true))
    el.confirmCancel?.addEventListener('click', () => resolveConfirm(false))
    document.querySelector('[data-confirm-close]')?.addEventListener('click', () => resolveConfirm(false))
    el.confirmDialog?.addEventListener('click', e => {
      if (e.target === el.confirmDialog) resolveConfirm(false)
    })
    el.confirmBody?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target?.id === 'hubConfirmInput') {
        e.preventDefault()
        resolveConfirm(true)
      }
    })
    document.querySelector('[data-expert-dialog-close]')?.addEventListener('click', closeExpertEditor)
    document.getElementById('hubAddCancel')?.addEventListener('click', closeAddDialog)
    document.querySelector('[data-dialog-close]')?.addEventListener('click', closeAddDialog)
    document.getElementById('hubAddConfirm')?.addEventListener('click', confirmImport)
    document.getElementById('hubPickLocal')?.addEventListener('click', pickLocal)
    document.getElementById('hubPickZip')?.addEventListener('click', pickZip)
    document.getElementById('hubPickCursorRepo')?.addEventListener('click', pickCursorRepository)
    document.querySelectorAll('.hub-add-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.addMode = btn.dataset.add || 'local'
        state.importPrecheck = null
        state.pendingImportPayload = null
        renderImportPrecheck()
        syncAddPanels()
      })
    })
    document.addEventListener('keydown', e => {
      if (confirmSession && e.key === 'Escape') {
        resolveConfirm(false)
        return
      }
      if (confirmSession) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        el.search?.focus()
        el.search?.select()
        return
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-create-expert]')) {
        e.preventDefault()
        void openExpertEditor('create')
        return
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.hub-card[data-id], .hub-featured-card[data-id]')) {
        e.preventDefault()
        applyPresentation('hub')
        state.surface = 'capability'
        openDrawer(e.target.dataset.id)
        return
      }
      if (e.key === 'Escape') {
        if (el.pickerDialog && !el.pickerDialog.hidden) { closeCatalogPicker(); return }
        if (el.expertDialogBody?.querySelector('[data-hub-select].open')) { closeHubSelects(); return }
        if (el.expertDialog && !el.expertDialog.hidden) { closeExpertEditor(); return }
        if (!el.addDialog.hidden) { closeAddDialog(); return }
        if (state.selected) { closeDrawer(); return }
        closeHub()
      }
    })
  }

  function boot() {
    document.body.classList.toggle('hub-embedded', new URLSearchParams(location.search).get('embedded') === '1')
    if (window.StickyIcons) StickyIcons.mount(document)
    parseInitialDeepLink()
    document.body.classList.toggle('hub-detail-only', state.presentation === 'detail')
    state.tab = parseInitialTab()
    bindEvents()
    setTab(state.tab)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
