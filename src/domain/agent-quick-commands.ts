/** 助理空态快捷卡 + Ctrl+K 菜单共用（对齐 f6ad048 QUICK_ACTION_PROMPTS） */
export const ASSISTANT_QUICK_COMMANDS = [
  {
    id: 'meetingSummary',
    title: '会议总结',
    subtitle: '为我总结最近三天的会议',
    prompt: '请为我做会议总结：总结最近三天与我相关的会议。第一阶段仅展示候选会议列表：每场会议只显示一张可打开的飞书妙记卡片，会议标题、日期时间、组织者全部放在卡片内，卡片外不重复展示，不显示原始 minute_token/url，不要直接读取正文、不要直接总结；若首轮为 0 条先自动放宽关键词再检索一轮。第二阶段等我选择具体会议后，再调用 feishu.meeting_read 读取并输出会议总结（议题、结论、待办、责任人与时间点）和简要分析（对我相关、风险阻塞、建议下一步）。',
  },
  {
    id: 'todayPriority',
    title: '今日优先级',
    subtitle: '基于飞书日程/待办直接出 Top3',
    prompt: '请作为今日优先级助手：先调用 feishu.today_priority 拉取我今天的飞书日程、未完成待办与今日 @我 信号；拿到事实后立刻给出我现在先做的最多 3 件事（每项含优先级理由、预计耗时、第一步动作）。禁止先问三项澄清；仅当日程与待办都为空或无法判断时最多追问 1 句。不要索要文档 token。',
  },
  {
    id: 'docKbSuggest',
    title: '查文档/知识库',
    subtitle: '文件夹·记忆推荐·最近编辑/阅读',
    prompt: '请查文档/知识库：点击后直接执行。先检查飞书 user 授权；已授权则立刻调用 feishu.doc_kb_suggest，列出我的个人文件夹、可见知识库空间，以及依据个人记忆可能需要的文件（≤5）、最近自己编辑的文件（≤5）、最近自己阅读的文件（≤5）。首轮不要澄清提问、不要读取正文；等我选定后再深入读取或检索。',
  },
  {
    id: 'relatedChats',
    title: '分析跟我相关的聊天',
    subtitle: '今天：私聊/群聊主题与 @我',
    prompt: '请分析跟我相关的聊天：用飞书 CLI 读取我授权账号今天内的私聊与群聊主题及未读相关信息，特别确认并优先列出 @我 的内容，再整理待回应事项与建议下一步。输出风格保持克制专业：默认不使用 emoji 或装饰性图标，状态统一使用纯文本标签「[需确认]」「[高优先级]」「[可延后]」，不要堆叠图标或使用高情绪化表达。不要走会议文档或索要文档 token。',
  },
] as const

export type AssistantQuickCommand = (typeof ASSISTANT_QUICK_COMMANDS)[number]
