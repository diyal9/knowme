'use strict'

/**
 * Conservative, local-only cognition observation. This module never calls an
 * LLM and only extracts statements that carry an explicit user-owned signal.
 */

const crypto = require('crypto')

const MAX_CANDIDATES = 4
const SENSITIVE_RE = /(?:密码|口令|验证码|身份证|银行卡|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|password|\bsk-[a-z0-9_-]{8,})/i
const EPHEMERAL_RE = /(?:不要|别|无需)(?:记住|学习|保存)|仅(?:本次|这次|当前对话)|一次性(?:对话|会话)|无痕|临时对话/i
const QUESTION_RE = /(?:吗|么|如何|为什么|是否|是不是|能否|可否)[？?]?$/
const COLLABORATION_RE = /(?:回答|回复|沟通|表达|语气|称呼|先给结论|简洁|详细|主动提醒|主动追问|协作方式|不要寒暄|少用|多用)/

const KIND_META = Object.freeze({
  preference: { nodeKind: 'preference', predicate: 'hasPreference', category: 'about', scope: 'global', impact: '确认后，伙伴会在后续协作中稳定采用这项偏好。' },
  behavior: { targetType: 'partner_profile', category: 'about', scope: 'global', impact: '确认后会更新伙伴的协作方式，不会把回复风格当作 Brain 事实。' },
  fact: { nodeKind: 'concept', predicate: 'hasFact', category: 'about', scope: 'global', impact: '确认后，这项关于你的信息会成为稳定个性化依据。' },
  goal: { nodeKind: 'goal', predicate: 'pursues', category: 'project', scope: 'global', impact: '确认后，Brain 会把它作为长期目标参与任务理解。' },
  project: { nodeKind: 'project', predicate: 'worksOn', category: 'project', scope: 'project', impact: '确认后，Brain 会把它作为当前工作上下文组织任务与决策。' },
  decision: { nodeKind: 'decision', predicate: 'madeDecision', category: 'project', scope: 'project', impact: '确认后，Brain 会在相关工作中优先引用这项决定。' },
})

