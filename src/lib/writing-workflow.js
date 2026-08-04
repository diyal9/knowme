'use strict'

const TASKS = [
  {
    id: 'requirements_doc',
    title: '需求文档草稿',
    label: '需求文档',
    re: /(需求文档|prd|产品需求|需求说明|验收标准|非目标|用户场景)/i,
    deliverables: ['背景', '目标', '范围', '非目标', '用户场景', '验收标准', '风险与待确认事项'],
    tone: '保持专业、边界清晰、结构先行，不做宣传式拔高。',
    askLimit: 3,
  },
  {
    id: 'office_doc',
    title: '办公文档草稿',
    label: '办公文档',
    re: /(办公文档|通知|汇报|周报|纪要|方案同步|同步消息|邮件|发给团队|会议纪要)/i,
    deliverables: ['合适文体', '完整正文', '更简洁发送版'],
    tone: '默认写成可直接发送版本，语气自然、节制、专业。',
    askLimit: 2,
  },
  {
    id: 'outline_draft',
    title: '提纲扩写成稿',
    label: '提纲成稿',
    re: /(提纲成稿|按提纲|扩写|扩成正文|补齐段落|根据提纲|大纲成稿)/i,
    deliverables: ['标题层级', '段落扩写', '过渡句', '待补事实标记'],
    tone: '围绕已有提纲补齐内容，不编造事实或数据。',
    askLimit: 2,
  },
  {
    id: 'finalize_doc',
    title: '排版定稿',
    label: '排版定稿',
    re: /(排版定稿|整理成定稿|统一格式|统一标题层级|行动项|最终版|可直接发送)/i,
    deliverables: ['标题层级', '列表规范', '结论与行动项', '可发送成稿'],
    tone: '优先整理结构、压缩重复表达、保留原意。',
    askLimit: 1,
  },
  {
    id: 'humanize',
    title: '润色去 AI 味',
    label: '去 AI 味',
    re: /(去 ai 味|去AI味|人性化|humanizer|humanize|模板腔|宣传腔|套话)/i,
    deliverables: ['最终版本', '消减的 AI 痕迹说明'],
    tone: '保留事实、术语和结构，只消减模板腔与空话。',
    askLimit: 1,
  },
  {
    id: 'polish_rewrite',
    title: '润色改写',
    label: '润色改写',
    re: /(润色改写|润色|改写|重写|精修|校对)/i,
    deliverables: ['基于材料的改写版本', '保留的事实与术语边界', '引用或依据说明（如有）'],
    tone: '基于已有正文与资料做专业润色，不扩写未证实事实，术语与口径保持一致。',
    askLimit: 1,
  },
]

const SOURCE_KIND_LABEL = {
  local: '本地目录',
  gitlab: 'GitLab 仓库',
  github: 'GitHub 仓库',
  web: '网页资料',
}

function buildActiveSourceHint(activeSource) {
  if (!activeSource?.displayName) return ''
  const kind = SOURCE_KIND_LABEL[activeSource.type] || activeSource.type || '内容源'
  const addr = activeSource.pageUrl || activeSource.remoteUrl || activeSource.rootPath || ''
  const addrLine = addr ? `\n- 地址：${String(addr).slice(0, 240)}` : ''
  return [
    '资料源提示：',
    `- 当前活跃内容源：${activeSource.displayName}（${kind}）${addrLine}`,
    '- 润色改写前 SHOULD 先用 read_file / grep_files / semantic_search 读取该源中的相关资料；',
    '- 若用户给出飞书链接，优先读取飞书正文；本地知识库与远程 RAG 命中亦应先吸收再改写；',
    '- 输出 MUST 标注哪些表述来自资料、哪些仍是待确认推断，不得把检索片段写成既定事实。',
  ].join('\n')
}

