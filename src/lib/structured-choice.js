/**
 * Structured choice component for Agent chat history.
 * It keeps message history as pure choices and routes input-required items
 * into composer editing after a click.
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.StructuredChoice = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const INPUT_INTENT_RE = /(补充|填写|输入|说明|描述|背景|上下文|澄清|手动)/i

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function toPayloadValue(payload) {
    return encodeURIComponent(String(payload || ''))
  }

  function needsUserInput(item, payloadNeedsUserEdit) {
    if (!item || typeof item !== 'object') return false
    if (item.action === 'fill') return true
    const payload = String(item.payload || '')
    if (typeof payloadNeedsUserEdit === 'function' && payloadNeedsUserEdit(payload)) return true
    const text = `${item.label || ''} ${item.description || ''} ${payload}`
    return INPUT_INTENT_RE.test(text)
  }

  function render(bar, options = {}) {
    if (!bar?.items?.length) return ''
    const chosenIndex = Number.isInteger(options.chosenIndex) ? options.chosenIndex : -1
    const payloadNeedsUserEdit = options.payloadNeedsUserEdit
    const title = escapeHtml(bar.title || '结构化选择')
    const decided = chosenIndex >= 0
    const items = bar.items.map((it, index) => {
      const desc = it.description ? `<span class="sug-desc">${escapeHtml(it.description)}</span>` : ''
      const selected = decided && index === chosenIndex
      const disabled = decided ? ' disabled' : ''
      const selCls = selected ? ' is-selected' : ''
      const requireInput = needsUserInput(it, payloadNeedsUserEdit) ? '1' : '0'
      const actionId = escapeHtml(it.id || `suggestion-${index + 1}`)
      return `<button type="button" class="agent-suggest-item${selCls}" data-action-id="${actionId}" data-action-source="model" data-suggest-act="${escapeHtml(it.action)}" data-payload="${escapeHtml(toPayloadValue(it.payload))}" data-needs-input="${requireInput}"${disabled}>
        <span class="sug-choice" aria-hidden="true">${index + 1}</span>
        <span class="sug-copy"><strong>${escapeHtml(it.label)}</strong>${desc}</span>
      </button>`
    }).join('')
    const status = decided ? '已选择' : '选择一项'
    return `<div class="agent-suggest structured-choice${decided ? ' is-decided' : ''}" role="group" aria-label="${title}，${status}">
      <div class="agent-suggest-head"><div class="agent-suggest-title">${title}</div><span>${status}</span></div>
      <div class="agent-suggest-list">${items}</div>
    </div>`
  }

  function lock(root, selectedBtn) {
    if (!root || !selectedBtn) return
    root.classList.add('is-decided')
    const hint = root.querySelector('.agent-suggest-head > span')
    if (hint) hint.textContent = '已选择'
    root.setAttribute('aria-label', `${root.querySelector('.agent-suggest-title')?.textContent || '结构化选择'}，已选择`)
    root.querySelectorAll('.agent-suggest-item').forEach(btn => {
      btn.disabled = true
      btn.classList.toggle('is-selected', btn === selectedBtn)
    })
  }

  function parseSelectionButton(button) {
    if (!button) return { action: '', payload: '', needsInput: false }
    const action = String(button.dataset.suggestAct || '')
    let payload = ''
    try { payload = decodeURIComponent(button.dataset.payload || '') } catch { payload = button.dataset.payload || '' }
    const needsInput = String(button.dataset.needsInput || '') === '1'
    return { action, payload, needsInput }
  }

  return {
    needsUserInput,
    render,
    lock,
    parseSelectionButton,
  }
})
