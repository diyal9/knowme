'use strict'

// Request metadata is not retrieved content, even inside provider envelopes.
// Keep a bounded structural walk; this does not infer semantic authority from
// arbitrary provider fields. Tool success/effects are checked separately.
const NON_CONTENT = new Set(['query', 'args', 'request', 'meta', 'requestId', 'durationMs', 'elapsedMs'])

function toolSourceContent(raw) {
  const text = String(raw || '')
  let parsed
  try { parsed = JSON.parse(text) } catch { return text }
  let visited = 0
  let exceeded = false
  function visit(value, depth = 0) {
    visited++
    if (visited > 4096 || depth > 12) { exceeded = true; return '' }
    if (value == null) return ''
    if (Array.isArray(value)) return value.map(item => visit(item, depth + 1)).join('\n')
    if (typeof value !== 'object') return String(value)
    return Object.entries(value).filter(([key]) => !NON_CONTENT.has(key)).map(([key, item]) => {
      const body = visit(item, depth + 1)
      return body ? `${key}：${body}` : ''
    }).join('\n')
  }
  const content = visit(parsed)
  return exceeded ? '' : content
}

module.exports = { toolSourceContent }
