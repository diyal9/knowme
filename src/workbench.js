'use strict'

/**
 * Workbench（工作台 · 用户侧）：
 *   工作模式 — 用户按岗位组合 Agent、专业能力与工作流
 *   执行平面 — 复用现有本机/管线服务工作流与真实任务
 *   软件研发是首个完整专业能力，不再等同于整个工作台
 */
window.Workbench = (function () {
  let toastFn = (m) => console.log('[workbench]', m)
  let onViewChange = () => {}
  let onPageChange = () => {}
  let onExpertTaskStart = null
  let onExpertTaskResume = null
  let loaded = false
  let data = {
    root: '', repo: null, agents: [], daemonAgents: [], repositoryAgents: [], agentSource: 'none', workflows: [], workflowPackages: [], workContext: null, repoError: '',
    skills: [], connectors: [], knowledgeProviders: [],
    daemon: { online: false, workflows: [], tasks: [], hint: '', auth: { state: 'disabled' } },
    automation: { jobs: [], templates: [] },
    console: { domains: [], runs: [], attention: [], automation: [], counts: {} },
    taskDraft: null,
    modes: fallbackModeState(),
  }
  let activePage = 'home'
  let activeSurface = 'shelf'
  let activeManagePanel = ''
  let shelfQuery = ''
  let runStage = 'input'
  let runInputItem = null
  let viewState = {
    surface: 'home',
    taskRoom: false,
    runMode: 'local',
    phase: 'idle',
  }
  let elShelfSurface, elRunSurface, elStudioSurface, elShelfGrid, elShelfEmpty, elShelfLocked, elShelfSummary, elShelfSearch
  let elShelfRecentList, elShelfRecentEmpty, btnShelfRecentToggle, btnShelfGridToggle, btnShelfTaskManage
  let shelfGridExpanded = false
  let shelfGridCache = []
  /** @type {Set<string>} */
  const announcedAttentionIds = new Set()

  function publishTaskAttention(raw) {
    const id = String(raw?.id || '').trim()
    if (!id) return
    const payload = {
      id,
      kind: String(raw.kind || 'daemon'),
      title: String(raw.title || '需要关注').trim().slice(0, 80) || '需要关注',
      body: String(raw.body || '').trim().slice(0, 160),
      urgency: String(raw.urgency || 'info') === 'input' ? 'input' : 'info',
      source: String(raw.source || 'daemon'),
      avatarText: String(raw.avatarText || raw.title || '管').trim().slice(0, 1) || '管',
      deepLink: raw.deepLink || null,
    }
    try {
      window.dispatchEvent(new CustomEvent('knowme-needs-attention', { detail: payload }))
    } catch { /* ignore */ }
    if (!announcedAttentionIds.has(id)) {
      announcedAttentionIds.add(id)
      try { window.api?.attentionNotify?.(payload) } catch { /* ignore */ }
    }
  }

  function clearTaskAttention(id) {
    const key = String(id || '').trim()
    if (!key) return
    announcedAttentionIds.delete(key)
    try {
      window.dispatchEvent(new CustomEvent('knowme-attention-cleared', { detail: { id: key } }))
    } catch { /* ignore */ }
  }

  function syncDaemonAttentionNotify(waitingAfter, hitlPending) {
    const slug = String(run.slug || '').trim()
    if (!slug) return
    if (!hitlPending) {
      for (const id of [...announcedAttentionIds]) {
        if (id.startsWith(`daemon:${slug}:`)) clearTaskAttention(id)
      }
      return
    }
    const gate = waitingAfter?.gate
    const clarification = waitingAfter?.clarification
    const kind = gate ? 'gate' : (clarification ? 'clarification' : 'hitl')
    const node = String(
      gate?.node || gate?.id
      || clarification?.node || clarification?.node_id || clarification?.id
      || 'default'
    ).trim()
    const id = `daemon:${slug}:${kind}:${node}`
    const title = String(
      run.purposeTitle || run.intent || run.workflow?.name || slug
    ).trim().slice(0, 80) || slug
    let body = '任务等待你处理'
    if (gate) body = String(gate.title || gate.node || '需要你审批').trim()
    if (clarification) {
      const display = briefApi()?.resolveClarificationDisplay
        ? briefApi().resolveClarificationDisplay(clarification)
        : null
      body = String(
        (display && display.title)
        || clarification.question
        || clarification.node
        || '需要补充信息'
      ).trim()
    }
    publishTaskAttention({
      id,
      kind: 'daemon',
      title,
      body,
      urgency: 'input',
      source: 'daemon',
      avatarText: title,
      deepLink: { type: 'daemon-task', slug },
    })
  }

  /** 与 `.wb-shelf-grid` / `@media (max-width: 900px)` 列数对齐 */
  const SHELF_GRID_NARROW_MAX = 900
  let elModeTabs, elManageSurface, elManageTabs, elWorkflowManagePage, elWorkflowManageList, elWorkflowManageEmpty, btnWorkflowManageNew, btnWorkflowManageBack
  let elManageBack, elManageHeadTitle
  let elTaskSurface, elTaskQuickGrid, elTaskRecentList, elTaskRecentEmpty, btnTaskQuickToggle, btnTaskRecentToggle, btnTaskNew, btnTaskManage
  let taskQuickEnterPlayed = false
  let taskQuickEnterTimer = null
  const TASK_QUICK_ENTER_MS = 400
  /** 快捷专家默认只展示一排（与最近任务三列对齐） */
  const TASK_QUICK_PREVIEW = 3
  let taskQuickExpanded = false
  let taskHomeExperts = []
  let elExpertTaskRoom, elExpertTaskBody, elExpertTaskStatus, elExpertTaskTitle, btnExpertTaskBack, elTaskDashboard
  let elDialogueStatusBar, elDialogueStatusTitle, elDialogueStatusMeta, elDialogueStatusState, elDialogueStatusMode, btnDialogueStatusBack
  let elRunStageInput, elRunStageLive, elRunStageResult, elRunInputForm, elRunInputHint, elRunInputTitle, elRunBackendNote, btnRunInputStart, btnRunInputCancel, elRunResultBody, elRunResultActions, btnRunBack
  let elTeamPage, elDaemonPage, elAutomationPage
  let elHeadSub, btnReload
  let elRecentNote
  let elAutomationList, elAutomationTemplates, elAutomationHint, btnAutomationNew
  let elAutomationModal, elAutomationModalTitle, elAutomationModalBody, elAutomationModalHint, btnAutomationModalClose, btnAutomationModalCancel, btnAutomationModalSave
  let elGoalPaths, elGoalPathPicker, elGoalPathRecommendation, btnGoalPathPickerDismiss
  let elQuickGoalForm, elQuickGoalInput
  let elDomainSwitcher
  let elConsoleActiveCount, elConsoleAttentionCount, elConsoleArtifactCount
  let elStudioGraph, elStudioGraphMeta, elStudioTitle, elStudioTitleInput, elStudioTopMeta, elStudioTools, elStudioActions, elStudioInspector, elStudioInspectorTitle, elStudioInspectorPane, elStudioShell
  let elDaemonModeStatus, elDaemonModeList, elDaemonModeDetail, elDaemonRunList, elDaemonRunFilters
  let elRunner, elRunnerTitle, elRunnerMeta, elRunnerLog, elRunnerActions
  let elRunGoal, elRunStatus, elRunNextAction, elRunProgress, elRunAgents, elRunGraph, elRunArtifacts, elRunTrace, elHeadTitle
  let elDaemonReview, elDaemonReviewTabs, elDaemonReviewBody, elTaskContextLegacy
  let daemonReviewTab = 'steps'
  let daemonReviewStepId = ''
  let daemonProgressCollapsed = false
  let daemonLogsCollapsed = false
  let elModal, elModalTitle, elModalBody, elModalHint, btnModalClose, btnModalCancel, btnModalConfirm
  let run = emptyRun()
  let modal = emptyModal()
  let expertTaskRoom = null
  let taskComposerDraftTask = null
  let pollTimer = null
  let daemonLogStreamSlug = ''
  let daemonLogStreamActive = false
  let daemonLogSkipReplay = 0
  let daemonLogRenderSignature = ''
  let daemonLogStickToBottom = true
  let daemonLogFallbackTimer = null
  let agentGraphPlan = null
  let consoleDomain = 'all'
  let selectedFlowId = ''
  let selectedAgentId = ''
  let selectedStudioWorkflowId = ''
  let selectedStudioNodeId = ''
  let studioDraft = null
  /** 进入编排前的一层来源：manage→管理工作流；shelf→货架；默认 manage */
  let studioReturnState = { surface: 'manage', managePanel: 'workflows' }
  let studioDragNodeId = ''
  let studioDragAgentId = ''
  let studioSimpleMode = false
  let studioExpertPickerEl = null
  let studioExpertPickerSelected = new Set()
  let studioExpertPickerQuery = ''
  let resumeStudioExpertPickerAfterHub = false
  let selectedStudioEdgeId = ''
  let studioWireFrom = ''
  let studioWireBranch = ''
  let studioDragPos = null
  let studioView = { scale: 1, tx: 0, ty: 0 }
  let studioSpaceHeld = false
  let studioPanning = false
  let studioViewHandlersBound = false
  const STUDIO_SCALE_MIN = 0.35
  const STUDIO_SCALE_MAX = 2.2
  const STUDIO_SCALE_STEP = 0.12
  const START_NODE_ID = '__start__'
  const END_NODE_ID = '__end__'
  let selectedManagedAgentId = ''
  let selectedDaemonWorkflowId = ''
  let daemonShowMorePaths = false
  let daemonShowRoster = false
  let daemonRunFilter = 'all'
  let daemonTaskQuery = ''
  let selectedDaemonTaskSlug = ''
  let daemonComposeIntent = ''
  let daemonComposeMaterials = []
  let daemonComposeLaunchContext = null
  let daemonComposeSubmitting = false
  let daemonRunnerLogExpanded = false
  let daemonRunnerAgentsExpanded = false
  let runListResourceId = ''
  let runListRunId = ''
  let taskRoomReturnState = null
  let pendingGoal = ''
  let launchIntentState = null
  let elLaunchDrawer, btnLaunchDrawerClose, elRunOutcome
  let elLeaveModal = null
  let leaveChoiceResolve = null
  let elWorkflowDeleteModal = null
  let workflowDeleteResolve = null
  let goalPathRecommendation = null
  let automationDraft = null
  let automationConnectors = []
  let feishuTargetOptions = { users: [], chats: [], userQuery: '', chatQuery: '' }
  let feishuTargetQueryTimer = null

  function fallbackModeState() {
    return {
      activeModeId: 'office',
      modes: [
        {
          id: 'office',
          name: '日常办公',
          description: '把会议、文档、日程和协作交给你的 专家团队。',
          icon: 'briefcase',
          accent: 'sage',
          professionalCapabilities: [
            { id: 'meeting', label: '会议与纪要', description: '整理会议、决策与后续待办', status: 'setup_required', icon: 'note' },
            { id: 'planning', label: '日程与优先级', description: '汇总安排并梳理今天最重要的工作', status: 'setup_required', icon: 'calendarRange' },
            { id: 'knowledge', label: '文档与知识', description: '检索、整理并沉淀可信工作资料', status: 'ready', icon: 'bookOpen' },
          ],
          suggestedRoles: [],
          bindings: [],
          providers: [{ id: 'local-agent', label: '本地智能助理', status: 'ready' }],
        },
        {
          id: 'engineering',
          name: '软件研发',
          description: '从需求、架构、编码到测试交付，让专业角色按流程协作。',
          icon: 'code',
          accent: 'forest',
          professionalCapabilities: [
            { id: 'delivery', label: '研发交付', description: '需求、开发、测试与发布协同', status: 'setup_required', icon: 'workflow' },
            { id: 'coding', label: '编码实现', description: '在仓库上下文中完成开发与验证', status: 'setup_required', icon: 'code' },
            { id: 'quality', label: '质量门禁', description: '审查、测试、证据与验收闭环', status: 'setup_required', icon: 'check' },
          ],
          suggestedRoles: [],
          bindings: [],
          providers: [{ id: 'workbench-daemon', label: '管线服务', status: 'offline' }],
        },
        {
          id: 'visual',
          name: '视觉创作',
          description: '组合策划、文案与图像生成专家，完成从想法到视觉产出。',
          icon: 'image',
          accent: 'clay',
          professionalCapabilities: [
            { id: 'concept', label: '创意策划', description: '把模糊想法整理为清晰视觉方向', status: 'setup_required', icon: 'optimize' },
            { id: 'prompt', label: '提示词设计', description: '生成可复用、可迭代的图像提示词', status: 'setup_required', icon: 'edit' },
            { id: 'image', label: '图像生成', description: '连接图像模型并保留版本与产物', status: 'setup_required', icon: 'image' },
          ],
          suggestedRoles: [],
          bindings: [],
          providers: [{ id: 'image-provider', label: '图像生成服务', status: 'setup_required' }],
        },
      ],
    }
  }

  function modeState() {
    const state = data.modes && typeof data.modes === 'object' ? data.modes : fallbackModeState()
    const modes = Array.isArray(state.modes) && state.modes.length ? state.modes : fallbackModeState().modes
    const activeModeId = modes.some(mode => mode.id === state.activeModeId)
      ? state.activeModeId
      : modes[0].id
    return { ...state, activeModeId, modes }
  }

  function activeMode() {
    const state = modeState()
    return state.modes.find(mode => mode.id === state.activeModeId) || state.modes[0]
  }

  function isEngineeringMode() {
    return activeMode()?.id === 'engineering'
  }

  function esc(s) {
    if (window.WorkbenchEscape?.escapeHtml) return window.WorkbenchEscape.escapeHtml(s)
    if (window.UIKit?.escapeHtml) return window.UIKit.escapeHtml(s)
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function escAttr(s) {
    if (window.WorkbenchEscape?.escapeAttr) return window.WorkbenchEscape.escapeAttr(s)
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  function runPhaseFromStatus(status, mode = run.mode) {
    if (window.WorkbenchRunPhase?.runPhaseFromStatus) {
      return window.WorkbenchRunPhase.runPhaseFromStatus(status, mode, run.terminalKind)
    }
    const value = String(status || '').toLowerCase()
    if (!value || value === 'idle') return 'idle'
    if (['ready', 'preparing'].includes(value)) return 'preparing'
    if (['running', 'queued', 'pending', 'waiting', 'blocked'].includes(value)) return 'running'
    if (['done', 'success', 'completed', 'finished'].includes(value)) return 'completed'
    if (['failed', 'error', 'rejected'].includes(value)) return 'failed'
    if (['cancelled', 'canceled'].includes(value)) return 'cancelled'
    if (mode === 'daemon' && run.terminalKind === 'success') return 'completed'
    return 'running'
  }

  function updateWorkbenchViewState(patch = {}) {
    viewState = {
      ...viewState,
      ...patch,
    }
    const root = document.getElementById('workbench')
    if (root) {
      root.dataset.surface = viewState.surface
      root.dataset.layout = viewState.taskRoom ? 'task-room' : 'overview'
      root.dataset.runMode = viewState.runMode
      root.dataset.phase = viewState.phase
    }
  }

  function workbenchTaskStateLabel(state) {
    const key = String(state || 'idle').trim().toLowerCase()
    if (key === 'running') return '进行中'
    if (key === 'queued' || key === 'pending') return '排队中'
    if (key === 'done' || key === 'success' || key === 'completed') return '已完成'
    if (key === 'failed' || key === 'error' || key === 'rejected') return '执行失败'
    if (key === 'cancelled' || key === 'canceled') return '已取消'
    if (key === 'blocked') return '已阻塞'
    return '等待中'
  }

  function saveTaskDraft(patch = {}) {
    const current = data.taskDraft && typeof data.taskDraft === 'object' ? data.taskDraft : {}
    data.taskDraft = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    if (window.api?.workbenchTaskDraftSave) {
      void window.api.workbenchTaskDraftSave(patch).then(result => {
        if (result && result.ok && result.draft) data.taskDraft = result.draft
      }).catch(() => {})
    }
  }

  function activeLaunchDomain() {
    return consoleDomain !== 'all' ? consoleDomain : (activeMode()?.id || 'office')
  }

  /** 进入运行/任务房前捕获：回到专家协作 / 工作流 / 管线服务 */
  function resolveReturnSurface(override = '') {
    const forced = String(override || '').trim()
    if (forced === 'daemon' || forced === 'shelf' || forced === 'taskhome') return forced
    if (forced === 'workflows' || forced === 'workflow') return 'shelf'
    if (forced === 'tasks' || forced === 'home') return 'taskhome'
    if (activeSurface === 'manage' && activeManagePanel === 'daemon') return 'daemon'
    if (activeSurface === 'shelf' || activeSurface === 'studio') return 'shelf'
    if (activeSurface === 'taskhome') return 'taskhome'
    const prior = String(taskRoomReturnState?.surface || launchIntentState?.returnState?.surface || '').trim()
    if (prior === 'daemon' || prior === 'shelf' || prior === 'taskhome') return prior
    if (prior === 'workflows' || prior === 'workflow') return 'shelf'
    if (prior === 'tasks' || prior === 'home') return 'taskhome'
    return 'taskhome'
  }

  function captureTaskRoomReturnState(overrides = {}) {
    const body = document.querySelector('#workbench .wb-body')
    const resourceType = String(overrides.resourceType || launchIntentState?.resourceType || '').trim()
    const resourceId = String(overrides.resourceId || launchIntentState?.resourceId || runListResourceId || '').trim()
    const surface = resolveReturnSurface(overrides.surface)
    return {
      ...(launchIntentState?.returnState || {}),
      surface,
      sourceSurface: activeSurface,
      managePanel: activeManagePanel || '',
      domain: consoleDomain,
      resourceType,
      resourceId,
      runId: String(overrides.runId || launchIntentState?.runId || launchIntentState?.rootRunId || launchIntentState?.slug || '').trim(),
      selectedFlowId,
      selectedStudioWorkflowId,
      selectedStudioNodeId,
      shelfQuery,
      scrollTop: ['taskhome', 'shelf', 'manage'].includes(activeSurface)
        ? Math.max(0, Math.round(body?.scrollTop || 0))
        : 0,
      sourceScrollTop: Math.max(0, Math.round(body?.scrollTop || 0)),
      ...overrides,
      surface: resolveReturnSurface(overrides.surface),
    }
  }

  function restoreTaskRoomReturnState(state = {}) {
    const restored = state && typeof state === 'object' ? state : {}
    const domain = String(restored.domain || '')
    if (['all', 'office', 'engineering', 'visual'].includes(domain)) consoleDomain = domain
    selectedFlowId = String(restored.selectedFlowId || selectedFlowId || '')
    selectedStudioWorkflowId = String(restored.selectedStudioWorkflowId || selectedStudioWorkflowId || '')
    selectedStudioNodeId = String(restored.selectedStudioNodeId || selectedStudioNodeId || '')
    shelfQuery = String(restored.shelfQuery || '')
    // activeWorkMode / shelfSource 已退役；旧存档值安全忽略
    runListResourceId = ['pipeline', 'workflow'].includes(String(restored.resourceType || ''))
      ? String(restored.resourceId || '')
      : ''
    runListRunId = String(restored.runId || '')
    if (elShelfSearch) elShelfSearch.value = shelfQuery
    syncShelfFilterChips()
    runInputItem = null
    const target = resolveReturnSurface(restored.surface)
    if (target === 'daemon') openManagePanel('daemon')
    else if (target === 'shelf') setSurface('shelf', { force: true })
    else setSurface('taskhome', { force: true })
    setRunStage('input')
    syncTaskView()
    taskRoomReturnState = null
    const scrollTop = Math.max(0, Number(restored.scrollTop) || 0)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const body = document.querySelector('#workbench .wb-body')
      if (body) body.scrollTop = scrollTop
    }))
  }

  function syncLaunchIntentLocal(intent) {
    if (!intent || typeof intent !== 'object') return
    launchIntentState = intent
    if (intent.goal) pendingGoal = intent.goal
    if (intent.domain && consoleDomain !== 'all') consoleDomain = intent.domain
  }

  function closeLaunchDrawer() {
    if (activeSurface === 'run' && runStage === 'input' && !run.workflow) setSurface('shelf', { force: true })
  }

  // 用户主动取消确认输入：标记 cancelled，避免下次打开再被草稿强制拉回表单
  async function dismissRunInputDraft() {
    const goal = humanGoalText(
      document.getElementById('wbRunGoalInput')?.value
      || launchIntentState?.goal
      || pendingGoal
      || data.taskDraft?.goal
      || '',
    )
    runInputItem = null
    if (goal) pendingGoal = goal
    try {
      await updateLaunchIntent({ status: 'cancelled', step: 'intent' })
    } catch {
      /* best effort */
    }
    if (window.api?.workbenchTaskDraftClear) {
      try {
        await window.api.workbenchTaskDraftClear()
        data.taskDraft = null
      } catch {
        /* best effort */
      }
    } else {
      data.taskDraft = null
    }
    launchIntentState = null
    const returnState = {
      ...(taskRoomReturnState || {}),
      surface: resolveReturnSurface(taskRoomReturnState?.surface || 'shelf'),
    }
    restoreTaskRoomReturnState(returnState)
  }

  // 唯一启动入口：进入运行视图的「确认输入」阶段
  function openLaunchDrawer(patch = {}) {
    // 进 run 前锁定来源，避免 resolveReturnSurface 在 run 面上失真
    if (activeSurface !== 'run' || !taskRoomReturnState?.surface) {
      taskRoomReturnState = captureTaskRoomReturnState({
        surface: resolveReturnSurface(patch.returnState?.surface),
        ...(patch.returnState || {}),
      })
    }
    setSurface('run', { force: true })
    setRunStage('input')
    renderRunInputStage()
    void updateLaunchIntent({
      step: 'intent',
      status: 'draft',
      domain: activeLaunchDomain(),
      returnState: taskRoomReturnState,
      ...patch,
    }).then(() => renderRunInputStage())
    setTimeout(() => elRunInputForm?.querySelector('textarea, input')?.focus(), 120)
  }

  function runInputFields(item) {
    const inputs = Array.isArray(item?.inputs) ? item.inputs : []
    const usedIds = new Set()
    return inputs
      .map((input, index) => {
        if (typeof input === 'string') {
          const id = `input-${index}`
          usedIds.add(id)
          return { id, label: input, required: false, type: 'text', hint: '', example: '', options: [] }
        }
        const rawId = String(input.id || input.name || `input-${index}`)
        let safeId = rawId || `input-${index}`
        let seq = 2
        while (usedIds.has(safeId)) {
          safeId = `${rawId}-${seq}`
          seq += 1
        }
        usedIds.add(safeId)
        const options = (Array.isArray(input.options || input.enum) ? (input.options || input.enum) : [])
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 20)
        return {
          id: safeId,
          label: String(input.label || input.name || input.id || `输入 ${index + 1}`),
          required: input.required === true,
          type: String(input.type || input.valueType || (options.length ? 'enum' : 'text')).toLowerCase(),
          hint: String(input.description || input.hint || ''),
          example: String(input.example || ''),
          options,
        }
      })
      .filter(field => field.label)
  }

  // 历史草稿会把工作流 id 当作目标写回，这里挡掉，避免用户看到 "team-run" 这种机器名
  function humanGoalText(value) {
    const goal = String(value || '').trim()
    if (!goal) return ''
    if (/\s/.test(goal)) return goal
    const packages = Array.isArray(data.workflowPackages) ? data.workflowPackages : []
    const isIdentifier = packages.some(item => item.id === goal || item.slug === goal)
    return isIdentifier ? '' : goal
  }

  function renderRunInputStage() {
    if (!elRunInputForm) return
    const intent = launchIntentState || {}
    const item = runInputItem || workflowById(intent.resourceId) || null
    const goal = humanGoalText(intent.goal || pendingGoal)
    // 工作流名与产出只在顶栏出现一次；卡片只写阶段指引
    if (elRunInputTitle) elRunInputTitle.textContent = '填写本次信息'
    if (elRunInputHint) {
      elRunInputHint.textContent = item
        ? '确认目标与必要材料后即可开始。运行过程中可随时返回流程；也可从「专家协作」或「管线服务」找回进行中的项。'
        : '描述这次运行要交付的结果，系统会自动选择合适的执行方式。'
    }
    const fields = runInputFields(item)
    const fieldControl = field => {
      const type = field.type === 'integer' ? 'number' : (field.type === 'bool' ? 'boolean' : field.type)
      const placeholder = field.hint || field.example || (field.required ? '运行前需要提供' : '可留空，运行中再补充')
      if (type === 'enum' && Array.isArray(field.options) && field.options.length) {
        return `<select data-run-input="${escAttr(field.id)}"><option value="">请选择</option>${field.options.map(opt => `<option value="${escAttr(opt)}">${esc(opt)}</option>`).join('')}</select>`
      }
      if (type === 'boolean') {
        return `<select data-run-input="${escAttr(field.id)}"><option value="">请选择</option><option value="true">是</option><option value="false">否</option></select>`
      }
      if (type === 'json') {
        return `<textarea data-run-input="${escAttr(field.id)}" rows="3" placeholder="${escAttr(placeholder)}"></textarea>`
      }
      const inputType = type === 'number' ? 'number' : 'text'
      return `<input type="${inputType}" data-run-input="${escAttr(field.id)}" placeholder="${escAttr(placeholder)}">`
    }
    elRunInputForm.innerHTML = `
      <label class="wb-run-field">
        <span class="wb-run-field-label"><span>本次目标</span></span>
        <textarea id="wbRunGoalInput" rows="3" maxlength="240" placeholder="例如：整理今天的会议纪要并生成待办">${esc(goal)}</textarea>
      </label>
      ${fields.map(field => `
      <label class="wb-run-field">
        <span class="wb-run-field-label">
          <span>${esc(field.label)}</span>
          ${field.required ? '<span class="wb-run-field-req">必填</span>' : ''}
        </span>
        ${fieldControl(field)}
      </label>`).join('')}
    `
    const elAgents = document.getElementById('wbRunInputAgents')
    if (elAgents) {
      const agents = item ? workflowAgents(item) : []
      const names = agents
        .map(agent => chineseRoleName(agent))
        .map(name => String(name || '').trim())
        .filter(Boolean)
        .filter((name, index, list) => list.indexOf(name) === index)
        .slice(0, 8)
      if (names.length) {
        elAgents.hidden = false
        elAgents.innerHTML = `
          <span class="wb-run-agents-preview-label">参与专家</span>
          ${names.map(name => `<span class="wb-run-agent">${esc(name)}</span>`).join('')}`
      } else {
        elAgents.hidden = true
        elAgents.innerHTML = ''
      }
    }
    if (elRunBackendNote) {
      const backend = item ? executionBackendLabel(item) : (data.daemon?.online ? '管线服务' : '本机专家团队')
      elRunBackendNote.textContent = `执行方式：${backend}（系统自动选择）`
    }
    if (btnRunInputStart) btnRunInputStart.disabled = false
  }

  function runResultIdentity() {
    // 管线结果页：小标题跟顶栏「管线服务」对齐，主标题用 Daemon 目的标题；
    // 勿因 run.workflow（管线定义）误标成「工作流」。
    if (run.mode === 'daemon') {
      return {
        kicker: '管线',
        title: daemonRunIdentityTitle() || 'Daemon 阶段 · 管线任务',
      }
    }
    const wfName = run.workflow
      ? String(workflowDisplayNameOf(run.workflow) || run.workflow.name || run.workflow.id || '').trim()
      : ''
    const fallback = String(run.intent || run.contextSummary || run.slug || '').trim()
    return {
      kicker: wfName ? '工作流' : '任务',
      title: wfName || fallback || '运行结果',
    }
  }

  function renderRunResultStage() {
    if (!elRunResultBody) return
    if (runStage !== 'result') return
    const artifacts = (Array.isArray(run.artifacts) ? run.artifacts : []).filter(item => {
      const pathValue = typeof item === 'string'
        ? item
        : String(item?.path || item?.full_path || item?.fullPath || item?.name || '')
      return !isDaemonInputArtifactPath(pathValue)
    })
    const identity = runResultIdentity()
    const resultSummary = String(run.resultSummary || '').trim()
    const summaryHtml = resultSummary
      ? `<section class="wb-run-result-summary"><strong>执行结果</strong><div>${esc(resultSummary)}</div></section>`
      : ''
    // 标题块 + 分割线对齐对话右栏 .wb-side-block
    const headHtml = `<div class="wb-run-result-block">
      <header class="wb-run-result-head">
        <div class="wb-run-result-kicker">${esc(identity.kicker)}</div>
        <h2 class="wb-run-result-title">${esc(identity.title)}</h2>
      </header>
      ${summaryHtml}
    </div>`
    const visibleArtifacts = artifacts.slice(0, 12)
    const artifactCount = visibleArtifacts.length
    const artifactsHeading = artifactCount
      ? `产物（${artifactCount}）`
      : '产物'
    const artifactsListHtml = artifactCount
      ? `<div class="wb-run-result-list" role="list">${visibleArtifacts.map((item, index) => {
        const artifact = normalizeRunArtifact(item, index)
        const attr = artifact.url
          ? `data-artifact-url="${escAttr(artifact.url)}"`
          : (artifact.path ? `data-artifact-path="${escAttr(artifact.path)}"` : '')
        const preview = artifact.content
          ? `<small>${esc(artifact.content.slice(0, 240))}</small>`
          : ''
        const copy = `<span class="wb-run-result-item-copy"><span class="wb-run-result-item-name">${esc(artifact.title)}</span>${preview}</span>`
        const icon = `<span class="ico" data-icon="${artifact.url ? 'link' : 'file'}" aria-hidden="true"></span>`
        return attr
          ? `<button type="button" class="wb-run-result-item" role="listitem" ${attr}>${icon}${copy}</button>`
          : `<span class="wb-run-result-item is-static" role="listitem">${icon}${copy}</span>`
      }).join('')}</div>`
      : `<p class="wb-run-muted">${resultSummary
        ? '已保留本次执行结果，但没有生成可复用的文件或链接。'
        : '本次运行已结束，但没有返回结果或可打开产物。可查看执行过程定位原因，或调整输入后再跑一次。'}</p>`
    const artifactsHtml = `<section class="wb-run-result-artifacts" aria-label="${escAttr(artifactsHeading)}">
      <div class="wb-run-result-section-title">${esc(artifactsHeading)}</div>
      ${artifactsListHtml}
    </section>`
    elRunResultBody.innerHTML = `${headHtml}${artifactsHtml}`
    if (window.StickyIcons) window.StickyIcons.mount(elRunResultBody)
    if (elRunResultActions) {
      elRunResultActions.innerHTML = `
        <button type="button" class="wb-modal-btn primary" data-run-result="again"><span class="ico" data-icon="refresh" aria-hidden="true"></span><span>再跑一次</span></button>
        <button type="button" class="wb-modal-btn" data-run-result="log"><span class="ico" data-icon="history" aria-hidden="true"></span><span>查看执行过程</span></button>`
      if (window.StickyIcons) window.StickyIcons.mount(elRunResultActions)
    }
  }

  function collectRunInputs() {
    const goal = String(document.getElementById('wbRunGoalInput')?.value || '').trim()
    const fields = runInputFields(runInputItem || workflowById(launchIntentState?.resourceId) || null)
    const fieldMap = new Map(fields.map(field => [field.id, field]))
    const missing = []
    const refs = [...(elRunInputForm?.querySelectorAll('[data-run-input]') || [])]
      .map(node => {
        const id = String(node.getAttribute('data-run-input') || '')
        const value = String(node.value || '').trim()
        const field = fieldMap.get(id)
        if (field?.required && !value) missing.push(field.label)
        return { id, value }
      })
      .filter(entry => entry.value)
    return { goal, inputRefs: refs, missingFields: missing }
  }

  async function updateLaunchIntent(patch = {}, options = {}) {
    if (!window.api?.workbenchLaunchSave) {
      syncLaunchIntentLocal({ ...(launchIntentState || {}), ...(patch || {}) })
      return { ok: true, intent: launchIntentState }
    }
    const res = await window.api.workbenchLaunchSave({
      patch,
      persist: options.persist || 'both',
      options: options.saveOptions || {},
      facts: {
        daemonOnline: !!(data.daemon && data.daemon.online),
        localTeamEnabled: true,
      },
    })
    if (res?.duplicate) {
      toastFn('该运行已存在，正在打开…', 'success')
      await openExistingLaunchRun(res.runId, res.intent)
      return res
    }
    if (res?.ok) {
      if (res.context) data.workContext = res.context
      if (res.draft) data.taskDraft = res.draft
      syncLaunchIntentLocal(res.intent)
    }
    return res
  }

  async function completeLaunchIntent(refs = {}) {
    if (!window.api?.workbenchLaunchComplete) return updateLaunchIntent({
      status: 'launched',
      step: 'launch',
      ...refs,
    })
    const res = await window.api.workbenchLaunchComplete({ refs })
    if (res?.ok) {
      if (res.context) data.workContext = res.context
      if (res.draft) data.taskDraft = res.draft
      syncLaunchIntentLocal(res.intent)
    }
    return res
  }

  async function clearStaleDaemonTaskDraft() {
    if (window.api?.workbenchTaskDraftClear) {
      try {
        await window.api.workbenchTaskDraftClear()
      } catch { /* best effort */ }
    }
    data.taskDraft = null
    launchIntentState = null
    if (data.workContext && data.workContext.launchIntent) {
      const nextContext = { ...data.workContext, launchIntent: null }
      data.workContext = nextContext
      if (window.api?.workbenchContextSave) {
        void window.api.workbenchContextSave({ launchIntent: null }).then(result => {
          if (result?.ok && result.context) data.workContext = result.context
        }).catch(() => {})
      }
    }
  }

  function daemonDraftPhaseIsTerminal(phase) {
    return ['completed', 'failed', 'cancelled', 'canceled', 'done', 'success', 'error'].includes(
      String(phase || '').toLowerCase(),
    )
  }

  async function openExistingLaunchRun(runId, intent = {}) {
    const id = String(runId || intent.runId || intent.rootRunId || intent.slug || '').trim()
    if (!id) return false
    if (intent.executionSource === 'daemon' || intent.backend === 'daemon' || intent.slug) {
      const opened = await openDaemonTask(intent.slug || id, {
        silent: true,
        returnSurface: intent.returnState?.surface || 'daemon',
      })
      return !!opened
    }
    if (intent.resourceType === 'graph' || intent.executionSource === 'agent-graph' || intent.rootRunId) {
      setWorkbenchPage('tasks', { force: true })
      restoreAgentGraphDraft({
        rootRunId: intent.rootRunId || id,
        goal: intent.goal || pendingGoal,
        phase: 'running',
        executionSource: 'agent-graph',
      }, { shouldRefresh: true })
      return true
    }
    if (intent.resourceType === 'pipeline' && intent.resourceId) {
      // 没有 runId 的管线意图只是没跑完的草稿：保留目标预填，不强制弹出确认输入
      syncLaunchIntentLocal(intent)
      if (intent.goal) pendingGoal = humanGoalText(intent.goal) || pendingGoal
      return false
    }
    return false
  }

  function resolveWorkflowExecutionSource(item) {
    const backends = (Array.isArray(item?.executionBackends) ? item.executionBackends : [])
      .filter(value => value !== 'legacy-local')
    if (backends.includes('daemon') && data.daemon?.online) return 'daemon'
    if (backends.includes('local-team')) return 'local-team'
    if (item?.executionSource && item.executionSource !== 'legacy-local') return item.executionSource
    if (data.daemon?.online) return 'daemon'
    return 'local-team'
  }

  async function ingestLaunchRequest(launchRequest = {}, extras = {}) {
    const request = launchRequest && typeof launchRequest === 'object' ? launchRequest : {}
    const resourceType = request.resourceType === 'workflow' ? 'pipeline' : request.resourceType
    await updateLaunchIntent({
      domain: request.domain || activeLaunchDomain(),
      resourceType,
      resourceId: request.resourceId,
      goal: request.goal || pendingGoal,
      backend: request.backend,
      inputRefs: request.inputRefs,
      returnState: { ...(request.returnState || {}), ...(extras.returnState || {}) },
      executionSource: extras.executionSource || 'automation',
      step: 'confirm',
      status: 'ready',
    })
    openLaunchDrawer({ step: 'confirm', status: 'ready' })
  }

  async function launchGraphFromIntent(intent = {}) {
    const goal = String(intent.goal || pendingGoal || '').trim()
    if (!goal) {
      openLaunchDrawer({ resourceType: 'graph', step: 'inputs' })
      return false
    }
    if (intent.resourceType === 'pipeline' && intent.resourceId) {
      const item = workflowById(intent.resourceId)
      if (item?.graph?.nodes?.length) {
        await openSavedWorkflowGraph(item, goal, { autoStart: true })
        return true
      }
      const agentRefs = Array.isArray(item?.agentRefs) ? item.agentRefs : []
      if (agentRefs.length) {
        return openAgentGraph(goal, {
          autoStart: true,
          members: agentRefs.map(ref => ({
            agentPackageId: ref.id,
            expertId: ref.id,
            profileId: ref.profileId || '',
            role: ref.role || ref.id,
          })),
          template: agentRefs.length >= 3 ? 'parallel' : (agentRefs.length === 2 ? 'serial' : 'single'),
          teamName: item.name || 'KnowMe 专业管线',
        })
      }
    }
    return openAgentGraph(goal, { autoStart: true })
  }

  async function launchPreparedIntent(options = {}) {
    let baseIntent = launchIntentState
      || data.taskDraft?.launchIntent
      || data.workContext?.launchIntent
      || {}
    taskRoomReturnState = captureTaskRoomReturnState({
      resourceType: baseIntent.resourceType,
      resourceId: baseIntent.resourceId,
    })
    const saved = await updateLaunchIntent({ returnState: taskRoomReturnState })
    if (saved?.intent) baseIntent = saved.intent
    if (!window.api?.workbenchLaunchStart) {
      if (baseIntent.resourceType === 'pipeline' && baseIntent.resourceId) {
        await startWorkflowRun(baseIntent.resourceId, baseIntent.goal || pendingGoal)
        return { ok: true }
      }
      return { ok: false, error: 'Launch Controller 不可用' }
    }
    const start = await window.api.workbenchLaunchStart({
      intent: baseIntent,
      allowRelaunch: options.allowRelaunch === true,
      facts: { daemonOnline: !!(data.daemon && data.daemon.online) },
    })
    if (!start?.ok) {
      if (start?.duplicate) {
        toastFn('该运行已存在，正在打开…', 'success')
        await openExistingLaunchRun(start.runId, start.intent)
        return start
      }
      toastFn(start?.error || '暂时无法启动', 'error')
      if (start?.readiness?.blockers?.length) openLaunchDrawer({ step: 'inputs', status: 'blocked' })
      return start
    }
    syncLaunchIntentLocal(start.intent)
    closeLaunchDrawer()
    dismissGoalPathPicker()
    switch (start.route) {
      case 'confirm-daemon-workflow':
      case 'confirm-local-workflow':
        if (start.intent?.resourceId) {
          setWorkbenchPage('tasks', { force: true })
          setRunStage('running')
          await startWorkflowRun(start.intent.resourceId, start.intent.goal || pendingGoal)
        } else {
          openLaunchDrawer({ step: 'inputs' })
        }
        break
      case 'confirm-agent-graph':
        setWorkbenchPage('tasks', { force: true })
        setRunStage('running')
        await launchGraphFromIntent(start.intent)
        break
      case 'plan-agent-run':
        setWorkbenchPage('tasks', { force: true })
        setRunStage('running')
        await launchAgentRun(start.intent.resourceId, start.intent.goal)
        break
      case 'drawer-inputs':
      case 'drawer-readiness':
      case 'drawer':
      default:
        openLaunchDrawer({ step: start.route === 'drawer-readiness' ? 'readiness' : 'inputs' })
        break
    }
    return start
  }

  async function restoreLaunchIntentFromStores() {
    const intent = data.taskDraft?.launchIntent || data.workContext?.launchIntent
    if (!intent || typeof intent !== 'object') return false
    if (window.api?.workbenchLaunchAssess) {
      const assessed = await window.api.workbenchLaunchAssess({
        intent,
        recover: true,
        facts: { daemonOnline: !!(data.daemon && data.daemon.online) },
      })
      if (!assessed?.recoverable) {
        // 已取消或不完整：只回填目标，不强制打开「填写本次信息」
        if (assessed?.intent?.goal) pendingGoal = humanGoalText(assessed.intent.goal) || pendingGoal
        return false
      }
      syncLaunchIntentLocal(assessed.intent)
      if (['launched', 'launching'].includes(String(assessed.intent.status || ''))
        && (assessed.intent.runId || assessed.intent.rootRunId || assessed.intent.slug)) {
        return openExistingLaunchRun(assessed.intent.runId || assessed.intent.slug, assessed.intent)
      }
      // 未真正开跑的草稿：预填目标即可，由用户从货架主动再开；避免每次进入工作台都弹确认输入
      if (assessed.intent.goal) pendingGoal = humanGoalText(assessed.intent.goal) || pendingGoal
      return false
    }
    syncLaunchIntentLocal(intent)
    if (intent.goal) pendingGoal = humanGoalText(intent.goal) || pendingGoal
    return false
  }

  async function backToRunList() {
    if (expertTaskRoom) {
      closeExpertTaskRoom()
      return
    }
    const intent = launchIntentState || data.taskDraft?.launchIntent || data.workContext?.launchIntent || {}
    // 无显式来源时：daemon → 管线，带 workflow → 货架，否则专家协作
    const inferred = resolveReturnSurface(
      taskRoomReturnState?.surface
      || intent.returnState?.surface
      || (run.mode === 'daemon' ? 'daemon' : '')
      || (run.workflow ? 'shelf' : 'taskhome')
    )
    const returnState = {
      ...(intent.returnState || {}),
      ...(taskRoomReturnState || {}),
      surface: inferred,
      runId: intent.runId || intent.rootRunId || intent.slug || taskRoomReturnState?.runId || '',
    }
    // 先离开运行面，目录刷新放后台，避免返回按钮「卡一会」
    resetRun()
    closeModal()
    restoreTaskRoomReturnState(returnState)
    void refreshRunDirectory()
  }

  /** 仅当来源明确为管线服务时强制回管线；否则走统一来源恢复 */
  async function backDaemonRunToPipelineTasks() {
    const origin = resolveReturnSurface(
      taskRoomReturnState?.surface || launchIntentState?.returnState?.surface
    )
    if (origin !== 'daemon') {
      await backToRunList()
      return
    }
    if (expertTaskRoom) {
      closeExpertTaskRoom()
      return
    }
    const returnState = {
      ...(taskRoomReturnState || {}),
      surface: 'daemon',
      runId: String(run.slug || taskRoomReturnState?.runId || '').trim(),
    }
    resetRun()
    closeModal()
    restoreTaskRoomReturnState(returnState)
    void refreshRunDirectory()
  }

  /** 结束态返回：按进入来源回分类首页（不再写死货架） */
  async function backRunResultToShelf() {
    await backToRunList()
  }

  function saveWorkContext(patch = {}) {
    const current = data.workContext && typeof data.workContext === 'object' ? data.workContext : {}
    data.workContext = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    if (window.api?.workbenchContextSave) {
      void window.api.workbenchContextSave(patch).then(result => {
        if (result?.ok && result.context) data.workContext = result.context
      }).catch(() => {})
    }
  }

  function emptyRun() {
    return {
      workflow: null,
      graph: null,
      currentId: '',
      status: 'idle',
      logs: [],
      dispatchId: '',
      mode: 'local',
      slug: '',
      intent: '',
      purposeTitle: '',
      context: null,
      contextSummary: '',
      task: null,
      artifacts: [],
      resultSummary: '',
      agentArtifacts: [],
      projection: null,
      taskTrace: null,
      terminalKind: '',
      hitlPending: false,
      error: '',
      rootRunId: '',
      composition: null,
      agentTree: null,
      pendingGates: [],
      progressText: '',
      processLogsText: '',
      events: [],
      changes: null,
      changesLoaded: false,
      changesLoading: false,
      changesError: '',
    }
  }

  function daemonPurposeTitleApi() {
    return window.WorkbenchDaemonSurface || null
  }

  function daemonRunIdentityTitle() {
    const api = daemonPurposeTitleApi()
    const workflowName = run.workflow
      ? (workflowDisplayNameOf(run.workflow) || run.workflow.name || run.workflow.id || '')
      : ''
    if (api && typeof api.formatDaemonPurposeTitle === 'function') {
      return api.formatDaemonPurposeTitle(run.purposeTitle || '', {
        intent: run.intent,
        workflowName,
        slug: run.slug,
      })
    }
    const body = String(run.purposeTitle || run.intent || workflowName || run.slug || '管线任务').trim().slice(0, 24)
    return `Daemon 阶段 · ${body || '管线任务'}`
  }

  let daemonPurposeTitleToken = 0

  async function ensureDaemonPurposeTitle({ force = false } = {}) {
    if (run.mode !== 'daemon') return ''
    const intent = String(run.intent || '').trim()
    const workflowName = run.workflow
      ? (workflowDisplayNameOf(run.workflow) || run.workflow.name || run.workflow.id || '')
      : ''
    const api = daemonPurposeTitleApi()
    const draftTitle = String(data.taskDraft?.purposeTitle || '').trim()
    if (!force && run.purposeTitle) return run.purposeTitle
    if (!force && draftTitle) {
      run.purposeTitle = draftTitle.replace(/^Daemon\s*阶段\s*[·•]\s*/i, '').trim() || draftTitle
      return run.purposeTitle
    }
    const local = api && typeof api.resolveDaemonPurposeTitleLocal === 'function'
      ? api.resolveDaemonPurposeTitleLocal(intent, { workflowName, slug: run.slug, purposeTitle: draftTitle })
      : String(intent || workflowName || run.slug || '管线任务').trim().slice(0, 24)
    run.purposeTitle = local
    renderDaemonRunner()
    syncRunTopbar()
    if (!intent || intent.length < 8 || !window.api?.aiSuggestTitle) return run.purposeTitle
    const token = ++daemonPurposeTitleToken
    let suggested = null
    try {
      suggested = await window.api.aiSuggestTitle({ content: intent.slice(0, 1200) })
    } catch {
      suggested = null
    }
    if (token !== daemonPurposeTitleToken || run.mode !== 'daemon') return run.purposeTitle
    const next = String(suggested?.title || '').trim().replace(/^Daemon\s*阶段\s*[·•]\s*/i, '').slice(0, 24)
    if (next && next !== run.purposeTitle) {
      run.purposeTitle = next
      saveTaskDraft({ purposeTitle: next, goal: run.intent, slug: run.slug || '' })
      renderDaemonRunner()
      syncRunTopbar()
    }
    return run.purposeTitle
  }

  function buildTaskTrace({ context = null, handoff = null, session = null, slug = '', workflow = '' } = {}) {
    const meta = (context && context.meta) || {}
    const trace = (handoff && handoff.trace) || {}
    const requirement = (handoff && handoff.requirement) || {}
    const list = value => {
      if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
      const text = String(value || '').trim()
      return text ? [text] : []
    }
    return {
      sceneId: String(meta.sceneId || trace.sceneId || '').trim(),
      skillId: String(meta.skillId || trace.skillId || '').trim(),
      connectors: list(meta.connectors || trace.connectors),
      knowledgeSources: list(meta.sources || requirement.sources || trace.knowledgeSources),
      sessionId: String((session && session.id) || meta.sessionId || trace.sessionId || '').trim(),
      runId: String((session && session.run && session.run.id) || meta.runId || trace.runId || slug || '').trim(),
      workflow: String(workflow || (handoff && handoff.workflow) || meta.workflow || '').trim(),
      handoffFrom: String(meta.handoffFrom || trace.handoffFrom || '').trim(),
      sessionCompatMode: String(trace.sessionCompatMode || meta.sessionCompatMode || '').trim(),
    }
  }

  function renderTaskTracePanel() {
    if (!elRunTrace) return
    const trace = run.taskTrace || buildTaskTrace({
      context: run.context,
      slug: run.slug,
      workflow: run.workflow && (run.workflow.id || run.workflow.name),
    })
    const rows = []
    if (trace.sceneId) rows.push(['场景', trace.sceneId])
    if (trace.skillId) rows.push(['Skill', trace.skillId])
    if (trace.connectors.length) rows.push(['连接器', trace.connectors.join(' · ')])
    if (trace.knowledgeSources.length) rows.push(['知识来源', trace.knowledgeSources.join(' · ')])
    if (trace.sessionId) rows.push(['Session', trace.sessionId])
    if (trace.runId) rows.push(['Run', trace.runId])
    if (trace.workflow) rows.push(['Workflow', trace.workflow])
    if (trace.handoffFrom) rows.push(['交接来源', trace.handoffFrom])
    if (trace.sessionCompatMode) rows.push(['兼容模式', trace.sessionCompatMode])
    if (!rows.length) {
      elRunTrace.innerHTML = '<span class="wb-run-muted">任务追溯将在场景 Skill 或管线服务交接后显示</span>'
      toggleRunSection(elRunTrace, true)
      return
    }
    elRunTrace.innerHTML = rows.map(([label, value]) =>
      `<div class="wb-run-trace-row"><span class="wb-run-trace-label">${esc(label)}</span><span class="wb-run-trace-value">${esc(value)}</span></div>`
    ).join('')
    toggleRunSection(elRunTrace, true)
  }

  function daemonContextStorageKey(workflowId) {
    return `knowme.workbench.daemon-context.v1.${String(workflowId || 'default')}`
  }

  function loadDaemonContext(workflowId) {
    try {
      const raw = window.localStorage.getItem(daemonContextStorageKey(workflowId))
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  function saveDaemonContext(workflowId, context) {
    try {
      window.localStorage.setItem(daemonContextStorageKey(workflowId), JSON.stringify(context || {}))
    } catch {
      // Context persistence is an enhancement; a storage failure must not block launch.
    }
  }

  function studioSimpleModeStorageKey() {
    return 'knowme.workbench.studio.simple-mode.v1'
  }

  function loadStudioSimpleModePreference() {
    try {
      const raw = window.localStorage.getItem(studioSimpleModeStorageKey())
      if (raw === 'false') return false
      if (raw === 'true') return true
    } catch {
      // Ignore preference restore failures and fallback to default.
    }
    return false
  }

  function saveStudioSimpleModePreference(value) {
    try {
      window.localStorage.setItem(studioSimpleModeStorageKey(), value ? 'true' : 'false')
    } catch {
      // Ignore preference persistence failures and continue with in-memory state.
    }
  }

  function applyTaskProjection(res) {
    if (!res || !res.projection) return
    const projection = res.projection
    run.projection = projection
    run.workflow = projection.workflow || run.workflow
    if (run.workflow && Array.isArray(run.workflow.nodes) && run.workflow.nodes.length && model()) {
      run.graph = model().buildWorkflowGraph(run.workflow)
    } else {
      run.graph = null
    }
    if (projection.intentTitle) run.intent = projection.intentTitle
  }

  function emptyModal() {
    return {
      item: null,
      workflow: null,
      graph: null,
      loading: false,
      contextLoading: false,
      contextDefaults: null,
      dagExpanded: false,
      error: '',
      daemon: false,
      kind: 'workflow',
      initialIntent: '',
      silent: false,
      purpose: '',
      plan: null,
    }
  }

  function grabDom() {
    elShelfSurface = document.getElementById('wbShelfSurface')
    elRunSurface = document.getElementById('wbRunSurface')
    elStudioSurface = document.getElementById('wbStudioSurface')
    elShelfGrid = document.getElementById('wbShelfGrid')
    elShelfEmpty = document.getElementById('wbShelfEmpty')
    elShelfLocked = document.getElementById('wbShelfLocked')
    elShelfSummary = document.getElementById('wbShelfSummary')
    elShelfSearch = document.getElementById('wbShelfSearch')
    elShelfRecentList = document.getElementById('wbShelfRecentList')
    elShelfRecentEmpty = document.getElementById('wbShelfRecentEmpty')
    btnShelfRecentToggle = document.getElementById('wbShelfRecentToggle')
    btnShelfTaskManage = document.getElementById('wbShelfTaskManage')
    btnShelfGridToggle = document.getElementById('wbShelfGridToggle')
    elModeTabs = document.getElementById('wbModeTabs')
    elManageSurface = document.getElementById('wbManageSurface')
    elManageTabs = document.getElementById('wbManageTabs')
    elManageBack = document.getElementById('wbManageBack')
    elManageHeadTitle = document.getElementById('wbManageHeadTitle')
    elTaskSurface = document.getElementById('wbTaskSurface')
    elTaskQuickGrid = document.getElementById('wbTaskQuickGrid')
    elTaskRecentList = document.getElementById('wbTaskRecentList')
    elTaskRecentEmpty = document.getElementById('wbTaskRecentEmpty')
    btnTaskQuickToggle = document.getElementById('wbTaskQuickToggle')
    btnTaskRecentToggle = document.getElementById('wbTaskRecentToggle')
    btnTaskNew = document.getElementById('wbTaskNew')
    btnTaskManage = document.getElementById('wbTaskManage')
    elExpertTaskRoom = document.getElementById('wbExpertTaskRoom')
    elExpertTaskBody = document.getElementById('wbExpertTaskBody')
    elExpertTaskStatus = document.getElementById('wbExpertTaskStatus')
    elExpertTaskTitle = document.getElementById('wbExpertTaskTitle')
    btnExpertTaskBack = null
    elDialogueStatusBar = document.getElementById('agentDialogueStatusBar')
    elDialogueStatusTitle = document.getElementById('agentDialogueStatusTitle')
    elDialogueStatusMeta = document.getElementById('agentDialogueStatusMeta')
    elDialogueStatusState = document.getElementById('agentDialogueStatusState')
    elDialogueStatusMode = document.getElementById('agentDialogueStatusMode')
    btnDialogueStatusBack = document.getElementById('agentDialogueStatusBack')
    elTaskDashboard = document.getElementById('wbTaskDashboard')
    elWorkflowManagePage = document.getElementById('wbWorkflowManagePage')
    elWorkflowManageList = document.getElementById('wbWorkflowManageList')
    elWorkflowManageEmpty = document.getElementById('wbWorkflowManageEmpty')
    btnWorkflowManageNew = document.getElementById('wbWorkflowManageNew')
    btnWorkflowManageBack = document.getElementById('wbWorkflowManageBack')
    elRunStageInput = document.getElementById('wbRunStageInput')
    elRunStageLive = document.getElementById('wbRunStageLive')
    elRunStageResult = document.getElementById('wbRunStageResult')
    elRunInputForm = document.getElementById('wbRunInputForm')
    elRunInputHint = document.getElementById('wbRunInputHint')
    elRunInputTitle = document.getElementById('wbRunInputTitle')
    elRunBackendNote = document.getElementById('wbRunBackendNote')
    btnRunInputStart = document.getElementById('wbRunInputStart')
    btnRunInputCancel = document.getElementById('wbRunInputCancel')
    btnRunBack = document.getElementById('wbRunBack')
    elRunResultBody = document.getElementById('wbRunResultBody')
    elRunResultActions = document.getElementById('wbRunResultActions')
    elDaemonPage = document.getElementById('wbDaemonPage')
    elAutomationPage = document.getElementById('wbAutomationPage')
    elHeadSub = document.getElementById('wbHeadSub')
    elHeadTitle = document.getElementById('wbHeadTitle')
    btnReload = document.getElementById('wbReload')
    elRecentNote = document.getElementById('wbRecentNote')
    elAutomationList = document.getElementById('wbAutomationList')
    elAutomationTemplates = document.getElementById('wbAutomationTemplates')
    elAutomationHint = document.getElementById('wbAutomationHint')
    btnAutomationNew = document.getElementById('wbAutomationNew')
    elAutomationModal = document.getElementById('wbAutomationModal')
    elAutomationModalTitle = document.getElementById('wbAutomationModalTitle')
    elAutomationModalBody = document.getElementById('wbAutomationModalBody')
    elAutomationModalHint = document.getElementById('wbAutomationModalHint')
    btnAutomationModalClose = document.getElementById('wbAutomationModalClose')
    btnAutomationModalCancel = document.getElementById('wbAutomationModalCancel')
    btnAutomationModalSave = document.getElementById('wbAutomationModalSave')
    elDomainSwitcher = document.getElementById('wbDomainSwitcher')
    elStudioGraph = document.getElementById('wbStudioGraph')
    elStudioGraphMeta = document.getElementById('wbStudioGraphMeta')
    elStudioTitle = document.getElementById('wbStudioTitle')
    elStudioTitleInput = document.getElementById('wbStudioTitleInput')
    elStudioTopMeta = document.getElementById('wbStudioTopMeta')
    elStudioTools = document.getElementById('wbStudioTools')
    elStudioActions = document.getElementById('wbStudioActions')
    elStudioInspector = document.getElementById('wbStudioInspector')
    elStudioInspectorTitle = document.getElementById('wbStudioInspectorTitle')
    elStudioInspectorPane = document.querySelector('#wbStudioSurface .wb-studio-inspector')
    elStudioShell = document.querySelector('#wbStudioSurface .wb-studio-shell')
    elLeaveModal = document.getElementById('wbLeaveModal')
    elWorkflowDeleteModal = document.getElementById('wbWorkflowDeleteModal')
    elDaemonModeStatus = document.getElementById('wbDaemonModeStatus')
    elDaemonModeList = document.getElementById('wbDaemonModeList')
    elDaemonModeDetail = document.getElementById('wbDaemonModeDetail')
    elDaemonRunList = document.getElementById('wbDaemonRunList')
    elDaemonRunFilters = document.getElementById('wbDaemonRunFilters')
    elRunner = document.getElementById('wbRunner')
    elRunnerTitle = document.getElementById('wbRunnerTitle')
    elRunnerMeta = document.getElementById('wbRunnerMeta')
    elRunnerLog = document.getElementById('wbRunnerLog')
    elRunnerActions = document.getElementById('wbRunnerActions')
    elDaemonReview = document.getElementById('wbDaemonReview')
    elDaemonReviewTabs = document.getElementById('wbDaemonReviewTabs')
    elDaemonReviewBody = document.getElementById('wbDaemonReviewBody')
    elTaskContextLegacy = document.getElementById('wbTaskContextLegacy')
    elRunGoal = document.getElementById('wbRunGoal')
    elRunStatus = document.getElementById('wbRunStatus')
    elRunNextAction = document.getElementById('wbRunNextAction')
    elRunProgress = document.getElementById('wbRunProgress')
    elRunAgents = document.getElementById('wbRunAgents')
    elRunGraph = document.getElementById('wbRunGraph')
    elRunArtifacts = document.getElementById('wbRunArtifacts')
    elRunTrace = document.getElementById('wbRunTrace')
    elModal = document.getElementById('wbWorkflowModal')
    elModalTitle = document.getElementById('wbModalTitle')
    elModalBody = document.getElementById('wbModalBody')
    elModalHint = document.getElementById('wbModalHint')
    btnModalClose = document.getElementById('wbModalClose')
    btnModalCancel = document.getElementById('wbModalCancel')
    btnModalConfirm = document.getElementById('wbModalConfirm')
    elRunOutcome = document.getElementById('wbRunOutcome')
  }

  const MANAGE_PANELS = {
    workflows: { title: '工作流', el: () => elWorkflowManagePage },
    daemon: { title: '管线服务', el: () => elDaemonPage },
    automation: { title: '自动化', el: () => elAutomationPage },
  }
  const DEFAULT_MANAGE_PANEL = 'workflows'

  // 兼容既有调用方：studio/agents 已迁出；studio → 一级编排面，agents → 专家库
  function setWorkbenchPage(page, { force = false } = {}) {
    const requested = page === 'team' ? 'agents' : page
    if (requested === 'studio') {
      void openOrchestration({ force })
      return
    }
    if (requested === 'agents') {
      openCapabilityPicker('experts')
      return
    }
    if (requested === 'manage' || MANAGE_PANELS[requested]) {
      openManagePanel(MANAGE_PANELS[requested] ? requested : 'daemon')
      return
    }
    if (requested === 'tasks') { setSurface('run', { force }); return }
    // 'home' 及其它默认着陆到「任务」首页
    setSurface('taskhome', { force })
  }

  async function openOrchestration(options = {}) {
    const switchesDraft = options.reset === true
      || (options.workflowId && String(options.workflowId) !== studioDraft?.sourceWorkflowId)
    if (switchesDraft && !await confirmLeaveStudio()) return
    // 仅从非编排面切入时捕获来源；同页切换草稿保留原返回目标
    if (activeSurface !== 'studio') {
      studioReturnState = activeSurface === 'shelf'
        ? { surface: 'shelf', managePanel: '' }
        : { surface: 'manage', managePanel: 'workflows' }
    }
    if (options.reset) {
      selectedStudioWorkflowId = ''
      selectedStudioNodeId = ''
      studioDraft = null
    } else if (options.workflowId) {
      selectedStudioWorkflowId = String(options.workflowId)
      selectedStudioNodeId = ''
      studioDraft = null
    }
    setSurface('studio', { force: options.force !== false })
    ensureStudioDraft(options.reset ? { reset: true } : {})
    renderStudio()
  }

  function syncExpertTaskRoomVisibility() {
    const visible = !!expertTaskRoom && activeSurface === 'run'
    if (elExpertTaskRoom) elExpertTaskRoom.hidden = !visible
    if (elTaskDashboard) elTaskDashboard.hidden = visible
  }

  function setSurface(surface, { force = false } = {}) {
    const known = ['run', 'studio', 'manage', 'shelf', 'taskhome']
    const next = known.includes(surface) ? surface : 'shelf'
    if (!force && activeSurface === next) return
    activeSurface = next
    activePage = next === 'run' ? 'tasks' : 'home'
    if (elTaskSurface) elTaskSurface.classList.toggle('active', next === 'taskhome')
    if (elShelfSurface) elShelfSurface.classList.toggle('active', next === 'shelf')
    if (elRunSurface) elRunSurface.classList.toggle('active', next === 'run')
    if (elStudioSurface) elStudioSurface.classList.toggle('active', next === 'studio')
    if (elManageSurface) elManageSurface.classList.toggle('active', next === 'manage')
    syncExpertTaskRoomVisibility()
    if (next !== 'manage') activeManagePanel = ''
    if (elHeadTitle) elHeadTitle.textContent = next === 'run' ? '运行' : (next === 'studio' ? '编排' : '工作台')
    syncModeTabs()
    updateWorkbenchViewState({
      surface: activePage,
      taskRoom: (!!run.workflow || !!expertTaskRoom) && next === 'run',
      runMode: expertTaskRoom
        ? (expertTaskRoom.workflow ? 'workflow-chat' : 'expert-chat')
        : (run.mode || 'local'),
      phase: expertTaskRoom ? 'active' : runPhaseFromStatus(run.status),
    })
    // 先清壳层 task-room 窄栏，再量货架宽度；否则一行容量会被算成 1
    onPageChange(activePage)
    if (next === 'taskhome') renderTaskHome()
    if (next === 'shelf') {
      renderShelf()
      requestAnimationFrame(() => {
        if (activeSurface === 'shelf') paintShelfGrid()
      })
    }
    if (next === 'studio') renderStudio()
    syncShelfHomeScrollLock()
  }

  // 三 Tab 只在任务 / 货架 / 管理常驻面出现；运行与编排是带返回入口的全屏页
  // 编排 / 专家任务房：返回用右侧 wbReload；工作流运行：用 #wbRunBack，并隐藏空 wb-head
  function syncModeTabs() {
    const visible = ['taskhome', 'shelf', 'manage'].includes(activeSurface)
    const studioNav = activeSurface === 'studio'
    let activeMode = ''
    if (activeSurface === 'taskhome') activeMode = 'tasks'
    else if (activeSurface === 'shelf') activeMode = 'workflows'
    else if (activeSurface === 'manage') {
      activeMode = activeManagePanel === 'daemon'
        ? 'daemon'
        : (activeManagePanel === 'automation' ? 'tasks' : 'workflows')
    }
    if (elModeTabs) {
      elModeTabs.hidden = !visible
      elModeTabs.querySelectorAll('[data-wb-mode]').forEach(button => {
        const active = visible && button.getAttribute('data-wb-mode') === activeMode
        button.classList.toggle('active', active)
        button.setAttribute('aria-selected', active ? 'true' : 'false')
      })
    }
    if (elShelfSearch) elShelfSearch.hidden = activeSurface !== 'shelf'
    const elStudioHeadNav = document.getElementById('wbStudioHeadNav')
    if (elStudioHeadNav) elStudioHeadNav.hidden = !studioNav
    const workbenchRoot = document.getElementById('workbench')
    if (workbenchRoot) workbenchRoot.classList.toggle('wb-studio-active', studioNav)
    syncHeadActionButton()
  }

  function openManagePanel(panel) {
    const key = MANAGE_PANELS[panel] ? panel : DEFAULT_MANAGE_PANEL
    setSurface('manage', { force: true })
    activeManagePanel = key
    Object.entries(MANAGE_PANELS).forEach(([id, entry]) => {
      const el = entry.el()
      if (el) el.classList.toggle('active', id === key)
    })
    // 子 Tab 已退役：管理页现为单一用途页，经三 Tab 或页内入口进入
    if (elManageTabs) elManageTabs.hidden = true
    // 工作流管理：返回改到面板右侧图标，顶栏不再展示文字「返回」
    const backTarget = key === 'automation' ? 'tasks' : ''
    if (elManageBack) {
      elManageBack.hidden = !backTarget
      elManageBack.dataset.manageBack = backTarget
    }
    // 管线服务顶栏 Tab 已命名，不再叠一层同名页头；工作流管理由面板头自带返回
    if (elManageHeadTitle) {
      elManageHeadTitle.textContent = (key === 'daemon' || key === 'workflows')
        ? ''
        : (MANAGE_PANELS[key]?.title || '')
    }
    const manageHead = document.querySelector('.wb-manage-head')
    if (manageHead) manageHead.hidden = key === 'daemon' || key === 'workflows' || !backTarget
    if (elManageSurface) elManageSurface.classList.toggle('wb-manage-daemon', key === 'daemon')
    syncModeTabs()
    if (key === 'workflows') renderWorkflowManage()
    if (key === 'daemon') renderDaemonMode()
    if (key === 'automation') refreshAutomation()
    onPageChange(key)
  }

  function setRunStage(stage) {
    const next = ['input', 'running', 'result'].includes(stage) ? stage : 'input'
    runStage = next
    if (elRunStageInput) elRunStageInput.hidden = next !== 'input'
    if (elRunStageLive) elRunStageLive.hidden = next !== 'running'
    if (elRunStageResult) elRunStageResult.hidden = next !== 'result'
    syncRunTopbar()
  }

  // 运行视图的顶栏说明「在跑哪一条」，而不是货架的筛选状态
  function syncRunTopbar() {
    const item = run.workflow || runInputItem || workflowById(launchIntentState?.resourceId)
    const title = document.getElementById('wbStartTitle')
    const daemonLive = run.mode === 'daemon' && (runStage === 'running' || runStage === 'result' || !!run.slug)
    const titleText = daemonLive
      ? daemonRunIdentityTitle()
      : (item ? workflowDisplayNameOf(item) : '运行')
    if (title) title.textContent = titleText
    if (elRecentNote) {
      let note = ''
      if (runStage === 'input') {
        note = item ? `产出：${workflowOutcomeText(item)}` : '确认输入后开始'
      } else if (runStage === 'running') {
        try {
          note = runNodeProgressMeta()
        } catch {
          note = ''
        }
        if (!note || note === titleText || note === String(run.intent || '').trim()) {
          note = run.contextSummary || ''
        }
        if (note === titleText) note = ''
      } else if (daemonLive) {
        const wf = item ? workflowDisplayNameOf(item) : ''
        note = wf && !titleText.includes(wf) ? wf : (run.contextSummary || '')
      } else {
        note = run.intent && run.intent !== titleText ? run.intent : '查看产物'
      }
      elRecentNote.textContent = note
      elRecentNote.hidden = !note
    }
    syncRunOutcomePill()
    syncDialogueStatusBar()
  }

  /** 协作/工作流通栏：主副身份用 · 拼进同一标题（对齐管线服务） */
  function foldDialogueStatusTitle(primary, secondary) {
    const title = String(primary || '').trim()
    const meta = String(secondary || '').trim()
    if (!meta || meta === title) return { title, meta: '' }
    return { title: `${title} · ${meta}`, meta: '' }
  }

  /** 模式标签跟分类首页对齐：协作→专家协作，工作流→货架，管线服务→管线 */
  function dialogueModeFromOrigin() {
    const explicit = String(
      taskRoomReturnState?.surface || launchIntentState?.returnState?.surface || ''
    ).trim()
    if (explicit) {
      const origin = resolveReturnSurface(explicit)
      if (origin === 'daemon') return '管线服务'
      if (origin === 'shelf') return '工作流'
      return '协作'
    }
    if (run.mode === 'daemon') return '管线服务'
    if (run.workflow) return '工作流'
    return '协作'
  }

  /** task-room 通栏：模式标签（协作 / 工作流 / 管线服务）+ 具体标题 */
  function dialogueStatusProjection() {
    if (expertTaskRoom) {
      const { task, expert, workflow } = expertTaskRoom
      const goal = String(task?.goal || task?.title || '').trim()
      if (workflow && workflow.id) {
        const name = workflowDisplayNameOf(workflow) || workflow.name || '工作流'
        const folded = foldDialogueStatusTitle(name, goal && goal !== name ? goal : '')
        const modeFromOrigin = dialogueModeFromOrigin()
        return {
          visible: true,
          // 带 workflow 的对话房身份是工作流；仅当明确从管线进入时保留「管线服务」
          mode: modeFromOrigin === '管线服务' ? '管线服务' : '工作流',
          title: folded.title,
          meta: folded.meta,
        }
      }
      const expertName = expert?.name || expert?.title || task?.expertName || '专家'
      const folded = foldDialogueStatusTitle(
        goal || expertName,
        goal && expertName && goal !== expertName ? expertName : '',
      )
      return {
        visible: true,
        mode: '协作',
        title: folded.title,
        meta: folded.meta,
      }
    }
    if (run.workflow || (run.mode === 'daemon' && (run.slug || runStage !== 'input'))) {
      const item = run.workflow || runInputItem || workflowById(launchIntentState?.resourceId)
      const daemonLive = run.mode === 'daemon' && (runStage === 'running' || runStage === 'result' || !!run.slug)
      const title = daemonLive
        ? daemonRunIdentityTitle()
        : (item ? workflowDisplayNameOf(item) : '运行')
      let meta = ''
      // Daemon：顶栏只留目的标题；工作流短名改放到右栏审阅身份行
      if (daemonLive) {
        meta = ''
      } else if (run.intent && run.intent !== title) {
        meta = run.intent
      } else if (runStage === 'input') {
        meta = '确认输入'
      }
      // 按进入来源打标签，避免「货架启动的 daemon 跑批」被标成管线服务
      const mode = dialogueModeFromOrigin()
      if (mode === '工作流' || mode === '协作') {
        const folded = foldDialogueStatusTitle(title || '运行', meta)
        return {
          visible: true,
          mode: mode === '协作' && item ? '工作流' : mode,
          title: folded.title,
          meta: folded.meta,
        }
      }
      return {
        visible: true,
        mode,
        title: title || '运行',
        meta,
      }
    }
    return { visible: false, mode: '', title: '', meta: '' }
  }

  function syncDialogueStatusBar() {
    const projection = dialogueStatusProjection()
    const inTaskRoom = !!viewState.taskRoom || !!expertTaskRoom
      || !!(run.workflow && activeSurface === 'run')
    const show = inTaskRoom && projection.visible
    if (elDialogueStatusBar) elDialogueStatusBar.hidden = !show
    if (elDialogueStatusMode) {
      const mode = String(projection.mode || '').trim()
      elDialogueStatusMode.textContent = mode
      elDialogueStatusMode.hidden = !mode
      elDialogueStatusMode.dataset.mode = mode || ''
    }
    if (elDialogueStatusTitle) {
      elDialogueStatusTitle.textContent = projection.title || '当前协作'
    }
    if (elDialogueStatusMeta) {
      const meta = String(projection.meta || '').trim()
      elDialogueStatusMeta.textContent = meta
      elDialogueStatusMeta.hidden = !meta || meta === projection.title || meta === projection.mode
    }
    if (elDialogueStatusState) {
      let stateLabel = ''
      let stateTone = 'running'
      if (expertTaskRoom) {
        const fallbackStatus = expertTaskRoom?.workflow ? '对话中' : '协作中'
        stateLabel = String(elExpertTaskStatus?.textContent || fallbackStatus).trim() || fallbackStatus
        stateTone = 'done'
      } else {
        try {
          const outcome = runOutcomePresentation()
          if (outcome?.visible && outcome.label) {
            stateLabel = outcome.label
            stateTone = outcome.tone || 'running'
          }
        } catch {
          stateLabel = ''
        }
      }
      elDialogueStatusState.textContent = stateLabel
      elDialogueStatusState.hidden = !stateLabel
      elDialogueStatusState.className = stateLabel
        ? `agent-dialogue-status-state tone-${stateTone}`
        : 'agent-dialogue-status-state'
    }
    if (show && btnDialogueStatusBack && window.StickyIcons) {
      window.StickyIcons.mount(btnDialogueStatusBack)
    }
  }

  /** 对话房返回：一律按进入来源回到专家协作 / 工作流 / 管线服务 */
  function leaveDialogueTaskRoom() {
    if (expertTaskRoom) {
      closeExpertTaskRoom()
      return
    }
    void backToRunList()
  }

  /** L1：任务结论 pill（唯一全局 outcome 位） */
  function runOutcomePresentation() {
    if (runStage === 'input') return { visible: false, label: '', tone: 'muted' }
    const degraded = !!(run.projection && run.projection.degraded)
    const lifecycle = lifecycleApi()
    if (lifecycle && (run.workflow || run.slug || run.rootRunId || run.mode === 'daemon' || run.mode === 'agent-graph')) {
      const projected = lifecycle.projectRunLifecycle(runLifecycleInput())
      if (degraded && !projected.terminal) {
        return { visible: true, label: '详情受限', tone: 'muted' }
      }
      const raw = String(run.status || '').toLowerCase()
      if (projected.kind === 'active' && ['queued', 'pending'].includes(raw)) {
        return { visible: true, label: '排队中', tone: 'running' }
      }
      if (run.workflow || run.slug || run.rootRunId || runStage === 'running' || runStage === 'result') {
        return { visible: true, label: projected.outcomeLabel, tone: projected.tone }
      }
      return { visible: false, label: '', tone: 'muted' }
    }
    const status = String(run.status || run.terminalKind || '').toLowerCase()
    const terminal = String(run.terminalKind || '').toLowerCase()
    let waitingKind = 'none'
    try {
      if (run.workflow || run.mode === 'daemon' || run.mode === 'agent-graph') {
        waitingKind = String(workbenchTaskContext().waitingKind || 'none')
      }
    } catch {
      waitingKind = 'none'
    }
    const waiting = waitingKind === 'gate' || waitingKind === 'clarification'
      || (Array.isArray(run.pendingGates) && run.pendingGates.length)
      || ['waiting', 'blocked', 'gate', 'clarification', 'needs_input', 'needs-input'].includes(status)
      || !!(run.task && (
        (Array.isArray(run.task.pending_clarifications) && run.task.pending_clarifications.length)
        || (Array.isArray(run.task.pending_gates) && run.task.pending_gates.length)
      ))
    // 对齐 Daemon WebUI：HITL / 等待优先于完成（避免 job.completed 误标已完成）
    if (waiting) {
      return { visible: true, label: '等待你', tone: 'waiting' }
    }
    if (runSucceeded() || terminal === 'success' || ['done', 'success', 'completed', 'finished'].includes(status)) {
      return { visible: true, label: '已完成', tone: 'done' }
    }
    if (terminal === 'failure' || ['failed', 'error', 'rejected'].includes(status)) {
      return { visible: true, label: '失败', tone: 'error' }
    }
    if (terminal === 'cancelled' || ['cancelled', 'canceled'].includes(status)) {
      return { visible: true, label: '已取消', tone: 'muted' }
    }
    if (degraded) return { visible: true, label: '详情受限', tone: 'muted' }
    if (['queued', 'pending'].includes(status)) return { visible: true, label: '排队中', tone: 'running' }
    if (run.workflow || run.slug || run.rootRunId || runStage === 'running' || runStage === 'result') {
      return { visible: true, label: '执行中', tone: 'running' }
    }
    return { visible: false, label: '', tone: 'muted' }
  }

  function syncRunOutcomePill() {
    if (!elRunOutcome) return
    const next = runOutcomePresentation()
    elRunOutcome.hidden = !next.visible
    elRunOutcome.textContent = next.visible ? next.label : ''
    elRunOutcome.className = next.visible
      ? `wb-run-outcome tone-${next.tone}`
      : 'wb-run-outcome'
  }

  /** L2：节点进度摘要，禁止单独复述失败/完成结论 */
  function runNodeProgressMeta() {
    const nodes = graphNodes()
    const progress = progressSummary(nodes)
    const pureOutcome = new Set(['执行失败', '已完成', '已取消', '流程执行中', '进行中', '排队中', '等待中', '执行中'])
    const degraded = !!(run.projection && run.projection.degraded)
    if (degraded) {
      return runSucceeded() ? '已结束 · 流程详情暂不可用' : '流程详情暂不可用'
    }

    if (run.mode !== 'daemon' && run.mode !== 'agent-graph') {
      try {
        const node = typeof currentNode === 'function' ? currentNode() : null
        if (node && typeof model === 'function' && model()) {
          const type = model().nodeTypeLabel(node.type)
          const title = model().nodeTitle(node, agentsById())
          if (title) return `${type} · ${title}`
          if (type) return type
        }
      } catch {
        /* ignore local graph helpers missing during input */
      }
      if (runSucceeded()) return (progress && !pureOutcome.has(progress)) ? progress : '流程已完成'
      return (progress && !pureOutcome.has(progress)) ? progress : '节点推进中'
    }

    let context = null
    try {
      if (run.workflow || run.mode === 'daemon' || run.mode === 'agent-graph') {
        context = workbenchTaskContext()
      }
    } catch {
      context = null
    }

    if (context && (context.waitingKind === 'gate' || context.waitingKind === 'clarification')) {
      const wait = context.waitingTitle || '等待处理'
      return progress && !pureOutcome.has(progress) ? `${wait} · ${progress}` : wait
    }

    if (run.mode === 'agent-graph' && Array.isArray(run.pendingGates) && run.pendingGates.length) {
      return progress && !pureOutcome.has(progress) ? `等待审批 · ${progress}` : '等待审批'
    }

    let nodeLabel = context && context.currentNode ? String(context.currentNode) : ''
    if (!nodeLabel || pureOutcome.has(nodeLabel)) {
      const list = Array.isArray(nodes) ? nodes : []
      const errorNode = list.find((node, index) => {
        const status = String(node && node.status || '').toLowerCase()
        return ['failed', 'error', 'rejected'].includes(status)
          || nodeVisualStatus(node, index, list) === 'error'
      })
      const activeNode = list.find((node, index) => nodeVisualStatus(node, index, list) === 'active')
      const pick = errorNode || activeNode
      nodeLabel = pick ? String(pick.label || pick.id || '').trim() : ''
    }

    const safeProgress = progress && !pureOutcome.has(progress) ? progress : ''
    if (nodeLabel && safeProgress && !safeProgress.includes(nodeLabel)) return `${nodeLabel} · ${safeProgress}`
    if (nodeLabel) return nodeLabel
    if (safeProgress) return safeProgress
    return runSucceeded() ? '流程已完成' : '节点推进中'
  }

  function automationStatusLabel(status) {
    const value = String(status || 'idle').toLowerCase()
    if (['done', 'success', 'completed', 'finished'].includes(value)) return '成功'
    if (['running', 'queued', 'pending'].includes(value)) return '执行中'
    if (['failed', 'error', 'rejected'].includes(value)) return '失败'
    if (['paused', 'disabled'].includes(value)) return '已暂停'
    return '未执行'
  }

  function automationTemplateIcon(templateId) {
    return {
      'daily-ai-news': 'optimize',
      'daily-work-brief': 'list',
      'pre-meeting-brief': 'users',
      'post-meeting-minutes': 'edit',
      'pr-task-digest': 'code',
      'daily-todo-review': 'check',
      'weekly-goal-review': 'calendarRange',
      'risk-blocker-alert': 'triangleAlert',
    }[String(templateId || '')] || 'automation'
  }

  function renderAutomation() {
    if (!elAutomationList || !elAutomationTemplates) return
    const automation = data.automation || { jobs: [], templates: [] }
    const jobs = Array.isArray(automation.jobs) ? automation.jobs : []
    const templates = Array.isArray(automation.templates) ? automation.templates : []
    const automationProjection = new Map((data.console?.automation || []).map(item => [item.id, item]))
    if (elAutomationHint) {
      elAutomationHint.textContent = window.WorkbenchTaskComposerSchedule?.COPY?.automationListHint
        || '侧栏自动化绑定可执行管线后才会按计划触发；未绑定的计划仅为草稿，不会后台自动运行'
    }
    elAutomationList.innerHTML = jobs.length
      ? jobs.map(job => {
        const status = String(job.lastStatus || 'idle').toLowerCase()
        const state = automationStatusLabel(status)
        const projected = automationProjection.get(job.id)
        const runCapable = projected
          ? projected.runCapable === true
          : Boolean(job.workflowId && job.domain && job.backend)
        return `
        <article class="wb-automation-card ${esc(status)}" data-automation="${esc(job.id)}">
          <header class="wb-automation-card-head">
            <h3>${esc(job.name || '未命名自动化')}</h3>
            <span class="wb-automation-pill ${job.enabled === false ? 'paused' : 'active'}">${job.enabled === false ? '已关闭' : '已启用'}</span>
          </header>
          <div class="wb-automation-meta">触发：${esc(job.scheduleLabel || '未配置')}</div>
          <div class="wb-automation-meta">上次：${esc(job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '未执行')} · ${esc(state)}</div>
          <div class="wb-automation-meta">下次：${esc(job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '等待计算')}</div>
          ${runCapable ? '' : '<div class="wb-automation-meta">执行：尚未绑定可执行管线</div>'}
          <div class="wb-automation-actions">
            <button type="button" class="wb-run-btn" data-auto-action="toggle">${job.enabled === false ? '启用' : '停用'}</button>
            ${runCapable ? '<button type="button" class="wb-run-btn" data-auto-action="run">立即执行</button>' : ''}
            <button type="button" class="wb-run-btn" data-auto-action="edit">编辑</button>
            <button type="button" class="wb-run-btn" data-auto-action="delete">删除</button>
          </div>
        </article>
      `
      }).join('')
      : '<div class="wb-template-empty"><strong>还没有自动化任务</strong>先从下方模板创建一条，再按你的节奏微调。</div>'
    elAutomationTemplates.innerHTML = templates.length
      ? templates.map(template => `
        <button type="button" class="wb-automation-template" data-auto-template-action="create" data-auto-template="${esc(template.id || '')}">
          <div class="wb-automation-template-head">
            <span class="wb-automation-template-icon" aria-hidden="true"><span class="ico" data-icon="${automationTemplateIcon(template.id)}"></span></span>
            <div class="wb-automation-template-title">${esc(template.title || template.id || '自动化模板')}</div>
          </div>
          <div class="wb-automation-template-desc">${esc(template.description || '可复用任务模板')}</div>
          <div class="wb-automation-template-foot">
            <div class="wb-automation-template-meta">${esc(template.scheduleHint || '按需配置执行频率')}</div>
            <span class="ico wb-automation-template-arrow" data-icon="chevronRight" aria-hidden="true"></span>
          </div>
        </button>
      `).join('')
      : '<div class="wb-template-empty"><strong>模板加载中</strong>请稍后刷新。</div>'
    if (window.StickyIcons) window.StickyIcons.mount(elAutomationPage || document.getElementById('workbench'))
  }

  async function refreshAutomation() {
    if (!window.api || !window.api.workbenchAutomationList) return
    let res
    try { res = await window.api.workbenchAutomationList() } catch (error) { res = { ok: false, error: error.message } }
    if (!res || !res.ok) {
      if (elAutomationHint) elAutomationHint.textContent = (res && res.error) || '自动化列表加载失败'
      return
    }
    data.automation = {
      jobs: Array.isArray(res.jobs) ? res.jobs : [],
      templates: Array.isArray(res.templates) ? res.templates : [],
    }
    renderAutomation()
  }

  function templateById(id) {
    const templates = data.automation && Array.isArray(data.automation.templates)
      ? data.automation.templates
      : []
    return templates.find(item => item.id === id) || null
  }

  async function loadAutomationConnectors() {
    if (!window.api || !window.api.connectorsList) return []
    try {
      const res = await window.api.connectorsList()
      const list = Array.isArray(res && res.connectors) ? res.connectors : []
      automationConnectors = list
        .filter(item => item && item.id && item.enabled !== false)
        .map(item => ({
          id: String(item.id),
          name: String(item.name || item.id),
          status: String(item.status && item.status.code || ''),
        }))
      return automationConnectors
    } catch {
      return automationConnectors
    }
  }

  function defaultDraft(template = null) {
    const schedule = template && template.schedule
      ? {
          type: template.schedule.type || 'daily',
          dailyTime: template.schedule.dailyTime || '09:00',
          intervalValue: Number(template.schedule.intervalValue || 24),
          intervalUnit: template.schedule.intervalUnit || 'hour',
          onceAt: template.schedule.onceAt || '',
        }
      : {
          type: 'daily',
          dailyTime: '09:00',
          intervalValue: 24,
          intervalUnit: 'hour',
          onceAt: '',
        }
    return {
      mode: 'create',
      editId: '',
      templateId: template ? String(template.id || '') : '',
      name: template ? String(template.title || '').trim() : '',
      workspaceId: '',
      prompt: template ? String(template.prompt || '').trim() : '',
      connectorId: '',
      workflowId: '',
      domain: activeLaunchDomain(),
      backend: '',
      schedule,
      dateRange: { start: '', end: '' },
      permissionMode: 'default',
      pushTargets: {
        miniApp: false,
        bot: false,
        userTargets: [],
        groupTargets: [],
        selectedUserId: '',
        selectedGroupId: '',
      },
      enabled: true,
    }
  }

  function draftFromJob(job) {
    return {
      mode: 'edit',
      editId: String(job.id || ''),
      templateId: String(job.templateId || ''),
      name: String(job.name || ''),
      workspaceId: String(job.workspaceId || ''),
      prompt: String(job.prompt || ''),
      connectorId: String(job.connectorId || ''),
      workflowId: String(job.workflowId || ''),
      domain: String(job.domain || activeLaunchDomain()),
      backend: String(job.backend || ''),
      schedule: {
        type: String(job.schedule && job.schedule.type || 'daily'),
        dailyTime: String(job.schedule && job.schedule.dailyTime || '09:00'),
        intervalValue: Number(job.schedule && job.schedule.intervalValue || 24),
        intervalUnit: String(job.schedule && job.schedule.intervalUnit || 'hour'),
        onceAt: String(job.schedule && job.schedule.onceAt || ''),
      },
      dateRange: {
        start: String(job.dateRange && job.dateRange.start || ''),
        end: String(job.dateRange && job.dateRange.end || ''),
      },
      permissionMode: job.permissionMode === 'full' ? 'full' : 'default',
      pushTargets: {
        miniApp: !!(job.pushTargets && job.pushTargets.miniApp),
        bot: !!(job.pushTargets && job.pushTargets.bot),
        userTargets: Array.isArray(job.pushTargets && job.pushTargets.userTargets)
          ? job.pushTargets.userTargets
          : [],
        groupTargets: Array.isArray(job.pushTargets && job.pushTargets.groupTargets)
          ? job.pushTargets.groupTargets
          : [],
        selectedUserId: String(
          job.pushTargets && Array.isArray(job.pushTargets.userTargets) && job.pushTargets.userTargets[0]
            ? job.pushTargets.userTargets[0].id || ''
            : ''
        ),
        selectedGroupId: String(
          job.pushTargets && Array.isArray(job.pushTargets.groupTargets) && job.pushTargets.groupTargets[0]
            ? job.pushTargets.groupTargets[0].id || ''
            : ''
        ),
      },
      enabled: job.enabled !== false,
    }
  }

  function scheduleRowsVisibility() {
    if (!elAutomationModalBody) return
    const type = elAutomationModalBody.querySelector('#wbAutoScheduleType')
    const val = type ? String(type.value || 'daily') : 'daily'
    elAutomationModalBody.querySelectorAll('[data-auto-schedule]').forEach(row => {
      row.hidden = row.getAttribute('data-auto-schedule') !== val
    })
  }

  function pushTargetRowsVisibility() {
    if (!elAutomationModalBody) return
    const userOn = !!elAutomationModalBody.querySelector('#wbAutoPushMiniApp')?.checked
    const groupOn = !!elAutomationModalBody.querySelector('#wbAutoPushBot')?.checked
    const userPanel = elAutomationModalBody.querySelector('[data-auto-target="user"]')
    const groupPanel = elAutomationModalBody.querySelector('[data-auto-target="group"]')
    if (userPanel) userPanel.hidden = !userOn
    if (groupPanel) groupPanel.hidden = !groupOn
  }

  async function fetchFeishuTargetOptions(mode, query = '') {
    if (!window.api || !window.api.workbenchAutomationFeishuTargets) return []
    const res = await window.api.workbenchAutomationFeishuTargets({ mode, query, limit: 20 })
    if (!res || !res.ok) {
      throw new Error((res && res.error) || '读取飞书目标失败')
    }
    return Array.isArray(res.items) ? res.items : []
  }

  async function preloadFeishuTargetsForDraft(draft) {
    const needUserTargets = !!(draft && draft.pushTargets && draft.pushTargets.miniApp)
    const needGroupTargets = !!(draft && draft.pushTargets && draft.pushTargets.bot)
    if (!needUserTargets && !needGroupTargets) return
    const jobs = []
    if (needUserTargets) {
      jobs.push(
        fetchFeishuTargetOptions('user', '').then(items => {
          feishuTargetOptions.users = items
        })
      )
    }
    if (needGroupTargets) {
      jobs.push(
        fetchFeishuTargetOptions('chat', '').then(items => {
          feishuTargetOptions.chats = items
        })
      )
    }
    await Promise.all(jobs)
  }

  function targetDisplay(item) {
    const id = String(item && item.id || '').trim()
    const name = String(item && item.name || id).trim()
    if (!name && !id) return ''
    if (name && id && name !== id) return `${name}（${id}）`
    return name || id
  }

  function targetOptionsMarkup(items) {
    const list = Array.isArray(items) ? items : []
    return list
      .filter(item => item && item.id)
      .map(item => `<option value="${escAttr(targetDisplay(item))}" data-id="${escAttr(item.id)}"></option>`)
      .join('')
  }

  function targetInputId(mode) {
    return mode === 'user' ? '#wbAutoUserTargetInput' : '#wbAutoGroupTargetInput'
  }

  function targetHiddenId(mode) {
    return mode === 'user' ? '#wbAutoUserTargetId' : '#wbAutoGroupTargetId'
  }

  function targetListId(mode) {
    return mode === 'user' ? '#wbAutoUserTargetList' : '#wbAutoGroupTargetList'
  }

  function syncTargetPickerId(mode) {
    if (!elAutomationModalBody) return ''
    const input = elAutomationModalBody.querySelector(targetInputId(mode))
    const hidden = elAutomationModalBody.querySelector(targetHiddenId(mode))
    const list = elAutomationModalBody.querySelector(targetListId(mode))
    if (!input || !hidden || !list) return ''
    const text = String(input.value || '').trim()
    if (!text) {
      hidden.value = ''
      return ''
    }
    const option = [...list.querySelectorAll('option')]
      .find(item => String(item.value || '').trim() === text)
    hidden.value = option ? String(option.dataset.id || '').trim() : ''
    return hidden.value
  }

  function fillTargetPicker(mode, items, placeholder) {
    if (!elAutomationModalBody) return
    const input = elAutomationModalBody.querySelector(targetInputId(mode))
    const hidden = elAutomationModalBody.querySelector(targetHiddenId(mode))
    const list = elAutomationModalBody.querySelector(targetListId(mode))
    if (!input || !hidden || !list) return
    list.innerHTML = targetOptionsMarkup(items)
    const selectedId = String(hidden.value || '').trim()
    if (selectedId) {
      const matched = (Array.isArray(items) ? items : []).find(item => String(item && item.id || '') === selectedId)
      if (matched) input.value = targetDisplay(matched)
    }
    input.placeholder = placeholder
    syncTargetPickerId(mode)
  }

  function targetDisplayById(id, options, fallback = []) {
    const key = String(id || '').trim()
    if (!key) return ''
    const pool = [
      ...(Array.isArray(options) ? options : []),
      ...(Array.isArray(fallback) ? fallback : []),
    ]
    const match = pool.find(item => String(item && item.id || '') === key)
    return match ? targetDisplay(match) : key
  }

  function renderAutomationModalForm() {
    if (!elAutomationModalBody || !automationDraft) return
    const d = automationDraft
    const userTargetValue = targetDisplayById(
      d.pushTargets.selectedUserId,
      feishuTargetOptions.users,
      d.pushTargets.userTargets,
    )
    const groupTargetValue = targetDisplayById(
      d.pushTargets.selectedGroupId,
      feishuTargetOptions.chats,
      d.pushTargets.groupTargets,
    )
    const connectorOptions = [
      '<option value="">不绑定连接器（Auto）</option>',
      ...automationConnectors.map(item =>
        `<option value="${escAttr(item.id)}"${item.id === d.connectorId ? ' selected' : ''}>${esc(item.name)}${item.status === 'auth_required' ? '（需授权）' : ''}</option>`),
    ].join('')
    const automationPipelines = activeWorkflowPackages()
      .filter(item => String(item.status || 'published') !== 'unavailable')
      .map(item => {
        const backends = (Array.isArray(item.executionBackends) ? item.executionBackends : [])
          .filter(backend => ['daemon', 'local-team'].includes(String(backend || '')))
        const backend = d.workflowId === item.id && d.backend
          ? d.backend
          : (backends.includes('daemon') && data.daemon?.online ? 'daemon' : (backends[0] || ''))
        return {
          id: item.id,
          name: item.name || item.id,
          domain: consoleDomainOf(item),
          backend,
        }
      })
      .filter(item => item.id && item.backend)
    const workflowOptions = [
      '<option value="">不绑定管线（仅保存计划，不可立即执行）</option>',
      ...automationPipelines.map(item =>
        `<option value="${escAttr(item.id)}" data-domain="${escAttr(item.domain)}" data-backend="${escAttr(item.backend)}"${item.id === d.workflowId ? ' selected' : ''}>${esc(item.name)} · ${esc(consoleSourceLabel(item.backend))}</option>`),
    ].join('')
    const title = d.mode === 'edit' ? '编辑自动化' : '添加自动化'
    if (elAutomationModalTitle) elAutomationModalTitle.textContent = title
    if (btnAutomationModalSave) btnAutomationModalSave.textContent = d.mode === 'edit' ? '保存修改' : '确认创建'
    elAutomationModalBody.innerHTML = `
      <div class="wb-auto-grid">
        <div class="wb-auto-field full">
          <label for="wbAutoName">名称</label>
          <input id="wbAutoName" class="wb-auto-input" maxlength="60" value="${escAttr(d.name)}" placeholder="例如：每日 AI 新闻推送">
        </div>
        <div class="wb-auto-field full">
          <label for="wbAutoWorkspace">工作空间（可选）</label>
          <input id="wbAutoWorkspace" class="wb-auto-input" maxlength="80" value="${escAttr(d.workspaceId)}" placeholder="例如：my-project / team-space">
        </div>
        <div class="wb-auto-field full">
          <label for="wbAutoPrompt">提示词</label>
          <textarea id="wbAutoPrompt" class="wb-auto-textarea" placeholder="描述自动化执行目标、输出结构与约束">${esc(d.prompt)}</textarea>
        </div>
        <div class="wb-auto-field full">
          <label for="wbAutoWorkflow">执行管线</label>
          <select id="wbAutoWorkflow" class="wb-auto-select">${workflowOptions}</select>
          <small>绑定后“立即执行”和定时触发都会进入统一运行目录；缺少依赖的管线不会出现在这里。</small>
        </div>
        <div class="wb-auto-field">
          <label for="wbAutoConnector">连接器</label>
          <select id="wbAutoConnector" class="wb-auto-select">${connectorOptions}</select>
        </div>
        <div class="wb-auto-field">
          <label for="wbAutoPermissionMode">执行权限</label>
          <select id="wbAutoPermissionMode" class="wb-auto-select">
            <option value="default"${d.permissionMode !== 'full' ? ' selected' : ''}>默认权限</option>
            <option value="full"${d.permissionMode === 'full' ? ' selected' : ''}>完全访问权限</option>
          </select>
        </div>
      </div>
      <div class="wb-auto-sep"></div>
      <div class="wb-auto-one-line-grid">
        <div class="wb-auto-field">
          <label for="wbAutoScheduleType">执行频率与时间</label>
          <div class="wb-auto-frequency-control">
            <select id="wbAutoScheduleType" class="wb-auto-select">
            <option value="daily"${d.schedule.type === 'daily' ? ' selected' : ''}>周期（每天）</option>
            <option value="interval"${d.schedule.type === 'interval' ? ' selected' : ''}>按间隔</option>
            <option value="once"${d.schedule.type === 'once' ? ' selected' : ''}>单次</option>
            </select>
            <input id="wbAutoDailyTime" class="wb-auto-input" type="time" value="${escAttr(d.schedule.dailyTime || '09:00')}" aria-label="每天时间" data-auto-schedule="daily">
            <input id="wbAutoIntervalValue" class="wb-auto-input" type="number" min="1" max="720" value="${escAttr(String(d.schedule.intervalValue || 24))}" aria-label="间隔值" placeholder="间隔值" data-auto-schedule="interval" hidden>
            <select id="wbAutoIntervalUnit" class="wb-auto-select" aria-label="间隔单位" data-auto-schedule="interval" hidden>
              <option value="hour"${d.schedule.intervalUnit === 'hour' ? ' selected' : ''}>小时</option>
              <option value="day"${d.schedule.intervalUnit === 'day' ? ' selected' : ''}>天</option>
            </select>
            <input id="wbAutoOnceAt" class="wb-auto-input" type="datetime-local" value="${escAttr(d.schedule.onceAt || '')}" aria-label="单次时间" data-auto-schedule="once" hidden>
          </div>
        </div>
        <div class="wb-auto-field">
          <label for="wbAutoStartDate">有效期（可选）</label>
          <div class="wb-auto-date-range" role="group" aria-label="自动化有效期">
            <input id="wbAutoStartDate" class="wb-auto-input" type="date" value="${escAttr(d.dateRange.start || '')}" aria-label="有效期开始日">
            <span class="wb-auto-date-sep" aria-hidden="true">至</span>
            <input id="wbAutoEndDate" class="wb-auto-input" type="date" value="${escAttr(d.dateRange.end || '')}" aria-label="有效期结束日">
          </div>
        </div>
      </div>
      <div class="wb-auto-row wb-auto-push-row">
        <span class="wb-auto-inline-label">推送目标</span>
        <label class="wb-auto-radio"><input id="wbAutoPushMiniApp" type="checkbox"${d.pushTargets.miniApp ? ' checked' : ''}> 推送到飞书个人会话</label>
        <label class="wb-auto-radio"><input id="wbAutoPushBot" type="checkbox"${d.pushTargets.bot ? ' checked' : ''}> 推送到飞书群会话</label>
      </div>
      <div class="wb-auto-grid" data-auto-target="user" hidden>
        <div class="wb-auto-field full">
          <label for="wbAutoUserTargetInput">发送给谁（可输入检索）</label>
          <input id="wbAutoUserTargetInput" class="wb-auto-input" value="${escAttr(userTargetValue)}" placeholder="输入姓名/邮箱并从下拉建议中选择" list="wbAutoUserTargetList" autocomplete="off">
          <datalist id="wbAutoUserTargetList">${targetOptionsMarkup(feishuTargetOptions.users)}</datalist>
          <input id="wbAutoUserTargetId" type="hidden" value="${escAttr(d.pushTargets.selectedUserId || '')}">
        </div>
      </div>
      <div class="wb-auto-grid" data-auto-target="group" hidden>
        <div class="wb-auto-field full">
          <label for="wbAutoGroupTargetInput">发送到哪个群（可输入检索）</label>
          <input id="wbAutoGroupTargetInput" class="wb-auto-input" value="${escAttr(groupTargetValue)}" placeholder="输入群名并从下拉建议中选择" list="wbAutoGroupTargetList" autocomplete="off">
          <datalist id="wbAutoGroupTargetList">${targetOptionsMarkup(feishuTargetOptions.chats)}</datalist>
          <input id="wbAutoGroupTargetId" type="hidden" value="${escAttr(d.pushTargets.selectedGroupId || '')}">
        </div>
      </div>
    `
    scheduleRowsVisibility()
    pushTargetRowsVisibility()
    if (window.StickyIcons) window.StickyIcons.mount(elAutomationModalBody)
  }

  async function openAutomationModal(draft) {
    automationDraft = draft
    feishuTargetOptions = {
      users: Array.isArray(draft.pushTargets && draft.pushTargets.userTargets) ? draft.pushTargets.userTargets : [],
      chats: Array.isArray(draft.pushTargets && draft.pushTargets.groupTargets) ? draft.pushTargets.groupTargets : [],
      userQuery: '',
      chatQuery: '',
    }
    await loadAutomationConnectors()
    try {
      // 仅在已勾选飞书推送目标时才预拉取，避免模板创建时无关权限弹错。
      await preloadFeishuTargetsForDraft(draft)
    } catch (error) {
      toastFn(error.message || '读取飞书目标失败', 'error')
    }
    renderAutomationModalForm()
    if (elAutomationModal) elAutomationModal.hidden = false
    if (elAutomationModalHint) {
      elAutomationModalHint.textContent = '自动化在本机执行；须绑定可执行管线才会按计划触发。关闭电脑或退出客户端后不会后台运行。'
    }
  }

  function closeAutomationModal() {
    if (elAutomationModal) elAutomationModal.hidden = true
    automationDraft = null
  }

  function readAutomationModalPayload() {
    if (!elAutomationModalBody) return null
    syncTargetPickerId('user')
    syncTargetPickerId('chat')
    const name = String(elAutomationModalBody.querySelector('#wbAutoName')?.value || '').trim()
    const prompt = String(elAutomationModalBody.querySelector('#wbAutoPrompt')?.value || '').trim()
    const scheduleType = String(elAutomationModalBody.querySelector('#wbAutoScheduleType')?.value || 'daily')
    const workflowSelect = elAutomationModalBody.querySelector('#wbAutoWorkflow')
    const workflowOption = workflowSelect?.selectedOptions?.[0]
    const payload = {
      name,
      workspaceId: String(elAutomationModalBody.querySelector('#wbAutoWorkspace')?.value || '').trim(),
      prompt,
      connectorId: String(elAutomationModalBody.querySelector('#wbAutoConnector')?.value || '').trim(),
      workflowId: String(workflowSelect?.value || '').trim(),
      domain: String(workflowOption?.dataset?.domain || automationDraft?.domain || activeLaunchDomain()).trim(),
      backend: String(workflowOption?.dataset?.backend || automationDraft?.backend || '').trim(),
      permissionMode: String(elAutomationModalBody.querySelector('#wbAutoPermissionMode')?.value || 'default') === 'full' ? 'full' : 'default',
      schedule: {
        type: scheduleType,
        dailyTime: String(elAutomationModalBody.querySelector('#wbAutoDailyTime')?.value || '09:00'),
        intervalValue: Number(elAutomationModalBody.querySelector('#wbAutoIntervalValue')?.value || 24),
        intervalUnit: String(elAutomationModalBody.querySelector('#wbAutoIntervalUnit')?.value || 'hour'),
        onceAt: String(elAutomationModalBody.querySelector('#wbAutoOnceAt')?.value || ''),
      },
      dateRange: {
        start: String(elAutomationModalBody.querySelector('#wbAutoStartDate')?.value || ''),
        end: String(elAutomationModalBody.querySelector('#wbAutoEndDate')?.value || ''),
      },
      pushTargets: {
        miniApp: !!elAutomationModalBody.querySelector('#wbAutoPushMiniApp')?.checked,
        bot: !!elAutomationModalBody.querySelector('#wbAutoPushBot')?.checked,
        userTargets: [],
        groupTargets: [],
      },
      enabled: true,
      templateId: automationDraft && automationDraft.templateId ? automationDraft.templateId : '',
    }
    if (!payload.workflowId) payload.backend = ''
    const selectedUserId = String(elAutomationModalBody.querySelector('#wbAutoUserTargetId')?.value || '').trim()
    const selectedGroupId = String(elAutomationModalBody.querySelector('#wbAutoGroupTargetId')?.value || '').trim()
    if (payload.pushTargets.miniApp) {
      if (!selectedUserId) return { error: '请在下拉建议中选择飞书个人会话接收人' }
      const selectedUser = (feishuTargetOptions.users || []).find(item => item.id === selectedUserId)
      payload.pushTargets.userTargets = [{ id: selectedUserId, name: selectedUser ? selectedUser.name : selectedUserId }]
    }
    if (payload.pushTargets.bot) {
      if (!selectedGroupId) return { error: '请在下拉建议中选择飞书群会话' }
      const selectedGroup = (feishuTargetOptions.chats || []).find(item => item.id === selectedGroupId)
      payload.pushTargets.groupTargets = [{ id: selectedGroupId, name: selectedGroup ? selectedGroup.name : selectedGroupId }]
    }
    if (!payload.name) return { error: '请填写自动化名称' }
    if (!payload.prompt) return { error: '请填写提示词' }
    if (payload.schedule.type === 'once' && !payload.schedule.onceAt) return { error: '请填写单次执行时间' }
    return { payload }
  }

  async function saveAutomationModal() {
    if (!window.api) return
    const parsed = readAutomationModalPayload()
    if (!parsed || parsed.error) {
      toastFn((parsed && parsed.error) || '自动化配置无效', 'error')
      return
    }
    if (parsed.payload.permissionMode === 'full') {
      const ok = window.confirm('该自动化将以完全访问权限执行，可能进行文件写入或外部调用。请确认你理解风险并继续。')
      if (!ok) return
    }
    const isEdit = !!(automationDraft && automationDraft.mode === 'edit' && automationDraft.editId)
    let res
    if (isEdit) {
      res = await window.api.workbenchAutomationUpdate(automationDraft.editId, parsed.payload)
    } else {
      res = await window.api.workbenchAutomationCreate(parsed.payload)
    }
    if (!res || !res.ok) {
      toastFn((res && res.error) || '自动化保存失败', 'error')
      return
    }
    closeAutomationModal()
    await refreshAutomation()
    toastFn(isEdit ? '自动化已更新' : '自动化已创建', 'success')
  }

  function agentById(id) {
    return data.agents.find(a => a.id === id) || null
  }

  function workflowById(id) {
    const existing = activeWorkflows().find(w => w.id === id)
    if (existing) return existing
    const packageItem = (Array.isArray(data.workflowPackages) ? data.workflowPackages : [])
      .find(item => item.id === id)
    if (!packageItem) return null
    return {
      ...packageItem,
      path: packageItem.path || packageItem.provenance?.path || '',
      summary: packageItem.summary || packageItem.description || '',
      tags: packageItem.tags || packageItem.goalTypes || [],
      executionSource: resolveWorkflowExecutionSource(packageItem),
    }
  }

  function consoleDomainOf(item = {}) {
    const values = [
      item.domain,
      item.modeId,
      item.workMode,
      ...(Array.isArray(item.workModes) ? item.workModes : []),
      ...(Array.isArray(item.goalTypes) ? item.goalTypes : []),
      item.provenance?.domain,
    ].map(value => String(value || '').toLowerCase())
    for (const id of ['office', 'engineering', 'visual']) {
      if (values.includes(id)) return id
    }
    const source = `${item.id || ''} ${item.name || ''} ${item.description || ''} ${(item.tags || []).join?.(' ') || ''}`.toLowerCase()
    if (/(视觉|海报|图片|图像|设计|image|visual|poster|design)/.test(source)) return 'visual'
    if (/(研发|开发|代码|测试|需求|工程|软件|code|dev|test|engineering|release)/.test(source)) return 'engineering'
    return 'office'
  }

  function activeWorkflowPackages() {
    const packages = Array.isArray(data.workflowPackages) ? data.workflowPackages : []
    const query = String(shelfQuery || '').trim().toLowerCase()
    return packages
      .filter(item => !query || `${item.id} ${item.name} ${item.description} ${(item.goalTypes || []).join(' ')}`
        .toLowerCase().includes(query))
      .sort((a, b) => {
        const sourceOrder = { official: 0, team: 1, forked: 2, personal: 3 }
        return (sourceOrder[a.source] ?? 9) - (sourceOrder[b.source] ?? 9)
          || String(a.name || a.id).localeCompare(String(b.name || b.id))
      })
      .filter(item => consoleDomain === 'all' || consoleDomainOf(item) === consoleDomain)
  }

  function workflowCatalog(workflow) {
    const raw = workflow && workflow.catalog
    if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) return null
    const visibility = String(raw && raw.visibility || 'primary').trim().toLowerCase()
    if (visibility !== 'primary' && visibility !== 'advanced') return null
    const rawOrder = raw && raw.order
    const numericOrder = rawOrder === null || rawOrder === '' ? NaN : Number(rawOrder)
    return {
      visibility,
      category: String(raw && raw.category || 'general').trim() || 'general',
      order: Number.isInteger(numericOrder) ? numericOrder : 1000,
    }
  }

  function visibleWorkflows(workflows) {
    return (Array.isArray(workflows) ? workflows : [])
      .map((workflow, index) => ({ workflow, index, catalog: workflowCatalog(workflow) }))
      .filter(item => item.catalog)
      .sort((a, b) => (a.catalog.order - b.catalog.order) || (a.index - b.index))
      .map(item => ({
        ...item.workflow,
        catalog: { ...(item.workflow.catalog || {}), ...item.catalog },
      }))
  }

  function activeWorkflows() {
    const workflows = data.daemon && data.daemon.online ? data.daemon.workflows : data.workflows
    const packageMap = new Map((Array.isArray(data.workflowPackages) ? data.workflowPackages : [])
      .map(item => [item.id, item]))
    const visible = visibleWorkflows(workflows).map(item => {
      const packageItem = packageMap.get(item.id)
      return packageItem
        ? {
            ...item,
            source: packageItem.source,
            version: packageItem.version,
            executionSource: resolveWorkflowExecutionSource(packageItem),
          }
        : item
    })
    const known = new Set(visible.map(item => item.id))
    const packageWorkflows = (Array.isArray(data.workflowPackages) ? data.workflowPackages : [])
      .filter(item => !known.has(item.id) && item.status !== 'unavailable' && item.status !== 'archived')
      .map(item => ({
        ...item,
        path: item.path || item.provenance?.path || '',
        summary: item.summary || item.description || '',
        tags: item.tags || item.goalTypes || [],
        executionSource: item.executionBackends?.includes('daemon') ? 'daemon' : 'local-team',
      }))
    const all = [...visible, ...packageWorkflows]
    const mode = activeMode()
    if (!mode) return all
    const matchesMode = workflow => {
      const declared = workflow.workModes || workflow.work_modes || workflow.catalog?.workModes
      return (Array.isArray(declared) && declared.map(String).includes(mode.id))
        || (Array.isArray(workflow.goalTypes) && workflow.goalTypes.map(String).includes(mode.id))
    }
    // 模式仍用于推荐排序，不再把普通用户挡在空目录之外。
    return [...all].sort((a, b) => Number(matchesMode(b)) - Number(matchesMode(a)))
  }

  function mergeWorkflowItem(item) {
    if (!item) return null
    const repo = data.workflows.find(w => w.id === item.id)
    const tags = [...new Set([...(repo && repo.tags || []), ...(item.tags || [])].map(String))]
    return {
      ...(repo || {}),
      ...item,
      path: String(item.path || (repo && repo.path) || '').trim(),
      tags,
      summary: item.summary || (repo && repo.summary) || item.purpose || '',
      description: item.description || (repo && repo.description) || '',
      name: item.name || (repo && repo.name) || item.id,
    }
  }

  function agentsById() {
    return Object.fromEntries(data.agents.map(agent => [agent.id, agent]))
  }

  function hasChinese(value) {
    return /[\u3400-\u9fff]/.test(String(value || ''))
  }

  function englishAgentName(agent) {
    const title = String(agent.title || agent.id || '专家').trim()
    const english = title
      .replace(/[\u3400-\u9fff]/g, '')
      .replace(/[·｜|（）()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return english || title
  }

  function chineseRoleName(agent) {
    const role = String((agent.persona && agent.persona.role) || '').trim()
    if (hasChinese(role)) return role
    const title = String(agent.title || agent.id || '').trim()
    if (hasChinese(title)) {
      const chinese = title.replace(/[A-Za-z0-9_.-]+/g, '').replace(/\s+/g, ' ').trim()
      if (chinese) return chinese
    }
    const semantic = `${title} ${role}`.toLowerCase()
    if (/(arch|architect).*(fe|front)|(fe|front).*(arch|architect)/.test(semantic)) return '前端架构师'
    if (/(arch|architect).*(be|back)|(be|back).*(arch|architect)/.test(semantic)) return '后端架构师'
    if (/(test|tester|qa)/.test(semantic)) return '测试架构师'
    if (/(query|search|research)/.test(semantic)) return '项目问答助手'
    if (/(operator|devops|ops)/.test(semantic)) return '后端运维工程师'
    if (/(story|product|producer|leader|\bpm\b)/.test(semantic)) return '产品需求负责人'
    if (/(fe|front)/.test(semantic)) return '前端研发工程师'
    if (/(be|back)/.test(semantic)) return '后端研发工程师'
    if (/(code|coder|develop|engineer)/.test(semantic)) return '研发工程师'
    return role || '智能专家'
  }

  function roleIconName(agent) {
    const identity = window.AgentIdentity
    if (identity && typeof identity.identityIcon === 'function') {
      return identity.identityIcon({
        id: agent?.id,
        name: agent?.name || agent?.title,
        title: agent?.title,
        description: agent?.description || agent?.summary,
        role: agent?.persona?.role || agent?.role,
        avatar: agent?.avatar || agent?.persona?.avatar,
        skills: agent?.skills,
      })
    }
    const semantic = `${agent.title || ''} ${(agent.persona && agent.persona.role) || ''}`.toLowerCase()
    if (/(arch|architect|架构)/.test(semantic) && /(be|back|后端)/.test(semantic)) return 'database'
    if (/(arch|architect|架构)/.test(semantic) && /(fe|front|前端)/.test(semantic)) return 'component'
    if (/(arch|architect|架构)/.test(semantic)) return 'network'
    if (/(test|tester|qa|测试)/.test(semantic)) return 'flask'
    if (/(query|search|research|查询|问答)/.test(semantic)) return 'searchLine'
    if (/(operator|devops|ops|运维)/.test(semantic)) return 'server'
    if (/(story|product|producer|leader|\bpm\b|产品|制作人)/.test(semantic)) return 'clipboardCheck'
    if (/(fe|front|前端)/.test(semantic)) return 'panelsTopLeft'
    if (/(code|coder|develop|engineer|be|back|研发|开发|后端)/.test(semantic)) return 'terminal'
    return 'users'
  }

  /** 专家预设头像：优先图片，失败回退语义图标 */
  function agentAvatarMark(agent = {}, className = 'wb-agent-detail-avatar', size = 44) {
    const identity = window.AgentIdentity
    const payload = {
      id: agent?.id || agent?.agentPackageId,
      name: agent?.name || agent?.title || chineseRoleName(agent),
      title: agent?.title,
      description: agent?.description || agent?.summary || agent?.display?.summary,
      role: agent?.persona?.role || agent?.role,
      avatar: agent?.avatar || agent?.persona?.avatar,
      skills: agent?.skills || agent?.skillRefs,
      category: agent?.category,
      tags: agent?.tags,
    }
    const src = identity && typeof identity.identityAvatarSrc === 'function'
      ? identity.identityAvatarSrc(payload)
      : ''
    if (src) {
      return `<span class="${className} has-photo" aria-hidden="true"><img src="${esc(src)}" alt="" width="${size}" height="${size}" decoding="async"></span>`
    }
    const icon = roleIconName(agent)
    return `<span class="${className}" aria-hidden="true"><span class="ico" data-icon="${esc(icon)}"></span></span>`
  }

  function model() {
    return window.WorkbenchModel || null
  }

  function presenter() {
    return window.WorkbenchPresenter || null
  }

  /** 专家简介：仓库文案含实现细节时退回角色模板，避免内部术语进界面 */
  function agentSummary(agent, roleLabel) {
    const api = presenter()
    if (api) return api.userFacingSummary(agent, roleLabel)
    return `${roleLabel || '这位专家'}会按工作流接收任务，并产出可以直接使用的专业结果。`
  }

  /** 专家能力标签：skills 是内部 slug，对外只展示按角色归纳的能力词 */
  function agentCapabilities(agent) {
    const api = presenter()
    return api ? api.capabilityTags(agent) : []
  }

  function resetRun(keepWorkflow = false) {
    stopDaemonRuntimeWatchers()
    const workflow = keepWorkflow ? run.workflow : null
    run = emptyRun()
    if (workflow && model()) {
      run.workflow = workflow
      run.graph = model().buildWorkflowGraph(workflow)
      run.currentId = workflow.entryNode
      run.status = 'ready'
    }
    renderRunner()
  }

  function runAgentLabels() {
    if (run.projection && Array.isArray(run.projection.agents) && run.projection.agents.length) {
      return run.projection.agents.slice()
    }
    const local = workflowAgents(run.workflow).map(agent => chineseRoleName(agent))
    if (local.length) return local
    const status = run.task && run.task.status
    const remote = status && Array.isArray(status.agents) ? status.agents : []
    return remote.map(item => String(item && (item.name || item.role || item.id) || item)).filter(Boolean)
  }

  function briefApi() {
    return window.WorkbenchTaskBrief || null
  }

  function lifecycleApi() {
    return window.WorkbenchTaskLifecycle || null
  }

  function runLifecycleInput() {
    const waiting = localWaiting()
    const backend = run.mode === 'daemon'
      ? 'daemon'
      : (run.mode === 'agent-graph' ? 'agent-graph' : 'local-team')
    return {
      backend,
      rawStatus: run.status,
      terminalKind: run.terminalKind,
      task: run.mode === 'daemon' ? (run.task || null) : null,
      gate: waiting.gate || null,
      clarification: waiting.clarification || null,
      pendingGates: run.pendingGates,
      pendingClarifications: run.task && run.task.pending_clarifications,
      terminal: !!(run.task && run.task.terminal),
    }
  }

  function localWaiting() {
    const daemon = daemonWaiting()
    if (daemon.gate || daemon.clarification) return daemon
    if (run.mode === 'agent-graph' && Array.isArray(run.pendingGates) && run.pendingGates.length) {
      const gate = run.pendingGates[0] || {}
      return {
        gate: {
          node: gate.nodeId || gate.node_id || gate.id || 'agent-gate',
          title: gate.title || gate.summary || '等待审批',
        },
        clarification: null,
      }
    }
    if (run.mode !== 'daemon') {
      const node = currentNode()
      if (node && node.type === 'gate') {
        const title = model()
          ? model().nodeTitle(node, agentsById())
          : (node.id || '审批节点')
        return { gate: { node: node.id, title }, clarification: null }
      }
    }
    return daemon
  }

  function workbenchTaskContext() {
    const status = run.task && run.task.status || {}
    const waiting = localWaiting()
    const projection = run.projection || null
    const agents = runAgentLabels()
    const artifacts = Array.isArray(run.artifacts) ? run.artifacts : []
    const inputs = run.context && run.context.inputs ? run.context.inputs : null
    const degraded = !!(projection && projection.degraded)
    const rawNode = projection && projection.currentNodeLabel
      ? projection.currentNodeLabel
      : (status.current_node || status.current || run.currentId || '')
    const brief = briefApi()
      ? briefApi().buildWorkbenchTaskBrief({
          status: run.status || status.state || '',
          terminalKind: run.terminalKind || '',
          currentNode: rawNode,
          agents,
          artifacts,
          inputs,
          degraded,
          degradedReason: (projection && projection.degradedReason) || '',
          gate: waiting.gate,
          clarification: waiting.clarification,
        })
      : null
    return {
      slug: run.slug,
      name: run.intent || (run.workflow && run.workflow.name) || (projection && projection.intentTitle) || '',
      intent: run.intent || (run.workflow && run.workflow.name) || (projection && projection.intentTitle) || '',
      workflow: run.workflow && run.workflow.id,
      workflowName: (projection && projection.workflowName) || (run.workflow && (run.workflow.name || run.workflow.id)),
      context: run.context,
      contextSummary: run.contextSummary,
      status: run.status,
      statusTone: brief ? brief.tone : (runSucceeded() ? 'done' : 'running'),
      statusHeadline: brief ? brief.headline : (runSucceeded() ? '任务已完成' : '正在执行'),
      currentNode: brief ? brief.currentNodeLabel : (rawNode || (runSucceeded() ? '已完成' : '流程执行中')),
      currentOwner: (projection && projection.currentOwner) || '',
      degraded,
      degradedReason: (projection && projection.degradedReason) || '',
      agents,
      artifacts,
      resultSummary: String(run.resultSummary || '').trim(),
      inputs,
      waitingKind: brief ? brief.waitingKind : 'none',
      waitingTitle: brief ? brief.waitingTitle : '',
      waitingDetail: brief ? brief.waitingDetail : '',
      nextAction: brief ? brief.nextAction : '',
      approver: brief ? brief.approver : '',
      factualBrief: brief ? brief.factualBrief : '',
      gate: waiting.gate || null,
      clarification: waiting.clarification || null,
      runMode: run.mode || '',
    }
  }

  function syncTaskView() {
    const active = !!run.workflow
    if (active && expertTaskRoom) {
      expertTaskRoom = null
      syncExpertTaskRoomVisibility()
    }
    updateWorkbenchViewState({
      surface: active ? 'tasks' : activePage,
      taskRoom: active,
      runMode: run.mode || 'local',
      phase: runPhaseFromStatus(run.status),
    })
    if (elHeadTitle) elHeadTitle.textContent = active ? (workflowDisplayNameOf(run.workflow) || '运行') : '工作台'
    syncHeadActionButton()
    if (active) {
      setSurface('run', { force: true })
      setRunStage(runPhaseFromStatus(run.status) === 'completed' ? 'result' : 'running')
      renderRunResultStage()
    }
    onViewChange(active, active ? workbenchTaskContext() : {}, {
      layout: viewState.taskRoom ? 'task-room' : 'overview',
      viewState: { ...viewState },
    })
  }

  function syncHeadActionButton() {
    const elHead = document.getElementById('wbHead')
    // task-room 左栏已有对话状态栏「返回」；运行面另有 #wbRunBack — 隐藏空全局头，避免三重返回
    const hideGlobalHead = activeSurface === 'run'
    if (elHead) elHead.hidden = hideGlobalHead
    if (!btnReload) return
    const icon = btnReload.querySelector('.ico')
    // 总览不显示刷新；仅编排页借用 wbReload 作返回（对话房走左栏状态栏）
    const showBack = activeSurface === 'studio'
    btnReload.hidden = !showBack
    if (showBack) {
      const backToShelf = studioReturnState?.surface === 'shelf'
      const backLabel = backToShelf ? '返回工作流' : '返回管理工作流'
      btnReload.title = backLabel
      btnReload.setAttribute('aria-label', backLabel)
      if (icon) icon.setAttribute('data-icon', 'chevronLeft')
    } else {
      btnReload.title = '刷新助手'
      btnReload.setAttribute('aria-label', '刷新')
      if (icon) icon.setAttribute('data-icon', 'refresh')
    }
    if (window.StickyIcons) window.StickyIcons.mount(btnReload)
    syncDialogueStatusBar()
  }

  async function loadStudioOptions() {
    const [skillsResult, connectorsResult, knowledgeResult] = await Promise.all([
      window.api?.capabilityList
        ? window.api.capabilityList({ kind: 'skill' }).catch(() => ({ items: [] }))
        : Promise.resolve({ items: [] }),
      window.api?.capabilityList
        ? window.api.capabilityList({ kind: 'connector' }).catch(() => ({ items: [] }))
        : Promise.resolve({ items: [] }),
      window.api?.knowledgeProviderList
        ? window.api.knowledgeProviderList().catch(() => ({ providers: [] }))
        : Promise.resolve({ providers: [] }),
    ])
    data.skills = (Array.isArray(skillsResult?.items) ? skillsResult.items : [])
      .filter(item => item.enabled !== false && String(item.status || 'installed') !== 'unavailable')
    data.connectors = (Array.isArray(connectorsResult?.items) ? connectorsResult.items : [])
      .filter(item => item.enabled !== false)
    data.knowledgeProviders = Array.isArray(knowledgeResult?.providers) ? knowledgeResult.providers : []
    data.activeKnowledgeProviderId = String(knowledgeResult?.activeProviderId || '')
  }

  async function load() {
    if (!window.api || !window.api.workbenchLoad) return
    let res
    try { res = await window.api.workbenchLoad() } catch (e) { res = { ok: false, error: e.message } }
    loaded = true
    if (!res || !res.ok) {
      data = {
        root: (res && res.root) || '',
        repo: (res && res.repo) || null,
        agents: [],
        daemonAgents: [],
        repositoryAgents: [],
        agentSource: 'none',
        workflows: [],
        workflowPackages: [],
        skills: [],
        connectors: [],
        knowledgeProviders: [],
        workContext: null,
        repoError: (res && res.error) || '请检查当前 Git 仓库',
        daemon: { online: false, workflows: [], tasks: [], hint: '本机管线服务不可用' },
        automation: { jobs: [], templates: [] },
        console: { domains: [], runs: [], attention: [], automation: [], counts: {} },
        taskDraft: null,
        modes: (res && res.modes) || fallbackModeState(),
      }
      closeModal()
      resetRun()
      updateWorkbenchViewState({
        surface: activePage,
        taskRoom: false,
        runMode: 'local',
        phase: 'idle',
      })
      renderModeOverview()
      renderAutomation()
      return
    }
    data = {
      root: res.root || '',
      repo: res.repo || null,
      agents: Array.isArray(res.agents) ? res.agents : [],
      daemonAgents: Array.isArray(res.daemonAgents)
        ? res.daemonAgents
        : (Array.isArray(res.daemon?.agents) ? res.daemon.agents : []),
      repositoryAgents: Array.isArray(res.repositoryAgents) ? res.repositoryAgents : [],
      agentSource: String(res.agentSource || 'none'),
      workflows: Array.isArray(res.workflows) ? res.workflows : [],
      workflowPackages: Array.isArray(res.workflowPackages) ? res.workflowPackages : [],
      workContext: res.workContext && typeof res.workContext === 'object' ? res.workContext : null,
      repoError: res.repoError || '',
      daemon: res.daemon && typeof res.daemon === 'object'
        ? {
            ...res.daemon,
            workflows: Array.isArray(res.daemon.workflows) ? res.daemon.workflows : [],
            tasks: Array.isArray(res.daemon.tasks) ? res.daemon.tasks : [],
          }
        : { online: false, workflows: [], tasks: [], hint: '本机管线服务不可用' },
      automation: res.automation && typeof res.automation === 'object'
        ? {
            jobs: Array.isArray(res.automation.jobs) ? res.automation.jobs : [],
            templates: Array.isArray(res.automation.templates) ? res.automation.templates : [],
          }
        : { jobs: [], templates: [] },
      console: res.console && typeof res.console === 'object'
        ? res.console
        : { domains: [], runs: [], attention: [], automation: [], counts: {} },
      taskDraft: res.taskDraft && typeof res.taskDraft === 'object' ? res.taskDraft : null,
      modes: res.modes && typeof res.modes === 'object' ? res.modes : fallbackModeState(),
      skills: [],
      connectors: [],
      knowledgeProviders: [],
    }
    await loadStudioOptions()
    if (consoleDomain !== 'all') {
      consoleDomain = String(data.console.activeDomainId || data.modes.activeModeId || 'office')
    }
    if (data.taskDraft?.goal) pendingGoal = data.taskDraft.goal
    if (data.workContext?.launchIntent?.goal) pendingGoal = data.workContext.launchIntent.goal
    if (data.workContext?.launchIntent?.domain && consoleDomain !== 'all') {
      consoleDomain = data.workContext.launchIntent.domain
    }
    closeModal()
    resetRun()
    updateWorkbenchViewState({
      surface: activePage,
      taskRoom: false,
      runMode: 'local',
      phase: 'idle',
    })
    renderModeOverview()
    renderShelf()
    renderStudio()
    renderWorkflowManage()
    renderAutomation()
    const restoredRun = await restoreTaskFromDraft()
    if (!restoredRun) await restoreLaunchIntentFromStores()
  }

  function restoreAgentGraphDraft(draft = {}, { shouldRefresh = true } = {}) {
    const rootRunId = String(draft.rootRunId || '').trim()
    stopDaemonRuntimeWatchers()
    run = emptyRun()
    run.mode = 'agent-graph'
    run.workflow = {
      id: 'workbench-agent-graph',
      name: draft.workflowName || '专家协作图',
      description: draft.goal || '',
    }
    run.intent = draft.goal || ''
    run.rootRunId = rootRunId
    run.composition = draft.composition || null
    run.status = draft.phase === 'completed'
      ? 'done'
      : (draft.phase === 'failed' ? 'failed' : (draft.phase === 'cancelled' ? 'cancelled' : 'running'))
    renderRunner()
    if (shouldRefresh && rootRunId) void refreshAgentGraphRun(false)
  }

  async function restoreTaskFromDraft() {
    const draft = data.taskDraft && typeof data.taskDraft === 'object' ? data.taskDraft : null
    if (!draft) return false
    const intent = draft.launchIntent
    if (intent && String(intent.status || '') === 'cancelled') {
      if (draft.goal) pendingGoal = humanGoalText(draft.goal) || pendingGoal
      return false
    }
    if (intent && ['launched', 'launching'].includes(String(intent.status || ''))
      && (intent.runId || intent.rootRunId || intent.slug)) {
      return openExistingLaunchRun(intent.runId || intent.slug, intent)
    }
    if (draft.slug) {
      // 终态或管线在线但任务已不在列表：不自动弹任务房，清草稿防下次再弹
      if (daemonDraftPhaseIsTerminal(draft.phase)) {
        await clearStaleDaemonTaskDraft()
        if (draft.goal) pendingGoal = humanGoalText(draft.goal) || pendingGoal
        return false
      }
      const online = !!(data.daemon && data.daemon.online)
      const tasks = Array.isArray(data.daemon?.tasks) ? data.daemon.tasks : []
      if (online && !tasks.some(task => String(task?.slug || '') === String(draft.slug))) {
        await clearStaleDaemonTaskDraft()
        if (draft.goal) pendingGoal = humanGoalText(draft.goal) || pendingGoal
        return false
      }
      const surface = resolveReturnSurface(intent?.returnState?.surface || 'daemon')
      return openDaemonTask(draft.slug, { silent: true, returnSurface: surface })
    }
    if (draft.executionSource === 'agent-graph' && draft.rootRunId) {
      setWorkbenchPage('tasks', { force: true })
      restoreAgentGraphDraft(draft, { shouldRefresh: true })
      return true
    }
    // preparing 且无真实 run：只是确认输入草稿，预填目标，不自动弹窗
    if (draft.workflowId && ['preparing', 'running', 'queued', 'pending'].includes(String(draft.phase || '').toLowerCase())) {
      if (draft.goal) pendingGoal = humanGoalText(draft.goal) || pendingGoal
      if (intent) syncLaunchIntentLocal(intent)
      return false
    }
    return false
  }

  function modeBindings(mode = activeMode()) {
    if (consoleDomain === 'all') {
      const seen = new Set()
      return modeState().modes.flatMap(item => Array.isArray(item.bindings) ? item.bindings : [])
        .filter(item => {
          const id = String(item?.expertId || item?.id || '')
          if (!id || seen.has(id)) return false
          seen.add(id)
          return true
        })
    }
    return Array.isArray(mode?.bindings) ? mode.bindings : []
  }

  function boundExpert(binding = {}) {
    const expert = binding.expert && typeof binding.expert === 'object' ? binding.expert : binding
    const status = String(expert.status || binding.status || 'enabled').trim().toLowerCase()
    const missing = ['missing', 'removed', 'unavailable', 'not_found'].includes(status)
    return {
      ...expert,
      expertId: String(binding.expertId || expert.id || '').trim(),
      id: String(binding.expertId || expert.id || '').trim(),
      name: String(expert.name || binding.name || binding.label || binding.expertId || '未命名专家').trim(),
      description: String(
        expert.description
        || binding.description
        || (missing ? '专家已卸载，可重新安装或从工作台移除' : '已加入当前工作模式'),
      ).trim(),
      // 缺失/卸载态不得当成 enabled，否则快捷卡会误标「已安装」
      enabled: !missing && expert.enabled !== false && binding.available !== false,
      status: status || 'enabled',
      tags: Array.isArray(expert.tags) ? expert.tags : [],
      addedAt: binding.addedAt || '',
    }
  }

  function daemonLogSseApi() {
    return window.WorkbenchDaemonLogSse || null
  }

  function stopDaemonLogStream() {
    const slug = daemonLogStreamSlug || run.slug || ''
    daemonLogStreamActive = false
    daemonLogStreamSlug = ''
    daemonLogSkipReplay = 0
    if (daemonLogFallbackTimer) {
      clearTimeout(daemonLogFallbackTimer)
      daemonLogFallbackTimer = null
    }
    if (window.api?.workbenchDaemonLogsStreamStop) {
      void window.api.workbenchDaemonLogsStreamStop({ slug })
    }
  }

  function scheduleDaemonLogFallback(delayMs = 4000) {
    if (daemonLogFallbackTimer) clearTimeout(daemonLogFallbackTimer)
    daemonLogFallbackTimer = setTimeout(() => {
      daemonLogFallbackTimer = null
      if (run.mode !== 'daemon' || !run.slug) return
      if (daemonLogStreamActive && daemonLogStreamSlug === run.slug) return
      void loadDaemonReviewExtras({ light: false, forceLogs: true }).then(() => {
        if (daemonReviewTab === 'logs') renderDaemonReview()
      })
    }, delayMs)
  }

  function startDaemonLogStream({ forceSeed = false } = {}) {
    if (run.mode !== 'daemon' || !run.slug || !window.api?.workbenchDaemonLogsStreamStart) return
    const terminal = ['done', 'failed', 'cancelled', 'error'].includes(String(run.status || '').toLowerCase())
      || ['finished', 'completed', 'success', 'failed', 'error', 'cancelled', 'canceled'].includes(
        String(run.task?.state || run.status || '').toLowerCase(),
      )
    if (terminal) {
      stopDaemonLogStream()
      return
    }
    const slug = run.slug
    if (daemonLogStreamActive && daemonLogStreamSlug === slug) return

    const seed = async () => {
      if (!forceSeed && run.processLogsText) return
      if (!window.api.workbenchDaemonLogs) return
      try {
        const res = await window.api.workbenchDaemonLogs(slug)
        if (res && res.ok && run.slug === slug) {
          const api = daemonLogSseApi()
          run.processLogsText = api?.mergeLogFullText
            ? api.mergeLogFullText(run.processLogsText, res.text || '')
            : (res.text || run.processLogsText || '')
        }
      } catch { /* ignore seed errors */ }
    }

    void seed().then(() => {
      if (run.slug !== slug || run.mode !== 'daemon') return
      const api = daemonLogSseApi()
      const skip = api?.countLogLines ? api.countLogLines(run.processLogsText) : 0
      if (window.api?.workbenchDaemonLogsStreamStop) {
        void window.api.workbenchDaemonLogsStreamStop({ slug: daemonLogStreamSlug || slug })
      }
      if (daemonLogFallbackTimer) {
        clearTimeout(daemonLogFallbackTimer)
        daemonLogFallbackTimer = null
      }
      daemonLogSkipReplay = skip
      daemonLogStreamSlug = slug
      daemonLogStreamActive = true
      void window.api.workbenchDaemonLogsStreamStart({
        slug,
        skipLines: skip,
      }).then(res => {
        if (!res || !res.ok) {
          daemonLogStreamActive = false
          daemonLogStreamSlug = ''
          scheduleDaemonLogFallback(1500)
        }
      }).catch(() => {
        daemonLogStreamActive = false
        daemonLogStreamSlug = ''
        scheduleDaemonLogFallback(1500)
      })
      if (daemonReviewTab === 'logs') renderDaemonReview()
    })
  }

  function handleDaemonLogEvent(event = {}) {
    const slug = String(event.slug || '').trim()
    if (!slug || slug !== run.slug || run.mode !== 'daemon') return
    const api = daemonLogSseApi()
    if (event.type === 'line') {
      run.processLogsText = api?.appendLogLine
        ? api.appendLogLine(run.processLogsText, event.line)
        : `${run.processLogsText || ''}${run.processLogsText ? '\n' : ''}${event.line || ''}`
      if (daemonReviewTab === 'logs') renderDaemonReview()
      return
    }
    if (event.type === 'done' || event.type === 'end') {
      daemonLogStreamActive = false
      daemonLogStreamSlug = ''
      if (daemonReviewTab === 'logs') renderDaemonReview()
      return
    }
    if (event.type === 'error') {
      daemonLogStreamActive = false
      daemonLogStreamSlug = ''
      scheduleDaemonLogFallback(2000)
    }
  }

  function daemonSurfaceApi() {
    return window.WorkbenchDaemonSurface || null
  }

  function daemonReviewApi() {
    return window.WorkbenchDaemonReview || null
  }

  function statusStepsMap(task) {
    const status = task && task.status && typeof task.status === 'object' ? task.status : {}
    const steps = status.steps
    if (steps && typeof steps === 'object' && !Array.isArray(steps)) return steps
    return {}
  }

  function syncDaemonProcessFeed() {
    const agent = window.WorkspaceAgent
    if (!agent?.setDaemonProcessFeed) return
    if (run.mode !== 'daemon' || !run.slug) {
      agent.setDaemonProcessFeed(null)
      return
    }
    const api = daemonReviewApi()
    if (!api?.projectChatProgressCard) {
      agent.setDaemonProcessFeed(null)
      return
    }
    const waiting = daemonWaiting()
    const brief = briefApi()?.buildWorkbenchTaskBrief
      ? briefApi().buildWorkbenchTaskBrief({
          status: run.status,
          terminalKind: run.terminalKind || '',
          currentNode: (run.projection && run.projection.currentNodeLabel) || '',
          gate: waiting.gate,
          clarification: waiting.clarification,
        })
      : null
    const briefWaiting = String(brief?.waitingKind || 'none')
    const waitingKind = (briefWaiting && briefWaiting !== 'none')
      ? briefWaiting
      : (waiting.clarification ? 'clarification' : (waiting.gate ? 'gate' : 'none'))
    const card = api.projectChatProgressCard({
      nodes: graphNodes(),
      statusSteps: statusStepsMap(run.task),
      status: waitingKind !== 'none' ? 'waiting' : run.status,
      intent: run.intent,
      currentLabel: brief?.currentNodeLabel || runNodeProgressMeta(),
      waitingKind,
    })
    agent.setDaemonProcessFeed(card, { compact: true })
  }

  function focusDaemonProcessLogs() {
    void switchDaemonReviewTab('logs')
  }

  async function loadDaemonReviewExtras({ includeEvents = false, includeChanges = false, light = false, forceLogs = false } = {}) {
    if (run.mode !== 'daemon' || !run.slug || !window.api) return
    const jobs = []
    const streamCoversLogs = daemonLogStreamActive && daemonLogStreamSlug === run.slug
    if (!light) {
      if (window.api.workbenchDaemonProgress) {
        jobs.push(window.api.workbenchDaemonProgress(run.slug).then(res => {
          if (res && res.ok) run.progressText = res.text || ''
        }).catch(() => {}))
      }
      if (window.api.workbenchDaemonLogs && (forceLogs || !streamCoversLogs)) {
        jobs.push(window.api.workbenchDaemonLogs(run.slug).then(res => {
          if (res && res.ok) {
            const api = daemonLogSseApi()
            run.processLogsText = api?.mergeLogFullText
              ? api.mergeLogFullText(run.processLogsText, res.text || '')
              : (res.text || '')
          }
        }).catch(() => {}))
      }
      if (window.api.workbenchDaemonArtifacts) {
        jobs.push(window.api.workbenchDaemonArtifacts(run.slug).then(res => {
          if (res && res.ok && Array.isArray(res.files)) run.artifacts = res.files
        }).catch(() => {}))
      }
    }
    if (includeEvents && window.api.workbenchDaemonEvents) {
      jobs.push(window.api.workbenchDaemonEvents(run.slug, { limit: 120 }).then(res => {
        if (res && res.ok) run.events = res.events || []
      }).catch(() => {}))
    }
    if (includeChanges && window.api.workbenchDaemonChanges) {
      jobs.push(window.api.workbenchDaemonChanges(run.slug).then(res => {
        if (res && res.ok) {
          run.changes = Object.assign({}, res)
          delete run.changes.ok
          delete run.changes.slug
          run.changesLoaded = true
          run.changesError = ''
        } else if (res && !res.ok) {
          run.changesError = res.error || res.message || '变更加载失败'
        }
      }).catch((err) => {
        run.changesError = err?.message || '变更加载失败'
      }))
    }
    await Promise.all(jobs)
  }

  function stepVisualLabel(status) {
    const map = { done: '已完成', active: '进行中', error: '需处理', pending: '待执行' }
    return map[status] || status || '未知'
  }

  /** 微卡主标题：优先中文类型·执行者；副标题为英文节点名 */
  function stepCardTitles(step) {
    const label = String(step && (step.label || step.id) || '').trim()
    const meta = String(step && step.meta || '').trim()
    const owner = String(step && step.owner || '').trim()
    const primary = meta || owner || label || '节点'
    const secondary = label && label !== primary ? label : ''
    return { primary, secondary }
  }

  function renderDaemonStepDetail(step, status) {
    const titles = stepCardTitles(step)
    const rows = [
      ['状态', stepVisualLabel(status)],
      ['类型 · 执行者', step.meta || ''],
      ['执行者', step.owner || ''],
      ['节点', step.label || step.id || ''],
      ['节点类型', step.type || ''],
      ['节点 ID', step.id || ''],
      ['产出', step.outputTitle || step.outputLabel || ''],
      ['交接', step.handoff || ''],
    ].filter(row => row[1])
    return `
      <div class="wb-daemon-review-step-detail">
        <button type="button" class="wb-icon-btn wb-daemon-review-step-close" data-step-detail-back title="关闭详情" aria-label="关闭详情">
          <span class="ico" data-icon="close" aria-hidden="true"></span>
        </button>
        <div class="wb-daemon-review-step-detail-head">
          <span class="wb-daemon-review-step-mark status-${escAttr(status)}" aria-hidden="true"></span>
          <div>
            <strong>${esc(titles.primary)}</strong>
            ${titles.secondary ? `<small class="wb-daemon-review-step-en">${esc(titles.secondary)}</small>` : ''}
            <small>${esc(stepVisualLabel(status))}</small>
          </div>
        </div>
        <dl class="wb-daemon-review-step-detail-dl">
          ${rows.map(([label, value]) => `
            <div>
              <dt>${esc(label)}</dt>
              <dd title="${escAttr(value)}">${esc(value)}</dd>
            </div>`).join('')}
        </dl>
      </div>`
  }

  function renderDaemonReviewBody(surface) {
    if (!elDaemonReviewBody || !surface) return
    const tab = surface.activeTab
    if (tab === 'steps') {
      const rawSteps = Array.isArray(surface.steps) ? surface.steps : []
      const steps = rawSteps.filter(step => !(step && (step.degradedPlaceholder || step.id === 'degraded-info')))
      const degraded = !!(run.projection && run.projection.degraded) || rawSteps.some(s => s && s.degradedPlaceholder)
      if (!steps.length) {
        daemonReviewStepId = ''
        const reason = (run.projection && run.projection.degradedReason)
          || '暂时无法确认执行步骤：管线服务工作流定义未能加载。请在设置中确认管线服务安装目录后刷新。'
        elDaemonReviewBody.innerHTML = degraded
          ? `<div class="wb-daemon-review-callout">
              <strong>流程详情暂不可用</strong>
              <span>${esc(reason)}</span>
            </div>`
          : `<div class="wb-daemon-review-empty"><p>暂无步骤记录，任务计划生成后将显示在这里。</p></div>`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      const visuals = steps.map((step, index) => nodeVisualStatus(step, index, steps))
      const done = visuals.filter(status => status === 'done').length
      const hasError = visuals.includes('error')
      const currentIndex = visuals.findIndex(status => status === 'active')
      const ratio = steps.length ? Math.round((done / steps.length) * 100) : 0
      const barTone = hasError ? 'is-error' : (runSucceeded() || done === steps.length ? 'is-done' : '')
      const currentLabel = currentIndex >= 0
        ? stepCardTitles(steps[currentIndex]).primary
        : (runSucceeded() ? '全部完成' : stepCardTitles(steps[Math.min(done, steps.length - 1)] || {}).primary || '编排步骤')
      const progressLine = runSucceeded()
        ? `已完成 ${steps.length}/${steps.length} 步 · 100%`
        : (hasError
          ? `已完成 ${done}/${steps.length} 步 · ${ratio}%`
          : `已完成 ${done}/${steps.length} 步 · ${ratio}%`)
      const progressStatus = runSucceeded() ? '已完成' : (hasError ? '失败' : '执行中')
      const selected = daemonReviewStepId
        ? steps.find(step => step && step.id === daemonReviewStepId)
        : null
      if (daemonReviewStepId && !selected) daemonReviewStepId = ''
      if (selected) {
        const selectedIndex = steps.indexOf(selected)
        const selectedStatus = visuals[selectedIndex] || nodeVisualStatus(selected, selectedIndex, steps)
        elDaemonReviewBody.innerHTML = `
          <div class="wb-daemon-review-progress">
            <div class="wb-daemon-review-progress-head">
              <strong>${esc(progressLine)}</strong>
              <span>${esc(`${progressStatus} · ${currentLabel}`)}</span>
            </div>
            <div class="wb-daemon-review-progress-bar ${barTone}" aria-hidden="true">
              <span style="width:${Math.max(ratio, hasError || done ? ratio : 4)}%"></span>
            </div>
          </div>
          ${renderDaemonStepDetail(selected, selectedStatus)}`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      elDaemonReviewBody.innerHTML = `
        <div class="wb-daemon-review-progress">
          <div class="wb-daemon-review-progress-head">
            <strong>${esc(progressLine)}</strong>
            <span>${esc(`${progressStatus} · ${currentLabel}`)}</span>
          </div>
          <div class="wb-daemon-review-progress-bar ${barTone}" aria-hidden="true">
            <span style="width:${Math.max(ratio, hasError || done ? ratio : 4)}%"></span>
          </div>
        </div>
        <ol class="wb-daemon-review-steps is-zigzag">
          ${steps.map((step, index) => {
            const status = visuals[index] || 'pending'
            const current = index === currentIndex
            const zig = index % 2 === 0 ? 'is-zig-left' : 'is-zig-right'
            const titles = stepCardTitles(step)
            const bodyBits = [
              titles.secondary
                ? `<small class="wb-daemon-review-step-en" title="${escAttr(titles.secondary)}">${esc(titles.secondary)}</small>`
                : '',
              step.outputLabel
                ? `<small class="wb-daemon-review-step-output" title="${escAttr(step.outputTitle || step.outputLabel)}">${esc(step.outputLabel)}</small>`
                : '',
            ].filter(Boolean).join('')
            return `<li class="wb-daemon-review-step status-${escAttr(status)} ${zig}${current ? ' is-current' : ''}">
              <button type="button" class="wb-daemon-review-step-card" data-step-id="${escAttr(step.id)}" title="查看节点详情">
                <span class="wb-daemon-review-step-head">
                  <strong title="${escAttr(titles.primary)}">${esc(titles.primary)}</strong>
                </span>
                ${bodyBits
                  ? `<span class="wb-daemon-review-step-body">${bodyBits}</span>`
                  : ''}
              </button>
              <span class="wb-daemon-review-step-mark" aria-hidden="true"></span>
            </li>`
          }).join('')}
        </ol>`
      return
    }
    if (tab === 'artifacts') {
      const files = surface.artifacts
      const count = files.length
      const emptyApi = daemonReviewApi()
      const empty = emptyApi && typeof emptyApi.artifactEmptyState === 'function'
        ? emptyApi.artifactEmptyState(run.status || run.terminalKind || '')
        : { title: '暂无制品', body: '当前没有可展示的产出文件。', showStepsCta: true }
      if (!count) {
        elDaemonReviewBody.innerHTML = `
          <div class="wb-daemon-review-artifacts-panel">
            <div class="wb-daemon-review-section-title">制品（0）</div>
            <div class="wb-daemon-review-empty is-artifacts" role="status">
              <span class="wb-daemon-review-empty-icon ico" data-icon="folder" aria-hidden="true"></span>
              <strong>${esc(empty.title || '暂无制品')}</strong>
              <p>${esc(empty.body || '当前没有可展示的产出文件。')}</p>
              ${empty.showStepsCta !== false
                ? `<button type="button" class="wb-run-btn sm" data-review-tab="steps">查看步骤</button>`
                : ''}
            </div>
          </div>`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      elDaemonReviewBody.innerHTML = `
        <div class="wb-daemon-review-artifacts-panel">
          <div class="wb-daemon-review-artifacts-head">
            <div class="wb-daemon-review-section-title">制品（${count}）</div>
            <div class="wb-daemon-review-tip">产出文件 · 点击「预览」打开</div>
          </div>
          <div class="wb-daemon-review-artifacts" role="list">${files.map((item) => {
            const openAttr = item.downloadUrl
              ? `data-artifact-url="${escAttr(item.downloadUrl)}"`
              : (item.path ? `data-artifact-path="${escAttr(item.path)}"` : '')
            const pathLabel = String(item.path || item.name || '未命名制品').replace(/\\/g, '/')
            const segments = pathLabel.split('/').filter(Boolean)
            const fileName = segments.length ? segments[segments.length - 1] : pathLabel
            const dirLabel = segments.length > 1 ? segments.slice(0, -1).join('/') : ''
            const sizeLabel = Number.isFinite(item.size) && item.size >= 0
              ? fmtWorkspaceSize(item.size)
              : ''
            const metaBits = [dirLabel || (item.local ? '本地制品' : ''), sizeLabel].filter(Boolean)
            return `<div class="wb-daemon-review-artifact is-webui" role="listitem">
              <span class="wb-daemon-review-artifact-icon ico" data-icon="note" aria-hidden="true"></span>
              <div class="wb-daemon-review-artifact-copy">
                <span class="wb-daemon-review-artifact-name" title="${escAttr(pathLabel)}">${esc(fileName)}</span>
                <span class="wb-daemon-review-artifact-meta" title="${escAttr(pathLabel)}">${esc(metaBits.join(' · ') || pathLabel)}</span>
              </div>
              <div class="wb-daemon-review-artifact-actions">
                ${openAttr
                  ? `<button type="button" class="wb-daemon-review-artifact-preview" ${openAttr}>预览</button>`
                  : `<span class="wb-daemon-review-artifact-preview is-disabled">预览</span>`}
              </div>
            </div>`
          }).join('')}</div>
        </div>`
      if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
      return
    }
    if (tab === 'changes') {
      const workspaceBtn = run.slug
        ? `<button type="button" class="wb-daemon-review-workspace" data-run-action="daemon-workspace" title="代码工作区">
            <span class="ico" data-icon="code" aria-hidden="true"></span>
            <span>代码工作区</span>
          </button>`
        : ''
      if (run.changesLoading) {
        elDaemonReviewBody.innerHTML = `
          <div class="wb-daemon-review-changes-head">
            <div class="wb-daemon-review-section-title">变更</div>
            ${workspaceBtn}
          </div>
          <div class="wb-daemon-review-empty"><p>正在加载变更…</p></div>`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      if (run.changesError && !run.changesLoaded) {
        elDaemonReviewBody.innerHTML = `
          <div class="wb-daemon-review-changes-head">
            <div class="wb-daemon-review-section-title">变更</div>
            ${workspaceBtn}
          </div>
          <div class="wb-daemon-review-empty"><p>${esc(run.changesError)}</p></div>`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      const changes = surface.changes || { empty: true, files: [], summary: '' }
      const files = Array.isArray(changes.files) ? changes.files : []
      const MAX_CHANGE_ROWS = 200
      const visible = files.slice(0, MAX_CHANGE_ROWS)
      const more = files.length - visible.length
      if (changes.empty) {
        elDaemonReviewBody.innerHTML = `
          <div class="wb-daemon-review-changes-head">
            <div class="wb-daemon-review-section-title">变更</div>
            ${workspaceBtn}
          </div>
          <div class="wb-daemon-review-empty"><p>暂无变更。</p></div>`
        if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
        return
      }
      elDaemonReviewBody.innerHTML = `
        <div class="wb-daemon-review-changes-head">
          <div class="wb-daemon-review-section-title">${esc(changes.summary || '变更')}</div>
          ${workspaceBtn}
        </div>
        <div class="wb-daemon-review-changes">
          ${visible.map(file => `
            <div class="wb-daemon-review-change">
              <span class="wb-daemon-review-change-status">${esc(file.status)}</span>
              <span class="wb-daemon-review-change-path">${esc(file.path)}</span>
            </div>
          `).join('') || '<div class="wb-run-muted">变更树已载入，暂无文件路径清单</div>'}
          ${more > 0 ? `<div class="wb-daemon-review-tip">另有 ${more} 个文件未展开显示</div>` : ''}
        </div>`
      if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
      return
    }
    if (tab === 'events') {
      if (!surface.events.length) {
        elDaemonReviewBody.innerHTML = `<div class="wb-daemon-review-empty"><p>暂无事件。</p></div>`
        return
      }
      elDaemonReviewBody.innerHTML = `
        <div class="wb-daemon-review-events">
          ${surface.events.map(ev => `
            <div class="wb-daemon-review-event">
              <div class="wb-daemon-review-event-head">
                <strong>${esc(ev.type)}</strong>
                <span>${esc(ev.at)}</span>
              </div>
              <div class="wb-daemon-review-event-body">${esc(ev.message || '—')}</div>
            </div>
          `).join('')}
        </div>`
      return
    }
    if (tab === 'logs') {
      const process = surface.process || {
        tip: '',
        progress: { title: '全部过程', empty: true, text: '', emptyLabel: '暂无过程摘要（任务运行后将自动生成）。' },
        logs: { title: '运行日志', empty: true, lines: [], emptyLabel: '（等待日志输出…）' },
      }
      const logApi = daemonLogSseApi()
      const nextSignature = logApi?.reviewLogsSignature
        ? logApi.reviewLogsSignature(process.progress.text, process.logs.lines.join('\n'))
        : `${process.progress.text}\0${process.logs.lines.join('\n')}`
      const existing = elDaemonReviewBody.querySelector('#wbDaemonReviewLogs')
      if (existing && daemonLogRenderSignature === nextSignature) {
        const linesPane = elDaemonReviewBody.querySelector('[data-logs-pane="lines"]')
        if (linesPane && daemonLogStickToBottom && (logApi?.isNearBottom ? logApi.isNearBottom(linesPane) : true)) {
          linesPane.scrollTop = linesPane.scrollHeight
        }
        return
      }
      const progressBody = process.progress.empty
        ? `<div class="wb-daemon-review-logs-empty">${esc(process.progress.emptyLabel)}</div>`
        : `<div class="wb-daemon-progress-md">${
          (window.MarkdownLite && typeof window.MarkdownLite.render === 'function')
            ? window.MarkdownLite.render(process.progress.text)
            : `<pre class="wb-daemon-review-logs-pre">${esc(process.progress.text)}</pre>`
        }</div>`
      const logBody = process.logs.empty
        ? `<div class="wb-daemon-review-logs-empty">${esc(process.logs.emptyLabel)}</div>`
        : `<div class="wb-daemon-review-log-lines">${
          process.logs.lines.map(line => `<div class="wb-daemon-review-log-line">${esc(line)}</div>`).join('')
        }</div>`
      const prevLinesPane = elDaemonReviewBody.querySelector('[data-logs-pane="lines"]')
      if (prevLinesPane) {
        daemonLogStickToBottom = logApi?.isNearBottom
          ? logApi.isNearBottom(prevLinesPane)
          : true
      } else {
        daemonLogStickToBottom = true
      }
      const progressExpanded = !daemonProgressCollapsed
      const logsExpanded = !daemonLogsCollapsed
      const progressPreviewBtn = process.progress.empty
        ? ''
        : `<button type="button" class="wb-daemon-progress-preview" data-progress-preview aria-label="放大全部过程" title="放大全部过程">
              <span class="ico" data-icon="maximize" aria-hidden="true"></span>
            </button>`
      elDaemonReviewBody.innerHTML = `
        <div class="wb-daemon-review-logs" id="wbDaemonReviewLogs">
          ${process.tip ? `<p class="wb-daemon-review-logs-tip">${esc(process.tip)}</p>` : ''}
          <section class="wb-daemon-review-logs-block${daemonProgressCollapsed ? ' is-collapsed' : ''}" data-logs-block="progress">
            <header class="wb-daemon-review-logs-head">
              <button type="button" class="wb-daemon-review-logs-toggle" data-logs-toggle="progress" aria-expanded="${progressExpanded ? 'true' : 'false'}" aria-label="${progressExpanded ? '收起全部过程' : '展开全部过程'}" title="${progressExpanded ? '收起' : '展开'}">
                <span class="ico wb-daemon-review-logs-file" data-icon="file" aria-hidden="true"></span>
                <strong>${esc(process.progress.title)}</strong>
                <span class="ico wb-daemon-review-logs-chevron" data-icon="chevronRight" aria-hidden="true"></span>
              </button>
              ${progressPreviewBtn}
            </header>
            <div class="wb-daemon-review-logs-body" data-logs-pane="progress"${daemonProgressCollapsed ? ' hidden' : ''}>${progressBody}</div>
          </section>
          <section class="wb-daemon-review-logs-block${daemonLogsCollapsed ? ' is-collapsed' : ''}" data-logs-block="logs">
            <header class="wb-daemon-review-logs-head">
              <button type="button" class="wb-daemon-review-logs-toggle" data-logs-toggle="logs" aria-expanded="${logsExpanded ? 'true' : 'false'}" aria-label="${logsExpanded ? '收起运行日志' : '展开运行日志'}" title="${logsExpanded ? '收起' : '展开'}">
                <span class="ico wb-daemon-review-logs-file" data-icon="history" aria-hidden="true"></span>
                <strong>${esc(process.logs.title)}</strong>
                <span class="ico wb-daemon-review-logs-chevron" data-icon="chevronRight" aria-hidden="true"></span>
              </button>
            </header>
            <div class="wb-daemon-review-logs-body" data-logs-pane="lines"${daemonLogsCollapsed ? ' hidden' : ''}>${logBody}</div>
          </section>
        </div>`
      daemonLogRenderSignature = nextSignature
      if (window.StickyIcons) window.StickyIcons.mount(elDaemonReviewBody)
      const linesPane = elDaemonReviewBody.querySelector('[data-logs-pane="lines"]')
      if (linesPane) {
        linesPane.addEventListener('scroll', () => {
          const api = daemonLogSseApi()
          daemonLogStickToBottom = api?.isNearBottom ? api.isNearBottom(linesPane) : true
        }, { passive: true })
        if (daemonLogStickToBottom) linesPane.scrollTop = linesPane.scrollHeight
      }
      return
    }
  }

  function closeDaemonProgressPreview() {
    const mask = document.getElementById('wbDaemonProgressPreviewMask')
    if (!mask) return
    mask.remove()
  }

  function openDaemonProgressPreview(contentEl) {
    if (!contentEl) return
    closeDaemonProgressPreview()
    const mask = document.createElement('div')
    mask.id = 'wbDaemonProgressPreviewMask'
    mask.className = 'wb-modal-mask'
    mask.innerHTML = `
      <div class="wb-modal wb-daemon-progress-preview-modal" role="dialog" aria-modal="true" aria-labelledby="wbDaemonProgressPreviewTitle">
        <div class="wb-modal-head">
          <strong class="wb-modal-title" id="wbDaemonProgressPreviewTitle">全部过程</strong>
          <button type="button" class="wb-modal-close" data-progress-preview-close aria-label="关闭">×</button>
        </div>
        <div class="wb-modal-body wb-daemon-progress-preview-modal-body"></div>
      </div>`
    const body = mask.querySelector('.wb-daemon-progress-preview-modal-body')
    if (body) {
      const clone = contentEl.cloneNode(true)
      clone.classList.add('is-preview')
      body.appendChild(clone)
    }
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDaemonProgressPreview()
        document.removeEventListener('keydown', onKey, true)
      }
    }
    mask.addEventListener('click', event => {
      if (event.target === mask || event.target.closest('[data-progress-preview-close]')) {
        closeDaemonProgressPreview()
        document.removeEventListener('keydown', onKey, true)
      }
    })
    document.addEventListener('keydown', onKey, true)
    document.body.appendChild(mask)
    if (window.StickyIcons) window.StickyIcons.mount(mask)
  }

  const daemonWorkspaceState = {
    open: false,
    busy: false,
    loadingPath: null,
    repo: null,
    expanded: {},
    currentBlob: null,
  }

  function fmtWorkspaceSize(bytes) {
    const n = Number(bytes) || 0
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  function daemonWorkspaceOpenPath() {
    const artifacts = Array.isArray(run.artifacts) ? run.artifacts : []
    for (const item of artifacts) {
      if (typeof item === 'string' && item.trim()) return item.trim()
      if (item && typeof item === 'object') {
        const path = String(item.path || item.localPath || item.file || '').trim()
        if (path && !/^https?:\/\//i.test(path)) return path
      }
    }
    return ''
  }

  function syncDaemonWorkspaceButton() {
    /* 代码工作区入口改挂在变更 Tab；保留函数供兼容调用 */
  }

  function setDaemonWorkspaceBusy(on, loadingPath) {
    daemonWorkspaceState.busy = !!on
    daemonWorkspaceState.loadingPath = on ? (loadingPath || null) : null
    const tree = document.getElementById('wbWsTree')
    if (tree) tree.classList.toggle('busy', !!on)
  }

  function closeDaemonWorkspace() {
    daemonWorkspaceState.open = false
    daemonWorkspaceState.busy = false
    daemonWorkspaceState.loadingPath = null
    const mask = document.getElementById('wbDaemonWorkspaceMask')
    if (mask) mask.hidden = true
  }

  function renderDaemonWorkspaceTree() {
    const tree = document.getElementById('wbWsTree')
    if (!tree) return
    const repo = daemonWorkspaceState.repo
    const rootEntries = daemonWorkspaceState.expanded[repo] || []
    const renderList = (entries) => (entries || []).map(node => {
      if (node.type === 'dir') {
        const expanded = !!daemonWorkspaceState.expanded[node.path]
        const loading = daemonWorkspaceState.loadingPath === node.path
        const enc = encodeURIComponent(node.path)
        const leadIcon = loading ? 'refresh' : (expanded ? 'chevronTree' : 'chevronRight')
        let children = ''
        if (loading) {
          children = `<div class="wb-ws-children"><div class="wb-ws-empty" style="min-height:0;padding:6px 8px">加载中…</div></div>`
        } else if (expanded) {
          children = `<div class="wb-ws-children">${renderList(daemonWorkspaceState.expanded[node.path])}</div>`
        }
        return `<div class="wb-ws-dir">
          <div class="wb-ws-node${loading ? ' loading' : ''}" data-ws-dir="${enc}">
            <span class="ico" data-icon="${leadIcon}" aria-hidden="true"></span>
            <span class="ico" data-icon="folder" aria-hidden="true"></span>
            <span class="wb-ws-name">${esc(node.name)}</span>
          </div>
          ${children}
        </div>`
      }
      const enc = encodeURIComponent(node.path)
      const active = daemonWorkspaceState.currentBlob === node.path
      return `<div class="wb-ws-node wb-ws-file${active ? ' active' : ''}" data-ws-file="${enc}" title="${escAttr(node.path)}">
        <span class="ico" data-icon="file" aria-hidden="true"></span>
        <span class="wb-ws-name">${esc(node.name)}</span>
        <span class="wb-ws-size">${esc(fmtWorkspaceSize(node.size || 0))}</span>
      </div>`
    }).join('')
    tree.innerHTML = rootEntries.length
      ? renderList(rootEntries)
      : `<div class="wb-ws-empty" style="min-height:80px">空目录。</div>`
    if (window.StickyIcons) window.StickyIcons.mount(tree)
  }

  async function loadDaemonWorkspaceDir(path) {
    if (daemonWorkspaceState.busy || !run.slug || !window.api?.workbenchDaemonWorkspaceTree) return
    setDaemonWorkspaceBusy(true, path)
    renderDaemonWorkspaceTree()
    try {
      const data = await window.api.workbenchDaemonWorkspaceTree(run.slug, path)
      if (!data?.ok) {
        toastFn(data?.error || data?.message || '目录加载失败', 'error')
        return
      }
      if (data.error) {
        toastFn(data.error, 'error')
        return
      }
      daemonWorkspaceState.expanded[path] = Array.isArray(data.entries) ? data.entries : []
    } catch (err) {
      toastFn(err?.message || '目录加载失败', 'error')
    } finally {
      setDaemonWorkspaceBusy(false)
      renderDaemonWorkspaceTree()
    }
  }

  async function loadDaemonWorkspaceRoot() {
    if (daemonWorkspaceState.busy || !run.slug || !window.api?.workbenchDaemonWorkspaceTree) return
    const tree = document.getElementById('wbWsTree')
    if (tree) tree.innerHTML = `<div class="wb-ws-empty" style="min-height:80px">加载中…</div>`
    setDaemonWorkspaceBusy(true, '')
    let data
    try {
      data = await window.api.workbenchDaemonWorkspaceTree(run.slug, '')
    } catch (err) {
      if (tree) tree.innerHTML = `<div class="wb-ws-empty">${esc(err?.message || '加载失败')}</div>`
      setDaemonWorkspaceBusy(false)
      return
    }
    setDaemonWorkspaceBusy(false)
    if (!data?.ok) {
      if (tree) tree.innerHTML = `<div class="wb-ws-empty">${esc(data?.error || data?.message || '加载失败')}</div>`
      return
    }
    const roots = (Array.isArray(data.entries) ? data.entries : []).filter(e => e && e.type === 'dir')
    const sel = document.getElementById('wbWsRepoSelect')
    if (sel) {
      sel.innerHTML = roots.map(r => `<option value="${escAttr(r.path)}">${esc(r.name)}</option>`).join('')
    }
    if (!roots.length) {
      if (tree) tree.innerHTML = `<div class="wb-ws-empty">该任务工作区暂无代码仓目录。</div>`
      return
    }
    daemonWorkspaceState.repo = roots[0].path
    if (sel) sel.value = daemonWorkspaceState.repo
    await loadDaemonWorkspaceDir(daemonWorkspaceState.repo)
  }

  async function loadDaemonWorkspaceBlob(path) {
    const head = document.getElementById('wbWsBlobPath')
    const box = document.getElementById('wbWsBlob')
    if (head) {
      head.textContent = path
      head.title = path
    }
    if (box) box.innerHTML = `<div class="wb-ws-empty" style="min-height:80px">加载中…</div>`
    setDaemonWorkspaceBusy(true, null)
    let data
    try {
      data = await window.api.workbenchDaemonWorkspaceBlob(run.slug, path)
    } catch (err) {
      if (box) box.innerHTML = `<div class="wb-ws-empty">${esc(err?.message || '加载失败')}</div>`
      setDaemonWorkspaceBusy(false)
      renderDaemonWorkspaceTree()
      return
    }
    setDaemonWorkspaceBusy(false)
    renderDaemonWorkspaceTree()
    if (daemonWorkspaceState.currentBlob !== path || !box) return
    if (!data?.ok) {
      box.innerHTML = `<div class="wb-ws-empty">${esc(data?.error || data?.message || '加载失败')}</div>`
      return
    }
    if (data.error) {
      box.innerHTML = `<div class="wb-ws-empty">${esc(data.error)}</div>`
      return
    }
    if (data.is_binary) {
      box.innerHTML = `<div class="wb-ws-empty">二进制文件（${esc(fmtWorkspaceSize(data.size || 0))}），无法预览。</div>`
      return
    }
    const tip = data.truncated
      ? `<div class="wb-daemon-review-tip" style="padding:8px 14px">文件已截断（超过上限）</div>`
      : ''
    box.innerHTML = `${tip}<pre class="wb-ws-code">${esc(data.content || '')}</pre>`
  }

  async function openDaemonWorkspaceBrowser() {
    if (!run.slug) {
      toastFn('当前没有可浏览的任务', 'error')
      return
    }
    if (!window.api?.workbenchDaemonWorkspaceTree) {
      toastFn('代码工作区接口不可用', 'error')
      return
    }
    daemonWorkspaceState.open = true
    daemonWorkspaceState.repo = null
    daemonWorkspaceState.expanded = {}
    daemonWorkspaceState.currentBlob = null
    const mask = document.getElementById('wbDaemonWorkspaceMask')
    const blob = document.getElementById('wbWsBlob')
    const head = document.getElementById('wbWsBlobPath')
    if (blob) blob.innerHTML = `<div class="wb-ws-empty">从左侧选择文件查看内容。</div>`
    if (head) head.textContent = '选择左侧文件查看内容'
    if (mask) mask.hidden = false
    if (window.StickyIcons) window.StickyIcons.mount(mask)
    await loadDaemonWorkspaceRoot()
  }

  function wireDaemonWorkspaceUi() {
    const mask = document.getElementById('wbDaemonWorkspaceMask')
    if (!mask || mask.dataset.wired === '1') return
    mask.dataset.wired = '1'
    mask.addEventListener('click', (event) => {
      if (event.target === mask) closeDaemonWorkspace()
    })
    const closeBtn = document.getElementById('wbWsClose')
    if (closeBtn) closeBtn.addEventListener('click', closeDaemonWorkspace)
    const refreshBtn = document.getElementById('wbWsRefresh')
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        if (daemonWorkspaceState.busy) return
        if (!daemonWorkspaceState.repo) {
          await loadDaemonWorkspaceRoot()
          return
        }
        const repo = daemonWorkspaceState.repo
        daemonWorkspaceState.expanded = {}
        await loadDaemonWorkspaceDir(repo)
        if (daemonWorkspaceState.currentBlob) await loadDaemonWorkspaceBlob(daemonWorkspaceState.currentBlob)
      })
    }
    const sel = document.getElementById('wbWsRepoSelect')
    if (sel) {
      sel.addEventListener('change', () => {
        const repo = sel.value
        if (!repo || daemonWorkspaceState.busy) {
          if (daemonWorkspaceState.repo) sel.value = daemonWorkspaceState.repo
          return
        }
        daemonWorkspaceState.repo = repo
        daemonWorkspaceState.expanded = {}
        daemonWorkspaceState.currentBlob = null
        const head = document.getElementById('wbWsBlobPath')
        const blob = document.getElementById('wbWsBlob')
        if (head) head.textContent = '选择左侧文件查看内容'
        if (blob) blob.innerHTML = `<div class="wb-ws-empty">从左侧选择文件查看内容。</div>`
        loadDaemonWorkspaceDir(repo)
      })
    }
    const tree = document.getElementById('wbWsTree')
    if (tree) {
      tree.addEventListener('click', (event) => {
        if (daemonWorkspaceState.busy) return
        const dir = event.target.closest('[data-ws-dir]')
        if (dir) {
          const path = decodeURIComponent(dir.getAttribute('data-ws-dir') || '')
          if (!path) return
          if (daemonWorkspaceState.expanded[path]) {
            delete daemonWorkspaceState.expanded[path]
            renderDaemonWorkspaceTree()
          } else {
            loadDaemonWorkspaceDir(path)
          }
          return
        }
        const file = event.target.closest('[data-ws-file]')
        if (file) {
          const path = decodeURIComponent(file.getAttribute('data-ws-file') || '')
          if (!path) return
          daemonWorkspaceState.currentBlob = path
          renderDaemonWorkspaceTree()
          loadDaemonWorkspaceBlob(path)
        }
      })
    }
  }

  function renderDaemonReview() {
    const api = daemonReviewApi()
    const isDaemon = run.mode === 'daemon'
    if (elDaemonReview) elDaemonReview.hidden = !isDaemon
    if (elTaskContextLegacy) elTaskContextLegacy.hidden = isDaemon
    const logSection = elRunnerLog && elRunnerLog.closest ? elRunnerLog.closest('.wb-runner-log-section') : null
    if (logSection) logSection.hidden = isDaemon
    if (elRunner) elRunner.classList.toggle('is-daemon-review', isDaemon)
    if (!isDaemon || !api || !elDaemonReviewBody) {
      syncDaemonWorkspaceButton()
      return
    }

    const surface = api.projectReviewSurface({
      slug: run.slug,
      intent: run.intent,
      workflow: run.workflow && (run.workflow.name || run.workflow.id),
      status: run.status,
      nodes: graphNodes(),
      statusSteps: statusStepsMap(run.task),
      artifacts: run.artifacts,
      events: run.events,
      changes: run.changes || {},
      progressText: run.progressText,
      logsText: run.processLogsText,
      activeTab: daemonReviewTab,
    })
    daemonReviewTab = surface.activeTab

    const identityEl = document.getElementById('wbDaemonReviewIdentity')
    const workflowNameEl = document.getElementById('wbDaemonReviewWorkflowName')
    const wfName = run.workflow
      ? String(workflowDisplayNameOf(run.workflow) || run.workflow.name || run.workflow.id || '').trim()
      : ''
    const identityFallback = String(run.slug || run.contextSummary || '').trim()
    const identityTitle = wfName || identityFallback
    if (identityEl && workflowNameEl) {
      const labelEl = identityEl.querySelector('.wb-daemon-review-identity-label')
      if (identityTitle) {
        if (labelEl) labelEl.textContent = wfName ? '工作流' : '任务'
        workflowNameEl.textContent = identityTitle
        identityEl.hidden = false
      } else {
        workflowNameEl.textContent = ''
        identityEl.hidden = true
      }
    }

    if (elDaemonReviewTabs) {
      elDaemonReviewTabs.querySelectorAll('[data-review-tab]').forEach(btn => {
        const id = btn.getAttribute('data-review-tab')
        const active = id === surface.activeTab
        btn.classList.toggle('is-active', active)
        btn.setAttribute('aria-selected', active ? 'true' : 'false')
      })
    }
    renderDaemonReviewBody(surface)
    syncDaemonWorkspaceButton()
    if (window.StickyIcons && elDaemonReview) window.StickyIcons.mount(elDaemonReview)
  }

  async function switchDaemonReviewTab(tab) {
    if (!['steps', 'artifacts', 'changes', 'events', 'logs'].includes(tab)) return
    daemonReviewTab = tab
    daemonReviewStepId = ''
    // 先切 UI，再轻量拉数，避免点 Tab 时串行卡死
    renderDaemonReview()
    if (tab === 'events') {
      await loadDaemonReviewExtras({ includeEvents: true, light: true })
      renderDaemonReview()
      return
    }
    if (tab === 'logs') {
      await loadDaemonReviewExtras({ light: false, forceLogs: !daemonLogStreamActive })
      startDaemonLogStream()
      renderDaemonReview()
      return
    }
    if (tab === 'changes') {
      if (run.changesLoaded) return
      run.changesLoading = true
      run.changesError = ''
      renderDaemonReview()
      await loadDaemonReviewExtras({ includeChanges: true, light: true })
      run.changesLoading = false
      renderDaemonReview()
    }
  }

  function daemonWorkflowRoster(workflow = null) {
    const ids = new Set(Array.isArray(workflow?.agentIds) ? workflow.agentIds.map(String) : [])
    const agents = (Array.isArray(data.daemonAgents) ? data.daemonAgents : [])
      .filter(agent => !ids.size || ids.has(String(agent.id)))
    return agents.map(agent => ({
      ...agent,
      origin: 'daemon',
      editable: false,
    }))
  }

  function materialChipLabel(item) {
    return item.shortLabel || item.label || item.id || '项'
  }

  function compactEndpointLabel(endpoint = '', fallback = '') {
    const raw = String(endpoint || '').trim()
    if (!raw) return String(fallback || '').trim()
    try {
      const url = new URL(raw)
      return url.host || raw.replace(/^https?:\/\//, '')
    } catch {
      return raw.replace(/^https?:\/\//, '')
    }
  }

  function daemonComposeFormState() {
    return {
      intent: daemonComposeIntent,
      goal: daemonComposeIntent,
      materials: daemonComposeMaterials,
      files: daemonComposeMaterials,
      inputs: loadDaemonContext(selectedDaemonWorkflowId || 'default'),
    }
  }

  function daemonComposeEvaluation(workflows = []) {
    const surface = daemonSurfaceApi()
    const daemon = data.daemon || {}
    const workflow = (workflows || []).find(item => item.id === selectedDaemonWorkflowId) || null
    const requirements = surface
      ? surface.resolveIngestRequirements(workflow || {}, daemonComposeLaunchContext)
      : []
    const preflight = surface && surface.assessComposePreflight
      ? surface.assessComposePreflight(daemon, workflow)
      : { ok: !!(daemon.online && workflow) }
    const evaluation = surface
      ? surface.evaluateIngest(daemonComposeFormState(), requirements, { daemon, workflow, preflight })
      : {
        canSubmit: !!(daemon.online && workflow && String(daemonComposeIntent || '').trim().length >= 20 && preflight.ok !== false),
        minGate: {
          ok: String(daemonComposeIntent || '').trim().length >= 20 || daemonComposeMaterials.length > 0,
          message: '请填写不少于 20 字的需求说明，或上传至少 1 个附件后再创建任务。',
        },
        preflight,
        items: [],
        warnings: [],
        hardBlockers: [],
      }
    return { workflow, requirements, evaluation, preflight }
  }

  async function refreshDaemonComposeLaunchContext(workflowId) {
    const id = String(workflowId || '').trim()
    if (!id || !window.api?.workbenchDaemonLaunchContext) {
      daemonComposeLaunchContext = null
      return
    }
    try {
      const res = await window.api.workbenchDaemonLaunchContext(id)
      daemonComposeLaunchContext = res?.ok ? (res.context || res) : null
    } catch {
      daemonComposeLaunchContext = null
    }
  }

  function appendDaemonComposeMaterials(files = []) {
    const next = (Array.isArray(files) ? files : []).map(file => {
      if (!file) return null
      if (typeof file === 'string') {
        const path = file.trim()
        if (!path) return null
        return { path, name: path.split(/[/\\]/).pop() }
      }
      const path = String(file.path || '').trim()
      if (!path) return null
      return {
        path,
        name: String(file.name || path.split(/[/\\]/).pop()).trim() || '材料',
      }
    }).filter(Boolean)
    if (!next.length) return 0
    const seen = new Set(daemonComposeMaterials.map(item => item.path))
    let added = 0
    for (const file of next) {
      if (seen.has(file.path)) continue
      seen.add(file.path)
      daemonComposeMaterials.push(file)
      added += 1
    }
    if (added) renderDaemonMode()
    return added
  }

  async function submitDaemonCompose() {
    if (daemonComposeSubmitting) return
    const daemon = data.daemon || {}
    const workflows = visibleWorkflows(daemon.workflows || [])
    const { workflow, evaluation, preflight } = daemonComposeEvaluation(workflows)
    if (!daemon.online) {
      toastFn('管线服务离线，请先连接', 'error')
      return
    }
    if (!workflow) {
      toastFn('请选择交付路径', 'error')
      return
    }
    if (preflight && preflight.ok === false) {
      toastFn(preflight.message || '执行器预检未通过，请先修复后再启动', 'error')
      renderDaemonMode()
      return
    }
    if (!evaluation.canSubmit) {
      const msg = evaluation.minGate?.message
        || evaluation.hardBlockers?.[0]?.detail
        || evaluation.preflight?.message
        || '请补全创建条件后再启动管线'
      toastFn(msg, 'error')
      renderDaemonMode()
      return
    }
    const surface = daemonSurfaceApi()
    const packed = surface
      ? surface.buildDaemonLaunchContextFromForm(daemonComposeFormState())
      : { intent: daemonComposeIntent, inputs: { intent: daemonComposeIntent } }
    const intent = String(packed.intent || daemonComposeIntent || '').trim()
    const context = packed.inputs && Object.keys(packed.inputs).length
      ? { inputs: packed.inputs }
      : null
    daemonComposeSubmitting = true
    renderDaemonMode()
    toastFn('正在启动管线…')
    try {
      const res = await beginDaemonRun(workflow, { intent, context })
      if (res && res.ok === false) return
      selectedDaemonTaskSlug = String(run?.slug || res?.slug || '').trim()
      daemonComposeIntent = ''
      daemonComposeMaterials = []
      try { await load() } catch (_) { /* overview refresh best-effort */ }
      if (selectedDaemonTaskSlug) {
        taskRoomReturnState = captureTaskRoomReturnState({
          surface: 'daemon',
          runId: selectedDaemonTaskSlug,
        })
        setWorkbenchPage('tasks')
        await openDaemonTask(selectedDaemonTaskSlug, { returnSurface: 'daemon' })
      } else {
        renderDaemonMode()
      }
    } finally {
      daemonComposeSubmitting = false
    }
  }

  function renderDaemonMode() {
    if (!elDaemonModeDetail || !elDaemonRunList) return
    const surface = daemonSurfaceApi()
    const daemon = data.daemon || {}
    const workflows = visibleWorkflows(daemon.workflows || [])
    const curated = surface
      ? surface.curateDaemonPaths(workflows)
      : { primary: workflows.slice(0, 4), more: workflows.slice(4) }
    const selectable = [...curated.primary, ...curated.more]
    if (!selectedDaemonWorkflowId || !selectable.some(item => item.id === selectedDaemonWorkflowId)) {
      selectedDaemonWorkflowId = curated.primary[0]?.id || selectable[0]?.id || ''
    }

    if (elDaemonModeStatus) {
      const online = !!daemon.online
      const endpoint = compactEndpointLabel(daemon.endpoint, '')
      const hint = String(daemon.hint || '').trim()
      const line = endpoint || hint || (online ? '本机' : '未检测到服务')
      elDaemonModeStatus.innerHTML = `
        <div class="wb-daemon-link ${online ? 'is-online' : 'is-offline'}">
          <span class="wb-daemon-pulse" aria-hidden="true"></span>
          <div class="wb-daemon-link-copy">
            <strong>${online ? '已连接' : '未连接'}</strong>
            <span class="wb-daemon-link-host" title="${esc(String(daemon.endpoint || hint || ''))}">${esc(line)}</span>
          </div>
          <button type="button" class="wb-daemon-link-btn icon" data-daemon-action="reconnect" title="${online ? '刷新连接' : '重试连接'}" aria-label="${online ? '刷新连接' : '重试连接'}">
            <span class="ico" data-icon="refresh" aria-hidden="true"></span>
          </button>
        </div>`
      if (window.StickyIcons) window.StickyIcons.mount(elDaemonModeStatus)
    }

    // keep hidden list mount populated for any path-helper consumers
    if (elDaemonModeList) {
      elDaemonModeList.innerHTML = selectable.map(item => {
        const name = surface ? surface.daemonPathPresentation(item).name : (item.name || item.id)
        return `<option value="${esc(item.id)}">${esc(name)}</option>`
      }).join('')
    }

    const { workflow } = daemonComposeEvaluation(selectable)
    const pathDisabled = !daemon.online || !selectable.length
    const pathOptions = selectable.map(item => {
      const presentation = surface
        ? surface.daemonPathPresentation(item)
        : { name: item.name || item.id }
      const locked = item.locked ? '（已锁定）' : ''
      return `<option value="${esc(item.id)}" ${item.id === selectedDaemonWorkflowId ? 'selected' : ''} ${item.locked ? 'disabled' : ''}>${esc(presentation.name)}${esc(locked)}</option>`
    }).join('')
    const pathTriggerLabel = workflow
      ? (surface ? surface.daemonPathPresentation(workflow).name : (workflow.name || workflow.id))
      : (selectable.length ? '请选择交付路径' : '暂无可用路径')
    const pathMenuHtml = selectable.length
      ? selectable.map(item => {
        const presentation = surface
          ? surface.daemonPathPresentation(item)
          : { name: item.name || item.id }
        const locked = !!item.locked
        const selected = item.id === selectedDaemonWorkflowId
        const label = `${presentation.name}${locked ? '（已锁定）' : ''}`
        return `<li role="option" class="wb-daemon-path-option${selected ? ' is-selected' : ''}${locked ? ' is-disabled' : ''}" data-value="${escAttr(item.id)}" aria-selected="${selected ? 'true' : 'false'}"${locked ? ' aria-disabled="true"' : ''}>${esc(label)}</li>`
      }).join('')
      : '<li role="option" class="wb-daemon-path-option is-disabled" aria-disabled="true">暂无可用路径</li>'
    const materialsHtml = daemonComposeMaterials.length
      ? `<ul class="wb-daemon-compose-files">${daemonComposeMaterials.map((file, index) => {
        const name = String(file.name || file.path || '材料').split(/[/\\]/).pop()
        return `<li>
          <span title="${esc(file.path || name)}">${esc(name)}</span>
          <button type="button" data-daemon-action="remove-material" data-index="${index}" aria-label="移除材料">移除</button>
        </li>`
      }).join('')}</ul>`
      : ''
    const offlineBlock = !daemon.online
    // 门槛校验在点击「启动管线」时 toast，不在表单上常驻红字；离线/无路径/提交中仍禁用
    const canAttemptSubmit = !daemonComposeSubmitting && !!daemon.online && !!workflow && selectable.length > 0

    elDaemonModeDetail.innerHTML = `
      <div class="wb-daemon-compose-panel">
        <p class="wb-daemon-compose-lead" id="wbDaemonComposeTitle">创建管线运行 · 描述目标后按默认流程启动</p>
        <div class="wb-daemon-compose-body">
          <div class="wb-daemon-compose-field">
            <span>交付路径</span>
            <div class="wb-daemon-path-select${pathDisabled ? ' is-disabled' : ''}">
              <select id="wbDaemonComposePath" class="wb-daemon-path-native" tabindex="-1" aria-hidden="true" ${pathDisabled ? 'disabled' : ''}>
                ${pathOptions || '<option value="">暂无可用路径</option>'}
              </select>
              <button type="button" class="wb-daemon-path-trigger" id="wbDaemonComposePathTrigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="wbDaemonComposePathMenu" ${pathDisabled ? 'disabled' : ''}>
                <span class="wb-daemon-path-trigger-label">${esc(pathTriggerLabel)}</span>
                <span class="wb-daemon-path-caret" aria-hidden="true">▾</span>
              </button>
              <ul class="wb-daemon-path-menu" id="wbDaemonComposePathMenu" role="listbox" aria-label="交付路径" hidden>
                ${pathMenuHtml}
              </ul>
            </div>
          </div>
          <label class="wb-daemon-compose-field wb-daemon-compose-field-intent">
            <span>你想完成什么？</span>
            <textarea id="wbDaemonComposeIntent" rows="3" placeholder="业务目标、范围、验收标准与约束（建议≥20 字）" ${offlineBlock ? 'disabled' : ''}>${esc(daemonComposeIntent)}</textarea>
          </label>
          <div class="wb-daemon-compose-materials">
            <button type="button" class="wb-daemon-compose-dropzone" data-daemon-action="pick-materials" ${offlineBlock || typeof window.api?.workbenchPickFiles !== 'function' ? 'disabled' : ''} aria-label="点击或拖拽文件到此处上传">
              <span class="wb-daemon-compose-dropzone-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 16.2A4.5 4.5 0 0 0 18.2 8h-.3A7 7 0 0 0 5.1 10.3 4 4 0 0 0 6 18h13"/>
                  <path d="M12 12v7"/>
                  <path d="m8.5 15.5 3.5-3.5 3.5 3.5"/>
                </svg>
              </span>
              <span class="wb-daemon-compose-dropzone-line">点击或拖拽文件到此处上传</span>
            </button>
            ${materialsHtml}
          </div>
        </div>
        <footer class="wb-daemon-compose-foot">
          <button type="button" class="wb-daemon-compose-btn primary" data-daemon-action="compose-submit" ${canAttemptSubmit ? '' : 'disabled'}>
            ${daemonComposeSubmitting ? '创建中…' : '开始开发'}
          </button>
        </footer>
        ${offlineBlock ? '<p class="wb-daemon-compose-offline">管线服务未连接，连接后即可创建管线运行。</p>' : ''}
      </div>`

    const filterDefs = [
      { id: 'all', label: '全部', icon: 'workbench', title: '全部运行' },
      { id: 'active', label: '进行', icon: 'play', title: '进行中' },
      { id: 'needs_you', label: '待办', icon: 'history', title: '需要你处理' },
      { id: 'done', label: '完成', icon: 'check', title: '已完成' },
      { id: 'failed', label: '失败', icon: 'circleX', title: '失败' },
    ]
    if (elDaemonRunFilters) {
      elDaemonRunFilters.innerHTML = filterDefs.map(item => (
        `<button type="button" class="wb-daemon-run-filter${daemonRunFilter === item.id ? ' active' : ''}" data-daemon-run-filter="${item.id}" role="tab" aria-selected="${daemonRunFilter === item.id ? 'true' : 'false'}" title="${esc(item.title)}" aria-label="${esc(item.title)}"><span class="ico" data-icon="${esc(item.icon)}" aria-hidden="true"></span></button>`
      )).join('')
      if (window.StickyIcons) window.StickyIcons.mount(elDaemonRunFilters)
    }

    const searchEl = document.getElementById('wbDaemonTaskSearch')
    if (searchEl && searchEl.value !== daemonTaskQuery) searchEl.value = daemonTaskQuery

    const tasks = Array.isArray(daemon.tasks) ? daemon.tasks : []
    const records = tasks.map(task => {
      if (surface?.daemonTaskCardView) {
        return { ...surface.daemonTaskCardView(task, workflows), task }
      }
      const view = surface
        ? surface.daemonRunRecordView(task, workflows)
        : {
          slug: task.slug || task.id || '',
          title: task.intent || task.title || task.slug || '管线记录',
          pathName: task.workflow || '',
          statusLabel: String(task.status || task.state || 'unknown'),
          badge: String(task.status || task.state || '—'),
          nextAction: '',
          bucket: 'active',
          updatedAt: task.updatedAt || '',
          secondary: '',
          cardTitle: task.intent || task.title || task.slug || '管线记录',
          cardMeta: [task.workflow, task.status || task.state].filter(Boolean).join(' · '),
          relativeTime: wbRelTime(task.updatedAt || task.createdAt || ''),
          tone: 'active',
        }
      return { ...view, task }
    })
    let filtered = surface
      ? surface.filterDaemonRunRecords(records, daemonRunFilter)
      : records
    if (surface?.searchDaemonRunRecords) {
      filtered = surface.searchDaemonRunRecords(filtered, daemonTaskQuery)
    } else if (daemonTaskQuery.trim()) {
      const q = daemonTaskQuery.trim().toLowerCase()
      filtered = filtered.filter(item => {
        const hay = [item.title, item.slug, item.pathName, item.cardTitle, item.cardMeta].join(' ').toLowerCase()
        return hay.includes(q)
      })
    }

    const filterLabel = filterDefs.find(item => item.id === daemonRunFilter)?.title || '全部运行'
    const runsTitle = document.getElementById('wbDaemonRunsTitle')
    if (runsTitle) runsTitle.textContent = filterLabel
    const runHead = document.getElementById('wbDaemonRunCount')
    if (runHead) {
      runHead.textContent = filtered.length ? `· ${filtered.length}` : ''
    }

    elDaemonRunList.innerHTML = filtered.length
      ? filtered.map(item => {
        const tip = [item.intentTitle || item.title, item.statusLabel, item.pathName].filter(Boolean).join(' · ')
        const active = selectedDaemonTaskSlug && selectedDaemonTaskSlug === item.slug
        return `
        <button type="button" class="wb-daemon-task-card tone-${esc(item.tone || item.bucket || 'active')}${active ? ' active' : ''}" data-task="${esc(item.slug)}" title="${esc(tip || item.cardTitle || item.title)}">
          <span class="wb-daemon-task-dot" aria-hidden="true"></span>
          <span class="wb-daemon-task-copy">
            <strong class="wb-daemon-task-title">${esc(item.cardTitle || item.intentTitle || item.title || item.slug)}</strong>
            ${(item.cardSummary || item.cardBrief) ? `<span class="wb-daemon-task-summary">${esc(item.cardSummary || item.cardBrief)}</span>` : ''}
            <span class="wb-daemon-task-meta">
              <em>${esc(item.cardMeta || item.statusLabel || '')}</em>
              <time>${esc(item.relativeTime || wbRelTime(item.updatedAt) || '')}</time>
            </span>
          </span>
        </button>`
      }).join('')
      : `<div class="wb-daemon-idle wb-daemon-idle-compact">
          <strong>${!daemon.online ? '服务离线' : (tasks.length ? '无匹配管线运行' : '暂无管线运行')}</strong>
          <span>${!daemon.online ? '连接后再查看运行记录' : '在左侧创建后会出现在这里'}</span>
        </div>`
  }

  function renderModeOverview() {
    const state = modeState()
    const mode = activeMode()
    if (!mode) return
    const root = document.getElementById('workbench')
    if (root) root.dataset.modeAccent = mode.id || 'office'
    if (elHeadSub) elHeadSub.textContent = ''
    renderConsoleOverview()
  }

  function consoleProjection() {
    const builder = window.WorkbenchConsoleModel?.buildConsoleProjection
    const snapshot = data.console && Array.isArray(data.console.domains) ? data.console : null
    if (!builder) return snapshot || { domains: [], runs: [], attention: [], automation: [], counts: {} }
    const live = builder({ ...data, activeDomainId: consoleDomain })
    if (!snapshot) return live
    const runs = new Map()
    ;[...(snapshot.runs || []), ...(live.runs || [])].forEach(item => {
      if (item?.id) runs.set(item.id, item)
    })
    const mergedRuns = [...runs.values()]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 100)
    const attention = mergedRuns
      .filter(item => item.attention)
      .map(item => ({
        runId: item.id,
        domain: item.domain,
        kind: item.status,
        title: item.title,
        detail: item.reason || (item.status === 'waiting' ? '等待处理后继续' : '运行失败，需要检查'),
      }))
    return {
      ...snapshot,
      generatedAt: live.generatedAt,
      activeDomainId: consoleDomain,
      domains: snapshot.domains?.length ? snapshot.domains : live.domains,
      runs: mergedRuns,
      attention,
      automation: live.automation?.length ? live.automation : (snapshot.automation || []),
      counts: {
        ...(snapshot.counts || {}),
        activeRuns: mergedRuns.filter(item => ['active', 'waiting'].includes(item.status)).length,
        attention: attention.length,
        artifacts: mergedRuns.reduce((total, item) => total + (Number(item.artifactCount) || 0), 0),
      },
    }
  }

  function filteredConsoleItems(items) {
    const values = Array.isArray(items) ? items : []
    return consoleDomain === 'all' ? values : values.filter(item => (item.domain || consoleDomainOf(item)) === consoleDomain)
  }

  function consoleSourceLabel(source) {
    if (window.WorkbenchLabels?.consoleSourceLabel) {
      return window.WorkbenchLabels.consoleSourceLabel(source)
    }
    return {
      daemon: '管线服务',
      'local-team': 'Local Team',
      'legacy-local': '兼容本地',
      automation: '自动化',
    }[String(source || '')] || '本机'
  }

  function renderConsoleOverview() {
    syncShelfFilterChips()
    renderShelf()
  }

  function studioAgentCandidates() {
    const seen = new Set()
    return [
      ...(Array.isArray(data.agents) ? data.agents : []),
    ].map(agent => ({
      ...agent,
      origin: agent.origin || 'local',
      editable: agent.editable !== false,
      id: String(agent.id || agent.expertId || agent.packageId || '').trim(),
      name: String(agent.name || agent.title || agent.role || agent.id || '未命名专家').trim(),
      description: String(agent.description || agent.summary || agent.persona?.role || '').trim(),
    })).filter(agent => {
      if (!agent.id || seen.has(agent.id) || agent.origin !== 'local' || agent.editable === false) return false
      seen.add(agent.id)
      return true
    })
  }

  function ensureStudioDraft(options = {}) {
    const model = window.WorkbenchStudioModel
    if (!model) return null
    if (options.reset === true) {
      studioDraft = model.createDraft({ name: '我的专家协作', goal: pendingGoal || '' })
      selectedStudioWorkflowId = ''
      selectedStudioNodeId = ''
      return studioDraft
    }
    if (studioDraft) return studioDraft
    const selected = (Array.isArray(data.workflowPackages) ? data.workflowPackages : [])
      .find(item => item.id === selectedStudioWorkflowId && item.graph?.nodes?.length)
    if (selected) {
      // 编辑既有流程时用包内目标/说明，勿注入会话 pendingGoal（那是某次运行意图，会污染 description）
      studioDraft = model.fromGraph(selected.graph, {
        id: `draft-${selected.id}`,
        name: selected.name,
        goal: selected.graph.goal || selected.description || '',
        inputs: selected.inputs || selected.graph.inputs || [],
        outputs: selected.outputs || selected.graph.outputs || [],
        sourceWorkflowId: selected.id,
      })
      // 加载草稿不预选节点；右侧属性栏仅在点击画布节点后展开。
      selectedStudioNodeId = ''
      return studioDraft
    }
    if (agentGraphPlan?.composition) {
      studioDraft = model.fromGraph(agentGraphPlan.composition, {
        name: agentGraphPlan.composition.name || '我的专家协作',
        goal: agentGraphPlan.composition.goal || pendingGoal,
        inputs: agentGraphPlan.composition.inputs || [],
        outputs: agentGraphPlan.composition.outputs || [],
      })
      selectedStudioNodeId = ''
      return studioDraft
    }
    studioDraft = model.createDraft({ name: '我的专家协作', goal: pendingGoal || '' })
    return studioDraft
  }

  function studioNodeProfile(node) {
    const profile = node?.profile && typeof node.profile === 'object' ? node.profile : {}
    return {
      id: profile.id || node?.profileId || '',
      agentId: node?.agentPackageId || '',
      name: profile.name || node?.name || node?.agentPackageId || 'Agent',
      roleOverlay: profile.roleOverlay || node?.role || '',
      promptOverlay: profile.promptOverlay || '',
      skillRefs: Array.isArray(profile.skillRefs) ? profile.skillRefs : [],
      knowledgeRefs: Array.isArray(profile.knowledgeRefs) ? profile.knowledgeRefs : [],
      connectorRefs: Array.isArray(profile.connectorRefs) ? profile.connectorRefs : [],
      knowledgePolicy: profile.knowledgePolicy || { mode: 'selected', includeWorkMemory: false },
      memoryPolicy: profile.memoryPolicy || { scope: 'session' },
      modelPolicy: profile.modelPolicy || {},
      permissions: profile.permissions || { files: 'workspace' },
      outputContract: profile.outputContract || { format: 'markdown' },
      budget: profile.budget || {},
    }
  }

  function refIds(values) {
    return new Set((Array.isArray(values) ? values : []).map(item => String(item?.id || item || '')).filter(Boolean))
  }

  function studioSkillOptions() {
    return (Array.isArray(data.skills) ? data.skills : []).slice(0, 60)
  }

  function studioSkillPicker(node) {
    const selected = refIds(studioNodeProfile(node).skillRefs)
    const skills = studioSkillOptions()
    if (!skills.length) {
      return `<div class="wb-studio-skill-group">
        <div class="wb-studio-io-head"><span>本步骤技能</span></div>
        <p class="wb-studio-skill-empty">还没有可用技能。<button type="button" class="wb-flow-library-action" data-studio-open-skills>去专家库添加</button></p>
      </div>`
    }
    const options = skills.map(skill => {
      const id = String(skill.id || '')
      const hint = String(skill.description || skill.category || '')
      return `<label class="wb-studio-skill-option" data-skill-search="${escAttr(`${id} ${skill.name || ''} ${hint}`.toLowerCase())}">
        <input type="checkbox" data-studio-skill="${escAttr(id)}"${selected.has(id) ? ' checked' : ''}>
        <span><strong>${esc(skill.name || id)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
      </label>`
    }).join('')
    // 装了几十个技能时，没有过滤就只能在 168px 的滚动框里翻找。
    const filter = skills.length > 8
      ? '<input class="wb-studio-skill-filter" data-studio-skill-filter placeholder="搜索技能" aria-label="搜索技能">'
      : ''
    return `<div class="wb-studio-skill-group">
      <div class="wb-studio-io-head">
        <span>本步骤技能</span>
        <span class="wb-studio-skill-count" data-studio-skill-count>已选 ${selected.size}/${skills.length}</span>
      </div>
      ${filter}
      <div class="wb-studio-skill-list">${options}</div>
    </div>`
  }

  function filterStudioSkills(query) {
    const needle = String(query || '').trim().toLowerCase()
    for (const option of elStudioInspector?.querySelectorAll('[data-skill-search]') || []) {
      const match = !needle || option.getAttribute('data-skill-search').includes(needle)
      option.hidden = !match && !option.querySelector('input')?.checked
    }
  }

  function readStudioSkillSelection() {
    const inputs = [...(elStudioInspector?.querySelectorAll('[data-studio-skill]') || [])]
    if (!inputs.length) return null
    return inputs
      .filter(input => input.checked)
      .map(input => ({ id: input.getAttribute('data-studio-skill'), version: 'latest' }))
  }

  function studioNodeSummary(node, profile) {
    const skills = Array.isArray(profile?.skillRefs) ? profile.skillRefs.length : 0
    if (!studioSimpleMode) return `${node.role || '未设置职责'} · ${skills} 个 Skill`
    return [node.intent || '点击后填写本步骤目标', skills ? `${skills} 个 Skill` : '']
      .filter(Boolean)
      .join(' · ')
  }

  function studioIoRows(values = [], ioType) {
    const rows = Array.isArray(values) && values.length ? values : [{ id: `${ioType}-1`, label: '', type: 'text', required: ioType === 'input', example: '', description: '', options: [] }]
    return rows.map((item) => {
      const optionsText = Array.isArray(item?.options) ? item.options.join('，') : ''
      const isEnum = item?.type === 'enum'
      return `<div class="wb-studio-io-row" data-studio-io-row="${ioType}">
        <label class="wb-studio-io-field wb-studio-io-field--name">
          <span>字段名</span>
          <input data-studio-io="${ioType}:label" value="${escAttr(item?.label || '')}" maxlength="160" placeholder="如：需求文档链接">
        </label>
        <div class="wb-studio-io-row-meta">
          <label class="wb-studio-io-field">
            <span>类型</span>
            <select data-studio-io="${ioType}:type">
              <option value="text"${(item?.type || 'text') === 'text' ? ' selected' : ''}>文本</option>
              <option value="number"${item?.type === 'number' ? ' selected' : ''}>数字</option>
              <option value="boolean"${item?.type === 'boolean' ? ' selected' : ''}>是/否</option>
              <option value="enum"${isEnum ? ' selected' : ''}>枚举</option>
              <option value="url"${item?.type === 'url' ? ' selected' : ''}>链接</option>
              <option value="json"${item?.type === 'json' ? ' selected' : ''}>JSON</option>
            </select>
          </label>
          <label class="wb-studio-io-required"><input type="checkbox" data-studio-io="${ioType}:required"${item?.required ? ' checked' : ''}><span>必填</span></label>
          <button type="button" class="wb-studio-node-action danger" data-studio-io-remove="${ioType}" aria-label="移除此项" title="移除此项">×</button>
        </div>
        <label class="wb-studio-io-field">
          <span>示例值</span>
          <input data-studio-io="${ioType}:example" value="${escAttr(item?.example || '')}" maxlength="240" placeholder="可选">
        </label>
        <label class="wb-studio-io-field wb-studio-io-field--options"${isEnum ? '' : ' hidden'}>
          <span>枚举项</span>
          <input data-studio-io="${ioType}:options" value="${escAttr(optionsText)}" maxlength="240" placeholder="用逗号分隔，如：A，B，C">
        </label>
      </div>`
    }).join('')
  }

  function parseStudioIoRows(ioType) {
    const existingKey = ioType === 'output' ? 'outputs' : 'inputs'
    const existing = Array.isArray(studioDraft?.[existingKey]) ? studioDraft[existingKey] : []
    const rows = [...(elStudioInspector?.querySelectorAll(`[data-studio-io-row="${ioType}"]`) || [])]
    return rows
      .map((row, index) => {
        const read = key => String(row.querySelector(`[data-studio-io="${ioType}:${key}"]`)?.value || '').trim()
        const label = read('label')
        if (!label) return null
        const type = read('type') || 'text'
        const required = row.querySelector(`[data-studio-io="${ioType}:required"]`)?.checked === true
        const options = read('options')
          .split(/[，,]/)
          .map(item => item.trim())
          .filter(Boolean)
          .slice(0, 20)
        return {
          // 保留已有 id，避免每次 sync 重写 id 被当成「有修改」
          id: String(existing[index]?.id || `${ioType}-${index + 1}`),
          label,
          type,
          required,
          example: read('example'),
          options,
        }
      })
      .filter(Boolean)
      .slice(0, 16)
  }

  function studioIoFingerprint(list) {
    return JSON.stringify((Array.isArray(list) ? list : []).map(item => ([
      String(item?.id || ''),
      String(item?.label || ''),
      String(item?.type || 'text'),
      item?.required === true,
      String(item?.example || ''),
      Array.isArray(item?.options) ? item.options.join(',') : '',
    ])))
  }

  function studioRelationLabel(value) {
    if (value === 'parallel') return '与下一步同时执行'
    if (value === 'approval') return '下一步前需要确认'
    return '完成后进入下一步'
  }

  function studioCanvasSectionsHtml(sections) {
    if (!Array.isArray(sections) || !sections.length) return ''
    return sections.map(section => {
      if (!section || !section.title) return ''
      const tone = section.tone === 'warn' ? ' is-warn' : (section.tone === 'empty' ? ' is-empty' : '')
      if (section.mode === 'text') {
        const text = section.rows?.[0] || '—'
        return `<section class="wb-studio-flow-section mode-text${tone}">
          <header class="wb-studio-flow-section-head">${esc(section.title)}</header>
          <p class="wb-studio-flow-section-text" title="${escAttr(text)}">${esc(text)}</p>
        </section>`
      }
      const list = (section.rows || []).map(row =>
        `<div class="wb-studio-flow-kv"><span class="wb-studio-flow-kv-key" title="${escAttr(row)}">${esc(row)}</span></div>`
      ).join('')
      return `<section class="wb-studio-flow-section${tone}">
        <header class="wb-studio-flow-section-head">${esc(section.title)}</header>
        <div class="wb-studio-flow-section-body">${list}</div>
      </section>`
    }).join('')
  }

  function clampStudioScale(value) {
    return Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, Number(value) || 1))
  }

  function applyStudioViewTransform() {
    if (!elStudioGraph) return
    const viewport = elStudioGraph.querySelector('[data-studio-viewport]')
    if (viewport) {
      viewport.style.transform = `translate(${studioView.tx}px, ${studioView.ty}px) scale(${studioView.scale})`
    }
    elStudioGraph.classList.toggle('is-panning', studioPanning)
    elStudioGraph.classList.toggle('is-space-pan', studioSpaceHeld)
    const label = elStudioGraph.querySelector('[data-studio-zoom-label]')
    if (label) label.textContent = `${Math.round(studioView.scale * 100)}%`
  }

  function setStudioScale(nextScale, originClientX, originClientY) {
    if (!elStudioGraph) return
    const prev = studioView.scale
    const next = clampStudioScale(nextScale)
    if (next === prev) {
      applyStudioViewTransform()
      return
    }
    const rect = elStudioGraph.getBoundingClientRect()
    const mx = Number.isFinite(originClientX) ? originClientX - rect.left : rect.width / 2
    const my = Number.isFinite(originClientY) ? originClientY - rect.top : rect.height / 2
    const contentX = (mx - studioView.tx) / prev
    const contentY = (my - studioView.ty) / prev
    studioView.scale = next
    studioView.tx = mx - contentX * next
    studioView.ty = my - contentY * next
    applyStudioViewTransform()
  }

  function resetStudioView(options = {}) {
    studioView = { scale: 1, tx: 0, ty: 0 }
    if (options.fit && elStudioGraph) {
      const board = elStudioGraph.querySelector('[data-studio-board]')
      if (board) {
        const gw = elStudioGraph.clientWidth || 1
        const gh = elStudioGraph.clientHeight || 1
        const bw = board.offsetWidth || 1
        const bh = board.offsetHeight || 1
        const fit = Math.min(1, (gw - 48) / bw, (gh - 48) / bh)
        studioView.scale = clampStudioScale(fit)
        studioView.tx = Math.max(16, (gw - bw * studioView.scale) / 2)
        studioView.ty = Math.max(16, (gh - bh * studioView.scale) / 2)
      }
    }
    applyStudioViewTransform()
  }

  function studioKindIcon(kind) {
    if (window.WorkbenchStudioCanvas?.iconForKind) {
      return window.WorkbenchStudioCanvas.iconForKind(kind)
    }
    return ({
      start: 'play',
      end: 'square',
      agent: 'users',
      llm: 'optimize',
      tool: 'component',
      knowledge: 'bookOpen',
      condition: 'workflow',
      join: 'network',
      gate: 'clipboardCheck',
    })[kind] || 'component'
  }

  function studioCanvasNodeHtml(node) {
    const kind = node.kind || 'agent'
    const icon = studioKindIcon(kind)
    const ports = []
    if (node.canInput !== false && kind !== 'start') {
      ports.push('<span class="wb-studio-port wb-studio-port--in side-left" data-studio-port="in" data-studio-side="left" title="入口 · 左" aria-hidden="true"></span>')
      ports.push('<span class="wb-studio-port wb-studio-port--in side-top" data-studio-port="in" data-studio-side="top" title="入口 · 上" aria-hidden="true"></span>')
    }
    if (node.canOutput !== false && kind !== 'end') {
      if (kind === 'condition') {
        ports.push('<span class="wb-studio-port wb-studio-port--out side-right branch-true" data-studio-port="out" data-studio-side="right" data-studio-branch="true" title="成立" aria-hidden="true"></span>')
        ports.push('<span class="wb-studio-port wb-studio-port--out side-right branch-false" data-studio-port="out" data-studio-side="right" data-studio-branch="false" title="不成立" aria-hidden="true"></span>')
        ports.push('<span class="wb-studio-port wb-studio-port--out side-bottom branch-true" data-studio-port="out" data-studio-side="bottom" data-studio-branch="true" title="成立 · 下" aria-hidden="true"></span>')
      } else {
        ports.push('<span class="wb-studio-port wb-studio-port--out side-right" data-studio-port="out" data-studio-side="right" title="出口 · 右" aria-hidden="true"></span>')
        ports.push('<span class="wb-studio-port wb-studio-port--out side-bottom" data-studio-port="out" data-studio-side="bottom" title="出口 · 下" aria-hidden="true"></span>')
      }
    }
    const removable = !['start', 'end'].includes(kind)
    const agentTools = removable
      ? `<span class="wb-studio-flow-node-tools">
          ${kind !== 'join' && kind !== 'gate' && kind !== 'condition' ? '<button type="button" class="wb-studio-node-action" data-studio-duplicate title="复制" aria-label="复制">＋</button>' : ''}
          <button type="button" class="wb-studio-node-action danger" data-studio-remove title="删除节点" aria-label="删除节点">×</button>
        </span>`
      : ''
    const titleHtml = `<strong title="${escAttr(node.title)}">${esc(node.title)}</strong>`
    const sections = studioCanvasSectionsHtml(node.sections)
    const relationBadge = kind === 'condition'
      ? '<span class="wb-studio-flow-badge">双分支</span>'
      : (kind === 'agent' && node.relation && node.relation !== 'serial'
        ? `<span class="wb-studio-flow-badge">${esc(studioRelationLabel(node.relation))}</span>`
        : '')
    const typeLabel = node.typeLabel ? `<em class="wb-studio-flow-type">${esc(node.typeLabel)}</em>` : ''
    return `<article
      class="wb-studio-flow-node is-summary kind-${escAttr(kind)}${node.selected ? ' active' : ''}"
      style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px"
      data-studio-node="${escAttr(node.id)}"
      data-studio-kind="${escAttr(kind)}"
      draggable="false"
      tabindex="0"
      role="group"
      aria-pressed="${node.selected ? 'true' : 'false'}"
      aria-label="${escAttr(node.title)}">
      ${ports.join('')}
      <header class="wb-studio-flow-head">
        <span class="wb-studio-flow-icon" aria-hidden="true"><span class="ico" data-icon="${escAttr(icon)}"></span></span>
        <span class="wb-studio-flow-titles">
          ${typeLabel}
          ${titleHtml}
          ${node.subtitle ? `<small title="${escAttr(node.subtitle)}">${esc(node.subtitle)}</small>` : ''}
        </span>
        ${relationBadge}
        ${agentTools}
      </header>
      <div class="wb-studio-flow-sections">${sections}</div>
    </article>`
  }

  function studioWorkflowDisplayName(draft = studioDraft) {
    const name = String(draft?.name || '').trim()
    return name || '我的专家协作'
  }

  function studioHeadMetaText(draft = studioDraft) {
    if (!draft) return '编排工作流'
    const nodes = Array.isArray(draft.nodes) ? draft.nodes : []
    const dirty = draft.dirty ? '未保存' : '已保存'
    return nodes.length
      ? `编排工作流 · ${nodes.length} 节点 · ${dirty}`
      : `编排工作流 · ${dirty}`
  }

  function renderStudioHeadChrome() {
    if (!studioDraft) return
    const editing = elStudioTitleInput && !elStudioTitleInput.hidden
    if (elStudioTitle && !editing) {
      elStudioTitle.textContent = studioWorkflowDisplayName()
    }
    if (elStudioTopMeta) elStudioTopMeta.textContent = studioHeadMetaText()
  }

  function beginStudioTitleEdit() {
    if (!studioDraft || !elStudioTitle || !elStudioTitleInput) return
    const current = studioWorkflowDisplayName()
    elStudioTitle.hidden = true
    elStudioTitleInput.hidden = false
    elStudioTitleInput.value = current
    elStudioTitleInput.focus()
    elStudioTitleInput.select()
  }

  function cancelStudioTitleEdit() {
    if (!elStudioTitle || !elStudioTitleInput) return
    elStudioTitleInput.hidden = true
    elStudioTitle.hidden = false
    elStudioTitleInput.value = ''
    renderStudioHeadChrome()
  }

  function commitStudioTitleEdit() {
    const model = window.WorkbenchStudioModel
    if (!studioDraft || !elStudioTitleInput || !model) {
      cancelStudioTitleEdit()
      return
    }
    const nextName = String(elStudioTitleInput.value || '').trim() || studioWorkflowDisplayName()
    const prev = String(studioDraft.name || '').trim()
    elStudioTitleInput.hidden = true
    if (elStudioTitle) elStudioTitle.hidden = false
    if (nextName !== prev) {
      studioDraft = model.updateDraft(studioDraft, { name: nextName })
      const inspectorName = elStudioInspector?.querySelector('[data-studio-workflow-field="name"]')
      if (inspectorName) inspectorName.value = nextName
    }
    renderStudioHeadChrome()
  }

  function markStudioDraftDirtyMeta() {
    if (!studioDraft) return
    studioDraft.dirty = true
    const nodes = studioDraft.nodes || []
    const inputCount = Array.isArray(studioDraft.inputs) ? studioDraft.inputs.length : 0
    const outputCount = Array.isArray(studioDraft.outputs) ? studioDraft.outputs.length : 0
    const business = nodes.filter(n => !['start', 'end'].includes(n.kind)).length
    if (elStudioGraphMeta) elStudioGraphMeta.textContent = `${business || nodes.length} 节点 · ${inputCount}入/${outputCount}出 · 未保存`
    renderStudioHeadChrome()
  }

  function renderStudioPalette() {
    const el = document.getElementById('wbStudioPalette')
    if (!el || !window.WorkbenchStudioCanvas) return
    const groups = []
    for (const item of window.WorkbenchStudioCanvas.paletteTypes()) {
      const id = item.group || 'default'
      let section = groups.find(entry => entry.id === id)
      if (!section) {
        section = { id, title: item.groupTitle || '组件', items: [] }
        groups.push(section)
      }
      section.items.push(item)
    }
    el.innerHTML = groups.map(section => `
      <section class="wb-studio-palette-section" aria-label="${escAttr(section.title)}">
        <div class="wb-studio-palette-section-title">${esc(section.title)}</div>
        <div class="wb-studio-palette-col">
          ${section.items.map(item => {
            const icon = studioKindIcon(item.kind)
            return `
            <button type="button" class="wb-studio-palette-item kind-${escAttr(item.kind)}" data-studio-palette="${escAttr(item.kind)}" title="${escAttr(item.hint)}">
              <span class="wb-studio-palette-glyph" aria-hidden="true"><span class="ico" data-icon="${escAttr(icon)}"></span></span>
              <strong>${esc(item.title)}</strong>
            </button>`
          }).join('')}
        </div>
      </section>`).join('')
    if (window.StickyIcons) window.StickyIcons.mount(el)
  }

  function closeStudioExpertPicker(options = {}) {
    if (!studioExpertPickerEl) return
    studioExpertPickerEl.hidden = true
    if (options.preserveResume !== true) {
      studioExpertPickerSelected = new Set()
      studioExpertPickerQuery = ''
    }
  }

  function studioExpertPickerLibraryButtonHtml() {
    return `<button type="button" class="wb-studio-expert-picker-library" data-studio-expert-picker-library title="打开专家库，添加专家到工作台">
      <span class="ico" data-icon="capabilityStack" aria-hidden="true"></span>
      <span>专家库</span>
    </button>`
  }

  function openStudioExpertLibraryFromPicker() {
    resumeStudioExpertPickerAfterHub = true
    closeStudioExpertPicker({ preserveResume: true })
    openCapabilityPicker('experts')
  }

  async function resumeStudioExpertPickerFromHub() {
    if (!resumeStudioExpertPickerAfterHub) return
    resumeStudioExpertPickerAfterHub = false
    try {
      await refreshModes()
    } catch { /* best-effort */ }
    openStudioExpertPicker()
  }

  function studioExpertPickerCandidates() {
    const q = String(studioExpertPickerQuery || '').trim().toLowerCase()
    return workbenchQuickExperts().filter(agent => {
      if (!q) return true
      return `${agent.id} ${agent.name} ${agent.description || ''} ${agent.category || ''}`.toLowerCase().includes(q)
    })
  }

  function renderStudioExpertPickerCard(agent, index = 0) {
    const id = String(agent.id || '').trim()
    const selected = studioExpertPickerSelected.has(id)
    const title = expertCardTitle(agent)
    const origin = expertCardOrigin(agent)
    const sub = [
      agent.category || '专家',
      expertSourceLabel(agent.source),
      origin,
    ].filter(Boolean).join(' · ')
    const desc = agent.description || agent.summary || '安排这位专家协作'
    const version = String(agent.version || '1.0.0').replace(/^v/i, '')
    return `
      <button type="button"
        class="wb-task-quick-card wb-studio-expert-pick-card${selected ? ' is-selected' : ''}"
        data-studio-expert-pick="${escAttr(id)}"
        style="--index:${index}"
        aria-pressed="${selected ? 'true' : 'false'}"
        aria-label="${escAttr(`${selected ? '取消选择' : '选择'} ${title}`)}">
        <span class="wb-studio-expert-pick-check" aria-hidden="true"${selected ? '' : ' hidden'}>✓</span>
        <div class="wb-task-quick-head">
          ${agentAvatarMark(agent, 'wb-task-quick-icon', 38)}
          <div class="wb-task-quick-meta">
            <div class="wb-task-quick-title">${esc(title)}</div>
            <div class="wb-task-quick-sub">${esc(sub)}</div>
          </div>
        </div>
        <div class="wb-task-quick-desc">${esc(desc)}</div>
        <div class="wb-task-quick-foot">
          <div class="wb-task-quick-badges">${expertCardStatusBadge(agent)}</div>
          <span class="wb-task-quick-version">v${esc(version)}</span>
        </div>
      </button>`
  }

  function renderStudioExpertPicker() {
    const mask = ensureStudioExpertPicker()
    const grid = mask.querySelector('#wbStudioExpertPickerGrid')
    const hint = mask.querySelector('#wbStudioExpertPickerHint')
    const search = mask.querySelector('#wbStudioExpertPickerSearch')
    const confirmBtn = mask.querySelector('[data-studio-expert-picker-confirm]')
    if (search && search.value !== studioExpertPickerQuery) search.value = studioExpertPickerQuery
    const experts = studioExpertPickerCandidates()
    if (grid) {
      grid.innerHTML = experts.length
        ? experts.map((agent, index) => renderStudioExpertPickerCard(agent, index)).join('')
        : `<div class="wb-task-quick-empty">${
          workbenchQuickExperts().length
            ? '没有匹配的专家，试试其他关键词。'
            : '还没有添加到工作台的专家。点击右上角「专家库」，选择专家并「添加到工作台」后即可在这里选用。'
        }</div>`
    }
    const count = studioExpertPickerSelected.size
    if (hint) hint.textContent = count ? `已选 ${count} 位` : '可多选后一次加入画布'
    if (confirmBtn) confirmBtn.disabled = count === 0
    if (window.StickyIcons) window.StickyIcons.mount(mask)
  }

  function ensureStudioExpertPicker() {
    if (studioExpertPickerEl) return studioExpertPickerEl
    const mask = document.createElement('div')
    mask.className = 'wb-modal-mask is-studio-expert-picker'
    mask.id = 'wbStudioExpertPicker'
    mask.hidden = true
    mask.innerHTML = `
      <div class="wb-modal wb-studio-expert-picker" role="dialog" aria-modal="true" aria-labelledby="wbStudioExpertPickerTitle">
        <div class="wb-modal-head">
          <strong class="wb-modal-title" id="wbStudioExpertPickerTitle">选择工作台专家</strong>
          <div class="wb-studio-expert-picker-head-actions">
            ${studioExpertPickerLibraryButtonHtml()}
            <button type="button" class="wb-modal-close" data-studio-expert-picker-close aria-label="关闭">×</button>
          </div>
        </div>
        <div class="wb-modal-body">
          <input class="wb-studio-search" id="wbStudioExpertPickerSearch" placeholder="搜索专家" aria-label="搜索专家" autocomplete="off">
          <div class="wb-studio-expert-picker-grid" id="wbStudioExpertPickerGrid"></div>
        </div>
        <div class="wb-modal-foot">
          <span class="wb-modal-hint" id="wbStudioExpertPickerHint">可多选后一次加入画布</span>
          <div class="wb-modal-actions">
            <button type="button" class="wb-modal-btn" data-studio-expert-picker-close>取消</button>
            <button type="button" class="wb-modal-btn primary" data-studio-expert-picker-confirm disabled>添加到画布</button>
          </div>
        </div>
      </div>`
    document.body.appendChild(mask)
    mask.addEventListener('click', event => {
      if (event.target === mask || event.target.closest('[data-studio-expert-picker-close]')) {
        resumeStudioExpertPickerAfterHub = false
        closeStudioExpertPicker()
        return
      }
      if (event.target.closest('[data-studio-expert-picker-library]')) {
        openStudioExpertLibraryFromPicker()
        return
      }
      const card = event.target.closest('[data-studio-expert-pick]')
      if (card) {
        const id = card.getAttribute('data-studio-expert-pick') || ''
        if (!id) return
        if (studioExpertPickerSelected.has(id)) studioExpertPickerSelected.delete(id)
        else studioExpertPickerSelected.add(id)
        renderStudioExpertPicker()
        return
      }
      if (event.target.closest('[data-studio-expert-picker-confirm]')) {
        confirmStudioExpertPicker()
      }
    })
    mask.querySelector('#wbStudioExpertPickerSearch')?.addEventListener('input', event => {
      studioExpertPickerQuery = String(event.target.value || '').trim()
      renderStudioExpertPicker()
      event.target.focus()
    })
    studioExpertPickerEl = mask
    return mask
  }

  function openStudioExpertPicker() {
    studioExpertPickerSelected = new Set()
    studioExpertPickerQuery = ''
    const mask = ensureStudioExpertPicker()
    mask.hidden = false
    renderStudioExpertPicker()
    requestAnimationFrame(() => mask.querySelector('#wbStudioExpertPickerSearch')?.focus())
  }

  function confirmStudioExpertPicker() {
    const model = window.WorkbenchStudioModel
    if (!model) return
    const byId = new Map(workbenchQuickExperts().map(agent => [agent.id, agent]))
    const agents = [...studioExpertPickerSelected]
      .map(id => byId.get(id))
      .filter(Boolean)
    if (!agents.length) {
      toastFn('请至少选择一位专家', 'error')
      return
    }
    ensureStudioDraft()
    let lastId = selectedStudioNodeId
    for (const agent of agents) {
      studioDraft = model.addAgent(studioDraft, agent)
      lastId = studioDraft.nodes.at(-1)?.id || lastId
    }
    selectedStudioNodeId = lastId
    closeStudioExpertPicker()
    renderStudio()
    toastFn(agents.length === 1 ? `已添加 ${agents[0].name || '专家'}` : `已添加 ${agents.length} 位专家`)
  }

  function studioIconBtn(attrs) {
    const {
      action,
      tool,
      icon,
      label,
      primary = false,
      disabled = false,
      pressed = null,
    } = attrs
    const dataAttr = action
      ? `data-studio-action="${escAttr(action)}"`
      : `data-studio-tool="${escAttr(tool)}"`
    const pressedAttr = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`
    const cls = `wb-studio-tool-btn${primary ? ' primary' : ''}`
    return `<button type="button" class="${cls}" ${dataAttr} title="${escAttr(label)}" aria-label="${escAttr(label)}"${pressedAttr}${disabled ? ' disabled' : ''}><span class="ico" data-icon="${escAttr(icon)}" aria-hidden="true"></span></button>`
  }

  function applyStudioNodePositions(positions) {
    const model = window.WorkbenchStudioModel
    if (!model || !studioDraft || !Array.isArray(positions)) return
    let next = studioDraft
    positions.forEach(pos => {
      if (!pos?.id) return
      next = model.updatePosition(next, pos.id, pos.x, pos.y)
    })
    studioDraft = next
  }

  function runStudioAutoLayout() {
    const canvasApi = window.WorkbenchStudioCanvas
    const model = window.WorkbenchStudioModel
    if (!canvasApi?.layoutPositions || !model || !studioDraft) return
    ensureStudioDraft()
    if (studioDraft.graphMode !== 'free') {
      studioDraft = model.ensureFreeGraph(studioDraft)
    }
    const positions = canvasApi.layoutPositions(studioDraft)
    if (!positions.length) {
      toastFn('画布上还没有可对齐的节点', 'error')
      return
    }
    applyStudioNodePositions(positions)
    renderStudio()
    requestAnimationFrame(() => resetStudioView({ fit: true }))
    toastFn('已一键对齐')
  }

  function renderStudioToolbar(nodes) {
    const hasNodes = Array.isArray(nodes) && nodes.length > 0
    const modeLabel = studioSimpleMode ? '专业画布' : '轻量步骤'
    const modeIcon = studioSimpleMode ? 'network' : 'list'
    if (elStudioTools) {
      elStudioTools.hidden = false
      const bits = [
        studioIconBtn({
          action: 'toggle-mode',
          icon: modeIcon,
          label: modeLabel,
          pressed: studioSimpleMode,
        }),
      ]
      if (!studioSimpleMode) {
        bits.push(
          '<span class="wb-studio-tools-sep" aria-hidden="true"></span>',
          studioIconBtn({ tool: 'auto-layout', icon: 'layoutTidy', label: '一键对齐', disabled: !hasNodes }),
        )
      }
      elStudioTools.innerHTML = bits.join('')
    }
    if (elStudioActions) {
      elStudioActions.innerHTML = [
        studioIconBtn({ action: 'save', icon: 'save', label: '保存', disabled: !hasNodes }),
        studioIconBtn({ action: 'run', icon: 'play', label: '检查流程', primary: true, disabled: !hasNodes }),
      ].join('')
    }
  }

  function renderStudio() {
    if (!elStudioGraph || !window.WorkbenchStudioModel) return
    ensureStudioDraft()
    ensureStudioLlmModels().then(() => {
      /* catalog ready for next inspector paint */
    })
    renderStudioPalette()

    const nodes = studioDraft.nodes || []
    const inputCount = Array.isArray(studioDraft.inputs) ? studioDraft.inputs.length : 0
    const outputCount = Array.isArray(studioDraft.outputs) ? studioDraft.outputs.length : 0
    if (elStudioGraphMeta) elStudioGraphMeta.textContent = nodes.length
      ? `${nodes.length} 节点 · ${inputCount}入/${outputCount}出${studioDraft.dirty ? ' · 未保存' : ''}`
      : (studioSimpleMode ? '添加专家步骤' : '从左侧添加节点 · 右键可操作')
    renderStudioHeadChrome()
    if (studioSimpleMode) renderStudioStepList(nodes)
    else renderStudioBoardGraph(nodes)
    renderStudioToolbar(nodes)
    renderStudioInspector()
    if (window.StickyIcons) {
      window.StickyIcons.mount(document.getElementById('wbStudioHeadNav'))
      window.StickyIcons.mount(elStudioSurface || elStudioGraph)
      if (elStudioTools) window.StickyIcons.mount(elStudioTools)
      if (elStudioActions) window.StickyIcons.mount(elStudioActions)
    }
  }

  function renderStudioBoardGraph(nodes) {
    const canvasApi = window.WorkbenchStudioCanvas
    const model = window.WorkbenchStudioModel
    if (!canvasApi || !elStudioGraph || !model) return
    if (!studioSimpleMode) {
      studioDraft = model.ensureFreeGraph({
        ...studioDraft,
        nodes: (studioDraft.nodes || []).map(node => ({
          ...node,
          profile: (!node.kind || node.kind === 'agent') ? studioNodeProfile(node) : node.profile,
        })),
      }, { markDirty: false })
    }
    const draft = {
      ...studioDraft,
      nodes: (studioDraft.nodes || []).map(node => ({
        ...node,
        profile: studioNodeProfile(node),
      })),
    }
    const board = canvasApi.buildBoard(draft, {
      selectedId: selectedStudioNodeId,
      selectedEdgeId: selectedStudioEdgeId,
      knownExpertIds: studioAgentCandidates().map(agent => agent.id),
      toComposition: d => model.toComposition(d),
    })
    const edgeMarkup = board.edges.map(edge =>
      `<path class="wb-studio-edge${edge.selected ? ' is-selected' : ''}${edge.branch ? ` branch-${escAttr(edge.branch)}` : ''}" data-studio-edge="${escAttr(edge.id)}" data-studio-edge-from="${escAttr(edge.from)}" data-studio-edge-to="${escAttr(edge.to)}" d="${escAttr(edge.path)}" fill="none" marker-end="url(#wb-studio-arrow)"></path>`
    ).join('')
    const empty = board.empty
      ? `<div class="wb-studio-empty wb-studio-empty--board"><strong>从左侧加入节点</strong><span>滚轮缩放 · 拖空白平移 · 四向端口连线 · Delete 可删</span></div>`
      : ''
    const wireLayer = studioWireFrom
      ? '<path class="wb-studio-edge is-wiring" id="wbStudioWirePreview" d="" fill="none"></path>'
      : ''
    elStudioGraph.classList.add('wb-studio-graph--canvas')
    elStudioGraph.innerHTML = `
      <div class="wb-studio-viewport" data-studio-viewport="true">
        <div class="wb-studio-board" style="width:${board.width}px;height:${board.height}px" data-studio-board="true">
          <svg class="wb-studio-edges" width="${board.width}" height="${board.height}" aria-hidden="true">
            <defs>
              <marker id="wb-studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b8def"></path>
              </marker>
            </defs>
            ${edgeMarkup}
            ${wireLayer}
          </svg>
          ${board.nodes.map(studioCanvasNodeHtml).join('')}
          ${empty}
        </div>
      </div>
      <div class="wb-studio-nav" aria-label="画布缩放">
        <button type="button" class="wb-studio-nav-btn" data-studio-zoom="out" title="缩小" aria-label="缩小">−</button>
        <button type="button" class="wb-studio-nav-btn wb-studio-nav-label" data-studio-zoom="reset" title="重置 100%" aria-label="重置缩放">
          <span data-studio-zoom-label>${Math.round(studioView.scale * 100)}%</span>
        </button>
        <button type="button" class="wb-studio-nav-btn" data-studio-zoom="in" title="放大" aria-label="放大">+</button>
        <button type="button" class="wb-studio-nav-btn" data-studio-zoom="fit" title="适应画布" aria-label="适应画布">⤢</button>
      </div>`
    applyStudioViewTransform()
  }

  function renderStudioStepList(nodes) {
    elStudioGraph.classList.remove('wb-studio-graph--canvas')
    elStudioGraph.innerHTML = nodes.length
      ? nodes.map((node, index) => {
        const summary = studioNodeSummary(node, studioNodeProfile(node))
        const relationControl = index < nodes.length - 1
          ? (studioSimpleMode
              ? `<div class="wb-studio-relation-chip">${esc(studioRelationLabel(node.relation))}</div>`
              : `<label class="wb-studio-relation"><select data-studio-relation="${escAttr(node.id)}" aria-label="${escAttr(`${node.name} 与下一步的关系`)}"><option value="serial"${node.relation === 'serial' ? ' selected' : ''}>接着执行</option><option value="parallel"${node.relation === 'parallel' ? ' selected' : ''}>同时执行</option><option value="approval"${node.relation === 'approval' ? ' selected' : ''}>执行前确认</option></select></label>`)
          : ''
        const nodeLabel = node.name || node.agentPackageId
        const tools = studioSimpleMode
          ? `<button type="button" class="wb-studio-node-action danger" data-studio-remove title="移除" aria-label="${escAttr(`移除${nodeLabel}`)}">×</button>`
          : `<button type="button" class="wb-studio-node-action" data-studio-move="up" title="上移" aria-label="${escAttr(`上移${nodeLabel}`)}"${index === 0 ? ' disabled' : ''}>↑</button>
                <button type="button" class="wb-studio-node-action" data-studio-move="down" title="下移" aria-label="${escAttr(`下移${nodeLabel}`)}"${index === nodes.length - 1 ? ' disabled' : ''}>↓</button>
                <button type="button" class="wb-studio-node-action" data-studio-duplicate title="复制" aria-label="${escAttr(`复制${nodeLabel}`)}">＋</button>
                <button type="button" class="wb-studio-node-action danger" data-studio-remove title="移除" aria-label="${escAttr(`移除${nodeLabel}`)}">×</button>`
        return `<div class="wb-studio-node-wrap" data-studio-position="${index}">
          <article class="wb-studio-node${node.id === selectedStudioNodeId ? ' active' : ''}" draggable="true" tabindex="0" role="button" aria-pressed="${node.id === selectedStudioNodeId ? 'true' : 'false'}" aria-label="${escAttr(`第 ${index + 1} 步 ${nodeLabel}，回车打开设置，Alt+方向键调整顺序`)}" data-studio-node="${escAttr(node.id)}">
            <div class="wb-studio-node-main">
              <span class="wb-studio-node-order">${index + 1}</span>
              <span class="wb-studio-node-copy"><strong>${esc(nodeLabel)}</strong><small>${esc(summary)}</small></span>
              <span class="wb-studio-node-tools">
                ${tools}
              </span>
            </div>
          </article>
          ${relationControl}
        </div>`
      }).join('')
      : '<div class="wb-studio-empty"><strong>先加入一位专家</strong><span>推荐步骤：1）左侧加入专家；2）点击步骤填写目标；3）保存并测试。</span></div>'
  }



  // 图重绘会丢焦点，连续调整顺序时必须把焦点送回同一个节点，键盘用户才不会掉队。
  function focusStudioNode(nodeId, controlSelector) {
    if (!elStudioGraph || !nodeId) return
    requestAnimationFrame(() => {
      const card = elStudioGraph.querySelector(`[data-studio-node="${CSS.escape(nodeId)}"]`)
      if (!card) return
      const control = controlSelector ? card.querySelector(`${controlSelector}:not([disabled])`) : null
      ;(control || card).focus()
    })
  }

  function moveStudioNode(nodeId, toIndex, controlSelector) {
    if (toIndex < 0 || toIndex >= (studioDraft.nodes || []).length) return
    studioDraft = window.WorkbenchStudioModel.moveNode(studioDraft, nodeId, toIndex)
    renderStudio()
    focusStudioNode(nodeId, controlSelector)
  }

  function isStudioSystemSelection(nodeId) {
    if (!nodeId) return false
    if (nodeId === window.WorkbenchStudioCanvas?.START_ID || nodeId === window.WorkbenchStudioCanvas?.END_ID) return true
    if (String(nodeId).startsWith('join-') || String(nodeId).startsWith('gate-')) return true
    return false
  }

  function studioSelectionKind(selectionId = selectedStudioNodeId) {
    const id = String(selectionId || '').trim()
    if (!id) return ''
    const draftNode = studioDraft?.nodes?.find(item => item.id === id)
    if (draftNode) {
      if (draftNode.kind === 'start' || id === window.WorkbenchStudioCanvas?.START_ID) return 'start'
      if (draftNode.kind === 'end' || id === window.WorkbenchStudioCanvas?.END_ID) return 'end'
      return draftNode.kind || 'agent'
    }
    if (id === window.WorkbenchStudioCanvas?.START_ID) return 'start'
    if (id === window.WorkbenchStudioCanvas?.END_ID) return 'end'
    if (String(id).startsWith('gate-')) return 'gate'
    if (String(id).startsWith('join-')) return 'join'
    return ''
  }

  function studioExpertOptionsHtml(selectedId) {
    const candidates = studioAgentCandidates()
    const selected = String(selectedId || '').trim()
    const options = candidates.map(agent =>
      `<option value="${escAttr(agent.id)}"${agent.id === selected ? ' selected' : ''}>${esc(agent.name || agent.id)}</option>`
    )
    // 已删除专家仍挂在草稿上时，保留 selected 值并标失效，避免下拉空白却节点仍带旧 id
    if (selected && !candidates.some(agent => agent.id === selected)) {
      options.unshift(
        `<option value="${escAttr(selected)}" selected>${esc(selected)}（已失效）</option>`,
      )
    }
    return `<option value="">选择执行专家…</option>${options.join('')}`
  }

  function formatStudioPlanError(plan) {
    const issue = Array.isArray(plan?.issues) ? plan.issues[0] : null
    const code = String(issue?.code || plan?.code || '').trim()
    const raw = String(issue?.message || plan?.error || '').trim()
    if (
      code === 'unresolved_member'
      || code === 'unresolved_node_agent'
      || /无法解析\s*(member\s*)?agentPackageId/i.test(raw)
      || /workflow 节点无法解析 agentPackageId/i.test(raw)
    ) {
      const idMatch = raw.match(/「([^」]+)」/) || raw.match(/agentPackageId:\s*([^\s，。]+)/i)
      const id = idMatch ? idMatch[1] : ''
      if (raw.includes('请重新选择')) return raw
      return id
        ? `执行专家「${id}」已删除或不存在，请重新选择后再保存`
        : '工作流引用了已删除的专家，请重新选择执行专家后再保存'
    }
    return raw || '协作步骤未通过校验'
  }

  function studioModelOptionsHtml(selectedId) {
    const fallback = [
      { id: 'qwen-plus', label: 'Qwen3 Plus' },
      { id: 'qwen-max', label: 'Qwen3 Max' },
      { id: 'deepseek-v3', label: 'DeepSeek V3' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ]
    const catalog = Array.isArray(data.llmModels?.models)
      ? data.llmModels.models
      : (Array.isArray(data.llmModels) ? data.llmModels : fallback)
    const current = String(selectedId || 'auto').trim() || 'auto'
    const seen = new Set()
    const options = []
    options.push(`<option value="auto"${current === 'auto' ? ' selected' : ''}>Auto（跟随设置）</option>`)
    seen.add('auto')
    catalog.forEach(item => {
      const id = String(item.id || item.model || item.name || '').trim()
      if (!id || seen.has(id)) return
      seen.add(id)
      const label = item.label || item.name || id
      options.push(`<option value="${escAttr(id)}"${id === current ? ' selected' : ''}>${esc(label)}</option>`)
    })
    if (current && !seen.has(current)) {
      options.push(`<option value="${escAttr(current)}" selected>${esc(current)}（自定义）</option>`)
    }
    return options.join('')
  }

  async function ensureStudioLlmModels() {
    if (data.llmModelsLoaded) return
    data.llmModelsLoaded = true
    try {
      const catalog = await window.api?.llmModels?.()
      if (catalog) data.llmModels = catalog
    } catch { /* keep fallback */ }
  }

  function studioSkillOptionsHtml(selectedId) {
    const options = studioSkillOptions().map(skill =>
      `<option value="${escAttr(skill.id)}"${skill.id === selectedId ? ' selected' : ''}>${esc(skill.name || skill.id)}</option>`
    ).join('')
    return `<option value="">选择技能 / 工具…</option>${options}`
  }

  function studioKnowledgeOptionsHtml(selectedId) {
    const kbs = Array.isArray(data.knowledgeBases) ? data.knowledgeBases
      : (Array.isArray(data.knowledge) ? data.knowledge : [])
    const options = kbs.slice(0, 80).map(item => {
      const id = String(item.id || item.knowledgeId || item.name || '')
      return `<option value="${escAttr(id)}"${id === selectedId ? ' selected' : ''}>${esc(item.name || item.title || id)}</option>`
    }).join('')
    return `<option value="">选择知识库…</option>${options}`
  }

  function syncStudioInspectorVisibility(open) {
    const shown = open === true
    if (elStudioInspectorPane) {
      elStudioInspectorPane.hidden = !shown
      elStudioInspectorPane.setAttribute('aria-hidden', shown ? 'false' : 'true')
    }
    if (elStudioShell) elStudioShell.classList.toggle('has-inspector', shown)
  }

  function clearStudioSelection(options = {}) {
    if (!selectedStudioNodeId && !options.force) return false
    selectedStudioNodeId = ''
    if (options.render !== false) renderStudio()
    return true
  }

  function studioNodeRemovable(nodeId) {
    if (!nodeId) return false
    const startId = window.WorkbenchStudioCanvas?.START_ID || '__start__'
    const endId = window.WorkbenchStudioCanvas?.END_ID || '__end__'
    if (nodeId === startId || nodeId === endId) return false
    const node = (studioDraft?.nodes || []).find(item => item.id === nodeId)
    if (!node) return false
    return !['start', 'end'].includes(node.kind)
  }

  function hideStudioContextMenu() {
    const el = document.getElementById('wbStudioCtx')
    if (!el) return
    el.hidden = true
    el.innerHTML = ''
  }

  function showStudioContextMenu(clientX, clientY, items) {
    const el = document.getElementById('wbStudioCtx')
    if (!el || !items.length) return
    el.innerHTML = items.map(item => {
      if (item.sep) return '<div class="wb-studio-ctx-sep" role="separator"></div>'
      return `<button type="button" role="menuitem" class="${item.danger ? 'danger' : ''}" data-studio-ctx="${escAttr(item.id)}"${item.disabled ? ' disabled' : ''}>${esc(item.label)}</button>`
    }).join('')
    el.hidden = false
    const pad = 8
    const w = 168
    const h = items.length * 32 + 12
    const left = Math.min(clientX, Math.max(pad, window.innerWidth - w - pad))
    const top = Math.min(clientY, Math.max(pad, window.innerHeight - h - pad))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }

  function deleteStudioEdge(edgeId, options = {}) {
    if (!edgeId || !window.WorkbenchStudioModel || !studioDraft) return false
    studioDraft = window.WorkbenchStudioModel.disconnect(studioDraft, edgeId)
    selectedStudioEdgeId = ''
    if (options.render !== false) renderStudio()
    if (options.toast !== false) toastFn('已删除连线')
    return true
  }

  function deleteStudioNode(nodeId, options = {}) {
    if (!window.WorkbenchStudioModel || !studioDraft) return false
    if (!studioNodeRemovable(nodeId)) {
      if (options.toast !== false) toastFn('开始与结束节点不可删除')
      return false
    }
    const list = studioDraft.nodes || []
    const index = list.findIndex(item => item.id === nodeId)
    studioDraft = window.WorkbenchStudioModel.removeNode(studioDraft, nodeId)
    selectedStudioEdgeId = ''
    selectedStudioNodeId = (studioDraft.nodes || [])[Math.min(Math.max(0, index), (studioDraft.nodes || []).length - 1)]?.id || ''
    if (options.render !== false) renderStudio()
    if (options.toast !== false) toastFn('已删除节点')
    return true
  }

  function deleteStudioSelection() {
    if (selectedStudioEdgeId) return deleteStudioEdge(selectedStudioEdgeId)
    if (selectedStudioNodeId) return deleteStudioNode(selectedStudioNodeId)
    return false
  }

  function renderStudioInspector() {
    const selectionId = selectedStudioNodeId || ''
    const kind = studioSelectionKind(selectionId)
    const node = studioDraft?.nodes?.find(item => item.id === selectionId) || null
    const nodeIndex = node ? (studioDraft?.nodes || []).findIndex(item => item.id === node.id) : -1
    const hasNextStep = nodeIndex >= 0 && nodeIndex < (studioDraft?.nodes?.length || 0) - 1
      && studioDraft.graphMode !== 'free'
    const systemKind = ['start', 'end', 'gate', 'join'].includes(kind) ? kind : ''
    const isExecNode = ['agent', 'llm', 'tool', 'knowledge'].includes(kind)

    if (!kind) {
      syncStudioInspectorVisibility(false)
      if (elStudioInspectorTitle) elStudioInspectorTitle.textContent = '节点属性'
      if (elStudioInspector) {
        elStudioInspector.innerHTML = '<p class="wb-studio-inspector-idle">点选画布节点后在此配置；端口拖线连接；Delete / 右键删除。</p>'
      }
      return
    }
    syncStudioInspectorVisibility(true)

    const workflowFields = `
        <label class="wb-studio-field"><span>工作流名称</span><input data-studio-workflow-field="name" maxlength="160" value="${escAttr(studioDraft?.name || '')}" placeholder="例如：需求评审与开发交付"></label>
        <label class="wb-studio-field"><span>工作流目标</span><textarea data-studio-workflow-field="goal" rows="3" maxlength="2000" placeholder="这条工作流最终要交付什么">${esc(studioDraft?.goal || '')}</textarea></label>
        <div class="wb-studio-io-group">
          <div class="wb-studio-io-head"><span>入参结构</span><button type="button" class="wb-flow-library-action" data-studio-io-add="input">添加入参</button></div>
          <div class="wb-studio-io-list">${studioIoRows(studioDraft?.inputs || [], 'input')}</div>
        </div>
        <div class="wb-studio-io-group">
          <div class="wb-studio-io-head"><span>出参结构</span><button type="button" class="wb-flow-library-action" data-studio-io-add="output">添加出参</button></div>
          <div class="wb-studio-io-list">${studioIoRows(studioDraft?.outputs || [], 'output')}</div>
        </div>`
    const workflowBlock = isExecNode || kind === 'condition'
      ? `<details class="wb-studio-advanced wb-studio-inspector-block">
          <summary>流程定义（名称 / 目标 / 入出参）</summary>
          <div class="wb-studio-advanced-body">${workflowFields}</div>
        </details>`
      : systemKind === 'start' || systemKind === 'end'
        ? `<section class="wb-studio-inspector-block">
          <div class="wb-section-label">流程定义</div>
          ${workflowFields}
        </section>`
        : ''
    const titles = {
      start: '开始节点', end: '结束节点', gate: '人工确认', join: '汇合',
      llm: '大模型节点', tool: '工具节点', knowledge: '知识库节点', condition: '条件判断', agent: node?.name || '专家节点',
    }
    if (elStudioInspectorTitle) {
      elStudioInspectorTitle.textContent = node?.name || titles[kind] || '节点属性'
    }
    if (!elStudioInspector) return
    if (systemKind === 'join') {
      elStudioInspector.innerHTML = `${workflowBlock}<p class="wb-studio-guide">汇合等待所有入边完成。可从上游多节点连线到此汇合点。</p>`
      return
    }
    if (systemKind === 'gate') {
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <label class="wb-studio-field"><span>确认标题</span><input data-studio-config="title" maxlength="160" value="${escAttr(node?.config?.title || node?.approvalNote || '')}"></label>
        <label class="wb-studio-field"><span>确认说明</span><input data-studio-config="note" maxlength="240" value="${escAttr(node?.config?.note || node?.approvalNote || '')}"></label>
        <p class="wb-studio-guide">运行到此节点将请求人工批准后继续。</p>`
      return
    }
    if (systemKind === 'start' || systemKind === 'end') {
      elStudioInspector.innerHTML = `${workflowBlock}<p class="wb-studio-guide">${systemKind === 'start' ? '从开始节点的输出端口连出到第一个业务节点。' : '将最终节点的输出端口连入结束节点。'}</p>`
      return
    }
    if (kind === 'condition' && node) {
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <label class="wb-studio-field"><span>节点名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
        <label class="wb-studio-field"><span>左值</span><input data-studio-config="left" maxlength="160" value="${escAttr(node.config?.left || 'input')}" placeholder="input 或 input.field"></label>
        <label class="wb-studio-field"><span>比较</span>
          <select data-studio-config="compare">
            <option value="equal"${(node.config?.compare || 'equal') === 'equal' ? ' selected' : ''}>等于</option>
            <option value="not_equal"${node.config?.compare === 'not_equal' ? ' selected' : ''}>不等于</option>
            <option value="contains"${node.config?.compare === 'contains' ? ' selected' : ''}>包含</option>
            <option value="blank"${node.config?.compare === 'blank' ? ' selected' : ''}>为空</option>
          </select>
        </label>
        <label class="wb-studio-field"><span>右值</span><input data-studio-config="right" maxlength="240" value="${escAttr(node.config?.right || '')}"></label>
        <p class="wb-studio-guide">从「成立 / 不成立」两个输出端口分别连到下游。未选中分支的节点会在运行时跳过。</p>`
      return
    }
    if (kind === 'llm' && node) {
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <label class="wb-studio-field"><span>节点名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
        <label class="wb-studio-field"><span>模型</span><select data-studio-config="modelName">${studioModelOptionsHtml(node.config?.modelName || node.config?.model || '')}</select></label>
        <label class="wb-studio-field"><span>温度</span><input data-studio-config="temperature" maxlength="12" value="${escAttr(node.config?.temperature || '')}" placeholder="0.2"></label>
        <label class="wb-studio-field"><span>Prompt</span><textarea data-studio-config="prompt" rows="8" maxlength="4000" placeholder="系统提示词，可用 {{input}} 变量">${esc(node.config?.prompt || node.intent || '')}</textarea></label>
        <p class="wb-studio-guide">大模型节点直连 LLM Hub，无需绑定专家。</p>`
      return
    }
    if (kind === 'tool' && node) {
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <label class="wb-studio-field"><span>节点名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
        <label class="wb-studio-field"><span>技能 / 工具</span><select data-studio-config="skillId">${studioSkillOptionsHtml(node.config?.skillId)}</select></label>
        <label class="wb-studio-field"><span>目标说明</span><textarea data-studio-field="intent" rows="3" maxlength="1200">${esc(node.intent || '')}</textarea></label>
        <p class="wb-studio-guide">工具节点按所选技能执行，无需绑定专家。</p>`
      return
    }
    if (kind === 'knowledge' && node) {
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <label class="wb-studio-field"><span>节点名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
        <label class="wb-studio-field"><span>知识库</span><select data-studio-config="knowledgeId">${studioKnowledgeOptionsHtml(node.config?.knowledgeId)}</select></label>
        <label class="wb-studio-field"><span>检索目标</span><textarea data-studio-field="intent" rows="3" maxlength="1200">${esc(node.intent || '')}</textarea></label>
        <p class="wb-studio-guide">知识库节点直接检索，无需绑定专家。</p>`
      return
    }
    if (!node) {
      elStudioInspector.innerHTML = '<p class="wb-studio-inspector-idle">点选画布节点后在右侧配置属性。</p>'
      return
    }
    if (studioSimpleMode) {
      const hitlToggle = hasNextStep
        ? `<label class="wb-studio-check"><input type="checkbox" data-studio-field="requiresApproval"${node.relation === 'approval' ? ' checked' : ''}><span>完成后需人工确认再进入下一步</span></label>`
        : ''
      elStudioInspector.innerHTML = `
        ${workflowBlock}
        <p class="wb-studio-guide">填写本步骤目标即可运行；其余项可稍后再完善。</p>
        <label class="wb-studio-field"><span>本步骤目标</span><textarea data-studio-field="intent" rows="5" maxlength="1200" placeholder="例如：整理需求并输出可执行清单">${esc(node.intent || '')}</textarea></label>
        ${studioSkillPicker(node)}
        <details class="wb-studio-advanced">
          <summary>高级选项</summary>
          <div class="wb-studio-advanced-body">
            <label class="wb-studio-field"><span>步骤名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
            <label class="wb-studio-field"><span>步骤角色</span><input data-studio-field="role" maxlength="200" value="${escAttr(node.role || '')}" placeholder="可选：本流程中的职责称呼"></label>
            <label class="wb-studio-field"><span>本步骤输入</span><textarea data-studio-field="inputSpec" rows="2" maxlength="500" placeholder="例如：需求文档、历史缺陷列表">${esc(node.inputSpec || '')}</textarea></label>
            <label class="wb-studio-field"><span>本步骤输出</span><textarea data-studio-field="outputSpec" rows="2" maxlength="500" placeholder="例如：技术方案、风险清单">${esc(node.outputSpec || '')}</textarea></label>
            ${hitlToggle}
            ${hasNextStep ? `<label class="wb-studio-field"><span>确认说明</span><input data-studio-field="approvalNote" maxlength="240" value="${escAttr(node.approvalNote || '')}" placeholder="可选：请负责人确认方案后再实现"></label>` : ''}
            <div class="wb-studio-inspector-actions"><button type="button" class="wb-flow-library-action" data-studio-tune-agent="${escAttr(node.agentPackageId)}">去专家库调优</button></div>
          </div>
        </details>`
      return
    }
    elStudioInspector.innerHTML = `
      ${workflowBlock}
      <label class="wb-studio-field"><span>节点名称</span><input data-studio-field="name" maxlength="120" value="${escAttr(node.name || '')}"></label>
      <label class="wb-studio-field"><span>执行专家</span><select data-studio-field="agentPackageId">${studioExpertOptionsHtml(node.agentPackageId)}</select></label>
      <label class="wb-studio-field"><span>本节点目标</span><textarea data-studio-field="intent" rows="4" maxlength="1200" placeholder="这位专家在当前工作流中要完成什么">${esc(node.intent || '')}</textarea></label>
      <label class="wb-studio-field"><span>节点角色</span><input data-studio-field="role" maxlength="200" value="${escAttr(node.role || '')}" placeholder="可选：本流程中的职责称呼"></label>
      <label class="wb-studio-field"><span>本节点输入</span><textarea data-studio-field="inputSpec" rows="2" maxlength="500" placeholder="例如：需求文档、上下文资料">${esc(node.inputSpec || '')}</textarea></label>
      <label class="wb-studio-field"><span>本节点输出</span><textarea data-studio-field="outputSpec" rows="2" maxlength="500" placeholder="例如：阶段产物、结论报告">${esc(node.outputSpec || '')}</textarea></label>
      ${studioSkillPicker(node)}
      <div class="wb-studio-inspector-actions"><button type="button" class="wb-flow-library-action" data-studio-tune-agent="${escAttr(node.agentPackageId)}">去专家库调优</button></div>`
  }

  function syncStudioWorkflowInspectorState() {
    const model = window.WorkbenchStudioModel
    if (!model || !studioDraft || !elStudioInspector) return
    // 未挂载流程字段时（空闲态 / join 等）不得把 goal/IO 同步成空并误标 dirty
    if (!elStudioInspector.querySelector('[data-studio-workflow-field="name"]')) return
    const read = key => String(elStudioInspector.querySelector(`[data-studio-workflow-field="${key}"]`)?.value || '').trim()
    const nextName = read('name') || studioDraft.name
    const nextGoal = read('goal')
    const nextInputs = parseStudioIoRows('input')
    const nextOutputs = parseStudioIoRows('output')
    const unchanged = nextName === String(studioDraft.name || '')
      && nextGoal === String(studioDraft.goal || '')
      && studioIoFingerprint(nextInputs) === studioIoFingerprint(studioDraft.inputs)
      && studioIoFingerprint(nextOutputs) === studioIoFingerprint(studioDraft.outputs)
    if (unchanged) return
    studioDraft = model.updateDraft(studioDraft, {
      name: nextName,
      goal: nextGoal,
      inputs: nextInputs,
      outputs: nextOutputs,
    })
    renderStudioHeadChrome()
  }

  function syncStudioInspectorState() {
    const model = window.WorkbenchStudioModel
    if (!model || !studioDraft || !elStudioInspector) return
    syncStudioWorkflowInspectorState()
    const node = studioDraft?.nodes?.find(item => item.id === selectedStudioNodeId)
    if (!node) {
      const inputCount = Array.isArray(studioDraft.inputs) ? studioDraft.inputs.length : 0
      const outputCount = Array.isArray(studioDraft.outputs) ? studioDraft.outputs.length : 0
      const dirtyNote = studioDraft.dirty ? ' · 有未保存修改' : ''
      if (elStudioGraphMeta) elStudioGraphMeta.textContent = `${studioDraft.nodes.filter(n => !['start', 'end'].includes(n.kind)).length} 个节点 · ${inputCount} 入参 · ${outputCount} 出参${dirtyNote}`
      return
    }
    const value = key => String(elStudioInspector.querySelector(`[data-studio-field="${key}"]`)?.value || '').trim()
    const configPatch = {}
    for (const input of elStudioInspector.querySelectorAll('[data-studio-config]') || []) {
      const key = input.getAttribute('data-studio-config')
      if (key) configPatch[key] = String(input.value || '').trim()
    }
    if (configPatch.skillId) {
      const skill = studioSkillOptions().find(item => item.id === configPatch.skillId)
      if (skill) configPatch.skillName = skill.name || skill.id
    }
    if (configPatch.knowledgeId) {
      const kbs = Array.isArray(data.knowledgeBases) ? data.knowledgeBases : (data.knowledge || [])
      const kb = kbs.find(item => String(item.id || item.knowledgeId || '') === configPatch.knowledgeId)
      if (kb) configPatch.knowledgeName = kb.name || kb.title || configPatch.knowledgeId
    }
    const relationInput = elStudioInspector.querySelector('[data-studio-field="relation"]')
    const approvalToggle = elStudioInspector.querySelector('[data-studio-field="requiresApproval"]')
    let relationValue = relationInput ? relationInput.value : node.relation
    if (approvalToggle) relationValue = approvalToggle.checked ? 'approval' : (relationValue === 'approval' ? 'serial' : relationValue)
    const skillRefs = readStudioSkillSelection()
    const agentPackageId = value('agentPackageId') || node.agentPackageId
    const nextPatch = {
      name: value('name') || node.name,
      intent: value('intent') || (configPatch.prompt || node.intent),
      role: value('role') || node.role,
      agentPackageId,
      inputSpec: value('inputSpec'),
      outputSpec: value('outputSpec'),
      approvalNote: value('approvalNote') || configPatch.note || node.approvalNote,
      relation: relationValue,
      config: { ...(node.config || {}), ...configPatch },
      profile: {
        ...studioNodeProfile(node),
        ...(skillRefs ? { skillRefs } : {}),
      },
    }
    const sameNode = String(node.name || '') === String(nextPatch.name || '')
      && String(node.intent || '') === String(nextPatch.intent || '')
      && String(node.role || '') === String(nextPatch.role || '')
      && String(node.agentPackageId || '') === String(nextPatch.agentPackageId || '')
      && String(node.inputSpec || '') === String(nextPatch.inputSpec || '')
      && String(node.outputSpec || '') === String(nextPatch.outputSpec || '')
      && String(node.approvalNote || '') === String(nextPatch.approvalNote || '')
      && String(node.relation || '') === String(nextPatch.relation || '')
      && JSON.stringify(node.config || {}) === JSON.stringify(nextPatch.config || {})
      && JSON.stringify(studioNodeProfile(node).skillRefs || []) === JSON.stringify(nextPatch.profile.skillRefs || [])
    // 失焦未改内容时不得记 dirty，否则货架「编辑」会误弹离开确认
    if (!sameNode) {
      studioDraft = model.updateNode(studioDraft, node.id, nextPatch)
    }
    const skillCountEl = elStudioInspector.querySelector('[data-studio-skill-count]')
    if (skillCountEl && skillRefs) skillCountEl.textContent = `已选 ${skillRefs.length}/${studioSkillOptions().length}`
    const inputCount = Array.isArray(studioDraft.inputs) ? studioDraft.inputs.length : 0
    const outputCount = Array.isArray(studioDraft.outputs) ? studioDraft.outputs.length : 0
    const dirtyNote = studioDraft.dirty ? ' · 有未保存修改' : ''
    if (elStudioGraphMeta) elStudioGraphMeta.textContent = `${studioDraft.nodes.filter(n => !['start', 'end'].includes(n.kind)).length} 个节点 · ${inputCount} 入参 · ${outputCount} 出参${dirtyNote}`
  }

  async function persistStudioNodeProfile(node, options = {}) {
    if (!node) return { ok: false, error: '专家节点不存在' }
    const profile = studioNodeProfile(node)
    return {
      ok: true,
      profile,
      profileId: node.profileId || profile.id || '',
      profileHash: node.profileHash || profile.profileHash || '',
      packageHash: node.packageHash || '',
      options,
    }
  }

  function mergeStudioLayoutIntoGraph(planComposition, studioComposition) {
    const base = planComposition && typeof planComposition === 'object'
      ? { ...planComposition }
      : {}
    const studio = studioComposition && typeof studioComposition === 'object'
      ? studioComposition
      : {}
    const byId = new Map(
      (Array.isArray(studio.nodes) ? studio.nodes : [])
        .filter(node => node && node.id)
        .map(node => [String(node.id), node]),
    )
    if (studio.layout && typeof studio.layout === 'object') {
      base.layout = {
        ...(base.layout && typeof base.layout === 'object' ? base.layout : {}),
        ...studio.layout,
        nodes: {
          ...(base.layout?.nodes && typeof base.layout.nodes === 'object' ? base.layout.nodes : {}),
          ...(studio.layout.nodes && typeof studio.layout.nodes === 'object' ? studio.layout.nodes : {}),
        },
      }
    }
    base.nodes = (Array.isArray(base.nodes) ? base.nodes : []).map(node => {
      if (!node || !node.id) return node
      const fromStudio = byId.get(String(node.id))
      if (!fromStudio) return node
      const next = { ...node }
      if (Number.isFinite(Number(fromStudio.x))) next.x = Math.max(0, Number(fromStudio.x))
      if (Number.isFinite(Number(fromStudio.y))) next.y = Math.max(0, Number(fromStudio.y))
      if (fromStudio.studioKind) next.studioKind = fromStudio.studioKind
      return next
    })
    return base
  }

  async function saveStudioWorkflow() {
    syncStudioInspectorState()
    const model = window.WorkbenchStudioModel
    if (!model) return { ok: false, error: '编排模型未加载' }
    const agents = model.draftAgents(studioDraft)
    if (!agents.length) {
      const err = { ok: false, error: '请至少添加一个可执行节点（专家 / 大模型 / 工具 / 知识库）' }
      toastFn(err.error, 'error')
      return err
    }
    const check = model.validateDraft(studioDraft)
    if (!check.ok) {
      toastFn(check.issues?.[0]?.message || '协作步骤未通过校验', 'error')
      return { ok: false, error: check.issues?.[0]?.message || '校验失败', issues: check.issues }
    }
    // 持久化流程定义时勿回退到 pendingGoal：那是单次任务意图，不是工作流说明
    const workflowGoal = String(studioDraft.goal || studioDraft.name || '完成专家协作任务').trim()
    studioDraft = model.createDraft({
      ...studioDraft,
      goal: workflowGoal,
      dirty: true,
    })
    for (const node of agents.filter(item => item.kind === 'agent')) {
      const saved = await persistStudioNodeProfile(node)
      if (!saved?.ok) {
        toastFn(saved?.error || `无法保存 ${node.name} 的设置`, 'error')
        return saved
      }
    }
    const composition = model.toComposition(studioDraft)
    const plan = await window.api?.workbenchAgentGraphPlan?.({
      ...composition,
      members: Array.isArray(composition.members) ? composition.members : [],
      teamName: studioDraft.name,
    })
    if (!plan?.ok) {
      toastFn(formatStudioPlanError(plan), 'error')
      return plan
    }
    agentGraphPlan = plan
    const source = workflowById(studioDraft.sourceWorkflowId)
    const editableSource = source && ['personal', 'forked'].includes(String(source.source || ''))
    const packageId = editableSource ? source.id : `my-${Date.now().toString(36)}`
    const expertNodes = agents.filter(node => node.kind === 'agent' && node.agentPackageId)
    const packageDescription = workflowPackageDescription(studioDraft, source, workflowGoal)
    // plan 编译可能丢掉画布坐标；用 studio composition 的 layout/x/y 合并回去再落盘
    const graphForSave = mergeStudioLayoutIntoGraph(plan.composition, composition)
    const result = await window.api?.workbenchWorkflowPackageSave?.({
      package: {
        ...(editableSource ? source : {}),
        id: packageId,
        name: studioDraft.name || '我的专家协作',
        description: packageDescription,
        inputs: studioDraft.inputs || [],
        outputs: studioDraft.outputs || [],
        source: editableSource ? source.source : 'personal',
        status: 'draft',
        version: source?.version || '1.0.0',
        goalTypes: [activeMode()?.id || 'general'],
        agentRefs: expertNodes.map(node => ({
          id: node.agentPackageId,
          profileId: node.profileId,
        })),
        skillRefs: expertNodes.flatMap(node => studioNodeProfile(node).skillRefs || []),
        graph: graphForSave,
        executionBackends: ['local-team'],
        provenance: {
          ...(source?.provenance || {}),
          kind: 'agent-composition',
          sourceWorkflowId: studioDraft.sourceWorkflowId || '',
        },
      },
    })
    if (!result?.ok) {
      toastFn(result?.error || '保存个人工作流失败', 'error')
      return result
    }
    data.workflowPackages = [...(data.workflowPackages || []).filter(item => item.id !== result.package.id), result.package]
    selectedStudioWorkflowId = result.package.id
    studioDraft = window.WorkbenchStudioModel.fromGraph(result.package.graph, {
      id: `draft-${result.package.id}`,
      name: result.package.name,
      goal: result.package.graph.goal,
      inputs: result.package.inputs || result.package.graph?.inputs || [],
      outputs: result.package.outputs || result.package.graph?.outputs || [],
      sourceWorkflowId: result.package.id,
    })
    selectedStudioNodeId = ''
    saveWorkContext({
      goal: studioDraft.goal,
      workflowId: result.package.id,
      workflowVersion: result.package.version,
      compositionId: result.package.id,
      compositionHash: result.package.compositionHash,
      executionSource: 'local-team',
    })
    renderShelf()
    renderStudio()
    renderWorkflowManage()
    // 渲染可能做过自由图归一化；保存成功后必须清 dirty，否则稍后离开/再编辑会误弹确认
    if (studioDraft) studioDraft.dirty = false
    // 工具栏保存只落盘，留在编排面；离开由 leaveStudioToShelf / 显式返回按来源恢复
    toastFn('已保存到「我的」工作流', 'success')
    return result
  }

  function askLeaveChoice() {
    if (!elLeaveModal) return Promise.resolve('discard')
    elLeaveModal.hidden = false
    return new Promise(resolve => {
      leaveChoiceResolve = choice => {
        leaveChoiceResolve = null
        elLeaveModal.hidden = true
        resolve(choice)
      }
      requestAnimationFrame(() => elLeaveModal.querySelector('[data-leave-choice="save"]')?.focus())
    })
  }

  // 草稿只活在内存里，任何离开编排的路径都要先兜一次，否则改了半天一走就没了。
  async function confirmLeaveStudio() {
    const bizNodes = (studioDraft?.nodes || []).filter(node => node.kind !== 'start' && node.kind !== 'end')
    if (!studioDraft?.dirty || !bizNodes.length) return true
    const choice = await askLeaveChoice()
    if (choice === 'save') {
      const saved = await saveStudioWorkflow()
      return !!saved?.ok
    }
    if (choice === 'discard') {
      clearStudioDraftMemory()
      return true
    }
    return false
  }

  function clearStudioDraftMemory() {
    studioDraft = null
    selectedStudioNodeId = ''
    selectedStudioEdgeId = ''
    agentGraphPlan = null
  }

  async function leaveStudioToShelf() {
    if (!await confirmLeaveStudio()) return false
    // 「保存后离开」只完成落盘；此处清空草稿并按进入来源恢复（默认管理工作流）
    clearStudioDraftMemory()
    const target = studioReturnState && typeof studioReturnState === 'object'
      ? studioReturnState
      : { surface: 'manage', managePanel: 'workflows' }
    if (target.surface === 'shelf') {
      if (activeSurface !== 'shelf') setSurface('shelf', { force: true })
    } else {
      openManagePanel(target.managePanel || 'workflows')
    }
    return true
  }

  async function openStudioSaveConfirm() {
    syncStudioInspectorState()
    const model = window.WorkbenchStudioModel
    if (!model || !studioDraft) {
      toastFn('编排草稿未就绪', 'error')
      return
    }
    const nodes = Array.isArray(studioDraft.nodes) ? studioDraft.nodes : []
    if (!nodes.some(node => node.kind !== 'start' && node.kind !== 'end')) {
      toastFn('请先添加可执行节点再保存', 'error')
      return
    }
    modal = {
      ...emptyModal(),
      item: { id: studioDraft.sourceWorkflowId || 'studio-draft', name: studioWorkflowDisplayName() },
      kind: 'studio-save',
      purpose: 'save',
    }
    renderModal()
  }

  function renderStudioSaveConfirmBody() {
    const draft = studioDraft || {}
    const nodes = (Array.isArray(draft.nodes) ? draft.nodes : [])
      .filter(node => node && node.kind !== 'start' && node.kind !== 'end')
    const byId = Object.fromEntries((draft.nodes || []).map(node => [node.id, node]))
    const nodeLabel = (id) => {
      const node = byId[id]
      if (!node) return id
      if (node.kind === 'start') return '开始'
      if (node.kind === 'end') return '结束'
      if (node.kind === 'gate') return node.name || '人工确认'
      if (node.kind === 'agent') return node.name || node.agentPackageId || id
      return node.name || id
    }
    const nodeRows = nodes.map(node => {
      const kindLabel = ({
        agent: '专家',
        llm: '大模型',
        tool: '工具',
        knowledge: '知识库',
        condition: '条件',
        gate: '人工确认',
        join: '汇合',
      })[node.kind] || '节点'
      const detail = node.kind === 'agent'
        ? (node.agentPackageId || '未绑定专家')
        : (node.intent || node.description || kindLabel)
      const mark = node.kind === 'agent'
        ? agentAvatarMark({
          id: node.agentPackageId || node.id,
          name: node.name || node.agentPackageId || node.id,
          role: node.name,
          description: node.intent,
          avatar: node.profile?.avatar,
        }, 'wb-launch-agent-mark', 28)
        : ''
      return `<div class="wb-launch-extra-item${node.kind === 'agent' ? ' has-agent-mark' : ''}">
        ${mark}
        <div class="wb-launch-extra-copy">
          <strong>${esc(node.name || kindLabel)}</strong>
          <span>${esc(detail)}</span>
        </div>
      </div>`
    }).join('')
    const edges = (Array.isArray(draft.edges) ? draft.edges : [])
      .map(edge => `${nodeLabel(edge.from)} → ${nodeLabel(edge.to)}`)
      .join(' · ')
    // 工作流定义目标：只用草稿 goal/name，绝不回填会话 pendingGoal
    const goalValue = String(draft.goal || draft.name || '').trim()
    return `
      <div class="wb-studio-save-dialog">
        <div class="wb-launch-intro">
          <p class="wb-launch-kicker">保存确认</p>
          <p class="wb-launch-lead">确认名称、目标与协作节点后写入「我的」工作流。本次不会启动运行。</p>
        </div>
        <div class="wb-launch-group wb-launch-primary">
          <div class="wb-launch-group-head">工作流目标</div>
          <label class="wb-modal-field wb-launch-field-compact">
            <span class="wb-sr-only">工作流目标</span>
            <textarea id="wbStudioSaveGoal" class="wb-modal-textarea" rows="3" maxlength="2000" placeholder="这条工作流最终要交付什么">${esc(goalValue)}</textarea>
          </label>
        </div>
        <div class="wb-launch-group">
          <div class="wb-launch-group-head">协作节点 · ${nodes.length}</div>
          <div class="wb-launch-extra wb-launch-extra-grid">${nodeRows || '<div class="wb-run-muted">暂无业务节点</div>'}</div>
        </div>
        <div class="wb-launch-group wb-launch-group-flat">
          <div class="wb-launch-group-head">交接关系</div>
          <div class="wb-modal-desc wb-studio-save-edges">${esc(edges || '按画布连线顺序交接')}</div>
        </div>
      </div>`
  }

  let studioGraphCheckToken = 0

  function clearStudioGraphCheckVisuals() {
    if (!elStudioGraph) return
    elStudioGraph.querySelectorAll('.wb-studio-flow-node').forEach(el => {
      el.classList.remove('is-check-active', 'is-check-pass', 'is-check-fail')
    })
    elStudioGraph.querySelectorAll('.wb-studio-edge').forEach(el => {
      el.classList.remove('is-check-flow', 'is-check-pass', 'is-check-fail')
    })
    elStudioGraph.querySelectorAll('.wb-studio-check-dot').forEach(el => el.remove())
  }

  function sleepMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async function animateStudioEdgeFlow(fromId, toId, token) {
    if (!elStudioGraph) return
    const edge = elStudioGraph.querySelector(
      `.wb-studio-edge[data-studio-edge-from="${CSS.escape(fromId)}"][data-studio-edge-to="${CSS.escape(toId)}"],`
      + `.wb-studio-edge[data-from="${CSS.escape(fromId)}"][data-to="${CSS.escape(toId)}"]`
    ) || [...elStudioGraph.querySelectorAll('.wb-studio-edge')].find(el => {
      const id = el.getAttribute('data-studio-edge') || el.id || ''
      return id.includes(fromId) && id.includes(toId)
    })
    if (!edge) {
      await sleepMs(180)
      return
    }
    edge.classList.add('is-check-flow')
    const svg = edge.ownerSVGElement || edge.closest('svg')
    if (svg && typeof edge.getTotalLength === 'function') {
      try {
        const len = edge.getTotalLength()
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('r', '4')
        dot.setAttribute('class', 'wb-studio-check-dot')
        dot.setAttribute('fill', '#3d8bfd')
        svg.appendChild(dot)
        const steps = 12
        for (let i = 0; i <= steps; i += 1) {
          if (token !== studioGraphCheckToken) break
          const pt = edge.getPointAtLength((len * i) / steps)
          dot.setAttribute('cx', String(pt.x))
          dot.setAttribute('cy', String(pt.y))
          await sleepMs(28)
        }
        dot.remove()
      } catch {
        await sleepMs(220)
      }
    } else {
      await sleepMs(220)
    }
    if (token === studioGraphCheckToken) {
      edge.classList.remove('is-check-flow')
      edge.classList.add('is-check-pass')
    }
  }

  async function previewCheckStudioGraph() {
    syncStudioInspectorState()
    const model = window.WorkbenchStudioModel
    if (!model || !studioDraft) {
      toastFn('编排草稿未就绪', 'error')
      return
    }
    if (studioSimpleMode) {
      toastFn('请切换到画布模式后再检查流程', 'error')
      return
    }
    const report = model.inspectStudioGraph(studioDraft)
    const token = ++studioGraphCheckToken
    clearStudioGraphCheckVisuals()
    const issueByNode = new Map()
    ;(report.issues || []).forEach(issue => {
      if (!issue?.nodeId) return
      if (!issueByNode.has(issue.nodeId)) issueByNode.set(issue.nodeId, issue)
    })
    const edges = Array.isArray(studioDraft.edges) ? studioDraft.edges : []
    const adj = new Map()
    edges.forEach(edge => {
      if (!adj.has(edge.from)) adj.set(edge.from, [])
      adj.get(edge.from).push(edge.to)
    })
    const startId = report.startId || model.START_ID || '__start__'
    const seen = new Set()

    async function visit(nodeId, fromId) {
      if (token !== studioGraphCheckToken) return false
      if (seen.has(nodeId)) return true
      seen.add(nodeId)
      if (fromId) await animateStudioEdgeFlow(fromId, nodeId, token)
      if (token !== studioGraphCheckToken) return false
      const nodeEl = elStudioGraph?.querySelector(`.wb-studio-flow-node[data-studio-node="${CSS.escape(nodeId)}"]`)
      if (nodeEl) {
        nodeEl.classList.add('is-check-active')
        nodeEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      }
      await sleepMs(360)
      if (token !== studioGraphCheckToken) return false
      const fail = issueByNode.get(nodeId)
      if (fail) {
        if (nodeEl) {
          nodeEl.classList.remove('is-check-active')
          nodeEl.classList.add('is-check-fail')
        }
        toastFn(fail.message || '节点未通过检查', 'error')
        return false
      }
      if (nodeEl) {
        nodeEl.classList.remove('is-check-active')
        nodeEl.classList.add('is-check-pass')
      }
      const outs = adj.get(nodeId) || []
      for (const nextId of outs) {
        const ok = await visit(nextId, nodeId)
        if (!ok) return false
      }
      return true
    }

    toastFn('开始检查流程（不会真正运行）', 'info')
    const okPath = await visit(startId, '')
    if (token !== studioGraphCheckToken) return
    if (!okPath) return
    // Unreachable / graph-level issues after path walk
    if (!report.ok) {
      const leftover = (report.issues || []).find(issue => !issue.nodeId || !seen.has(issue.nodeId)) || report.issues?.[0]
      if (leftover?.nodeId) {
        const nodeEl = elStudioGraph?.querySelector(`.wb-studio-flow-node[data-studio-node="${CSS.escape(leftover.nodeId)}"]`)
        if (nodeEl) nodeEl.classList.add('is-check-fail')
      }
      toastFn(leftover?.message || '流程未通过检查', 'error')
      return
    }
    toastFn('流程检查通过', 'success')
  }

  async function testStudioWorkflow() {
    // 兼容旧名：改为干跑检查，不再保存/启动
    return previewCheckStudioGraph()
  }

  function dismissGoalPathPicker() {
    if (elGoalPathPicker) elGoalPathPicker.hidden = true
    goalPathRecommendation = null
  }

  function executionBackendLabel(item) {
    if (window.WorkbenchLabels?.executionBackendLabel) {
      return window.WorkbenchLabels.executionBackendLabel(item)
    }
    const backends = Array.isArray(item?.executionBackends) ? item.executionBackends : []
    if (backends.includes('daemon') || item?.executionSource === 'daemon') return '管线服务'
    if (backends.includes('local-team') || item?.executionSource === 'local-team') return '本机专家团队'
    if (backends.includes('legacy-local') || item?.executionSource === 'legacy-local') return '兼容本地'
    return '本机执行'
  }

  function workflowDisplayNameOf(item = {}) {
    const api = window.WorkflowDisplayName
    if (api && typeof api.workflowDisplayName === 'function') return api.workflowDisplayName(item)
    return String(item.name || item.id || '未命名工作流').trim()
  }

  function workflowSearchHaystackOf(item = {}) {
    const api = window.WorkflowDisplayName
    if (api && typeof api.workflowSearchHaystack === 'function') return api.workflowSearchHaystack(item)
    return `${item.id || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase()
  }

  function workflowOutcomeText(item = {}) {
    const outputs = Array.isArray(item.outputs) ? item.outputs : []
    if (outputs.length) return outputs.map(value => value.label || value.name || value.id || value).join('、')
    return item.description || item.summary || '可查看、可追溯的工作结果'
  }

  function workflowInputText(item = {}) {
    const inputs = Array.isArray(item.inputs) ? item.inputs : []
    if (inputs.length) return inputs.map(value => value.label || value.name || value.id || value).join('、')
    return '一句话目标'
  }

  // 可运行性由主进程供给管道给出，渲染层只负责展示，不再按领域整体推断
  function shelfReadiness(item = {}) {
    if (item.readiness && typeof item.readiness === 'object') {
      const blockers = Array.isArray(item.readiness.blockers) ? item.readiness.blockers : []
      return {
        runnable: item.readiness.runnable !== false && item.status !== 'unavailable',
        blockers: blockers.map(entry => entry.label || entry.reason || entry).filter(Boolean),
      }
    }
    const domain = (consoleProjection().domains || []).find(entry => entry.id === consoleDomainOf(item))
    return {
      runnable: item.status !== 'unavailable' && (domain ? domain.ready : true),
      blockers: (domain?.blockers || []).map(entry => entry.label).filter(Boolean),
    }
  }

  function shelfProvenanceLabel(source) {
    if (window.WorkbenchProvenance && typeof window.WorkbenchProvenance.shelfProvenanceLabel === 'function') {
      return window.WorkbenchProvenance.shelfProvenanceLabel(source)
    }
    const value = String(source || '')
    if (['personal', 'forked'].includes(value)) return '我的'
    if (value === 'official') return '官方'
    return '共享'
  }

  function shelfItems() {
    const packages = Array.isArray(data.workflowPackages) ? data.workflowPackages : []
    const query = String(shelfQuery || '').trim().toLowerCase()
    return packages
      .filter(item => consoleDomain === 'all' || consoleDomainOf(item) === consoleDomain)
      .filter(item => !query || workflowSearchHaystackOf(item).includes(query) || workflowOutcomeText(item).toLowerCase().includes(query))
      .sort((a, b) => {
        const readyDelta = Number(shelfReadiness(b).runnable) - Number(shelfReadiness(a).runnable)
        if (readyDelta) return readyDelta
        const order = { official: 0, team: 1, forked: 2, personal: 3 }
        return (order[a.source] ?? 9) - (order[b.source] ?? 9)
          || String(workflowDisplayNameOf(a)).localeCompare(String(workflowDisplayNameOf(b)))
      })
  }

  function shelfChipText(value, max = 22) {
    const text = String(value || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    if (text.length <= max) return text
    return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
  }

  function looksLikeOneShotRunGoal(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim()
    if (!value) return false
    // 短、无句读、不像流程说明 → 多为某次运行意图（如「三元礼包」）
    if (value.length > 28) return false
    if (/[。.!！？?;；：:]/.test(value)) return false
    if (/→|—|–/.test(value)) return false
    return true
  }

  function shelfCardBlurb(item) {
    const description = String(item.description || '').trim()
    const graphGoal = String(item.graph?.goal || '').trim()
    const outcome = workflowOutcomeText(item)
    // 包 description 曾被会话 pendingGoal 污染时，优先展示图内目标或产出摘要
    if (looksLikeOneShotRunGoal(description)) {
      if (graphGoal && !looksLikeOneShotRunGoal(graphGoal)) return graphGoal
      if (outcome && outcome !== description) return outcome
    }
    if (description && description !== outcome) return description
    return description || graphGoal || outcome
  }

  function workflowPackageDescription(draft, source, workflowGoal) {
    const goal = String(workflowGoal || draft?.goal || '').trim()
    const existing = String(source?.description || '').trim()
    if (existing && !looksLikeOneShotRunGoal(existing)) return existing
    if (goal && !looksLikeOneShotRunGoal(goal)) return goal
    if (existing) return existing
    return goal || '由搭建专家保存的个人工作流。'
  }

  function shelfDomainIcon(domain) {
    if (domain === 'office') return 'note'
    if (domain === 'engineering') return 'code'
    if (domain === 'visual') return 'image'
    return 'workflow'
  }

  function shelfFooterMetaHtml(item = {}, steps = 1) {
    return `<div class="wb-shelf-meta"><span class="wb-shelf-steps">${esc(String(steps))} 步</span></div>`
  }

  function workflowBriefFlowHtml(stepLabels = []) {
    if (!stepLabels.length) {
      return '<span class="wb-workflow-manage-flow-step" title="按系统默认顺序调度">按系统默认顺序调度</span>'
    }
    return stepLabels.map((label, index) => `
      ${index ? '<span class="wb-workflow-manage-flow-sep" aria-hidden="true">→</span>' : ''}
      <span class="wb-workflow-manage-flow-step" title="${escAttr(label)}">${esc(label)}</span>`).join('')
  }

  function shelfCardHtml(item) {
    const { runnable, blockers } = shelfReadiness(item)
    const stepLabels = workflowManageFlowSteps(item)
    const steps = Math.max(1, stepLabels.length)
    const isPersonal = ['personal', 'forked'].includes(String(item.source || ''))
    const provenanceClass = isPersonal ? 'mine' : 'team'
    const domain = consoleDomainOf(item)
    const displayName = workflowDisplayNameOf(item)
    const inputFull = workflowInputText(item)
    const outcomeFull = workflowOutcomeText(item)
    const blurb = shelfCardBlurb(item)
    const blockerText = blockers.join('、') || '执行所需的专家或外部工具'
    const markIcon = shelfDomainIcon(domain)
    const footerMeta = shelfFooterMetaHtml(item, steps)
    const flowHtml = workflowBriefFlowHtml(stepLabels)
    return `<article class="wb-shelf-card${runnable ? '' : ' blocked'}" data-flow-id="${escAttr(item.id)}" data-domain="${escAttr(domain)}" tabindex="0" role="button" aria-label="打开工作流对话：${escAttr(displayName)}">
      <div class="wb-shelf-card-top">
        <span class="wb-shelf-mark" aria-hidden="true"><span class="ico" data-icon="${escAttr(markIcon)}"></span></span>
        <div class="wb-shelf-card-copy">
          <div class="wb-shelf-title-row">
            <h3>${esc(displayName)}</h3>
            <span class="wb-shelf-badge wb-shelf-provenance wb-shelf-provenance-${provenanceClass}">${esc(shelfProvenanceLabel(item.source))}</span>
          </div>
          <p class="wb-shelf-outcome">${esc(blurb)}</p>
          <ul class="wb-shelf-chips" aria-label="工作流摘要">
            <li class="wb-shelf-chip" title="${escAttr(inputFull)}"><span class="wb-shelf-chip-k">输入</span><span class="wb-shelf-chip-v">${esc(shelfChipText(inputFull, 48))}</span></li>
            <li class="wb-shelf-chip" title="${escAttr(outcomeFull)}"><span class="wb-shelf-chip-k">产出</span><span class="wb-shelf-chip-v">${esc(shelfChipText(outcomeFull, 48))}</span></li>
          </ul>
          ${runnable
            ? ''
            : `<p class="wb-shelf-blocker" title="${escAttr(blockerText)}"><span class="wb-shelf-blocker-dot" aria-hidden="true"></span>缺少：${esc(shelfChipText(blockerText, 36))}</p>`}
        </div>
      </div>
      <div class="wb-shelf-card-bottom">
        <div class="wb-shelf-brief">
          <div class="wb-shelf-brief-label">简要流程</div>
          <div class="wb-shelf-brief-flow" aria-label="简要流程">${flowHtml}</div>
        </div>
        <footer>
          ${footerMeta}
          <div class="wb-shelf-actions">
            <button type="button" class="wb-shelf-icon-btn is-primary" data-flow-action="inspect" title="开始运行" aria-label="开始运行"><span class="ico" data-icon="play" aria-hidden="true"></span></button>
          </div>
        </footer>
      </div>
    </article>`
  }

  function shelfRowCapacity() {
    const width = Number(elShelfGrid?.clientWidth || elShelfSurface?.clientWidth || window.innerWidth || 960)
    if (!Number.isFinite(width) || width <= 0) return 2
    return width <= SHELF_GRID_NARROW_MAX ? 1 : 2
  }

  function syncShelfHomeScrollLock() {
    const body = document.querySelector('#workbench .wb-body')
    if (!body) return
    if (activeSurface !== 'shelf') {
      body.classList.remove('is-shelf-home-locked')
      return
    }
    const shelfExpanded = !!elShelfSurface?.classList.contains('is-shelf-expanded')
    const recentExpanded = !!elShelfRecentList?.closest('.wb-shelf-recent')?.classList.contains('expanded')
    body.classList.toggle('is-shelf-home-locked', !(shelfExpanded || recentExpanded))
  }

  function syncShelfGridToggle(total) {
    const catalog = elShelfGrid?.closest('.wb-shelf-catalog')
    const preview = shelfRowCapacity()
    const needsToggle = total > preview
    if (catalog) catalog.classList.toggle('expanded', needsToggle && shelfGridExpanded)
    if (elShelfGrid) {
      elShelfGrid.classList.toggle('is-expanded', needsToggle && shelfGridExpanded)
    }
    if (elShelfSurface) {
      elShelfSurface.classList.toggle('is-shelf-expanded', needsToggle && shelfGridExpanded)
      elShelfSurface.classList.toggle('is-shelf-compact', !(needsToggle && shelfGridExpanded))
    }
    if (!btnShelfGridToggle) {
      syncShelfHomeScrollLock()
      return
    }
    btnShelfGridToggle.hidden = !needsToggle
    if (!needsToggle) {
      btnShelfGridToggle.setAttribute('aria-expanded', 'false')
      syncShelfHomeScrollLock()
      return
    }
    const remaining = total - preview
    const label = shelfGridExpanded ? '收起' : `更多（${remaining}）`
    const textEl = btnShelfGridToggle.querySelector('.wb-list-toggle-text')
    if (textEl) textEl.textContent = label
    else btnShelfGridToggle.textContent = label
    btnShelfGridToggle.setAttribute('aria-expanded', shelfGridExpanded ? 'true' : 'false')
    syncShelfHomeScrollLock()
  }

  function paintShelfGrid() {
    if (!elShelfGrid) return
    const items = shelfGridCache
    const total = items.length
    const preview = shelfRowCapacity()
    const visible = shelfGridExpanded || total <= preview
      ? items
      : items.slice(0, preview)
    elShelfGrid.innerHTML = visible.map(shelfCardHtml).join('')
    syncShelfGridToggle(total)
    if (window.StickyIcons) window.StickyIcons.mount(elShelfGrid)
  }

  function renderShelf() {
    if (!elShelfGrid) return
    if (elDomainSwitcher) elDomainSwitcher.hidden = false
    const all = Array.isArray(data.workflowPackages) ? data.workflowPackages : []
    const items = shelfItems()
    shelfGridCache = items
    const runnable = items.filter(item => shelfReadiness(item).runnable).length
    const filtered = consoleDomain !== 'all' || !!String(shelfQuery || '').trim()

    if (elShelfSummary) {
      elShelfSummary.textContent = all.length
        ? `${items.length} 个工作流 · ${runnable} 个现在可以运行`
        : ''
    }
    paintShelfGrid()

    if (elShelfEmpty) {
      const empty = !items.length
      elShelfEmpty.hidden = !empty
      if (empty) {
        if (filtered) {
          elShelfEmpty.innerHTML = `<strong>没有匹配的工作流</strong><span>点「全部」或清空搜索再看看。</span>`
        } else {
          elShelfEmpty.innerHTML = `<strong>还没有工作流</strong><span>${esc(shelfSupplyHint())}</span>
             <div class="wb-empty-actions">
               <button type="button" class="wb-shelf-run" data-shelf-action="studio">新建工作流</button>
               <button type="button" class="wb-shelf-secondary" data-shelf-action="capability">去专家库添加专家</button>
             </div>`
        }
      }
    }
    if (elShelfLocked) {
      const excluded = Number(data.supply?.stats?.excluded || 0)
      elShelfLocked.hidden = excluded <= 0
      if (excluded > 0) elShelfLocked.textContent = `另有 ${excluded} 个工作流未上架（已废弃或缺少可执行定义）`
    }
    void refreshShelfRecentTasks()
  }

  function personalWorkflowPackages() {
    const packages = Array.isArray(data.workflowPackages) ? data.workflowPackages : []
    return packages
      .filter(item => ['personal', 'forked'].includes(String(item.source || '')))
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
  }

  function workflowManageFlowSteps(item = {}) {
    const { nodes, edges } = shelfPackageGraphView(item)
    if (!nodes.length) {
      return workflowParticipantLabels(item).slice(0, 6)
    }
    const byId = new Map(nodes.map(node => [node.id, node]))
    const outEdges = new Map()
    for (const edge of edges) {
      if (!byId.has(edge.from) || !byId.has(edge.to)) continue
      if (!outEdges.has(edge.from)) outEdges.set(edge.from, [])
      outEdges.get(edge.from).push(edge)
    }
    const incoming = new Set(edges.filter(edge => byId.has(edge.from) && byId.has(edge.to)).map(edge => edge.to))
    const starts = nodes.filter(node => !incoming.has(node.id))
    const order = []
    const seen = new Set()
    const queue = (starts.length ? starts : [nodes[0]]).map(node => node.id)
    while (queue.length) {
      const id = queue.shift()
      if (!id || seen.has(id) || !byId.has(id)) continue
      seen.add(id)
      order.push(id)
      for (const edge of (outEdges.get(id) || [])) {
        if (!seen.has(edge.to)) queue.push(edge.to)
      }
    }
    for (const node of nodes) {
      if (!seen.has(node.id)) order.push(node.id)
    }
    return order.slice(0, 6).map(id => packageNodeDisplayTitle(byId.get(id)) || id)
  }

  function workflowManageItemHtml(item) {
    const stepLabels = workflowManageFlowSteps(item)
    const stepCount = Math.max(1, stepLabels.length)
    const blurb = shelfCardBlurb(item)
    const inputFull = workflowInputText(item)
    const outcomeFull = workflowOutcomeText(item)
    const domain = consoleDomainOf(item)
    const markIcon = shelfDomainIcon(domain)
    const metaBits = [
      `${stepCount} 步`,
      executionBackendLabel(item),
      item.source === 'forked' ? '复制自共享流程' : '',
    ].filter(Boolean)
    const flowHtml = workflowBriefFlowHtml(stepLabels)
    return `<article class="wb-workflow-manage-item" data-workflow-id="${escAttr(item.id)}" data-domain="${escAttr(domain)}">
      <div class="wb-workflow-manage-top">
        <span class="wb-shelf-mark" aria-hidden="true"><span class="ico" data-icon="${escAttr(markIcon)}"></span></span>
        <div class="wb-workflow-manage-copy">
          <div class="wb-workflow-manage-title-row">
            <strong>${esc(workflowDisplayNameOf(item))}</strong>
          </div>
          <span>${esc(blurb)}</span>
          <ul class="wb-workflow-manage-chips" aria-label="能力摘要">
            <li class="wb-workflow-manage-chip" title="${escAttr(inputFull)}"><span class="k">输入</span><span class="v">${esc(shelfChipText(inputFull, 48))}</span></li>
            <li class="wb-workflow-manage-chip" title="${escAttr(outcomeFull)}"><span class="k">产出</span><span class="v">${esc(shelfChipText(outcomeFull, 48))}</span></li>
          </ul>
          <small>${esc(metaBits.join(' · '))}</small>
        </div>
        <div class="wb-workflow-manage-actions">
          <button type="button" class="wb-shelf-icon-btn" data-workflow-manage="fork" title="复制" aria-label="复制">
            <span class="ico" data-icon="copy" aria-hidden="true"></span>
          </button>
          <button type="button" class="wb-shelf-icon-btn" data-workflow-manage="edit" title="编辑" aria-label="编辑">
            <span class="ico" data-icon="edit" aria-hidden="true"></span>
          </button>
          <button type="button" class="wb-shelf-icon-btn is-danger" data-workflow-manage="delete" title="删除" aria-label="删除">
            <span class="ico" data-icon="trash" aria-hidden="true"></span>
          </button>
        </div>
      </div>
      <div class="wb-workflow-manage-bottom">
        <div class="wb-workflow-manage-flow-label">简要流程</div>
        <div class="wb-workflow-manage-flow" aria-label="简要流程">${flowHtml}</div>
      </div>
    </article>`
  }

  function renderWorkflowManage() {
    if (!elWorkflowManageList) return
    const items = personalWorkflowPackages()
    elWorkflowManageList.innerHTML = items.map(workflowManageItemHtml).join('')
    if (elWorkflowManageEmpty) {
      elWorkflowManageEmpty.hidden = items.length > 0
      if (!items.length) {
        elWorkflowManageEmpty.innerHTML = `<strong>还没有属于你的工作流</strong>
          <span>从零编排一条，或在此复制已有「我的」流程后再改。</span>
          <div class="wb-empty-actions">
            <button type="button" class="wb-shelf-run" data-workflow-manage="new">新建工作流</button>
            <button type="button" class="wb-shelf-secondary" data-workflow-manage="shelf">去工作流查看</button>
          </div>`
      }
    }
    if (window.StickyIcons) window.StickyIcons.mount(elWorkflowManagePage || elWorkflowManageList)
  }

  function askWorkflowDeleteConfirm(item = {}) {
    if (!elWorkflowDeleteModal) {
      const name = workflowDisplayNameOf(item) || item.name || item.id
      return Promise.resolve(window.confirm(`删除「${name}」？删除后它将从工作流中移除，且不可恢复。`))
    }
    const title = elWorkflowDeleteModal.querySelector('#wbWorkflowDeleteTitle')
    const body = elWorkflowDeleteModal.querySelector('#wbWorkflowDeleteBody')
    const name = workflowDisplayNameOf(item) || item.name || item.id || '该工作流'
    if (title) title.textContent = `删除「${name}」？`
    if (body) body.textContent = '删除后它将从工作流中移除，且不可恢复。'
    elWorkflowDeleteModal.hidden = false
    return new Promise(resolve => {
      workflowDeleteResolve = ok => {
        workflowDeleteResolve = null
        elWorkflowDeleteModal.hidden = true
        resolve(!!ok)
      }
      requestAnimationFrame(() => elWorkflowDeleteModal.querySelector('[data-workflow-delete="cancel"]')?.focus())
    })
  }

  async function deletePersonalWorkflow(id) {
    const item = personalWorkflowPackages().find(entry => entry.id === id)
    if (!item) return
    if (!await askWorkflowDeleteConfirm(item)) return
    if (!window.api?.workbenchWorkflowPackageArchive) {
      toastFn('当前版本不支持删除工作流', 'error')
      return
    }
    const result = await window.api.workbenchWorkflowPackageArchive(item.id)
    if (!result?.ok) {
      toastFn(result?.error || '删除工作流失败', 'error')
      return
    }
    data.workflowPackages = (data.workflowPackages || []).filter(entry => entry.id !== item.id)
    if (selectedStudioWorkflowId === item.id) {
      selectedStudioWorkflowId = ''
      studioDraft = null
    }
    renderWorkflowManage()
    renderShelf()
    toastFn('已删除该工作流', 'success')
  }

  function handleWorkflowManageAction(action, id) {
    if (action === 'back' || action === 'shelf') {
      setSurface('shelf', { force: true })
      return
    }
    if (action === 'new') {
      void openOrchestration({ reset: true })
      return
    }
    if (!id) return
    if (action === 'fork') {
      const item = personalWorkflowPackages().find(entry => entry.id === id)
      if (!item) {
        toastFn('未找到该流程', 'error')
        return
      }
      void forkWorkflowPackage(item)
      return
    }
    if (action === 'edit') {
      void openOrchestration({ workflowId: id })
      return
    }
    if (action === 'delete') void deletePersonalWorkflow(id)
  }

  function syncShelfFilterChips() {
    elDomainSwitcher?.querySelectorAll('[data-domain]').forEach(node => {
      const on = node.getAttribute('data-domain') === consoleDomain
      node.classList.toggle('active', on)
      node.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }

  function shelfSupplyHint() {
    if (!data.daemon?.online) return '连接管线服务，或点击「新建工作流」编排自己的流程。'
    if (!data.repo && data.repoError) return `当前仓库不可用：${data.repoError}`
    return '在专家库安装专家后，可编排工作流或直接使用共享流程。'
  }

  async function forkWorkflowPackage(item) {
    if (!item?.id || !window.api?.workbenchWorkflowPackageFork) return
    const result = await window.api.workbenchWorkflowPackageFork(item.id, {
      name: `${item.name || item.id}（我的版本）`,
      package: item,
    })
    if (!result?.ok) {
      toastFn(result?.error || '复制流程失败', 'error')
      return
    }
    data.workflowPackages = [...(data.workflowPackages || []).filter(entry => entry.id !== result.package.id), result.package]
    renderShelf()
    renderWorkflowManage()
    toastFn('已复制为我的流程，可继续配置专家与 Graph', 'success')
    return result.package
  }

  function workflowParticipantLabels(item = {}) {
    const nodes = Array.isArray(item.graph?.nodes) ? item.graph.nodes.filter(node => node.type === 'agent') : []
    const refs = nodes.length
      ? nodes.map(node => node.agentPackageId || node.id)
      : (Array.isArray(item.agentRefs) ? item.agentRefs.map(ref => ref.id || ref) : [])
    const labels = refs.map(id => {
      const agent = agentById(id)
      return agent ? chineseRoleName(agent) : String(id || '').trim()
    }).filter(Boolean)
    return labels.length ? labels : ['由系统按步骤调度']
  }

  function workflowIoEntries(list, fallbackLabel) {
    const raw = Array.isArray(list) ? list : []
    if (!raw.length) return [{ label: fallbackLabel, hint: '' }]
    return raw.map(value => {
      if (value == null) return { label: fallbackLabel, hint: '' }
      if (typeof value === 'string' || typeof value === 'number') {
        return { label: String(value), hint: '' }
      }
      return {
        label: String(value.label || value.name || value.id || fallbackLabel).trim() || fallbackLabel,
        hint: String(value.description || value.hint || value.example || '').trim(),
      }
    })
  }

  function renderWorkflowIoListHtml(list, fallbackLabel, options = {}) {
    const entries = workflowIoEntries(list, fallbackLabel)
    const forceList = !!options.forceList
    const allSimple = entries.every(entry => !entry.hint)
    if (allSimple && !forceList) {
      return `<div class="wb-flow-io-chips" role="list">${entries.map(entry => `
        <span class="wb-flow-io-chip" role="listitem">${esc(entry.label)}</span>`).join('')}</div>`
    }
    return `<ul class="wb-flow-io-list">${entries.map(entry => `
      <li>
        <strong>${esc(entry.label)}</strong>
        ${entry.hint ? `<span>${esc(entry.hint)}</span>` : ''}
      </li>`).join('')}</ul>`
  }

  function shelfPackageGraphView(item = {}) {
    const graph = item.graph && typeof item.graph === 'object' ? item.graph : {}
    let nodes = (Array.isArray(graph.nodes) ? graph.nodes : [])
      .filter(node => node && node.id)
      .map(node => ({
        id: String(node.id),
        type: String(node.type || 'agent'),
        agentPackageId: String(node.agentPackageId || node.agent || '').trim(),
        name: String(node.name || node.title || '').trim(),
        role: String(node.role || '').trim(),
        intent: String(node.intent || node.description || '').trim(),
      }))
    let edges = (Array.isArray(graph.edges) ? graph.edges : [])
      .filter(edge => edge && edge.from && edge.to)
      .map(edge => ({
        from: String(edge.from),
        to: String(edge.to),
        label: String(edge.label || '').trim(),
      }))
    if (!nodes.length) {
      const refs = Array.isArray(item.agentRefs) ? item.agentRefs : []
      nodes = refs.map((ref, index) => {
        const id = String(ref?.id || ref || `step-${index + 1}`)
        const agent = agentById(id)
        return {
          id,
          type: 'agent',
          agentPackageId: id,
          name: agent ? chineseRoleName(agent) : id,
          role: '',
          intent: '',
        }
      }).filter(node => node.id)
      edges = nodes.slice(0, -1).map((node, index) => ({
        from: node.id,
        to: nodes[index + 1].id,
        label: '',
      }))
    }
    return { nodes, edges }
  }

  function packageNodeDisplayTitle(node) {
    if (!node) return ''
    if (node.type === 'agent' || !node.type) {
      const agentId = node.agentPackageId || node.id
      const agent = agentById(agentId)
      if (agent) return chineseRoleName(agent)
    }
    return node.name || node.role || node.intent || node.id
  }

  const DAG_LABEL_TONE = {
    '通过': 'ok', '成功': 'ok',
    '打回': 'warn', '失败': 'warn', '耗尽': 'warn',
    '修订': 'revise', '修复': 'revise', '检查': 'revise',
    '并行': 'fork', '汇合': 'merge',
  }

  function renderShelfPackageDagHtml(item = {}, options = {}) {
    const surface = options.surface === 'detail' ? 'detail' : 'default'
    const isDetail = surface === 'detail'
    const { nodes, edges } = shelfPackageGraphView(item)
    if (!nodes.length) {
      return `<div class="wb-dag-panel degraded${isDetail ? ' is-detail is-compact' : ''}">
        <div class="wb-dag-head"><div class="wb-dag-head-copy">
          ${isDetail ? '' : '<span class="wb-dag-kicker">协作结构</span>'}
          <span class="wb-dag-head-title">${isDetail ? '协作步骤' : 'Agent 步骤'}</span>
          <span class="wb-dag-head-subtitle">${isDetail
            ? '暂无固定步骤，将按系统默认顺序调度'
            : '暂无可展示的拓扑，将按系统默认顺序调度'}</span>
        </div></div>
        <p class="wb-dag-muted">${esc(workflowParticipantLabels(item).join('、') || '尚无参与专家')}</p>
      </div>`
    }
    const byId = new Map(nodes.map(node => [node.id, node]))
    const outEdges = new Map()
    for (const edge of edges) {
      if (!byId.has(edge.from) || !byId.has(edge.to)) continue
      if (!outEdges.has(edge.from)) outEdges.set(edge.from, [])
      outEdges.get(edge.from).push(edge)
    }
    const incoming = new Set(edges.filter(edge => byId.has(edge.from) && byId.has(edge.to)).map(edge => edge.to))
    const starts = nodes.filter(node => !incoming.has(node.id))
    const order = []
    const seen = new Set()
    const queue = (starts.length ? starts : [nodes[0]]).map(node => node.id)
    while (queue.length) {
      const id = queue.shift()
      if (!id || seen.has(id) || !byId.has(id)) continue
      seen.add(id)
      order.push(id)
      for (const edge of (outEdges.get(id) || [])) {
        if (!seen.has(edge.to)) queue.push(edge.to)
      }
    }
    for (const node of nodes) {
      if (!seen.has(node.id)) order.push(node.id)
    }
    const indexOf = Object.fromEntries(order.map((id, index) => [id, index]))
    const compact = isDetail && order.length <= 2
    const typeFnBase = model()?.nodeTypeLabel
      ? type => model().nodeTypeLabel(type)
      : type => ({ agent: 'Agent', gate: '门禁', parallel: '并行', script: '脚本', loop: '循环', terminal: '完成' }[type] || type)
    const typeFn = type => {
      if (!isDetail) return typeFnBase(type)
      const label = typeFnBase(type)
      if (String(label).toLowerCase() === 'agent') return '专家'
      return label || ({ agent: '专家', gate: '门禁', parallel: '并行', script: '脚本', loop: '循环', terminal: '完成' }[type] || type)
    }
    const steps = order.map((id, index) => {
      const node = byId.get(id)
      const type = node.type || 'agent'
      const outs = outEdges.get(id) || []
      const nextSequential = order[index + 1]
      const sequentialOnly = outs.length === 1
        && outs[0].to === nextSequential
        && !outs[0].label
      const multiExit = outs.length > 1 || outs.some(edge => edge.label || edge.to !== nextSequential)
      const agentId = node.agentPackageId || node.id
      const agent = (type === 'agent' || !node.type) ? agentById(agentId) : null
      const avatar = agent
        ? agentAvatarMark(agent, 'wb-dag-avatar', compact ? 36 : 28)
        : `<span class="wb-dag-avatar is-fallback" aria-hidden="true"><span class="wb-dag-step">${index + 1}</span></span>`
      const intentRaw = String(node.intent || node.role || '').trim()
      const shortIntent = intentRaw.length > 80 ? `${intentRaw.slice(0, 78)}…` : intentRaw
      let exits = ''
      if (multiExit && outs.length) {
        exits = `<div class="wb-dag-node-exits">${outs.map(edge => {
          const target = byId.get(edge.to)
          const tone = DAG_LABEL_TONE[edge.label] || ''
          const isBack = (indexOf[edge.to] ?? 999) < index
          return `<span class="wb-dag-exit${isBack ? ' is-back' : ''}">
            ${edge.label ? `<span class="wb-dag-exit-label${tone ? ` tone-${tone}` : ''}">${esc(edge.label)}</span><span class="wb-dag-exit-arrow">${isBack ? '↩' : '→'}</span>` : '<span class="wb-dag-exit-arrow">→</span>'}
            <span class="wb-dag-exit-target">${esc(packageNodeDisplayTitle(target) || edge.to)}</span>
          </span>`
        }).join('')}</div>`
      }
      let connector = ''
      if (index < order.length - 1) {
        if (sequentialOnly || !outs.length) {
          const label = sequentialOnly ? outs[0].label : ''
          const tone = label ? (DAG_LABEL_TONE[label] || '') : ''
          connector = `<div class="wb-dag-link" aria-hidden="true">
            <span class="wb-dag-link-line"></span>
            ${label ? `<span class="wb-dag-link-label${tone ? ` tone-${tone}` : ''}">${esc(label)}</span>` : ''}
            <span class="wb-dag-link-arrow"></span>
          </div>`
        } else if (!multiExit) {
          const edge = outs[0]
          const tone = edge?.label ? (DAG_LABEL_TONE[edge.label] || '') : ''
          connector = `<div class="wb-dag-link" aria-hidden="true">
            <span class="wb-dag-link-line"></span>
            ${edge?.label ? `<span class="wb-dag-link-label${tone ? ` tone-${tone}` : ''}">${esc(edge.label)}</span>` : ''}
            <span class="wb-dag-link-arrow"></span>
          </div>`
        } else {
          connector = `<div class="wb-dag-link" aria-hidden="true"><span class="wb-dag-link-line"></span><span class="wb-dag-link-arrow"></span></div>`
        }
      }
      return `<article class="wb-dag-node type-${escAttr(type)}${index === 0 ? ' is-entry' : ''}${compact ? ' is-wide' : ''}">
        <span class="wb-dag-node-rail" aria-hidden="true"></span>
        <div class="wb-dag-node-content">
          <div class="wb-dag-node-main">
            ${avatar}
            <div class="wb-dag-node-text">
              <div class="wb-dag-node-head">
                <span class="wb-dag-step">${index + 1}</span>
                <span class="wb-dag-type">${esc(typeFn(type))}</span>
                ${index === 0 ? '<span class="wb-dag-badge">起点</span>' : ''}
                ${index === order.length - 1 && order.length > 1 ? '<span class="wb-dag-badge is-end">收尾</span>' : ''}
              </div>
              <strong class="wb-dag-title">${esc(packageNodeDisplayTitle(node))}</strong>
              ${shortIntent ? `<span class="wb-dag-node-intent">${esc(shortIntent)}</span>` : ''}
            </div>
          </div>
          ${exits}
        </div>
      </article>${connector}`
    }).join('')
    const headTitle = isDetail ? '协作步骤' : 'Agent 步骤'
    const headSub = isDetail
      ? (order.length === 1 ? '由以下专家独立完成' : '按顺序协作 · 系统自动调度')
      : '只读预览 · 运行时系统按拓扑调度'
    return `<div class="wb-dag-panel${isDetail ? ' is-detail' : ''}${compact ? ' is-compact' : ''}${order.length === 1 ? ' is-single' : ''}">
      <div class="wb-dag-head"><div class="wb-dag-head-copy">
        ${isDetail ? '' : '<span class="wb-dag-kicker">协作结构</span>'}
        <span class="wb-dag-head-title">${esc(headTitle)}</span>
        <span class="wb-dag-head-subtitle">${esc(headSub)}</span>
      </div><span class="wb-dag-count"><strong>${order.length}</strong><span>步</span></span></div>
      <div class="wb-dag-flow-shell"><div class="wb-dag-flow" role="region" aria-label="协作步骤">${steps}</div></div>
    </div>`
  }

  function resolveShelfWorkflow(id) {
    return workflowById(id)
      || (Array.isArray(data.workflowPackages) ? data.workflowPackages : []).find(entry => entry.id === id)
      || null
  }

  function openWorkflowDetail(id) {
    const item = resolveShelfWorkflow(id)
    if (!item) {
      toastFn('未找到该流程', 'error')
      return
    }
    modal = {
      ...emptyModal(),
      item,
      workflow: item,
      kind: 'workflow-detail',
    }
    renderModal()
  }

  function openWorkflowStartConfirm(id) {
    const item = resolveShelfWorkflow(id)
    if (!item) {
      toastFn('未找到该流程', 'error')
      return
    }
    modal = {
      ...emptyModal(),
      item,
      workflow: item,
      kind: 'workflow-start',
    }
    renderModal()
  }

  /** 页脚兼容：与卡片一致，进入工作流对话房 */
  async function openWorkflowAsTask(id) {
    return openWorkflowDialogueRoom(id)
  }

  /** package 起点专家：优先 graph 无入边 agent 节点，否则首个 agentRefs */
  function workflowPrimaryExpert(item = {}) {
    const graph = item.graph && typeof item.graph === 'object' ? item.graph : {}
    const agentNodes = (Array.isArray(graph.nodes) ? graph.nodes : []).filter(node => node && String(node.type || 'agent') === 'agent')
    let primaryId = ''
    if (agentNodes.length) {
      const edges = Array.isArray(graph.edges) ? graph.edges : []
      const targets = new Set(edges.map(edge => String(edge?.to || edge?.target || '').trim()).filter(Boolean))
      const start = agentNodes.find(node => !targets.has(String(node.id || ''))) || agentNodes[0]
      primaryId = String(start.agentPackageId || start.agent || start.id || '').trim()
    }
    if (!primaryId && Array.isArray(item.agentRefs) && item.agentRefs.length) {
      const ref = item.agentRefs[0]
      primaryId = String(ref?.id || ref?.agentPackageId || ref || '').trim()
    }
    if (!primaryId) return null
    return availableExperts().find(agent => String(agent.id) === primaryId)
      || agentById(primaryId)
      || { id: primaryId, name: primaryId }
  }

  /** 货架主入口：双栏工作流对话房（左 Session，右工作流属性） */
  async function openWorkflowDialogueRoom(id) {
    const item = resolveShelfWorkflow(id)
    if (!item) {
      toastFn('未找到该流程', 'error')
      return { ok: false, error: '未找到该流程' }
    }
    const expert = workflowPrimaryExpert(item)
    if (!expert?.id) {
      toastFn('暂不可对话：缺少可对话的起点专家', 'error')
      return { ok: false, error: '缺少可对话的起点专家' }
    }
    const displayName = workflowDisplayNameOf(item)
    const result = await beginExpertTask({
      expertId: expert.id,
      expert,
      goal: pendingGoal || '',
      knowledgeRefs: expertDefaultKnowledgeRefs(expert),
      workflowId: item.id,
      workflowName: displayName,
      workflow: item,
      requireGoal: false,
    })
    if (!result?.ok && !result?.notified) {
      toastFn(result?.error || '无法打开工作流对话', 'error')
    }
    return result
  }

  async function beginWorkflowRun(item) {
    const target = item && item.id ? item : resolveShelfWorkflow(item)
    if (!target) {
      toastFn('未找到该流程', 'error')
      return
    }
    runInputItem = target
    selectedFlowId = target.id
    await updateLaunchIntent({
      goal: pendingGoal,
      domain: activeLaunchDomain(),
      resourceType: 'pipeline',
      resourceId: target.id,
      step: 'inputs',
      status: 'draft',
    })
    openLaunchDrawer({ step: 'inputs', status: 'draft' })
  }

  async function handleFlowLibraryAction(action, id) {
    const item = resolveShelfWorkflow(id)
    if (!item) {
      toastFn('未找到该流程', 'error')
      return
    }
    if (action === 'fork') {
      await forkWorkflowPackage(item)
      return
    }
    if (action === 'graph') {
      void openOrchestration({ workflowId: item.id })
      return
    }
    if (action === 'history') {
      setWorkbenchPage('tasks')
      return
    }
    if (action === 'inspect' || action === 'use') {
      await openWorkflowDialogueRoom(item.id)
      return
    }
  }

  async function confirmRunInputs() {
    const { goal, inputRefs, missingFields } = collectRunInputs()
    if (!goal) {
      toastFn('先写清楚这次要交付什么', 'error')
      document.getElementById('wbRunGoalInput')?.focus()
      return
    }
    if (Array.isArray(missingFields) && missingFields.length) {
      toastFn(`请先补全必填入参：${missingFields[0]}`, 'error')
      const firstMissing = runInputFields(runInputItem || workflowById(launchIntentState?.resourceId) || null)
        .find(field => missingFields.includes(field.label))
      if (firstMissing) {
        elRunInputForm?.querySelector(`[data-run-input="${CSS.escape(firstMissing.id)}"]`)?.focus()
      }
      return
    }
    pendingGoal = goal
    if (btnRunInputStart) btnRunInputStart.disabled = true
    try {
      await updateLaunchIntent({ goal, inputRefs, step: 'confirm', status: 'ready' })
      await launchPreparedIntent()
    } finally {
      if (btnRunInputStart) btnRunInputStart.disabled = false
    }
  }

  function workflowSourceLabel(source) {
    if (window.WorkbenchLabels?.workflowSourceLabel) {
      return window.WorkbenchLabels.workflowSourceLabel(source)
    }
    return {
      official: '官方专业管线',
      team: '团队专业管线',
      forked: '我的派生流程',
      personal: '我的工作流',
    }[String(source || '')] || '可组合流程'
  }

  async function openAgentGraph(goal, options = {}) {
    const value = String(goal || pendingGoal || '').trim()
    if (!value || !window.api?.workbenchAgentGraphPlan) return false
    pendingGoal = value
    await updateLaunchIntent({
      goal: value,
      domain: activeLaunchDomain(),
      resourceType: 'graph',
      step: 'readiness',
      status: 'ready',
      backend: 'local-team',
      executionSource: 'agent-graph',
    })
    modal = {
      ...emptyModal(),
      item: { id: 'workbench-agent-graph', name: '专家协作图' },
      kind: 'agent-graph',
      loading: true,
      initialIntent: value,
      silent: options.autoStart === true,
      plan: null,
    }
    if (!options.autoStart) renderModal()
    try {
      const plan = await window.api.workbenchAgentGraphPlan({
        goal: value,
        ...(Array.isArray(options.members) && options.members.length ? { members: options.members } : {}),
        ...(options.template ? { template: options.template } : {}),
        ...(options.teamName ? { teamName: options.teamName } : {}),
      })
      if (!modal.item || modal.item.id !== 'workbench-agent-graph') return
      modal.plan = plan
      agentGraphPlan = plan?.ok ? plan : null
      modal.loading = false
      modal.error = plan && plan.ok ? '' : (plan?.error || '暂时无法生成 Agent Graph')
    } catch (error) {
      modal.loading = false
      modal.error = error.message || '暂时无法生成 Agent Graph'
    }
    if (!modal.plan?.ok) {
      const error = modal.error || '当前没有可执行的本地 Agent Graph'
      closeModal()
      toastFn(error, 'error')
      return false
    }
    if (options.autoStart) {
      await confirmModal()
      return true
    }
    renderModal()
    renderStudio()
    return true
  }

  // ── 专家协作首页（专家协作 Tab）：快捷入口 + 持久化最近协作 ──
  let taskHomeTasks = []
  let shelfRecentTasks = []
  let taskComposerEl = null
  let taskManageEl = null
  /** 管理弹窗作用域：expert = 任务 Tab；workflow = 工作流 Tab */
  let taskManageScope = 'expert'
  /** 最近任务默认只展示前 N 条，保证任务首页一屏可读完；点「更多」再展开。 */
  const TASK_RECENT_PREVIEW = 3
  let taskRecentExpanded = false
  let shelfRecentExpanded = false
  const scheduleDueInFlight = new Set()

  const TASK_STATUS_META = {
    draft: { dot: 'idle', label: '草稿' },
    running: { dot: 'running', label: '进行中' },
    review: { dot: 'queued', label: '待确认' },
    done: { dot: 'done', label: '已完成' },
    failed: { dot: 'failed', label: '失败' },
    cancelled: { dot: 'cancelled', label: '已取消' },
  }

  function taskHasWorkflowId(task) {
    return !!String(task?.workflowId || '').trim()
  }

  function expertHomeTasks(list = taskHomeTasks) {
    return (Array.isArray(list) ? list : []).filter(task => !taskHasWorkflowId(task))
  }

  function workflowShelfTasks(list = taskHomeTasks) {
    return (Array.isArray(list) ? list : []).filter(taskHasWorkflowId)
  }

  function taskRecentSummary(task) {
    const result = String(task?.resultSummary || '').trim()
    if (result) return result
    const goal = String(task?.goal || '').trim()
    if (goal) return goal
    const meta = TASK_STATUS_META[task?.status] || TASK_STATUS_META.draft
    if (meta.dot === 'running' || meta.dot === 'queued') return '专家协作进行中，点开可继续'
    if (meta.dot === 'done') return '任务已完成，可回看产物或再次安排'
    if (meta.dot === 'failed') return '上次执行未完成，点开可重试或调整目标'
    if (meta.dot === 'cancelled') return '任务已取消'
    return '等待安排专家执行'
  }

  function renderTaskRecentRow(task) {
    const meta = TASK_STATUS_META[task.status] || TASK_STATUS_META.draft
    const when = wbRelTime(task.updatedAt)
    const isWorkflow = taskHasWorkflowId(task)
    let actor
    let actorMark
    if (isWorkflow) {
      actor = task.workflowName || task.workflowId || '工作流'
      actorMark = '<span class="ico ico-sm" data-icon="workflow" aria-hidden="true"></span>'
    } else {
      const expert = resolveTaskManageExpert(task)
      actor = expert.name || expert.title || task.expertName || task.expertId || '专家'
      actorMark = agentAvatarMark(expert, 'wb-task-card-avatar', 18)
    }
    const summary = taskRecentSummary(task)
    const scheduleTitle = window.WorkbenchTaskComposerSchedule?.buildTaskScheduleTooltip?.(task)
      || (task.scheduleEnabled
        ? (task.scheduleLabel
          ? `已设定时：${task.scheduleLabel}${task.nextRunAt ? ` · 下次 ${new Date(task.nextRunAt).toLocaleString()}` : ''}`
          : '已设定时')
        : '')
    const scheduleMark = task.scheduleEnabled
      ? `<span class="wb-task-schedule-mark" title="${escAttr(scheduleTitle)}" aria-label="${escAttr(scheduleTitle)}"><span class="ico ico-sm" data-icon="clock" aria-hidden="true"></span></span>`
      : ''
    return `
      <article class="wb-task-card${task.scheduleEnabled ? ' is-scheduled' : ''}">
        <button type="button" class="wb-task-card-main" data-task-open="${escAttr(task.id)}">
          <span class="wb-task-card-top">
            <span class="wb-task-state-dot ${esc(meta.dot)}" aria-hidden="true"></span>
            <span class="wb-task-state">${esc(meta.label)}</span>
            ${scheduleMark}
          </span>
          <span class="wb-task-name">${esc(task.title)}</span>
          <span class="wb-task-summary">${esc(summary)}</span>
          <span class="wb-task-intent">
            ${actorMark}
            <span>${esc(actor)}</span>
            <span class="wb-task-intent-sep" aria-hidden="true">·</span>
            <span>${esc(when || '刚刚')}</span>
          </span>
        </button>
      </article>`
  }

  function syncTaskRecentToggle(total) {
    const panel = elTaskRecentList?.closest('.wb-task-recent')
    const needsToggle = total > TASK_RECENT_PREVIEW
    if (panel) panel.classList.toggle('expanded', needsToggle && taskRecentExpanded)
    if (elTaskRecentList) {
      elTaskRecentList.classList.toggle('is-expanded', needsToggle && taskRecentExpanded)
    }
    if (!btnTaskRecentToggle) return
    btnTaskRecentToggle.hidden = !needsToggle
    if (!needsToggle) {
      btnTaskRecentToggle.setAttribute('aria-expanded', 'false')
      return
    }
    const remaining = total - TASK_RECENT_PREVIEW
    const label = taskRecentExpanded ? '收起' : `更多（${remaining}）`
    const textEl = btnTaskRecentToggle.querySelector('.wb-list-toggle-text')
    if (textEl) textEl.textContent = label
    else btnTaskRecentToggle.textContent = label
    btnTaskRecentToggle.setAttribute('aria-expanded', taskRecentExpanded ? 'true' : 'false')
  }

  function paintTaskRecentList() {
    if (!elTaskRecentList) return
    const expertTasks = expertHomeTasks()
    const total = expertTasks.length
    const visible = taskRecentExpanded || total <= TASK_RECENT_PREVIEW
      ? expertTasks
      : expertTasks.slice(0, TASK_RECENT_PREVIEW)
    elTaskRecentList.innerHTML = visible.map(renderTaskRecentRow).join('')
    syncTaskRecentToggle(total)
    if (window.StickyIcons) window.StickyIcons.mount(elTaskRecentList)
  }

  function syncShelfRecentToggle(total) {
    const panel = elShelfRecentList?.closest('.wb-shelf-recent')
    const needsToggle = total > TASK_RECENT_PREVIEW
    if (panel) panel.classList.toggle('expanded', needsToggle && shelfRecentExpanded)
    if (elShelfRecentList) {
      elShelfRecentList.classList.toggle('is-expanded', needsToggle && shelfRecentExpanded)
    }
    if (!btnShelfRecentToggle) {
      syncShelfHomeScrollLock()
      return
    }
    btnShelfRecentToggle.hidden = !needsToggle
    if (!needsToggle) {
      btnShelfRecentToggle.setAttribute('aria-expanded', 'false')
      syncShelfHomeScrollLock()
      return
    }
    const remaining = total - TASK_RECENT_PREVIEW
    const label = shelfRecentExpanded ? '收起' : `更多（${remaining}）`
    const textEl = btnShelfRecentToggle.querySelector('.wb-list-toggle-text')
    if (textEl) textEl.textContent = label
    else btnShelfRecentToggle.textContent = label
    btnShelfRecentToggle.setAttribute('aria-expanded', shelfRecentExpanded ? 'true' : 'false')
    syncShelfHomeScrollLock()
  }

  function paintShelfRecentList() {
    if (!elShelfRecentList) return
    const total = shelfRecentTasks.length
    const visible = shelfRecentExpanded || total <= TASK_RECENT_PREVIEW
      ? shelfRecentTasks
      : shelfRecentTasks.slice(0, TASK_RECENT_PREVIEW)
    elShelfRecentList.innerHTML = visible.map(renderTaskRecentRow).join('')
    syncShelfRecentToggle(total)
    if (elShelfRecentEmpty) elShelfRecentEmpty.hidden = total > 0
    if (window.StickyIcons) window.StickyIcons.mount(elShelfRecentList)
  }

  async function refreshShelfRecentTasks() {
    try {
      const res = await window.api?.workbenchTaskList?.()
      taskHomeTasks = res?.ok && Array.isArray(res.tasks) ? res.tasks : taskHomeTasks
    } catch { /* keep cache */ }
    shelfRecentTasks = workflowShelfTasks(taskHomeTasks)
    paintShelfRecentList()
  }

  function syncRecentTaskCaches() {
    shelfRecentTasks = workflowShelfTasks(taskHomeTasks)
    if (activeSurface === 'taskhome') {
      paintTaskRecentList()
      if (elTaskRecentEmpty) elTaskRecentEmpty.hidden = expertHomeTasks().length > 0
    }
    if (activeSurface === 'shelf') paintShelfRecentList()
  }

  function ensureTaskManageModal() {
    if (taskManageEl) {
      // 壳层升级后丢弃旧 DOM，避免无策略按钮的缓存弹窗残留
      if (!taskManageEl.querySelector('[data-task-manage="select-older-3m"]')) {
        taskManageEl.remove()
        taskManageEl = null
      } else {
        return taskManageEl
      }
    }
    const mask = document.createElement('div')
    mask.className = 'wb-modal-mask'
    mask.id = 'wbTaskManageModal'
    mask.hidden = true
    mask.innerHTML = `
      <div class="wb-modal wb-task-manage-modal" role="dialog" aria-modal="true" aria-labelledby="wbTaskManageTitle">
        <div class="wb-modal-head">
          <strong id="wbTaskManageTitle" class="wb-modal-title">管理最近协作</strong>
          <button type="button" class="wb-modal-close" data-task-manage="close" aria-label="关闭">×</button>
        </div>
        <div class="wb-modal-body" id="wbTaskManageBody"></div>
        <div class="wb-modal-actions wb-task-manage-actions">
          <div class="wb-task-manage-strategies" role="group" aria-label="选择策略">
            <button type="button" class="wb-modal-btn" data-task-manage="select-all">全选</button>
            <button type="button" class="wb-modal-btn ghost" data-task-manage="select-done">已完成</button>
            <button type="button" class="wb-modal-btn ghost" data-task-manage="select-older-1m">超过 1 个月</button>
            <button type="button" class="wb-modal-btn ghost" data-task-manage="select-older-3m">超过 3 个月</button>
            <button type="button" class="wb-modal-btn ghost" data-task-manage="select-none">清空</button>
          </div>
          <span class="wb-task-manage-spacer"></span>
          <button type="button" class="wb-modal-btn danger" data-task-manage="delete" disabled>删除所选</button>
        </div>
      </div>`
    document.getElementById('workbench')?.appendChild(mask)
    mask.addEventListener('click', event => {
      if (event.target === mask) { closeTaskManageModal(); return }
      const action = event.target.closest('[data-task-manage]')?.getAttribute('data-task-manage')
      if (!action) return
      if (action === 'close') closeTaskManageModal()
      else if (action === 'select-all') toggleTaskManageSelectAll(mask)
      else if (action === 'select-done') applyTaskManageSelectStrategy(mask, 'done')
      else if (action === 'select-older-1m') applyTaskManageSelectStrategy(mask, 'older-1m')
      else if (action === 'select-older-3m') applyTaskManageSelectStrategy(mask, 'older-3m')
      else if (action === 'select-none') applyTaskManageSelectStrategy(mask, 'none')
      else if (action === 'delete') void deleteSelectedManagedTasks(mask)
    })
    mask.addEventListener('change', event => {
      if (event.target?.matches?.('[data-task-manage-id]')) syncTaskManageDeleteState(mask)
    })
    taskManageEl = mask
    return mask
  }

  function closeTaskManageModal() {
    if (taskManageEl) taskManageEl.hidden = true
  }

  function syncTaskManageDeleteState(mask = taskManageEl) {
    if (!mask) return
    const checked = mask.querySelectorAll('[data-task-manage-id]:checked').length
    const btn = mask.querySelector('[data-task-manage="delete"]')
    if (btn) {
      btn.disabled = checked === 0
      btn.textContent = checked > 0 ? `删除所选（${checked}）` : '删除所选'
    }
  }

  function toggleTaskManageSelectAll(mask) {
    if (!mask) return
    const boxes = [...mask.querySelectorAll('[data-task-manage-id]')]
    if (!boxes.length) return
    const allOn = boxes.every(input => input.checked)
    boxes.forEach(input => { input.checked = !allOn })
    syncTaskManageDeleteState(mask)
  }

  const TASK_MANAGE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

  function taskManageStamp(task) {
    const raw = task?.updatedAt || task?.createdAt || ''
    const t = Date.parse(String(raw))
    return Number.isFinite(t) ? t : Date.now()
  }

  function resolveTaskManageExpert(task) {
    const expertId = String(task?.expertId || '').trim()
    const listed = availableExperts().find(agent => String(agent.id) === expertId)
    if (listed) return listed
    return {
      id: expertId,
      name: task?.expertName || expertId || '专家',
      title: task?.expertName || '',
    }
  }

  function taskManageScopeList(scope = taskManageScope) {
    return scope === 'workflow' ? workflowShelfTasks() : expertHomeTasks()
  }

  function applyTaskManageSelectStrategy(mask, strategy) {
    if (!mask) return
    const boxes = [...mask.querySelectorAll('[data-task-manage-id]')]
    if (!boxes.length) return
    const now = Date.now()
    const byId = new Map(taskManageScopeList().map(task => [String(task.id), task]))
    boxes.forEach(input => {
      const id = String(input.getAttribute('data-task-manage-id') || '')
      const task = byId.get(id)
      let on = false
      if (strategy === 'all') on = true
      else if (strategy === 'none') on = false
      else if (strategy === 'done') on = task?.status === 'done'
      else if (strategy === 'older-1m') on = !!task && (now - taskManageStamp(task)) >= TASK_MANAGE_MONTH_MS
      else if (strategy === 'older-3m') on = !!task && (now - taskManageStamp(task)) >= TASK_MANAGE_MONTH_MS * 3
      input.checked = on
    })
    syncTaskManageDeleteState(mask)
  }

  function renderTaskManageItem(task, scope = taskManageScope) {
    const meta = TASK_STATUS_META[task.status] || TASK_STATUS_META.draft
    const when = wbRelTime(task.updatedAt) || '刚刚'
    const summary = taskRecentSummary(task)
    const isWorkflow = scope === 'workflow' || taskHasWorkflowId(task)
    let avatar
    let subtitle
    if (isWorkflow) {
      const workflowName = task.workflowName || task.workflowId || '工作流'
      avatar = `<span class="wb-task-manage-avatar" aria-hidden="true"><span class="ico" data-icon="workflow"></span></span>`
      subtitle = `${workflowName} · ${when}`
    } else {
      const expert = resolveTaskManageExpert(task)
      const expertName = expert.name || expert.title || task.expertName || task.expertId || '专家'
      avatar = agentAvatarMark(expert, 'wb-task-manage-avatar', 32)
      subtitle = `${expertName} · ${when}`
    }
    return `
      <div class="wb-task-manage-item" role="listitem">
        <label class="wb-task-manage-row">
          <input type="checkbox" data-task-manage-id="${escAttr(task.id)}">
          ${avatar}
          <span class="wb-task-manage-copy">
            <strong>${esc(task.title || '未命名协作')}</strong>
            <span class="wb-task-manage-expert">${esc(subtitle)}</span>
          </span>
        </label>
        <details class="wb-task-manage-progress">
          <summary>
            <span class="wb-task-state-dot ${esc(meta.dot)}" aria-hidden="true"></span>
            <span class="wb-task-manage-status">${esc(meta.label)}</span>
            <span class="wb-task-manage-progress-toggle">进度</span>
          </summary>
          <p class="wb-task-manage-progress-body">${esc(summary)}</p>
        </details>
      </div>`
  }

  async function openTaskManageHub(scope = 'expert') {
    taskManageScope = scope === 'workflow' ? 'workflow' : 'expert'
    try {
      const res = await window.api?.workbenchTaskList?.()
      if (res?.ok && Array.isArray(res.tasks)) taskHomeTasks = res.tasks
    } catch { /* keep cache */ }
    const tasks = taskManageScopeList()
    const mask = ensureTaskManageModal()
    const title = mask.querySelector('#wbTaskManageTitle')
    if (title) {
      title.textContent = taskManageScope === 'workflow' ? '管理工作流运行' : '管理最近协作'
    }
    const body = mask.querySelector('#wbTaskManageBody')
    if (body) {
      if (!tasks.length) {
        body.innerHTML = taskManageScope === 'workflow'
          ? '<p class="wb-task-manage-empty">还没有工作流运行可管理。</p>'
          : '<p class="wb-task-manage-empty">还没有最近协作可管理。</p>'
      } else {
        const hint = taskManageScope === 'workflow'
          ? '勾选后可批量删除。删除后无法从工作流运行恢复，进行中的对话会话不会自动关闭。'
          : '勾选后可批量删除。删除后无法从最近协作恢复，进行中的对话会话不会自动关闭。'
        const listLabel = taskManageScope === 'workflow' ? '工作流运行' : '最近协作'
        body.innerHTML = `
          <p class="wb-task-manage-hint">${hint}</p>
          <div class="wb-task-manage-list" role="list" aria-label="${escAttr(listLabel)}">
            ${tasks.map(task => renderTaskManageItem(task, taskManageScope)).join('')}
          </div>`
      }
    }
    syncTaskManageDeleteState(mask)
    mask.hidden = false
    if (window.StickyIcons) window.StickyIcons.mount(mask)
  }

  async function deleteSelectedManagedTasks(mask) {
    const ids = [...(mask?.querySelectorAll('[data-task-manage-id]:checked') || [])]
      .map(input => String(input.getAttribute('data-task-manage-id') || '').trim())
      .filter(Boolean)
    if (!ids.length) {
      toastFn('请先勾选要删除的任务', 'error')
      return
    }
    if (!window.api?.workbenchTaskArchive) {
      toastFn('无法删除任务', 'error')
      return
    }
    const btn = mask.querySelector('[data-task-manage="delete"]')
    if (btn) {
      btn.disabled = true
      btn.textContent = '删除中…'
    }
    let okCount = 0
    const failed = []
    for (const id of ids) {
      try {
        const res = await window.api.workbenchTaskArchive(id)
        if (res?.ok) okCount += 1
        else failed.push(id)
      } catch {
        failed.push(id)
      }
    }
    taskHomeTasks = taskHomeTasks.filter(task => !ids.includes(task.id) || failed.includes(task.id))
    syncRecentTaskCaches()
    if (elTaskRecentEmpty) elTaskRecentEmpty.hidden = expertHomeTasks().length > 0
    if (elShelfRecentEmpty) elShelfRecentEmpty.hidden = workflowShelfTasks().length > 0
    if (failed.length && okCount) toastFn(`已删除 ${okCount} 条，${failed.length} 条失败`, 'error')
    else if (failed.length) toastFn('删除失败，请稍后重试', 'error')
    else toastFn(`已删除 ${okCount} 条记录`, 'success')
    if (!failed.length) closeTaskManageModal()
    else await openTaskManageHub(taskManageScope)
  }

  async function handleTaskScheduleDue(payload = {}) {
    const parentId = String(payload.parentId || payload.parent?.id || '').trim()
    if (!parentId || scheduleDueInFlight.has(parentId)) return
    scheduleDueInFlight.add(parentId)
    try {
      let parent = payload.parent
      if (!parent?.id && window.api?.workbenchTaskGet) {
        const got = await window.api.workbenchTaskGet(parentId)
        parent = got?.ok ? got.task : null
      }
      if (!parent?.id) {
        const listed = await window.api?.workbenchTaskList?.()
        parent = (listed?.tasks || []).find(item => item.id === parentId) || null
      }
      if (!parent?.id || !parent.expertId) {
        toastFn('定时执行缺少专家信息，已跳过', 'error')
        return
      }
      const title = `${parent.title || parent.goal || '定时协作'} · 定时执行`.slice(0, 60)
      const created = await window.api?.workbenchTaskCreate?.({
        title,
        goal: parent.goal || parent.title || '',
        expertId: parent.expertId,
        expertName: parent.expertName || '',
        workflowId: parent.workflowId || '',
        workflowName: parent.workflowName || '',
        knowledgeRefs: parent.knowledgeRefs || [],
        scheduleParentId: parent.id,
        status: 'draft',
      })
      if (!created?.ok || !created.task) {
        toastFn(created?.error || '无法创建定时子任务', 'error')
        return
      }
      const started = await beginExpertTask({
        expertId: parent.expertId,
        goal: parent.goal || '',
        knowledgeRefs: parent.knowledgeRefs || [],
        draftTask: created.task,
        requireGoal: false,
        workflowId: parent.workflowId || '',
        workflowName: parent.workflowName || '',
      })
      if (!started?.ok) {
        toastFn(started?.error || '定时执行启动失败', 'error')
      } else {
        toastFn(window.WorkbenchTaskComposerSchedule?.COPY?.scheduleDueStarted
          || '计划已触发，已打开协作（需本机在线，不会代发消息）', 'success')
      }
      await renderTaskHome()
    } catch (err) {
      toastFn(err?.message || '定时执行触发失败', 'error')
    } finally {
      scheduleDueInFlight.delete(parentId)
    }
  }

  function wbRelTime(iso) {
    const t = Date.parse(iso || '')
    if (!Number.isFinite(t)) return ''
    const diff = Date.now() - t
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚'
    if (min < 60) return `${min} 分钟前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} 小时前`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} 天前`
    const mon = Math.floor(day / 30)
    if (mon < 12) return `${mon} 个月前`
    return `${Math.floor(mon / 12)} 年前`
  }

  function availableExperts() {
    return (data.agents || []).filter(agent => agent && agent.id)
  }

  /**
   * 快捷任务只展示「已添加到工作台」的专家（工作模式绑定），而不是全部可用专家。
   * 用户在专家库点「添加到工作台」后，这里才会出现对应快捷卡片。
   * 展示名称/描述优先用最新的专家目录，绑定投影作为兜底。
   */
  function expertSourceLabel(source) {
    return ({
      curated: '精选',
      pack: '精选',
      official: '精选',
      local: '本地',
      'local-repo': 'Cursor 仓库',
      zip: 'ZIP',
      https: '远程',
      custom: '自定义',
      'legacy-okf': '旧版 OKF',
    })[source] || source || '工作台'
  }

  function expertCardTitle(agent = {}) {
    const candidates = [agent.name, agent.title, agent.label]
    for (const value of candidates) {
      const text = String(value || '').trim()
      if (text && hasChinese(text)) return text
    }
    for (const value of candidates) {
      const text = String(value || '').trim()
      if (text && text !== agent.id) return text
    }
    return chineseRoleName(agent) || String(agent.id || '专家')
  }

  function expertCardOrigin(agent = {}) {
    const origin = String(agent.originName || '').trim()
    const title = expertCardTitle(agent)
    return origin && origin !== title ? origin : ''
  }

  function expertCardStatusBadge(agent = {}) {
    const status = String(agent.status || '').trim().toLowerCase()
    // 缺失/卸载态优先，避免 enabled 默认 true 误显示「已安装」
    if (['missing', 'removed', 'unavailable', 'not_found'].includes(status)) {
      return '<span class="wb-task-quick-badge">已卸载</span>'
    }
    if (status === 'disabled' || agent.enabled === false) {
      return '<span class="wb-task-quick-badge">已停用</span>'
    }
    if (['installed', 'enabled'].includes(status) || agent.enabled === true) {
      return '<span class="wb-task-quick-badge installed">已安装</span>'
    }
    return '<span class="wb-task-quick-badge">工作台</span>'
  }

  function workbenchQuickExperts() {
    const catalog = agentsById()
    const seen = new Set()
    const list = []
    modeBindings().forEach(binding => {
      const bound = boundExpert(binding)
      const id = bound.id
      if (!id || seen.has(id)) return
      seen.add(id)
      const agent = catalog[id]
      const status = String(agent?.status || bound.status || 'enabled').trim().toLowerCase()
      // 快捷任务只展示仍可用的专家；卸载/缺失绑定不出现在启动入口
      // （卸载路径应已清绑定；此处作防御，避免幽灵「智能专家」）
      if (!agent || ['missing', 'removed', 'unavailable', 'not_found'].includes(status)) return
      if (agent.enabled === false || status === 'disabled') return
      // 合并：目录补齐头像/版本/分类；绑定的中文 label 不丢弃
      list.push({
        ...bound,
        ...agent,
        id,
        name: expertCardTitle({ ...agent, ...bound, label: bound.name || bound.label }),
        description: String(
          agent.description || agent.display?.summary || agent.summary
          || bound.description
          || '安排这位专家协作',
        ).trim(),
        category: String(agent.category || bound.category || '专家').trim(),
        version: String(agent.version || bound.version || '1.0.0').replace(/^v/i, ''),
        source: String(agent.source || bound.source || 'local').trim(),
        originName: String(agent.originName || bound.originName || '').trim(),
        status,
        enabled: agent.enabled !== false,
        avatar: agent.avatar || agent.persona?.avatar || bound.avatar,
      })
    })
    return list
  }

  function renderWorkbenchQuickCard(agent, index = 0) {
    const title = expertCardTitle(agent)
    const origin = expertCardOrigin(agent)
    const sub = [
      agent.category || '专家',
      expertSourceLabel(agent.source),
      origin,
    ].filter(Boolean).join(' · ')
    const desc = agent.description || agent.summary || '安排这位专家协作'
    const version = String(agent.version || '1.0.0').replace(/^v/i, '')
    return `
      <button type="button" class="wb-task-quick-card" data-task-quick="${escAttr(agent.id)}" style="--index:${index}"
        aria-label="查看专家 ${escAttr(title)}">
        <div class="wb-task-quick-head">
          ${agentAvatarMark(agent, 'wb-task-quick-icon', 38)}
          <div class="wb-task-quick-meta">
            <div class="wb-task-quick-title">${esc(title)}</div>
            <div class="wb-task-quick-sub">${esc(sub)}</div>
          </div>
        </div>
        <div class="wb-task-quick-desc">${esc(desc)}</div>
        <div class="wb-task-quick-foot">
          <div class="wb-task-quick-badges">${expertCardStatusBadge(agent)}</div>
          <span class="wb-task-quick-version">v${esc(version)}</span>
        </div>
      </button>`
  }

  function syncTaskQuickToggle(total) {
    const panel = elTaskQuickGrid?.closest('.wb-task-quick')
    const needsToggle = total > TASK_QUICK_PREVIEW
    if (panel) panel.classList.toggle('expanded', needsToggle && taskQuickExpanded)
    if (elTaskQuickGrid) {
      elTaskQuickGrid.classList.toggle('is-expanded', needsToggle && taskQuickExpanded)
    }
    if (!btnTaskQuickToggle) return
    btnTaskQuickToggle.hidden = !needsToggle
    if (!needsToggle) {
      btnTaskQuickToggle.setAttribute('aria-expanded', 'false')
      return
    }
    const remaining = total - TASK_QUICK_PREVIEW
    const label = taskQuickExpanded ? '收起' : `更多（${remaining}）`
    const textEl = btnTaskQuickToggle.querySelector('.wb-list-toggle-text')
    if (textEl) textEl.textContent = label
    else btnTaskQuickToggle.textContent = label
    btnTaskQuickToggle.setAttribute('aria-expanded', taskQuickExpanded ? 'true' : 'false')
  }

  function paintTaskQuickGrid() {
    if (!elTaskQuickGrid) return
    const total = taskHomeExperts.length
    if (!total) {
      elTaskQuickGrid.innerHTML = '<div class="wb-task-quick-empty">还没有添加到工作台的专家。到专家库选择专家并「添加到工作台」，就会出现在这里。</div>'
      syncTaskQuickToggle(0)
      return
    }
    const visible = taskQuickExpanded || total <= TASK_QUICK_PREVIEW
      ? taskHomeExperts
      : taskHomeExperts.slice(0, TASK_QUICK_PREVIEW)
    elTaskQuickGrid.innerHTML = visible.map((agent, index) => renderWorkbenchQuickCard(agent, index)).join('')
    syncTaskQuickToggle(total)
    maybeArmTaskQuickEnter(true)
    if (window.StickyIcons) window.StickyIcons.mount(elTaskQuickGrid)
  }

  async function renderTaskHome() {
    taskHomeExperts = workbenchQuickExperts()
    paintTaskQuickGrid()
    try {
      const res = await window.api?.workbenchTaskList?.()
      taskHomeTasks = res?.ok && Array.isArray(res.tasks) ? res.tasks : []
    } catch { taskHomeTasks = [] }
    paintTaskRecentList()
    const expertTasks = expertHomeTasks()
    if (elTaskRecentEmpty) elTaskRecentEmpty.hidden = expertTasks.length > 0
    if (window.StickyIcons && elTaskSurface) window.StickyIcons.mount(elTaskSurface)
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
    } catch {
      return false
    }
  }

  /** 工作台快捷专家卡：会话内首次有卡时减弱入场一次 */
  function maybeArmTaskQuickEnter(hasCards) {
    if (!elTaskQuickGrid || taskQuickEnterPlayed || !hasCards || prefersReducedMotion()) return
    taskQuickEnterPlayed = true
    elTaskQuickGrid.classList.add('is-entering')
    clearTimeout(taskQuickEnterTimer)
    taskQuickEnterTimer = setTimeout(() => {
      elTaskQuickGrid.classList.remove('is-entering')
      taskQuickEnterTimer = null
    }, TASK_QUICK_ENTER_MS)
  }

  function ensureTaskComposer() {
    if (taskComposerEl) return taskComposerEl
    const mask = document.createElement('div')
    mask.className = 'wb-modal-mask'
    mask.id = 'wbTaskComposer'
    mask.hidden = true
    mask.innerHTML = `
      <div class="wb-modal wb-task-composer-modal" role="dialog" aria-modal="true" aria-labelledby="wbTaskComposerTitle">
        <div class="wb-modal-head">
          <strong id="wbTaskComposerTitle" class="wb-modal-title">安排专家协作</strong>
          <button type="button" class="wb-modal-close" data-task-composer="close" aria-label="关闭">×</button>
        </div>
        <div class="wb-modal-body">
          <div class="wb-studio-field">
            <span>选择专家</span>
            <div class="wb-task-expert-picker" id="wbTaskComposerExpertPicker">
              <input type="hidden" id="wbTaskComposerExpert" value="">
              <button type="button" class="wb-task-expert-trigger" id="wbTaskComposerExpertTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="wb-task-expert-trigger-body" id="wbTaskComposerExpertTriggerBody"></span>
                <span class="wb-task-expert-chevron" aria-hidden="true"></span>
              </button>
              <div class="wb-task-expert-menu" id="wbTaskComposerExpertMenu" role="listbox" hidden></div>
            </div>
          </div>
          <label class="wb-studio-field"><span>协作目标</span>
            <textarea id="wbTaskComposerGoal" rows="3" maxlength="2000" placeholder="描述你希望这位专家完成什么"></textarea>
          </label>
          <div class="wb-studio-field wb-task-knowledge-field">
            <span>知识库</span>
            <div class="wb-task-knowledge-list" id="wbTaskComposerKnowledge"></div>
            <small class="wb-task-knowledge-hint">不选则沿用默认知识库；勾选后仅在所选范围内检索。</small>
          </div>
          <div class="wb-studio-field wb-task-composer-schedule">
            <label class="wb-task-schedule-toggle">
              <input type="checkbox" id="wbTaskComposerScheduleEnabled">
              <span class="wb-task-schedule-toggle-copy">
                <strong>定时执行</strong>
                <small>到期会新建一次协作并尝试自动开工；需本机 App 在线，不会无人值守代发消息</small>
              </span>
            </label>
            <div class="wb-task-composer-schedule-fields" id="wbTaskComposerScheduleFields" hidden>
              <div class="wb-task-composer-freq">
                <select id="wbTaskComposerScheduleType" class="wb-task-composer-select" aria-label="执行频率">
                  <option value="daily">每天</option>
                  <option value="interval">按间隔</option>
                  <option value="once">单次</option>
                </select>
                <input id="wbTaskComposerDailyTime" class="wb-task-composer-input" type="time" value="09:00" aria-label="每天时间" data-composer-schedule="daily">
                <input id="wbTaskComposerIntervalValue" class="wb-task-composer-input" type="number" min="1" max="720" value="24" aria-label="间隔值" data-composer-schedule="interval" hidden>
                <select id="wbTaskComposerIntervalUnit" class="wb-task-composer-select" aria-label="间隔单位" data-composer-schedule="interval" hidden>
                  <option value="hour">小时</option>
                  <option value="day">天</option>
                </select>
                <input id="wbTaskComposerOnceAt" class="wb-task-composer-input" type="datetime-local" value="" aria-label="单次时间" data-composer-schedule="once" hidden>
              </div>
              <small class="wb-task-composer-schedule-note" id="wbTaskComposerScheduleNote" hidden>计划仅保存在本机；关闭或退出 KnowMe 后不会触发</small>
            </div>
          </div>
        </div>
        <div class="wb-modal-actions wb-task-composer-actions">
          <button type="button" class="wb-modal-btn primary" data-task-composer="confirm">创建并开始</button>
        </div>
      </div>`
    document.getElementById('workbench')?.appendChild(mask)
    mask.addEventListener('click', event => {
      if (event.target === mask) { closeTaskComposer(); return }
      const closeMenu = () => setTaskComposerExpertMenuOpen(mask, false)
      if (event.target.closest('[data-task-composer="close"]')) {
        closeTaskComposer()
        return
      }
      const confirmBtn = event.target.closest('[data-task-composer="confirm"]')
      if (confirmBtn) {
        void submitTaskComposer()
        return
      }
      const trigger = event.target.closest('#wbTaskComposerExpertTrigger')
      if (trigger) {
        const menu = mask.querySelector('#wbTaskComposerExpertMenu')
        setTaskComposerExpertMenuOpen(mask, !!menu?.hidden)
        return
      }
      const option = event.target.closest('[data-task-expert-option]')
      if (option) {
        const expertId = option.getAttribute('data-task-expert-option') || ''
        const select = mask.querySelector('#wbTaskComposerExpert')
        if (select) select.value = expertId
        renderTaskComposerExpert(mask, expertId)
        closeMenu()
        return
      }
      if (!event.target.closest('#wbTaskComposerExpertPicker')) closeMenu()
    })
    mask.addEventListener('change', event => {
      if (event.target?.id === 'wbTaskComposerScheduleEnabled' || event.target?.id === 'wbTaskComposerScheduleType') {
        syncTaskComposerScheduleFields(mask)
      }
    })
    taskComposerEl = mask
    return mask
  }

  function syncTaskComposerScheduleFields(mask) {
    window.WorkbenchTaskComposerSchedule?.syncTaskComposerScheduleFields?.(mask)
  }

  function resetTaskComposerSchedule(mask) {
    window.WorkbenchTaskComposerSchedule?.resetTaskComposerSchedule?.(mask)
  }

  function readTaskComposerSchedule(mask) {
    if (window.WorkbenchTaskComposerSchedule?.readTaskComposerSchedule) {
      return window.WorkbenchTaskComposerSchedule.readTaskComposerSchedule(mask)
    }
    return {
      scheduleEnabled: false,
      schedule: { type: 'daily', dailyTime: '09:00', intervalValue: 24, intervalUnit: 'hour', onceAt: '' },
    }
  }

  function setTaskComposerExpertMenuOpen(mask, open) {
    const menu = mask?.querySelector('#wbTaskComposerExpertMenu')
    const trigger = mask?.querySelector('#wbTaskComposerExpertTrigger')
    if (!menu || !trigger) return
    menu.hidden = !open
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
    mask?.querySelector('.wb-task-expert-picker')?.classList.toggle('is-open', !!open)
  }

  function renderTaskComposerExpertBrief(expert = {}, { selected = false } = {}) {
    const role = expert.persona?.role || expert.role || '专业 Agent'
    const name = expert.name || expert.title || expert.id || '专家'
    return `
      ${agentAvatarMark(expert, 'wb-task-expert-mark', 28)}
      <span class="wb-task-expert-copy">
        <strong>${esc(name)}</strong>
        <small>${esc(role)}</small>
      </span>
      ${selected ? '<span class="wb-task-expert-check" aria-hidden="true"></span>' : ''}`
  }

  function expertDefaultKnowledgeRefs(expert = {}) {
    const refs = expert.profile?.knowledgeRefs || expert.knowledgeRefs || []
    return Array.isArray(refs)
      ? refs.map(item => String(item?.id || item?.providerId || item || '').trim()).filter(Boolean)
      : []
  }

  function renderTaskComposerExpert(mask, expertId, knowledgeRefs = null) {
    const experts = availableExperts()
    const expert = experts.find(agent => String(agent.id) === String(expertId)) || experts[0] || {}
    const selectedId = String(expert.id || expertId || '')
    const hidden = mask.querySelector('#wbTaskComposerExpert')
    if (hidden) hidden.value = selectedId
    const triggerBody = mask.querySelector('#wbTaskComposerExpertTriggerBody')
    if (triggerBody) {
      triggerBody.innerHTML = selectedId
        ? renderTaskComposerExpertBrief(expert)
        : '<span class="wb-task-expert-placeholder">选择一位专家</span>'
    }
    const menu = mask.querySelector('#wbTaskComposerExpertMenu')
    if (menu) {
      menu.innerHTML = experts.map(agent => {
        const id = String(agent.id || '')
        const isSelected = id === selectedId
        return `<button type="button" class="wb-task-expert-option${isSelected ? ' is-selected' : ''}" role="option" aria-selected="${isSelected ? 'true' : 'false'}" data-task-expert-option="${escAttr(id)}">${renderTaskComposerExpertBrief(agent, { selected: isSelected })}</button>`
      }).join('')
    }
    const selected = new Set(normalizedKnowledgeRefs(
      Array.isArray(knowledgeRefs) ? knowledgeRefs : expertDefaultKnowledgeRefs(expert)
    ))
    const host = mask.querySelector('#wbTaskComposerKnowledge')
    if (host) {
      const providers = Array.isArray(data.knowledgeProviders) ? data.knowledgeProviders : []
      host.innerHTML = providers.length
        ? providers.map(provider => {
            const id = String(provider.id || '').trim()
            const status = provider.enabled === false ? '未启用' : (['local', 'qmd-local'].includes(provider.kind) ? '本地知识' : '远程知识')
            return `<label class="wb-task-knowledge-option">
              <input type="checkbox" data-task-knowledge="${escAttr(id)}"${selected.has(id) ? ' checked' : ''}${provider.enabled === false ? ' disabled' : ''}>
              <span class="wb-task-knowledge-meta"><strong>${esc(provider.displayName || provider.name || id)}</strong><small>${esc(status)}</small></span>
            </label>`
          }).join('')
        : '<span class="wb-task-knowledge-hint">还没有可选知识库，可先直接对话，之后在设置中添加。</span>'
    }
    if (window.StickyIcons) window.StickyIcons.mount(mask)
  }

  function openTaskComposer({ expertId = '', goal = '', knowledgeRefs = null } = {}) {
    const experts = availableExperts()
    if (!experts.length) {
      toastFn('还没有可用专家，请先到专家库创建专家', 'error')
      openCapabilityPicker('experts')
      return
    }
    const mask = ensureTaskComposer()
    const selectedId = expertId || String(experts[0]?.id || '')
    const goalInput = mask.querySelector('#wbTaskComposerGoal')
    // 仅使用显式 goal；不回填会话残留目标，避免管线侧文案污染新建
    if (goalInput) goalInput.value = String(goal || '')
    resetTaskComposerSchedule(mask)
    taskComposerDraftTask = null
    setTaskComposerExpertMenuOpen(mask, false)
    renderTaskComposerExpert(mask, selectedId, knowledgeRefs)
    mask.hidden = false
    setTimeout(() => goalInput?.focus(), 0)
  }

  function closeTaskComposer() {
    if (taskComposerEl) {
      setTaskComposerExpertMenuOpen(taskComposerEl, false)
      taskComposerEl.hidden = true
    }
    taskComposerDraftTask = null
  }

  /**
   * 工作台专家对话统一入口：创建/更新任务 → 持久 Session → 展开 task-room。
   * 关闭工作间后协作仍在「最近协作」，可恢复同一 Session。
   * requireGoal=true 时用于任务弹窗；直接开工允许空目标（首屏说明目标再发送）。
   */
  async function beginExpertTask({
    expertId,
    goal = '',
    knowledgeRefs = [],
    expert = null,
    draftTask = null,
    requireGoal = false,
    workflowId = '',
    workflowName = '',
    workflow = null,
    scheduleEnabled = false,
    schedule = null,
  } = {}) {
    const id = String(expertId || '').trim()
    if (!id) return { ok: false, error: '请选择一位专家' }
    const trimmedGoal = String(goal || '').trim()
    if (requireGoal && !trimmedGoal) return { ok: false, error: '请填写协作目标' }
    if (typeof onExpertTaskStart !== 'function') {
      return { ok: false, error: '专家对话服务未就绪' }
    }

    const resolvedExpert = expert && typeof expert === 'object'
      ? expert
      : (availableExperts().find(agent => String(agent.id) === id) || {})
    const refs = normalizedKnowledgeRefs(knowledgeRefs)
    const expertName = resolvedExpert.name || resolvedExpert.title || id
    const resolvedWorkflow = workflow && workflow.id
      ? workflow
      : (workflowId ? resolveShelfWorkflow(workflowId) : null)
    const wfId = String(workflowId || resolvedWorkflow?.id || '').trim()
    const wfName = String(workflowName || (resolvedWorkflow ? workflowDisplayNameOf(resolvedWorkflow) : '') || '').trim()
    const title = (wfName || trimmedGoal || `与 ${expertName} 协作`).slice(0, 60)
    const schedulePatch = scheduleEnabled === true
      ? { scheduleEnabled: true, schedule: schedule && typeof schedule === 'object' ? schedule : {} }
      : { scheduleEnabled: false }

    let created = draftTask
    try {
      if (!created) {
        const res = await window.api?.workbenchTaskCreate?.({
          title,
          goal: trimmedGoal,
          expertId: id,
          expertName,
          workflowId: wfId,
          workflowName: wfName,
          knowledgeRefs: refs,
          status: 'draft',
          ...schedulePatch,
        })
        created = res?.ok ? res.task : null
      } else if (window.api?.workbenchTaskUpdate) {
        const res = await window.api.workbenchTaskUpdate(created.id, {
          title,
          goal: trimmedGoal,
          expertId: id,
          expertName,
          workflowId: wfId,
          workflowName: wfName,
          knowledgeRefs: refs,
          ...schedulePatch,
        })
        if (res?.ok && res.task) created = res.task
      }
      if (!created) return { ok: false, error: '无法保存任务' }

      pendingGoal = trimmedGoal
      const result = await onExpertTaskStart({
        task: created,
        expert: resolvedExpert,
        expertId: id,
        goal: trimmedGoal,
        knowledgeRefs: refs,
      })
      if (!result?.ok || !result.session?.id) {
        return {
          ok: false,
          error: result?.error || '无法创建专家对话',
          notified: Boolean(result?.notified),
          task: created,
        }
      }

      let updatedTask = created
      if (window.api?.workbenchTaskUpdate) {
        const updated = await window.api.workbenchTaskUpdate(created.id, {
          status: 'running',
          knowledgeRefs: refs,
          workflowId: wfId,
          workflowName: wfName,
          sessionId: result.session.id,
          execRef: { kind: 'session', id: result.session.id },
          resultSummary: trimmedGoal
            ? `进行中：${trimmedGoal}`.slice(0, 280)
            : `已与 ${expertName} 开始协作`,
        })
        if (updated?.ok && updated.task) updatedTask = updated.task
      } else {
        updatedTask = {
          ...created,
          status: 'running',
          knowledgeRefs: refs,
          workflowId: wfId,
          workflowName: wfName,
          execRef: { kind: 'session', id: result.session.id },
          resultSummary: trimmedGoal
            ? `进行中：${trimmedGoal}`.slice(0, 280)
            : `已与 ${expertName} 开始协作`,
        }
      }

      const existingIdx = taskHomeTasks.findIndex(item => item.id === updatedTask.id)
      if (existingIdx >= 0) taskHomeTasks[existingIdx] = updatedTask
      else taskHomeTasks = [updatedTask, ...taskHomeTasks]
      syncRecentTaskCaches()

      openExpertTaskRoom(updatedTask, result.session, resolvedExpert, resolvedWorkflow)
      return {
        ok: true,
        task: updatedTask,
        session: result.session,
        expert: resolvedExpert,
        workflow: resolvedWorkflow,
      }
    } catch (error) {
      return {
        ok: false,
        error: error?.message || '无法开始专家对话',
        task: created || null,
      }
    }
  }

  async function submitTaskComposer() {
    const mask = taskComposerEl
    if (!mask) return
    const expertId = String(mask.querySelector('#wbTaskComposerExpert')?.value || '').trim()
    const goal = String(mask.querySelector('#wbTaskComposerGoal')?.value || '').trim()
    const knowledgeRefs = [...mask.querySelectorAll('[data-task-knowledge]:checked')]
      .map(input => String(input.getAttribute('data-task-knowledge') || '').trim())
      .filter(Boolean)
    const schedulePayload = readTaskComposerSchedule(mask)
    if (!expertId) { toastFn('请选择一位专家', 'error'); return }
    if (!goal) { toastFn('请填写协作目标', 'error'); return }
    if (schedulePayload.error) { toastFn(schedulePayload.error, 'error'); return }
    const confirmButton = mask.querySelector('[data-task-composer="confirm"]')
    if (confirmButton?.disabled) return
    if (confirmButton) {
      confirmButton.disabled = true
      confirmButton.textContent = '正在打开对话…'
    }
    try {
      const result = await beginExpertTask({
        expertId,
        goal,
        knowledgeRefs,
        draftTask: taskComposerDraftTask,
        requireGoal: true,
        scheduleEnabled: schedulePayload.scheduleEnabled === true,
        schedule: schedulePayload.schedule,
      })
      if (!result?.ok) {
        if (result?.task) taskComposerDraftTask = result.task
        if (!result?.notified) toastFn(result?.error || '无法开始专家对话，任务已保留为草稿', 'error')
        return
      }
      taskComposerEl.hidden = true
      taskComposerDraftTask = null
    } catch (error) {
      toastFn(error?.message || '无法开始专家对话，任务已保留为草稿', 'error')
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false
        confirmButton.textContent = '创建并开始'
      }
    }
  }

  /** 工作台点专家「开始对话」：直接建任务并铺开，不跳转到助理。 */
  async function startExpertTaskDirect({ expertId, goal = '', knowledgeRefs = [], expert = null } = {}) {
    return beginExpertTask({
      expertId,
      goal,
      knowledgeRefs: knowledgeRefs?.length
        ? knowledgeRefs
        : expertDefaultKnowledgeRefs(expert || availableExperts().find(a => String(a.id) === String(expertId)) || {}),
      expert,
      requireGoal: false,
    })
  }

  function normalizedKnowledgeRefs(value) {
    return Array.isArray(value)
      ? [...new Set(value.map(item => String(item?.id || item?.providerId || item || '').trim()).filter(Boolean))]
      : []
  }

  /** 技能/连接器 slug → 短标签（优先 catalog 名，避免内部长 ID 进界面） */
  function capabilityChipLabel(id, kind = 'skill') {
    const raw = String(id || '').trim()
    if (!kind || kind === 'skill') {
      const skill = (data.skills || []).find(item => String(item.id || '') === raw)
      const titled = skill?.title || skill?.name || skill?.displayName || skill?.slash
      if (titled) return String(titled).replace(/^\//, '').slice(0, 14)
    }
    if (kind === 'connector') {
      const connector = (data.connectors || []).find(item => String(item.id || item.kind || '') === raw)
      const titled = connector?.displayName || connector?.name || connector?.title
      if (titled) return String(titled).slice(0, 14)
      if (/feishu|lark/i.test(raw)) return '飞书'
      if (/mcp/i.test(raw)) return 'MCP'
    }
    const cleaned = raw
      .replace(/^th-bi-[a-f0-9]+--?/i, '')
      .replace(/^(skill|connector)[:./-]+/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
    return (words || (kind === 'connector' ? '连接' : '技能')).slice(0, 14)
  }

  function capabilityChipMark(label, kind, ready) {
    const tone = kind === 'connector'
      ? (/飞书|feishu|lark/i.test(label) ? 'feishu' : 'plug')
      : 'skill'
    const letter = String(label || '?').trim().charAt(0).toUpperCase() || '?'
    const icon = tone === 'feishu'
      ? '<span class="ico" data-icon="network"></span>'
      : (tone === 'plug'
        ? '<span class="ico" data-icon="link"></span>'
        : `<span class="wb-side-chip-letter">${esc(letter)}</span>`)
    return `<span class="wb-side-chip${ready ? ' is-ready' : ' is-limited'}" data-tone="${tone}" title="${esc(label)}">${icon}</span>`
  }

  function renderExpertTaskRoom() {
    if (!elExpertTaskBody || !expertTaskRoom) return
    const { task, session, expert, workflow } = expertTaskRoom
    const sessionExpert = session.expert || {}
    const role = expert.persona?.role || expert.role || sessionExpert.role || '专业 Agent'
    const name = expert.name || expert.title || task.expertName || task.expertId || '专家'
    const knowledgeRefs = normalizedKnowledgeRefs(session.knowledgeRefs || task.knowledgeRefs)
    const providers = new Map((data.knowledgeProviders || []).map(item => [String(item.id || ''), item]))
    const bindings = sessionExpert.bindings || {
      skills: Array.isArray(expert.skills) ? expert.skills : [],
      connectors: Array.isArray(expert.connectors) ? expert.connectors : [],
    }
    const skillIds = [...new Set((Array.isArray(bindings.skills) ? bindings.skills : [])
      .map(item => String(item?.id || item || '').trim()).filter(Boolean))]
    const connectorIds = [...new Set((Array.isArray(bindings.connectors) ? bindings.connectors : [])
      .map(item => String(item?.id || item || '').trim()).filter(Boolean))]
    const skillCatalog = new Set((data.skills || []).map(item => String(item.id || '').trim()).filter(Boolean))
    const readinessItems = Array.isArray(sessionExpert.readiness?.items) && sessionExpert.readiness.items.length
      ? sessionExpert.readiness.items
      : [
          ...skillIds.map(id => ({
            id,
            kind: 'skill',
            status: skillCatalog.has(id) ? 'ready' : 'limited',
            reason: skillCatalog.has(id) ? '' : '未安装',
          })),
          ...connectorIds.map(id => ({ id, kind: 'connector', status: 'ready' })),
        ]
    const connectors = readinessItems.filter(item => item.kind === 'connector')
    const skills = readinessItems.filter(item => item.kind !== 'connector')
    const capabilityTags = agentCapabilities({
      ...expert,
      skills: skillIds,
      display: expert.display || sessionExpert.display,
    })
    const agenticType = sessionExpert.agenticType || expert.agenticType || 'react'
    const agenticLabels = {
      reflection: '反射',
      tool_use: '工具优先',
      react: 'ReAct',
      planning: '规划',
      multi_agent: '多智能体',
    }
    const sopBrief = String(sessionExpert.sop || expert.sop || '').trim().split(/\n/).map(s => s.trim()).filter(Boolean)[0] || ''
    const typeHtml = `<span class="wb-side-cap">${esc(agenticLabels[agenticType] || agenticType)}</span>`
    const tagHtml = [typeHtml].concat(
      capabilityTags.length
        ? capabilityTags.map(tag => `<span class="wb-side-cap">${esc(tag)}</span>`)
        : [],
    ).join('')
    const connectorHtml = connectors.length
      ? connectors.map(item => {
          const label = capabilityChipLabel(item.id, 'connector')
          return capabilityChipMark(label, 'connector', item.status === 'ready')
        }).join('')
      : '<span class="wb-side-empty">点击管理添加</span>'
    const skillHtml = skills.length
      ? skills.map(item => {
          const label = capabilityChipLabel(item.id, 'skill')
          return capabilityChipMark(label, 'skill', item.status === 'ready')
        }).join('')
      : '<span class="wb-side-empty">点击管理添加</span>'
    let knowledgeHtml = ''
    if (knowledgeRefs.length) {
      knowledgeHtml = knowledgeRefs.map(id => {
        const label = providers.get(id)?.displayName || providers.get(id)?.name || id
        const letter = String(label || 'K').trim().charAt(0)
        return `<span class="wb-side-chip is-ready" data-tone="knowledge" title="${esc(label)}"><span class="wb-side-chip-letter">${esc(letter)}</span></span>`
      }).join('')
    } else {
      const defId = data.activeKnowledgeProviderId
      const defLabel = defId
        ? (providers.get(defId)?.displayName || providers.get(defId)?.name || defId)
        : '默认'
      knowledgeHtml = `<span class="wb-side-chip is-ready" data-tone="knowledge" title="${esc(defLabel)}"><span class="ico" data-icon="bookOpen"></span></span>`
    }
    const avatarMark = agentAvatarMark({
      id: expert.id || task.expertId,
      name,
      title: expert.title,
      description: expert.description || expert.display?.summary || sessionExpert.description,
      role,
      avatar: expert.avatar || expert.persona?.avatar || sessionExpert.avatar,
      skills: skillIds,
      category: expert.category,
      tags: expert.tags,
    }, 'wb-side-avatar', 48)
    const identity = window.AgentIdentity
    const badge = identity && typeof identity.identitySourceLabel === 'function'
      ? identity.identitySourceLabel({
          origin: expert.origin || expert.source || sessionExpert.origin || 'local',
          source: expert.source || sessionExpert.source,
        })
      : '我的专家'
    const goal = String(task.goal || '').trim()
    const goalHtml = goal
      ? `<section class="wb-side-panel">
          <div class="wb-side-panel-head"><strong>任务</strong></div>
          <p class="wb-side-goal">${esc(goal)}</p>
        </section>`
      : ''
    const sopHtml = sopBrief
      ? `<p class="wb-side-sop">${esc(sopBrief.slice(0, 100))}${sopBrief.length > 100 ? '…' : ''}</p>`
      : ''
    const canTune = /local|custom|user|mine/i.test(String(expert.origin || expert.source || sessionExpert.origin || sessionExpert.source || 'local'))
    const tuneHtml = canTune
      ? `<button type="button" class="wb-side-manage" data-side-tune-expert="${esc(expert.id || task.expertId || '')}">调优专家</button>`
      : ''

    let workflowHtml = ''
    if (workflow && workflow.id) {
      const { runnable, blockers } = shelfReadiness(workflow)
      const displayName = workflowDisplayNameOf(workflow)
      const intro = String(workflow.description || workflow.summary || '').trim()
        || `整理材料并产出：${workflowOutcomeText(workflow)}`
      const steps = Math.max(1, workflow.graph?.nodes?.filter(node => node.type === 'agent').length || workflow.agentRefs?.length || 1)
      const stepLabels = workflowParticipantLabels(workflow)
      const readinessHtml = runnable
        ? '<p class="wb-side-ready">现在可以在左侧对话推进本工作流。</p>'
        : `<p class="wb-side-blocker">缺少：${esc(blockers.join('、') || '执行所需的专家或外部工具')}</p>`
      const stepListHtml = stepLabels.length
        ? `<ul class="wb-side-step-list">${stepLabels.map(label => `<li>${esc(label)}</li>`).join('')}</ul>`
        : '<p class="wb-side-workflow-steps">暂无步骤</p>'
      workflowHtml = `
        <section class="wb-side-panel wb-side-workflow">
          <div class="wb-side-block">
            <div class="wb-side-panel-head"><strong>工作流</strong><span>${esc(shelfProvenanceLabel(workflow.source))}</span></div>
            <strong class="wb-side-workflow-name">${esc(displayName)}</strong>
            <p class="wb-side-workflow-intro">${esc(intro)}</p>
          </div>
          <div class="wb-side-block wb-side-workflow-io">
            <div>
              <div class="wb-side-panel-head"><strong>需要</strong></div>
              ${renderWorkflowIoListHtml(workflow.inputs, workflowInputText(workflow), { forceList: true })}
            </div>
            <div>
              <div class="wb-side-panel-head"><strong>产出</strong></div>
              ${renderWorkflowIoListHtml(workflow.outputs, workflowOutcomeText(workflow), { forceList: true })}
            </div>
          </div>
          <div class="wb-side-block">
            <div class="wb-side-panel-head"><strong>协作步骤</strong><span>${steps} 步</span></div>
            ${stepListHtml}
          </div>
          <div class="wb-side-block is-last">
            ${readinessHtml}
          </div>
        </section>`
    }

    elExpertTaskBody.innerHTML = `
      <div class="wb-side-stack">
        ${workflowHtml}
        <section class="wb-side-panel wb-side-expert">
          ${avatarMark}
          <div class="wb-side-expert-copy">
            <div class="wb-side-expert-name">
              <strong>${esc(name)}</strong>
              <span class="wb-side-badge">${esc(badge)}</span>
            </div>
            ${tagHtml ? `<div class="wb-side-caps" aria-label="专业能力">${tagHtml}</div>` : ''}
            ${sopHtml}
            ${tuneHtml}
          </div>
        </section>
        ${goalHtml}
        <section class="wb-side-panel" data-side-section="connectors">
          <div class="wb-side-panel-head">
            <strong>连接器</strong>
            <span>${connectors.length || 0}</span>
            <button type="button" class="wb-side-manage" data-side-manage="connectors" title="管理本次协作连接器">管理</button>
          </div>
          <div class="wb-side-icons" aria-label="连接器">${connectorHtml}</div>
          <div class="wb-side-manage-panel" hidden data-side-manage-panel="connectors"></div>
        </section>
        <section class="wb-side-panel" data-side-section="skills">
          <div class="wb-side-panel-head">
            <strong>技能</strong>
            <span>${skills.length || 0}</span>
            <button type="button" class="wb-side-manage" data-side-manage="skills" title="管理本次协作技能">管理</button>
          </div>
          <div class="wb-side-icons" aria-label="技能">${skillHtml}</div>
          <div class="wb-side-manage-panel" hidden data-side-manage-panel="skills"></div>
        </section>
        <section class="wb-side-panel" data-side-section="knowledge">
          <div class="wb-side-panel-head">
            <strong>知识</strong>
            <span>${knowledgeRefs.length || '默认'}</span>
            <button type="button" class="wb-side-manage" data-side-manage="knowledge" title="管理本次知识范围">管理</button>
          </div>
          <div class="wb-side-icons" aria-label="知识范围">${knowledgeHtml}</div>
          <div class="wb-side-manage-panel" hidden data-side-manage-panel="knowledge"></div>
        </section>
        <p class="wb-side-hint">技能/连接器调整仅影响本次协作，不改写专家包。</p>
      </div>`
    if (window.StickyIcons) window.StickyIcons.mount(elExpertTaskRoom)
    bindExpertSideManageHandlers()
    if (elExpertTaskTitle) {
      const displayName = workflow && workflow.id
        ? (workflowDisplayNameOf(workflow) || workflow.name || '工作流')
        : (goal || name)
      elExpertTaskTitle.textContent = displayName
    }
    syncDialogueStatusBar()
  }

  function bindExpertSideManageHandlers() {
    if (!elExpertTaskBody || elExpertTaskBody.dataset.sideManageBound === '1') return
    elExpertTaskBody.dataset.sideManageBound = '1'
    elExpertTaskBody.addEventListener('click', async (event) => {
      const tune = event.target.closest?.('[data-side-tune-expert]')
      if (tune) {
        const expertId = String(tune.getAttribute('data-side-tune-expert') || '').trim()
        if (expertId && typeof window.openCapabilityHub === 'function') {
          window.openCapabilityHub('experts', { expertId, surface: 'workbench', action: 'tune' })
        }
        return
      }
      const manageBtn = event.target.closest?.('[data-side-manage]')
      if (manageBtn) {
        const kind = String(manageBtn.getAttribute('data-side-manage') || '').trim()
        await toggleExpertSideManagePanel(kind)
        return
      }
      const applyBtn = event.target.closest?.('[data-side-apply]')
      if (applyBtn) {
        const kind = String(applyBtn.getAttribute('data-side-apply') || '').trim()
        await applyExpertSideManage(kind)
      }
      const cfgBtn = event.target.closest?.('[data-side-config-connector]')
      if (cfgBtn) {
        window.api?.openSettings?.('connectors')
      }
    })
  }

  async function toggleExpertSideManagePanel(kind) {
    if (!elExpertTaskBody || !expertTaskRoom) return
    const panel = elExpertTaskBody.querySelector(`[data-side-manage-panel="${kind}"]`)
    if (!panel) return
    const opening = panel.hidden
    elExpertTaskBody.querySelectorAll('[data-side-manage-panel]').forEach((node) => { node.hidden = true })
    if (!opening) return
    panel.hidden = false
    const session = expertTaskRoom.session || {}
    const sessionExpert = session.expert || {}
    const bindings = sessionExpert.bindings || {
      skills: Array.isArray(expertTaskRoom.expert?.skills) ? expertTaskRoom.expert.skills : [],
      connectors: Array.isArray(expertTaskRoom.expert?.connectors) ? expertTaskRoom.expert.connectors : [],
    }
    if (kind === 'knowledge') {
      const selected = new Set(normalizedKnowledgeRefs(session.knowledgeRefs || expertTaskRoom.task?.knowledgeRefs))
      const providers = data.knowledgeProviders || []
      panel.innerHTML = `
        <label class="wb-side-check"><input type="checkbox" data-side-knowledge-default ${selected.size ? '' : 'checked'}> 跟随默认知识库</label>
        ${providers.map((p) => {
          const id = String(p.id || '')
          const label = p.displayName || p.name || id
          const disabled = p.enabled === false ? 'disabled' : ''
          return `<label class="wb-side-check"><input type="checkbox" data-side-knowledge="${esc(id)}" ${selected.has(id) ? 'checked' : ''} ${disabled}> ${esc(label)}</label>`
        }).join('') || '<p class="wb-side-empty">暂无知识库</p>'}
        <button type="button" class="wb-side-apply" data-side-apply="knowledge">应用到本次协作</button>`
      return
    }
    if (kind === 'skills') {
      const selected = new Set((bindings.skills || []).map((id) => String(id?.id || id || '').trim()).filter(Boolean))
      const skills = data.skills || []
      panel.innerHTML = `
        ${skills.slice(0, 80).map((s) => {
          const id = String(s.id || '')
          const label = s.title || s.name || s.displayName || id
          return `<label class="wb-side-check"><input type="checkbox" data-side-skill="${esc(id)}" ${selected.has(id) ? 'checked' : ''}> ${esc(label)}</label>`
        }).join('') || '<p class="wb-side-empty">暂无已安装技能</p>'}
        <button type="button" class="wb-side-apply" data-side-apply="skills">应用到本次协作</button>`
      return
    }
    if (kind === 'connectors') {
      const selected = new Set((bindings.connectors || []).map((id) => String(id?.id || id || '').trim()).filter(Boolean))
      const connectors = data.connectors || []
      panel.innerHTML = `
        ${connectors.slice(0, 80).map((c) => {
          const id = String(c.id || c.kind || '')
          const label = c.displayName || c.name || c.title || id
          const limited = c.enabled === false || c.status === 'limited'
          return `<label class="wb-side-check"><input type="checkbox" data-side-connector="${esc(id)}" ${selected.has(id) ? 'checked' : ''}> ${esc(label)}${limited ? ' · 需配置' : ''}</label>`
        }).join('') || '<p class="wb-side-empty">暂无连接器</p>'}
        <button type="button" class="wb-side-apply" data-side-apply="connectors">应用到本次协作</button>
        <button type="button" class="wb-side-manage" data-side-config-connector>打开连接器设置</button>`
    }
  }

  async function applyExpertSideManage(kind) {
    const sessionId = expertTaskRoom?.session?.id
    if (!sessionId || typeof window.api?.agentSessionContextUpdate !== 'function') {
      toast('当前会话暂不可更新', 'error')
      return
    }
    const panel = elExpertTaskBody?.querySelector(`[data-side-manage-panel="${kind}"]`)
    if (!panel) return
    let patch = {}
    if (kind === 'knowledge') {
      if (panel.querySelector('[data-side-knowledge-default]')?.checked) {
        patch = { knowledgeRefs: [] }
      } else {
        const refs = [...panel.querySelectorAll('[data-side-knowledge]:checked')]
          .map((input) => input.getAttribute('data-side-knowledge'))
          .filter(Boolean)
        patch = { knowledgeRefs: refs }
      }
    } else if (kind === 'skills') {
      patch = {
        skills: [...panel.querySelectorAll('[data-side-skill]:checked')]
          .map((input) => input.getAttribute('data-side-skill'))
          .filter(Boolean),
      }
    } else if (kind === 'connectors') {
      patch = {
        connectors: [...panel.querySelectorAll('[data-side-connector]:checked')]
          .map((input) => input.getAttribute('data-side-connector'))
          .filter(Boolean),
      }
    } else {
      return
    }
    try {
      const result = await window.api.agentSessionContextUpdate(sessionId, patch)
      if (!result?.ok || !result.session) throw new Error(result?.error || '更新失败')
      expertTaskRoom.session = { ...expertTaskRoom.session, ...result.session }
      if (result.session.expert) {
        expertTaskRoom.session.expert = result.session.expert
      }
      if (patch.knowledgeRefs) {
        expertTaskRoom.task = { ...expertTaskRoom.task, knowledgeRefs: patch.knowledgeRefs }
      }
      toast(kind === 'knowledge' ? '知识范围已更新' : '本次协作绑定已更新')
      renderExpertTaskRoom()
      window.AgentChat?.refreshAfterSessionContext?.(result.session)
    } catch (error) {
      toast(error?.message || '更新失败', 'error')
    }
  }

  function openExpertTaskRoom(task, session, expert = {}, workflow = null) {
    stopDaemonRuntimeWatchers()
    run = emptyRun()
    const resolvedWorkflow = workflow && workflow.id
      ? workflow
      : (task?.workflowId ? resolveShelfWorkflow(task.workflowId) : null)
    // 工作流对话默认回工作流；专家协作对话回专家协作 Tab
    const fallback = resolvedWorkflow && activeSurface !== 'taskhome' ? 'shelf' : 'taskhome'
    taskRoomReturnState = captureTaskRoomReturnState({
      surface: resolveReturnSurface(fallback),
      resourceType: resolvedWorkflow ? 'pipeline' : 'agent',
      resourceId: resolvedWorkflow?.id || task?.expertId || '',
      runId: task?.id || session?.id || '',
    })
    expertTaskRoom = {
      task: { ...task },
      session: { ...session },
      expert: { ...expert },
      workflow: resolvedWorkflow || null,
    }
    setSurface('run', { force: true })
    syncExpertTaskRoomVisibility()
    renderExpertTaskRoom()
    const headName = resolvedWorkflow
      ? workflowDisplayNameOf(resolvedWorkflow)
      : (expert.name || expert.title || task.expertName || '专家任务')
    if (elHeadTitle) elHeadTitle.textContent = headName
    if (elExpertTaskTitle) {
      const goal = String(task.goal || task.title || '').trim()
      elExpertTaskTitle.textContent = resolvedWorkflow
        ? (workflowDisplayNameOf(resolvedWorkflow) || headName)
        : (goal || headName)
    }
    if (elExpertTaskStatus) {
      elExpertTaskStatus.textContent = resolvedWorkflow ? '对话中' : '协作中'
    }
    syncHeadActionButton()
    syncDialogueStatusBar()
    updateWorkbenchViewState({
      surface: 'tasks',
      taskRoom: true,
      runMode: resolvedWorkflow ? 'workflow-chat' : 'expert-chat',
      phase: 'active',
    })
    onViewChange(true, {
      kind: resolvedWorkflow ? 'workflow-chat' : 'expert-chat',
      id: task.id,
      name: task.title,
      intent: task.goal,
      expertId: task.expertId,
      expertName: task.expertName,
      workflowId: task.workflowId || resolvedWorkflow?.id || '',
      sessionId: session.id,
      knowledgeRefs: normalizedKnowledgeRefs(session.knowledgeRefs || task.knowledgeRefs),
    }, {
      layout: 'task-room',
      viewState: { ...viewState },
    })
    // 任务间就绪后再刷左侧，避免属性仍堆在对话主栏（创建 Session 时右侧尚未打开）
    window.WorkspaceAgent?.renderChat?.()
  }

  function updateExpertTaskRoom(session = {}) {
    if (!expertTaskRoom || !session?.id || session.id !== expertTaskRoom.session?.id) return false
    expertTaskRoom.session = { ...expertTaskRoom.session, ...session }
    const knowledgeRefs = normalizedKnowledgeRefs(session.knowledgeRefs)
    expertTaskRoom.task = { ...expertTaskRoom.task, knowledgeRefs }
    const index = taskHomeTasks.findIndex(item => item.id === expertTaskRoom.task.id)
    if (index >= 0) taskHomeTasks[index] = { ...taskHomeTasks[index], knowledgeRefs }
    renderExpertTaskRoom()
    return true
  }

  function closeExpertTaskRoom() {
    if (!expertTaskRoom) return
    const returnState = {
      ...(taskRoomReturnState || {}),
      surface: resolveReturnSurface(
        taskRoomReturnState?.surface || (expertTaskRoom.workflow ? 'shelf' : 'taskhome')
      ),
    }
    expertTaskRoom = null
    syncExpertTaskRoomVisibility()
    syncHeadActionButton()
    syncDialogueStatusBar()
    // 先退出 task-room 窄栏，再 restore→renderShelf，避免一行容量按侧栏宽度算成 1
    updateWorkbenchViewState({
      surface: returnState.surface === 'shelf' ? 'home' : 'tasks',
      taskRoom: false,
      runMode: 'local',
      phase: 'idle',
    })
    onViewChange(false, {}, { layout: 'overview', viewState: { ...viewState } })
    restoreTaskRoomReturnState(returnState)
  }

  async function openTaskFromRecent(id) {
    const task = taskHomeTasks.find(item => item.id === id)
    if (!task) return
    const expert = availableExperts().find(item => item.id === task.expertId) || {}
    const workflow = task.workflowId ? resolveShelfWorkflow(task.workflowId) : null
    if (task.execRef?.kind === 'session' && task.execRef.id && typeof onExpertTaskResume === 'function') {
      const result = await onExpertTaskResume({ task, sessionId: task.execRef.id, expert })
      if (result?.ok && result.session) {
        openExpertTaskRoom(task, result.session, expert, workflow)
        return
      }
      toastFn(result?.error || '原对话不可用，可创建新的专家对话', 'error')
    }
    if (['run', 'daemon'].includes(task.execRef?.kind) && task.execRef.id) {
      await openExistingLaunchRun(task.execRef.id, {
        goal: task.goal,
        resourceType: 'agent',
        resourceId: task.expertId,
      })
      return
    }
    openTaskComposer({ expertId: task.expertId, goal: task.goal, knowledgeRefs: task.knowledgeRefs })
  }

  function currentNode() {
    return run.graph && run.graph.byId ? run.graph.byId.get(run.currentId) : null
  }

  function addLog(title, text, dispatchId = '') {
    run.logs.push({ title, text: String(text || ''), dispatchId })
    if (run.logs.length > 40) run.logs.shift()
    renderRunLog()
  }

  function updateDispatchLog(dispatchId, text) {
    const entry = run.logs.find(item => item.dispatchId === dispatchId)
    if (!entry) return
    entry.text = String(text || '')
    renderRunLog()
  }

  function syncDaemonRunnerDisclosure() {
    const isDaemon = run.mode === 'daemon'
    const logToggle = document.getElementById('wbRunnerLogToggle')
    const agentsToggle = document.getElementById('wbRunAgentsToggle')
    const logSection = elRunnerLog && elRunnerLog.closest ? elRunnerLog.closest('.wb-runner-log-section') : null
    if (logToggle) {
      logToggle.hidden = !isDaemon
      logToggle.textContent = daemonRunnerLogExpanded ? '收起' : '展开'
      logToggle.setAttribute('aria-expanded', daemonRunnerLogExpanded ? 'true' : 'false')
    }
    if (logSection) logSection.classList.toggle('is-collapsed', isDaemon && !daemonRunnerLogExpanded)
    if (elRunnerLog) elRunnerLog.hidden = false
    if (agentsToggle) {
      agentsToggle.hidden = !isDaemon
      agentsToggle.textContent = daemonRunnerAgentsExpanded ? '收起' : '展开'
      agentsToggle.setAttribute('aria-expanded', daemonRunnerAgentsExpanded ? 'true' : 'false')
    }
    if (elRunAgents) {
      const agentsSection = elRunAgents.closest ? elRunAgents.closest('.wb-run-agents-section') : null
      if (agentsSection) agentsSection.classList.toggle('is-collapsed', isDaemon && !daemonRunnerAgentsExpanded)
      elRunAgents.hidden = false
    }
  }

  function renderRunLog() {
    if (!elRunnerLog) return
    syncDaemonRunnerDisclosure()
    if (run.mode === 'daemon' && !daemonRunnerLogExpanded) {
      elRunnerLog.innerHTML = '<div class="wb-run-empty">过程日志已折叠。需要排障时再展开。</div>'
      return
    }
    if (!run.logs.length) {
      elRunnerLog.innerHTML = '<div class="wb-run-empty">运行日志会显示在这里</div>'
      return
    }
    elRunnerLog.innerHTML = run.logs.map(item => `
      <div class="wb-run-log-item">
        <div class="wb-run-log-title">${esc(item.title)}</div>
        <div class="wb-run-log-text">${esc(item.text || '处理中…')}</div>
      </div>
    `).join('')
    elRunnerLog.scrollTop = elRunnerLog.scrollHeight
  }

  function graphNodes() {
    if (run.projection && Array.isArray(run.projection.graphNodes) && run.projection.graphNodes.length) {
      return run.projection.graphNodes
    }
    if (run.graph && Array.isArray(run.graph.order) && run.graph.byId) {
      return run.graph.order.map(id => {
        const node = run.graph.byId.get(id)
        return {
          id,
          label: model()?.nodeTitle(node, agentsById()) || id,
          meta: model()?.nodeTypeLabel(node?.type) || '步骤',
        }
      })
    }
    const status = run.task && run.task.status || {}
    const source = Array.isArray(status.nodes)
      ? status.nodes
      : (Array.isArray(status.steps) ? status.steps : [])
    if (source.length) {
      return source.slice(0, 24).map((item, index) => ({
        id: String(item && (item.id || item.node || item.name) || `step-${index + 1}`),
        label: String(item && (item.title || item.name || item.node || item.id) || item),
        meta: String(item && (item.type || item.role || item.status) || '步骤'),
        status: String(item && item.status || ''),
      }))
    }
    if (run.mode === 'daemon') {
      const reason = (run.projection && run.projection.degradedReason)
        || '无法确认执行步骤。请确认已配置管线服务安装目录，且其中包含对应工作流定义。'
      return [{
        id: 'degraded-info',
        label: '流程详情暂不可用',
        meta: reason,
        status: 'pending',
        degraded: true,
        degradedPlaceholder: true,
      }]
    }
    return []
  }

  function progressSummary(nodes) {
    const list = Array.isArray(nodes) ? nodes : []
    const degraded = !!(run.projection && run.projection.degraded)
      || list.some(node => node && (node.degradedPlaceholder || node.degraded))
    const countable = list.filter(node => !(node && (node.degradedPlaceholder || (node.degraded && node.id === 'degraded-info'))))
    if (degraded && !countable.length) return '无法确认进度'
    if (!countable.length) return runSucceeded() ? '已完成' : '执行中'
    const statuses = countable.map((node, index) => nodeVisualStatus(node, index, countable))
    const done = statuses.filter(status => status === 'done').length
    if (statuses.includes('error')) return `需要处理 · 已完成 ${done}/${countable.length} 步`
    if (runSucceeded()) return `已完成 ${countable.length}/${countable.length} 步 · 100%`
    return `已完成 ${done}/${countable.length} 步 · ${Math.round((done / countable.length) * 100)}%`
  }

  function nodeVisualStatus(node, index, nodes) {
    if (node.status) {
      const status = String(node.status).toLowerCase()
      if (['done', 'completed', 'finished', 'success'].includes(status)) return 'done'
      if (['running', 'active', 'current', 'waiting'].includes(status)) return 'active'
      if (['failed', 'error', 'rejected'].includes(status)) return 'error'
    }
    if (runSucceeded()) return 'done'
    const current = workbenchTaskContext().currentNode
    const currentIndex = nodes.findIndex(item => item.id === current)
    if (currentIndex >= 0) {
      if (index < currentIndex) return 'done'
      if (index === currentIndex) return 'active'
      return 'pending'
    }
    return index === 0 ? 'active' : 'pending'
  }

  function toggleRunSection(childEl, visible) {
    const section = childEl && childEl.closest ? childEl.closest('.wb-run-section') : null
    if (section) section.hidden = !visible
  }

  function runSucceeded() {
    if (run.mode === 'daemon') {
      const waiting = daemonWaiting()
      if (waiting.gate || waiting.clarification) return false
      if (run.hitlPending) return false
      return run.terminalKind === 'success'
    }
    return run.status === 'done'
  }

  /** Daemon ingest/ 是启动输入，不是可打开产物。 */
  function isDaemonInputArtifactPath(value) {
    const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
    return normalized === 'ingest' || normalized.startsWith('ingest/')
  }

  async function openDaemonArtifactPath(artifactPath) {
    if (!window.api?.workbenchDaemonArtifactOpen) {
      return { ok: false, reason: 'unavailable', error: '该产物尚未生成或未同步' }
    }
    return window.api.workbenchDaemonArtifactOpen({
      path: artifactPath,
      slug: run.slug || '',
    })
  }

  function normalizeRunArtifact(item, index = 0) {
    const source = item && typeof item === 'object' ? item : {}
    const raw = typeof item === 'string' ? item.trim() : ''
    const url = String(source.downloadUrl || source.download_url || source.previewUrl || source.preview_url
      || (/^https?:\/\//i.test(raw) ? raw : '')).trim()
    const path = String(source.path || source.full_path || source.fullPath
      || (raw && !url ? raw : '')).trim()
    const id = String(source.id || source.artifactId || source.ref || path || url || `artifact-${index + 1}`).trim()
    const label = String(source.name || source.title || source.label || path || url || id).trim()
    const content = String(source.content || source.body || source.text || '').trim()
    return {
      id,
      kind: String(source.kind || (url ? 'url' : 'file')).trim(),
      title: label,
      path,
      url,
      content,
      hash: String(source.hash || source.contentHash || '').trim(),
      local: source.local === true || Boolean(path),
      inputPath: Boolean(path),
    }
  }

  async function reuseRunArtifact(index) {
    const artifact = normalizeRunArtifact(run.artifacts[index], index)
    await updateLaunchIntent({
      domain: activeLaunchDomain(),
      resourceType: 'artifact',
      resourceId: artifact.id,
      goal: '',
      inputRefs: [artifact],
      backend: '',
      runId: '',
      rootRunId: '',
      slug: '',
      executionSource: '',
      returnState: {
        surface: 'tasks',
        sourceRunId: run.slug || run.rootRunId || run.currentId || '',
      },
      step: 'inputs',
      status: 'draft',
    }, { saveOptions: { allowRelaunch: true } })
    openLaunchDrawer({ step: 'inputs', status: 'draft' })
  }

  function runnerDegradedDetailActive() {
    const context = workbenchTaskContext()
    return !!context.degraded && !runSucceeded()
  }

  function renderTaskContext() {
    if (!run.workflow) return
    const context = workbenchTaskContext()
    const nodes = graphNodes()
    const isDone = runSucceeded()
    const degraded = !!context.degraded
    const auth = daemonAuth()
    const permissionBlocked = isEngineeringMode() && auth.authEnabled && auth.state === 'required'
    let tone = degraded
      ? (isDone ? 'done' : 'muted')
      : (context.statusTone || (isDone ? 'done' : 'running'))
    if (['cancelled', 'canceled'].includes(String(run.status || run.terminalKind || '').toLowerCase())) tone = 'cancelled'
    if (permissionBlocked) tone = 'waiting'
    if (elRunStatus) {
      // 只呈现「一句结论 + 一行用户向说明」；factualBrief 仅用于 LLM 上下文注入，不入 DOM。
      const headline = degraded
        ? (isDone ? '任务已结束' : '流程详情暂不可用')
        : (context.statusHeadline || (isDone ? '任务已完成' : '正在执行'))
      const detail = degraded
        ? (isDone
          ? '任务已跑完，但流程明细未能加载。如需回看每一步，请在设置的内容源里确认对应来源后刷新。'
          : (context.degradedReason || '当前激活内容源可能与该工作流不匹配，请在设置的内容源里确认后刷新。'))
        : (context.waitingDetail || '')
      elRunStatus.className = `wb-run-status tone-${tone}${permissionBlocked ? ' is-permission' : ''}${degraded && !isDone ? ' is-degraded' : ''}`
        elRunStatus.innerHTML = `<div class="wb-status-headline"><span class="wb-status-dot" aria-hidden="true"></span><span class="wb-status-headline-text">${esc(headline)}</span></div>`
        + (detail ? `<div class="wb-status-detail">${esc(detail)}</div>` : '')
    }
    if (elRunProgress) {
      // 降级态不再显示「无法确认进度」等否定文案，只如实标注是否已结束。
      const progressText = degraded
        ? (isDone ? '已结束' : '进行中')
        : progressSummary(nodes)
      elRunProgress.textContent = progressText
      elRunProgress.className = `wb-run-progress tone-${tone}`
    }
    if (elRunNextAction) {
      const guidance = context.nextAction || '关注流程进度，按下方按钮继续。'
      // 降级态把唯一的 CTA 收敛到「你现在要做什么」这一处，避免多处重复按钮。
      const ctaHtml = degraded
        ? '<div class="wb-run-degraded-exit"><button type="button" class="wb-run-btn primary" data-run-action="open-sources">打开内容源设置</button></div>'
        : ''
      elRunNextAction.innerHTML = `<span class="wb-run-next-text">${esc(guidance)}</span>${ctaHtml}`
      elRunNextAction.classList.toggle('is-done', context.waitingKind === 'none' && isDone && !degraded)
    }
    if (elRunGoal) elRunGoal.textContent = context.intent || context.name || '围绕当前工作流完成交付'

    renderTaskTracePanel()

    const hasAgents = context.agents.length > 0
    const hasArtifacts = run.artifacts.length > 0

    if (elRunAgents) {
      const owner = context.currentOwner || ''
      const agentsCollapsed = run.mode === 'daemon' && !daemonRunnerAgentsExpanded
      elRunAgents.innerHTML = agentsCollapsed
        ? `<span class="wb-run-muted">${hasAgents ? `已折叠 ${context.agents.length} 位参与专家` : '参与专家已折叠'}</span>`
        : (hasAgents
          ? context.agents.map(name => {
            const active = owner && name === owner
            return `<span class="wb-run-agent${active ? ' is-active' : ''}">${esc(name)}${active ? ' · 当前' : ''}</span>`
          }).join('')
          : '<span class="wb-run-muted">等待流程加载参与角色…</span>')
      // 降级且无角色时收起本节，说明已在状态卡里给出，无需重复占位。
      toggleRunSection(elRunAgents, !(degraded && !hasAgents))
      syncDaemonRunnerDisclosure()
    }
    if (elRunGraph) {
      if (degraded) {
        // 降级态不再渲染「流程详情暂不可用」占位节点，整节收起。
        elRunGraph.innerHTML = ''
        toggleRunSection(elRunGraph, false)
      } else {
        elRunGraph.innerHTML = nodes.map((node, index) => {
          const status = nodeVisualStatus(node, index, nodes)
          return `<div class="wb-graph-node ${status}${node.degraded || node.degradedPlaceholder ? ' degraded' : ''}">
            <span class="wb-graph-marker" aria-hidden="true"></span>
            <span class="wb-graph-copy">
              <strong>${esc(node.label)}</strong>
              <small>${esc(node.meta)}</small>
              ${node.handoff ? `<small class="wb-graph-handoff">交接 · ${esc(node.handoff)}</small>` : ''}
            </span>
          </div>`
        }).join('')
        toggleRunSection(elRunGraph, true)
      }
    }
    if (elRunArtifacts) {
      elRunArtifacts.innerHTML = hasArtifacts
        ? run.artifacts.slice(0, 8).map((item, index) => {
          const artifact = normalizeRunArtifact(item, index)
          const openAction = artifact.url
            ? `<button type="button" class="wb-run-artifact" data-artifact-url="${escAttr(artifact.url)}" title="打开远程产物：${escAttr(artifact.title)}">${esc(artifact.title)}</button>`
            : (artifact.path
              ? `<button type="button" class="wb-run-artifact" data-artifact-path="${escAttr(artifact.path)}" title="打开本地产物：${escAttr(artifact.title)}">${esc(artifact.title)}</button>`
              : `<span class="wb-run-artifact-label">${esc(artifact.title)}</span>`)
          const reuseAction = runSucceeded()
            ? `<button type="button" class="wb-run-artifact-reuse" data-artifact-reuse="${index}">用于新运行</button>`
            : ''
          return `<span class="wb-run-artifact-row">${openAction}${reuseAction}</span>`
        }).join('')
        : `<span class="wb-run-muted">${run.terminalKind === 'failure'
          ? '任务失败，暂无可展示的产物'
          : (run.terminalKind === 'cancelled' ? '任务已取消，暂无可展示的产物' : '任务产物将在完成后显示')}</span>`
      // 降级且无产物时收起，避免和状态卡重复「暂不可用」语义。
      toggleRunSection(elRunArtifacts, !(degraded && !hasArtifacts))
    }
    markLastVisibleSection()
  }

  function markLastVisibleSection() {
    const container = elRunStatus && elRunStatus.closest ? elRunStatus.closest('.wb-task-context') : null
    if (!container) return
    const sections = Array.from(container.querySelectorAll('.wb-run-section'))
    let last = null
    sections.forEach(section => {
      section.classList.remove('is-last-visible')
      if (!section.hidden) last = section
    })
    if (last) last.classList.add('is-last-visible')
  }

  function actionButton(action, label, kind = '', opts = {}) {
    const primaryBlocked = runnerDegradedDetailActive() && kind === 'primary'
    const cls = primaryBlocked ? '' : kind
    const icon = opts.icon
      ? `<span class="ico" data-icon="${escAttr(opts.icon)}" aria-hidden="true"></span>`
      : ''
    const title = opts.title || label
    return `<button type="button" class="wb-run-btn${cls ? ` ${cls}` : ''}" data-run-action="${escAttr(action)}" title="${escAttr(title)}" aria-label="${escAttr(title)}">${icon}<span>${esc(label)}</span></button>`
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function stopDaemonRuntimeWatchers() {
    stopPolling()
    stopDaemonLogStream()
  }

  function scheduleAgentGraphPoll() {
    stopPolling()
    if (run.mode !== 'agent-graph' || !run.rootRunId || ['done', 'failed', 'cancelled'].includes(run.status)) return
    pollTimer = setTimeout(() => refreshAgentGraphRun(false), 2000)
  }

  function schedulePoll() {
    stopPolling()
    if (run.mode !== 'daemon' || !run.slug || run.status === 'done') return
    pollTimer = setTimeout(() => refreshDaemonTask(false), 2000)
  }

  function flattenAgentRunTree(tree) {
    const out = []
    const seen = new Set()
    const visit = value => {
      if (!value || typeof value !== 'object') return
      if (value.runId && !seen.has(value.runId)) {
        seen.add(value.runId)
        out.push(value)
      }
      if (value.root && value.root !== value) visit(value.root)
      for (const child of Object.values(value.nodes || {})) visit(child)
      for (const child of (Array.isArray(value.children) ? value.children : [])) visit(child)
      for (const child of (Array.isArray(value.runs) ? value.runs : [])) visit(child)
    }
    visit(tree)
    return out
  }

  function agentGraphStatusLabel(status) {
    const value = String(status || '').toLowerCase()
    const lifecycle = lifecycleApi()
    if (lifecycle) {
      if (value === 'pending') return '准备中'
      const isGateWait = ['waiting', 'blocked', 'gate'].includes(value)
      const kind = isGateWait
        ? 'waiting'
        : lifecycle.classifyTaskState(value, isGateWait ? { gate: { node: 'gate' } } : {})
      const hitlKind = isGateWait ? 'gate' : 'none'
      return lifecycle.compactLabelFor(kind, hitlKind, value)
    }
    if (['completed', 'done', 'success'].includes(value)) return '已完成'
    if (['failed', 'error'].includes(value)) return '执行失败'
    if (['cancelled', 'canceled'].includes(value)) return '已取消'
    if (['waiting', 'blocked', 'gate'].includes(value)) return '等待确认'
    if (['running', 'started'].includes(value)) return '执行中'
    return '准备中'
  }

  async function refreshAgentGraphRun(showToast = false) {
    if (run.mode !== 'agent-graph' || !run.rootRunId || !window.api?.workbenchAgentRunTree) return
    let res
    try {
      res = await window.api.workbenchAgentRunTree(run.rootRunId)
    } catch (error) {
      res = { ok: false, error: error.message || '无法读取本地 Agent Run' }
    }
    if (!res || !res.ok) {
      run.error = res?.error || res?.message || '无法读取本地 Agent Run'
      addLogOnce('运行状态同步失败', run.error)
      renderRunner()
      scheduleAgentGraphPoll()
      return
    }
    run.agentTree = res.tree || res
    run.pendingGates = Array.isArray(res.pendingGates) ? res.pendingGates : []
    const root = res.tree?.root || res.root || res.run || res.tree || {}
    const runs = flattenAgentRunTree(res.tree || res)
    const terminal = String(root.status || root.terminal || '').toLowerCase()
    run.status = terminal || (run.pendingGates.length ? 'waiting' : 'running')
    if (['completed', 'done', 'success'].includes(run.status)) run.status = 'done'
    if (['failed', 'error'].includes(run.status)) run.status = 'failed'
    if (['cancelled', 'canceled'].includes(run.status)) run.status = 'cancelled'
    const events = Array.isArray(res.events) ? res.events : []
    run.logs = events
      .filter(event => event && (event.type || event.error))
      .slice(-40)
      .map(event => ({
        title: event.type || '运行事件',
        text: event.error || event.summary || event.nodeId || '',
      }))
    run.agentRuns = runs
    run.agentArtifacts = Array.isArray(res.artifacts) ? res.artifacts : []
    run.resultSummary = String(
      root.summary
      || root.meta?.summary
      || [...runs].reverse().find(item => String(item?.summary || item?.meta?.summary || '').trim())?.summary
      || '',
    ).trim()
    const artifactRefs = runs.flatMap(item =>
      Array.isArray(item.artifactRefs) ? item.artifactRefs : [],
    )
    saveWorkContext({
      goal: run.intent,
      rootRunId: run.rootRunId,
      executionSource: 'local-team',
      artifactRefs,
    })
    if (run.status === 'done') {
      saveTaskDraft({ phase: 'completed', executionSource: 'agent-graph', rootRunId: run.rootRunId, goal: run.intent })
    } else if (run.status === 'failed') {
      saveTaskDraft({ phase: 'failed', executionSource: 'agent-graph', rootRunId: run.rootRunId, goal: run.intent })
    } else if (run.status === 'cancelled') {
      saveTaskDraft({ phase: 'cancelled', executionSource: 'agent-graph', rootRunId: run.rootRunId, goal: run.intent })
    }
    if (showToast) toastFn('本地 Agent Graph 状态已刷新', 'success')
    renderRunner()
    scheduleAgentGraphPoll()
  }

  function renderAgentGraphRunner() {
    const nodes = Array.isArray(run.composition?.nodes) ? run.composition.nodes : []
    const runs = Array.isArray(run.agentRuns) ? run.agentRuns : []
    const runByNode = new Map(runs.map(item => [item.meta?.workflowNodeId || item.workflowNodeId, item]))
    const artifactRefs = runs.flatMap(item =>
      Array.isArray(item.artifactRefs) ? item.artifactRefs : [],
    )
    const artifactsById = new Map()
    artifactRefs.forEach((item, index) => {
      const artifact = normalizeRunArtifact(item, index)
      artifactsById.set(artifact.id, artifact)
    })
    ;(Array.isArray(run.agentArtifacts) ? run.agentArtifacts : []).forEach((item, index) => {
      const artifact = normalizeRunArtifact(item, artifactRefs.length + index)
      artifactsById.set(artifact.id, artifact)
    })
    const currentGate = run.pendingGates[0] || null
    const activeRun = runs.find(item => ['running', 'started', 'waiting', 'blocked'].includes(String(item.status || '').toLowerCase())) || null
    run.projection = {
      intentTitle: run.intent || '专家协作图',
      workflowName: run.workflow?.name || '专家协作图',
      currentNodeLabel: currentGate?.title || currentGate?.nodeId || activeRun?.meta?.workflowNodeId || '',
      currentOwner: activeRun?.meta?.role || activeRun?.meta?.agentPackageId || '',
      graphNodes: nodes.map(node => {
        const child = runByNode.get(node.id)
        const active = run.pendingGates.some(gate => gate.nodeId === node.id)
        return {
          id: String(node.id || ''),
          label: String(node.role || node.agentPackageId || node.id || '节点'),
          meta: agentGraphStatusLabel(child?.status || (active ? 'waiting' : 'pending')),
          status: active ? 'waiting' : String(child?.status || ''),
        }
      }),
      agents: nodes.map(node => String(node.role || node.agentPackageId || node.id || '')).filter(Boolean),
    }
    run.artifacts = [...artifactsById.values()]
    if (elRunnerTitle) elRunnerTitle.textContent = run.intent || '专家协作图'
    if (elRunnerMeta) elRunnerMeta.textContent = runNodeProgressMeta()
    syncRunOutcomePill()
    elRunner?.classList.toggle('busy', ['running', 'waiting'].includes(run.status))
    let actions = ''
    let gatePrimaryUsed = false
    for (const gate of run.pendingGates) {
      const primary = !gatePrimaryUsed ? 'primary' : ''
      if (!gatePrimaryUsed) gatePrimaryUsed = true
      actions += actionButton(`agent-approve:${gate.nodeId}`, '通过', primary)
      actions += actionButton(`agent-revise:${gate.nodeId}`, '修订')
      actions += actionButton(`agent-reject:${gate.nodeId}`, '打回')
    }
    if (['running', 'waiting'].includes(run.status)) {
      actions += actionButton('agent-cancel', '停止')
    }
    if (run.status === 'failed' || run.status === 'cancelled') {
      actions += actionButton('agent-retry', '重新发起', 'primary')
    }
    actions += actionButton('agent-refresh', '刷新')
    actions += actionButton('back', '返回工作台')
    if (elRunnerActions) {
      elRunnerActions.innerHTML = actions
      elRunnerActions.hidden = !actions
    }
    renderTaskContext()
    renderRunLog()
    syncTaskView()
  }

  function daemonWaiting() {
    const task = run.task || {}
    const gates = Array.isArray(task.pending_gates) ? task.pending_gates : []
    const clarifications = Array.isArray(task.pending_clarifications) ? task.pending_clarifications : []
    let clarification = clarifications[0] || null
    if (clarification) {
      const node = briefApi()?.clarificationNodeId
        ? briefApi().clarificationNodeId(clarification)
        : String(clarification.node || clarification.node_id || clarification.id || '').trim()
      const cached = node && run.clarificationPromptCache && run.clarificationPromptCache[node]
      const api = briefApi()
      const hasExplicit = !!api?.clarificationQuestionFromFields?.(clarification)
      const cachedUsable = !!(cached && api?.clarificationQuestionFromFields?.({ question: cached, node }))
      if (cachedUsable && !hasExplicit) {
        clarification = { ...clarification, question: cached, promptText: cached }
      } else if (cached && !cachedUsable && run.clarificationPromptCache) {
        delete run.clarificationPromptCache[node]
      }
    }
    return { gate: gates[0] || null, clarification }
  }

  async function enrichDaemonClarificationPrompt(clarification) {
    if (!clarification || !run.slug || !window.api?.workbenchDaemonWorkspaceBlob) return clarification
    const api = briefApi()
    if (!api?.clarificationQuestionFromFields) return clarification
    if (api.clarificationQuestionFromFields(clarification)) return clarification
    const node = api.clarificationNodeId(clarification)
    if (!node) return clarification
    run.clarificationPromptCache = run.clarificationPromptCache || {}
    if (run.clarificationPromptCache[node]) {
      const cached = run.clarificationPromptCache[node]
      if (api.clarificationQuestionFromFields({ question: cached, node })) {
        return { ...clarification, question: cached, promptText: cached }
      }
      delete run.clarificationPromptCache[node]
    }
    const paths = api.clarificationFileCandidates
      ? api.clarificationFileCandidates(node, run.slug)
      : []
    for (const relPath of paths) {
      let blob
      try {
        blob = await window.api.workbenchDaemonWorkspaceBlob(run.slug, relPath)
      } catch {
        blob = null
      }
      if (!blob || !blob.ok || blob.is_binary) continue
      const prompt = api.extractPromptFromClarificationFile
        ? api.extractPromptFromClarificationFile(blob.content || '', node)
        : ''
      if (!prompt) continue
      const questions = api.extractQuestionsFromDaemonText
        ? api.extractQuestionsFromDaemonText(blob.content || '', node)
        : []
      run.clarificationPromptCache[node] = prompt
      return {
        ...clarification,
        question: prompt,
        promptText: prompt,
        promptPath: relPath,
        ...(questions.length ? { questions } : {}),
      }
    }
    const logHint = api.extractClarificationHintFromLogs(
      `${run.processLogsText || ''}\n${run.progressText || ''}`,
      node,
    )
    if (logHint) {
      run.clarificationPromptCache[node] = logHint
      return { ...clarification, question: logHint, promptText: logHint }
    }
    return clarification
  }

  function renderDaemonRunner() {
    if (elRunnerTitle) {
      elRunnerTitle.textContent = daemonRunIdentityTitle()
      elRunnerTitle.title = String(run.intent || run.purposeTitle || '').trim()
    }
    if (elRunnerMeta) {
      const meta = runNodeProgressMeta()
      elRunnerMeta.textContent = run.contextSummary
        ? `${meta} · ${run.contextSummary}`
        : meta
    }
    syncRunOutcomePill()
    const reviewRefresh = document.getElementById('wbDaemonReviewRefresh')
    if (reviewRefresh) {
      reviewRefresh.hidden = !run.slug
      if (window.StickyIcons) window.StickyIcons.mount(reviewRefresh)
    }
    let actions = ''
    const lifecycle = lifecycleApi()
    const waitingNow = daemonWaiting()
    const projected = lifecycle
      ? lifecycle.projectRunLifecycle({
          backend: 'daemon',
          task: run.task || null,
          rawStatus: run.status,
          terminalKind: run.terminalKind,
          gate: waitingNow.gate,
          clarification: waitingNow.clarification,
          terminal: !!(run.task && run.task.terminal),
        })
      : null
    if (projected && projected.cancellable) {
      actions += actionButton('daemon-cancel', '停止')
    }
    actions += actionButton('refresh-task', '刷新')
    // Gate / 澄清人机交互已迁入左栏对话，底栏不再放「回答」或审批按钮
    if (elRunnerActions) {
      elRunnerActions.innerHTML = actions
      elRunnerActions.hidden = !actions
    }
    renderDaemonReview()
    syncDaemonProcessFeed()
    // 遗留 task-context 仅作非 daemon；daemon 右侧走审阅面
    if (run.mode !== 'daemon') {
      renderTaskContext()
      renderRunLog()
    }
    syncTaskView()
  }

  function renderRunner() {
    if (!elRunner) return
    elRunner.hidden = !run.workflow
    if (!run.workflow) {
      if (window.WorkspaceAgent?.setDaemonProcessFeed) window.WorkspaceAgent.setDaemonProcessFeed(null)
      if (elDaemonReview) elDaemonReview.hidden = true
      if (elTaskContextLegacy) elTaskContextLegacy.hidden = false
      elRunner.classList.remove('is-daemon-review')
      syncTaskView()
      return
    }
    if (run.mode === 'daemon') {
      renderDaemonRunner()
      return
    }
    if (elDaemonReview) elDaemonReview.hidden = true
    if (elTaskContextLegacy) elTaskContextLegacy.hidden = false
    elRunner.classList.remove('is-daemon-review')
    const logSection = elRunnerLog && elRunnerLog.closest ? elRunnerLog.closest('.wb-runner-log-section') : null
    if (logSection) logSection.hidden = false
    if (window.WorkspaceAgent?.setDaemonProcessFeed) window.WorkspaceAgent.setDaemonProcessFeed(null)
    if (run.mode === 'agent-graph') {
      renderAgentGraphRunner()
      return
    }
    if (!model()) return
    const node = currentNode()
    const busy = run.status === 'running'
    elRunner.classList.toggle('busy', busy)
    if (elRunnerTitle) elRunnerTitle.textContent = run.workflow.name || run.workflow.id
    if (elRunnerMeta) elRunnerMeta.textContent = runNodeProgressMeta()
    syncRunOutcomePill()

    let actions = ''
    if (node) actions += actionButton('reset', '重置')
    if (!busy && node) {
      if (node.type === 'agent') actions += actionButton('run', '运行此节点', 'primary')
      else if (node.type === 'gate') {
        actions += actionButton('approve', '通过', 'primary')
        actions += actionButton('revise', '修订')
        actions += actionButton('reject', '打回')
      } else if (node.type === 'script') {
        actions += actionButton('complete', '确认已人工完成', 'primary')
      } else if (node.type === 'loop') {
        actions += actionButton('success', '标记成功', 'primary')
        actions += actionButton('exhausted', '标记耗尽')
      } else if (node.type === 'parallel') {
        actions += actionButton('run-parallel', '运行并行专家', 'primary')
      } else if (node.type === 'terminal') {
        actions += actionButton('finish', '完成工作流', 'primary')
      } else {
        actions += actionButton('complete', '继续', 'primary')
      }
    }
    actions += actionButton('back', '返回模板')
    if (elRunnerActions) {
      elRunnerActions.innerHTML = actions
      elRunnerActions.hidden = !actions
    }
    renderTaskContext()
    renderRunLog()
    syncTaskView()
  }

  function workflowAgents(workflow) {
    const ids = []
    const seen = new Set()
    for (const node of (workflow && workflow.nodes) || []) {
      if (!node.agent || seen.has(node.agent)) continue
      seen.add(node.agent)
      ids.push(node.agent)
    }
    return ids.map(id => agentById(id) || { id, title: id, persona: {} })
  }

  async function loadWorkflowDetail(item) {
    const merged = mergeWorkflowItem(item)
    if (!merged) return { ok: false, error: '未找到工作流' }
    if (!merged.path) {
      return { ok: true, item: merged, workflow: null, graph: null, noPath: true }
    }
    if (!window.api || !window.api.workbenchWorkflow) {
      return { ok: false, error: '工作流 API 不可用' }
    }
    if (!model()) {
      return { ok: false, error: '工作流模型未加载，请刷新应用' }
    }
    let res
    try {
      res = await window.api.workbenchWorkflow(merged)
    } catch (e) {
      res = { ok: false, error: e.message || String(e) }
    }
    if (!res || !res.ok || !res.workflow) {
      return { ok: false, error: (res && res.error) || '工作流加载失败', item: merged }
    }
    try {
      const workflow = res.workflow
      const graph = model().buildWorkflowGraph(workflow)
      return { ok: true, item: merged, workflow, graph }
    } catch (e) {
      return { ok: false, error: e.message || '工作流解析失败', item: merged }
    }
  }

  function renderAgentGraphLaunchBody(plan) {
    const composition = plan && plan.composition
    const nodes = Array.isArray(composition && composition.nodes) ? composition.nodes : []
    const members = Array.isArray(composition && composition.members) ? composition.members : []
    const memberById = Object.fromEntries(members.map(member => [member.id, member]))
    const nodeRows = nodes.map(node => {
      const member = memberById[node.id]
      const label = node.type === 'agent'
        ? (member?.role || node.agentPackageId || node.id)
        : (node.type === 'gate' ? '人工审批' : (node.type === 'join' ? '并行汇总' : '完成'))
      const mark = node.type === 'agent'
        ? agentAvatarMark({
          id: member?.agentPackageId || node.agentPackageId || node.id,
          name: member?.role || label,
          role: member?.role,
          description: node.intent || node.description || member?.description,
          avatar: member?.avatar,
          skills: member?.skillRefs,
        }, 'wb-launch-agent-mark', 28)
        : ''
      return `<div class="wb-launch-extra-item${node.type === 'agent' ? ' has-agent-mark' : ''}">
        ${mark}
        <div class="wb-launch-extra-copy">
          <strong>${esc(label)}</strong>
          <span>${esc(node.intent || node.description || `${node.type} 节点`)}</span>
        </div>
      </div>`
    }).join('')
    const edges = (Array.isArray(composition && composition.edges) ? composition.edges : [])
      .map(edge => `${edge.from} → ${edge.to}`)
      .join(' · ')
    const issueText = Array.isArray(plan && plan.issues) && plan.issues.length
      ? `<div class="wb-modal-error">${plan.issues.map(item => esc(item.message || item.code)).join('<br>')}</div>`
      : ''
    const goalValue = String(composition?.goal || modal.initialIntent || '').trim()
    return `
      <div class="wb-studio-save-dialog">
        <div class="wb-launch-intro">
          <p class="wb-launch-kicker">本地 Agent Graph</p>
          <p class="wb-launch-lead">先确认协作角色和交接关系，确认后才会创建本地 Team Run。</p>
        </div>
        <div class="wb-launch-group wb-launch-primary">
          <div class="wb-launch-group-head">本次运行目标</div>
          <label class="wb-modal-field wb-launch-field-compact">
            <span class="wb-sr-only">本次运行目标</span>
            <textarea id="wbAgentGraphGoal" class="wb-modal-textarea" rows="3" maxlength="2000" placeholder="描述本次要完成的任务">${esc(goalValue)}</textarea>
          </label>
        </div>
        <div class="wb-launch-group">
          <div class="wb-launch-group-head">协作节点 · ${nodes.length}</div>
          <div class="wb-launch-extra wb-launch-extra-grid">${nodeRows || '<div class="wb-run-muted">暂无可执行专家</div>'}</div>
        </div>
        <div class="wb-launch-group wb-launch-group-flat">
          <div class="wb-launch-group-head">交接关系</div>
          <div class="wb-modal-desc wb-studio-save-edges">${esc(edges || '无')}</div>
        </div>
        ${issueText}
      </div>`
  }

  function renderModal() {
    if (!elModal) return
    const open = !!modal.item
    elModal.hidden = !open
    elModal.classList.toggle('is-agent-detail', open && modal.kind === 'agent')
    elModal.classList.toggle('is-workflow-detail', open && modal.kind === 'workflow-detail')
    elModal.classList.toggle('is-workflow-start', open && modal.kind === 'workflow-start')
    elModal.classList.toggle('is-studio-save', open && modal.kind === 'studio-save')
    elModal.classList.toggle('is-workflow-launch', open && !['agent', 'notice', 'clarify', 'workflow-detail', 'workflow-start', 'studio-save'].includes(modal.kind))
    elModal.classList.toggle('is-dag-expanded', open && !['agent', 'notice', 'clarify', 'workflow-detail', 'workflow-start', 'studio-save'].includes(modal.kind) && !!modal.dagExpanded)
    if (!open) return
    // 默认显示页脚取消；介绍层等个别 kind 可再隐藏
    if (btnModalCancel) btnModalCancel.hidden = false
    const item = modal.item
    const workflow = modal.workflow
    if (elModalTitle) {
      elModalTitle.textContent = workflow
        ? workflowDisplayNameOf(workflow)
        : (item.name || item.id || '详情')
    }
    if (modal.kind === 'workflow-detail') {
      const { runnable, blockers } = shelfReadiness(item)
      const description = item.description || item.summary || workflowOutcomeText(item)
      if (elModalTitle) elModalTitle.textContent = workflowDisplayNameOf(item)
      if (elModalBody) {
        elModalBody.innerHTML = `
          <div class="wb-flow-detail">
            <header class="wb-flow-detail-intro">
              <p class="wb-flow-detail-kicker">流程简介</p>
              <p class="wb-flow-detail-lead">${esc(description)}</p>
            </header>
            <div class="wb-flow-detail-io" role="group" aria-label="输入与产出">
              <section class="wb-flow-detail-block is-input">
                <div class="wb-flow-detail-label-row">
                  <span class="wb-flow-detail-index" aria-hidden="true">01</span>
                  <h3 class="wb-flow-detail-label">你需要提供</h3>
                </div>
                ${renderWorkflowIoListHtml(item.inputs, workflowInputText(item))}
              </section>
              <div class="wb-flow-detail-io-sep" aria-hidden="true">
                <span class="wb-flow-detail-io-sep-line"></span>
                <span class="wb-flow-detail-io-sep-mark">→</span>
                <span class="wb-flow-detail-io-sep-line"></span>
              </div>
              <section class="wb-flow-detail-block is-output">
                <div class="wb-flow-detail-label-row">
                  <span class="wb-flow-detail-index" aria-hidden="true">02</span>
                  <h3 class="wb-flow-detail-label">你会得到</h3>
                </div>
                ${renderWorkflowIoListHtml(item.outputs, workflowOutcomeText(item))}
              </section>
            </div>
            <section class="wb-flow-detail-block wb-flow-detail-dag" aria-label="协作步骤">
              ${renderShelfPackageDagHtml(item, { surface: 'detail' })}
            </section>
            <div class="wb-flow-detail-status ${runnable ? 'is-ready' : 'is-blocked'}" role="status">
              <span class="wb-flow-detail-status-dot" aria-hidden="true"></span>
              <span class="wb-flow-detail-status-text">${runnable
                ? '现在可以运行'
                : `暂不可用：缺少 ${esc(blockers.join('、') || '执行所需的专家或外部工具')}`}</span>
            </div>
          </div>`
      }
      if (elModalHint) {
        elModalHint.textContent = runnable
          ? `来源：${shelfProvenanceLabel(item.source)} · 了解步骤后可以开始`
          : '补齐缺失项后再开始'
      }
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = !runnable
        btnModalConfirm.textContent = runnable ? '开始运行' : '暂不可用'
      }
      // 顶栏已有关闭，介绍层页脚只保留主操作，避免重复
      if (btnModalCancel) btnModalCancel.hidden = true
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'workflow-start') {
      const { runnable, blockers } = shelfReadiness(item)
      const steps = Math.max(1, item.graph?.nodes?.filter(node => node.type === 'agent').length || item.agentRefs?.length || 1)
      const participants = workflowParticipantLabels(item)
      const description = item.description || item.summary || workflowOutcomeText(item)
      if (elModalTitle) elModalTitle.textContent = workflowDisplayNameOf(item)
      if (elModalBody) {
        elModalBody.innerHTML = `
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>能做什么</span></div>
            <div class="wb-modal-desc">${esc(description)}</div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>需要提供</span></div>
            <div class="wb-modal-desc">${esc(workflowInputText(item))}</div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>产出</span></div>
            <div class="wb-modal-desc">${esc(workflowOutcomeText(item))}</div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>步骤与专家</span></div>
            <div class="wb-modal-desc">${steps} 步 · ${esc(participants.join('、'))}</div>
          </div>
          ${!runnable ? `<div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>可运行性</span></div>
            <div class="wb-modal-desc">暂不可用：缺少 ${esc(blockers.join('、') || '执行所需的专家或外部工具')}</div>
          </div>` : ''}`
      }
      if (elModalHint) {
        elModalHint.textContent = runnable
          ? `来源：${shelfProvenanceLabel(item.source)} · 执行方式由系统决定`
          : '补齐缺失项后再开始'
      }
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = !runnable
        btnModalConfirm.textContent = runnable ? '开始运行' : '暂不可用'
      }
      if (btnModalCancel) btnModalCancel.textContent = '关闭'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'notice') {
      if (elModalTitle) elModalTitle.textContent = item.name || '提示'
      if (elModalBody) elModalBody.innerHTML = modal.noticeHtml || ''
      if (elModalHint) elModalHint.textContent = modal.noticeHint || ''
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = false
        btnModalConfirm.textContent = modal.noticeConfirm || '重新检测'
      }
      if (btnModalCancel) btnModalCancel.textContent = '关闭'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'clarify') {
      const question = String(modal.clarification?.question || '请补充任务所需信息').trim()
      if (elModalTitle) elModalTitle.textContent = '补充任务信息'
      if (elModalBody) {
        elModalBody.innerHTML = `
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>需要你确认</span></div>
            <div class="wb-modal-desc">${esc(question)}</div>
          </div>
          <div class="wb-modal-section">
            <label class="wb-modal-field"><span>你的回答</span><textarea id="wbClarifyAnswer" rows="5" maxlength="1600" placeholder="请补充当前任务需要的信息"></textarea></label>
          </div>`
      }
      if (elModalHint) elModalHint.textContent = modal.error || '提交后任务会继续执行'
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = false
        btnModalConfirm.textContent = '提交回答'
      }
      if (btnModalCancel) btnModalCancel.textContent = '稍后处理'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'studio-save') {
      if (elModalTitle) elModalTitle.textContent = studioWorkflowDisplayName()
      if (elModalBody) elModalBody.innerHTML = renderStudioSaveConfirmBody()
      if (elModalHint) elModalHint.textContent = modal.error || '确认后保存到「我的」工作流，不会启动运行'
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = !!modal.loading
        btnModalConfirm.textContent = '确认保存'
      }
      if (btnModalCancel) {
        btnModalCancel.hidden = false
        btnModalCancel.textContent = '返回修改'
      }
      elModal.classList.add('is-studio-save')
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'agent-graph') {
      if (elModalBody) {
        elModalBody.innerHTML = renderAgentGraphLaunchBody(modal.plan)
      }
      if (elModalHint) {
        elModalHint.textContent = modal.error || '本地 Agent Graph 将由已安装能力协作执行'
      }
      if (btnModalConfirm) {
        btnModalConfirm.hidden = false
        btnModalConfirm.disabled = modal.loading || !modal.plan?.ok
        btnModalConfirm.textContent = '确认并启动'
      }
      if (btnModalCancel) btnModalCancel.textContent = '返回修改'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (modal.kind === 'agent') {
      const agent = item
      const role = chineseRoleName(agent)
      const capabilities = agentCapabilities(agent)
      const stages = presenter() ? presenter().stageCount(agent) : 0
      if (elModalTitle) elModalTitle.textContent = role
      if (elModalBody) {
        elModalBody.innerHTML = `
          <div class="wb-agent-detail-hero">
            ${agentAvatarMark(agent, 'wb-agent-detail-avatar', 44)}
            <div>
              <div class="wb-agent-detail-name">${esc(role)}</div>
              <div class="wb-agent-detail-role">${esc(englishAgentName(agent))}</div>
            </div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>专家简介</span></div>
            <div class="wb-agent-detail-copy">${esc(agentSummary(agent, role))}</div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>擅长</span></div>
            <div class="wb-modal-chips">${capabilities.length
              ? capabilities.map(tag => `<span class="wb-modal-chip">${esc(tag)}</span>`).join('')
              : '<span class="wb-modal-muted">由工作流按需调度</span>'}</div>
          </div>
          <div class="wb-modal-section">
            <div class="wb-modal-section-head"><span>参与方式</span></div>
            <div class="wb-agent-detail-copy">${stages
              ? `工作流会在 ${stages} 个环节自动调度这位专家，你不需要手动指派。`
              : '工作流会在需要时自动调度这位专家，你不需要手动指派。'}</div>
          </div>`
          + `<div class="wb-modal-actions"><button type="button" class="wb-overview-secondary" data-agent-tune-capability="${esc(agent.id)}">前往专家库调优专家</button><button type="button" class="wb-overview-primary" data-agent-run="${esc(agent.id)}">用此专家继续</button></div>`
      }
      if (elModalHint) elModalHint.textContent = pendingGoal ? `当前目标：${pendingGoal}` : '可直接开始会话，或加入新运行'
      if (btnModalConfirm) btnModalConfirm.hidden = true
      if (btnModalCancel) btnModalCancel.textContent = '关闭'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    // 工作流启动不再走弹窗，剩余分支已由运行视图接管
    closeModal()
  }

  function closeModal() {
    modal = emptyModal()
    if (elModal) elModal.hidden = true
  }

  function daemonAuth() {
    return (data.daemon && data.daemon.auth) || { state: 'disabled', configured: false, authEnabled: false }
  }

  function applyDaemonAuth(auth) {
    if (!auth || typeof auth !== 'object') return
    if (!data.daemon || typeof data.daemon !== 'object') {
      data.daemon = { online: false, workflows: [], tasks: [], auth: null }
    }
    data.daemon.auth = auth
    if (modal.item && modal.item.id === 'workbench-auth' && !(auth.authEnabled && auth.state === 'required')) {
      closeModal()
    }
  }

  async function refreshAuthFromServer() {
    if (!window.api || !window.api.workbenchAuthStatus) return
    try {
      const res = await window.api.workbenchAuthStatus()
      if (res && res.auth) applyDaemonAuth(res.auth)
    } catch { /* ignore */ }
  }

  async function refreshDaemonOverview() {
    if (!loaded || !window.api) return
    const fetchOverview = window.api.workbenchDaemonOverview || window.api.workbenchLoad
    if (!fetchOverview) return
    try {
      const res = await fetchOverview()
      if (!res || !res.ok) return
      const daemon = res.daemon
      if (!daemon || typeof daemon !== 'object') return
      if (!data.daemon || typeof data.daemon !== 'object') {
        data.daemon = { online: false, workflows: [], tasks: [], auth: null }
      }
      data.daemon = {
        ...data.daemon,
        ...daemon,
        workflows: Array.isArray(daemon.workflows) ? daemon.workflows : [],
        tasks: Array.isArray(daemon.tasks) ? daemon.tasks : [],
      }
      data.daemonAgents = (Array.isArray(daemon.agents) ? daemon.agents : []).map(agent => ({
        ...agent,
        origin: 'daemon',
        editable: false,
      }))
      const buildProjection = window.WorkbenchConsoleModel?.buildConsoleProjection
      if (buildProjection) data.console = buildProjection({ ...data, activeDomainId: consoleDomain })
      if (activeSurface === 'manage' && activeManagePanel === 'daemon') renderDaemonMode()
    } catch { /* ignore */ }
  }

  async function refreshRunDirectory() {
    if (!loaded || !window.api?.workbenchLoad) return
    try {
      const res = await window.api.workbenchLoad()
      if (!res?.ok) return
      if (res.daemon && typeof res.daemon === 'object') {
        data.daemon = {
          ...data.daemon,
          ...res.daemon,
          workflows: Array.isArray(res.daemon.workflows) ? res.daemon.workflows : [],
          tasks: Array.isArray(res.daemon.tasks) ? res.daemon.tasks : [],
        }
      }
      if (Array.isArray(res.agents)) data.agents = res.agents
      if (Array.isArray(res.daemonAgents)) data.daemonAgents = res.daemonAgents
      if (res.console && typeof res.console === 'object') data.console = res.console
    } catch { /* keep the current run directory snapshot */ }
  }

  async function handleWorkbenchAuthChanged(auth) {
    if (auth && typeof auth === 'object') applyDaemonAuth(auth)
    else await refreshAuthFromServer()
    await refreshDaemonOverview()
  }

  function openWorkbenchAuthHelp() {
    modal = {
      ...emptyModal(),
      item: { id: 'workbench-auth', name: 'Workbench 授权' },
      kind: 'notice',
      noticeConfirm: '打开设置',
      noticeHint: '配置完成后工作台会自动刷新授权状态',
      noticeHtml: `
        <div class="wb-modal-section">
          <div class="wb-modal-desc">本机管线服务已启用授权。启动 team-run 等任务前，需要先在 KnowMe 设置中验证项目组授权码。</div>
        </div>
        <div class="wb-modal-section">
          <div class="wb-modal-section-head"><span>怎么配置</span></div>
          <ol class="wb-notice-steps">
            <li>打开「设置 → 连接器 → Workbench 授权」</li>
            <li>填写服务地址与授权码，点击「验证并保存」</li>
            <li>回到工作台重新启动任务</li>
          </ol>
        </div>`,
    }
    renderModal()
  }

  function handleDaemonAuthFailure(res) {
    if (!res || res.code !== 'auth_required') return false
    if (btnModalConfirm) btnModalConfirm.disabled = false
    if (elModalHint) elModalHint.textContent = '需要 Workbench 授权'
    toastFn('需要 Workbench 授权，请在设置中验证授权码', 'error')
    openWorkbenchAuthHelp()
    return true
  }

  function openAgentDetail(id) {
    const agent = agentById(id)
    if (!agent) {
      toastFn('未找到该专家资料', 'error')
      return
    }
    modal = {
      item: agent,
      workflow: null,
      graph: null,
      loading: false,
      error: '',
      daemon: false,
      kind: 'agent',
    }
    renderModal()
  }

  async function startAgentContinuation(id) {
    await launchAgentRun(id)
  }

  async function launchAgentRun(agentId, goal = pendingGoal) {
    const value = String(goal || '').trim()
    const expertId = String(agentId || '').trim()
    if (!value) {
      openLaunchDrawer({ resourceType: 'agent', resourceId: expertId })
      toastFn('请先在新建运行中填写目标', 'error')
      return false
    }
    closeModal()
    let profileId = `${expertId}-profile`
    let profileSnapshot = {
      profileIds: [profileId],
      agentId: expertId,
    }
    try {
      const profiles = await window.api?.agentProfileList?.(expertId)
      const profile = profiles?.profiles?.[0] || null
      profileId = profile?.id || profileId
      profileSnapshot = {
        profileIds: [profileId],
        id: profileId,
        agentId: expertId,
        version: profile?.version || '',
        contentHash: profile?.contentHash || '',
        skillRefs: Array.isArray(profile?.skillRefs) ? profile.skillRefs : [],
        connectorRefs: Array.isArray(profile?.connectorRefs) ? profile.connectorRefs : [],
        permissions: profile?.permissions || {},
        modelPolicy: profile?.modelPolicy || {},
        outputContract: profile?.outputContract || {},
        budget: profile?.budget || {},
      }
    } catch { /* use default profile id */ }
    await updateLaunchIntent({
      goal: value,
      resourceType: 'agent',
      resourceId: expertId,
      domain: activeLaunchDomain(),
      profileSnapshot,
      step: 'confirm',
      status: 'ready',
      backend: 'local-team',
      executionSource: 'local-team',
    })
    modal = {
      ...emptyModal(),
      item: { id: 'workbench-agent-graph', name: '专家协作运行' },
      kind: 'agent-graph',
      loading: true,
      initialIntent: value,
      plan: null,
    }
    renderModal()
    try {
      const plan = await window.api.workbenchAgentGraphPlan({
        goal: value,
        members: [{ agentPackageId: expertId, expertId, profileId, role: expertId }],
        template: 'single',
      })
      if (!modal.item || modal.item.id !== 'workbench-agent-graph') return false
      modal.plan = plan
      agentGraphPlan = plan?.ok ? plan : null
      modal.loading = false
      modal.error = plan && plan.ok ? '' : (plan?.error || '暂时无法生成 Agent 运行计划')
    } catch (error) {
      modal.loading = false
      modal.error = error.message || '暂时无法生成 Agent 运行计划'
    }
    if (!modal.plan?.ok) {
      const error = modal.error || '当前 Agent 无法启动 Run'
      closeModal()
      toastFn(error, 'error')
      openLaunchDrawer({ resourceType: 'agent', resourceId: expertId, step: 'readiness', status: 'blocked' })
      return false
    }
    renderModal()
    renderStudio()
    return true
  }

  async function saveAgentGraphAsWorkflow() {
    const plan = modal.plan
    const composition = plan?.composition
    if (!composition || !window.api?.workbenchWorkflowPackageSave) return
    const members = Array.isArray(composition.members) ? composition.members : []
    const result = await window.api.workbenchWorkflowPackageSave({
      package: {
        id: `my-${Date.now().toString(36)}`,
        name: `${composition.goal || modal.initialIntent || 'Agent 协作'}（我的流程）`,
        description: '由 Agent Graph 编排工作室保存的个人工作流。',
        source: 'personal',
        status: 'draft',
        goalTypes: [activeMode()?.id || 'general'],
        agentRefs: members.map(member => ({
          id: member.agentPackageId || member.id,
          profileId: member.profileId || '',
        })),
        skillRefs: members.flatMap(member => Array.isArray(member.skillRefs) ? member.skillRefs : []),
        graph: composition,
        executionBackends: ['local-team'],
        provenance: { kind: 'agent-composition', goal: composition.goal || modal.initialIntent || '' },
      },
    })
    if (!result?.ok) {
      toastFn(result?.error || '保存个人工作流失败', 'error')
      return
    }
    data.workflowPackages = [...(data.workflowPackages || []).filter(item => item.id !== result.package.id), result.package]
    saveWorkContext({
      goal: composition.goal || modal.initialIntent || '',
      workflowId: result.package.id,
      workflowVersion: result.package.version,
      compositionId: result.package.id,
      compositionHash: result.package.compositionHash,
      executionSource: 'local-team',
    })
    renderShelf()
    renderWorkflowManage()
    toastFn('已保存为我的工作流，可从流程库或团队页继续使用', 'success')
  }

  function openSavedWorkflowGraph(item, goal = '', { autoStart = false } = {}) {
    const composition = {
      ...(item.graph || {}),
      goal: goal || item.graph?.goal || item.description || item.name || item.id,
    }
    pendingGoal = composition.goal
    saveTaskDraft({
      goal: composition.goal,
      workflowId: item.id,
      workflowVersion: item.version || '',
      phase: 'preparing',
      executionSource: 'agent-graph',
      composition,
    })
    saveWorkContext({
      goal: composition.goal,
      workflowId: item.id,
      workflowVersion: item.version || '',
      compositionId: item.id,
      compositionHash: item.compositionHash || '',
      executionSource: 'local-team',
    })
    modal = {
      ...emptyModal(),
      item,
      kind: 'agent-graph',
      initialIntent: composition.goal,
      silent: autoStart,
      plan: {
        ok: true,
        composition,
        teamPackage: {
          packageId: item.id,
          name: item.name || item.id,
          version: item.version || '1.0.0',
        },
      },
    }
    // 从货架启动时输入已确认过，不再弹第二个确认框
    if (autoStart) return confirmModal()
    renderModal()
    return undefined
  }

  // 运行视图的「确认输入」已经是唯一确认点，这里直接起跑，不再弹二次确认框
  async function startWorkflowRun(id, initialIntent = '') {
    const raw = workflowById(id)
    const selectedItem = mergeWorkflowItem(raw)
    if (!selectedItem) {
      toastFn('未找到该工作流模板', 'error')
      return
    }
    if (selectedItem.locked) {
      toastFn('当前体验档未授权此流程，请先在 workbench Web 端登录', 'error')
      return
    }

    const goal = String(initialIntent || pendingGoal || '').trim()
    if (!selectedItem.path && ['personal', 'forked', 'official'].includes(String(selectedItem.source || '')) && selectedItem.graph?.nodes?.length) {
      setSurface('run', { force: true })
      setRunStage('running')
      await openSavedWorkflowGraph(selectedItem, goal, { autoStart: true })
      return
    }
    pendingGoal = goal
    const executionSource = resolveWorkflowExecutionSource(selectedItem)
    const executionWorkflowId = executionSource === 'daemon'
      ? String(selectedItem.provenance?.executionWorkflowId || '').trim()
      : ''
    const executionItem = executionWorkflowId ? mergeWorkflowItem(workflowById(executionWorkflowId)) : null
    const item = executionItem
      ? {
          ...executionItem,
          launchPackageId: selectedItem.id,
          launchPackageVersion: selectedItem.version || '',
          launchPackageName: selectedItem.name || selectedItem.id,
        }
      : selectedItem
    await updateLaunchIntent({
      goal,
      domain: activeLaunchDomain(),
      resourceType: 'pipeline',
      resourceId: selectedItem.id,
      backend: executionSource === 'daemon' ? 'daemon' : 'local-team',
      executionSource,
      step: 'confirm',
      status: 'ready',
      workflowVersion: selectedItem.version || '',
    })
    saveTaskDraft({
      goal,
      workflowId: selectedItem.id,
      workflowVersion: selectedItem.version || '',
      executionSource,
      modeId: activeMode()?.id || '',
      phase: 'preparing',
      slug: '',
    })
    saveWorkContext({
      goal,
      workflowId: selectedItem.id,
      workflowVersion: selectedItem.version || '',
      executionSource,
    })
    const daemonOnline = executionSource === 'daemon' && !!(data.daemon && data.daemon.online)
    setSurface('run', { force: true })
    setRunStage('running')

    if (daemonOnline) {
      await beginDaemonRun(item, { intent: goal || item.name || item.id })
      return
    }

    const detail = await loadWorkflowDetail(item)
    if (detail.ok && detail.workflow) {
      beginLocalRun(detail.workflow, detail.graph, goal)
      return
    }
    const message = detail.noPath
      ? '这条流程还没有可执行的定义，请先在编排中补全节点'
      : (detail.error || '工作流加载失败')
    toastFn(message, 'error')
    setRunStage('input')
    renderRunInputStage()
  }

  function beginLocalRun(workflow, graph, goal) {
    stopDaemonRuntimeWatchers()
    run = emptyRun()
    run.mode = 'local'
    run.workflow = workflow
    run.graph = graph || model()?.buildWorkflowGraph(workflow)
    run.currentId = workflow.entryNode || run.graph?.order?.[0] || ''
    run.intent = goal || workflow.description || workflow.name || workflow.id
    run.status = 'ready'
    saveTaskDraft({ goal: run.intent, workflowId: workflow.id, modeId: activeMode()?.id || '', phase: 'preparing', slug: '' })
    addLog('已进入任务工作间', workflow.name || workflow.id)
    renderRunner()
  }

  // 远程任务的真正落地：提交 → 建立 run 状态 → 开始轮询
  async function beginDaemonRun(item, { intent, slug = '', context = null } = {}) {
    const goal = String(intent || '').trim()
    if (!goal) {
      toastFn('请先填写协作目标', 'error')
      setRunStage('input')
      renderRunInputStage()
      return { ok: false }
    }
    const saved = loadDaemonContext(item.id)
    const payloadContext = context || (saved && Object.keys(saved).length ? saved : null)
    if (payloadContext) saveDaemonContext(item.id, payloadContext)
    let res
    try {
      res = await window.api.workbenchDaemonStart({ workflow: item.id, slug, intent: goal, context: payloadContext })
    } catch (error) {
      res = { ok: false, error: error.message || '任务启动失败' }
    }
    if (!res || !res.ok) {
      if (handleDaemonAuthFailure(res)) return res
      saveTaskDraft({
        goal,
        workflowId: item.launchPackageId || item.id,
        workflowVersion: item.launchPackageVersion || item.version || '',
        phase: 'preparing',
        slug: '',
      })
      toastFn((res && res.error) || '任务启动失败', 'error')
      setRunStage('input')
      renderRunInputStage()
      return res
    }
    const detail = await loadWorkflowDetail(item)
    run = emptyRun()
    run.mode = 'daemon'
    daemonReviewTab = 'steps'
    daemonReviewStepId = ''
    run.workflow = detail.ok && detail.workflow ? detail.workflow : item
    run.graph = detail.ok ? detail.graph : null
    run.slug = res.slug
    run.intent = goal
    run.purposeTitle = String(data.taskDraft?.purposeTitle || '').trim()
    run.context = payloadContext
    run.contextSummary = res.contextSummary || ''
    run.taskTrace = buildTaskTrace({
      context: payloadContext,
      slug: res.slug,
      workflow: item.id,
    })
    run.status = (res.job && res.job.state) || 'queued'
    run.terminalKind = ''
    saveTaskDraft({
      goal,
      workflowId: item.launchPackageId || item.id,
      workflowVersion: item.launchPackageVersion || item.version || '',
      phase: 'running',
      slug: res.slug,
      context: payloadContext,
      purposeTitle: run.purposeTitle || undefined,
    })
    await completeLaunchIntent({
      runId: res.slug,
      rootRunId: res.slug,
      slug: res.slug,
      backend: 'daemon',
      executionSource: 'daemon',
    })
    addLog('任务已提交', `${res.slug} · ${goal}${run.contextSummary ? ` · ${run.contextSummary}` : ''}`)
    renderRunner()
    void ensureDaemonPurposeTitle({ force: !run.purposeTitle })
    await refreshDaemonOverview()
    await refreshDaemonTask(false)
    return res
  }

  async function confirmModal() {
    if (modal.kind === 'studio-save') {
      const goalInput = document.getElementById('wbStudioSaveGoal')
      const nextGoal = String(goalInput?.value || '').trim()
      if (!nextGoal) {
        if (elModalHint) elModalHint.textContent = '请填写工作流目标后再保存'
        goalInput?.focus()
        return
      }
      if (studioDraft && window.WorkbenchStudioModel) {
        studioDraft = window.WorkbenchStudioModel.updateDraft(studioDraft, { goal: nextGoal })
      }
      if (btnModalConfirm) btnModalConfirm.disabled = true
      if (elModalHint) elModalHint.textContent = '正在保存…'
      const saved = await saveStudioWorkflow()
      if (!saved?.ok) {
        modal.error = saved?.error || '保存失败'
        if (btnModalConfirm) btnModalConfirm.disabled = false
        renderModal()
        return
      }
      closeModal()
      return
    }
    if (modal.kind === 'workflow-detail' || modal.kind === 'workflow-start') {
      const id = modal.item?.id
      const runnable = id ? shelfReadiness(modal.item).runnable : false
      if (!id || !runnable) return
      const item = modal.item
      closeModal()
      await beginWorkflowRun(item)
      return
    }
    if (modal.kind === 'notice') {
      if (modal.item && modal.item.id === 'workbench-auth') {
        closeModal()
        window.api?.openSettings?.('connectors')
        return
      }
      if (btnModalConfirm) btnModalConfirm.disabled = true
      if (elModalHint) elModalHint.textContent = '正在重新检测…'
      await load()
      const online = !!(data.daemon && data.daemon.online)
      closeModal()
      toastFn(online ? '管线服务已连接' : '仍未检测到管线服务', online ? 'success' : 'error')
      return
    }
    if (modal.kind === 'clarify') {
      const clarification = modal.clarification || {}
      const node = clarification.node || clarification.node_id || clarification.id
      const answer = String(document.getElementById('wbClarifyAnswer')?.value || '').trim()
      if (!node) {
        toastFn('当前澄清节点缺少标识，无法提交回答', 'error')
        return
      }
      if (!answer) {
        if (elModalHint) elModalHint.textContent = '请先填写回答内容'
        return
      }
      if (btnModalConfirm) btnModalConfirm.disabled = true
      let res
      try {
        res = await window.api.workbenchDaemonClarify(run.slug, { node, answer })
      } catch (error) {
        res = { ok: false, error: error.message || '提交回答失败' }
      }
      if (!res || !res.ok) {
        if (btnModalConfirm) btnModalConfirm.disabled = false
        if (elModalHint) elModalHint.textContent = (res && res.error) || '提交回答失败'
        toastFn((res && res.error) || '提交回答失败', 'error')
        return
      }
      closeModal()
      addLog('已补充信息', `${node} · 已提交`)
      await refreshDaemonTask(false)
      return
    }
    if (modal.kind === 'agent-graph') {
      const plan = modal.plan
      if (!plan || !plan.ok) {
        toastFn('当前 Agent Graph 未通过校验，请修改目标或能力', 'error')
        return
      }
      const goalInput = document.getElementById('wbAgentGraphGoal')
      const runGoal = String(goalInput?.value || plan.composition?.goal || modal.initialIntent || '').trim()
      if (goalInput && plan.composition) {
        plan.composition = { ...plan.composition, goal: runGoal }
      }
      if (btnModalConfirm) btnModalConfirm.disabled = true
      if (elModalHint) elModalHint.textContent = '正在校验并启动本地 Team Run…'
      let res
      try {
        res = await window.api.workbenchAgentGraphStart({
          goal: runGoal,
          members: plan.composition?.members || [],
          template: plan.composition?.template || '',
          nodes: plan.composition?.nodes || [],
          edges: plan.composition?.edges || [],
          gates: plan.composition?.gates || [],
          joinStrategy: plan.composition?.joinStrategy,
          parallelism: plan.composition?.parallelism,
          teamPackageId: plan.teamPackage?.packageId,
          teamName: plan.teamPackage?.name,
          version: plan.teamPackage?.version,
        })
      } catch (error) {
        res = { ok: false, error: error.message || '本地 Agent Graph 启动失败' }
      }
      if (!res || !res.ok) {
        const error = res?.error || res?.message || '本地 Agent Graph 启动失败'
        modal.error = error
        if (elModalHint) elModalHint.textContent = error
        if (btnModalConfirm) btnModalConfirm.disabled = false
        // 静默启动失败时回到确认输入，不要凭空弹出一个启动对话框
        if (modal.silent) {
          closeModal()
          setRunStage('input')
          renderRunInputStage()
        } else {
          renderModal()
        }
        toastFn(error, 'error')
        return
      }
      const graphItem = modal.item
      closeModal()
      stopDaemonRuntimeWatchers()
      run = emptyRun()
      run.mode = 'agent-graph'
      run.workflow = {
        id: 'workbench-agent-graph',
        name: '专家协作图',
        description: res.composition?.goal || modal.initialIntent,
      }
      run.intent = res.composition?.goal || modal.initialIntent
      run.rootRunId = res.rootRunId
      run.composition = res.composition
      run.status = 'running'
      saveTaskDraft({
        goal: run.intent,
        workflowId: graphItem?.id || '',
        workflowVersion: graphItem?.version || '',
        executionSource: 'agent-graph',
        rootRunId: run.rootRunId,
        composition: run.composition,
        phase: 'running',
      })
      saveWorkContext({
        goal: run.intent,
        workflowId: graphItem?.id || '',
        workflowVersion: graphItem?.version || '',
        compositionId: graphItem?.id || 'workbench-agent-graph',
        rootRunId: run.rootRunId,
        executionSource: 'local-team',
      })
      await completeLaunchIntent({
        runId: run.rootRunId,
        rootRunId: run.rootRunId,
        backend: 'local-team',
        executionSource: 'local-team',
      })
      addLog('已启动本地 Agent Graph', `Root Run ${run.rootRunId}`)
      renderRunner()
      void refreshAgentGraphRun(false)
      return
    }
  }

  async function refreshDaemonTask(showToast = true) {
    if (run.mode !== 'daemon' || !run.slug || !window.api.workbenchDaemonTask) return
    let res
    try {
      res = await window.api.workbenchDaemonTask(run.slug)
    } catch (error) {
      res = { ok: false, error: error.message || '无法读取任务状态' }
    }
    if (!res || !res.ok) {
      if (handleDaemonAuthFailure(res)) return
      stopDaemonRuntimeWatchers()
      run.status = 'error'
      run.terminalKind = 'failure'
      run.error = (res && res.error) || '无法读取任务状态'
      addLog('状态刷新失败', (res && res.error) || '无法读取任务状态')
      renderRunner()
      return
    }
    run.task = res
    run.status = res.state || 'running'
    run.resultSummary = String(res.summary || res.result?.summary || res.result?.text || res.message || '').trim()
    applyTaskProjection(res)
    await loadDaemonReviewExtras({
      includeEvents: daemonReviewTab === 'events',
      includeChanges: daemonReviewTab === 'changes',
      forceLogs: !!showToast,
    })
    const waiting = daemonWaiting()
    if (waiting.clarification) {
      const enriched = await enrichDaemonClarificationPrompt(waiting.clarification)
      if (enriched && run.task) {
        const list = Array.isArray(run.task.pending_clarifications) ? run.task.pending_clarifications.slice() : []
        if (list[0]) list[0] = enriched
        run.task = { ...run.task, pending_clarifications: list }
      }
    }
    const waitingAfter = daemonWaiting()
    if (waitingAfter.gate) addLogOnce('等待你的决定', waitingAfter.gate.title || waitingAfter.gate.node || '审批节点')
    if (waitingAfter.clarification) {
      const display = briefApi()?.resolveClarificationDisplay
        ? briefApi().resolveClarificationDisplay(waitingAfter.clarification)
        : null
      addLogOnce(
        '需要补充信息',
        (display && display.title) || waitingAfter.clarification.question || waitingAfter.clarification.node || '请回答问题',
      )
    }
    const hitlPending = !!(res.hitlPending || waitingAfter.gate || waitingAfter.clarification)
    if (hitlPending) {
      run.terminalKind = ''
      run.hitlPending = true
      if (!['waiting', 'blocked', 'gate', 'clarification'].includes(String(run.status || '').toLowerCase())) {
        run.status = 'waiting'
      }
      syncDaemonAttentionNotify(waitingAfter, true)
      schedulePoll()
      startDaemonLogStream()
    } else if (res.terminal) {
      run.hitlPending = false
      syncDaemonAttentionNotify(waitingAfter, false)
      const state = String(res.state || '').toLowerCase()
      const successful = ['finished', 'completed', 'done', 'success'].includes(state)
      const cancelled = ['cancelled', 'canceled'].includes(state)
      run.terminalKind = successful ? 'success' : (cancelled ? 'cancelled' : 'failure')
      run.status = successful ? 'done' : (cancelled ? 'cancelled' : 'failed')
      stopDaemonRuntimeWatchers()
      if (successful && window.api.workbenchDaemonArtifacts) {
        let artifacts
        try {
          artifacts = await window.api.workbenchDaemonArtifacts(run.slug)
        } catch (error) {
          artifacts = { ok: false, error: error.message || '无法读取任务制品' }
        }
        run.artifacts = artifacts && artifacts.ok ? artifacts.files : []
        if (artifacts && !artifacts.ok) {
          addLogOnce('制品读取失败', artifacts.error || '任务已结束，但暂未读取到制品')
        }
      } else {
        run.artifacts = []
      }
      saveTaskDraft({
        phase: successful ? 'completed' : (cancelled ? 'cancelled' : 'failed'),
        slug: run.slug,
        goal: run.intent,
        workflowId: run.workflow?.id || '',
      })
      addLogOnce(
        successful ? '任务已完成' : (cancelled ? '任务已取消' : '任务执行失败'),
        successful
          ? (run.artifacts.length ? `已生成 ${run.artifacts.length} 个制品` : '未发现可展示的制品')
          : (res.error || res.message || '请检查任务日志后重新执行')
      )
      await refreshDaemonOverview()
    } else {
      run.hitlPending = false
      syncDaemonAttentionNotify(waitingAfter, false)
      schedulePoll()
      startDaemonLogStream()
    }
    if (showToast) toastFn('任务状态已刷新', 'success')
    renderRunner()
  }

  function addLogOnce(title, text) {
    const key = `${title}\n${text}`
    const exists = run.logs.some(item => `${item.title}\n${item.text}` === key)
    if (!exists) addLog(title, text)
  }

  async function openDaemonTask(slug, { silent = false, returnSurface = '' } = {}) {
    const target = String(slug || '').trim()
    if (!target) return false
    const item = (data.daemon.tasks || []).find(task => task.slug === target)
    // 须在切到 run 面之前定稿来源；无 UI/显式来源时 Daemon 默认回管线，避免落到专家协作
    const surface = resolveReturnSurface(
      returnSurface
      || (activeSurface === 'manage' && activeManagePanel === 'daemon' ? 'daemon' : '')
      || (activeSurface === 'run' ? (taskRoomReturnState?.surface || 'daemon') : '')
      || (activeSurface === 'shelf' || activeSurface === 'studio' ? 'shelf' : '')
      || (activeSurface === 'taskhome' ? 'taskhome' : '')
      || 'daemon'
    )
    taskRoomReturnState = captureTaskRoomReturnState({ surface, runId: target })
    stopDaemonRuntimeWatchers()
    daemonLogRenderSignature = ''
    daemonLogStickToBottom = true
    run = emptyRun()
    run.mode = 'daemon'
    run.workflow = {
      id: (item && item.workflow) || 'task',
      name: (item && (item.pathName || item.workflowName || item.workflow)) || '管线任务',
    }
    run.slug = target
    run.intent = (item && item.intent) || ''
    run.purposeTitle = String(data.taskDraft?.purposeTitle || item?.purposeTitle || '').trim()
    run.status = (item && item.state) || 'loading'
    daemonReviewTab = 'steps'
    daemonReviewStepId = ''
    daemonProgressCollapsed = false
    daemonLogsCollapsed = false
    addLog('打开最近协作', run.intent || target)
    renderRunner()
    void ensureDaemonPurposeTitle({ force: !run.purposeTitle })
    await refreshDaemonTask(false)
    // 静默恢复遇到任务已清除/不可读：清草稿并退出运行面，避免冷启动卡在错误页
    if (silent && (run.status === 'error' || run.terminalKind === 'failure')) {
      await clearStaleDaemonTaskDraft()
      stopDaemonRuntimeWatchers()
      run = emptyRun()
      taskRoomReturnState = null
      renderRunner()
      return false
    }
    if (!silent) toastFn('已恢复任务工作间', 'success')
    return true
  }

  function advance(outcome = 'default') {
    const node = currentNode()
    if (!node || !model()) return
    const next = model().nextNodeId(node, outcome)
    if (!next) {
      run.currentId = ''
      run.status = 'done'
      addLog('工作流完成', run.workflow.name || run.workflow.id)
    } else {
      run.currentId = next
      run.status = 'ready'
    }
    renderRunner()
  }

  async function dispatchAgent(node, advanceAfter = true) {
    if (!model()) return false
    const prompt = model().composeDispatchPrompt(node, run.workflow, agentsById())
    const dispatchId = `wb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    run.dispatchId = dispatchId
    run.status = 'running'
    addLog(`派单 · ${model().nodeTitle(node, agentsById())}`, '正在等待专家…', dispatchId)
    renderRunner()
    let res
    try {
      res = await window.api.workbenchDispatch({ dispatchId, prompt })
    } catch (e) {
      res = { error: e.message }
    }
    if (run.dispatchId !== dispatchId) return false
    run.dispatchId = ''
    if (!res || res.error) {
      run.status = 'error'
      updateDispatchLog(dispatchId, `${(res && res.error) || '派单失败'}\n\n可人工执行的派单内容：\n${prompt}`)
      renderRunner()
      return false
    }
    updateDispatchLog(dispatchId, res.text || '专家已完成')
    run.status = 'ready'
    if (advanceAfter) advance()
    else renderRunner()
    return true
  }

  async function runParallel(node) {
    const children = (node.children || []).map(id => run.graph.byId.get(id)).filter(Boolean)
    const agents = children.filter(child => child.type === 'agent')
    if (!agents.length) {
      addLog('并行节点', '没有可派单的专家子节点，已人工跳过')
    }
    for (const child of agents) {
      const ok = await dispatchAgent(child, false)
      if (!ok) return
    }
    run.currentId = node.next || ''
    run.status = run.currentId ? 'ready' : 'done'
    renderRunner()
  }

  async function handleRunAction(action) {
    if (action === 'open-sources') {
      window.api?.openSettings?.('sources')
      return
    }
    if (action === 'focus-process-logs') {
      focusDaemonProcessLogs()
      return
    }
    if (action === 'daemon-workspace') {
      await openDaemonWorkspaceBrowser()
      return
    }
    if (action === 'back') {
      void backToRunList()
      return
    }
    if (action === 'reset') {
      resetRun(true)
      addLog('运行已重置', run.workflow.name || run.workflow.id)
      return
    }
    if (run.mode === 'agent-graph') {
      if (action === 'agent-refresh') {
        await refreshAgentGraphRun(true)
        return
      }
      if (action === 'agent-cancel') {
        const result = await window.api.agentRunCancel(run.rootRunId)
        if (!result || result.ok === false) {
          toastFn(result?.error || '停止本地 Agent Graph 失败', 'error')
          return
        }
        run.status = 'cancelled'
        saveTaskDraft({ phase: 'cancelled', executionSource: 'agent-graph', rootRunId: run.rootRunId })
        renderRunner()
        return
      }
      if (action === 'agent-retry') {
        await openAgentGraph(run.intent)
        return
      }
      if (action.startsWith('agent-')) {
        const [kind, nodeId] = action.split(':')
        if (['agent-approve', 'agent-revise', 'agent-reject'].includes(kind) && nodeId) {
          const decision = kind.replace('agent-', '')
          const result = await window.api.workbenchAgentRunDecision({
            rootRunId: run.rootRunId,
            nodeId,
            decision,
          })
          if (!result || !result.ok) {
            toastFn(result?.error || '审批提交失败', 'error')
            return
          }
          addLog('已提交 Agent Graph 审批', `${nodeId} · ${decision}`)
          await refreshAgentGraphRun(false)
        }
      }
      return
    }
    if (run.mode === 'daemon') {
      if (action === 'restart-task') {
        const workflowId = String(run.workflow && run.workflow.id || '').trim()
        if (!workflowId) {
          toastFn('当前任务缺少可重新启动的工作流标识', 'error')
          return
        }
        pendingGoal = run.intent
        saveTaskDraft({ goal: run.intent, workflowId, phase: 'preparing', slug: '' })
        await startWorkflowRun(workflowId, run.intent)
        return
      }
      if (action === 'refresh-task') {
        await refreshDaemonTask()
        return
      }
      if (action === 'daemon-cancel') {
        if (!run.slug || !window.api?.workbenchDaemonCancel) {
          toastFn('无法取消管线任务', 'error')
          return
        }
        let res
        try {
          res = await window.api.workbenchDaemonCancel(run.slug, { reason: 'user_cancelled' })
        } catch (error) {
          res = { ok: false, error: error.message || '停止管线任务失败' }
        }
        if (!res || !res.ok) {
          toastFn((res && res.error) || '停止管线任务失败', 'error')
          return
        }
        addLog('已请求取消任务', run.slug)
        stopDaemonRuntimeWatchers()
        run.status = 'cancelled'
        run.terminalKind = 'cancelled'
        saveTaskDraft({
          phase: 'cancelled',
          executionSource: 'daemon',
          slug: run.slug,
          goal: run.intent,
        })
        await refreshDaemonTask(false)
        renderRunner()
        return
      }
      const waiting = daemonWaiting()
      if (action.startsWith('daemon-') && action !== 'daemon-clarify') {
        const decision = action.replace('daemon-', '')
        const gate = waiting.gate
        if (!gate) return
        const node = gate.node || gate.node_id || gate.id
        if (!node) {
          toastFn('当前审批节点缺少标识，无法提交决定', 'error')
          return
        }
        let res
        try {
          res = await window.api.workbenchDaemonGate(run.slug, { node, decision })
        } catch (error) {
          res = { ok: false, error: error.message || '提交决定失败' }
        }
        if (!res || !res.ok) {
          toastFn((res && res.error) || '提交决定失败', 'error')
          return
        }
        addLog('已提交决定', `${node} · ${decision}`)
        await refreshDaemonTask(false)
        return
      }
      if (action === 'daemon-clarify') {
        // 澄清已迁入左栏对话；保留分支避免旧调用误开弹窗
        toastFn('请在左侧对话中直接回复澄清问题', 'info')
        return
      }
      return
    }
    const node = currentNode()
    if (!node || run.status === 'running') return
    if (action === 'run' && node.type === 'agent') {
      await dispatchAgent(node)
      return
    }
    if (action === 'run-parallel' && node.type === 'parallel') {
      await runParallel(node)
      return
    }
    const outcome = {
      approve: 'approve',
      revise: 'revise',
      reject: 'reject',
      success: 'success',
      exhausted: 'exhausted',
    }[action] || 'default'
    addLog(`${model().nodeTypeLabel(node.type)} · 人工确认`, action)
    advance(outcome)
  }

  function modePayloadFromResult(result) {
    if (!result || result.ok === false) return null
    if (result.state && Array.isArray(result.state.modes)) return result.state
    if (result.modeState && Array.isArray(result.modeState.modes)) return result.modeState
    if (result.modes && Array.isArray(result.modes.modes)) return result.modes
    if (Array.isArray(result.modes)) {
      return {
        activeModeId: result.activeModeId || activeMode()?.id || 'office',
        modes: result.modes,
      }
    }
    return null
  }

  function applyModeState(result) {
    const next = modePayloadFromResult(result)
    if (!next) return false
    data.modes = next
    shelfQuery = ''
    if (elShelfSearch) elShelfSearch.value = ''
    renderModeOverview()
    if (activeSurface === 'taskhome') void renderTaskHome()
    return true
  }

  async function selectMode(modeId) {
    const id = String(modeId || '').trim()
    if (!id || id === activeMode()?.id) return { ok: true, modes: data.modes }
    if (!window.api?.workbenchModeSelect) {
      const state = modeState()
      data.modes = { ...state, activeModeId: id }
      applyModeState({ modes: data.modes })
      return { ok: true, modes: data.modes }
    }
    try {
      const result = await window.api.workbenchModeSelect(id)
      if (!result?.ok || !applyModeState(result)) {
        throw new Error(result?.error || '无法切换工作模式')
      }
      consoleDomain = id
      // activePage 只有 home/tasks，无法还原 shelf/manage；setWorkbenchPage('home') 会误跳「任务」
      renderShelf()
      renderStudio()
      toastFn(`已切换到${activeMode()?.name || '新的工作模式'}`, 'success')
      return result
    } catch (error) {
      toastFn(error.message || '无法切换工作模式', 'error')
      return { ok: false, error: error.message }
    }
  }

  function selectConsoleDomain(domainId) {
    const id = ['all', 'office', 'engineering', 'visual'].includes(String(domainId || ''))
      ? String(domainId)
      : 'all'
    // 领域 chip 只筛货架，不切换工作模式、不重绘 Studio（避免 IPC + 画布重建造成卡顿）
    if (id === consoleDomain) {
      syncShelfFilterChips()
      return
    }
    runListResourceId = ''
    runListRunId = ''
    consoleDomain = id
    syncShelfFilterChips()
    renderShelf()
  }

  
  async function refreshModes() {
    if (!window.api?.workbenchModeList) {
      renderModeOverview()
      return { ok: true, modes: data.modes }
    }
    try {
      const result = await window.api.workbenchModeList()
      if (!result?.ok || !applyModeState(result)) {
        throw new Error(result?.error || '无法刷新工作模式')
      }
      return result
    } catch (error) {
      toastFn(error.message || '无法刷新工作模式', 'error')
      return { ok: false, error: error.message }
    }
  }

  function openCapabilityPicker(tab = 'experts') {
    if (typeof window.openCapabilityHub === 'function') {
      window.openCapabilityHub(tab)
      return
    }
    toastFn('专家库暂不可用', 'error')
  }

  function openAgentPicker() {
    openCapabilityPicker('experts')
  }

  function bind() {
    btnReload && btnReload.addEventListener('click', async () => {
      // 编排页：右侧返回图标离开 Studio
      if (activeSurface === 'studio') {
        await leaveStudioToShelf()
        return
      }
      // 对话房主退路改走 #agentDialogueStatusBack；此处保留兜底
      if (expertTaskRoom) {
        closeExpertTaskRoom()
        return
      }
      if (run.workflow) {
        void backToRunList()
        return
      }
      loaded = false
      toastFn('正在刷新助手与本机管线服务…')
      await load()
    })
    btnDialogueStatusBack && btnDialogueStatusBack.addEventListener('click', () => {
      leaveDialogueTaskRoom()
    })
    elDomainSwitcher && elDomainSwitcher.addEventListener('click', event => {
      const button = event.target.closest('[data-domain]')
      if (button) void selectConsoleDomain(button.getAttribute('data-domain'))
    })
    elShelfSearch && elShelfSearch.addEventListener('input', () => {
      shelfQuery = String(elShelfSearch.value || '')
      renderShelf()
    })
    const btnShelfManage = document.getElementById('wbShelfManage')
    btnShelfManage && btnShelfManage.addEventListener('click', () => openManagePanel('workflows'))
    elShelfEmpty && elShelfEmpty.addEventListener('click', event => {
      const button = event.target.closest('[data-shelf-action]')
      if (!button) return
      const action = button.getAttribute('data-shelf-action')
      if (action === 'capability') openCapabilityPicker('experts')
      else void openOrchestration({ reset: true })
    })
    elShelfGrid && elShelfGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-flow-action]')
      const card = event.target.closest('[data-flow-id]')
      if (!card) return
      if (button) {
        event.stopPropagation()
        if (button.disabled) return
        void handleFlowLibraryAction(button.getAttribute('data-flow-action'), card.getAttribute('data-flow-id'))
        return
      }
      void openWorkflowDialogueRoom(card.getAttribute('data-flow-id'))
    })
    elShelfGrid && elShelfGrid.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.target.closest('[data-flow-action]')) return
      const card = event.target.closest('[data-flow-id]')
      if (!card || event.target !== card) return
      event.preventDefault()
      void openWorkflowDialogueRoom(card.getAttribute('data-flow-id'))
    })
    elModeTabs && elModeTabs.addEventListener('click', async event => {
      const button = event.target.closest('[data-wb-mode]')
      if (!button) return
      if (activeSurface === 'studio' && !await leaveStudioToShelf()) return
      const mode = button.getAttribute('data-wb-mode')
      if (mode === 'tasks') setSurface('taskhome', { force: true })
      else if (mode === 'daemon') openManagePanel('daemon')
      else if (activeSurface !== 'shelf') setSurface('shelf', { force: true })
    })
    elManageTabs && elManageTabs.addEventListener('click', event => {
      const button = event.target.closest('[data-manage-panel]')
      if (button) openManagePanel(button.getAttribute('data-manage-panel'))
    })
    elManageBack && elManageBack.addEventListener('click', () => {
      const target = elManageBack.dataset.manageBack
      if (target === 'workflows') setSurface('shelf', { force: true })
      else setSurface('taskhome', { force: true })
    })
    btnTaskNew && btnTaskNew.addEventListener('click', () => openTaskComposer())
    btnTaskManage && btnTaskManage.addEventListener('click', () => openTaskManageHub('expert'))
    btnShelfTaskManage && btnShelfTaskManage.addEventListener('click', () => openTaskManageHub('workflow'))
    elTaskQuickGrid && elTaskQuickGrid.addEventListener('click', event => {
      const card = event.target.closest('[data-task-quick]')
      if (!card) return
      const expertId = card.getAttribute('data-task-quick')
      if (typeof window.openCapabilityHub === 'function') {
        window.openCapabilityHub('experts', {
          expertId,
          surface: 'workbench',
          presentation: 'detail',
        })
        return
      }
      openCapabilityPicker('experts')
    })
    elTaskRecentList && elTaskRecentList.addEventListener('click', event => {
      const row = event.target.closest('[data-task-open]')
      if (row) openTaskFromRecent(row.getAttribute('data-task-open'))
    })
    btnTaskRecentToggle && btnTaskRecentToggle.addEventListener('click', () => {
      taskRecentExpanded = !taskRecentExpanded
      paintTaskRecentList()
    })
    elShelfRecentList && elShelfRecentList.addEventListener('click', event => {
      const row = event.target.closest('[data-task-open]')
      if (row) openTaskFromRecent(row.getAttribute('data-task-open'))
    })
    btnShelfRecentToggle && btnShelfRecentToggle.addEventListener('click', () => {
      shelfRecentExpanded = !shelfRecentExpanded
      paintShelfRecentList()
      syncShelfHomeScrollLock()
    })
    btnShelfGridToggle && btnShelfGridToggle.addEventListener('click', () => {
      shelfGridExpanded = !shelfGridExpanded
      paintShelfGrid()
      syncShelfHomeScrollLock()
    })
    window.addEventListener('resize', () => {
      if (activeSurface !== 'shelf' || shelfGridExpanded) return
      paintShelfGrid()
    })
    btnWorkflowManageNew && btnWorkflowManageNew.addEventListener('click', () => void openOrchestration({ reset: true }))
    btnWorkflowManageBack && btnWorkflowManageBack.addEventListener('click', () => setSurface('shelf', { force: true }))
    elWorkflowManagePage && elWorkflowManagePage.addEventListener('click', event => {
      const button = event.target.closest('[data-workflow-manage]')
      if (!button) return
      const card = button.closest('[data-workflow-id]')
      handleWorkflowManageAction(button.getAttribute('data-workflow-manage'), card?.getAttribute('data-workflow-id') || '')
    })
        elRunResultActions && elRunResultActions.addEventListener('click', event => {
      const button = event.target.closest('[data-run-result]')
      if (!button) return
      const action = button.getAttribute('data-run-result')
      if (action === 'back') void backRunResultToShelf()
      else if (action === 'again') openLaunchDrawer({ step: 'inputs', status: 'draft' })
      else {
        setRunStage('running')
        if (run.mode === 'daemon') focusDaemonProcessLogs()
      }
    })
    elRunResultBody && elRunResultBody.addEventListener('click', async event => {
      const button = event.target.closest('[data-artifact-path],[data-artifact-url]')
      if (!button || !window.api) return
      const url = button.getAttribute('data-artifact-url')
      if (url && window.api.openExternal) {
        const res = await window.api.openExternal(url)
        if (!res?.ok) toastFn(res?.message || res?.error || '无法打开远程产物', 'error')
        return
      }
      const artifactPath = button.getAttribute('data-artifact-path')
      if (!artifactPath || !window.api.workbenchDaemonArtifactOpen) {
        toastFn('该产物尚未生成或未同步', 'error')
        return
      }
      const res = await openDaemonArtifactPath(artifactPath)
      if (!res?.ok) {
        const hint = !res || res.reason === 'not-generated' || /尚未生成|未同步/.test(String(res.error || ''))
          ? '该产物尚未生成或未同步'
          : (res.error || '该产物尚未生成或未同步')
        toastFn(hint, 'error')
      }
    })
    btnRunInputStart && btnRunInputStart.addEventListener('click', () => void confirmRunInputs())
    btnRunInputCancel && btnRunInputCancel.addEventListener('click', () => {
      void dismissRunInputDraft()
    })
    btnRunBack && btnRunBack.addEventListener('click', () => {
      leaveDialogueTaskRoom()
    })
    btnExpertTaskBack && btnExpertTaskBack.addEventListener('click', () => closeExpertTaskRoom())
    elLeaveModal && elLeaveModal.addEventListener('click', event => {
      if (event.target === elLeaveModal) {
        leaveChoiceResolve?.('cancel')
        return
      }
      const choice = event.target.closest('[data-leave-choice]')?.getAttribute('data-leave-choice')
      if (choice) leaveChoiceResolve?.(choice)
    })
    elWorkflowDeleteModal && elWorkflowDeleteModal.addEventListener('click', event => {
      if (event.target === elWorkflowDeleteModal) {
        workflowDeleteResolve?.(false)
        return
      }
      const choice = event.target.closest('[data-workflow-delete]')?.getAttribute('data-workflow-delete')
      if (choice === 'confirm') workflowDeleteResolve?.(true)
      else if (choice === 'cancel') workflowDeleteResolve?.(false)
    })
    elDaemonModeList && elDaemonModeList.addEventListener('click', event => {
      const button = event.target.closest('[data-daemon-workflow]')
      if (!button) return
      selectedDaemonWorkflowId = button.getAttribute('data-daemon-workflow') || ''
      void refreshDaemonComposeLaunchContext(selectedDaemonWorkflowId).then(() => renderDaemonMode())
    })
    async function reconnectDaemonSurface() {
      toastFn('正在检测管线服务…')
      try {
        // 仅刷新管线概览，避免走完整 load() 重置视图并跳离管线服务页
        await refreshDaemonOverview()
      } catch (_) {
        /* overview already swallows transport errors */
      }
      const online = !!(data.daemon && data.daemon.online)
      toastFn(online ? '管线服务已连接' : '仍未检测到管线服务', online ? 'success' : 'error')
      if (activeManagePanel === 'daemon') renderDaemonMode()
    }
    elDaemonModeStatus && elDaemonModeStatus.addEventListener('click', event => {
      if (event.target.closest('[data-daemon-action="reconnect"]')) {
        void reconnectDaemonSurface()
      }
    })
    const setDaemonPathMenuOpen = (open) => {
      const root = elDaemonModeDetail?.querySelector('.wb-daemon-path-select')
      const trigger = elDaemonModeDetail?.querySelector('#wbDaemonComposePathTrigger')
      const menu = elDaemonModeDetail?.querySelector('#wbDaemonComposePathMenu')
      if (!root || !trigger || !menu) return
      const next = !!open && !trigger.disabled
      root.classList.toggle('is-open', next)
      trigger.setAttribute('aria-expanded', next ? 'true' : 'false')
      if (next) menu.removeAttribute('hidden')
      else menu.setAttribute('hidden', '')
    }
    elDaemonModeDetail && elDaemonModeDetail.addEventListener('click', event => {
      if (event.target.closest('[data-daemon-action="reconnect"]')) {
        void reconnectDaemonSurface()
        return
      }
      const pathOption = event.target.closest('.wb-daemon-path-option')
      if (pathOption) {
        if (pathOption.classList.contains('is-disabled') || pathOption.getAttribute('aria-disabled') === 'true') return
        const value = String(pathOption.getAttribute('data-value') || '').trim()
        const select = elDaemonModeDetail.querySelector('#wbDaemonComposePath')
        if (select && value && select.value !== value) {
          select.value = value
          select.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          setDaemonPathMenuOpen(false)
        }
        return
      }
      const pathTrigger = event.target.closest('#wbDaemonComposePathTrigger')
      if (pathTrigger) {
        event.preventDefault()
        const root = pathTrigger.closest('.wb-daemon-path-select')
        setDaemonPathMenuOpen(!root?.classList.contains('is-open'))
        return
      }
      if (elDaemonModeDetail.querySelector('.wb-daemon-path-select.is-open')) {
        setDaemonPathMenuOpen(false)
      }
      const remove = event.target.closest('[data-daemon-action="remove-material"]')
      if (remove) {
        const index = Number(remove.getAttribute('data-index'))
        if (Number.isInteger(index)) {
          daemonComposeMaterials = daemonComposeMaterials.filter((_, i) => i !== index)
          renderDaemonMode()
        }
        return
      }
      if (event.target.closest('[data-daemon-action="pick-materials"]')) {
        void (async () => {
          if (!window.api?.workbenchPickFiles) {
            toastFn('文件选择暂不可用', 'error')
            return
          }
          try {
            const res = await window.api.workbenchPickFiles({
              title: '选择补充材料',
              multi: true,
            })
            if (!res?.ok || res.canceled) return
            appendDaemonComposeMaterials(res.files || [])
          } catch (error) {
            toastFn(error?.message || '选择文件失败', 'error')
          }
        })()
        return
      }
      if (event.target.closest('[data-daemon-action="compose-reset"]')) {
        daemonComposeIntent = ''
        daemonComposeMaterials = []
        renderDaemonMode()
        return
      }
      if (event.target.closest('[data-daemon-action="compose-submit"]')) {
        void submitDaemonCompose()
      }
    })
    document.addEventListener('click', event => {
      const open = elDaemonModeDetail?.querySelector('.wb-daemon-path-select.is-open')
      if (!open) return
      if (open.contains(event.target)) return
      setDaemonPathMenuOpen(false)
    })
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      if (!elDaemonModeDetail?.querySelector('.wb-daemon-path-select.is-open')) return
      setDaemonPathMenuOpen(false)
    })
    ;['dragenter', 'dragover'].forEach(type => {
      elDaemonModeDetail && elDaemonModeDetail.addEventListener(type, event => {
        const zone = event.target.closest('.wb-daemon-compose-dropzone')
        if (!zone || zone.disabled) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        zone.classList.add('is-dragover')
      })
    })
    elDaemonModeDetail && elDaemonModeDetail.addEventListener('dragleave', event => {
      const zone = event.target.closest('.wb-daemon-compose-dropzone')
      if (!zone) return
      if (zone.contains(event.relatedTarget)) return
      zone.classList.remove('is-dragover')
    })
    elDaemonModeDetail && elDaemonModeDetail.addEventListener('drop', event => {
      const zone = event.target.closest('.wb-daemon-compose-dropzone')
      if (!zone || zone.disabled) return
      event.preventDefault()
      zone.classList.remove('is-dragover')
      const files = Array.from(event.dataTransfer?.files || []).map(file => ({
        path: file.path || '',
        name: file.name || '',
      })).filter(item => item.path)
      if (!files.length) {
        toastFn('未能读取拖入的文件路径', 'error')
        return
      }
      appendDaemonComposeMaterials(files)
    })
    elDaemonModeDetail && elDaemonModeDetail.addEventListener('input', event => {
      const target = event.target
      if (target && target.id === 'wbDaemonComposeIntent') {
        daemonComposeIntent = String(target.value || '')
        const footer = elDaemonModeDetail.querySelector('[data-daemon-action="compose-submit"]')
        if (footer) {
          const hasPath = !!String(selectedDaemonWorkflowId || '').trim()
          footer.disabled = daemonComposeSubmitting || !data.daemon?.online || !hasPath
        }
      }
    })
    elDaemonModeDetail && elDaemonModeDetail.addEventListener('change', event => {
      const target = event.target
      if (target && target.id === 'wbDaemonComposePath') {
        selectedDaemonWorkflowId = String(target.value || '')
        void refreshDaemonComposeLaunchContext(selectedDaemonWorkflowId).then(() => renderDaemonMode())
      }
    })
    elDaemonRunFilters && elDaemonRunFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-daemon-run-filter]')
      if (!button) return
      daemonRunFilter = button.getAttribute('data-daemon-run-filter') || 'all'
      renderDaemonMode()
    })
    const elDaemonTaskSearch = document.getElementById('wbDaemonTaskSearch')
    elDaemonTaskSearch && elDaemonTaskSearch.addEventListener('input', () => {
      daemonTaskQuery = String(elDaemonTaskSearch.value || '')
      renderDaemonMode()
      const again = document.getElementById('wbDaemonTaskSearch')
      if (again) {
        again.focus()
        const len = again.value.length
        again.setSelectionRange(len, len)
      }
    })
    elDaemonRunList && elDaemonRunList.addEventListener('click', event => {
      const button = event.target.closest('[data-task]')
      if (!button) return
      selectedDaemonTaskSlug = button.getAttribute('data-task') || ''
      daemonRunnerLogExpanded = false
      daemonRunnerAgentsExpanded = false
      // 先记下管线来源，再进 run（setWorkbenchPage 会改掉 activeSurface）
      taskRoomReturnState = captureTaskRoomReturnState({
        surface: 'daemon',
        runId: selectedDaemonTaskSlug,
      })
      setWorkbenchPage('tasks')
      void openDaemonTask(selectedDaemonTaskSlug, { returnSurface: 'daemon' })
    })
    elStudioGraph && elStudioGraph.addEventListener('click', event => {
      const action = event.target.closest('[data-studio-remove],[data-studio-duplicate],[data-studio-move]')
      const button = event.target.closest('[data-studio-node]')
      if (action && button) return
      if (!button) {
        if (selectedStudioNodeId) clearStudioSelection()
        return
      }
      selectedStudioNodeId = button.getAttribute('data-studio-node') || ''
      if (studioSimpleMode) renderStudioInspector()
      else renderStudio()
    })
    elStudioGraph && elStudioGraph.addEventListener('click', event => {
      const nodeRoot = event.target.closest('[data-studio-node]')
      const nodeId = nodeRoot?.getAttribute('data-studio-node') || ''
      if (!nodeId) return
      if (event.target.closest('[data-studio-remove]')) {
        event.preventDefault()
        event.stopPropagation()
        deleteStudioNode(nodeId)
        return
      }
      const index = (studioDraft?.nodes || []).findIndex(item => item.id === nodeId)
      if (index < 0) return
      if (event.target.closest('[data-studio-duplicate]')) {
        studioDraft = window.WorkbenchStudioModel.duplicateNode(studioDraft, nodeId)
        selectedStudioNodeId = studioDraft.nodes[index + 1]?.id || nodeId
        renderStudio()
      } else if (event.target.closest('[data-studio-move="up"]')) {
        moveStudioNode(nodeId, index - 1, '[data-studio-move="up"]')
      } else if (event.target.closest('[data-studio-move="down"]')) {
        moveStudioNode(nodeId, index + 1, '[data-studio-move="down"]')
      }
    })
    elStudioGraph && elStudioGraph.addEventListener('contextmenu', event => {
      if (studioSimpleMode) return
      const edge = event.target.closest('[data-studio-edge]')
      const nodeRoot = event.target.closest('[data-studio-node]')
      event.preventDefault()
      if (edge) {
        const edgeId = edge.getAttribute('data-studio-edge') || ''
        selectedStudioEdgeId = edgeId
        selectedStudioNodeId = ''
        renderStudioBoardGraph(studioDraft?.nodes || [])
        showStudioContextMenu(event.clientX, event.clientY, [
          { id: 'delete-edge', label: '删除连线', danger: true },
        ])
        return
      }
      if (nodeRoot) {
        const nodeId = nodeRoot.getAttribute('data-studio-node') || ''
        const kind = nodeRoot.getAttribute('data-studio-kind') || ''
        selectedStudioNodeId = nodeId
        selectedStudioEdgeId = ''
        renderStudio()
        const canDup = ['agent', 'llm', 'tool', 'knowledge'].includes(kind)
        showStudioContextMenu(event.clientX, event.clientY, [
          { id: 'inspect', label: '配置属性' },
          ...(canDup ? [{ id: 'duplicate', label: '复制节点' }] : []),
          { sep: true },
          { id: 'delete-node', label: '删除节点', danger: true, disabled: !studioNodeRemovable(nodeId) },
        ])
        return
      }
      selectedStudioNodeId = ''
      selectedStudioEdgeId = ''
      renderStudioBoardGraph(studioDraft?.nodes || [])
      showStudioContextMenu(event.clientX, event.clientY, [
        { id: 'add-llm', label: '添加大模型' },
        { id: 'add-condition', label: '添加条件' },
        { id: 'add-join', label: '添加汇合' },
      ])
    })
    document.addEventListener('click', event => {
      const menu = document.getElementById('wbStudioCtx')
      if (!menu || menu.hidden) return
      if (menu.contains(event.target)) return
      hideStudioContextMenu()
    })
    document.getElementById('wbStudioCtx')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-studio-ctx]')
      if (!btn) return
      const action = btn.getAttribute('data-studio-ctx')
      hideStudioContextMenu()
      const model = window.WorkbenchStudioModel
      if (action === 'inspect') {
        renderStudio()
        return
      }
      if (action === 'duplicate' && selectedStudioNodeId && model) {
        studioDraft = model.duplicateNode(studioDraft, selectedStudioNodeId)
        selectedStudioNodeId = (studioDraft.nodes || []).at(-1)?.id || selectedStudioNodeId
        renderStudio()
        toastFn('已复制节点')
        return
      }
      if (action === 'delete-node') {
        deleteStudioNode(selectedStudioNodeId)
        return
      }
      if (action === 'delete-edge') {
        deleteStudioEdge(selectedStudioEdgeId)
        return
      }
      if (action === 'add-llm' || action === 'add-condition' || action === 'add-join') {
        const kind = action.replace('add-', '')
        const labels = { llm: '大模型', condition: '条件判断', join: '汇合' }
        const seed = { kind, name: labels[kind] || kind }
        if (kind === 'llm') seed.config = { modelName: 'auto', prompt: '', temperature: '0.2' }
        studioDraft = model.addNode(ensureStudioDraft(), seed)
        selectedStudioNodeId = [...(studioDraft.nodes || [])].reverse().find(item => item.kind === kind)?.id || ''
        renderStudio()
      }
    })
    elStudioGraph && elStudioGraph.addEventListener('keydown', event => {
      const card = event.target.closest('[data-studio-node]')
      if (!card) return
      const nodeId = card.getAttribute('data-studio-node') || ''
      const index = studioDraft.nodes.findIndex(item => item.id === nodeId)
      if (index < 0) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
          event.preventDefault()
          selectedStudioNodeId = nodeId
          renderStudio()
          focusStudioNode(nodeId)
        }
        return
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        const to = event.key === 'ArrowUp' ? index - 1 : index + 1
        if (to < 0 || to >= studioDraft.nodes.length) return
        event.preventDefault()
        moveStudioNode(nodeId, to)
        toastFn(`「${studioDraft.nodes[to]?.name || nodeId}」已移到第 ${to + 1} 步`)
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
        event.preventDefault()
        selectedStudioNodeId = nodeId
        renderStudio()
        focusStudioNode(nodeId)
      }
    })
    elStudioGraph && elStudioGraph.addEventListener('change', event => {
      const relation = event.target.closest('[data-studio-relation]')
      if (!relation) return
      studioDraft = window.WorkbenchStudioModel.updateNode(studioDraft, relation.getAttribute('data-studio-relation'), {
        relation: relation.value,
      })
      if (elStudioGraphMeta) elStudioGraphMeta.textContent = `${studioDraft.nodes.length} 个专家节点 · 有未保存修改`
    })
    elStudioGraph && elStudioGraph.addEventListener('dragstart', event => {
      const node = event.target.closest('[data-studio-node][data-studio-kind="agent"], [data-studio-node].wb-studio-node')
      const kind = event.target.closest('[data-studio-kind]')?.getAttribute('data-studio-kind')
      if (kind && kind !== 'agent') {
        event.preventDefault()
        return
      }
      studioDragNodeId = node?.getAttribute('data-studio-node') || ''
      if (event.dataTransfer && studioDragNodeId) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', studioDragNodeId)
      }
    })
    const elStudioLibrary = document.querySelector('.wb-studio-library')
    elStudioLibrary && elStudioLibrary.addEventListener('click', event => {
      const palette = event.target.closest('[data-studio-palette]')
      if (!palette) return
      const kind = palette.getAttribute('data-studio-palette')
      const model = window.WorkbenchStudioModel
      if (kind === 'start' || kind === 'end') {
        selectedStudioNodeId = kind === 'start'
          ? (window.WorkbenchStudioCanvas?.START_ID || '__start__')
          : (window.WorkbenchStudioCanvas?.END_ID || '__end__')
        renderStudio()
        return
      }
      if (kind === 'agent') {
        openStudioExpertPicker()
        return
      }
      if (!model) return
      const labels = { llm: '大模型', tool: '工具', knowledge: '知识库', condition: '条件判断', join: '汇合', gate: '人工确认' }
      const seed = { kind, name: labels[kind] || kind }
      if (kind === 'llm') {
        seed.config = { modelName: 'auto', prompt: '', temperature: '0.2' }
      }
      studioDraft = model.addNode(ensureStudioDraft(), seed)
      const created = [...studioDraft.nodes].reverse().find(item => item.kind === kind)
      selectedStudioNodeId = created?.id || selectedStudioNodeId
      renderStudio()
    })

    elStudioGraph && elStudioGraph.addEventListener('pointerdown', event => {
      const outPort = event.target.closest('[data-studio-port="out"]')
      if (!outPort || studioSimpleMode) return
      const nodeEl = outPort.closest('[data-studio-node]')
      const fromId = nodeEl?.getAttribute('data-studio-node') || ''
      if (!fromId) return
      event.preventDefault()
      event.stopPropagation()
      studioWireFrom = fromId
      studioWireBranch = outPort.getAttribute('data-studio-branch') || ''
      const fromSide = outPort.getAttribute('data-studio-side') || 'right'
      // 不重绘节点 DOM：否则 pointer 会话中途销毁端口，且中途 hit-test 不稳定
      const board = elStudioGraph.querySelector('[data-studio-board]')
      let preview = elStudioGraph.querySelector('#wbStudioWirePreview')
      if (!preview && board) {
        const svg = board.querySelector('svg.wb-studio-edges')
        if (svg) {
          preview = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          preview.setAttribute('id', 'wbStudioWirePreview')
          preview.setAttribute('class', 'wb-studio-edge is-wiring')
          preview.setAttribute('fill', 'none')
          preview.setAttribute('d', '')
          svg.appendChild(preview)
        }
      }
      const boardRect = board?.getBoundingClientRect()
      if (!boardRect || !preview || !window.WorkbenchStudioCanvas) {
        studioWireFrom = ''
        studioWireBranch = ''
        return
      }
      // getBoundingClientRect already includes viewport scale — convert back to board units
      const scale = studioView.scale || 1
      const portRect = outPort.getBoundingClientRect()
      const x1 = ((portRect.left + portRect.width / 2) - boardRect.left) / scale
      const y1 = ((portRect.top + portRect.height / 2) - boardRect.top) / scale
      const onMove = moveEvent => {
        const rect = board.getBoundingClientRect()
        const x2 = (moveEvent.clientX - rect.left) / scale
        const y2 = (moveEvent.clientY - rect.top) / scale
        const preferTo = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
          ? (x2 >= x1 ? 'left' : 'right')
          : (y2 >= y1 ? 'top' : 'bottom')
        preview.setAttribute(
          'd',
          window.WorkbenchStudioCanvas.edgePathPoints(x1, y1, x2, y2, fromSide, preferTo),
        )
      }
      const resolveDropNodeId = (clientX, clientY) => {
        const stack = (typeof document.elementsFromPoint === 'function'
          ? document.elementsFromPoint(clientX, clientY)
          : [document.elementFromPoint(clientX, clientY)]).filter(Boolean)
        for (const el of stack) {
          if (el.id === 'wbStudioWirePreview' || el.classList?.contains?.('is-wiring')) continue
          const port = el.closest?.('[data-studio-port="in"]')
          if (port) {
            const id = port.closest('[data-studio-node]')?.getAttribute('data-studio-node') || ''
            if (id && id !== fromId) return id
          }
        }
        for (const el of stack) {
          if (el.id === 'wbStudioWirePreview' || el.classList?.contains?.('is-wiring')) continue
          const card = el.closest?.('.wb-studio-flow-node[data-studio-node]')
          const id = card?.getAttribute('data-studio-node') || ''
          if (id && id !== fromId && id !== (window.WorkbenchStudioCanvas?.START_ID || START_NODE_ID)) return id
        }
        // 几何兜底：点是否落在某张节点卡片附近（含端口外扩）
        const cards = [...(board?.querySelectorAll('.wb-studio-flow-node[data-studio-node]') || [])]
        let best = ''
        let bestDist = Infinity
        for (const card of cards) {
          const id = card.getAttribute('data-studio-node') || ''
          if (!id || id === fromId) continue
          if (id === (window.WorkbenchStudioCanvas?.START_ID || START_NODE_ID)) continue
          const r = card.getBoundingClientRect()
          const pad = 18
          const inside = clientX >= r.left - pad && clientX <= r.right + pad
            && clientY >= r.top - pad && clientY <= r.bottom + pad
          if (!inside) continue
          const cx = Math.min(Math.max(clientX, r.left), r.right)
          const cy = Math.min(Math.max(clientY, r.top), r.bottom)
          const dist = Math.hypot(clientX - cx, clientY - cy)
          if (dist < bestDist) {
            bestDist = dist
            best = id
          }
        }
        return best
      }
      const onUp = upEvent => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const toId = resolveDropNodeId(upEvent.clientX, upEvent.clientY)
        const model = window.WorkbenchStudioModel
        if (model && toId && toId !== studioWireFrom) {
          studioDraft = model.connect(studioDraft, studioWireFrom, toId, {
            branch: studioWireBranch,
            label: studioWireBranch === 'true' ? '成立' : (studioWireBranch === 'false' ? '不成立' : ''),
          })
          const upserted = (studioDraft?.edges || []).some(e =>
            e.from === studioWireFrom && e.to === toId
          )
          if (upserted) toastFn('已连接')
          else toastFn('连接失败：不能成环，或目标无效', 'error')
        } else if (studioWireFrom) {
          toastFn('请拖到目标节点或入口端口上松开', 'error')
        }
        studioWireFrom = ''
        studioWireBranch = ''
        preview?.remove?.()
        renderStudio()
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    })

    elStudioGraph && elStudioGraph.addEventListener('pointerdown', event => {
      if (event.target.closest('input, textarea, select, label, button, .wb-studio-nav')) return
      if (studioSimpleMode || event.target.closest('[data-studio-port], [data-studio-remove], [data-studio-duplicate]')) return
      // Pan: 中键 / 空格+左键 / 空白处左键拖动
      const onBlank = !event.target.closest('.wb-studio-flow-node, [data-studio-edge]')
      const wantPan = event.button === 1 || (event.button === 0 && (studioSpaceHeld || onBlank))
      if (wantPan && event.button !== 2) {
        event.preventDefault()
        studioPanning = true
        applyStudioViewTransform()
        const startX = event.clientX
        const startY = event.clientY
        const originTx = studioView.tx
        const originTy = studioView.ty
        const onMove = moveEvent => {
          studioView.tx = originTx + (moveEvent.clientX - startX)
          studioView.ty = originTy + (moveEvent.clientY - startY)
          applyStudioViewTransform()
        }
        const onUp = () => {
          studioPanning = false
          applyStudioViewTransform()
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return
      }
      const nodeEl = event.target.closest('.wb-studio-flow-node')
      if (!nodeEl || !studioDraft || studioDraft.graphMode !== 'free') return
      const nodeId = nodeEl.getAttribute('data-studio-node') || ''
      if (!nodeId) return
      if (event.button !== 0 || studioSpaceHeld) return
      const startX = event.clientX
      const startY = event.clientY
      const originLeft = parseFloat(nodeEl.style.left) || 0
      const originTop = parseFloat(nodeEl.style.top) || 0
      const scale = studioView.scale || 1
      let moved = false
      const onMove = moveEvent => {
        const dx = (moveEvent.clientX - startX) / scale
        const dy = (moveEvent.clientY - startY) / scale
        if (Math.abs(dx) + Math.abs(dy) < 3 && !moved) return
        moved = true
        nodeEl.style.left = `${Math.max(0, originLeft + dx)}px`
        nodeEl.style.top = `${Math.max(0, originTop + dy)}px`
        // Live rewire: update edge paths while dragging for softer feedback
        if (window.WorkbenchStudioCanvas && studioDraft?.edges) {
          const byId = new Map()
          elStudioGraph.querySelectorAll('.wb-studio-flow-node[data-studio-node]').forEach(el => {
            const id = el.getAttribute('data-studio-node')
            byId.set(id, {
              id,
              x: parseFloat(el.style.left) || 0,
              y: parseFloat(el.style.top) || 0,
              w: el.offsetWidth || 220,
              h: el.offsetHeight || 112,
            })
          })
          elStudioGraph.querySelectorAll('[data-studio-edge]').forEach(path => {
            const edgeId = path.getAttribute('data-studio-edge') || ''
            const edge = (studioDraft.edges || []).find(e => e.id === edgeId || `e-${e.from}-${e.to}` === edgeId)
            if (!edge) return
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return
            path.setAttribute('d', window.WorkbenchStudioCanvas.edgePath(from, to))
          })
        }
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (!moved) return
        studioDraft = window.WorkbenchStudioModel.updatePosition(
          studioDraft,
          nodeId,
          parseFloat(nodeEl.style.left) || 0,
          parseFloat(nodeEl.style.top) || 0,
        )
        renderStudioBoardGraph(studioDraft.nodes)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    })

    if (elStudioGraph && !studioViewHandlersBound) {
      studioViewHandlersBound = true
      elStudioGraph.addEventListener('wheel', event => {
        if (studioSimpleMode || !elStudioGraph.classList.contains('wb-studio-graph--canvas')) return
        // 滚轮缩放；Shift+滚轮横向平移
        if (event.shiftKey) {
          event.preventDefault()
          studioView.tx -= event.deltaY
          applyStudioViewTransform()
          return
        }
        event.preventDefault()
        const factor = event.deltaY > 0 ? 1 - STUDIO_SCALE_STEP : 1 + STUDIO_SCALE_STEP
        setStudioScale(studioView.scale * factor, event.clientX, event.clientY)
      }, { passive: false })
      elStudioGraph.addEventListener('click', event => {
        const zoom = event.target.closest('[data-studio-zoom]')
        if (!zoom) return
        event.preventDefault()
        const action = zoom.getAttribute('data-studio-zoom')
        if (action === 'in') setStudioScale(studioView.scale + STUDIO_SCALE_STEP)
        else if (action === 'out') setStudioScale(studioView.scale - STUDIO_SCALE_STEP)
        else if (action === 'fit') resetStudioView({ fit: true })
        else resetStudioView()
      })
      window.addEventListener('keydown', event => {
        if (event.code === 'Space' && !event.repeat) {
          const tag = String(document.activeElement?.tagName || '').toLowerCase()
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) return
          if (!elStudioSurface?.classList.contains('active')) return
          studioSpaceHeld = true
          applyStudioViewTransform()
          event.preventDefault()
        }
      })
      window.addEventListener('keyup', event => {
        if (event.code === 'Space') {
          studioSpaceHeld = false
          applyStudioViewTransform()
        }
      })
    }

    elStudioGraph && elStudioGraph.addEventListener('click', event => {
      const edge = event.target.closest('[data-studio-edge]')
      if (!edge) return
      selectedStudioEdgeId = edge.getAttribute('data-studio-edge') || ''
      selectedStudioNodeId = ''
      renderStudioBoardGraph(studioDraft?.nodes || [])
      toastFn('已选中连线，Delete 可删除')
    })

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (studioExpertPickerEl && !studioExpertPickerEl.hidden) {
          closeStudioExpertPicker()
          return
        }
        hideStudioContextMenu()
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (studioSimpleMode) return
      if (!elStudioSurface?.classList.contains('active')) return
      const tag = String(document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) return
      if (!selectedStudioEdgeId && !selectedStudioNodeId) return
      event.preventDefault()
      deleteStudioSelection()
    })

    elStudioGraph && elStudioGraph.addEventListener('dragover', event => {
      event.preventDefault()
      elStudioGraph.classList.add('is-dragover')
      if (event.dataTransfer) event.dataTransfer.dropEffect = studioDragNodeId ? 'move' : 'copy'
    })
    elStudioGraph && elStudioGraph.addEventListener('dragleave', event => {
      if (!elStudioGraph.contains(event.relatedTarget)) elStudioGraph.classList.remove('is-dragover')
    })
    elStudioGraph && elStudioGraph.addEventListener('drop', event => {
      event.preventDefault()
      elStudioGraph.classList.remove('is-dragover')
      const targetPosition = Number(event.target.closest('[data-studio-position]')?.getAttribute('data-studio-position'))
      const at = Number.isFinite(targetPosition) ? targetPosition : studioDraft.nodes.length
      if (studioDragNodeId && studioDraft.nodes.some(item => item.id === studioDragNodeId)) {
        studioDraft = window.WorkbenchStudioModel.moveNode(studioDraft, studioDragNodeId, at)
      } else {
        const id = studioDragAgentId || event.dataTransfer?.getData('text/plain')
        const agent = studioAgentCandidates().find(item => item.id === id)
        if (agent) {
          studioDraft = window.WorkbenchStudioModel.addAgent(ensureStudioDraft(), agent, at)
          selectedStudioNodeId = studioDraft.nodes[Math.min(at, studioDraft.nodes.length - 1)]?.id || ''
        }
      }
      studioDragNodeId = ''
      studioDragAgentId = ''
      renderStudio()
    })

    elStudioInspector && elStudioInspector.addEventListener('input', event => {
      if (event.target.matches('[data-studio-skill-filter]')) {
        filterStudioSkills(event.target.value)
        return
      }
      syncStudioInspectorState()
    })
    elStudioInspector && elStudioInspector.addEventListener('change', event => {
      syncStudioInspectorState()
      const field = event.target.getAttribute?.('data-studio-field')
      const config = event.target.getAttribute?.('data-studio-config')
      if (field === 'relation' || field === 'requiresApproval' || field === 'inputSpec' || field === 'outputSpec' || field === 'intent' || field === 'name' || config) {
        if (!studioSimpleMode) renderStudioBoardGraph(studioDraft?.nodes || [])
      }
    })
    elStudioInspector && elStudioInspector.addEventListener('click', event => {
      const ioAdd = event.target.closest('[data-studio-io-add]')
      if (ioAdd) {
        syncStudioWorkflowInspectorState()
        const model = window.WorkbenchStudioModel
        if (!model || !studioDraft) return
        const kind = ioAdd.getAttribute('data-studio-io-add')
        const list = Array.isArray(studioDraft[kind === 'output' ? 'outputs' : 'inputs'])
          ? studioDraft[kind === 'output' ? 'outputs' : 'inputs']
          : []
        const next = [...list, {
          id: `${kind}-${list.length + 1}`,
          label: '',
          type: 'text',
          required: kind !== 'output',
          example: '',
          options: [],
        }]
        studioDraft = model.updateDraft(studioDraft, kind === 'output' ? { outputs: next } : { inputs: next })
        renderStudioInspector()
        const lastRow = [...(elStudioInspector.querySelectorAll(`[data-studio-io-row="${kind}"]`) || [])].at(-1)
        lastRow?.querySelector(`[data-studio-io="${kind}:label"]`)?.focus()
        return
      }
      const ioRemove = event.target.closest('[data-studio-io-remove]')
      if (ioRemove) {
        syncStudioWorkflowInspectorState()
        const model = window.WorkbenchStudioModel
        if (!model || !studioDraft) return
        const kind = ioRemove.getAttribute('data-studio-io-remove')
        const row = ioRemove.closest(`[data-studio-io-row="${kind}"]`)
        const rows = [...(elStudioInspector.querySelectorAll(`[data-studio-io-row="${kind}"]`) || [])]
        const removeAt = Math.max(0, rows.indexOf(row))
        const key = kind === 'output' ? 'outputs' : 'inputs'
        const list = Array.isArray(studioDraft[key]) ? studioDraft[key] : []
        if (!list.length) return
        const next = list.filter((_, index) => index !== removeAt)
        studioDraft = model.updateDraft(studioDraft, { [key]: next })
        renderStudioInspector()
        return
      }
      if (event.target.closest('[data-studio-open-skills]')) {
        openCapabilityPicker('skills')
        return
      }
      const button = event.target.closest('[data-studio-tune-agent]')
      if (!button) return
      syncStudioInspectorState()
      openCapabilityPicker('experts')
    })
    elStudioActions && elStudioActions.addEventListener('click', event => {
      const action = event.target.closest('[data-studio-action]')?.getAttribute('data-studio-action')
      if (action === 'save') void openStudioSaveConfirm()
      if (action === 'run') void previewCheckStudioGraph()
    })
    elStudioTools && elStudioTools.addEventListener('click', event => {
      const action = event.target.closest('[data-studio-action]')?.getAttribute('data-studio-action')
      if (action === 'toggle-mode') {
        studioSimpleMode = !studioSimpleMode
        saveStudioSimpleModePreference(studioSimpleMode)
        renderStudio()
        return
      }
      const tool = event.target.closest('[data-studio-tool]')?.getAttribute('data-studio-tool')
      if (!tool || studioSimpleMode) return
      if (tool === 'auto-layout') {
        runStudioAutoLayout()
      }
    })
    elStudioTitle && elStudioTitle.addEventListener('click', event => {
      event.preventDefault()
      beginStudioTitleEdit()
    })
    elStudioTitleInput && elStudioTitleInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitStudioTitleEdit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelStudioTitleEdit()
      }
    })
    elStudioTitleInput && elStudioTitleInput.addEventListener('blur', () => {
      if (elStudioTitleInput.hidden) return
      commitStudioTitleEdit()
    })
    const teamAssetsPanel = document.getElementById('wbTeamAssetsPanel')
    teamAssetsPanel && teamAssetsPanel.addEventListener('click', event => {
      const button = event.target.closest('[data-team-asset-action]')
      if (!button) return
      const action = button.getAttribute('data-team-asset-action')
      const profileCard = event.target.closest('[data-team-profile]')
      const workflowCard = event.target.closest('[data-team-workflow]')
      if (action === 'add') {
        openAgentPicker()
        return
      }
      if (action === 'profile' && profileCard) {
        openCapabilityPicker('experts')
        return
      }
      if (action === 'detail' && profileCard) {
        openAgentDetail(profileCard.getAttribute('data-team-profile'))
        return
      }
      if (workflowCard) {
        const workflowId = workflowCard.getAttribute('data-team-workflow')
        if (action === 'graph') openSavedWorkflowGraph(workflowById(workflowId), pendingGoal)
        else {
          runInputItem = workflowById(workflowId) || null
          openLaunchDrawer({ resourceType: 'pipeline', resourceId: workflowId, step: 'inputs' })
        }
      }
    })
    elAutomationList && elAutomationList.addEventListener('click', async e => {
      const card = e.target.closest('[data-automation]')
      const button = e.target.closest('[data-auto-action]')
      if (!card || !button) return
      if (!window.api) return
      const id = card.getAttribute('data-automation')
      const action = button.getAttribute('data-auto-action')
      if (!id || !action) return
      if (action === 'toggle' && window.api.workbenchAutomationToggle) {
        const item = (data.automation && data.automation.jobs || []).find(job => job.id === id)
        const nextEnabled = item ? item.enabled === false : true
        const res = await window.api.workbenchAutomationToggle(id, nextEnabled)
        if (!res || !res.ok) {
          toastFn((res && res.error) || '更新自动化状态失败', 'error')
          return
        }
        await refreshAutomation()
        toastFn(nextEnabled ? '自动化已启用' : '自动化已停用', 'success')
        return
      }
      if (action === 'run' && window.api.workbenchAutomationRunNow) {
        const res = await window.api.workbenchAutomationRunNow(id)
        if (!res || !res.ok) {
          toastFn((res && res.error) || '触发执行失败', 'error')
          return
        }
        if (res.launchRequest) {
          await ingestLaunchRequest(res.launchRequest, {
            executionSource: 'automation',
            returnState: { automationJobId: id },
          })
          await launchPreparedIntent()
        } else {
          toastFn((res && res.message) || '已提交执行', 'success')
        }
        await refreshAutomation()
        return
      }
      if (action === 'edit') {
        const item = (data.automation && data.automation.jobs || []).find(job => job.id === id)
        if (!item) return
        await openAutomationModal(draftFromJob(item))
        return
      }
      if (action === 'delete' && window.api.workbenchAutomationDelete) {
        const ok = window.confirm('确认删除该自动化？删除后不可恢复。')
        if (!ok) return
        const res = await window.api.workbenchAutomationDelete(id)
        if (!res || !res.ok) {
          toastFn((res && res.error) || '删除自动化失败', 'error')
          return
        }
        await refreshAutomation()
        toastFn('自动化已删除', 'success')
      }
    })
    elAutomationTemplates && elAutomationTemplates.addEventListener('click', async e => {
      const button = e.target.closest('[data-auto-template-action="create"]')
      if (!button) return
      const templateId = button.getAttribute('data-auto-template') || ''
      const template = templateById(templateId)
      await openAutomationModal(defaultDraft(template))
    })
    btnAutomationNew && btnAutomationNew.addEventListener('click', async () => {
      await openAutomationModal(defaultDraft())
    })
    elAutomationModalBody && elAutomationModalBody.addEventListener('change', async e => {
      const target = e.target
      if (target && target.id === 'wbAutoScheduleType') scheduleRowsVisibility()
      if (target && target.id === 'wbAutoUserTargetInput') syncTargetPickerId('user')
      if (target && target.id === 'wbAutoGroupTargetInput') syncTargetPickerId('chat')
      if (target && (target.id === 'wbAutoPushMiniApp' || target.id === 'wbAutoPushBot')) {
        pushTargetRowsVisibility()
        const needUser = target.id === 'wbAutoPushMiniApp' && target.checked
        const needGroup = target.id === 'wbAutoPushBot' && target.checked
        try {
          if (needUser) {
            const items = await fetchFeishuTargetOptions('user', '')
            feishuTargetOptions.users = items
            fillTargetPicker('user', items, '输入姓名/邮箱并从下拉建议中选择')
          }
          if (needGroup) {
            const items = await fetchFeishuTargetOptions('chat', '')
            feishuTargetOptions.chats = items
            fillTargetPicker('chat', items, '输入群名并从下拉建议中选择')
          }
        } catch (error) {
          toastFn(error.message || '读取飞书目标失败', 'error')
        }
      }
    })
    elAutomationModalBody && elAutomationModalBody.addEventListener('input', e => {
      const target = e.target
      if (!target) return
      const isUserQuery = target.id === 'wbAutoUserTargetInput'
      const isGroupQuery = target.id === 'wbAutoGroupTargetInput'
      if (!isUserQuery && !isGroupQuery) return
      const userEnabled = !!elAutomationModalBody.querySelector('#wbAutoPushMiniApp')?.checked
      const groupEnabled = !!elAutomationModalBody.querySelector('#wbAutoPushBot')?.checked
      if ((isUserQuery && !userEnabled) || (isGroupQuery && !groupEnabled)) return
      const mode = isUserQuery ? 'user' : 'chat'
      const query = String(target.value || '').trim()
      if (isUserQuery) feishuTargetOptions.userQuery = query
      else feishuTargetOptions.chatQuery = query
      syncTargetPickerId(mode)
      if (feishuTargetQueryTimer) clearTimeout(feishuTargetQueryTimer)
      feishuTargetQueryTimer = setTimeout(async () => {
        try {
          const items = await fetchFeishuTargetOptions(mode, query)
          if (mode === 'user') {
            feishuTargetOptions.users = items
            fillTargetPicker('user', items, '输入姓名/邮箱并从下拉建议中选择')
          } else {
            feishuTargetOptions.chats = items
            fillTargetPicker('chat', items, '输入群名并从下拉建议中选择')
          }
        } catch (error) {
          toastFn(error.message || '读取飞书目标失败', 'error')
        }
      }, 280)
    })
    btnAutomationModalClose && btnAutomationModalClose.addEventListener('click', () => closeAutomationModal())
    btnAutomationModalCancel && btnAutomationModalCancel.addEventListener('click', () => closeAutomationModal())
    btnAutomationModalSave && btnAutomationModalSave.addEventListener('click', async () => saveAutomationModal())
    elAutomationModal && elAutomationModal.addEventListener('click', e => {
      if (e.target === elAutomationModal) closeAutomationModal()
    })
    wireDaemonWorkspaceUi()
    elRunner && elRunner.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-review-tab]')
      if (tabBtn && run.mode === 'daemon') {
        void switchDaemonReviewTab(tabBtn.getAttribute('data-review-tab'))
        return
      }
      const progressPreview = e.target.closest('[data-progress-preview]')
      if (progressPreview && elDaemonReviewBody && elDaemonReviewBody.contains(progressPreview)) {
        const md = elDaemonReviewBody.querySelector('.wb-daemon-progress-md')
        openDaemonProgressPreview(md)
        return
      }
      const logsToggle = e.target.closest('[data-logs-toggle]')
      if (logsToggle && elDaemonReviewBody && elDaemonReviewBody.contains(logsToggle)) {
        const pane = logsToggle.getAttribute('data-logs-toggle')
        if (pane === 'progress') daemonProgressCollapsed = !daemonProgressCollapsed
        else if (pane === 'logs') daemonLogsCollapsed = !daemonLogsCollapsed
        else return
        const collapsed = pane === 'progress' ? daemonProgressCollapsed : daemonLogsCollapsed
        const block = logsToggle.closest('.wb-daemon-review-logs-block')
        if (block) block.classList.toggle('is-collapsed', collapsed)
        logsToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
        const foldLabel = collapsed ? '展开' : '收起'
        const label = pane === 'progress'
          ? (collapsed ? '展开全部过程' : '收起全部过程')
          : (collapsed ? '展开运行日志' : '收起运行日志')
        logsToggle.setAttribute('aria-label', label)
        logsToggle.setAttribute('title', foldLabel)
        const body = block?.querySelector('.wb-daemon-review-logs-body')
        if (body) body.hidden = collapsed
        return
      }
      const stepBack = e.target.closest('[data-step-detail-back]')
      if (stepBack && elDaemonReviewBody && elDaemonReviewBody.contains(stepBack)) {
        daemonReviewStepId = ''
        renderDaemonReview()
        return
      }
      const stepCard = e.target.closest('[data-step-id]')
      if (stepCard && elDaemonReviewBody && elDaemonReviewBody.contains(stepCard)) {
        daemonReviewStepId = stepCard.getAttribute('data-step-id') || ''
        renderDaemonReview()
        return
      }
      const reviewAction = e.target.closest('[data-run-action]')
      if (reviewAction && elDaemonReview && elDaemonReview.contains(reviewAction)) {
        handleRunAction(reviewAction.getAttribute('data-run-action'))
        return
      }
      const artifactBtn = e.target.closest('[data-artifact-path],[data-artifact-url],[data-artifact-reuse]')
      if (artifactBtn && elDaemonReviewBody && elDaemonReviewBody.contains(artifactBtn)) {
        const reuseButton = artifactBtn.closest('[data-artifact-reuse]')
        if (reuseButton) {
          const index = Number(reuseButton.getAttribute('data-artifact-reuse'))
          if (Number.isInteger(index) && index >= 0) void reuseRunArtifact(index)
          return
        }
        void (async () => {
          if (!window.api) return
          const url = artifactBtn.getAttribute('data-artifact-url')
          if (url && window.api.openExternal) {
            const res = await window.api.openExternal(url)
            if (!res || !res.ok) toastFn((res && (res.message || res.error)) || '无法打开远程制品', 'error')
            return
          }
          if (!window.api.workbenchDaemonArtifactOpen) return
          const path = artifactBtn.getAttribute('data-artifact-path')
          if (!path) return
          const res = await openDaemonArtifactPath(path)
          if (!res || !res.ok) {
            const hint = res && res.reason === 'not-generated'
              ? '该产物尚未生成或未同步'
              : ((res && res.error) || '无法打开产物')
            toastFn(hint, 'error')
          }
        })()
        return
      }
      const toggle = e.target.closest('[data-daemon-runner-toggle]')
      if (!toggle || run.mode !== 'daemon') return
      const kind = toggle.getAttribute('data-daemon-runner-toggle')
      if (kind === 'log') {
        daemonRunnerLogExpanded = !daemonRunnerLogExpanded
        renderRunLog()
        return
      }
      if (kind === 'agents') {
        daemonRunnerAgentsExpanded = !daemonRunnerAgentsExpanded
        renderTaskContext()
      }
    })
    elRunnerActions && elRunnerActions.addEventListener('click', e => {
      const button = e.target.closest('[data-run-action]')
      if (button) handleRunAction(button.getAttribute('data-run-action'))
    })
    elRunGraph && elRunGraph.addEventListener('click', e => {
      const button = e.target.closest('[data-run-action]')
      if (button) handleRunAction(button.getAttribute('data-run-action'))
    })
    elRunNextAction && elRunNextAction.addEventListener('click', e => {
      const button = e.target.closest('[data-run-action]')
      if (button) handleRunAction(button.getAttribute('data-run-action'))
    })
    elRunArtifacts && elRunArtifacts.addEventListener('click', async e => {
      const reuseButton = e.target.closest('[data-artifact-reuse]')
      if (reuseButton) {
        const index = Number(reuseButton.getAttribute('data-artifact-reuse'))
        if (Number.isInteger(index) && index >= 0) await reuseRunArtifact(index)
        return
      }
      const button = e.target.closest('[data-artifact-path],[data-artifact-url]')
      if (!button || !window.api) return
      const url = button.getAttribute('data-artifact-url')
      if (url && window.api.openExternal) {
        const res = await window.api.openExternal(url)
        if (!res || !res.ok) toastFn((res && (res.message || res.error)) || '无法打开远程制品', 'error')
        return
      }
      if (!window.api.workbenchDaemonArtifactOpen) return
      const path = button.getAttribute('data-artifact-path')
      if (!path) return
      const res = await openDaemonArtifactPath(path)
      if (!res || !res.ok) {
        const hint = res && res.reason === 'not-generated'
          ? '该产物尚未生成或未同步'
          : ((res && res.error) || '无法打开产物')
        toastFn(hint, 'error')
      }
    })
    btnModalClose && btnModalClose.addEventListener('click', () => closeModal())
    btnModalCancel && btnModalCancel.addEventListener('click', () => closeModal())
    btnModalConfirm && btnModalConfirm.addEventListener('click', () => confirmModal())
    elModal && elModal.addEventListener('click', e => {
      const saveGraph = e.target.closest('[data-save-graph]')
      if (saveGraph) {
        saveAgentGraphAsWorkflow()
        return
      }
      const tuneButton = e.target.closest('[data-agent-tune-capability]')
      if (tuneButton) {
        openCapabilityPicker('experts')
        return
      }
      const agentRunButton = e.target.closest('[data-agent-run]')
      if (agentRunButton) {
        startAgentContinuation(agentRunButton.getAttribute('data-agent-run'))
        return
      }
      const suggest = e.target.closest('[data-intent-suggest]')
      if (suggest) {
        const intentEl = document.getElementById('wbRunGoalInput')
        if (intentEl) {
          intentEl.value = suggest.getAttribute('data-intent-suggest') || ''
          intentEl.focus()
          intentEl.setSelectionRange(intentEl.value.length, intentEl.value.length)
        }
        return
      }
      if (e.target === elModal) closeModal()
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && workflowDeleteResolve) {
        workflowDeleteResolve(false)
        return
      }
      if (e.key === 'Escape' && leaveChoiceResolve) {
        leaveChoiceResolve('cancel')
        return
      }
      if (e.key === 'Escape' && taskManageEl && !taskManageEl.hidden) {
        closeTaskManageModal()
        return
      }
      if (e.key === 'Escape' && taskComposerEl && !taskComposerEl.hidden) {
        if (!taskComposerEl.querySelector('#wbTaskComposerExpertMenu')?.hidden) {
          setTaskComposerExpertMenuOpen(taskComposerEl, false)
          return
        }
        closeTaskComposer()
        return
      }
      if (e.key === 'Escape' && elAutomationModal && !elAutomationModal.hidden) {
        closeAutomationModal()
        return
      }
      if (e.key === 'Escape' && elModal && !elModal.hidden) closeModal()
    })
    if (window.api && window.api.onWorkbenchStreamChunk) {
      window.api.onWorkbenchStreamChunk(chunk => {
        if (chunk && chunk.dispatchId === run.dispatchId) updateDispatchLog(chunk.dispatchId, chunk.text)
      })
    }
    if (window.api && typeof window.api.onWorkbenchDaemonLogEvent === 'function') {
      window.api.onWorkbenchDaemonLogEvent(event => {
        handleDaemonLogEvent(event || {})
      })
    }
    if (window.api && typeof window.api.onWorkbenchTaskScheduleDue === 'function') {
      window.api.onWorkbenchTaskScheduleDue(payload => {
        void handleTaskScheduleDue(payload || {})
      })
    }
    if (window.api && window.api.onWorkbenchAuthChanged) {
      window.api.onWorkbenchAuthChanged(auth => {
        handleWorkbenchAuthChanged(auth)
      })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && loaded) refreshAuthFromServer()
    })
    window.addEventListener('knowme-drawer-closed', event => {
      const kind = String(event?.detail?.kind || '')
      if (kind === 'capability-hub' || kind === 'capability-hub-detail') {
        void resumeStudioExpertPickerFromHub()
      }
    })
    window.addEventListener('knowme-daemon-hitl-submitted', () => {
      if (run.mode === 'daemon' && run.slug) {
        for (const id of [...announcedAttentionIds]) {
          if (id.startsWith(`daemon:${run.slug}:`)) clearTaskAttention(id)
        }
        void refreshDaemonTask(false)
      }
    })
    window.addEventListener('knowme-attention-activate', event => {
      const link = event?.detail?.deepLink
      if (link?.type === 'daemon-task' && link.slug) {
        void openDaemonTask(link.slug, { silent: true })
      }
    })
    window.addEventListener('knowme-daemon-open-process-logs', () => {
      if (run.mode === 'daemon') void switchDaemonReviewTab('logs')
    })
  }

  function init(opts = {}) {
    if (opts.toast) toastFn = opts.toast
    if (typeof opts.onViewChange === 'function') onViewChange = opts.onViewChange
    if (typeof opts.onPageChange === 'function') onPageChange = opts.onPageChange
    if (typeof opts.onExpertTaskStart === 'function') onExpertTaskStart = opts.onExpertTaskStart
    if (typeof opts.onExpertTaskResume === 'function') onExpertTaskResume = opts.onExpertTaskResume
    grabDom()
    if (!elShelfSurface) return
    studioSimpleMode = loadStudioSimpleModePreference()
    shelfQuery = ''
    if (elShelfSearch) elShelfSearch.value = ''
    syncShelfFilterChips()
    setSurface('taskhome', { force: true })
    setRunStage('input')
    renderModeOverview()
    bind()
    if (window.StickyIcons) window.StickyIcons.mount(document.getElementById('workbench'))
  }

  function ensureLoaded() {
    if (!loaded) load()
  }

  function openPage(page) {
    setWorkbenchPage(page, { force: true })
    if (page === 'automation') refreshAutomation()
  }

  async function startDaemonFromHandoff(handoff, session = null) {
    if (!handoff || !handoff.ok || handoff.blocked) {
      toastFn((handoff && handoff.error) || '无法交接任务', 'error')
      return handoff
    }
    const item = (data.daemon && data.daemon.workflows || []).find(w => w.id === handoff.workflow)
      || { id: handoff.workflow, name: handoff.workflowName || handoff.workflow }
    if (!item || !item.id) {
      toastFn('管线服务工作流不可用', 'error')
      return { ok: false, error: 'workflow_missing' }
    }
    setWorkbenchPage('tasks', { force: true })
    const res = await window.api.workbenchDaemonStart({
      workflow: handoff.workflow,
      slug: handoff.slug,
      intent: handoff.intent,
      context: handoff.context,
    })
    if (!res || !res.ok) {
      if (handleDaemonAuthFailure(res)) return res
      toastFn((res && res.error) || '任务启动失败', 'error')
      return res
    }
    run = emptyRun()
    run.mode = 'daemon'
    run.workflow = item
    run.slug = res.slug
    run.intent = handoff.intent
    run.context = handoff.context
    run.contextSummary = res.contextSummary || ''
    run.status = (res.job && res.job.state) || 'queued'
    run.taskTrace = buildTaskTrace({
      context: handoff.context,
      handoff,
      session,
      slug: res.slug,
      workflow: handoff.workflow,
    })
    addLog('游戏需求已交接', `${res.slug} · ${handoff.workflow}`)
    renderRunner()
    await refreshDaemonTask(false)
    return { ok: true, slug: res.slug, taskTrace: run.taskTrace }
  }

  function previewTaskTrace(input = {}) {
    run.taskTrace = buildTaskTrace(input)
    renderTaskTracePanel()
    return run.taskTrace
  }

  return {
    init,
    ensureLoaded,
    load,
    refreshModes,
    selectMode,
    resetRun,
    openPage,
    openAgentDetail,
    startDaemonFromHandoff,
    startExpertTaskDirect,
    previewTaskTrace,
    updateExpertTaskRoom,
    getRunTrace: () => run.taskTrace || null,
  }
})()
