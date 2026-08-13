'use strict'

/**
 * Workbench HTML escape helpers (browser).
 * Prefers UIKit when loaded; keeps a local fallback.
 */
;(function (root) {
  function escapeHtml(value) {
    if (root.UIKit && typeof root.UIKit.escapeHtml === 'function') {
      return root.UIKit.escapeHtml(value)
    }
    if (value === null || value === undefined) return ''
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  root.WorkbenchEscape = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml: escapeHtml, escapeAttr: escapeAttr }
  }
})(typeof window !== 'undefined' ? window : globalThis)