const HUMANIZER_RULES = [
  '去掉空泛拔高、象征意义堆叠和“这不仅仅是…而是…”式论述。',
  '避免宣传腔、广告腔和过度积极总结，不使用“赋能、至关重要、深度、显著提升、全面促进”等高频套话。',
  '避免机械三段排比、刻意换词和没有信息增量的总结句。',
  '保留事实、术语、边界、结论顺序和专业结构，不要把专业文档洗成口语散文。',
  '若缺少关键事实，只能用“待补”“待确认”标注，不得编造。',
]

function clean(text, max = 500) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function classifyWritingTask(prompt = '', displayPrompt = '', grounding = {}) {
  const source = `${displayPrompt}\n${prompt}\n${grounding?.goal || ''}\n${grounding?.title || ''}`
  for (const item of TASKS) {
    if (item.re.test(source)) return item
  }
  return null
}

function buildWritingPromptContext({
  prompt = '',
  displayPrompt = '',
  context = '',
  grounding = {},
  activeSource = null,
} = {}) {
  const task = classifyWritingTask(prompt, displayPrompt, grounding)
  if (!task) return ''
  const materialReady = clean(context, 120).length > 0
  const deliverables = task.deliverables.map(item => `- ${item}`).join('\n')
  const rules = HUMANIZER_RULES.map(item => `- ${item}`).join('\n')
  const sourceHint = buildActiveSourceHint(activeSource)
  return [
    '【写作办公搭档规则】',
    `当前任务：${task.label}`,
    `材料状态：${materialReady ? '已有正文或材料，可直接成稿' : '材料可能不完整，仅在必要时追问'}`,
    `追问上限：最多 ${task.askLimit} 个关键缺口；若信息已经足够，直接交付，不要先讲方法论。`,
    '事实约束：若已提供飞书正文、知识库检索结果、活跃内容源文件或远程 RAG 命中，必须先吸收其中的事实、术语、口径和限制，再开始改写；没有证据的事实不得补写。',
    sourceHint,
    '交付重点：',
    deliverables,
    `风格要求：${task.tone}`,
    '专业表达要求：优先保留业务术语、数字、边界、结论顺序与责任归属；润色只优化表达质量，不改写事实口径。',
    '默认去 AI 味处理（规则来自 Humanizer-zh 的本地化约束）：',
    rules,
  ].filter(Boolean).join('\n')
}

function shouldCreateWritingArtifact(text = '', task = null) {
  const src = String(text || '').trim()
  if (!src) return false
  const lines = src.split(/\r?\n/).filter(Boolean)
  const hasSections = /(^|\n)#{1,4}\s+/.test(src) || /(^|\n)(\d+\.|[-*])\s+/.test(src)
  if (task?.id === 'humanize') return false
  if (src.length >= 900) return true
  if (task && ['requirements_doc', 'outline_draft', 'finalize_doc'].includes(task.id) && src.length >= 480) return true
  return hasSections && lines.length >= 12 && src.length >= 360
}

function buildWritingArtifact(text = '', task = null) {
  const title = task?.title || '写作文稿'
  return {
    type: 'text',
    title,
    body: String(text || '').trim(),
    status: 'draft',
    meta: {
      workspaceAction: 'writing_review',
      allowFeishuDraft: true,
      writingTask: task?.id || 'generic',
      suggestedFeishuTitle: buildFeishuDraftTitle(task, text),
    },
  }
}

function buildFeishuDraftTitle(task = null, text = '') {
  const title = clean(String(text || '').split(/\r?\n/).find(line => /^#/.test(line)) || '', 80).replace(/^#+\s*/, '')
  if (title) return title
  return task?.title || 'KnowMe 文档草稿'
}

module.exports = {
  TASKS,
  HUMANIZER_RULES,
  SOURCE_KIND_LABEL,
  classifyWritingTask,
  buildActiveSourceHint,
  buildWritingPromptContext,
  shouldCreateWritingArtifact,
  buildWritingArtifact,
  buildFeishuDraftTitle,
}
