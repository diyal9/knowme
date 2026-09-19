'use strict'

/**
 * 工作流会话 ReAct 指令与计划种子。只对 taskRef.kind=workflow 生效。
 */

const REACT_INSTRUCTIONS = [
  '你正在工作流对话房。按任务复杂度使用 ReAct：明确目标 → 必要时列计划 → 逐步执行 → 验收证据。',
  '简单且可一次完成的任务使用 1–2 个可验证步骤；多阶段、有依赖或高风险任务使用 3–6 个 pending 步骤。禁止为了满足数量加入空泛占位步骤。',
  '推进时持续 update_plan；计划未完成不得以「全部完成」收束。',
].join('\n')

function classifyWorkflowComplexity(session = {}, prompt = '') {
  const text = String(
    prompt || session?.goal || session?.taskGoal || session?.intent || session?.meta?.goal || '',
  ).trim()
  if (!text) return 'standard'
  if (session?.meta?.workflowComplexity === 'complex') return 'complex'
  if (session?.meta?.workflowComplexity === 'simple') return 'simple'
  const complexSignals = /多个|批量|端到端|全流程|依赖|并行|迁移|重构|发布|部署|验收|审计|风险|multi|batch|end[- ]to[- ]end|migrat|refactor|deploy|audit/i
  if (text.length > 180 || complexSignals.test(text)) return 'complex'
  return text.length <= 60 ? 'simple' : 'standard'
}

function resolveWorkflowReactInstructions(session = {}, prompt = '') {
  const complexity = classifyWorkflowComplexity(session, prompt)
  const policy = complexity === 'simple'
    ? '本轮属于简单任务：计划保持 1–2 个可验证步骤，信息充分时直接执行。'
    : complexity === 'complex'
      ? '本轮属于复杂任务：先列出 3–6 个包含依赖、风险和验收的任务相关步骤。'
      : '根据实际依赖选择 2–4 个任务相关步骤。'
  return `${REACT_INSTRUCTIONS}\n${policy}`
}

function shouldForceWorkflowReact(session) {
  if (String(session?.taskRef?.kind || '') === 'workflow') return true
  return Boolean(String(session?.meta?.workflowId || '').trim())
}

function ensureWorkflowPlanSeed(session, agentRun) {
  if (!shouldForceWorkflowReact(session) || !agentRun) return session
  const items = agentRun.normalizePlan(session?.run?.plan)?.items || []
  if (items.length) return session
  const complexity = classifyWorkflowComplexity(session)
  const seed = complexity === 'simple' ? [
    { title: '完成当前任务并记录结果', status: 'pending' },
    { title: '核对结果是否满足目标', status: 'pending' },
  ] : [
    { title: '思考并澄清本轮目标', status: 'pending' },
    { title: '列出可执行计划', status: 'pending' },
    { title: '按计划执行并记录证据', status: 'pending' },
    { title: '验收交付是否满足目标', status: 'pending' },
  ]
  return agentRun.replacePlan(session, seed)
}

module.exports = {
  REACT_INSTRUCTIONS,
  classifyWorkflowComplexity,
  resolveWorkflowReactInstructions,
  shouldForceWorkflowReact,
  ensureWorkflowPlanSeed,
}
