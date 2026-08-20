import { describe, expect, it } from 'vitest'
import {
  applyAssistantStreamEvent,
  buildExecutionTimelineView,
  formatReplyTiming,
  seedPrepareTrace,
  stampStreamTiming,
  userStatusLabel,
} from './agent-execution-timeline'

describe('agent-execution-timeline', () => {
  it('maps context prepare titles to friendly labels', () => {
    expect(userStatusLabel('正在准备上下文…', 'pending')).toBe('正在整理相关内容')
    expect(userStatusLabel('上下文准备完成', 'done')).toBe('内容整理完成')
  })

  it('seeds prepare trace for the first paint', () => {
    const view = buildExecutionTimelineView({
      streaming: true,
      startedAt: Date.now(),
      trace: seedPrepareTrace(),
    })
    expect(view?.rows[0].title).toBe('正在整理相关内容')
    expect(view?.summaryTitle).toBe('正在整理相关内容')
    expect(view?.compact).toBe(true)
  })

  it('upserts v2 payload stages onto the assistant message', () => {
    const next = applyAssistantStreamEvent(
      { id: 'a1', role: 'assistant', text: '', streaming: true, thinking: true, trace: [] },
      { type: 'stage', payload: { id: 'stage_prepare', title: '上下文准备完成', status: 'done', summary: '命中 8 条' } },
    )
    expect(next.thinking).toBe(false)
    expect(next.trace).toHaveLength(1)
    expect(next.trace?.[0].title).toBe('上下文准备完成')
    const view = buildExecutionTimelineView(next)
    expect(view?.rows[0].title).toBe('内容整理完成')
    expect(view?.rows[0].hint).toBe('命中 8 条')
  })

  it('uses the user-facing title for a completed multi-step trace', () => {
    const view = buildExecutionTimelineView({
      streaming: false,
      trace: [
        { id: 'a', kind: 'stage', title: '准备内容', status: 'done', round: 1 },
        { id: 'b', kind: 'tool', title: '读取资料', status: 'done', round: 1 },
      ],
    })
    expect(view?.summaryTitle).toBe('思考执行过程')
  })

  it('copies plan.updated onto the assistant message', () => {
    const next = applyAssistantStreamEvent(
      { id: 'a1', role: 'assistant', text: '', streaming: true, thinking: true },
      { type: 'plan.updated', plan: { items: [{ id: '1', title: '想', status: 'pending' }] } },
    )
    expect(next.plan?.items?.[0]?.title).toBe('想')
    expect(next.thinking).toBe(false)
  })

  it('accepts legacy flat stage events', () => {
    const next = applyAssistantStreamEvent(
      { id: 'a1', role: 'assistant', text: '', streaming: true, trace: [] },
      { type: 'stage', id: 'stage_generate', title: '正在组织回答', status: 'pending' },
    )
    expect(next.trace?.[0].id).toBe('stage_generate')
    expect(buildExecutionTimelineView({ ...next, streaming: true })?.summaryTitle).toBe('正在组织回答')
  })

  it('stamps first-token latency once text appears', () => {
    const startedAt = Date.now() - 420
    const waiting = stampStreamTiming({
      id: 'a1',
      role: 'assistant',
      text: '',
      streaming: true,
      startedAt,
    }, startedAt + 200)
    expect(waiting.firstTokenMs).toBeUndefined()
    const live = stampStreamTiming({ ...waiting, text: '你好' }, startedAt + 420)
    expect(live.firstTokenMs).toBe(420)
    expect(formatReplyTiming({
      firstTokenMs: live.firstTokenMs,
      elapsedMs: 2100,
      streaming: false,
      hasText: true,
    })).toBe('首 Token 420ms · 共 2.1s')
    const again = stampStreamTiming({ ...live, text: '你好，世界' }, startedAt + 900)
    expect(again.firstTokenMs).toBe(420)
  })
})
