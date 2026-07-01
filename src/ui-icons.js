/** Sticky-Notes 统一线型图标（16×16） */
;(function () {
  const BASE = 'viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'

  const paths = {
    star: '<path d="M8 2.5 9.7 6l4 .6-2.9 2.8.7 4L8 11.2 4.5 13.4l.7-4L2.3 6.6l4-.6z"/>',
    pin: '<circle cx="8" cy="5.2" r="2"/><path d="M8 7.2v4.2"/><path d="M6 11.4h4"/>',
    expand: '<path d="M2.5 6.5V2.5H6.5"/><path d="M9.5 2.5H13.5V6.5"/><path d="M13.5 9.5V13.5H9.5"/><path d="M6.5 13.5H2.5V9.5"/>',
    shrink: '<path d="M6.5 2.5H2.5V6.5"/><path d="M13.5 9.5V13.5H9.5"/><path d="M2.5 9.5V13.5H6.5"/><path d="M13.5 2.5V6.5H9.5"/>',
    minimize: '<path d="M3 8h10"/>',
    close: '<path d="M4 4l8 8"/><path d="M12 4 4 12"/>',
    chat: '<path d="M3.5 4.5h9A1.5 1.5 0 0 1 14 6v4a1.5 1.5 0 0 1-1.5 1.5H7.5L5 13v-2H3.5A1.5 1.5 0 0 1 2 9.5V6a1.5 1.5 0 0 1 1.5-1.5z"/>',
    send: '<path d="M8 4v7.5"/><path d="M5.5 7.5 8 5l2.5 2.5"/>',
    copy: '<rect x="5.5" y="5.5" width="7" height="8" rx="1.2"/><path d="M4 10V4.5A1 1 0 0 1 5 3.5h5.5"/>',
    check: '<path d="M3.2 8.5l3 3 6.5-7"/>',
    chevronRight: '<path d="M6 4l4 4-4 4"/>',
    optimize: '<path d="M3 5h7"/><circle cx="5.5" cy="5" r="1.2"/><path d="M3 8.5h10"/><circle cx="10.5" cy="8.5" r="1.2"/><path d="M3 12h6"/><circle cx="7" cy="12" r="1.2"/>',
    expandText: '<path d="M8 2.5v11"/><path d="M5.5 5.5 8 3l2.5 2.5"/><path d="M5.5 10.5 8 13l2.5-2.5"/>',
    simplify: '<path d="M3.5 5h9"/><path d="M4.5 8h7"/><path d="M5.5 11h5"/>',
    en: '<path d="M5 12 8 4l3 8"/><path d="M6.2 9.5h3.6"/>',
    note: '<path d="M4.5 3.5h7A1.5 1.5 0 0 1 13 5v8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M6 7h4"/><path d="M6 9.5h4"/><path d="M6 12h2.5"/>',
    list: '<path d="M4 5h8"/><path d="M4 8h8"/><path d="M4 11h5"/>',
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
