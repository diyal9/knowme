import { describe, expect, it } from 'vitest'
import { buildExpertCollabFeed } from './expert-collab-feed'
import { buildExpertCollabNarrative } from './expert-collab-narrative'

describe('expert collaboration narrative', () => {
  it('keeps lifecycle events silent and lets the expert explain the SOP', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'created', type: 'created', summary: '已确认委托单并开始预检', createdAt: '2026-09-02T10:00:00.000Z' },
      { id: 'passed', type: 'preflight_passed', summary: '预检通过', createdAt: '2026-09-02T10:00:01.000Z' },
      { id: 'sop', type: 'sop_applied', summary: '已按 SOP 路由执行：先读取材料，再生成导入方案。', createdAt: '2026-09-02T10:00:02.000Z' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative).toHaveLength(1)
    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: {
        role: 'expert',
        body: '我会先读取材料，再生成导入方案。',
        disclosure: { label: '查看工作路径' },
      },
    })
  })

  it('keeps consecutive progress as one chronological execution turn', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'one', type: 'progress', summary: '正在准备上下文…', createdAt: '2026-09-02T10:00:00.000Z' },
      { id: 'two', type: 'progress', summary: '已完成环境核对，正在检查兼容性。', createdAt: '2026-09-02T10:00:01.000Z' },
      { id: 'three', type: 'tool_progress', summary: '正在读取版本信息', createdAt: '2026-09-02T10:00:02.000Z' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative).toHaveLength(1)
    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: {
        body: '正在读取版本信息',
        active: true,
        execution: {
          status: 'running',
          activities: [
            expect.objectContaining({ kind: 'commentary', body: '我正在整理完成这项工作所需的背景和材料。' }),
            expect.objectContaining({ kind: 'commentary', body: '已完成环境核对，正在检查兼容性。' }),
            expect.objectContaining({ kind: 'action', body: '正在读取版本信息' }),
          ],
        },
      },
    })
  })

  it('keeps tool-round messages inside one progress summary', () => {
    const feed = buildExpertCollabFeed([
      {
        id: 'tool-round-1',
        role: 'assistant',
        text: '调用工具：mkdir',
        trace: [{ id: 'mkdir', kind: 'tool', title: 'mkdir', status: 'done' }],
      },
    ], [
      { id: 'progress-1', type: 'tool_progress', summary: '已创建工作目录' },
      { id: 'progress-2', type: 'tool_progress', summary: '正在写入页面文件' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative).toHaveLength(1)
    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: {
        body: '正在写入页面文件',
        execution: {
          activities: [
            expect.objectContaining({ kind: 'action', body: '已创建工作目录' }),
            expect.objectContaining({ kind: 'action', body: '正在写入页面文件' }),
          ],
        },
      },
    })
  })

  it('treats runtime preparation stages as progress instead of duplicate dialogue', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'prepare-start', type: 'stage_prepare', summary: '正在准备上下文…', createdAt: '2026-09-02T10:00:00.000Z' },
      { id: 'prepare-done', type: 'stage_prepare', summary: '上下文准备完成', createdAt: '2026-09-02T10:00:01.000Z' },
      { id: 'started', type: 'task_started', summary: '专家已开始执行', createdAt: '2026-09-02T10:00:02.000Z' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')
    const moments = narrative.filter((item) => item.kind === 'moment')

    expect(moments).toHaveLength(1)
    expect(moments[0]).toMatchObject({
      kind: 'moment',
      moment: {
        body: '上下文准备完成',
        active: true,
        execution: {
          activities: [
            expect.objectContaining({ kind: 'commentary', body: '我正在整理完成这项工作所需的背景和材料。' }),
            expect.objectContaining({ kind: 'commentary', body: '上下文准备完成' }),
          ],
        },
      },
    })
  })

  it('shows user input as a normal collaboration turn', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'input', type: 'input_provided', summary: '目标环境是 3.8 版本。' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: { role: 'user', body: '目标环境是 3.8 版本。' },
    })
  })

  it('shows queued input as a user turn while the expert is still working', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'queued', type: 'input_queued', summary: '优先使用已确认的视觉方案。' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: { role: 'user', body: '优先使用已确认的视觉方案。' },
    })
  })

  it('shows a plan confirmation as a durable user turn after reopening the task', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'plan-confirmed', type: 'plan_confirmed', kind: 'message', source: 'user', summary: '确认计划并执行' },
      { id: 'created', type: 'created', summary: '已确认委托单并开始预检' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: { role: 'user', body: '确认计划并执行' },
    })
  })

  it('uses explicit user provenance for new event types without a per-agent allowlist', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'custom-user-action', type: 'agent_question_answered', kind: 'message', source: 'user', summary: '只处理本周数据。' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: { role: 'user', body: '只处理本周数据。' },
    })
  })

  it('keeps concrete planned work while hiding a generic start event', () => {
    const feed = buildExpertCollabFeed([], [
      { id: 'generic', type: 'task_started', summary: '专家已开始执行', createdAt: '2026-09-02T10:00:00.000Z' },
      { id: 'planned', type: 'task_started', summary: '先整理消息，再核对负责人', createdAt: '2026-09-02T10:00:01.000Z' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')

    expect(narrative).toHaveLength(1)
    expect(narrative[0]).toMatchObject({
      kind: 'moment',
      moment: { body: '我会先整理消息，再核对负责人。', disclosure: { label: '查看工作路径' } },
    })
  })

  it('shows an active execution update even when earlier chat messages exist', () => {
    const feed = buildExpertCollabFeed([
      { id: 'plan', role: 'assistant', text: '这是已确认的协作计划。' },
    ], [
      { id: 'started', type: 'task_started', summary: '专家已开始执行' },
    ], [])

    const narrative = buildExpertCollabNarrative(feed, 'running')
    const active = narrative.find((item) => item.kind === 'moment' && item.moment.active)

    expect(active).toMatchObject({
      kind: 'moment',
      moment: {
        body: '执行已开始，我正在推进第一项工作。',
        execution: {
          status: 'running',
          activities: [expect.objectContaining({
            kind: 'commentary',
            body: '执行已开始，我正在推进第一项工作。',
          })],
        },
      },
    })
  })
})


describe('plan confirmation echo reconciliation', () => {
  const confirmation = '确认计划并执行'
  const event = { id: 'confirmed-event', type: 'plan_confirmed', source: 'user' as const, summary: confirmation, createdAt: '2026-09-16T04:49:41.687Z' }
  const userTurns = (feed: ReturnType<typeof buildExpertCollabNarrative>) => feed.filter(item => item.kind === 'message' ? item.message.role === 'user' : item.kind === 'moment' && item.moment.role === 'user')

  it.each(['plan-confirm-1720', 'restored-plan-confirmation-task-one'])('shows one confirmation when %s also has a persisted event', id => {
    const feed = buildExpertCollabFeed([
      { id, role: 'user', text: confirmation, createdAt: '2026-09-16T04:49:41.500Z' },
      { id: 'plan-start-1720', role: 'assistant', text: '计划已确认，执行已经开始。', createdAt: '2026-09-16T04:49:41.500Z' },
    ], [event], [])
    const narrative = buildExpertCollabNarrative(feed, 'failed')
    expect(userTurns(narrative)).toHaveLength(1)
    expect(narrative[0]).toMatchObject({ kind: 'message', message: { id, text: confirmation } })
    expect(feed.filter(item => item.kind === 'event')).toHaveLength(1)
  })

  it('preserves historical confirmation when only the event exists', () => {
    const narrative = buildExpertCollabNarrative(buildExpertCollabFeed([], [event], []), 'completed')
    expect(userTurns(narrative)).toHaveLength(1)
  })

  it('does not deduplicate ordinary repeated user messages by text', () => {
    const feed = buildExpertCollabFeed([
      { id: 'typed-one', role: 'user', text: confirmation },
      { id: 'typed-two', role: 'user', text: confirmation },
    ], [event], [])
    expect(userTurns(buildExpertCollabNarrative(feed, 'failed'))).toHaveLength(3)
  })

  it('matches mirrors one to one and keeps a different later confirmation', () => {
    const feed = buildExpertCollabFeed([{ id: 'plan-confirm-1720', role: 'user', text: confirmation }], [event, { ...event, id: 'confirmed-again' }, { ...event, id: 'confirmed-different', summary: '确认调整后的计划' }], [])
    expect(userTurns(buildExpertCollabNarrative(feed, 'completed'))).toHaveLength(3)
  })
})
