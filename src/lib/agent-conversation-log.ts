'use strict'

const crypto = require('crypto')

const CHAT_ROLES = new Set(['user', 'assistant'])
const MESSAGE_ROLES = new Set(['user', 'assistant', 'tool'])
const MAX_MESSAGE_ID_CHARS = 180

function cleanId(value) {
  return String(value || '').trim().slice(0, MAX_MESSAGE_ID_CHARS)
}

function cleanRunId(value) {
  return String(value || '').trim().slice(0, MAX_MESSAGE_ID_CHARS)
}

function messageText(raw) {
  return String(raw?.text ?? raw?.content ?? '').trim()
}

function digest(value, length = 20) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, length)
}

/**
 * Legacy sessions did not persist message IDs. The index is intentionally part
 * of the fingerprint: two identical `hi` turns are two different messages.
 */
function legacyMessageId(sessionId, index, raw = {}) {
  const role = MESSAGE_ROLES.has(raw?.role) ? raw.role : 'message'
  const toolCallId = cleanId(raw?.toolCallId)
  const fingerprint = [sessionId, index, role, messageText(raw), toolCallId].join('\u0000')
  return `legacy_${digest(fingerprint)}`
}

function runtimeMessageId(runId, role, suffix = '') {
  const safeRunId = cleanRunId(runId) || `run_${digest(Date.now())}`
  const safeRole = MESSAGE_ROLES.has(role) ? role : 'message'
  const tail = suffix ? `_${digest(suffix, 12)}` : ''
  return `msg_${safeRunId}_${safeRole}${tail}`.slice(0, MAX_MESSAGE_ID_CHARS)
}

function normalizeCreatedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function resolveTurnIdentity(payload = {}, runId = '', now = new Date().toISOString()) {
  const turn = payload?.turn && typeof payload.turn === 'object' ? payload.turn : {}
  const resolvedRunId = cleanRunId(runId || payload?.runId)
  const userMessageId = cleanId(turn.userMessageId) || runtimeMessageId(resolvedRunId, 'user')
  let assistantMessageId = cleanId(turn.assistantMessageId) || runtimeMessageId(resolvedRunId, 'assistant')
  if (assistantMessageId === userMessageId) {
    assistantMessageId = runtimeMessageId(resolvedRunId, 'assistant')
  }
  return {
    userMessageId,
    assistantMessageId,
    userCreatedAt: normalizeCreatedAt(turn.userCreatedAt) || normalizeCreatedAt(now) || new Date().toISOString(),
  }
}

/** Add stable identity metadata without discarding message-specific fields. */
function withConversationIdentity(raw = {}, options = {}) {
  const role = MESSAGE_ROLES.has(raw?.role) ? raw.role : options.role
  if (!MESSAGE_ROLES.has(role)) return null
  const runId = cleanRunId(raw?.runId || options.runId)
  const explicitId = cleanId(raw?.id || options.id)
  const toolSuffix = role === 'tool' ? cleanId(raw?.toolCallId) || String(options.index ?? '') : ''
  const id = explicitId
    || (runId ? runtimeMessageId(runId, role, toolSuffix) : '')
    || legacyMessageId(options.sessionId || 'session', options.index || 0, raw)
  const createdAt = normalizeCreatedAt(raw?.createdAt || options.createdAt)
  return {
    ...raw,
    id,
    role,
    ...(runId ? { runId } : {}),
    ...(createdAt ? { createdAt } : {}),
  }
}

/**
 * Idempotent append/update. Message identity, never text equality, determines
 * whether this is an update or a new turn.
 */
function upsertConversationMessage(messages, message) {
  const list = Array.isArray(messages) ? [...messages] : []
  if (!message || typeof message !== 'object') return list
  const id = cleanId(message.id)
  if (!id) throw new Error('conversation_message_id_required')
  const index = list.findIndex(item => cleanId(item?.id) === id)
  if (index < 0) return [...list, message]
  if (list[index]?.role && message?.role && list[index].role !== message.role) {
    throw new Error('conversation_message_role_conflict')
  }
  list[index] = { ...list[index], ...message, id }
  return list
}

