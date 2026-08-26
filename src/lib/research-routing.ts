'use strict'

/**
 * Real-time research routing.
 *
 * The first pass only promotes an intent tier. The second pass runs after the
 * real tool surface is projected, so source descriptions never advertise a
 * disabled connector or a tool filtered by governance/allowlist.
 */

const FRESHNESS_RE = /(今天|今日|最新|近期|最近|刚刚|实时|本周|这周|本月|这个月|当前|截至|动态|资讯|新闻|进展|更新)/i
const RESEARCH_RE = /(资讯|新闻|动态|进展|更新|趋势|消息|公告|政策|行情|市场|舆情|发布|发生了什么|看下|看看|查下|查一下|搜下|搜一下|检索|调查|research|news|latest|recent|today)/i
const NEWS_RE = /(资讯|新闻|动态|消息|快讯|舆情|news)/i
const INTERNAL_RE = /(公司|团队|内部|项目|飞书|知识库|文档|会议|纪要|工作区|组织)/i
const PUBLIC_RE = /(全网|公开|互联网|网页|新闻|资讯|行业|市场|官网|媒体|public|web)/i
const FALSE_POSITIVE_RE = /(动态效果|动态规划|动态类型|动态链接库|css\s*动画|motion|animation)/i
const SEARCH_HINT_RE = /(search|query|retriev|lookup|find|搜索|检索|查询|查找)/i
const WEB_FETCH_HINT_RE = /(fetch_web_page|网页.*读取|read.*web|fetch.*page)/i
const KNOWLEDGE_HINT_RE = /(knowledge|wiki|rag|知识库|文档搜索)/i

