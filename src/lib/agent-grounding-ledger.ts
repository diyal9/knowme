'use strict'

/**
 * Grounding 台账：Evidence / ToolLedger、声明抽取与 OutputGate。
 * 声明正则以 state 为准，禁止在本文件再写一份。
 */

const { formatToolLabelForUser } = require('./agent-grounding-labels')
const { checkProvidedFieldClaims, executionClaimText } = require('./agent-claim-source-check')
const { explicitSourceIds } = require('./agent-source-citations')
const { toolSourceContent } = require('./tool-source-content')
const { matchesRequiredTool } = require('./agent-tool-requirements')
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
const CONTENT_RETRIEVAL_TOOLS = new Set(['search_knowledge', 'fabric_search', 'kb_query'])

function isDiscoveryTool(toolName) {
  const name = String(toolName || '').trim()
  return DISCOVERY_TOOL_RE.test(name) && !CONTENT_RETRIEVAL_TOOLS.has(name)
}

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
    if (parsed.ok === false || parsed.isError === true) return { status: 'fail', truncated: false, empty: false }
    // A tool result need not be a document. Arrays, measurements, receipts and
    // structured data are valid evidence regardless of the tool/expert name.
    if (Array.isArray(parsed)) return { status: parsed.length ? 'ok' : 'empty', truncated: false, empty: !parsed.length }
    const body = String(parsed.body || parsed.content || parsed.plain_text || parsed.summary || '').trim()
    const titleOnly = String(parsed.title || parsed.name || '').trim()
    const thinBody = !body || body.length < 40
    const titleWrapper = thinBody && titleOnly && !parsed.items?.length
    if (titleWrapper) return { status: 'truncated', truncated: true, empty: false, reason: 'title_only' }
    const metadataKeys = new Set(['ok', 'isError', 'status', 'code', 'message', 'title', 'name', 'meta',
      'query', 'durationMs', 'elapsedMs', 'requestId'])
    const resultLists = ['results', 'items', 'hits', 'chunks', 'records', 'rows']
      .filter(key => Array.isArray(parsed[key]))
    if (resultLists.length && resultLists.every(key => parsed[key].length === 0)) {
      // A count of zero alongside empty result lists is response metadata,
      // not source content. Standalone numeric measurements remain valid.
      if (parsed.total === 0) metadataKeys.add('total')
      if (parsed.count === 0) metadataKeys.add('count')
    }
    const structuredData = Object.entries(parsed).some(([key, value]) => !metadataKeys.has(key)
      && value != null && value !== '' && (!Array.isArray(value) || value.length > 0)
      && (typeof value !== 'object' || Object.keys(value).length > 0))
    if (!body) return { status: structuredData ? 'ok' : 'empty', truncated: false, empty: !structuredData }
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
    effects: Array.isArray(call.effects) ? call.effects.filter(effect => effect && typeof effect.type === 'string') : [],
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
      truncated: item.truncated === true,
      meta: item.meta,
    })
    const binding = validateToolResultBinding(item.args || {}, item.text)
    const boundStatus = binding.mismatch ? 'fail' : quality.status
    tl = recordToolCall(tl, {
      id: item.toolCallId,
      name: item.toolName,
      status: boundStatus === 'fail' ? 'fail' : 'ok',
      truncated: quality.truncated || binding.mismatch === true,
      durationMs: item.durationMs,
      args: item.args,
      // Receipts come from the executed adapter, never from model arguments or
      // answer text. A save receipt must identify a returned artifact.
      effects: (Array.isArray(item.receipt?.effects) ? item.receipt.effects : []).filter(effect =>
        effect?.type !== 'save' || (item.artifactRefs || []).some(artifact =>
          artifact.id === effect.target && Boolean(artifact.targetPath || artifact.path || artifact.url))),
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
  const calls = createToolLedger(toolLedger).calls
  const missing = required.filter(name => !calls.some(call => call.status === 'ok' && matchesRequiredTool(call.name, name)))
  return { satisfied: missing.length === 0, missing }
}

function evaluateRequiredEvidence(taskFrame, evidenceLedger) {
  const rules = taskFrame?.requiredEvidence || []
  const unmet = []
  for (const rule of rules) {
    const entries = createEvidenceLedger(evidenceLedger).entries.filter(e => {
      if (rule.tool && !matchesRequiredTool(e.provenance?.tool, rule.tool)) return false
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
      const calls = createToolLedger(toolLedger).calls
      if (!calls.some(call => call.status === 'ok' && matchesRequiredTool(call.name, cond.tool))) unmet.push(cond)
    } else if (cond.type === 'evidence_present') {
      const ok = createEvidenceLedger(evidenceLedger).entries.some(e =>
        e.status === 'ok' && (!cond.kind || e.provenance?.kind === cond.kind)
      )
      if (!ok) unmet.push(cond)
    }
  }
  return { satisfied: unmet.length === 0, unmet }
}

function extractClaims(text = '', userSources = []) {
  const src = executionClaimText(text, userSources)
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
  { effect: 'import', claim: /(已(?:经)?导入|imported)/i, tool: /(import|ingest)/i, label: '导入' },
  { effect: 'install', claim: /(已(?:经)?安装|installed)/i, tool: /(install|import)/i, label: '安装' },
  { effect: 'send', claim: /(已(?:经)?发送)/i, tool: /(send|message|mail)/i, label: '发送' },
  { effect: 'publish', claim: /(已(?:经)?发布|published)/i, tool: /(publish|release|deploy)/i, label: '发布' },
  { effect: 'delete', claim: /(已(?:经)?删除|deleted)/i, tool: /(delete|remove)/i, label: '删除' },
  { effect: 'write', claim: /(已(?:经)?修改(?:文件|代码)|已(?:经)?写入)/i, tool: /(write|update|patch|edit|save)/i, label: '写入' },
  { effect: 'save', claim: /已(?:经)?保存/i, tool: /(write|save)/i, label: '保存' },
  { effect: 'run', claim: /(已(?:经)?运行(?:测试|脚本|命令)|tests? passed)/i, tool: /(test|run|shell|python|process|command)/i, label: '运行' },
]

// One projection for verification and answer-only repair. This does not grant
// new source authority or turn source excerpts into execution receipts.
function collectGroundingSources({ providedMaterials, evidenceLedger, toolMessages = [] } = {}) {
  const el = createEvidenceLedger(evidenceLedger)
  return [
    ...(Array.isArray(providedMaterials?.items) ? providedMaterials.items : []),
    ...el.entries.filter(e => e.source === 'user' && e.status === 'ok')
      .map(e => ({ id: e.refId || e.id, text: e.digest })),
    ...el.entries.filter(e => e.source === 'tool' && e.status === 'ok' && !isDiscoveryTool(e.provenance?.tool))
      .flatMap(e => {
        const message = toolMessages.find(item => item?.status === 'done'
          && item.toolCallId && item.toolCallId === e.toolCallId
          && item.toolName === e.provenance?.tool)
        const body = typeof message?.text === 'string' ? message.text : e.digest
        const content = toolSourceContent(body)
        const aliases = Object.entries(e.provenance?.actualSource || {})
          .filter(([key, value]) => typeof value === 'string' && value
            && e.provenance?.expectedSource?.[key] === value)
          .map(([, value]) => value)
        return [...new Set([e.refId || e.id, ...aliases])].map(id => ({ id, text: content }))
      }),
  ]
}

function expandInlineSourceAliases(sources = []) {
  const existing = new Set(sources.map(source => String(source?.id || '')).filter(Boolean))
  const owners = new Map()
  for (const source of sources) {
    const aliases = [...String(source?.text || '').matchAll(/^\s*(?:[-*]\s*)?([A-Z]{1,4}\d{1,4}(?:[-_.]\d{1,4})?)\s*[：:]/gmu)]
      .map(match => match[1])
    for (const alias of new Set(aliases)) {
      const matches = owners.get(alias) || []
      matches.push(source)
      owners.set(alias, matches)
    }
  }
  const expanded = sources.slice()
  for (const [alias, matches] of owners) {
    // A unique, explicitly declared section/rule label is an alias of its
    // containing material. Ambiguous labels across documents remain unresolved.
    if (existing.has(alias) || matches.length !== 1) continue
    expanded.push({ ...matches[0], id: alias, parentSourceId: matches[0].id })
  }
  return expanded
}

function verifyClaims({
  text = '',
  evidenceLedger,
  toolLedger,
  referenceState,
  taskFrame,
  providedMaterials,
  toolMessages = [],
} = {}) {
  const violations = []
  const tl = createToolLedger(toolLedger)
  const el = createEvidenceLedger(evidenceLedger)
  const tf = taskFrame || referenceState?.taskFrame || null
  const userSources = [
    ...(Array.isArray(providedMaterials?.items) ? providedMaterials.items : []),
    ...el.entries.filter(entry => entry.source === 'user' && entry.status === 'ok')
      .map(entry => ({ id: entry.refId || entry.id, text: entry.digest })),
  ]
  const executionText = executionClaimText(text, userSources)
  const claims = extractClaims(text, userSources)

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

  if (EXECUTION_CLAIM_RE.test(executionText)) {
    const execOk = tl.calls.some(c => c.status === 'ok')
    // Reading is a platform capability, not a Feishu-only capability. Keep
    // the explicit list conservative so an unrelated successful tool cannot
    // satisfy a read claim, while allowing the built-in public web reader to
    // support claims such as “已读取官方页面”.
    const readTools = [
      'feishu.meeting_read',
      'feishu.meeting_candidates',
      'feishu.today_priority',
      'feishu.doc_kb_suggest',
      'feishu.related_chats',
      'feishu.read_doc',
      'feishu.get_wiki_node',
      'fetch_web_page',
    ]
    const hasRead = readTools.some(name => hasOkToolCall(tl, name))
    if (!execOk || (/(已读取|读取完成|读取成功)/i.test(executionText) && !hasRead)) {
      violations.push({ code: 'false_execution_claim', message: '执行态声明无 ToolLedger 支撑' })
    }
    for (const family of EXECUTION_TOOL_FAMILIES) {
      if (!family.claim.test(executionText)) continue
      const supported = tl.calls.some(call => call.status === 'ok' && (
        (call.effects || []).some(effect => effect.type === family.effect)
        || family.tool.test(String(call.name || ''))
      ))
      if (!supported) {
        violations.push({
          code: 'unsupported_execution_claim',
          message: `${family.label}声明没有对应的成功工具证据`,
        })
      }
    }
  }

  const hasSupportingEvidence = el.entries.some(e =>
      e.source === 'tool' && e.status === 'ok' && !isDiscoveryTool(e.provenance?.tool)
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
  const materialSources = expandInlineSourceAliases(
    collectGroundingSources({ providedMaterials, evidenceLedger: el, toolMessages }),
  )
  const fieldChecks = checkProvidedFieldClaims(text, materialSources)
  // Citation identity is checked over the whole answer, independently of
  // labelled fields or candidate presentation. One real ID cannot launder a
  // missing ID, and an analytical paragraph is not exempt from source identity.
  const sourceIds = materialSources.map(source => source.id)
  const missingSourceIds = explicitSourceIds(text, sourceIds).filter(id => !sourceIds.includes(id))
  if (missingSourceIds.length) violations.push({
    code: 'unresolved_source_citation',
    message: '回复包含无法对应当前材料的来源引用，需要重新核对引用',
    missingSourceIds: missingSourceIds.slice(0, 32),
  })
  if (!candidatePresentation) {
    const unresolved = fieldChecks.filter(claim => claim.support === 'unresolved')
    if (unresolved.length) violations.push({
      code: 'ungrounded_external_fact',
      message: '具体字段缺少对应来源片段；材料存在不代表所有声明都有依据',
      claims: unresolved.map(({ label, value }) => ({ label, value })),
    })
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
      fieldChecks,
      verificationScope: 'execution_receipts_and_labelled_fields_not_semantic_truth',
    },
  }
}

function buildHonestRefusal(verification, taskFrame) {
  if (verification.violations.some(v => v.code === 'source_mismatch')) {
    return '工具返回的内容与您指定的文档或资源不一致。为避免误答，我不会使用这份内容；请核对链接/token 后重试。'
  }
  const missingTools = verification.violations.find(v => v.code === 'missing_required_tools')?.missingTools || []
  if (missingTools.length) {
    const label = missingTools.map(formatToolLabelForUser).join('、')
    return `当前还没有「${label}」的成功执行结果，不能确认任务已完成。已有需求和材料已保留，可以重试未完成的步骤。`
  }
  if (verification.violations.some(v => v.code === 'unsupported_execution_claim')) {
    return '回复中的部分完成声明缺少对应的成功操作凭据，尚不能确认这些操作已完成。已有需求和执行记录已保留。'
  }
  if (verification.violations.some(v => v.code === 'false_execution_claim')) {
    return '当前没有成功的对应工具结果，不能确认所述操作已完成。已有需求和材料已保留。'
  }
  if (verification.violations.some(v => v.code === 'unresolved_source_citation')) {
    return '回复中的部分来源引用无法对应当前材料，暂不能确认这些引用。已有需求和材料已保留，需要重新核对引用。'
  }
  if (verification.violations.some(v => v.code === 'ungrounded_external_fact')) {
    return '回复中的部分字段尚未与来源对应，暂不能确认这些内容。已有需求和材料已保留，需要重新核对依据。'
  }
  if (verification.violations.some(v => v.code === 'missing_required_evidence')) {
    return '工具返回的证据尚未满足任务要求（可能为空、不完整或缺少必要结果）。已有需求和执行记录已保留。'
  }
  return '当前证据不足，尚不能确认任务完成。需要先补齐未满足的结果或操作凭据。'
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
  collectGroundingSources,
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
