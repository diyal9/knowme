'use strict'

/**
 * Grounding 台账：Evidence / ToolLedger、声明抽取与 OutputGate。
 * 声明正则以 state 为准，禁止在本文件再写一份。
 */

const { formatToolLabelForUser } = require('./agent-grounding-labels')
const {
  newId,
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
  PENDING_OK_RE,
} = require('./agent-grounding-state')

function createEvidenceLedger(seed = {}) {
  return {
    runId: seed.runId || newId('run'),
    entries: Array.isArray(seed.entries) ? seed.entries.slice() : [],
  }
}

function createToolLedger(seed = {}) {
  return {
    calls: Array.isArray(seed.calls) ? seed.calls.slice() : [],
    derivedFacts: Array.isArray(seed.derivedFacts) ? seed.derivedFacts.slice() : [],
  }
}

function digestText(text = '', max = 240) {
  const src = String(text || '').replace(/\s+/g, ' ').trim()
  if (!src) return ''
  return src.length <= max ? src : `${src.slice(0, max)}…`
}

function classifyToolResultQuality(toolName, result = {}) {
  const text = String(result.text || result.preview || '').trim()
  const ok = result.ok !== false
  if (!ok) return { status: 'fail', truncated: false, empty: !text }
  if (!text) return { status: 'empty', truncated: false, empty: true }
  if (result.truncated === true || result.meta?.truncated === true) {
    return { status: 'truncated', truncated: true, empty: false }
  }
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* ignore */ }
  if (parsed && typeof parsed === 'object') {
    const body = String(parsed.body || parsed.content || parsed.plain_text || parsed.summary || '').trim()
    const titleOnly = String(parsed.title || parsed.name || '').trim()
    const thinBody = !body || body.length < 40
    const titleWrapper = thinBody && titleOnly && !parsed.items?.length
    if (titleWrapper) return { status: 'truncated', truncated: true, empty: false, reason: 'title_only' }
    if (!body && !parsed.items?.length) return { status: 'empty', truncated: false, empty: true }
    if (body.length < (Number(result.minChars) || 80)) {
      return { status: 'truncated', truncated: true, empty: false, reason: 'short_body' }
    }
  }
  if (text.length < 40 && /^(title|标题)/i.test(text)) {
    return { status: 'truncated', truncated: true, empty: false, reason: 'thin_text' }
  }
  return { status: 'ok', truncated: false, empty: false }
}

function appendEvidence(ledger, entry = {}) {
  const next = createEvidenceLedger(ledger)
  const normalized = {
    id: entry.id || newId('ev'),
    source: ['tool', 'context', 'user', 'system', 'subrun'].includes(entry.source) ? entry.source : 'system',
    refId: entry.refId || null,
    toolCallId: entry.toolCallId || null,
    status: ['ok', 'fail', 'empty', 'truncated'].includes(entry.status) ? entry.status : 'fail',
    digest: digestText(entry.digest || entry.text || ''),
    provenance: entry.provenance && typeof entry.provenance === 'object' ? { ...entry.provenance } : {},
    rawRef: entry.rawRef || null,
    timestamp: entry.timestamp || new Date().toISOString(),
  }
  next.entries.push(normalized)
  return next
}

function recordToolCall(ledger, call = {}) {
  const next = createToolLedger(ledger)
  next.calls.push({
    id: String(call.id || newId('tc')).slice(0, 160),
    name: String(call.name || 'unknown_tool').slice(0, 120),
    args: call.args && typeof call.args === 'object' ? { ...call.args } : {},
    status: call.status === 'ok' ? 'ok' : (call.status === 'fail' ? 'fail' : (call.ok === false ? 'fail' : 'ok')),
    resultRef: call.resultRef || null,
    error: call.error ? String(call.error).slice(0, 500) : null,
    truncated: call.truncated === true,
    durationMs: Number.isFinite(call.durationMs) ? call.durationMs : null,
  })
  return next
}

