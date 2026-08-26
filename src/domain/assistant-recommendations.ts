import type { AssistantModeId, FollowUpPreset } from './assistant-modes'
import { MODE_FOLLOWUP_PRESETS } from './assistant-modes'

export type IntelligentRecommendation = FollowUpPreset & {
  description: string
  reason?: string
  badges?: string[]
}

type RecommendationRule = {
  test: RegExp
  items: IntelligentRecommendation[]
}

const RULES: RecommendationRule[] = [
  {
    test: /(待确认|工作主题|匹配专家|匹配.*工作流|下一步|输出结论)/i,
    items: [
      { label: '确认主题范围', description: '围绕当前输出提炼目标、依据和待确认项', prompt: '请基于刚才的输出，提炼需要我确认的主题范围、关键依据和缺失信息；只引用当前上下文已有内容，不要补造事实。' },
      { label: '匹配专家或工作流', description: '根据当前结论推荐合适的后续处理能力', prompt: '请基于刚才的输出内容，推荐最适合的专家、Skill 或工作流，并说明匹配依据、预计产出和开始前需要确认的事项；不要直接执行。' },
    ],
  },
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

/**
 * 空白会话的主题入口：以低门槛的回顾和澄清问题作为工作入口。
 * 这些只是建议，不代表系统已经读取了对应数据；每个 prompt 都要求先确认范围和可用来源。
 */
export function buildMemoryTopicRecommendations(memoryHints: string[]): IntelligentRecommendation[] {
  const hints = memoryHints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
  const focus = hints[0]?.slice(0, 36)
  const contextNote = focus ? `结合「${focus}」` : '结合最近的工作资料'
  return [
    {
      label: '回顾昨天的工作',
      description: `${contextNote}盘点事项、进展和未完成项`,
      prompt: '我想盘点昨天做了哪些事。请先确认“昨天”对应的日期，以及你可以读取的会话、会议、文档或本地资料范围；确认后只基于可验证内容列出事项、进展、未完成项和需要我补充的信息，不要猜测。',
    },
    {
      label: '提炼近期工作结论',
      description: '从已有记录中区分结论、依据和待确认项',
      prompt: '请帮我提炼近期工作的结论。先确认时间范围和需要覆盖的资料来源；再只根据可验证内容整理结论、依据、影响、待确认事项，并区分事实与推断。',
    },
    {
      label: '盘点最近的会议',
      description: '整理会议主题、结论、待办和风险',
      prompt: '请帮我盘点最近的会议。先确认时间范围，以及是否只读取已授权的会议来源；确认后列出会议主题、关键结论、待办负责人和截止时间、风险与需要跟进的事项。只有读到会议正文或妙记内容后才总结，不要根据标题猜测。',
    },
    {
      label: '确认今天的重点',
      description: '结合近期记录澄清今天最重要的 1 至 3 件事',
      prompt: '请帮我确认今天的工作重点。先询问我希望覆盖的时间范围、资料来源和优先级约束；再结合可验证的近期记录提出不超过 3 个重点，并为每个重点说明依据、下一步和待确认信息。',
    },
  ]
}

/** 右栏能力来源：只展示有记忆依据的习惯/判断，不使用固定办公入口。 */
export function buildMemoryCapabilityRecommendations(memoryHints: string[]): IntelligentRecommendation[] {
  const hints = memoryHints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 2)
  if (!hints.length) return []
  const focus = hints[0].slice(0, 44)
  return [
    {
      label: '沿用我的工作习惯',
      description: `基于「${focus}」组织下一步`,
      prompt: '请根据我的全局记忆和当前上下文，沿用我已确认的工作习惯组织下一步；先列出采用的记忆依据，遇到冲突或缺失信息先向我确认。',
      badges: ['基于记忆'],
    },
    {
      label: '优先匹配相关能力',
      description: '从已授权 Skill、专家和工作流中选择',
      prompt: '请根据当前上下文和我的全局记忆，只从已授权的 Skill、专家或工作流中推荐最匹配的能力；说明匹配依据、预计产出和权限状态，不要编造能力。',
      badges: ['已授权', '需确认'],
    },
  ]
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
