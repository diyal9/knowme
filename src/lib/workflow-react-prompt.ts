'use strict'

/**
 * 工作流会话 ReAct 指令与计划种子。只对 taskRef.kind=workflow 生效。
 */

const REACT_INSTRUCTIONS = [
  '你正在工作流对话房。必须走 ReAct：思考目标 → 列出计划 → 逐步执行 → 验收证据。',
  '首轮先用 update_plan 给出至少 3 项 pending 计划（含思考/计划/执行/验收语义），禁止跳过计划宣称完成。',
  '推进时持续 update_plan；计划未完成不得以「全部完成」收束。',
].join('\n')

function shouldForceWorkflowReact(session) {
  if (String(session?.taskRef?.kind || '') === 'workflow') return true
  return Boolean(String(session?.meta?.workflowId || '').trim())
}

function ensureWorkflowPlanSeed(session, agentRun) {
  if (!shouldForceWorkflowReact(session) || !agentRun) return session
  const items = agentRun.normalizePlan(session?.run?.plan)?.items || []
  if (items.length) return session
  return agentRun.replacePlan(session, [
    { title: '思考并澄清本轮目标', status: 'pending' },
    { title: '列出可执行计划', status: 'pending' },
    { title: '按计划执行并记录证据', status: 'pending' },
    { title: '验收交付是否满足目标', status: 'pending' },
  ])
}

module.exports = {
  REACT_INSTRUCTIONS,
  shouldForceWorkflowReact,
  ensureWorkflowPlanSeed,
}
