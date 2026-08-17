import { describe, expect, it } from 'vitest'
import {
  applyVisibleCatalogBulk,
  buildExpertCatalogFields,
  groupHubCatalogItems,
  hubCatalogSelectedChips,
} from './hub-catalog-fields'
import { draftFromExpertGet, expertEditorFooterSummary, slugifyExpertId } from './hub-expert-editor'

describe('hub expert editor helpers', () => {
  it('slugifies expert ids from names', () => {
    expect(slugifyExpertId('Duty Assistant')).toBe('duty-assistant')
    expect(slugifyExpertId('  ')).toBe('')
  })

  it('summarizes footer selection counts', () => {
    expect(expertEditorFooterSummary({
      id: 'duty-assistant',
      name: '值班助手',
      skills: 2,
      connectors: 1,
      knowledge: 0,
    })).toBe('已选 2 Skill · 1 连接器 · 0 知识源 · 将保存为 duty-assistant')
  })

  it('reads a loaded expert payload', () => {
    const draft = draftFromExpertGet({
      ok: true,
      expert: {
        name: '办公搭档',
        description: '整理纪要',
        avatar: 'office/collaborator',
        soul: '稳',
        sop: '先结论',
        agenticType: 'planning',
        agenticConfig: { planFirst: true },
        skills: [{ id: 's1' }],
        connectors: ['feishu'],
      },
    })
    expect(draft?.avatar).toBe('office/collaborator')
    expect(draft?.skills).toEqual(['s1'])
    expect(draft?.connectors).toEqual(['feishu'])
  })

  it('keeps bulk select scoped to visible ids', () => {
    expect(applyVisibleCatalogBulk(['a', 'b'], ['b', 'c'], true).sort()).toEqual(['a', 'b', 'c'])
    expect(applyVisibleCatalogBulk(['a', 'b', 'c'], ['b'], false)).toEqual(['a', 'c'])
  })

  it('groups catalog items and chips', () => {
    const items = [
      { id: 's1', name: '写纪要', category: '办公' },
      { id: 's2', name: '验收', category: '游戏' },
    ]
    expect(groupHubCatalogItems(items, true).map((group) => group.key)).toEqual(['办公', '游戏'])
    expect(hubCatalogSelectedChips(items, ['s1']).chips.map((chip) => chip.name)).toEqual(['写纪要'])
  })

  it('uses empty skill action when catalog is empty', () => {
    const fields = buildExpertCatalogFields({
      skills: [],
      connectors: [],
      knowledgeRefs: [],
      selectedSkills: [],
      selectedConnectors: [],
      selectedKnowledge: [],
    })
    expect(fields[0].emptyAction?.label).toBe('去安装技能')
    expect(fields[0].emptyAction?.tab).toBe('skill')
  })
})
