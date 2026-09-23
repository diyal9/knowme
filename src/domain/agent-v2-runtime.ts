// @ts-nocheck — lib IIFE modules (agent-message-state / markdown-lite / grounding) are CJS at runtime.
import * as messageStateNs from '@knowme-lib/agent-message-state'
import * as groundingNs from '@knowme-lib/conversation-grounding'
import type { AgentTurnIdentity, ChatMessage, ConversationHistoryTurn } from '../shared/api'
import { extractStructuredChoiceFromText, parseStructuredChoiceBars } from './agent-message-ui'
import { applyAssistantStreamEvent, stampStreamTiming } from './agent-execution-timeline'
import { renderKnowledgeMarkdown } from './knowledge-markdown'
import type { ExpertDiscussionContext, ExpertDiscussionMode } from './expert-discussion'
import { normalizeMessageLinkBoundaries } from './message-links'

type MessageReducer = {
  createMessageState: (runId: string) => unknown
  reduceMessageEvent: (state: unknown, event: Record<string, unknown>) => {
    changed?: boolean
    state: unknown
  }
  applyStateToMessage: (message: ChatMessage, state: unknown) => ChatMessage
}

type GroundingApi = {
  buildGrounding: (input: {
    prompt?: string
    displayPrompt?: string
    context?: string
    task?: unknown
    attachment?: string
  }) => Record<string, unknown>
}

/** Vite `import *` of CJS `module.exports = api` may nest `default` one or more times. */
export function unwrapCjsApi<T>(mod: unknown, method: string): T {
  const queue: unknown[] = [mod]
  const seen = new Set<unknown>()
  while (queue.length) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    const rec = current as Record<string, unknown>
    if (typeof rec[method] === 'function') return rec as T
    if (rec.default !== undefined) queue.push(rec.default)
  }
  return (mod && typeof mod === 'object' ? mod : {}) as T
}

const reducer = unwrapCjsApi<MessageReducer>(messageStateNs, 'reduceMessageEvent')
const groundingApi = unwrapCjsApi<GroundingApi>(groundingNs, 'buildGrounding')

export function createAgentRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function conversationMessageId(runId: string, role: 'user' | 'assistant'): string {
  return `msg_${String(runId || '').trim()}_${role}`
}

