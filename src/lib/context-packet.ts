'use strict'

const MAX_LIGHT_CHARS = 900
const MAX_WORK_CHARS = 3200
const DEFAULT_MAX_ITEMS = 12

const TYPES = new Set(['profile', 'preference', 'work_memory', 'session', 'knowledge'])
const SCOPES = new Set(['global', 'project', 'session'])
const CONFIDENCE = new Set(['explicit', 'confirmed', 'derived', 'activity'])
const MODES = new Set(['light', 'work', 'off'])

const CONFIDENCE_ORDER = {
  explicit: 0,
  confirmed: 1,
  derived: 2,
  activity: 3,
}

function clean(value, max = 320) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeSource(source = {}) {
  if (!source || typeof source !== 'object') return { type: 'unknown', id: '' }
  return {
    type: clean(source.type || 'unknown', 40),
    id: clean(source.id || '', 160),
    label: clean(source.label || '', 160),
  }
}

function normalizeItem(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const text = clean(raw.text, 800)
  if (!text) return null
  const type = TYPES.has(raw.type) ? raw.type : 'work_memory'
  const scope = SCOPES.has(raw.scope) ? raw.scope : 'global'
  const confidence = CONFIDENCE.has(raw.confidence) ? raw.confidence : 'derived'
  const staleAt = raw.staleAt ? String(raw.staleAt) : null
  return {
    id: clean(raw.id || `${type}:${index + 1}`, 180),
    type,
    text,
    scope,
    confidence,
    source: normalizeSource(raw.source),
    staleAt,
    reason: clean(raw.reason || 'context_match', 120),
    sensitivity: clean(raw.sensitivity || 'local', 40),
  }
}

function isStale(item, now = Date.now()) {
  if (!item?.staleAt) return false
  const timestamp = Date.parse(item.staleAt)
  return Number.isFinite(timestamp) && timestamp <= now
}

function allowedInMode(item, mode) {
  if (mode === 'off') return false
  if (mode === 'light') {
    return (
      (item.type === 'profile' && item.confidence === 'explicit') ||
      (item.type === 'preference' && ['explicit', 'confirmed'].includes(item.confidence))
    )
  }
  return true
}

function itemKey(item) {
  return `${item.type}|${item.scope}|${item.text.toLowerCase()}`
}

function buildContextPacket({
  items = [],
  mode = 'work',
  maxItems = DEFAULT_MAX_ITEMS,
  now = Date.now(),
} = {}) {
  const safeMode = MODES.has(mode) ? mode : 'work'
  const seen = new Set()
  const normalized = (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .filter(Boolean)
    .filter(item => !isStale(item, now))
    .filter(item => allowedInMode(item, safeMode))
    .filter(item => {
      const key = itemKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (
      (CONFIDENCE_ORDER[a.confidence] ?? 9) - (CONFIDENCE_ORDER[b.confidence] ?? 9) ||
      a.type.localeCompare(b.type) ||
      a.text.localeCompare(b.text, 'zh-CN')
    ))
    .slice(0, Math.max(0, Math.min(50, Number(maxItems) || DEFAULT_MAX_ITEMS)))

  const omitted = (Array.isArray(items) ? items.length : 0) - normalized.length
  return {
    version: 1,
    items: normalized,
    omitted: Math.max(0, omitted),
    policy: {
      memoryMode: safeMode,
      maxItems: normalized.length,
      maxChars: safeMode === 'light' ? MAX_LIGHT_CHARS : MAX_WORK_CHARS,
    },
  }
}

function formatForPrompt(packet = {}, options = {}) {
  const items = Array.isArray(packet.items) ? packet.items : []
  if (!items.length) return ''
  const maxChars = Number(options.maxChars) > 0
    ? Number(options.maxChars)
    : packet.policy?.memoryMode === 'light' ? MAX_LIGHT_CHARS : MAX_WORK_CHARS
  const lines = []
  for (const item of items) {
    const confidenceLabel = {
      explicit: '用户明确提供',
      confirmed: '用户已确认',
      derived: '近期推断',
      activity: '活动信号',
    }[item.confidence] || item.confidence
    const source = item.source?.label || item.source?.id
      ? `；来源：${item.source.label || item.source.id}`
      : ''
    lines.push(`- [${confidenceLabel}] ${item.text}${source}`)
  }
  const title = packet.policy?.memoryMode === 'light'
    ? '【轻量个性化上下文】'
    : '【工作上下文（非知识库事实）】'
  return `${title}\n${lines.join('\n')}`.slice(0, maxChars)
}

function toUiItems(packet = {}) {
  return (Array.isArray(packet.items) ? packet.items : []).map(item => ({
    id: item.id,
    type: item.type,
    text: item.text,
    scope: item.scope,
    confidence: item.confidence,
    source: item.source,
    staleAt: item.staleAt,
    reason: item.reason,
  }))
}

module.exports = {
  MAX_LIGHT_CHARS,
  MAX_WORK_CHARS,
  buildContextPacket,
  formatForPrompt,
  normalizeItem,
  toUiItems,
  isStale,
}
