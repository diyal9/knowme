import { describe, expect, it } from 'vitest'
import { getSlashContext, insertSlashSkill, removeSlashSkillMarker } from './slashContext'

describe('slash skill context', () => {
  it('finds the slash query at the caret inside conversation text', () => {
    const value = '/办公信息整理与沟通交付 使用 /飞书'
    expect(getSlashContext(value, value.length)).toEqual({
      start: value.lastIndexOf('/'),
      end: value.length,
      query: '飞书',
    })
  })

  it('does not reopen for a completed marker followed by conversation text', () => {
    const value = '/办公信息整理与沟通交付 使用这个技能'
    expect(getSlashContext(value, value.length)).toBeNull()
  })

  it('replaces only the active slash query and preserves surrounding text', () => {
    const value = '请使用 /飞书 生成周报'
    const context = getSlashContext(value, '请使用 /飞书'.length)
    expect(context).not.toBeNull()
    expect(insertSlashSkill(value, context!, '飞书数据填表')).toEqual({
      next: '请使用 /飞书数据填表 生成周报',
      caret: '请使用 /飞书数据填表 '.length,
    })
  })

  it('removes the matching inline marker when its toggle is cleared', () => {
    expect(removeSlashSkillMarker('请使用 /飞书数据填表 生成周报', '飞书数据填表')).toEqual({
      next: '请使用 生成周报',
      caret: '请使用 '.length,
    })
  })
})
