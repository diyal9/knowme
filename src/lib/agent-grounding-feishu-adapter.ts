'use strict'

/**
 * Feishu grounding adapter — bridges legacy feishu-grounding with runtime ledgers.
 */

const feishuGrounding = require('./feishu-grounding')
const groundingRuntime = require('./agent-grounding-runtime')
const { mergeExecutionContracts, hasRules, validateExecutionCompletion } = require('./agent-execution-contract')

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

// Legacy GROUND does not run the unified contract gate. Formal execution must
// still validate its declared receipts before an answer can be committed.
// This projects actual tool results, never obligations inferred from prose.
function assertDeclaredExecutionEvidence(contracts, toolMessages = [], session = {}) {
  const contract = mergeExecutionContracts(contracts)
  if (!hasRules(contract)) return
  const messages = Array.isArray(toolMessages) ? toolMessages : []
  const { toolLedger, evidenceLedger } = groundingRuntime.mergeToolResultsIntoLedgers({ toolMessages: messages })
  const assessment = validateExecutionCompletion(contract, {
    executionEvidence: { toolCalls: toolLedger.calls, evidence: evidenceLedger.entries },
    artifactRefs: [
      ...(Array.isArray(session?.run?.artifacts) ? session.run.artifacts : []),
      ...messages.flatMap(item => Array.isArray(item?.artifactRefs) ? item.artifactRefs : []),
    ],
  })
  if (!assessment.ok) {
    const error = new Error(assessment.violations.map(item => item.message).join('；'))
    error.code = 'execution_contract_unmet'
    error.violations = assessment.violations
    throw error
  }
}

function buildChatPostProcessHint(prompt, toolMessages, fullText, context = {}) {
  const intent = feishuGrounding.detectFeishuIntent(prompt)
  if (!intent.mentioned) return ''
  const messages = Array.isArray(toolMessages) ? toolMessages : []
  const readTools = new Set(['feishu.read_doc', 'feishu.get_wiki_node', 'feishu.meeting_read'])
  const reads = messages.filter(item => readTools.has(item?.toolName))
  // A successful transport status is not necessarily a qualified body. Reuse
  // the ledger's quality and document-binding checks for candidate decisions.
  const qualifiedReads = new Set(reads.filter(item => {
    if (item.status !== 'done') return false
    const { evidenceLedger } = groundingRuntime.mergeToolResultsIntoLedgers({ toolMessages: [item] })
    return evidenceLedger.entries.some(entry => entry.status === 'ok')
      && feishuGrounding.analyzeFeishuToolEvidence([item]).hasContentRead
  }))
  const candidate = [...messages].reverse().find(item => (
    item?.toolName === 'feishu.meeting_candidates' && item.status === 'done'
  ))
  const candidateVerified = candidate
    && groundingRuntime.mergeToolResultsIntoLedgers({ toolMessages: [candidate] })
      .evidenceLedger.entries.some(entry => entry.status === 'ok')
    && feishuGrounding.analyzeFeishuToolEvidence([candidate]).hasMeetingCandidates
  const referenceState = context.referenceState || {}
  const pending = referenceState.pendingSelection?.options?.length > 0
  // Legacy mode may not have projected a fresh candidate receipt into state.
  // Its concrete locators can establish the same intermediate selection step.
  const freshCandidates = candidateVerified && !referenceState.activeRefId
    && extractMeetingCandidatesFromToolText(candidate).length > 0
  const awaitingSelection = intent.asksMinutes && !intent.directDocRead
    && (pending || freshCandidates) && reads.length === 0 && qualifiedReads.size === 0
  // An explicit empty discovery result is a terminal fact, not a request to
  // choose. Preserve it without treating missing metadata as a zero-result run.
  const emptyDiscovery = candidateVerified && candidate.meta?.workflow === 'meeting_candidates'
    && Array.isArray(candidate.meta.candidates) && candidate.meta.candidates.length === 0
  if (intent.asksMinutes && reads.length === 0 && emptyDiscovery && String(candidate.text || '').trim()) {
    return candidate.text.trim()
  }
  if (awaitingSelection && candidateVerified && String(candidate?.text || '').trim()) return candidate.text.trim()

  // Presentation-only copies: keep original receipts and session anchors
  // untouched. Do not let the old hint's own candidate branch undo this guard,
  // or let an empty/truncated/wrong-document read masquerade as content.
  const hintMessages = messages.flatMap(item => {
    if (item?.toolName === 'feishu.meeting_candidates') {
      // Preserve failures so auth/timeout diagnostics are not relabeled as a
      // missing call; suppress only successful, no-longer-actionable lists.
      if (item.status === 'error') return [item]
      if (feishuGrounding.analyzeFeishuToolEvidence([item]).hasFailure) return [{ ...item, status: 'error' }]
      return []
    }
    if (readTools.has(item?.toolName) && item.status === 'done' && !qualifiedReads.has(item)) {
      const evidence = feishuGrounding.analyzeFeishuToolEvidence([item])
      return [{ ...item, status: 'error', text: evidence.readNotFound || evidence.hasFailure
        ? item.text : '读取结果证据不足：正文为空、截断、过短或来源与请求不一致。' }]
    }
    return [item]
  })
  return buildLegacyPostProcessHint(prompt, hintMessages, fullText, context)
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
  buildChatPostProcessHint,
  assertDeclaredExecutionEvidence,
  resolveUserPromptWithReferenceState,
  analyzeFeishuToolEvidence,
}
