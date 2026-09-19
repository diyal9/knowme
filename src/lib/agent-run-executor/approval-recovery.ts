'use strict'

// Input must come exclusively from the host surface's durable receipt getter.
// Session fields, renderer payloads and model output are never receipt sources.
function approvalRecoveryContext(rows, sessionId) {
  if (!Array.isArray(rows) || rows.length > 32) {
    throw Object.assign(new Error('审批恢复记录超过本轮预算，不能忽略既有执行结果。'), { code: 'approval_context_budget_exceeded' })
  }
  const messages = []
  const artifacts = []
  for (const row of rows) {
    if (row?.sessionId !== sessionId || !row.draftId || !row.toolName) {
      throw Object.assign(new Error('审批恢复记录不属于当前会话。'), { code: 'approval_receipt_invalid' })
    }
    if (row.outcome === 'uncertain') return { uncertain: true, messages: [], artifacts: [] }
    const result = row.result || {}
    const succeeded = row.outcome === 'executed' && result.ok === true
    const refs = succeeded ? (result.artifactRefs || result.artifacts || []) : []
    const text = String(result.text || '')
    if (text.length > 32768 || !Array.isArray(refs) || refs.length > 32) {
      throw Object.assign(new Error('审批结果不能完整放入本轮上下文。'), { code: 'approval_context_budget_exceeded' })
    }
    messages.push({ role: 'tool', toolCallId: `approval_${row.draftId}`, toolName: row.toolName,
      status: succeeded ? 'done' : 'error', text: text || (succeeded ? '操作已由 host 审批执行并记录回执。' : '审批操作未执行成功。'),
      code: result.code, truncated: result.truncated === true, artifactRefs: refs,
      receipt: result.receipt || null, meta: { approvalDraftId: row.draftId, recoveredRunId: row.runId } })
    artifacts.push(...refs)
  }
  return { uncertain: false, messages, artifacts }
}

module.exports = { approvalRecoveryContext }
