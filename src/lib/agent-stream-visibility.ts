/**
 * Agent streaming visibility boundary.
 * Node tests: require('./lib/agent-stream-visibility')
 * Browser: <script src="lib/agent-stream-visibility.js"> → window.AgentStreamVisibility
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AgentStreamVisibility = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  function splitStreamingMarkdown(src) {
    const text = String(src || '').replace(/\r\n/g, '\n')
    const lines = text.split('\n')
    let splitAt = lines.length

    let fenceCount = 0
    let openFenceAt = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) {
        fenceCount += 1
        if (fenceCount % 2 === 1) openFenceAt = i
      }
    }
    if (fenceCount % 2 === 1 && openFenceAt >= 0) {
      splitAt = Math.min(splitAt, openFenceAt)
    }

    const endsWithBlankLine = /\n[ \t]*\n$/.test(text)
    if (!endsWithBlankLine) {
      let i = lines.length - 1
      while (i >= 0 && !String(lines[i] || '').trim()) i -= 1
      let tableStart = -1
      while (i >= 0 && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tableStart = i
        i -= 1
      }
      if (tableStart >= 0) splitAt = Math.min(splitAt, tableStart)
    }

    if (text.length && !text.endsWith('\n') && lines.length) {
      splitAt = Math.min(splitAt, lines.length - 1)
    }

    if (splitAt < 0) splitAt = 0
    return {
      stable: lines.slice(0, splitAt).join('\n'),
      pending: splitAt < lines.length && lines.slice(splitAt).join('\n').length > 0,
    }
  }

  return {
    splitStreamingMarkdown,
  }
})
