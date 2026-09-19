import { resolveAssistantModeId, type AssistantModeId } from './assistant-modes'

export const WB_EXPERT_SESSION_PREFIX = 'wb-expert-'
export const WB_RUN_SESSION_PREFIX = 'wb-run-'
export const WB_PARTNER_SESSION_PREFIX = 'wb-partner-'

export type WorkbenchDialogueSurface = 'expert' | 'partner' | 'workflow'
export type WorkbenchExpertDialogueMode = 'planning' | 'discussion' | 'execution'

export interface WorkbenchDialogueBinding {
  sessionId: string
  surface: WorkbenchDialogueSurface
  lane: string
  ref: string
}

function laneToken(raw: string): string {
  return String(raw || 'general').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'general'
}

export function isWorkbenchLaneSessionId(id: string | undefined | null): boolean {
  const value = String(id || '')
  return value.startsWith(WB_EXPERT_SESSION_PREFIX)
    || value.startsWith(WB_RUN_SESSION_PREFIX)
    || value.startsWith(WB_PARTNER_SESSION_PREFIX)
}

export function workbenchExpertSessionId(expertId: string): string {
  return `${WB_EXPERT_SESSION_PREFIX}${laneToken(expertId)}`
}

/** Canonical task-bound expert discussion lane; preserves the existing v3 ids. */
export function workbenchExpertDiscussionSessionId(
  taskId: string,
  mode: WorkbenchExpertDialogueMode | string = 'planning',
): string {
  const normalizedMode = laneToken(String(mode || 'planning').replace(/^expert-/, '')) || 'planning'
  return workbenchExpertSessionId(`${taskId}-${normalizedMode}-v3`)
}

export function workbenchRunSessionId(slug: string): string {
  return `${WB_RUN_SESSION_PREFIX}${laneToken(slug)}`
}

/** Canonical workflow lane name; kept separate from the legacy run helper. */
export function workbenchWorkflowSessionId(slug: string): string {
  return workbenchRunSessionId(slug)
}

/** Reserved partner lane for workbench-scoped partner conversations. */
export function workbenchPartnerSessionId(scope = 'default'): string {
  return `${WB_PARTNER_SESSION_PREFIX}${laneToken(scope)}`
}

export function workbenchDialogueBindingForSessionId(
  sessionId: string | undefined | null,
): WorkbenchDialogueBinding | undefined {
  const value = String(sessionId || '')
  if (value.startsWith(WB_EXPERT_SESSION_PREFIX)) {
    const ref = value.slice(WB_EXPERT_SESSION_PREFIX.length)
    const mode = ref.match(/-(planning|discussion|execution)-v3$/)?.[1]
    return { sessionId: value, surface: 'expert', lane: mode ? `expert-${mode}` : 'expert', ref }
  }
  if (value.startsWith(WB_RUN_SESSION_PREFIX)) {
    return { sessionId: value, surface: 'workflow', lane: 'workflow', ref: value.slice(WB_RUN_SESSION_PREFIX.length) }
  }
  if (value.startsWith(WB_PARTNER_SESSION_PREFIX)) {
    return { sessionId: value, surface: 'partner', lane: 'partner', ref: value.slice(WB_PARTNER_SESSION_PREFIX.length) }
  }
  return undefined
}

export function workbenchTaskRefForSessionId(sessionId: string): { id: string; kind: string } | undefined {
  const value = String(sessionId || '')
  if (value.startsWith(WB_EXPERT_SESSION_PREFIX)) {
    return { id: value.slice(WB_EXPERT_SESSION_PREFIX.length), kind: 'expert-chat' }
  }
  if (value.startsWith(WB_RUN_SESSION_PREFIX)) {
    return { id: value.slice(WB_RUN_SESSION_PREFIX.length), kind: 'workflow-chat' }
  }
  if (value.startsWith(WB_PARTNER_SESSION_PREFIX)) {
    return { id: value.slice(WB_PARTNER_SESSION_PREFIX.length), kind: 'partner-chat' }
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
