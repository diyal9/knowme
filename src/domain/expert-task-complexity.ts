export type ExpertTaskComplexity = 'simple' | 'single_step' | 'multi_step'

const TOOL_OR_SIDE_EFFECT_RE = /(?:写入|新建|修改|删除|移动|复制|发送|发布|导出|调用|连接器|工具|文件|网页|网站|代码|脚本|部署|同步|分析数据|生成图片|create_file|write_file|apply_patch|http|mcp|cli)/i
const MULTI_OUTPUT_RE = /(?:以及|并且|同时|多个|多份|流程|阶段|步骤|先.+再|然后)/

/**
 * Host-side routing hint for planning depth. It is deliberately conservative:
 * uncertainty or side effects increase the depth, while it never grants tools
 * or marks a task complete. The planner may choose a deeper plan at any time.
 */
export function classifyExpertTaskComplexity(input: {
  goal?: unknown
  deliverables?: unknown[]
  requiredTools?: unknown[]
  requiredSkills?: unknown[]
  materials?: unknown[]
}): ExpertTaskComplexity {
  const goal = String(input.goal || '').trim()
  const deliverables = (input.deliverables || []).map(value => String(value || '').trim()).filter(Boolean)
  const requiredTools = (input.requiredTools || []).map(value => String(value || '').trim()).filter(Boolean)
  const requiredSkills = (input.requiredSkills || []).map(value => String(value || '').trim()).filter(Boolean)
  const materialCount = Array.isArray(input.materials) ? input.materials.length : 0
  const signal = [goal, ...deliverables, ...requiredTools, ...requiredSkills].join(' ')
  if (requiredTools.length || requiredSkills.length > 1 || deliverables.length > 1 || materialCount > 3 || MULTI_OUTPUT_RE.test(signal)) {
    return 'multi_step'
  }
  if (TOOL_OR_SIDE_EFFECT_RE.test(signal)) return 'single_step'
  return 'simple'
}

export function minimumPlanStepsFor(complexity: ExpertTaskComplexity): number {
  return complexity === 'multi_step' ? 2 : 1
}
