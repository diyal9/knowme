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
// unknown 也要经过一次反思：MCP/第三方连接器经常返回未标准化的错误码，
// 不能因为分类不完整就让工具调用成为对话的最后一个可见动作。
const RECOVERABLE_CATEGORIES = new Set([
  'invalid_args',
  'network',
  'timeout',
  'missing_resource',
  'empty_result',
  'minute_permission',
  'permission',
  'unknown',
  'unknown_tool',
])

const REFLECTION_TIPS = {
  minute_permission: '这是单条妙记的授权问题，不是应用权限缺失；不要重复读取同一个 minute_token。',
  permission: '这是授权/身份问题，重复重试无用；请明确告诉用户需要补齐哪个授权范围。',
  invalid_args: '这是参数问题；请检查并修正参数（如补齐 token、缩短或更换关键词）后再调用。',
  network: '这是网络/服务波动；可稍后重试，或先缩小查询范围。',
  timeout: '这是执行超时；请缩小查询范围或减少一次性读取的数据量后重试。',
  missing_resource: '目标资源不存在；请确认路径/token 是否正确，或换一个来源，必要时向用户确认。',
  empty_result: '返回内容为空或与目标无关；请更换检索策略或关键词，不要基于空结果臆造结论。',
  unknown_tool: '该名称不是本轮可调用工具。Skill 是方法说明，不等于同名函数；只调用本轮 tools 列表中提供的工具。若材料已经齐全，可直接按 Skill 方法分析作答，不要因工具名称错误要求用户补参数，也不要重跑已经成功的副作用。',
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
  // Canonical codes describe the failure; prose may merely mention a previous
  // cancellation, permissions or arguments. It must not override that code.
  const canonical = {
    cancelled: 'cancelled', unknown_tool: 'unknown_tool', invalid_args: 'invalid_args',
    tool_timeout: 'timeout', timeout: 'timeout', network: 'network', network_error: 'network',
    econnreset: 'network', econnrefused: 'network', enotfound: 'network', etimedout: 'timeout',
    missing_resource: 'missing_resource', empty_result: 'empty_result', not_meeting_document: 'empty_result',
    pango_no_image: 'empty_result',
    scope_denied: 'permission', permission_denied: 'permission', auth_required: 'permission',
  }
  if (Object.hasOwn(canonical, code)) return canonical[code]
  if (code === 'cancelled' || /已取消|cancelled/.test(text)) return 'cancelled'
  if (code === 'unknown_tool') return 'unknown_tool'
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

/** 超时类用更长退避，避免贴着连续打满多次 TOOL_EXEC_TIMEOUT。 */
function backoffDefaultsForCategory(category) {
  if (String(category || '') === 'timeout') return { base: 2000, cap: 30000 }
  return { base: 400, cap: 4000 }
}

/**
 * 单个工具调用是否应重试（仅网络/超时）。
 * 默认指数退避：network 400→800→…cap4s；timeout 2s→4s→…cap30s。
 * @returns {{retry:boolean, delayMs:number}}
 */
function planRetry({ category, attempt = 0, maxRetries = 2, base, cap } = {}) {
  if (!isRetryable(category)) return { retry: false, delayMs: 0 }
  if (Number(attempt) >= Number(maxRetries)) return { retry: false, delayMs: 0 }
  const defaults = backoffDefaultsForCategory(category)
  const resolvedBase = Number.isFinite(base) ? base : defaults.base
  const resolvedCap = Number.isFinite(cap) ? cap : defaults.cap
  return { retry: true, delayMs: retryDelayMs(attempt, { base: resolvedBase, cap: resolvedCap }) }
}

function formatToolTimeoutSummary({ argsSummary = '', timeoutSec = 45 } = {}) {
  const sec = Math.max(1, Math.round(Number(timeoutSec) || 45))
  const base = String(argsSummary || '').trim()
  return base ? `${base} · 工具执行超时（${sec}s）` : `工具执行超时（${sec}s）`
}

/**
 * 退避等待中的进度文案（第 attempt 次即将执行的重试，attempt 从 1 起）。
 */
function formatToolRetrySummary({ argsSummary = '', attempt = 1, delayMs = 0, reason = 'timeout' } = {}) {
  const waitSec = Math.max(1, Math.ceil(Math.max(0, Number(delayMs) || 0) / 1000))
  const n = Math.max(1, Math.floor(Number(attempt) || 1))
  const reasonLabel = reason === 'network' ? '网络异常' : reason === 'timeout' ? '超时' : '失败'
  const base = String(argsSummary || '').trim()
  const tip = `${reasonLabel}，${waitSec}s 后第 ${n} 次重试`
  return base ? `${base} · ${tip}` : tip
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
  const name = String(toolName || '').trim()
  const fileTools = new Set(['read_file', 'list_dir', 'write_file', 'create_file', 'apply_patch', 'mkdir'])
  if (fileTools.has(name)) {
    // OpenAI-compatible models commonly use these documented-by-other-SDK
    // aliases. They carry the same value, so normalizing them is deterministic.
    const nested = args.file && typeof args.file === 'object' && !Array.isArray(args.file)
      ? args.file
      : args.input && typeof args.input === 'object' && !Array.isArray(args.input)
        ? args.input
        : null
    const pathAliases = ['file_path', 'filePath', 'target_path', 'targetPath', 'filename']
    const contentAliases = ['contents', 'body', 'text', 'code', 'html']
    if (!args.path && typeof args.file === 'string' && args.file.trim()) {
      args.path = args.file
      delete args.file
      changed = true
    }
    if (!args.path) {
      const key = pathAliases.find(alias => typeof args[alias] === 'string' && args[alias].trim())
      const nestedKey = nested && pathAliases.find(alias => typeof nested[alias] === 'string' && nested[alias].trim())
      if (key || nestedKey || (nested && typeof nested.path === 'string' && nested.path.trim())) {
        args.path = key ? args[key] : nestedKey ? nested[nestedKey] : nested.path
        changed = true
      }
    }
    if (['write_file', 'create_file', 'apply_patch'].includes(name) && args.content == null) {
      const key = contentAliases.find(alias => typeof args[alias] === 'string')
      const nestedKey = nested && contentAliases.find(alias => typeof nested[alias] === 'string')
      if (key || nestedKey || (nested && typeof nested.content === 'string')) {
        args.content = key ? args[key] : nestedKey ? nested[nestedKey] : nested.content
        changed = true
      }
    }
    for (const alias of [...pathAliases, ...contentAliases]) {
      if (Object.prototype.hasOwnProperty.call(args, alias)) {
        delete args[alias]
        changed = true
      }
    }
    if (nested) {
      delete args.file
      delete args.input
      changed = true
    }
  }
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

/**
 * 将错误分类收敛为运行时可执行的下一步。
 * 这份计划同时供执行器和模型反思提示使用，避免每个连接器各自发明一套失败语义。
 */
function buildRecoveryPlan({ toolName = '', result = {}, rawArgs = null, contract = {}, attempt = 0 } = {}) {
  const category = classifyToolError(result)
  if (!category) return { category: null, action: 'none', retry: false }
  const failureKind = require('./tool-failure-kind').classifyToolFailure(result, contract)
  if (failureKind === 'execution_uncertain' || failureKind === 'evidence_insufficient') {
    return { category, failureKind, action: 'verify_result', retry: false, automatic: false,
      reason: '先通过只读查询核验已有操作结果；没有证据前不得重放写入或宣称完成。' }
  }
  if (['authentication', 'authorization', 'operation_approval'].includes(failureKind)) {
    return { category, failureKind, action: 'ask_user', retry: false, automatic: false,
      reason: failureKind === 'authentication' ? '连接器身份已失效，请重新认证。'
        : failureKind === 'operation_approval' ? '等待本次具体操作批准。' : '需要当前任务的能力或资源授权。' }
  }
  const retrySafe = contract?.sideEffects === false && contract?.risk === 'read'
  const correctedArgs = suggestParamCorrection(toolName, rawArgs, category)
  if (category === 'invalid_args' && correctedArgs && result?.executionStarted === false) {
    return {
      category,
      action: 'repair_args',
      retry: true,
      automatic: true,
      correctedArgs,
      reason: '参数可做无语义猜测的字段归一化、清理或裁剪',
    }
  }
  if (category === 'network' || category === 'timeout') {
    return {
      category,
      action: retrySafe ? 'retry' : 'reflect',
      retry: retrySafe && attempt < 2,
      automatic: retrySafe,
      reason: retrySafe ? '工具声明无副作用，可退避重试' : '工具未声明为无副作用，禁止自动重放',
    }
  }
  if (category === 'minute_permission') {
    return { category, action: 'alternative_tool', retry: false, automatic: false, alternativeTool: suggestAlternativeTool(toolName, category) }
  }
  if (category === 'permission') {
    return { category, action: 'ask_user', retry: false, automatic: false, reason: '需要授权或更高权限' }
  }
  if (category === 'missing_resource' || category === 'invalid_args' || category === 'empty_result') {
    return { category, action: 'reflect', retry: false, automatic: false, reason: REFLECTION_TIPS[category] }
  }
  if (category === 'unknown_tool') {
    return { category, action: 'alternative_tool', retry: false, automatic: false, reason: REFLECTION_TIPS.unknown_tool }
  }
  return { category, action: 'reflect', retry: false, automatic: false, reason: REFLECTION_TIPS.unknown }
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
    const syntaxFailure = require('./tool-json-diagnostics').isToolJsonSyntaxFailure(item)
    const tip = syntaxFailure
      ? '这是工具调用参数的 JSON 语法错误，该调用尚未执行。请按工具 schema 重新生成完整 JSON 对象，不要包 Markdown 代码围栏或附加解释。正文中的双引号、反斜杠和换行必须正确转义（例如换行写成 \\n）。检查字符串与括号闭合；不得猜补或删减正文来掩盖错误。若内容过长，在工具支持的前提下分步生成并核验完整成果；不要重复已经成功的写入，也不要要求用户提供 JSON 或凭据来修复语法。'
      : REFLECTION_TIPS[category] || REFLECTION_TIPS.unknown
    const alt = suggestAlternativeTool(item.toolName, category)
    const detail = String(item.text || item.message || '').replace(/\s+/g, ' ').trim().slice(0, 160)
    lines.push(`- 工具 \`${item.toolName || '未知'}\` 失败（${category}）：${detail}`)
    lines.push(`  · ${tip}${alt ? ` 可改用 \`${alt}\`。` : ''}`)
    const corrected = suggestParamCorrection(item.toolName, item.args, category)
    if (corrected) {
      lines.push(`  · 运行时可安全修正参数后重试：${JSON.stringify(corrected).slice(0, 360)}`)
    }
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
  backoffDefaultsForCategory,
  planRetry,
  formatToolTimeoutSummary,
  formatToolRetrySummary,
  suggestAlternativeTool,
  suggestParamCorrection,
  buildRecoveryPlan,
  shouldAttemptRecovery,
  buildReflectionNote,
}
