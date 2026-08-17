import { describe, expect, it } from 'vitest'
import {
  addStudioIoRow,
  normalizeStudioIoList,
  parseStudioIoOptions,
  removeStudioIoRow,
} from './studio-io'

describe('studio-io', () => {
  it('normalizes draft io rows with defaults', () => {
    const rows = normalizeStudioIoList([], 'input')
    expect(rows).toHaveLength(1)
    expect(rows[0].required).toBe(true)
  })

  it('adds and removes io rows', () => {
    const base = normalizeStudioIoList([{ id: 'input-1', label: 'brief', type: 'text' }], 'input')
    const added = addStudioIoRow(base, 'input')
    expect(added).toHaveLength(2)
    const removed = removeStudioIoRow(added, 1, 'input')
    expect(removed).toHaveLength(1)
    expect(removed[0].label).toBe('brief')
  })

  it('parses enum options', () => {
    expect(parseStudioIoOptions('A，B, C')).toEqual(['A', 'B', 'C'])
  })
})
