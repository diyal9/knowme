'use strict'

const { analyzeExpertPlanningReply } = require('../../shared/expert-planning-contract')

function compact(value, max) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function normalizeDiscussionContext(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    taskId: compact(source.taskId, 160),
    goal: compact(source.goal, 500),
    status: compact(source.status, 80),
    resultSummary: compact(source.resultSummary, 1200),
    deliverables: (Array.isArray(source.deliverables) ? source.deliverables : []).slice(-6).map(item => ({
      id: compact(item?.id, 160),
      title: compact(item?.title || '专业成果', 120),
      type: compact(item?.type || 'document', 60),
      version: Math.max(1, Number(item?.version) || 1),
      acceptanceStatus: compact(item?.acceptanceStatus || 'pending', 60),
      excerpt: compact(item?.excerpt, 1600),
    })),
    recentEvents: (Array.isArray(source.recentEvents) ? source.recentEvents : []).slice(-5).map(item => ({
      type: compact(item?.type, 80),
      summary: compact(item?.summary, 300),
    })).filter(item => item.type || item.summary),
  }
}

function formatDiscussionFacts(raw) {
  const context = normalizeDiscussionContext(raw)
  const deliverables = context.deliverables.length
    ? context.deliverables.map((item, index) => [
        `${index + 1}. ${item.title}（${item.type}，第 ${item.version} 版，${item.acceptanceStatus}）`,
        item.excerpt ? `   摘要：${item.excerpt}` : '',
      ].filter(Boolean).join('\n')).join('\n')
    : '暂无成果。'
  const events = context.recentEvents.length
    ? context.recentEvents.map(item => `- ${item.summary || item.type}`).join('\n')
    : '暂无关键事件。'
  return [
    `任务 ID：${context.taskId || '未提供'}`,
    `目标：${context.goal || '未填写'}`,
    `状态：${context.status || '未知'}`,
    `结果摘要：${context.resultSummary || '暂无'}`,
    '当前成果：',
    deliverables,
    '最近进展：',
    events,
  ].join('\n')
}

function formatPlanningCapabilities(raw = {}) {
  const skills = (Array.isArray(raw.skills) ? raw.skills : []).slice(0, 10)
  const connectors = (Array.isArray(raw.connectors) ? raw.connectors : []).slice(0, 8)
  const knowledgeRefs = (Array.isArray(raw.knowledgeRefs) ? raw.knowledgeRefs : []).slice(0, 8)
  const lines = ['【本专家可用于规划的能力（只读说明，不代表已经执行）】']
  lines.push('技能：')
  lines.push(skills.length
    ? skills.map(item => `- ${compact(item?.name || item?.id, 100)}${item?.description ? `：${compact(item.description, 220)}` : ''}${item?.status && item.status !== 'ready' ? `（${compact(item.reason || item.status, 100)}）` : ''}`).join('\n')
    : '- 暂无绑定技能')
  lines.push('连接器：')
  lines.push(connectors.length
    ? connectors.map(item => `- ${compact(item?.name || item?.id, 100)}：${item?.status === 'ready' ? '已安装，正式执行前仍需预检授权' : compact(item?.reason || item?.status || '状态未知', 120)}`).join('\n')
    : '- 暂无绑定连接器')
  lines.push(`知识范围：${knowledgeRefs.length ? knowledgeRefs.map(item => compact(item, 100)).join('、') : '使用专家默认知识范围'}`)
  const inputs = (Array.isArray(raw.inputContract) ? raw.inputContract : []).map(item => compact(item, 180)).filter(Boolean)
  const outputs = (Array.isArray(raw.outputContract) ? raw.outputContract : []).map(item => compact(item, 180)).filter(Boolean)
  if (inputs.length) lines.push(`输入契约：\n${inputs.map(item => `- ${item}`).join('\n')}`)
  if (outputs.length) lines.push(`输出契约：\n${outputs.map(item => `- ${item}`).join('\n')}`)
  lines.push('默认策略：数量、格式、详细风格等非阻塞偏好由专家采用推荐值；只有缺少会导致无法确定对象、数据源或交付物的条件时才询问用户。')
  if (raw.sop) lines.push(`工作方法（SOP）：\n${compact(raw.sop, 1400)}`)
  return lines.join('\n')
}

