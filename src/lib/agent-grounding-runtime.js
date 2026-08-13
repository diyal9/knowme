'use strict'

/**
 * Grounding Runtime — ReferenceState, EvidenceLedger, ToolLedger,
 * ClaimVerifier (L0/L1), OutputGate (fail-closed).
 */

const crypto = require('crypto')
const { formatToolLabelForUser } = require('./agent-grounding-labels')

const EXECUTION_CLAIM_RE = /(已读取|已创建|已发送|已执行|已完成读取|已成功读取|读取完成|读取成功)/i
const EXTERNAL_FACT_RE = /(议题[：:]|负责人[：:]|责任人[：:]|日期[：:]|待办[：:]|结论[：:]|会议时间|组织者[：:])/i
const PENDING_OK_RE = /(我将|我会|需要先|尚未读取|需先|请允许|下一步|正在准备)/i
const NUMERIC_INPUT_RE = /^(?:第?\s*(\d{1,2})\s*(?:条|项|个|号)?|(\d{1,2}))$/

function newId(prefix = 'gr') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

function resolveGroundingRuntimeMode() {
  const raw = String(process.env.KNOWME_GROUNDING_RUNTIME || 'runtime').trim().toLowerCase()
  return raw === 'legacy' ? 'legacy' : 'runtime'
}

function createReferenceState(seed = {}) {
  return {
    version: 1,
    refs: Array.isArray(seed.refs) ? seed.refs.map(normalizeRef) : [],
    activeRefId: seed.activeRefId || null,
    pendingSelection: seed.pendingSelection ? normalizePendingSelection(seed.pendingSelection) : null,
    taskFrame: seed.taskFrame ? normalizeTaskFrame(seed.taskFrame) : null,
  }
}

function normalizeRef(raw = {}) {
  return {
    id: String(raw.id || newId('ref')).slice(0, 120),
    kind: String(raw.kind || 'generic').slice(0, 64),
    label: String(raw.label || '').slice(0, 240),
    payload: raw.payload && typeof raw.payload === 'object' ? { ...raw.payload } : {},
    boundTool: raw.boundTool ? String(raw.boundTool).slice(0, 120) : null,
    expiresAt: raw.expiresAt || null,
    stale: raw.stale === true,
  }
}

function normalizePendingSelection(raw = {}) {
  const options = Array.isArray(raw.options) ? raw.options.map((opt, idx) => ({
    id: String(opt.id || `option-${idx + 1}`).slice(0, 120),
    label: String(opt.label || opt.title || `选项 ${idx + 1}`).slice(0, 240),
    payload: opt.payload && typeof opt.payload === 'object' ? { ...opt.payload } : { ...(opt || {}) },
    boundTool: opt.boundTool ? String(opt.boundTool).slice(0, 120) : null,
  })) : []
  return {
    refSetId: String(raw.refSetId || newId('sel')).slice(0, 120),
    options,
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

function normalizeTaskFrame(raw = {}) {
  return {
    workflowId: raw.workflowId ? String(raw.workflowId).slice(0, 120) : null,
    skillId: raw.skillId ? String(raw.skillId).slice(0, 120) : null,
    requiredTools: uniqueStrings(raw.requiredTools),
    requiredEvidence: Array.isArray(raw.requiredEvidence) ? raw.requiredEvidence.map(normalizeEvidenceRule) : [],
    completionConditions: Array.isArray(raw.completionConditions) ? raw.completionConditions.map(normalizeCompletionCondition) : [],
  }
}

function normalizeEvidenceRule(raw = {}) {
  const minRaw = raw.minChars
  let minChars = null
  if (minRaw != null && minRaw !== '') {
    const n = Number(minRaw)
    minChars = Number.isFinite(n) ? Math.max(0, n) : null
  }
  return {
    kind: String(raw.kind || 'tool_result').slice(0, 64),
    tool: raw.tool ? String(raw.tool).slice(0, 120) : null,
    minChars,
    forbidTruncated: raw.forbidTruncated !== false,
  }
}

function normalizeCompletionCondition(raw = {}) {
  return {
    type: String(raw.type || '').slice(0, 64),
    tool: raw.tool ? String(raw.tool).slice(0, 120) : null,
    kind: raw.kind ? String(raw.kind).slice(0, 64) : null,
  }
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => String(v || '').trim()).filter(Boolean))]
}

function normalizeRequiredToolsField(value) {
  if (Array.isArray(value)) return uniqueStrings(value).filter(isLikelyToolId)
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return []
    if (v.startsWith('[') && v.endsWith(']')) return uniqueStrings(parseInlineListFromScalar(v)).filter(isLikelyToolId)
    if (isLikelyToolId(v)) return [v]
    return []
  }
  return []
}

function isLikelyToolId(name) {
  const v = String(name || '').trim()
  return /^[a-zA-Z0-9_.-]+$/.test(v) && v.includes('.')
}

