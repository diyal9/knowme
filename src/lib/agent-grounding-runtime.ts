'use strict'

/**
 * Grounding Runtime — ReferenceState, EvidenceLedger, ToolLedger,
 * ClaimVerifier (L0/L1), OutputGate (fail-closed).
 */

const {
  newId,
  resolveGroundingRuntimeMode,
  createReferenceState,
  normalizeRef,
  normalizePendingSelection,
  normalizeTaskFrame,
  normalizeEvidenceRule,
  normalizeCompletionCondition,
  uniqueStrings,
  normalizeRequiredToolsField,
  isLikelyToolId,
  parseInlineListFromScalar,
  serializeReferenceState,
  deserializeReferenceState,
  setPendingSelection,
  clearPendingSelection,
  setTaskFrame,
  clearStaleOnTaskSwitch,
  parseNumericSelection,
  bindNumericSelection,
  buildDeterministicToolIntent,
  EXECUTION_CLAIM_RE,
  EXTERNAL_FACT_RE,
} = require('./agent-grounding-state')

const { createEvidenceLedger, createToolLedger, digestText, classifyToolResultQuality, appendEvidence, recordToolCall, mergeToolResultsIntoLedgers, hasOkToolCall, hasOkEvidenceForTool, evaluateRequiredTools, evaluateRequiredEvidence, evaluateCompletionConditions, extractClaims, verifyClaims, buildHonestRefusal, applyOutputGate, isVerifiedCandidatePresentation, extractToolSourceIdentity, validateToolResultBinding } = require('./agent-grounding-ledger')

function buildGroundingStatus(verification, { evidenceLedger, toolLedger } = {}) {
  const status = verification?.passed ? 'verified' : 'blocked'
  const el = createEvidenceLedger(evidenceLedger)
  const tl = createToolLedger(toolLedger)
  const { formatViolationForUser } = require('./agent-grounding-labels')
  return {
    status,
    claims: (verification?.claims || []).map(c => ({
      text: c.text,
      type: c.type,
      verified: verification?.passed === true,
      evidenceIds: el.entries.filter(e => e.status === 'ok').map(e => e.id),
    })),
    sources: el.entries.map(e => ({
      tool: e.provenance?.tool || null,
      refId: e.refId || e.provenance?.refId || null,
      status: e.status,
      truncated: e.status === 'truncated',
      digest: e.digest,
    })),
    toolCalls: tl.calls.map(c => ({ name: c.name, status: c.status, truncated: c.truncated })),
    violations: (verification?.violations || []).map(v => ({
      ...v,
      userMessage: formatViolationForUser(v),
    })),
  }
}

function meetingCandidatesToPendingSelection(candidates = [], refSetId) {
  const options = (Array.isArray(candidates) ? candidates : []).map((c, idx) => {
    const minuteToken = c.minute_token || c.minuteToken || ''
    const url = c.url || ''
    const isMinute = Boolean(minuteToken) || /\/minutes\//i.test(String(url))
    return {
      id: c.id || `candidate-${idx + 1}`,
      label: c.title || c.label || `候选 ${idx + 1}`,
      // A Feishu meeting may point at a Smart Minutes page or at the
      // generated docx record. Route by the actual locator instead of
      // assuming every meeting card is a minutes artifact.
      boundTool: isMinute ? 'feishu.meeting_read' : 'feishu.read_doc',
      payload: {
      minute_token: minuteToken,
      url,
      title: c.title || c.label || '',
      startTime: c.startTime || c.time || '',
      organizer: c.organizer || '',
      },
    }
  })
  return normalizePendingSelection({ refSetId: refSetId || newId('meeting'), options })
}

