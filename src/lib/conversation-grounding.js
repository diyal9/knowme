'use strict'

const WORK_RE = /(整理|总结|概括|归纳|摘要|润色|改写|重写|翻译|校对|纠错|提炼|拆解|分析|对比|生成|起草|优化|列出|梳理|规划|设计|检查|评审|复盘|方案|计划|处理|完成)/
const QUESTION_RE = /[？?]|(吗|呢|如何|怎么|怎样|为什么|为何|哪|是不是|能不能|可不可以|什么|多少|几)/
const MATERIAL_RE = /(会议|纪要|文档|文件|材料|笔记|代码|数据|资料|内容|报告|记录|邮件|方案)/
const CONSTRAINT_RE = /(要求|必须|不要|不能|保留|限制|控制|只要|仅需|不超过|格式|语气|面向)/
const RESULT_RE = /(输出|生成|整理成|给我|形成|交付|返回|列出|写成|改成|最终)/

function clean(text, max = 180) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function firstMatch(text, re) {
  const value = clean(text)
  const match = value.match(re)
  if (!match) return ''
  const start = Math.max(0, value.lastIndexOf('。', match.index) + 1)
  return clean(value.slice(start), 140)
}

function isWorkInput(prompt, context = '', task = null) {
  const p = clean(prompt)
  return !!task || !!clean(context) || WORK_RE.test(p) || (p.length > 4 && QUESTION_RE.test(p))
}

function buildGrounding({ prompt = '', displayPrompt = '', context = '', task = null, attachment = '' } = {}) {
  const p = clean(prompt)
  // 用户可见目标优先用短文案（快捷入口），避免把内部长指令 dump 到 UI / grounding 条
  const visible = clean(displayPrompt) || p
  const materialText = clean(context) || clean(attachment)
  const work = isWorkInput(visible, materialText, task) || isWorkInput(p, materialText, task)
  if (!work) {
    return {
      active: false,
      goal: '',
      materials: [],
      constraints: [],
      expectedResult: '',
      title: '日常交流',
      labels: ['交流'],
      text: '',
    }
  }

  const goal = firstMatch(visible, WORK_RE) || visible
  const constraints = []
  // 约束/期望结果仅从可见短文案提取，避免快捷长 prompt 泄漏到「目标」条
  const constraint = firstMatch(visible, CONSTRAINT_RE)
  if (constraint) constraints.push(constraint)
  const expectedResult = firstMatch(visible, RESULT_RE)
  const materials = []
  if (materialText) materials.push(task ? '当前任务材料' : '当前打开的文件或附加材料')
  else if (MATERIAL_RE.test(visible)) materials.push('用户提到的材料（正文未提供）')

  const lines = [
    `目标：${clean(goal, 80) || '用户尚未明确提供'}`,
    `材料：${materials.length ? materials.join('、') : '用户尚未提供'}`,
    `约束：${constraints.length ? constraints.join('；') : '用户尚未提供'}`,
    `期望结果：${expectedResult || '用户尚未明确提供'}`,
  ]
  if (task) {
    if (task.intent || task.name || task.slug) lines[0] = `目标：${clean(task.intent || task.name || task.slug, 80)}`
    if (task.factualBrief) lines.push(`任务进展：${clean(task.factualBrief, 500)}`)
  }
  const labels = deriveLabels(`${visible} ${materialText} ${task?.intent || ''}`)
  return {
    active: true,
    goal: clean(goal, 80),
    materials,
    constraints,
    expectedResult: clean(expectedResult, 80),
    title: deriveTitle(visible, task),
    labels,
    text: lines.join('\n'),
  }
}