export function extractSkillRefs(prompt: string, extra: string[] = []): string[] {
  const fromPrompt = [...String(prompt || '').matchAll(/(^|\s)\/([a-z0-9][a-z0-9-]{0,31})\b/gi)]
    .map((match) => String(match[2] || '').toLowerCase())
  return [...new Set([...extra, ...fromPrompt].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
}

export function buildContentGrounding(input: {
  prompt: string
  displayPrompt?: string
  context?: string
  attachment?: string
  task?: unknown
}): Record<string, unknown> {
  if (typeof groundingApi.buildGrounding !== 'function') {
    return { active: false, text: '', title: '日常交流', labels: ['交流'] }
  }
  return groundingApi.buildGrounding(input)
}

export function renderAgentMarkdown(src: string): string {
  return renderKnowledgeMarkdown(String(src || ''))
}

export const INCOMPLETE_ASSISTANT_REPLY = '未能收到完整答复，请重试。'

export function isV2StreamEvent(event: Record<string, unknown>): boolean {
  return event.version != null
}

export function normalizeV2StreamEvent(event: Record<string, unknown>): Record<string, unknown> {
  const seqNum = Number(event.seq)
  const versionNum = Number(event.version)
  return {
    ...event,
    runId: event.runId == null ? event.runId : String(event.runId),
    seq: Number.isFinite(seqNum) ? Math.trunc(seqNum) : event.seq,
    version: Number.isFinite(versionNum) ? versionNum : event.version,
  }
}

export function applyRuntimeStreamEvent(message: ChatMessage, event: Record<string, unknown>): ChatMessage {
  if (!isV2StreamEvent(event)) return stampStreamTiming(applyAssistantStreamEvent(message, event))
  const normalized = normalizeV2StreamEvent(event)
  try {
    if (typeof reducer.reduceMessageEvent !== 'function' || typeof reducer.applyStateToMessage !== 'function') {
      // A V2 envelope is owned by the protocol reducer. If the reducer is
      // unavailable, fail closed instead of silently routing the event through
      // the legacy compatibility path (which can duplicate or overwrite an
      // answer that was already rendered).
      return stampStreamTiming(message)
    }
    const runId = String(message.runId || normalized.runId || 'run')
    const isAnswerCommit = String(normalized.type || '') === 'answer.committed'
    const alreadyCommitted = Boolean(
      message.v2AnswerCommitted
      || (message.protocolVersion === 2 && message.answerHash && String(message.text || '').trim()),
    )
    if (isAnswerCommit && alreadyCommitted) {
      return stampStreamTiming({
        ...message,
        streaming: false,
        thinking: false,
        protocolVersion: 2,
        v2AnswerCommitted: true,
      })
    }
    const state = message.messageState || reducer.createMessageState?.(runId)
    const reduced = reducer.reduceMessageEvent(state, normalized)
    if (!reduced?.changed) {
      // A V2 event that the reducer rejects is not a legacy stream event.
      // Project the reducer state for diagnostics/counters, but never let the
      // rejected payload mutate the visible answer through the compatibility
      // fallback (which would duplicate or overwrite a committed response).
      if (reduced?.ignored) {
        const rejected: ChatMessage = { ...message, messageState: reduced.state, protocolVersion: 2 }
        reducer.applyStateToMessage(rejected, reduced.state)
        return stampStreamTiming(rejected)
      }
      return stampStreamTiming(message)
    }
    const next: ChatMessage = { ...message, messageState: reduced.state, protocolVersion: 2, thinking: false }
    reducer.applyStateToMessage(next, reduced.state)
    const ui = (next as ChatMessage & { ui?: unknown }).ui
    const structured = parseStructuredChoiceBars(ui)
    if (structured.length) next.structuredUi = structured
    return stampStreamTiming(next)
  } catch {
    // A V2 envelope must fail closed if its reducer cannot process it. The
    // legacy fallback is reserved for events without a V2 envelope.
    return stampStreamTiming(message)
  }
}

export function buildAgentGeneratePayload(input: {
  prompt: string
  sessionId: string
  agentId?: string
  runId: string
  history: ConversationHistoryTurn[]
  turn: AgentTurnIdentity
  attachment?: { name?: string; text?: string; kind?: 'text' | 'image'; mimeType?: string; dataUrl?: string }
  displayPrompt?: string
  task?: unknown
  role?: string
  expertId?: string
  surface?: string
  taskRef?: { id?: string; kind?: string } | null
  skillRefs?: string[]
  conversationMode?: ExpertDiscussionMode
  expertDiscussionContext?: ExpertDiscussionContext
  orchestrationMode?: 'expert-adaptive' | 'workflow-fixed'
}): Record<string, unknown> {
  const prompt = normalizeMessageLinkBoundaries(input.prompt)
  const attachedContext = input.attachment?.text
    ? `\n\n[用户附加文件：${input.attachment.name || '未命名文件'}]\n${input.attachment.text}\n[附加文件结束]`
    : ''
  const contentGrounding = buildContentGrounding({
    prompt,
    displayPrompt: input.displayPrompt || '',
    context: attachedContext,
    attachment: input.attachment?.text || '',
    task: input.task || null,
  })
  return {
    prompt,
    displayPrompt: input.displayPrompt || '',
    context: attachedContext.trim() || null,
    history: input.history,
    turn: input.turn,
    skillRefs: [...new Set([...(input.skillRefs || []), ...extractSkillRefs(prompt)])],
    contentGrounding,
    sessionId: input.sessionId,
    agentId: input.agentId || 'general',
    runId: input.runId,
    role: input.role || input.agentId || 'general',
    expertId: input.expertId || '',
    surface: input.surface || 'assistant',
    taskRef: input.taskRef || null,
    hasImage: input.attachment?.kind === 'image',
    attachments: input.attachment ? [input.attachment] : [],
    conversationMode: input.conversationMode || '',
    expertDiscussionContext: input.expertDiscussionContext || null,
    orchestrationMode: input.orchestrationMode
      || (input.expertId ? 'expert-adaptive' : input.taskRef?.kind?.startsWith('workflow') ? 'workflow-fixed' : ''),
  }
}
