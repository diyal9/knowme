'use strict'

const { stripLeadingAssistantIdentity } = require('../domain/assistant-identity')

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

/**
 * Identity is prompt metadata, not a greeting template. Some models still
 * echo the configured name as a standalone first line; remove only that
 * unambiguous wrapper and preserve mentions inside the actual answer.
 */
function normalizeAssistantOutput(text, options = {}) {
  const source = String(text ?? '')
    .replace(/\r\n/g, '\n')
    // Connector envelopes occasionally contain escaped line breaks in a
    // successful doc read. Decode them before rendering so the model cannot
    // present the payload as a single malformed paragraph.
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
  const identityStripped = stripLeadingAssistantIdentity(source, options.displayName)
  const lines = identityStripped.split('\n')
  const output = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*(?:工具原始结果|工具返回结果|原始工具结果)\s*[:：]?\s*$/i.test(line)) continue
    // ReAct is an internal execution protocol, never user-facing content.
    // Some models still echo these labels despite the tool-message contract;
    // remove only the protocol markers and retain the factual observation
    // body, which remains subject to the grounding gate.
    const reactLabel = line.match(/^\s*(Thought|Act|Action|Observation|Observe)\s*:\s*(.*)$/i)
    if (reactLabel) {
      // Thought/Act are private deliberation and tool routing; discard them.
      // Keep only the factual body after Observe/Observation.
      if (/^(?:Thought|Act|Action)$/i.test(reactLabel[1])) continue
      const cleaned = String(reactLabel[2] || '')
      if (cleaned.trim() && !/^(?:调用工具|工具返回成功)/i.test(cleaned.trim())) output.push(cleaned)
      continue
    }
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

/** 最终展示前的轻量门禁：拦截明显的工具协议泄漏，不参与模型生成。 */
function enforceAssistantOutputGate(text, options = {}) {
  const source = String(text ?? '').trim()
  if (!source || options.allowRawJson === true) return { text, blocked: false }
  if (!(source.startsWith('{') && source.endsWith('}'))) return { text, blocked: false }
  let parsed
  try { parsed = JSON.parse(source) } catch { return { text, blocked: false } }
  const hasToolEnvelope = parsed && typeof parsed === 'object' && (
    Object.prototype.hasOwnProperty.call(parsed, 'ok')
    || Object.prototype.hasOwnProperty.call(parsed, 'identity')
    || Object.prototype.hasOwnProperty.call(parsed, 'page_token')
    || (parsed.data && typeof parsed.data === 'object' && (
      Object.prototype.hasOwnProperty.call(parsed.data, 'results')
      || Object.prototype.hasOwnProperty.call(parsed.data, 'page_token')
      || Object.prototype.hasOwnProperty.call(parsed.data, 'shown_records_cacheKey')
    ))
  )
  if (!hasToolEnvelope) return { text, blocked: false }
  const results = Array.isArray(parsed?.data?.results) ? parsed.data.results : []
  return {
    text: results.length ? `已获取到 ${results.length} 条结果，正在整理可读信息。` : '已获取到结构化结果，但当前未生成可读摘要。',
    blocked: true,
  }
}

return {
  normalizeAssistantOutput,
  normalizeGeneratedLine,
  enforceAssistantOutputGate,
  stripLeadingIdentityLine: stripLeadingAssistantIdentity,
}
})
