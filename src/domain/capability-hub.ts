import type { CapabilityItem, CapabilityKind } from '../shared/api'

export type HubCapabilityItem = CapabilityItem & {
  version?: string
  source?: string
  originName?: string
  avatar?: string
  favorite?: boolean
  featured?: boolean
  legacy?: boolean
  health?: string
  sourceAvailable?: boolean
  categories?: string[]
  tags?: string[]
  repositoryId?: string
  contentHash?: string
  installedAt?: string
  dependencies?: Array<string | { name?: string; id?: string; optional?: boolean }>
  permissions?: Record<string, unknown>
  inputs?: unknown[]
  outputs?: unknown[]
  risk?: { level?: string; reasons?: string[] }
  provenance?: { ref?: string; source?: string; trust?: string; adaptedFrom?: string }
  skills?: Array<string | { id?: string; name?: string }>
  connectors?: Array<string | { id?: string; name?: string }>
}

export type HubSourceFilter = '全部来源' | '官方' | '组织' | '我的'

export const HUB_EXPERT_SOURCE_FILTERS: HubSourceFilter[] = ['全部来源', '官方', '组织', '我的']

const EXPERT_DOMAIN_CATEGORIES = ['全部', '收藏', '产品与研究', '内容写作', '视觉创意', '日常办公', '数据分析', '软件研发', '知识研究']

export const HUB_TAB_CATEGORIES: Record<CapabilityKind, string[]> = {
  expert: EXPERT_DOMAIN_CATEGORIES,
  skill: [...EXPERT_DOMAIN_CATEGORIES],
  connector: ['全部', '收藏', '办公协作', '视觉创作', '游戏研发', '知识与数据', '研发工具', '通用连接'],
}

export const HUB_TAB_COPY: Record<CapabilityKind, { catalog: string; empty: string; featured: string; unit: string }> = {
  expert: {
    catalog: '全部专家',
    empty: '还没有符合条件的专家。你可以调整筛选，或添加自己的专家。',
    featured: '从常用工作场景开始，快速组建你的能力组合。',
    unit: '位专家',
  },
  skill: {
    catalog: '全部技能',
    empty: '还没有符合条件的技能。你可以调整筛选，或导入一个 SKILL.md。',
    featured: '把高频工作方法装进 KnowMe，需要时随时调用。',
    unit: '项技能',
  },
  connector: {
      catalog: '全部连接器',
      empty: '还没有符合条件的连接器。你可以调整筛选，或从公司配置中心导入能力包。',
      featured: '这里提供包装好的 MCP、固定 HTTP 调用包、公司 CLI，以及本机或远程 npx MCP 能力，可安装后装配给专家。',
      unit: '个连接器',
  },
}

const DOMAIN_ICONS: Record<string, string> = {
  产品与研究: 'clipboardCheck',
  内容写作: 'pencilLine',
  视觉创意: 'image',
  日常办公: 'clipboardCheck',
  数据分析: 'optimize',
  软件研发: 'code',
  知识研究: 'bookOpen',
  写作: 'pencilLine',
  游戏: 'gamepad',
  研发: 'code',
  开发: 'code',
  办公: 'clipboardCheck',
  知识: 'bookOpen',
  视觉: 'image',
  效率: 'clipboardCheck',
  飞书: 'clipboardCheck',
  办公协作: 'clipboardCheck',
  视觉创作: 'image',
  游戏研发: 'gamepad',
  知识与数据: 'bookOpen',
  研发工具: 'code',
  通用连接: 'network',
  能力包: 'optimize',
}

const KIND_FALLBACK: Record<CapabilityKind, string> = {
  expert: 'users',
  skill: 'optimize',
  connector: 'network',
}

const SOURCE_LABELS: Record<string, string> = {
  curated: '官方',
  official: '官方',
  pack: '官方',
  local: '我的',
  'local-repo': '组织',
  zip: 'ZIP',
  https: '远程',
  custom: '自定义',
}

export function isCapabilityInstalled(item: CapabilityItem): boolean {
  return item.installed === true
    || item.enabled === true
    || item.status === 'installed'
    || item.status === 'enabled'
    || item.status === 'disabled'
}

export function hubCategoryChips(items: CapabilityItem[]): string[] {
  const seen = new Set<string>()
  const chips: string[] = []
  for (const item of items) {
    const category = String(item.category || '').trim()
    if (!category || seen.has(category)) continue
    seen.add(category)
    chips.push(category)
  }
  return chips
}

