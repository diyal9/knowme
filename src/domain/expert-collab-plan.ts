type PlanMessage = { role?: string; text?: string }

import { analyzeExpertPlanningReply } from '../shared/expert-planning-contract'
import { classifyExpertTaskComplexity, minimumPlanStepsFor } from './expert-task-complexity'

export interface ExpertTaskPlan {
  goal: string
  deliverables: string[]
  acceptanceCriteria: string[]
  capabilityUse: string[]
  steps: string[]
  risks: string[]
}

export interface ExpertPlanningState {
  phase: 'exploring' | 'clarifying' | 'ready'
  plan: ExpertTaskPlan | null
  missingField: string
  question: string
  example: string
  options: string[]
}

const PLAN_MARKER_RE = /(?:【\s*协作计划\s*】|协作计划|执行计划)/
const STEP_SECTION_RE = /^(?:执行|处理|实施|工作|专业)?步骤\s*[：:]?$/
const STEP_LINE_RE = /^\s*(?:\d{1,2}[.)、：:]|[-*•])\s*(.+?)\s*$/
const SECTION_END_RE = /^(?:风险|注意事项|需要确认|请确认|待确认|范围|交付|验收)\s*[：:]?/
const FIELD_RE = /^(目标|交付物?|产出|验收(?:标准)?|能力(?:调用)?|风险|注意事项)\s*[：:]\s*(.*)$/

function stripLineMarkup(value: string): string {
  return String(value || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`/g, '')
    .trim()
}

function cleanStep(value: string): string {
  return value
    .replace(/[*`#]/g, '')
    .replace(/^步骤\s*\d+\s*[：:]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 从专家最后一条明确的“协作计划”中提取任务相关步骤。
 * 普通澄清选项不会被当成计划，避免用户尚未澄清完就看到确认按钮。
 */
export function extractExpertPlanSteps(messages: PlanMessage[]): string[] {
  return extractExpertPlan(messages)?.steps || []
}

function splitValues(value: string): string[] {
  return String(value || '')
    .split(/[；;]|、|\n/)
    .map((item) => cleanStep(item.replace(/^[-*•]\s*/, '')))
    .filter(Boolean)
}

/** 从最后一条明确计划中提取稳定的任务契约；兼容旧版只含步骤的计划。 */
export function extractExpertPlan(messages: PlanMessage[]): ExpertTaskPlan | null {
  const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant')
  for (const message of assistantMessages) {
    const text = String(message.text || '').trim()
    if (!PLAN_MARKER_RE.test(text)) continue
    const lines = text.split(/\r?\n/).map((line) => line.trim())
    const readableLines = lines.map(stripLineMarkup)
    const planStart = lines.findIndex((line) => PLAN_MARKER_RE.test(line))
    const stepHeading = readableLines.findIndex((line, index) => index >= planStart && STEP_SECTION_RE.test(line))
    const start = stepHeading >= 0 ? stepHeading + 1 : planStart + 1
    const steps: string[] = []
    for (let index = start; index < lines.length; index += 1) {
      const line = readableLines[index]
      if (steps.length && SECTION_END_RE.test(line)) break
      const matched = line.match(STEP_LINE_RE)
      if (!matched) continue
      const step = cleanStep(matched[1])
      if (step && !steps.includes(step)) steps.push(step)
      if (steps.length === 6) break
    }
    if (!steps.length) continue
    const fields: Record<string, string[]> = {}
    for (const line of readableLines.slice(planStart + 1)) {
      const matched = line.match(FIELD_RE)
      if (!matched) continue
      const key = /^(交付物?|产出)$/.test(matched[1])
        ? '交付'
        : /^验收/.test(matched[1])
          ? '验收'
          : /^能力/.test(matched[1])
            ? '能力'
            : matched[1]
      fields[key] = splitValues(matched[2])
    }
    return {
      goal: fields['目标']?.join('；') || '',
      deliverables: fields['交付'] || [],
      acceptanceCriteria: fields['验收'] || [],
      capabilityUse: fields['能力'] || [],
      steps,
      risks: [...(fields['风险'] || []), ...(fields['注意事项'] || [])],
    }
  }
  return null
}

/**
 * 识别用户对已展示计划的简短确认。仅匹配无附加修改的肯定表达，
 * 带有否定、转折或调整诉求的内容仍交给专家继续澄清。
 */
export function isExpertPlanConfirmation(value: unknown): boolean {
  const text = String(value || '').trim().replace(/[\t ]+/g, '').toLowerCase()
  // Questions/quoted instructions are not consent. Do this before discarding
  // punctuation: stripping '?' used to turn "可以？" into approval.
  if (!text || text.length > 96 || /[?？“”"「」]|(?:吗|么|是否|能否|如果|等到|之后|之前)/.test(text)) return false
  if (/(不|别|暂缓|等等|等一下|修改|调整|补充|但是|不过|再说)/.test(text)) return false
  const clauses = text.split(/[，,。.!！、；;：:\r\n]+/).filter(Boolean)
  const approval = /^(?:我)?(?:确认|同意|认可)(?:(?:这个|当前|上述|以上|该)?(?:方案|计划))?(?:(?:并)?(?:开始)?(?:执行|生成|生图))?(?:了|吧)?$/
  const action = /^(?:请|麻烦)?(?:可以)?(?:开始(?:执行|生成|生图)?|执行|生成|生图)(?:了|吧|即可|就行)?$/
  const plannedAction = /^(?:请|麻烦)?(?:就)?按(?:照)?(?:此|这个|上述|以上|当前|该)?(?:方案|计划|建议)(?:(?:开始)?(?:执行|生成|生图|来))?(?:了|吧|即可|就行)?$/
  const simple = /^(?:好的?|可以|没问题|就这样)(?:吧)?$/
  let hasConsent = false
  // Every clause must stay within the displayed plan's consent vocabulary.
  // Unrecognized constraints/new actions remain normal conversation; a leading
  // "确认" must never swallow "先发给张三" or another material change.
  return clauses.every((clause) => {
    if (/^(?:谢谢|辛苦了)$/.test(clause)) return true
    if (!approval.test(clause) && !action.test(clause) && !plannedAction.test(clause) && !simple.test(clause)) return false
    hasConsent = true
    return true
  }) && hasConsent
}

/**
 * 只有满足通用计划契约时才允许离开规划阶段。
 * 专业差异由 Agent/Skill 的能力声明表达，平台不按 expertId 猜测字段。
 */
export function isExpertPlanReady(plan: ExpertTaskPlan | null): boolean {
  if (!plan) return false
  const complexity = classifyExpertTaskComplexity({
    goal: plan.goal,
    deliverables: plan.deliverables,
    requiredTools: plan.capabilityUse,
  })
  if (plan.steps.length < minimumPlanStepsFor(complexity)) return false
  return Boolean(plan.goal.trim())
    && plan.deliverables.length > 0
    && plan.acceptanceCriteria.length > 0
    && (complexity !== 'multi_step' || plan.capabilityUse.length > 0)
}

/**
 * 将专家自然语言回复收敛为稳定的协作状态。界面只消费该对象，不再分别猜测
 * “是否在澄清”和“是否可以确认”；旧会话仍可从可见文本恢复。
 */
export function extractExpertPlanningState(messages: PlanMessage[], expertId: unknown): ExpertPlanningState {
  const assistant = [...messages].reverse().find((message) => message.role === 'assistant' && String(message.text || '').trim())
  // A newer reply supersedes old plan readiness, including new clarification.
  const plan = extractExpertPlan(assistant ? [assistant] : [])
  const text = String(assistant?.text || '').trim()
  const lines = text.split(/\r?\n/).map((line) => stripLineMarkup(line)).filter(Boolean)
  const analysis = analyzeExpertPlanningReply(text)
  const missingField = cleanStep(analysis.missingField)
  const question = cleanStep(analysis.question)
  let questionIndex = -1
  if (question) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (cleanStep(lines[index].replace(/^(?:问题\s*[：:]|\d{1,2}[.)、])\s*/, '')) === question) {
        questionIndex = index
        break
      }
    }
  }
  const exampleLine = lines.find((line) => /(?:可以直接回复|例如|回答示例)/.test(line)) || ''
  const example = cleanStep(exampleLine.replace(/^(?:回答示例|例如|可以直接回复)\s*[：:]?\s*/, ''))
  const options = lines.slice(Math.max(0, questionIndex + 1), questionIndex + 6)
    .map((line) => line.match(/^(?:\d{1,2}[.)、]|[A-Da-d][.)、]|[-*•])\s*(.+)$/)?.[1] || '')
    .map(cleanStep)
    .filter(Boolean)
    .slice(0, 4)
  return {
    phase: analysis.unresolved ? 'clarifying' : isExpertPlanReady(plan) ? 'ready' : 'exploring',
    plan,
    missingField,
    question,
    example,
    options,
  }
}