function inferPlanningDefaults(userText = '', planningCapabilities = {}) {
  const text = compact(userText, 1200)
  if (!text) return []
  const defaults = []
  if (/(今天|今日)/.test(text)) {
    defaults.push('时间范围已明确为：今天（按当前本地时间锚点执行，不再追问具体日期）。')
  } else if (/(昨天|昨日)/.test(text)) {
    defaults.push('时间范围已明确为：昨天（按当前本地时间锚点换算，不再追问具体日期）。')
  } else if (/(本周|这周)/.test(text)) {
    defaults.push('时间范围已明确为：本周（按当前本地时间锚点换算）。')
  } else if (/(上周)/.test(text)) {
    defaults.push('时间范围已明确为：上周（按当前本地时间锚点换算）。')
  } else if (/(最近|近\s*\d+\s*天)/.test(text)) {
    defaults.push('用户已表达相对时间范围；按原话解释，不要再泛问“从什么时候开始”。')
  }
  if (/(群消息|群聊|群里|群组|群)/.test(text)) {
    defaults.push('消息范围已明确为：群聊消息。')
  } else if (/(私聊|单聊)/.test(text)) {
    defaults.push('消息范围已明确为：私聊消息。')
  }
  if (/(全部消息|所有消息)/.test(text)) {
    defaults.push('消息范围已明确为：用户指定范围内的全部消息；不再追问“全部还是相关”。')
  } else if (/(跟我相关|与我相关|相关聊天|@我|未读)/.test(text)) {
    defaults.push('消息范围已明确为：与用户相关的消息，并优先关注 @我 和未读内容。')
  }
  const relatedChatSkill = (Array.isArray(planningCapabilities?.skills) ? planningCapabilities.skills : [])
    .some(item => /(related[-_ ]?chats|相关聊天|聊天整理|消息整理)/i.test(
      `${item?.id || ''} ${item?.name || ''} ${item?.description || ''}`,
    ))
  if (relatedChatSkill && /(飞书|消息|聊天)/.test(text)
    && !/(全部|所有|群消息|群聊|群|私聊|单聊|跟我相关|与我相关|相关聊天|@我|未读)/.test(text)) {
    defaults.push('未指定消息细分时，按“相关聊天”技能默认处理：与用户相关的消息，优先关注 @我、未读和待回应内容；不再追问“全部还是相关”。')
  }
  if (/(总结|汇总|整理|概括|梳理)/.test(text)) {
    defaults.push('交付偏好可按默认处理：先给结论/重点，再列待办、待回应事项和风险；不因未指定格式而停下来提问。')
  }
  return defaults
}

const PLANNING_EXECUTION_CLAIM_RE = /(?:正在|已(?:经)?|刚刚|现已)\s*(?:为你)?\s*(?:开始)?\s*(?:执行|检索|搜索|查询|读取|调用|同步|抓取|获取|生成)/i
const PLANNING_CONFIRMATION_RE = /^(?:确认|同意|好的?|可以|没问题|就按|按.+执行|开始(?:执行|生成|生图)?)/
const VAGUE_CLARIFICATION_RE = /(?:继续|请)?补充(?:尚未明确的)?(?:信息|内容|范围|需求)|(?:还有|仍有).*(?:不明确|未明确)/

function latestSpecificPlanningQuestion(history = []) {
  const assistant = [...(Array.isArray(history) ? history : [])]
    .reverse()
    .find(item => item?.role === 'assistant' && String(item?.text || '').trim())
  if (!assistant) return ''
  const lines = String(assistant.text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const questionIndex = lines.findLastIndex(line => /[?？]$/.test(line))
  if (questionIndex < 0) return ''
  const question = lines[questionIndex].replace(/^\s*(?:[-*•]|\d{1,2}[.)、])\s*/, '')
  if (VAGUE_CLARIFICATION_RE.test(question) || /确认.*(?:计划|方案).*(?:执行|生成)|是否按.*(?:计划|方案)/.test(question)) return ''
  const choices = lines.slice(questionIndex + 1, questionIndex + 5)
    .filter(line => /^(?:[-*•]|\d{1,2}[.)、]|[A-Da-d][.)、])\s*/.test(line))
  return compact([question, ...choices].join('\n'), 520)
}

