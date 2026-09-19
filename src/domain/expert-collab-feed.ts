import type { ChatMessage, WorkbenchTask } from '../shared/api'

export type ExpertCollabFeedItem =
  | { kind: 'message'; message: ChatMessage; index: number }
  | { kind: 'event'; event: NonNullable<WorkbenchTask['events']>[number]; index: number }
  | { kind: 'deliverable'; deliverable: NonNullable<WorkbenchTask['deliverables']>[number]; index: number }

function timeOf(value: unknown): number | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const time = Date.parse(raw)
  return Number.isFinite(time) ? time : null
}

function sequenceOf(item: ExpertCollabFeedItem): number | null {
  const value = item.kind === 'event' ? item.event.sequence : item.kind === 'deliverable' ? item.deliverable.sequence : undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Merge user-visible transcript sources into one stable chronological stream.
 * Missing timestamps retain source order and use the historical source priority.
 */
export function buildExpertCollabFeed(
  messages: ChatMessage[],
  events: NonNullable<WorkbenchTask['events']>,
  deliverables: NonNullable<WorkbenchTask['deliverables']>,
): ExpertCollabFeedItem[] {
  const items: ExpertCollabFeedItem[] = [
    ...(Array.isArray(messages) ? messages : []).map((message, index) => ({ kind: 'message' as const, message, index })),
    ...(Array.isArray(events) ? events : []).map((event, index) => ({ kind: 'event' as const, event, index })),
    ...(Array.isArray(deliverables) ? deliverables : []).map((deliverable, index) => ({ kind: 'deliverable' as const, deliverable, index })),
  ]
  return items.sort((a, b) => {
    const aTime = timeOf(a.kind === 'message' ? a.message.createdAt : a.kind === 'event' ? a.event.createdAt : a.deliverable.createdAt)
    const bTime = timeOf(b.kind === 'message' ? b.message.createdAt : b.kind === 'event' ? b.event.createdAt : b.deliverable.createdAt)
    if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime
    if (aTime !== null && bTime !== null && aTime === bTime) {
      const aSequence = sequenceOf(a)
      const bSequence = sequenceOf(b)
      if (aSequence !== null && bSequence !== null && aSequence !== bSequence) return aSequence - bSequence
    }
    if (aTime !== null && bTime === null) return b.kind === 'message' ? 1 : -1
    if (aTime === null && bTime !== null) return a.kind === 'message' ? -1 : 1
    const aLegacyKind = a.kind === 'message' ? 0 : a.kind === 'event' ? 1 : 2
    const bLegacyKind = b.kind === 'message' ? 0 : b.kind === 'event' ? 1 : 2
    return aLegacyKind - bLegacyKind || a.index - b.index
  })
}

/** Merge reopened-session history with the current in-memory room without duplicating turns. */
export function mergeExpertChatMessages(...sources: ChatMessage[][]): ChatMessage[] {
  const entries = sources.flatMap((messages, sourceIndex) => (
    (Array.isArray(messages) ? messages : []).map((message, itemIndex) => ({ message, sourceIndex, itemIndex }))
  ))
  const byId = new Map<string, typeof entries[number]>()
  const anonymous = new Map<string, typeof entries[number]>()
  for (const entry of entries) {
    const id = String(entry.message.id || '').trim()
    const key = id || `${entry.message.role}:${entry.message.createdAt || ''}:${entry.message.text}`
    const bucket = id ? byId : anonymous
    const previous = bucket.get(key)
    if (!previous || (previous.message.streaming && !entry.message.streaming) || entry.message.text.length > previous.message.text.length) {
      bucket.set(key, entry)
    }
  }
  return [...byId.values(), ...anonymous.values()]
    .sort((a, b) => {
      const aTime = timeOf(a.message.createdAt)
      const bTime = timeOf(b.message.createdAt)
      if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime
      if (aTime !== null && bTime === null) return -1
      if (aTime === null && bTime !== null) return 1
      return a.sourceIndex - b.sourceIndex || a.itemIndex - b.itemIndex
    })
    .map((entry) => entry.message)
}
