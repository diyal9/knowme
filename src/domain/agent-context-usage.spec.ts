import { describe, expect, it } from 'vitest'
import { buildContextUsageViewModel, formatTokenCount } from './agent-context-usage'

describe('agent-context-usage', () => {
  it('formats token counts', () => {
    expect(formatTokenCount(900)).toBe('900')
    expect(formatTokenCount(2400)).toBe('2K')
  })

  it('builds usage view model from contextInfo', () => {
    const usage = buildContextUsageViewModel({
      usedTokens: 12000,
      contextWindow: 32000,
      sectionUsage: [{ key: 'knowledge', usedTokens: 3000 }],
      omittedTurns: 1,
      omittedMessages: 2,
    }, 32000, 8000)
    expect(usage.ratio).toBeCloseTo(0.375)
    expect(usage.barClass).toBe('')
    expect(usage.rows.some((row) => row.key === 'knowledge')).toBe(true)
    expect(usage.compacted).toBe(true)
  })

  it('returns empty rows before first turn', () => {
    const usage = buildContextUsageViewModel(null, 32768, 0)
    expect(usage.rows).toEqual([])
    expect(usage.used).toBe(0)
  })
})
