import { describe, expect, it } from 'vitest'
import { filterShelfCards, isDemoShelfEntry, isDemoVerticalSeed, shelfLockHint, shelfProvenanceLabel, shelfSupplyHint, toShelfCard } from './shelf'

describe('shelf domain', () => {
  it('labels personal as 我的 and official as 官方', () => {
    expect(shelfProvenanceLabel('personal')).toBe('我的')
    expect(shelfProvenanceLabel('official')).toBe('官方')
  })

  it('drops demo vertical seeds and demo-* test workflows', () => {
    expect(isDemoVerticalSeed('demo-meeting-minutes')).toBe(true)
    expect(isDemoShelfEntry('demo-test10')).toBe(true)
    expect(isDemoShelfEntry('team-shared-flow')).toBe(false)
    const cards = filterShelfCards([
      toShelfCard({ id: 'demo-meeting-minutes', name: 'x', source: 'official' }),
      toShelfCard({ id: 'demo-test10', name: 'demo-test10', source: 'team' }),
      toShelfCard({ id: 'real', name: '真', source: 'personal' }),
    ], '', 'all')
    expect(cards.map((c) => c.id)).toEqual(['real'])
  })

  it('marks locked cards and daemon-offline hint', () => {
    expect(toShelfCard({ id: 'a', name: 'a', locked: true }).blocked).toBe(true)
    expect(shelfLockHint(false)).toBeNull()
    expect(shelfLockHint(true)).toBeNull()
  })

  it('classifies imported art workflow tags as visual without explicit provenance', () => {
    const card = toShelfCard({
      id: 'th-art-psd-to-artbundle',
      name: 'PSD导Artbundle',
      source: 'team',
      goalTypes: ['ui', 'psd', 'artbundle', 'factory', 'creator'],
    })
    expect(card.domain).toBe('visual')
    expect(card.markIcon).toBe('arrowLeftRight')
    expect(filterShelfCards([card], '', 'visual')).toEqual([card])
  })

  it('assigns workflow icons by purpose before falling back to its domain', () => {
    expect(toShelfCard({ id: 'daily-summary', name: '飞书日常总结' }).markIcon).toBe('clipboardCheck')
    expect(toShelfCard({ id: 'qa-check', name: '发布质量验收' }).markIcon).toBe('badgeCheck')
    expect(toShelfCard({ id: 'image-flow', name: '美术生图' }).markIcon).toBe('image')
    expect(toShelfCard({ id: 'data-flow', name: '经营数据分析' }).markIcon).toBe('database')
    expect(toShelfCard({ id: 'team-flow', name: '跨团队交接' }).markIcon).toBe('users')
    expect(toShelfCard({ id: 'unknown', name: '未分类流程' }).markIcon).toBe('workflow')
  })

  it('explains empty shelf supply by daemon status', () => {
    expect(shelfSupplyHint(false)).toMatch(/完成后即可运行/)
    expect(shelfSupplyHint(true)).toMatch(/团队提供/)
  })
})
