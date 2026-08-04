'use strict'

/**
 * Workbench（工作台 · 用户侧）：
 *   上半 — 岗位配套 Agent 助手（只读角色卡）
 *   下半 — 本机 workbench 服务的岗位工作流与真实任务
 *   服务离线时保留当前 Git 仓库模板作为只读预览
 */
window.Workbench = (function () {
  let toastFn = (m) => console.log('[workbench]', m)
  let onViewChange = () => {}
  let onPageChange = () => {}
  let loaded = false
  let data = {
    root: '', repo: null, agents: [], workflows: [], repoError: '',
    daemon: { online: false, workflows: [], tasks: [], hint: '', auth: { state: 'disabled' } },
    automation: { jobs: [], templates: [] },
  }
  let teamExpanded = false
  let workflowExpanded = false
  let taskExpanded = false
  let activeContentPage = 'workflow'
  let activePage = 'home'
  let btnTabHome, btnTabTasks, btnTabAutomation, elHomePage, elTaskPage, elAutomationPage
  let contentTabButtons = []
  let contentPages = []
  let elTeam, elTeamList, btnTeamToggle, elWorkflowList, elWorkflowAllList, elWorkflowBrowser, elWorkflowSearch, elWorkflowRecommendHead, elWorkflowSections, elWorkflowRecommendSection, elWorkflowDailySection, elWorkflowDailyList, elWorkflowFrequentSection, elWorkflowFrequentList, elWorkflowOtherSection, elWorkflowOtherList, elStartPanel, btnWorkflowToggle, elHeadSub, btnReload
  let elDaemonStatus, elTaskList, elRecentPanel, btnTaskToggle
  let elAutomationList, elAutomationTemplates, elAutomationHint, btnAutomationNew
  let elAutomationModal, elAutomationModalTitle, elAutomationModalBody, elAutomationModalHint, btnAutomationModalClose, btnAutomationModalCancel, btnAutomationModalSave
  let elStatService, elStatWorkflows, elStatTasks, elStatAgents
  let elTodoForm, elTodoInput, elTodoList, elTodoCount, elTodoClear
  let elRunner, elRunnerTitle, elRunnerMeta, elRunnerLog, elRunnerActions
  let elRunGoal, elRunStatus, elRunNextAction, elRunProgress, elRunAgents, elRunGraph, elRunArtifacts, elRunTrace, elHeadTitle
  let elModal, elModalTitle, elModalBody, elModalHint, btnModalClose, btnModalCancel, btnModalConfirm
  let run = emptyRun()
  let modal = emptyModal()
  let pollTimer = null
  const TODO_STORAGE_KEY = 'knowme.workbench.todos.v1'
  const INTENT_TEMPLATES = {
    product: [
      '梳理「{workflow}」的核心需求与约束，给出优先级和验收标准',
      '明确「{workflow}」的目标用户、成功指标与最小可交付范围',
      '输出「{workflow}」的执行计划：里程碑、风险与协作分工',
    ],
    frontend: [
      '完成「{workflow}」前端实现方案，列出交互状态、接口契约和边界条件',
      '针对「{workflow}」落地页面与组件结构，给出可直接开发的任务拆分',
      '围绕「{workflow}」补齐 UI 细节与异常态，确保体验闭环可验收',
    ],
    backend: [
      '设计「{workflow}」后端方案，明确数据模型、接口定义和错误处理',
      '完成「{workflow}」服务改造清单：实现步骤、回滚点与监控项',
      '梳理「{workflow}」性能与稳定性风险，给出可执行的优化计划',
    ],
    qa: [
      '为「{workflow}」制定测试方案，覆盖主流程、异常流和回归范围',
      '列出「{workflow}」上线前的质量门禁与验证步骤',
      '输出「{workflow}」可复现的测试用例与验收结论模板',
    ],
    devops: [
      '为「{workflow}」准备发布计划：环境检查、灰度策略与回滚预案',
      '梳理「{workflow}」运行监控与告警规则，确保问题可观测',
      '整理「{workflow}」部署依赖与执行脚本，给出最短上线路径',
    ],
    research: [
      '调研「{workflow}」相关资料，提炼结论并给出可执行建议',
      '汇总「{workflow}」上下文与限制条件，输出决策对比清单',
      '回答「{workflow}」关键问题，并标注依据与不确定项',
    ],
    general: [
      '明确「{workflow}」的任务目标、交付物和完成标准',
      '拆解「{workflow}」为可执行步骤，并标注负责人与预计耗时',
      '识别「{workflow}」风险与依赖，制定下一步推进策略',
    ],
  }
  let todos = []
  let workflowQuery = ''
  let automationDraft = null
  let automationConnectors = []
  let feishuTargetOptions = { users: [], chats: [], userQuery: '', chatQuery: '' }
  let feishuTargetQueryTimer = null

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  function shortDateTime(iso) {
    const t = new Date(iso || 0).getTime()
    if (!t) return ''
    try {
      return new Date(t).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  function workbenchTaskStateLabel(state) {
    const key = String(state || 'idle').trim().toLowerCase()
    if (key === 'running') return '进行中'
    if (key === 'queued' || key === 'pending') return '排队中'
    if (key === 'done' || key === 'success' || key === 'completed') return '已完成'
    if (key === 'failed' || key === 'error') return '执行失败'
    if (key === 'blocked') return '已阻塞'
    return '等待中'
  }

  function workbenchTaskMeta(task = {}) {
    const parts = [workbenchTaskStateLabel(task.state)]
    const updated = shortDateTime(task.updatedAt || task.finishedAt || task.createdAt)
    if (updated) parts.push(`更新于 ${updated}`)
    return parts.join(' · ')
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
      context: null,
      contextSummary: '',
      task: null,
      artifacts: [],
      projection: null,
      taskTrace: null,
    }
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
      elRunTrace.innerHTML = '<span class="wb-run-muted">任务追溯将在场景 Skill 或 Daemon 交接后显示</span>'
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

  function contextText(value) {
    return String(value == null ? '' : value).trim()
  }

  function contextList(value) {
    if (Array.isArray(value)) return value.map(contextText).filter(Boolean)
    return contextText(value)
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  function resolveDaemonContextDisplay(workflowId) {
    const saved = loadDaemonContext(workflowId)
    const savedWorkspace = saved.workspace || {}
    const savedInputs = saved.inputs || {}
    const savedOutputs = saved.outputs || {}
    const defaults = modal.contextDefaults || {}
    const defaultWorkspace = defaults.workspace || {}
    const defaultInputs = defaults.inputs || {}
    const defaultOutputs = defaults.outputs || {}
    const defaultResources = contextList(defaultInputs.resources)
    const savedResources = contextList(savedInputs.resources)
    return {
      workspace: {
        projectId: contextText(defaultWorkspace.projectId || savedWorkspace.projectId),
        ref: contextText(defaultWorkspace.ref || savedWorkspace.ref),
        commit: contextText(defaultWorkspace.commit || savedWorkspace.commit),
      },
      inputs: {
        root: contextText(defaultInputs.root || savedInputs.root),
        prd: contextText(defaultInputs.prd || savedInputs.prd),
        resources: defaultResources.length ? defaultResources : savedResources,
      },
      outputs: {
        root: contextText(defaultOutputs.root || savedOutputs.root),
      },
    }
  }

  function readDaemonContext(item, slug) {
    const projectId = String(document.getElementById('wbDaemonProject')?.value || '').trim()
    const ref = String(document.getElementById('wbDaemonRef')?.value || '').trim()
    const commit = String(document.getElementById('wbDaemonCommit')?.value || '').trim()
    const root = String(document.getElementById('wbDaemonInputRoot')?.value || '').trim()
    const prd = String(document.getElementById('wbDaemonPrd')?.value || '').trim()
    const resources = String(document.getElementById('wbDaemonResources')?.value || '').trim()
    const outputRoot = String(document.getElementById('wbDaemonOutputRoot')?.value || '').trim()
    if (![projectId, ref, commit, root, prd, resources, outputRoot].some(Boolean)) return null
    return {
      protocolVersion: '1',
      requestId: `knowme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      workspace: { provider: 'gitlab', projectId, ref, commit },
      inputs: { root, prd, resources: resources.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) },
      outputs: { root: outputRoot, mode: 'gitlab' },
      slug: String(slug || ''),
      workflow: String(item && item.id || ''),
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
      error: '',
      daemon: false,
      kind: 'workflow',
    }
  }

  function grabDom() {
    btnTabHome = document.getElementById('wbTabHome')
    btnTabTasks = document.getElementById('wbTabTasks')
    btnTabAutomation = document.getElementById('wbTabAutomation')
    elHomePage = document.getElementById('wbHomePage')
    elTaskPage = document.getElementById('wbTaskPage')
    elAutomationPage = document.getElementById('wbAutomationPage')
    contentTabButtons = [...document.querySelectorAll('[data-wb-content-tab]')]
    contentPages = [...document.querySelectorAll('[data-wb-content-page]')]
    elTeam = document.getElementById('wbTeam')
    elTeamList = document.getElementById('wbTeamList')
    btnTeamToggle = document.getElementById('wbTeamToggle')
    elWorkflowList = document.getElementById('wbWorkflowList')
    elWorkflowAllList = document.getElementById('wbWorkflowAllList')
    elWorkflowBrowser = document.getElementById('wbWorkflowBrowser')
    elWorkflowSearch = document.getElementById('wbWorkflowSearch')
    elWorkflowRecommendHead = document.getElementById('wbWorkflowRecommendHead')
    elWorkflowSections = document.getElementById('wbWorkflowSections')
    elWorkflowRecommendSection = document.getElementById('wbWorkflowRecommendSection')
    elWorkflowDailySection = document.getElementById('wbWorkflowDailySection')
    elWorkflowDailyList = document.getElementById('wbWorkflowDailyList')
    elWorkflowFrequentSection = document.getElementById('wbWorkflowFrequentSection')
    elWorkflowFrequentList = document.getElementById('wbWorkflowFrequentList')
    elWorkflowOtherSection = document.getElementById('wbWorkflowOtherSection')
    elWorkflowOtherList = document.getElementById('wbWorkflowOtherList')
    elStartPanel = document.getElementById('wbStartPanel')
    btnWorkflowToggle = document.getElementById('wbWorkflowToggle')
    elHeadSub = document.getElementById('wbHeadSub')
    elHeadTitle = document.getElementById('wbHeadTitle')
    btnReload = document.getElementById('wbReload')
    elDaemonStatus = document.getElementById('wbDaemonStatus')
    elTaskList = document.getElementById('wbTaskList')
    elRecentPanel = document.getElementById('wbRecentPanel')
    btnTaskToggle = document.getElementById('wbTaskToggle')
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
    elStatService = document.getElementById('wbStatService')
    elStatWorkflows = document.getElementById('wbStatWorkflows')
    elStatTasks = document.getElementById('wbStatTasks')
    elStatAgents = document.getElementById('wbStatAgents')
    elTodoForm = document.getElementById('wbTodoForm')
    elTodoInput = document.getElementById('wbTodoInput')
    elTodoList = document.getElementById('wbTodoList')
    elTodoCount = document.getElementById('wbTodoCount')
    elTodoClear = document.getElementById('wbTodoClear')
    elRunner = document.getElementById('wbRunner')
    elRunnerTitle = document.getElementById('wbRunnerTitle')
    elRunnerMeta = document.getElementById('wbRunnerMeta')
    elRunnerLog = document.getElementById('wbRunnerLog')
    elRunnerActions = document.getElementById('wbRunnerActions')
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
  }

  function setWorkbenchPage(page, { force = false } = {}) {
    const next = page === 'tasks' || page === 'automation' ? page : 'home'
    if (!force && activePage === next) return
    activePage = next
    const isTask = activePage === 'tasks'
    const isAutomation = activePage === 'automation'
    if (btnTabHome) {
      const on = !isTask && !isAutomation
      btnTabHome.classList.toggle('active', on)
      btnTabHome.setAttribute('aria-selected', on ? 'true' : 'false')
    }
    if (btnTabTasks) {
      btnTabTasks.classList.toggle('active', isTask)
      btnTabTasks.setAttribute('aria-selected', isTask ? 'true' : 'false')
    }
    if (btnTabAutomation) {
      btnTabAutomation.classList.toggle('active', isAutomation)
      btnTabAutomation.setAttribute('aria-selected', isAutomation ? 'true' : 'false')
    }
    if (elHomePage) elHomePage.classList.toggle('active', !isTask && !isAutomation)
    if (elTaskPage) elTaskPage.classList.toggle('active', isTask)
    if (elAutomationPage) elAutomationPage.classList.toggle('active', isAutomation)
    if (!run.workflow && elHeadTitle) {
      elHeadTitle.textContent = isAutomation ? '自动化中心' : '工作台'
    }
    onPageChange(activePage)
    scheduleContentDisclosures()
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
    if (elAutomationHint) {
      elAutomationHint.textContent = '自动化在本机执行；关闭电脑或退出客户端后将无法按计划触发'
    }
    elAutomationList.innerHTML = jobs.length
      ? jobs.map(job => {
        const status = String(job.lastStatus || 'idle').toLowerCase()
        const state = automationStatusLabel(status)
        return `
        <article class="wb-automation-card ${esc(status)}" data-automation="${esc(job.id)}">
          <header class="wb-automation-card-head">
            <h3>${esc(job.name || '未命名自动化')}</h3>
            <span class="wb-automation-pill ${job.enabled === false ? 'paused' : 'active'}">${job.enabled === false ? '已关闭' : '已启用'}</span>
          </header>
          <div class="wb-automation-meta">触发：${esc(job.scheduleLabel || '未配置')}</div>
          <div class="wb-automation-meta">上次：${esc(job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '未执行')} · ${esc(state)}</div>
          <div class="wb-automation-meta">下次：${esc(job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '等待计算')}</div>
          <div class="wb-automation-actions">
            <button type="button" class="wb-run-btn" data-auto-action="toggle">${job.enabled === false ? '启用' : '停用'}</button>
            <button type="button" class="wb-run-btn" data-auto-action="run">立即执行</button>
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
      elAutomationModalHint.textContent = '自动化在本机执行；关闭电脑或退出客户端后将无法按计划触发。'
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
    const payload = {
      name,
      workspaceId: String(elAutomationModalBody.querySelector('#wbAutoWorkspace')?.value || '').trim(),
      prompt,
      connectorId: String(elAutomationModalBody.querySelector('#wbAutoConnector')?.value || '').trim(),
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

  function setWorkbenchContentPage(page, { force = false } = {}) {
    const next = page === 'todo' || page === 'recent' ? page : 'workflow'
    if (!force && activeContentPage === next) return
    activeContentPage = next
    contentTabButtons.forEach(button => {
      const on = button.dataset.wbContentTab === activeContentPage
      button.classList.toggle('active', on)
      button.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    contentPages.forEach(pageEl => {
      pageEl.classList.toggle('active', pageEl.dataset.wbContentPage === activeContentPage)
    })
    if (activePage === 'tasks') scheduleContentDisclosures()
  }

  function todoApi() {
    return window.api && window.api.workbenchTodoList ? window.api : null
  }

  /** 旧版本待办写在 localStorage，首次运行搬进用户数据目录后清掉本地副本 */
  function legacyTodos() {
    try {
      const saved = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]')
      return Array.isArray(saved) ? saved.filter(item => item && typeof item.text === 'string') : []
    } catch {
      return []
    }
  }

  function applyTodoResult(res) {
    if (!res || !res.ok) {
      if (res && res.error) toastFn(res.error, 'error')
      return false
    }
    todos = Array.isArray(res.items) ? res.items : []
    renderTodos()
    return true
  }

  async function loadTodos() {
    const api = todoApi()
    if (!api) {
      todos = legacyTodos()
      renderTodos()
      return
    }
    const legacy = legacyTodos()
    if (legacy.length && api.workbenchTodoImportLegacy) {
      const migrated = await api.workbenchTodoImportLegacy(legacy)
      try { localStorage.removeItem(TODO_STORAGE_KEY) } catch {}
      if (applyTodoResult(migrated)) return
    }
    applyTodoResult(await api.workbenchTodoList())
  }

  function renderTodos() {
    if (!elTodoList) return
    const remaining = todos.filter(item => !item.done).length
    const doneCount = todos.length - remaining
    if (elTodoCount) {
      elTodoCount.textContent = todos.length && !remaining
        ? '今天都完成了'
        : `${remaining} 项未完成`
    }
    if (elTodoClear) elTodoClear.hidden = doneCount === 0
    if (!todos.length) {
      elTodoList.innerHTML = '<div class="wb-todo-empty">今天还没有待办<br>先记下一件真正重要的事</div>'
      return
    }
    elTodoList.innerHTML = todos.map(item => `
      <div class="wb-todo-item${item.done ? ' done' : ''}" data-todo="${esc(item.id)}">
        <button class="wb-todo-check" type="button" data-todo-action="toggle" aria-label="${item.done ? '标记为未完成' : '标记为完成'}">
          <span class="ico" data-icon="check"></span>
        </button>
        <span class="wb-todo-text" title="${esc(item.text)}">${esc(item.text)}</span>
        <button class="wb-todo-delete" type="button" data-todo-action="delete" aria-label="删除待办">
          <span class="ico" data-icon="trash"></span>
        </button>
      </div>
    `).join('')
    if (window.StickyIcons) window.StickyIcons.mount(elTodoList)
  }

  async function addTodo(text) {
    const value = String(text || '').trim()
    if (!value) return
    const api = todoApi()
    if (!api) {
      todos = [{ id: `local-${Date.now()}`, text: value.slice(0, 80), done: false }, ...todos]
      renderTodos()
      return
    }
    applyTodoResult(await api.workbenchTodoAdd(value))
  }

  async function handleTodoAction(id, action) {
    const api = todoApi()
    if (!api) return
    if (action === 'delete') applyTodoResult(await api.workbenchTodoRemove(id))
    if (action === 'toggle') applyTodoResult(await api.workbenchTodoToggle(id))
  }

  async function clearDoneTodos() {
    const api = todoApi()
    if (!api || !api.workbenchTodoClearDone) return
    applyTodoResult(await api.workbenchTodoClearDone())
  }

  function agentById(id) {
    return data.agents.find(a => a.id === id) || null
  }

  function workflowById(id) {
    return activeWorkflows().find(w => w.id === id) || null
  }

  function activeWorkflows() {
    return data.daemon && data.daemon.online ? data.daemon.workflows : data.workflows
  }

  function workflowText(workflow) {
    return [
      workflow && workflow.id,
      workflow && workflow.name,
      workflow && workflow.description,
      Array.isArray(workflow && workflow.tags) ? workflow.tags.join(' ') : '',
    ].filter(Boolean).join(' ').toLowerCase()
  }

  function filterWorkflows(workflows) {
    const query = String(workflowQuery || '').trim().toLowerCase()
    if (!query) return workflows
    return workflows.filter(workflow => workflowText(workflow).includes(query))
  }

  function workflowUsageRank() {
    const recentTasks = data.daemon && Array.isArray(data.daemon.tasks) ? data.daemon.tasks : []
    const rank = new Map()
    let weight = recentTasks.length + 5
    for (const task of recentTasks) {
      const id = String(task && task.workflow || '')
      if (!id) continue
      if (!rank.has(id)) rank.set(id, weight)
      weight -= 1
    }
    return rank
  }

  function workflowFlags(workflow) {
    const tags = Array.isArray(workflow && workflow.tags)
      ? workflow.tags.map(tag => String(tag).toLowerCase())
      : []
    const category = String(workflow && workflow.category || '').toLowerCase()
    const blob = `${workflow && workflow.id || ''} ${workflowText(workflow)}`.toLowerCase()
    const has = pattern => tags.some(tag => pattern.test(tag)) || pattern.test(category) || pattern.test(blob)
    return {
      recommended: has(/推荐|recommended|featured|优先/),
      daily: has(/日常|daily|routine/),
    }
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

  function categorizeWorkflows(workflows) {
    const list = filterWorkflows(workflows)
    const rank = workflowUsageRank()
    const items = list.map((workflow, index) => ({
      workflow,
      index,
      rank: rank.get(workflow.id) || 0,
      flags: workflowFlags(workflow),
    }))
    const picked = new Set()
    const take = (predicate, limit = Infinity) => {
      const out = []
      const sorted = [...items].sort((a, b) => (b.rank - a.rank) || (a.index - b.index))
      for (const item of sorted) {
        if (picked.has(item.workflow.id)) continue
        if (!predicate(item)) continue
        out.push(item.workflow)
        picked.add(item.workflow.id)
        if (out.length >= limit) break
      }
      return out
    }

    let recommended = take(item => item.flags.recommended, 3)
    if (recommended.length < 3) {
      recommended = recommended.concat(take(item => item.rank > 0, 3 - recommended.length))
    }
    if (recommended.length < 3) {
      recommended = recommended.concat(take(() => true, 3 - recommended.length))
    }
    recommended.forEach(w => picked.add(w.id))

    const daily = take(item => item.flags.daily, 4)
    const frequent = take(item => item.rank > 0, 4)
    const other = list.filter(workflow => !picked.has(workflow.id))
    return { recommended, daily, frequent, other, all: list }
  }

  function recommendedWorkflows(workflows) {
    return categorizeWorkflows(workflows).recommended
  }

  function agentsById() {
    return Object.fromEntries(data.agents.map(agent => [agent.id, agent]))
  }

  function hasChinese(value) {
    return /[\u3400-\u9fff]/.test(String(value || ''))
  }

  function englishAgentName(agent) {
    const title = String(agent.title || agent.id || 'Agent').trim()
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

  function inferRoleKey(text) {
    const semantic = String(text || '').toLowerCase()
    if (/(story|product|producer|leader|需求|产品|方案|澄清)/.test(semantic)) return 'product'
    if (/(qa|test|测试|验收|回归|黑盒)/.test(semantic)) return 'qa'
    if (/(devops|ops|部署|发布|运维|灰度|监控|告警)/.test(semantic)) return 'devops'
    if (/(research|query|search|调研|问答|检索|分析)/.test(semantic)) return 'research'
    if (/(frontend|front-end|front|fe|前端|页面|ui|交互)/.test(semantic)) return 'frontend'
    if (/(backend|back-end|back|be|后端|接口|数据库|服务端|api)/.test(semantic)) return 'backend'
    return 'general'
  }

  function roleLabelByKey(key) {
    return {
      product: '产品需求负责人',
      frontend: '前端研发工程师',
      backend: '后端研发工程师',
      qa: '测试架构师',
      devops: '后端运维工程师',
      research: '项目问答助手',
      general: '智能专家',
    }[key] || '智能专家'
  }

  function workflowRoleSignals(workflow) {
    if (!workflow || !Array.isArray(workflow.nodes) || !workflow.nodes.length) return []
    const byId = agentsById()
    const entryId = workflow.entryNode || (workflow.nodes[0] && workflow.nodes[0].id)
    const entry = workflow.nodes.find(node => node.id === entryId) || workflow.nodes[0]
    const signals = [
      workflow.name,
      workflow.id,
      workflow.description,
      Array.isArray(workflow.tags) ? workflow.tags.join(' ') : '',
    ]
    if (entry) {
      signals.push(entry.id, entry.type, entry.intent, entry.nodeKey)
      if (entry.agent && byId[entry.agent]) {
        const agent = byId[entry.agent]
        signals.push(agent.id, agent.title, agent.persona && agent.persona.role)
      } else {
        signals.push(entry.agent)
      }
    }
    return signals.filter(Boolean).map(String)
  }

  function inferIntentContext(item, workflow) {
    const signals = [
      item && item.name,
      item && item.id,
      item && item.description,
      item && Array.isArray(item.tags) ? item.tags.join(' ') : '',
    ]
    const workflowSignals = workflowRoleSignals(workflow)
    const key = inferRoleKey([...signals, ...workflowSignals].join(' '))
    const role = roleLabelByKey(key)
    const workflowName = String(
      (workflow && (workflow.name || workflow.id)) ||
      (item && (item.name || item.id)) ||
      '当前流程'
    ).trim()
    const templates = INTENT_TEMPLATES[key] || INTENT_TEMPLATES.general
    return {
      role,
      suggestions: templates.map(text => text.replaceAll('{workflow}', workflowName)).slice(0, 3),
    }
  }

  function summarizeIntentSuggestion(text) {
    const source = String(text || '').trim()
    const withoutWorkflow = source.replace(/^.*?「[^」]+」\s*/, '').replace(/^\s*的\s*/, '')
    const keywords = withoutWorkflow
      .split(/[，,；;：:]/)
      .flatMap(part => part
        .replace(/^\s*(?:列出|给出|明确|确保|覆盖|补齐|形成|输出|提炼|说明|制定|评估|识别|验证|保留|整理)\s*/, '')
        .split(/[、/]/)
        .flatMap(item => item.split(/\s*和\s*/))
      )
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 3)
    return keywords.join(' · ') || source
  }

  function renderHelpButton(id, label, content) {
    return `
      <span class="wb-help-wrap">
        <button type="button" class="wb-help-trigger" data-help-toggle aria-expanded="false" aria-controls="${escAttr(id)}" aria-label="${escAttr(label)}" title="${escAttr(label)}">?</button>
        <span class="wb-help-popover" id="${escAttr(id)}" data-help-popover role="tooltip" hidden>${esc(content)}</span>
      </span>`
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
    stopPolling()
    const workflow = keepWorkflow ? run.workflow : null
    run = emptyRun()
    if (workflow && model()) {
      run.workflow = workflow
      run.graph = model().buildWorkflowGraph(workflow)
      run.currentId = workflow.entryNode
      run.status = 'ready'
    }
    renderWorkflows()
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

  function localWaiting() {
    const daemon = daemonWaiting()
    if (daemon.gate || daemon.clarification) return daemon
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
      statusTone: brief ? brief.tone : (run.status === 'done' ? 'done' : 'running'),
      statusHeadline: brief ? brief.headline : (run.status === 'done' ? '任务已完成' : '正在执行'),
      currentNode: brief ? brief.currentNodeLabel : (rawNode || (run.status === 'done' ? '已完成' : '流程执行中')),
      currentOwner: (projection && projection.currentOwner) || '',
      degraded,
      degradedReason: (projection && projection.degradedReason) || '',
      agents,
      artifacts,
      inputs,
      waitingKind: brief ? brief.waitingKind : 'none',
      waitingTitle: brief ? brief.waitingTitle : '',
      waitingDetail: brief ? brief.waitingDetail : '',
      nextAction: brief ? brief.nextAction : '',
      approver: brief ? brief.approver : '',
      factualBrief: brief ? brief.factualBrief : '',
    }
  }

  function syncTaskView() {
    const active = !!run.workflow
    if (elHeadTitle) elHeadTitle.textContent = active ? '任务工作间' : '工作台'
    syncHeadActionButton(active)
    if (active) {
      // 即使内部 activePage 已经是 tasks，也要强制通知外层同步布局状态。
      // 否则 runner 已渲染，但 workspace 的 workbench-task-active 类仍可能缺失，
      // 导致流程目录头部和工作流 Tab 与任务工作间同时出现。
      setWorkbenchPage('tasks', { force: true })
      setWorkbenchContentPage('workflow')
    }
    onViewChange(active, active ? workbenchTaskContext() : {})
  }

  function syncHeadActionButton(inTaskRoom) {
    if (!btnReload) return
    const icon = btnReload.querySelector('.ico')
    if (inTaskRoom) {
      btnReload.title = '返回上一级'
      btnReload.setAttribute('aria-label', '返回上一级')
      if (icon) icon.setAttribute('data-icon', 'chevronLeft')
    } else {
      btnReload.title = '刷新助手'
      btnReload.setAttribute('aria-label', '刷新')
      if (icon) icon.setAttribute('data-icon', 'refresh')
    }
    if (window.StickyIcons) window.StickyIcons.mount(btnReload)
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
        workflows: [],
        repoError: (res && res.error) || '请检查当前 Git 仓库',
        daemon: { online: false, workflows: [], tasks: [], hint: '本机工作服务不可用' },
        automation: { jobs: [], templates: [] },
      }
      closeModal()
      resetRun()
      renderTeam()
      renderWorkflows()
      renderAutomation()
      return
    }
    data = {
      root: res.root || '',
      repo: res.repo || null,
      agents: Array.isArray(res.agents) ? res.agents : [],
      workflows: Array.isArray(res.workflows) ? res.workflows : [],
      repoError: res.repoError || '',
      daemon: res.daemon && typeof res.daemon === 'object'
        ? {
            ...res.daemon,
            workflows: Array.isArray(res.daemon.workflows) ? res.daemon.workflows : [],
            tasks: Array.isArray(res.daemon.tasks) ? res.daemon.tasks : [],
          }
        : { online: false, workflows: [], tasks: [], hint: '本机工作服务不可用' },
      automation: res.automation && typeof res.automation === 'object'
        ? {
            jobs: Array.isArray(res.automation.jobs) ? res.automation.jobs : [],
            templates: Array.isArray(res.automation.templates) ? res.automation.templates : [],
          }
        : { jobs: [], templates: [] },
    }
    closeModal()
    resetRun()
    renderTeam()
    renderWorkflows()
    renderAutomation()
  }

  function renderTeam() {
    if (!elTeamList) return
    if (elStatAgents) elStatAgents.textContent = String(data.agents.length)
    if (elHeadSub) {
      // 首页 hero 已经给出专家与工作流数量，副标题只在加载异常时说话，
      // 也不再暴露内容来源仓库名。
      elHeadSub.textContent = data.agents.length
        ? ''
        : (data.repoError ? '专家资料未加载' : '')
    }
    if (data.repoError && !data.agents.length) {
      elTeamList.innerHTML = '<div class="wb-empty"><strong>暂时没能读到专家资料</strong>请稍后点击右上角刷新重试</div>'
      scheduleTeamDisclosure()
      return
    }
    if (!data.agents.length) {
      elTeamList.innerHTML = '<div class="wb-empty"><strong>还没有可用的专家</strong>连接工作服务后即可看到可调度的专家</div>'
      scheduleTeamDisclosure()
      return
    }
    elTeamList.innerHTML = data.agents.map(a => {
      const chineseRole = chineseRoleName(a)
      const englishName = englishAgentName(a)
      const roleIcon = roleIconName(a)
      const description = agentSummary(a, chineseRole)
      const capabilities = agentCapabilities(a)
      return `<button type="button" class="wb-agent-card" data-agent="${esc(a.id)}" aria-label="查看${esc(chineseRole)}详情">
        <span class="wb-agent-head">
          <span class="wb-agent-avatar" aria-hidden="true"><span class="ico" data-icon="${roleIcon}"></span></span>
          <span class="wb-agent-copy">
            <span class="wb-agent-name">${esc(chineseRole)}</span>
            <span class="wb-agent-role">${esc(englishName)}</span>
          </span>
        </span>
        <span class="wb-agent-desc">${esc(description)}</span>
        <span class="wb-agent-skills" aria-label="擅长">
          ${capabilities.map(tag => `<span class="wb-agent-skill">${esc(tag)}</span>`).join('')}
        </span>
      </button>`
    }).join('')
    if (window.StickyIcons) window.StickyIcons.mount(elTeamList)
    scheduleTeamDisclosure()
  }

  function scheduleTeamDisclosure() {
    // 首页在隐藏状态完成首次渲染时，Electron 可能暂停 rAF；先同步折叠，再在可见帧校准列数。
    syncTeamDisclosure()
    if (window.requestAnimationFrame) window.requestAnimationFrame(syncTeamDisclosure)
  }

  function syncTeamDisclosure() {
    if (!elTeam || !elTeamList || !btnTeamToggle) return
    const count = data.agents.length
    const visibleLimit = gridColumnCount(elTeamList) * 2
    const hasMore = count > visibleLimit
    if (!hasMore) teamExpanded = false
    // 按整行隐藏而不是裁切高度：裁切会在折叠边缘留下半张卡片，看起来像渲染故障
    const cards = [...elTeamList.querySelectorAll('.wb-agent-card')]
    cards.forEach((card, index) => {
      card.classList.toggle('is-folded', !teamExpanded && hasMore && index >= visibleLimit)
    })
    elTeam.classList.toggle('expanded', teamExpanded)
    btnTeamToggle.hidden = !hasMore
    btnTeamToggle.setAttribute('aria-expanded', String(teamExpanded))
    const text = btnTeamToggle.querySelector('.wb-team-toggle-text')
    if (text) text.textContent = teamExpanded ? '收起专家' : `查看全部 ${count} 位专家`
  }

  function gridColumnCount(list) {
    return Math.max(
      1,
      window.getComputedStyle(list).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    )
  }

  function scheduleContentDisclosures() {
    const sync = () => {
      syncWorkflowDisclosure()
      syncTaskDisclosure()
    }
    if (window.requestAnimationFrame) window.requestAnimationFrame(sync)
    else sync()
  }

  function syncWorkflowDisclosure() {
    if (!elStartPanel || !elWorkflowList || !btnWorkflowToggle) return
    const workflows = activeWorkflows()
    const count = workflows.length
    const searching = !!String(workflowQuery || '').trim()
    const categories = categorizeWorkflows(workflows)
    const showFlat = searching || workflowExpanded
    // 默认只保留推荐入口；其余流程通过“查看全部流程”按需展开，
    // 避免目录把最近运行区域推到首屏以下。
    const hasMore = count > categories.recommended.length
    if (!hasMore && !searching) workflowExpanded = false
    elStartPanel.classList.toggle('expanded', workflowExpanded)
    if (elWorkflowSections) elWorkflowSections.hidden = showFlat || !!run.workflow
    if (elWorkflowBrowser) elWorkflowBrowser.hidden = !count || !!run.workflow
    if (elWorkflowAllList) elWorkflowAllList.hidden = !showFlat || !!run.workflow
    btnWorkflowToggle.hidden = !hasMore || !!run.workflow || searching
    btnWorkflowToggle.setAttribute('aria-expanded', String(workflowExpanded))
    const text = btnWorkflowToggle.querySelector('.wb-list-toggle-text')
    if (text) text.textContent = workflowExpanded ? '收起流程' : '查看全部流程'
  }

  function syncTaskDisclosure() {
    if (!elRecentPanel || !elTaskList || !btnTaskToggle) return
    const count = data.daemon && Array.isArray(data.daemon.tasks) ? data.daemon.tasks.length : 0
    const hasMore = count > gridColumnCount(elTaskList) * 2
    if (!hasMore) taskExpanded = false
    elTaskList.classList.toggle('limited', count > 0)
    elRecentPanel.classList.toggle('expanded', taskExpanded)
    btnTaskToggle.hidden = !hasMore || !!run.workflow
    btnTaskToggle.setAttribute('aria-expanded', String(taskExpanded))
    const text = btnTaskToggle.querySelector('.wb-list-toggle-text')
    if (text) text.textContent = taskExpanded ? '收起运行' : '展开更多'
  }

  function workflowCatalogSummary(workflow) {
    const name = String(workflow && (workflow.name || workflow.id) || '').trim()
    const explicit = String(workflow && (workflow.summary || workflow.purpose) || '').trim()
    const internal = /(?:→|->|gate[-_\s]|plan[-_\s]|storyleader|proto|chunk|test-plan|node[-_]|script|agent)/i
    if (explicit && !internal.test(explicit)) return explicit
    return name
      ? `用于「${name}」的完整工作流，选择后查看流程说明与执行拓扑`
      : '选择后查看流程说明与执行拓扑'
  }

  function renderWorkflowCard(w, daemon) {
    return `
      <button type="button" class="wb-workflow-card" data-workflow="${esc(w.id || '')}"${w.locked ? ' disabled title="当前体验档未授权此流程"' : ''}>
        <div class="wb-workflow-icon" aria-hidden="true"><span class="ico" data-icon="workflow"></span></div>
        <div class="wb-workflow-copy">
          <div class="wb-workflow-name">${esc(w.name || w.id || '未命名工作流')}</div>
          <div class="wb-workflow-desc">${esc(workflowCatalogSummary(w))}</div>
        </div>
        <span class="ico wb-workflow-go" data-icon="chevronRight" aria-hidden="true"></span>
      </button>
    `
  }

  function mountWorkflowCards(root) {
    if (!root) return
    if (window.StickyIcons) window.StickyIcons.mount(root)
  }

  function renderWorkflows() {
    if (!elWorkflowList) return
    const daemon = data.daemon || { online: false, workflows: [], tasks: [] }
    const workflows = activeWorkflows()
    const categories = categorizeWorkflows(workflows)
    const searching = !!String(workflowQuery || '').trim()
    if (elStatService) {
      elStatService.textContent = daemon.online ? '在线' : '离线'
      elStatService.classList.toggle('online', !!daemon.online)
      elStatService.classList.toggle('offline', !daemon.online)
    }
    if (elStatWorkflows) elStatWorkflows.textContent = String(workflows.length)
    if (elStatTasks) elStatTasks.textContent = String(daemon.tasks.length)
    if (elDaemonStatus) {
      const auth = daemonAuth()
      const authPending = auth.authEnabled && auth.state === 'required'
      elDaemonStatus.classList.toggle('online', !!daemon.online && !authPending)
      elDaemonStatus.classList.toggle('offline', !daemon.online || authPending)
      let text = daemon.online ? '服务已连接' : '离线模式 · 仅可浏览'
      if (authPending) text = '需要 Workbench 授权'
      else if (auth.configured && auth.user) text = `已授权 · ${auth.user}`
      const label = elDaemonStatus.querySelector('.wb-daemon-text')
      if (label) label.textContent = text
      elDaemonStatus.title = authPending
        ? '点击配置 Workbench 授权后再启动任务'
        : (daemon.online ? '工作服务已连接，可以启动工作流' : '点击查看如何连接工作服务')
    }
    if (elTaskList) {
      elTaskList.hidden = !!run.workflow
      elTaskList.innerHTML = daemon.tasks.length
        ? daemon.tasks.map(task => {
          const state = String(task.state || 'idle').toLowerCase()
          const meta = workbenchTaskMeta(task)
          const stateLabel = workbenchTaskStateLabel(task.state)
          const taskTitle = task.intent || task.workflow || '最近运行'
          return `
        <button type="button" class="wb-task-chip ${esc(state)}" data-task="${esc(task.slug)}" title="${esc(taskTitle)}">
          <span class="wb-task-state-dot" aria-hidden="true"></span>
          <span class="wb-task-copy">
            <span class="wb-task-name">${esc(taskTitle)}</span>
            <span class="wb-task-intent">${esc(meta)}</span>
          </span>
          <span class="wb-task-state">${esc(stateLabel)}</span>
        </button>
      `
        }).join('')
        : '<div class="wb-task-empty">暂无运行记录，从上方选择一个工作流开始</div>'
    }
    if (!workflows.length) {
      const fallback = daemon.online
        ? '服务端当前没有可用岗位流程'
        : (data.repoError || '当前仓库没有可预览的流程模板')
      if (elWorkflowSections) elWorkflowSections.hidden = true
      elWorkflowList.innerHTML = `<div class="wb-template-empty"><strong>暂无可用工作流</strong>${esc(fallback)}</div>`
      if (elWorkflowDailyList) elWorkflowDailyList.innerHTML = ''
      if (elWorkflowFrequentList) elWorkflowFrequentList.innerHTML = ''
      if (elWorkflowOtherList) elWorkflowOtherList.innerHTML = ''
      if (elWorkflowAllList) elWorkflowAllList.innerHTML = ''
      scheduleContentDisclosures()
      return
    }

    const renderCards = list => list.map(w => renderWorkflowCard(w, daemon)).join('')
    if (searching || workflowExpanded) {
      if (elWorkflowSections) elWorkflowSections.hidden = true
      if (elWorkflowAllList) {
        elWorkflowAllList.innerHTML = categories.all.length
          ? renderCards(categories.all)
          : '<div class="wb-template-empty"><strong>没有匹配的流程</strong>请尝试更短关键词，例如“需求”或“前端”</div>'
        mountWorkflowCards(elWorkflowAllList)
      }
    } else {
      if (elWorkflowSections) elWorkflowSections.hidden = !!run.workflow
      elWorkflowList.innerHTML = categories.recommended.length
        ? renderCards(categories.recommended)
        : renderCards(categories.all.slice(0, 3))
      mountWorkflowCards(elWorkflowList)
      if (elWorkflowDailySection && elWorkflowDailyList) {
        elWorkflowDailySection.hidden = true
        elWorkflowDailyList.innerHTML = categories.daily.length ? renderCards(categories.daily) : ''
        mountWorkflowCards(elWorkflowDailyList)
      }
      if (elWorkflowFrequentSection && elWorkflowFrequentList) {
        elWorkflowFrequentSection.hidden = true
        elWorkflowFrequentList.innerHTML = categories.frequent.length ? renderCards(categories.frequent) : ''
        mountWorkflowCards(elWorkflowFrequentList)
      }
      if (elWorkflowOtherSection && elWorkflowOtherList) {
        elWorkflowOtherSection.hidden = true
        elWorkflowOtherList.innerHTML = categories.other.length ? renderCards(categories.other) : ''
        mountWorkflowCards(elWorkflowOtherList)
      }
      if (elWorkflowAllList) elWorkflowAllList.innerHTML = ''
    }
    scheduleContentDisclosures()
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

  function renderRunLog() {
    if (!elRunnerLog) return
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
        || '无法确认执行步骤。当前激活内容源可能与该工作流不匹配（请确认源内是否有 .cursor/workflows/）。'
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
    if (!countable.length) return run.status === 'done' ? '已完成' : '执行中'
    const statuses = countable.map((node, index) => nodeVisualStatus(node, index, countable))
    const done = statuses.filter(status => status === 'done').length
    if (statuses.includes('error')) return `需要处理 · 已完成 ${done}/${countable.length} 步`
    if (run.status === 'done') return `已完成 ${countable.length}/${countable.length} 步 · 100%`
    return `已完成 ${done}/${countable.length} 步 · ${Math.round((done / countable.length) * 100)}%`
  }

  function nodeVisualStatus(node, index, nodes) {
    if (node.status) {
      const status = String(node.status).toLowerCase()
      if (['done', 'completed', 'finished', 'success'].includes(status)) return 'done'
      if (['running', 'active', 'current', 'waiting'].includes(status)) return 'active'
      if (['failed', 'error', 'rejected'].includes(status)) return 'error'
    }
    if (run.status === 'done') return 'done'
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

  function renderTaskContext() {
    if (!run.workflow) return
    const context = workbenchTaskContext()
    const nodes = graphNodes()
    const isDone = run.status === 'done'
    const degraded = !!context.degraded
    // 降级态优先表达「任务是否已结束」这个事实，避免把已完成任务渲染成故障。
    const tone = degraded
      ? (isDone ? 'done' : 'muted')
      : (context.statusTone || (isDone ? 'done' : 'running'))
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
      elRunStatus.className = `wb-run-status tone-${tone}`
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
      elRunAgents.innerHTML = hasAgents
        ? context.agents.map(name => {
          const active = owner && name === owner
          return `<span class="wb-run-agent${active ? ' is-active' : ''}">${esc(name)}${active ? ' · 当前' : ''}</span>`
        }).join('')
        : '<span class="wb-run-muted">等待流程加载参与角色…</span>'
      // 降级且无角色时收起本节，说明已在状态卡里给出，无需重复占位。
      toggleRunSection(elRunAgents, !(degraded && !hasAgents))
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
        ? run.artifacts.slice(0, 8).map(item => {
          const label = item.name || item.path || item.title || item
          const path = item.path || item.full_path || item.fullPath || item.name || ''
          const url = item.downloadUrl || item.download_url || item.previewUrl || item.preview_url || ''
          const local = item.local === true
          return `<button type="button" class="wb-run-artifact" ${local ? `data-artifact-path="${escAttr(path)}"` : ''} ${url ? `data-artifact-url="${escAttr(url)}"` : ''} title="${url ? '打开远程制品' : '打开制品'}：${escAttr(label)}">${esc(label)}</button>`
        }).join('')
        : '<span class="wb-run-muted">任务产物将在完成后显示</span>'
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

  function actionButton(action, label, kind = '') {
    return `<button type="button" class="wb-run-btn${kind ? ` ${kind}` : ''}" data-run-action="${action}">${label}</button>`
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function schedulePoll() {
    stopPolling()
    if (run.mode !== 'daemon' || !run.slug || run.status === 'done') return
    pollTimer = setTimeout(() => refreshDaemonTask(false), 2000)
  }

  function daemonWaiting() {
    const task = run.task || {}
    const gates = Array.isArray(task.pending_gates) ? task.pending_gates : []
    const clarifications = Array.isArray(task.pending_clarifications) ? task.pending_clarifications : []
    return { gate: gates[0] || null, clarification: clarifications[0] || null }
  }

  function renderDaemonRunner() {
    const task = run.task || {}
    const waiting = daemonWaiting()
    const status = task.status || {}
    const state = run.status || task.state || 'queued'
    if (elRunnerTitle) {
      elRunnerTitle.textContent = run.intent
        || (run.projection && run.projection.intentTitle)
        || (run.workflow && (run.workflow.name || run.workflow.id))
        || run.slug
        || '任务'
    }
    if (elRunnerMeta) {
      const degraded = !!(run.projection && run.projection.degraded)
      if (degraded) {
        // 降级时不重复长原因，也不谎报「执行中」；详情已在下方状态区呈现。
        elRunnerMeta.textContent = run.status === 'done' ? '已结束 · 流程详情暂不可用' : '流程详情暂不可用'
      } else {
        const ctx = workbenchTaskContext()
        const owner = (run.projection && run.projection.currentOwner) || ctx.currentOwner
        // done 时与进度/结论保持一致，避免「流程执行中」与「已完成」同屏矛盾。
        const node = run.status === 'done' ? '已完成' : (ctx.currentNode || '流程执行中')
        const statusText = owner && run.status !== 'done'
          ? `当前负责人：${owner} · ${node}`
          : (owner ? `${node} · 负责人：${owner}` : node)
        elRunnerMeta.textContent = run.contextSummary
          ? `${statusText} · ${run.contextSummary}`
          : statusText
      }
    }
    let actions = ''
    if (run.slug) actions += actionButton('refresh-task', '刷新')
    if (waiting.gate) {
      actions += actionButton('daemon-approve', '通过', 'primary')
      actions += actionButton('daemon-revise', '修订')
      actions += actionButton('daemon-reject', '打回')
    } else if (waiting.clarification) {
      actions += actionButton('daemon-clarify', '回答问题', 'primary')
    }
    actions += actionButton('back', '返回流程')
    if (elRunnerActions) elRunnerActions.innerHTML = actions
    renderTaskContext()
    renderRunLog()
    syncTaskView()
  }

  function renderRunner() {
    if (!elRunner) return
    elRunner.hidden = !run.workflow
    if (!run.workflow) {
      syncTaskView()
      return
    }
    if (run.mode === 'daemon') {
      renderDaemonRunner()
      return
    }
    if (!model()) return
    const node = currentNode()
    const busy = run.status === 'running'
    elRunner.classList.toggle('busy', busy)
    if (elRunnerTitle) elRunnerTitle.textContent = run.workflow.name || run.workflow.id
    if (elRunnerMeta) {
      const type = node ? model().nodeTypeLabel(node.type) : '完成'
      const title = node ? model().nodeTitle(node, agentsById()) : ''
      elRunnerMeta.textContent = node ? `${type} · ${title}` : '工作流已完成'
    }

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
        actions += actionButton('run-parallel', '运行并行 Agent', 'primary')
      } else if (node.type === 'terminal') {
        actions += actionButton('finish', '完成工作流', 'primary')
      } else {
        actions += actionButton('complete', '继续', 'primary')
      }
    }
    actions += actionButton('back', '返回模板')
    if (elRunnerActions) elRunnerActions.innerHTML = actions
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

  function workflowInstruction(workflow, item) {
    const lines = []
    const desc = (workflow && workflow.description) || (item && item.description) || ''
    if (desc) lines.push(desc)
    const entry = workflow && model()
      ? workflow.nodes.find(n => n.id === workflow.entryNode)
      : null
    if (entry && entry.type === 'agent') {
      const agent = agentById(entry.agent)
      const role = agent && agent.persona ? agent.persona.role : ''
      lines.push('')
      lines.push(`# 角色`)
      lines.push(agent
        ? `你是「${agent.title || agent.id}」${role ? `（${role}）` : ''}，负责本工作流的首个节点。`
        : `执行入口节点「${entry.id}」。`)
      if (agent && agent.description) lines.push(agent.description)
      if (entry.intent) lines.push(`目标：${entry.intent}`)
    }
    lines.push('')
    lines.push('确认后将打开运行面板：Agent 节点可直接调用 LLM；Gate / 脚本节点需人工确认，不会自动执行本地命令。')
    return lines.join('\n').trim()
  }

  function suggestedSlug(item) {
    const base = String(item && item.id || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const safe = /^[a-z]/.test(base) ? base : `task-${base || 'work'}`
    const now = new Date()
    const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    return `${safe.slice(0, 58)}-${stamp}`
  }

  function nodeAgentLabel(node) {
    if (!node || !node.agent) return ''
    const agent = agentById(node.agent)
    return agent ? chineseRoleName(agent) : node.agent
  }

  function nodeIoSummary(node) {
    const api = model()
    if (!api || !node) return { input: '', output: '' }
    const inputs = api.nodeInputPaths(node)
    const input = inputs.length
      ? inputs.join('、')
      : (node.intent ? node.intent : '')
    const out = node.output
    const output = out && (out.path || out.kind)
      ? `${out.kind || '产出'}${out.path ? ` · ${out.path}` : ''}`
      : ''
    return { input, output }
  }

  const DAG_LABEL_TONE = {
    '通过': 'ok', '成功': 'ok',
    '打回': 'warn', '失败': 'warn', '耗尽': 'warn',
    '修订': 'revise', '修复': 'revise', '检查': 'revise',
    '并行': 'fork', '汇合': 'merge',
  }
  function dagLabelTone(label) {
    return DAG_LABEL_TONE[label] || 'plain'
  }

  function renderDagConnector(label = '') {
    const chip = label
      ? `<span class="wb-dag-link-label tone-${dagLabelTone(label)}">${esc(label)}</span>`
      : ''
    return `<div class="wb-dag-link" aria-hidden="true"><span class="wb-dag-link-line"></span>${chip}<span class="wb-dag-link-arrow"></span></div>`
  }

  function renderNodeExits(edges, titleOf, fromIndex, indexOf) {
    if (!edges.length) return ''
    const chips = edges.map((edge) => {
      const targetIndex = indexOf.has(edge.to) ? indexOf.get(edge.to) : -1
      const back = targetIndex !== -1 && targetIndex <= fromIndex
      const label = edge.label || '分支'
      const target = titleOf(edge.to)
      return `<span class="wb-dag-exit${back ? ' is-back' : ''}">
        <span class="wb-dag-exit-label tone-${dagLabelTone(edge.label)}">${esc(label)}</span>
        <span class="wb-dag-exit-arrow" aria-hidden="true">${back ? '↩' : '→'}</span>
        <span class="wb-dag-exit-target">${esc(target)}</span>
      </span>`
    }).join('')
    return `<div class="wb-dag-node-exits">${chips}</div>`
  }

  function renderWorkflowDagHtml(workflow, graph, options = {}) {
    const loading = !!options.loading
    const error = String(options.error || '').trim()
    const fallback = String(options.fallback || '').trim()
      || '流程节点暂未加载；启动后仍可按模板推进，详情会在任务工作间更新'
    const dagHead = (count = '') => `
      <div class="wb-dag-head">
        <div class="wb-dag-head-copy">
          <span class="wb-dag-kicker">执行拓扑</span>
          <span class="wb-dag-head-title">DAG 关系图</span>
          <span class="wb-dag-head-subtitle">只读预览 ${renderHelpButton('wbHelpDag', '查看 DAG 阅读说明', `节点按执行顺序从上到下排列；超过 6 步时可在右侧区域滚动查看。`)}</span>
        </div>
        ${count ? `<span class="wb-dag-count"><strong>${count}</strong><span>步</span></span>` : ''}
      </div>`
    if (loading) {
      return `<div class="wb-dag-panel">${dagHead()}<div class="wb-dag-muted">正在加载关系图…</div></div>`
    }
    if (!workflow || !graph || !Array.isArray(graph.order) || !graph.order.length) {
      return `<div class="wb-dag-panel degraded">${dagHead()}<div class="wb-dag-muted">${esc(error || fallback)}</div></div>`
    }
    const api = model()
    const byAgent = agentsById()
    const total = graph.order.length
    const indexOf = new Map()
    graph.order.forEach((id, i) => indexOf.set(id, i))
    const outEdges = new Map()
    for (const edge of (Array.isArray(graph.edges) ? graph.edges : [])) {
      if (!graph.byId.has(edge.to)) continue
      if (!outEdges.has(edge.from)) outEdges.set(edge.from, [])
      outEdges.get(edge.from).push(edge)
    }
    const titleOf = (nodeId) => {
      const n = graph.byId.get(nodeId)
      if (!n) return nodeId
      return (api ? api.nodeTitle(n, byAgent) : n.id) || nodeId
    }
    const blocks = []
    graph.order.forEach((id, index) => {
      const node = graph.byId.get(id)
      if (!node) return
      const title = api ? api.nodeTitle(node, byAgent) : node.id
      const type = api ? api.nodeTypeLabel(node.type) : node.type
      const isEntry = id === workflow.entryNode
      const edges = outEdges.get(id) || []
      const nextId = index < total - 1 ? graph.order[index + 1] : null
      const primary = nextId ? edges.find((e) => e.to === nextId) || null : null
      const secondary = edges.filter((e) => e !== primary)
      blocks.push(`<article class="wb-dag-node type-${esc(node.type)}${isEntry ? ' is-entry' : ''}">
        <span class="wb-dag-node-rail" aria-hidden="true"></span>
        <div class="wb-dag-node-content">
          <div class="wb-dag-node-head">
            <span class="wb-dag-step">${index + 1}</span>
            <span class="wb-dag-type">${esc(type)}</span>
            ${isEntry ? '<span class="wb-dag-badge">起点</span>' : ''}
          </div>
          <strong class="wb-dag-title">${esc(title || id)}</strong>
          ${renderNodeExits(secondary, titleOf, index, indexOf)}
        </div>
      </article>`)
      if (index >= total - 1) return
      const primaryLabel = primary ? primary.label : ''
      blocks.push(renderDagConnector(primaryLabel))
    })
    return `<div class="wb-dag-panel">${dagHead(total)}<div class="wb-dag-flow-shell"><div class="wb-dag-flow" role="region" tabindex="0" aria-label="Agent 执行路径">${blocks.join('')}</div></div></div>`
  }

  function wrapWorkflowLaunchBody(mainHtml, workflow, graph, options = {}) {
    return `
      <div class="wb-modal-split">
        <div class="wb-modal-main">${mainHtml}</div>
        <aside class="wb-modal-dag">${renderWorkflowDagHtml(workflow, graph, options)}</aside>
      </div>`
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

  function renderDaemonLaunchBody(item, workflow, graph) {
    const intentContext = inferIntentContext(item, workflow)
    const placeholder = intentContext.suggestions[0] || '例如：整理今天的客户反馈，提炼前三个问题并给出处理建议'
    const primarySuggestion = intentContext.suggestions[0] || placeholder
    const primarySuggestionLabel = summarizeIntentSuggestion(primarySuggestion)
    const additionalSuggestions = intentContext.suggestions.slice(1)
    const contextDisplay = resolveDaemonContextDisplay(item.id)
    const savedWorkspace = contextDisplay.workspace
    const savedInputs = contextDisplay.inputs
    const savedOutputs = contextDisplay.outputs
    const remoteContextState = modal.contextLoading
      ? '<div class="wb-modal-muted">正在从 Daemon 同步默认上下文…</div>'
      : (modal.contextDefaults
        ? '<div class="wb-modal-muted">已同步 Daemon 默认上下文；你仍可手动覆盖。</div>'
        : '')
    const main = `
      <div class="wb-launch-intro">
        <div class="wb-launch-kicker">先定义任务 ${renderHelpButton('wbHelpIntro', '查看流程说明', item.description || '本工作流将由本机工作服务按右侧关系图执行。')}</div>
      </div>
      <div class="wb-launch-group wb-launch-primary">
        <div class="wb-launch-group-head">任务目标 <span class="wb-launch-group-note">必填</span> ${renderHelpButton('wbHelpIntent', '查看任务目标说明', `请用一句话说明希望这条工作流最终完成什么。推荐填入只提供常用方向，不会限制你自由修改。`)}</div>
        <div class="wb-modal-field wb-launch-field-compact">
          <label class="wb-sr-only" for="wbDaemonIntent">任务目标</label>
          <div class="wb-intent-input-shell">
            <textarea class="wb-modal-textarea" id="wbDaemonIntent" placeholder="${escAttr(placeholder)}" aria-label="任务目标"></textarea>
            <div class="wb-intent-recommendations" aria-label="推荐填入">
              <button type="button" class="wb-intent-recommendation" data-intent-suggest="${escAttr(primarySuggestion)}" title="完整建议：${escAttr(primarySuggestion)}" aria-label="完整建议：${escAttr(primarySuggestion)}">
                <span class="wb-intent-recommendation-label">推荐</span>
                <span class="wb-intent-recommendation-text">${esc(primarySuggestionLabel)}</span>
              </button>
              ${additionalSuggestions.length ? `
                <button type="button" class="wb-intent-toggle" data-intent-toggle aria-expanded="false" aria-controls="wbIntentSuggestions">更多建议</button>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="wb-launch-suggest" id="wbIntentSuggestions" hidden>
          <div class="wb-launch-suggest-label">更多建议</div>
          <div class="wb-intent-suggestions">
            ${additionalSuggestions.map((text, index) => `
              <button type="button" class="wb-intent-suggestion" data-intent-suggest="${escAttr(text)}" title="完整建议：${escAttr(text)}" aria-label="完整建议：${escAttr(text)}">${esc(summarizeIntentSuggestion(text))}</button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="wb-launch-group wb-launch-context">
        <div class="wb-launch-group-head">启动上下文 ${renderHelpButton('wbHelpContext', '查看上下文说明', `建议已按当前角色匹配：${intentContext.role}。任务标识、仓库 ref 和制品路径会随启动请求一起保存。`)}</div>
        ${remoteContextState}
        <div class="wb-context-grid">
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonSlug">任务标识</label>
            <input class="wb-modal-input" id="wbDaemonSlug" value="${esc(suggestedSlug(item))}" maxlength="80" spellcheck="false" aria-label="任务标识">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonProject">GitLab 项目 / 仓库</label>
            <input class="wb-modal-input" id="wbDaemonProject" value="${escAttr(savedWorkspace.projectId || '')}" placeholder="group/project" maxlength="240" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonRef">分支或 ref</label>
            <input class="wb-modal-input" id="wbDaemonRef" value="${escAttr(savedWorkspace.ref || '')}" placeholder="main 或 release/1.0" maxlength="240" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonCommit">固定 commit（可选）</label>
            <input class="wb-modal-input" id="wbDaemonCommit" value="${escAttr(savedWorkspace.commit || '')}" placeholder="留空表示使用 ref" maxlength="128" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonInputRoot">输入制品目录</label>
            <input class="wb-modal-input" id="wbDaemonInputRoot" value="${escAttr(savedInputs.root || '')}" placeholder="artifacts/inbox/task-001" maxlength="512" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonPrd">PRD / asset 文件</label>
            <input class="wb-modal-input" id="wbDaemonPrd" value="${escAttr(savedInputs.prd || '')}" placeholder="PRD.md 或 assets/mockup.png" maxlength="512" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact">
            <label for="wbDaemonResources">资源路径（逗号分隔）</label>
            <input class="wb-modal-input" id="wbDaemonResources" value="${escAttr((savedInputs.resources || []).join(', '))}" placeholder="assets/, references/" maxlength="512" spellcheck="false">
          </div>
          <div class="wb-modal-field wb-launch-field-compact wb-context-grid-wide">
            <label for="wbDaemonOutputRoot">输出制品目录</label>
            <input class="wb-modal-input" id="wbDaemonOutputRoot" value="${escAttr(savedOutputs.root || '')}" placeholder="artifacts/outputs/task-001" maxlength="512" spellcheck="false">
          </div>
        </div>
      </div>
      <details class="wb-launch-advanced">
        <summary>
          <span class="wb-launch-advanced-title">高级设置</span>
          <span class="wb-launch-advanced-note">执行方式与安全边界</span>
        </summary>
        <div class="wb-launch-advanced-body">
          <div class="wb-launch-extra-grid">
            <div class="wb-launch-extra-item">
              <strong>执行方式</strong>
              <span>按右侧 DAG 从入口到输出逐步推进，节点状态会回写到任务面板。</span>
            </div>
            <div class="wb-launch-extra-item">
              <strong>权限边界</strong>
              <span>需要外部服务或脚本确认时会停在对应节点，不会静默越过确认。</span>
            </div>
            <div class="wb-launch-extra-item">
              <strong>失败处理</strong>
              <span>失败节点保留日志和上下文，便于在运行面板继续定位和重试。</span>
            </div>
          </div>
        </div>
      </details>`
    return wrapWorkflowLaunchBody(main, workflow, graph, {
      loading: modal.loading,
      error: modal.error,
    })
  }

  function renderLocalLaunchBody(item, workflow) {
    const tags = (workflow && workflow.tags && workflow.tags.length)
      ? workflow.tags
      : (item.tags || [])
    const agents = workflow ? workflowAgents(workflow) : []
    const graph = modal.graph || (workflow && model() ? model().buildWorkflowGraph(workflow) : null)
    const intro = (workflow && workflow.description) || item.description || ''
    let main = `
      ${intro ? `<div class="wb-launch-intro"><div class="wb-launch-group-head">流程说明</div><p class="wb-launch-lead">${esc(intro)}</p></div>` : ''}
      <div class="wb-launch-group">
        <div class="wb-launch-group-head">流程说明</div>
        <div class="wb-modal-desc wb-launch-instruction">${esc(workflowInstruction(workflow, item))}</div>
      </div>
      <div class="wb-launch-group wb-launch-group-flat">
        <div class="wb-launch-group-head">参与专家</div>
        <div class="wb-modal-chips">
          ${agents.length
            ? agents.map(a => `<span class="wb-modal-chip"><span class="ico" data-icon="users"></span><span>${esc(chineseRoleName(a))}</span></span>`).join('')
            : `<div class="wb-modal-muted">${modal.loading ? '正在解析参与专家…' : '这个工作流没有指定专家'}</div>`}
        </div>
      </div>`
    if (tags.length) {
      main += `
        <div class="wb-launch-group wb-launch-group-flat">
          <div class="wb-launch-group-head">标签</div>
          <div class="wb-modal-chips">
            ${tags.map(tag => `<span class="wb-modal-chip"><span>${esc(tag)}</span></span>`).join('')}
          </div>
        </div>`
    }
    return wrapWorkflowLaunchBody(main, workflow, graph, {
      loading: modal.loading,
      error: modal.error,
    })
  }

  function renderModal() {
    if (!elModal) return
    const open = !!modal.item
    elModal.hidden = !open
    elModal.classList.toggle('is-agent-detail', open && modal.kind === 'agent')
    elModal.classList.toggle('is-workflow-launch', open && modal.kind !== 'agent' && modal.kind !== 'notice')
    if (!open) return
    const item = modal.item
    const workflow = modal.workflow
    if (elModalTitle) elModalTitle.textContent = (workflow && workflow.name) || item.name || item.id || '启动工作流'
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
    if (modal.kind === 'agent') {
      const agent = item
      const role = chineseRoleName(agent)
      const icon = roleIconName(agent)
      const capabilities = agentCapabilities(agent)
      const stages = presenter() ? presenter().stageCount(agent) : 0
      if (elModalTitle) elModalTitle.textContent = role
      if (elModalBody) {
        elModalBody.innerHTML = `
          <div class="wb-agent-detail-hero">
            <span class="wb-agent-detail-avatar" aria-hidden="true"><span class="ico" data-icon="${esc(icon)}"></span></span>
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
      }
      if (elModalHint) elModalHint.textContent = '专家资料 · 由工作流按需调度'
      if (btnModalConfirm) btnModalConfirm.hidden = true
      if (btnModalCancel) btnModalCancel.textContent = '关闭'
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (btnModalConfirm) {
      btnModalConfirm.hidden = false
      btnModalConfirm.textContent = '开始任务'
    }
    if (btnModalCancel) btnModalCancel.textContent = '取消'
    if (modal.daemon) {
      if (elModalBody) elModalBody.innerHTML = renderDaemonLaunchBody(item, workflow, modal.graph)
      if (elModalHint) {
        elModalHint.textContent = modal.error
          ? modal.error
          : (modal.loading
            ? '正在读取工作流关系图…'
            : '任务在本机执行；关闭窗口后仍可从最近任务继续查看')
      }
      if (btnModalConfirm) btnModalConfirm.disabled = modal.loading
      if (window.StickyIcons) window.StickyIcons.mount(elModal)
      return
    }
    if (elModalBody) elModalBody.innerHTML = renderLocalLaunchBody(item, workflow)
    if (elModalHint) {
      elModalHint.textContent = modal.error
        ? modal.error
        : (modal.loading
          ? '正在读取工作流…'
          : '确认后进入运行面板，第一位专家会立即开始')
    }
    if (btnModalConfirm) btnModalConfirm.disabled = !workflow || !!modal.error || modal.loading
    if (window.StickyIcons) window.StickyIcons.mount(elModal)
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
    renderWorkflows()
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
      renderWorkflows()
    } catch { /* ignore */ }
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
          <div class="wb-modal-desc">本机工作服务已启用授权。启动 team-run 等任务前，需要先在 KnowMe 设置中验证项目组授权码。</div>
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

  function openDaemonHelp() {
    const daemon = data.daemon || {}
    if (daemon.online) {
      toastFn('工作服务已连接', 'success')
      return
    }
    const detail = String(daemon.address || daemon.baseUrl || '127.0.0.1:8010')
    modal = {
      ...emptyModal(),
      item: { id: 'daemon-help', name: '连接工作服务' },
      kind: 'notice',
      noticeConfirm: '重新检测',
      noticeHint: '连接后回到工作台即可启动工作流',
      noticeHtml: `
        <div class="wb-modal-section">
          <div class="wb-modal-desc">工作流需要本机的工作服务在后台运行。现在未连接，你仍可以浏览专家和流程，但还不能启动。</div>
        </div>
        <div class="wb-modal-section">
          <div class="wb-modal-section-head"><span>怎么连上</span></div>
          <ol class="wb-notice-steps">
            <li>在本机启动 KnowMe 工作服务</li>
            <li>回到这里点「重新检测」，或用右上角刷新</li>
          </ol>
        </div>
        <div class="wb-modal-section">
          <div class="wb-modal-muted">服务地址：${esc(detail)}（仅本机可访问）</div>
        </div>`,
    }
    renderModal()
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

  async function openWorkflow(id) {
    const raw = workflowById(id)
    const item = mergeWorkflowItem(raw)
    if (!item) {
      toastFn('未找到该工作流模板', 'error')
      return
    }
    if (item.locked) {
      toastFn('当前体验档未授权此流程，请先在 workbench Web 端登录', 'error')
      return
    }

    const daemonOnline = !!(data.daemon && data.daemon.online)
    modal = {
      item,
      workflow: null,
      graph: null,
      loading: true,
      contextLoading: false,
      contextDefaults: null,
      error: '',
      daemon: daemonOnline,
    }
    renderModal()

    const detail = await loadWorkflowDetail(item)
    if (!modal.item || modal.item.id !== item.id) return
    modal.loading = false
    if (detail.ok && detail.workflow) {
      modal.workflow = detail.workflow
      modal.graph = detail.graph
      modal.error = ''
    } else if (detail.noPath) {
      modal.workflow = null
      modal.graph = null
      modal.error = ''
    } else {
      modal.workflow = null
      modal.graph = null
      modal.error = detail.error || '工作流加载失败'
      if (!daemonOnline) toastFn(modal.error, 'error')
    }
    renderModal()
    if (daemonOnline) void hydrateDaemonLaunchContext(item)
  }

  async function hydrateDaemonLaunchContext(item) {
    if (!item || !item.id || !modal.daemon || !window.api?.workbenchDaemonLaunchContext) return
    if (!modal.item || modal.item.id !== item.id) return
    modal.contextLoading = true
    renderModal()
    try {
      const res = await window.api.workbenchDaemonLaunchContext(item.id)
      if (!modal.item || modal.item.id !== item.id) return
      modal.contextDefaults = res && res.ok && res.context ? res.context : null
    } catch {
      if (!modal.item || modal.item.id !== item.id) return
      modal.contextDefaults = null
    } finally {
      if (!modal.item || modal.item.id !== item.id) return
      modal.contextLoading = false
      renderModal()
    }
  }

  async function confirmModal() {
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
      toastFn(online ? '工作服务已连接' : '仍未检测到工作服务', online ? 'success' : 'error')
      return
    }
    if (modal.daemon) {
      const item = modal.item
      const slugEl = document.getElementById('wbDaemonSlug')
      const intentEl = document.getElementById('wbDaemonIntent')
      const slug = String(slugEl && slugEl.value || '').trim()
      const intent = String(intentEl && intentEl.value || '').trim()
      if (!intent) {
        toastFn('请先填写任务目标', 'error')
        intentEl && intentEl.focus()
        return
      }
      const context = readDaemonContext(item, slug)
      if (context) saveDaemonContext(item.id, context)
      if (btnModalConfirm) btnModalConfirm.disabled = true
      if (elModalHint) elModalHint.textContent = context ? '正在提交远程任务上下文…' : '正在创建并启动 Agent 服务任务…'
      const res = await window.api.workbenchDaemonStart({ workflow: item.id, slug, intent, context })
      if (!res || !res.ok) {
        if (handleDaemonAuthFailure(res)) return
        if (btnModalConfirm) btnModalConfirm.disabled = false
        if (elModalHint) elModalHint.textContent = (res && res.error) || '任务启动失败'
        toastFn((res && res.error) || '任务启动失败', 'error')
        return
      }
      closeModal()
      run = emptyRun()
      run.mode = 'daemon'
      run.workflow = modal.workflow || item
      run.graph = modal.graph || (run.workflow && model() ? model().buildWorkflowGraph(run.workflow) : null)
      run.slug = res.slug
      run.intent = intent
      run.context = context
      run.contextSummary = res.contextSummary || ''
      run.taskTrace = buildTaskTrace({
        context,
        slug: res.slug,
        workflow: (modal.workflow || item).id,
        handoff: modal.handoff || null,
        session: modal.session || null,
      })
      run.status = (res.job && res.job.state) || 'queued'
      addLog('任务已提交', `${res.slug} · ${intent}${run.contextSummary ? ` · ${run.contextSummary}` : ''}`)
      renderWorkflows()
      renderRunner()
      await refreshDaemonTask(false)
      return
    }
    if (!modal.workflow) return
    const workflow = modal.workflow
    const graph = modal.graph || model()?.buildWorkflowGraph(workflow)
    closeModal()
    stopPolling()
    run = emptyRun()
    run.mode = 'local'
    run.workflow = workflow
    run.graph = graph
    run.currentId = workflow.entryNode || graph?.order?.[0] || ''
    run.intent = workflow.description || workflow.name || workflow.id
    run.status = 'ready'
    addLog('已进入任务工作间', workflow.name || workflow.id)
    renderWorkflows()
    renderRunner()
    toastFn('已打开本地工作流；执行 Agent 节点前请确认任务目标', 'success')
  }

  async function refreshDaemonTask(showToast = true) {
    if (run.mode !== 'daemon' || !run.slug || !window.api.workbenchDaemonTask) return
    const res = await window.api.workbenchDaemonTask(run.slug)
    if (!res || !res.ok) {
      if (handleDaemonAuthFailure(res)) return
      stopPolling()
      run.status = 'error'
      addLog('状态刷新失败', (res && res.error) || '无法读取任务状态')
      renderRunner()
      return
    }
    run.task = res
    run.status = res.state || 'running'
    applyTaskProjection(res)
    const waiting = daemonWaiting()
    if (waiting.gate) addLogOnce('等待你的决定', waiting.gate.title || waiting.gate.node || '审批节点')
    if (waiting.clarification) {
      addLogOnce('需要补充信息', waiting.clarification.question || waiting.clarification.node || '请回答问题')
    }
    if (res.terminal) {
      run.status = 'done'
      stopPolling()
      const artifacts = await window.api.workbenchDaemonArtifacts(run.slug)
      run.artifacts = artifacts && artifacts.ok ? artifacts.files : []
      addLogOnce(
        '任务已结束',
        run.artifacts.length ? `已生成 ${run.artifacts.length} 个制品` : '未发现可展示的制品'
      )
    } else {
      schedulePoll()
    }
    if (showToast) toastFn('任务状态已刷新', 'success')
    renderRunner()
  }

  function addLogOnce(title, text) {
    const key = `${title}\n${text}`
    const exists = run.logs.some(item => `${item.title}\n${item.text}` === key)
    if (!exists) addLog(title, text)
  }

  async function openDaemonTask(slug) {
    const item = (data.daemon.tasks || []).find(task => task.slug === slug)
    stopPolling()
    run = emptyRun()
    run.mode = 'daemon'
    run.workflow = {
      id: (item && item.workflow) || 'task',
      name: (item && item.intent) || slug,
    }
    run.slug = slug
    run.intent = (item && item.intent) || ''
    run.status = (item && item.state) || 'loading'
    addLog('打开最近任务', run.intent || slug)
    renderWorkflows()
    renderRunner()
    await refreshDaemonTask(false)
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
    addLog(`派单 · ${model().nodeTitle(node, agentsById())}`, '正在等待 Agent…', dispatchId)
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
    updateDispatchLog(dispatchId, res.text || 'Agent 已完成')
    run.status = 'ready'
    if (advanceAfter) advance()
    else renderRunner()
    return true
  }

  async function runParallel(node) {
    const children = (node.children || []).map(id => run.graph.byId.get(id)).filter(Boolean)
    const agents = children.filter(child => child.type === 'agent')
    if (!agents.length) {
      addLog('并行节点', '没有可派单的 Agent 子节点，已人工跳过')
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
    if (action === 'back') {
      resetRun()
      return
    }
    if (action === 'reset') {
      resetRun(true)
      addLog('运行已重置', run.workflow.name || run.workflow.id)
      return
    }
    if (run.mode === 'daemon') {
      if (action === 'refresh-task') {
        await refreshDaemonTask()
        return
      }
      const waiting = daemonWaiting()
      if (action.startsWith('daemon-') && action !== 'daemon-clarify') {
        const decision = action.replace('daemon-', '')
        const gate = waiting.gate
        if (!gate) return
        const node = gate.node || gate.node_id || gate.id
        const res = await window.api.workbenchDaemonGate(run.slug, { node, decision })
        if (!res || !res.ok) {
          toastFn((res && res.error) || '提交决定失败', 'error')
          return
        }
        addLog('已提交决定', `${node} · ${decision}`)
        await refreshDaemonTask(false)
        return
      }
      if (action === 'daemon-clarify') {
        const clarification = waiting.clarification
        if (!clarification) return
        const node = clarification.node || clarification.node_id || clarification.id
        const question = clarification.question || '请补充任务所需信息'
        const answer = window.prompt(question, '')
        if (!answer || !answer.trim()) return
        const res = await window.api.workbenchDaemonClarify(run.slug, { node, answer })
        if (!res || !res.ok) {
          toastFn((res && res.error) || '提交回答失败', 'error')
          return
        }
        addLog('已补充信息', `${node} · 已提交`)
        await refreshDaemonTask(false)
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

  function bind() {
    btnReload && btnReload.addEventListener('click', async () => {
      if (run.workflow) {
        resetRun()
        toastFn('已返回工作台', 'success')
        return
      }
      loaded = false
      toastFn('正在刷新助手与本机工作服务…')
      await load()
    })
    btnTabHome && btnTabHome.addEventListener('click', () => setWorkbenchPage('home'))
    btnTabTasks && btnTabTasks.addEventListener('click', () => setWorkbenchPage('tasks'))
    btnTabAutomation && btnTabAutomation.addEventListener('click', () => {
      setWorkbenchPage('automation')
      refreshAutomation()
    })
    contentTabButtons.forEach(button => {
      button.addEventListener('click', () => setWorkbenchContentPage(button.dataset.wbContentTab))
    })
    btnTeamToggle && btnTeamToggle.addEventListener('click', () => {
      teamExpanded = !teamExpanded
      syncTeamDisclosure()
    })
    btnWorkflowToggle && btnWorkflowToggle.addEventListener('click', () => {
      workflowExpanded = !workflowExpanded
      renderWorkflows()
    })
    elWorkflowSearch && elWorkflowSearch.addEventListener('input', () => {
      workflowQuery = String(elWorkflowSearch.value || '').trim()
      if (workflowQuery) workflowExpanded = true
      renderWorkflows()
    })
    btnTaskToggle && btnTaskToggle.addEventListener('click', () => {
      taskExpanded = !taskExpanded
      syncTaskDisclosure()
    })
    elTodoForm && elTodoForm.addEventListener('submit', event => {
      event.preventDefault()
      addTodo(elTodoInput && elTodoInput.value)
      if (elTodoInput) {
        elTodoInput.value = ''
        elTodoInput.focus()
      }
    })
    elTodoList && elTodoList.addEventListener('click', event => {
      const button = event.target.closest('[data-todo-action]')
      const item = event.target.closest('[data-todo]')
      if (button && item) {
        handleTodoAction(item.getAttribute('data-todo'), button.getAttribute('data-todo-action'))
      }
    })
    elTodoClear && elTodoClear.addEventListener('click', () => clearDoneTodos())
    elDaemonStatus && elDaemonStatus.addEventListener('click', () => {
      const auth = daemonAuth()
      if (auth.authEnabled && auth.state === 'required') openWorkbenchAuthHelp()
      else openDaemonHelp()
    })
    window.addEventListener('resize', () => {
      scheduleTeamDisclosure()
      scheduleContentDisclosures()
    })
    elWorkflowList && elWorkflowList.addEventListener('click', e => {
      const card = e.target.closest('[data-workflow]')
      if (card) openWorkflow(card.getAttribute('data-workflow'))
    })
    ;[elWorkflowDailyList, elWorkflowFrequentList, elWorkflowOtherList, elWorkflowAllList].forEach(root => {
      root && root.addEventListener('click', e => {
        const card = e.target.closest('[data-workflow]')
        if (card) openWorkflow(card.getAttribute('data-workflow'))
      })
    })
    elTeamList && elTeamList.addEventListener('click', e => {
      const card = e.target.closest('[data-agent]')
      if (card) openAgentDetail(card.getAttribute('data-agent'))
    })
    elTaskList && elTaskList.addEventListener('click', e => {
      const chip = e.target.closest('[data-task]')
      if (chip) openDaemonTask(chip.getAttribute('data-task'))
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
        await refreshAutomation()
        toastFn((res && res.message) || '已提交执行', 'success')
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
      const res = await window.api.workbenchDaemonArtifactOpen(path)
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
      const helpToggle = e.target.closest('[data-help-toggle]')
      if (helpToggle) {
        const help = document.getElementById(helpToggle.getAttribute('aria-controls'))
        const expanded = !!help && help.hidden
        document.querySelectorAll('[data-help-popover]').forEach(popover => {
          popover.hidden = true
        })
        document.querySelectorAll('[data-help-toggle]').forEach(button => {
          button.setAttribute('aria-expanded', 'false')
        })
        if (help) {
          help.hidden = !expanded
          helpToggle.setAttribute('aria-expanded', String(expanded))
        }
        return
      }
      const toggle = e.target.closest('[data-intent-toggle]')
      if (toggle) {
        const suggestions = document.getElementById(toggle.getAttribute('aria-controls'))
        if (suggestions) {
          const expanded = suggestions.hidden
          suggestions.hidden = !expanded
          toggle.setAttribute('aria-expanded', String(expanded))
          toggle.textContent = expanded ? '收起建议' : '更多建议'
        }
        return
      }
      const suggest = e.target.closest('[data-intent-suggest]')
      if (suggest) {
        const intentEl = document.getElementById('wbDaemonIntent')
        if (intentEl) {
          intentEl.value = suggest.getAttribute('data-intent-suggest') || ''
          intentEl.focus()
          intentEl.setSelectionRange(intentEl.value.length, intentEl.value.length)
        }
        const toggle = document.querySelector('[data-intent-toggle]')
        const suggestions = document.getElementById('wbIntentSuggestions')
        if (toggle && suggestions) {
          suggestions.hidden = true
          toggle.setAttribute('aria-expanded', 'false')
          toggle.textContent = '更多建议'
        }
        return
      }
      if (e.target === elModal) closeModal()
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && elModal && !elModal.hidden) {
        const openHelp = elModal.querySelector('[data-help-popover]:not([hidden])')
        if (openHelp) {
          openHelp.hidden = true
          const trigger = elModal.querySelector(`[aria-controls="${openHelp.id}"]`)
          if (trigger) trigger.setAttribute('aria-expanded', 'false')
          e.preventDefault()
          return
        }
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
    if (window.api && window.api.onWorkbenchAuthChanged) {
      window.api.onWorkbenchAuthChanged(auth => {
        handleWorkbenchAuthChanged(auth)
      })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && loaded) refreshAuthFromServer()
    })
  }

  function init(opts = {}) {
    if (opts.toast) toastFn = opts.toast
    if (typeof opts.onViewChange === 'function') onViewChange = opts.onViewChange
    if (typeof opts.onPageChange === 'function') onPageChange = opts.onPageChange
    grabDom()
    if (!elTeamList) return
    workflowQuery = ''
    if (elWorkflowSearch) elWorkflowSearch.value = ''
    setWorkbenchPage('home', { force: true })
    setWorkbenchContentPage('workflow', { force: true })
    renderTodos()
    loadTodos()
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

  // 供悬浮助理等外部入口写入今日待办；store 每次读盘，无需先同步内存副本
  if (typeof window !== 'undefined') {
    window.addEventListener('knowme:add-todo', ev => {
      const text = ev && ev.detail && ev.detail.text
      if (!text) return
      addTodo(String(text))
    })
  }

  async function startDaemonFromHandoff(handoff, session = null) {
    if (!handoff || !handoff.ok || handoff.blocked) {
      toastFn((handoff && handoff.error) || '无法交接任务', 'error')
      return handoff
    }
    const item = (data.daemon && data.daemon.workflows || []).find(w => w.id === handoff.workflow)
      || { id: handoff.workflow, name: handoff.workflowName || handoff.workflow }
    if (!item || !item.id) {
      toastFn('Daemon 工作流不可用', 'error')
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
    renderWorkflows()
    renderRunner()
    await refreshDaemonTask(false)
    return { ok: true, slug: res.slug, taskTrace: run.taskTrace }
  }

  function previewTaskTrace(input = {}) {
    run.taskTrace = buildTaskTrace(input)
    renderTaskTracePanel()
    return run.taskTrace
  }

  return { init, ensureLoaded, load, resetRun, openPage, startDaemonFromHandoff, previewTaskTrace, getRunTrace: () => run.taskTrace || null }
})()
