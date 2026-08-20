'use strict'

const fs = require('fs')
const path = require('path')
const {
  normalizeTaskScheduleFields,
} = require('./workbench-task-scheduler')

const VERSION = 2
const TITLE_MAX = 160
const GOAL_MAX = 2000
const SUMMARY_MAX = 280
const LIST_MAX = 200
const KNOWLEDGE_REFS_MAX = 16
const STATUSES = Object.freeze([
  'draft', 'starting', 'needs_input', 'running', 'review', 'revising', 'completed', 'failed', 'cancelled',
])
const EXEC_KINDS = Object.freeze(['session', 'run', 'daemon', 'none'])

function nowIso() {
  return new Date().toISOString()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function pickStatus(value) {
  const status = text(value, 20).toLowerCase()
  if (status === 'done') return 'completed'
  return STATUSES.includes(status) ? status : 'draft'
}

function normalizeExecRef(raw) {
  if (!raw || typeof raw !== 'object') return { kind: 'none', id: '' }
  const kind = text(raw.kind, 20).toLowerCase()
  return {
    kind: EXEC_KINDS.includes(kind) ? kind : 'none',
    id: text(raw.id, 160),
  }
}

function normalizeKnowledgeRefs(raw) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(raw) ? raw : []) {
    const item = typeof value === 'string'
      ? { id: value }
      : (value && typeof value === 'object' ? value : null)
    const itemId = text(item?.id, 80)
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({ id: itemId })
    if (out.length >= KNOWLEDGE_REFS_MAX) break
  }
  return out
}

function normalizeTaskRef(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = text(raw.id, 80)
  return id ? { id } : null
}

function safeRef(value, max = 240) {
  const ref = text(value, max)
  if (/^[a-z]:[\\/]/i.test(ref) || ref.startsWith('/') || ref.startsWith('\\\\')) return ''
  return ref
}

function normalizeMaterials(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 32).map((value, index) => {
    const item = value && typeof value === 'object' ? value : { title: value }
    return {
      id: text(item.id, 80) || `material-${index + 1}`,
      type: text(item.type, 40) || 'reference',
      title: text(item.title || item.name, 160) || `材料 ${index + 1}`,
      ref: safeRef(item.ref || item.resourceRef || item.path),
      content: text(item.content || item.text, 8000),
    }
  })
}

function normalizeRequestedDeliverables(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 16).map((value, index) => {
    const item = value && typeof value === 'object' ? value : { title: value }
    return {
      id: text(item.id, 80) || `output-${index + 1}`,
      title: text(item.title || item.name, 160) || `交付物 ${index + 1}`,
      type: text(item.type, 80) || 'document',
      required: item.required !== false,
      acceptanceCriteria: (Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria : [])
        .map(value => text(value, 400)).filter(Boolean).slice(0, 16),
      requiredTools: (Array.isArray(item.requiredTools) ? item.requiredTools : [])
        .map(value => text(value, 120)).filter(Boolean).slice(0, 32),
      requiredEvidence: (Array.isArray(item.requiredEvidence) ? item.requiredEvidence : [])
        .filter(value => value && typeof value === 'object').slice(0, 16),
      completionConditions: (Array.isArray(item.completionConditions) ? item.completionConditions : [])
        .filter(value => value && typeof value === 'object').slice(0, 16),
    }
  })
}

function normalizeBrief(source) {
  const brief = source.brief && typeof source.brief === 'object' ? source.brief : {}
  const goal = text(brief.goal || source.goal, GOAL_MAX)
  return {
    goal,
    requiresMaterials: brief.requiresMaterials === true || source.requiresMaterials === true,
    materials: normalizeMaterials(brief.materials || source.materials),
    deliverables: normalizeRequestedDeliverables(brief.deliverables || source.requestedDeliverables),
    constraints: (Array.isArray(brief.constraints || source.constraints) ? (brief.constraints || source.constraints) : [])
      .map(value => text(value, 400)).filter(Boolean).slice(0, 24),
    dueAt: text(brief.dueAt || source.dueAt, 40),
  }
}

