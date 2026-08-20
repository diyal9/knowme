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
  if (text && typeof text === 'object') {
    const meta = text.meta && typeof text.meta === 'object' ? text.meta : text
    const lists = [meta.candidates, meta.items, meta.data?.candidates, meta.data?.items]
    for (const list of lists) {
      if (Array.isArray(list) && list.length) {
        return list.map((c, idx) => ({
          id: c.id || `candidate-${idx + 1}`,
          title: c.title || c.name || c.label || `候选 ${idx + 1}`,
          minute_token: c.minute_token || c.minuteToken || '',
          url: c.url || c.open_url || '',
          startTime: c.start_time || c.startTime || c.time || '',
          organizer: c.organizer || c.owner_name || '',
        })).filter(item => item.minute_token || item.url)
      }
    }
    return []
  }
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

function resolveUserPromptWithReferenceState(referenceState, userInput, { bindRefId, allowMeetingRecovery = false } = {}) {
  const binding = groundingRuntime.bindNumericSelection(referenceState, userInput, { bindRefId })
  if (!binding.bound) {
    if (binding.ambiguous && groundingRuntime.parseNumericSelection(userInput)) {
      const requiredTools = referenceState?.taskFrame?.requiredTools || []
      const canRecoverMeetings = allowMeetingRecovery || requiredTools.includes('feishu.meeting_candidates')
      if (canRecoverMeetings) {
        const index = groundingRuntime.parseNumericSelection(userInput)
        return {
          referenceState: binding.state,
          prompt: `我选择第${index}条会议。候选状态缺失，请先重新调用 \`feishu.meeting_candidates\`（优先 days=3；必要时扩展到 days=7），再按序号读取第${index}条。不要编造候选或会议正文。`,
          binding,
          needsClarification: false,
          selfHealing: true,
        }
      }
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
