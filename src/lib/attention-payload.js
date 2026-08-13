'use strict'

function normalizeAttentionPayload(raw = {}) {
  const id = String(raw.id || '').trim()
  if (!id) return null
  const urgency = String(raw.urgency || 'info').trim() === 'input' ? 'input' : 'info'
  const kind = String(raw.kind || 'task').trim() || 'task'
  return {
    id,
    kind,
    title: String(raw.title || '需要关注').trim().slice(0, 80) || '需要关注',
    body: String(raw.body || '').trim().slice(0, 160),
    urgency,
    source: String(raw.source || '').trim().slice(0, 40),
    avatarText: String(raw.avatarText || raw.title || '知').trim().slice(0, 1) || '知',
    deepLink: raw.deepLink && typeof raw.deepLink === 'object'
      ? {
          type: String(raw.deepLink.type || '').trim(),
          slug: String(raw.deepLink.slug || '').trim(),
          runId: String(raw.deepLink.runId || '').trim(),
        }
      : null,
  }
}

function daemonAttentionId(slug, waitingKind, node) {
  return `daemon:${String(slug || '').trim()}:${String(waitingKind || 'hitl').trim()}:${String(node || 'default').trim()}`
}

module.exports = {
  normalizeAttentionPayload,
  daemonAttentionId,
}
