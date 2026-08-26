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

// Kept in the shared binding for compatibility with the grounding split
// contract; explicit uncertainty is intentionally checked locally below.
void PENDING_OK_RE

// Search/candidate tools locate sources; they are not authoritative evidence
// for concrete facts such as owners, dates, conclusions or action items.
// Requiring a subsequent read (or a purpose-built data tool) prevents a
// plausible search snippet from being promoted into a fabricated conclusion.
const DISCOVERY_TOOL_RE = /(?:^|[._-])(search|candidate(?:s)?|suggest(?:ion)?|lookup|find)(?:$|[._-])/i

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

function parseResultObject(text = '') {
  try {
    const parsed = JSON.parse(String(text || '').trim())
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function collectSourceIdentity(value, out = {}) {
  if (!value || typeof value !== 'object') return out
  const keys = ['doc_token', 'document_token', 'minute_token', 'wiki_token', 'token', 'url', 'source_url', 'document_url']
  for (const key of keys) {
    const val = String(value[key] || '').trim()
    if (val) out[key] = val
  }
  for (const key of ['source', 'document', 'doc', 'data', 'meta', 'result']) {
    if (value[key] && typeof value[key] === 'object') collectSourceIdentity(value[key], out)
  }
  return out
}

function extractToolSourceIdentity(args = {}, text = '') {
  const expected = collectSourceIdentity(args)
  const actual = collectSourceIdentity(parseResultObject(text) || {})
  return { expected, actual }
}

function validateToolResultBinding(args = {}, text = '') {
  const { expected, actual } = extractToolSourceIdentity(args, text)
  const expectedValues = Object.values(expected).filter(Boolean)
  const actualValues = Object.values(actual).filter(Boolean)
  if (!expectedValues.length || !actualValues.length) return { matched: true, expected, actual }
  const matched = expectedValues.some(wanted => actualValues.some(found =>
    found === wanted || found.includes(wanted) || wanted.includes(found)
  ))
  return { matched, expected, actual, mismatch: !matched }
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
    // Import/verification tools return structured contracts (tokens, counts,
    // id maps, or verification objects), not a document body. Treat a
    // successful structured response as usable evidence instead of
    // misclassifying it as "short body" / truncated content.
    const structuredImportResult = /^(?:preview_external_project|design_external_workflow_import|import_external_project|verify_imported_workflow)$/.test(String(toolName || ''))
      && parsed.ok !== false
      && Boolean(parsed.previewToken || parsed.planToken || parsed.counts || parsed.idMaps || parsed.verification || parsed.plan || parsed.preview)
    if (structuredImportResult) return { status: 'ok', truncated: false, empty: false }
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
    const binding = validateToolResultBinding(item.args || {}, item.text)
    const boundStatus = binding.mismatch ? 'fail' : quality.status
    tl = recordToolCall(tl, {
      id: item.toolCallId,
      name: item.toolName,
      status: boundStatus === 'fail' ? 'fail' : 'ok',
      truncated: quality.truncated || binding.mismatch === true,
      durationMs: item.durationMs,
    })
    el = appendEvidence(el, {
      source: 'tool',
      toolCallId: item.toolCallId,
      status: boundStatus,
      digest: item.text,
      provenance: {
        tool: item.toolName,
        callId: item.toolCallId,
        ...(Object.keys(binding.expected).length ? { expectedSource: binding.expected } : {}),
        ...(Object.keys(binding.actual).length ? { actualSource: binding.actual } : {}),
        ...(binding.mismatch ? { bindingStatus: 'mismatch' } : {}),
      },
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

// A discovery result is not evidence for meeting conclusions, owners or dates,
// but it is valid evidence for the narrow intermediate response that presents
// the returned candidates and asks the user to select one. Without this
// distinction the output gate replaces a real candidate list with a generic
// "no正文证据" refusal, breaking the deterministic meeting workflow.
function isVerifiedCandidatePresentation(text = '', toolLedger) {
  const src = String(text || '').trim()
  if (!src) return false
  const hasCandidateCall = hasOkToolCall(toolLedger, 'feishu.meeting_candidates')
  if (!hasCandidateCall) return false
  return /(?:候选|会议记录|智能纪要|回复\s*序号|选择(?:一场|第)|minute[_ ]?token|最近\s*\d+\s*(?:个)?自然日)/i.test(src)
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

const EXECUTION_TOOL_FAMILIES = [
  { claim: /(已(?:经)?导入|imported)/i, tool: /(import|ingest)/i, label: '导入' },
  { claim: /(已(?:经)?安装|installed)/i, tool: /(install|import)/i, label: '安装' },
  { claim: /(已(?:经)?发送)/i, tool: /(send|message|mail)/i, label: '发送' },
  { claim: /(已(?:经)?发布|published)/i, tool: /(publish|release|deploy)/i, label: '发布' },
  { claim: /(已(?:经)?删除|deleted)/i, tool: /(delete|remove)/i, label: '删除' },
  { claim: /(已(?:经)?修改(?:文件|代码)|已(?:经)?写入|已(?:经)?保存)/i, tool: /(write|update|patch|edit|save)/i, label: '写入' },
  { claim: /(已(?:经)?运行(?:测试|脚本|命令)|tests? passed)/i, tool: /(test|run|shell|python|process|command)/i, label: '运行' },
]

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
    for (const family of EXECUTION_TOOL_FAMILIES) {
      if (!family.claim.test(text)) continue
      const supported = tl.calls.some(call => call.status === 'ok' && family.tool.test(String(call.name || '')))
      if (!supported) {
        violations.push({
          code: 'unsupported_execution_claim',
          message: `${family.label}声明没有对应的成功工具证据`,
        })
      }
    }
  }

  const hasSupportingEvidence = el.entries.some(e =>
    e.status === 'ok' && !e.status.includes?.('truncated') && !DISCOVERY_TOOL_RE.test(String(e.provenance?.tool || ''))
  )
  const hasOkEvidence = el.entries.some(e => e.status === 'ok')
  const sourceMismatch = el.entries.some(e => e.provenance?.bindingStatus === 'mismatch')
  if (sourceMismatch) {
    violations.push({
      code: 'source_mismatch',
      message: '工具返回内容与用户指定的文档或资源不一致',
    })
  }
  const candidatePresentation = isVerifiedCandidatePresentation(text, tl)
  if (EXTERNAL_FACT_RE.test(text) && !hasSupportingEvidence && !candidatePresentation) {
    // Planning language alone ("下一步" / "我会") must not launder a
    // fabricated fact. Only an explicit uncertainty/refusal can pass without
    // supporting evidence.
    const explicitUncertainty = /(无法(?:确认|核实|读取)|不能(?:确认|据此)|尚未(?:读取|找到|确认)|未读取到|缺少(?:正文|证据)|证据不足|请(?:提供|补充).*(?:链接|token|正文))/i.test(text)
    if (!explicitUncertainty) {
      violations.push({ code: 'ungrounded_external_fact', message: '具体事实没有正文或权威数据证据支撑' })
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
  if (verification.violations.some(v => v.code === 'source_mismatch')) {
    return '工具返回的内容与您指定的文档或资源不一致。为避免误答，我不会使用这份内容；请核对链接/token 后重试。'
  }
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
  isVerifiedCandidatePresentation,
  extractToolSourceIdentity,
  validateToolResultBinding,
}
