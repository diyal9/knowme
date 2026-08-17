'use strict'

/**
 * Map internal/IPC errors to short user-facing Chinese copy.
 * Keeps Electron "Error invoking remote method" and ReferenceError out of chat bubbles.
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AgentErrorHumanize = api
})(typeof window !== 'undefined' ? window : null, function () {

  function rawMessage(err) {
    if (err == null) return ''
    if (typeof err === 'string') return err
    if (err instanceof Error) return err.message || String(err)
    if (typeof err.message === 'string') return err.message
    return String(err)
  }

  function humanizeAgentError(err, opts = {}) {
    const fallback = opts.fallback || '暂时无法完成回复，请重试'
    const raw = rawMessage(err).trim()
    if (!raw) return fallback

    if (/未填写 API Key|未填写 API Endpoint|Endpoint 格式错误/i.test(raw)) return raw
    if (/任务入口已失效|所需工具不可用|模型返回空响应|请求已取消|暂时无法完成回复/i.test(raw)) return raw
    if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(raw)) {
      return '网络异常，请检查连接后重试'
    }
    if (/abort|cancelled|canceled/i.test(raw)) return '请求已取消'

    // Already a product-facing string (Chinese guidance / short reason)
    if (
      !/Error invoking remote method/i.test(raw)
      && !/\bReferenceError\b|\bTypeError\b|\bSyntaxError\b|\bis not defined\b|\bcannot read\b/i.test(raw)
      && raw.length <= 200
    ) {
      return raw
    }

    if (/Error invoking remote method/i.test(raw) || /\bis not defined\b/i.test(raw)) {
      return fallback
    }
    if (/\bReferenceError\b|\bTypeError\b/i.test(raw)) return fallback

    // Strip Electron IPC wrapper if present but keep a short trailing clue for support
    const stripped = raw
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (stripped.length > 160) return fallback
    if (/\b[A-Za-z]+Error\b/.test(stripped) || /\bis not (defined|a function)\b/i.test(stripped)) {
      return fallback
    }
    return stripped || fallback
  }

  return { humanizeAgentError, rawMessage }
})
