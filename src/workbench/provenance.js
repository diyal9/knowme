'use strict'

/**
 * Workbench 货架来源标签（浏览器脚本）。
 * 挂到 window.WorkbenchProvenance，供 workbench.js 委托。
 * 无 bundler：用 IIFE，顶层不声明 const/let，避免 script-scope 冲突。
 */
;(function (root) {
  function shelfProvenanceLabel(source) {
    const value = String(source || '')
    if (value === 'personal' || value === 'forked') return '我的'
    if (value === 'official') return '官方'
    return '共享'
  }

  root.WorkbenchProvenance = {
    shelfProvenanceLabel: shelfProvenanceLabel,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { shelfProvenanceLabel: shelfProvenanceLabel }
  }
})(typeof window !== 'undefined' ? window : globalThis)
