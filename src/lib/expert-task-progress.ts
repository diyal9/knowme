'use strict'

function safeExpertProgressText(value, fallback = '', max = 180) {
  if (typeof value !== 'string') return fallback
  const line = value.split(/\r?\n/, 1)[0].trim()
  if (/^[{[]|^(?:at\s|Traceback\b)|(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie|credential)["']?\s*[:=]|\b(?:Bearer|Basic)\s+\S+|\bsk-[A-Za-z0-9_-]+|\b[a-z][a-z0-9+.-]*:\/\/|[A-Za-z0-9_-]{32,}/i.test(line)) return fallback
  return line.replace(/\s+/g, ' ').slice(0, max) || fallback
}

module.exports = { safeExpertProgressText }