function deriveTitle(prompt, task = null) {
  const source = clean(task?.intent || task?.name || task?.slug || prompt, 80)
  if (!source) return '新对话'
  if (/(需求文档|prd|产品需求|验收标准|非目标)/.test(source)) return '起草需求文档'
  if (/(办公文档|通知|汇报|周报|方案同步|会议纪要|邮件)/.test(source)) return '起草办公文档'
  if (/(提纲成稿|按提纲|扩写|根据提纲|大纲成稿)/.test(source)) return '按提纲扩写成稿'
  if (/(排版定稿|统一格式|最终版|可直接发送)/.test(source)) return '整理排版定稿'
  if (/(去 ai 味|去AI味|humanizer|humanize|模板腔|宣传腔)/i.test(source)) return '润色并去 AI 味'
  if (/会议.*(纪要|记录)|纪要/.test(source)) return '整理会议纪要'
  if (/改写|润色|重写/.test(source)) return '改写与润色内容'
  if (/拆解|小任务|任务清单/.test(source)) return '拆解工作任务'
  if (/查询|搜索|查找|知识库|文档/.test(source)) return '查找相关资料'
  if (/代码|编程|实现|修复/.test(source)) return '处理代码问题'
  return source.replace(/^(请|帮我|我想|可以帮我|麻烦你)\s*/, '').slice(0, 28) || '新对话'
}

function deriveLabels(text) {
  const src = clean(text, 400)
  const labels = []
  const add = (label, re) => { if (re.test(src) && !labels.includes(label)) labels.push(label) }
  add('需求文档', /(需求文档|prd|产品需求|验收标准|非目标)/i)
  add('办公文档', /(办公文档|通知|汇报|周报|会议纪要|方案同步|邮件)/i)
  add('提纲成稿', /(提纲成稿|按提纲|扩写|根据提纲|大纲成稿)/i)
  add('排版定稿', /(排版定稿|统一格式|最终版|可直接发送)/i)
  add('去AI味', /(去 ai 味|去AI味|humanizer|humanize|模板腔|宣传腔)/i)
  add('整理', /(整理|总结|归纳|摘要|梳理|会议纪要)/)
  add('写作', /(写作|改写|润色|重写|起草|文案)/)
  add('分析', /(分析|对比|评审|复盘|检查|规划|方案)/)
  add('代码', /(代码|编程|实现|修复|接口|脚本)/)
  add('资料', /(知识库|文档|资料|查询|搜索|检索)/)
  return labels.slice(0, 3).length ? labels.slice(0, 3) : ['工作']
}

function roleGuidance(role) {
  const guidance = {
    general: '先确认要完成的工作和结果形式；信息足够时直接交付，不做泛泛介绍。',
    writing: '优先直接产出可用文档；润色改写前先吸收飞书正文、本地知识库、远程 RAG 与活跃内容源资料；先结构化成稿，再减少模板腔和 AI 套话；保留用户原意、事实和术语，并标注资料引用边界。',
    coding: '先说明影响范围和实现结果，再给出可执行方案；不要编造未提供的代码或运行结果。',
    steward: '先查本地知识库/约定；需要远程资料时用已配置 MCP 的 RAG 工具（如 ragflow_retrieval）。没有命中时明确说明，不要猜测。',
  }
  return guidance[role] || guidance.general
}

function userStatusLabel(title, status = '') {
  const original = String(title || '').trim()
  const text = String(title || '').toLowerCase()
  if (/检索|查找|知识/.test(text)) return status === 'done' ? '资料查找完成' : '正在查找相关资料'
  if (/上下文|准备/.test(text)) return status === 'done' ? '内容整理完成' : '正在整理相关内容'
  if (/模型|生成|回答|完善/.test(text)) return status === 'done' ? '回答已完成' : '正在组织回答'
  if (/工具|操作/.test(text)) return status === 'done' ? '操作已完成' : '正在处理相关操作'
  if (/失败|错误/.test(text)) return '处理未完成'
  if (status === 'done') {
    if (original && !/^(完成|已完成|执行完成|处理完成)$/i.test(original)) return original
    return '执行完成'
  }
  return original || '正在处理'
}

// Use var because the desktop harness may evaluate this browser script more
// than once while reloading an embedded workspace surface.
var groundingApi = { buildGrounding, deriveLabels, deriveTitle, isWorkInput, roleGuidance, userStatusLabel }

if (typeof module === 'object' && module.exports) module.exports = groundingApi
if (typeof window !== 'undefined') window.ConversationGrounding = groundingApi