function mergeToolResultsIntoLedgers({ toolLedger, evidenceLedger, toolMessages = [] }) {
  let tl = createToolLedger(toolLedger)
  let el = createEvidenceLedger(evidenceLedger)
  for (const item of toolMessages) {
    const quality = classifyToolResultQuality(item.toolName, {
      ok: item.status !== 'error',
      text: item.text,
      preview: item.text,
    })
    tl = recordToolCall(tl, {
      id: item.toolCallId,
      name: item.toolName,
      status: quality.status === 'fail' ? 'fail' : 'ok',
      truncated: quality.truncated,
      durationMs: item.durationMs,
    })
    el = appendEvidence(el, {
      source: 'tool',
      toolCallId: item.toolCallId,
      status: quality.status,
      digest: item.text,
      provenance: { tool: item.toolName, callId: item.toolCallId },
    })
  }
  return { toolLedger: tl, evidenceLedger: el }
}

function hasOkToolCall(toolLedger, toolName) {
  return createToolLedger(toolLedger).calls.some(c => c.name === toolName && c.status === 'ok')
}

function hasOkEvidenceForTool(evidenceLedger, toolName) {
  return createEvidenceLedger(evidenceLedger).entries.some(e =>
    e.status === 'ok' && !['truncated', 'empty', 'fail'].includes(e.status) &&
    (e.provenance?.tool === toolName)
  )
}

function evaluateRequiredTools(taskFrame, toolLedger) {
  const required = taskFrame?.requiredTools || []
  const missing = required.filter(name => !hasOkToolCall(toolLedger, name))
  return { satisfied: missing.length === 0, missing }
}

function evaluateRequiredEvidence(taskFrame, evidenceLedger) {
  const rules = taskFrame?.requiredEvidence || []
  const unmet = []
  for (const rule of rules) {
    const entries = createEvidenceLedger(evidenceLedger).entries.filter(e => {
      if (rule.tool && e.provenance?.tool !== rule.tool) return false
      if (rule.forbidTruncated && (e.status === 'truncated' || e.status === 'empty')) return false
      if (rule.minChars != null && (e.digest || '').length < rule.minChars) return false
      return e.status === 'ok'
    })
    if (!entries.length) unmet.push(rule)
  }
  return { satisfied: unmet.length === 0, unmet }
}

function evaluateCompletionConditions(taskFrame, toolLedger, evidenceLedger) {
  const conditions = taskFrame?.completionConditions || []
  const unmet = []
  for (const cond of conditions) {
    if (cond.type === 'tool_success') {
      if (!hasOkToolCall(toolLedger, cond.tool)) unmet.push(cond)
    } else if (cond.type === 'evidence_present') {
      const ok = createEvidenceLedger(evidenceLedger).entries.some(e =>
        e.status === 'ok' && (!cond.kind || e.provenance?.kind === cond.kind)
      )
      if (!ok) unmet.push(cond)
    }
  }
  return { satisfied: unmet.length === 0, unmet }
}

function extractClaims(text = '') {
  const src = String(text || '')
  const claims = []
  if (EXECUTION_CLAIM_RE.test(src)) {
    claims.push({ type: 'execution', text: src.match(EXECUTION_CLAIM_RE)?.[0] || 'execution' })
  }
  if (EXTERNAL_FACT_RE.test(src)) {
    claims.push({ type: 'external_fact', text: src.match(EXTERNAL_FACT_RE)?.[0] || 'external_fact' })
  }
  return claims
}

