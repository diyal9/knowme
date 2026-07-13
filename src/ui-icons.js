/** Sticky-Notes 图标 — Cursor / VS Code Codicon（16×16 · stroke 1.5 · 纯线型为主） */
;(function () {
  const BASE =
    'viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'

  const tint = 'fill="currentColor" fill-opacity="0.35" stroke="none"'

  const paths = {
    star: '<path d="M8 2.35 9.6 5.75l3.7.5-2.7 2.6.65 3.7L8 10.9l-3.25 1.65.65-3.7-2.7-2.6 3.7-.5z"/>',

    // 地图钉（线型，避免被看成钢笔）
    pin:
      '<path d="M8 1.8c-2.15 0-3.9 1.7-3.9 3.8 0 2.85 3.9 7.4 3.9 7.4s3.9-4.55 3.9-7.4c0-2.1-1.75-3.8-3.9-3.8z"/>' +
      '<circle cx="8" cy="5.6" r="1.35"/>',

    // Cursor 布局：右侧栏（放大/分栏）
    expand:
      '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2"/>' +
      '<path d="M10.15 2.25v11.5"/>' +
      `<rect ${tint} x="10.15" y="2.25" width="3.6" height="11.5" rx="0 2 2 0"/>`,

    // Cursor 布局：底栏（还原）
    shrink:
      '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2"/>' +
      '<path d="M2.25 10.15h11.5"/>' +
      `<rect ${tint} x="2.25" y="10.15" width="11.5" height="3.6" rx="0 0 2 2"/>`,

    minimize: '<path d="M3 8h10"/>',
    close: '<path d="M4.2 4.2l7.6 7.6"/><path d="M11.8 4.2 4.2 11.8"/>',

    trash:
      '<path d="M3.5 4.5h9"/><path d="M6.25 4.5V3.4h3.5v1.1"/><path d="M5.25 4.5l.5 8h4.5l.5-8"/><path d="M7 7v3.6"/><path d="M9 7v3.6"/>',

    // 对话气泡：纯描边（无实心填色）
    chat:
      '<path d="M2.4 3.4h11.2a1.3 1.3 0 0 1 1.3 1.3v5a1.3 1.3 0 0 1-1.3 1.3H7.1L4.4 13.4v-2.4H2.4A1.3 1.3 0 0 1 1.1 9.7v-5A1.3 1.3 0 0 1 2.4 3.4z"/>',

    send: '<path d="M2.6 8.1 13.4 3.3"/><path d="M13.4 3.3 9.1 9l3.1 5.5-2.6-3-5 1.3z"/>',

    copy:
      '<rect x="5.6" y="5.4" width="6.8" height="7.6" rx="1.3"/>' +
      '<path d="M4.3 10.4V4.5A1.3 1.3 0 0 1 5.6 3.2h5.1"/>',

    check: '<path d="M3.3 8.2 6.5 11.3 12.7 4.7"/>',

    history: '<circle cx="8" cy="8" r="5.2"/><path d="M8 5.15V8.05l2 1.35"/>',

    chevronRight: '<path d="M6.1 3.9 10 8 6.1 12.1"/>',

    // AI 优化：四角星芒（Cursor sparkle）
    optimize:
      '<path d="M8 2.2 8.85 6.15 12.8 7 8.85 7.85 8 11.8 7.15 7.85 3.2 7 7.15 6.15z"/>' +
      '<path d="M12.4 3.1l.35 1.35 1.35.35-1.35.35-.35 1.35-.35-1.35-1.35-.35 1.35-.35z"/>',

    expandText: '<path d="M8 2.5v11"/><path d="M5.5 5.3 8 2.9l2.5 2.4"/><path d="M5.5 10.7 8 13.1l2.5-2.4"/>',

    simplify: '<path d="M3.3 5h9.4"/><path d="M4.5 8.5h7"/><path d="M5.7 12h4.6"/>',

    en: '<path d="M5.1 12.1 8 3.9l2.9 8.2"/><path d="M6.2 9.35h3.6"/>',

    note:
      '<rect x="3.6" y="2.4" width="8.8" height="11.2" rx="1.5"/>' +
      '<path d="M5.8 5.3h4.4"/><path d="M5.8 7.5h4.4"/><path d="M5.8 9.7h2.8"/>',

    list: '<path d="M3.5 4.8h9"/><path d="M3.5 8h9"/><path d="M3.5 11.2h5.8"/>',

    panelBottom:
      '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2"/>' +
      '<path d="M2.25 10.15h11.5"/>' +
      `<rect ${tint} x="2.25" y="10.15" width="11.5" height="3.6" rx="0 0 2 2"/>`,

    panelRight:
      '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2"/>' +
      '<path d="M10.15 2.25v11.5"/>' +
      `<rect ${tint} x="10.15" y="2.25" width="3.6" height="11.5" rx="0 2 2 0"/>`,
  }

  function svg(name) {
    const inner = paths[name]
    if (!inner) return ''
    return `<svg ${BASE} aria-hidden="true">${inner}</svg>`
  }

  function mount(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      const html = svg(el.dataset.icon)
      if (html) el.innerHTML = html
    })
  }

  window.StickyIcons = { svg, mount, paths }
})()
