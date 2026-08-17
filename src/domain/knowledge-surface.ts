export const KNOWLEDGE_SURFACE_TABS = [
  { id: 'status', label: '我的知识' },
  { id: 'review', label: '待我确认' },
  { id: 'connect', label: '来源' },
] as const

export type KnowledgePrimaryTab = (typeof KNOWLEDGE_SURFACE_TABS)[number]['id']
export type KnowledgePage = KnowledgePrimaryTab | 'health' | 'organize'

export function normalizeKnowledgePage(tab?: string | null): KnowledgePage {
  const key = String(tab || '').trim()
  if (key === 'sources') return 'connect'
  if (key === 'browse') return 'status'
  if (key === 'health' || key === 'organize') return key
  if (key === 'status' || key === 'review' || key === 'connect') return key
  return 'status'
}

export function primaryKnowledgeTab(page: KnowledgePage): KnowledgePrimaryTab {
  if (page === 'review') return 'review'
  if (page === 'connect') return 'connect'
  return 'status'
}

export function knowledgeIssueLabel(type?: string): string {
  return ({
    empty: '内容为空',
    duplicate_title: '标题可能重复',
    broken_link: '链接已经失效',
    unreadable: '文件无法读取',
    limit: '资料较多，未全部检查',
    missing_directory: '资料目录缺失',
    missing_manifest: '资料空间信息缺失',
    invalid_manifest: '资料空间信息损坏',
    unsupported_schema: '资料空间版本不兼容',
    unsupported_file_type: '文件类型不支持',
    symlink_forbidden: '链接目录不安全',
    scan_limit: '资料较多，未全部检查',
    harness_unavailable: '知识保护未连接',
    orphan: '断链',
  } as Record<string, string>)[String(type || '')] || '需要关注'
}

export function knowledgeTaskStatusLabel(status?: string): string {
  return ({
    idle: '待开始',
    scanning: '扫描资料',
    analyzing: 'AI 分析中',
    review: '等待审核',
    committing: '正在写入',
    completed: '已完成',
    failed: '处理失败',
    cancelled: '已取消',
    done: '已完成',
    pending: '待处理',
  } as Record<string, string>)[String(status || '')] || '待处理'
}