export function hubDisplayChips(items: CapabilityItem[], kind: CapabilityKind = 'expert'): string[] {
  if (kind === 'connector') {
    const present = new Set(
      items
        .filter((item) => item.kind === 'connector')
        .map((item) => connectorBroadCategory(item as HubCapabilityItem)),
    )
    return HUB_TAB_CATEGORIES.connector.filter((category) => (
      category === '全部' || category === '收藏' || present.has(category)
    ))
  }
  return HUB_TAB_CATEGORIES[kind] || ['全部']
}

/**
 * 连接器筛选使用用户任务域，不把厂商名、协议或来源当作一级分类。
 * 未识别的新连接器稳定落入“通用连接”，因此导入后不会从筛选中消失。
 */
export function connectorBroadCategory(item: HubCapabilityItem): string {
  const text = [
    item.id,
    item.name,
    item.description,
    item.category,
    ...(item.categories || []),
    ...(item.tags || []),
  ].filter(Boolean).join(' ').toLowerCase()

  if (/feishu|lark|飞书|dingtalk|钉钉|wecom|企业微信|slack|teams|outlook|gmail|calendar|mail|会议|文档协作/.test(text)) {
    return '办公协作'
  }
  if (/photoshop|adobe|figma|canva|视觉|设计|图像|图片|image|design|creative|psd/.test(text)) {
    return '视觉创作'
  }
  if (/cocos|creator|unity|unreal|游戏|game|artbundle|prefab/.test(text)) {
    return '游戏研发'
  }
  if (/知识|knowledge|rag|搜索|search|数据库|database|vector|向量|notion|obsidian|wiki|sql|data/.test(text)) {
    return '知识与数据'
  }
  if (/github|gitlab|devops|ci\b|代码|code|研发|开发|terminal|shell|cli|playwright|browser|自动化|automation/.test(text)) {
    return '研发工具'
  }
  return '通用连接'
}

export function isCuratedExpert(item: HubCapabilityItem): boolean {
  return item.kind === 'expert' && ['curated', 'pack', 'official'].includes(String(item.source || ''))
}

export function isLocalExpert(item: HubCapabilityItem): boolean {
  return item.kind === 'expert' && ['local', 'custom', 'zip', 'https', 'local-repo'].includes(String(item.source || ''))
}

export function isUserCreatedExpert(item: HubCapabilityItem): boolean {
  if (item.kind !== 'expert') return false
  if (['curated', 'pack', 'official'].includes(String(item.source || ''))) return false
  if (!['local', 'custom'].includes(String(item.source || ''))) return false
  if (String(item.repositoryId || '').trim()) return false
  return true
}

/** 私人专家由“从目录添加”和“自己创建”两条路径产生。 */
export function isMyExpert(item: HubCapabilityItem): boolean {
  return item.kind === 'expert' && (isCapabilityInstalled(item) || isUserCreatedExpert(item))
}

/** 私人自建 Agent 不回流到所有用户可见的专家目录。 */
export function isExpertCatalogEntry(item: HubCapabilityItem): boolean {
  return item.kind === 'expert' && !isUserCreatedExpert(item)
}

export function myExpertOriginLabel(item: HubCapabilityItem): string {
  return isUserCreatedExpert(item) ? '我创建的' : '从专家库添加'
}

export function matchesHubCategory(item: HubCapabilityItem, category: string): boolean {
  if (!category || category === '全部') return true
  if (category === '收藏') return !!item.favorite
  if (item.kind === 'connector' && HUB_TAB_CATEGORIES.connector.includes(category)) {
    return connectorBroadCategory(item) === category
  }
  if (item.category === category) return true
  return (item.categories || []).some((cat) => String(cat) === category)
}

export function matchesHubSource(item: HubCapabilityItem, sourceFilter: HubSourceFilter | string = '全部来源'): boolean {
  if (!sourceFilter || sourceFilter === '全部来源') return true
  const source = String(item.source || 'local')
  if (sourceFilter === '官方') return ['curated', 'official', 'pack'].includes(source)
  if (sourceFilter === '组织') return source === 'local-repo' || Boolean(String(item.repositoryId || '').trim())
  if (sourceFilter === '我的') return isMyExpert(item)
  return true
}