function normalizeAssignmentSnapshot(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    agentId: text(source.agentId || source.expertId, 160),
    agentVersion: text(source.agentVersion || source.version, 80),
    agentHash: text(source.agentHash || source.contentHash || source.hash, 180),
    profileId: text(source.profileId, 80),
    profileVersion: text(source.profileVersion, 80),
    profileHash: text(source.profileHash, 180),
    snapshotRef: safeRef(source.snapshotRef || source.path, 300),
  }
}

function normalizeParticipants(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 32).map((value) => {
    const item = value && typeof value === 'object' ? value : {}
    return {
      id: text(item.id || item.userId, 120),
      role: text(item.role, 40) || 'viewer',
      name: text(item.name, 120),
    }
  }).filter(item => item.id)
}

function normalizeEvents(raw) {
  return (Array.isArray(raw) ? raw : []).slice(-200).map((value) => {
    const item = value && typeof value === 'object' ? value : {}
    return {
      id: text(item.id, 120) || `event-${Math.random().toString(36).slice(2, 9)}`,
      type: text(item.type, 80) || 'updated',
      summary: text(item.summary, 500),
      actorId: text(item.actorId, 120),
      createdAt: text(item.createdAt, 40) || nowIso(),
    }
  })
}

function normalizeDeliverables(raw) {
  return (Array.isArray(raw) ? raw : []).slice(-80).map((value, index) => {
    const item = value && typeof value === 'object' ? value : {}
    const version = Math.max(1, Math.floor(Number(item.version) || 1))
    return {
      deliverableId: text(item.deliverableId || item.id, 120) || `deliverable-${index + 1}`,
      title: text(item.title, 160) || `交付物 ${index + 1}`,
      type: text(item.type, 80) || 'document',
      version,
      required: item.required !== false,
      previousVersionId: text(item.previousVersionId, 120),
      artifactRef: safeRef(item.artifactRef || item.ref, 300),
      executionRef: safeRef(item.executionRef || item.runRef, 300),
      evidenceStatus: ['verified', 'blocked', 'not_required'].includes(item.evidenceStatus)
        ? item.evidenceStatus
        : 'not_required',
      acceptanceStatus: ['pending', 'accepted', 'changes_requested'].includes(item.acceptanceStatus)
        ? item.acceptanceStatus
        : 'pending',
      comments: (Array.isArray(item.comments) ? item.comments : []).slice(-50).map(comment => ({
        id: text(comment?.id, 120) || `comment-${Math.random().toString(36).slice(2, 9)}`,
        body: text(comment?.body || comment?.text, 1000),
        authorId: text(comment?.authorId, 120),
        createdAt: text(comment?.createdAt, 40) || nowIso(),
      })).filter(comment => comment.body),
      createdAt: text(item.createdAt, 40) || nowIso(),
    }
  })
}

function normalizeExecutionEvidence(raw) {
  return (Array.isArray(raw) ? raw : []).slice(-80).map(value => {
    const item = value && typeof value === 'object' ? value : {}
    return {
      runId: text(item.runId, 160),
      deliverableId: text(item.deliverableId, 120),
      gateStatus: ['verified', 'blocked', 'not_required'].includes(item.gateStatus)
        ? item.gateStatus
        : 'not_required',
      verificationPassed: item.verificationPassed !== false,
      toolCalls: (Array.isArray(item.toolCalls) ? item.toolCalls : []).slice(-64).map(call => ({
        id: text(call?.id, 160),
        name: text(call?.name, 120),
        status: call?.status === 'ok' ? 'ok' : 'fail',
        resultRef: safeRef(call?.resultRef, 300),
        error: text(call?.error, 500),
        durationMs: Number.isFinite(Number(call?.durationMs)) ? Number(call.durationMs) : null,
      })),
      evidence: (Array.isArray(item.evidence) ? item.evidence : []).slice(-64).map(entry => ({
        id: text(entry?.id, 160),
        status: text(entry?.status, 40),
        digest: text(entry?.digest, 500),
        provenance: entry?.provenance && typeof entry.provenance === 'object' ? entry.provenance : {},
      })),
      violations: (Array.isArray(item.violations) ? item.violations : []).slice(0, 16).map(entry => ({
        code: text(entry?.code, 120),
        message: text(entry?.message, 500),
        missingTools: (Array.isArray(entry?.missingTools) ? entry.missingTools : []).map(value => text(value, 120)).filter(Boolean).slice(0, 32),
      })),
      createdAt: text(item.createdAt, 40) || nowIso(),
    }
  }).filter(item => item.runId)
}

