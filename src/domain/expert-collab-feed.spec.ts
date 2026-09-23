import { describe, expect, it } from 'vitest'
import { buildExpertCollabFeed } from './expert-collab-feed'

describe('expert collaboration feed', () => {
  it('orders messages and deliverable versions by their creation time', () => {
    const feed = buildExpertCollabFeed([
      { id: 'assistant-late', role: 'assistant', text: '结果已准备好', createdAt: '2026-08-27T10:03:00.000Z' },
      { id: 'user-early', role: 'user', text: '请帮我整理消息', createdAt: '2026-08-27T10:00:00.000Z' },
    ], [], [{ deliverableId: 'primary', title: '同步稿', createdAt: '2026-08-27T10:02:00.000Z' }])

    expect(feed.map((item) => item.kind === 'message' ? item.message.id : item.kind === 'event' ? item.event.id : item.deliverable.deliverableId))
      .toEqual(['user-early', 'primary', 'assistant-late'])
  })

  it('puts legacy messages before results when timestamps are unavailable', () => {
    const feed = buildExpertCollabFeed(
      [{ id: 'legacy-message', role: 'user', text: '历史消息' }],
      [],
      [{ deliverableId: 'result', title: '历史成果', createdAt: '2026-08-27T10:02:00.000Z' }],
    )
    expect(feed[0].kind).toBe('message')
  })

  it('interleaves events with messages and deliverables by one timeline', () => {
    const feed = buildExpertCollabFeed(
      [{ id: 'message', role: 'assistant', text: '已完成读取', createdAt: '2026-08-27T10:02:00.000Z' }],
      [{ id: 'event', type: 'progress', summary: '读取完成', createdAt: '2026-08-27T10:01:00.000Z' }],
      [{ deliverableId: 'result', title: '整理稿', createdAt: '2026-08-27T10:03:00.000Z' }],
    )
    expect(feed.map((item) => item.kind)).toEqual(['event', 'message', 'deliverable'])
  })

  it('uses activity sequence as the deterministic tie-breaker', () => {
    const feed = buildExpertCollabFeed(
      [],
      [
        { id: 'second', type: 'progress', sequence: 2, createdAt: '2026-08-27T10:00:00.000Z' },
        { id: 'first', type: 'progress', sequence: 1, createdAt: '2026-08-27T10:00:00.000Z' },
      ],
      [],
    )
    expect(feed.map((item) => item.kind === 'event' ? item.event.id : '')).toEqual(['first', 'second'])
  })

  it('does not render a task event again when it references a canonical message', () => {
    const feed = buildExpertCollabFeed(
      [{ id: 'assistant-1', role: 'assistant', text: '唯一结果', createdAt: '2026-08-27T10:01:00.000Z' }],
      [{ id: 'event-1', type: 'answer_committed', messageId: 'assistant-1', summary: '唯一结果', createdAt: '2026-08-27T10:01:01.000Z' }],
      [],
    )
    expect(feed.map((item) => item.kind)).toEqual(['message'])
  })
})
