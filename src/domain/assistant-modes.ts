/** 内置助理模式（对齐 f6ad048 availableAssistantModes / fallbackExperts） */

export type AssistantModeId = 'general' | 'steward' | 'writing' | 'coding'

export interface AssistantMode {
  id: AssistantModeId
  name: string
  description: string
  avatar: string
}

export const BUILTIN_ASSISTANT_MODES: AssistantMode[] = [
  { id: 'general', name: '通用办公', description: '处理日常问题、资料整理和工作推进', avatar: 'other/partner' },
  { id: 'steward', name: '知识管家', description: '查询公司知识、整理 Wiki 和知识库', avatar: 'office/knowledge' },
  { id: 'writing', name: '写作专家', description: '润色、改写和结构化办公内容', avatar: 'office/writer' },
  { id: 'coding', name: '研发助手', description: '代码分析、实现方案和研发任务', avatar: 'game/engineer' },
]

export function resolveAssistantModeId(raw: string | undefined | null): AssistantModeId {
  const id = String(raw || '').trim()
  if (id === 'steward' || id === 'writing' || id === 'coding') return id
  return 'general'
}

export function modeSectionMeta(mode: AssistantModeId): string {
  if (mode === 'writing') return '写作与文档'
  if (mode === 'coding') return '研发协作'
  if (mode === 'steward') return '知识检索'
  return '智能办公搭档'
}

export interface EmptyShortcutCard {
  id: string
  title: string
  subtitle: string
  prompt: string
}

const WRITING_PROMPTS = {
  writingRequirementsDoc: '请作为需求文档搭档：根据我提供的目标、背景、约束和要点，直接产出一份可继续评审的需求文档初稿。默认结构包含：背景、目标、范围、非目标、用户场景、核心流程、验收标准、风险与待确认事项。材料不足时最多追问 3 个最关键缺口；若信息已足够，直接交付，不要先讲方法论。',
  writingOfficeDoc: '请作为办公文档搭档：根据我提供的场景和材料，直接写成可发送的办公文稿，适用于通知、汇报、周报、方案同步、会议纪要等日常场景。先判断最合适的文体并按文体组织结构；正文后补一版更简洁的发送版。',
  writingOutlineDraft: '请根据我提供的标题、提纲和要点扩写成完整文稿。优先补齐段落衔接、例子占位、结尾收束和行动项，不要编造我未提供的事实或数据；缺关键事实时用“待补”明确标注。',
  writingFinalize: '请把我提供的草稿整理成可直接发送/评审的定稿：统一标题层级、段落节奏、列表样式、结论、行动项和附录说明；必要时将散乱内容重排为更清晰的结构。',
  codingExplain: '请解释当前问题相关的代码：先说明模块职责、关键流程和依赖关系，再列出风险点与可改进项。若信息不足，明确缺少哪些文件或报错。',
  codingFix: '请帮我修复这个问题：先定位根因，再给出最小改动方案和验证步骤。优先可落地修改，不要编造未提供的运行结果。',
  codingImplement: '请为当前需求给出实现方案：输出影响范围、模块拆分、数据流、关键接口和验收标准，必要时给出分步实施计划。',
  codingDraftPatch: '请生成一份可执行的代码修改草案：按文件列出改动点，说明每处改动目的，并给出回归验证清单。',
}

export const MODE_EMPTY_SHORTCUTS: Record<AssistantModeId, EmptyShortcutCard[]> = {
  general: [],
  steward: [],
  writing: [
    { id: 'writingRequirementsDoc', title: '写需求文档', subtitle: '背景、范围、验收标准、风险', prompt: WRITING_PROMPTS.writingRequirementsDoc },
    { id: 'writingOfficeDoc', title: '写办公文档', subtitle: '通知、汇报、周报、纪要等成稿', prompt: WRITING_PROMPTS.writingOfficeDoc },
    { id: 'writingOutlineDraft', title: '按提纲成稿', subtitle: '提纲扩写为完整段落与过渡', prompt: WRITING_PROMPTS.writingOutlineDraft },
    { id: 'writingFinalize', title: '排版定稿', subtitle: '统一结构、列表、行动项与可发送版本', prompt: WRITING_PROMPTS.writingFinalize },
  ],
  coding: [
    { id: 'codingExplain', title: '解释代码', subtitle: '职责、流程、风险与改进', prompt: WRITING_PROMPTS.codingExplain },
    { id: 'codingFix', title: '修复报错', subtitle: '根因定位 + 最小修复方案', prompt: WRITING_PROMPTS.codingFix },
    { id: 'codingImplement', title: '实现方案', subtitle: '范围、拆分、接口与验收', prompt: WRITING_PROMPTS.codingImplement },
    { id: 'codingDraftPatch', title: '生成改动草案', subtitle: '按文件列改动并附回归清单', prompt: WRITING_PROMPTS.codingDraftPatch },
  ],
}

export interface FollowUpPreset {
  label: string
  prompt: string
}

export const MODE_FOLLOWUP_PRESETS: Record<AssistantModeId, FollowUpPreset[]> = {
  general: [
    { label: '继续追问细节', prompt: '请继续细化上面的结论，补充关键依据与可执行下一步。' },
    { label: '整理成行动项', prompt: '请把上面的内容整理为可执行行动项清单（含优先级、负责人、截止时间占位）。' },
    { label: '生成同步消息', prompt: '请把上面的结论改写成一段可直接发给团队的同步消息，语气专业简洁。' },
  ],
  steward: [
    { label: '补充知识依据', prompt: '请基于已有结果补充知识依据：来源、适用边界、可能冲突约定。' },
    { label: '转成知识卡片', prompt: '请把当前结论整理成知识卡片：背景、结论、适用范围、注意事项。' },
    { label: '继续检索资料', prompt: '请查文档/知识库：点击后直接执行。先检查飞书 user 授权；已授权则立刻调用 feishu.doc_kb_suggest，列出我的个人文件夹、可见知识库空间，以及依据个人记忆可能需要的文件（≤5）、最近自己编辑的文件（≤5）、最近自己阅读的文件（≤5）。' },
  ],
  writing: [
    { label: '改成正式版', prompt: '请把上面的内容改成正式公文语气，保持信息完整并提升可读性。' },
    { label: '排版定稿', prompt: WRITING_PROMPTS.writingFinalize },
    { label: '继续去 AI 味', prompt: '请对我提供的文本做“去 AI 味”处理：重点消减空泛拔高、宣传腔、三段排比、过度“此外/至关重要/赋能/深度”等表达，保持原意、事实、术语和结构不变。' },
  ],
  coding: [
    { label: '补充边界条件', prompt: '请继续补充实现的边界条件、异常路径和回归风险点。' },
    { label: '给最小改动方案', prompt: WRITING_PROMPTS.codingFix },
    { label: '输出验收清单', prompt: '请基于上面的方案给出可执行验收清单（功能、异常、回归、性能）。' },
  ],
}

export function emptyShortcutIcon(taskId = ''): string {
  const id = String(taskId || '').toLowerCase()
  if (/meeting|summary|writing|draft|polish|requirement|document/.test(id)) return 'note'
  if (/priority|schedule|workflow|release|implement/.test(id)) return 'automation'
  if (/doc|knowledge|wiki|search|explain/.test(id)) return 'bookOpen'
  if (/chat|message|related/.test(id)) return 'chat'
  if (/code|debug|fix|review/.test(id)) return 'code'
  if (/skill|capability/.test(id)) return 'capabilityStack'
  return 'optimize'
}