function genId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeTask(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = text(source.createdAt, 40) || nowIso()
  const scheduleFields = normalizeTaskScheduleFields(source)
  const brief = normalizeBrief(source)
  const deliverables = normalizeDeliverables(source.deliverables)
  const requiredDeliverableIds = brief.deliverables.filter(item => item.required !== false).map(item => item.id)
  const requestedComplete = !requiredDeliverableIds.length || requiredDeliverableIds.every(id => (
    deliverables.some(item => item.deliverableId === id && item.acceptanceStatus === 'accepted')
  ))
  const sourceStatus = pickStatus(source.status)
  // Legacy expert tasks could be marked completed after producing only the first
  // requested deliverable. Reopen them as actionable work instead of presenting
  // an incomplete task as finished or leaving it stuck in a review-only state.
  const status = sourceStatus === 'completed' && !requestedComplete ? 'needs_input' : sourceStatus
  const kind = source.kind === 'expert' || source.expertId ? 'expert' : (source.kind === 'workflow' || source.workflowId ? 'workflow' : 'legacy')
  return {
    taskVersion: VERSION,
    id: text(source.id, 80) || genId(),
    kind,
    title: text(source.title, TITLE_MAX) || text(brief.goal, TITLE_MAX) || '未命名任务',
    expertId: text(source.expertId, 160),
    expertName: text(source.expertName, TITLE_MAX),
    workflowId: text(source.workflowId, 160),
    workflowName: text(source.workflowName, TITLE_MAX),
    goal: brief.goal,
    brief,
    assignmentSnapshot: normalizeAssignmentSnapshot(source.assignmentSnapshot || {
      agentId: source.expertId,
      agentVersion: source.expertVersion,
      agentHash: source.expertHash,
    }),
    visibility: source.visibility === 'organization' ? 'organization' : 'private',
    participants: normalizeParticipants(source.participants),
    events: normalizeEvents(source.events),
    deliverables,
    executionEvidence: normalizeExecutionEvidence(source.executionEvidence),
    resultSummary: text(source.resultSummary, SUMMARY_MAX),
    status,
    execRef: normalizeExecRef(source.execRef),
    taskRef: normalizeTaskRef(source.taskRef),
    knowledgeRefs: normalizeKnowledgeRefs(source.knowledgeRefs),
    pinned: Boolean(source.pinned),
    ...scheduleFields,
    legacySchedule: source.legacySchedule || (source.scheduleEnabled || source.schedule ? {
      scheduleEnabled: scheduleFields.scheduleEnabled,
      schedule: scheduleFields.schedule,
      scheduleLabel: scheduleFields.scheduleLabel,
    } : null),
    createdAt,
    updatedAt: text(source.updatedAt, 40) || createdAt,
  }
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return String(b.updatedAt).localeCompare(String(a.updatedAt))
  })
}

