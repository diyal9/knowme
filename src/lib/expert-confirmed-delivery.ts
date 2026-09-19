'use strict'

// A plan promising runnable source/files cannot be executed as an answer-only
// contract. This check does not grant tools or infer a provider from a skill name.
const FILE_DELIVERY = /代码包|源码包|源代码文件|网页文件|完整前端代码|HTML\s*\/\s*CSS\s*\/\s*JS\s*代码|代码结构|页面代码|前端源码|(?:可运行|可部署).{0,12}(?:网页|网站|程序|应用)/i
const FILE_PRODUCTION_GOAL = /(?:生成|制作|开发|实现|搭建|创建|编写).{0,28}(?:落地页|宣传页|活动页|网页|网站|Web\s*系统|前端页面|管理后台|数据看板)/i

function requiresFileDelivery(task) {
  const promised = Array.isArray(task?.brief?.plan?.deliverables) ? task.brief.plan.deliverables : []
  const goals = [task?.brief?.goal, task?.brief?.plan?.goal, task?.goal].filter(Boolean).join('\n')
  return promised.some(item => FILE_DELIVERY.test(String(item || ''))) || FILE_PRODUCTION_GOAL.test(goals)
}

function confirmedDeliveryIssues(task, outputSpec = {}) {
  if (!requiresFileDelivery(task)) return []
  // A separate answer summary must not block a plan that already declares a
  // real file deliverable. Its own execution/evidence gates remain mandatory.
  const contracts = [outputSpec, ...(task?.brief?.deliverables || [])]
  if (contracts.some(spec => (spec.requiredTools || []).length > 0 && (
    Number(spec.minArtifacts) > 0 || (spec.requiredArtifacts || []).length > 0
    || (spec.completionConditions || []).some(item => item?.type === 'artifact_present')
  ))) return []
  return [{
    id: '文件交付能力', code: 'execution_contract_missing',
    message: '已确认计划要求交付代码或网页文件，但当前执行路径尚未配置必需的执行工具和文件成果验收条件。任务尚未执行；请为该 Agent 配置可用的文件开发能力，或将计划改为代码建议。仅重新执行无法补齐这些能力。',
  }]
}

module.exports = { confirmedDeliveryIssues, requiresFileDelivery }
