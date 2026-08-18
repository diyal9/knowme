'use strict'

const crypto = require('crypto')

const RUN_ROLES = ['general', 'steward', 'writing', 'coding']
const ARTIFACT_TYPES = ['knowledge_proposal', 'health_report', 'text', 'wiki_write', 'editor_patch']
const APPLY_ACTIONS = ['insert', 'append', 'replace', 'reject', 'copy']
const MAX_APPLY_LOG = 30
const MAX_RUN_STEPS = 80
const MAX_PLAN_ITEMS = 12
const PLAN_STATUSES = ['pending', 'doing', 'done', 'blocked']

function newArtifactId() {
  return `art_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
}

function newPlanItemId() {
  return `plan_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`
}

function normalizePlanItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const status = PLAN_STATUSES.includes(raw.status) ? raw.status : 'pending'
  const title = String(raw.title || '').trim().slice(0, 160)
  if (!title) return null
  const item = {
    id: String(raw.id || newPlanItemId()).slice(0, 120),
    title,
    status,
  }
  if (raw.evidence) item.evidence = String(raw.evidence).slice(0, 500)
  return item
}

function normalizePlan(raw) {
  if (raw == null) return undefined
  if (typeof raw !== 'object') return { version: 1, updatedAt: new Date().toISOString(), items: [] }
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizePlanItem).filter(Boolean).slice(0, MAX_PLAN_ITEMS)
    : []
  const version = Math.max(1, Math.floor(Number(raw.version) || 1))
  return {
    version,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    items,
  }
}

function createEmptyPlan() {
  return { version: 1, updatedAt: new Date().toISOString(), items: [] }
}

function formatPlanChecklist(plan) {
  const normalized = normalizePlan(plan)
  if (!normalized || !normalized.items.length) return ''
  const marks = { pending: '[ ]', doing: '[~]', done: '[x]', blocked: '[!]' }
  const lines = normalized.items.map((item, index) => {
    const mark = marks[item.status] || '[ ]'
    const evidence = item.evidence ? ` — ${item.evidence}` : ''
    return `${index + 1}. ${mark} ${item.title}${evidence}`
  })
  return `To-dos ${normalized.items.length}\n${lines.join('\n')}`
}

function countPlanRemaining(plan) {
  const items = normalizePlan(plan)?.items || []
  return items.filter((item) => item.status === 'pending' || item.status === 'doing').length
}

function replacePlan(session, items) {
  const run = normalizeRun(session?.run || createEmptyRun())
  const nextItems = (Array.isArray(items) ? items : [])
    .map(normalizePlanItem)
    .filter(Boolean)
    .slice(0, MAX_PLAN_ITEMS)
  run.plan = {
    version: (run.plan?.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    items: nextItems,
  }
  return { ...session, run }
}

function upsertPlanItems(session, items) {
  const run = normalizeRun(session?.run || createEmptyRun())
  const plan = normalizePlan(run.plan) || createEmptyPlan()
  const list = [...plan.items]
  for (const raw of Array.isArray(items) ? items : []) {
    const item = normalizePlanItem(raw)
    if (!item) continue
    const index = list.findIndex((entry) => entry.id === item.id)
    if (index >= 0) list[index] = { ...list[index], ...item }
    else list.push(item)
  }
  run.plan = {
    version: plan.version + 1,
    updatedAt: new Date().toISOString(),
    items: list.slice(0, MAX_PLAN_ITEMS),
  }
  return { ...session, run }
}

function setPlanItemStatus(session, id, status, evidence) {
  const run = normalizeRun(session?.run || createEmptyRun())
  const plan = normalizePlan(run.plan) || createEmptyPlan()
  const nextStatus = PLAN_STATUSES.includes(status) ? status : null
  if (!nextStatus || !id) return session
  const items = plan.items.map((item) => {
    if (item.id !== String(id)) return item
    const next = { ...item, status: nextStatus }
    if (evidence != null) next.evidence = String(evidence).slice(0, 500)
    return next
  })
  run.plan = {
    version: plan.version + 1,
    updatedAt: new Date().toISOString(),
    items,
  }
  return { ...session, run }
}

function normalizeArtifact(raw) {
  if (!raw || typeof raw !== 'object') return null
  const type = ARTIFACT_TYPES.includes(raw.type) ? raw.type : 'text'
  const status = ['draft', 'accepted', 'rejected'].includes(raw.status) ? raw.status : 'draft'
  return {
    id: String(raw.id || newArtifactId()),
    type,
    title: String(raw.title || '产物').slice(0, 120),
    body: String(raw.body || '').slice(0, 100000),
    status,
    targetPath: raw.targetPath ? String(raw.targetPath).slice(0, 260) : undefined,
    sourceWikiPath: raw.sourceWikiPath ? String(raw.sourceWikiPath).slice(0, 260) : undefined,
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
  }
}

function createEmptyRun(role = 'general', goal = '') {
  const r = RUN_ROLES.includes(role) ? role : 'general'
  return {
    goal: String(goal || '').slice(0, 200),
    role: r,
    status: 'active',
    toolsUsed: [],
    steps: [],
    artifacts: [],
    applyLog: [],
  }
}

function normalizeRunStep(raw) {
  if (!raw || typeof raw !== 'object') return null
  const kind = raw.kind === 'tool' ? 'tool' : 'stage'
  const status = ['pending', 'done', 'error'].includes(raw.status) ? raw.status : 'done'
  const duration = Number(raw.durationMs)
  const step = {
    id: String(raw.id || newArtifactId()).slice(0, 120),
    kind,
    title: String(raw.title || (kind === 'tool' ? '工具调用' : '执行步骤')).slice(0, 160),
    status,
    at: String(raw.at || new Date().toISOString()),
  }
  if (raw.summary) step.summary = String(raw.summary).slice(0, 1000)
  if (raw.toolCallId) step.toolCallId = String(raw.toolCallId).slice(0, 160)
  if (raw.toolName) step.toolName = String(raw.toolName).slice(0, 120)
  if (Number.isFinite(duration) && duration >= 0) step.durationMs = Math.min(duration, 3_600_000)
  return step
}

function normalizeApplyEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const action = APPLY_ACTIONS.includes(raw.action) ? raw.action : null
  if (!action) return null
  return {
    at: String(raw.at || new Date().toISOString()),
    action,
    detail: String(raw.detail || '').slice(0, 200),
    noteId: raw.noteId ? String(raw.noteId).slice(0, 80) : undefined,
  }
}

function normalizeRun(raw) {
  if (raw == null) return undefined
  if (typeof raw !== 'object') return createEmptyRun()
  const base = createEmptyRun(raw.role, raw.goal)
  const toolsUsed = Array.isArray(raw.toolsUsed)
    ? [...new Set(raw.toolsUsed.map(String).filter(Boolean))].slice(0, 40)
    : []
  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.map(normalizeArtifact).filter(Boolean).slice(0, 40)
    : []
  const applyLog = Array.isArray(raw.applyLog)
    ? raw.applyLog.map(normalizeApplyEntry).filter(Boolean).slice(-MAX_APPLY_LOG)
    : []
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(normalizeRunStep).filter(Boolean).slice(-MAX_RUN_STEPS)
    : []
  const status = ['active', 'review', 'done'].includes(raw.status) ? raw.status : 'active'
  const plan = raw.plan != null ? normalizePlan(raw.plan) : undefined
  return {
    ...base,
    goal: String(raw.goal || '').slice(0, 200),
    role: RUN_ROLES.includes(raw.role) ? raw.role : 'general',
    status,
    toolsUsed,
    steps,
    artifacts,
    applyLog,
    ...(plan ? { plan } : {}),
  }
}

function upsertStep(session, rawStep) {
  const step = normalizeRunStep(rawStep)
  if (!step) return session
  const run = normalizeRun(session?.run || createEmptyRun())
  const index = run.steps.findIndex((item) => item.id === step.id)
  if (index >= 0) run.steps[index] = { ...run.steps[index], ...step }
  else run.steps.push(step)
  run.steps = run.steps.slice(-MAX_RUN_STEPS)
  return { ...session, run }
}

function ensureRun(session, patch = {}) {
  const run = normalizeRun({ ...(session?.run || createEmptyRun()), ...patch })
  return { ...session, run }
}

function recordTool(session, toolName) {
  const run = normalizeRun(session?.run || createEmptyRun())
  if (toolName && !run.toolsUsed.includes(toolName)) run.toolsUsed.push(String(toolName))
  return { ...session, run }
}

function addArtifact(session, artifact) {
  const run = normalizeRun(session?.run || createEmptyRun())
  const art = normalizeArtifact(artifact)
  if (!art) return session
  run.artifacts = [...run.artifacts.filter((a) => a.id !== art.id), art]
  run.status = 'review'
  return { ...session, run }
}

function setArtifactStatus(session, artifactId, status) {
  const run = normalizeRun(session?.run || createEmptyRun())
  run.artifacts = run.artifacts.map((a) =>
    a.id === artifactId ? { ...a, status } : a
  )
  if (status === 'accepted' || status === 'rejected') {
    const pending = run.artifacts.some((a) => a.status === 'draft')
    run.status = pending ? 'review' : 'done'
  }
  return { ...session, run }
}

function recordApply(session, entry) {
  const run = normalizeRun(session?.run || createEmptyRun())
  const item = normalizeApplyEntry(entry)
  if (!item) return session
  run.applyLog = [...(run.applyLog || []), item].slice(-MAX_APPLY_LOG)
  return { ...session, run }
}

function editorPatchArtifact({ body, mode = 'replace', noteId, title } = {}) {
  const m = ['replace', 'append', 'insert'].includes(mode) ? mode : 'replace'
  const labels = { replace: '替换当前文件全文', append: '追加到文末', insert: '插入到光标' }
  return normalizeArtifact({
    id: newArtifactId(),
    type: 'editor_patch',
    title: title || labels[m] || '写入当前文件',
    body: String(body || ''),
    status: 'draft',
    meta: { mode: m, noteId: noteId || undefined },
  })
}

function healthReportArtifact(lintResult) {
  const issues = lintResult?.issues || []
  const lines = issues.length
    ? issues.map((i) => `- [${i.type}] ${i.path || '—'}：${i.message}`).join('\n')
    : '未发现问题，知识库健康。'
  return normalizeArtifact({
    id: newArtifactId(),
    type: 'health_report',
    title: lintResult?.healthy ? '知识健康：通过' : `知识健康：${issues.length} 个问题`,
    body: `扫描 ${lintResult?.scanned ?? 0} 个文件。\n\n${lines}`,
    status: 'draft',
    meta: { issueCount: issues.length, healthy: !!lintResult?.healthy },
  })
}

module.exports = {
  RUN_ROLES,
  ARTIFACT_TYPES,
  APPLY_ACTIONS,
  MAX_APPLY_LOG,
  MAX_RUN_STEPS,
  MAX_PLAN_ITEMS,
  PLAN_STATUSES,
  newArtifactId,
  newPlanItemId,
  normalizeArtifact,
  normalizeApplyEntry,
  normalizeRunStep,
  normalizePlanItem,
  normalizePlan,
  createEmptyPlan,
  createEmptyRun,
  formatPlanChecklist,
  countPlanRemaining,
  replacePlan,
  upsertPlanItems,
  setPlanItemStatus,
  normalizeRun,
  ensureRun,
  recordTool,
  upsertStep,
  addArtifact,
  setArtifactStatus,
  recordApply,
  editorPatchArtifact,
  healthReportArtifact,
}
