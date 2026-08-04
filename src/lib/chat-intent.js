'use strict'

/**
 * chat-intent — 本地启发式意图分级（零网络/零模型成本）。
 *
 * 目标（工作伙伴定位）：闲聊/短确认走轻量、干活才带知识与检索。
 * 分三级：
 *   - chat      问候/致谢/极短闲聊 → 仅底座人格 + 近期历史
 *   - assist    工作动词 / 有打开文件正文 / 实质问题 → KB 摘要 + 技能
 *   - retrieval steward / 明确知识意图 / /技能 / @引用 → 追加 wiki 检索
 *
 * 判定异常一律回退 assist（安全默认，不丢能力）。
 */

// 明确的知识检索意图（希望查库/引用出处）
const KNOWLEDGE_RE =
  /(知识库|我的笔记|笔记里|笔记中|文档里|文档中|资料里|资料中|依据|出处|来源|检索|查阅|查找|查询|搜索|搜一下|查一下|找一下|找找)/

// 工作动词（对给定材料做处理）
const WORK_VERB_RE =
  /(总结|概括|归纳|摘要|整理|润色|改写|重写|续写|扩写|精简|翻译|校对|纠错|提炼|拆解|拆分|分析|对比|比较|生成|起草|写|回复|回信|优化|列出|梳理|规划|设计|检查|评审|复盘|建议|方案|计划)/

// 飞书连接器意图：须至少走 assist，否则 main.js 会关闭 tools，模型只能谎称「无法访问飞书」
const FEISHU_RE = /(飞书|feishu|lark)/i
const FEISHU_WORK_RE =
  /(文档|知识库|wiki|纪要|会议记录|多维表格|bitable|搜索|查找|查询|获取|拉取|读取|打开|列出|浏览|总结|整理)/

// 实质性问题标记
const QUESTION_RE = /[？?]|(吗|呢|如何|怎么|怎样|为什么|为何|哪|是不是|能不能|可不可以|什么|多少|几)/

// @引用（后接中英文/数字）
const AT_REF_RE = /@[\w\u4e00-\u9fff]/

const VERY_SHORT_CHARS = 4

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {boolean} [opts.hasNoteContext] 是否存在打开文件正文
 * @param {string[]} [opts.slashRefs] 已解析的 /技能 引用
 * @param {string} [opts.role] 会话角色（steward 强制走检索）
 * @returns {'chat'|'assist'|'retrieval'}
 */
function classifyIntent({ prompt = '', hasNoteContext = false, slashRefs = [], role = '' } = {}) {
  try {
    const p = String(prompt || '').trim()
    const refs = Array.isArray(slashRefs) ? slashRefs.filter(Boolean) : []
    const isSteward = String(role || '') === 'steward'
    const hasSlash = refs.length > 0
    const hasAt = AT_REF_RE.test(p)
    const knowledgeIntent = KNOWLEDGE_RE.test(p)
    const feishuWork = FEISHU_RE.test(p) && FEISHU_WORK_RE.test(p)

    if (isSteward || hasSlash || hasAt || knowledgeIntent) return 'retrieval'

    const workVerb = WORK_VERB_RE.test(p)
    if (workVerb || hasNoteContext || feishuWork) return 'assist'

    const veryShort = p.length <= VERY_SHORT_CHARS
    if (!veryShort && QUESTION_RE.test(p)) return 'assist'

    return 'chat'
  } catch {
    return 'assist'
  }
}

module.exports = { classifyIntent, VERY_SHORT_CHARS }
