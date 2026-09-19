/** User-facing route names shared by package ingestion, readiness and the workbench. */
const BUILTIN_ROUTE_LABELS: Record<string, string> = {
  'today-priority': '今日安排与待办',
  'meeting-summary': '会议与纪要',
  'doc-kb': '文档与知识库',
  'related-chats': '相关消息与聊天',
  'crawl-markdown': '网页抓取与整理',
  'data-report': '分析报告',
  'business-insight': '经营洞察',
  'data-analysis-method': '数据分析',
  'action-extraction': '提取行动项',
  'provided-meeting': '整理会议材料',
  'provided-material': '整理已有材料',
  'direct-drafting': '起草与改写',
  'office-collaboration': '日常办公协作',
  'requirement-review': '需求评审',
  'user-research': '用户研究',
  'product-definition': '产品定义',
  'provided-fact-check': '材料事实核查',
  'public-fact-check': '公开来源核查',
  'public-web-research': '公开信息研究',
  'research-synthesis': '研究综合',
  'knowledge-curation': '知识整理',
  'topic-sentiment': '主题舆情分析',
  'architecture-decision': '架构设计与技术选型',
  'software-change-verification': '功能开发与缺陷修复',
  'quality-verification': '测试设计与质量验收',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function expertRouteLabel(route: Record<string, unknown>, index = 0): string {
  const id = text(route.id)
  // Explicit author-provided names win, including names in other languages.
  const explicit = [route.label, route.name].map(text).find(value => value && value !== id)
  if (explicit) return explicit
  const description = text(route.description)
  return BUILTIN_ROUTE_LABELS[id] || (description && description !== id ? description : `协作方式 ${index + 1}`)
}

/** Legacy packages receive a safe label; malformed execution identity is never repaired silently. */
export function normalizeExpertRouteDisplay(value: unknown) {
  const issues: Array<{ code: string; message: string; path: string }> = []
  const warnings: typeof issues = []
  const prefix = 'metadata.knowme.execution.routes'
  if (!Array.isArray(value)) return { routes: [], warnings, issues: [{ code: 'invalid_expert_routes', message: '专家协作方式必须为数组', path: prefix }] }
  const seen = new Set<string>()
  const routes = value.map((raw, index) => {
    const route = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const id = text(route.id)
    if (!id || seen.has(id)) issues.push({ code: 'invalid_expert_route_id', message: `第 ${index + 1} 个协作方式的标识为空或重复`, path: `${prefix}[${index}].id` })
    seen.add(id)
    const label = expertRouteLabel(route, index)
    if (text(route.label) !== label) warnings.push({ code: 'expert_route_label_normalized', message: `已为第 ${index + 1} 个协作方式补全显示名称：${label}`, path: `${prefix}[${index}].label` })
    return { ...route, id, label }
  })
  return { routes, issues, warnings }
}
