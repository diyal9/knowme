import type { ChatMessage } from '../../../shared/api'
import { chatMessagesFromSession } from '../../../domain/agent-session'
import { applyRuntimeStreamEvent } from '../../../domain/agent-v2-runtime'
import { stampStreamTiming } from '../../../domain/agent-execution-timeline'
import {
  laneHasMessage,
  laneHasStreaming,
  mapMessageById,
  stopStreamingMessages,
} from '../../../domain/live-chat-lanes'
import type { AgentContextInfo } from '../../../domain/agent-context-usage'
import type { AppState, SessionSlice, StoreGet, StoreSet } from '../../app/store-types'
import { api } from '../../app/store-types'

export function emptySessionSlice(): SessionSlice {
  return { messages: [], composer: '', attachments: [] }
}

export function getSessionSlice(states: Record<string, SessionSlice>, id: string): SessionSlice {
  return states[id] ?? emptySessionSlice()
}

export function patchSession(
  states: Record<string, SessionSlice>,
  id: string,
  patch: Partial<SessionSlice>,
): Record<string, SessionSlice> {
  const current = getSessionSlice(states, id)
  return { ...states, [id]: { ...current, ...patch } }
}

export function patchAssistantMessage(
  states: Record<string, SessionSlice>,
  sessionId: string,
  assistantId: string,
  updater: (msg: ChatMessage) => ChatMessage,
): Record<string, SessionSlice> {
  const slice = getSessionSlice(states, sessionId)
  return patchSession(states, sessionId, {
    messages: mapMessageById(slice.messages, assistantId, updater),
  })
}

/** 按气泡 id 写入助理 session、专家协作、工作流任务对话（可并行存在于不同槽）。 */
export function patchLiveAssistantMessage(
  state: AppState,
  assistantId: string,
  updater: (msg: ChatMessage) => ChatMessage,
  sessionId: string | null = activeStreamSessionId,
): Partial<AppState> {
  const next: Partial<AppState> = {}
  if (sessionId && laneHasMessage(getSessionSlice(state.sessionStates, sessionId).messages, assistantId)) {
    next.sessionStates = patchAssistantMessage(state.sessionStates, sessionId, assistantId, updater)
  }
  if (state.expertRoom && laneHasMessage(state.expertRoom.messages, assistantId)) {
    next.expertRoom = {
      ...state.expertRoom,
      messages: mapMessageById(state.expertRoom.messages, assistantId, updater),
    }
  }
  if (state.run && laneHasMessage(state.run.dialogueMessages, assistantId)) {
    next.run = {
      ...state.run,
      dialogueMessages: mapMessageById(state.run.dialogueMessages, assistantId, updater),
    }
  }
  return next
}

export function stopLiveStreamingMessages(state: AppState): Partial<AppState> {
  const next: Partial<AppState> = {}
  let sessionStates = state.sessionStates
  let changed = false
  for (const [id, slice] of Object.entries(state.sessionStates)) {
    if (!laneHasStreaming(slice.messages)) continue
    sessionStates = patchSession(sessionStates, id, { messages: stopStreamingMessages(slice.messages) })
    changed = true
  }
  if (changed) next.sessionStates = sessionStates
  if (state.expertRoom && laneHasStreaming(state.expertRoom.messages)) {
    next.expertRoom = { ...state.expertRoom, messages: stopStreamingMessages(state.expertRoom.messages) }
  }
  if (state.run && laneHasStreaming(state.run.dialogueMessages)) {
    next.run = { ...state.run, dialogueMessages: stopStreamingMessages(state.run.dialogueMessages) }
  }
  return next
}

let activeStreamAssistantId: string | null = null
let activeStreamSessionId: string | null = null
let streamUnsub: (() => void) | null = null
let streamEventUnsub: (() => void) | null = null

