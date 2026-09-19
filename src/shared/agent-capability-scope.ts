export type TaskCapabilityKind = 'skills' | 'connectors' | 'knowledge'

export interface TaskCapabilityGrant {
  id: string
  sessionId: string
  taskId: string
  agentId: string
  capabilityKind: TaskCapabilityKind
  capabilityId: string
  draftId: string
  approvedBy: 'user'
  approvedAt: string
  revokedAt: string | null
}

export interface TaskCapabilityGrantResult {
  ok: boolean
  code?: string
  message?: string
  grantId?: string
  restartRequired?: boolean
}
