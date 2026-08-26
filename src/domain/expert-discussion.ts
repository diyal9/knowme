import { expertArtifactBody } from './expert-artifact'
import type { AgentRunArtifact, WorkbenchTask } from '../shared/api'

export type ExpertDiscussionMode = 'expert-planning' | 'expert-discussion'

export interface ExpertDiscussionContext {
  taskId: string
  goal: string
  status: string
  resultSummary: string
  deliverables: {
    id: string
    title: string
    type: string
    version: number
    acceptanceStatus: string
    excerpt: string
  }[]
  recentEvents: { type: string; summary: string }[]
}

function compactText(value: unknown, limit: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

export function buildExpertDiscussionContext(
  task: WorkbenchTask,
  artifacts: Record<string, AgentRunArtifact>,
): ExpertDiscussionContext {
  return {
    taskId: String(task.id || ''),
    goal: compactText(task.brief?.goal || task.goal || task.title, 500),
    status: String(task.status || ''),
    resultSummary: compactText(task.resultSummary, 1200),
    deliverables: (task.deliverables || []).slice(-6).map((item) => {
      const ref = String(item.artifactRef || '')
      const artifact = ref ? artifacts[ref] : undefined
      return {
        id: String(item.deliverableId || artifact?.id || ''),
        title: compactText(item.title || artifact?.title || '专业成果', 100),
        type: String(item.type || artifact?.type || 'document'),
        version: Number(item.version || 1),
        acceptanceStatus: String(item.acceptanceStatus || 'pending'),
        excerpt: compactText(expertArtifactBody(artifact, task.resultSummary), 1600),
      }
    }),
    recentEvents: (task.events || []).slice(-5).map((item) => ({
      type: String(item.type || ''),
      summary: compactText(item.summary, 240),
    })).filter((item) => item.type || item.summary),
  }
}

export function formatExpertDiscussionContext(context?: ExpertDiscussionContext): string {
  if (!context) return '当前任务信息仍在同步，请基于用户本轮描述回答，不要猜测任务事实。'
  const deliverables = context.deliverables.length
    ? context.deliverables.map((item, index) => [
        `${index + 1}. ${item.title}（${item.type}，第 ${item.version} 版，${item.acceptanceStatus}）`,
        item.excerpt ? `   内容摘要：${item.excerpt}` : '',
      ].filter(Boolean).join('\n')).join('\n')
    : '暂无成果。'
  const events = context.recentEvents.length
    ? context.recentEvents.map((item) => `- ${item.summary || item.type}`).join('\n')
    : '暂无关键事件。'
  return [
    `任务 ID：${context.taskId}`,
    `目标：${context.goal || '未填写'}`,
    `状态：${context.status || '未知'}`,
    `结果摘要：${context.resultSummary || '暂无'}`,
    '当前成果：',
    deliverables,
    '最近进展：',
    events,
  ].join('\n')
}

export function isAmbiguousExpertDiscussion(value: unknown): boolean {
  const text = String(value || '').trim()
  if (!text) return true
  if (/^[?？!！。.，,、…]+$/.test(text)) return true
  return /^(什么意思|然后呢|怎么说|怎么办|接下来|继续)$/.test(text)
}

export function buildAmbiguousExpertReply(context?: ExpertDiscussionContext): string {
  const status = String(context?.status || '')
  if (status === 'needs_input') {
    return '你想先处理哪一项？\n\n1. 查看还缺什么信息\n2. 补充材料或限制条件\n3. 说明为什么需要补充\n4. 重新梳理任务目标'
  }
  if (['failed', 'cancelled'].includes(status)) {
    return '你想先了解哪一部分？\n\n1. 查看未完成原因\n2. 查看已经产出的内容\n3. 调整要求后重试\n4. 改用其他专家或工作流'
  }
  if (context?.deliverables?.length) {
    return '你想继续看哪一部分？\n\n1. 查看成果内容\n2. 说明结论和依据\n3. 核对验收标准\n4. 提出修改意见'
  }
  return '你想从哪一步继续？\n\n1. 说明当前进展\n2. 澄清任务目标\n3. 补充材料\n4. 调整计划'
}

export function buildExpertDiscussionPrompt(input: {
  expertName: string
  userText: string
  context?: ExpertDiscussionContext
  planning: boolean
}): string {
  if (input.planning) {
    return `[专家协作·规划阶段]\n你是${input.expertName}。当前只做需求澄清和计划，不开始正式执行，也不调用工具。采用苏格拉底式提问：先复述理解，每次只问一个最关键问题，尽量给出 2-4 个结构化选项和推荐项。信息不足时继续提问，不要提前给计划。信息足够时必须按以下短格式输出，步骤应针对本次任务动态规划为 3-6 步，不要使用“专业处理、自验证、质量复盘”等通用步骤占位：\n【协作计划】\n目标：一句话\n交付：具体成果\n验收：可判断的标准\n执行步骤：\n1. 任务相关步骤\n2. 任务相关步骤\n3. 任务相关步骤\n风险：必要时填写\n最后请用户确认计划。\n\n用户补充：${input.userText}`
  }
  return `[专家协作·成果讨论]\n你是${input.expertName}。以下“当前任务事实”来自已保存的正式任务与成果，是本轮回答的唯一事实依据。你只负责解释成果、回答问题、收集补充和整理修改意见；不要调用工具，不要重新执行任务，不要声称完成了新的操作。若事实不足，直接说明缺少哪一项，不要编造。回答应简短、专业、结论优先；需要用户选择时最多给 4 项。\n\n当前任务事实：\n${formatExpertDiscussionContext(input.context)}\n\n用户消息：${input.userText}`
}