function createStore(file) {
  function loadAll() {
    const raw = readJson(file)
    const list = raw && [1, VERSION].includes(raw.version) && Array.isArray(raw.tasks) ? raw.tasks : []
    return list.map(normalizeTask)
  }

  function persist(tasks) {
    const trimmed = sortTasks(tasks).slice(0, LIST_MAX)
    writeJson(file, { version: VERSION, tasks: trimmed, updatedAt: nowIso() })
    return trimmed
  }

  function list() {
    return { ok: true, tasks: sortTasks(loadAll()) }
  }

  function get(id) {
    const key = text(id, 80)
    const task = loadAll().find(item => item.id === key)
    return task ? { ok: true, task } : { ok: false, error: '任务不存在' }
  }

  function create(input = {}) {
    const requestedGoal = text(input?.brief?.goal || input?.goal, GOAL_MAX)
    if (!requestedGoal) return { ok: false, error: '任务目标不能为空' }
    const task = normalizeTask({ ...input, id: '', createdAt: nowIso(), updatedAt: nowIso() })
    const tasks = loadAll()
    tasks.push(task)
    persist(tasks)
    return { ok: true, task }
  }

  function update(id, patch = {}) {
    const key = text(id, 80)
    const tasks = loadAll()
    const index = tasks.findIndex(item => item.id === key)
    if (index === -1) return { ok: false, error: '任务不存在' }
    const merged = normalizeTask({ ...tasks[index], ...(patch || {}), id: key, updatedAt: nowIso() })
    tasks[index] = merged
    persist(tasks)
    return { ok: true, task: merged }
  }

  function archive(id) {
    const key = text(id, 80)
    const tasks = loadAll().filter(item => item.id !== key)
    persist(tasks)
    return { ok: true }
  }

  function appendEvent(id, event) {
    const current = get(id)
    if (!current.ok) return current
    return update(id, { events: [...current.task.events, event] })
  }

  function reviewDeliverable(id, deliverableId, review = {}) {
    const current = get(id)
    if (!current.ok) return current
    const deliverables = current.task.deliverables.map(item => item.deliverableId === text(deliverableId, 120)
      ? {
          ...item,
          acceptanceStatus: review.action === 'accept' ? 'accepted' : 'changes_requested',
          comments: review.comment ? [...item.comments, { body: review.comment, authorId: review.actorId }] : item.comments,
        }
      : item)
    if (!deliverables.some(item => item.deliverableId === text(deliverableId, 120))) {
      return { ok: false, error: '交付物不存在' }
    }
    const reviewedItem = deliverables.find(item => item.deliverableId === text(deliverableId, 120))
    if (review.action === 'accept' && reviewedItem?.evidenceStatus === 'blocked') {
      return { ok: false, error: '该交付物缺少真实执行证据，不能验收' }
    }
    const requiredIds = (current.task.brief?.deliverables || [])
      .filter(item => item.required !== false).map(item => item.id)
    const allAccepted = requiredIds.length
      ? requiredIds.every(requiredId => deliverables.some(item => (
        item.deliverableId === requiredId
        && item.acceptanceStatus === 'accepted'
        && item.evidenceStatus !== 'blocked'
      )))
      : deliverables.filter(item => item.required).every(item => item.acceptanceStatus === 'accepted')
    return update(id, {
      deliverables,
      status: allAccepted ? 'completed' : (review.action === 'accept' ? 'review' : 'revising'),
      events: [...current.task.events, {
        type: review.action === 'accept' ? 'deliverable_accepted' : 'changes_requested',
        summary: text(review.comment, 500),
        actorId: review.actorId,
      }],
    })
  }

  return { list, get, create, update, archive, appendEvent, reviewDeliverable }
}

module.exports = {
  VERSION,
  STATUSES,
  EXEC_KINDS,
  KNOWLEDGE_REFS_MAX,
  SUMMARY_MAX,
  normalizeTask,
  normalizeKnowledgeRefs,
  normalizeTaskRef,
  normalizeExecRef,
  normalizeBrief,
  normalizeAssignmentSnapshot,
  normalizeDeliverables,
  normalizeExecutionEvidence,
  createStore,
}
