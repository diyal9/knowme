'use strict'

/**
 * One append-only audit ledger for confirmed cognition, partner-profile and
 * capability growth. Payloads contain only reversible state needed locally.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VERSION = 1
const MAX_EVENTS = 500

function filePath(userData) {
  return path.join(String(userData || ''), 'knowledge-os', 'growth-ledger.json')
}

function now() {
  return new Date().toISOString()
}

function read(userData) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(userData), 'utf8'))
    return {
      version: VERSION,
      events: Array.isArray(parsed?.events) ? parsed.events.slice(-MAX_EVENTS) : [],
      updatedAt: parsed?.updatedAt || now(),
    }
  } catch {
    return { version: VERSION, events: [], updatedAt: now() }
  }
}

function writeAtomic(userData, state) {
  const file = filePath(userData)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  const backup = `${file}.bak`
  const previous = `${file}.previous`
  const next = { version: VERSION, events: (state.events || []).slice(-MAX_EVENTS), updatedAt: now() }
  fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', 'utf8')
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, backup)
    if (fs.existsSync(file)) fs.renameSync(file, previous)
    fs.renameSync(temp, file)
    if (fs.existsSync(previous)) fs.unlinkSync(previous)
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch { /* best effort */ }
    try { if (!fs.existsSync(file) && fs.existsSync(previous)) fs.renameSync(previous, file) } catch { /* best effort */ }
    throw error
  }
  return next
}

function append(userData, input = {}) {
  const state = read(userData)
  const event = {
    id: String(input.id || `growth_${crypto.randomUUID()}`),
    proposalId: input.proposalId ? String(input.proposalId) : undefined,
    targetType: ['brain', 'partner_profile', 'capability'].includes(input.targetType) ? input.targetType : 'brain',
    kind: String(input.kind || 'cognition').slice(0, 80),
    summary: String(input.summary || '确认一项成长').trim().slice(0, 500),
    status: input.status === 'reverted' ? 'reverted' : 'applied',
    reversible: input.reversible !== false && Array.isArray(input.reverseEffects),
    effects: Array.isArray(input.effects) ? input.effects : [],
    reverseEffects: Array.isArray(input.reverseEffects) ? input.reverseEffects : [],
    source: String(input.source || 'brain-proposal').slice(0, 120),
    memoryPatternId: input.memoryPatternId ? String(input.memoryPatternId).slice(0, 180) : undefined,
    createdAt: input.createdAt || now(),
  }
  const index = state.events.findIndex(item => item.id === event.id)
  if (index >= 0) state.events[index] = { ...state.events[index], ...event, createdAt: state.events[index].createdAt || event.createdAt }
  else state.events.push(event)
  writeAtomic(userData, state)
  return event
}

function list(userData, options = {}) {
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 50))
  const events = read(userData).events
    .filter(item => !options.targetType || item.targetType === options.targetType)
    .slice(-limit)
    .reverse()
  return { ok: true, events }
}

function markReverted(userData, eventId) {
  const state = read(userData)
  const event = state.events.find(item => item.id === String(eventId || ''))
  if (!event) return { ok: false, error: '成长记录不存在' }
  if (!event.reversible || event.status === 'reverted') return { ok: false, error: '这项成长不可撤销或已经撤销' }
  event.status = 'reverted'
  event.revertedAt = now()
  writeAtomic(userData, state)
  return { ok: true, event }
}

module.exports = { VERSION, MAX_EVENTS, filePath, read, append, list, markReverted }
