'use strict'

/**
 * agent-recovery — Agent 工具失败后的无副作用恢复策略。
 *
 * 只负责「判断」：错误分类、可重试判定、退避时长、替代工具建议、参数轻量修正、
 * 反思提示词构造与恢复预算判定。不做网络请求、不执行工具、不 sleep。
 * 由 main.js 的 ai-generate 循环消费，从而把「工具失败即结束」升级为
 * 「Reason → Act → Observe → Reflect」的自我修正闭环。
 */

// 仅网络/超时类适合无脑退避重试；权限/参数/资源类需要模型反思或用户介入。
const RETRYABLE_CATEGORIES = new Set(['network', 'timeout'])

// 允许触发一次「反思轮」的类别：要么模型能修正（参数/空结果/资源），
// 要么存在可执行的替代动作（妙记权限→申请草稿），要么可如实说明（权限）。
const RECOVERABLE_CATEGORIES = new Set([
  'invalid_args',
  'network',
  'timeout',
  'missing_resource',
  'empty_result',
  'minute_permission',
  'permission',
])

const REFLECTION_TIPS = {
  minute_permission: '这是单条妙记的授权问题，不是应用权限缺失；不要重复读取同一个 minute_token。',
  permission: '这是授权/身份问题，重复重试无用；请明确告诉用户需要补齐哪个授权范围。',
  invalid_args: '这是参数问题；请检查并修正参数（如补齐 token、缩短或更换关键词）后再调用。',
  network: '这是网络/服务波动；可稍后重试，或先缩小查询范围。',
  timeout: '这是执行超时；请缩小查询范围或减少一次性读取的数据量后重试。',
  missing_resource: '目标资源不存在；请确认路径/token 是否正确，或换一个来源，必要时向用户确认。',
  empty_result: '返回内容为空或与目标无关；请更换检索策略或关键词，不要基于空结果臆造结论。',
  unknown_tool: '该工具不可用；请改用已注册的工具完成目标。',
  cancelled: '本次执行已被取消，无需继续。',
  unknown: '请结合报错原文判断原因，必要时更换工具或如实说明无法完成。',
}

function errorHaystack(result = {}) {
  return `${result?.code || ''} ${result?.message || ''} ${result?.text || ''}`
    .toLowerCase()
    .trim()
}

/**
 * 将一次工具执行结果归类。成功（ok !== false）返回 null。
 * @param {{ok?:boolean, code?:string, message?:string, text?:string}} result
 * @returns {string|null}
 */
function classifyToolError(result = {}) {
  // 兼容两种入参：真实工具结果（ok:false）与循环 trace 条目（status:'error'）。
  if (!result) return null
  if (result.ok !== false && result.status !== 'error') return null
  const code = String(result.code || '').toLowerCase()
  const text = errorHaystack(result)
  if (code === 'cancelled' || /已取消|cancelled/.test(text)) return 'cancelled'
  if (/no read permission for minute|单条妙记|这份妙记.*没有查看权限|minute\b.*permission/.test(text)) {
    return 'minute_permission'
  }
  if (code === 'invalid_args' || /invalid_args|参数|argument|需要非空|需要 [a-z_]/.test(text)) {
    return 'invalid_args'
  }
  if (code === 'unknown_tool' || /unknown_tool|未注册工具|非只读飞书工具/.test(text)) return 'unknown_tool'
  if (code === 'tool_timeout' || /timeout|超时/.test(text)) return 'timeout'
  if (
    /enotfound|econnrefused|econnreset|etimedout|socket hang up|network|网络|服务暂时不可用|internal error|please retry|try again|服务器繁忙|系统繁忙|暂时不可用|"code"\s*:\s*1\b/.test(text)
  ) {
    return 'network'
  }
  if (
    /未授权|auth_required|identity is missing|no token in keychain|401|403|权限不足|权限|unauthorized|forbidden|scope/.test(text)
  ) {
    return 'permission'
  }
  if (/enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源/.test(text)) {
    return 'missing_resource'
  }
  if (code === 'not_meeting_document' || code === 'empty_result' || /没有会议内容|拒绝总结|正文为空|结果为空/.test(text)) {
    return 'empty_result'
  }
  return 'unknown'
}

function isRetryable(category) {
  return RETRYABLE_CATEGORIES.has(String(category || ''))
}

