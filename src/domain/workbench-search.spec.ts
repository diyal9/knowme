import { describe, expect, it } from 'vitest'
import { filterByWorkbenchQuery, matchesWorkbenchQuery } from './workbench-search'

describe('workbench-search', () => {
  it('matches name and schedule label', () => {
    expect(matchesWorkbenchQuery({ id: 'a', name: '每日简报', scheduleLabel: '每天 09:00' }, '简报')).toBe(true)
    expect(matchesWorkbenchQuery({ id: 'a', name: '每日简报' }, 'cron')).toBe(false)
  })

  it('empty query keeps all', () => {
    const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    expect(filterByWorkbenchQuery(items, '  ')).toHaveLength(2)
    expect(filterByWorkbenchQuery(items, 'B').map((x) => x.id)).toEqual(['2'])
  })
})
