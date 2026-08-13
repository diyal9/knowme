'use strict'

/**
 * 将工具失败 trace 条目收敛为用户可读提示。
 * 禁止把 CLI/API 原始 JSON、log_id 直接甩到对话面。
 */
function buildToolFailureHint(entries = []) {
  const list = Array.isArray(entries) ? entries.filter(item => item && item.status === 'error') : []
  if (!list.length) return ''
  const joined = list.map(item => `${item.code || ''} ${item.text || ''}`.trim()).join('\n')
  if (/未授权|auth_required|identity is missing|no token in keychain|401|403|权限不足|unauthorized|forbidden/i.test(joined)) {
    return '工具调用未成功：当前权限或身份不足。\n请先在“设置 → 连接器”完成授权并补齐权限范围后重试。'
  }
  if (/approval_required|pending_review|等待.*批准|草稿/i.test(joined)) {
    return '工具调用已生成预览草稿，等待你在审批卡中确认后才会执行写入。'
  }
  if (/scope_denied|patch_conflict|pdf_too_large|orchestration_depth_exceeded|parallel_cap_exceeded/i.test(joined)) {
    return '工具调用未成功：路径/权限/编排策略不允许此操作。\n请检查内容源范围、文件冲突或子 Agent 预算后重试。'
  }
  if (/unknown_tool|未注册工具|非只读飞书工具|invalid_args|需要|参数/i.test(joined)) {
    return '工具调用未成功：请求参数或工具能力不匹配。\n请明确目标对象与参数后重试（例如补充文档 token、查询关键词）。'
  }
  if (/internal error|please retry|try again|服务器繁忙|系统繁忙|暂时不可用|"code"\s*:\s*1\b/i.test(joined)) {
    return '工具调用未成功：飞书接口暂时故障。\n请稍后再试一次，无需根据原始报错自行排查。'
  }
  if (/timeout|超时|network|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(joined)) {
    return '工具调用未成功：网络或服务暂时不可用。\n请稍后重试，或先缩小查询范围。'
  }
  const first = String(list[list.length - 1]?.text || '').trim()
  // Never dump raw CLI/API JSON envelopes into the chat surface.
  if (first.startsWith('{') || /"log_id"\s*:/.test(first)) {
    return '工具调用未成功：飞书接口暂时故障。\n请稍后再试一次。'
  }
  if (first) {
    return `工具调用未成功：${first.slice(0, 200)}\n请根据报错修正后重试。`
  }
  return '工具调用未成功，请根据报错修正后重试。'
}

module.exports = {
  buildToolFailureHint,
}
