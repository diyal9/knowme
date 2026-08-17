'use strict'

const MAX_DISPLAY_PREVIEW = 240

const FAILURE_CODE_LABELS = {
  tool_timeout: '执行超时',
  timeout: '执行超时',
  cancelled: '已取消',
  task_failed: '命令执行失败',
  spawn_failed: '进程启动失败',
  invalid_args: '参数无效',
  scope_denied: '范围或安全策略拒绝',
  unknown_tool: '工具不可用',
  tool_unavailable: '工具不可用',
  tool_failed: '工具执行失败',
  tool_error: '工具执行失败',
  network: '网络异常',
  approval_required: '等待批准',
  missing_resource: '目标资源不存在',
  empty_result: '结果为空',
}

function isUnsafeRawDump(text = '') {
  const s = String(text || '').trim()
  if (!s) return true
  if (s.startsWith('{') || s.startsWith('[')) return true
  if (/"log_id"\s*:/.test(s)) return true
  if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(s)) return true
  return false
}

function friendlyFailureCode(code = '') {
  const key = String(code || '').trim().toLowerCase()
  return FAILURE_CODE_LABELS[key] || ''
}

/**
 * Build a display-safe tool summary for v2 events / DOM timeline.
 * Full result.text stays in model context and internal ledger only.
 * Failures MUST surface a short human reason (code label / preview / message),
 * without dumping raw CLI/API envelopes.
 * @param {object} result
 * @param {{ ok?: boolean }} [options]
 */
function buildToolDisplaySummary(result = {}, options = {}) {
  const ok = options.ok !== false && result.ok !== false
  if (result.displaySafe === true && result.displayPreview) {
    return String(result.displayPreview).slice(0, MAX_DISPLAY_PREVIEW)
  }
  if (ok) {
    const code = result.code ? String(result.code).slice(0, 40) : ''
    const base = '操作已完成'
    return code && code !== 'ok' ? `${base}（${code}）` : base
  }

  const code = result.code ? String(result.code).slice(0, 40) : ''
  const label = friendlyFailureCode(code) || '操作失败'
  const preview = String(result.preview || result.message || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (preview && !isUnsafeRawDump(preview)) {
    return preview.slice(0, MAX_DISPLAY_PREVIEW)
  }
  if (code && !friendlyFailureCode(code)) {
    return `${label}（${code}）`
  }
  return label
}

module.exports = {
  MAX_DISPLAY_PREVIEW,
  FAILURE_CODE_LABELS,
  isUnsafeRawDump,
  friendlyFailureCode,
  buildToolDisplaySummary,
}
