import type { ExpertTaskAttention } from '../shared/api'

export type WorkbenchTaskActionKind =
  | 'clarify'
  | 'confirm_plan'
  | 'approve_operation'
  | 'authorize_capability'
  | 'retry'
  | 'verify_result'
  | 'discuss'
  | 'cancel'

export interface WorkbenchTaskActionProjection {
  kind: WorkbenchTaskActionKind
  title: string
  detail: string
  primaryLabel: string
  canDiscuss: boolean
  allowedCommands: WorkbenchTaskActionKind[]
}

export function projectWorkbenchTaskAction(input: {
  status?: string | null
  attention?: ExpertTaskAttention | null
  planReady?: boolean
  planningClarifying?: boolean
  hasPendingReview?: boolean
  terminal?: boolean
}): WorkbenchTaskActionProjection {
  const attention = input.attention
  if (attention?.kind === 'approval_required') {
    return {
      kind: 'approve_operation',
      title: '等待操作审批',
      detail: '请在审批卡中核对并批准或拒绝本次操作；讨论不会自动批准。',
      primaryLabel: '查看审批卡',
      canDiscuss: true,
      allowedCommands: ['approve_operation', 'discuss', 'cancel'],
    }
  }
  if (attention?.action === 'retry') {
    return {
      kind: 'retry', title: attention.title || '需要重新执行',
      detail: attention.detail || '任务背景和已有材料已保留，可以重新执行。',
      primaryLabel: '重新执行', canDiscuss: true, allowedCommands: ['retry', 'discuss', 'cancel'],
    }
  }
  if (attention?.kind === 'capability_unavailable' || attention?.action === 'open_capability' || attention?.action === 'open_settings') {
    return {
      kind: 'authorize_capability', title: attention.title || '需要启用执行能力',
      detail: attention.detail || '完成能力安装、启用或授权后再继续。',
      primaryLabel: attention.action === 'open_settings' ? '前往设置' : '前往能力中心',
      canDiscuss: true, allowedCommands: ['authorize_capability', 'discuss', 'cancel'],
    }
  }
  if (input.status === 'draft' && input.planningClarifying) {
    return {
      kind: 'clarify', title: '等待补充信息', detail: '请先回答未澄清的问题，专家会更新计划。',
      primaryLabel: '补充信息', canDiscuss: true, allowedCommands: ['clarify', 'discuss', 'cancel'],
    }
  }
  if (input.status === 'draft' && input.planReady) {
    return {
      kind: 'confirm_plan', title: '等待确认计划', detail: '确认后才会开始执行。',
      primaryLabel: '确认计划并执行', canDiscuss: true, allowedCommands: ['confirm_plan', 'discuss', 'cancel'],
    }
  }
  if (input.hasPendingReview || input.status === 'review') {
    return {
      kind: 'verify_result', title: '等待验收成果', detail: '请查看成果并接受或提出修改意见。',
      primaryLabel: '查看成果', canDiscuss: true, allowedCommands: ['verify_result', 'discuss', 'cancel'],
    }
  }
  if (input.terminal) {
    return {
      kind: 'discuss', title: '可以继续讨论', detail: '任务记录已保留，可继续追问或发起后续委托。',
      primaryLabel: '继续讨论', canDiscuss: true, allowedCommands: ['discuss'],
    }
  }
  return {
    kind: 'discuss', title: '协作进行中', detail: '可以补充方向或材料。',
    primaryLabel: '继续讨论', canDiscuss: true, allowedCommands: ['discuss', 'cancel'],
  }
}
