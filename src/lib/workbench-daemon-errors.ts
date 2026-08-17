'use strict'

/**
 * Daemon (workflow-web) error envelope helpers.
 * Protocol source: docs/daemon/API.md (upstream v1.0.0+)
 *
 * Success path is opaque to this module. Failures use:
 *   { detail: { code, message, errors? } }
 */

/**
 * @typedef {object} DaemonErrorDetail
 * @property {string} [code]
 * @property {string} [message]
 * @property {unknown[]} [errors]
 */

/**
 * @typedef {object} DaemonErrorBody
 * @property {DaemonErrorDetail|string} [detail]
 * @property {string} [code]
 * @property {string} [error_code]
 * @property {string} [message]
 * @property {unknown[]} [errors]
 */

/**
 * @typedef {object} ParsedDaemonError
 * @property {string} code
 * @property {string} message
 * @property {number} status
 * @property {unknown[]} [errors]
 * @property {string} [daemonCode]
 */

/** @type {Record<string, string>} */
const DEFAULT_MESSAGES = {
  auth_required: '需要授权码登录后使用此功能',
  unauthorized: '授权失败，请重新登录',
  forbidden: '没有权限执行此操作',
  demo_slug_required: '体验档任务标识须以 demo- 开头',
  tenant_slug_required: '任务标识须以项目组前缀开头',
  tenant_forbidden: '不是你的项目组',
  tenants_disabled: '未启用项目组功能',
  tenant_not_found: '未知项目组',
  task_not_found: '任务不存在',
  task_forbidden: '不是你的任务',
  slug_exists: '任务标识已存在',
  slug_invalid: '任务标识格式错误：须为 kebab-case（^[a-z][a-z0-9-]*$）',
  ingest_required: '缺少必要的需求材料',
  handler_required: '飞书通知（离线）模式须指定处理者 handler_open_id',
  mode_invalid: 'mode 须为 long 或 pre',
  workflow_required: 'workflow 字段必填',
  workflow_not_found: '工作流不存在',
  workflow_or_node_not_found: '工作流或节点不存在',
  validation_failed: '参数校验失败',
  validation_error: '请求参数无效',
  invalid_json: 'JSON 无效',
  invalid_encoding: '请求编码无效',
  invalid_body: '请求体须为 JSON 对象',
  chat_session_not_found: '编排会话不存在',
  query_session_not_found: '问答会话不存在',
  stream_not_found: '流不存在',
  stream_session_not_found: '当前对话没有流式会话',
  artifact_not_found: '制品不存在',
  not_found: '资源不存在',
  gate_invalid: '审批参数无效：需要 node 与 decision(approve|reject|revise)',
  gate_write_failed: '写入 Gate 决策失败',
  clarify_invalid: '澄清答复无效：需要 node 与 answer',
  clarify_write_failed: '写入澄清答复失败',
  file_required: '需要上传文件',
  file_empty: '文件为空',
  file_too_large: '文件过大（最大 15MB）',
  channel_invalid: 'channel 须为 query 或 chat',
  action_invalid: 'action 须为 reset 或 compress',
  text_required: 'text 不能为空',
  bad_request: '请求无效',
  internal_error: '服务内部错误',
}

const AUTH_ERROR_CODES = new Set(['auth_required', 'unauthorized'])

/**
 * @param {unknown} code
 * @returns {boolean}
 */
function isAuthErrorCode(code) {
  return AUTH_ERROR_CODES.has(String(code || '').trim().toLowerCase())
}

/**
 * @param {DaemonErrorBody|null|undefined} body
 * @returns {DaemonErrorDetail|null}
 */
function readDetailObject(body) {
  if (!body || typeof body !== 'object') return null
  const detail = body.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) return detail
  return null
}

/**
 * @param {DaemonErrorBody|null|undefined} body
 * @returns {string}
 */
function extractDaemonErrorCode(body) {
  const detail = readDetailObject(body)
  const fromDetail = detail && detail.code != null ? String(detail.code).trim() : ''
  if (fromDetail) return fromDetail.toLowerCase()
  if (!body || typeof body !== 'object') return ''
  const top = body.code != null ? body.code : body.error_code
  return top != null ? String(top).trim().toLowerCase() : ''
}

/**
 * @param {DaemonErrorBody|null|undefined} body
 * @param {string} [fallback]
 * @returns {string}
 */
function extractDaemonErrorMessage(body, fallback = '请求失败') {
  if (!body || typeof body !== 'object') return fallback
  const detail = body.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  const detailObj = readDetailObject(body)
  if (detailObj && typeof detailObj.message === 'string' && detailObj.message.trim()) {
    return detailObj.message.trim()
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
  const code = extractDaemonErrorCode(body)
  if (code && DEFAULT_MESSAGES[code]) return DEFAULT_MESSAGES[code]
  return fallback
}

/**
 * @param {DaemonErrorBody|null|undefined} body
 * @returns {unknown[]|undefined}
 */
function extractDaemonErrorErrors(body) {
  const detail = readDetailObject(body)
  if (detail && Array.isArray(detail.errors)) return detail.errors
  if (body && Array.isArray(body.errors)) return body.errors
  return undefined
}

/**
 * @param {DaemonErrorBody|null|undefined} body
 * @param {number} [status]
 * @param {string} [fallbackMessage]
 * @param {{ isAuthFailure?: (status: number, message: string) => boolean }} [options]
 * @returns {ParsedDaemonError}
 */
function parseDaemonError(body, status = 0, fallbackMessage, options = {}) {
  const httpStatus = Number(status) || 0
  const fallback = fallbackMessage || (httpStatus ? `Workbench 请求失败（${httpStatus}）` : 'Workbench 请求失败')
  const message = extractDaemonErrorMessage(body, fallback)
  const rawCode = extractDaemonErrorCode(body)
  const errors = extractDaemonErrorErrors(body)

  let code = rawCode
  if (isAuthErrorCode(code)) {
    code = 'auth_required'
  } else if (!code) {
    const authProbe = typeof options.isAuthFailure === 'function'
      ? options.isAuthFailure(httpStatus, message)
      : (httpStatus === 401 || (httpStatus === 403 && /授权|auth|login|未登录|guest|token/i.test(message)))
    if (httpStatus === 401 || authProbe) code = 'auth_required'
    else if (httpStatus === 403) code = 'forbidden'
    else if (httpStatus === 409 || httpStatus === 426
      || /protocol|version/.test(message)
      || /协议版本|protocol version/i.test(message)) {
      code = 'protocol_incompatible'
    } else {
      code = 'http_error'
    }
  } else if (code === 'protocol_incompatible' || /protocol|version/.test(code)) {
    code = 'protocol_incompatible'
  }

  const result = {
    code,
    message,
    status: httpStatus,
  }
  if (errors !== undefined) result.errors = errors
  if (rawCode && rawCode !== code) result.daemonCode = rawCode
  return result
}

module.exports = {
  DEFAULT_MESSAGES,
  AUTH_ERROR_CODES,
  isAuthErrorCode,
  extractDaemonErrorCode,
  extractDaemonErrorMessage,
  parseDaemonError,
}