function parseInlineListFromScalar(value) {
  const raw = String(value || '').trim()
  if (!raw.startsWith('[') || !raw.endsWith(']')) return []
  return raw
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function serializeReferenceState(state) {
  return JSON.parse(JSON.stringify(state || createReferenceState()))
}

function deserializeReferenceState(raw) {
  if (!raw || typeof raw !== 'object') return createReferenceState()
  return createReferenceState(raw)
}

function setPendingSelection(state, options, refSetId) {
  const next = createReferenceState(state)
  next.pendingSelection = normalizePendingSelection({
    refSetId: refSetId || newId('sel'),
    options: Array.isArray(options) ? options : [],
  })
  return next
}

function clearPendingSelection(state) {
  const next = createReferenceState(state)
  next.pendingSelection = null
  return next
}

function setTaskFrame(state, taskFrame) {
  const next = createReferenceState(state)
  next.taskFrame = normalizeTaskFrame(taskFrame || {})
  return next
}

function clearStaleOnTaskSwitch(state, newTaskFrame = null) {
  const next = createReferenceState(state)
  next.pendingSelection = null
  next.refs = next.refs.map(ref => ({ ...ref, stale: true }))
  next.activeRefId = null
  if (newTaskFrame) next.taskFrame = normalizeTaskFrame(newTaskFrame)
  return next
}

function parseNumericSelection(input = '') {
  const src = String(input || '').trim()
  const m = src.match(NUMERIC_INPUT_RE)
  if (!m) return 0
  return Number(m[1] || m[2] || 0)
}

function bindNumericSelection(state, userInput, { bindRefId } = {}) {
  const next = createReferenceState(state)
  const index = parseNumericSelection(userInput)
  if (bindRefId && next.pendingSelection?.options?.length) {
    const opts = next.pendingSelection.options
    const byId = opts.find(opt => opt.id === bindRefId)
    if (byId) {
      const optIndex = opts.indexOf(byId)
      next.activeRefId = byId.id
      next.pendingSelection = null
      return { state: next, bound: true, option: byId, index: optIndex + 1, ambiguous: false }
    }
  }
  if (!index || index < 1) {
    return { state: next, bound: false, option: null, index: 0, ambiguous: false }
  }
  const options = next.pendingSelection?.options || []
  if (!options.length) {
    return { state: next, bound: false, option: null, index, ambiguous: true }
  }
  const option = options[index - 1]
  if (!option) {
    return { state: next, bound: false, option: null, index, ambiguous: true }
  }
  next.activeRefId = option.id
  next.pendingSelection = null
  return { state: next, bound: true, option, index, ambiguous: false }
}

function buildDeterministicToolIntent(option, { defaultTool = 'feishu.meeting_read' } = {}) {
  if (!option) return null
  const tool = option.boundTool || defaultTool
  const payload = option.payload || {}
  const label = option.label || payload.title || '所选项'
  if (tool === 'feishu.meeting_read' || payload.minute_token || payload.minuteToken) {
    const minuteToken = String(payload.minute_token || payload.minuteToken || '').trim()
    const url = String(payload.url || '').trim()
    const locator = minuteToken ? `minute_token=${minuteToken}` : (url ? `url=${url}` : '')
    if (!locator) return null
    return {
      tool: 'feishu.meeting_read',
      rewrittenPrompt: `我选择：${label}。请立刻使用 \`feishu.meeting_read\` 读取该会议妙记正文（${locator}）。读取成功后再输出结构化会议总结；若失败请返回真实原因，不要编造正文。`,
      args: minuteToken ? { minute_token: minuteToken } : { url },
    }
  }
  if (tool === 'feishu.read_doc' || payload.doc_token || payload.token) {
    const token = String(payload.doc_token || payload.token || '').trim()
    const url = String(payload.url || '').trim()
    const locator = token || url
    if (!locator) return null
    return {
      tool: 'feishu.read_doc',
      rewrittenPrompt: `我选择：${label}。请立刻使用 \`feishu.read_doc\` 读取文档原文（${locator}）。`,
      args: token ? { doc_token: token } : { url },
    }
  }
  return {
    tool,
    rewrittenPrompt: `我选择：${label}。请立刻调用 \`${tool}\` 并基于真实工具结果继续。`,
    args: payload,
  }
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
  const options = (Array.isArray(candidates) ? candidates : []).map((c, idx) => ({
    id: c.id || `candidate-${idx + 1}`,
    label: c.title || c.label || `候选 ${idx + 1}`,
    boundTool: 'feishu.meeting_read',
    payload: {
      minute_token: c.minute_token || c.minuteToken || '',
      url: c.url || '',
      title: c.title || c.label || '',
      startTime: c.startTime || c.time || '',
      organizer: c.organizer || '',
    },
  }))
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