function verifyClaims({
  text = '',
  evidenceLedger,
  toolLedger,
  referenceState,
  taskFrame,
} = {}) {
  const claims = extractClaims(text)
  const violations = []
  const tl = createToolLedger(toolLedger)
  const el = createEvidenceLedger(evidenceLedger)
  const tf = taskFrame || referenceState?.taskFrame || null

  const requiredTools = evaluateRequiredTools(tf, tl)
  if (!requiredTools.satisfied) {
    violations.push({
      code: 'missing_required_tools',
      message: `缺少必需工具调用: ${requiredTools.missing.join(', ')}`,
      missingTools: requiredTools.missing,
    })
  }

  const requiredEvidence = evaluateRequiredEvidence(tf, el)
  if (!requiredEvidence.satisfied) {
    violations.push({
      code: 'missing_required_evidence',
      message: 'requiredEvidence 未满足',
      unmet: requiredEvidence.unmet,
    })
  }

  const completion = evaluateCompletionConditions(tf, tl, el)
  if (tf?.completionConditions?.length && !completion.satisfied) {
    violations.push({
      code: 'completion_unmet',
      message: 'completionConditions 未满足',
      unmet: completion.unmet,
    })
  }

  if (EXECUTION_CLAIM_RE.test(text)) {
    const execOk = tl.calls.some(c => c.status === 'ok')
    const readTools = ['feishu.meeting_read', 'feishu.read_doc', 'feishu.get_wiki_node']
    const hasRead = readTools.some(name => hasOkToolCall(tl, name))
    if (!execOk || (/(已读取|读取完成|读取成功)/i.test(text) && !hasRead)) {
      violations.push({ code: 'false_execution_claim', message: '执行态声明无 ToolLedger 支撑' })
    }
  }

  const hasSupportingEvidence = el.entries.some(e => e.status === 'ok' && !e.status.includes?.('truncated'))
  const hasOkEvidence = el.entries.some(e => e.status === 'ok')
  if (EXTERNAL_FACT_RE.test(text) && !hasOkEvidence) {
    if (!PENDING_OK_RE.test(text)) {
      violations.push({ code: 'ungrounded_external_fact', message: '外部事实无 EvidenceLedger 支撑' })
    }
  }

  if (parseNumericSelection(text) && !referenceState?.activeRefId && referenceState?.pendingSelection) {
    violations.push({ code: 'unbound_selection', message: '数字选择未绑定 ReferenceState' })
  }

  const passed = violations.length === 0
  return {
    passed,
    claims,
    violations,
    metadata: {
      evidenceCount: el.entries.length,
      toolCallCount: tl.calls.length,
      hasSupportingEvidence,
    },
  }
}

function buildHonestRefusal(verification, taskFrame) {
  const missingTools = verification.violations.find(v => v.code === 'missing_required_tools')?.missingTools || []
  const tfTools = taskFrame?.requiredTools || []
  const tools = missingTools.length ? missingTools : tfTools
  if (tools.length) {
    const label = formatToolLabelForUser(tools[0])
    return `我还未成功读取所需内容，因此不能给出具体会议/文档细节。\n请先允许我完成「${label}」，或重新选择候选。`
  }
  if (verification.violations.some(v => v.code === 'false_execution_claim')) {
    return '当前还没有成功的工具读取结果，我不能声称「已读取」。请让我先完成读取，或说明需要哪一场会议/文档。'
  }
  if (verification.violations.some(v => v.code === 'ungrounded_external_fact')) {
    return '我还没有拿到可验证的正文证据，因此不能输出具体议题、责任人或日期。请让我先读取来源，或补充更明确的选择。'
  }
  if (verification.violations.some(v => v.code === 'missing_required_evidence')) {
    return '工具返回的内容不足（可能为空或仅标题），不能据此生成具体事实。请让我重新读取完整正文。'
  }
  return '当前证据不足，我需要先完成读取或澄清你的选择后再继续。'
}

function applyOutputGate({ text = '', verification, taskFrame, regenUsed = false } = {}) {
  if (!verification || verification.passed) {
    return {
      allowed: true,
      text: String(text || ''),
      blocked: false,
      regenSuggested: false,
      status: 'verified',
    }
  }
  if (!regenUsed && verification.violations.some(v =>
    ['missing_required_tools', 'false_execution_claim', 'ungrounded_external_fact'].includes(v.code)
  )) {
    return {
      allowed: false,
      text: String(text || ''),
      blocked: true,
      regenSuggested: true,
      status: 'blocked',
      refusal: buildHonestRefusal(verification, taskFrame),
    }
  }
  return {
    allowed: false,
    text: buildHonestRefusal(verification, taskFrame),
    blocked: true,
    regenSuggested: false,
    status: 'blocked',
    refusal: buildHonestRefusal(verification, taskFrame),
  }
}

module.exports = {
  createEvidenceLedger,
  createToolLedger,
  digestText,
  classifyToolResultQuality,
  appendEvidence,
  recordToolCall,
  mergeToolResultsIntoLedgers,
  hasOkToolCall,
  hasOkEvidenceForTool,
  evaluateRequiredTools,
  evaluateRequiredEvidence,
  evaluateCompletionConditions,
  extractClaims,
  verifyClaims,
  buildHonestRefusal,
  applyOutputGate,
}
