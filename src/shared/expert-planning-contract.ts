export interface ExpertPlanningReplyAnalysis {
  hasPlan: boolean
  unresolved: boolean
  missingField: string
  question: string
  requestsInput: boolean
}

const PLAN_MARKER_RE = /(?:【\s*协作计划\s*】|协作计划|执行计划)/
const CONFIRMATION_QUESTION_RE = /^(?:请)?(?:确认是否按(?:此|上述|以上|本次|该|这个)?计划执行|是否(?:同意|确认)(?:上述|以上|本次|该|这个)?计划|是否按(?:此|上述|以上|本次|该|这个)?计划执行)[?？]$/

function cleanLine(value: unknown): string {
  return String(value || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`/g, '')
    .trim()
}

/**
 * Host-wide interpretation of an expert planning reply. Unresolved input is
 * authoritative even when the model also emitted a syntactically complete plan.
 */
export function analyzeExpertPlanningReply(value: unknown): ExpertPlanningReplyAnalysis {
  const text = String(value || '').trim()
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean)
  const explicitMissing = lines
    .map(line => line.match(/^(?:还缺|缺少|需要补充)\s*[：:]\s*(.+)/)?.[1])
    .find(Boolean) || ''
  const requestsInput = lines.some(line => (
    /(?:请|需要|还需|仍需)(?:你|您|用户)?(?:先|继续|进一步)?补充/.test(line)
    || /若(?:同意|确认)[^。；;]*[，,]\s*(?:请|还需|需要)补充/.test(line)
  ) && !/(?:无需|不需要|不用)补充/.test(line))
  let question = ''
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index].replace(/^(?:问题\s*[：:]|\d{1,2}[.)、])\s*/, '')
    if (!/[?？]$/.test(candidate) || CONFIRMATION_QUESTION_RE.test(candidate)) continue
    question = candidate
    break
  }
  return {
    hasPlan: PLAN_MARKER_RE.test(text),
    unresolved: Boolean(explicitMissing || requestsInput || question),
    missingField: cleanLine(explicitMissing || (requestsInput ? '关键信息' : '')),
    question: cleanLine(question),
    requestsInput,
  }
}