function parseContextInfo(raw: unknown): AgentContextInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const sectionUsage = Array.isArray(record.sectionUsage)
    ? record.sectionUsage.map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        key: String(row.key || ''),
        usedTokens: Number(row.usedTokens) || 0,
      }
    }).filter((item) => item.key)
    : undefined
  return {
    usedTokens: Number(record.usedTokens) || undefined,
    contextWindow: Number(record.contextWindow) || undefined,
    omittedTurns: Number(record.omittedTurns) || undefined,
    omittedMessages: Number(record.omittedMessages) || undefined,
    sectionUsage,
    sectionOmitted: Array.isArray(record.sectionOmitted)
      ? record.sectionOmitted.map((item) => String(item || '')).filter(Boolean)
      : undefined,
  }
}

function applyStreamEvent(set: StoreSet, event: Record<string, unknown>) {
  const type = String(event.type || '')
  const nested = event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : {}
  const title = String(nested.title || event.title || '').trim()
  const contextInfo = parseContextInfo(nested.contextInfo || event.contextInfo)

  set((state: AppState) => {
    const next: Partial<AppState> = {}
    if (contextInfo) next.assistantContextInfo = contextInfo
    if (title && type !== 'cancelled') next.assistantStatus = title
    if (type === 'error') next.assistantStatus = title || '生成失败'
    if (type === 'cancelled') next.assistantStatus = '已停止生成'
    const assistantId = activeStreamAssistantId
    const sessionId = activeStreamSessionId
    if (assistantId && sessionId) {
      Object.assign(next, patchLiveAssistantMessage(state, assistantId, (msg) => {
        if (event.runId && msg.runId && String(event.runId) !== String(msg.runId)) return msg
        return applyRuntimeStreamEvent(msg, event)
      }, sessionId))
    }
    return next
  })
}

export function detachStreamListener() {
  streamUnsub?.()
  streamUnsub = null
  streamEventUnsub?.()
  streamEventUnsub = null
  activeStreamAssistantId = null
  activeStreamSessionId = null
}

/** ipcMain.handle 回包常早于同轮 webContents.send；短 flush 让 v2 envelope 先归约。 */
export function waitForStreamFlush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 16)
  })
}

export function attachStreamListener(set: StoreSet) {
  if (!streamUnsub && api()?.onAiStreamChunk) {
    streamUnsub = api()!.onAiStreamChunk!((chunk) => {
      const assistantId = activeStreamAssistantId
      const sessionId = activeStreamSessionId
      if (!assistantId || !sessionId) return
      if (chunk.sessionId && chunk.sessionId !== sessionId) return
      const text = chunk.text ?? ''
      set((state: AppState) => patchLiveAssistantMessage(state, assistantId, (msg) => {
        if (msg.protocolVersion === 2 || msg.v2AnswerCommitted) return msg
        return stampStreamTiming({ ...msg, text, thinking: false, streaming: true })
      }, sessionId))
    })
  }

  if (!streamEventUnsub && api()?.onAiStreamEvent) {
    streamEventUnsub = api()!.onAiStreamEvent!((event) => {
      const sessionId = activeStreamSessionId
      if (!sessionId) return
      if (event?.sessionId && event.sessionId !== sessionId) return
      if (event && typeof event === 'object') {
        applyStreamEvent(set, event as Record<string, unknown>)
      }
    })
  }
}

export function beginAssistantStream(assistantId: string, sessionId: string, set: StoreSet) {
  activeStreamAssistantId = assistantId
  activeStreamSessionId = sessionId
  set({
    assistantProcessLines: [],
    assistantProcessFeed: '',
  })
  attachStreamListener(set)
}

export async function hydrateSession(set: StoreSet, get: StoreGet, id: string) {
  if (getSessionSlice(get().sessionStates, id).messages.length) return
  try {
    const raw = await api()?.agentSessionGet?.(id)
    const messages = chatMessagesFromSession(raw)
    if (!messages.length) return
    set((state) => ({
      sessionStates: {
        ...state.sessionStates,
        [id]: { ...getSessionSlice(state.sessionStates, id), messages },
      },
    }))
  } catch {
    /* keep empty */
  }
}
