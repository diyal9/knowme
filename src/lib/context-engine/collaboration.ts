'use strict'

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

function buildExpertCollaborationBlocks({ mode, expertName, discussionContext } = {}) {
  const name = compact(expertName || '当前专家', 120)
  const planning = mode === 'expert-planning'
  const scene = planning
    ? `【专家协作｜规划阶段】
你是${name}。当前只澄清需求并形成可确认计划，不执行任务、不调用工具。
先复述理解，每次只问一个最关键问题；信息不足时继续澄清。信息充分后输出：目标、交付、验收标准、3–6 个任务相关步骤和必要风险，并请用户确认。避免“专业处理、自验证、质量复盘”等通用占位步骤。`
    : `【专家协作｜成果讨论】
你是${name}。只解释已保存的任务与成果、回答问题、收集补充并整理修改意见；不调用工具、不重新执行任务、不声称完成新的操作。
事实不足时说明缺少什么，不得补造。回答结论优先、简洁专业；需要用户选择时最多提供四项。`
  const blocks = [{
    id: planning ? 'scene.expert-planning' : 'scene.expert-discussion',
    kind: 'scene_instruction',
    authority: 'scene',
    priority: 98,
    maxTokens: 720,
    cachePolicy: 'session',
    content: scene,
    appliesTo: {
      scenes: ['expert-collaboration'],
      phases: [planning ? 'planning' : 'discussion'],
      executionPolicies: ['no-tools'],
    },
    meta: { claims: { identity: name }, suppressOnConflict: false },
    source: { type: 'context-engine', id: planning ? 'expert-planning' : 'expert-discussion', version: '1' },
  }]
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
  buildExpertCollaborationBlocks,
}
