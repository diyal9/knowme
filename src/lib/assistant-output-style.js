'use strict'

;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AssistantOutputStyle = api
})(typeof window !== 'undefined' ? window : null, function () {

/**
 * Assistant output style normalization.
 *
 * This is intentionally narrower than "remove all emoji": user messages,
 * quoted source, and code must retain their original content. Only obvious
 * decorative emoji positions in generated prose are normalized.
 */
const EMOJI_UNIT = String.raw`(?:\p{Regional_Indicator}{2}|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Emoji}\uFE0F|\p{Emoji_Modifier})`
const EMOJI_CLUSTER = `${EMOJI_UNIT}(?:\u200d${EMOJI_UNIT})*`
const LEADING_EMOJI_RE = new RegExp(
  String.raw`^\s*(?:${EMOJI_CLUSTER})+(?=\s|$)\s*`,
  'u',
)
const TRAILING_EMOJI_RE = new RegExp(
  String.raw`\s*(?:${EMOJI_CLUSTER})+\s*$`,
  'u',
)
const EMOJI_ONLY_RE = new RegExp(
  String.raw`^\s*(?:${EMOJI_CLUSTER})+(?:\s*(?:${EMOJI_CLUSTER})+)*\s*$`,
  'u',
)
const STRUCTURAL_PREFIX_RE = /^(\s*(?:#{1,6}\s+|\d+[.)、]\s+|[-*+]\s+)?)(.*)$/u

function normalizeGeneratedLine(line) {
  const match = String(line ?? '').match(STRUCTURAL_PREFIX_RE)
  if (!match) return String(line ?? '')
  const prefix = match[1]
  let body = match[2]

  if (EMOJI_ONLY_RE.test(body)) return ''
  body = body.replace(LEADING_EMOJI_RE, '')
  body = body.replace(TRAILING_EMOJI_RE, '')
  if (!body.trim()) return ''
  return `${prefix}${body}`
}

function normalizeAssistantOutput(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n')
  const lines = source.split('\n')
  const output = []
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
    output.push(normalizeGeneratedLine(line))
  }

  return output.join('\n')
}

return {
  normalizeAssistantOutput,
  normalizeGeneratedLine,
}
})
