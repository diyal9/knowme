import { describe, expect, it } from 'vitest'
import { buildPersonalGrowthSnapshot } from './personal-growth'

describe('personal growth model', () => {
  it('keeps installed equipment outside the four understanding dimensions', () => {
    const empty = buildPersonalGrowthSnapshot({})
    const equipped = buildPersonalGrowthSnapshot({
      capabilities: [
        { id: 'writing', kind: 'skill', installed: true },
        { id: 'feishu', kind: 'connector', enabled: true },
      ],
    })

    expect(equipped.points).toBe(empty.points)
    expect(equipped.equipment.skills.installed).toBe(1)
    expect(equipped.equipment.connectors.installed).toBe(1)
    expect(empty.recommendations[0]).toMatchObject({ action: 'workbench', actionLabel: '前往工作台' })
  })

  it('grows from confirmed preferences, reused knowledge and completed work', () => {
    const snapshot = buildPersonalGrowthSnapshot({
      profile: {
        profileVersion: 3,
        id: 'mine',
        agentId: 'personal',
        profileKind: 'personal',
        identity: {},
        contexts: [{ id: 'product', name: '产品规划', knowledgeRefs: [{ id: 'roadmap' }] }],
        taskPreferences: {},
      },
      memory: {
        patterns: [{ id: 'p1', prompt_state: 'accepted', summary: '先结论后依据' }],
        globalMemories: [{ id: 'm1', type: 'preference', text: '先给结论' }],
      },
      knowledge: [{ path: 'roadmap.md', kind: 'okf' }],
      tasks: [{
        id: 't1', status: 'completed', workflowId: 'planning', updatedAt: '2026-08-24T10:00:00Z',
        knowledgeRefs: [{ id: 'roadmap' }],
        deliverables: [{ acceptanceStatus: 'accepted' }],
      }],
      now: new Date('2026-08-25T12:00:00+08:00'),
    })

    expect(snapshot.dimensions.find((item) => item.id === 'context')?.points).toBeGreaterThan(0)
    expect(snapshot.dimensions.find((item) => item.id === 'preference')?.evidenceCount).toBe(2)
    expect(snapshot.dimensions.find((item) => item.id === 'knowledge')?.summary).toContain('已在任务中复用')
    expect(snapshot.dimensions.find((item) => item.id === 'collaboration')?.evidenceCount).toBe(2)
    expect(snapshot.yesterdayCompleted).toBe(1)
  })
})
