import { describe, expect, it } from 'vitest'
import { projectWorkbenchTaskAction } from './workbench-task-action'

describe('workbench task action projection', () => {
  it('keeps approval and discussion as separate allowed commands', () => {
    const action = projectWorkbenchTaskAction({
      status: 'needs_input',
      attention: { kind: 'approval_required', action: 'review_approval', title: '等待操作审批', detail: 'x' } as never,
    })
    expect(action.kind).toBe('approve_operation')
    expect(action.allowedCommands).toEqual(['approve_operation', 'discuss', 'cancel'])
    expect(action.canDiscuss).toBe(true)
  })

  it('does not expose plan confirmation while clarification is unresolved', () => {
    expect(projectWorkbenchTaskAction({ status: 'draft', planReady: true, planningClarifying: true }).kind).toBe('clarify')
  })

  it.each([
    ['draft awaiting clarification', { status: 'draft', planningClarifying: true }, 'clarify'],
    ['draft with a complete plan', { status: 'draft', planReady: true }, 'confirm_plan'],
    ['capability unavailable', { attention: { kind: 'capability_unavailable', action: 'open_capability' } as never }, 'authorize_capability'],
    ['retryable failure', { attention: { action: 'retry', title: '执行失败' } as never }, 'retry'],
    ['pending acceptance', { status: 'review', hasPendingReview: true }, 'verify_result'],
    ['terminal task', { status: 'completed', terminal: true }, 'discuss'],
  ])('projects %s to one canonical primary action', (_label, input, expected) => {
    const action = projectWorkbenchTaskAction(input)
    expect(action.kind).toBe(expected)
    expect(action.primaryLabel).toBeTruthy()
    expect(action.allowedCommands).toContain(expected)
  })
})
