import { describe, expect, it } from 'vitest'
import {
  boundWorkbenchExpertIds,
  expertHomeDomain,
  isDemoOrTestExpert,
  shelfRowCapacity,
  workbenchHomeExperts,
} from './workbench-home'

describe('workflow shelf layout', () => {
  it('keeps the visible card count aligned with the responsive grid', () => {
    expect(shelfRowCapacity(1280)).toBe(3)
    expect(shelfRowCapacity(901)).toBe(3)
    expect(shelfRowCapacity(900)).toBe(2)
    expect(shelfRowCapacity(601)).toBe(2)
    expect(shelfRowCapacity(600)).toBe(1)
    expect(shelfRowCapacity(0)).toBe(3)
  })
})

describe('workbench home experts', () => {
  it('maps expert categories to the same compact domains used by workflows', () => {
    expect(expertHomeDomain({ id: 'office', name: '办公协作专家', category: '日常办公' })).toBe('office')
    expect(expertHomeDomain({ id: 'pm', name: '产品经理', category: '产品与研究' })).toBe('engineering')
    expect(expertHomeDomain({ id: 'creative', name: '创意策划', category: '视觉创意' })).toBe('visual')
  })

  it('treats test1, qa-copy, and 测试用 prompts as demo fixtures', () => {
    expect(isDemoOrTestExpert({ id: 'test1', name: 'test1' })).toBe(true)
    expect(isDemoOrTestExpert({ id: 'qa-copy-n1fa1g', name: 'QA 自建' })).toBe(true)
    expect(isDemoOrTestExpert({ id: 'office-partner', systemPrompt: '一个测试用专家' })).toBe(true)
    expect(isDemoOrTestExpert({ id: 'tester', name: '测试' })).toBe(false)
  })

  it('only returns bound non-demo experts for the home grid', () => {
    const items = [
      { id: 'office-partner', kind: 'expert' as const, name: '办公伙伴' },
      { id: 'producer', kind: 'expert' as const, name: '制作人' },
      { id: 'test1', kind: 'expert' as const, name: 'test1' },
      { id: 'writing-polish', kind: 'skill' as const, name: '写作润色' },
    ]
    const modes = [
      { id: 'office', bindings: [{ expertId: 'office-partner' }, { expertId: 'test1' }] },
    ]
    expect(boundWorkbenchExpertIds(modes)).toEqual(new Set(['office-partner', 'test1']))
    expect(workbenchHomeExperts(items, modes).map((item) => item.id)).toEqual(['office-partner'])
    expect(workbenchHomeExperts(items, [])).toEqual([])
  })
})
