'use strict'

/**
 * 渲染层共享内核：HTML 转义、时间格式化、Toast。
 *
 * 各窗口（workspace / note / settings / editor-pane / list / memory）此前各自
 * 复制了一份实现，行为互不一致。本模块是唯一事实来源。
 *
 * 加载方式：浏览器侧 <script src="lib/ui-kit.js">，挂到 window.UIKit；
 * Node 侧 require() 用于单测。
 *
 * 整个模块包在 IIFE 里：经典 <script> 之间共享同一个顶层词法作用域，任何顶层
 * `const foo` 都可能与同页其它脚本（含 HTML 内联脚本）撞名，一旦撞上整页抛
 * SyntaxError 且后续脚本全部不执行。闭包内声明不进入该作用域，从结构上杜绝。
 */

;(function () {
  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  /**
   * 转义 HTML。同时覆盖引号，因此在属性上下文（href="…"）中使用也是安全的。
   * 非字符串（null / undefined / 数字）一律安全降级，不抛异常。
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return ''
    return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch])
  }

  /** 相对时间（口语化）：刚刚 / 5 分钟前 / 3 小时前 / 昨天 / 3 天前 / 具体日期 */
  function relativeTime(iso) {
    const t = new Date(iso || 0).getTime()
    if (!t) return ''
    const d = Date.now() - t
    if (d < 60e3) return '刚刚'
    if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前'
    if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前'
    if (d < 2 * 86400e3) return '昨天'
    if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + ' 天前'
    try {
      return new Date(t).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    } catch {
      return ''
    }
  }

  /** 相对时间（紧凑型）：刚刚 / 30s 前 / 5m 前 / 3h 前 / 3d 前 */
  function relativeTimeCompact(iso, emptyText = '—') {
    if (!iso) return emptyText
    const s = (Date.now() - new Date(iso).getTime()) / 1000
    if (!Number.isFinite(s)) return emptyText
    if (s < 5) return '刚刚'
    if (s < 60) return `${Math.floor(s)}s 前`
    if (s < 3600) return `${Math.floor(s / 60)}m 前`
    if (s < 86400) return `${Math.floor(s / 3600)}h 前`
    return `${Math.floor(s / 86400)}d 前`
  }

  /** 绝对时间：09/12 14:30 */
  function formatDateTime(iso) {
    const t = new Date(iso || 0).getTime()
    if (!t) return ''
    try {
      return new Date(t).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return ''
    }
  }

  const TOAST_MODIFIERS = { error: ' error', success: ' success' }

  /**
   * 构造一个绑定到指定 DOM 容器的 toast 函数。
   *
   * 容器可以传元素，也可以传返回元素的函数——settings 页在脚本执行时 DOM 尚未就绪，
   * 需要延迟到调用时才查找。
   */
  function createToast({ wrap, text, defaultMs = 3000 } = {}) {
    const resolve = ref => (typeof ref === 'function' ? ref() : ref)
    let timer = null

    return function toast(msg, type = 'info', ms = defaultMs) {
      const wrapEl = resolve(wrap)
      const textEl = resolve(text)
      if (!wrapEl || !textEl) return
      textEl.textContent = msg
      wrapEl.className = 'toast-wrap show' + (TOAST_MODIFIERS[type] || '')
      clearTimeout(timer)
      timer = setTimeout(() => { wrapEl.className = 'toast-wrap' }, ms)
    }
  }

  const uiKit = {
    escapeHtml,
    relativeTime,
    relativeTimeCompact,
    formatDateTime,
    createToast,
  }

  if (typeof module === 'object' && module.exports) module.exports = uiKit
  if (typeof window !== 'undefined') window.UIKit = uiKit
})()
