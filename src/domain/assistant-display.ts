const EMOJI_UNIT = String.raw`(?:\p{Regional_Indicator}{2}|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Emoji}\uFE0F|\p{Emoji_Modifier})`
const EMOJI_CLUSTER = `${EMOJI_UNIT}(?:\u200d${EMOJI_UNIT})*`
const LEADING_EMOJI_RE = new RegExp(String.raw`^\s*(?:${EMOJI_CLUSTER})+(?=\s|$)\s*`, 'u')
const TRAILING_EMOJI_RE = new RegExp(String.raw`\s*(?:${EMOJI_CLUSTER})+\s*$`, 'u')
const EMOJI_ONLY_RE = new RegExp(String.raw`^\s*(?:${EMOJI_CLUSTER})+(?:\s*(?:${EMOJI_CLUSTER})+)*\s*$`, 'u')
const TABLE_CELL_EMOJI_RE = new RegExp(String.raw`(\|\s*)(?:${EMOJI_CLUSTER})+(?=\s|$)\s*`, 'gu')
const STRUCTURAL_PREFIX_RE = /^(\s*(?:#{1,6}\s+|\d+[.)、]\s+|[-*+]\s+)?)(.*)$/u

function normalizeAssistantDisplayLine(line: string): string {
  const match = String(line ?? '').match(STRUCTURAL_PREFIX_RE)
  if (!match) return String(line ?? '')
  const prefix = match[1]
  let body = match[2]
  if (EMOJI_ONLY_RE.test(body)) return ''
  body = body.replace(LEADING_EMOJI_RE, '')
  body = body.replace(TRAILING_EMOJI_RE, '')
  body = body.replace(TABLE_CELL_EMOJI_RE, '$1')
  if (!body.trim()) return ''
  return `${prefix}${body}`
}

/** 只整理 assistant 展示层的装饰符号；引用、代码块和用户原文保持不变。 */
export function normalizeAssistantDisplay(text: string): string {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const output: string[] = []
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      output.push(line)
      inFence = !inFence
      continue
    }
    if (inFence || /^\s*>/.test(line)) {
      output.push(line)
      continue
    }
    output.push(normalizeAssistantDisplayLine(line))
  }
  return output.join('\n')
    .replace(/(^|\n)\s*```[^\n]*\n\s*```(?=\n|$)/gm, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
