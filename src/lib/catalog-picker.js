'use strict'

/**
 * 可复用目录多选：卡片勾选、分类滚动、搜索、仅看已选、全选/清空。
 * 浏览器：<script src="lib/catalog-picker.js"> → window.CatalogPicker
 * Node：require() 用于单测。
 */
;(function initCatalogPicker(global) {
  const BROWSE_THRESHOLD = 9

  function escapeHtml(value) {
    if (global.UIKit && typeof global.UIKit.escapeHtml === 'function') {
      return global.UIKit.escapeHtml(value)
    }
    if (value === null || value === undefined) return ''
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function itemId(item) {
    if (item == null) return ''
    if (typeof item === 'string' || typeof item === 'number') return String(item)
    return String(item.id || item.name || item.title || item.label || '')
  }

  function itemLabel(item) {
    if (item == null) return ''
    if (typeof item === 'string' || typeof item === 'number') return String(item)
    return String(item.name || item.title || item.label || item.id || '')
  }

  function itemMeta(item) {
    if (!item || typeof item !== 'object') return ''
    return String(item.category || item.kind || item.type || '')
  }

  function selectedSet(selected) {
    return new Set((Array.isArray(selected) ? selected : []).map(item => itemId(item)).filter(Boolean))
  }

  function optionHtml(item, values, name) {
    const id = itemId(item)
    const label = itemLabel(item) || id
    const meta = itemMeta(item)
    const haystack = `${id} ${label} ${meta}`.toLowerCase()
    return `<label class="hub-check" data-search="${escapeHtml(haystack)}">
      <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(id)}"${values.has(id) ? ' checked' : ''}>
      <span class="hub-check-box" aria-hidden="true"></span>
      <span class="hub-check-text"><strong>${escapeHtml(label)}</strong>${meta && meta !== label ? `<em>${escapeHtml(meta)}</em>` : ''}</span>
    </label>`
  }

  function emptyHtml(emptyLabel, emptyAction) {
    const action = emptyAction && emptyAction.label
      ? `<button type="button" class="hub-mini-btn" data-picker-empty-action="${escapeHtml(emptyAction.tab || emptyAction.action || '')}">${escapeHtml(emptyAction.label)}</button>`
      : ''
    return `<div class="hub-picker-empty"><p>${escapeHtml(emptyLabel || '暂无可选项')}</p>${action}</div>`
  }

  function panelBodyHtml({ items, selected, name, title, unit, emptyLabel, emptyAction }) {
    const values = selectedSet(selected)
    const list = Array.isArray(items) ? items : []
    const browse = list.length > BROWSE_THRESHOLD
    if (!list.length) return emptyHtml(emptyLabel, emptyAction)
    const tools = `<div class="hub-picker-tools">
          <button type="button" class="hub-mini-btn" data-pick-all="${escapeHtml(name)}">全选</button>
          <button type="button" class="hub-mini-btn" data-pick-none="${escapeHtml(name)}">清空</button>
        </div>`
    const controls = browse
      ? `<div class="hub-picker-controls">
          <input type="search" class="hub-picker-search" data-picker-search="${escapeHtml(name)}" placeholder="搜索 ${list.length} 个${escapeHtml(unit || '')}" spellcheck="false" aria-label="搜索${escapeHtml(title || '')}">
          <button type="button" class="hub-mini-btn hub-toggle-mini" data-picker-selected="${escapeHtml(name)}" aria-pressed="false">仅看已选</button>
        </div>`
      : ''
    let grid = ''
    if (browse) {
      const groups = new Map()
      list.forEach(item => {
        const key = itemMeta(item) || '其他'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(item)
      })
      const subgroups = [...groups.entries()].map(([key, group]) => `
        <div class="hub-check-subgroup">
          <h4>${escapeHtml(key)}<span>${group.length}</span></h4>
          <div class="hub-check-grid">${group.map(item => optionHtml(item, values, name)).join('')}</div>
        </div>`).join('')
      grid = `<div class="hub-check-scroll">${subgroups}</div>
        <p class="hub-picker-none" hidden>没有匹配的${escapeHtml(unit || '项')}</p>`
    } else {
      grid = `<div class="hub-check-grid">${list.map(item => optionHtml(item, values, name)).join('')}</div>`
    }
    return `<header class="hub-picker-panel-head">
        ${tools}
      </header>
      ${controls}
      ${grid}`
  }

  function renderPanel(options = {}) {
    const name = String(options.name || 'catalog')
    return `<div class="hub-picker-panel" data-picker="${escapeHtml(name)}">
      ${panelBodyHtml(options)}
    </div>`
  }

  function hiddenValuesHtml(name, selectedIds) {
    return `<div class="hub-catalog-values" hidden>
      ${selectedIds.map(id => `<input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(id)}" checked>`).join('')}
    </div>`
  }

  function chipHtml(item) {
    return `<span class="hub-catalog-chip">${escapeHtml(itemLabel(item) || itemId(item))}</span>`
  }

  function renderSummary(options = {}) {
    const name = String(options.name || 'catalog')
    const title = options.title || ''
    const hint = options.hint || ''
    const unit = options.unit || ''
    const selectLabel = options.selectLabel || `选择${unit}`
    const list = Array.isArray(options.items) ? options.items : []
    const values = selectedSet(options.selected)
    const picked = list.filter(item => values.has(itemId(item)))
    const selectedIds = picked.map(itemId)
    const count = `<span class="hub-picker-count${picked.length ? ' active' : ''}" data-count-for="${escapeHtml(name)}">${picked.length}/${list.length}</span>`
    if (!list.length) {
      return `<section class="hub-expert-section hub-catalog-summary" data-picker="${escapeHtml(name)}" data-catalog-field="${escapeHtml(name)}">
        <header class="hub-expert-section-head">
          <div>
            <h3>${escapeHtml(title)}${count}</h3>
            <p>${escapeHtml(hint)}</p>
          </div>
        </header>
        ${emptyHtml(options.emptyLabel, options.emptyAction)}
      </section>`
    }
    const chips = picked.length
      ? picked.slice(0, 8).map(chipHtml).join('') + (picked.length > 8 ? `<span class="hub-catalog-chip more">+${picked.length - 8}</span>` : '')
      : `<span class="hub-catalog-placeholder">尚未选择，点右侧按钮打开列表</span>`
    return `<section class="hub-expert-section hub-catalog-summary" data-picker="${escapeHtml(name)}" data-catalog-field="${escapeHtml(name)}">
      <header class="hub-expert-section-head">
        <div>
          <h3>${escapeHtml(title)}${count}</h3>
          <p>${escapeHtml(hint)}</p>
        </div>
        <button type="button" class="hub-btn" data-open-picker="${escapeHtml(name)}">${escapeHtml(selectLabel)}</button>
      </header>
      <div class="hub-catalog-chips">${chips}</div>
      ${hiddenValuesHtml(name, selectedIds)}
    </section>`
  }

  function filter(section) {
    if (!section) return 0
    const query = String(section.querySelector('[data-picker-search]')?.value || '').trim().toLowerCase()
    const onlySelected = section.querySelector('[data-picker-selected]')?.getAttribute('aria-pressed') === 'true'
    let visible = 0
    section.querySelectorAll('.hub-check').forEach(option => {
      const matchesQuery = !query || (option.dataset.search || '').includes(query)
      const matchesSelected = !onlySelected || !!option.querySelector('input')?.checked
      const show = matchesQuery && matchesSelected
      option.hidden = !show
      if (show) visible += 1
    })
    section.querySelectorAll('.hub-check-subgroup').forEach(subgroup => {
      subgroup.hidden = ![...subgroup.querySelectorAll('.hub-check')].some(option => !option.hidden)
    })
    const none = section.querySelector('.hub-picker-none')
    if (none) none.hidden = visible > 0
    return visible
  }

  function selectedValues(section, name) {
    if (!section) return []
    const selector = name ? `input[name="${name}"]:checked` : 'input[type="checkbox"]:checked'
    return [...section.querySelectorAll(selector)].map(input => input.value).filter(Boolean)
  }

  function applyBulk(section, name, checked) {
    if (!section) return
    const scope = name ? `[data-picker="${name}"]` : ''
    const root = scope && section.matches?.(scope) ? section : (section.querySelector(scope) || section)
    root.querySelectorAll('.hub-check:not([hidden]) input').forEach(input => {
      input.checked = !!checked
    })
  }

  function bind(section, { onSelectionChange } = {}) {
    if (!section || section.dataset.catalogPickerBound === '1') return
    section.dataset.catalogPickerBound = '1'
    const notify = () => {
      if (typeof onSelectionChange === 'function') onSelectionChange(selectedValues(section))
    }
    section.addEventListener('click', e => {
      const toggle = e.target.closest('[data-picker-selected]')
      if (toggle) {
        toggle.setAttribute('aria-pressed', toggle.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
        filter(section)
        return
      }
      const btn = e.target.closest('[data-pick-all], [data-pick-none]')
      if (!btn) return
      const name = btn.dataset.pickAll || btn.dataset.pickNone
      applyBulk(section, name, !!btn.dataset.pickAll)
      notify()
    })
    section.addEventListener('input', e => {
      const search = e.target.closest?.('[data-picker-search]')
      if (search) filter(section)
    })
    section.addEventListener('change', e => {
      if (e.target?.type === 'checkbox') notify()
    })
  }

  const exported = {
    BROWSE_THRESHOLD,
    renderPanel,
    renderSummary,
    filter,
    selectedValues,
    applyBulk,
    bind,
    itemId,
    itemLabel,
  }

  if (typeof module === 'object' && module.exports) module.exports = exported
  global.CatalogPicker = exported
})(typeof window !== 'undefined' ? window : globalThis)