function sameVisibleTurn(a, b) {
  return a?.role === b?.role && messageText(a) === messageText(b)
}

function appendLegacyRecovery(messages, recovery, sessionId) {
  const visible = messages.filter(item => CHAT_ROLES.has(item?.role) && messageText(item))
  let overlap = Math.min(visible.length, recovery.length)
  while (overlap > 0) {
    const left = visible.slice(-overlap)
    const right = recovery.slice(0, overlap)
    if (left.every((item, index) => sameVisibleTurn(item, right[index]))) break
    overlap -= 1
  }
  let next = messages
  for (let index = overlap; index < recovery.length; index += 1) {
    const item = recovery[index]
    const identified = withConversationIdentity(item, {
      sessionId: `${sessionId}:legacy-recovery`,
      index,
    })
    next = upsertConversationMessage(next, identified)
  }
  return next
}

/**
 * Reconcile a renderer recovery snapshot into the persisted transcript.
 * Canonical ordering is preserved; unseen IDs are appended in recovery order.
 * Text overlap exists only for all-legacy payloads that carry no IDs.
 */
function reconcileConversationLog(canonical, recovery, options = {}) {
  let messages = []
  for (const item of Array.isArray(canonical) ? canonical : []) {
    if (!item || typeof item !== 'object') continue
    const identified = cleanId(item.id)
      ? item
      : withConversationIdentity(item, {
          sessionId: options.sessionId || 'session',
          index: messages.length,
        })
    messages = upsertConversationMessage(messages, identified)
  }

  const incoming = (Array.isArray(recovery) ? recovery : [])
    .filter(item => CHAT_ROLES.has(item?.role) && messageText(item))
  if (!incoming.length) return messages

  if (incoming.every(item => !cleanId(item?.id))) {
    return appendLegacyRecovery(messages, incoming, options.sessionId || 'session')
  }

  for (const item of incoming) {
    const id = cleanId(item?.id)
    if (!id) continue // Mixed identity payloads fail closed instead of guessing order.
    const normalized = withConversationIdentity({
      id,
      role: item.role,
      text: messageText(item),
      runId: item.runId,
      createdAt: item.createdAt,
    }, { sessionId: options.sessionId || 'session' })
    const existingIndex = messages.findIndex(entry => cleanId(entry?.id) === id)
    if (existingIndex >= 0) {
      if (messages[existingIndex]?.role !== normalized?.role) {
        throw new Error('conversation_message_role_conflict')
      }
      // Persisted content is authoritative; recovery may only fill absent metadata.
      messages[existingIndex] = { ...normalized, ...messages[existingIndex], id }
    } else {
      messages.push(normalized)
    }
  }
  return messages
}

function projectConversationHistory(messages, options = {}) {
  const excluded = new Set((options.excludeIds || []).map(cleanId).filter(Boolean))
  return (Array.isArray(messages) ? messages : [])
    .filter(item => CHAT_ROLES.has(item?.role) && messageText(item) && !excluded.has(cleanId(item?.id)))
    .map(item => ({
      id: cleanId(item.id),
      role: item.role,
      text: messageText(item),
      ...(cleanRunId(item.runId) ? { runId: cleanRunId(item.runId) } : {}),
      ...(normalizeCreatedAt(item.createdAt) ? { createdAt: normalizeCreatedAt(item.createdAt) } : {}),
    }))
}

module.exports = {
  CHAT_ROLES,
  MESSAGE_ROLES,
  cleanId,
  legacyMessageId,
  runtimeMessageId,
  resolveTurnIdentity,
  withConversationIdentity,
  upsertConversationMessage,
  reconcileConversationLog,
  projectConversationHistory,
}
