'use strict'
/* 工作区级 Agent 对话：与 editor-pane iframe 通过回调通信 */

window.WorkspaceAgent = (function () {
  const normalizeAssistantOutput = window.AssistantOutputStyle?.normalizeAssistantOutput
    || (text => String(text ?? ''))
  const chatLog = document.getElementById('agentChatLog')
  const topicNav = document.getElementById('agentTopicNav')
  const aiInput = document.getElementById('agentInput')
  const aiSend = document.getElementById('agentSend')
  const aiComposer = document.getElementById('agentComposer')
  const agentCol = document.getElementById('agentCol')
  const agentFoot = aiComposer?.closest('.agent-col-foot') || null
  const aiQuickBtn = document.getElementById('agentQuickBtn')
  const aiQuickMenu = document.getElementById('agentQuickMenu')
  const slashMenu = document.getElementById('agentSlashMenu')
  const atMenu = document.getElementById('agentAtMenu')
  const aiAttach = document.getElementById('agentAttach')
  const aiFileInput = document.getElementById('agentFileInput')
  const aiAttachment = document.getElementById('agentAttachment')
  const aiAttachmentName = document.getElementById('agentAttachmentName')
  const aiAttachmentRemove = document.getElementById('agentAttachmentRemove')
  const aiComposerMeta = document.getElementById('agentComposerMeta')
  const aiModelBtn = document.getElementById('agentModelBtn')
  const aiModelLabel = document.getElementById('agentModelLabel')
  const aiModelUsage = document.getElementById('agentModelUsage')
  const aiModelMenu = document.getElementById('agentModelMenu')
  const aiContextPanel = document.getElementById('agentContextPanel')
  const aiKnowledgeWrap = document.getElementById('agentSessionKnowledgeWrap')
  const aiKnowledgeBtn = document.getElementById('agentSessionKnowledgeBtn')
  const aiKnowledgeLabel = document.getElementById('agentSessionKnowledgeLabel')
  const aiKnowledgeMenu = document.getElementById('agentSessionKnowledgeMenu')
  const sessionTabsEl = document.getElementById('agentSessionTabs')
  const sessionTabScrollEl = sessionTabsEl?.closest('.agent-tab-scroll')
    || document.querySelector('.agent-tab-scroll')
  const btnHistory = document.getElementById('agentHistoryBtn')
  const btnMore = document.getElementById('agentMoreBtn')
  const btnExpert = document.getElementById('agentExpertBtn')
  const expertPop = document.getElementById('agentExpertPop')
  const historyPop = document.getElementById('agentHistoryPop')
  const morePop = document.getElementById('agentMorePop')
  const tabCtxPop = document.getElementById('agentTabCtxPop')
  const quickSearchInput = document.getElementById('agentQuickSearch')
  const quickItemsHost = document.getElementById('agentQuickItems')
  const quickSummary = document.getElementById('agentQuickSummary')
  const quickEmpty = document.getElementById('agentQuickEmpty')
  const feishuLinkMenu = document.getElementById('feishuLinkMenu')
  const agentImageViewer = document.getElementById('agentImageViewer')
  const agentImageViewerImg = document.getElementById('agentImageViewerImg')
  const agentImageViewerClose = document.getElementById('agentImageViewerClose')

  let chatHistory = []
  let runArtifacts = []
  let daemonProcessCache = null
  let agents = []
  let catalogExperts = []
  let knowledgeProviders = []
  let activeKnowledgeProviderId = ''
  let knowledgeCatalogState = 'idle'
  let knowledgeUpdatePending = false
  let knowledgeMenuOpen = false
  let sessions = []
  let openSessionIds = []
  let activeAgentId = 'general'
  let activeSession = null
  let skillCatalog = []
  let slashOpen = false
  let slashActive = 0
  let slashQuery = ''
  let quickActive = 0
  let quickCommands = []
  let quickQuery = ''
  let atOpen = false
  let atActive = 0
  let atQuery = ''
  let atExpanded = new Set()
  let attachedFile = null
  // 快捷任务缺素材时暂存，用户在输入框补齐后下一次发送自动带上该任务指令
  let pendingShortcut = null
  let editorContextText = ''
  let hasActiveEditor = false
  let surfaceMode = 'agent'
  let workbenchTaskContext = null
  let sessionsLoaded = false
  let sessionsLoadPromise = null
  let surfaceSwitchNonce = 0
  let activeRunId = ''
  /** sessionId → 生成中 chatHistory 数组引用；切面后仍接收流事件，切回时优先恢复 */
  const inflightChatBySession = new Map()
  let runPermissionPrompted = new Set()
  const runActionState = new Map()

  const RUN_PERMISSION_LABELS = {
    network: 'network（联网）',
    write: 'write（写入）',
    dangerous: 'dangerous（危险操作）',
  }

  async function maybeOfferRunPermissionUpgrade(event) {
    const need = String(event?.needsPermission || '').trim()
    if (!need || !RUN_PERMISSION_LABELS[need]) return
    if (runPermissionPrompted.has(need)) return
    runPermissionPrompted.add(need)
    const label = RUN_PERMISSION_LABELS[need]
    const toolHint = event.toolName ? `（工具 ${event.toolName}）` : ''
    const ok = window.confirm(
      `当前运行缺少 ${label} 权限${toolHint}。\n\n是否为本次 Session 开启该权限？开启后请重新发送或让助手重试相关操作。`,
    )
    if (!ok || !activeSession?.id) return
    try {
      const updated = await window.api.agentRunUpdate({
        sessionId: activeSession.id,
        permissions: { [need]: true },
      })
      if (updated?.session?.run?.permissions) {
        activeSession.run = activeSession.run || {}
        activeSession.run.permissions = updated.session.run.permissions
      }
    } catch { /* ignore */ }
  }
  let thinkingTicker = 0
  /** 对话 stick-to-bottom：发送后强制跟随；用户上滑则解除，滚回近底再恢复 */
  let chatStickToBottom = true
  let chatProgrammaticScroll = false
  const CHAT_NEAR_BOTTOM_PX = 96
  const SURFACE_UI_KEY = 'knowme.agent.surfaceUi.v2'
  const LEGACY_SURFACE_SESSION_KEY = 'knowme.agent.surfaceSessions.v1'
  const WORKBENCH_SESSION_GOAL = '当前工作'
  const AI_INPUT_FALLBACK_MAX_HEIGHT = 198
  let surfaceUi = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SURFACE_UI_KEY) || '{}')
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SURFACE_SESSION_KEY) || '{}')
      const state = mode => ({
        activeId: String(saved[mode]?.activeId || legacy[mode] || ''),
        openIds: Array.isArray(saved[mode]?.openIds) ? [...new Set(saved[mode].openIds.map(String))] : [],
      })
      return { agent: state('agent'), workbench: state('workbench') }
    } catch {
      return {
        agent: { activeId: '', openIds: [] },
        workbench: { activeId: '', openIds: [] },
      }
    }
  })()
  const CONTEXT_LIMIT_TOKENS = 32768
  let contextLimitTokens = CONTEXT_LIMIT_TOKENS
  let contextProfile = null
  let lastContextInfo = null
  let localContextTokens = 0
  let modelCatalog = null
  let modelMenuOpen = false
  let contextPanelOpen = false
  const SECTION_LABELS = {
    conversation: '对话历史',
    grounding: '本轮内容理解',
    session: '会话摘要',
    retrieval: '知识检索',
    memory: '记忆',
    system: '系统提示',
    tools: '工具定义',
  }
  /** 各 Session 的草稿输入，切换 Tab 时不丢失 */
  const draftsBySession = new Map()
  /** fill / 占位符选项：不把模板写入输入框，发送时再合并用户内容 */
  let pendingSuggestionPayload = null
  /** 所有对话推荐、快捷入口和能力入口的统一执行器 */
  let actionDispatcher = null
  let packEmptyGroups = []
  let skillTaskCatalog = { tasks: [], issues: [], revision: '' }
  let skillTaskMap = new Map()
  const skillTaskUi = window.SkillTaskUi || {}

  async function refreshSkillTaskCatalog() {
    const api = window.knowme?.skill?.tasks || window.api?.skillTaskList
    if (!api) return false
    try {
      const res = await api()
      if (res?.ok === false) return false
      const tasks = Array.isArray(res?.tasks) ? res.tasks : []
      skillTaskCatalog = {
        tasks,
        issues: Array.isArray(res?.issues) ? res.issues : [],
        revision: String(res?.revision || ''),
      }
      skillTaskMap = skillTaskUi.buildTaskMap
        ? skillTaskUi.buildTaskMap(tasks)
        : new Map(tasks.filter(t => t?.id).map(t => [t.id, t]))
      return true
    } catch {
      return false
    }
  }

  async function refreshPackEmptyGroups() {
    try {
      const api = window.knowme?.capabilityPackEmptyState || window.api?.capabilityPackEmptyState
      if (!api) { packEmptyGroups = [] }
      else {
        const res = await api()
        packEmptyGroups = Array.isArray(res?.groups) ? res.groups : []
      }
    } catch {
      packEmptyGroups = []
    }
    await refreshSkillTaskCatalog()
  }

  function emptyShortcutIcon(taskId = '') {
    const id = String(taskId || '').toLowerCase()
    if (/meeting|summary|writing|draft|polish|requirement|document/.test(id)) return 'note'
    if (/priority|schedule|workflow|release|implement/.test(id)) return 'automation'
    if (/doc|knowledge|wiki|search|explain/.test(id)) return 'bookOpen'
    if (/chat|message|related/.test(id)) return 'chat'
    if (/code|debug|fix|review/.test(id)) return 'code'
    if (/skill|capability/.test(id)) return 'capabilityStack'
    return 'optimize'
  }

  function renderEmptyActionCard(card, attributes = '') {
    const id = card?.id || card?.sceneId || ''
    return `<button type="button" class="agent-empty-act" data-auto-send="1" ${attributes}>
      <span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="${emptyShortcutIcon(id)}"></span></span>
      <span class="agent-empty-act-copy"><strong>${escHtml(card?.title || '开始任务')}</strong><span>${escHtml(card?.subtitle || '说明你的目标，KnowMe 会继续推进')}</span></span>
    </button>`
  }

  const DEFAULT_LAUNCH_INTRO = '把你的问题或任务交给 KnowMe，它来帮你完成。'

  function renderLaunchIntroHtml(sectionMeta = '', intro = '') {
    const copy = String(intro || '').trim() || DEFAULT_LAUNCH_INTRO
    return `<div class="agent-launch-intro">
      <div class="agent-empty-sub">${escHtml(copy)}</div>
    </div>
    <div class="agent-home-composer-mount" data-agent-composer-mount></div>
    <div class="agent-launch-section">
      <span>开始使用</span>
      ${sectionMeta ? `<small>${escHtml(sectionMeta)}</small>` : ''}
    </div>`
  }

  function renderPackEmptyStateHtml() {
    if (!packEmptyGroups.length) return ''
    return packEmptyGroups.map(group => {
      const cards = skillTaskUi.resolvePackEmptyCards
        ? skillTaskUi.resolvePackEmptyCards(group, skillTaskMap)
        : (group.scenes || []).map(card => ({
            sceneId: card.id,
            title: card.title,
            subtitle: card.subtitle,
            prompt: card.prompt,
            dynamic: false,
          }))
      const home = skillTaskUi.partitionPackHomeCards
        ? skillTaskUi.partitionPackHomeCards(cards, 4)
        : { recommendations: cards.slice(0, 4), workflow: null, overflow: cards.slice(4) }
      const renderCardAttributes = card => card.dynamic
        ? `data-pack-id="${escHtml(group.packId)}" data-shortcut="${escHtml(card.id)}"`
        : `data-pack-id="${escHtml(group.packId)}" data-pack-scene="${escHtml(card.sceneId || card.id)}" data-prompt="${escHtml(card.prompt || '')}"`
      const cardsHtml = home.recommendations
        .map(card => renderEmptyActionCard(card, renderCardAttributes(card)))
        .join('')
      const workflowHtml = home.workflow
        ? `<button type="button" class="agent-empty-act agent-workflow-entry" data-auto-send="1"
            ${renderCardAttributes(home.workflow)}>
            <span class="agent-workflow-mark" aria-hidden="true"><span class="agent-workflow-glyph">↗</span></span>
            <span class="agent-workflow-copy">
              <small>启动工作流</small>
              <strong>${escHtml(home.workflow.title)}</strong>
              <span>${escHtml(home.workflow.subtitle)}</span>
            </span>
            <span class="ico agent-workflow-arrow" data-icon="chevronRight" aria-hidden="true"></span>
          </button>`
        : ''
      const kicker = String(group.kicker || '').trim()
      const ariaLabel = kicker ? `${kicker}任务入口` : `${group.hero || '工作伙伴'}任务入口`
      return `<div class="agent-empty-tips agent-empty-home agent-empty-pack" aria-label="${escHtml(ariaLabel)}" data-pack-id="${escHtml(group.packId)}">
        ${renderLaunchIntroHtml(kicker || group.hero || 'KnowMe 工作伙伴')}
        <div class="agent-empty-actions">${cardsHtml}</div>
        ${workflowHtml}
      </div>`
    }).join('')
  }
  /** @type {null | ((title?: string) => void)} */
  let openKnowledgePanel = null
  let workSurface = null
  let feishuUsageHint = '状态检测中…'
  function setPresenceState(state) {
    try {
      window.KnowMeAgentPresence?.setState(state)
    } catch {
      // Presence is decorative and must never affect the conversation.
    }
  }

  function classifyPresenceInput(text) {
    return window.KnowMeAgentPresenceLib?.classifyInputState?.(text)
      || (String(text || '').trim() ? 'typing' : 'idle')
  }

  /** @type {() => Promise<{ok:boolean, noteId?:string, content?:string, category?:string, error?:string}>} */
  let getEditorContext = async () => ({ ok: false, error: '未打开文件' })
  /** @type {(text:string, mode:'replace'|'append'|'insert') => void} */
  let applyToEditor = () => {}
  /** @type {(msg:string, type?:string) => void} */
  let toastFn = () => {}
  let getFileCatalog = () => []
  let openReferencedFile = () => false

  function hideHeadPops() {
    expertPop?.classList.remove('show')
    historyPop?.classList.remove('show')
    morePop?.classList.remove('show')
    tabCtxPop?.classList.remove('show')
  }

  const fallbackExperts = [
    { id: 'general', name: '通用办公', description: '处理日常问题、资料整理和工作推进' },
    { id: 'steward', name: '知识管家', description: '查询公司知识、整理 Wiki 和知识库' },
    { id: 'writing', name: '写作专家', description: '润色、改写和结构化办公内容' },
    { id: 'coding', name: '研发助手', description: '代码分析、实现方案和研发任务' },
  ]

  function iconForAgent(agentId) {
    if (agentId === 'coding') return 'code'
    if (agentId === 'steward') return 'bookOpen'
    if (agentId === 'writing') return 'edit'
    return 'chat'
  }

  /** 内置模式与专家会话共用的身份 payload，供预设头像解析 */
  function agentMarkPayload(agentId, sessionMeta = null) {
    const expertId = String(sessionMeta?.expertId || '').trim()
    if (expertId) {
      const catalog = (Array.isArray(catalogExperts) ? catalogExperts : [])
        .find(item => String(item.id || '') === expertId) || {}
      const expert = sessionMeta.expert || {}
      return {
        id: expertId,
        name: sessionMeta.expertName || expert.name || catalog.name || expertId,
        description: expert.description || catalog.description || '',
        avatar: expert.avatar || expert.persona?.avatar || catalog.avatar || '',
        skills: expert.bindings?.skills || catalog.skills,
      }
    }
    const id = String(agentId || sessionMeta?.agentId || '').trim()
    if (id === 'writing') return { id, name: '写作专家', description: '写作润色与办公文档', avatar: 'office/writer' }
    if (id === 'steward') return { id, name: '知识管家', description: '知识库与 Wiki', avatar: 'office/knowledge' }
    if (id === 'coding') return { id, name: '研发助手', description: '研发与代码交付', avatar: 'game/engineer' }
    if (id === 'general') return { id, name: '通用助手', description: '通用搭档', avatar: 'other/partner' }
    const catalog = (Array.isArray(catalogExperts) ? catalogExperts : [])
      .find(item => String(item.id || '') === id) || {}
    if (catalog.id) {
      return {
        id: catalog.id,
        name: catalog.name || id,
        description: catalog.description || '',
        avatar: catalog.avatar || '',
        skills: catalog.skills,
      }
    }
    return { id: id || 'general', name: id || '助手', avatar: 'other/partner' }
  }

  function agentAvatarMarkHtml(payload, { size = 16, className = '' } = {}) {
    const identity = window.AgentIdentity
    const src = identity && typeof identity.identityAvatarSrc === 'function'
      ? identity.identityAvatarSrc(payload)
      : ''
    if (src) {
      return `<img class="agent-avatar-photo${className ? ` ${className}` : ''}" src="${escHtml(src)}" alt="" width="${size}" height="${size}" decoding="async">`
    }
    const icon = identity && typeof identity.identityIcon === 'function'
      ? identity.identityIcon(payload)
      : iconForAgent(payload?.id)
    return `<span class="ico${className ? ` ${className}` : ''}" data-icon="${escHtml(icon)}" style="width:${size}px;height:${size}px;flex-shrink:0"></span>`
  }

  function currentAgentModeId() {
    const raw = String(activeSession?.agentId || activeAgentId || 'general').trim()
    if (raw === 'steward' || raw === 'writing' || raw === 'coding') return raw
    return 'general'
  }

  function currentComposerPlaceholder() {
    if (surfaceMode === 'workbench') {
      const waiting = String(workbenchTaskContext?.waitingKind || '')
      if (waiting === 'clarification') {
        const display = window.WorkbenchTaskBrief?.resolveClarificationDisplay?.(workbenchTaskContext.clarification || {})
        if (display?.hasExplicitQuestion) {
          return '直接写出澄清答案并发送；若只是询问要填什么，会先由助手说明…'
        }
        return '可先问助手要补充什么；准备好答案后点卡片「提交澄清」…'
      }
      if (waiting === 'gate') return '可在上方卡片选择通过 / 修订 / 打回；也可补充说明… @ 选文件'
      return '补充任务要求或材料… @ 选文件'
    }
    const mode = currentAgentModeId()
    return MODE_INPUT_EXPERIENCE[mode]?.placeholder || MODE_INPUT_EXPERIENCE.general.placeholder
  }

  function currentComposerIdleMeta() {
    if (surfaceMode === 'workbench') {
      const waiting = String(workbenchTaskContext?.waitingKind || '')
      if (waiting === 'clarification') {
        const display = window.WorkbenchTaskBrief?.resolveClarificationDisplay?.(workbenchTaskContext.clarification || {})
        return display?.hasExplicitQuestion
          ? '发送即提交澄清答案；询问类问题会交给助手'
          : '发送先问助手；点卡片「提交澄清」才会继续任务'
      }
      if (waiting === 'gate') return '请在对话卡片完成审批'
      return 'Enter 发送 · Shift+Enter 换行 · @ 引用文件'
    }
    const mode = currentAgentModeId()
    return MODE_INPUT_EXPERIENCE[mode]?.idleMeta || MODE_INPUT_EXPERIENCE.general.idleMeta
  }

  function syncComposerPlaceholder({ force = false } = {}) {
    if (!aiInput) return
    if (!force && String(aiInput.value || '').trim()) return
    aiInput.placeholder = currentComposerPlaceholder()
  }

  const QUICK_ACTION_PROMPTS = {
    meetingSummary: '请为我做会议总结：总结最近三天与我相关的会议。第一阶段仅展示候选会议列表：每场会议只显示一张可打开的飞书妙记卡片，会议标题、日期时间、组织者全部放在卡片内，卡片外不重复展示，不显示原始 minute_token/url，不要直接读取正文、不要直接总结；若首轮为 0 条先自动放宽关键词再检索一轮。第二阶段等我选择具体会议后，再调用 feishu.meeting_read 读取并输出会议总结（议题、结论、待办、责任人与时间点）和简要分析（对我相关、风险阻塞、建议下一步）。',
    todayPriority: '请作为今日优先级助手：先调用 feishu.today_priority 拉取我今天的飞书日程、未完成待办与今日 @我 信号；拿到事实后立刻给出我现在先做的最多 3 件事（每项含优先级理由、预计耗时、第一步动作）。禁止先问三项澄清；仅当日程与待办都为空或无法判断时最多追问 1 句。不要索要文档 token。',
    docKbSuggest: '请查文档/知识库：点击后直接执行。先检查飞书 user 授权；已授权则立刻调用 feishu.doc_kb_suggest，列出我的个人文件夹、可见知识库空间，以及依据个人记忆可能需要的文件（≤5）、最近自己编辑的文件（≤5）、最近自己阅读的文件（≤5）。首轮不要澄清提问、不要读取正文；等我选定后再深入读取或检索。',
    relatedChats: '请分析跟我相关的聊天：用飞书 CLI 读取我授权账号今天内的私聊与群聊主题及未读相关信息，特别确认并优先列出 @我 的内容，再整理待回应事项与建议下一步。输出风格保持克制专业：默认不使用 emoji 或装饰性图标，状态统一使用纯文本标签「[需确认]」「[高优先级]」「[可延后]」，不要堆叠图标或使用高情绪化表达。不要走会议文档或索要文档 token。',
    writingDraft: '请根据我接下来提供的目标，先给出一版结构清晰、可直接发送的正式文稿；同时给一版简洁版，并列出 2-3 个可替换措辞。',
    writingPolish: '请对我的文本做精修：保持原意不变，重点优化逻辑层次、语气一致性与可执行性，最后给出修改前后对照要点。',
    writingSummary: '请把我提供的信息压缩成一页摘要：包含结论、关键事实、风险点、下一步动作（负责人/截止时间可留空位）。',
    writingRequirementsDoc: '请作为需求文档搭档：根据我提供的目标、背景、约束和要点，直接产出一份可继续评审的需求文档初稿。默认结构包含：背景、目标、范围、非目标、用户场景、核心流程、验收标准、风险与待确认事项。材料不足时最多追问 3 个最关键缺口；若信息已足够，直接交付，不要先讲方法论。输出完成后再做一轮去 AI 味处理：减少空泛拔高、宣传腔、三段排比和套话，但保留事实、术语、边界和专业度。',
    writingOfficeDoc: '请作为办公文档搭档：根据我提供的场景和材料，直接写成可发送的办公文稿，适用于通知、汇报、周报、方案同步、会议纪要等日常场景。先判断最合适的文体并按文体组织结构；正文后补一版更简洁的发送版。输出完成后再做一轮去 AI 味处理：减少模板腔和高频套话，保留事实、语气和结论。',
    writingOutlineDraft: '请根据我提供的标题、提纲和要点扩写成完整文稿。优先补齐段落衔接、例子占位、结尾收束和行动项，不要编造我未提供的事实或数据；缺关键事实时用“待补”明确标注。输出完成后再做一轮去 AI 味处理，让成稿更自然可读，但不牺牲结构。',
    writingFinalize: '请把我提供的草稿整理成可直接发送/评审的定稿：统一标题层级、段落节奏、列表样式、结论、行动项和附录说明；必要时将散乱内容重排为更清晰的结构。若内容已足够长，优先产出适合进入右侧审阅区的完整长文。输出完成后再做一轮去 AI 味处理，减少空话和重复表达。',
    writingHumanize: '请对我提供的文本做“去 AI 味”处理：重点消减空泛拔高、宣传腔、三段排比、过度“此外/至关重要/赋能/深度”等表达，保持原意、事实、术语和结构不变。先输出最终版本，再列出 3-5 条你消减掉的 AI 痕迹。',
    codingDebug: '请作为研发助手，先复述问题现象与复现路径，再给出最可能的 3 个根因假设、最小验证步骤，以及建议的修复顺序。',
    codingImplement: '请基于我的需求给出实现方案：拆分任务、关键数据结构、边界条件与验收要点；必要时给出可直接落地的代码草稿。',
    codingReview: '请对我提供的改动做工程化评审：重点检查回归风险、异常处理、可维护性与测试覆盖，并给出最小改进清单。',
    codingRelease: '请生成一次研发交付说明：变更摘要、影响范围、验证结果、上线/回滚要点，用于同步团队。',
  }

  const EMPTY_SHORTCUT_PRESETS = {
    general: [
      { id: 'meetingSummary', title: '会议总结', subtitle: '为我总结最近三天的会议' },
      { id: 'todayPriority', title: '今日优先级', subtitle: '基于飞书日程/待办直接出 Top3' },
      { id: 'docKbSuggest', title: '查文档/知识库', subtitle: '文件夹·记忆推荐·最近编辑/阅读' },
      { id: 'relatedChats', title: '分析跟我相关的聊天', subtitle: '今天：私聊/群聊主题与 @我' },
    ],
    coding: [
      { id: 'codingExplain', title: '解释代码', subtitle: '职责、流程、风险与改进' },
      { id: 'codingFix', title: '修复报错', subtitle: '根因定位 + 最小修复方案' },
      { id: 'codingImplement', title: '实现方案', subtitle: '范围、拆分、接口与验收' },
      { id: 'codingDraftPatch', title: '生成改动草案', subtitle: '按文件列改动并附回归清单' },
    ],
    writing: [
      { id: 'writingRequirementsDoc', title: '写需求文档', subtitle: '背景、范围、验收标准、风险' },
      { id: 'writingOfficeDoc', title: '写办公文档', subtitle: '通知、汇报、周报、纪要等成稿' },
      { id: 'writingOutlineDraft', title: '按提纲成稿', subtitle: '提纲扩写为完整段落与过渡' },
      { id: 'writingFinalize', title: '排版定稿', subtitle: '统一结构、列表、行动项与可发送版本' },
    ],
  }

  const EMPTY_SHORTCUT_PROMPTS = {
    meetingSummary: QUICK_ACTION_PROMPTS.meetingSummary,
    todayPriority: QUICK_ACTION_PROMPTS.todayPriority,
    docKbSuggest: QUICK_ACTION_PROMPTS.docKbSuggest,
    relatedChats: QUICK_ACTION_PROMPTS.relatedChats,
    codingExplain: '请解释当前问题相关的代码：先说明模块职责、关键流程和依赖关系，再列出风险点与可改进项。若信息不足，明确缺少哪些文件或报错。',
    codingFix: '请帮我修复这个问题：先定位根因，再给出最小改动方案和验证步骤。优先可落地修改，不要编造未提供的运行结果。',
    codingImplement: '请为当前需求给出实现方案：输出影响范围、模块拆分、数据流、关键接口和验收标准，必要时给出分步实施计划。',
    codingDraftPatch: '请生成一份可执行的代码修改草案：按文件列出改动点，说明每处改动目的，并给出回归验证清单。',
    writingPolish: '请润色这段内容：保留原意，提升清晰度与专业度，输出可直接发送的版本。',
    writingStructure: '请将材料结构化：整理成标题、大纲、关键结论、行动项和待补事实。',
    writingDraftDoc: '请起草一份办公文档：先给可复用模板，再按该模板输出完整初稿。',
    writingTone: '请将下面内容改成三种语气版本：正式、协作、简洁，每个版本控制在易读长度。',
    writingRequirementsDoc: QUICK_ACTION_PROMPTS.writingRequirementsDoc,
    writingOfficeDoc: QUICK_ACTION_PROMPTS.writingOfficeDoc,
    writingOutlineDraft: QUICK_ACTION_PROMPTS.writingOutlineDraft,
    writingFinalize: QUICK_ACTION_PROMPTS.writingFinalize,
    writingHumanize: QUICK_ACTION_PROMPTS.writingHumanize,
  }

  const MODE_INPUT_EXPERIENCE = {
    general: {
      placeholder: '说说你想做什么（目标 / 材料 / 期望结果）… @ 选文件',
      idleMeta: '先说目标，必要时补充材料',
    },
    steward: {
      placeholder: '先说要查什么知识或文档，我会优先走知识库与约定… @ 选文件',
      idleMeta: '优先查知识库，再给结论',
    },
    writing: {
      placeholder: '贴入目标、提纲或草稿，我来写需求文档/办公文档/成稿定稿… @ 选文件',
      idleMeta: '先贴材料或提纲，再指定文档类型',
    },
    coding: {
      placeholder: '贴报错或需求，我来做定位、实现方案与回归清单… @ 选文件',
      idleMeta: '先给现象，再给约束与验收',
    },
  }

  // 任务卡片发送前的确定性 preflight：缺内容就用一句话询问（非 LLM 生成，零幻觉），不乱说不乱做。
  // need = 'feishuAuth'（需先授权飞书）| 'material'（需先给素材/需求）
  const TASK_PREFLIGHT = {
    meetingSummary: { need: 'feishuAuth', ask: '要做会议总结，我得先连上飞书读取你的会议记录。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「会议总结」。' },
    todayPriority: { need: 'feishuAuth', ask: '要排今日优先级，我得先连上飞书读取你的日程与待办。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「今日优先级」。' },
    docKbSuggest: { need: 'feishuAuth', ask: '要查文档/知识库，我得先连上飞书读取你的文件夹与知识空间。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「查文档/知识库」。' },
    relatedChats: { need: 'feishuAuth', ask: '要分析跟你相关的聊天，我得先连上飞书读取你今天的会话。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「分析跟我相关的聊天」。' },
    writingRequirementsDoc: { need: 'material', ask: '写需求文档前，用一句话告诉我要写什么需求（目标 + 背景 + 关键约束），或直接粘贴/@ 已有材料，我就开始。' },
    writingOfficeDoc: { need: 'material', ask: '要写哪类办公文档、给谁看、核心信息是什么？发一句话或粘贴要点，我立刻成稿。' },
    writingOutlineDraft: { need: 'material', ask: '请把提纲或标题贴进输入框（或 @ 文件），我再扩写成完整文稿。' },
    writingFinalize: { need: 'material', ask: '请把要定稿的草稿贴进输入框（或 @ 文件），我来统一结构、列表与可发送版本。' },
    writingHumanize: { need: 'material', ask: '请把要去 AI 味的文本贴进输入框（或 @ 文件），我再消减套话并保留事实与术语。' },
    codingExplain: { need: 'material', ask: '请把要解释的代码贴进输入框（或 @ 文件），我再讲清它的职责、流程与风险。' },
    codingFix: { need: 'material', ask: '请把报错信息连同相关代码贴进输入框（或 @ 文件），我来定位根因并给最小修复。' },
    codingImplement: { need: 'material', ask: '请用一句话说明要实现的需求（目标 + 约束），需要的话 @ 相关文件，我就给方案。' },
    codingDraftPatch: { need: 'material', ask: '请说明要改什么、涉及哪些文件（可 @ 文件），我再按文件产出改动草案与回归清单。' },
    codingDebug: { need: 'material', ask: '请把报错信息或问题现象贴进输入框（或 @ 文件），我再给根因假设与验证步骤。' },
    codingReview: { need: 'material', ask: '请把要评审的改动或代码贴进输入框（或 @ 文件），我再看回归风险、异常处理与测试覆盖。' },
    codingRelease: { need: 'material', ask: '请说明本次交付改了什么（可 @ 文件或粘贴变更清单），我再写成可同步团队的发布说明。' },
  }

  // 由 prompt 文本反查任务 id，供快捷菜单复用同一套 preflight
  const PROMPT_TO_TASK = (() => {
    const map = new Map()
    const register = (id, prompt) => {
      const key = String(prompt || '').trim()
      if (key && !map.has(key)) map.set(key, id)
    }
    for (const [id, prompt] of Object.entries(EMPTY_SHORTCUT_PROMPTS)) register(id, prompt)
    for (const [id, prompt] of Object.entries(QUICK_ACTION_PROMPTS)) register(id, prompt)
    return map
  })()

  const MODE_FOLLOWUP_PRESETS = {
    general: [
      { label: '继续追问细节', prompt: '请继续细化上面的结论，补充关键依据与可执行下一步。' },
      { label: '整理成行动项', prompt: '请把上面的内容整理为可执行行动项清单（含优先级、负责人、截止时间占位）。' },
      { label: '生成同步消息', prompt: '请把上面的结论改写成一段可直接发给团队的同步消息，语气专业简洁。' },
    ],
    steward: [
      { label: '补充知识依据', prompt: '请基于已有结果补充知识依据：来源、适用边界、可能冲突约定。' },
      { label: '转成知识卡片', prompt: '请把当前结论整理成知识卡片：背景、结论、适用范围、注意事项。' },
      { label: '继续检索资料', prompt: QUICK_ACTION_PROMPTS.docKbSuggest },
    ],
    writing: [
      { label: '改成正式版', prompt: '请把上面的内容改成正式公文语气，保持信息完整并提升可读性。' },
      { label: '排版定稿', prompt: EMPTY_SHORTCUT_PROMPTS.writingFinalize },
      { label: '继续去 AI 味', prompt: EMPTY_SHORTCUT_PROMPTS.writingHumanize },
    ],
    coding: [
      { label: '补充边界条件', prompt: '请继续补充实现的边界条件、异常路径和回归风险点。' },
      { label: '给最小改动方案', prompt: EMPTY_SHORTCUT_PROMPTS.codingFix },
      { label: '输出验收清单', prompt: '请基于上面的方案给出可执行验收清单（功能、异常、回归、性能）。' },
    ],
  }

  const QUICK_MENU_PROFILES = {
    general: [
      {
        key: 'office-core',
        label: '办公核心',
        icon: 'optimize',
        items: [
          { label: '会议总结', icon: 'check', prompt: QUICK_ACTION_PROMPTS.meetingSummary },
          { label: '今日优先级', icon: 'list', prompt: QUICK_ACTION_PROMPTS.todayPriority },
        ],
      },
      {
        key: 'knowledge-collab',
        label: '文档与沟通',
        icon: 'note',
        items: [
          { label: '查文档/知识库', icon: 'note', prompt: QUICK_ACTION_PROMPTS.docKbSuggest },
          { label: '相关聊天', icon: 'chat', prompt: QUICK_ACTION_PROMPTS.relatedChats },
        ],
      },
    ],
    steward: [
      {
        key: 'knowledge-maintain',
        label: '知识维护',
        icon: 'bookOpen',
        items: [
          { label: '整理本地 Wiki', icon: 'folder', steward: 'ingest' },
          { label: '知识健康检查', icon: 'check', steward: 'lint' },
          { label: '升格 OKF', icon: 'pin', steward: 'promote' },
        ],
      },
      {
        key: 'knowledge-retrieve',
        label: '检索读取',
        icon: 'list',
        items: [
          { label: '检索远程知识库', icon: 'list', steward: 'remote-rag' },
          { label: '查文档/知识库', icon: 'note', prompt: QUICK_ACTION_PROMPTS.docKbSuggest },
        ],
      },
    ],
    writing: [
      {
        key: 'writing-docs',
        label: '文档起草',
        icon: 'edit',
        items: [
          { label: '写需求文档', icon: 'note', prompt: QUICK_ACTION_PROMPTS.writingRequirementsDoc },
          { label: '写办公文档', icon: 'chat', prompt: QUICK_ACTION_PROMPTS.writingOfficeDoc },
        ],
      },
      {
        key: 'writing-refine',
        label: '成稿与定稿',
        icon: 'list',
        items: [
          { label: '按提纲成稿', icon: 'list', prompt: QUICK_ACTION_PROMPTS.writingOutlineDraft },
          { label: '排版定稿', icon: 'check', prompt: QUICK_ACTION_PROMPTS.writingFinalize },
          { label: '润色去 AI 味', icon: 'expandText', prompt: QUICK_ACTION_PROMPTS.writingHumanize },
        ],
      },
    ],
    coding: [
      {
        key: 'coding-dev',
        label: '研发实现',
        icon: 'code',
        items: [
          { label: '问题排查', icon: 'optimize', prompt: QUICK_ACTION_PROMPTS.codingDebug },
          { label: '实现方案', icon: 'note', prompt: QUICK_ACTION_PROMPTS.codingImplement },
          { label: '改动评审', icon: 'check', prompt: QUICK_ACTION_PROMPTS.codingReview },
        ],
      },
      {
        key: 'coding-sync',
        label: '交付同步',
        icon: 'chat',
        items: [
          { label: '发布说明', icon: 'send', prompt: QUICK_ACTION_PROMPTS.codingRelease },
        ],
      },
    ],
  }

  function availableAssistantModes() {
    const base = Array.isArray(agents) && agents.length ? agents : fallbackExperts
    return base.map(item => ({
      id: String(item.id || ''),
      name: String(item.name || item.title || item.id || '未命名助手'),
      description: String(item.description || '处理相关工作任务'),
      source: 'agent',
    })).filter(item => item.id)
  }

  function availableExperts() {
    const base = availableAssistantModes()
    const hubExperts = Array.isArray(catalogExperts) ? catalogExperts : []
    const merged = new Map()
    for (const item of base) {
      merged.set(item.id, item)
    }
    for (const item of hubExperts) {
      const id = String(item.id || '').trim()
      if (!id) continue
      merged.set(id, {
        id,
        name: String(item.name || id),
        description: String(item.description || ''),
        avatar: String(item.avatar || ''),
        skills: Array.isArray(item.skills) ? item.skills : undefined,
        source: 'expert',
      })
    }
    return [...merged.values()].filter(item => item.id)
  }

  function isBuiltinAssistantMode(id) {
    const key = String(id || '').trim()
    return !!key && availableAssistantModes().some(item => item.id === key)
  }

  // 加号菜单只负责换模式。专家包的浏览与启动在专家库，混进来会让两种
  // 语义都失真，也曾让内置模式被当成专家包去加载而报「专家不存在」。
  function renderExpertPop() {
    if (!expertPop) return
    expertPop.innerHTML = availableAssistantModes().map(item => `
      <button type="button" class="agent-pop-item agent-expert-item${item.id === activeAgentId ? ' active' : ''}" data-expert-id="${escHtml(item.id)}">
        ${agentAvatarMarkHtml(agentMarkPayload(item.id, { agentId: item.id, name: item.name, description: item.description }), { size: 18 })}
        <span class="expert-copy"><span class="expert-name">${escHtml(item.name)}</span><span class="expert-desc">${escHtml(item.description)}</span></span>
      </button>`).join('')
    if (window.StickyIcons) window.StickyIcons.mount(expertPop)
  }

  async function selectExpert(agentId) {
    const mode = availableAssistantModes().find(item => item.id === agentId)
    if (!mode) return
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    hideHeadPops()
    const result = await startModeChat(mode.id)
    if (result.ok) toastFn(`已切换到${mode.name}`)
  }

  function tabTitle(sessionMeta) {
    if (!sessionMeta) return '新助手'
    if (sessionMeta.displayTitle) return compactSessionDisplayTitle(sessionMeta.displayTitle) || '新助手'
    if (sessionMeta.expertName) return String(sessionMeta.expertName).trim()
    const t = String(sessionMeta.title || '').trim()
    return compactSessionDisplayTitle(t) || '新助手'
  }

  function compactSessionDisplayTitle(raw = '') {
    const text = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    if (/(会议总结|会议纪要|会议记录|meeting_candidates|meeting_read)/i.test(text)) return '会议总结'
    if (/(今日优先级|today_priority)/i.test(text)) return '今日优先级'
    if (/(查文档\/知识库|doc_kb_suggest|知识库空间|最近自己编辑|最近自己阅读)/i.test(text)) return '查文档/知识库'
    if (/(相关的聊天|related_chats|@我)/i.test(text)) return '分析相关聊天'
    if (/(需求梳理|workflow-intake|intake\s*\/\s*ingest|可启动\s*(管线服务|Daemon)\s*工作流)/i.test(text)) return '需求梳理'
    if (/(需求文档搭档|需求文档初稿|非目标|验收标准)/i.test(text)) return '写需求文档'
    if (/(办公文档搭档|通知|汇报|周报|方案同步|会议纪要)/i.test(text)) return '写办公文档'
    if (/(根据我提供的标题|提纲和要点扩写|提纲成稿|大纲成稿)/i.test(text)) return '按提纲成稿'
    if (/(排版定稿|统一标题层级|可直接发送\/评审的定稿)/i.test(text)) return '排版定稿'
    if (/(去 ai 味|去AI味|Humanizer|humanize|AI 痕迹)/i.test(text)) return '润色去 AI 味'
    const leakedInstruction = /(第一阶段|第二阶段|不要直接读取正文|不要直接总结|feishu\.[a-z_]+|快捷操作执行规则|时间范围以点击时刻为准|需求文档搭档|办公文档搭档|提纲和要点扩写|排版定稿|去 AI 味处理)/i
    if (leakedInstruction.test(text)) {
      const concise = quickItemLabelFromPrompt(text)
      return concise && concise !== '快捷操作' ? concise : text.slice(0, 24)
    }
    return text.length > 40 ? `${text.slice(0, 36)}…` : text
  }

  function compactUserShortcutBubbleText(raw = '') {
    const text = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    const leakedInstruction = /(第一阶段|第二阶段|不要直接读取正文|不要直接总结|快捷操作执行规则|时间范围以点击时刻为准|feishu\.[a-z_]+|需求文档搭档|办公文档搭档|提纲和要点扩写|排版定稿|去 AI 味处理)/i
    if (!leakedInstruction.test(text)) return text
    if (/(会议总结|会议纪要|会议记录|meeting_candidates|meeting_read)/i.test(text)) return '会议总结'
    if (/(今日优先级|today_priority)/i.test(text)) return '今日优先级'
    if (/(查文档\/知识库|doc_kb_suggest|知识库空间|最近自己编辑|最近自己阅读)/i.test(text)) return '查文档/知识库'
    if (/(相关的聊天|related_chats|@我)/i.test(text)) return '分析相关聊天'
    if (/(需求梳理|workflow-intake|intake\s*\/\s*ingest|可启动\s*(管线服务|Daemon)\s*工作流)/i.test(text)) return '需求梳理'
    if (/(需求文档搭档|需求文档初稿|非目标|验收标准)/i.test(text)) return '写需求文档'
    if (/(办公文档搭档|通知|汇报|周报|方案同步|会议纪要)/i.test(text)) return '写办公文档'
    if (/(根据我提供的标题|提纲和要点扩写|提纲成稿|大纲成稿)/i.test(text)) return '按提纲成稿'
    if (/(排版定稿|统一标题层级|可直接发送\/评审的定稿)/i.test(text)) return '排版定稿'
    if (/(去 ai 味|去AI味|Humanizer|humanize|AI 痕迹)/i.test(text)) return '润色去 AI 味'
    return quickItemLabelFromPrompt(text)
  }

  function normalizeTopicKey(raw = '') {
    return String(raw || '')
      .toLowerCase()
      .replace(/[，。！？、；：,.!?;:'"()[\]{}<>《》【】]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function isLikelyContinuationTopic(text = '') {
    const s = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (!s) return true
    if (s.length <= 3) return /^(好|行|嗯|ok|收到|继续|再来|然后|下一步|同上|按这个|继续这个)$/.test(s)
    return /^(继续|然后|再|按上面|照这个|同上|下一步|沿用|基于上面)/.test(s)
  }

  function isMeaningfulTopic(text = '') {
    const raw = String(text || '').replace(/\s+/g, ' ').trim()
    if (!raw || isLikelyContinuationTopic(raw)) return false
    const compact = compactUserShortcutBubbleText(raw)
    const normalized = normalizeTopicKey(compact || raw)
    if (!normalized) return false
    if (/^(好|行|嗯|哦|ok|okay|收到|知道了|明白|谢谢|感谢|继续|再来|下一步|然后|同上|可以)$/.test(normalized)) return false
    const knownShortcut = /^(会议总结|今日优先级|查文档\/知识库|分析相关聊天)$/.test(compact)
    return knownShortcut || normalized.length >= 8
  }

  function topicSummaryFromUserText(raw = '', fallback = '') {
    const compact = compactUserShortcutBubbleText(raw) || fallback || '未命名主题'
    const text = String(compact || '').replace(/\s+/g, ' ').trim() || '未命名主题'
    return text.length > 28 ? `${text.slice(0, 26)}…` : text
  }

  function topicGoalFromUserText(raw = '', fallback = '') {
    const direct = compactSessionDisplayTitle(raw) || compactUserShortcutBubbleText(raw) || fallback || '未命名主题'
    const text = String(direct || '').replace(/\s+/g, ' ').trim() || '未命名主题'
    return text.length > 42 ? `${text.slice(0, 40)}…` : text
  }

  function buildConversationTopics() {
    const topics = []
    const byKey = new Map()
    let lastTopicKey = ''
    let userTurn = 0
    chatHistory.forEach((msg, msgIdx) => {
      if (msg?.role !== 'user') return
      userTurn += 1
      const raw = String(msg.text || '').trim()
      if (!isMeaningfulTopic(raw)) return
      const summary = topicSummaryFromUserText(raw, `主题 ${topics.length + 1}`)
      const goal = topicGoalFromUserText(raw, summary)
      let key = normalizeTopicKey(summary)
      if (isLikelyContinuationTopic(raw) && lastTopicKey) key = lastTopicKey
      if (!key) key = `topic-${userTurn}`
      if (!byKey.has(key)) {
        byKey.set(key, true)
        topics.push({
          key,
          summary,
          goal,
          userMsgIdx: msgIdx,
          firstTurn: userTurn,
        })
      }
      lastTopicKey = key
    })
    return topics
  }

  function groundingApi() {
    return window.ConversationGrounding || {
      buildGrounding: () => ({ active: false, title: '新对话', labels: [], text: '' }),
      userStatusLabel: (title, status) => status === 'done' ? '已完成' : '正在处理',
    }
  }

  function renderConversationMeta() {
    const topics = buildConversationTopics()
    if (topics.length <= 2) return ''
    const countLabel = `${topics.length} 个主题`
    const rows = topics.map((topic, idx) => `
      <button
        type="button"
        class="agent-conversation-anchor"
        data-conversation-anchor
        data-user-msg-idx="${topic.userMsgIdx}"
        aria-label="主题 ${idx + 1}，点击跳转到第 ${topic.firstTurn} 轮首条输入。"
      >
        <span class="agent-conversation-chip">#${idx + 1}</span>
        <span class="agent-conversation-goal">${escHtml(topic.summary)}</span>
      </button>
    `).join('')
    return `<div class="agent-conversation-meta" aria-label="对话主题目录">
      <div class="agent-conversation-summary">${escHtml(countLabel)}</div>
      <div class="agent-conversation-list">${rows}</div>
    </div>`
  }

  function syncConversationAnchorPosition() {
    if (!topicNav) return
    const hasAnchors = !!topicNav.querySelector('.agent-conversation-anchor')
    const hasVerticalOverflow = !!chatLog && (chatLog.scrollHeight - chatLog.clientHeight > 1)
    topicNav.hidden = !(hasAnchors && hasVerticalOverflow)
  }

  function jumpToConversationAnchor(userMsgIdx = null) {
    if (!chatLog) return
    const targetSelector = Number.isInteger(userMsgIdx)
      ? `.agent-bubble.user[data-user-msg-idx="${userMsgIdx}"]`
      : '.agent-bubble.user'
    const firstBubble = chatLog.querySelector(targetSelector) || chatLog.querySelector('.agent-bubble.user')
    if (!firstBubble) return
    chatStickToBottom = false
    const top = Math.max(0, (firstBubble.offsetTop || 0) - 8)
    beginProgrammaticChatScroll()
    chatLog.scrollTo({ top, behavior: 'smooth' })
  }

  function isChatNearBottom(threshold = CHAT_NEAR_BOTTOM_PX) {
    if (!chatLog) return true
    return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < threshold
  }

  function beginProgrammaticChatScroll() {
    chatProgrammaticScroll = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { chatProgrammaticScroll = false })
    })
  }

  function pinChatToBottom() {
    chatStickToBottom = true
    scrollChatToBottomIfNeeded(true)
  }

  function syncChatStickFromUserScroll() {
    if (!chatLog || chatProgrammaticScroll) return
    chatStickToBottom = isChatNearBottom()
  }

  function sortOpenTabs(ids) {
    const byId = new Map(sessions.map(s => [s.id, s]))
    const pinned = []
    const rest = []
    for (const id of ids) {
      if (byId.get(id)?.pinned) pinned.push(id)
      else rest.push(id)
    }
    return [...pinned, ...rest]
  }

  function renderSessionTabs() {
    if (!sessionTabsEl) return
    openSessionIds = sortOpenTabs(openSessionIds)
    const byId = new Map(sessions.map(s => [s.id, s]))
    sessionTabsEl.innerHTML = openSessionIds.map(id => {
      const meta = byId.get(id) || { id, title: '新助手' }
      const label = tabTitle(meta)
      const active = activeSession?.id === id
      const pinned = !!meta.pinned
      const pinIcon = pinned
        ? '<span class="ico tab-pin" data-icon="pin" title="已固定"></span>'
        : agentAvatarMarkHtml(agentMarkPayload(meta.agentId, meta), { size: 16, className: 'tab-agent-avatar' })
      return `<div class="agent-session-tab${active ? ' active' : ''}${pinned ? ' pinned' : ''}" data-session-id="${escHtml(id)}" role="tab" aria-selected="${active}" tabindex="0" title="${escHtml(label)}">
        ${pinIcon}
        <span class="tab-label">${escHtml(label)}</span>
        <button type="button" class="tab-close" data-close-session="${escHtml(id)}" title="关闭" aria-label="关闭">
          <span class="ico" data-icon="close"></span>
        </button>
      </div>`
    }).join('')
    if (window.StickyIcons) StickyIcons.mount(sessionTabsEl)
  }

  function persistSurfaceUi() {
    try { localStorage.setItem(SURFACE_UI_KEY, JSON.stringify(surfaceUi)) } catch {}
  }

  function updateCurrentSurfaceUi(activeId = activeSession?.id || '') {
    surfaceUi[surfaceMode] = {
      activeId,
      openIds: [...new Set(openSessionIds)],
    }
    persistSurfaceUi()
  }

  function saveDraft() {
    if (!activeSession?.id || !aiInput) return
    draftsBySession.set(activeSession.id, aiInput.value)
  }

  function resizeAiInput() {
    if (!aiInput) return
    aiInput.style.height = 'auto'
    const computedMax = Number.parseInt(window.getComputedStyle(aiInput).maxHeight || '', 10)
    const maxHeight = Number.isFinite(computedMax) && computedMax > 0
      ? computedMax
      : AI_INPUT_FALLBACK_MAX_HEIGHT
    const nextHeight = Math.min(aiInput.scrollHeight, maxHeight)
    aiInput.style.height = `${Math.max(nextHeight, 0)}px`
    aiInput.style.overflowY = aiInput.scrollHeight > maxHeight ? 'auto' : 'hidden'
    syncConversationAnchorPosition()
  }

  function restoreDraft() {
    if (!aiInput) return
    const draft = activeSession?.id ? (draftsBySession.get(activeSession.id) || '') : ''
    aiInput.value = draft
    syncComposerPlaceholder({ force: !draft.trim() })
    resizeAiInput()
    updateContextMeter()
  }

  async function activateSession(sessionId, { persist = true } = {}) {
    if (!sessionId) return
    saveDraft()
    clearAttachment()
    const result = await window.api.agentSessionGet(sessionId)
    if (!result?.ok) {
      toastFn(result?.error || '对话不存在', 'error')
      return false
    }
    activeSession = result.session
    activeAgentId = activeSession.agentId || 'general'
    renderQuickMenuForAgent(activeAgentId)
    const inflightHistory = inflightChatBySession.get(sessionId)
    if (inflightHistory) {
      // 生成中切面再回来：复用同一数组，避免磁盘半持久化覆盖 streaming 气泡
      chatHistory = inflightHistory
    } else {
      chatHistory = (activeSession.messages || []).map(m => hydrateLegacyAssistantMessage({
        role: m.role,
        text: m.text,
        trace: Array.isArray(m.trace) ? m.trace.map(item => ({ ...item })) : [],
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        status: m.status,
        durationMs: m.durationMs,
        protocolVersion: m.protocolVersion,
        answerHash: m.answerHash,
        ui: Array.isArray(m.ui) ? m.ui.map(item => ({ ...item, items: Array.isArray(item.items) ? item.items.map(it => ({ ...it })) : [] })) : undefined,
      }))
    }
    runArtifacts = Array.isArray(activeSession.run?.artifacts)
      ? activeSession.run.artifacts.map(a => ({ ...a }))
      : []
    if (!openSessionIds.includes(sessionId)) openSessionIds = [sessionId, ...openSessionIds]
    updateCurrentSurfaceUi(sessionId)
    if (persist && window.api.agentSessionSetUi) {
      await window.api.agentSessionSetUi({ openSessionIds, activeSessionId: sessionId })
    }
    restoreDraft()
    renderSessionTabs()
    chatStickToBottom = true
    renderChat()
    pinChatToBottom()
    return true
  }

  async function resumeSession(sessionId) {
    if (!sessionId) return false
    if (aiSend?.disabled) {
      toastFn('当前助手正在生成，请稍候')
      return false
    }
    const resumed = await activateSession(sessionId)
    if (resumed) toastFn('已恢复上次工作')
    return resumed
  }

  async function openArtifact(sessionId, artifactId) {
    if (!sessionId || !artifactId) return false
    if (aiSend?.disabled) {
      toastFn('当前助手正在生成，请稍候')
      return false
    }
    const activated = await activateSession(sessionId)
    if (!activated) return false
    setSurfaceMode('agent')
    if (workSurface?.openReview) {
      workSurface.openReview(artifactId, runArtifacts)
      return true
    }
    const art = (Array.isArray(runArtifacts) ? runArtifacts : [])
      .find(item => String(item?.id || '') === String(artifactId))
    const href = String(art?.url || art?.href || art?.openUrl || '').trim()
    if (href && window.api?.openExternal) {
      const opened = await window.api.openExternal(href)
      if (opened?.ok) {
        toastFn('已在外部打开产物')
        return true
      }
    }
    const text = String(art?.content || art?.body || art?.text || art?.markdown || '').trim()
    if (text) {
      const title = String(art?.title || art?.type || '产物').slice(0, 80)
      chatHistory.push({
        role: 'system-note',
        text: `【${title}】\n${text.slice(0, 4000)}${text.length > 4000 ? '\n…' : ''}`,
      })
      renderChat()
      toastFn('已在对话中展示产物内容')
      return true
    }
    toastFn('暂无可打开的产物视图', 'error')
    return false
  }

  async function createNewAgent(opts = {}) {
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    saveDraft()
    const payload = typeof opts === 'object' && (opts.agentId || opts.expertId)
      ? opts
      : { agentId: opts.agentId || activeAgentId || 'general', goal: opts.goal, role: opts.role }
    const created = await window.api.agentSessionNew(payload)
    if (!created?.ok) { toastFn(created?.error || '新建失败', 'error'); return }
    activeSession = created.session
    activeAgentId = activeSession.agentId || 'general'
    renderQuickMenuForAgent(activeAgentId)
    runArtifacts = Array.isArray(activeSession.run?.artifacts) ? [...activeSession.run.artifacts] : []
    const selectedExpertId = activeSession.expertId || activeSession.agentId
    const agentLabel = activeSession.expertName
      || activeSession.expert?.name
      || availableExperts().find(item => item.id === selectedExpertId)?.name
      || (activeSession.agentId === 'steward' ? '知识管家' : '新助手')
    sessions = [
      {
        ...activeSession,
        messages: undefined,
        displayTitle: activeSession.run?.goal || agentLabel,
        messageCount: 0,
      },
      ...sessions.filter(s => s.id !== activeSession.id),
    ]
    openSessionIds = [activeSession.id, ...openSessionIds.filter(id => id !== activeSession.id)]
    updateCurrentSurfaceUi(activeSession.id)
    if (window.api.agentSessionSetUi) {
      await window.api.agentSessionSetUi({ openSessionIds, activeSessionId: activeSession.id })
    }
    chatHistory = []
    clearAttachment()
    if (aiInput) aiInput.value = ''
    syncComposerPlaceholder({ force: true })
    draftsBySession.set(activeSession.id, '')
    renderSessionTabs()
    renderChat()
    return activeSession
  }

  async function startModeChat(modeId) {
    const mode = availableAssistantModes().find(item => item.id === String(modeId || '').trim())
    if (!mode) return { ok: false, error: '助手模式不存在' }
    if (aiSend?.disabled) return { ok: false, error: '当前助手正在生成，请稍候' }
    if (!sessionsLoaded && sessionsLoadPromise) await sessionsLoadPromise

    const previousSurface = surfaceMode
    if (surfaceMode !== 'agent' && activeSession?.id) updateCurrentSurfaceUi(activeSession.id)
    surfaceMode = 'agent'
    const created = await createNewAgent({ agentId: mode.id })
    if (!created) {
      surfaceMode = previousSurface
      return { ok: false, error: '无法开始对话', notified: true }
    }

    requestAnimationFrame(() => {
      aiInput?.focus()
      resizeAiInput()
    })
    return { ok: true, session: created }
  }

  async function startExpertChat(expertIdOrOptions) {
    const options = expertIdOrOptions && typeof expertIdOrOptions === 'object'
      ? expertIdOrOptions
      : { expertId: expertIdOrOptions }
    const id = String(options.expertId || '').trim()
    if (!id) return { ok: false, error: '缺少专家 ID' }
    // 内置模式没有对应的专家包目录，交给 loadExpert 只会得到 not_found。
    if (isBuiltinAssistantMode(id)) return startModeChat(id)
    if (aiSend?.disabled) return { ok: false, error: '当前助手正在生成，请稍候' }
    if (!sessionsLoaded && sessionsLoadPromise) await sessionsLoadPromise
    await ensureExpertCatalog()
    // 目录缓存只用来取显示名。它加载失败时会被静默置空，若拿它当准入判据，
    // 用户就会遇到「卡片看得见、点了没反应」；权威校验交给主进程 loadExpert。
    const expert = catalogExperts.find(item => String(item.id || '') === id) || null

    const targetSurface = options.surface === 'workbench' ? 'workbench' : 'agent'
    const previousSurface = surfaceMode
    if (surfaceMode !== targetSurface && activeSession?.id) updateCurrentSurfaceUi(activeSession.id)
    surfaceMode = targetSurface
    const knowledgeRefs = Array.isArray(options.knowledgeRefs)
      ? [...new Set(options.knowledgeRefs.map(item => String(item?.id || item?.providerId || item || '').trim()).filter(Boolean))]
      : []
    const created = await createNewAgent({
      agentId: 'general',
      expertId: id,
      goal: String(options.goal || '').trim(),
      knowledgeRefs,
      taskRef: options.taskRef || null,
    })
    if (!created) {
      surfaceMode = previousSurface
      return { ok: false, error: '无法开始对话', notified: true }
    }

    const draft = String(options.goal || '').trim()
    if (aiInput && draft) {
      aiInput.value = draft
      draftsBySession.set(created.id, draft)
      syncComposerPlaceholder({ force: true })
    }
    renderQuickMenuForAgent('general')
    renderExpertPop()
    void ensureKnowledgeCatalog({ rerender: true })
    requestAnimationFrame(() => {
      aiInput?.focus()
      resizeAiInput()
    })
    toastFn(`已开始与${created.expertName || created.expert?.name || expert?.name || id}对话`)
    return { ok: true, session: created }
  }

  async function startSkillChat({ skillId, prompt = '', title = '' } = {}) {
    const id = String(skillId || '').trim()
    if (!id) return { ok: false, error: '缺少技能 ID' }
    if (aiSend?.disabled) return { ok: false, error: '当前助手正在生成，请稍候' }
    if (!sessionsLoaded && sessionsLoadPromise) await sessionsLoadPromise

    const previousSurface = surfaceMode
    if (surfaceMode !== 'agent' && activeSession?.id) updateCurrentSurfaceUi(activeSession.id)
    surfaceMode = 'agent'
    const created = await createNewAgent({ agentId: 'general' })
    if (!created) {
      surfaceMode = previousSurface
      return { ok: false, error: '无法开始对话', notified: true }
    }

    // 任务提示词只做预填：它是模板，用户通常还要补上自己的上下文再发送。
    const draft = String(prompt || '').trim()
    if (aiInput && draft) {
      aiInput.value = draft
      draftsBySession.set(created.id, draft)
      syncComposerPlaceholder({ force: true })
    }
    requestAnimationFrame(() => {
      aiInput?.focus()
      resizeAiInput()
    })
    toastFn(`已带上「${title || id}」，确认内容后发送`)
    return { ok: true, session: created }
  }

  /** 同步恢复目标 surface 的打开集合并重绘 Tab（须在任何 await 之前调用，避免跨面闪签） */
  function paintSurfaceTabs(mode) {
    const state = surfaceUi[mode] || { openIds: [], activeId: '' }
    openSessionIds = (state.openIds || []).filter(id => sessions.some(s => s.id === id))
    const savedId = sessions.some(s => s.id === state.activeId) ? state.activeId : ''
    if (savedId && !openSessionIds.includes(savedId)) openSessionIds.unshift(savedId)
    renderSessionTabs()
    return savedId || openSessionIds[0] || ''
  }

  async function activateSurfaceSession(mode, fallbackId = '') {
    if (!sessionsLoaded) return
    const nonce = ++surfaceSwitchNonce
    const state = surfaceUi[mode] || { openIds: [], activeId: '' }
    paintSurfaceTabs(mode)
    const savedId = sessions.some(s => s.id === state.activeId) ? state.activeId : ''
    const targetId = savedId
      || openSessionIds[0]
      || (mode === 'agent' && sessions.some(s => s.id === fallbackId) ? fallbackId : '')
    if (targetId) {
      if (!openSessionIds.includes(targetId)) {
        openSessionIds.unshift(targetId)
        renderSessionTabs()
      }
      await activateSession(targetId)
      if (nonce !== surfaceSwitchNonce) return
      return
    }
    const created = await createNewAgent(mode === 'workbench'
      ? { agentId: 'general', goal: WORKBENCH_SESSION_GOAL }
      : { agentId: 'general' })
    if (!created || nonce !== surfaceSwitchNonce) return
    updateCurrentSurfaceUi(created.id)
  }

  async function runStewardTemplate(kind) {
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    const goals = {
      ingest: '整理本地 Wiki',
      lint: '知识健康检查',
      promote: '升格 OKF',
      'remote-rag': '检索远程知识库',
    }
    const goal = goals[kind] || '知识管家任务'
    if (!activeSession || activeSession.agentId !== 'steward' || chatHistory.length) {
      await createNewAgent({ agentId: 'steward', role: 'steward', goal })
    } else {
      await window.api.agentRunUpdate({
        sessionId: activeSession.id,
        goal,
        role: 'steward',
      })
      activeSession = { ...activeSession, run: { ...(activeSession.run || {}), goal, role: 'steward' } }
      sessions = sessions.map(s => s.id === activeSession.id
        ? { ...s, displayTitle: goal }
        : s)
      renderSessionTabs()
    }
    if (!activeSession?.id) return

    if (kind === 'remote-rag') {
      if (!shortcutHasMaterial()) {
        chatHistory.push({ role: 'system-note', text: '请用一句话告诉我要在远程知识库里检索什么主题，我就去查（需已在「设置 → 连接器」启用公司 MCP）。' })
        renderChat()
        try { aiInput?.focus() } catch { /* noop */ }
        return
      }
      const prompt = [
        '请检索远程知识库：通过已配置的公司 MCP 调用 RAG 检索工具（优先 ragflow_retrieval）读取远程知识库。',
        '若我已给出具体问题，立即检索并整理命中结果（标题、摘要、来源/相似度）；若尚未给出问题，先用一句话请我补充查询主题。',
        'MCP 未启用、命令未配置或 allowlist 未放行 RAG 工具时，明确说明并引导：设置 → 连接器 → 启用公司 MCP 并放行 ragflow_retrieval（或等价 RAG 工具）。',
        '禁止编造未检索到的内容。',
      ].join('')
      await dispatchAgentAction({
        id: 'steward-remote-rag',
        kind: 'conversation',
        execution: 'send',
        label: '检索远程知识库',
        payload: prompt,
        source: 'shortcut',
      }, { messageId: activeSession.id })
      return
    }

    if (kind === 'lint') {
      const res = await window.api.knowledgeOsStewardLint(activeSession.id)
      if (!res?.ok) { toastFn(res?.error || 'lint 失败', 'error'); return }
      runArtifacts = res.session?.run?.artifacts || [res.artifact]
      chatHistory.push({
        role: 'system-note',
        text: res.lint?.healthy
          ? `知识健康检查通过（扫描 ${res.lint.scanned} 个文件）。`
          : `发现 ${res.lint?.issueCount || 0} 个问题，请在右侧审阅。`,
      })
      renderChat()
      toastFn('已完成健康检查')
      return
    }

    if (kind === 'ingest') {
      openKnowledgePanel?.('知识库 · AI 整理', 'organize')
      chatHistory.push({
        role: 'system-note',
        text: '已打开 AI 整理工作台。请选择全部资料、新增资料或指定主题，生成整理提案后再审核写入。',
      })
      renderChat()
      return
    }

    if (kind === 'promote') {
      const started = await window.api.knowledgeStewardTaskCreate?.({
        scope: { mode: 'changed' },
      })
      if (!started?.ok) {
        toastFn(started?.error || '整理任务启动失败', 'error')
        return
      }
      chatHistory.push({
        role: 'system-note',
        text: started.proposals?.length
          ? `已生成 ${started.proposals.length} 条整理提案，请在知识库审核区逐条确认。`
          : '当前没有新的整理提案，请先检查资料范围或刷新知识源。',
      })
      openKnowledgePanel?.('知识库 · 待审核提案', 'review')
      renderChat()
    }
  }

  async function handleArtifactAction(act, artId) {
    if (!artId) return
    if (act === 'open') {
      if (workSurface) workSurface.openReview(artId, runArtifacts)
      return
    }
    if (!activeSession?.id) return
    const art = runArtifacts.find(a => a.id === artId)
    if (act === 'apply-editor') {
      const ctx = await getEditorContext()
      if (!ctx?.noteId) {
        toastFn('请先打开目标文件，再写入当前编辑器', 'error')
        return
      }
      applyToEditor(String(art?.body || ''), 'replace')
      await logApply('replace', '已从写作文稿审阅区写入当前编辑器', ctx.noteId)
      const res = await window.api.agentArtifactAccept({
        sessionId: activeSession.id,
        artifactId: artId,
      })
      if (res?.ok) {
        runArtifacts = res.session?.run?.artifacts || runArtifacts.map(a =>
          a.id === artId ? { ...a, status: 'accepted' } : a
        )
        if (activeSession && res.session) activeSession = { ...activeSession, ...res.session }
      }
      pushTrail('已将审阅中的文稿写入当前编辑器')
      toastFn('已写入当前编辑器')
      renderChat()
      return
    }
    if (act === 'feishu-draft') {
      const title = String(art?.meta?.suggestedFeishuTitle || art?.title || 'KnowMe 文档草稿').trim()
      const created = await window.api.connectorsCreateDocDraft({
        title,
        body: String(art?.body || ''),
        sourceArtifactId: artId,
      })
      if (!created?.ok) {
        toastFn(created?.message || created?.error || '生成飞书草稿失败', 'error')
        return
      }
      const res = await window.api.agentArtifactAccept({
        sessionId: activeSession.id,
        artifactId: artId,
      })
      if (res?.ok) {
        runArtifacts = res.session?.run?.artifacts || runArtifacts.map(a =>
          a.id === artId ? { ...a, status: 'accepted' } : a
        )
        if (activeSession && res.session) activeSession = { ...activeSession, ...res.session }
      }
      pushTrail(`已生成飞书文档草稿「${title}」，等待你确认后再真正写入飞书`)
      toastFn('已生成飞书文档草稿')
      renderChat()
      return
    }
    if (act === 'accept') {
      if (art?.type === 'editor_patch') {
        const ctx = await getEditorContext()
        if (!ctx?.noteId) {
          toastFn('请先打开目标文件，再接受写入', 'error')
          return
        }
      }
      const res = await window.api.agentArtifactAccept({
        sessionId: activeSession.id,
        artifactId: artId,
      })
      if (!res?.ok) { toastFn(res?.error || '接受失败', 'error'); return }
      runArtifacts = res.session?.run?.artifacts || runArtifacts.map(a =>
        a.id === artId ? { ...a, status: 'accepted' } : a
      )
      if (activeSession && res.session) activeSession = { ...activeSession, ...res.session }
      if (res.editorPatch) {
        const mode = res.applyMode || 'replace'
        applyToEditor(res.body || '', mode === 'append' || mode === 'insert' ? mode : 'replace')
        pushTrail(modeTrailText(mode, true))
        toastFn('已允许写入当前文件')
      } else {
        toastFn(res.written ? `已写入 ${res.written}` : '已接受')
      }
      renderChat()
      return
    }
    if (act === 'reject') {
      const res = await window.api.agentArtifactReject({
        sessionId: activeSession.id,
        artifactId: artId,
      })
      if (!res?.ok) { toastFn(res?.error || '拒绝失败', 'error'); return }
      runArtifacts = res.session?.run?.artifacts || runArtifacts.map(a =>
        a.id === artId ? { ...a, status: 'rejected' } : a
      )
      if (activeSession && res.session) activeSession = { ...activeSession, ...res.session }
      if (art?.type === 'editor_patch') {
        pushTrail('已拒绝写入当前文件')
        toastFn('已拒绝写入')
      } else {
        toastFn('已拒绝')
      }
      renderChat()
    }
  }

  function modeTrailText(mode, ok) {
    if (!ok) return '操作未完成'
    if (mode === 'insert') return '已插入到当前文件光标处'
    if (mode === 'append') return '已追加到当前文件文末'
    return '已替换当前文件全文'
  }

  function pushTrail(text) {
    chatHistory.push({ role: 'system-note', text: String(text || '').trim() })
    if (activeSession) activeSession.messages = chatHistory.filter(m => m.role !== 'loading')
  }

  async function logApply(action, detail, noteId) {
    if (!activeSession?.id || !window.api.agentApplyLog) return
    const res = await window.api.agentApplyLog({
      sessionId: activeSession.id,
      action,
      detail,
      noteId,
    })
    if (res?.ok && res.session) activeSession = { ...activeSession, ...res.session }
  }

  async function applyLowRisk(mode, text) {
    const ctx = await getEditorContext()
    if (!ctx?.noteId) {
      toastFn('请先打开一个文件', 'error')
      return
    }
    applyToEditor(text, mode)
    const detail = modeTrailText(mode, true)
    pushTrail(detail)
    await logApply(mode, detail, ctx.noteId)
    toastFn(detail)
    renderChat()
  }

  async function proposeReplace(text) {
    if (!activeSession?.id) {
      toastFn('请先打开一个对话 Session', 'error')
      return
    }
    const ctx = await getEditorContext()
    if (!ctx?.noteId) {
      toastFn('请先打开目标文件', 'error')
      return
    }
    const artifact = {
      type: 'editor_patch',
      title: '替换当前文件全文（待确认）',
      body: String(text || ''),
      status: 'draft',
      meta: { mode: 'replace', noteId: ctx.noteId },
    }
    const res = await window.api.agentArtifactAdd({
      sessionId: activeSession.id,
      artifact,
    })
    if (!res?.ok) { toastFn(res?.error || '无法创建写入提案', 'error'); return }
    runArtifacts = res.session?.run?.artifacts || [...runArtifacts, res.artifact]
    if (res.session) activeSession = { ...activeSession, ...res.session }
    pushTrail('已生成「替换全文」提案，请在产物卡中接受或拒绝')
    toastFn('请确认是否允许替换全文')
    renderChat()
  }

  async function closeSessionTabs(sessionIds, { toastSuccess = '' } = {}) {
    const ids = [...new Set((sessionIds || []).map(String).filter(Boolean))]
      .filter(id => openSessionIds.includes(id))
    if (!ids.length) return
    if (aiSend?.disabled && activeSession?.id && ids.includes(activeSession.id)) {
      toastFn('当前助手正在生成，请稍候')
      return
    }
    saveDraft()
    let lastResult = null
    for (const id of ids) {
      const result = await window.api.agentSessionCloseTab(id)
      if (!result?.ok) { toastFn(result?.error || '关闭失败', 'error'); return }
      lastResult = result
      openSessionIds = result.ui?.openSessionIds || openSessionIds.filter(item => item !== id)
      draftsBySession.delete(id)
    }
    const list = await window.api.agentSessionList()
    sessions = list.sessions || sessions
    agents = list.agents || agents
    const nextId = lastResult?.ui?.activeSessionId || openSessionIds[0] || ''
    updateCurrentSurfaceUi(nextId)
    if (nextId) await activateSession(nextId, { persist: false })
    else renderSessionTabs()
    if (toastSuccess) toastFn(toastSuccess)
  }

  async function closeSessionTab(sessionId) {
    await closeSessionTabs([sessionId])
  }

  function renderHistoryPop() {
    if (!historyPop) return
    const recent = [...sessions]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 30)
    if (!recent.length) {
      historyPop.innerHTML = '<div class="agent-pop-empty">暂无历史 Session</div>'
      return
    }
    historyPop.innerHTML = recent.map(s => {
      const open = openSessionIds.includes(s.id)
      const label = tabTitle(s)
      const when = s.updatedAt ? new Date(s.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
      return `<button type="button" class="agent-pop-item${activeSession?.id === s.id ? ' active' : ''}" data-reopen="${escHtml(s.id)}">
        ${agentAvatarMarkHtml(agentMarkPayload(s.agentId, s), { size: 18 })}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(label)}</span>
        <span class="pop-meta">${open ? '已打开' : escHtml(when)}</span>
      </button>`
    }).join('')
    if (window.StickyIcons) StickyIcons.mount(historyPop)
  }

  function hasErrorBubble() {
    return chatHistory.some(m => m.role === 'error' && String(m.text || '').trim())
  }

  function lastErrorText() {
    const err = [...chatHistory].reverse().find(m => m.role === 'error' && String(m.text || '').trim())
    return err ? String(err.text) : ''
  }

  function renderMorePop() {
    if (!morePop) return
    const canCopyErr = hasErrorBubble()
    const presenceEnabled = window.KnowMeAgentPresence?.enabled !== false
    morePop.innerHTML = `
      <button type="button" class="agent-pop-item" data-more="copy-summary">
        <span class="ico" data-icon="copy" style="width:14px;height:14px"></span><span>复制当前总结</span>
      </button>
      <button type="button" class="agent-pop-item" data-more="fork">
        <span class="ico" data-icon="plus" style="width:14px;height:14px"></span><span>在新对话继续</span>
      </button>
      <button type="button" class="agent-pop-item" data-more="rename">
        <span class="ico" data-icon="edit" style="width:14px;height:14px"></span><span>重命名</span>
      </button>
      <div class="agent-pop-sep"></div>
      <button type="button" class="agent-pop-item" data-more="toggle-presence" aria-pressed="${presenceEnabled ? 'true' : 'false'}">
        <span class="ico" data-icon="optimize" style="width:14px;height:14px"></span><span>动作表现：${presenceEnabled ? '已开启' : '已关闭'}</span>
      </button>
      <button type="button" class="agent-pop-item" data-more="copy-error" ${canCopyErr ? '' : 'disabled'}>
        <span class="ico" data-icon="copy" style="width:14px;height:14px"></span><span>复制错误信息</span>
      </button>
      <button type="button" class="agent-pop-item" data-more="close">
        <span class="ico" data-icon="close" style="width:14px;height:14px"></span><span>关闭 Tab</span>
      </button>`
    if (window.StickyIcons) StickyIcons.mount(morePop)
  }

  async function handleMoreAction(action) {
    hideHeadPops()
    if (action === 'toggle-presence') {
      const controller = window.KnowMeAgentPresence
      if (!controller?.setEnabled) return
      const enabled = controller.setEnabled(!controller.enabled)
      toastFn(enabled ? '已开启动作表现' : '已关闭动作表现')
      return
    }
    if (!activeSession?.id) return
    if (action === 'copy-summary') {
      const res = await window.api.agentSessionSummary(activeSession.id)
      const text = res?.ok ? res.text : ''
      if (!text?.trim()) { toastFn('当前还没有可复制的总结'); return }
      window.api.copyToClipboard(text)
      toastFn('已复制当前总结')
      return
    }
    if (action === 'fork') {
      if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
      const res = await window.api.agentSessionFork(activeSession.id)
      if (!res?.ok) { toastFn(res?.error || '创建失败', 'error'); return }
      sessions = [
        { ...res.session, messages: undefined, displayTitle: '新助手', messageCount: 0 },
        ...sessions.filter(s => s.id !== res.session.id),
      ]
      openSessionIds = [res.session.id, ...openSessionIds.filter(id => id !== res.session.id)]
      updateCurrentSurfaceUi(res.session.id)
      await activateSession(res.session.id, { persist: false })
      toastFn('已在新对话继续')
      return
    }
    if (action === 'rename') {
      const labelEl = sessionTabsEl?.querySelector(`.agent-session-tab.active .tab-label`)
        || [...(sessionTabsEl?.querySelectorAll('[data-session-id]') || [])]
          .find(el => el.dataset.sessionId === activeSession.id)
          ?.querySelector('.tab-label')
      if (!labelEl) return
      const current = tabTitle(sessions.find(s => s.id === activeSession.id) || activeSession)
      const input = document.createElement('input')
      input.type = 'text'
      input.value = current
      input.maxLength = 80
      input.style.cssText = 'width:110px;height:22px;border:1px solid var(--div);border-radius:5px;padding:0 6px;font:500 12px var(--ui);outline:none'
      labelEl.replaceWith(input)
      input.focus()
      input.select()
      const commit = async () => {
        const next = input.value.trim()
        input.replaceWith(labelEl)
        if (!next || next === current) { renderSessionTabs(); return }
        const res = await window.api.agentSessionRename(activeSession.id, next)
        if (!res?.ok) { toastFn(res?.error || '重命名失败', 'error'); renderSessionTabs(); return }
        sessions = sessions.map(s => s.id === activeSession.id
          ? { ...s, title: res.session.title, displayTitle: res.session.displayTitle }
          : s)
        activeSession = { ...activeSession, title: res.session.title }
        renderSessionTabs()
        toastFn('已重命名')
      }
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { e.preventDefault(); renderSessionTabs() }
      })
      input.addEventListener('blur', () => commit())
      return
    }
    if (action === 'copy-error') {
      const text = lastErrorText()
      if (!text) { toastFn('当前没有错误信息'); return }
      window.api.copyToClipboard(text)
      toastFn('已复制错误信息')
      return
    }
    if (action === 'close') {
      await closeSessionTab(activeSession.id)
    }
  }

  function showTabContextMenu(sessionId, clientX, clientY) {
    if (!tabCtxPop || !sessionId) return
    const meta = sessions.find(s => s.id === sessionId) || { id: sessionId }
    const pinned = !!meta.pinned
    const orderedIds = sortOpenTabs([...openSessionIds])
    const currentIndex = orderedIds.indexOf(sessionId)
    const leftIds = currentIndex > 0 ? orderedIds.slice(0, currentIndex) : []
    const rightIds = currentIndex >= 0 ? orderedIds.slice(currentIndex + 1) : []
    const otherIds = orderedIds.filter(id => id !== sessionId)
    tabCtxPop.innerHTML = `
      <button type="button" class="agent-pop-item" data-tab-ctx="manage" data-session-id="${escHtml(sessionId)}">
        <span class="ico" data-icon="settingsLine" style="width:14px;height:14px"></span><span>管理对话</span>
      </button>
      <button type="button" class="agent-pop-item" data-tab-ctx="transcript" data-session-id="${escHtml(sessionId)}">
        <span class="ico" data-icon="copy" style="width:14px;height:14px"></span><span>复制对话记录</span>
      </button>
      <button type="button" class="agent-pop-item" data-tab-ctx="pin" data-session-id="${escHtml(sessionId)}">
        <span class="ico" data-icon="pin" style="width:14px;height:14px"></span><span>${pinned ? '取消 Pin' : 'Pin'}</span>
      </button>
      <div class="agent-pop-sep"></div>
      <button type="button" class="agent-pop-item" data-tab-ctx="close-left" data-session-id="${escHtml(sessionId)}" ${leftIds.length ? '' : 'disabled'}>
        <span class="ico" data-icon="close" style="width:14px;height:14px"></span><span>关闭左侧</span>
      </button>
      <button type="button" class="agent-pop-item" data-tab-ctx="close-right" data-session-id="${escHtml(sessionId)}" ${rightIds.length ? '' : 'disabled'}>
        <span class="ico" data-icon="close" style="width:14px;height:14px"></span><span>关闭右侧</span>
      </button>
      <button type="button" class="agent-pop-item" data-tab-ctx="close-others" data-session-id="${escHtml(sessionId)}" ${otherIds.length ? '' : 'disabled'}>
        <span class="ico" data-icon="close" style="width:14px;height:14px"></span><span>关闭其他</span>
      </button>`
    if (window.StickyIcons) StickyIcons.mount(tabCtxPop)
    hideHeadPops()
    tabCtxPop.classList.add('show')
    const pad = 8
    const w = tabCtxPop.offsetWidth || 180
    const h = tabCtxPop.offsetHeight || 120
    const left = Math.min(clientX, window.innerWidth - w - pad)
    const top = Math.min(clientY, window.innerHeight - h - pad)
    tabCtxPop.style.left = `${Math.max(pad, left)}px`
    tabCtxPop.style.top = `${Math.max(pad, top)}px`
  }

  async function handleTabCtxAction(action, sessionId) {
    hideHeadPops()
    if (!sessionId) return
    const orderedIds = sortOpenTabs([...openSessionIds])
    const currentIndex = orderedIds.indexOf(sessionId)
    const leftIds = currentIndex > 0 ? orderedIds.slice(0, currentIndex) : []
    const rightIds = currentIndex >= 0 ? orderedIds.slice(currentIndex + 1) : []
    const otherIds = orderedIds.filter(id => id !== sessionId)
    if (action === 'manage') {
      if (aiSend?.disabled && activeSession?.id !== sessionId) {
        toastFn('当前助手正在生成，请稍候')
        return
      }
      if (activeSession?.id !== sessionId) await activateSession(sessionId)
      renderMorePop()
      morePop?.classList.add('show')
      return
    }
    if (action === 'transcript') {
      const res = await window.api.agentSessionTranscript(sessionId)
      if (!res?.ok) { toastFn(res?.error || '复制失败', 'error'); return }
      const text = String(res.text || '').trim()
      if (!text) { toastFn('当前还没有可复制的 Transcript'); return }
      window.api.copyToClipboard(text)
      toastFn('已复制对话记录')
      return
    }
    if (action === 'pin') {
      const meta = sessions.find(s => s.id === sessionId)
      const nextPinned = !meta?.pinned
      const res = await window.api.agentSessionPin(sessionId, nextPinned)
      if (!res?.ok) { toastFn(res?.error || '操作失败', 'error'); return }
      sessions = sessions.map(s => s.id === sessionId
        ? { ...s, pinned: !!res.session.pinned }
        : s)
      openSessionIds = sortOpenTabs(openSessionIds)
      updateCurrentSurfaceUi()
      if (window.api.agentSessionSetUi) {
        await window.api.agentSessionSetUi({ openSessionIds, activeSessionId: activeSession?.id || '' })
      }
      renderSessionTabs()
      toastFn(nextPinned ? '已 Pin' : '已取消 Pin')
      return
    }
    if (action === 'close-left') {
      await closeSessionTabs(leftIds, { toastSuccess: '已关闭左侧会话' })
      return
    }
    if (action === 'close-right') {
      await closeSessionTabs(rightIds, { toastSuccess: '已关闭右侧会话' })
      return
    }
    if (action === 'close-others') {
      await closeSessionTabs(otherIds, { toastSuccess: '已关闭其他会话' })
    }
  }

  function isWorkbenchOwnedSession(sessionMeta) {
    if (!sessionMeta || typeof sessionMeta !== 'object') return false
    const taskKind = String(sessionMeta.taskRef?.kind || '')
    if (taskKind === 'workbench-task' || taskKind === 'workflow-chat' || taskKind === 'expert-chat') {
      return true
    }
    const goal = String(
      sessionMeta.run?.goal
      || sessionMeta.displayTitle
      || sessionMeta.title
      || ''
    ).trim()
    if (goal === WORKBENCH_SESSION_GOAL) return true
    // 「工作台 ·」「工作台 -」「工作台—」等历史/展示变体均视为工作台归属
    if (/^工作台\s*[·\-—–]/.test(goal) || goal.startsWith('工作台·')) return true
    return false
  }

  function relocateWorkbenchSessionsFromAgentSurface() {
    const byId = new Map(sessions.map(session => [session.id, session]))
    const keepAgent = []
    const moveIds = []
    for (const id of surfaceUi.agent.openIds) {
      const meta = byId.get(id)
      if (meta && isWorkbenchOwnedSession(meta)) moveIds.push(id)
      else keepAgent.push(id)
    }
    if (!moveIds.length) {
      if (surfaceUi.agent.activeId && byId.has(surfaceUi.agent.activeId)
        && isWorkbenchOwnedSession(byId.get(surfaceUi.agent.activeId))) {
        surfaceUi.agent.activeId = keepAgent[0] || ''
        persistSurfaceUi()
      }
      return
    }
    surfaceUi.agent.openIds = keepAgent
    if (!keepAgent.includes(surfaceUi.agent.activeId)) {
      surfaceUi.agent.activeId = keepAgent[0] || ''
    }
    surfaceUi.workbench.openIds = [...new Set([...moveIds, ...surfaceUi.workbench.openIds])]
    if (!surfaceUi.workbench.activeId || !surfaceUi.workbench.openIds.includes(surfaceUi.workbench.activeId)) {
      surfaceUi.workbench.activeId = surfaceUi.workbench.openIds[0] || ''
    }
    persistSurfaceUi()
  }

  async function loadSessions() {
    if (!window.api?.agentSessionList) return
    const result = await window.api.agentSessionList()
    agents = result.agents || []
    sessions = result.sessions || []
    const persistedOpenIds = result.ui?.openSessionIds || []
    const activeId = result.ui?.activeSessionId || persistedOpenIds[0]
    sessionsLoaded = true
    relocateWorkbenchSessionsFromAgentSurface()
    const workbenchIds = new Set(surfaceUi.workbench.openIds)
    if (surfaceUi.workbench.activeId) workbenchIds.add(surfaceUi.workbench.activeId)
    for (const id of persistedOpenIds) {
      const meta = sessions.find(session => session.id === id)
      if (meta && isWorkbenchOwnedSession(meta)) workbenchIds.add(id)
    }
    surfaceUi.workbench.openIds = [...workbenchIds]
    if (!surfaceUi.agent.openIds.length) {
      surfaceUi.agent.openIds = persistedOpenIds.filter(id => !workbenchIds.has(id))
    } else {
      surfaceUi.agent.openIds = surfaceUi.agent.openIds.filter(id => !workbenchIds.has(id))
    }
    if (surfaceUi.agent.activeId && workbenchIds.has(surfaceUi.agent.activeId)) {
      surfaceUi.agent.activeId = surfaceUi.agent.openIds[0] || ''
    }
    if (!surfaceUi.agent.activeId && activeId && !workbenchIds.has(activeId)) {
      surfaceUi.agent.activeId = activeId
    }
    if (!surfaceUi.workbench.activeId && surfaceUi.workbench.openIds.length) {
      surfaceUi.workbench.activeId = surfaceUi.workbench.openIds[0]
    }
    persistSurfaceUi()
    await activateSurfaceSession(surfaceMode, activeId)
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function openImageViewer(src, alt = '') {
    const safeSrc = String(src || '').trim()
    if (!safeSrc || !agentImageViewer || !agentImageViewerImg) return
    agentImageViewerImg.src = safeSrc
    agentImageViewerImg.alt = String(alt || '图片预览')
    agentImageViewer.classList.add('show')
    agentImageViewer.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  function closeImageViewer() {
    if (!agentImageViewer || !agentImageViewerImg) return
    agentImageViewer.classList.remove('show')
    agentImageViewer.setAttribute('aria-hidden', 'true')
    agentImageViewerImg.removeAttribute('src')
    document.body.style.overflow = ''
  }

  function cleanLinkLabel(label, fallback = '飞书文档') {
    const cleaned = String(label || '')
      .trim()
      .replace(/^(?:<code>|&lt;code&gt;)([\s\S]*?)(?:<\/code>|&lt;\/code&gt;)$/i, '$1')
      .replace(/<\/?(?:code|strong|em)>/gi, '')
      .trim()
    return cleaned || fallback
  }

  function renderFeishuLinkCard(href, label) {
    const parsed = window.FeishuLink?.parseOpenLink?.(href)
    if (!parsed?.isFeishu) return null
    const rawTitle = cleanLinkLabel(label)
    const resource = parsed.feishuResource || { type: 'resource', label: '飞书资源', glyph: '飞' }
    const meeting = resource.type === 'minutes'
      ? rawTitle.match(/^(\d{1,2})\.\s*(.+?)｜([^｜]+)(?:｜组织者：(.+))?$/)
      : null
    const title = meeting ? String(meeting[2] || '').trim() : rawTitle
    const meetingMeta = meeting
      ? [String(meeting[3] || '').trim(), meeting[4] ? `组织者：${String(meeting[4]).trim()}` : '']
        .filter(Boolean)
        .join(' ｜ ')
      : ''
    const titleEsc = escHtml(title)
    const hrefEsc = escHtml(parsed.href)
    // Chat deep-links stay compact so related-chats lists remain scannable.
    if (resource.type === 'chat') {
      return `<a href="${hrefEsc}" class="chat-open-link feishu-chat-open" data-resource-type="chat" data-open-url="${hrefEsc}" data-open-title="${titleEsc}" title="在飞书打开会话">${titleEsc}<span class="feishu-chat-open-mark" aria-hidden="true">↗</span></a>`
    }
    const metaHtml = meetingMeta
      ? `<span class="feishu-link-meta">${escHtml(meetingMeta)}</span>`
      : ''
    return `<a class="feishu-link-card${meeting ? ' feishu-meeting-card' : ''}" href="${hrefEsc}" data-resource-type="${escHtml(resource.type)}" data-open-url="${hrefEsc}" data-open-title="${titleEsc}" title="点击在右侧预览，右键查看更多操作"><span class="feishu-link-mark" aria-hidden="true">${escHtml(resource.glyph)}</span><span class="feishu-link-copy"><span class="feishu-link-kind">${escHtml(resource.label)}${meeting ? ` · 第${escHtml(meeting[1])}场` : ''}</span><span class="feishu-link-title">${titleEsc}</span>${metaHtml}</span><span class="feishu-link-open"><span class="feishu-link-open-label">预览</span><span aria-hidden="true">↗</span></span></a>`
  }

  function renderMarkdown(src) {
    const rewriteLinks = window.FeishuLink?.rewriteMarkdownLinks
      || ((text, mapFn) => String(text || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label, href) => mapFn(label, href)))
    const inline = (t, options = {}) => {
      const compactLinks = options.compactLinks === true
      const imageTokens = []
      const textWithPlaceholders = String(t || '').replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
        (_m, alt, src) => {
          const token = `__AGENT_IMG_${imageTokens.length}__`
          imageTokens.push({ alt: String(alt || ''), src: String(src || '') })
          return token
        }
      )
      let html = escHtml(textWithPlaceholders)
        .replace(/`([^`]+?)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
      // The auth action carries a knowme:// scheme, so it must be consumed before
      // the http-only link rewriters leave it as plain text.
      html = html.replace(
        /\[([^\]]+)\]\(knowme:\/\/feishu\/auth(\?[^)]*)?\)/g,
        (_m, label, query) => {
          // Carry the exact missing scopes (if any) so the click handler can
          // request just-in-time incremental authorization for only what's needed.
          let scopes = ''
          if (query) {
            const mm = /[?&]scopes=([^&]*)/.exec(query)
            if (mm) { try { scopes = decodeURIComponent(mm[1]) } catch { scopes = mm[1] } }
          }
          const scopeAttr = scopes ? ` data-feishu-scopes="${escHtml(scopes)}"` : ''
          const rawList = scopes
            ? `<details class="feishu-auth-cta-scopes"><summary>查看所需权限</summary><code>${escHtml(scopes.split(',').map(s => s.trim()).filter(Boolean).join(', '))}</code></details>`
            : ''
          return `<span class="feishu-auth-cta-wrap"><button type="button" class="feishu-auth-cta" data-feishu-auth-cta="1"${scopeAttr}><span class="feishu-auth-cta-mark" aria-hidden="true">飞</span>${escHtml(label)}</button>${rawList}</span>`
        }
      )
      html = rewriteLinks(html, (label, href) => {
        const feishu = renderFeishuLinkCard(href, label)
        if (feishu) {
          if (compactLinks) {
            const parsed = window.FeishuLink?.parseOpenLink?.(href)
            const title = escHtml(cleanLinkLabel(label, parsed?.label || '飞书文档'))
            const openHref = escHtml(parsed?.href || href)
            return `<a href="${openHref}" class="chat-open-link" data-open-url="${openHref}" data-open-title="${title}" title="右键选择打开方式">${title}</a>`
          }
          return feishu
        }
        const parsed = window.FeishuLink?.parseOpenLink?.(href)
        if (parsed) {
          const title = escHtml(cleanLinkLabel(label, parsed.label || '链接'))
          return `<a href="${escHtml(parsed.href)}" class="chat-open-link" data-open-url="${escHtml(parsed.href)}" data-open-title="${title}" title="右键选择打开方式">${title}</a>`
        }
        return `<a href="${escHtml(href)}" target="_blank" rel="noreferrer noopener">${escHtml(cleanLinkLabel(label, href))}</a>`
      })
      // Bare URLs: do not treat "(" as a lead, or half-parsed Markdown leftovers become "飞书文档".
      return html.replace(/(^|[\s>])((?:https?:\/\/|www\.)[^\s<)]+)/g, (_m, lead, url) => {
        const href = url.startsWith('http') ? url : `https://${url}`
        const feishu = renderFeishuLinkCard(href, '飞书文档')
        if (feishu) {
          if (compactLinks) {
            const parsed = window.FeishuLink?.parseOpenLink?.(href)
            const title = escHtml(parsed?.label || url)
            const openHref = escHtml(parsed?.href || href)
            return `${lead}<a href="${openHref}" class="chat-open-link" data-open-url="${openHref}" data-open-title="${title}" title="右键选择打开方式">${title}</a>`
          }
          return `${lead}${feishu}`
        }
        const parsed = window.FeishuLink?.parseOpenLink?.(href)
        if (parsed) {
          return `${lead}<a href="${escHtml(parsed.href)}" class="chat-open-link" data-open-url="${escHtml(parsed.href)}" data-open-title="${escHtml(parsed.label || '链接')}" title="右键选择打开方式">${escHtml(url)}</a>`
        }
        return `${lead}<a href="${escHtml(href)}" target="_blank" rel="noreferrer noopener">${escHtml(url)}</a>`
      })
      if (imageTokens.length) {
        html = html.replace(/__AGENT_IMG_(\d+)__/g, (_m, idx) => {
          const item = imageTokens[Number(idx)]
          if (!item?.src) return ''
          const alt = item.alt || '图片'
          const safeSrc = escHtml(item.src)
          const safeAlt = escHtml(alt)
          return `<figure class="agent-inline-image-wrap" data-image-state="loading"><div class="agent-inline-image-stage"><img class="agent-inline-image" src="${safeSrc}" alt="${safeAlt}" data-zoom-src="${safeSrc}" data-zoom-alt="${safeAlt}" loading="lazy"><div class="agent-inline-image-status" aria-live="polite"><span class="agent-inline-image-status-mark" aria-hidden="true">图</span><span data-image-status-text>正在加载图片</span></div></div><figcaption><span class="agent-inline-image-name">${safeAlt}</span><span class="agent-inline-image-action">点击查看大图</span></figcaption></figure>`
        })
      }
      return html
    }
    const normalized = String(src || '')
      .replace(/\r\n/g, '\n')
      // 常见模型会输出 <br> 来表达换行；这里按纯换行处理，避免原样显示成噪声。
      .replace(/<br\s*\/?>/gi, '\n')
    const lines = normalized.split('\n')
    const out = []
    let list = null
    let inCode = false
    let codeBuf = []
    let tableRows = []
    const extractFirstUrl = (text = '') => {
      const match = String(text).match(/(https?:\/\/[^\s<)]+)/i)
      return match ? String(match[1]).trim() : ''
    }
    const cellHasMarkdownLink = (text = '') => /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i.test(String(text))
    const normalizeTableRows = (rows = []) => {
      if (!Array.isArray(rows)) return rows
      const outRows = rows.map(cells => Array.isArray(cells) ? [...cells] : [])
      for (let i = 1; i < outRows.length; i += 1) {
        const cells = outRows[i]
        if (!cells.length) continue
        let linkUrl = ''
        let linkCellIdx = -1
        for (let ci = 0; ci < cells.length; ci += 1) {
          const url = extractFirstUrl(cells[ci])
          if (url) {
            linkUrl = url
            linkCellIdx = ci
            break
          }
        }
        if (!linkUrl) continue
        let titleCellIdx = -1
        for (let ci = 0; ci < cells.length; ci += 1) {
          if (ci === linkCellIdx) continue
          const value = String(cells[ci] || '').trim()
          if (!value) continue
          if (extractFirstUrl(value)) continue
          if (cellHasMarkdownLink(value)) continue
          titleCellIdx = ci
          break
        }
        if (titleCellIdx < 0) continue
        const title = String(cells[titleCellIdx] || '').trim()
        if (!title) continue
        cells[titleCellIdx] = `[${title}](${linkUrl})`
      }
      return outRows
    }
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
    const flushTable = () => {
      if (!tableRows.length) return
      const normalizedRows = normalizeTableRows(tableRows)
      const rows = normalizedRows.map((cells, ri) => {
        const tag = ri === 0 ? 'th' : 'td'
        return `<tr>${cells.map(c => `<${tag}>${inline(c.trim(), { compactLinks: true })}</${tag}>`).join('')}</tr>`
      })
      // skip markdown separator row |---|
      const body = rows.filter((_, i) => {
        if (i !== 1) return true
        if (!normalizedRows[1]) return true
        return !normalizedRows[1].every(c => /^:?-+:?$/.test(String(c).trim()))
      })
      out.push(`<table>${body.join('')}</table>`)
      tableRows = []
    }
    for (const line of lines) {
      const fence = line.match(/^\s*```/)
      if (fence) {
        flushTable()
        if (inCode) { out.push(`<pre><code>${escHtml(codeBuf.join('\n'))}</code></pre>`); codeBuf = []; inCode = false }
        else { closeList(); inCode = true }
        continue
      }
      if (inCode) { codeBuf.push(line); continue }
      if (!line.trim()) { flushTable(); closeList(); continue }
      if (/^\s*\|.+\|\s*$/.test(line)) {
        closeList()
        tableRows.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|'))
        continue
      }
      flushTable()
      const h = line.match(/^(#{1,4})\s+(.*)$/)
      if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }
      const bq = line.match(/^\s*>\s?(.*)$/)
      if (bq) { closeList(); out.push(`<blockquote><p>${inline(bq[1])}</p></blockquote>`); continue }
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
      const ul = line.match(/^\s*[-*+]\s+(.*)$/)
      if (ol) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' } out.push(`<li>${inline(ol[1])}</li>`); continue }
      if (ul) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' } out.push(`<li>${inline(ul[1])}</li>`); continue }
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
    flushTable()
    if (inCode) out.push(`<pre><code>${escHtml(codeBuf.join('\n'))}</code></pre>`)
    closeList()
    return out.join('')
  }

  /** 流式：只返回可安全格式化的稳定块；未完成尾部不进入可见 DOM。 */
  function splitStreamingMarkdown(src) {
    const split = window.AgentStreamVisibility?.splitStreamingMarkdown
    if (typeof split === 'function') return split(src)
    return { stable: '', pending: Boolean(String(src || '')) }
  }

  function renderStreamingMarkdown(src) {
    const { stable, pending } = splitStreamingMarkdown(src)
    const md = stable ? renderMarkdown(stable) : ''
    const pendingHtml = pending
      ? '<span class="md-stream-pending" role="status" aria-label="正在整理回答"><span aria-hidden="true">正在整理…</span></span>'
      : ''
    return `<div class="chat-text agent-md">${md}${pendingHtml}</div>`
  }

  const FEISHU_AUTH_DEEP_LINK_RE = /^knowme:\/\/feishu\/auth(?:[/?#]|$)/i

  /** Parse the in-app authorization deep link; returns null for any other URL. */
  function parseFeishuAuthDeepLink(value) {
    const raw = String(value || '').trim()
    if (!FEISHU_AUTH_DEEP_LINK_RE.test(raw)) return null
    const match = /[?&]scopes=([^&#]*)/.exec(raw)
    let scopes = []
    if (match) {
      let text = match[1]
      try { text = decodeURIComponent(text) } catch { /* keep the raw value */ }
      scopes = text.split(',').map(s => s.trim()).filter(Boolean)
    }
    return { scopes }
  }

  /**
   * A structured suggestion carries no inline CTA wrapper, so anchor the progress
   * panel to the latest reply instead.
   */
  function ensureFeishuAuthHost() {
    const bubbles = chatLog?.querySelectorAll?.('.agent-bubble')
    const host = bubbles?.length ? bubbles[bubbles.length - 1] : chatLog
    if (!host) return null
    let wrap = host.querySelector?.('.feishu-auth-cta-wrap')
    if (!wrap) {
      wrap = document.createElement('span')
      wrap.className = 'feishu-auth-cta-wrap feishu-auth-cta-wrap-standalone'
      host.appendChild(wrap)
    }
    return wrap
  }

  function hideFeishuLinkMenu() {
    feishuLinkMenu?.classList.remove('show')
    if (feishuLinkMenu) feishuLinkMenu.innerHTML = ''
  }

  function showFeishuLinkMenu(url, title, x, y) {
    const parsed = window.FeishuLink?.parseOpenLink?.(url)
    if (!parsed || !feishuLinkMenu) return
    feishuLinkMenu.innerHTML = `
      <button type="button" data-feishu-action="external">浏览器打开</button>
      <button type="button" data-feishu-action="copy">复制链接</button>
      <button type="button" data-feishu-action="quote">引用文件</button>`
    feishuLinkMenu.dataset.url = parsed.href
    feishuLinkMenu.dataset.title = String(title || parsed.label || '链接')
    feishuLinkMenu.style.left = `${Math.min(x, window.innerWidth - 172)}px`
    feishuLinkMenu.style.top = `${Math.min(y, window.innerHeight - 140)}px`
    feishuLinkMenu.classList.add('show')
  }

  function quoteFeishuLinkToComposer(title = '', href = '') {
    if (!aiInput) return
    const safeTitle = cleanLinkLabel(title, '飞书文档')
    const safeHref = String(href || '').trim()
    const prefix = aiInput.value && !/\s$/.test(aiInput.value) ? ' ' : ''
    const quote = safeHref ? `@${safeTitle} ${safeHref} ` : `@${safeTitle} `
    aiInput.value = `${aiInput.value || ''}${prefix}${quote}`
    const pos = aiInput.value.length
    aiInput.setSelectionRange(pos, pos)
    hideAtMenu()
    aiInput.focus()
    aiInput.dispatchEvent(new Event('input'))
    toastFn('已引用到对话框')
  }

  async function handleFeishuLinkAction(action, url, title = '') {
    // The auth deep link is an in-app action, not an external URL. Handing it to
    // the OS opener only earns a 「不允许的协议」 rejection, so consume it here and
    // run the same authorize-then-resume flow as the inline CTA button.
    const authLink = parseFeishuAuthDeepLink(url)
    if (authLink) {
      hideFeishuLinkMenu()
      if (action === 'copy') {
        window.api.copyToClipboard(String(url))
        toastFn('链接已复制')
        return
      }
      const host = ensureFeishuAuthHost()
      if (!host) {
        window.api?.openSettings?.('connectors')
        toastFn('已为你打开「设置 → 连接器」，请在那里完成飞书授权', 'info')
        return
      }
      await runFeishuAuthInChat(host, authLink.scopes)
      return
    }
    if (action === 'quote') {
      const parsed = window.FeishuLink?.parseOpenLink?.(url)
      if (!parsed?.href) {
        toastFn('链接不安全', 'error')
        return
      }
      const displayTitle = String(title || feishuLinkMenu?.dataset?.title || parsed.label || '链接')
      hideFeishuLinkMenu()
      quoteFeishuLinkToComposer(displayTitle, parsed.href)
      return
    }
    const result = window.FeishuLink?.linkAction(url, action)
    if (!result?.ok) {
      toastFn(result?.message || '链接不安全', 'error')
      return
    }
    const displayTitle = String(title || feishuLinkMenu?.dataset?.title || result.label || '链接')
    hideFeishuLinkMenu()
    if (action === 'right') {
      if (workSurface?.openLink) {
        const ok = workSurface.openLink(result.href, displayTitle)
        if (!ok) toastFn('当前链接不支持右侧预览', 'error')
      } else toastFn('当前工作区不支持右侧打开', 'error')
      return
    }
    if (action === 'copy') {
      window.api.copyToClipboard(result.href)
      toastFn('链接已复制')
      return
    }
    const opened = await window.api.openExternal(result.href)
    if (!opened?.ok) {
      // Deep-link fallback: if auth scheme cannot be opened, route user to settings.
      if (result.protocol === 'knowme:' && /\/\/feishu\/auth(?:[/?#]|$)/i.test(result.href)) {
        window.api?.openSettings?.('connectors')
        toastFn('未能直接拉起授权，已为你打开「设置 → 连接器」，请点击继续授权', 'info')
        return
      }
      toastFn(opened?.message || '无法打开链接', 'error')
    }
  }

  function renderSuggestionBar(bar, chosenIndex) {
    if (!bar?.items?.length) return ''
    if (window.StructuredChoice && typeof window.StructuredChoice.render === 'function') {
      return window.StructuredChoice.render(bar, {
        chosenIndex,
        payloadNeedsUserEdit: window.AgentSuggestion?.payloadNeedsUserEdit,
      })
    }
    const title = escHtml(bar.title || '结构化选择')
    const decided = Number.isInteger(chosenIndex) && chosenIndex >= 0
    const items = bar.items.map((it, index) => {
      const selected = decided && index === chosenIndex
      const disabled = decided ? ' disabled' : ''
      const selCls = selected ? ' is-selected' : ''
      const desc = it.description ? `<span class="sug-desc">${escHtml(it.description)}</span>` : ''
      return `<button type="button" class="agent-suggest-item${selCls}" data-suggest-act="${escHtml(it.action)}" data-payload="${escHtml(encodeURIComponent(it.payload || ''))}"${disabled}>
        <span class="sug-choice" aria-hidden="true">${index + 1}</span>
        <span class="sug-copy"><strong>${escHtml(it.label)}</strong>${desc}</span>
      </button>`
    }).join('')
    const status = decided ? '已选择' : '选择一项'
    return `<div class="agent-suggest structured-choice${decided ? ' is-decided' : ''}" role="group" aria-label="${title}，${status}">
      <div class="agent-suggest-head"><div class="agent-suggest-title">${title}</div><span>${status}</span></div>
      <div class="agent-suggest-list">${items}</div>
    </div>`
  }

  function resolveMessageChoiceBar(message) {
    if (!message || message.role !== 'assistant') return null
    if (Array.isArray(message.ui) && message.ui.length) {
      const choice = message.ui.find(item => item && item.kind === 'choice')
      if (choice?.items?.length) {
        return { title: choice.title || '', items: choice.items }
      }
    }
    return null
  }

  function hydrateLegacyAssistantMessage(message) {
    if (!message || message.role !== 'assistant' || message.streaming) return message
    if (resolveMessageChoiceBar(message)) {
      if (Array.isArray(message.ui) && message.ui.length) return message
    }
    const parse = (window.AgentSuggestion && window.AgentSuggestion.parseSuggestionBlock)
      ? window.AgentSuggestion.parseSuggestionBlock
      : null
    if (!parse) return message
    const strip = window.AgentSuggestion?.stripDisplayProtocolText
    const normalizedText = normalizeAssistantOutput(
      strip ? strip(message.text) : message.text,
    )
    const parsed = parse(normalizedText)
    if (parsed.bar?.items?.length) {
      message.text = parsed.bodyWithoutBlock
      message.ui = [{ kind: 'choice', title: parsed.bar.title || '', items: parsed.bar.items }]
    } else if (parsed.bodyWithoutBlock !== normalizedText) {
      message.text = parsed.bodyWithoutBlock
    } else if (strip && normalizedText !== String(message.text || '')) {
      message.text = normalizedText
    }
    return message
  }

  function renderStructuredUiRegion(message, messageIdx = -1, forceShell = false) {
    const bar = resolveMessageChoiceBar(message)
    if (!bar && !forceShell) return ''
    const content = bar ? renderSuggestionBar(bar, message.suggestionChosenIndex) : ''
    return `<div class="agent-structured-ui" data-structured-ui="1">${content}</div>`
  }

  function patchAssistantStructuredUi(bubble, message, messageIdx) {
    if (!bubble || !message) return
    const html = renderStructuredUiRegion(message, messageIdx, message.protocolVersion === 2)
    const current = bubble.querySelector('[data-structured-ui="1"]')
    if (!html) {
      current?.remove()
      return
    }
    if (!current) {
      const body = bubble.querySelector('[data-assistant-body="1"]')
      const wrap = document.createElement('div')
      wrap.innerHTML = html
      const node = wrap.firstElementChild
      if (body && node) body.after(node)
      else if (node) bubble.appendChild(node)
      return
    }
    const wrap = document.createElement('div')
    wrap.innerHTML = html
    const next = wrap.firstElementChild
    if (next && current.innerHTML !== next.innerHTML) current.innerHTML = next.innerHTML
  }

  function patchAssistantResponseBody(bubble, message, messageIdx) {
    if (!bubble || !message) return
    const body = bubble.querySelector('[data-assistant-body="1"]')
    if (!body) return
    const html = assistantBodyHtml(message, messageIdx)
    const next = document.createElement('div')
    next.innerHTML = html
    reconcileCompletedAssistantBody(body, next)
    bubble.classList.toggle('related-chats-result', isRelatedChatsResult(message))
  }

  function applyV2StreamEvent(event, messageIdx, message) {
    const reducer = window.AgentMessageState
    if (!reducer || !event || typeof event !== 'object') return false
    if (event.version == null) return false
    if (!message.messageState) {
      message.messageState = reducer.createMessageState(message.runId || event.runId)
    }
    const reduced = reducer.reduceMessageEvent(message.messageState, event)
    if (!reduced.changed) return false
    message.messageState = reduced.state
    reducer.applyStateToMessage(message, reduced.state)

    // 离屏保活：只更新消息对象，禁止用其它 Session 的 chatHistory 误 render
    if (chatHistory[messageIdx] !== message) return true

    const bubble = chatLog?.querySelector(`[data-idx="${messageIdx}"]`)
    const type = String(event.type || '')

    if (reduced.ignored === 'unsupported_version' || (message.messageState?.frozen && message.messageState?.status === 'failed' && !message.v2AnswerCommitted)) {
      message.streaming = false
      if (bubble) {
        patchAssistantResponseBody(bubble, message, messageIdx)
        patchAssistantStructuredUi(bubble, message, messageIdx)
        refreshAssistantProgress(messageIdx)
      } else {
        renderChat()
      }
      return true
    }

    if (type === 'answer.committed') {
      if (bubble) {
        upgradeThinkingBubble(bubble, message, assistantBodyHtml(message, messageIdx))
        patchAssistantResponseBody(bubble, message, messageIdx)
        bubble.querySelector(':scope > .stream-cursor')?.remove()
      } else {
        renderChat()
      }
      scrollChatToBottomIfNeeded(false)
      return true
    }

    if (type === 'choice.ready') {
      if (bubble) patchAssistantStructuredUi(bubble, message, messageIdx)
      else renderChat()
      scrollChatToBottomIfNeeded(false)
      return true
    }

    if (type === 'run.completed' || type === 'run.cancelled' || type === 'run.failed') {
      message.streaming = false
      message.activity = message.activity || ''
      void syncPersistedRunTree(message)
      if (bubble) {
        if (message.v2AnswerCommitted || String(message.text || '').trim()) {
          patchAssistantResponseBody(bubble, message, messageIdx)
        }
        patchAssistantStructuredUi(bubble, message, messageIdx)
        refreshAssistantProgress(messageIdx)
      } else {
        renderChat()
      }
      return true
    }

    if (type.startsWith('subrun.')) {
      if (bubble) refreshAssistantProgress(messageIdx)
      else renderChat()
      scrollChatToBottomIfNeeded(false)
      return true
    }

    if (type === 'tool.started' || type === 'tool.completed' || type === 'tool.failed') {
      if (type === 'tool.failed' && event.payload?.needsPermission) {
        void maybeOfferRunPermissionUpgrade({
          toolName: event.payload.toolName,
          needsPermission: event.payload.needsPermission,
          summary: event.payload.summary,
        })
      }
      refreshAssistantProgress(messageIdx)
      return true
    }

    if (type === 'stage' || type === 'plan.updated') {
      if (event.payload?.contextInfo && typeof event.payload.contextInfo === 'object') {
        lastContextInfo = event.payload.contextInfo
        renderModelUsage()
      }
    }

    if (type === 'grounding-status') {
      if (bubble && message.groundingStatus && window.GroundingUI?.patchAssistantGroundingMeta) {
        window.GroundingUI.patchAssistantGroundingMeta(bubble, message.groundingStatus, escHtml)
      }
      refreshAssistantProgress(messageIdx)
      return true
    }

    refreshAssistantProgress(messageIdx)
    return true
  }

  function isWorkflowReturnChoice(button, payload) {
    const buttonText = String(button?.textContent || '')
    const hint = `${buttonText}\n${String(payload || '')}`
    if (!hint.trim()) return false
    if (!/(返回|回到|继续|切回|进入).{0,8}(流程|工作流|审批|澄清|面板)|流程面板|工作流面板|右侧流程|流程操作|审批操作/i.test(hint)) {
      return false
    }
    return !/(知识库|wiki|文档|docs?|knowledge|飞书文档|多维表格|bitable|base)/i.test(hint)
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(String(text || ''))
    } catch {
      return null
    }
  }

  function isSuggestionLikeJson(data) {
    if (!data || typeof data !== 'object') return false
    if (Array.isArray(data)) {
      return data.length > 0 && data.every(item => item && typeof item === 'object'
        && typeof item.action === 'string'
        && typeof item.label === 'string')
    }
    return Array.isArray(data.items)
      && data.items.length > 0
      && data.items.every(item => item && typeof item === 'object'
        && typeof item.action === 'string'
        && typeof item.label === 'string')
  }

  const STREAM_LAYOUT_SENTINEL = '\uE000knowme-stream-end\uE001'

  function assistantDisplayText(m, { preserveStreamingLayout = false } = {}) {
    const strip = window.AgentSuggestion?.stripDisplayProtocolText
    const sourceText = String(m?.text || '')
    const stripInput = preserveStreamingLayout
      ? `${sourceText}${STREAM_LAYOUT_SENTINEL}`
      : sourceText
    const stripped = strip ? strip(stripInput) : stripInput
    let displayText = stripped
    if (preserveStreamingLayout) {
      const hasSentinel = String(stripped || '').includes(STREAM_LAYOUT_SENTINEL)
      displayText = String(stripped || '').replace(STREAM_LAYOUT_SENTINEL, '')
      if (!hasSentinel && displayText && sourceText.startsWith(displayText)
        && sourceText.slice(displayText.length).startsWith('\n')) {
        displayText = `${displayText}\n`
      }
    }
    const normalizedText = normalizeAssistantOutput(
      displayText,
    )
    return isRelatedChatsResult(m)
      ? normalizeRelatedChatsResultMarkdown(normalizedText)
      : normalizedText
  }

  function settleCancelledAssistantText(message) {
    if (!message || message.protocolVersion === 2) {
      if (message && !String(message.text || '').trim()) message.text = '已停止生成'
      return
    }
    const safeStreamText = assistantDisplayText(message, { preserveStreamingLayout: true })
    const { stable } = splitStreamingMarkdown(safeStreamText)
    message.text = String(stable || '').trim() || '已停止生成'
  }

  function assistantBodyHtml(m, messageIdx = -1) {
    const normalizedText = assistantDisplayText(m, {
      preserveStreamingLayout: Boolean(m.streaming && m.protocolVersion !== 2),
    })
    if (m.streaming && m.protocolVersion === 2) {
      if (!m.v2AnswerCommitted || !String(normalizedText || '').trim()) return ''
      const bodyMarkdown = normalizedText
      return bodyMarkdown
        ? `<div class="chat-text agent-md">${renderMarkdown(bodyMarkdown)}</div>`
        : ''
    }
    if (m.streaming) {
      return renderStreamingMarkdown(normalizedText)
    }
    const parse = (window.AgentSuggestion && window.AgentSuggestion.parseSuggestionBlock)
      ? window.AgentSuggestion.parseSuggestionBlock
      : (t) => ({ bodyWithoutBlock: t, bar: null })
    const emptyTodayPriority = hasEmptyTodayPriorityFacts(m)
    const presetBar = resolveMessageChoiceBar(m)
    const parsed = presetBar ? { bodyWithoutBlock: normalizedText, bar: null } : parse(normalizedText)
    const bodyWithoutBlock = emptyTodayPriority
      ? emptyTodayPriorityBody()
      : parsed.bodyWithoutBlock
    const bar = emptyTodayPriority ? null : (presetBar || parsed.bar)
    const bodyMarkdown = isRelatedChatsResult(m)
      ? normalizeRelatedChatsResultMarkdown(bodyWithoutBlock)
      : bodyWithoutBlock
    const md = bodyMarkdown
      ? `<div class="chat-text agent-md">${renderMarkdown(bodyMarkdown)}</div>`
      : ''
    const fallback = md
      ? ''
      : renderAssistantEmptyResultFallback(m)
    const followups = renderModeFollowups(m, messageIdx, !!bar)
    const inlineBar = m.protocolVersion === 2 ? '' : renderSuggestionBar(bar, m.suggestionChosenIndex)
    return `${md}${fallback}${followups}${inlineBar}`
  }

  function looksLikeRelatedChatsMarkdown(text = '') {
    const src = String(text || '')
    if (/(今日相关会话主题|分析跟我相关的聊天|feishu\.related_chats)/i.test(src)) return true
    return /(`?\[?(?:私聊|群聊|话题群)\]?`?)/.test(src)
      && /(私聊\s*\(|群聊\s*\/\s*话题群|@我\s*的消息)/.test(src)
  }

  function isRelatedChatsResult(m) {
    const byTrace = Array.isArray(m?.trace)
      && m.trace.some(item => item?.toolName === 'feishu.related_chats' && (item?.status === 'done' || !item?.status))
    if (byTrace) return true
    return looksLikeRelatedChatsMarkdown(m?.text)
  }

  function hasEmptyTodayPriorityFacts(m) {
    if (!isTodayPriorityShortcut(getLatestUserText())) return false
    const result = [...(Array.isArray(m?.trace) ? m.trace : [])]
      .reverse()
      .find(item => item?.toolName === 'feishu.today_priority' && item?.status === 'done')
    const text = String(result?.text || '')
    return /今日日程（0）/.test(text) && /未完成待办（0[，、）]/.test(text)
  }

  function normalizeRelatedChatsResultMarkdown(text = '') {
    return String(text || '')
      .replace(/^\s*-{3,}\s*$/gm, '')
      .replace(
        /^\s*\d+[.)、]\s*\*{0,2}(今日相关会话主题[^*\n]*)\*{0,2}\s*$/gm,
        '## $1'
      )
      .replace(
        /^\s*\d+[.)、]\s*\*{0,2}(@我[^*\n]*|待我回应[^*\n]*|需跟进事项[^*\n]*|建议下一步[^*\n]*)\*{0,2}\s*$/gm,
        '## $1'
      )
      .replace(
        /^\s*[-*+]\s+\*{0,2}(私聊[^*\n]*|群聊\s*\/\s*话题群[^*\n]*|群聊[^*\n]*|话题群[^*\n]*)\*{0,2}\s*:?\s*$/gm,
        '### $1'
      )
      .replace(/`?\[(私聊|群聊|话题群)\]`?/g, '`$1`')
  }

  function currentIndustry() {
    try {
      const settings = window.api?.getSettings?.() || {}
      return settings.industry || 'general'
    } catch {
      return 'general'
    }
  }

  function emptyTodayPriorityBody() {
    if (window.IndustryProfile?.formatEmptyTodayPriorityBody) {
      return window.IndustryProfile.formatEmptyTodayPriorityBody(currentIndustry())
    }
    return '## 今日优先级\n飞书今天没有返回可排序的日程或未完成待办。\n\n请告诉我你今天最想推进的 1 个真实工作目标，我再帮你拆成第一步。'
  }

  function renderAssistantEmptyResultFallback(m) {
    const trace = Array.isArray(m?.trace) ? m.trace : []
    if (!trace.length) return ''
    const pending = trace.some(item => item && item.status === 'pending')
    if (pending) return ''
    return `<div class="chat-text agent-md"><p>处理已完成，但这次没有返回可展示正文。你可以继续补充要求，或点击“执行过程”查看详情。</p></div>`
  }

  function renderModeFollowups(message, messageIdx, hasSuggestionBar = false) {
    if (surfaceMode === 'workbench') return ''
    if (!message || message.role !== 'assistant' || message.streaming) return ''
    if (!String(message.text || '').trim()) return ''
    if (hasSuggestionBar) return ''
    let latestAssistantIdx = -1
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      if (chatHistory[i]?.role === 'assistant') {
        latestAssistantIdx = i
        break
      }
    }
    if (messageIdx !== latestAssistantIdx) return ''
    const mode = currentAgentModeId()
    const presets = MODE_FOLLOWUP_PRESETS[mode] || MODE_FOLLOWUP_PRESETS.general
    if (!Array.isArray(presets) || !presets.length) return ''
    const chips = presets.slice(0, 3).map(item => `
      <button class="agent-followup-btn" type="button" data-action-kind="conversation" data-action-execution="send" data-action-source="shortcut" data-followup-prompt="${escHtml(item.prompt || '')}" title="${escHtml(item.prompt || '')}">
        ${escHtml(item.label || '下一步')}
      </button>`).join('')
    return `<div class="agent-followups" aria-label="建议下一步">${chips}</div>`
  }

  function traceStatusIcon(status) {
    if (status === 'error') return '!'
    if (status === 'pending') return '<span class="agent-trace-pulse" aria-hidden="true"></span>'
    return '✓'
  }

  function formatElapsed(ms) {
    const safe = Math.max(0, Math.floor(Number(ms) || 0))
    if (!safe) return '0s'
    const sec = Math.floor(safe / 1000)
    const min = Math.floor(sec / 60)
    const left = sec % 60
    return min > 0 ? `${min}m ${left}s` : `${left}s`
  }

  function toolTimelineTitle(item, status) {
    const name = String(item.toolName || '')
    if (item.kind === 'subrun' || item.delegation) {
      if (item.timelineTitle) return item.timelineTitle
      const expert = item.expertId || 'Expert'
      const builder = builderBadgeLabel(item.builderId)
      const base = `委派 · ${expert} · ${builder}`
      if (status === 'pending') return `${base} · 进行中`
      if (status === 'cancelled') return `${base} · 已取消`
      if (status === 'error') return `${base} · ${stopReasonText(item.stopReason, 'failed')}`
      return `${base} · 已完成`
    }
    const args = item.args || item.toolArgs || {}
    const draft = item.draft || {}
    if (item.timelineTitle) return item.timelineTitle
    if (name === 'write_file' || name === 'create_file' || name === 'apply_patch') {
      const p = args.path || draft.path || ''
      const label = name === 'apply_patch' ? '补丁' : name === 'create_file' ? '新建' : '写入'
      const base = p ? `${label} ${p}` : `${label}文件`
      if (status === 'error') return `${base}失败`
      if (status === 'pending') return `等待批准 · ${base}`
      return base
    }
    if (name === 'move_path') {
      const from = args.from || draft.from || ''
      const to = args.to || draft.to || ''
      const base = from && to ? `移动 ${from} → ${to}` : '移动路径'
      if (status === 'error') return `${base}失败`
      if (status === 'pending') return `等待批准 · ${base}`
      return base
    }
    if (name === 'mkdir') {
      const p = args.path || draft.path || ''
      if (item.meta?.lowRiskDirect || (item.summary || '').includes('低风险直建')) {
        return p ? `已创建目录 ${p} · 低风险直建` : '已创建目录 · 低风险直建'
      }
      const base = p ? `创建目录 ${p}` : '创建目录'
      if (status === 'pending') return `等待批准 · ${base}`
      return base
    }
    if (name.startsWith('feishu.draft')) {
      const title = draft.title || args.title || item.summary || '飞书文档'
      if (status === 'pending') return `等待批准 · 飞书：${String(title).slice(0, 60)}`
      return `飞书文档：${String(title).slice(0, 60)}`
    }
    const labels = {
      'search_knowledge': { pending: '正在查找知识库资料', done: '资料查找完成', error: '资料查找失败' },
      'search_web': { pending: '正在搜索公开网络', done: '网络搜索完成', error: '网络搜索失败' },
      'fetch_web_page': { pending: '正在读取网页', done: '网页读取完成', error: '网页读取失败' },
      'feishu.meeting_candidates': { pending: '正在查找会议候选', done: '会议候选已找到', error: '会议候选查找失败' },
      'feishu.related_chats': { pending: '正在分析相关聊天', done: '相关聊天已汇总', error: '相关聊天分析失败' },
      'feishu.today_priority': { pending: '正在拉取今日日程与待办', done: '今日优先级事实已就绪', error: '今日优先级事实拉取失败' },
      'feishu.doc_kb_suggest': { pending: '正在整理文档与知识库候选', done: '文档与知识库候选已就绪', error: '文档与知识库候选整理失败' },
      'feishu.search_docs': { pending: '正在搜索飞书文档', done: '飞书文档搜索完成', error: '飞书文档搜索失败' },
      'feishu.read_doc': { pending: '正在读取飞书文档', done: '飞书文档读取完成', error: '飞书文档读取失败' },
      'feishu.get_wiki_node': { pending: '正在读取飞书知识库节点', done: '知识库节点读取完成', error: '知识库节点读取失败' },
    }
    const known = labels[String(item.toolName || '')]
    if (known) return known[status] || known.pending
    const summaryText = String(item.summary || '')
    if (/超时|重试/.test(summaryText)) {
      const toolLabel = name || '工具'
      if (status === 'error' || (/超时/.test(summaryText) && !/重试/.test(summaryText))) {
        return `工具超时 · ${toolLabel}`
      }
      if (status === 'pending' && /重试/.test(summaryText)) {
        return `等待重试 · ${toolLabel}`
      }
    }
    const raw = String(item.title || item.toolName || '工具调用').trim()
    if (status === 'error') return `${raw}失败`
    if (status === 'done') return raw
    return raw.startsWith('正在') ? raw : `正在${raw}`
  }

  function messageStateApi() {
    return window.AgentMessageState || null
  }

  function redactDisplayValue(value) {
    const api = messageStateApi()
    if (api?.redactSensitiveFields && value && typeof value === 'object') {
      return api.redactSensitiveFields(value)
    }
    return value
  }

  function redactDisplayText(text) {
    const raw = String(text || '')
    if (!raw) return ''
    return raw
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[REDACTED]')
      .replace(/("?(?:token|authorization|password|secret|apikey|api_key|credential)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
  }

  function builderBadgeLabel(builderId) {
    const api = messageStateApi()
    return api?.builderLabel ? api.builderLabel(builderId) : String(builderId || '本地')
  }

  function stopReasonText(stopReason, terminal) {
    const api = messageStateApi()
    return api?.stopReasonLabel ? api.stopReasonLabel(stopReason, terminal) : String(stopReason || terminal || '已终止')
  }

  function runTreeNodes(message) {
    const nodes = message?.runTree?.nodes
    return nodes && typeof nodes === 'object' ? Object.values(nodes) : []
  }

  function actionLabel(action) {
    const map = {
      retry: '重试',
      resume: '恢复',
      review_draft: '查看审批草稿',
      reject: '拒绝草稿',
      provide_input: '补充输入',
      wait_children: '等待子 Run',
      switch_to_local: '切换本地执行',
      reduce_scope: '缩小任务范围',
      open_permission_settings: '调整权限',
      switch_backend: '切换后端',
      update_package: '更新能力包',
      provide_more_context: '补充上下文',
      cancel: '取消运行',
      retry_after_approval: '审批后重试',
    }
    return map[String(action || '')] || String(action || '')
  }

  function computeRunGuidance(message) {
    const rootRunId = String(message?.runTree?.rootRunId || message?.runId || '')
    const actionState = rootRunId ? runActionState.get(rootRunId) : null
    if (actionState?.phase === 'cancel_requested') {
      return {
        tone: 'info',
        title: '取消请求已发送',
        detail: '正在通知并收敛子 Run，请稍候。若长时间未收敛可再次点击取消。',
        recommended: 'wait_children',
        alternatives: ['resume'],
      }
    }
    const nodes = runTreeNodes(message)
    const waitingNode = nodes.find(node => String(node.status || '').toLowerCase() === 'waiting')
    if (waitingNode) {
      return {
        tone: 'info',
        title: waitingNode.waitingFor === 'approval' ? '等待审批确认' : '运行暂时等待中',
        detail: waitingNode.summary || stopReasonText(waitingNode.stopReason, waitingNode.terminal),
        recommended: waitingNode.recommendedAction || (waitingNode.waitingFor === 'approval' ? 'review_draft' : 'provide_input'),
        alternatives: Array.isArray(waitingNode.alternativeActions) ? waitingNode.alternativeActions : [],
        estimatedWait: waitingNode.estimatedWait || null,
      }
    }
    const failedNode = nodes.find(node => String(node.status || '').toLowerCase() === 'failed' || String(node.terminal || '').toLowerCase() === 'failed')
    if (failedNode) {
      return {
        tone: 'warning',
        title: '检测到子 Run 失败',
        detail: failedNode.summary || stopReasonText(failedNode.stopReason, failedNode.terminal),
        recommended: failedNode.recommendedAction || 'retry',
        alternatives: Array.isArray(failedNode.alternativeActions) ? failedNode.alternativeActions : ['provide_more_context'],
        estimatedWait: failedNode.estimatedWait || null,
      }
    }
    return null
  }

  function renderRunGuidancePanel(message) {
    const guidance = computeRunGuidance(message)
    if (!guidance) return ''
    const alternatives = Array.isArray(guidance.alternatives) ? guidance.alternatives.filter(Boolean).slice(0, 2) : []
    return `<div class="agent-run-guidance ${escHtml(guidance.tone || 'info')}">
      <div class="agent-run-guidance-title">${escHtml(guidance.title || '下一步')}</div>
      <div class="agent-run-guidance-detail">${escHtml(guidance.detail || '')}</div>
      <div class="agent-run-guidance-actions">
        <span class="agent-run-guidance-pill">推荐：${escHtml(actionLabel(guidance.recommended))}</span>
        ${alternatives.map(item => `<span class="agent-run-guidance-pill alt">备选：${escHtml(actionLabel(item))}</span>`).join('')}
        ${guidance.estimatedWait ? `<span class="agent-run-guidance-pill wait">预计：${escHtml(String(guidance.estimatedWait))}</span>` : ''}
      </div>
    </div>`
  }

  function canRetrySubRun(node) {
    if (!node) return false
    const terminal = String(node.terminal || node.status || '').toLowerCase()
    return Boolean(node.retriable) || terminal === 'failed' || terminal === 'error'
  }

  function canResumeSubRun(node, message) {
    if (!node) return false
    if (message?.resumeAvailable) return true
    const reason = String(node.stopReason || '').toLowerCase()
    return reason === 'interrupted' || reason === 'recovering' || node.status === 'recovering'
  }

  function renderRunTreeActions(node) {
    if (!node?.subRunId) return ''
    const status = String(node.status || '').toLowerCase()
    const terminal = String(node.terminal || '').toLowerCase()
    const running = status === 'running' || status === 'waiting' || status === 'preparing'
    const cancelBtn = running
      ? `<button type="button" class="agent-run-action cancel" data-run-cancel="${escHtml(node.subRunId)}" title="取消子 Run">取消</button>`
      : ''
    const retryBtn = !running && canRetrySubRun(node)
      ? `<button type="button" class="agent-run-action retry" data-run-retry="${escHtml(node.subRunId)}" title="重试子 Run">重试</button>`
      : ''
    const resumeBtn = canResumeSubRun(node)
      ? `<button type="button" class="agent-run-action resume" data-run-resume="${escHtml(node.subRunId)}" title="恢复子 Run">恢复</button>`
      : ''
    if (!cancelBtn && !retryBtn && !resumeBtn) return ''
    return `<div class="agent-run-actions">${cancelBtn}${retryBtn}${resumeBtn}</div>`
  }

  function renderRunTreeMetaSection(title, items, renderItem) {
    const list = Array.isArray(items) ? items.filter(Boolean) : []
    if (!list.length) return ''
    return `<div class="agent-run-meta-section"><div class="agent-run-meta-title">${escHtml(title)}</div>${list.map(renderItem).join('')}</div>`
  }

  function renderRunTreeNode(node) {
    if (!node?.subRunId) return ''
    const status = node.status === 'running' || node.status === 'waiting' ? 'pending'
      : node.status === 'failed' || node.terminal === 'failed' ? 'error'
        : node.status === 'cancelled' || node.terminal === 'cancelled' ? 'cancelled'
          : 'done'
    const builder = builderBadgeLabel(node.builderId)
    const expert = escHtml(node.expertId || 'Expert')
    const phase = node.phase ? `<span class="agent-run-phase">${escHtml(node.phase)}</span>` : ''
    const stop = node.stopReason || node.terminal
      ? `<span class="agent-run-stop">${escHtml(stopReasonText(node.stopReason, node.terminal))}</span>`
      : ''
    const summary = redactDisplayText(String(node.summary || '').trim())
    const phases = Array.isArray(node.phases) ? node.phases.slice(-4) : []
    const phaseRows = phases.map(item => `<div class="agent-run-phase-row"><span>${escHtml(item.phase || '阶段')}</span>${item.durationMs ? `<span class="agent-run-phase-time">${escHtml(formatElapsed(item.durationMs))}</span>` : ''}${item.summary ? `<span class="agent-run-phase-summary">${escHtml(redactDisplayText(item.summary))}</span>` : ''}</div>`).join('')
    const handoffs = renderRunTreeMetaSection('Handoff', node.handoffs, (item) =>
      `<div class="agent-run-meta-row"><span>${escHtml(item.sourceExpertId || '父 Run')}</span><span>→</span><span>${escHtml(item.targetExpertId || item.summary || '子 Run')}</span></div>`)
    const approvals = renderRunTreeMetaSection('审批', node.approvals, (item) => {
      const pending = item.pending && item.approved == null
      return `<div class="agent-run-meta-row approval${pending ? ' pending' : ''}"><span>${escHtml(item.summary || item.draftId || '草稿')}</span><span>${pending ? '待确认' : item.approved ? '已批准' : '已拒绝'}</span></div>`
    })
    const artifacts = renderRunTreeMetaSection('产物', (node.artifacts || []).filter(item => !item.inputPath), (item) =>
      `<div class="agent-run-meta-row"><span class="agent-artifact-kind">${escHtml(item.kind || 'artifact')}</span><span>${escHtml(item.title || item.id)}</span></div>`)
    const evidence = renderRunTreeMetaSection('证据', node.evidence, (item) =>
      `<div class="agent-run-meta-row"><span>${escHtml(item.summary || '摘要')}</span>${item.digest ? `<span class="agent-run-digest">${escHtml(String(item.digest).slice(0, 16))}</span>` : ''}</div>`)
    const budgetEntries = node.budget && typeof node.budget === 'object'
      ? Object.entries(redactDisplayValue(node.budget)).filter(([, v]) => v != null && v !== '')
      : []
    const budget = budgetEntries.length
      ? `<div class="agent-run-meta-section"><div class="agent-run-meta-title">预算</div>${budgetEntries.map(([k, v]) => `<div class="agent-run-meta-row"><span>${escHtml(k)}</span><span>${escHtml(String(v))}</span></div>`).join('')}</div>`
      : ''
    const security = Array.isArray(node.diagnostics) && node.diagnostics.some(item => item?.code === 'prompt_injection_suspected')
      ? '<div class="agent-run-meta-section"><div class="agent-run-meta-title">安全</div><div class="agent-run-meta-row approval pending"><span>检测到疑似提示词注入，子 Run 输出按不可信内容处理</span></div></div>'
      : ''
    const actions = renderRunTreeActions(node)
    return `<details class="agent-run-node ${status}" data-subrun-id="${escHtml(node.subRunId)}">
      <summary class="agent-run-node-summary">
        <span class="agent-run-mark">${traceStatusIcon(status === 'cancelled' ? 'done' : status)}</span>
        <span class="agent-run-node-title">${expert}</span>
        <span class="agent-run-builder">${escHtml(builder)}</span>
        ${phase}
        ${stop}
        ${actions}
      </summary>
      ${summary ? `<div class="agent-run-summary">${escHtml(summary)}</div>` : ''}
      ${phaseRows ? `<div class="agent-run-phase-list">${phaseRows}</div>` : ''}
      ${handoffs}${approvals}${artifacts}${evidence}${budget}${security}
    </details>`
  }

  function renderRunTreePanel(message) {
    const nodes = runTreeNodes(message)
    if (!nodes.length) return ''
    const runningCount = nodes.filter(node => node.status === 'running' || node.status === 'waiting').length
    const errorCount = nodes.filter(node => node.terminal === 'failed' || node.status === 'failed').length
    const meta = `${nodes.length} 个子 Run${runningCount ? ` · ${runningCount} 进行中` : ''}${errorCount ? ` · ${errorCount} 异常` : ''}`
    const resumeRoot = message?.resumeAvailable
      ? `<div class="agent-run-resume-banner"><span>检测到可恢复的团队工作流</span><button type="button" class="agent-run-action resume" data-run-resume="${escHtml(message.runId || message.runTree?.rootRunId || '')}">恢复</button></div>`
      : ''
    const guidancePanel = renderRunGuidancePanel(message)
    return `<details class="agent-run-tree">
      <summary class="agent-run-tree-summary"><span class="agent-run-tree-title">Run 树</span><span class="agent-run-tree-meta">${escHtml(meta)}</span></summary>
      ${guidancePanel}
      ${resumeRoot}
      <div class="agent-run-tree-list">${nodes.map(renderRunTreeNode).join('')}</div>
    </details>`
  }

  async function syncPersistedRunTree(message) {
    const rootRunId = message?.runTree?.rootRunId || message?.runId
    const api = window.api?.agentRunTree
    if (!rootRunId || typeof api !== 'function') return
    try {
      const snapshot = await api(rootRunId)
      if (!snapshot?.ok || !snapshot.tree) return
      const reducer = messageStateApi()
      if (!reducer?.mergeRunTreeSnapshot) return
      if (!message.messageState) {
        message.messageState = reducer.createMessageState(message.runId || rootRunId)
      }
      reducer.mergeRunTreeSnapshot(message.messageState, snapshot.tree)
      reducer.applyStateToMessage(message, message.messageState)
      const rootRunIdForState = String(message.runTree?.rootRunId || message.runId || '')
      if (rootRunIdForState) {
        const nodes = runTreeNodes(message)
        const running = nodes.some(node => ['running', 'waiting', 'preparing'].includes(String(node.status || '').toLowerCase()))
        if (!running) runActionState.delete(rootRunIdForState)
      }
      renderChat()
    } catch {
      // best-effort; main IPC may not be wired yet
    }
  }

  async function handleRunTreeAction(kind, runId) {
    const id = String(runId || '').trim()
    if (!id) return
    const rootRunId = (() => {
      const direct = chatHistory.find(message => message?.runId === id || message?.runTree?.rootRunId === id)
      if (direct?.runTree?.rootRunId) return String(direct.runTree.rootRunId)
      const parent = chatHistory.find(message => Boolean(message?.runTree?.nodes?.[id]))
      return String(parent?.runTree?.rootRunId || parent?.runId || id)
    })()
    const apiName = kind === 'cancel'
      ? 'agentRunCancel'
      : kind === 'retry'
        ? 'agentRunRetry'
        : 'agentRunResume'
    const api = window.api?.[apiName]
    if (typeof api !== 'function') {
      if (kind === 'cancel' && typeof window.api?.aiCancelRun === 'function') {
        await window.api.aiCancelRun(id)
      }
      return
    }
    const result = kind === 'resume'
      ? await api(id, 'continue')
      : kind === 'retry'
        ? await api(id, { force: false })
        : await api(id)
    if (result?.ok === false) {
      toastFn(result.message || result.error || `${kind === 'cancel' ? '取消' : kind === 'retry' ? '重试' : '恢复'}失败`, 'error')
      return
    }
    if (rootRunId) {
      if (kind === 'cancel') runActionState.set(rootRunId, { phase: 'cancel_requested', at: Date.now() })
      else runActionState.delete(rootRunId)
    }
    const affected = chatHistory.filter(message => {
      if (message?.runId === id || message?.runTree?.rootRunId === id) return true
      return Boolean(message?.runTree?.nodes?.[id])
    })
    for (const message of affected) await syncPersistedRunTree(message)
    renderChat()
  }

  function workbenchTaskDone() {
    if (surfaceMode !== 'workbench' || !workbenchTaskContext) return false
    const status = String(workbenchTaskContext.status || '').toLowerCase()
    return ['done', 'completed', 'finished', 'success', 'terminal'].includes(status)
  }

  function setSendButtonMode(mode) {
    if (!aiSend) return
    const running = mode === 'running'
    const icon = aiSend.querySelector('[data-icon]')
    if (icon) {
      const next = running ? 'stop' : 'send'
      if (icon.dataset.icon !== next) {
        icon.dataset.icon = next
        if (window.StickyIcons) StickyIcons.mount(aiSend)
      }
    }
    aiSend.classList.toggle('is-running', running)
    aiSend.disabled = false
    aiSend.title = running ? '停止生成' : '发送'
    aiSend.setAttribute('aria-label', running ? '停止生成' : '发送')
  }

  function updateComposerMeta() {
    if (!aiComposerMeta || !aiInput) return
    const draft = String(aiInput.value || '').trim()
    const isRunning = !!activeRunId
    const feishuTail = ` · 飞书：${feishuUsageHint}`
    aiComposerMeta.classList.toggle('busy', isRunning)
    aiComposerMeta.classList.toggle('pending', !isRunning && !!pendingSuggestionPayload)
    if (isRunning) {
      aiComposerMeta.textContent = `正在生成回答，可点击停止${feishuTail}`
      return
    }
    if (pendingSuggestionPayload) {
      aiComposerMeta.textContent = `已选择建议项：请补充内容后按 Enter 发送${feishuTail}`
      return
    }
    if (workbenchTaskDone()) {
      aiComposerMeta.textContent = `任务已完成 · 可继续补充问题或开始新任务${feishuTail}`
      return
    }
    if (!draft) {
      aiComposerMeta.textContent = `${currentComposerIdleMeta()} · Enter 发送 · Shift+Enter 换行${feishuTail}`
      return
    }
    aiComposerMeta.textContent = `准备发送 · Enter 发送${feishuTail}`
  }

  function syncThinkingTicker() {
    const hasStreaming = chatHistory.some(m => m.role === 'assistant' && m.streaming)
    if (hasStreaming && !thinkingTicker) {
      thinkingTicker = setInterval(() => {
        let touched = false
        chatHistory.forEach((msg, index) => {
          if (msg.role === 'assistant' && msg.streaming && Number.isFinite(msg.startedAt)) {
            msg.elapsedMs = Math.max(0, Date.now() - msg.startedAt)
            refreshAssistantProgress(index)
            touched = true
          }
        })
        if (touched) updateComposerMeta()
      }, 1000)
    }
    if (!hasStreaming && thinkingTicker) {
      clearInterval(thinkingTicker)
      thinkingTicker = 0
    }
  }

  /** djb2；只用于比对「本次生成的 HTML 是否与上次相同」，不用于安全用途 */
  function quickHash(str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  }

  /** 给可增量比对的行打签名，使后续 patch 能跳过未变化节点（保住动画与用户展开态） */
  function withSig(html) {
    return html.replace(/^<([a-z]+)/i, `<$1 data-sig="${quickHash(html)}"`)
  }

  function elementSignature(el) {
    return el.getAttribute('data-sig') || el.outerHTML
  }

  /** 按位置逐个比对签名，只替换变化的子节点；未变化的保持同一节点身份 */
  function reconcileKeyedChildren(parent, nextParent) {
    if (!parent || !nextParent) return
    const olds = Array.from(parent.children)
    const nexts = Array.from(nextParent.children)
    for (let i = 0; i < nexts.length; i++) {
      const next = nexts[i]
      const cur = olds[i]
      if (!cur) { parent.appendChild(next); continue }
      if (elementSignature(cur) === elementSignature(next)) continue
      cur.replaceWith(next)
    }
    for (let i = nexts.length; i < olds.length; i++) olds[i].remove()
  }

  function syncTextNode(cur, next) {
    if (!cur || !next) return
    if (cur.textContent !== next.textContent) cur.textContent = next.textContent
  }

  function renderPlanChecklist(plan) {
    const items = Array.isArray(plan?.items) ? plan.items : []
    if (!items.length) return ''
    const mark = (status) => {
      if (status === 'done') return '✓'
      if (status === 'doing') return '…'
      if (status === 'blocked') return '!'
      return '○'
    }
    const rows = items.slice(0, 12).map((item) => {
      const status = String(item.status || 'pending')
      const title = escHtml(String(item.title || item.id || '步骤').slice(0, 120))
      const evidence = item.evidence ? `<span class="agent-plan-evidence">${escHtml(String(item.evidence).slice(0, 160))}</span>` : ''
      return withSig(`<li class="agent-plan-item status-${escHtml(status)}" data-plan-id="${escHtml(String(item.id || ''))}"><span class="agent-plan-mark" aria-hidden="true">${mark(status)}</span><span class="agent-plan-title">${title}</span>${evidence}</li>`)
    }).join('')
    const remaining = Number.isFinite(plan.remaining)
      ? plan.remaining
      : items.filter((item) => item.status === 'pending' || item.status === 'doing').length
    return `<div class="agent-plan-checklist" data-agent-plan="1" aria-label="执行计划"><div class="agent-plan-head">计划 · 剩余 ${remaining}</div><ul class="agent-plan-list">${rows}</ul></div>`
  }

  function draftApprovalSummary(item) {
    const name = String(item.toolName || '')
    const args = item.args || item.toolArgs || {}
    const draft = item.draft || {}
    if (name === 'move_path') {
      const from = args.from || draft.from || ''
      const to = args.to || draft.to || ''
      return from && to ? `${from} → ${to}` : '移动路径'
    }
    if (name.startsWith('feishu.draft')) {
      return draft.title || args.title || item.summary || '飞书写入'
    }
    return args.path || draft.path || draft.title || item.summary || ''
  }

  function hasPendingReview(message) {
    const terminal = new Set(['applied', 'approved', 'rejected'])
    return (Array.isArray(message?.trace) ? message.trace : []).some((item) => {
      if (!item?.requiresApproval) return false
      return !terminal.has(String(item.draftStatus || '').toLowerCase())
    })
  }

  function renderToolApprovalCard(item) {
    if (!item?.draftId && !item?.requiresApproval) return ''
    const draftId = escHtml(item.draftId || '')
    const summary = escHtml(String(draftApprovalSummary(item) || '').slice(0, 120))
    const applied = item.draftStatus === 'applied' || item.status === 'done' && !item.requiresApproval
    const rollbackBtn = applied && item.draftId
      ? `<button type="button" class="agent-draft-rollback" data-draft-rollback="${draftId}">回滚到备份</button>`
      : ''
    return `<div class="agent-tool-approval" data-draft-id="${draftId}">
      <span class="agent-tool-approval-badge">待确认</span>
      ${summary ? `<span class="agent-tool-approval-target" title="${summary}">${summary}</span>` : ''}
      <span class="agent-tool-approval-hint">写入操作需批准后才会执行</span>
      <div class="agent-tool-approval-actions">
        <button type="button" class="agent-draft-approve" data-draft-approve="${draftId}">批准</button>
        <button type="button" class="agent-draft-reject" data-draft-reject="${draftId}">拒绝</button>
        ${rollbackBtn}
      </div>
    </div>`
  }

  function renderArtifactCards(refs = []) {
    const list = Array.isArray(refs) ? refs.filter(r => r && r.id) : []
    if (!list.length) return ''
    return `<div class="agent-artifact-cards">${list.map(r =>
      `<div class="agent-artifact-card" data-artifact-id="${escHtml(r.id)}"><span class="agent-artifact-kind">${escHtml(r.kind || 'artifact')}</span><span class="agent-artifact-title">${escHtml(r.title || r.id)}</span></div>`,
    ).join('')}</div>`
  }

  function renderExecutionTimeline(m) {
    const trace = Array.isArray(m.trace) ? m.trace : []
    const planHtml = renderPlanChecklist(m.plan)
    const runTreeHtml = renderRunTreePanel(m)
    if (!trace.length && !planHtml && !runTreeHtml) return ''
    const elapsedMs = Number.isFinite(m.elapsedMs)
      ? m.elapsedMs
      : (m.streaming && Number.isFinite(m.startedAt) ? Date.now() - m.startedAt : 0)
    const toolCount = trace.filter(item => item.kind === 'tool').length
    const errorCount = trace.filter(item => item.status === 'error').length
    const rounds = new Set(trace.map(item => Number(item.round)).filter(Number.isFinite))
    const pending = trace.some(item => item.status === 'pending') || (m.plan?.items || []).some(item => item.status === 'pending' || item.status === 'doing')
    const running = Boolean(m.streaming) || pending
    const pendingReview = hasPendingReview(m)
    const summaryTitle = running ? '执行进度' : '执行过程'
    const summaryMeta = running
      ? (elapsedMs > 0 ? formatElapsed(elapsedMs) : '')
      : `${trace.length} 步${rounds.size > 1 ? ` / ${rounds.size} 轮` : ''}${toolCount ? ` / ${toolCount} 项操作` : ''}${errorCount ? ` / ${errorCount} 项未完成` : ''}`
    let lastRound = null
    const rows = trace.map(item => {
      const round = Number.isFinite(item.round) ? item.round : null
      const roundLabel = rounds.size > 1 && round !== null && round !== lastRound
        ? withSig(`<div class="agent-trace-round">第 ${round} 轮</div>`)
        : ''
      lastRound = round
      const duration = Number.isFinite(item.durationMs) && item.durationMs > 0
        ? `<span class="agent-trace-time">${item.durationMs < 1000 ? `${Math.round(item.durationMs)}ms` : `${(item.durationMs / 1000).toFixed(1)}s`}</span>`
        : ''
      const status = item.status === 'error' ? 'error' : item.status === 'pending' ? 'pending' : item.status === 'cancelled' ? 'cancelled' : 'done'
      const friendlyTitle = item.kind === 'tool'
        ? toolTimelineTitle(item, status)
        : item.kind === 'subrun'
          ? toolTimelineTitle(item, status)
          : groundingApi().userStatusLabel(item.title || '正在处理', status)
      const head = `<span class="agent-trace-mark">${traceStatusIcon(status)}</span><span class="agent-trace-title">${escHtml(friendlyTitle)}</span>`
      const detail = String(item.summary || '').trim()
      const draftPending = item.requiresApproval && String(item.draftStatus || '').toLowerCase() === 'pending_review'
      const safeDetail = draftPending ? '等待批准，预览已隐藏' : redactDisplayText(detail)
      const sources = Array.isArray(item.sources) ? item.sources.filter(source => source && typeof source === 'object').slice(0, 8) : []
      const sourceCards = sources.length
        ? `<div class="agent-source-results" aria-label="检索到的资料">${sources.map((source, index) => `
            <div class="agent-source-card">
              <div class="agent-source-card-head">
                <span class="agent-source-index">${index + 1}</span>
                <span class="agent-source-title">${escHtml(source.title || `资料 ${index + 1}`)}</span>
              </div>
              ${source.path ? `<div class="agent-source-path" title="${escHtml(source.path)}">${escHtml(source.path)}</div>` : ''}
              ${source.snippet ? `<div class="agent-source-snippet">${escHtml(source.snippet)}</div>` : ''}
            </div>`).join('')}</div>`
        : ''
      const approvalCard = renderToolApprovalCard(item)
      const artifactCards = renderArtifactCards(item.artifactRefs)
      if (item.kind === 'subrun') {
        const node = m.runTree?.nodes?.[item.subRunId]
        const subDetail = node ? renderRunTreeNode(node) : ''
        const meta = duration ? `<span class="agent-trace-meta">${duration}</span>` : ''
        return `${roundLabel}${withSig(`<details class="agent-trace-row subrun ${status}"><summary aria-label="${escHtml(friendlyTitle)}">${head}${meta}</summary>${subDetail ? `<div class="agent-run-inline">${subDetail}</div>` : (safeDetail ? `<span class="agent-trace-hint">${escHtml(safeDetail)}</span>` : '')}</details>`)}`
      }
      if (item.kind === 'tool' && safeDetail && !draftPending) {
        const resultLabel = status === 'error' ? '查看详情' : item.requiresApproval ? '查看预览' : sources.length ? `查看 ${sources.length} 条资料` : '查看结果'
        const meta = `<span class="agent-trace-meta"><span class="agent-trace-result-label">${escHtml(resultLabel)}</span>${duration}</span>`
        const statusHint = (status === 'pending' && /超时|重试|已等待/.test(safeDetail))
          || (status === 'error' && safeDetail)
          ? `<span class="agent-trace-hint">${escHtml(safeDetail.slice(0, 160))}</span>`
          : ''
        return `${roundLabel}${withSig(`<details class="agent-trace-row tool ${status}${item.requiresApproval ? ' pending-review' : ''}"><summary aria-label="${escHtml(`${friendlyTitle}，${status === 'pending' ? '进行中' : status === 'error' ? '未完成' : '已完成'}`)}">${head}${meta}${statusHint}</summary><pre>${escHtml(safeDetail)}</pre>${approvalCard}${artifactCards}${sourceCards}</details>`)}`
      }
      const meta = duration ? `<span class="agent-trace-meta">${duration}</span>` : ''
      return `${roundLabel}${withSig(`<div class="agent-trace-row ${item.kind} ${status}${item.requiresApproval ? ' pending-review' : ''}" aria-label="${escHtml(`${friendlyTitle}，${status === 'pending' ? '进行中' : status === 'error' ? '未完成' : '已完成'}`)}">${head}${meta}${safeDetail ? `<span class="agent-trace-hint">${escHtml(safeDetail)}</span>` : ''}${approvalCard}${artifactCards}${sourceCards}</div>`)}`
    }).join('')
    const keepExpanded = running || pendingReview
    return `<details class="agent-execution${running ? ' is-running' : ''}" data-execution-timeline="1"${keepExpanded ? ' open' : ''}>
      <summary class="agent-execution-summary">${running ? '<span class="agent-execution-orb" aria-hidden="true"></span>' : '<span class="agent-execution-check" aria-hidden="true">✓</span>'}<span class="agent-execution-title">${escHtml(summaryTitle)}</span>${summaryMeta ? `<span class="agent-execution-meta">${escHtml(summaryMeta)}</span>` : ''}</summary>
      ${planHtml}
      ${runTreeHtml}
      <div class="agent-execution-list" role="log" aria-live="polite">${rows}</div>
    </details>`
  }

  function buildExecutionTimelineNode(m) {
    const html = renderExecutionTimeline(m)
    if (!html) return null
    const wrap = document.createElement('div')
    wrap.innerHTML = html
    return wrap.firstElementChild
  }

  /**
   * 原地更新时间线：只改真正变化的文本与行。
   * 整棵替换会让呼吸球/pulse 动画重播、用户展开的工具详情复位，是流式闪屏的主因。
   */
  function patchExecutionTimeline(current, next) {
    if (!current || !next) return false
    const nextCls = next.getAttribute('class') || ''
    if (current.getAttribute('class') !== nextCls) current.setAttribute('class', nextCls)

    const curSummary = current.querySelector(':scope > .agent-execution-summary')
    const nextSummary = next.querySelector(':scope > .agent-execution-summary')
    if (curSummary && nextSummary) {
      const curMark = curSummary.querySelector('.agent-execution-orb, .agent-execution-check')
      const nextMark = nextSummary.querySelector('.agent-execution-orb, .agent-execution-check')
      if (nextMark && (!curMark || curMark.className !== nextMark.className)) {
        if (curMark) curMark.replaceWith(nextMark)
        else curSummary.prepend(nextMark)
      } else if (!nextMark && curMark) curMark.remove()

      syncTextNode(curSummary.querySelector('.agent-execution-title'), nextSummary.querySelector('.agent-execution-title'))

      const curMeta = curSummary.querySelector('.agent-execution-meta')
      const nextMeta = nextSummary.querySelector('.agent-execution-meta')
      if (nextMeta && curMeta) syncTextNode(curMeta, nextMeta)
      else if (nextMeta) curSummary.appendChild(nextMeta)
      else curMeta?.remove()
    }

    const curList = current.querySelector(':scope > .agent-execution-list')
    const nextList = next.querySelector(':scope > .agent-execution-list')
    const curPlan = current.querySelector(':scope > .agent-plan-checklist')
    const nextPlan = next.querySelector(':scope > .agent-plan-checklist')
    const curRunTree = current.querySelector(':scope > .agent-run-tree')
    const nextRunTree = next.querySelector(':scope > .agent-run-tree')
    if (curPlan && nextPlan) {
      syncTextNode(curPlan.querySelector('.agent-plan-head'), nextPlan.querySelector('.agent-plan-head'))
      reconcileKeyedChildren(curPlan.querySelector('.agent-plan-list'), nextPlan.querySelector('.agent-plan-list'))
    } else if (nextPlan) {
      current.insertBefore(nextPlan, curList || null)
    } else if (curPlan) {
      curPlan.remove()
    }

    if (curRunTree && nextRunTree) {
      syncTextNode(curRunTree.querySelector('.agent-run-tree-meta'), nextRunTree.querySelector('.agent-run-tree-meta'))
      reconcileKeyedChildren(curRunTree.querySelector('.agent-run-tree-list'), nextRunTree.querySelector('.agent-run-tree-list'))
    } else if (nextRunTree) {
      current.insertBefore(nextRunTree, curList || null)
    } else if (curRunTree) {
      curRunTree.remove()
    }

    if (curList && nextList) reconcileKeyedChildren(curList, nextList)
    else if (nextList) current.appendChild(nextList)
    else curList?.remove()
    return true
  }

  function renderThinkingStatus(message) {
    const elapsed = Number.isFinite(message?.elapsedMs)
      ? message.elapsedMs
      : (Number.isFinite(message?.startedAt) ? Math.max(0, Date.now() - message.startedAt) : 0)
    return `<span class="thinking-status" data-thinking-status role="status"><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span><span data-thinking-label>${escHtml(groundingApi().userStatusLabel(message?.activity || '正在处理'))}${elapsed > 0 ? ` · ${formatElapsed(elapsed)}` : ''}</span></span>`
  }

  function updateThinkingStatus(bubble, message) {
    const label = bubble?.querySelector('[data-thinking-label]')
    if (!label) return
    const elapsed = Number.isFinite(message?.elapsedMs) ? message.elapsedMs : 0
    const status = groundingApi().userStatusLabel(message?.activity || '正在处理')
    label.textContent = `${status}${elapsed > 0 ? ` · ${formatElapsed(elapsed)}` : ''}`
  }

  function refreshAssistantProgress(index) {
    const message = chatHistory[index]
    if (!message?.streaming) return true
    const bubble = chatLog.querySelector(`[data-idx="${index}"]`)
    if (!bubble) {
      renderChat()
      return false
    }

    const timeline = bubble.querySelector('[data-execution-timeline]')
    const next = buildExecutionTimelineNode(message)
    if (next) {
      // 已有时间线走原地 patch；整棵替换会重播动画并复位用户展开的工具详情
      if (!timeline || !patchExecutionTimeline(timeline, next)) {
        if (timeline) timeline.replaceWith(next)
        else {
          const status = bubble.querySelector('[data-thinking-status]')
          if (status) bubble.insertBefore(next, status)
          else bubble.prepend(next)
        }
      }
      bubble.querySelector('[data-thinking-status]')?.remove()
      bubble.classList.add('has-execution')
    } else {
      timeline?.remove()
      bubble.classList.remove('has-execution')
      if (!bubble.querySelector('[data-thinking-status]')) {
        const wrap = document.createElement('div')
        wrap.innerHTML = renderThinkingStatus(message)
        if (wrap.firstElementChild) bubble.appendChild(wrap.firstElementChild)
      }
    }

    const meta = bubble.querySelector('.agent-execution-meta')
    const hasPending = Array.isArray(message.trace) && message.trace.some(item => item.status === 'pending')
    if (meta && hasPending) {
      const elapsedText = message.elapsedMs > 0 ? formatElapsed(message.elapsedMs) : ''
      if (meta.textContent !== elapsedText) meta.textContent = elapsedText
    }
    updateThinkingStatus(bubble, message)
    return true
  }

  function renderGroundingStatusMeta(m) {
    if (m?.streaming) return ''
    const gs = m?.groundingStatus
    if (!gs) return ''
    const render = window.GroundingUI?.renderGroundingStatusMetaHtml
    if (render) return render(gs, escHtml)
    return ''
  }

  function renderWorkbenchCitationsMeta(m) {
    if (m?.streaming) return ''
    if (surfaceMode !== 'workbench') return ''
    const citations = Array.isArray(m?.workbenchCitations) ? m.workbenchCitations.filter(c => c && c.label) : []
    if (!citations.length) return ''
    const items = citations.slice(0, 8).map((item) => {
      const detail = String(item.detail || '').trim()
      return `<li><span class="agent-workbench-cite-label">${escHtml(item.label)}</span>${
        detail ? `<span class="agent-workbench-cite-detail">${escHtml(detail)}</span>` : ''
      }</li>`
    }).join('')
    return `<details class="agent-workbench-citations">
      <summary>引用来源（${citations.length}）</summary>
      <ul>${items}</ul>
    </details>`
  }

  function renderPersonalizationMeta(m) {
    if (m?.streaming) return ''
    const applied = Array.isArray(m?.personalization?.applied) ? m.personalization.applied : []
    if (!applied.length) return ''
    const items = applied.slice(0, 8).map((item) => {
      const label = item.kind === 'user_prompt' ? '协作偏好' : '已确认习惯'
      return `<li><span class="agent-personalization-kind">${escHtml(label)}</span>${escHtml(String(item.text || '').trim())}</li>`
    }).join('')
    return `<details class="agent-personalization">
      <summary>本轮沿用了 ${applied.length} 条习惯</summary>
      <ul>${items}</ul>
    </details>`
  }

  function assistantActionsHtml(i) {
    const apply = hasActiveEditor
      ? `<div class="agent-apply-wrap">
          <button class="agent-chat-act subtle" type="button" data-act="apply-menu" data-idx="${i}">应用到文件</button>
          <div class="agent-apply-menu" role="menu">
            <button type="button" data-act="insert" data-idx="${i}">插入光标</button>
            <button type="button" data-act="append" data-idx="${i}">追加文末</button>
            <button type="button" class="warn" data-act="replace" data-idx="${i}">替换全文…</button>
          </div>
        </div>`
      : ''
    return apply ? `<div class="agent-chat-actions">${apply}</div>` : ''
  }

  function activeExpertProjection() {
    const expertId = String(activeSession?.expertId || '').trim()
    if (!expertId) return null
    const catalog = catalogExperts.find(item => String(item.id || '') === expertId) || {}
    const sessionExpert = activeSession?.expert || {}
    const bindings = sessionExpert.bindings || {
      skills: Array.isArray(catalog.skills) ? catalog.skills : [],
      connectors: Array.isArray(catalog.connectors) ? catalog.connectors : [],
    }
    return {
      id: expertId,
      name: activeSession.expertName || sessionExpert.name || catalog.name || expertId,
      description: sessionExpert.description || catalog.description || '使用该专家的方法与能力处理工作任务。',
      role: sessionExpert.role || sessionExpert.persona?.role || catalog.persona?.role || catalog.role || '专业 Agent',
      avatar: sessionExpert.avatar || sessionExpert.persona?.avatar || catalog.avatar || catalog.persona?.avatar || '',
      attributes: sessionExpert.attributes || catalog.attributes || {},
      professionalCapabilities: sessionExpert.professionalCapabilities || catalog.display?.capabilities || catalog.capabilities || catalog.skills || [],
      origin: sessionExpert.origin || sessionExpert.source || catalog.origin || catalog.source || 'local',
      soul: sessionExpert.soul || catalog.soul || '',
      sop: sessionExpert.sop || catalog.sop || sessionExpert.systemPrompt || catalog.systemPrompt || '',
      agenticType: sessionExpert.agenticType || catalog.agenticType || 'react',
      bindings,
      readiness: sessionExpert.readiness || null,
    }
  }

  /** 会话首屏的身份区：与工作台卡片共用图标语义，让「点开始使用」是同一对象的延续 */
  function renderExpertIdentityHtml(expert) {
    const identity = window.AgentIdentity || null
    const icon = identity ? identity.identityIcon(expert) : 'users'
    const badge = identity ? identity.identitySourceLabel(expert) : '我的专家'
    const avatarSrc = identity && typeof identity.identityAvatarSrc === 'function'
      ? identity.identityAvatarSrc(expert)
      : ''
    const mark = avatarSrc
      ? `<img class="agent-expert-identity-photo" src="${escHtml(avatarSrc)}" alt="" width="34" height="34" decoding="async">`
      : `<span class="ico" data-icon="${escHtml(icon)}"></span>`
    return `<div class="agent-expert-identity">
      <span class="agent-expert-identity-mark${avatarSrc ? ' has-photo' : ''}" aria-hidden="true">${mark}</span>
      <div class="agent-expert-identity-copy">
        <div class="agent-expert-identity-name">
          <strong>${escHtml(expert.name)}</strong>
          <span class="agent-expert-identity-badge">${escHtml(badge)}</span>
        </div>
        <p>${escHtml(expert.description)}</p>
      </div>
    </div>`
  }

  function renderExpertKnowledgeHtml() {
    const selected = new Set(sessionKnowledgeRefs())
    const canUpdateKnowledge = typeof window.api?.agentSessionContextUpdate === 'function'
    let options = ''
    if (!canUpdateKnowledge) {
      options = '<span class="agent-expert-capability limited">本次对话知识库范围由系统管理</span>'
    } else if (knowledgeCatalogState === 'loading' || knowledgeCatalogState === 'idle') {
      options = '<button type="button" class="agent-expert-knowledge" disabled>正在读取知识库…</button>'
    } else if (knowledgeCatalogState === 'error') {
      options = '<span class="agent-expert-capability limited">知识库暂不可用</span><button type="button" class="agent-expert-knowledge-retry" data-knowledge-retry>重试</button>'
    } else {
      const known = new Set(knowledgeProviders.map(item => String(item.id || '')))
      const defaultLabel = activeKnowledgeProviderId
        ? (knowledgeProviders.find(item => String(item.id || '') === activeKnowledgeProviderId)?.displayName
          || knowledgeProviders.find(item => String(item.id || '') === activeKnowledgeProviderId)?.name
          || activeKnowledgeProviderId)
        : '系统默认'
      const defaultOption = `<button type="button" class="agent-expert-knowledge${selected.size ? '' : ' selected'}" data-knowledge-default="1"${knowledgeUpdatePending ? ' disabled' : ''}>跟随默认 · ${escHtml(defaultLabel)}</button>`
      const providerOptions = knowledgeProviders.map(provider => {
        const id = String(provider.id || '')
        const unavailable = provider.enabled === false
        return `<button type="button" class="agent-expert-knowledge${selected.has(id) ? ' selected' : ''}${unavailable ? ' limited' : ''}" data-knowledge-provider="${escHtml(id)}"${unavailable || knowledgeUpdatePending ? ' disabled' : ''}>${escHtml(provider.displayName || provider.name || id)}</button>`
      }).join('')
      const missing = [...selected].filter(id => !known.has(id))
        .map(id => `<button type="button" class="agent-expert-knowledge limited selected" data-knowledge-provider="${escHtml(id)}"${knowledgeUpdatePending ? ' disabled' : ''}>${escHtml(id)} · 已失效</button>`)
        .join('')
      options = defaultOption + providerOptions + missing
    }
    return `<section class="agent-expert-section">
      <div class="agent-expert-section-head"><span>知识库</span><small>${selected.size ? `本次仅使用 ${selected.size} 个` : '沿用当前默认范围'}</small></div>
      <div class="agent-expert-knowledge-options">${options}</div>
    </section>`
  }

  function renderKnowledgeToolbarMenu() {
    if (!aiKnowledgeMenu) return
    const selected = new Set(sessionKnowledgeRefs())
    const canUpdateKnowledge = typeof window.api?.agentSessionContextUpdate === 'function'
    let options = ''
    if (!canUpdateKnowledge) {
      options = '<span class="agent-expert-capability limited">本次对话知识库范围由系统管理</span>'
    } else if (knowledgeCatalogState === 'loading' || knowledgeCatalogState === 'idle') {
      options = '<button type="button" class="agent-expert-knowledge" disabled>正在读取知识库…</button>'
    } else if (knowledgeCatalogState === 'error') {
      options = '<span class="agent-expert-capability limited">知识库暂不可用</span><button type="button" class="agent-expert-knowledge-retry" data-knowledge-retry>重试</button>'
    } else {
      const known = new Set(knowledgeProviders.map(item => String(item.id || '')))
      const defaultProvider = knowledgeProviders.find(item => String(item.id || '') === activeKnowledgeProviderId)
      const defaultLabel = defaultProvider?.displayName || defaultProvider?.name || activeKnowledgeProviderId || '系统默认'
      options = `<button type="button" class="agent-expert-knowledge${selected.size ? '' : ' selected'}" data-knowledge-default="1"${knowledgeUpdatePending ? ' disabled' : ''}>跟随默认 · ${escHtml(defaultLabel)}</button>`
      options += knowledgeProviders.map(provider => {
        const id = String(provider.id || '')
        return `<button type="button" class="agent-expert-knowledge${selected.has(id) ? ' selected' : ''}" data-knowledge-provider="${escHtml(id)}"${provider.enabled === false || knowledgeUpdatePending ? ' disabled' : ''}>${escHtml(provider.displayName || provider.name || id)}</button>`
      }).join('')
      options += [...selected].filter(id => !known.has(id))
        .map(id => `<button type="button" class="agent-expert-knowledge limited selected" data-knowledge-provider="${escHtml(id)}"${knowledgeUpdatePending ? ' disabled' : ''}>${escHtml(id)} · 已失效</button>`)
        .join('')
    }
    aiKnowledgeMenu.innerHTML = `<div class="agent-knowledge-menu-head"><strong>本次对话知识库</strong><span>${selected.size ? `已选 ${selected.size}` : '跟随默认'}</span></div><div class="agent-expert-knowledge-options">${options}</div>`
  }

  function hideKnowledgeMenu() {
    knowledgeMenuOpen = false
    aiKnowledgeMenu?.classList.remove('show')
    aiKnowledgeBtn?.setAttribute('aria-expanded', 'false')
  }

  function syncKnowledgeToolbar() {
    if (!aiKnowledgeWrap) return
    const expert = activeExpertProjection()
    aiKnowledgeWrap.hidden = !expert
    if (!expert) {
      hideKnowledgeMenu()
      return
    }
    const refs = sessionKnowledgeRefs()
    if (aiKnowledgeLabel) {
      aiKnowledgeLabel.textContent = refs.length ? `${refs.length} 个知识库` : '默认知识库'
    }
    if (knowledgeMenuOpen) renderKnowledgeToolbarMenu()
  }

  /** 工作台专家任务间：属性落右侧详情；左侧用「协作首屏」而非助手通用入口 */
  function isWorkbenchExpertTaskRoomActive() {
    const shell = document.getElementById('appShell')
    const room = document.getElementById('wbExpertTaskRoom')
    return !!(
      shell?.classList.contains('mode-workbench')
      && shell?.dataset.workbenchLayout === 'task-room'
      && room
      && !room.hidden
    )
  }

  function expertReadinessItems(expert) {
    const fallbackItems = [
      ...(expert.bindings?.skills || []).map(id => ({
        id,
        kind: 'skill',
        status: skillCatalog.some(item => String(item.id || '') === String(id)) ? 'ready' : 'limited',
      })),
      ...(expert.bindings?.connectors || []).map(id => ({ id, kind: 'connector', status: 'ready' })),
    ]
    const readinessItems = Array.isArray(expert.readiness?.items)
      ? expert.readiness.items.map(item => ({ ...item }))
      : fallbackItems
    for (const item of readinessItems) {
      if (item.kind === 'connector' && /feishu|lark/i.test(String(item.id || '')) && !/^可/.test(feishuUsageHint)) {
        item.status = 'limited'
        item.reason = feishuUsageHint
      }
    }
    return readinessItems
  }

  function expertCollabCapabilityTags(expert) {
    const api = window.WorkbenchPresenter
    if (api && typeof api.capabilityTags === 'function') {
      return api.capabilityTags(expert, 3)
    }
    const role = String(expert.role || '').trim()
    return role ? [role] : []
  }

  /** 仅工作台专家任务间：强调「与该 Agent 深入协作」，不复用助手通用 launch intro */
  function renderExpertCollabEmptyState(expert) {
    const identity = window.AgentIdentity || null
    const avatarSrc = identity && typeof identity.identityAvatarSrc === 'function'
      ? identity.identityAvatarSrc(expert)
      : ''
    const icon = identity && typeof identity.identityIcon === 'function'
      ? identity.identityIcon(expert)
      : 'users'
    const mark = avatarSrc
      ? `<img class="agent-collab-photo" src="${escHtml(avatarSrc)}" alt="" width="56" height="56" decoding="async">`
      : `<span class="ico" data-icon="${escHtml(icon)}"></span>`
    const tags = expertCollabCapabilityTags(expert)
    const tagsHtml = tags.length
      ? `<div class="agent-collab-caps">${tags.map(t => `<span>${escHtml(t)}</span>`).join('')}</div>`
      : ''
    const skillsCount = (expert.bindings?.skills || []).length
    const connectorCount = (expert.bindings?.connectors || []).length
    const metaBits = []
    if (expert.agenticType) {
      const typeLabels = {
        reflection: '反射',
        tool_use: '工具优先',
        react: 'ReAct',
        planning: '规划',
        multi_agent: '多智能体',
      }
      metaBits.push(typeLabels[expert.agenticType] || expert.agenticType)
    }
    if (skillsCount) metaBits.push(`${skillsCount} 技能`)
    if (connectorCount) metaBits.push(`${connectorCount} 连接`)
    const sopHint = String(expert.sop || '').trim().split(/\n/).map(s => s.trim()).filter(Boolean)[0] || ''
    const metaHtml = metaBits.length
      ? `<div class="agent-collab-meta">${metaBits.map(b => `<span>${escHtml(b)}</span>`).join('')}</div>`
      : ''
    const sopHtml = sopHint
      ? `<p class="agent-collab-sop">${escHtml(sopHint.slice(0, 120))}${sopHint.length > 120 ? '…' : ''}</p>`
      : ''
    const group = packEmptyGroups.find(item => String(item.packId || '') === expert.id)
    const packCards = group
      ? (skillTaskUi.resolvePackEmptyCards
          ? skillTaskUi.resolvePackEmptyCards(group, skillTaskMap)
          : (group.scenes || []).map(card => ({
              sceneId: card.id,
              title: card.title,
              subtitle: card.subtitle,
              prompt: card.prompt,
              dynamic: false,
            })))
      : []
    let actionsHtml = ''
    if (packCards.length) {
      actionsHtml = packCards.slice(0, 3).map(card => {
        const attrs = card.dynamic
          ? `data-pack-id="${escHtml(group.packId)}" data-shortcut="${escHtml(card.id)}"`
          : `data-pack-id="${escHtml(group.packId)}" data-pack-scene="${escHtml(card.sceneId || card.id)}" data-prompt="${escHtml(card.prompt || '')}"`
        return `<button type="button" class="agent-collab-act" data-auto-send="1" ${attrs}>
          <strong>${escHtml(card.title || '协作')}</strong>
          <span>${escHtml(card.subtitle || '')}</span>
        </button>`
      }).join('')
    } else {
      actionsHtml = `
        <button type="button" class="agent-collab-act" data-auto-send="1" data-prompt="${escHtml(`请以${expert.name}的身份开始协作。先复述你理解的目标、缺口信息与可立即推进的第一步。`)}">
          <strong>对齐目标</strong>
          <span>复述目标 · 缺口 · 下一步</span>
        </button>
        <button type="button" class="agent-collab-act" data-auto-send="1" data-prompt="${escHtml(`请按${expert.name}的方法列出你最适合接手的 3 类任务，并各给一个我可以直接粘贴的示例请求。`)}">
          <strong>擅长什么</strong>
          <span>3 类任务 + 示例请求</span>
        </button>
        <button type="button" class="agent-collab-act" data-auto-send="1" data-prompt="${escHtml(`我有一批材料尚未整理。请以${expert.name}身份告诉我：需要哪些文件/数据，以及拿到后会怎么处理。`)}">
          <strong>带上材料</strong>
          <span>需要什么 · 如何处理</span>
        </button>`
    }
    const readinessItems = expertReadinessItems(expert)
    const limited = readinessItems.some(item => item.status !== 'ready')
    return `<div class="agent-empty-tips agent-empty-expert-collab" aria-label="${escHtml(expert.name)}协作入口">
      <div class="agent-collab-head">
        <span class="agent-collab-mark${avatarSrc ? ' has-photo' : ''}" aria-hidden="true">${mark}</span>
        <div class="agent-collab-copy">
          <span class="agent-collab-kicker">专家协作</span>
          <strong>${escHtml(expert.name)}</strong>
          ${tagsHtml}
          ${metaHtml}
          ${sopHtml}
        </div>
      </div>
      <div class="agent-home-composer-mount" data-agent-composer-mount></div>
      <div class="agent-collab-section"><span>一起开始</span></div>
      <div class="agent-collab-actions">${actionsHtml}</div>
      ${limited ? '<p class="agent-collab-hint">部分能力待配置，仍可先对话推进。</p>' : ''}
    </div>`
  }

  /** 专家多出的上下文：属性 / 能力 / 技能 / 知识库（助理模式：对话右侧） */
  function renderExpertContextPanelHtml(expert, { includeKnowledge = true } = {}) {
    const readinessItems = expertReadinessItems(expert)
    const readinessHtml = readinessItems.length
      ? readinessItems.map(item => {
          const ready = item.status === 'ready'
          const kind = item.kind === 'connector' ? '连接器' : '技能'
          return `<span class="agent-expert-capability${ready ? ' ready' : ' limited'}">
            ${escHtml(kind)} · ${escHtml(item.id)} · ${ready ? '已就绪' : escHtml(item.reason || '暂不可用')}
          </span>`
        }).join('')
      : '<span class="agent-expert-capability ready">专家方法 · 已就绪</span>'
    const limitedConnectors = readinessItems.filter(item => item.kind === 'connector' && item.status !== 'ready')
    const configureHtml = limitedConnectors.length
      ? '<button type="button" class="agent-expert-config" data-expert-config>去配置连接器</button>'
      : ''
    const capabilityCount = readinessItems.length
    const attributes = expert.attributes && typeof expert.attributes === 'object'
      ? Object.values(expert.attributes).map(String).filter(Boolean).slice(0, 3)
      : []
    const attributeText = attributes.length
      ? attributes.join(' · ')
      : `${expert.origin === 'local' ? '本地专家' : '已安装专家'} · ${capabilityCount || 1} 项能力`
    const professional = Array.isArray(expert.professionalCapabilities)
      ? expert.professionalCapabilities.map(item => String(item?.label || item?.name || item || '')).filter(Boolean).slice(0, 5)
      : []
    const professionalText = professional.length ? professional.join('、') : expert.description
    return `<div class="agent-expert-context">
      <div class="agent-expert-context-grid">
        <section class="agent-expert-context-card"><span>专家属性</span><strong>${escHtml(expert.role)}<br>${escHtml(attributeText)}</strong></section>
        <section class="agent-expert-context-card"><span>专业能力</span><p>${escHtml(professionalText)}</p></section>
      </div>
      <section class="agent-expert-section">
        <div class="agent-expert-section-head"><span>技能与连接器</span><small>${capabilityCount ? `${capabilityCount} 项绑定` : '内置方法'}</small></div>
        <div class="agent-expert-readiness" aria-label="专家能力状态">${readinessHtml}${configureHtml}</div>
      </section>
      ${includeKnowledge ? renderExpertKnowledgeHtml() : ''}
    </div>`
  }

  function renderExpertEmptyState(expert) {
    // 工作台任务间：专用协作首屏（不与助手通用 launch 混用）
    if (isWorkbenchExpertTaskRoomActive()) {
      return renderExpertCollabEmptyState(expert)
    }
    const group = packEmptyGroups.find(item => String(item.packId || '') === expert.id)
    const cards = group
      ? (skillTaskUi.resolvePackEmptyCards
          ? skillTaskUi.resolvePackEmptyCards(group, skillTaskMap)
          : (group.scenes || []).map(card => ({
              sceneId: card.id,
              title: card.title,
              subtitle: card.subtitle,
              prompt: card.prompt,
              dynamic: false,
            })))
      : []
    const cardsHtml = cards.slice(0, 4).map(card => {
      const attrs = card.dynamic
        ? `data-pack-id="${escHtml(group.packId)}" data-shortcut="${escHtml(card.id)}"`
        : `data-pack-id="${escHtml(group.packId)}" data-pack-scene="${escHtml(card.sceneId || card.id)}" data-prompt="${escHtml(card.prompt || '')}"`
      return renderEmptyActionCard(card, attrs)
    }).join('') || `
      <button type="button" class="agent-empty-act" data-auto-send="1" data-prompt="${escHtml(`请以${expert.name}的身份开始协作。先确认我的目标和已有材料，再给出最短可执行步骤。`)}">
        <span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="play"></span></span>
        <span class="agent-empty-act-copy"><strong>开始一个任务</strong><span>说明目标与已有材料，专家会直接推进</span></span>
      </button>
      <button type="button" class="agent-empty-act" data-auto-send="1" data-prompt="${escHtml(`请介绍你作为${expert.name}最适合处理的任务，并给我 3 个具体示例。`)}">
        <span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="capabilityStack"></span></span>
        <span class="agent-empty-act-copy"><strong>看看能做什么</strong><span>了解适用场景和协作方式</span></span>
      </button>`

    const readinessItems = expertReadinessItems(expert)
    // 受限项要读起来像「解释降级」而不是「功能失效」：明确许可用户先聊起来
    const degradedHtml = readinessItems.some(item => item.status !== 'ready')
      ? '<p class="agent-expert-degraded">有依赖未就绪，仍可直接对话；需要用到它时再去配置。</p>'
      : ''
    // 助理模式：引导 + Composer 位 + 快捷任务；属性并排在对话右侧
    const mainHtml = `${renderLaunchIntroHtml(expert.name, '说明你的目标与已有材料，它会按自己的方法推进。')}
      <div class="agent-empty-actions">${cardsHtml}</div>`
    const sideHtml = `${renderExpertIdentityHtml(expert)}
      ${renderExpertContextPanelHtml(expert)}
      ${degradedHtml}`
    return `<div class="agent-empty-tips agent-empty-home agent-empty-expert agent-empty-expert-split" aria-label="${escHtml(expert.name)}专家入口">
      <div class="agent-empty-expert-main">${mainHtml}</div>
      <aside class="agent-empty-expert-side" aria-label="专家属性与能力">${sideHtml}</aside>
    </div>`
  }

  function renderEmptyState() {
    const renderShortcutCards = mode => {
      const cards = skillTaskUi.resolveEmptyStateCards
        ? skillTaskUi.resolveEmptyStateCards(mode, EMPTY_SHORTCUT_PRESETS, skillTaskMap)
        : (Array.isArray(EMPTY_SHORTCUT_PRESETS[mode]) ? EMPTY_SHORTCUT_PRESETS[mode] : [])
      return cards.slice(0, 4)
        .map(card => renderEmptyActionCard(card, `data-shortcut="${escHtml(card.id)}"`))
        .join('')
    }
    if (surfaceMode === 'workbench') {
      const task = workbenchTaskContext || {}
      const kind = String(task.kind || task.runMode || '')
      if (kind === 'expert-chat' || (isWorkbenchExpertTaskRoomActive() && kind !== 'workflow-chat' && String(task.runMode || '') !== 'daemon')) {
        const activeExpert = activeExpertProjection()
        if (activeExpert) return renderExpertCollabEmptyState(activeExpert)
      }
      const goal = task.intent || task.name || task.slug || '当前工作'
      const artifacts = Array.isArray(task.artifacts) ? task.artifacts : []
      const resultSummary = String(task.resultSummary || '').trim()
      if (workbenchTaskDone()) {
        const artifactHtml = artifacts.length
          ? `<div class="agent-workbench-results">${artifacts.slice(0, 6).map((item, index) => {
              const source = item && typeof item === 'object' ? item : {}
              const title = String(source.title || source.name || source.label || source.path || source.url || item || `产物 ${index + 1}`)
              return `<div class="agent-workbench-result"><span class="ico" data-icon="fileText"></span><span>${escHtml(title)}</span></div>`
            }).join('')}</div>`
          : ''
        const summaryHtml = resultSummary
          ? `<div class="agent-workbench-result-summary">${escHtml(resultSummary)}</div>`
          : ''
        const emptyText = !artifacts.length && !resultSummary
          ? '<div class="agent-empty-sub">本次运行已结束，但没有返回结果或可打开产物。可在右侧查看执行过程，或调整输入后再跑一次。</div>'
          : ''
        return `<div class="agent-empty-tips agent-empty-workbench is-completed" aria-label="任务结果">
          <div class="agent-empty-kicker">任务结果</div>
          <div class="agent-empty-hero">${escHtml(goal)}</div>
          <div class="agent-empty-sub">${artifacts.length ? `已完成 · ${artifacts.length} 个产物` : '已完成 · 无可打开产物'}</div>
          ${summaryHtml}
          ${artifactHtml}
          ${emptyText}
        </div>`
      }
      const workflow = task.workflowName || task.workflow || '待确认流程'
      const current = task.currentNode || '流程执行中'
      const agents = Array.isArray(task.agents) && task.agents.length
        ? task.agents.join(' · ')
        : '由流程按需调度'
      return `<div class="agent-empty-tips agent-empty-workbench" aria-label="任务协作入口">
        <div class="agent-empty-kicker is-secondary">协作引导</div>
        <div class="agent-empty-hero">${escHtml(goal)}</div>
        <div class="agent-empty-sub">进度与审批请在右侧流程面板操作。这里只补充要求、附材料或调用 Agent，不臆造流程外角色。</div>
        <div class="agent-workbench-steps">
          <div><span>01</span><strong>工作流</strong><small>${escHtml(workflow)}</small></div>
          <div><span>02</span><strong>当前节点</strong><small>${escHtml(current)}</small></div>
          <div><span>03</span><strong>参与助手</strong><small>${escHtml(agents)}</small></div>
        </div>
        <div class="agent-empty-tip"><span class="tip-label">推进任务</span><span class="tip-key">右侧 · 通过/修订/澄清</span></div>
        <div class="agent-empty-tip"><span class="tip-label">补充材料</span><span class="tip-key">@ 文件</span></div>
        <div class="agent-empty-tip"><span class="tip-label">飞书查询</span><span class="tip-key">${escHtml(feishuUsageHint)}</span></div>
      </div>`
    }
    const activeExpert = activeExpertProjection()
    if (activeExpert) return renderExpertEmptyState(activeExpert)
    const packHtml = activeSession?.agentId === 'general'
      ? renderPackEmptyStateHtml()
      : ''
    if (packHtml) return packHtml
    if (activeSession?.agentId === 'steward') {
      return `<div class="agent-empty-tips agent-empty-home agent-empty-steward" aria-label="知识管家入口">
        ${renderLaunchIntroHtml('知识管家 · 公司知识协作')}
        <div class="agent-empty-actions">
          <button type="button" class="agent-empty-act" data-steward="ingest"><span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="bookOpen"></span></span><span class="agent-empty-act-copy"><strong>整理本地 Wiki</strong><span>吸收材料到知识根</span></span></button>
          <button type="button" class="agent-empty-act" data-steward="lint"><span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="clipboardCheck"></span></span><span class="agent-empty-act-copy"><strong>知识健康检查</strong><span>断链 / 空文 / 重复标题</span></span></button>
          <button type="button" class="agent-empty-act" data-steward="promote"><span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="database"></span></span><span class="agent-empty-act-copy"><strong>升格 OKF</strong><span>Wiki → 可交换概念（需审阅）</span></span></button>
          <button type="button" class="agent-empty-act" data-steward="remote-rag"><span class="agent-empty-act-mark" aria-hidden="true"><span class="ico" data-icon="searchLine"></span></span><span class="agent-empty-act-copy"><strong>检索远程知识库</strong><span>MCP 读取 RAG 知识库</span></span></button>
        </div>
      </div>`
    }
    if (activeSession?.agentId === 'coding') {
      return `<div class="agent-empty-tips agent-empty-home" aria-label="编程模式入口">
      ${renderLaunchIntroHtml('研发助手 · 编程协作')}
      <div class="agent-empty-actions">
        ${renderShortcutCards('coding')}
      </div>
    </div>`
    }
    if (activeSession?.agentId === 'writing') {
      return `<div class="agent-empty-tips agent-empty-home" aria-label="写作模式入口">
      ${renderLaunchIntroHtml('写作专家 · 文档协作')}
      <div class="agent-empty-actions">
        ${renderShortcutCards('writing')}
      </div>
    </div>`
    }
    return `<div class="agent-empty-tips agent-empty-home" aria-label="任务入口">
      ${renderLaunchIntroHtml('智能办公搭档')}
      <div class="agent-empty-actions">
        ${renderShortcutCards('general')}
      </div>
    </div>`
  }

  function resolveEmptyShortcutPrompt(button) {
    if (!button || !button.dataset) return ''
    const shortcutId = String(button.dataset.shortcut || '').trim()
    if (shortcutId && EMPTY_SHORTCUT_PROMPTS[shortcutId]) return String(EMPTY_SHORTCUT_PROMPTS[shortcutId]).trim()
    const fromPrompt = String(button.dataset.prompt || button.dataset.p || '').trim()
    return fromPrompt
  }

  function deriveFeishuUsageHint(connector = null) {
    const enabled = !!connector?.enabled
    const status = connector?.status || {}
    if (!enabled) return '未启用（设置 → 连接器）'
    if (status.state === 'auth_required') return '需授权 user 身份'
    if (status.userReady) return '可查询文档/知识库'
    if (status.botReady && !status.userReady) return '仅 bot 在线（文档检索需 user）'
    if (status.state === 'timeout') return '状态检查超时'
    return '连接中或不可用'
  }

  function classifyFeishuIntent(text) {
    const src = String(text || '')
    const low = src.toLowerCase()
    const mentions = /(飞书|feishu|lark)/i.test(src)
    if (!mentions) return { mentions: false, kind: '' }
    if (/(文档|知识库|wiki|doc|docs|多维表格|bitable|base)/i.test(src)) return { mentions: true, kind: 'docs' }
    if (/(消息|聊天|会话|群|im|发消息|回复)/i.test(src)) return { mentions: true, kind: 'im' }
    if (/(日历|会议|日程|calendar)/i.test(src)) return { mentions: true, kind: 'calendar' }
    if (/(任务|待办|task)/i.test(src)) return { mentions: true, kind: 'task' }
    if (/(专家|智能体|bot|助手|agent)/i.test(src)) return { mentions: true, kind: 'agent' }
    // 仅提到飞书，但未给出明确能力类型
    if (/飞书|feishu|lark/i.test(low)) return { mentions: true, kind: 'unknown' }
    return { mentions: true, kind: 'unknown' }
  }

  async function readFeishuConnector() {
    if (!window.api?.connectorsStatus) return null
    try {
      const res = await window.api.connectorsStatus('feishu')
      return res?.connector || null
    } catch {
      return null
    }
  }

  async function maybeAugmentFeishuPrompt(userPrompt) {
    const intent = classifyFeishuIntent(userPrompt)
    if (!intent.mentions) return userPrompt
    const connector = await readFeishuConnector()
    const hint = deriveFeishuUsageHint(connector)
    const status = connector?.status || {}
    const needsUserAuth = !connector?.enabled || status.state === 'auth_required' || !status.userReady
    const needsFunctionClarify = intent.kind === 'unknown'
    if (!needsUserAuth && !needsFunctionClarify) return userPrompt
    const directives = []
    directives.push('你是 KnowMe。先进行澄清，不要直接执行工具。')
    if (needsFunctionClarify) {
      directives.push('当前仅支持飞书文档/知识库只读能力；请询问用户要搜索关键词、浏览知识库空间，还是读取指定文档。')
    }
    if (needsUserAuth) {
      directives.push(`明确当前飞书状态：${hint}。给出最短下一步：到“设置 → 连接器”启用飞书并完成 user 授权。`)
    }
    directives.push('语气简短，给用户可选项并等待用户回复。')
    directives.push(`用户原始输入：${String(userPrompt || '').trim()}`)
    return directives.join('\n')
  }

  async function refreshFeishuUsageHint({ rerender = false } = {}) {
    if (!window.api?.connectorsStatus) {
      feishuUsageHint = '当前版本未接入连接器状态'
      if (rerender && !chatHistory.length && !runArtifacts.length) renderChat()
      return
    }
    try {
      const res = await window.api.connectorsStatus('feishu')
      feishuUsageHint = deriveFeishuUsageHint(res?.connector)
    } catch {
      feishuUsageHint = '状态读取失败'
    }
    if (rerender && !chatHistory.length && !runArtifacts.length) renderChat()
  }

  function syncWorkSurface({ autoOpen = true } = {}) {
    if (!workSurface) return
    workSurface.syncArtifacts(runArtifacts, { autoOpen })
  }

  function renderArtifactCard(art, i) {
    const st = art.status || 'draft'
    const isPatch = art.type === 'editor_patch'
    const summary = (window.WorkSurface && window.WorkSurface.summarizeArtifact)
      ? window.WorkSurface.summarizeArtifact(art, 140)
      : String(art.body || '').slice(0, 140)
    const pathMeta = art.targetPath
      ? `<div class="agent-artifact-meta">目标：${escHtml(art.targetPath)}</div>`
      : (isPatch
        ? `<div class="agent-artifact-meta">写入当前打开的文件 · 需确认</div>`
        : '')
    const openBtn = `<button type="button" class="primary-open" data-art-act="open" data-art-id="${escHtml(art.id)}">在右侧打开</button>`
    const actions = st === 'draft'
      ? `<div class="agent-artifact-actions">${openBtn}</div>`
      : `<div class="agent-artifact-actions">
          ${openBtn}
          <span class="agent-artifact-meta" style="align-self:center">${st === 'accepted' ? (isPatch ? '已写入' : '已接受') : '已拒绝'}</span>
        </div>`
    return `<div class="agent-artifact summary ${st}" data-artifact-idx="${i}">
      <div class="agent-artifact-title">${escHtml(art.title || art.type)}</div>
      ${pathMeta}
      <div class="agent-artifact-body">${escHtml(summary)}</div>
      ${actions}
    </div>`
  }

  function dockComposerAfterChat() {
    if (!agentCol || !chatLog || !agentFoot) return
    if (chatLog.nextElementSibling !== agentFoot) {
      chatLog.insertAdjacentElement('afterend', agentFoot)
    }
    agentCol.classList.remove('agent-launch-state')
    // Remeasure after leaving the larger launch state, then apply collab chrome.
    resizeAiInput()
    agentCol.classList.toggle('is-expert-collab', isWorkbenchExpertTaskRoomActive())
  }

  function mountComposerInLaunchState() {
    if (!agentCol || !chatLog || !agentFoot || surfaceMode === 'workbench') return false
    const mount = chatLog.querySelector('[data-agent-composer-mount]')
    if (!mount) return false
    mount.appendChild(agentFoot)
    agentCol.classList.add('agent-launch-state')
    const collab = isWorkbenchExpertTaskRoomActive()
    agentCol.classList.toggle('is-expert-collab', collab)
    if (aiInput) {
      // 专家会话里输入框也要点名对象，否则首屏刚建立的身份感又被通用文案冲掉
      const expert = activeExpertProjection()
      if (collab && expert) {
        aiInput.placeholder = `与「${expert.name}」协作：目标 / 材料 / 约束… @ 选文件`
      } else {
        aiInput.placeholder = expert ? `告诉「${expert.name}」你的目标…` : '给 KnowMe 发送消息…'
      }
    }
    return true
  }

  function renderChat() {
    // The launch state temporarily owns the real Composer. Dock it before
    // replacing chatLog.innerHTML so its event handlers and draft survive.
    dockComposerAfterChat()
    if (chatLog && isChatNearBottom()) chatStickToBottom = true
    const shouldFollow = !chatLog || chatStickToBottom
    const savedScrollTop = chatLog ? chatLog.scrollTop : 0
    const groundingDetailsOpen = (chatLog && window.GroundingUI?.captureGroundingDetailsOpenState)
      ? window.GroundingUI.captureGroundingDetailsOpenState(chatLog)
      : {}
    if (streamPaintRaf) {
      cancelAnimationFrame(streamPaintRaf)
      streamPaintRaf = 0
      streamPaintIdx = null
    }
    lastStreamHtml = ''
    if (!chatHistory.length && !runArtifacts.length) {
      chatLog.innerHTML = renderEmptyState()
      restoreDaemonProcessFeedAfterChatRender()
      mountComposerInLaunchState()
      syncKnowledgeToolbar()
      if (!agentCol?.classList.contains('agent-launch-state')) {
        syncComposerPlaceholder({ force: true })
      }
      if (topicNav) topicNav.innerHTML = ''
      if (window.StickyIcons) window.StickyIcons.mount(chatLog)
      syncConversationAnchorPosition()
      updateContextMeter()
      syncThinkingTicker()
      syncWorkSurface({ autoOpen: false })
      return
    }
    syncComposerPlaceholder({ force: true })
    const artHtml = runArtifacts.map((a, i) => renderArtifactCard(a, i)).join('')
    const userTurns = chatHistory.reduce((count, msg) => count + (msg.role === 'user' ? 1 : 0), 0)
    const metaHtml = userTurns > 0 ? renderConversationMeta() : ''
    const msgHtml = chatHistory.map((m, i) => {
      if (m.role === 'assistant' && !m.streaming) hydrateLegacyAssistantMessage(m)
      if (m.role === 'loading') return `<div class="agent-bubble assistant loading">${escHtml(m.text)}</div>`
      if (m.role === 'error') return `<div class="agent-bubble assistant err">${escHtml(m.text)}</div>`
      if (m.role === 'user') {
        const compactText = compactUserShortcutBubbleText(m.text)
        const attachment = m.attachmentName
          ? `<div class="agent-attachment"><span class="ico" data-icon="file" style="width:14px;height:14px"></span><span class="attachment-name">${escHtml(m.attachmentName)}</span></div>`
          : ''
        return `<div class="agent-bubble user" data-user-msg-idx="${i}">${escHtml(compactText)}${attachment}</div>`
      }
      if (m.role === 'system-note') {
        return `<div class="agent-trail">${escHtml(m.text)}</div>`
      }
      if (m.role === 'daemon-hitl') {
        return renderDaemonHitlBubble(m)
      }
      if (m.role === 'tool') return ''
      const streamCls = m.streaming ? ' streaming' : ''
      const waiting = m.streaming && !String(m.text || '').trim()
      if (waiting) {
        const timelineHtml = renderExecutionTimeline(m)
        const hasExecution = Boolean(timelineHtml)
        const status = hasExecution ? '' : renderThinkingStatus(m)
        return `<div class="agent-bubble assistant streaming thinking${hasExecution ? ' has-execution' : ''}" data-idx="${i}" aria-busy="true">${timelineHtml}<div class="agent-response-body" data-assistant-body="1">${assistantBodyHtml(m, i)}</div>${renderStructuredUiRegion(m, i, m.protocolVersion === 2)}${status}</div>`
      }
      const cursor = m.streaming ? '<span class="stream-cursor">▍</span>' : ''
      const personalization = (!m.streaming && m.text) ? renderPersonalizationMeta(m) : ''
      const groundingMeta = (!m.streaming && m.text) ? renderGroundingStatusMeta(m) : ''
      const workbenchCite = (!m.streaming && m.text) ? renderWorkbenchCitationsMeta(m) : ''
      const actions = (!m.streaming && m.text) ? assistantActionsHtml(i) : ''
      const body = `<div class="agent-response-body" data-assistant-body="1">${assistantBodyHtml(m, i)}</div>${renderStructuredUiRegion(m, i, m.protocolVersion === 2)}`
      const resultCls = isRelatedChatsResult(m) ? ' related-chats-result' : ''
      return `<div class="agent-bubble assistant${streamCls}${resultCls}" data-idx="${i}">${renderExecutionTimeline(m)}${body}${cursor}${workbenchCite}${groundingMeta}${personalization}${actions}</div>`
    }).join('')
    chatLog.innerHTML = `${artHtml}${msgHtml}`
    restoreDaemonProcessFeedAfterChatRender()
    syncKnowledgeToolbar()
    if (window.GroundingUI?.restoreGroundingDetailsOpenState) {
      window.GroundingUI.restoreGroundingDetailsOpenState(chatLog, groundingDetailsOpen)
    }
    if (topicNav) topicNav.innerHTML = metaHtml
    if (window.StickyIcons) window.StickyIcons.mount(chatLog)
    syncConversationAnchorPosition()
    if (shouldFollow) {
      scrollChatToBottomIfNeeded(true)
    } else {
      beginProgrammaticChatScroll()
      chatLog.scrollTop = savedScrollTop
    }
    updateContextMeter()
    syncThinkingTicker()
    syncWorkSurface({ autoOpen: true })
  }

  function scrollChatToBottomIfNeeded(force) {
    if (!chatLog) return
    if (force || chatStickToBottom) {
      beginProgrammaticChatScroll()
      chatLog.scrollTop = chatLog.scrollHeight
      return
    }
    if (isChatNearBottom()) {
      beginProgrammaticChatScroll()
      chatLog.scrollTop = chatLog.scrollHeight
    }
  }

  function estimateTokens(text) {
    return Math.ceil(String(text || '').length / 4)
  }

  function updateContextMeter() {
    if (!aiComposer) return
    const historyText = chatHistory.map(m => m.text || '').join('\n')
    const inputText = aiInput?.value || ''
    const attachmentText = attachedFile?.text || ''
    const tokens = estimateTokens(`${historyText}\n${editorContextText}\n${inputText}\n${attachmentText}`)
    localContextTokens = tokens
    const progress = Math.min(tokens / contextLimitTokens, 1)
    const visualProgress = progress > 0 ? Math.max(progress, 0.04) : 0
    if (aiModelBtn) {
      aiModelBtn.style.setProperty('--model-usage-progress', String(visualProgress))
      aiModelBtn.classList.toggle('usage-safe', progress <= .5)
      aiModelBtn.classList.toggle('usage-warn', progress > .5 && progress <= .85)
      aiModelBtn.classList.toggle('usage-danger', progress > .85)
    }
    aiComposer.removeAttribute('title')
    aiComposer.setAttribute('aria-label', '输入消息')
    renderModelUsage(tokens)
    if (modelMenuOpen) renderModelMenu()
    updateComposerMeta()
  }

  function formatTokenCount(n) {
    const value = Number(n) || 0
    return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
  }

  function formatTokenCountExact(n) {
    const value = Math.max(0, Number(n) || 0)
    return value.toLocaleString('en-US')
  }

  function normalizeModelLabel(value, fallback = '模型') {
    const raw = String(value || '').trim()
    if (!raw) return fallback
    // 兼容历史/异常文案：剔除尾部的 token 占用串（如 "3K/131K"）
    return raw.replace(/\s+\d+(?:\.\d+)?[KMB]?\/\d+(?:\.\d+)?[KMB]?$/i, '').trim() || fallback
  }

  function renderModelUsage() {
    if (!aiModelUsage) return
    const info = lastContextInfo
    const omittedTurns = Math.max(0, Number(info?.omittedTurns) || 0)
    const omittedMessages = Math.max(0, Number(info?.omittedMessages) || 0)
    const compacted = omittedTurns > 0 || omittedMessages > 0
    const compactHint = compacted
      ? `已省略 ${omittedTurns} 轮 / ${omittedMessages} 条消息`
      : ''
    const currentModelLabel = normalizeModelLabel(contextProfile?.label || contextProfile?.model || aiModelLabel?.textContent || '模型')
    aiModelUsage.hidden = !compacted
    aiModelUsage.textContent = compacted ? '已压缩' : ''
    aiModelUsage.title = compacted ? `${compactHint}\n点击查看分区明细` : ''
    aiModelUsage.classList.toggle('compacted', compacted)
    if (aiModelBtn) {
      aiModelBtn.setAttribute('aria-label', `选择模型，当前模型 ${currentModelLabel}`)
      aiModelBtn.title = compacted
        ? `当前模型: ${currentModelLabel}\n${compactHint}`
        : `当前模型: ${currentModelLabel}`
    }
    if (aiModelLabel) aiModelLabel.title = ''
    if (contextPanelOpen) renderContextPanel()
  }

  function buildContextUsageViewModel() {
    const info = lastContextInfo
    const historyTokens = estimateTokens(chatHistory.map(m => m.text || '').join('\n'))
    const used = Math.max(0, Number(info?.usedTokens) || historyTokens)
    const limit = Math.max(1, Number(info?.contextWindow || contextLimitTokens) || 32768)
    const ratio = Math.min(used / limit, 1)
    const barClass = ratio > .85 ? 'danger' : ratio > .5 ? 'warn' : ''
    const sections = Array.isArray(info?.sectionUsage) ? info.sectionUsage : []
    const rows = [
      { key: 'conversation', usedTokens: historyTokens },
      ...sections.filter(item => item && item.key !== 'conversation'),
    ]
    const omittedTurns = Math.max(0, Number(info?.omittedTurns) || 0)
    const omittedMessages = Math.max(0, Number(info?.omittedMessages) || 0)
    const omittedKeys = Array.isArray(info?.sectionOmitted) ? info.sectionOmitted : []
    const rowHtml = rows.length
      ? rows.map(item => {
          const label = SECTION_LABELS[item.key] || item.key
          return `<div class="ctx-row"><span>${escHtml(label)}</span><strong>${escHtml(formatTokenCount(item.usedTokens))}</strong></div>`
        }).join('')
      : '<div class="ctx-empty">发送一轮对话后可查看服务端分区明细</div>'
    const noteParts = []
    if (omittedTurns || omittedMessages) {
      noteParts.push(`按轮压缩：已省略 ${omittedTurns} 轮 / ${omittedMessages} 条消息`)
    }
    if (omittedKeys.length) {
      noteParts.push(`未纳入分区：${omittedKeys.map(key => SECTION_LABELS[key] || key).join('、')}`)
    }
    return {
      used,
      limit,
      ratio,
      barClass,
      rows,
      note: noteParts.join(' · '),
    }
  }

  function renderContextPanel() {
    if (!aiContextPanel) return
    const usage = buildContextUsageViewModel()
    const rowHtml = usage.rows.length
      ? usage.rows.map(item => {
          const label = SECTION_LABELS[item.key] || item.key
          return `<div class="ctx-row"><span>${escHtml(label)}</span><strong>${escHtml(formatTokenCount(item.usedTokens))}</strong></div>`
        }).join('')
      : '<div class="ctx-empty">发送一轮对话后可查看服务端分区明细</div>'
    aiContextPanel.innerHTML = `
      <div class="ctx-head">
        <span class="ctx-title">上下文占用</span>
        <span class="ctx-total">${escHtml(formatTokenCount(usage.used))} / ${escHtml(formatTokenCount(usage.limit))}</span>
      </div>
      <div class="ctx-bar ${usage.barClass}"><i style="width:${Math.max(usage.ratio * 100, usage.ratio > 0 ? 2 : 0)}%"></i></div>
      ${rowHtml}
      ${usage.note ? `<div class="ctx-note">${escHtml(usage.note)}</div>` : ''}
    `
  }

  function toggleContextPanel() {
    if (!aiContextPanel) return
    if (contextPanelOpen) { hideContextPanel(); return }
    hideModelMenu()
    renderContextPanel()
    contextPanelOpen = true
    aiContextPanel.hidden = false
    aiContextPanel.classList.add('show')
  }

  let streamPaintRaf = 0
  let streamPaintIdx = null
  let lastStreamHtml = ''

  function isStreamPending(node) {
    return node?.nodeType === Node.ELEMENT_NODE && node.classList.contains('md-stream-pending')
  }

  /** 逐个子节点比对，只替换变化的块；pending 状态原地复用，避免整块重排闪屏。 */
  function reconcileStreamChildren(container, nextContainer) {
    const olds = Array.from(container.childNodes)
    const nexts = Array.from(nextContainer.childNodes)
    for (let i = 0; i < nexts.length; i++) {
      const next = nexts[i]
      const cur = olds[i]
      if (!cur) { container.appendChild(next); continue }
      if (cur.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
        if (cur.nodeValue !== next.nodeValue) cur.nodeValue = next.nodeValue
        continue
      }
      if (isStreamPending(cur) && isStreamPending(next)) continue
      if (cur.nodeType === Node.ELEMENT_NODE && next.nodeType === Node.ELEMENT_NODE
        && cur.outerHTML === next.outerHTML) continue
      cur.replaceWith(next)
    }
    for (let i = nexts.length; i < olds.length; i++) olds[i].remove()
  }

  /** 首个正文 token 到达：就地把思考气泡升级为正文气泡，避免整页重绘 */
  function upgradeThinkingBubble(bubble, m, html) {
    bubble.classList.remove('thinking', 'has-execution')
    if (isRelatedChatsResult(m)) bubble.classList.add('related-chats-result')
    bubble.querySelector('[data-thinking-status]')?.remove()
    let body = bubble.querySelector('[data-assistant-body="1"]')
    if (!body) {
      body = document.createElement('div')
      body.className = 'agent-response-body'
      body.dataset.assistantBody = '1'
      bubble.appendChild(body)
    }
    const wrap = document.createElement('div')
    wrap.innerHTML = html
    const textNode = wrap.firstElementChild
    if (!textNode) return false
    body.replaceChildren(textNode)
    if (!bubble.querySelector(':scope > .stream-cursor')) {
      const cursor = document.createElement('span')
      cursor.className = 'stream-cursor'
      cursor.textContent = '▍'
      bubble.appendChild(cursor)
    }
    if (window.StickyIcons) window.StickyIcons.mount(bubble)
    return true
  }

  function paintStreamText(idx) {
    const bubble = chatLog.querySelector(`[data-idx="${idx}"]`)
    const m = chatHistory[idx]
    if (!m?.streaming) return
    if (!bubble) { renderChat(); return }
    const textEl = bubble.querySelector('.chat-text')
    const visibleText = assistantDisplayText(m, { preserveStreamingLayout: true })
    if (!textEl || bubble.classList.contains('thinking')) {
      const firstHtml = renderStreamingMarkdown(visibleText)
      if (!textEl && upgradeThinkingBubble(bubble, m, firstHtml)) {
        lastStreamHtml = firstHtml
        scrollChatToBottomIfNeeded(false)
        return
      }
      lastStreamHtml = ''
      renderChat()
      return
    }
    const html = renderStreamingMarkdown(visibleText)
    if (lastStreamHtml === html) {
      scrollChatToBottomIfNeeded(false)
      return
    }
    lastStreamHtml = html
    const wrap = document.createElement('div')
    wrap.innerHTML = html
    const next = wrap.firstElementChild
    if (!next) return
    const nextCls = next.getAttribute('class') || ''
    if (textEl.getAttribute('class') !== nextCls) textEl.setAttribute('class', nextCls)
    reconcileStreamChildren(textEl, next)
    scrollChatToBottomIfNeeded(false)
  }

  function updateStreamText(idx) {
    streamPaintIdx = idx
    if (streamPaintRaf) return
    streamPaintRaf = requestAnimationFrame(() => {
      streamPaintRaf = 0
      const i = streamPaintIdx
      streamPaintIdx = null
      if (i != null) paintStreamText(i)
    })
  }

  async function revealTypewriter(idx, fullText, runId = '') {
    const message = chatHistory[idx]
    if (!message || (runId && message.runId !== runId)) return false
    message.streaming = true
    message.text = ''
    renderChat()
    for (const ch of Array.from(fullText)) {
      const nextMessage = chatHistory[idx]
      if (!nextMessage || (runId && nextMessage.runId !== runId)) return false
      nextMessage.text += ch
      updateStreamText(idx)
      await new Promise(r => setTimeout(r, 12))
    }
    return true
  }

  function reconcileCompletedAssistantBody(current, next) {
    const currentText = current?.querySelector(':scope > .chat-text')
    const nextText = next?.querySelector(':scope > .chat-text')
    if (currentText && nextText) {
      const nextCls = nextText.getAttribute('class') || ''
      if (currentText.getAttribute('class') !== nextCls) currentText.setAttribute('class', nextCls)
      reconcileStreamChildren(currentText, nextText)
      nextText.replaceWith(currentText)
    }
    current.replaceChildren(...Array.from(next.childNodes))
  }

  function syncRunArtifactCards() {
    if (!chatLog) return
    const current = Array.from(chatLog.querySelectorAll(':scope > .agent-artifact.summary'))
    const wrap = document.createElement('div')
    wrap.innerHTML = runArtifacts.map((artifact, index) => renderArtifactCard(artifact, index)).join('')
    const next = Array.from(wrap.children)
    const firstMessage = chatLog.querySelector(':scope > .agent-bubble, :scope > .agent-trail')
    for (let i = 0; i < next.length; i++) {
      if (!current[i]) {
        chatLog.insertBefore(next[i], firstMessage)
      } else if (current[i].outerHTML !== next[i].outerHTML) {
        current[i].replaceWith(next[i])
      }
    }
    for (let i = next.length; i < current.length; i++) current[i].remove()
  }

  /** 将 streaming 气泡原地收尾；不替换 chatLog、历史消息或已显示的正文容器。 */
  function completeAssistantBubble(idx) {
    const message = chatHistory[idx]
    const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
    if (!message || !bubble) {
      renderChat()
      return false
    }
    if (streamPaintRaf && streamPaintIdx === idx) {
      cancelAnimationFrame(streamPaintRaf)
      streamPaintRaf = 0
      streamPaintIdx = null
    }
    lastStreamHtml = ''

    bubble.classList.remove('streaming', 'thinking', 'has-execution')
    bubble.classList.toggle('related-chats-result', isRelatedChatsResult(message))
    bubble.removeAttribute('aria-busy')
    bubble.querySelector('[data-thinking-status]')?.remove()

    const currentTimeline = bubble.querySelector('[data-execution-timeline]')
    const nextTimeline = buildExecutionTimelineNode(message)
    let timeline = currentTimeline
    if (nextTimeline) {
      if (!timeline) {
        bubble.prepend(nextTimeline)
        timeline = nextTimeline
      } else if (!patchExecutionTimeline(timeline, nextTimeline)) {
        timeline.replaceWith(nextTimeline)
        timeline = nextTimeline
      }
      if (hasPendingReview(message)) timeline.setAttribute('open', '')
      else timeline.removeAttribute('open')
    } else {
      timeline?.remove()
    }

    const nextBody = document.createElement('div')
    nextBody.className = 'agent-response-body'
    nextBody.dataset.assistantBody = '1'
    nextBody.innerHTML = assistantBodyHtml(message, idx)
    const currentBody = bubble.querySelector('[data-assistant-body="1"]')
    if (currentBody) {
      reconcileCompletedAssistantBody(currentBody, nextBody)
    } else if (timeline) {
      timeline.after(nextBody)
    } else {
      bubble.prepend(nextBody)
    }
    patchAssistantStructuredUi(bubble, message, idx)

    bubble.querySelector(':scope > .stream-cursor')?.remove()
    bubble.querySelectorAll(':scope > .agent-grounding-meta, :scope > .agent-workbench-citations, :scope > .agent-personalization, :scope > .agent-chat-actions')
      .forEach(node => node.remove())
    if (message.text) {
      bubble.insertAdjacentHTML(
        'beforeend',
        `${renderWorkbenchCitationsMeta(message)}${renderGroundingStatusMeta(message)}${renderPersonalizationMeta(message)}${assistantActionsHtml(idx)}`
      )
    }
    syncRunArtifactCards()
    if (window.StickyIcons) window.StickyIcons.mount(chatLog)
    scrollChatToBottomIfNeeded(false)
    updateContextMeter()
    syncThinkingTicker()
    syncWorkSurface({ autoOpen: true })
    return true
  }

  function setQuickMenuOpen(open) {
    const next = !!open
    aiQuickMenu?.classList.toggle('show', next)
    aiQuickMenu?.setAttribute('aria-hidden', String(!next))
    aiQuickBtn?.setAttribute('aria-expanded', String(next))
  }

  function hideAiMenus() {
    setQuickMenuOpen(false)
    hideKnowledgeMenu()
    hideHeadPops()
  }

  function getAtContext() {
    const val = aiInput.value
    const caret = aiInput.selectionStart ?? val.length
    const before = val.slice(0, caret)
    const m = before.match(/(^|\s)@([^\s@]*)$/)
    if (!m) return null
    return { start: caret - m[2].length - 1, end: caret, query: m[2].toLowerCase() }
  }

  function hideAtMenu() {
    atOpen = false
    atMenu?.classList.remove('show')
    if (atMenu) atMenu.innerHTML = ''
    atExpanded = new Set()
  }

  function fileTitle(note) {
    return String(note?.title || note?.preview || '未命名').trim()
  }

  function fileMatches(note) {
    const q = atQuery
    const title = fileTitle(note)
    const project = String(note?.project || '').trim()
    return !q || `${title} ${project}`.toLowerCase().includes(q)
  }

  function sortedFiles() {
    return getFileCatalog().slice().sort((a, b) => {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    })
  }

  function recentFiles() {
    return sortedFiles().filter(fileMatches).slice(0, 3)
  }

  function fileGroups() {
    const groups = new Map()
    for (const note of sortedFiles()) {
      if (!fileMatches(note)) continue
      const key = String(note.project || '').trim() || '__uncategorized__'
      if (!groups.has(key)) groups.set(key, {
        key,
        label: key === '__uncategorized__' ? '未分类' : key,
        files: [],
      })
      groups.get(key).files.push(note)
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }

  function visibleFiles() {
    const files = [...recentFiles()]
    for (const group of fileGroups()) {
      if (atExpanded.has(group.key)) files.push(...group.files)
    }
    return files
  }

  function renderAtMenu() {
    if (!atMenu || !atOpen) return
    const recent = recentFiles()
    const groups = fileGroups()
    const items = visibleFiles()
    if (!recent.length && !groups.length) {
      atMenu.innerHTML = '<div class="agent-chat-empty" style="padding:10px">没有找到这个文件</div>'
      atMenu.classList.add('show')
      return
    }
    if (atActive >= items.length) atActive = 0
    let itemIndex = 0
    const renderFile = (n) => {
      const index = itemIndex++
      return `<button type="button" class="agent-at-item${index === atActive ? ' active' : ''}" data-idx="${index}">
        <span class="ico" data-icon="file" style="width:15px;height:15px"></span>
        <span class="at-name">${escHtml(fileTitle(n))}</span>
        ${n.project ? `<span class="at-project">${escHtml(n.project)}</span>` : ''}
      </button>`
    }
    const recentHtml = recent.length
      ? `<div class="agent-at-section">
          <div class="agent-at-section-label">最近编辑</div>
          ${recent.map(renderFile).join('')}
        </div>`
      : ''
    const groupsHtml = groups.map((group, groupIndex) => {
      const open = atExpanded.has(group.key)
      return `<div class="agent-at-group">
        <button type="button" class="agent-at-folder${open ? ' open' : ''}" data-group-index="${groupIndex}" aria-expanded="${open ? 'true' : 'false'}">
          <span class="ico at-folder-chevron" data-icon="chevronTree"></span>
          <span class="ico" data-icon="folder" style="width:15px;height:15px"></span>
          <span class="at-name">${escHtml(group.label)}</span>
          <span class="at-project">${group.files.length}</span>
        </button>
        ${open ? `<div class="agent-at-folder-files">${group.files.map(renderFile).join('')}</div>` : ''}
      </div>`
    }).join('')
    atMenu.innerHTML = recentHtml + groupsHtml
    atMenu.classList.add('show')
    if (window.StickyIcons) StickyIcons.mount(atMenu)
    atMenu.querySelectorAll('.agent-at-item').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        pickFile(items[+btn.dataset.idx])
      })
    })
    atMenu.querySelectorAll('.agent-at-folder').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        const key = groups[Number(btn.dataset.groupIndex)]?.key
        if (!key) return
        if (atExpanded.has(key)) atExpanded.delete(key)
        else atExpanded.add(key)
        atActive = 0
        renderAtMenu()
      })
    })
  }

  function updateAtMenu() {
    const ctx = getAtContext()
    if (!ctx) { hideAtMenu(); return }
    setQuickMenuOpen(false)
    atQuery = ctx.query
    atActive = 0
    atOpen = true
    renderAtMenu()
  }

  function pickFile(note) {
    if (!note) return
    const ctx = getAtContext()
    if (!ctx) return
    const title = String(note.title || note.preview || '未命名').trim()
    const before = aiInput.value.slice(0, ctx.start)
    const after = aiInput.value.slice(ctx.end)
    const insert = `@${title} `
    aiInput.value = before + insert + after
    const pos = (before + insert).length
    aiInput.setSelectionRange(pos, pos)
    openReferencedFile(note.id)
    hideAtMenu()
    aiInput.focus()
    aiInput.dispatchEvent(new Event('input'))
  }

  function quickItems() {
    return aiQuickMenu
      ? Array.from(aiQuickMenu.querySelectorAll('[data-quick-command]'))
      : []
  }

  function quickMenuSectionsForAgent(agentId = '') {
    return QUICK_MENU_PROFILES[String(agentId || '').trim()] || QUICK_MENU_PROFILES.general
  }

  function filteredQuickCommands() {
    return skillTaskUi.filterQuickCommands
      ? skillTaskUi.filterQuickCommands(quickCommands, quickQuery)
      : quickCommands.filter(command => {
          const q = String(quickQuery || '').trim().toLowerCase()
          return !q || `${command.label || ''} ${command.description || ''} ${command.groupLabel || ''}`.toLowerCase().includes(q)
        })
  }

  function renderQuickResults() {
    if (!quickItemsHost) return
    const commands = filteredQuickCommands()
    if (quickActive >= commands.length) quickActive = Math.max(0, commands.length - 1)
    quickItemsHost.innerHTML = commands.map((item, index) => `
      <button class="agent-command-item${index === quickActive ? ' active' : ''}" type="button" role="option"
        aria-selected="${index === quickActive ? 'true' : 'false'}" data-quick-command="1"
        data-quick-label="${escHtml(item.label || '快捷操作')}"
        ${item.taskId ? `data-task-id="${escHtml(item.taskId)}"` : ''}
        ${item.prompt ? `data-p="${escHtml(item.prompt)}"` : ''}
        ${item.steward ? `data-steward="${escHtml(item.steward)}"` : ''}>
        <span class="ico" data-icon="${escHtml(item.icon || 'note')}" aria-hidden="true"></span>
        <span class="agent-command-copy">
          <strong>${escHtml(item.label || '快捷操作')}</strong>
          <small>${escHtml(item.description || '立即开始这个任务')}</small>
        </span>
        <span class="agent-command-group">${escHtml(item.groupLabel || '推荐操作')}</span>
      </button>
    `).join('')
    quickEmpty?.classList.toggle('show', commands.length === 0)
    if (quickSummary) {
      quickSummary.textContent = quickQuery
        ? `${commands.length} 项匹配`
        : `${commands.length} 项可用任务`
    }
    if (window.StickyIcons) StickyIcons.mount(aiQuickMenu)
  }

  function renderQuickMenuForAgent(agentId = activeAgentId) {
    if (!quickItemsHost) return
    const sections = skillTaskUi.mergeQuickMenuSections
      ? skillTaskUi.mergeQuickMenuSections(agentId, QUICK_MENU_PROFILES, skillTaskMap, PROMPT_TO_TASK)
      : quickMenuSectionsForAgent(agentId)
    quickCommands = skillTaskUi.flattenQuickMenuSections
      ? skillTaskUi.flattenQuickMenuSections(sections)
      : sections.flatMap(section => (section.items || []).map(item => ({
          ...item,
          description: item.description || item.subtitle || item.task?.subtitle || section.label,
          groupLabel: section.label,
        })))
    renderQuickResults()
  }

  function runQuickAction(btn) {
    if (!btn) return
    const steward = String(btn.dataset.steward || '').trim()
    if (steward) {
      hideAiMenus()
      void runStewardTemplate(steward)
      return
    }
    const prompt = String(btn.dataset.p || '').trim()
    if (!prompt) return
    const label = btn.dataset.quickLabel || btn.querySelector('span:last-child')?.textContent || ''
    const taskId = String(btn.dataset.taskId || '').trim() || PROMPT_TO_TASK.get(prompt)
    if (taskId && (skillTaskMap.has(taskId) || TASK_PREFLIGHT[taskId] || EMPTY_SHORTCUT_PROMPTS[taskId] || QUICK_ACTION_PROMPTS[taskId])) {
      void runTaskCard(taskId, label)
      return
    }
    void runOfficeShortcut(prompt, label)
  }

  function visibleQuickItems() {
    return quickItems()
  }

  function renderQuickActive() {
    const items = visibleQuickItems()
    if (!items.length) return
    if (quickActive < 0) quickActive = items.length - 1
    if (quickActive >= items.length) quickActive = 0
    items.forEach((item, idx) => {
      const selected = idx === quickActive
      item.classList.toggle('active', selected)
      item.setAttribute('aria-selected', String(selected))
    })
    items[quickActive]?.scrollIntoView({ block: 'nearest' })
  }

  function handleQuickMenuKeydown(e) {
    if (!aiQuickMenu?.classList.contains('show')) return false
    const items = visibleQuickItems()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length) quickActive = (quickActive + 1) % items.length
      renderQuickActive()
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length) quickActive = (quickActive - 1 + items.length) % items.length
      renderQuickActive()
      return true
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const active = items[quickActive] || items[0]
      if (active) runQuickAction(active)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      hideAiMenus()
      aiInput?.focus()
      return true
    }
    return false
  }

  function applyQuickPrompt(prompt) {
    const text = String(prompt || '').trim()
    if (!text) return
    aiInput.value = text
    aiInput.dispatchEvent(new Event('input'))
    aiInput.focus()
    hideAiMenus()
  }

  function formatDateYmd(date) {
    const d = date instanceof Date ? date : new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function addDateDays(date, deltaDays) {
    const d = new Date(date.getTime())
    d.setDate(d.getDate() + Number(deltaDays || 0))
    return d
  }

  function isMeetingSummaryShortcut(prompt = '') {
    const src = String(prompt || '')
    if (!src) return false
    if (!/(会议总结|会议纪要|会议记录)/.test(src)) return false
    return /(最近|近|自然日|N天|N\s*天|\d+\s*天|\d+\s*个自然日)/i.test(src)
  }

  function isRelatedChatsShortcut(prompt = '') {
    const src = String(prompt || '')
    if (!src) return false
    return /(分析跟我相关的聊天|跟我相关的聊天)/.test(src)
      || (/(聊天|群聊|私聊|消息)/.test(src) && /(@我|@\s*我|提到我)/.test(src))
  }

  function isTodayPriorityShortcut(prompt = '') {
    const src = String(prompt || '')
    if (!src) return false
    return /(今日优先级|今天优先级|今日优先|feishu\.today_priority)/i.test(src)
      || /(优先级助手)/.test(src)
  }

  function isDocKbShortcut(prompt = '') {
    const src = String(prompt || '')
    if (!src) return false
    if (/(feishu\.doc_kb_suggest|doc_kb_suggest|查文档\/知识库|查文档和知识库)/i.test(src)) return true
    return /(查文档|查询飞书文档|飞书文档或知识库)/.test(src)
      && /(知识库|文件夹|个人记忆|最近.*编辑|最近.*阅读)/.test(src)
  }

  function parseRecentDaysFromPrompt(prompt = '', fallback = 3) {
    const src = String(prompt || '')
    if (/(今天|今日|当天)/.test(src) && !/(最近|近\s*\d|个自然日)/.test(src)) {
      return 1
    }
    const patterns = [
      /最近\s*(\d{1,2})\s*天/i,
      /近\s*(\d{1,2})\s*天/i,
      /(\d{1,2})\s*个自然日/i,
    ]
    let days = Number(fallback) || 7
    for (const p of patterns) {
      const m = src.match(p)
      if (!m) continue
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) {
        days = n
        break
      }
    }
    days = Math.max(1, Math.min(30, Math.floor(days)))
    return days
  }

  function enrichMeetingSummaryShortcutPrompt(prompt = '', now = new Date()) {
    const base = String(prompt || '').trim()
    if (!isMeetingSummaryShortcut(base)) return base
    const daysBack = parseRecentDaysFromPrompt(base, 3)
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = []
    for (let i = daysBack - 1; i >= 0; i--) {
      days.push(formatDateYmd(addDateDays(todayZero, -i)))
    }
    const range = `${days[0]} 至 ${days[days.length - 1]}`
    return `${base}

这是一键任务：一次点击直接产出总结，禁止中途让我回复序号、禁止索要会议链接/token、禁止把「请粘贴链接」当作下一步。

时间范围以点击时刻为准：统计最近 ${daysBack} 个自然日（含今天），即 ${days.join('、')}（范围 ${range}）。
会议范围为“与我相关”的会议：我作为组织者、参会人、被@提及或会后待办责任人的记录。

执行步骤（自动连续完成，不要在中间停下来问我）：
1) 调用 \`feishu.meeting_candidates\`（days=${daysBack}）拉取候选。忽略工具结果里“回复序号”一类的提示——不需要我选择。
2) 若有候选：按时间从近到远，对最多 5 场**自动**逐个调用 \`feishu.meeting_read\` 读取正文，然后直接输出每场的结构化总结：
   ### 会议标题｜时间
   - 议题
   - 结论
   - 待办（责任人、时间点如有）
   - 与我相关 / 风险阻塞 / 建议下一步（各一句）
   超过 5 场时，先总结最近 5 场，末尾一句话说明“还有 N 场，需要继续说一声”。
   某场 \`feishu.meeting_read\` 因权限失败：跳过该场、继续其余场，并在末尾一句话提示可用 \`feishu.draft_minute_permission\` 申请权限；不要为此中断整任务。
3) 若候选为 0：只回一句话，例如“最近 ${daysBack} 天没有找到你在飞书发起/参加、并生成了智能纪要的会议。”，可再附一句可选下一步（换个时间范围或指定会议主题）。不要罗列“可能原因”，不要请求我粘贴链接。
4) 若工具返回接口错误（如 Internal error / 请重试 / 服务器繁忙）：只回一句“飞书接口暂时故障，请稍后再点一次「会议总结」”。严禁把原始报错 JSON、log_id、堆栈粘给我。

禁止编造正文未出现的事实。不要用普通 \`feishu.search_docs\` 替代会议工具。`
  }

  function enrichRelatedChatsShortcutPrompt(prompt = '', now = new Date()) {
    const base = String(prompt || '').trim()
    if (!isRelatedChatsShortcut(base)) return base
    const daysBack = parseRecentDaysFromPrompt(base, 1)
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = []
    for (let i = daysBack - 1; i >= 0; i--) {
      days.push(formatDateYmd(addDateDays(todayZero, -i)))
    }
    const range = `${days[0]} 至 ${days[days.length - 1]}`
    const dayLabel = daysBack === 1 ? '今天（1 个自然日）' : `最近 ${daysBack} 个自然日（含今天）`
    return `${base}

时间范围以点击时刻为准：统计${dayLabel}，即 ${days.join('、')}（范围 ${range}）。
必须先检查飞书 user 授权；未授权时提示我完成授权，不要臆造聊天内容。
必须调用确定性 Workflow 工具 \`feishu.related_chats\`（days=${daysBack}）读取授权用户可见的飞书私聊/群聊主题与 @我 消息。
拿到工具结果后用简洁 Markdown 分区输出，不要写成长段日志或原文 dump：
## 今日相关会话主题（总数）
### 私聊（数量）
- \`私聊\` [会话名](https://applink.feishu.cn/client/chat/open?openChatId=...)
### 群聊 / 话题群（数量）
- \`群聊\` [会话名](https://applink.feishu.cn/client/chat/open?openChatId=...)
## @我 的消息（数量）
### N. [会话名](飞书会话链接)
- 发送人 · 时间
- 主题：一句话提炼（禁止保留 &lt;at&gt;、表情码等原始标记）
- 建议处理：用户该怎么做
- 需要全文时：[在飞书打开原文](链接)（次要动作，非默认必读）
## 待我回应 / 需跟进事项
- 事项
## 建议下一步
- 是否回复、是否拉会对齐
硬性约束：
1. 每个私聊/群聊会话名 MUST 保留为可点击 Markdown 链接（使用工具给出的 openChatId 链接），禁止改成纯文本。
2. 凡涉及读取消息的条目 MUST 先总结主题并给出处理建议，不要粘贴长原文。
3. 只有用户需要核对完整上下文时，才提示点击飞书打开；不要把「打开飞书」当成每条的主操作。
禁止编造未出现在工具结果中的聊天内容；若 0 条请如实说明并给出扩大天数或指定群名的下一步。
禁止走会议文档 / 妙记路径，禁止索要文档链接或 token，禁止调用 feishu.meeting_candidates / feishu.meeting_read / feishu.search_docs 替代本任务。`
  }

  function enrichTodayPriorityShortcutPrompt(prompt = '', now = new Date()) {
    const base = String(prompt || '').trim()
    if (!isTodayPriorityShortcut(base)) return base
    const today = formatDateYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    return `${base}

时间范围以点击时刻为准：仅统计今天（${today}）。
必须先检查飞书 user 授权；未授权时提示我完成授权并补齐 calendar / task scope，不要臆造日程或待办。
必须先调用确定性 Workflow 工具 \`feishu.today_priority\`（可传 include_mentions=true）拉取：今日日程、未完成待办、今日 @我 阻塞信号。
拿到工具结果后**立刻**输出最多 3 件事，不要先问截止时间/影响范围/当前阻塞三项：
## 现在先做这 3 件事
### 1. …
- 优先级理由：（引用工具中的日程/待办/@我）
- 预计耗时：…
- 第一步动作：…
### 2. …
### 3. …
排序优先：已过期待办 > 今日硬截止/会议前必须完成 > 会议准备 > 其余待办。
仅当日程与待办都为空、或关键冲突无法判断时，最多追问 **1** 句（把缺的事实合并成一句）。
特别是当日程与待办都为空时：只能如实说明“当前没有可用的飞书事实”，然后询问用户提供 **1 个真实工作目标**；允许给出最多 3 条**行业占位示例**（须声明仅为示例格式、不是真实任务），禁止把示例写成推荐任务、禁止编造用户真实项目名，禁止输出“选一项”列表、按钮选项或 \`\`\`suggestion JSON\`\`\`。此规则优先于通用的建议/快捷入口规则。
禁止编造未出现在工具结果中的事实；禁止索要文档链接或 token；禁止用会议文档 / 相关聊天 Workflow 替代本任务。`
  }

  function enrichDocKbShortcutPrompt(prompt = '', now = new Date()) {
    const base = String(prompt || '').trim()
    if (!isDocKbShortcut(base)) return base
    const daysBack = parseRecentDaysFromPrompt(base, 30)
    const today = formatDateYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    return `${base}

时间范围以点击时刻为准：近 ${daysBack} 天（含今天 ${today}）用于「最近编辑 / 最近阅读」。
必须先检查飞书 user 授权；未授权时提示我完成授权，不要臆造文件夹或文档。
必须立刻调用确定性 Workflow 工具 \`feishu.doc_kb_suggest\`（days=${daysBack}），汇总：
1) 个人云空间文件夹
2) 可见知识库空间
3) 依据个人记忆可能需要的文件（≤5）
4) 最近自己编辑的文件（≤5）
5) 最近自己阅读的文件（≤5）
拿到工具结果后用简洁 Markdown 分区复述，不要先问关键词/空间/链接。
首轮禁止读取正文、禁止编造未出现的文件名。
用户选定某一文件或给出新关键词后，再用 \`feishu.read_doc\` / \`feishu.search_docs\` / \`feishu.list_wiki_nodes\` 深入。
禁止用会议总结 / 相关聊天 Workflow 替代本任务。`
  }

  function enrichOfficeShortcutPrompt(prompt = '', now = new Date()) {
    const meeting = enrichMeetingSummaryShortcutPrompt(prompt, now)
    if (meeting !== String(prompt || '').trim()) return meeting
    const priority = enrichTodayPriorityShortcutPrompt(prompt, now)
    if (priority !== String(prompt || '').trim()) return priority
    const docKb = enrichDocKbShortcutPrompt(prompt, now)
    if (docKb !== String(prompt || '').trim()) return docKb
    return enrichRelatedChatsShortcutPrompt(prompt, now)
  }

  function extractFeishuSearchCandidatesFromText(text = '') {
    if (window.FeishuMeetingSelection?.extractFeishuSearchCandidatesFromText) {
      return window.FeishuMeetingSelection.extractFeishuSearchCandidatesFromText(text)
    }
    return []
  }

  function getLatestAssistantText() {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const item = chatHistory[i]
      if (item && item.role === 'assistant' && String(item.text || '').trim()) return String(item.text || '')
    }
    return ''
  }

  function getLatestUserText() {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const item = chatHistory[i]
      if (!item || item.role !== 'user') continue
      const sourcePrompt = String(item.sourcePrompt || '').trim()
      if (sourcePrompt) return sourcePrompt
      const text = String(item.text || '').trim()
      if (text) return text
    }
    return ''
  }

  const FEISHU_AUTH_POLL_MS = 3000
  const FEISHU_AUTH_TIMEOUT_MS = 300000

  function unpackFeishuAuthStatus(payload) {
    if (payload && payload.connector && payload.connector.status) return payload.connector.status
    if (payload && payload.status) return payload.status
    if (payload && typeof payload === 'object') return payload
    return {}
  }

  function feishuUserAuthReady(payload) {
    const status = unpackFeishuAuthStatus(payload)
    const state = String(status.state || '').toLowerCase()
    if (state === 'auth_required') return false
    return status.userReady !== false
  }

  function renderFeishuAuthPanel(wrap, html) {
    let panel = wrap.querySelector('.feishu-auth-panel')
    if (!panel) {
      panel = document.createElement('div')
      panel.className = 'feishu-auth-panel'
      wrap.appendChild(panel)
    }
    panel.innerHTML = html
  }

  function normalizeFeishuVerificationUrl(value) {
    let text = String(value || '').trim()
    for (let i = 0; i < 4 && text; i += 1) {
      const quoted =
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith('\'') && text.endsWith('\'')) ||
        (text.startsWith('“') && text.endsWith('”'))
      if (quoted) {
        text = text.slice(1, -1).trim()
        continue
      }
      try {
        const parsed = JSON.parse(text)
        if (typeof parsed === 'string') {
          text = parsed.trim()
          continue
        }
      } catch {
        // keep current text
      }
      break
    }
    text = text
      .replace(/^\\+/, '')
      .replace(/^['"“”]+|['"“”]+$/g, '')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, '\'')
      .replace(/\\+$/, '')
      .trim()
    return text
  }

  function feishuScopeSignature(payload) {
    return String(unpackFeishuAuthStatus(payload).permissions?.signature || '')
  }

  /**
   * `baseline` guards the incremental-grant case: the user is already logged in,
   * so "user identity ready" was true before the button was clicked and cannot
   * prove this round granted anything. Wait for the granted scope set to change.
   */
  async function waitForFeishuAuth(wrap, baseline = null) {
    const deadline = Date.now() + FEISHU_AUTH_TIMEOUT_MS
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, FEISHU_AUTH_POLL_MS))
      let statusPayload = null
      try {
        statusPayload = await window.api.connectorsStatus?.('feishu')
      } catch {
        statusPayload = null
      }
      if (!statusPayload || !feishuUserAuthReady(statusPayload)) continue
      if (!baseline?.alreadyReady) return true
      if (feishuScopeSignature(statusPayload) !== baseline.signature) return true
    }
    renderFeishuAuthPanel(wrap, '<div class="feishu-auth-note">授权等待超时，还没有检测到新增权限。可继续在飞书确认，或再点一次授权按钮重试。</div>')
    return false
  }

  /**
   * Feishu refuses the whole authorization round when one scope name is unknown,
   * so the flow falls back to the curated set. Say which names were left out
   * instead of implying everything was requested.
   */
  function feishuSkippedScopeNote(result) {
    const skipped = [...(result?.droppedScopes || []), ...(result?.skippedScopes || [])]
    if (!skipped.length) return ''
    return `<div class="feishu-auth-note feishu-auth-note-warn">飞书不认识这些权限名，本轮按基础权限申请：${escHtml(skipped.join('、'))}</div>`
  }

  async function runFeishuAuthInChat(wrap, scopes = [], setBusy = () => {}) {
    if (!wrap) return
    const pendingPrompt = getLatestUserText()
    setBusy(true)
    renderFeishuAuthPanel(wrap, '<div class="feishu-auth-note">正在拉起飞书授权…</div>')
    let baseline = null
    try {
      const before = await window.api.connectorsStatus?.('feishu')
      baseline = {
        alreadyReady: !!before && feishuUserAuthReady(before),
        signature: feishuScopeSignature(before),
      }
    } catch {
      baseline = null
    }
    let result = null
    try {
      // Pass the discovered missing scopes so this becomes an incremental grant.
      result = await window.api.connectorsFeishuAuthStart?.(scopes.length ? { scopes } : undefined)
    } catch (error) {
      result = { ok: false, message: String(error?.message || error) }
    }
    if (!result?.ok) {
      setBusy(false)
      const reason = escHtml(String(result?.message || '未能拉起飞书授权'))
      renderFeishuAuthPanel(wrap, `<div class="feishu-auth-note feishu-auth-note-error">拉起授权失败：${reason}</div>`)
      return
    }
    const rawUrl = normalizeFeishuVerificationUrl(result.verificationUrl || '')
    if (rawUrl) {
      const opened = await window.api?.openExternal?.(rawUrl)
      if (!opened?.ok) {
        setBusy(false)
        const reason = escHtml(String(opened?.message || '未能打开浏览器授权页'))
        renderFeishuAuthPanel(wrap, `<div class="feishu-auth-note feishu-auth-note-error">拉起授权失败：${reason}</div>`)
        return
      }
    }
    renderFeishuAuthPanel(
      wrap,
      `<div class="feishu-auth-note">已为你打开飞书授权页，请在飞书中确认授权。完成后我会自动继续这次提问。</div>${feishuSkippedScopeNote(result)}<div class="feishu-auth-qr" hidden aria-hidden="true"></div>`
    )
    const authorized = await waitForFeishuAuth(wrap, baseline)
    setBusy(false)
    if (!authorized) return
    renderFeishuAuthPanel(wrap, '<div class="feishu-auth-note">授权已完成，正在继续这次提问…</div>')
    if (pendingPrompt && !aiSend.disabled) await runAI({ promptText: pendingPrompt })
  }

  async function startFeishuAuthFromChat(btn) {
    const wrap = btn.closest('.feishu-auth-cta-wrap')
    if (!wrap || btn.disabled) return
    const scopes = String(btn.dataset.feishuScopes || '')
      .split(',').map(s => s.trim()).filter(Boolean)
    await runFeishuAuthInChat(wrap, scopes, busy => { btn.disabled = busy })
  }

  function maybeRewriteFeishuCandidateSelection(prompt = '') {
    const selection = window.FeishuMeetingSelection
    if (!selection) return String(prompt || '').trim()
    const assistantText = getLatestAssistantText()
    const permission = selection.rewriteMinutePermissionRequest?.(prompt, assistantText)
    if (permission && permission !== String(prompt || '').trim()) return permission
    if (selection.rewriteFeishuCandidateSelection) {
      return selection.rewriteFeishuCandidateSelection(prompt, assistantText)
    }
    return String(prompt || '').trim()
  }

  function buildShortcutExecutionPolicy(label = '') {
    const actionLabel = String(label || '当前快捷操作').trim() || '当前快捷操作'
    return [
      `【快捷操作执行规则｜${actionLabel}】`,
      '',
      '1) 能直接执行就直接执行',
      '   - 如果信息充分且工具可用：立即调用工具并给出结果。',
      '   - 不要先问泛化问题。',
      '',
      '2) 缺信息就快速告知',
      '   - 仅在“无法继续执行”时提问。',
      '   - 一次最多列 1-3 条必需信息，并给最短示例，便于我直接补齐。',
      '',
      '3) 需要我做选择时，必须输出结构化选择',
      '   - 不要让我手打序号或自由描述。',
      '',
      '当需要用户选择时，使用下面格式输出（严格 JSON，动作仅用 fill / send / open_link / copy 之一）：',
      '```suggestion',
      '{',
      '  "title": "请选择下一步",',
      '  "items": [',
      '    {',
      '      "label": "选项A",',
      '      "description": "一句话说明差异",',
      '      "action": "fill",',
      '      "payload": "我选择A，请继续执行"',
      '    },',
      '    {',
      '      "label": "选项B",',
      '      "description": "一句话说明差异",',
      '      "action": "fill",',
      '      "payload": "我选择B，请继续执行"',
      '    }',
      '  ]',
      '}',
      '```',
      '',
      '当缺信息时，使用这个简洁模板：',
      '补充后即可继续：',
      '- 必需信息1（示例：...）',
      '- 必需信息2（示例：...）',
      '',
      '除上述两种情况外，不要额外追问，直接推进。',
    ].join('\n')
  }

  async function buildShortcutIntentPrompt(prompt, label = '') {
    const base = enrichOfficeShortcutPrompt(String(prompt || '').trim())
    if (!base) return ''
    const parts = [base, buildShortcutExecutionPolicy(label)]
    try {
      const pack = await window.api?.memoryInsights?.({
        workContext: { label, topic: String(label || prompt).slice(0, 40) },
      })
      // 与普通对话共用 Effective Personalization，避免另拼一套 collaborationPrompt
      const promptBlock = pack?.effectivePersonalization?.promptBlock
        || pack?.insights?.collaborationPrompt
      if (promptBlock) parts.push(promptBlock)
    } catch { /* best-effort */ }
    return parts.join('\n\n')
  }

  function mergeShortcutPromptWithComposer(prompt = '', draft = '') {
    const shortcut = String(prompt || '').trim()
    const material = String(draft || '').trim()
    if (!material) return shortcut
    if (!shortcut) return material
    if (shortcut.includes(material)) return shortcut
    return [
      shortcut,
      '',
      '以下是我当前提供的材料或链接，请直接基于它继续：',
      '"""',
      material,
      '"""',
    ].join('\n')
  }

  function quickItemLabelFromPrompt(prompt = '') {
    const mapping = new Map([
      ['会议总结', '为我总结最近三天的会议'],
      ['今日优先级', '基于飞书日程/待办给出今日 Top3'],
      ['查文档/知识库', '查文档/知识库'],
      ['相关的聊天', '分析今天跟我相关的聊天'],
      ['文档读写流程', '文档读写'],
      ['知识体系流程', '知识库检索'],
      ['meeting_candidates', '会议记录'],
      ['会议体系', '会议记录'],
      ['会议记录联动', '会议记录'],
      ['妙记', '妙记待办'],
      ['协同沟通助手', '飞书沟通'],
      ['日程与任务', '日程任务'],
      ['智能约会', '智能约会'],
      ['邮件分拣', '邮件分拣'],
      ['审批待办', '审批待办'],
      ['OKR', 'OKR推进'],
      ['组织协同场景', '组织协同'],
      ['需求文档搭档', '写需求文档'],
      ['需求文档初稿', '写需求文档'],
      ['办公文档搭档', '写办公文档'],
      ['提纲和要点扩写', '按提纲成稿'],
      ['提纲成稿', '按提纲成稿'],
      ['排版定稿', '排版定稿'],
      ['去 AI 味', '润色去 AI 味'],
      ['去AI味', '润色去 AI 味'],
    ])
    const src = String(prompt || '')
    for (const [key, label] of mapping.entries()) {
      if (src.includes(key)) return label
    }
    return '快捷操作'
  }

  function compactShortcutDisplayPrompt(label = '', prompt = '') {
    const normalizedLabel = String(label || '').replace(/\s+/g, ' ').trim()
    const normalizedPrompt = String(prompt || '').replace(/\s+/g, ' ').trim()
    const leakedInstruction = /快捷操作执行规则|```suggestion|feishu\.[a-z_]+/i
    let concise = normalizedLabel
    if (!concise || leakedInstruction.test(concise) || concise.length > 80) {
      concise = quickItemLabelFromPrompt(normalizedPrompt)
    }
    if (!concise) concise = '快捷操作'
    if (concise.length > 48) concise = `${concise.slice(0, 44)}…`
    return concise
  }

  function getActionDispatcher() {
    if (actionDispatcher) return actionDispatcher
    const create = window.AgentAction?.createActionDispatcher
    if (typeof create !== 'function') return null
    actionDispatcher = create({
      send: async item => {
        hideAiMenus()
        if (aiSend?.disabled) {
          const error = new Error('当前助手正在生成，请稍候')
          error.code = 'busy'
          throw error
        }
        if (!String(item.payload || '').trim()) {
          const error = new Error('建议动作缺少可发送内容')
          error.code = 'missing_payload'
          throw error
        }
        await runAI({
          promptText: item.payload,
          displayPrompt: item.label,
        })
        return { kind: 'conversation', execution: 'send' }
      },
      fill: item => {
        if (!aiInput) throw new Error('输入框不可用')
        const needsInput = item.requiresInput || item.legacyAction === 'fill'
        pendingSuggestionPayload = needsInput ? item.payload || null : null
        aiInput.value = needsInput ? '' : item.payload
        aiInput.dispatchEvent(new Event('input'))
        aiInput.focus()
        updateComposerMeta()
        toastFn(needsInput
          ? '已选择建议，请补充内容后发送'
          : '已填入下一步建议，可直接编辑后发送')
        return { kind: 'conversation', execution: 'fill', needsInput }
      },
      copy: item => {
        window.api.copyToClipboard(item.payload)
        toastFn('已复制')
        return { kind: 'clipboard', execution: 'copy' }
      },
      open: async item => {
        const legacyAction = item.legacyAction || ''
        const target = window.AgentSuggestion?.resolveOpenTarget?.(legacyAction, item.payload)
          || { kind: legacyAction === 'open_knowledge' ? 'knowledge' : 'invalid', url: '' }
        if (target.kind === 'link') {
          const label = item.label
          const parsed = window.FeishuLink?.parseOpenLink?.(target.url)
          await handleFeishuLinkAction(parsed?.isFeishu ? 'external' : 'smart', target.url, label)
          return { kind: 'navigation', target: target.url }
        }
        if (target.kind === 'invalid') {
          const error = new Error('该建议没有可打开的链接')
          error.code = 'invalid_target'
          throw error
        }
        if (isWorkflowReturnChoice({ textContent: item.context?.buttonText }, item.payload)) {
          toastFn('请在右侧流程面板继续操作')
          return { kind: 'workflow-panel' }
        }
        openKnowledgePanel?.()
        return { kind: 'knowledge', execution: 'open' }
      },
      invoke: async item => {
        if (!String(item.payload || '').trim()) {
          const error = new Error('能力动作缺少可执行指令')
          error.code = 'missing_payload'
          throw error
        }
        await runAI({
          promptText: item.payload,
          displayPrompt: item.label,
        })
        return { kind: item.kind, execution: 'invoke' }
      },
      confirm: async item => {
        await runAI({
          promptText: `请先确认是否执行「${item.label}」。如果确认，请说明将要执行的具体范围、目标和影响。`,
          displayPrompt: `确认：${item.label}`,
        })
        return { requiresApproval: true }
      },
    })
    return actionDispatcher
  }

  async function dispatchAgentAction(input, context = {}) {
    const dispatcher = getActionDispatcher()
    if (!dispatcher) {
      toastFn('建议动作暂不可用，请刷新后再试', 'error')
      return { ok: false, status: 'error', code: 'dispatcher_unavailable' }
    }
    const result = await dispatcher.dispatch(input, { context })
    if (!result.ok && result.status !== 'duplicate') {
      toastFn(result.message || '建议动作执行失败', 'error')
    }
    return result
  }

  // 是否已有可用素材（输入框文本或已选文件）
  function shortcutHasMaterial() {
    return !!String(aiInput?.value || '').trim() || !!attachedFile
  }

  // 确定性判断任务能否直接执行；缺内容返回 { ok:false, reason }
  async function taskContextReady(spec) {
    if (!spec || !spec.need) return { ok: true }
    if (spec.need === 'material') {
      return { ok: shortcutHasMaterial(), reason: 'material' }
    }
    if (spec.need === 'feishuAuth' || (spec.need === 'connectorAuth' && spec.connector === 'feishu')) {
      const connector = await readFeishuConnector()
      const status = connector?.status || {}
      const state = String(status.state || '').toLowerCase()
      const ready = !!connector?.enabled && state !== 'auth_required' && status.userReady !== false
      return { ok: ready, reason: 'feishuAuth' }
    }
    // 其它 connector 暂无 Renderer 侧 readiness API；依赖 main 侧 connector 策略
    return { ok: true }
  }

  // 缺内容时：推一句话询问（不调用 LLM），并按需暂存任务，等用户补齐后自动执行
  function askForTaskContent(spec, prompt, label, taskMeta = null) {
    const isMaterial = spec?.reason === 'material' || spec?.need === 'material'
    if (isMaterial) {
      pendingShortcut = {
        prompt: String(prompt || '').trim(),
        label: String(label || '').trim(),
        taskId: taskMeta?.taskId || '',
        skillRefs: Array.isArray(taskMeta?.skillRefs) ? [...taskMeta.skillRefs] : [],
        dynamic: !!taskMeta?.dynamic,
      }
    } else {
      pendingShortcut = null
    }
    chatHistory.push({ role: 'system-note', text: String(spec?.ask || spec?.message || '请补充需要的内容后再试。') })
    renderChat()
    try { aiInput?.focus() } catch { /* noop */ }
  }

  async function runDynamicTask(task, label = '') {
    const prompt = skillTaskUi.buildDynamicTaskPrompt
      ? skillTaskUi.buildDynamicTaskPrompt(task)
      : String(task?.prompt || '').trim()
    if (!prompt) return
    const displayPrompt = compactShortcutDisplayPrompt(label || task.title || '', prompt)
    const skillRefs = skillTaskUi.resolveTaskSkillRefs
      ? skillTaskUi.resolveTaskSkillRefs(task)
      : (task.skillId ? [String(task.skillId).trim()] : [])
    // requiredTools 可用性由 main Skill grounding / Registry 阻断；Renderer 不假定成功
    await runAI({ promptText: prompt, displayPrompt, skillRefs, taskId: task.id })
  }

  // 任务卡片统一入口：先查 dynamic map，再 preflight，齐备则走动态或 legacy 执行路径
  async function runTaskCard(taskId, label = '') {
    hideAiMenus()
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    const dynamicTask = skillTaskMap.get(taskId)
    const useDynamic = dynamicTask
      && skillTaskUi.canActivateDynamicTask
      && skillTaskUi.canActivateDynamicTask(dynamicTask)

    if (useDynamic) {
      const spec = skillTaskUi.resolveTaskPreflight
        ? skillTaskUi.resolveTaskPreflight(dynamicTask, taskId, TASK_PREFLIGHT)
        : TASK_PREFLIGHT[taskId]
      if (spec) {
        const ready = await taskContextReady(spec)
        if (!ready.ok) {
          askForTaskContent(
            { ...spec, reason: ready.reason },
            skillTaskUi.buildDynamicTaskPrompt ? skillTaskUi.buildDynamicTaskPrompt(dynamicTask) : dynamicTask.prompt,
            label || dynamicTask.title || taskId,
            {
              taskId,
              skillRefs: skillTaskUi.resolveTaskSkillRefs ? skillTaskUi.resolveTaskSkillRefs(dynamicTask) : [],
              dynamic: true,
            },
          )
          return
        }
      }
      await runDynamicTask(dynamicTask, label || dynamicTask.title || taskId)
      return
    }

    const prompt = String(EMPTY_SHORTCUT_PROMPTS[taskId] || QUICK_ACTION_PROMPTS[taskId] || dynamicTask?.prompt || '').trim()
    if (!prompt) return
    const spec = TASK_PREFLIGHT[taskId]
    if (spec) {
      const ready = await taskContextReady(spec)
      if (!ready.ok) {
        askForTaskContent({ ...spec, reason: ready.reason }, prompt, label, { taskId, dynamic: false })
        return
      }
    }
    await runOfficeShortcut(prompt, label)
  }

  // 卡片/快捷菜单是用户显式点击的确定性发送，直接走 runAI；不经建议动作的 send→fill 改判
  // （执行策略文本里含【…】与 suggestion 示例槽位，会被 hasUserInputSlot 误判为需补填）
  async function runOfficeShortcut(prompt, label = '') {
    hideAiMenus()
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    const text = await buildShortcutIntentPrompt(prompt, label)
    if (!text) return
    const displayPrompt = compactShortcutDisplayPrompt(label, prompt)
    await runAI({ promptText: text, displayPrompt })
  }

  async function runQuickStarter(prompt, label = '') {
    hideAiMenus()
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    const text = String(prompt || '').trim()
    if (!text) return
    const displayPrompt = compactShortcutDisplayPrompt(label, prompt)
    await runAI({ promptText: text, displayPrompt })
  }

  function clearAttachment() {
    attachedFile = null
    if (aiFileInput) aiFileInput.value = ''
    if (aiAttachment) aiAttachment.hidden = true
    if (aiAttachmentName) aiAttachmentName.textContent = ''
    aiAttach?.classList.remove('has-attachment')
    if (aiAttach) aiAttach.title = '添加文件'
    updateContextMeter()
  }

  function setAttachment(file, text) {
    const name = String(file?.name || '').trim() || '未命名文件'
    attachedFile = { name, text }
    if (aiAttachmentName) aiAttachmentName.textContent = name
    if (aiAttachment) aiAttachment.hidden = false
    aiAttach?.classList.add('has-attachment')
    if (aiAttach) aiAttach.title = `已选择：${name}（点击重新选择）`
    if (window.StickyIcons && aiAttachment) window.StickyIcons.mount(aiAttachment)
    updateContextMeter()
  }

  function showQuickMenu() {
    if (!aiQuickMenu) return
    quickQuery = ''
    quickActive = 0
    if (quickSearchInput) quickSearchInput.value = ''
    renderQuickMenuForAgent(activeAgentId)
    setQuickMenuOpen(true)
    renderQuickActive()
    requestAnimationFrame(() => quickSearchInput?.focus())
  }

  async function ensureExpertCatalog() {
    const expertApi = window.knowme?.expert?.list || window.api?.expertList
    if (!expertApi) return catalogExperts
    try {
      const r = await expertApi()
      catalogExperts = r?.experts || r?.items || []
    } catch { catalogExperts = [] }
    return catalogExperts
  }

  async function ensureSkillCatalog() {
    const skillApi = window.knowme?.skill?.list || window.api?.skillList
    if (skillApi) {
      try {
        const r = await skillApi()
        const items = r?.skills || r?.items || []
        skillCatalog = r?.ok !== false ? items : []
        if (skillCatalog.length) return skillCatalog
      } catch { /* fallback below */ }
    }
    if (!window.api?.listSkills) return []
    try {
      const r = await window.api.listSkills()
      skillCatalog = r.ok ? (r.skills || []) : []
    } catch { skillCatalog = [] }
    return skillCatalog
  }

  async function ensureKnowledgeCatalog({ force = false, rerender = false } = {}) {
    if (!force && knowledgeCatalogState === 'ready') return knowledgeProviders
    if (!window.api?.knowledgeProviderList) {
      knowledgeCatalogState = 'error'
      return []
    }
    knowledgeCatalogState = 'loading'
    if (rerender && !chatHistory.length) renderChat()
    try {
      const result = await window.api.knowledgeProviderList()
      if (result?.ok === false) throw new Error(result.error || '知识库读取失败')
      knowledgeProviders = Array.isArray(result?.providers)
        ? result.providers.filter(item => item && item.id)
        : []
      activeKnowledgeProviderId = String(result?.activeProviderId || '')
      knowledgeCatalogState = 'ready'
    } catch {
      knowledgeProviders = []
      activeKnowledgeProviderId = ''
      knowledgeCatalogState = 'error'
    }
    if (rerender && !chatHistory.length) renderChat()
    return knowledgeProviders
  }

  function sessionKnowledgeRefs() {
    const refs = activeSession?.knowledgeRefs
      || activeSession?.knowledgeScope?.refs
      || activeSession?.knowledge?.refs
      || []
    return Array.isArray(refs)
      ? [...new Set(refs.map(item => String(item?.id || item?.providerId || item || '').trim()).filter(Boolean))]
      : []
  }

  async function updateSessionKnowledgeRefs(nextRefs) {
    if (!activeSession?.id || knowledgeUpdatePending) return false
    const refs = [...new Set((Array.isArray(nextRefs) ? nextRefs : [])
      .map(item => String(item || '').trim())
      .filter(Boolean))]
    const api = window.api?.agentSessionContextUpdate
    if (typeof api !== 'function') {
      toastFn('知识库范围暂不可调整', 'error')
      return false
    }
    knowledgeUpdatePending = true
    renderChat()
    try {
      const result = await api(activeSession.id, { knowledgeRefs: refs })
      if (!result?.ok || !result.session) throw new Error(result?.error || '知识库更新失败')
      activeSession = { ...activeSession, ...result.session }
      sessions = sessions.map(item => item.id === activeSession.id
        ? { ...item, knowledgeRefs: refs, updatedAt: activeSession.updatedAt || item.updatedAt }
        : item)
      window.Workbench?.updateExpertTaskRoom?.(activeSession)
      toastFn(refs.length ? `本次对话已限定 ${refs.length} 个知识库` : '已恢复跟随默认知识库')
      return true
    } catch (error) {
      toastFn(error?.message || '知识库更新失败', 'error')
      return false
    } finally {
      knowledgeUpdatePending = false
      renderChat()
    }
  }

  async function handleKnowledgeControl(target) {
    if (!target?.closest) return false
    if (target.closest('[data-knowledge-retry]')) {
      await ensureKnowledgeCatalog({ force: true, rerender: true })
      renderKnowledgeToolbarMenu()
      return true
    }
    if (target.closest('[data-knowledge-default]')) {
      await updateSessionKnowledgeRefs([])
      return true
    }
    const providerButton = target.closest('[data-knowledge-provider]')
    if (!providerButton) return false
    const providerId = String(providerButton.dataset.knowledgeProvider || '').trim()
    if (!providerId) return true
    const selected = new Set(sessionKnowledgeRefs())
    if (selected.has(providerId)) selected.delete(providerId)
    else selected.add(providerId)
    await updateSessionKnowledgeRefs([...selected])
    return true
  }

  function getSlashContext() {
    const val = aiInput.value
    const caret = aiInput.selectionStart ?? val.length
    const before = val.slice(0, caret)
    const m = before.match(/(^|\s)\/([a-zA-Z0-9\-]*)$/)
    if (!m) return null
    return { start: caret - m[2].length - 1, end: caret, query: m[2].toLowerCase() }
  }

  function hideSlashMenu() {
    slashOpen = false
    slashMenu.classList.remove('show')
    slashMenu.innerHTML = ''
  }

  function filteredSkills() {
    const q = slashQuery
    return skillCatalog.filter(s => {
      const hay = `${s.slash} ${s.title} ${s.description || ''}`.toLowerCase()
      return !q || hay.includes(q)
    }).slice(0, 8)
  }

  function renderSlashMenu() {
    const items = filteredSkills()
    if (!slashOpen) return
    if (!skillCatalog.length) {
      slashMenu.innerHTML = '<div class="agent-chat-empty" style="padding:10px">暂无可用技能。可在设置 → 知识库管理概念后使用 / 引用。</div>'
      slashMenu.classList.add('show')
      return
    }
    if (!items.length) {
      slashMenu.innerHTML = `<div class="agent-chat-empty" style="padding:10px">没有匹配「/${slashQuery}」的片段</div>`
      slashMenu.classList.add('show')
      return
    }
    if (slashActive >= items.length) slashActive = 0
    slashMenu.innerHTML = items.map((s, i) =>
      `<button type="button" class="agent-slash-item${i === slashActive ? ' active' : ''}" data-idx="${i}">
        <span class="slash-cmd">/${escHtml(s.slash)}</span><span class="slash-title">${escHtml(s.title || s.id)}</span>
      </button>`).join('')
    slashMenu.classList.add('show')
    slashMenu.querySelectorAll('.agent-slash-item').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault()
        pickSlashSkill(items[+btn.dataset.idx])
      })
    })
  }

  async function updateSlashMenu() {
    const ctx = getSlashContext()
    if (!ctx) { hideSlashMenu(); return }
    setQuickMenuOpen(false)
    slashQuery = ctx.query
    slashOpen = true
    await ensureSkillCatalog()
    renderSlashMenu()
  }

  function pickSlashSkill(skill) {
    if (!skill) return
    const ctx = getSlashContext()
    if (!ctx) return
    const before = aiInput.value.slice(0, ctx.start)
    const after = aiInput.value.slice(ctx.end)
    const insert = `/${skill.slash} `
    aiInput.value = before + insert + after
    const pos = (before + insert).length
    aiInput.setSelectionRange(pos, pos)
    hideSlashMenu()
    aiInput.focus()
    aiInput.dispatchEvent(new Event('input'))
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
      summary: event.summary ? String(event.summary) : '',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      draftId: event.draftId,
      draftStatus: event.draftStatus,
      requiresApproval: Boolean(event.requiresApproval),
      artifactRefs: Array.isArray(event.artifactRefs) ? event.artifactRefs.slice(0, 8) : undefined,
      round: Number.isFinite(event.round) ? event.round : undefined,
      durationMs: Number.isFinite(event.durationMs) ? event.durationMs : undefined,
      sources: Array.isArray(event.sources)
        ? event.sources.slice(0, 8).map(source => ({
            title: String(source?.title || '').slice(0, 120),
            path: String(source?.path || '').slice(0, 260),
            snippet: String(source?.snippet || '').slice(0, 280),
          }))
        : undefined,
    }
    if (index >= 0) trace[index] = { ...trace[index], ...next }
    else trace.push(next)
    message.trace = trace.slice(-40)
  }

  let pendingBindRef = ''

  async function runAI(options = {}) {
    if (activeRunId) {
      await window.api.aiCancelRun?.(activeRunId)
      return
    }
    const bindRef = String(options?.bindRef || pendingBindRef || '').trim()
    pendingBindRef = ''
    let promptText = String(options?.promptText || '').trim()
    let displayPromptOpt = String(options?.displayPrompt || '')
    let explicitSkillRefs = Array.isArray(options?.skillRefs) ? [...options.skillRefs] : []
    let explicitTaskId = String(options?.taskId || '').trim()
    // 手动发送时若存在暂存的快捷任务且已补齐素材，则自动带上该任务指令继续
    if (!promptText) {
      if (pendingShortcut && String(aiInput?.value || '').trim()) {
        promptText = pendingShortcut.prompt
        displayPromptOpt = pendingShortcut.label
        if (!explicitSkillRefs.length && Array.isArray(pendingShortcut.skillRefs)) {
          explicitSkillRefs = [...pendingShortcut.skillRefs]
        }
        if (!explicitTaskId) explicitTaskId = String(pendingShortcut.taskId || '').trim()
        pendingShortcut = null
      } else {
        pendingShortcut = null
      }
    }
    const isShortcutRun = !!promptText
    const composerDraft = String(aiInput?.value || '').trim()
    const rawPrompt = isShortcutRun
      ? mergeShortcutPromptWithComposer(promptText, composerDraft)
      : composerDraft
    let prompt = rawPrompt
    if (!prompt) return

    // Daemon 澄清：仅在有明确问题且内容不是「元问题」时自动提交；否则走助手说明
    if (
      !isShortcutRun
      && surfaceMode === 'workbench'
      && workbenchTaskContext
      && String(workbenchTaskContext.waitingKind || '') === 'clarification'
      && String(workbenchTaskContext.runMode || '') === 'daemon'
    ) {
      const briefApi = window.WorkbenchTaskBrief
      const shouldSubmit = briefApi?.shouldAutoSubmitDaemonClarification
        ? briefApi.shouldAutoSubmitDaemonClarification(prompt, workbenchTaskContext.clarification || {})
        : false
      if (shouldSubmit) {
        chatHistory.push({ role: 'user', text: prompt })
        aiInput.value = ''
        clearAttachment()
        resizeAiInput()
        if (slashOpen) hideSlashMenu()
        if (atOpen) hideAtMenu()
        renderChat()
        const clarifyRes = await submitDaemonClarificationAnswer(prompt)
        if (!clarifyRes.ok) {
          chatHistory.push({ role: 'error', text: clarifyRes.error || '提交回答失败' })
          renderChat()
          toastFn(clarifyRes.error || '提交回答失败', 'error')
          return
        }
        chatHistory.push({ role: 'system-note', text: '已提交澄清回答，任务继续执行' })
        renderChat()
        syncComposerPlaceholder({ force: true })
        updateComposerMeta()
        toastFn('已提交回答', 'success')
        return
      }
      if (briefApi?.looksLikeClarificationMetaQuestion?.(prompt)) {
        toastFn('这像是在询问要填什么，先由助手说明；确认答案后点卡片「提交澄清」', 'info')
      }
      // fall through → 普通对话，让助手解释要补充什么
    }

    if (!isShortcutRun && pendingSuggestionPayload) {
      const merge = (window.AgentSuggestion && typeof window.AgentSuggestion.applyUserInputToPayload === 'function')
        ? window.AgentSuggestion.applyUserInputToPayload
        : (tpl, user) => user
      prompt = merge(pendingSuggestionPayload, prompt) || prompt
      pendingSuggestionPayload = null
    }
    if (!isShortcutRun) {
      prompt = maybeRewriteFeishuCandidateSelection(prompt)
    }
    prompt = await maybeAugmentFeishuPrompt(prompt)

    const attachment = attachedFile
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const runSessionId = String(activeSession?.id || '').trim()
    activeRunId = runId
    runPermissionPrompted = new Set()
    setPresenceState('thinking')
    const shortcutDisplayPrompt = isShortcutRun
      ? compactShortcutDisplayPrompt(String(displayPromptOpt || ''), rawPrompt)
      : ''
    chatHistory.push({
      role: 'user',
      text: isShortcutRun ? shortcutDisplayPrompt : rawPrompt,
      // Keep the raw ask for reliable auth-resume reruns.
      sourcePrompt: rawPrompt,
      attachmentName: attachment?.name || '',
    })
    chatHistory.push({
      role: 'assistant',
      text: '',
      streaming: true,
      runId,
      protocolVersion: 2,
      messageState: window.AgentMessageState?.createMessageState(runId) || null,
      v2AnswerCommitted: false,
      activity: '正在准备上下文…',
      startedAt: Date.now(),
      elapsedMs: 0,
      trace: [],
    })
    const assistantIdx = chatHistory.length - 1
    if (runSessionId) inflightChatBySession.set(runSessionId, chatHistory)
    chatStickToBottom = true
    renderChat()
    pinChatToBottom()
    setSendButtonMode('running')
    updateComposerMeta()
    aiInput.value = ''
    clearAttachment()
    resizeAiInput()
    if (slashOpen) hideSlashMenu()
    if (atOpen) hideAtMenu()

    const ctx = await getEditorContext()
    if (!ctx.ok && ctx.error) {
      const history = (runSessionId && inflightChatBySession.get(runSessionId)) || chatHistory
      if (history[assistantIdx]?.runId === runId) history.splice(assistantIdx, 1)
      history.push({ role: 'error', text: ctx.error })
      if (history === chatHistory) renderChat()
      setPresenceState('error')
      if (activeRunId === runId) activeRunId = ''
      if (runSessionId) inflightChatBySession.delete(runSessionId)
      setSendButtonMode('send')
      updateComposerMeta()
      return
    }
    hasActiveEditor = !!(ctx && ctx.noteId)
    editorContextText = ctx.content || ''
    updateContextMeter()
    const displayPrompt = isShortcutRun ? shortcutDisplayPrompt : ''
    const contentGrounding = groundingApi().buildGrounding({
      prompt,
      displayPrompt,
      context: ctx.content || '',
      task: surfaceMode === 'workbench' ? workbenchTaskContext : null,
      attachment: attachment?.text || '',
    })

    let gotNonEmptyStream = false
    const resolveAssistantRef = () => {
      const histories = [chatHistory]
      for (const hist of inflightChatBySession.values()) {
        if (hist !== chatHistory) histories.push(hist)
      }
      for (const history of histories) {
        for (let i = history.length - 1; i >= 0; i--) {
          const message = history[i]
          if (message?.role === 'assistant' && message.runId === runId) {
            return { idx: i, message, history }
          }
        }
      }
      return null
    }
    const paintAssistantIfOnScreen = (assistantRef) => {
      if (!assistantRef) return false
      if (assistantRef.history !== chatHistory) return false
      if (completeAssistantBubble(assistantRef.idx)) return true
      renderChat()
      return true
    }
    const offEvent = window.api.onAiStreamEvent
      ? window.api.onAiStreamEvent(event => {
          if (!event || event.runId !== runId) return
          if (event.version == null) return
          const assistantRef = resolveAssistantRef()
          if (!assistantRef) return
          const { idx: messageIdx, message } = assistantRef
          if (event.payload?.contextInfo && typeof event.payload.contextInfo === 'object') {
            lastContextInfo = event.payload.contextInfo
            renderModelUsage()
          }
          if (applyV2StreamEvent(event, messageIdx, message)) {
            if (message.v2AnswerCommitted) gotNonEmptyStream = true
            if (Number.isFinite(message.startedAt)) {
              message.elapsedMs = Math.max(0, Date.now() - message.startedAt)
            }
            updateComposerMeta()
          }
        })
      : () => {}
    const priorHistory = ((runSessionId && inflightChatBySession.get(runSessionId)) || chatHistory)
      .slice(0, -2)
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.text && !m.streaming)
      .map(m => ({ role: m.role, text: m.text }))
    const skillRefs = skillTaskUi.mergeSkillRefs
      ? skillTaskUi.mergeSkillRefs(explicitSkillRefs, prompt)
      : [...new Set([
        ...explicitSkillRefs.map(r => String(r || '').trim().toLowerCase()).filter(Boolean),
        ...[...prompt.matchAll(/(^|\s)\/([a-z0-9][a-z0-9\-]{0,31})\b/gi)].map(m => m[2].toLowerCase()),
      ])]

    try {
      const attachedContext = attachment
        ? `\n\n[用户附加文件：${attachment.name || '未命名文件'}]\n${attachment.text}\n[附加文件结束]`
        : ''
      let workbenchBundle = null
      if (surfaceMode === 'workbench' && workbenchTaskContext) {
        workbenchBundle = workbenchContextText(workbenchTaskContext, {
          attachmentName: attachment?.name || '',
        })
        const assistantRef = resolveAssistantRef()
        if (assistantRef?.message && Array.isArray(workbenchBundle.citations)) {
          assistantRef.message.workbenchCitations = workbenchBundle.citations
        }
      }
      const taskContext = workbenchBundle?.text
        ? `\n\n${workbenchBundle.text}\n\n`
        : ''
      const result = await window.api.aiGenerate({
        prompt,
        displayPrompt,
        bindRef: bindRef || undefined,
        context: `${taskContext}${(ctx.content || '').trim()}${attachedContext}`.trim() || null,
        history: priorHistory,
        noteId: ctx.noteId,
        category: ctx.category || '',
        skillRefs,
        taskId: explicitTaskId || undefined,
        contentGrounding,
        sessionId: runSessionId || activeSession?.id,
        agentId: activeAgentId,
        runId,
      })
      offEvent()
      if (result.error) {
        if (result.cancelled) {
          const assistantRef = resolveAssistantRef()
          if (assistantRef) {
            settleCancelledAssistantText(assistantRef.message)
            assistantRef.message.streaming = false
            assistantRef.message.activity = '已停止生成'
            if (!paintAssistantIfOnScreen(assistantRef)) { /* off-screen state kept */ }
          }
          setPresenceState('error')
          return
        }
        const friendly = (window.AgentErrorHumanize?.humanizeAgentError
          || (e => String(e || '生成失败')))(result.error)
        const assistantRef = resolveAssistantRef()
        if (assistantRef) {
          assistantRef.message.streaming = false
          assistantRef.message.activity = '生成失败'
          assistantRef.message.terminalStatus = 'failed'
          if (!assistantRef.message.v2AnswerCommitted || !String(assistantRef.message.text || '').trim()) {
            // 运行时给了可执行原因（缺工具、连接器未启用等）就必须展示，通用文案只做兜底。
            assistantRef.message.text = assistantRef.message.text
              || friendly
              || (assistantRef.message.protocolVersion === 2 ? '未能收到完整答复，请重试。' : '生成失败')
          }
          if (!paintAssistantIfOnScreen(assistantRef)) { /* off-screen state kept */ }
        } else if (((runSessionId && inflightChatBySession.get(runSessionId)) || chatHistory) === chatHistory) {
          chatHistory.push({ role: 'error', text: friendly })
          renderChat()
        } else {
          const history = inflightChatBySession.get(runSessionId)
          if (history) history.push({ role: 'error', text: friendly })
        }
        setPresenceState('error')
        return
      }
      const finalText = (result.text || '').trim()
      const latestSession = result.sessionId ? await window.api.agentSessionGet(result.sessionId) : null
      if (latestSession?.ok && latestSession.session?.run) {
        runArtifacts = Array.isArray(latestSession.session.run.artifacts) ? [...latestSession.session.run.artifacts] : runArtifacts
      }
      let assistantRef = resolveAssistantRef()
      if (!assistantRef) return
      if (!assistantRef.message.v2AnswerCommitted) {
        if (assistantRef.message.protocolVersion === 2) {
          assistantRef.message.text = assistantRef.message.text || '未能收到完整答复，请重试。'
          assistantRef.message.activity = assistantRef.message.activity || '输出未完成'
        } else if (!gotNonEmptyStream && finalText) {
          if (assistantRef.history === chatHistory) {
            await revealTypewriter(assistantRef.idx, finalText, runId)
            assistantRef = resolveAssistantRef()
            if (!assistantRef) return
          } else {
            assistantRef.message.text = finalText
          }
        } else if (finalText) {
          assistantRef.message.text = finalText
        }
      }
      assistantRef.message.streaming = false
      assistantRef.message.activity = ''
      if (Number.isFinite(assistantRef.message.startedAt)) {
        assistantRef.message.elapsedMs = Math.max(0, Date.now() - assistantRef.message.startedAt)
      }
      if (assistantRef.message.answerHash == null && result.answerHash) {
        assistantRef.message.answerHash = result.answerHash
      }
      if (!assistantRef.message.ui?.length && latestSession?.ok) {
        const persisted = [...(latestSession.session?.messages || [])].reverse()
          .find(item => item.role === 'assistant' && item.answerHash === result.answerHash)
        if (persisted?.ui?.length) assistantRef.message.ui = persisted.ui
      }
      hydrateLegacyAssistantMessage(assistantRef.message)
      if (Array.isArray(result.personalization?.applied) && result.personalization.applied.length) {
        assistantRef.message.personalization = {
          applied: result.personalization.applied,
          omitted: Array.isArray(result.personalization.omitted) ? result.personalization.omitted : [],
        }
      }
      const targetSessionId = runSessionId || result.sessionId || activeSession?.id || ''
      const historyForPersist = assistantRef.history
      if (targetSessionId) {
        const nextMessages = historyForPersist
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role: m.role,
            text: m.text,
            ...(m.role === 'assistant' && Array.isArray(m.trace) ? { trace: m.trace.map(item => ({ ...item })) } : {}),
            ...(m.role === 'assistant' && m.protocolVersion ? { protocolVersion: m.protocolVersion } : {}),
            ...(m.role === 'assistant' && m.answerHash ? { answerHash: m.answerHash } : {}),
            ...(m.role === 'assistant' && Array.isArray(m.ui) && m.ui.length
              ? { ui: m.ui.map(item => ({ ...item, items: Array.isArray(item.items) ? item.items.map(it => ({ ...it })) : [] })) }
              : {}),
          }))
        const updatedAt = new Date().toISOString()
        const firstUser = nextMessages.find(m => m.role === 'user')
        const previewRaw = contentGrounding.active
          ? contentGrounding.title
          : (firstUser ? String(firstUser.text).replace(/\s+/g, ' ').trim().slice(0, 28) : '新助手')
        const preview = compactSessionDisplayTitle(previewRaw) || '新助手'
        sessions = sessions.map(s => s.id === targetSessionId
          ? {
              ...s,
              displayTitle: preview,
              labels: contentGrounding.labels || [],
              grounding: contentGrounding.text || '',
              updatedAt,
              messageCount: nextMessages.length,
            }
          : s)
        if (activeSession?.id === targetSessionId) {
          activeSession = {
            ...activeSession,
            messages: nextMessages,
            updatedAt,
            displayTitle: preview,
            labels: contentGrounding.labels || [],
            grounding: contentGrounding.text || '',
          }
        }
        renderSessionTabs()
      }
      paintAssistantIfOnScreen(assistantRef)
      setPresenceState('success')
    } catch (err) {
      offEvent()
      const friendly = (window.AgentErrorHumanize?.humanizeAgentError
        || (e => String(e?.message || e || '生成失败')))(err)
      const assistantRef = resolveAssistantRef()
      if (assistantRef) {
        assistantRef.message.streaming = false
        assistantRef.message.activity = '生成失败'
        assistantRef.message.terminalStatus = 'failed'
        if (!assistantRef.message.v2AnswerCommitted || !String(assistantRef.message.text || '').trim()) {
          assistantRef.message.text = assistantRef.message.text
            || friendly
            || (assistantRef.message.protocolVersion === 2 ? '未能收到完整答复，请重试。' : '生成失败')
        }
        if (!paintAssistantIfOnScreen(assistantRef)) { /* off-screen state kept */ }
      } else if (((runSessionId && inflightChatBySession.get(runSessionId)) || chatHistory) === chatHistory) {
        chatHistory.push({ role: 'error', text: friendly })
        renderChat()
      } else {
        const history = inflightChatBySession.get(runSessionId)
        if (history) history.push({ role: 'error', text: friendly })
      }
      setPresenceState('error')
    } finally {
      offEvent()
      if (activeRunId === runId) activeRunId = ''
      if (runSessionId) inflightChatBySession.delete(runSessionId)
      setSendButtonMode('send')
      updateComposerMeta()
    }
  }

  function bindEvents() {
    aiKnowledgeBtn?.addEventListener('click', e => {
      e.stopPropagation()
      if (knowledgeMenuOpen) {
        hideKnowledgeMenu()
        return
      }
      renderKnowledgeToolbarMenu()
      knowledgeMenuOpen = true
      aiKnowledgeMenu?.classList.add('show')
      aiKnowledgeBtn.setAttribute('aria-expanded', 'true')
    })
    aiKnowledgeMenu?.addEventListener('click', async e => {
      if (await handleKnowledgeControl(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        renderKnowledgeToolbarMenu()
      }
    })
    aiModelBtn?.addEventListener('click', e => {
      e.stopPropagation()
      if (e.target.closest('#agentModelUsage')) {
        toggleContextPanel()
        return
      }
      toggleModelMenu()
    })
    aiModelMenu?.addEventListener('click', e => {
      const item = e.target.closest('[data-model]')
      if (!item) return
      e.preventDefault()
      pickModel(item.dataset.model, item.dataset.provider)
    })
    document.addEventListener('click', e => {
      if (modelMenuOpen && !e.target.closest('#agentModelMenu') && !e.target.closest('#agentModelBtn')) hideModelMenu()
      if (contextPanelOpen && !e.target.closest('#agentContextPanel') && !e.target.closest('#agentModelUsage')) hideContextPanel()
      if (knowledgeMenuOpen && !e.target.closest('#agentSessionKnowledgeMenu') && !e.target.closest('#agentSessionKnowledgeBtn')) hideKnowledgeMenu()
    })
    topicNav?.addEventListener('click', e => {
      const anchorBtn = e.target.closest('[data-conversation-anchor]')
      if (!anchorBtn) return
      e.preventDefault()
      const userMsgIdx = Number(anchorBtn.dataset.userMsgIdx)
      jumpToConversationAnchor(Number.isInteger(userMsgIdx) ? userMsgIdx : null)
    })
    chatLog?.addEventListener('click', async e => {
      const runCancelBtn = e.target.closest('[data-run-cancel]')
      const runRetryBtn = e.target.closest('[data-run-retry]')
      const runResumeBtn = e.target.closest('[data-run-resume]')
      if (runCancelBtn || runRetryBtn || runResumeBtn) {
        e.preventDefault()
        const btn = runCancelBtn || runRetryBtn || runResumeBtn
        if (btn.disabled) return
        btn.disabled = true
        const kind = runCancelBtn ? 'cancel' : runRetryBtn ? 'retry' : 'resume'
        await handleRunTreeAction(kind, btn.dataset.runCancel || btn.dataset.runRetry || btn.dataset.runResume)
        btn.disabled = false
        return
      }
      const approveBtn = e.target.closest('[data-draft-approve]')
      const rejectBtn = e.target.closest('[data-draft-reject]')
      const rollbackBtn = e.target.closest('[data-draft-rollback]')
      if (rollbackBtn) {
        e.preventDefault()
        const draftId = rollbackBtn.dataset.draftRollback
        const api = window.api?.toolRollbackDraft
        if (typeof api === 'function') {
          rollbackBtn.disabled = true
          const r = await api({ draftId })
          rollbackBtn.textContent = r?.ok ? '已回滚' : '回滚失败'
        }
        return
      }
      if (approveBtn || rejectBtn) {
        e.preventDefault()
        const btn = approveBtn || rejectBtn
        if (btn.disabled || btn.classList.contains('is-loading')) return
        const card = e.target.closest('.agent-tool-approval')
        const approve = card?.querySelector('[data-draft-approve]')
        const reject = card?.querySelector('[data-draft-reject]')
        ;[approve, reject].forEach((b) => { if (b) { b.disabled = true; b.classList.add('is-loading') } })
        const draftId = btn.dataset.draftApprove || btn.dataset.draftReject
        const api = window.api?.toolApproveDraft
        if (typeof api === 'function') {
          const r = await api({ draftId, reject: Boolean(rejectBtn) })
          if (card) {
            card.innerHTML = `<span class="agent-tool-approval-badge">${r?.rejected ? '已拒绝' : r?.ok ? '已批准' : (r?.code === 'not_pending' ? '已处理' : '失败')}</span>`
          }
        }
        return
      }
      const anchorBtn = e.target.closest('[data-conversation-anchor]')
      if (anchorBtn) {
        e.preventDefault()
        const userMsgIdx = Number(anchorBtn.dataset.userMsgIdx)
        jumpToConversationAnchor(Number.isInteger(userMsgIdx) ? userMsgIdx : null)
        return
      }
      const authCta = e.target.closest('[data-feishu-auth-cta]')
      if (authCta) {
        e.preventDefault()
        await startFeishuAuthFromChat(authCta)
        return
      }
      const zoomable = e.target.closest('[data-zoom-src]')
      if (zoomable) {
        e.preventDefault()
        openImageViewer(zoomable.dataset.zoomSrc || '', zoomable.dataset.zoomAlt || '')
        return
      }
      const link = e.target.closest('[data-open-url]')
      if (link) {
        e.preventDefault()
        // 飞书卡片左键默认进入内置右侧预览。
        await handleFeishuLinkAction('right', link.dataset.openUrl, link.dataset.openTitle || '')
        return
      }
      const sugBtn = e.target.closest('[data-suggest-act]')
      if (sugBtn) {
        e.preventDefault()
        const root = sugBtn.closest('.agent-suggest')
        if (!root || root.classList.contains('is-decided') || sugBtn.disabled) return
        const bubble = sugBtn.closest('.agent-bubble[data-idx]')
        const msgIdx = bubble ? Number(bubble.dataset.idx) : -1
        const list = root.querySelectorAll('.agent-suggest-item')
        const chosenIndex = Array.prototype.indexOf.call(list, sugBtn)
        if (msgIdx >= 0 && chatHistory[msgIdx] && Number.isInteger(chosenIndex) && chosenIndex >= 0) {
          chatHistory[msgIdx].suggestionChosenIndex = chosenIndex
        }
        if (window.StructuredChoice && typeof window.StructuredChoice.lock === 'function') {
          window.StructuredChoice.lock(root, sugBtn)
        }
        const picked = (window.StructuredChoice && typeof window.StructuredChoice.parseSelectionButton === 'function')
          ? window.StructuredChoice.parseSelectionButton(sugBtn)
          : (() => {
              let payload = ''
              try { payload = decodeURIComponent(sugBtn.dataset.payload || '') } catch { payload = sugBtn.dataset.payload || '' }
              return { action: sugBtn.dataset.suggestAct || '', payload, needsInput: false }
            })()
        const act = picked.action
        const payload = picked.payload
        pendingBindRef = String(sugBtn.dataset.actionId || '').trim()
        const label = sugBtn.querySelector('strong')?.textContent?.trim() || '建议动作'
        await dispatchAgentAction({
          id: `suggestion-${msgIdx}-${chosenIndex}`,
          label,
          action: act,
          payload,
          requiresInput: picked.needsInput,
          source: 'model',
        }, {
          messageId: `message-${msgIdx}`,
          buttonText: sugBtn.textContent || label,
        })
        return
      }
      const expertConfigBtn = e.target.closest('[data-expert-config]')
      if (expertConfigBtn) {
        e.preventDefault()
        if (typeof window.openCapabilityHub === 'function') window.openCapabilityHub('connectors')
        else toastFn('请前往专家库 → MCP 连接器完成配置')
        return
      }
      if (await handleKnowledgeControl(e.target)) {
        e.preventDefault()
        return
      }
      const officeBtn = e.target.closest('.agent-empty-act[data-auto-send="1"]')
      if (officeBtn) {
        e.preventDefault()
        const shortcutId = String(officeBtn.dataset.shortcut || '').trim()
        const title = officeBtn.querySelector('strong')?.textContent?.trim() || ''
        const sub = officeBtn.querySelector('.agent-empty-act-copy > span, .agent-workflow-copy > span')?.textContent?.trim() || ''
        if (shortcutId && (skillTaskMap.has(shortcutId) || EMPTY_SHORTCUT_PROMPTS[shortcutId] || QUICK_ACTION_PROMPTS[shortcutId])) {
          await runTaskCard(shortcutId, sub || title)
          return
        }
        const prompt = resolveEmptyShortcutPrompt(officeBtn)
        if (!prompt) return
        await runQuickStarter(prompt, sub || title)
        return
      }
      const followupBtn = e.target.closest('[data-followup-prompt]')
      if (followupBtn) {
        e.preventDefault()
        let prompt = ''
        try { prompt = decodeURIComponent(followupBtn.dataset.followupPrompt || '') } catch { prompt = followupBtn.dataset.followupPrompt || '' }
        if (!String(prompt || '').trim()) return
        const bubble = followupBtn.closest('.agent-bubble[data-idx]')
        const messageIdx = bubble ? Number(bubble.dataset.idx) : -1
        const label = followupBtn.textContent?.trim() || '下一步建议'
        await dispatchAgentAction({
          id: `followup-${messageIdx}-${label}`,
          label,
          action: 'send',
          payload: prompt,
          source: 'shortcut',
        }, {
          messageId: `message-${messageIdx}`,
          buttonText: label,
        })
        return
      }
      const stewardBtn = e.target.closest('[data-steward]')
      if (stewardBtn) {
        e.preventDefault()
        await runStewardTemplate(stewardBtn.dataset.steward)
        return
      }
      const artBtn = e.target.closest('[data-art-act]')
      if (artBtn) {
        e.preventDefault()
        await handleArtifactAction(artBtn.dataset.artAct, artBtn.dataset.artId)
        return
      }
      const actBtn = e.target.closest('[data-act]')
      if (!actBtn) return
      const idx = Number(actBtn.dataset.idx)
      const m = chatHistory[idx]
      if (!m?.text || m.role !== 'assistant') return
      const assistantText = normalizeAssistantOutput(m.text)
      const act = actBtn.dataset.act
      if (act === 'apply-menu') {
        e.preventDefault()
        e.stopPropagation()
        const wrap = actBtn.closest('.agent-apply-wrap')
        document.querySelectorAll('.agent-apply-wrap.open').forEach(el => {
          if (el !== wrap) el.classList.remove('open')
        })
        wrap?.classList.toggle('open')
        return
      }
      document.querySelectorAll('.agent-apply-wrap.open').forEach(el => el.classList.remove('open'))
      if (act === 'copy') {
        try {
          await navigator.clipboard.writeText(assistantText)
        } catch {
          window.api.copyToClipboard(assistantText)
        }
        toastFn('已复制')
        await logApply('copy', '已复制助手回复')
        return
      }
      if (act === 'insert' || act === 'append') {
        await applyLowRisk(act, assistantText)
        return
      }
      if (act === 'replace') {
        await proposeReplace(assistantText)
        return
      }
    })
    chatLog?.addEventListener('contextmenu', e => {
      const link = e.target.closest('[data-open-url]')
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
      showFeishuLinkMenu(link.dataset.openUrl, link.dataset.openTitle || '', e.clientX, e.clientY)
    })
    chatLog?.addEventListener('load', e => {
      if (!e.target.matches?.('.agent-inline-image')) return
      const figure = e.target.closest('.agent-inline-image-wrap')
      if (figure) figure.dataset.imageState = 'ready'
    }, true)
    chatLog?.addEventListener('error', e => {
      if (!e.target.matches?.('.agent-inline-image')) return
      const figure = e.target.closest('.agent-inline-image-wrap')
      if (!figure) return
      figure.dataset.imageState = 'error'
      const status = figure.querySelector('[data-image-status-text]')
      if (status) status.textContent = `图片加载失败：${e.target.alt || '无法显示此图片'}`
    }, true)
    feishuLinkMenu?.addEventListener('click', e => {
      const btn = e.target.closest('[data-feishu-action]')
      if (!btn) return
      void handleFeishuLinkAction(btn.dataset.feishuAction, feishuLinkMenu.dataset.url)
    })
    agentImageViewerClose?.addEventListener('click', closeImageViewer)
    agentImageViewer?.addEventListener('click', e => {
      if (e.target === agentImageViewer) closeImageViewer()
    })
    document.addEventListener('click', e => {
      if (!e.target.closest('#feishuLinkMenu')) hideFeishuLinkMenu()
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && agentImageViewer?.classList.contains('show')) closeImageViewer()
      if (e.key === 'Escape' && knowledgeMenuOpen) hideKnowledgeMenu()
    })
    document.addEventListener('click', () => {
      document.querySelectorAll('.agent-apply-wrap.open').forEach(el => el.classList.remove('open'))
    })
    sessionTabsEl?.addEventListener('click', async e => {
      const closeBtn = e.target.closest('[data-close-session]')
      if (closeBtn) {
        e.stopPropagation()
        await closeSessionTab(closeBtn.dataset.closeSession)
        return
      }
      const tab = e.target.closest('[data-session-id]')
      if (!tab) return
      const id = tab.dataset.sessionId
      if (!id || id === activeSession?.id) return
      if (aiSend.disabled) { toastFn('当前助手正在生成，请稍候'); return }
      await activateSession(id)
    })
    sessionTabScrollEl?.addEventListener('wheel', e => {
      const maxScroll = sessionTabScrollEl.scrollWidth - sessionTabScrollEl.clientWidth
      if (maxScroll <= 0) return
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!delta) return
      const next = Math.max(0, Math.min(maxScroll, sessionTabScrollEl.scrollLeft + delta))
      if (next === sessionTabScrollEl.scrollLeft) return
      e.preventDefault()
      sessionTabScrollEl.scrollLeft = next
    }, { passive: false })
    sessionTabsEl?.addEventListener('keydown', e => {
      const tab = e.target.closest('.agent-session-tab')
      if (!tab || e.target !== tab || !['Enter', ' '].includes(e.key)) return
      e.preventDefault()
      tab.click()
    })
    sessionTabsEl?.addEventListener('contextmenu', e => {
      const tab = e.target.closest('[data-session-id]')
      if (!tab) return
      e.preventDefault()
      e.stopPropagation()
      showTabContextMenu(tab.dataset.sessionId, e.clientX, e.clientY)
    })
    tabCtxPop?.addEventListener('click', async e => {
      e.stopPropagation()
      const btn = e.target.closest('[data-tab-ctx]')
      if (!btn) return
      await handleTabCtxAction(btn.dataset.tabCtx, btn.dataset.sessionId)
    })
    btnHistory?.addEventListener('click', e => {
      e.stopPropagation()
      const open = historyPop?.classList.contains('show')
      hideHeadPops()
      if (!open) {
        renderHistoryPop()
        historyPop?.classList.add('show')
      }
    })
    btnExpert?.addEventListener('click', e => {
      e.stopPropagation()
      const open = expertPop?.classList.contains('show')
      hideHeadPops()
      if (!open) {
        renderExpertPop()
        expertPop?.classList.add('show')
      }
    })
    expertPop?.addEventListener('click', async e => {
      e.stopPropagation()
      const item = e.target.closest('[data-expert-id]')
      if (item) await selectExpert(item.dataset.expertId)
    })
    btnMore?.addEventListener('click', e => {
      e.stopPropagation()
      const open = morePop?.classList.contains('show')
      hideHeadPops()
      if (!open) {
        renderMorePop()
        morePop?.classList.add('show')
      }
    })
    historyPop?.addEventListener('click', async e => {
      e.stopPropagation()
      const btn = e.target.closest('[data-reopen]')
      if (!btn) return
      hideHeadPops()
      if (aiSend.disabled) { toastFn('当前助手正在生成，请稍候'); return }
      await activateSession(btn.dataset.reopen)
    })
    morePop?.addEventListener('click', async e => {
      e.stopPropagation()
      const btn = e.target.closest('[data-more]')
      if (!btn || btn.disabled) return
      await handleMoreAction(btn.dataset.more)
    })

    aiSend.addEventListener('click', runAI)
    chatLog?.addEventListener('scroll', syncChatStickFromUserScroll, { passive: true })
    aiAttach?.addEventListener('click', () => aiFileInput?.click())
    aiFileInput?.addEventListener('change', async () => {
      const file = aiFileInput.files?.[0]
      if (!file) return
      if (file.size > 512 * 1024) {
        toastFn('文件过大，请选择 512 KB 以内的文本文件', 'error')
        clearAttachment()
        return
      }
      try {
        setAttachment(file, await file.text())
      } catch {
        toastFn('读取文件失败，请重试', 'error')
        clearAttachment()
      }
    })
    aiAttachmentRemove?.addEventListener('click', clearAttachment)
    aiQuickBtn?.addEventListener('click', e => {
      e.stopPropagation()
      if (aiQuickMenu?.classList.contains('show')) {
        setQuickMenuOpen(false)
        aiInput?.focus()
      }
      else showQuickMenu()
    })
    aiQuickMenu?.addEventListener('click', e => {
      e.stopPropagation()
      const btn = e.target.closest('[data-quick-command]')
      if (btn) runQuickAction(btn)
    })
    aiQuickMenu?.addEventListener('mousemove', e => {
      const btn = e.target.closest('[data-quick-command]')
      if (btn) {
        const items = visibleQuickItems()
        const idx = items.indexOf(btn)
        if (idx >= 0 && idx !== quickActive) {
          quickActive = idx
          renderQuickActive()
        }
      }
    })
    quickSearchInput?.addEventListener('input', () => {
      quickQuery = quickSearchInput.value
      quickActive = 0
      renderQuickResults()
    })
    aiComposer?.addEventListener('click', e => e.stopPropagation())
    document.addEventListener('click', () => hideAiMenus())

    aiInput.addEventListener('input', () => {
      resizeAiInput()
      updateContextMeter()
      updateSlashMenu()
      updateAtMenu()
      updateComposerMeta()
      if (!activeRunId) setPresenceState(classifyPresenceInput(aiInput.value))
    })
    aiInput.addEventListener('keydown', e => {
      if (handleQuickMenuKeydown(e)) return
      if (slashOpen) {
        const items = filteredSkills()
        if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { slashActive = (slashActive + 1) % items.length; renderSlashMenu() } return }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { slashActive = (slashActive - 1 + items.length) % items.length; renderSlashMenu() } return }
        if (e.key === 'Enter' && !e.shiftKey && items.length) { e.preventDefault(); pickSlashSkill(items[slashActive] || items[0]); return }
        if (e.key === 'Tab' && items.length) { e.preventDefault(); pickSlashSkill(items[slashActive] || items[0]); return }
        if (e.key === 'Escape') { e.preventDefault(); hideSlashMenu(); return }
      }
      if (atOpen) {
        const items = visibleFiles()
        if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { atActive = (atActive + 1) % items.length; renderAtMenu() } return }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { atActive = (atActive - 1 + items.length) % items.length; renderAtMenu() } return }
        if (e.key === 'Enter' && !e.shiftKey && items.length) { e.preventDefault(); pickFile(items[atActive] || items[0]); return }
        if (e.key === 'Tab' && items.length) { e.preventDefault(); pickFile(items[atActive] || items[0]); return }
        if (e.key === 'Escape') { e.preventDefault(); hideAtMenu(); return }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAI() }
    })
    aiInput.addEventListener('blur', () => {
      setTimeout(() => { hideSlashMenu(); hideAtMenu() }, 120)
      if (!activeRunId) setPresenceState('idle')
    })

    document.addEventListener('keydown', e => {
      if (e.defaultPrevented) return
      if (handleQuickMenuKeydown(e)) return
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') {
        if (document.getElementById('appShell')?.classList.contains('mode-edit')) return
        e.preventDefault()
        if (aiQuickMenu?.classList.contains('show')) {
          setQuickMenuOpen(false)
          aiInput?.focus()
        }
        else showQuickMenu()
      }
    })
    window.addEventListener('resize', () => syncConversationAnchorPosition())
  }

  function applyModelProfile(profile) {
    if (!profile?.contextWindow) return
    contextProfile = profile
    contextLimitTokens = Math.max(4000, Number(profile.contextWindow) || 32768)
    const displayLabel = normalizeModelLabel(profile.label || profile.model || '模型')
    if (aiModelLabel) aiModelLabel.textContent = displayLabel
    if (aiModelBtn) aiModelBtn.title = `当前模型：${displayLabel}`
    updateContextMeter()
  }

  async function loadLlmProfile() {
    try {
      const profile = await window.api?.llmProfile?.()
      applyModelProfile(profile)
    } catch { /* keep conservative fallback */ }
    try {
      modelCatalog = await window.api?.llmModels?.()
    } catch { /* keep conservative fallback */ }
  }

  function hideModelMenu() {
    modelMenuOpen = false
    if (aiModelMenu) aiModelMenu.classList.remove('show')
  }

  function hideContextPanel() {
    contextPanelOpen = false
    if (aiContextPanel) {
      aiContextPanel.classList.remove('show')
      aiContextPanel.hidden = true
    }
  }

  function renderModelMenu() {
    if (!aiModelMenu || !modelCatalog) return
    const currentModel = contextProfile?.model || modelCatalog.current?.model || ''
    const usage = buildContextUsageViewModel()
    const listHtml = (modelCatalog.groups || [])
      .filter(group => (group.models || []).length)
      .map(group => {
        const items = group.models.map(model => {
          const active = model.id === currentModel ? ' active' : ''
          const noTools = model.supportsTools === false
          const modelLimit = Number(model.contextWindow) || (active ? contextLimitTokens : 0)
          const limitText = modelLimit ? formatTokenCount(modelLimit) : '--'
          const metaHtml = noTools
            ? `<span class="m-limit" title="最大上下文：${escHtml(formatTokenCountExact(modelLimit || 0))} tokens">${escHtml(limitText)}</span><span class="m-sep">·</span><span class="m-no-tools">无工具</span>`
            : `<span class="m-limit" title="最大上下文：${escHtml(formatTokenCountExact(modelLimit || 0))} tokens">${escHtml(limitText)}</span>`
          return `<button class="agent-menu-item agent-model-item${active}${noTools ? ' no-tools' : ''}" type="button" role="option" data-model="${escHtml(model.id)}" data-provider="${escHtml(group.id)}"><span class="m-label">${escHtml(model.label)}${noTools ? '<em class="m-badge">无工具</em>' : ''}</span><span class="m-ctx">${metaHtml}</span></button>`
        }).join('')
        return `<div class="agent-model-group">${escHtml(group.label)}</div>${items}`
      }).join('')
    const sectionRows = usage.rows.length
      ? usage.rows.map(item => {
          const label = SECTION_LABELS[item.key] || item.key
          return `<div class="ctx2-row"><span>${escHtml(label)}</span><strong>${escHtml(formatTokenCount(item.usedTokens))}</strong></div>`
        }).join('')
      : '<div class="ctx2-empty">发送一轮对话后可查看分区明细</div>'
    aiModelMenu.innerHTML = `
      <div class="agent-model-layout">
        <div class="agent-model-list">${listHtml || '<div class="agent-model-group">暂无可选模型，请在设置中配置</div>'}</div>
        <aside class="agent-model-context" aria-label="Context Usage">
          <div class="ctx2-title">Context Usage</div>
          <div class="ctx2-sub">${escHtml(Math.round(usage.ratio * 100))}% Full</div>
          <div class="ctx2-total">${escHtml(`~${formatTokenCount(usage.used)} / ${formatTokenCount(usage.limit)} Tokens`)}</div>
          <div class="ctx2-bar ${usage.barClass}"><i style="width:${Math.max(usage.ratio * 100, usage.ratio > 0 ? 2 : 0)}%"></i></div>
          ${sectionRows}
          ${usage.note ? `<div class="ctx2-note">${escHtml(usage.note)}</div>` : ''}
        </aside>
      </div>
    `
    if (window.StickyIcons) window.StickyIcons.mount(aiModelMenu)
  }

  function toggleModelMenu() {
    if (!aiModelMenu) return
    if (modelMenuOpen) { hideModelMenu(); return }
    hideContextPanel()
    renderModelMenu()
    modelMenuOpen = true
    aiModelMenu.classList.add('show')
  }

  async function pickModel(modelId, provider) {
    hideModelMenu()
    if (!modelId || !window.api?.llmSetModel) return
    const prevWindow = Number(contextProfile?.contextWindow || contextLimitTokens) || 0
    try {
      const r = await window.api.llmSetModel({ model: modelId, provider })
      if (r?.ok && r.profile) {
        applyModelProfile(r.profile)
        try { modelCatalog = await window.api?.llmModels?.() } catch { /* keep */ }
        if (modelCatalog?.current) {
          modelCatalog.current.model = r.profile.model
          modelCatalog.current.label = r.profile.label
          modelCatalog.current.contextWindow = r.profile.contextWindow
        }
        const nextWindow = Number(r.profile.contextWindow) || 0
        const usedHint = Number(lastContextInfo?.usedTokens) || 0
        toastFn?.(`已切换模型：${r.profile.label || r.profile.model}`, 'success')
        if (nextWindow && prevWindow && nextWindow < prevWindow) {
          const msg = usedHint > nextWindow
            ? `上下文窗口已缩小（${formatTokenCount(prevWindow)} → ${formatTokenCount(nextWindow)}），下轮发送可能压缩较早对话`
            : `上下文窗口已缩小（${formatTokenCount(prevWindow)} → ${formatTokenCount(nextWindow)}）`
          toastFn?.(msg, 'info')
        }
        updateContextMeter()
      } else if (r?.error) {
        toastFn?.(r.error, 'error')
      }
    } catch (e) {
      toastFn?.(e?.message || '切换模型失败', 'error')
    }
  }

  function init(opts) {
    getEditorContext = opts.getEditorContext || getEditorContext
    applyToEditor = opts.applyToEditor || applyToEditor
    toastFn = opts.toast || toastFn
    getFileCatalog = opts.getFileCatalog || getFileCatalog
    openReferencedFile = opts.openReferencedFile || openReferencedFile
    openKnowledgePanel = opts.openKnowledgePanel || null
    workSurface = opts.workSurface || null
    if (workSurface && workSurface.setHandlers) {
      workSurface.setHandlers({
        accept: (id) => handleArtifactAction('accept', id),
        reject: (id) => handleArtifactAction('reject', id),
        applyEditor: (id) => handleArtifactAction('apply-editor', id),
        createFeishuDraft: (id) => handleArtifactAction('feishu-draft', id),
      })
    }
    bindEvents()
    bindDaemonProcessFeedOnce()
    bindDaemonHitlOnce()
    renderQuickMenuForAgent(activeAgentId)
    void refreshPackEmptyGroups().then(() => { if (typeof renderChat === 'function') renderChat() })
    if (window.api?.listSkills || window.knowme?.skill?.list) ensureSkillCatalog()
    if (window.knowme?.expert?.list || window.api?.expertList) ensureExpertCatalog()
    if (window.api?.knowledgeProviderList) void ensureKnowledgeCatalog({ rerender: true })
    refreshFeishuUsageHint({ rerender: true })
    window.addEventListener('focus', () => { refreshFeishuUsageHint({ rerender: true }) })
    if (window.StickyIcons) StickyIcons.mount(document.getElementById('agentCol'))
    updateComposerMeta()
    loadLlmProfile()
    sessionsLoadPromise = loadSessions()
    installAgentOutputFixture()
  }

  function installAgentOutputFixture() {
    if (localStorage.getItem('__knowme_agent_output_fixture') !== '1') return
    if (window.__KnowMeAgentOutputFixture) return

    const ipcWaiters = new Map()
    let fixtureIpcListenerOff = null

    function readFixtureState(message) {
      const state = message?.messageState
      if (!state) return null
      return {
        runId: state.runId,
        status: state.status,
        lastSeq: state.lastSeq,
        terminalType: state.terminalType,
        frozen: state.frozen,
        answerHash: state.answer?.hash || '',
        answerLength: String(state.answer?.text || '').length,
        answerCommitted: Boolean(state.answer?.committed),
        uiCount: Array.isArray(state.ui) ? state.ui.length : 0,
        counters: { ...(state.counters || {}) },
        diagnosticsCount: Array.isArray(state.diagnostics) ? state.diagnostics.length : 0,
      }
    }

    function resolveAssistantIndex(runId) {
      return chatHistory.findIndex(item => item.role === 'assistant' && item.runId === runId)
    }

    function captureDispatchRefs(idx) {
      const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
      return {
        bodyBefore: bubble?.querySelector('[data-assistant-body="1"]') || null,
        structuredUiBefore: bubble?.querySelector('[data-structured-ui="1"]') || null,
        bubbleBefore: bubble || null,
        historyNodes: Array.from(chatLog?.querySelectorAll('[data-idx]') || [])
          .map(node => ({ idx: Number(node.getAttribute('data-idx')), node })),
      }
    }

    function buildDispatchResult(idx, refs, changed, extra = {}) {
      const message = chatHistory[idx]
      const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
      const bodyAfter = bubble?.querySelector('[data-assistant-body="1"]') || null
      const structuredUiAfter = bubble?.querySelector('[data-structured-ui="1"]') || null
      const bubbleAfter = bubble || null
      const bodyBefore = refs.bodyBefore
      const structuredUiBefore = refs.structuredUiBefore
      const bubbleBefore = refs.bubbleBefore
      const sameBodyNode = Boolean(bodyBefore && bodyAfter && bodyBefore === bodyAfter)
      const sameStructuredUiNode = Boolean(
        structuredUiBefore && structuredUiAfter && structuredUiBefore === structuredUiAfter,
      )
      return {
        ok: true,
        changed,
        sameBodyNode,
        sameStructuredUiNode,
        sameBubbleNode: bubbleBefore && bubbleAfter ? bubbleBefore === bubbleAfter : Boolean(bubbleAfter),
        historySameNodes: refs.historyNodes.every(item => {
          const current = chatLog?.querySelector(`[data-idx="${item.idx}"]`)
          return current && current === item.node
        }),
        state: readFixtureState(message),
        ...extra,
      }
    }

    function ensureFixtureIpcListener() {
      if (fixtureIpcListenerOff || !window.api?.onAiStreamEvent) return
      fixtureIpcListenerOff = window.api.onAiStreamEvent((incoming) => {
        if (!incoming || incoming.version == null) return
        const key = `${incoming.runId}:${incoming.seq}`
        const waiter = ipcWaiters.get(key)
        if (!waiter) return
        ipcWaiters.delete(key)
        const idx = resolveAssistantIndex(incoming.runId)
        if (idx < 0) {
          waiter.reject(new Error('assistant_not_found'))
          return
        }
        const message = chatHistory[idx]
        let changed = false
        try {
          changed = applyV2StreamEvent(incoming, idx, message)
          waiter.resolve({ changed, event: incoming })
        } catch (err) {
          waiter.reject(err)
        }
      })
    }

    function waitForFixtureIpcSeq(runId, seq, timeoutMs = 8000) {
      const key = `${runId}:${seq}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ipcWaiters.delete(key)
          reject(new Error('ipc_seq_timeout'))
        }, timeoutMs)
        ipcWaiters.set(key, {
          resolve: (value) => {
            clearTimeout(timer)
            resolve(value)
          },
          reject: (err) => {
            clearTimeout(timer)
            ipcWaiters.delete(key)
            reject(err)
          },
        })
      })
    }

    window.__KnowMeAgentOutputFixture = {
      mount(options = {}) {
        const runId = String(options.runId || `run_fixture_${Date.now()}`)
        const history = Array.isArray(options.history) ? options.history.map(item => ({ ...item })) : []
        chatHistory = history.concat([{
          role: 'assistant',
          text: '',
          streaming: true,
          runId,
          protocolVersion: 2,
          messageState: window.AgentMessageState?.createMessageState(runId) || null,
          v2AnswerCommitted: false,
          activity: '正在准备上下文…',
          startedAt: Date.now(),
          elapsedMs: 0,
          trace: [],
        }])
        chatStickToBottom = true
        renderChat()
        if (window.api?.agentOutputFixtureRun) ensureFixtureIpcListener()
        return { runId, assistantIdx: chatHistory.length - 1, historyCount: history.length }
      },
      mountLegacyStream(options = {}) {
        const runId = String(options.runId || `run_legacy_fixture_${Date.now()}`)
        const history = Array.isArray(options.history) ? options.history.map(item => ({ ...item })) : []
        chatHistory = history.concat([{
          role: 'assistant',
          text: '',
          streaming: true,
          runId,
          protocolVersion: 1,
          activity: '正在生成回答…',
          startedAt: Date.now(),
          elapsedMs: 0,
          trace: [],
        }])
        chatStickToBottom = true
        renderChat()
        return { runId, assistantIdx: chatHistory.length - 1, historyCount: history.length }
      },
      stepLegacyStream(assistantIdx, text, options = {}) {
        const idx = Number(assistantIdx)
        const message = chatHistory[idx]
        if (!message?.streaming) return { ok: false, error: 'legacy_stream_not_found' }
        const refs = captureDispatchRefs(idx)
        message.text = options.append === false
          ? String(text || '')
          : `${String(message.text || '')}${String(text || '')}`
        paintStreamText(idx)
        const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
        return buildDispatchResult(idx, refs, true, {
          visibleText: bubble?.innerText || '',
          rawHtml: bubble?.innerHTML || '',
        })
      },
      completeLegacyStream(assistantIdx, options = {}) {
        const idx = Number(assistantIdx)
        const message = chatHistory[idx]
        if (!message) return { ok: false, error: 'legacy_stream_not_found' }
        const refs = captureDispatchRefs(idx)
        if (options.cancelled === true) settleCancelledAssistantText(message)
        message.streaming = false
        const changed = completeAssistantBubble(idx)
        const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
        return buildDispatchResult(idx, refs, changed, {
          visibleText: bubble?.innerText || '',
          rawHtml: bubble?.innerHTML || '',
        })
      },
      dispatch(event) {
        const runId = String(event?.runId || '')
        const idx = resolveAssistantIndex(runId)
        if (idx < 0) return { ok: false, error: 'assistant_not_found' }
        const message = chatHistory[idx]
        const refs = captureDispatchRefs(idx)
        const changed = applyV2StreamEvent(event, idx, message)
        return buildDispatchResult(idx, refs, changed, { ipcPath: false })
      },
      async dispatchViaIpc(event) {
        if (!window.api?.agentOutputFixtureRun) {
          return { ok: false, error: 'ipc_fixture_unavailable', ipcPath: false }
        }
        const runId = String(event?.runId || '')
        const seq = Number(event?.seq)
        if (!runId || !Number.isInteger(seq) || seq < 1) {
          return { ok: false, error: 'invalid_event', ipcPath: false }
        }
        const idx = resolveAssistantIndex(runId)
        if (idx < 0) return { ok: false, error: 'assistant_not_found', ipcPath: false }
        ensureFixtureIpcListener()
        const refs = captureDispatchRefs(idx)
        const waitPromise = waitForFixtureIpcSeq(runId, seq)
        let invokeResult
        try {
          invokeResult = await window.api.agentOutputFixtureRun({ runId, events: [event] })
        } catch (err) {
          ipcWaiters.delete(`${runId}:${seq}`)
          return { ok: false, error: String(err?.message || err), ipcPath: false }
        }
        if (!invokeResult?.ok) {
          ipcWaiters.delete(`${runId}:${seq}`)
          return { ok: false, error: invokeResult?.error || 'ipc_invoke_failed', ipcPath: false }
        }
        try {
          const applied = await waitPromise
          return buildDispatchResult(idx, refs, applied.changed, { ipcPath: true })
        } catch (err) {
          return { ok: false, error: String(err?.message || err), ipcPath: false }
        }
      },
      getDomRefs(assistantIdx) {
        const idx = Number(assistantIdx)
        const bubble = chatLog?.querySelector(`[data-idx="${idx}"]`)
        return {
          bubble: Boolean(bubble),
          body: Boolean(bubble?.querySelector('[data-assistant-body="1"]')),
          structuredUi: Boolean(bubble?.querySelector('[data-structured-ui="1"]')),
          timelineOpen: Boolean(bubble?.querySelector('[data-execution-timeline="1"]')?.open),
          approveVisible: Boolean(bubble?.querySelector('.agent-draft-approve')),
          rejectVisible: Boolean(bubble?.querySelector('.agent-draft-reject')),
          choiceInStructuredUi: Boolean(bubble?.querySelector('[data-structured-ui="1"] .agent-suggest-item')),
        }
      },
      getMessage(assistantIdx) {
        const message = chatHistory[Number(assistantIdx)]
        if (!message) return null
        return {
          textLength: String(message.text || '').length,
          answerHash: message.answerHash || '',
          v2AnswerCommitted: Boolean(message.v2AnswerCommitted),
          streaming: Boolean(message.streaming),
          uiCount: Array.isArray(message.ui) ? message.ui.length : 0,
          traceCount: Array.isArray(message.trace) ? message.trace.length : 0,
          state: readFixtureState(message),
        }
      },
      scrollUp(pixels = 120) {
        if (!chatLog) return 0
        chatStickToBottom = false
        const next = Math.max(0, chatLog.scrollTop - Math.max(0, Number(pixels) || 0))
        beginProgrammaticChatScroll()
        chatLog.scrollTop = next
        return chatLog.scrollTop
      },
      getScrollTop() {
        return chatLog ? chatLog.scrollTop : 0
      },
      getVisibleText() {
        return chatLog?.innerText || ''
      },
      getRawHtml() {
        return chatLog?.innerHTML || ''
      },
      reset() {
        resetChat()
      },
    }
  }

  function resetChat() {
    chatHistory = []
    runArtifacts = []
    lastContextInfo = null
    renderChat()
  }

  function workbenchContextText(context = {}, extras = {}) {
    const presenter = window.WorkbenchPresenter
    const agents = Array.isArray(context.agents) ? context.agents.filter(Boolean).join('、') : ''
    const briefApi = window.WorkbenchTaskBrief
    const classified = briefApi && briefApi.classifyWorkbenchPaths
      ? briefApi.classifyWorkbenchPaths(context.artifacts, context.inputs || (context.context && context.context.inputs))
      : null
    const artifactLabels = classified
      ? classified.artifacts.map(item => item.label || item.path).filter(Boolean)
      : (Array.isArray(context.artifacts)
        ? context.artifacts.map((item) => {
            if (item && typeof item === 'object') return item.name || item.path || item.title || ''
            return item
          }).filter(Boolean)
        : [])
    const artifacts = artifactLabels
      .map((label) => {
        if (presenter && presenter.looksInternal && presenter.looksInternal(label)) return ''
        return label
      })
      .filter(Boolean)
      .join('、')
    const factualBrief = String(context.factualBrief || '').trim()
      || (briefApi
        ? briefApi.buildWorkbenchTaskBrief({
            status: context.status,
            currentNode: context.currentNode,
            agents: context.agents,
            artifacts: context.artifacts,
            inputs: context.inputs || (context.context && context.context.inputs),
            degraded: context.degraded,
            degradedReason: context.degradedReason,
            waitingKind: context.waitingKind,
            gate: context.waitingKind === 'gate' ? { title: context.waitingTitle, node: context.currentNode } : null,
            clarification: context.waitingKind === 'clarification'
              ? (context.clarification || { question: context.waitingTitle })
              : null,
          }).factualBrief
        : '')
    const contextForCite = { ...context, factualBrief }
    const citations = briefApi?.buildWorkbenchCitations
      ? briefApi.buildWorkbenchCitations(contextForCite, extras)
      : []
    const citationsPrompt = briefApi?.formatWorkbenchCitationsForPrompt
      ? briefApi.formatWorkbenchCitationsForPrompt(citations)
      : ''
    const grounding = briefApi
      ? briefApi.workbenchGroundingRules()
      : [
          '【工作台任务事实门禁 · 必须遵守】',
          '只能引用下方任务事实；禁止编造财务/法务/运营等未声明角色；不足则说明本地工作流未提供。',
          '用第一性原则：事实 → 缺口 → 可验证下一步；禁止无来源断言。',
        ].join('\n')
    return {
      text: [
        '[工作台任务上下文]',
        `任务：${context.slug || context.name || '当前任务'}`,
        `目标：${context.intent || context.name || '围绕当前工作流完成交付'}`,
        `工作流：${context.workflowName || context.workflow || '未命名工作流'}`,
        agents ? `参与助手：${agents}` : '参与助手：未声明具体角色时禁止臆造',
        artifacts ? `产物：${artifacts}` : '产物：暂无或未同步',
        context.degraded ? '流程详情：暂不可用（请引导用户检查内容源设置）' : '',
        '',
        '【任务事实】',
        factualBrief || `状态：${context.status || '进行中'}\n当前节点：${context.currentNode || '流程执行中'}`,
        '',
        citationsPrompt,
        '',
        grounding,
        '',
        '请围绕该任务协助：需要审批/澄清时引导用户在本对话卡片或输入框完成；也可协助补充材料与解释状态。',
        '禁止建议用户查看 ingest/ 等任务输入路径作为产物。',
        '回答涉及工作内容时，正文用「依据：来源名」标注，并与上方可用来源对应。',
        '[工作台任务上下文结束]',
      ].filter((line) => line !== undefined && line !== null && line !== '').join('\n'),
      citations,
    }
  }

  async function enterWorkbenchTask(context = {}) {
    workbenchTaskContext = { ...context }
    if (surfaceMode !== 'workbench') return
    // 专家/工作流对话房已有绑定 Session，禁止再 fork「工作台 ·」指挥 Tab
    if (['expert-chat', 'workflow-chat'].includes(String(context.kind || ''))) return
    await activateSurfaceSession('workbench')
    if (!activeSession?.id) return
    const goal = `工作台 · ${context.intent || context.name || context.slug || '任务协作'}`
    if (activeSession.run?.goal !== goal) {
      const existing = sessions.find(session => session.run?.goal === goal)
      if (existing?.id) {
        await activateSession(existing.id)
      } else if (
        activeSession.run?.goal !== WORKBENCH_SESSION_GOAL
        || (activeSession.messages || []).length
      ) {
        await createNewAgent({ agentId: 'general', goal })
      }
    }
    if (!activeSession?.id) return
    const updated = await window.api.agentRunUpdate({
      sessionId: activeSession.id,
      goal,
      role: 'general',
    })
    if (updated?.ok && updated.session) activeSession = updated.session
    sessions = sessions.map(session => session.id === activeSession.id
      ? { ...session, displayTitle: goal }
      : session)
    syncDaemonHitlFromContext()
    syncComposerPlaceholder({ force: true })
    renderSessionTabs()
    renderChat()
  }

  function updateWorkbenchTaskContext(context = {}) {
    workbenchTaskContext = { ...context }
    if (surfaceMode === 'workbench') {
      if (aiInput && !aiInput.value.trim()) {
        syncComposerPlaceholder({ force: true })
      }
      updateComposerMeta()
      const hitlChanged = syncDaemonHitlFromContext()
      if (hitlChanged || !chatHistory.length) renderChat()
    }
  }

  function exitWorkbenchTask() {
    workbenchTaskContext = null
    setDaemonProcessFeed(null)
    if (surfaceMode === 'workbench') renderChat()
  }

  function daemonHitlNodeOf(payload) {
    if (!payload || typeof payload !== 'object') return ''
    return String(payload.node || payload.node_id || payload.nodeId || payload.id || '').trim()
  }

  function daemonHitlKey(kind, slug, node) {
    return `${String(slug || '').trim()}|${String(kind || '').trim()}|${String(node || '').trim()}`
  }

  function notifyDaemonHitlSubmitted(detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent('knowme-daemon-hitl-submitted', { detail }))
    } catch { /* ignore */ }
  }

  function resolveOpenDaemonHitl(exceptKey = '') {
    let changed = false
    for (const message of chatHistory) {
      if (message?.role !== 'daemon-hitl' || message.resolved) continue
      if (exceptKey && message.hitlKey === exceptKey) continue
      message.resolved = true
      message.statusText = message.statusText || '已处理'
      changed = true
    }
    return changed
  }

  function syncDaemonHitlFromContext() {
    if (surfaceMode !== 'workbench' || !workbenchTaskContext) {
      return resolveOpenDaemonHitl()
    }
    if (String(workbenchTaskContext.runMode || '') !== 'daemon') {
      return resolveOpenDaemonHitl()
    }
    const kind = String(workbenchTaskContext.waitingKind || 'none')
    if (kind !== 'gate' && kind !== 'clarification') {
      return resolveOpenDaemonHitl()
    }
    const slug = String(workbenchTaskContext.slug || '').trim()
    const payload = kind === 'gate' ? workbenchTaskContext.gate : workbenchTaskContext.clarification
    const node = daemonHitlNodeOf(payload)
    const briefApi = window.WorkbenchTaskBrief
    const clarifyDisplay = kind === 'clarification' && briefApi?.resolveClarificationDisplay
      ? briefApi.resolveClarificationDisplay(payload || {})
      : null
    const questions = Array.isArray(clarifyDisplay?.questions)
      ? clarifyDisplay.questions.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const title = kind === 'gate'
      ? String(payload?.title || workbenchTaskContext.waitingTitle || '需要你确认').trim()
      : String(
        questions.length > 1
          ? '待处理事项 · 请逐条回答'
          : (clarifyDisplay?.title || payload?.question || workbenchTaskContext.waitingTitle || '请补充任务所需信息'),
      ).trim()
    const detail = kind === 'clarification'
      ? String(clarifyDisplay?.detail || (questions.length === 1 ? '' : clarifyDisplay?.question || '')).trim()
      : String(workbenchTaskContext.waitingDetail || '').trim()
    const question = kind === 'clarification' ? String(clarifyDisplay?.question || '').trim() : ''
    const key = daemonHitlKey(kind, slug, node || title)
    let changed = resolveOpenDaemonHitl(key)
    const existing = chatHistory.find(message => message?.role === 'daemon-hitl' && message.hitlKey === key)
    if (existing) {
      if (existing.resolved) {
        existing.resolved = false
        existing.statusText = ''
        changed = true
      }
      if (existing.title !== title) {
        existing.title = title
        changed = true
      }
      if (existing.detail !== detail) {
        existing.detail = detail
        changed = true
      }
      if (existing.question !== question) {
        existing.question = question
        changed = true
      }
      const prevQuestions = Array.isArray(existing.questions) ? existing.questions.join('\n') : ''
      const nextQuestions = questions.join('\n')
      if (prevQuestions !== nextQuestions) {
        existing.questions = questions.slice()
        changed = true
      }
      if (existing.node !== node) {
        existing.node = node
        changed = true
      }
      return changed
    }
    chatHistory.push({
      role: 'daemon-hitl',
      hitlKey: key,
      kind,
      slug,
      node,
      title,
      question,
      questions,
      detail,
      resolved: false,
      statusText: '',
      text: title,
    })
    return true
  }

  function renderDaemonHitlBubble(message) {
    const kind = message.kind === 'gate' ? 'gate' : 'clarification'
    const resolved = !!message.resolved
    const questions = Array.isArray(message.questions)
      ? message.questions.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const kicker = kind === 'gate' ? '需要你确认' : '待处理事项'
    const nodeMeta = (kind === 'clarification' && message.node)
      ? `<div class="agent-daemon-hitl-meta">节点 ${escHtml(message.node)}</div>`
      : ''
    let bodyHtml = ''
    if (!resolved && kind === 'clarification' && questions.length > 1) {
      bodyHtml = `<ol class="agent-daemon-hitl-questions">${
        questions.map(q => `<li>${escHtml(q)}</li>`).join('')
      }</ol>`
    } else if (!resolved && kind === 'clarification' && questions.length === 1) {
      bodyHtml = `<div class="agent-daemon-hitl-title">${escHtml(questions[0]).replace(/\n/g, '<br>')}</div>`
    } else {
      const title = escHtml(message.title || (kind === 'gate' ? '需要你确认' : '请补充任务所需信息')).replace(/\n/g, '<br>')
      bodyHtml = `<div class="agent-daemon-hitl-title">${title}</div>`
      if (!resolved && message.detail) {
        bodyHtml += `<p class="agent-daemon-hitl-detail">${escHtml(message.detail).replace(/\n/g, '<br>')}</p>`
      }
    }
    let actions = ''
    if (!resolved && kind === 'gate') {
      actions = `<div class="agent-daemon-hitl-actions">
        <button type="button" class="agent-daemon-hitl-btn primary" data-daemon-hitl-decision="approve" data-hitl-key="${escHtml(message.hitlKey || '')}">通过</button>
        <button type="button" class="agent-daemon-hitl-btn" data-daemon-hitl-decision="revise" data-hitl-key="${escHtml(message.hitlKey || '')}">修订</button>
        <button type="button" class="agent-daemon-hitl-btn" data-daemon-hitl-decision="reject" data-hitl-key="${escHtml(message.hitlKey || '')}">打回</button>
      </div>`
    } else if (!resolved && kind === 'clarification') {
      actions = `<label class="agent-daemon-hitl-answer">
        <span class="agent-daemon-hitl-answer-label">你的答复</span>
        <textarea class="agent-daemon-hitl-input" rows="4" data-daemon-hitl-input="${escHtml(message.hitlKey || '')}" placeholder="逐条回答上面的问题，或写一段完整说明"></textarea>
      </label>
      <div class="agent-daemon-hitl-actions">
        <button type="button" class="agent-daemon-hitl-btn primary" data-daemon-hitl-clarify-submit="1" data-hitl-key="${escHtml(message.hitlKey || '')}">提交答复</button>
      </div>
      <p class="agent-daemon-hitl-hint">也可在底部输入框写好后点「提交答复」。仅询问「要补充什么」不会自动提交。</p>`
    } else if (resolved) {
      actions = `<p class="agent-daemon-hitl-hint">${escHtml(message.statusText || '已提交')}</p>`
    }
    return `<div class="agent-bubble assistant agent-daemon-hitl" data-hitl-key="${escHtml(message.hitlKey || '')}" data-hitl-kind="${kind}">
      <div class="agent-daemon-hitl-kicker">${kicker}</div>
      ${nodeMeta}
      ${bodyHtml}
      ${actions}
    </div>`
  }

  async function submitDaemonClarificationAnswer(answer) {
    const context = workbenchTaskContext || {}
    const clarification = context.clarification || {}
    const slug = String(context.slug || '').trim()
    const node = daemonHitlNodeOf(clarification)
    const text = String(answer || '').trim()
    if (!slug) return { ok: false, error: '当前任务缺少标识，无法提交回答' }
    if (!node) return { ok: false, error: '当前澄清节点缺少标识，无法提交回答' }
    if (!text) return { ok: false, error: '请先填写回答内容' }
    if (window.WorkbenchTaskBrief?.looksLikeClarificationMetaQuestion?.(text)) {
      return { ok: false, error: '这像是在询问要填什么，请先让助手说明，或直接写出要提交的答案后再点「提交澄清」' }
    }
    let res
    try {
      res = await window.api.workbenchDaemonClarify(slug, { node, answer: text })
    } catch (error) {
      res = { ok: false, error: error.message || '提交回答失败' }
    }
    if (!res || !res.ok) return { ok: false, error: (res && res.error) || '提交回答失败' }
    const key = daemonHitlKey('clarification', slug, node || clarification.question || '')
    for (const message of chatHistory) {
      if (message?.role === 'daemon-hitl' && message.hitlKey === key) {
        message.resolved = true
        message.statusText = '已提交回答，任务继续执行'
      }
    }
    notifyDaemonHitlSubmitted({ kind: 'clarification', slug, node, answer: text })
    return { ok: true }
  }

  async function submitDaemonGateDecision(decision, hitlKey = '') {
    const context = workbenchTaskContext || {}
    const gate = context.gate || {}
    const slug = String(context.slug || '').trim()
    const node = daemonHitlNodeOf(gate)
    const value = String(decision || '').trim()
    if (!slug) return { ok: false, error: '当前任务缺少标识，无法提交决定' }
    if (!node) return { ok: false, error: '当前审批节点缺少标识，无法提交决定' }
    if (!['approve', 'revise', 'reject'].includes(value)) {
      return { ok: false, error: '无效的审批决定' }
    }
    let res
    try {
      res = await window.api.workbenchDaemonGate(slug, { node, decision: value })
    } catch (error) {
      res = { ok: false, error: error.message || '提交决定失败' }
    }
    if (!res || !res.ok) return { ok: false, error: (res && res.error) || '提交决定失败' }
    const label = { approve: '通过', revise: '修订', reject: '打回' }[value] || value
    const key = hitlKey || daemonHitlKey('gate', slug, node)
    for (const message of chatHistory) {
      if (message?.role === 'daemon-hitl' && (!key || message.hitlKey === key)) {
        message.resolved = true
        message.statusText = `已提交：${label}`
      }
    }
    chatHistory.push({ role: 'user', text: `审批决定：${label}` })
    chatHistory.push({ role: 'system-note', text: `已提交 Gate 决定 · ${node} · ${label}` })
    notifyDaemonHitlSubmitted({ kind: 'gate', slug, node, decision: value })
    return { ok: true }
  }

  function bindDaemonHitlOnce() {
    if (bindDaemonHitlOnce.bound) return
    bindDaemonHitlOnce.bound = true
    document.addEventListener('click', (event) => {
      const clarifyBtn = event.target.closest('[data-daemon-hitl-clarify-submit]')
      if (clarifyBtn) {
        event.preventDefault()
        if (clarifyBtn.disabled) return
        const card = clarifyBtn.closest('.agent-daemon-hitl')
        const cardInput = card?.querySelector('[data-daemon-hitl-input]')
        const draft = String(cardInput?.value || aiInput?.value || '').trim()
        if (!draft) {
          toastFn('请先填写要提交的澄清内容', 'info')
          ;(cardInput || aiInput)?.focus()
          return
        }
        clarifyBtn.disabled = true
        void submitDaemonClarificationAnswer(draft).then((res) => {
          if (!res.ok) {
            clarifyBtn.disabled = false
            toastFn(res.error || '提交回答失败', 'error')
            return
          }
          chatHistory.push({ role: 'user', text: draft })
          chatHistory.push({ role: 'system-note', text: '已提交澄清回答，任务继续执行' })
          if (cardInput) cardInput.value = ''
          if (aiInput && String(aiInput.value || '').trim() === draft) aiInput.value = ''
          clearAttachment()
          resizeAiInput()
          renderChat()
          syncComposerPlaceholder({ force: true })
          updateComposerMeta()
          toastFn('已提交回答', 'success')
        })
        return
      }
      const btn = event.target.closest('[data-daemon-hitl-decision]')
      if (!btn) return
      event.preventDefault()
      if (btn.disabled) return
      const decision = btn.getAttribute('data-daemon-hitl-decision')
      const hitlKey = btn.getAttribute('data-hitl-key') || ''
      btn.disabled = true
      void submitDaemonGateDecision(decision, hitlKey).then((res) => {
        if (!res.ok) {
          btn.disabled = false
          toastFn(res.error || '提交决定失败', 'error')
          return
        }
        renderChat()
        toastFn('已提交决定', 'success')
      })
    })
  }

  function ensureDaemonProcessFeedMount() {
    if (!chatLog) return null
    let feed = document.getElementById('agentDaemonProcessFeed')
    if (!feed) {
      feed = document.createElement('div')
      feed.className = 'agent-daemon-process'
      feed.id = 'agentDaemonProcessFeed'
      feed.setAttribute('aria-label', '管线执行过程')
      feed.hidden = true
      chatLog.appendChild(feed)
    } else if (chatLog.lastElementChild !== feed) {
      // 与 Agent 对话同向：过程块挂在空态/消息之后，贴近输入框
      chatLog.appendChild(feed)
    }
    return feed
  }

  function scrollDaemonProcessLogToLatest(feed) {
    if (!feed) return
    const logBody = feed.querySelector('[data-daemon-process="logs"] .agent-daemon-process-body')
    if (logBody) logBody.scrollTop = logBody.scrollHeight
    const progressBody = feed.querySelector('#agentDaemonProcessProgress')
    if (progressBody) progressBody.scrollTop = progressBody.scrollHeight
  }

  function paintDaemonProcessFeed(transcript, options = {}) {
    const feed = ensureDaemonProcessFeedMount()
    if (!feed) return
    // 过程投影仅属工作台 Daemon 运行间；助理 surface 一律清空，避免与「开始使用」叠层
    if (surfaceMode !== 'workbench' || !transcript) {
      daemonProcessCache = null
      feed.hidden = true
      feed.innerHTML = ''
      agentCol?.classList.remove('has-daemon-process')
      return
    }
    daemonProcessCache = { transcript, options }
    agentCol?.classList.add('has-daemon-process')
    feed.hidden = false

    if (transcript.kind === 'chat-progress' || options.compact) {
      const ratio = Math.max(0, Math.min(100, Number(transcript.ratio) || 0))
      const barWidth = Math.max(ratio, ratio > 0 || transcript.done ? ratio : 4)
      const tip = String(transcript.tip || '').trim()
      const showTip = tip && transcript.statusLabel !== '已完成' && transcript.statusLabel !== '失败'
      feed.innerHTML = `
        <article class="agent-daemon-progress-card" aria-label="${escHtml(transcript.title || '管线进度')}">
          <div class="agent-daemon-progress-head">
            <strong>${escHtml(transcript.currentLabel || '管线任务')}</strong>
            <span class="agent-daemon-progress-status">${escHtml(transcript.statusLabel || '')}</span>
          </div>
          <div class="agent-daemon-progress-meta">${escHtml(transcript.progressLine || '')}</div>
          <div class="agent-daemon-progress-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
          ${showTip ? `<p class="agent-daemon-progress-tip">${escHtml(tip)}</p>` : ''}
          <div class="agent-daemon-progress-actions">
            <button type="button" class="agent-daemon-progress-link" data-daemon-open-logs="1">查看过程日志</button>
          </div>
        </article>`
      if (chatStickToBottom) scrollChatToBottomIfNeeded(true)
      return
    }

    const progressCollapsed = !!options.progressCollapsed
    const logsCollapsed = !!options.logsCollapsed
    const progressBody = transcript.progress?.empty
      ? `<div class="agent-daemon-process-empty">${escHtml(transcript.progress.emptyLabel)}</div>`
      : `<pre class="agent-daemon-process-pre">${escHtml(transcript.progress?.text || '')}</pre>`
    const logBody = transcript.logs?.empty
      ? `<div class="agent-daemon-process-empty">${escHtml(transcript.logs.emptyLabel)}</div>`
      : `<div class="agent-daemon-process-log-lines">${
        (transcript.logs?.lines || []).map(line => `<div class="agent-daemon-process-log-line">${escHtml(line)}</div>`).join('')
      }</div>`
    feed.innerHTML = `
      <article class="agent-daemon-process-card agent-msg" aria-label="管线进度摘要">
        <div class="agent-daemon-process-tip">${escHtml(transcript.tip || '')}</div>
        <section class="agent-daemon-process-block${progressCollapsed ? ' is-collapsed' : ''}" data-daemon-process="progress">
          <header class="agent-daemon-process-head">
            <strong>${escHtml(transcript.progress?.title || '过程')}</strong>
            <button type="button" class="agent-daemon-process-toggle" data-daemon-process-toggle="progress">
              ${progressCollapsed ? '展开摘要' : '收起摘要'}
            </button>
          </header>
          <div class="agent-daemon-process-body" id="agentDaemonProcessProgress">${progressBody}</div>
        </section>
        <section class="agent-daemon-process-block${logsCollapsed ? ' is-collapsed' : ''}" data-daemon-process="logs" id="agentDaemonProcessLogs">
          <header class="agent-daemon-process-head">
            <strong>${escHtml(transcript.logs?.title || '运行日志')}</strong>
            <button type="button" class="agent-daemon-process-toggle" data-daemon-process-toggle="logs">
              ${logsCollapsed ? '展开' : '收起'}
            </button>
          </header>
          <div class="agent-daemon-process-body">${logBody}</div>
        </section>
      </article>`
    scrollDaemonProcessLogToLatest(feed)
    if (options.focusLogs) {
      feed.querySelector('#agentDaemonProcessLogs')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else if (chatStickToBottom) {
      scrollChatToBottomIfNeeded(true)
    }
  }

  /**
   * Daemon 左栏过程投影：紧凑「管线进度」卡；全文日志仍在右侧「过程日志」Tab。
   */
  function setDaemonProcessFeed(transcript, options = {}) {
    paintDaemonProcessFeed(transcript, options)
  }

  function restoreDaemonProcessFeedAfterChatRender() {
    if (surfaceMode !== 'workbench' || !daemonProcessCache) {
      paintDaemonProcessFeed(null)
      return
    }
    paintDaemonProcessFeed(daemonProcessCache.transcript, {
      ...daemonProcessCache.options,
      focusLogs: false,
    })
  }

  function bindDaemonProcessFeedOnce() {
    if (bindDaemonProcessFeedOnce.bound) return
    bindDaemonProcessFeedOnce.bound = true
    document.addEventListener('click', e => {
      const openLogs = e.target.closest('[data-daemon-open-logs]')
      if (openLogs) {
        e.preventDefault()
        try {
          window.dispatchEvent(new CustomEvent('knowme-daemon-open-process-logs'))
        } catch { /* ignore */ }
        return
      }
      const btn = e.target.closest('[data-daemon-process-toggle]')
      if (!btn) return
      const kind = btn.getAttribute('data-daemon-process-toggle')
      const block = btn.closest('.agent-daemon-process-block')
      if (!block) return
      block.classList.toggle('is-collapsed')
      const collapsed = block.classList.contains('is-collapsed')
      btn.textContent = kind === 'progress'
        ? (collapsed ? '展开摘要' : '收起摘要')
        : (collapsed ? '展开' : '收起')
      if (daemonProcessCache) {
        daemonProcessCache.options = {
          ...daemonProcessCache.options,
          progressCollapsed: kind === 'progress' ? collapsed : !!daemonProcessCache.options.progressCollapsed,
          logsCollapsed: kind === 'logs' ? collapsed : !!daemonProcessCache.options.logsCollapsed,
        }
      }
    })
  }

  function setSurfaceMode(mode) {
    const nextMode = mode === 'workbench' ? 'workbench' : 'agent'
    if (sessionsLoaded && activeSession?.id && nextMode !== surfaceMode) {
      updateCurrentSurfaceUi(activeSession.id)
    }
    const switched = nextMode !== surfaceMode
    surfaceMode = nextMode
    // 切到助理时先丢掉 Daemon 过程投影，避免 renderChat restore 把过程卡叠回空态
    if (surfaceMode === 'agent') setDaemonProcessFeed(null)
    const agentCol = document.getElementById('agentCol')
    if (agentCol) agentCol.setAttribute('aria-label', surfaceMode === 'workbench' ? '工作台任务指挥' : '助手对话')
    // 先同步画出目标面 Tab，再灌内容；避免工作台→助理时闪现任务多签页
    if (sessionsLoaded && switched) paintSurfaceTabs(surfaceMode)
    syncComposerPlaceholder({ force: true })
    renderChat()
    // 助理 / 工作台各自恢复本面打开集合，避免任务 Session 残留在助理 Tab
    if (sessionsLoaded && switched) return activateSurfaceSession(surfaceMode)
    return Promise.resolve()
  }

  return {
    init,
    resetChat,
    renderChat,
    resumeSession,
    startExpertChat,
    startSkillChat,
    openArtifact,
    runStewardTemplate,
    setSurfaceMode,
    enterWorkbenchTask,
    updateWorkbenchTaskContext,
    exitWorkbenchTask,
    setDaemonProcessFeed,
  }
})()
