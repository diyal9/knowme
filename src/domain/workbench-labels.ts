/** Workbench 展示标签（纯规则，无 DOM） */

export function consoleSourceLabel(source: string): string {
  const map: Record<string, string> = {
    daemon: '管线服务',
    'local-team': 'Local Team',
    'legacy-local': '兼容本地',
    automation: '自动化',
  }
  return map[String(source || '')] || '本机'
}

export function executionBackendLabel(item: {
  executionBackends?: string[]
  executionSource?: string
} | null | undefined): string {
  const backends = Array.isArray(item?.executionBackends) ? item.executionBackends : []
  if (backends.includes('daemon') || item?.executionSource === 'daemon') return '管线服务'
  if (backends.includes('local-team') || item?.executionSource === 'local-team') return '本机专家团队'
  if (backends.includes('legacy-local') || item?.executionSource === 'legacy-local') return '兼容本地'
  return '本机执行'
}

export function workflowSourceLabel(source: string): string {
  const map: Record<string, string> = {
    official: '官方专业管线',
    team: '团队专业管线',
    forked: '我的派生流程',
    personal: '我的工作流',
  }
  return map[String(source || '')] || '可组合流程'
}
