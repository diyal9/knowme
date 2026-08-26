import { describe, expect, it } from 'vitest'
import {
  buildAmbiguousExpertReply,
  buildExpertDiscussionContext,
  buildExpertDiscussionPrompt,
  isAmbiguousExpertDiscussion,
} from './expert-discussion'

describe('expert discussion', () => {
  it('builds a bounded task fact snapshot with the actual artifact body', () => {
    const context = buildExpertDiscussionContext({
      id: 'task-1',
      status: 'review',
      goal: '整理会议结论',
      resultSummary: '摘要',
      deliverables: [{
        deliverableId: 'draft',
        title: '同步稿',
        type: 'document',
        version: 2,
        artifactRef: 's1#a1',
        acceptanceStatus: 'pending',
      }],
    }, {
      's1#a1': { id: 'a1', type: 'document', body: '# 核心结论\n真实产物内容' },
    })
    expect(context.deliverables[0]).toMatchObject({ title: '同步稿', version: 2 })
    expect(context.deliverables[0].excerpt).toContain('真实产物内容')
    expect(buildExpertDiscussionPrompt({ expertName: '办公协作专家', userText: '结论是什么？', context, planning: false }))
      .toMatch(/唯一事实依据[\s\S]*真实产物内容[\s\S]*结论是什么/)
  })

  it('turns punctuation-only follow-ups into a useful choice instead of calling execution', () => {
    expect(isAmbiguousExpertDiscussion('?')).toBe(true)
    expect(isAmbiguousExpertDiscussion('？')).toBe(true)
    expect(isAmbiguousExpertDiscussion('为什么没有完成？')).toBe(false)
    expect(buildAmbiguousExpertReply({
      taskId: 't1', goal: '', status: 'review', resultSummary: '', recentEvents: [],
      deliverables: [{ id: 'd1', title: '成果', type: 'document', version: 1, acceptanceStatus: 'pending', excerpt: '' }],
    })).toContain('查看成果内容')
  })
})