function planningClarificationGuidance(question) {
  const source = String(question || '')
  if (/(主体|人物|角色|机器人|画面)/i.test(source)) {
    return { label: '画面主体', example: '可以直接回复：“一个拟人化桌面机器人，面向用户，手持文件夹”；没有偏好可回复“按专家推荐”。' }
  }
  if (/(风格|质感|色彩|氛围)/.test(source)) {
    return { label: '视觉风格', example: '可以直接回复风格关键词或参考对象，例如：“柔和的 3D 微质感，浅色背景”。' }
  }
  if (/(尺寸|比例|画幅|用途|场景)/.test(source)) {
    return { label: '用途与画幅', example: '可以直接回复使用位置和比例，例如：“用于 App 图标，1:1”。' }
  }
  if (/(时间|日期|今天|本周|最近)/.test(source)) {
    return { label: '时间范围', example: '可以直接回复具体时间段，例如：“本周一至今天”。' }
  }
  if (/(范围|群聊|私聊|消息|对象)/.test(source)) {
    return { label: '处理范围', example: '可以直接回复具体对象，例如：“只处理今天与我相关的群聊消息”。' }
  }
  if (/(材料|文件|链接|数据源)/.test(source)) {
    return { label: '输入材料', example: '请提供对应文件、链接或数据源；如果没有材料，请明确允许专家按现有信息继续。' }
  }
  if (/(交付|输出|结果|格式)/.test(source)) {
    return { label: '期望结果', example: '可以直接回复最终要拿到什么，例如：“一张可直接作为 App 图标的 PNG 图片”。' }
  }
  return { label: '上一个问题中的关键条件', example: '请直接给出具体对象、范围或期望结果；没有偏好时可回复“按专家推荐”。' }
}

/** 规划阶段没有工具句柄；出现执行态措辞时必须确定性纠正，不能让“假进度”进入会话。 */
function enforcePlanningNoExecutionClaims(value, context = {}) {
  const output = String(value || '').trim()
  if (!output) return output
  const planningAnalysis = analyzeExpertPlanningReply(output)
  const userText = compact(context.userText, 300)
  const normalizedUser = userText.replace(/[\s，,。.!！?？、；;：:]+/g, '')
  const executionClaim = PLANNING_EXECUTION_CLAIM_RE.test(output)
  const vagueClarification = VAGUE_CLARIFICATION_RE.test(output)
  const question = latestSpecificPlanningQuestion(context.history)
  const weakAnswer = Boolean(question)
    && /^(?:确认|继续|好的?|可以|没问题|开始|执行|不知道|不清楚)$/.test(normalizedUser)
    && !/(?:【?协作计划】?|执行计划)/.test(output)
  const mixedPlan = planningAnalysis.hasPlan && planningAnalysis.unresolved
  if (!executionClaim && !vagueClarification && !weakAnswer && !mixedPlan) return output
  if (executionClaim && PLANNING_CONFIRMATION_RE.test(normalizedUser) && !question) {
    return [
      '我已收到你的确认，但当前回合仍处于规划通道，尚未调用工具。',
      '请使用计划下方的“确认计划并执行”开始任务；如果按钮没有出现，请让我重新整理一份可执行计划。',
    ].join('\n\n')
  }
  const blockingQuestion = planningAnalysis.question || question
  const guidance = planningClarificationGuidance(blockingQuestion)
  return [
    '当前仍在规划阶段，尚未调用工具或开始数据检索。',
    `还缺：${planningAnalysis.missingField || guidance.label}`,
    mixedPlan ? '上一条回复同时包含计划和未决问题，计划暂不能确认。' : '你刚才的回答还不足以确定这一项。',
    blockingQuestion || '请具体说明本次要处理的对象或范围。',
    guidance.example,
  ].join('\n\n')
}

