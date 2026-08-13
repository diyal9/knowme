'use strict'

const { validateEvent } = require('./agent-output-protocol')

const MAX_FIXTURE_EVENTS = 64

function validateFixtureRunPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'invalid_payload' }
  }
  const runId = String(payload.runId || '').trim()
  if (!runId) return { ok: false, error: 'run_id_required' }
  const events = Array.isArray(payload.events) ? payload.events : null
  if (!events || !events.length) return { ok: false, error: 'events_required' }
  if (events.length > MAX_FIXTURE_EVENTS) return { ok: false, error: 'too_many_events' }

  const validated = []
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid_event' }
    if (String(raw.runId || '') !== runId) return { ok: false, error: 'run_id_mismatch' }
    const checked = validateEvent(raw)
    if (!checked.ok) return { ok: false, error: checked.error || 'invalid_event' }
    try {
      structuredClone(checked.event)
    } catch {
      return { ok: false, error: 'not_clone_safe' }
    }
    validated.push(checked.event)
  }

  return { ok: true, runId, events: validated }
}

module.exports = {
  MAX_FIXTURE_EVENTS,
  validateFixtureRunPayload,
}