function clean(value, max = 300) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function canonical(value) {
  return clean(value, 300)
    .replace(/^[，,：:\s]+|[。！？!?；;，,\s]+$/g, '')
    .toLocaleLowerCase('zh-CN')
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

function splitStatements(text) {
  return String(text || '')
    .split(/[\n。！？!?；;]+/)
    .map(item => clean(item))
    .filter(item => item.length >= 4 && item.length <= 300)
    .slice(0, 20)
}

function classifyStatement(statement) {
  const text = clean(statement)
  if (!text || QUESTION_RE.test(text)) return null

  const remember = text.match(/^(?:请)?记住(?:一下)?[：,:，\s]*(.+)$/)
  if (remember?.[1]) {
    const content = clean(remember[1])
    const kind = /目标|要完成|计划/.test(content)
      ? 'goal'
      : /项目|正在做|负责/.test(content)
        ? 'project'
        : /决定|确定|采用/.test(content)
          ? 'decision'
          : /喜欢|偏好|习惯|希望你|以后|不要/.test(content)
            ? (COLLABORATION_RE.test(content) ? 'behavior' : 'preference')
            : 'fact'
    return { kind, text: content, explicit: true }
  }

  if (/^(?:我|本人)(?:更)?(?:喜欢|偏好|习惯)|^我的偏好是|^以后(?:请|希望)|^回答时(?:请|希望)|^请(?:始终|总是)/.test(text)) {
    return { kind: COLLABORATION_RE.test(text) ? 'behavior' : 'preference', text, explicit: true }
  }
  if (/^(?:我是|我的岗位是|我的职业是|我主要负责|我的职责是)/.test(text)) {
    return { kind: 'fact', text, explicit: true }
  }
  if (/^(?:我的长期目标是|我的目标是|我计划长期|我接下来长期要)/.test(text)) {
    return { kind: 'goal', text, explicit: true }
  }
  if (/^(?:我现在主要在做|我正在做的项目是|我当前负责的项目是)/.test(text)) {
    return { kind: 'project', text, explicit: true }
  }
  if (/^(?:我决定|我们决定|已经决定|已经确定|最终确定)/.test(text)) {
    return { kind: 'decision', text, explicit: true }
  }
  return null
}

function extractCandidates(text) {
  if (SENSITIVE_RE.test(String(text || '')) || EPHEMERAL_RE.test(String(text || ''))) return []
  const unique = new Map()
  for (const statement of splitStatements(text)) {
    const candidate = classifyStatement(statement)
    if (!candidate) continue
    const normalized = canonical(candidate.text)
    if (!normalized) continue
    const fingerprint = hash(`${candidate.kind}|${KIND_META[candidate.kind].scope}|${normalized}`).slice(0, 24)
    unique.set(fingerprint, { ...candidate, fingerprint, ...KIND_META[candidate.kind] })
    if (unique.size >= MAX_CANDIDATES) break
  }
  return [...unique.values()]
}

function extractWeakPreferenceSignals(text) {
  if (SENSITIVE_RE.test(String(text || '')) || EPHEMERAL_RE.test(String(text || ''))) return []
  return splitStatements(text)
    .filter(statement => /^(?:我通常|我一般|我经常|多数时候我|我往往)/.test(statement) && !QUESTION_RE.test(statement))
    .slice(0, 3)
    .map(statement => ({ kind: COLLABORATION_RE.test(statement) ? 'behavior' : 'preference', text: statement, category: 'about' }))
}

function buildProposal(store, candidate, source = {}) {
  const meta = KIND_META[candidate.kind] || KIND_META.fact
  const fingerprint = candidate.fingerprint || hash(`${candidate.kind}|${meta.scope}|${canonical(candidate.text)}`).slice(0, 24)
  const proposalId = candidate.proposalId || `observation:${fingerprint}`
  const evidenceId = `evidence:observation:${fingerprint}`
  const nodeId = `cognition:${meta.nodeKind}:${fingerprint}`
  const claimId = `claim:observation:${fingerprint}`
  const timestamp = source.capturedAt || new Date().toISOString()
  const sourceRef = clean(source.documentRef || `conversation:${source.sessionId || source.runId || fingerprint}`, 500)
  const title = clean(source.title || (candidate.memoryPatternId ? '近期协作中的重复观察' : '你在对话中的明确表达'), 180)
  const projectId = clean(source.projectId, 100) || undefined
  const scopedProjectId = meta.scope === 'project' ? projectId : undefined
  const rationale = clean(candidate.rationale || (
    candidate.memoryPatternId
      ? `这项表达在近期协作中重复出现 ${Math.max(1, Number(candidate.observationCount) || 1)} 次，可能值得形成长期理解。`
      : '这是你在当前对话中明确表达的个人或工作信息；KnowMe 只提出建议，不会自动写入长期 Brain。'
  ), 1200)
  const evidence = {
    id: evidenceId,
    type: 'conversation',
    projectId,
    taskId: clean(source.taskId, 100) || undefined,
    runId: clean(source.runId, 160) || undefined,
    documentRef: sourceRef,
    title,
    snippet: clean(candidate.text, 500),
    contentHash: hash(candidate.text),
    persistence: 'local',
    capturedAt: timestamp,
  }
  const cognitionEffects = meta.targetType === 'partner_profile'
    ? [{ patch: { promptOverlay: clean(candidate.text, 8000) } }]
    : [
        { op: 'upsert_evidence', value: evidence },
        { op: 'upsert_node', value: { id: nodeId, kind: meta.nodeKind, label: clean(candidate.text), summary: title, tags: ['cognition', candidate.kind, 'confirmed'], scope: meta.scope, projectId: scopedProjectId, authority: candidate.memoryPatternId ? 3 : 5 } },
        { op: 'upsert_claim', value: { id: claimId, subjectId: 'self:me', predicate: meta.predicate, objectNodeId: nodeId, status: 'observed', confidence: candidate.memoryPatternId ? 0.72 : 0.95, scope: meta.scope, projectId: scopedProjectId, evidenceRefs: [evidenceId] } },
      ]
  return {
    id: proposalId,
    kind: meta.targetType === 'partner_profile' ? 'behavior' : 'cognition',
    targetType: meta.targetType || 'brain',
    status: 'pending',
    projectId,
    summary: clean(candidate.text),
    rationale,
    effects: cognitionEffects,
    _evidence: evidence,
    evidenceRefs: [evidenceId],
    fingerprint,
    category: meta.category,
    confidence: candidate.memoryPatternId ? 0.72 : 0.95,
    impact: meta.impact,
    sourceRef,
    sourceLabel: title,
    memoryPatternId: candidate.memoryPatternId,
    observationCount: Math.max(1, Number(candidate.observationCount) || 1),
    lastObservedAt: timestamp,
    createdAt: candidate.createdAt || timestamp,
  }
}

function isSensitive(text) {
  return SENSITIVE_RE.test(String(text || ''))
}

function isEphemeral(text) {
  return EPHEMERAL_RE.test(String(text || ''))
}

function isCollaborationPreference(text) {
  return COLLABORATION_RE.test(String(text || ''))
}

module.exports = {
  MAX_CANDIDATES,
  KIND_META,
  canonical,
  extractCandidates,
  extractWeakPreferenceSignals,
  buildProposal,
  isSensitive,
  isEphemeral,
  isCollaborationPreference,
}