function buildExpertCollaborationBlocks({ mode, expertName, userText, discussionContext, planningCapabilities } = {}) {
  const name = compact(expertName || '当前专家', 120)
  const planning = mode === 'expert-planning'
  const execution = mode === 'expert-execution'
  const planningDefaults = planning ? inferPlanningDefaults(userText, planningCapabilities) : []
  const scene = planning
    ? `【专家协作｜规划阶段】
你是${name}。当前只澄清需求并形成可确认计划，不执行任务、不调用工具。
依据下方能力说明、SOP 和“本轮已识别参数”规划协作：先判断用户原话是否已经给出目标、对象/时间范围和交付动作。能从用户原话、上下文、能力说明或相对时间锚点推断的内容不得重复询问。
每次回复只能处于一种状态：待澄清，或可确认。只有缺少会导致无法选择数据源、无法确定处理对象或无法生成交付物的关键信息时，才输出“【待澄清】”并提问 1 个问题，不得在同一回复中输出“【协作计划】”或请用户确认；收件人、渠道、格式、详细偏好等非阻塞项应采用专家默认值，并在后续计划的风险中标注。
如果用户对上一问的回答仍不充分，必须使用“还缺：<具体字段>\n问题：<一个可以直接回答的问题>\n选项：<2-4 个互斥选项，标出推荐>\n回答示例：<一句可复制回答>”的结构；不得只说“请继续补充信息、范围或需求”。用户表示“不确定、都可以、你决定”时，对非阻塞偏好直接采用推荐默认值，不要重复追问。
如果“本轮已识别参数”已经覆盖任务目标、范围和交付动作，直接输出计划，不要再列“时间范围/范围界定/内容偏好”三项澄清。可以明确说明“正式执行时将使用”哪些技能或连接器，但绝不能声称正在或已经检索、读取、调用、同步、生成或执行。
信息充分后才输出“【协作计划】”，且回复中不得再包含要求用户补充的信息或非确认型问句。严格按以下字段输出：\n【协作计划】\n目标：一句话\n交付：具体成果\n验收：可判断标准\n能力：正式执行时将使用的技能、连接器或知识范围\n执行步骤：\n1. 任务相关步骤\n2. 任务相关步骤\n3. 任务相关步骤\n风险：必要时填写\n最后只请用户确认。避免“专业处理、自验证、质量复盘”等通用占位步骤。`
    : execution
      ? `【专家协作｜执行阶段】
你是${name}。当前任务已经进入正式执行：以已确认目标、任务事实、专家 SOP 和绑定能力为准，按依赖顺序推进。
只调用本轮工具面实际提供且完成任务所必需的能力；工具未提供、未授权或调用失败时如实说明阻塞，不用猜测替代执行结果。
任何“已读取、已发送、已创建、已完成”等结论必须有本轮成功工具结果或已保存成果作为证据。持续维护真实计划状态，未完成项不得标记完成。
输出围绕当前交付物和验收标准，不切回通用伙伴介绍，不重新发起首次需求澄清。`
      : `【专家协作｜成果讨论】
你是${name}。只解释已保存的任务与成果、回答问题、收集补充并整理修改意见；不调用工具、不重新执行任务、不声称完成新的操作。
事实不足时说明缺少什么，不得补造。回答结论优先、简洁专业；需要用户选择时最多提供四项。`
  const phase = planning ? 'planning' : execution ? 'execution' : 'discussion'
  const blocks = [{
    id: `scene.expert-${phase}`,
    kind: 'scene_instruction',
    authority: 'scene',
    priority: 98,
    maxTokens: 720,
    cachePolicy: 'session',
    content: scene,
    appliesTo: {
      scenes: ['expert-collaboration'],
      phases: [phase],
      // Execution still needs its scene contract when the selected model has
      // no tool surface; in that case it must report the missing capability
      // instead of silently degrading into a generic partner response.
      executionPolicies: execution ? ['tools-allowed', 'no-tools'] : ['no-tools'],
    },
    meta: { claims: { identity: name }, suppressOnConflict: false },
    source: { type: 'context-engine', id: `expert-${phase}`, version: '1' },
  }]
  if (planning && planningDefaults.length) {
    blocks.push({
      id: 'task.expert-planning-defaults',
      kind: 'task_fact',
      authority: 'data',
      trust: 'trusted',
      priority: 96,
      maxTokens: 420,
      cachePolicy: 'turn',
      content: `【本轮已识别参数】\n${planningDefaults.map(item => `- ${item}`).join('\n')}\n以上参数来自用户本轮原话，除非用户明确修正，不得再次追问。`,
      appliesTo: { scenes: ['expert-collaboration'], phases: ['planning'], executionPolicies: ['no-tools'] },
      source: { type: 'planning-understanding', id: 'user-text', version: '1' },
    })
  }
  if (planning && planningCapabilities) {
    blocks.push({
      id: 'task.expert-planning-capabilities',
      kind: 'task_fact',
      authority: 'data',
      trust: 'trusted',
      priority: 93,
      maxTokens: 2600,
      cachePolicy: 'session',
      content: formatPlanningCapabilities(planningCapabilities),
      appliesTo: { scenes: ['expert-collaboration'], phases: ['planning'], executionPolicies: ['no-tools'] },
      source: { type: 'expert-runtime', id: 'planning-capability-projection', version: '1' },
    })
  }
  if (!planning && discussionContext) {
    blocks.push({
      id: 'task.expert-discussion-facts',
      kind: 'task_fact',
      authority: 'data',
      trust: 'untrusted',
      priority: 92,
      maxTokens: 2600,
      cachePolicy: 'turn',
      sensitive: true,
      content: `【当前任务事实投影】\n${formatDiscussionFacts(discussionContext)}`,
      appliesTo: { scenes: ['expert-collaboration'], phases: ['discussion'] },
      source: { type: 'renderer-task-projection', id: compact(discussionContext.taskId, 160) },
    })
  }
  return blocks
}

module.exports = {
  compact,
  normalizeDiscussionContext,
  formatDiscussionFacts,
  formatPlanningCapabilities,
  inferPlanningDefaults,
  enforcePlanningNoExecutionClaims,
  buildExpertCollaborationBlocks,
}