export function hubCatalogTitle(
  kind: CapabilityKind,
  opts: { query?: string; installedOnly?: boolean; category?: string; sourceFilter?: string },
): string {
  if (kind === 'expert' && opts.sourceFilter === '我的') return '我的专家'
  if (kind === 'expert' && opts.sourceFilter === '组织') return '组织专家'
  if (kind === 'expert' && opts.sourceFilter === '官方') return '官方专家'
  if (opts.query || opts.installedOnly || (opts.category && opts.category !== '全部')) return '筛选结果'
  return HUB_TAB_COPY[kind].catalog
}

export function resolveHubIcon(item: HubCapabilityItem): string {
  const kind = item.kind || 'skill'
  if (kind === 'connector') {
    const cat = String(item.category || '')
    if (/飞书|feishu|lark/i.test(cat) || /feishu|lark/i.test(String(item.id || ''))) return 'wechat'
    if (/mcp/i.test(cat)) return 'network'
    if (/知识/i.test(cat)) return 'bookOpen'
    return KIND_FALLBACK.connector
  }
  const category = String(item.category || '').trim()
  if (DOMAIN_ICONS[category]) return DOMAIN_ICONS[category]
  for (const cat of item.categories || []) {
    const mapped = DOMAIN_ICONS[String(cat || '').trim()]
    if (mapped) return mapped
  }
  return KIND_FALLBACK[kind] || KIND_FALLBACK.skill
}

export function hubSourceLabel(source?: string): string {
  const key = String(source || 'local').trim()
  return SOURCE_LABELS[key] || key || '本地'
}

export function hubOriginLabel(item: HubCapabilityItem): string {
  const origin = String(item.originName || '').trim()
  const name = String(item.name || '').trim()
  return origin && origin !== name ? origin : ''
}

export function hubItemBadges(item: HubCapabilityItem, offline = false): { label: string; className: string }[] {
  const badges: { label: string; className: string }[] = []
  if (item.kind === 'expert' && isCuratedExpert(item)) badges.push({ label: '认证', className: 'official verified' })
  if (item.legacy) badges.push({ label: 'Legacy', className: 'legacy' })
  if (item.kind === 'expert' && isMyExpert(item)) {
    badges.push({ label: '已添加', className: 'installed' })
  } else if (['installed', 'enabled', 'disabled'].includes(String(item.status || '')) || isCapabilityInstalled(item)) {
    badges.push({ label: '已安装', className: 'installed' })
  }
  if (offline) badges.push({ label: '预览', className: 'offline' })
  if (item.health === 'green') badges.push({ label: '健康', className: 'installed' })
  if (item.sourceAvailable === false) badges.push({ label: '来源不可用', className: 'legacy' })
  if (!badges.length) badges.push({ label: item.category || '精选', className: '' })
  return badges
}

export function shouldShowHubFeatured(
  featured: CapabilityItem[],
  opts: { query?: string; installedOnly?: boolean },
): boolean {
  return featured.length > 0 && !String(opts.query || '').trim() && !opts.installedOnly
}

export function filterHubItems(
  items: CapabilityItem[],
  opts: {
    kind: CapabilityKind
    query?: string
    category?: string
    sourceFilter?: HubSourceFilter | string
    installedOnly?: boolean
  },
): CapabilityItem[] {
  const q = String(opts.query || '').trim().toLowerCase()
  const category = String(opts.category || '全部').trim() || '全部'
  return items.filter((item) => {
    const hubItem = item as HubCapabilityItem
    if (item.kind !== opts.kind) return false
    if (opts.installedOnly && !isCapabilityInstalled(item) && !['installed', 'enabled', 'disabled'].includes(String(item.status || ''))) {
      return false
    }
    if (!matchesHubCategory(hubItem, category)) return false
    if (opts.kind === 'expert' && !matchesHubSource(hubItem, opts.sourceFilter)) return false
    if (!q) return true
    const hay = [item.name, hubItem.originName, item.id, item.description, item.category, ...(hubItem.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function featuredHubItems(items: CapabilityItem[], limit = 4): CapabilityItem[] {
  const marked = items.filter((item) => {
    const hubItem = item as HubCapabilityItem
    return hubItem.featured || item.status === 'featured' || item.category === '精选'
  })
  return (marked.length ? marked : items).slice(0, limit)
}
