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

module.exports = {
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
  PENDING_OK_RE,
  NUMERIC_INPUT_RE,
}