function normalizeText(value, max = 800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function selectResearchPrompt({ prompt = '', displayPrompt = '' } = {}) {
  return normalizeText(displayPrompt) || normalizeText(prompt)
}

function classifyResearchIntent(prompt = '') {
  const text = normalizeText(prompt)
  if (!text || FALSE_POSITIVE_RE.test(text)) {
    return {
      active: false,
      scope: 'none',
      mode: 'web',
      recencyDays: null,
      needsFreshness: false,
    }
  }
  const needsFreshness = FRESHNESS_RE.test(text)
  const active = needsFreshness && RESEARCH_RE.test(text)
  if (!active) {
    return {
      active: false,
      scope: 'none',
      mode: 'web',
      recencyDays: null,
      needsFreshness,
    }
  }

  const internal = INTERNAL_RE.test(text)
  const external = PUBLIC_RE.test(text)
  const scope = internal && external ? 'mixed' : (internal ? 'internal' : 'public')
  let recencyDays = 7
  if (/(今天|今日|刚刚|实时|today)/i.test(text)) recencyDays = 1
  else if (/(本月|这个月)/.test(text)) recencyDays = 30

  return {
    active: true,
    scope,
    mode: NEWS_RE.test(text) ? 'news' : 'web',
    recencyDays,
    needsFreshness: true,
  }
}

function promoteIntentTier(tier, prompt) {
  const current = String(tier || 'chat')
  if (current !== 'chat') return current
  return classifyResearchIntent(prompt).active ? 'assist' : current
}

function getResearchMeta(record = {}) {
  return record._knowme?.research || record.contract?.research || null
}

function classifyToolRecord(record = {}) {
  const name = String(record?.function?.name || record?.name || '').trim()
  if (!name) return null
  const description = normalizeText(record?.function?.description || record?.description, 500)
  const contract = record._knowme || record.contract || {}
  const capability = String(contract.capability || '')
  const semantic = getResearchMeta(record)

  if (semantic?.kind) {
    return {
      toolName: name,
      kind: String(semantic.kind),
      scope: String(semantic.scope || 'external'),
      label: String(semantic.label || description || name).slice(0, 100),
      source: String(contract.source || 'builtin'),
      preferred: semantic.preferred === true,
    }
  }

  const haystack = `${name} ${description} ${capability}`
  if (name === 'search_knowledge' || KNOWLEDGE_HINT_RE.test(haystack) && SEARCH_HINT_RE.test(haystack)) {
    return {
      toolName: name,
      kind: 'knowledge-search',
      scope: name.startsWith('feishu.') ? 'internal' : 'knowledge',
      label: description || name,
      source: String(contract.source || 'builtin'),
      preferred: false,
    }
  }
  if (WEB_FETCH_HINT_RE.test(haystack)) {
    return {
      toolName: name,
      kind: 'web-fetch',
      scope: 'public',
      label: description || name,
      source: String(contract.source || 'builtin'),
      preferred: false,
    }
  }
  if (SEARCH_HINT_RE.test(haystack)) {
    const publicLike = /(web|news|internet|网页|新闻|资讯)/i.test(haystack)
    return {
      toolName: name,
      kind: publicLike ? 'web-search' : 'connector-search',
      scope: publicLike ? 'public' : 'external',
      label: description || name,
      source: String(contract.source || 'connector'),
      preferred: false,
    }
  }
  return null
}

function discoverResearchSources(toolRecords = []) {
  const records = Array.isArray(toolRecords) ? toolRecords : []
  const sources = []
  const seen = new Set()
  for (const record of records) {
    const source = classifyToolRecord(record)
    if (!source || seen.has(source.toolName)) continue
    seen.add(source.toolName)
    sources.push(source)
  }
  return sources.sort((a, b) => Number(b.preferred) - Number(a.preferred)
    || a.toolName.localeCompare(b.toolName))
}

function buildResearchContext(intent, sources) {
  if (!intent?.active) return ''
  const sourceLines = sources.length
    ? sources.map(source => `- ${source.toolName}: ${source.kind} / ${source.scope}`).join('\n')
    : '- 本轮没有可执行的研究来源'
  return [
    '【实时研究任务】',
    `范围：${intent.scope}；模式：${intent.mode}；时间范围：最近 ${intent.recencyDays} 天。`,
    '本轮实际可用来源：',
    sourceLines,
    '',
    '执行规则：',
    '- 信息足够时直接研究，不要询问用户选择内部工具；范围未指定时默认综合可用来源。',
    '- 公开时效事实优先调用 search_web；搜索结果摘要只用于发现线索，具体结论继续用 fetch_web_page 读取原文。',
    '- 尽量核对至少两个独立原始页面；保留来源 URL，区分发布时间与本次检索时间。',
    '- 未启用或未列出的来源不可声称已使用，也不可放进选择项。',
    '- 所有搜索均失败时如实说明，不得编造今天、最新或近期事实。',
    '- 不得生成只有一个项目的“请选择来源”结构化选择。',
  ].join('\n')
}

function buildResearchTaskFrame(intent, sources) {
  if (!intent?.active || !['public', 'mixed'].includes(intent.scope)) return null
  const hasBuiltInSearch = sources.some(source => source.toolName === 'search_web')
  if (!hasBuiltInSearch) return null
  return {
    workflowId: 'realtime-public-research',
    requiredTools: ['search_web'],
    requiredEvidence: [
      { kind: 'tool_result', tool: 'search_web', minChars: 40, forbidTruncated: false },
    ],
    completionConditions: [
      { type: 'tool_success', tool: 'search_web' },
    ],
  }
}

function buildResearchRoute({ prompt = '', toolRecords = [] } = {}) {
  const intent = classifyResearchIntent(prompt)
  const sources = intent.active ? discoverResearchSources(toolRecords) : []
  return {
    active: intent.active,
    intent,
    sources,
    context: buildResearchContext(intent, sources),
    taskFrame: buildResearchTaskFrame(intent, sources),
  }
}

function reconcileResearchTaskFrame(taskFrame, prompt = '') {
  if (!taskFrame || taskFrame.workflowId !== 'realtime-public-research') return taskFrame || null
  const intent = classifyResearchIntent(prompt)
  return intent.active && ['public', 'mixed'].includes(intent.scope) ? taskFrame : null
}

function injectResearchContext(messages = [], context = '') {
  const list = Array.isArray(messages) ? messages.map(message => ({ ...message })) : []
  const text = String(context || '').trim()
  if (!text) return list
  const lastUser = list.map(message => message.role).lastIndexOf('user')
  const index = lastUser >= 0 ? lastUser : list.length
  list.splice(index, 0, { role: 'system', content: text })
  return list
}

module.exports = {
  FRESHNESS_RE,
  RESEARCH_RE,
  selectResearchPrompt,
  classifyResearchIntent,
  promoteIntentTier,
  classifyToolRecord,
  discoverResearchSources,
  buildResearchContext,
  buildResearchTaskFrame,
  buildResearchRoute,
  reconcileResearchTaskFrame,
  injectResearchContext,
}
