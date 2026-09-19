'use strict'

const { classifyToolError } = require('./agent-recovery')

/**
 * 将工具失败 trace 条目收敛为用户可读提示。
 * 禁止把 CLI/API 原始 JSON、log_id 直接甩到对话面。
 */
function buildToolFailureHint(entries = []) {
  const list = Array.isArray(entries) ? entries.filter(item => item && item.status === 'error') : []
  if (!list.length) return ''
  if (list.some(item => item.code === 'unknown_tool')) {
    return '工具调用未成功：本轮工具目录中没有这个工具（未注册或不可调用）。任务材料已保留，可检查能力是否加载后重新执行。'
  }
  const last = list.at(-1)
  const failureKind = require('./tool-failure-kind').classifyToolFailure(last)
  if (failureKind === 'authentication') return '连接器登录或认证已失效，请在能力中心重新认证；这不会改变 Agent 的能力授权范围。'
  if (failureKind === 'execution_uncertain') return '操作结果暂时无法确认。应先查询执行记录核验，不能直接重放写入；任务材料已保留。'
  if (failureKind === 'evidence_insufficient') return '执行结果缺少可验证证据，暂不能确认完成。请先核验已有结果，无需重复补充任务需求。'
  if (failureKind === 'operation_approval') return '本次操作尚未执行，等待你在审批卡中确认具体目标与参数。'
  if (require('./tool-json-diagnostics').isToolJsonSyntaxFailure(last)) {
    return '工具调用参数格式错误，未能解析为有效 JSON，该次调用尚未执行。需要重新生成工具参数；任务材料已保留，无需你补写 JSON 或重新描述需求。'
  }
  const category = last.code ? classifyToolError(last) : null
  if (category === 'network' || category === 'timeout') return '工具调用未成功：网络或服务暂时不可用。请稍后重试，或先缩小查询范围。'
  if (category === 'permission' || category === 'minute_permission') return '工具调用未成功：当前权限或身份不足。请完成对应能力或资源的授权后再继续。'
  if (category === 'invalid_args' && /^(?:write_file|create_file|apply_patch|mkdir|read_file|list_dir)$/.test(String(last.toolName || ''))) {
    return `文件工具 ${last.toolName} 的参数不完整或格式不正确。KnowMe 已内置该能力，无需前往能力中心安装；请重新执行，运行时会自动兼容常见的路径与内容字段。`
  }
  const joined = list.map(item => `${item.code || ''} ${item.text || ''}`.trim()).join('\n')
  if (/未授权|auth_required|identity is missing|no token in keychain|401|403|权限不足|unauthorized|forbidden/i.test(joined)) {
    return '工具调用未成功：当前权限或身份不足。\n请先在“设置 → 连接器”完成授权并补齐权限范围后重试。'
  }
  if (/approval_required|pending_review/i.test(joined)) {
    return '工具调用已生成预览草稿，等待你在审批卡中确认后才会执行写入。'
  }
  if (/scope_denied|patch_conflict|pdf_too_large|orchestration_depth_exceeded|parallel_cap_exceeded/i.test(joined)) {
    return '工具调用未成功：路径/权限/编排策略不允许此操作。\n请检查内容源范围、文件冲突或子 Agent 预算后重试。'
  }
  if (/tool_unavailable|missing_tool_ref|未配置|未加载|能力未加载/i.test(joined)) {
    return '工具调用未成功：目标能力没有完成加载或运行时依赖未配置。\n请先在“能力中心”检查该连接器/能力的安装与授权；若能力已存在，重新打开任务后再试。'
  }
  if (/unknown_tool|未注册工具|非只读飞书工具|invalid_args|需要|参数/i.test(joined)) {
    return '工具调用未成功：请求参数或工具能力不匹配。\n请明确目标对象与参数后重试（例如补充文档 token、查询关键词）。'
  }
  if (/internal error|please retry|try again|服务器繁忙|系统繁忙|暂时不可用|"code"\s*:\s*1\b/i.test(joined)) {
    return '工具调用未成功：上游服务暂时故障。\n请稍后再试一次，无需根据原始报错自行排查。'
  }
  if (/timeout|超时|network|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(joined)) {
    return '工具调用未成功：网络或服务暂时不可用。\n请稍后重试，或先缩小查询范围。'
  }
  const first = String(list[list.length - 1]?.text || '').trim()
  // Never dump raw CLI/API JSON envelopes into the chat surface.
  if (first.startsWith('{') || /"log_id"\s*:/.test(first)) {
    return '工具调用未成功：上游服务暂时故障。\n请稍后再试一次。'
  }
  return '工具调用未成功，暂时无法确认具体原因。任务材料已保留，可稍后重新执行。'
}

module.exports = {
  buildToolFailureHint,
}
