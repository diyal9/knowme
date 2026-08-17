'use strict'

/**
 * Feishu grounding adapter — bridges legacy feishu-grounding with runtime ledgers.
 */

const feishuGrounding = require('./feishu-grounding')
const groundingRuntime = require('./agent-grounding-runtime')

function safeJsonParse(text = '') {
  try { return JSON.parse(String(text || '').trim()) } catch { return null }
}

function extractMeetingCandidatesFromToolText(text = '') {
  const json = safeJsonParse(text)
  if (json && Array.isArray(json.candidates)) {
    return json.candidates.map((c, idx) => ({
      id: c.id || `candidate-${idx + 1}`,
      title: c.title || c.name || c.label || `候选 ${idx + 1}`,
      minute_token: c.minute_token || c.minuteToken || '',
      url: c.url || c.open_url || '',
      startTime: c.start_time || c.startTime || c.time || '',
      organizer: c.organizer || c.owner_name || '',
    }))
  }
  if (json && Array.isArray(json.items)) {
    return json.items.map((c, idx) => ({
      id: c.id || `candidate-${idx + 1}`,
      title: c.title || c.name || `候选 ${idx + 1}`,
      minute_token: c.minute_token || c.minuteToken || '',
      url: c.url || '',
      startTime: c.start_time || c.startTime || '',
      organizer: c.organizer || '',
    }))
  }
  return []
}

function applyMeetingCandidatesToReferenceState(referenceState, toolResultText) {
  const candidates = extractMeetingCandidatesFromToolText(toolResultText)
  if (!candidates.length) return referenceState
  const pending = groundingRuntime.meetingCandidatesToPendingSelection(candidates)
  return groundingRuntime.setPendingSelection(referenceState, pending.options, pending.refSetId)
}

function enrichMeetingReadResult(result = {}) {
  const quality = groundingRuntime.classifyToolResultQuality('feishu.meeting_read', result)
  return {
    ...result,
    truncated: quality.truncated,
    empty: quality.empty,
    evidenceStatus: quality.status,
    meta: { ...(result.meta || {}), truncated: quality.truncated, evidenceStatus: quality.status },
  }
}

function buildLegacyPostProcessHint(prompt, toolMessages, fullText, context = {}) {
  return feishuGrounding.buildFeishuGroundingHint(prompt, toolMessages, fullText, context)
}

function resolveUserPromptWithReferenceState(referenceState, userInput, { bindRefId } = {}) {
  const binding = groundingRuntime.bindNumericSelection(referenceState, userInput, { bindRefId })
  if (!binding.bound) {
    if (binding.ambiguous && groundingRuntime.parseNumericSelection(userInput)) {
      return {
        referenceState: binding.state,
        prompt: userInput,
        binding,
        needsClarification: true,
        clarification: '我看到你回复了序号，但当前没有可绑定的候选列表。请先让我展示选项，或直接提供链接/token。',
      }
    }
    return { referenceState: binding.state, prompt: userInput, binding, needsClarification: false }
  }
  const intent = groundingRuntime.buildDeterministicToolIntent(binding.option)
  return {
    referenceState: binding.state,
    prompt: intent?.rewrittenPrompt || userInput,
    binding,
    intent,
    needsClarification: false,
  }
}

function analyzeFeishuToolEvidence(entries = []) {
  return feishuGrounding.analyzeFeishuToolEvidence(entries)
}

module.exports = {
  extractMeetingCandidatesFromToolText,
  applyMeetingCandidatesToReferenceState,
  enrichMeetingReadResult,
  buildLegacyPostProcessHint,
  resolveUserPromptWithReferenceState,
  analyzeFeishuToolEvidence,
}