/** 指数退避（含上限），不含抖动，便于测试确定性。 */
function retryDelayMs(attempt, { base = 400, cap = 4000 } = {}) {
  const n = Math.max(0, Math.floor(Number(attempt) || 0))
  return Math.min(cap, base * (2 ** n))
}

/**
 * 单个工具调用是否应重试（仅网络/超时）。
 * @returns {{retry:boolean, delayMs:number}}
 */
function planRetry({ category, attempt = 0, maxRetries = 2, base = 400, cap = 4000 } = {}) {
  if (!isRetryable(category)) return { retry: false, delayMs: 0 }
  if (Number(attempt) >= Number(maxRetries)) return { retry: false, delayMs: 0 }
  return { retry: true, delayMs: retryDelayMs(attempt, { base, cap }) }
}

/**
 * 依据错误类别为失败工具建议一个替代工具（存在确定性替代动作时）。
 * @returns {string|null}
 */
function suggestAlternativeTool(toolName, category) {
  const name = String(toolName || '').trim()
  if (category === 'minute_permission' && name === 'feishu.meeting_read') {
    return 'feishu.draft_minute_permission'
  }
  return null
}

/**
 * 对可确定的参数问题做轻量修正（不猜测语义，只做安全裁剪/清理）。
 * 返回修正后的 args；若无可修正项返回 null。
 */
function suggestParamCorrection(toolName, rawArgs, category) {
  if (category !== 'invalid_args') return null
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? { ...rawArgs } : {}
  let changed = false
  // 过长 query 往往导致检索后端报参错：裁剪到更稳的长度。
  if (typeof args.query === 'string' && args.query.length > 60) {
    args.query = args.query.slice(0, 60).trim()
    changed = true
  }
  // 清理空字符串参数，避免把 '' 当作有效定位符传下去。
  for (const key of Object.keys(args)) {
    if (typeof args[key] === 'string' && args[key].trim() === '') {
      delete args[key]
      changed = true
    }
  }
  return changed ? args : null
}

function normalizeFailures(failures = []) {
  return (Array.isArray(failures) ? failures : []).filter(
    (item) => item && item.status === 'error',
  )
}

/**
 * 是否值得再给模型一次「反思轮」而不是直接结束。
 * 约束：预算未耗尽、存在可恢复类别、且未发生重复调用（重复调用交给收敛逻辑）。
 */
function shouldAttemptRecovery({ failures = [], recoveryUsed = 0, maxRecovery = 2, repeatedCall = false } = {}) {
  if (repeatedCall) return false
  if (Number(recoveryUsed) >= Number(maxRecovery)) return false
  const list = normalizeFailures(failures)
  if (!list.length) return false
  return list.some((item) => RECOVERABLE_CATEGORIES.has(classifyToolError(item)))
}

/**
 * 构造喂给模型的反思提示（role:user），引导其定位失败原因并选择下一步，
 * 而不是机械地用相同参数重试。包含替代工具与参数修正建议。
 */
function buildReflectionNote(failures = []) {
  const list = normalizeFailures(failures)
  if (!list.length) return ''
  const lines = ['刚才的工具调用未成功。请先分析失败原因，再决定下一步，不要用相同参数机械重试：', '']
  for (const item of list) {
    const category = classifyToolError(item)
    const tip = REFLECTION_TIPS[category] || REFLECTION_TIPS.unknown
    const alt = suggestAlternativeTool(item.toolName, category)
    const detail = String(item.text || item.message || '').replace(/\s+/g, ' ').trim().slice(0, 160)
    lines.push(`- 工具 \`${item.toolName || '未知'}\` 失败（${category}）：${detail}`)
    lines.push(`  · ${tip}${alt ? ` 可改用 \`${alt}\`。` : ''}`)
  }
  lines.push('')
  lines.push(
    '决策原则：权限/身份问题——不要重试，明确告诉用户缺哪个授权（妙记类可生成权限申请草稿并等待确认）；参数问题——修正后再调用；网络/超时——可缩小范围后重试；确实无法完成——如实说明缺少什么，不要臆造结论。',
  )
  return lines.join('\n')
}

module.exports = {
  RETRYABLE_CATEGORIES,
  RECOVERABLE_CATEGORIES,
  REFLECTION_TIPS,
  classifyToolError,
  isRetryable,
  retryDelayMs,
  planRetry,
  suggestAlternativeTool,
  suggestParamCorrection,
  shouldAttemptRecovery,
  buildReflectionNote,
}