export function isExpertClarificationAnswerSufficient(value: unknown, state: ExpertPlanningState): boolean {
  const answer = String(value || '').replace(/[\s，,。.!！?？、；;：:]+/g, '')
  if (!answer) return false
  if (/^(?:按专家推荐|使用推荐|默认即可)$/.test(answer)) return true
  if (state.phase !== 'clarifying') return true
  return !/^(?:确认|继续|好的?|可以|没问题|开始|执行|不知道|不清楚)$/.test(answer)
}

export function formatExpertPlanMaterial(plan: ExpertTaskPlan | string[]): string {
  const normalized: ExpertTaskPlan = Array.isArray(plan)
    ? { goal: '', deliverables: [], acceptanceCriteria: [], capabilityUse: [], steps: plan, risks: [] }
    : plan
  return [
    normalized.goal ? `目标：${normalized.goal}` : '',
    normalized.deliverables.length ? `交付：${normalized.deliverables.join('；')}` : '',
    normalized.acceptanceCriteria.length ? `验收：${normalized.acceptanceCriteria.join('；')}` : '',
    normalized.capabilityUse.length ? `能力：${normalized.capabilityUse.join('；')}` : '',
    '执行步骤：',
    ...normalized.steps.slice(0, 6).map((step, index) => `${index + 1}. ${step}`),
    normalized.risks.length ? `风险：${normalized.risks.join('；')}` : '',
  ].filter(Boolean).join('\n')
}
