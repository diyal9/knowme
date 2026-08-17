'use strict'

/**
 * Daemon 运行日志 SSE 解析与滚动/缓存辅助（纯函数，可单测）。
 */

;(function initWorkbenchDaemonLogSse(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchDaemonLogSse = api
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function createWorkbenchDaemonLogSse() {
const NEAR_BOTTOM_PX = 48

function feedDaemonLogSse(buffer, chunk) {
  const combined = `${String(buffer || '')}${String(chunk || '')}`
  const parts = combined.split(/\n\n/)
  const rest = parts.pop() ?? ''
  const events = []
  for (const block of parts) {
    const raw = String(block || '').replace(/^\uFEFF/, '')
    if (!raw.trim()) continue
    let eventType = 'message'
    const dataLines = []
    for (const line of raw.split(/\n/)) {
      if (!line || line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim() || 'message'
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''))
      }
    }
    const data = dataLines.join('\n')
    if (eventType === 'done') {
      events.push({ type: 'done', data: data || 'end' })
      continue
    }
    if (dataLines.length) events.push({ type: 'line', data })
  }
  return { buffer: rest, events }
}

function isNearBottom(el, threshold = NEAR_BOTTOM_PX) {
  if (!el || typeof el.scrollHeight !== 'number') return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

function normalizeLogText(raw) {
  const source = String(raw == null ? '' : raw).replace(/^\uFEFF/, '')
  if (!source.trim() || source.trim() === '(no log yet)') return ''
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function splitLogLines(raw) {
  const text = normalizeLogText(raw)
  if (!text) return []
  return text.split('\n').filter(line => line.trim())
}

function countLogLines(raw) {
  return splitLogLines(raw).length
}

function appendLogLine(existing, line) {
  const base = normalizeLogText(existing)
  const next = String(line == null ? '' : line)
  if (!next && next !== '0') return base
  if (!base) return next
  return `${base}\n${next}`
}

function mergeLogFullText(existing, incoming) {
  const prev = normalizeLogText(existing)
  const next = normalizeLogText(incoming)
  if (!next) return prev
  if (!prev) return next
  if (next === prev) return prev
  if (next.startsWith(prev)) return next
  const prevLines = splitLogLines(prev)
  const nextLines = splitLogLines(next)
  if (nextLines.length >= prevLines.length) return next
  return prev
}

function reviewLogsSignature(progressText, logsText) {
  const progress = normalizeLogText(progressText).replace(/\n+$/g, '')
  const logs = normalizeLogText(logsText).replace(/\n+$/g, '')
  return `${progress}\0${logs}`
}

return {
  NEAR_BOTTOM_PX,
  feedDaemonLogSse,
  isNearBottom,
  normalizeLogText,
  splitLogLines,
  countLogLines,
  appendLogLine,
  mergeLogFullText,
  reviewLogsSignature,
}
})
