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
  const sessionTabsEl = document.getElementById('agentSessionTabs')
  const btnHistory = document.getElementById('agentHistoryBtn')
  const btnMore = document.getElementById('agentMoreBtn')
  const btnExpert = document.getElementById('agentExpertBtn')
  const expertPop = document.getElementById('agentExpertPop')
  const historyPop = document.getElementById('agentHistoryPop')
  const morePop = document.getElementById('agentMorePop')
  const tabCtxPop = document.getElementById('agentTabCtxPop')
  const quickCatsHost = document.getElementById('agentQuickCats')
  const quickItemsHost = document.getElementById('agentQuickItems')
  const feishuLinkMenu = document.getElementById('feishuLinkMenu')
  const agentImageViewer = document.getElementById('agentImageViewer')
  const agentImageViewerImg = document.getElementById('agentImageViewerImg')
  const agentImageViewerClose = document.getElementById('agentImageViewerClose')

  let chatHistory = []
  let runArtifacts = []
  let agents = []
  let catalogExperts = []
  let sessions = []
  let openSessionIds = []
  let activeAgentId = 'general'
  let activeSession = null
  let skillCatalog = []
  let slashOpen = false
  let slashActive = 0
  let slashQuery = ''
  let quickCatActive = 0
  let quickActive = 0
  let quickFocus = 'items'
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
  let surfaceSwitchNonce = 0
  let activeRunId = ''
  let runPermissionPrompted = new Set()

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

  function currentAgentModeId() {
    const raw = String(activeSession?.agentId || activeAgentId || 'general').trim()
    if (raw === 'steward' || raw === 'writing' || raw === 'coding') return raw
    return 'general'
  }

  function currentComposerPlaceholder() {
    if (surfaceMode === 'workbench') return '补充任务要求或材料；进度与审批请看右侧流程… @ 选文件'
    const mode = currentAgentModeId()
    return MODE_INPUT_EXPERIENCE[mode]?.placeholder || MODE_INPUT_EXPERIENCE.general.placeholder
  }

  function currentComposerIdleMeta() {
    if (surfaceMode === 'workbench') return 'Enter 发送 · Shift+Enter 换行 · @ 引用文件'
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
    codingExplain: { need: 'material', ask: '请把要解释的代码贴进输入框（或 @ 文件），我再讲清它的职责、流程与风险。' },
    codingFix: { need: 'material', ask: '请把报错信息连同相关代码贴进输入框（或 @ 文件），我来定位根因并给最小修复。' },
    codingImplement: { need: 'material', ask: '请用一句话说明要实现的需求（目标 + 约束），需要的话 @ 相关文件，我就给方案。' },
    codingDraftPatch: { need: 'material', ask: '请说明要改什么、涉及哪些文件（可 @ 文件），我再按文件产出改动草案与回归清单。' },
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

  function availableExperts() {
    const base = Array.isArray(agents) && agents.length ? agents : fallbackExperts
    const hubExperts = Array.isArray(catalogExperts) ? catalogExperts : []
    const merged = new Map()
    for (const item of base) {
      merged.set(String(item.id || ''), {
        id: String(item.id || ''),
        name: String(item.name || item.title || item.id || '未命名专家'),
        description: String(item.description || item.persona?.role || '处理相关工作任务'),
        source: 'agent',
      })
    }
    for (const item of hubExperts) {
      const id = String(item.id || '').trim()
      if (!id) continue
      merged.set(id, {
        id,
        name: String(item.name || id),
        description: String(item.description || ''),
        source: 'expert',
      })
    }
    return [...merged.values()].filter(item => item.id)
  }

  function renderExpertPop() {
    if (!expertPop) return
    expertPop.innerHTML = availableExperts().map(item => `
      <button type="button" class="agent-pop-item agent-expert-item${item.id === activeAgentId ? ' active' : ''}" data-expert-id="${escHtml(item.id)}">
        <span class="ico" data-icon="${iconForAgent(item.id)}" style="width:14px;height:14px;flex-shrink:0"></span>
        <span class="expert-copy"><span class="expert-name">${escHtml(item.name)}</span><span class="expert-desc">${escHtml(item.description)}</span></span>
      </button>`).join('')
    if (window.StickyIcons) window.StickyIcons.mount(expertPop)
  }

  async function selectExpert(agentId) {
    const expert = availableExperts().find(item => item.id === agentId)
    if (!expert) return
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    hideHeadPops()
    await createNewAgent(expert.source === 'expert'
      ? { agentId: 'general', expertId: expert.id }
      : { agentId: expert.id })
    renderQuickMenuForAgent(expert.source === 'expert' ? 'general' : expert.id)
    toastFn(`已切换到${expert.name}`)
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
    const top = Math.max(0, (firstBubble.offsetTop || 0) - 8)
    chatLog.scrollTo({ top, behavior: 'smooth' })
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
        : `<span class="ico" data-icon="${iconForAgent(meta.agentId)}"></span>`
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
    chatHistory = (activeSession.messages || []).map(m => ({
      role: m.role,
      text: m.text,
      trace: Array.isArray(m.trace) ? m.trace.map(item => ({ ...item })) : [],
      toolCallId: m.toolCallId,
      toolName: m.toolName,
      status: m.status,
      durationMs: m.durationMs,
    }))
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
    renderChat()
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
    toastFn('当前版本暂不支持产物审阅', 'error')
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
    const agentLabel = availableExperts().find(item => item.id === activeSession.agentId)?.name
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

  async function activateSurfaceSession(mode, fallbackId = '') {
    if (!sessionsLoaded) return
    const nonce = ++surfaceSwitchNonce
    const state = surfaceUi[mode]
    openSessionIds = state.openIds.filter(id => sessions.some(s => s.id === id))
    const savedId = sessions.some(s => s.id === state.activeId) ? state.activeId : ''
    const targetId = savedId
      || openSessionIds[0]
      || (mode === 'agent' && sessions.some(s => s.id === fallbackId) ? fallbackId : '')
    if (targetId) {
      if (!openSessionIds.includes(targetId)) openSessionIds.unshift(targetId)
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
      openKnowledgePanel?.('知识库 · 整理 Wiki')
      chatHistory.push({
        role: 'system-note',
        text: '请在知识库面板粘贴文本并「吸收到 Wiki」，或先在面板查看现有条目。',
      })
      renderChat()
      return
    }

    if (kind === 'promote') {
      const list = await window.api.knowledgeOsList()
      const first = (list.wiki || [])[0]
      if (!first) {
        toastFn('暂无 Wiki 条目，请先整理/吸收', 'error')
        openKnowledgePanel?.()
        return
      }
      const promo = await window.api.knowledgeOsPromote({ wikiPath: first.path, title: first.title })
      if (!promo?.ok) { toastFn(promo?.error || '升格失败', 'error'); return }
      const added = await window.api.agentArtifactAdd({
        sessionId: activeSession.id,
        artifact: promo.artifact,
      })
      if (!added?.ok) { toastFn(added?.error || '写入产物失败', 'error'); return }
      runArtifacts = added.session?.run?.artifacts || [promo.artifact]
      await window.api.agentRunUpdate({
        sessionId: activeSession.id,
        toolsUsed: ['okf.promote'],
      })
      chatHistory.push({
        role: 'system-note',
        text: `已为「${first.title}」生成 OKF 升格提案，请在右侧审阅后接受或拒绝。`,
      })
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
        <span class="ico" data-icon="${iconForAgent(s.agentId)}" style="width:14px;height:14px;flex-shrink:0"></span>
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

  async function loadSessions() {
    if (!window.api?.agentSessionList) return
    const result = await window.api.agentSessionList()
    agents = result.agents || []
    sessions = result.sessions || []
    const persistedOpenIds = result.ui?.openSessionIds || []
    const activeId = result.ui?.activeSessionId || persistedOpenIds[0]
    sessionsLoaded = true
    const workbenchIds = new Set(surfaceUi.workbench.openIds)
    if (surfaceUi.workbench.activeId) workbenchIds.add(surfaceUi.workbench.activeId)
    if (!surfaceUi.agent.openIds.length) {
      surfaceUi.agent.openIds = persistedOpenIds.filter(id => !workbenchIds.has(id))
    }
    if (!surfaceUi.agent.activeId && activeId && !workbenchIds.has(activeId)) {
      surfaceUi.agent.activeId = activeId
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

  /** 流式：稳定块走 MD；未闭合围栏 / 未完成表格 / 半行暂挂纯文本，减轻表格回流闪屏 */
  function splitStreamingMarkdown(src) {
    const text = String(src || '')
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    let splitAt = lines.length

    let fenceCount = 0
    let openFenceAt = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) {
        fenceCount++
        if (fenceCount % 2 === 1) openFenceAt = i
      }
    }
    if (fenceCount % 2 === 1 && openFenceAt >= 0) {
      splitAt = Math.min(splitAt, openFenceAt)
    }

    // 尾部连续表格行且尚未以空行结束 → 整段表格暂挂
    let end = lines.length - 1
    if (end >= 0 && !String(lines[end] || '').trim() && end > 0) {
      // 末尾空行：其前的表格视为已闭合，不暂挂
    } else {
      let tableStart = -1
      let i = end
      while (i >= 0 && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tableStart = i
        i--
      }
      if (tableStart >= 0) splitAt = Math.min(splitAt, tableStart)
    }

    // 不以换行结尾：最后一行仍在输入中
    if (text.length && !text.endsWith('\n') && lines.length) {
      splitAt = Math.min(splitAt, lines.length - 1)
    }

    if (splitAt < 0) splitAt = 0
    return {
      stable: lines.slice(0, splitAt).join('\n'),
      tail: lines.slice(splitAt).join('\n'),
    }
  }

  function renderStreamingMarkdown(src) {
    const { stable, tail } = splitStreamingMarkdown(src)
    const md = stable ? renderMarkdown(stable) : ''
    const tailHtml = tail ? `<span class="md-stream-tail">${escHtml(tail)}</span>` : ''
    return `<div class="chat-text agent-md">${md}${tailHtml}</div>`
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

  function isThinkingJson(data, lang = '') {
    if (!data || typeof data !== 'object' || isSuggestionLikeJson(data)) return false
    const langTag = String(lang || '').toLowerCase()
    if (/(thinking|reasoning|analysis|thought|mind|思考|推理)/i.test(langTag)) return true

    const typeLike = `${data.type || ''} ${data.kind || ''} ${data.stage || ''} ${data.category || ''}`
    if (/(thinking|reasoning|analysis|thought|思考|推理|分析)/i.test(typeLike)) return true

    const titleLike = `${data.title || ''} ${data.name || ''} ${data.label || ''}`
    if (/(thinking|reasoning|analysis|thought|思考|推理|分析)/i.test(titleLike)) return true

    const keys = Object.keys(data).map(k => k.toLowerCase())
    const markers = new Set([
      'thinking', 'reasoning', 'analysis', 'thought', 'thoughts',
      'steps', 'plan', 'assumptions', 'risks', 'observations',
      'next_action', 'nextaction', 'nextstep',
    ])
    const hitCount = keys.reduce((count, key) => count + (markers.has(key) ? 1 : 0), 0)
    return hitCount >= 2
  }

  function deriveThinkingTitle(data) {
    if (!data || typeof data !== 'object') return '思考过程 JSON'
    const candidate = String(data.title || data.name || data.phase || data.stage || '').trim()
    if (!candidate) return '思考过程 JSON'
    const clipped = candidate.slice(0, 42)
    return clipped || '思考过程 JSON'
  }

  function parseThinkingBlocks(src) {
    const text = String(src || '')
    const re = /```([a-zA-Z0-9_:+\-]*)[ \t]*\r?\n([\s\S]*?)```/g
    const blocks = []
    let m
    while ((m = re.exec(text))) {
      const lang = String(m[1] || '').trim()
      const inner = String(m[2] || '').trim()
      if (!inner) continue
      const data = tryParseJson(inner)
      if (!isThinkingJson(data, lang)) continue
      blocks.push({
        start: m.index,
        end: m.index + m[0].length,
        title: deriveThinkingTitle(data),
        data,
      })
    }
    if (!blocks.length) return { bodyWithoutThinking: text, blocks: [] }
    let body = text
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i]
      body = `${body.slice(0, block.start)}${body.slice(block.end)}`
    }
    body = body.replace(/\n{3,}/g, '\n\n').trim()
    return { bodyWithoutThinking: body, blocks }
  }

  function renderThinkingBlock(block) {
    const title = escHtml(block?.title || '思考过程 JSON')
    const json = escHtml(JSON.stringify(block?.data || {}, null, 2))
    return `<details class="agent-thinking-json" open>
      <summary><span class="agent-thinking-badge">思考过程</span><span class="agent-thinking-title">${title}</span></summary>
      <pre>${json}</pre>
    </details>`
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

  function assistantBodyHtml(m, messageIdx = -1) {
    const normalizedText = normalizeAssistantOutput(m.text)
    if (m.streaming) {
      const streamText = isRelatedChatsResult(m)
        ? normalizeRelatedChatsResultMarkdown(normalizedText)
        : normalizedText
      return renderStreamingMarkdown(streamText)
    }
    const parse = (window.AgentSuggestion && window.AgentSuggestion.parseSuggestionBlock)
      ? window.AgentSuggestion.parseSuggestionBlock
      : (t) => ({ bodyWithoutBlock: t, bar: null })
    const emptyTodayPriority = hasEmptyTodayPriorityFacts(m)
    const parsed = parse(normalizedText)
    const bodyWithoutBlock = emptyTodayPriority
      ? emptyTodayPriorityBody()
      : parsed.bodyWithoutBlock
    const bar = emptyTodayPriority ? null : parsed.bar
    const { bodyWithoutThinking, blocks } = parseThinkingBlocks(bodyWithoutBlock)
    const thinking = blocks.map(renderThinkingBlock).join('')
    const bodyMarkdown = isRelatedChatsResult(m)
      ? normalizeRelatedChatsResultMarkdown(bodyWithoutThinking)
      : bodyWithoutThinking
    const md = bodyMarkdown
      ? `<div class="chat-text agent-md">${renderMarkdown(bodyMarkdown)}</div>`
      : ''
    const fallback = md
      ? ''
      : renderAssistantEmptyResultFallback(m)
    const followups = renderModeFollowups(m, messageIdx, !!bar)
    return `${thinking}${md}${fallback}${followups}${renderSuggestionBar(bar, m.suggestionChosenIndex)}`
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
    const labels = {
      'search_knowledge': { pending: '正在查找知识库资料', done: '资料查找完成', error: '资料查找失败' },
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
    const raw = String(item.title || item.toolName || '工具调用').trim()
    if (status === 'error') return `${raw}失败`
    if (status === 'done') return raw
    return raw.startsWith('正在') ? raw : `正在${raw}`
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

  function renderExecutionTimeline(m) {
    const trace = Array.isArray(m.trace) ? m.trace : []
    const planHtml = renderPlanChecklist(m.plan)
    if (!trace.length && !planHtml) return ''
    const elapsedMs = Number.isFinite(m.elapsedMs)
      ? m.elapsedMs
      : (m.streaming && Number.isFinite(m.startedAt) ? Date.now() - m.startedAt : 0)
    const toolCount = trace.filter(item => item.kind === 'tool').length
    const errorCount = trace.filter(item => item.status === 'error').length
    const rounds = new Set(trace.map(item => Number(item.round)).filter(Number.isFinite))
    const pending = trace.some(item => item.status === 'pending') || (m.plan?.items || []).some(item => item.status === 'pending' || item.status === 'doing')
    const summaryTitle = pending ? '执行进度' : '执行过程'
    const summaryMeta = pending
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
      const status = item.status === 'error' ? 'error' : item.status === 'pending' ? 'pending' : 'done'
      const friendlyTitle = item.kind === 'tool'
        ? toolTimelineTitle(item, status)
        : groundingApi().userStatusLabel(item.title || '正在处理', status)
      const head = `<span class="agent-trace-mark">${traceStatusIcon(status)}</span><span class="agent-trace-title">${escHtml(friendlyTitle)}</span>`
      const detail = String(item.summary || '').trim()
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
      if (item.kind === 'tool' && detail) {
        const resultLabel = status === 'error' ? '查看错误' : sources.length ? `查看 ${sources.length} 条资料` : '查看结果'
        return `${roundLabel}${withSig(`<details class="agent-trace-row tool ${status}"><summary aria-label="${escHtml(`${friendlyTitle}，${status === 'pending' ? '进行中' : status === 'error' ? '未完成' : '已完成'}`)}">${head}<span class="agent-trace-result-label">${escHtml(resultLabel)}</span>${duration}</summary><pre>${escHtml(detail)}</pre>${sourceCards}</details>`)}`
      }
      return `${roundLabel}${withSig(`<div class="agent-trace-row ${item.kind} ${status}" aria-label="${escHtml(`${friendlyTitle}，${status === 'pending' ? '进行中' : status === 'error' ? '未完成' : '已完成'}`)}">${head}${duration}${detail ? `<span class="agent-trace-hint">${escHtml(detail)}</span>` : ''}${sourceCards}</div>`)}`
    }).join('')
    const keepExpanded = pending || m.streaming
    return `<details class="agent-execution${pending ? ' is-running' : ''}" data-execution-timeline="1"${keepExpanded ? ' open' : ''}>
      <summary class="agent-execution-summary">${pending ? '<span class="agent-execution-orb" aria-hidden="true"></span>' : '<span class="agent-execution-check" aria-hidden="true">✓</span>'}<span class="agent-execution-title">${escHtml(summaryTitle)}</span>${summaryMeta ? `<span class="agent-execution-meta">${escHtml(summaryMeta)}</span>` : ''}</summary>
      ${planHtml}
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
    if (curPlan && nextPlan) {
      syncTextNode(curPlan.querySelector('.agent-plan-head'), nextPlan.querySelector('.agent-plan-head'))
      reconcileKeyedChildren(curPlan.querySelector('.agent-plan-list'), nextPlan.querySelector('.agent-plan-list'))
    } else if (nextPlan) {
      current.insertBefore(nextPlan, curList || null)
    } else if (curPlan) {
      curPlan.remove()
    }

    if (curList && nextList) reconcileKeyedChildren(curList, nextList)
    else if (nextList) current.appendChild(nextList)
    else curList?.remove()
    return true
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
    } else {
      timeline?.remove()
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

  function renderEmptyState() {
    const renderShortcutCards = mode => {
      const cards = Array.isArray(EMPTY_SHORTCUT_PRESETS[mode]) ? EMPTY_SHORTCUT_PRESETS[mode] : []
      return cards.map(card => `
        <button type="button" class="agent-empty-act" data-auto-send="1" data-shortcut="${escHtml(card.id)}">
          <strong>${escHtml(card.title)}</strong><span>${escHtml(card.subtitle)}</span>
        </button>`).join('')
    }
    if (surfaceMode === 'workbench') {
      const task = workbenchTaskContext || {}
      const goal = task.intent || task.name || task.slug || '当前工作'
      const workflow = task.workflowName || task.workflow || '待确认流程'
      const current = task.currentNode || '流程执行中'
      const agents = Array.isArray(task.agents) && task.agents.length
        ? task.agents.join(' · ')
        : '由流程按需调度'
      const statusLines = String(task.factualBrief || '').trim()
        ? String(task.factualBrief).split('\n').slice(0, 4).map(line => `<div class="agent-empty-tip"><span class="tip-label">事实</span><span class="tip-key">${escHtml(line)}</span></div>`).join('')
        : ''
      return `<div class="agent-empty-tips agent-empty-workbench" aria-label="任务协作入口">
        <div class="agent-empty-kicker">当前工作</div>
        <div class="agent-empty-hero">${escHtml(goal)}</div>
        <div class="agent-empty-sub">进度与审批请在右侧流程面板操作。这里只补充要求、附材料或调用 Agent，不臆造流程外角色。</div>
        <div class="agent-workbench-steps">
          <div><span>01</span><strong>工作流</strong><small>${escHtml(workflow)}</small></div>
          <div><span>02</span><strong>当前节点</strong><small>${escHtml(current)}</small></div>
          <div><span>03</span><strong>参与助手</strong><small>${escHtml(agents)}</small></div>
        </div>
        ${statusLines}
        <div class="agent-empty-tip"><span class="tip-label">推进任务</span><span class="tip-key">右侧 · 通过/修订/澄清</span></div>
        <div class="agent-empty-tip"><span class="tip-label">补充材料</span><span class="tip-key">@ 文件</span></div>
        <div class="agent-empty-tip"><span class="tip-label">飞书查询</span><span class="tip-key">${escHtml(feishuUsageHint)}</span></div>
      </div>`
    }
    if (activeSession?.agentId === 'steward') {
      return `<div class="agent-empty-tips agent-empty-home agent-empty-steward" aria-label="知识管家入口">
        <div class="agent-empty-hero">公司知识协作</div>
        <div class="agent-empty-sub">先查约定、整理 Wiki，再对话。也可直接输入问题。</div>
        <div class="agent-empty-actions">
          <button type="button" class="agent-empty-act" data-steward="ingest"><strong>整理本地 Wiki</strong><span>吸收材料到知识根</span></button>
          <button type="button" class="agent-empty-act" data-steward="lint"><strong>知识健康检查</strong><span>断链 / 空文 / 重复标题</span></button>
          <button type="button" class="agent-empty-act" data-steward="promote"><strong>升格 OKF</strong><span>Wiki → 可交换概念（需审阅）</span></button>
          <button type="button" class="agent-empty-act" data-steward="remote-rag"><strong>检索远程知识库</strong><span>MCP 读取 RAG 知识库</span></button>
        </div>
      </div>`
    }
    if (activeSession?.agentId === 'coding') {
      return `<div class="agent-empty-tips agent-empty-home" aria-label="编程模式入口">
      <div class="agent-empty-hero">编程协作搭档</div>
      <div class="agent-empty-sub">点一个研发任务立即开工；也可直接贴代码或报错。</div>
      <div class="agent-empty-actions">
        ${renderShortcutCards('coding')}
      </div>
    </div>`
    }
    if (activeSession?.agentId === 'writing') {
      return `<div class="agent-empty-tips agent-empty-home" aria-label="写作模式入口">
      <div class="agent-empty-hero">写作办公搭档</div>
      <div class="agent-empty-sub">点一个日常文档任务立即开工；也可直接贴提纲、草稿或材料。</div>
      <div class="agent-empty-actions">
        ${renderShortcutCards('writing')}
      </div>
    </div>`
    }
    return `<div class="agent-empty-tips agent-empty-home" aria-label="任务入口">
      <div class="agent-empty-hero">智能办公搭档</div>
      <div class="agent-empty-sub">点一个任务立即开工；也可直接输入你的目标。</div>
      <div class="agent-empty-actions">
        ${renderShortcutCards('general')}
      </div>
    </div>`
  }

  function resolveEmptyShortcutPrompt(button) {
    if (!button || !button.dataset) return ''
    const shortcutId = String(button.dataset.shortcut || '').trim()
    if (shortcutId && EMPTY_SHORTCUT_PROMPTS[shortcutId]) return String(EMPTY_SHORTCUT_PROMPTS[shortcutId]).trim()
    return String(button.dataset.p || '').trim()
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
    if (/(智能体|bot|助手|agent)/i.test(src)) return { mentions: true, kind: 'agent' }
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

  function renderChat() {
    const shouldFollow = !chatLog
      || chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 96
    if (streamPaintRaf) {
      cancelAnimationFrame(streamPaintRaf)
      streamPaintRaf = 0
      streamPaintIdx = null
    }
    lastStreamHtml = ''
    if (!chatHistory.length && !runArtifacts.length) {
      chatLog.innerHTML = renderEmptyState()
      if (topicNav) topicNav.innerHTML = ''
      syncConversationAnchorPosition()
      updateContextMeter()
      syncThinkingTicker()
      syncWorkSurface({ autoOpen: false })
      return
    }
    const artHtml = runArtifacts.map((a, i) => renderArtifactCard(a, i)).join('')
    const userTurns = chatHistory.reduce((count, msg) => count + (msg.role === 'user' ? 1 : 0), 0)
    const metaHtml = userTurns > 0 ? renderConversationMeta() : ''
    const msgHtml = chatHistory.map((m, i) => {
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
      if (m.role === 'tool') return ''
      const streamCls = m.streaming ? ' streaming' : ''
      const waiting = m.streaming && !String(m.text || '').trim()
      if (waiting) {
        const hasTrace = Array.isArray(m.trace) && m.trace.length > 0
        const elapsed = Number.isFinite(m.elapsedMs)
          ? m.elapsedMs
          : (Number.isFinite(m.startedAt) ? Math.max(0, Date.now() - m.startedAt) : 0)
        const status = hasTrace
          ? ''
          : `<span class="thinking-status" data-thinking-status role="status"><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span><span data-thinking-label>${escHtml(groundingApi().userStatusLabel(m.activity || '正在处理'))}${elapsed > 0 ? ` · ${formatElapsed(elapsed)}` : ''}</span></span>`
        return `<div class="agent-bubble assistant streaming thinking${hasTrace ? ' has-execution' : ''}" data-idx="${i}" aria-busy="true">${renderExecutionTimeline(m)}${status}</div>`
      }
      const cursor = m.streaming ? '<span class="stream-cursor">▍</span>' : ''
      const personalization = (!m.streaming && m.text) ? renderPersonalizationMeta(m) : ''
      const actions = (!m.streaming && m.text) ? assistantActionsHtml(i) : ''
      const body = assistantBodyHtml(m, i)
      const resultCls = isRelatedChatsResult(m) ? ' related-chats-result' : ''
      return `<div class="agent-bubble assistant${streamCls}${resultCls}" data-idx="${i}">${renderExecutionTimeline(m)}${body}${cursor}${personalization}${actions}</div>`
    }).join('')
    chatLog.innerHTML = `${artHtml}${msgHtml}`
    if (topicNav) topicNav.innerHTML = metaHtml
    if (window.StickyIcons) window.StickyIcons.mount(chatLog)
    syncConversationAnchorPosition()
    scrollChatToBottomIfNeeded(shouldFollow)
    updateContextMeter()
    syncThinkingTicker()
    syncWorkSurface({ autoOpen: true })
  }

  function scrollChatToBottomIfNeeded(force) {
    if (!chatLog) return
    if (force) {
      chatLog.scrollTop = chatLog.scrollHeight
      return
    }
    const gap = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight
    if (gap < 96) chatLog.scrollTop = chatLog.scrollHeight
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

  function isStreamTail(node) {
    return node?.nodeType === Node.ELEMENT_NODE && node.classList.contains('md-stream-tail')
  }

  /** 逐个子节点比对，只替换变化的块；尾行走 textContent 原地更新，避免整块重排闪屏 */
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
      if (isStreamTail(cur) && isStreamTail(next)) {
        if (cur.textContent !== next.textContent) cur.textContent = next.textContent
        continue
      }
      if (cur.nodeType === Node.ELEMENT_NODE && next.nodeType === Node.ELEMENT_NODE
        && cur.outerHTML === next.outerHTML) continue
      cur.replaceWith(next)
    }
    for (let i = nexts.length; i < olds.length; i++) olds[i].remove()
  }

  /** 首个正文 token 到达：就地把思考气泡升级为正文气泡，避免整页重绘 */
  function upgradeThinkingBubble(bubble, m, html) {
    const wrap = document.createElement('div')
    wrap.innerHTML = html
    const textNode = wrap.firstElementChild
    if (!textNode) return false
    bubble.classList.remove('thinking', 'has-execution')
    if (isRelatedChatsResult(m)) bubble.classList.add('related-chats-result')
    bubble.querySelector('[data-thinking-status]')?.remove()
    bubble.appendChild(textNode)
    const cursor = document.createElement('span')
    cursor.className = 'stream-cursor'
    cursor.textContent = '▍'
    bubble.appendChild(cursor)
    if (window.StickyIcons) window.StickyIcons.mount(bubble)
    return true
  }

  function paintStreamText(idx) {
    const bubble = chatLog.querySelector(`[data-idx="${idx}"]`)
    const m = chatHistory[idx]
    if (!m?.streaming) return
    if (!bubble) { renderChat(); return }
    const textEl = bubble.querySelector('.chat-text')
    if (!textEl || bubble.classList.contains('thinking')) {
      const firstHtml = renderStreamingMarkdown(m.text)
      if (!textEl && upgradeThinkingBubble(bubble, m, firstHtml)) {
        lastStreamHtml = firstHtml
        scrollChatToBottomIfNeeded(false)
        return
      }
      lastStreamHtml = ''
      renderChat()
      return
    }
    const html = renderStreamingMarkdown(m.text)
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

  function setQuickMenuOpen(open) {
    const next = !!open
    aiQuickMenu?.classList.toggle('show', next)
    aiQuickMenu?.setAttribute('aria-hidden', String(!next))
    aiQuickBtn?.setAttribute('aria-expanded', String(next))
  }

  function hideAiMenus() {
    setQuickMenuOpen(false)
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

  function quickCats() {
    return aiQuickMenu ? Array.from(aiQuickMenu.querySelectorAll('[data-quick-cat-key]')) : []
  }

  function quickItems() {
    return aiQuickMenu
      ? Array.from(aiQuickMenu.querySelectorAll('[data-quick-cat][data-p], [data-quick-cat][data-steward]'))
      : []
  }

  function quickMenuSectionsForAgent(agentId = '') {
    return QUICK_MENU_PROFILES[String(agentId || '').trim()] || QUICK_MENU_PROFILES.general
  }

  function renderQuickMenuForAgent(agentId = activeAgentId) {
    if (!quickCatsHost || !quickItemsHost) return
    const sections = quickMenuSectionsForAgent(agentId)
    quickCatsHost.innerHTML = sections.map((section, index) => `
      <button class="agent-menu-item" type="button" role="menuitem" data-quick-cat-key="${escHtml(section.key)}" data-quick-cat-index="${index}">
        <span class="ico" data-icon="${escHtml(section.icon || 'list')}" style="width:14px;height:14px"></span>
        <span>${escHtml(section.label)}</span>
      </button>
    `).join('')
    quickItemsHost.innerHTML = sections.flatMap(section =>
      (section.items || []).map(item => `
        <button class="agent-menu-item" type="button" role="menuitem" data-quick-cat="${escHtml(section.key)}" data-quick-label="${escHtml(item.label || '快捷操作')}" ${item.prompt ? `data-p="${escHtml(item.prompt)}"` : ''} ${item.steward ? `data-steward="${escHtml(item.steward)}"` : ''}>
          <span class="ico" data-icon="${escHtml(item.icon || 'note')}" style="width:14px;height:14px"></span>
          <span>${escHtml(item.label || '快捷操作')}</span>
        </button>
      `)
    ).join('')
    if (window.StickyIcons) StickyIcons.mount(aiQuickMenu)
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
    const taskId = PROMPT_TO_TASK.get(prompt)
    if (taskId && TASK_PREFLIGHT[taskId]) {
      void runTaskCard(taskId, label)
      return
    }
    void runOfficeShortcut(prompt, label)
  }

  function currentQuickCatKey() {
    const cats = quickCats()
    if (!cats.length) return ''
    if (quickCatActive < 0) quickCatActive = cats.length - 1
    if (quickCatActive >= cats.length) quickCatActive = 0
    return String(cats[quickCatActive].dataset.quickCatKey || '')
  }

  function visibleQuickItems() {
    return quickItems().filter(btn => !btn.hidden)
  }

  function renderQuickActive() {
    const cats = quickCats()
    const catKey = currentQuickCatKey()
    if (aiQuickMenu) {
      aiQuickMenu.classList.toggle('quick-focus-cats', quickFocus === 'cats')
      aiQuickMenu.classList.toggle('quick-focus-items', quickFocus === 'items')
    }
    cats.forEach((cat, idx) => {
      const selected = idx === quickCatActive
      cat.classList.toggle('active', selected && quickFocus === 'cats')
      cat.classList.remove('is-current')
    })

    const allItems = quickItems()
    allItems.forEach(btn => {
      const belongs = String(btn.dataset.quickCat || '') === catKey
      btn.hidden = !belongs
    })

    const items = visibleQuickItems()
    if (!items.length) return
    if (quickActive < 0) quickActive = items.length - 1
    if (quickActive >= items.length) quickActive = 0
    items.forEach((item, idx) => {
      const selected = idx === quickActive
      item.classList.toggle('active', selected && quickFocus === 'items')
      item.classList.remove('is-current')
    })
  }

  function handleQuickMenuKeydown(e) {
    if (!aiQuickMenu?.classList.contains('show')) return false
    const cats = quickCats()
    const items = visibleQuickItems()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (quickFocus === 'cats') {
        quickCatActive = (quickCatActive + 1) % Math.max(cats.length, 1)
        quickActive = 0
      }
      else quickActive = (quickActive + 1) % Math.max(items.length, 1)
      renderQuickActive()
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (quickFocus === 'cats') {
        quickCatActive = (quickCatActive - 1 + Math.max(cats.length, 1)) % Math.max(cats.length, 1)
        quickActive = 0
      }
      else quickActive = (quickActive - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)
      renderQuickActive()
      return true
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      quickFocus = 'cats'
      renderQuickActive()
      return true
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      quickFocus = 'items'
      renderQuickActive()
      return true
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (quickFocus === 'cats') {
        quickFocus = 'items'
        quickActive = 0
        renderQuickActive()
        return true
      }
      const active = items[quickActive] || items[0]
      if (active) runQuickAction(active)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      hideAiMenus()
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
      toastFn('当前版本暂不支持该建议动作', 'error')
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
    if (spec.need === 'feishuAuth') {
      const connector = await readFeishuConnector()
      const status = connector?.status || {}
      const state = String(status.state || '').toLowerCase()
      const ready = !!connector?.enabled && state !== 'auth_required' && status.userReady !== false
      return { ok: ready, reason: 'feishuAuth' }
    }
    return { ok: true }
  }

  // 缺内容时：推一句话询问（不调用 LLM），并按需暂存任务，等用户补齐后自动执行
  function askForTaskContent(spec, prompt, label) {
    if (spec?.reason === 'material' || spec?.need === 'material') {
      pendingShortcut = { prompt: String(prompt || '').trim(), label: String(label || '').trim() }
    } else {
      pendingShortcut = null
    }
    chatHistory.push({ role: 'system-note', text: String(spec?.ask || '请补充需要的内容后再试。') })
    renderChat()
    try { aiInput?.focus() } catch { /* noop */ }
  }

  // 任务卡片统一入口：先 preflight，齐备则走增强执行路径，缺内容就一句话询问
  async function runTaskCard(taskId, label = '') {
    hideAiMenus()
    if (aiSend?.disabled) { toastFn('当前助手正在生成，请稍候'); return }
    const prompt = String(EMPTY_SHORTCUT_PROMPTS[taskId] || QUICK_ACTION_PROMPTS[taskId] || '').trim()
    if (!prompt) return
    const spec = TASK_PREFLIGHT[taskId]
    if (spec) {
      const ready = await taskContextReady(spec)
      if (!ready.ok) {
        askForTaskContent({ ...spec, reason: ready.reason }, prompt, label)
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
    renderQuickMenuForAgent(activeAgentId)
    setQuickMenuOpen(true)
    quickCatActive = 0
    quickActive = 0
    quickFocus = 'cats'
    renderQuickActive()
    aiInput.focus()
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

  async function runAI(options = {}) {
    if (activeRunId) {
      await window.api.aiCancelRun?.(activeRunId)
      return
    }
    let promptText = String(options?.promptText || '').trim()
    let displayPromptOpt = String(options?.displayPrompt || '')
    // 手动发送时若存在暂存的快捷任务且已补齐素材，则自动带上该任务指令继续
    if (!promptText) {
      if (pendingShortcut && String(aiInput?.value || '').trim()) {
        promptText = pendingShortcut.prompt
        displayPromptOpt = pendingShortcut.label
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
      activity: '正在准备上下文…',
      startedAt: Date.now(),
      elapsedMs: 0,
      trace: [],
    })
    const assistantIdx = chatHistory.length - 1
    renderChat()
    setSendButtonMode('running')
    updateComposerMeta()
    aiInput.value = ''
    clearAttachment()
    resizeAiInput()
    if (slashOpen) hideSlashMenu()
    if (atOpen) hideAtMenu()

    const ctx = await getEditorContext()
    if (!ctx.ok && ctx.error) {
      chatHistory.splice(assistantIdx, 1)
      chatHistory.push({ role: 'error', text: ctx.error })
      renderChat()
      setPresenceState('error')
      if (activeRunId === runId) activeRunId = ''
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

    let gotStream = false
    let streamUpdateCount = 0
    const resolveAssistantRef = () => {
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const message = chatHistory[i]
        if (message?.role === 'assistant' && message.runId === runId) return { idx: i, message }
      }
      return null
    }
    const offEvent = window.api.onAiStreamEvent
      ? window.api.onAiStreamEvent(event => {
          if (!event || event.runId !== runId) return
          const assistantRef = resolveAssistantRef()
          if (!assistantRef) return
          const { idx: messageIdx, message } = assistantRef
          if (event.type === 'content') {
            gotStream = true
            streamUpdateCount++
            message.text = String(event.text || '')
            message.activity = '正在生成回答…'
            if (Number.isFinite(message.startedAt)) message.elapsedMs = Math.max(0, Date.now() - message.startedAt)
            updateStreamText(messageIdx)
            return
          }
          if (event.type === 'stage' || event.type === 'fallback') {
            if (event.contextInfo && typeof event.contextInfo === 'object') {
              lastContextInfo = event.contextInfo
              renderModelUsage()
            }
            message.activity = groundingApi().userStatusLabel(String(event.title || event.activity || '正在处理…'))
            if (Number.isFinite(message.startedAt)) message.elapsedMs = Math.max(0, Date.now() - message.startedAt)
            upsertAssistantTrace(message, {
              id: event.id || `stage_${event.stage || 'working'}`,
              kind: 'stage',
              title: event.title || event.activity || '正在处理',
              status: event.status || 'pending',
              summary: event.summary,
              durationMs: event.durationMs,
            })
            refreshAssistantProgress(messageIdx)
            return
          }
          if (event.type === 'plan.updated') {
            message.plan = event.plan && typeof event.plan === 'object'
              ? {
                  version: event.plan.version,
                  updatedAt: event.plan.updatedAt,
                  remaining: event.plan.remaining,
                  items: Array.isArray(event.plan.items) ? event.plan.items.slice(0, 12) : [],
                }
              : message.plan
            message.activity = '正在按计划执行…'
            refreshAssistantProgress(messageIdx)
            return
          }
          if (event.type === 'tool.started' || event.type === 'tool.completed' || event.type === 'tool.failed') {
            const failed = event.type === 'tool.failed'
            const pending = event.type === 'tool.started'
            if (failed && event.needsPermission) {
              void maybeOfferRunPermissionUpgrade(event)
            }
            message.activity = pending
              ? toolTimelineTitle({
                  toolName: event.toolName,
                  title: String(event.title || '正在处理相关操作'),
                }, 'pending')
              : message.activity
            if (Number.isFinite(message.startedAt)) message.elapsedMs = Math.max(0, Date.now() - message.startedAt)
            upsertAssistantTrace(message, {
              id: event.id || event.toolCallId,
              kind: 'tool',
              title: event.title || event.toolName || '工具调用',
              status: pending ? 'pending' : failed ? 'error' : 'done',
              summary: event.summary,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              durationMs: event.durationMs,
            })
            refreshAssistantProgress(messageIdx)
            return
          }
          if (event.type === 'done' || event.type === 'error' || event.type === 'cancelled') {
            message.activity = event.type === 'cancelled' ? '已停止生成' : ''
            if (Number.isFinite(message.startedAt)) message.elapsedMs = Math.max(0, Date.now() - message.startedAt)
            for (const item of message.trace || []) {
              if (item.status === 'pending') item.status = event.type === 'error' ? 'error' : 'done'
            }
            renderChat()
          }
        })
      : () => {}
    const offChunk = window.api.onAiStreamChunk(({ text }) => {
      gotStream = true
      streamUpdateCount++
      const assistantRef = resolveAssistantRef()
      if (!assistantRef) return
      assistantRef.message.text = text
      updateStreamText(assistantRef.idx)
    })
    const priorHistory = chatHistory.slice(0, -2)
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.text && !m.streaming)
      .map(m => ({ role: m.role, text: m.text }))
    const skillRefs = [...prompt.matchAll(/(^|\s)\/([a-z0-9][a-z0-9\-]{0,31})\b/gi)].map(m => m[2].toLowerCase())

    try {
      const attachedContext = attachment
        ? `\n\n[用户附加文件：${attachment.name || '未命名文件'}]\n${attachment.text}\n[附加文件结束]`
        : ''
      const taskContext = surfaceMode === 'workbench' && workbenchTaskContext
        ? `\n\n${workbenchContextText(workbenchTaskContext)}\n\n`
        : ''
      const result = await window.api.aiGenerate({
        prompt,
        displayPrompt,
        context: `${taskContext}${(ctx.content || '').trim()}${attachedContext}`.trim() || null,
        history: priorHistory,
        noteId: ctx.noteId,
        category: ctx.category || '',
        skillRefs,
        contentGrounding,
        sessionId: activeSession?.id,
        agentId: activeAgentId,
        runId,
      })
      offEvent()
      offChunk()
      if (result.error) {
        if (result.cancelled) {
          const assistantRef = resolveAssistantRef()
          if (assistantRef) {
            assistantRef.message.streaming = false
            assistantRef.message.activity = '已停止生成'
            renderChat()
          }
            setPresenceState('error')
          return
        }
        const assistantRef = resolveAssistantRef()
        if (assistantRef) chatHistory.splice(assistantRef.idx, 1)
        chatHistory.push({ role: 'error', text: result.error })
        renderChat()
        setPresenceState('error')
        return
      }
      const finalText = (result.text || '').trim()
      const latestSession = result.sessionId ? await window.api.agentSessionGet(result.sessionId) : null
      if (latestSession?.ok && latestSession.session?.run) {
        runArtifacts = Array.isArray(latestSession.session.run.artifacts) ? [...latestSession.session.run.artifacts] : runArtifacts
      }
      const streamedButSingleFlush = !!result.streamed && streamUpdateCount <= 1
      let assistantRef = resolveAssistantRef()
      if (!assistantRef) return
      if ((!gotStream || streamedButSingleFlush) && finalText) {
        await revealTypewriter(assistantRef.idx, finalText, runId)
        assistantRef = resolveAssistantRef()
        if (!assistantRef) return
      } else {
        assistantRef.message.text = finalText
      }
      assistantRef.message.streaming = false
      assistantRef.message.activity = ''
      if (Number.isFinite(assistantRef.message.startedAt)) {
        assistantRef.message.elapsedMs = Math.max(0, Date.now() - assistantRef.message.startedAt)
      }
      if (Array.isArray(result.personalization?.applied) && result.personalization.applied.length) {
        assistantRef.message.personalization = {
          applied: result.personalization.applied,
          omitted: Array.isArray(result.personalization.omitted) ? result.personalization.omitted : [],
        }
      }
      if (activeSession) {
        activeSession.messages = chatHistory
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, text: m.text }))
        activeSession.updatedAt = new Date().toISOString()
        const firstUser = activeSession.messages.find(m => m.role === 'user')
        const previewRaw = contentGrounding.active
          ? contentGrounding.title
          : (firstUser ? String(firstUser.text).replace(/\s+/g, ' ').trim().slice(0, 28) : '新助手')
        const preview = compactSessionDisplayTitle(previewRaw) || '新助手'
        sessions = sessions.map(s => s.id === activeSession.id
          ? {
              ...s,
              displayTitle: preview,
              labels: contentGrounding.labels || [],
              grounding: contentGrounding.text || '',
              updatedAt: activeSession.updatedAt,
              messageCount: activeSession.messages.length,
            }
          : s)
        activeSession = {
          ...activeSession,
          displayTitle: preview,
          labels: contentGrounding.labels || [],
          grounding: contentGrounding.text || '',
        }
        renderSessionTabs()
      }
      renderChat()
      setPresenceState('success')
    } catch (err) {
      offEvent()
      offChunk()
      const assistantRef = resolveAssistantRef()
      if (assistantRef) chatHistory.splice(assistantRef.idx, 1)
      chatHistory.push({ role: 'error', text: err.message || '生成失败' })
      renderChat()
      setPresenceState('error')
    } finally {
      offEvent()
      if (activeRunId === runId) activeRunId = ''
      setSendButtonMode('send')
      updateComposerMeta()
    }
  }

  function bindEvents() {
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
    })
    topicNav?.addEventListener('click', e => {
      const anchorBtn = e.target.closest('[data-conversation-anchor]')
      if (!anchorBtn) return
      e.preventDefault()
      const userMsgIdx = Number(anchorBtn.dataset.userMsgIdx)
      jumpToConversationAnchor(Number.isInteger(userMsgIdx) ? userMsgIdx : null)
    })
    chatLog?.addEventListener('click', async e => {
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
      const officeBtn = e.target.closest('.agent-empty-act[data-auto-send="1"]')
      if (officeBtn) {
        e.preventDefault()
        const shortcutId = String(officeBtn.dataset.shortcut || '').trim()
        const title = officeBtn.querySelector('strong')?.textContent?.trim() || ''
        const sub = officeBtn.querySelector(':scope > span')?.textContent?.trim() || ''
        if (shortcutId && (EMPTY_SHORTCUT_PROMPTS[shortcutId] || QUICK_ACTION_PROMPTS[shortcutId])) {
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
      if (aiQuickMenu?.classList.contains('show')) setQuickMenuOpen(false)
      else showQuickMenu()
    })
    aiQuickMenu?.addEventListener('click', e => {
      e.stopPropagation()
      const catBtn = e.target.closest('[data-quick-cat-key]')
      if (catBtn) {
        const cats = quickCats()
        const idx = cats.indexOf(catBtn)
        if (idx >= 0) {
          quickCatActive = idx
          quickActive = 0
          quickFocus = 'items'
          renderQuickActive()
        }
        return
      }
      const btn = e.target.closest('[data-quick-cat][data-p], [data-quick-cat][data-steward]')
      if (btn) runQuickAction(btn)
    })
    aiQuickMenu?.addEventListener('mousemove', e => {
      const catBtn = e.target.closest('[data-quick-cat-key]')
      if (catBtn) {
        const cats = quickCats()
        const idx = cats.indexOf(catBtn)
        if (idx >= 0 && idx !== quickCatActive) {
          quickCatActive = idx
          quickActive = 0
          renderQuickActive()
        }
        quickFocus = 'cats'
        return
      }
      const btn = e.target.closest('[data-quick-cat][data-p], [data-quick-cat][data-steward]')
      if (btn && !btn.hidden) {
        const items = visibleQuickItems()
        const idx = items.indexOf(btn)
        if (idx >= 0 && idx !== quickActive) {
          quickActive = idx
          renderQuickActive()
        }
        quickFocus = 'items'
      }
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
        if (aiQuickMenu?.classList.contains('show')) setQuickMenuOpen(false)
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
    renderQuickMenuForAgent(activeAgentId)
    if (window.api?.listSkills || window.knowme?.skill?.list) ensureSkillCatalog()
    if (window.knowme?.expert?.list || window.api?.expertList) ensureExpertCatalog()
    refreshFeishuUsageHint({ rerender: true })
    window.addEventListener('focus', () => { refreshFeishuUsageHint({ rerender: true }) })
    if (window.StickyIcons) StickyIcons.mount(document.getElementById('agentCol'))
    updateComposerMeta()
    loadLlmProfile()
    loadSessions()
  }

  function resetChat() {
    chatHistory = []
    runArtifacts = []
    lastContextInfo = null
    renderChat()
  }

  function workbenchContextText(context = {}) {
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
            clarification: context.waitingKind === 'clarification' ? { question: context.waitingTitle } : null,
          }).factualBrief
        : '')
    const grounding = briefApi
      ? briefApi.workbenchGroundingRules()
      : [
          '【工作台任务事实门禁 · 必须遵守】',
          '只能引用下方任务事实；禁止编造财务/法务/运营等未声明角色；不足则说明本地工作流未提供。',
          '禁止把任务输入路径当作产物推荐。',
        ].join('\n')
    return [
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
      grounding,
      '',
      '请围绕该任务协助：优先引导用户在流程面板完成审批/澄清；对话侧只处理补充要求、材料与助手调用。',
      '禁止建议用户查看 ingest/ 等任务输入路径作为产物。',
      '[工作台任务上下文结束]',
    ].filter((line) => line !== undefined && line !== null && line !== '').join('\n')
  }

  async function enterWorkbenchTask(context = {}) {
    workbenchTaskContext = { ...context }
    if (surfaceMode !== 'workbench') return
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
      if (!chatHistory.length) renderChat()
    }
  }

  function exitWorkbenchTask() {
    workbenchTaskContext = null
    if (surfaceMode === 'workbench') renderChat()
  }

  function setSurfaceMode(mode) {
    const nextMode = mode === 'workbench' ? 'workbench' : 'agent'
    if (sessionsLoaded && activeSession?.id && nextMode !== surfaceMode) {
      updateCurrentSurfaceUi(activeSession.id)
    }
    surfaceMode = nextMode
    const agentCol = document.getElementById('agentCol')
    if (agentCol) agentCol.setAttribute('aria-label', surfaceMode === 'workbench' ? '工作台任务指挥' : '助手对话')
    syncComposerPlaceholder({ force: true })
    renderChat()
    if (surfaceMode === 'agent') activateSurfaceSession(surfaceMode)
  }

  return {
    init,
    resetChat,
    renderChat,
    resumeSession,
    openArtifact,
    runStewardTemplate,
    setSurfaceMode,
    enterWorkbenchTask,
    updateWorkbenchTaskContext,
    exitWorkbenchTask,
  }
})()
