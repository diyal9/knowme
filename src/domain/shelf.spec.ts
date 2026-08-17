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
    expect(shelfLockHint(false)).toMatch(/离线/)
    expect(shelfLockHint(true)).toBeNull()
  })

  it('explains empty shelf supply by daemon status', () => {
    expect(shelfSupplyHint(false)).toMatch(/连接管线服务/)
    expect(shelfSupplyHint(true)).toMatch(/专家库/)
  })
})
