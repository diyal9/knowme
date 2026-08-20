import type { AssistantModeId, FollowUpPreset } from './assistant-modes'
import { MODE_FOLLOWUP_PRESETS } from './assistant-modes'

export type IntelligentRecommendation = FollowUpPreset & {
  description: string
  reason?: string
}

type RecommendationRule = {
  test: RegExp
  items: IntelligentRecommendation[]
}

const RULES: RecommendationRule[] = [
  {
    test: /(需求|目标|为什么|不清楚|澄清|想法|问题)/i,
    items: [
      { label: '苏格拉底提问', description: '用关键问题澄清真正目标和约束', prompt: '请用苏格拉底提问法，提出不超过 3 个最关键的问题，帮助我澄清当前目标、约束和成功标准。' },
      { label: '第一性原理', description: '回到目标、事实和约束重新判断', prompt: '请用第一性原理分析当前问题：先拆出目标、基本事实和硬约束，再给出可验证的判断。' },
    ],
  },
  {
    test: /(方案|选型|比较|取舍|决策|路线)/i,
    items: [
      { label: '方案对比', description: '从收益、成本、风险和依赖做决策比较', prompt: '请对当前方案做结构化对比：收益、成本、风险、依赖、实施难度，并给出推荐结论。' },
      { label: '反向检查', description: '从失败和延期角度找出薄弱点', prompt: '请反向检查当前方案：假设它最终失败，列出最可能的原因、影响和提前验证方式。' },
    ],
  },
  {
    test: /(研发|代码|报错|接口|技术|版本|开发|测试)/i,
    items: [
      { label: '假设—验证', description: '按根因假设和验证步骤排查问题', prompt: '请用假设—验证方法排查当前研发问题：列出可能根因、验证步骤和最小修复路径。' },
      { label: '验收清单', description: '生成可执行的功能、异常和回归检查项', prompt: '请基于当前研发内容生成验收清单，覆盖正常流程、异常路径、回归风险和性能边界。' },
    ],
  },
  {
    test: /(会议|纪要|讨论|同步|团队|行动项|待办)/i,
    items: [
      { label: '整理行动项', description: '提取负责人、时间点、依赖和下一步', prompt: '请把当前内容整理为行动项清单，包含事项、负责人、截止时间、依赖和下一步；缺失信息明确标注待确认。' },
      { label: '生成同步稿', description: '按结论优先方式生成团队同步消息', prompt: '请按结论优先、简洁专业的方式，把当前内容改写成可直接发给团队的同步消息。' },
    ],
  },
  {
    test: /(资料|文档|知识库|历史|依据|来源|参考)/i,
    items: [
      { label: '查历史方案', description: '检索知识库中的相似结论和差异', prompt: '请检索与当前问题相关的历史方案或知识库内容，先列出相似点、差异和可能冲突，再给出建议。' },
      { label: '沉淀知识卡片', description: '将稳定结论整理为可复用知识', prompt: '请判断当前内容哪些适合长期沉淀，并整理为知识卡片：背景、结论、适用范围和注意事项。' },
    ],
  },
]

const MODE_FALLBACK: Record<AssistantModeId, IntelligentRecommendation[]> = {
  general: [
    { label: '拆成行动项', description: '把当前结论变成下一步任务', prompt: '请把上面的内容整理为可执行行动项清单（含优先级、负责人、截止时间占位）。' },
    { label: '补充风险', description: '检查遗漏、依赖和阻塞点', prompt: '请补充当前内容中的风险、依赖、待确认事项和建议下一步。' },
    { label: '第一性原理', description: '回到目标、事实和约束重新判断', prompt: '请用第一性原理分析当前问题：先拆出目标、基本事实和硬约束，再给出可验证的判断。' },
    { label: '结论先行', description: '先给结论，再补充必要依据', prompt: '请按结论先行的方式重排当前内容，再补充必要依据和行动项。' },
  ],
  steward: [
    { label: '查知识依据', description: '结合知识库补充来源和边界', prompt: '请基于已有结果补充知识依据、来源、适用边界和可能冲突约定。' },
    { label: '整理知识卡片', description: '将结论整理为可复用知识', prompt: '请把当前结论整理成知识卡片：背景、结论、适用范围、注意事项。' },
  ],
  writing: [
    { label: '改成正式版', description: '统一语气、结构和表达', prompt: '请把上面的内容改成正式、简洁、可直接发送的版本，保持事实完整。' },
    { label: '结论先行', description: '先给结论，再补充依据', prompt: '请按结论先行的方式重排当前内容，再补充必要依据和行动项。' },
  ],
  coding: [
    { label: '补充边界条件', description: '检查异常路径和回归风险', prompt: '请继续补充当前实现的边界条件、异常路径和回归风险点。' },
    { label: '输出验收清单', description: '形成可执行的验证步骤', prompt: '请基于上面的方案给出可执行验收清单（功能、异常、回归、性能）。' },
  ],
}

export function buildIntelligentRecommendations(
  body: string,
  modeId: AssistantModeId,
  context: { memoryHints?: string[]; userInput?: string } = {},
): IntelligentRecommendation[] {
  const text = `${String(context.userInput || '').trim()}\n${String(body || '').trim()}`
  const matched = RULES.find((rule) => rule.test.test(text))?.items || MODE_FALLBACK[modeId] || MODE_FALLBACK.general
  const memoryReason = context.memoryHints?.find(Boolean)
  return matched.slice(0, 4).map((item) => ({ ...item, ...(memoryReason ? { reason: memoryReason } : {}) }))
}

export function hasDynamicRecommendations(body: string): boolean {
  return RULES.some((rule) => rule.test.test(String(body || '')))
}

/** 对话结束区只允许真实的后续操作，不展示方法论入口。 */
export function buildConversationOperations(
  body: string,
  userInput = '',
): IntelligentRecommendation[] {
  // 已废弃：正文关键词不能证明用户需要某个操作。可操作建议必须来自
  // 模型明确返回并通过 structuredUi 校验的 suggestion，不允许前端猜测。
  void body
  void userInput
  return []
}

// Keep the old presets available to callers that need a strict compatibility fallback.
export function fallbackRecommendations(modeId: AssistantModeId): IntelligentRecommendation[] {
  return (MODE_FOLLOWUP_PRESETS[modeId] || MODE_FOLLOWUP_PRESETS.general).slice(0, 3).map((item) => ({
    ...item,
    description: '继续推进当前工作',
  }))
}