function validateGroundingContract(manifest = {}, rawFrontmatter = {}) {
  const issues = []
  const requiredEvidence = Array.isArray(manifest.requiredEvidence) ? manifest.requiredEvidence : []
  for (const [idx, rule] of requiredEvidence.entries()) {
    if (rule.kind === 'tool_result' && !rule.tool) {
      issues.push({ path: `requiredEvidence[${idx}].tool`, message: 'tool_result 规则需要 tool 字段' })
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawFrontmatter, 'requiredTools')) {
    const raw = rawFrontmatter.requiredTools
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      issues.push({ path: 'requiredTools', message: 'requiredTools 必须是字符串数组' })
    } else if (typeof raw === 'string' && raw.trim() && !raw.trim().startsWith('[')) {
      const v = raw.trim()
      if (/^\d+$/.test(v) || !/^[a-zA-Z0-9_.-]+$/.test(v)) {
        issues.push({ path: 'requiredTools', message: 'requiredTools 格式无效' })
      }
    }
  }
  return { ok: issues.length === 0, issues }
}

function parseSkillGroundingContract(frontmatter = {}) {
  const contract = {
    requiredTools: normalizeRequiredToolsField(frontmatter.requiredTools),
    requiredEvidence: [],
    completionConditions: [],
  }
  const rawEvidence = frontmatter.requiredEvidence
  if (Array.isArray(rawEvidence)) {
    contract.requiredEvidence = rawEvidence.map(normalizeEvidenceRule)
  } else if (rawEvidence && typeof rawEvidence === 'object') {
    contract.requiredEvidence = [normalizeEvidenceRule(rawEvidence)]
  }
  const rawCompletion = frontmatter.completionConditions
  if (Array.isArray(rawCompletion)) {
    contract.completionConditions = rawCompletion.map(normalizeCompletionCondition)
  } else if (typeof rawCompletion === 'string' && rawCompletion.trim()) {
    contract.completionConditions = [normalizeCompletionCondition({ type: rawCompletion.trim() })]
  }
  return contract
}

function mergeGroundingContracts(contracts = []) {
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean)
  if (!list.length) return null

  const merged = {
    skillId: list.map(c => c.skillId).filter(Boolean).join('+') || null,
    requiredTools: [],
    requiredEvidence: [],
    completionConditions: [],
  }

  for (const c of list) {
    merged.requiredTools.push(...(c.requiredTools || []))
  }
  merged.requiredTools = uniqueStrings(merged.requiredTools)

  const evidenceMap = new Map()
  for (const c of list) {
    for (const rule of c.requiredEvidence || []) {
      const key = `${rule.kind}|${rule.tool || ''}`
      const existing = evidenceMap.get(key)
      if (!existing) {
        evidenceMap.set(key, { ...rule })
      } else {
        if (rule.minChars != null) {
          existing.minChars = existing.minChars != null
            ? Math.max(existing.minChars, rule.minChars)
            : rule.minChars
        }
        existing.forbidTruncated = existing.forbidTruncated !== false || rule.forbidTruncated !== false
      }
    }
  }
  merged.requiredEvidence = [...evidenceMap.values()]

  const condMap = new Map()
  for (const c of list) {
    for (const cond of c.completionConditions || []) {
      const key = `${cond.type}|${cond.tool || ''}|${cond.kind || ''}`
      if (!condMap.has(key)) condMap.set(key, cond)
    }
  }
  merged.completionConditions = [...condMap.values()]

  return merged
}

module.exports = {
  resolveGroundingRuntimeMode,
  createReferenceState,
  serializeReferenceState,
  deserializeReferenceState,
  setPendingSelection,
  clearPendingSelection,
  setTaskFrame,
  clearStaleOnTaskSwitch,
  parseNumericSelection,
  bindNumericSelection,
  buildDeterministicToolIntent,
  createEvidenceLedger,
  createToolLedger,
  classifyToolResultQuality,
  appendEvidence,
  recordToolCall,
  mergeToolResultsIntoLedgers,
  evaluateRequiredTools,
  evaluateRequiredEvidence,
  evaluateCompletionConditions,
  extractClaims,
  verifyClaims,
  applyOutputGate,
  isVerifiedCandidatePresentation,
  extractToolSourceIdentity,
  validateToolResultBinding,
  buildGroundingStatus,
  buildHonestRefusal,
  meetingCandidatesToPendingSelection,
  validateGroundingContract,
  parseSkillGroundingContract,
  mergeGroundingContracts,
  normalizeRequiredToolsField,
  EXECUTION_CLAIM_RE,
  EXTERNAL_FACT_RE,
}
