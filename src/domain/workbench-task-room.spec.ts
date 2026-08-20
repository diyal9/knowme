import { describe, expect, it } from 'vitest'
import {
  resolveWorkbenchTaskKind,
  workbenchRunReturnSurface,
  workbenchTaskBackLabel,
  workbenchTaskHasDaemonReview,
  workbenchTaskModeLabel,
  joinTaskTitle,
  workbenchTaskShowsDialogue,
  workbenchTaskStateLabel,
  workbenchTaskStateTone,
} from './workbench-task-room'

describe('workbench-task-room', () => {
  it('maps pipeline runs to review chrome instead of workflow chat', () => {
    const kind = resolveWorkbenchTaskKind({ expertRoom: false, lane: 'pipeline' })
    expect(kind).toBe('pipeline-review')
    expect(workbenchTaskModeLabel(kind)).toBe('管线服务')
    expect(workbenchTaskBackLabel(kind)).toBe('返回管线服务')
    expect(workbenchTaskShowsDialogue(kind)).toBe(true)
    expect(workbenchRunReturnSurface('pipeline')).toBe('manage')
  })

  it('joins status titles without a dangling separator', () => {
    expect(joinTaskTitle('整理纪要', '制作人')).toBe('整理纪要 · 制作人')
    expect(joinTaskTitle('', '制作人')).toBe('制作人')
    expect(joinTaskTitle('制作人', '制作人')).toBe('制作人')
  })

  it('keeps shelf runs as workflow dialogue', () => {
    const kind = resolveWorkbenchTaskKind({ expertRoom: false, lane: 'workflow' })
    expect(kind).toBe('workflow-chat')
    expect(workbenchTaskModeLabel(kind)).toBe('工作流')
    expect(workbenchTaskShowsDialogue(kind)).toBe(true)
    expect(workbenchRunReturnSurface('workflow')).toBe('shelf')
    expect(workbenchTaskBackLabel(kind)).toBe('返回工作流')
    expect(workbenchTaskStateLabel(kind, 'input')).toBe('待启动')
    expect(workbenchTaskStateLabel(kind, 'running')).toBe('执行中')
    expect(workbenchTaskStateLabel(kind, 'hitl')).toBe('等待确认')
    expect(workbenchTaskStateLabel(kind, 'done')).toBe('已完成')
    expect(workbenchTaskStateTone('running')).toBe('running')
  })

  it('does not share daemon review with workflow dialogue', () => {
    expect(workbenchTaskHasDaemonReview('workflow-chat')).toBe(false)
    expect(workbenchTaskHasDaemonReview('pipeline-review')).toBe(true)
    expect(workbenchTaskHasDaemonReview('expert-chat')).toBe(false)
  })
})
