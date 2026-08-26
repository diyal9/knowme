/** 助理空态快捷卡 + Ctrl+K 菜单共用；提示词由产品统一维护，配置页只读展示。 */
export const ASSISTANT_QUICK_COMMANDS = [
  {
    id: 'meetingSummary',
    title: '会议总结',
    subtitle: '为我总结最近三天的会议',
    prompt: '总结我最近 3 天参加的会议。先检索并展示可验证的会议候选卡片；不要凭标题或元数据直接总结。等我选中会议后，调用 feishu.meeting_read 读取对应妙记或会议纪要正文，再输出议题、结论、待办（负责人和时间）、风险与下一步。读取失败时说明真实原因，不得编造内容。',
  },
  {
    id: 'todayPriority',
    title: '今日优先级',
    subtitle: '基于飞书日程/待办直接出 Top3',
    prompt: '整理我今天的优先事项。先读取飞书日程、未完成待办和 @我 消息，再按影响与时限给出最多 3 项；每项包含理由、预计耗时和第一步。没有事实依据时不要猜；信息为空时最多追问 1 个问题。',
  },
  {
    id: 'docKbSuggest',
    title: '查文档/知识库',
    subtitle: '文件夹·记忆推荐·最近编辑/阅读',
    prompt: '查找与我相关的文档和知识库。先读取当前授权范围并检索，按个人文件夹、知识库、最近编辑、最近阅读分组列出最多 5 条可访问结果。先给清单，不读正文、不编造；我选定后再深入读取。',
  },
  {
    id: 'relatedChats',
    title: '分析跟我相关的聊天',
    subtitle: '今天：私聊/群聊主题与 @我',
    prompt: '分析今天与我相关的飞书私聊和群聊。读取授权消息，优先列出 @我 和未读内容，再整理待回应事项、风险与下一步；只引用可验证的消息主题，读取失败时说明原因，不得编造。不要调用会议或文档读取。',
  },
] as const

export type AssistantQuickCommand = (typeof ASSISTANT_QUICK_COMMANDS)[number]

/**
 * 伙伴首页只提供意图入口，不直接承诺执行长程任务。
 * 复杂工作由后续匹配到的专家/工作流接管。
 */
export const COMPANION_HOME_RECOMMENDATIONS = [
  {
    id: 'companion-work-review',
    title: '回顾近期工作',
    subtitle: '从当前上下文找出重点与下一步',
    prompt: '请先理解我想回顾近期工作的意图，结合我的记忆和当前上下文，推荐最合适的专家或工作流，并说明推荐理由与预计产出；先给方案，不要直接执行。',
  },
  {
    id: 'companion-expert-match',
    title: '匹配合适能力',
    subtitle: '根据我的目标推荐专家或工作流',
    prompt: '请理解我当前想完成的工作，结合我的岗位、习惯和上下文，推荐最合适的技能、专家或工作流；说明为什么匹配、需要哪些资料，以及开始前需要我确认什么。',
  },
] as const

export const COMPANION_HOME_COMMON = [
  {
    id: 'companion-knowledge-route',
    title: '查找和整理资料',
    subtitle: '匹配知识检索能力，先确认范围',
    prompt: '我想查找或整理工作资料。请先判断需要哪种知识检索技能或专家，结合我的记忆和当前上下文给出推荐方案；不要直接读取或编造内容，等我确认后再执行。',
  },
  {
    id: 'companion-information-route',
    title: '分析相关信息',
    subtitle: '从对话和资料中识别待处理事项',
    prompt: '我想分析与当前工作相关的信息。请先理解范围并推荐合适的专家或工作流，说明依据、权限和预计产出；不要在方案确认前直接执行。',
  },
] as const

export type ConfiguredQuickAction = {
  id: string
  title: string
  subtitle: string
  prompt: string
  skillRef?: string
}

export function parseConfiguredQuickActions(raw: unknown): ConfiguredQuickAction[] {
  try {
    const items = JSON.parse(String(raw || ''))
    if (!Array.isArray(items)) return []
    return items.slice(0, 4).map((item) => {
      const id = String(item?.id || '').trim()
      const skillRef = String(item?.skillRef || '').trim() || undefined
      const builtin = ASSISTANT_QUICK_COMMANDS.find((command) => command.id === id)
      return {
        id,
        title: String(item?.title || builtin?.title || '').trim(),
        subtitle: String(item?.subtitle || builtin?.subtitle || '').trim(),
        // Built-in actions are product-owned. This also migrates older saved
        // prompts so every entry point uses the same grounded wording.
        prompt: skillRef ? '' : String(builtin?.prompt || item?.prompt || '').trim(),
        skillRef,
      }
    }).filter((item) => item.id && item.title && (item.prompt || item.skillRef))
  } catch {
    return []
  }
}

export function serializeConfiguredQuickActions(items: ConfiguredQuickAction[]): string {
  return JSON.stringify(items.slice(0, 4).map(({ id, title, subtitle, prompt, skillRef }) => ({ id, title, subtitle, prompt, ...(skillRef ? { skillRef } : {}) })))
}
