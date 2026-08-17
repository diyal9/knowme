import { resolveAssistantModeId, type AssistantModeId } from './assistant-modes'

export const WB_EXPERT_SESSION_PREFIX = 'wb-expert-'
export const WB_RUN_SESSION_PREFIX = 'wb-run-'

function laneToken(raw: string): string {
  return String(raw || 'general').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'general'
}

export function isWorkbenchLaneSessionId(id: string | undefined | null): boolean {
  const value = String(id || '')
  return value.startsWith(WB_EXPERT_SESSION_PREFIX) || value.startsWith(WB_RUN_SESSION_PREFIX)
}

export function workbenchExpertSessionId(expertId: string): string {
  return `${WB_EXPERT_SESSION_PREFIX}${laneToken(expertId)}`
}

export function workbenchRunSessionId(slug: string): string {
  return `${WB_RUN_SESSION_PREFIX}${laneToken(slug)}`
}

export function workbenchTaskRefForSessionId(sessionId: string): { id: string; kind: string } | undefined {
  const value = String(sessionId || '')
  if (value.startsWith(WB_EXPERT_SESSION_PREFIX)) {
    return { id: value.slice(WB_EXPERT_SESSION_PREFIX.length), kind: 'expert-chat' }
  }
  if (value.startsWith(WB_RUN_SESSION_PREFIX)) {
    return { id: value.slice(WB_RUN_SESSION_PREFIX.length), kind: 'workflow-chat' }
  }
  return undefined
}

export function resolveKernelRole(input: {
  agentId?: string
  expertId?: string
  category?: string
  kind?: string
  name?: string
  description?: string
} = {}): AssistantModeId {
  const direct = [input.agentId, input.expertId]
    .map((item) => String(item || '').trim())
    .find((item) => item === 'steward' || item === 'writing' || item === 'coding')
  if (direct) return direct
  const blob = [input.agentId, input.expertId, input.category, input.kind, input.name, input.description]
    .map((item) => String(item || ''))
    .join(' ')
    .toLowerCase()
  if (/steward|知识管家|知识库|wiki|knowledge/.test(blob)) return 'steward'
  if (/writ|写作|文档|文案|纪要/.test(blob)) return 'writing'
  if (/cod|研发|工程|engineer|debug|编程/.test(blob)) return 'coding'
  return resolveAssistantModeId(input.agentId)
}
