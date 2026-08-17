import { ASSISTANT_QUICK_COMMANDS } from './agent-quick-commands'

const LEAKED_INSTRUCTION =
  /(第一阶段|第二阶段|不要直接读取正文|不要直接总结|快捷操作执行规则|时间范围以点击时刻为准|feishu\.[a-z_]+|需求文档搭档|办公文档搭档|提纲和要点扩写|排版定稿|去 AI 味处理)/i

export function compactUserShortcutBubbleText(raw = ''): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (!LEAKED_INSTRUCTION.test(text)) return text
  if (/(会议总结|会议纪要|会议记录|meeting_candidates|meeting_read)/i.test(text)) return '会议总结'
  if (/(今日优先级|today_priority)/i.test(text)) return '今日优先级'
  if (/(查文档\/知识库|doc_kb_suggest|知识库空间|最近自己编辑|最近自己阅读)/i.test(text)) return '查文档/知识库'
  if (/(相关的聊天|related_chats|@我)/i.test(text)) return '分析相关聊天'
  if (/(需求梳理|workflow-intake|intake\s*\/\s*ingest|可启动\s*(管线服务|Daemon)\s*工作流)/i.test(text)) return '需求梳理'
  if (/(需求文档搭档|需求文档初稿|非目标|验收标准)/i.test(text)) return '写需求文档'
  if (/(办公文档搭档|通知|汇报|周报|方案同步)/i.test(text)) return '写办公文档'
  if (/(根据我提供的标题|提纲和要点扩写|提纲成稿|大纲成稿)/i.test(text)) return '按提纲成稿'
  if (/(排版定稿|统一标题层级|可直接发送\/评审的定稿)/i.test(text)) return '排版定稿'
  if (/(去 ai 味|去AI味|Humanizer|humanize|AI 痕迹)/i.test(text)) return '润色去 AI 味'
  const known = ASSISTANT_QUICK_COMMANDS.find((item) => item.prompt === text || text.includes(item.prompt.slice(0, 24)))
  return known?.title || text
}
