import { describe, expect, it } from 'vitest'
import type { CapabilityItem } from '../shared/api'
import {
  featuredHubItems,
  filterHubItems,
  hubCategoryChips,
  hubDisplayChips,
  hubItemBadges,
  isCapabilityInstalled,
  resolveHubIcon,
  shouldShowHubFeatured,
  type HubCapabilityItem,
} from './capability-hub'

const items: HubCapabilityItem[] = [
  { id: 'e1', kind: 'expert', name: '产品经理', description: '需求', category: '产品与研究', source: 'curated', installed: true },
  { id: 'e2', kind: 'expert', name: '测试', description: '质量', category: '软件研发', source: 'local-repo', status: 'featured' },
  { id: 's1', kind: 'skill', name: '写纪要', category: '办公' },
]

describe('capability hub filters', () => {
  it('builds unique category chips', () => {
    expect(hubCategoryChips(items)).toEqual(['产品与研究', '软件研发', '办公'])
  })

  it('filters by kind, category, installed and query', () => {
    expect(filterHubItems(items, { kind: 'expert' }).map((i) => i.id)).toEqual(['e1', 'e2'])
    expect(filterHubItems(items, { kind: 'expert', category: '产品与研究' }).map((i) => i.id)).toEqual(['e1'])
    expect(filterHubItems(items, { kind: 'expert', installedOnly: true }).map((i) => i.id)).toEqual(['e1'])
    expect(filterHubItems(items, { kind: 'expert', query: '质量' }).map((i) => i.id)).toEqual(['e2'])
    expect(filterHubItems([
      ...items,
      { id: 'mine', kind: 'expert', name: '值班', source: 'custom' } as CapabilityItem,
    ], { kind: 'expert', sourceFilter: '我的' }).map((i) => i.id)).toEqual(['e1', 'mine'])
    expect(filterHubItems(items, { kind: 'expert', sourceFilter: '官方' }).map((i) => i.id)).toEqual(['e1'])
    expect(filterHubItems(items, { kind: 'expert', sourceFilter: '组织' }).map((i) => i.id)).toEqual(['e2'])
  })

  it('prefers featured rows then falls back', () => {
    expect(featuredHubItems(items.filter((i) => i.kind === 'expert')).map((i) => i.id)).toEqual(['e2'])
    expect(isCapabilityInstalled(items[0])).toBe(true)
  })

  it('uses fixed scene chips instead of dynamic categories', () => {
    expect(hubDisplayChips(items.filter((i) => i.kind === 'expert'), 'expert')).toEqual([
      '全部', '产品与研究', '内容写作', '视觉创意', '日常办公', '数据分析', '软件研发', '知识研究',
    ])
  })

  it('resolves domain icons and installed badges', () => {
    expect(resolveHubIcon({ id: 'x', kind: 'skill', category: '办公' })).toBe('clipboardCheck')
    expect(hubItemBadges({ id: 'x', kind: 'expert', installed: true })[0]).toEqual({ label: '已添加', className: 'installed' })
    expect(hubItemBadges({ id: 'official', kind: 'expert', source: 'curated' })[0]).toEqual({ label: '认证', className: 'official verified' })
    expect(shouldShowHubFeatured([items[1]], { query: '', installedOnly: false })).toBe(true)
    expect(shouldShowHubFeatured([items[1]], { installedOnly: true })).toBe(false)
  })
})
