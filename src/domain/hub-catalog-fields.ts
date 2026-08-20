import type { CapabilityItem } from '../shared/api'

export type HubCatalogEmptyAction = {
  label: string
  tab?: 'skill' | 'connector' | 'sources'
}

export type HubCatalogItem = { id: string; name: string; category?: string }

export type HubCatalogFieldSpec = {
  name: string
  title: string
  dialogTitle: string
  hint: string
  unit: string
  selectLabel: string
  emptyLabel: string
  emptyAction?: HubCatalogEmptyAction
  key: 'skills' | 'connectors' | 'knowledgeRefs'
  items: HubCatalogItem[]
  selected: string[]
}

export function hubCatalogItemLabel(item: { id: string; name?: string; description?: string }): string {
  return String(item.name || item.id).trim() || item.id
}

export function hubCatalogItemsFromCapabilities(items: CapabilityItem[], kind: CapabilityItem['kind']) {
  return items
    .filter((item) => item.kind === kind)
    .map((item) => ({
      id: item.id,
      name: hubCatalogItemLabel(item),
      category: item.category || item.kind,
    }))
}

export function filterHubCatalogItems(
  items: HubCatalogFieldSpec['items'],
  query: string,
  selectedOnly: boolean,
  selected: string[],
) {
  const q = query.trim().toLowerCase()
  const picked = new Set(selected)
  return items.filter((item) => {
    if (selectedOnly && !picked.has(item.id)) return false
    if (!q) return true
    const hay = `${item.id} ${item.name} ${item.category || ''}`.toLowerCase()
    return hay.includes(q)
  })
}

export function groupHubCatalogItems(items: HubCatalogItem[], grouped: boolean) {
  if (!grouped) return [{ key: '', items }]
  const groups = new Map<string, HubCatalogItem[]>()
  for (const item of items) {
    const key = String(item.category || '其他').trim() || '其他'
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([key, groupItems]) => ({ key, items: groupItems }))
}

export function applyVisibleCatalogBulk(current: string[], visibleIds: string[], checked: boolean) {
  const visible = new Set(visibleIds.filter(Boolean))
  if (checked) return [...new Set([...current, ...visibleIds.filter(Boolean)])]
  return current.filter((id) => !visible.has(id))
}

export function hubCatalogSelectedChips(items: HubCatalogItem[], selected: string[], limit = 8) {
  const picked = new Set(selected)
  const chosen = items.filter((item) => picked.has(item.id))
  const extra = Math.max(0, chosen.length - limit)
  return {
    chips: chosen.slice(0, limit).map((item) => ({ id: item.id, name: item.name || item.id })),
    extra,
    empty: chosen.length === 0,
  }
}

export function buildExpertCatalogFields(input: {
  skills: CapabilityItem[]
  connectors: CapabilityItem[]
  knowledgeRefs: Array<{ id: string; name?: string }>
  selectedSkills: string[]
  selectedConnectors: string[]
  selectedKnowledge: string[]
}): HubCatalogFieldSpec[] {
  return [
    {
      name: 'hub-expert-skill',
      title: 'Skills',
      dialogTitle: '选择 Skills',
      hint: '专家可以调用的技能，决定它会做哪些事。',
      items: hubCatalogItemsFromCapabilities(input.skills, 'skill'),
      selected: input.selectedSkills,
      unit: 'Skill',
      selectLabel: '选择技能',
      emptyLabel: '请先安装技能，再选择要装配的能力。',
      emptyAction: { label: '去安装技能', tab: 'skill' },
      key: 'skills',
    },
    {
      name: 'hub-expert-connector',
      title: '连接器',
      dialogTitle: '选择连接器',
      hint: '允许专家调用的外部能力包，包括 MCP、固定 HTTP 调用和公司 CLI；真实服务授权需在设置的“服务授权”中完成。',
      items: hubCatalogItemsFromCapabilities(input.connectors, 'connector'),
      selected: input.selectedConnectors,
      unit: '连接器',
      selectLabel: '选择连接器',
      emptyLabel: '请先在能力中心安装连接器，再选择要装配给专家的外部能力。',
      emptyAction: { label: '去安装连接器', tab: 'connector' },
      key: 'connectors',
    },
    {
      name: 'hub-expert-knowledge',
      title: '知识库范围',
      dialogTitle: '选择知识来源',
      hint: '专家回答时可检索的知识来源。',
      items: input.knowledgeRefs.map((item) => ({
        id: item.id,
        name: String(item.name || item.id),
        category: '知识源',
      })),
      selected: input.selectedKnowledge,
      unit: '知识源',
      selectLabel: '选择知识源',
      emptyLabel: '请先在设置的「内容源」中添加来源，再回来选择。',
      emptyAction: { label: '去内容源', tab: 'sources' },
      key: 'knowledgeRefs',
    },
  ]
}
