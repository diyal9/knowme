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
} from './capability-hub'

const items: CapabilityItem[] = [
  { id: 'e1', kind: 'expert', name: '产品经理', description: '需求', category: '办公', installed: true },
  { id: 'e2', kind: 'expert', name: '测试', description: '质量', category: '研发', status: 'featured' },
  { id: 's1', kind: 'skill', name: '写纪要', category: '办公' },
]

describe('capability hub filters', () => {
  it('builds unique category chips', () => {
    expect(hubCategoryChips(items)).toEqual(['办公', '研发'])
  })

  it('filters by kind, category, installed and query', () => {
    expect(filterHubItems(items, { kind: 'expert' }).map((i) => i.id)).toEqual(['e1', 'e2'])
    expect(filterHubItems(items, { kind: 'expert', category: '办公' }).map((i) => i.id)).toEqual(['e1'])
    expect(filterHubItems(items, { kind: 'expert', installedOnly: true }).map((i) => i.id)).toEqual(['e1'])
    expect(filterHubItems(items, { kind: 'expert', query: '质量' }).map((i) => i.id)).toEqual(['e2'])
    expect(filterHubItems([
      ...items,
      { id: 'mine', kind: 'expert', name: '值班', source: 'custom' } as CapabilityItem,
    ], { kind: 'expert', category: '我的' }).map((i) => i.id)).toEqual(['mine'])
  })

  it('prefers featured rows then falls back', () => {
    expect(featuredHubItems(items.filter((i) => i.kind === 'expert')).map((i) => i.id)).toEqual(['e2'])
    expect(isCapabilityInstalled(items[0])).toBe(true)
  })

  it('uses fixed scene chips instead of dynamic categories', () => {
    expect(hubDisplayChips(items.filter((i) => i.kind === 'expert'), 'expert')).toEqual([
      '全部', '收藏', '办公', '写作', '研发', '知识', '我的',
    ])
  })

  it('resolves domain icons and installed badges', () => {
    expect(resolveHubIcon({ id: 'x', kind: 'skill', category: '办公' })).toBe('clipboardCheck')
    expect(hubItemBadges({ id: 'x', kind: 'expert', installed: true })[0]).toEqual({ label: '已安装', className: 'installed' })
    expect(shouldShowHubFeatured([items[1]], { query: '', installedOnly: false })).toBe(true)
    expect(shouldShowHubFeatured([items[1]], { installedOnly: true })).toBe(false)
  })
})
