'use strict'

/**
 * Grounding UI helpers — 用户可见 meta 渲染与 details 展开状态保持。
 */

;(function groundingUiModule(global) {
  const labelApi = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./agent-grounding-labels')
    : (global.GroundingLabels || {})

  function formatToolLabelForUser(toolName) {
    if (typeof labelApi.formatToolLabelForUser === 'function') {
      return labelApi.formatToolLabelForUser(toolName)
    }
    return String(toolName || '外部内容读取')
  }

  function formatViolationForUser(violation) {
    if (typeof labelApi.formatViolationForUser === 'function') {
      return labelApi.formatViolationForUser(violation)
    }
    return ''
  }

  function defaultEscHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function renderGroundingStatusMetaHtml(gs, escHtml = defaultEscHtml) {
    if (!gs) return ''
    const status = String(gs.status || 'pending')
    const cls = status === 'verified' ? 'is-verified' : (status === 'blocked' ? 'is-blocked' : 'is-pending')
    const badge = status === 'verified' ? '输出已验证' : (status === 'blocked' ? '证据不足' : '验证中')
    const sources = Array.isArray(gs.sources) ? gs.sources.filter(s => s && s.tool) : []
    const sourceItems = sources.slice(0, 5).map(s => {
      const st = s.status === 'truncated' ? '截断' : (s.status === 'fail' ? '失败' : (s.status === 'ok' ? '成功' : s.status))
      const toolLabel = formatToolLabelForUser(s.tool)
      return `<li><span class="agent-grounding-source-name">${escHtml(toolLabel)}</span> · ${escHtml(st)}</li>`
    }).join('')
    const violationText = formatViolationForUser(Array.isArray(gs.violations) ? gs.violations[0] : null)
    const violation = violationText
      ? `<p class="agent-grounding-note">${escHtml(violationText)}</p>`
      : ''
    const sourcesBlock = sourceItems
      ? `<details class="agent-grounding-sources"><summary>查看来源（${sources.length}）</summary><ul>${sourceItems}</ul></details>`
      : ''
    return `<div class="agent-grounding-meta ${cls}" role="status"><span class="agent-grounding-badge">${escHtml(badge)}</span>${violation}${sourcesBlock}</div>`
  }

  function captureGroundingDetailsOpenState(rootEl) {
    const state = {}
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return state
    rootEl.querySelectorAll('.agent-bubble.assistant[data-idx]').forEach((bubble) => {
      const idx = bubble.getAttribute('data-idx')
      const details = bubble.querySelector('.agent-grounding-sources')
      if (idx != null && details?.open) state[idx] = true
    })
    return state
  }

  function restoreGroundingDetailsOpenState(rootEl, state) {
    if (!rootEl || !state || typeof state !== 'object') return
    for (const [idx, open] of Object.entries(state)) {
      if (!open) continue
      const bubble = rootEl.querySelector(`.agent-bubble.assistant[data-idx="${idx}"]`)
      const details = bubble?.querySelector('.agent-grounding-sources')
      if (details) details.open = true
    }
  }

  function patchAssistantGroundingMeta(bubble, gs, escHtml = defaultEscHtml) {
    if (!bubble) return false
    const html = renderGroundingStatusMetaHtml(gs, escHtml)
    const existing = bubble.querySelector('.agent-grounding-meta')
    if (existing) {
      const wasOpen = bubble.querySelector('.agent-grounding-sources')?.open === true
      existing.outerHTML = html
      if (wasOpen) {
        const details = bubble.querySelector('.agent-grounding-sources')
        if (details) details.open = true
      }
      return true
    }
    if (!html) return false
    bubble.insertAdjacentHTML('beforeend', html)
    return true
  }

  const api = {
    renderGroundingStatusMetaHtml,
    captureGroundingDetailsOpenState,
    restoreGroundingDetailsOpenState,
    patchAssistantGroundingMeta,
    defaultEscHtml,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
  global.GroundingUI = api
})(typeof window !== 'undefined' ? window : globalThis)
