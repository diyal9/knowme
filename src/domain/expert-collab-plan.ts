type PlanMessage = { role?: string; text?: string }

const PLAN_MARKER_RE = /(?:【\s*协作计划\s*】|协作计划|执行计划)/
const STEP_SECTION_RE = /^(?:执行|处理|实施|工作|专业)?步骤\s*[：:]?$/
const STEP_LINE_RE = /^\s*(?:\d{1,2}[.)、：:]|[-*•])\s*(.+?)\s*$/
const SECTION_END_RE = /^(?:风险|注意事项|需要确认|请确认|待确认|范围|交付|验收)\s*[：:]?/

function cleanStep(value: string): string {
  return value
    .replace(/[*_`#]/g, '')
    .replace(/^步骤\s*\d+\s*[：:]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 从专家最后一条明确的“协作计划”中提取任务相关步骤。
 * 普通澄清选项不会被当成计划，避免用户尚未澄清完就看到确认按钮。
 */
export function extractExpertPlanSteps(messages: PlanMessage[]): string[] {
  const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant')
  for (const message of assistantMessages) {
    const text = String(message.text || '').trim()
    if (!PLAN_MARKER_RE.test(text)) continue
    const lines = text.split(/\r?\n/).map((line) => line.trim())
    const planStart = lines.findIndex((line) => PLAN_MARKER_RE.test(line))
    const stepHeading = lines.findIndex((line, index) => index >= planStart && STEP_SECTION_RE.test(line))
    const start = stepHeading >= 0 ? stepHeading + 1 : planStart + 1
    const steps: string[] = []
    for (let index = start; index < lines.length; index += 1) {
      const line = lines[index]
      if (steps.length && SECTION_END_RE.test(line)) break
      const matched = line.match(STEP_LINE_RE)
      if (!matched) continue
      const step = cleanStep(matched[1])
      if (step && !steps.includes(step)) steps.push(step)
      if (steps.length === 6) break
    }
    if (steps.length >= 2) return steps
  }
  return []
}

export function formatExpertPlanMaterial(steps: string[]): string {
  return steps.slice(0, 6).map((step, index) => `${index + 1}. ${step}`).join('\n')
}
