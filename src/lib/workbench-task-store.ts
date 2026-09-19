'use strict'

const fs = require('fs')
const path = require('path')
const { normalizeVerificationDiagnostics } = require('./agent-verification-diagnostics')
const { getViolationClaimLabels } = require('./agent-grounding-labels')
const { taskText, validateTaskTextFields } = require('./task-text-contract')
const { isExpertDeliverableComplete, projectExpertTaskLifecycle } = require('../shared/expert-task-lifecycle')
const {
  normalizeTaskScheduleFields,
} = require('./workbench-task-scheduler')

const VERSION = 2
const TITLE_MAX = 160
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

function stableLegacyIso(base, index) {
  const parsed = Date.parse(String(base || ''))
  const start = Number.isFinite(parsed) ? parsed : 0
  return new Date(start + Math.max(0, Number(index) || 0)).toISOString()
}

function sequence(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : Math.max(1, Number(fallback) || 1)
}

function activitySourceForTask(task) {
  if (String(task?.kind || '') === 'expert') return 'expert'
  if (String(task?.kind || '') === 'workflow') return 'workflow'
  if (String(task?.kind || '') === 'partner') return 'partner'
  return 'system'
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
  return (Array.isArray(raw) ? raw : []).map((value, index) => {
    const item = value && typeof value === 'object' ? value : { title: value }
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl.trim() : ''
    const isImage = item.kind === 'image' && /^data:image\/[\w.+-]+;base64,/i.test(dataUrl)
    return {
      id: text(item.id, 80) || `material-${index + 1}`,
      type: text(item.type, 40) || 'reference',
      title: text(item.title || item.name, 160) || `材料 ${index + 1}`,
      ref: safeRef(item.ref || item.resourceRef || item.path),
      content: taskText(item.content || item.text),
      ...(isImage ? {
        kind: 'image',
        mimeType: text(item.mimeType, 120) || dataUrl.slice(5, dataUrl.indexOf(';')),
        dataUrl,
      } : {}),
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
      requiredSkills: (Array.isArray(item.requiredSkills) ? item.requiredSkills : [])
        .map(value => text(value, 120)).filter(Boolean).slice(0, 32),
      requiredConnectorIds: (Array.isArray(item.requiredConnectorIds) ? item.requiredConnectorIds : [])
        .map(value => text(value, 120)).filter(Boolean).slice(0, 32),
      requiredEvidence: (Array.isArray(item.requiredEvidence) ? item.requiredEvidence : [])
        .filter(value => value && typeof value === 'object').slice(0, 16),
      requiredArtifacts: (Array.isArray(item.requiredArtifacts) ? item.requiredArtifacts : [])
        .filter(value => value && typeof value === 'object').slice(0, 16),
      minArtifacts: Math.max(0, Math.min(32, Math.floor(Number(item.minArtifacts) || 0))),
      completionConditions: (Array.isArray(item.completionConditions) ? item.completionConditions : [])
        .filter(value => value && typeof value === 'object').slice(0, 16),
    }
  })
}

function normalizeStringList(raw, maxItems = 16, maxChars = 400) {
  return (Array.isArray(raw) ? raw : [])
    .map(value => text(value, maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeHashMap(raw, maxItems = 32) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return Object.fromEntries(Object.keys(source).sort().slice(0, maxItems).flatMap((key) => {
    const id = text(key, 160)
    const hash = text(source[key], 180)
    return id ? [[id, hash]] : []
  }))
}

function normalizeQualificationResources(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 32).map(item => ({
    id: text(item?.id, 160),
    hash: text(item?.hash, 180),
  })).filter(item => item.id)
}

function normalizeQualificationContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  const configurationId = text(raw.configurationId, 180)
  return {
    contractVersion: Math.max(1, Math.min(20, Math.floor(Number(raw.contractVersion) || 1))),
    configurationId,
    complete: raw.complete === true && Boolean(configurationId),
    missing: normalizeStringList(raw.missing, 32, 180),
    runtime: { hash: text(raw.runtime?.hash, 180) },
    agent: {
      id: text(raw.agent?.id, 160),
      version: text(raw.agent?.version, 80),
      hash: text(raw.agent?.hash, 180),
    },
    skills: normalizeQualificationResources(raw.skills),
    connectors: normalizeQualificationResources(raw.connectors),
    model: {
      provider: text(raw.model?.provider, 80),
      id: text(raw.model?.id, 160),
      requestedId: text(raw.model?.requestedId, 160),
      label: text(raw.model?.label, 160),
      autoRouted: raw.model?.autoRouted === true,
    },
  }
}

function normalizeExpertPlan(raw) {
  const source = raw && typeof raw === 'object' ? raw : null
  if (!source) return null
  const plan = {
    goal: taskText(source.goal),
    deliverables: normalizeStringList(source.deliverables),
    acceptanceCriteria: normalizeStringList(source.acceptanceCriteria),
    capabilityUse: normalizeStringList(source.capabilityUse),
    steps: normalizeStringList(source.steps, 8, 600),
    risks: normalizeStringList(source.risks),
  }
  return plan.goal || plan.steps.length ? plan : null
}

function normalizeBrief(source) {
  const brief = source.brief && typeof source.brief === 'object' ? source.brief : {}
  const plan = normalizeExpertPlan(brief.plan || source.plan)
  const requestedGoal = taskText(brief.goal || source.goal)
  // 新协作房间会先以“待填写目标”创建；计划确认后，已确认的 plan.goal
  // 是任务的真实目标。归一化时就收敛它，保证重启后的任何读取面一致。
  const goal = (/(?:待填写目标|^与.+?(?:专家|Agent)协作$)/.test(requestedGoal) && plan?.goal)
    ? plan.goal
    : requestedGoal
  return {
    goal,
    plan,
    ...(['automatic', 'review'].includes(brief.completionPolicy) ? { completionPolicy: brief.completionPolicy } : {}),
    requiresMaterials: brief.requiresMaterials === true || source.requiresMaterials === true,
    requiredInputs: (Array.isArray(brief.requiredInputs) ? brief.requiredInputs : [])
      .map((item) => ({
        id: text(item?.id, 100),
        label: text(item?.label, 160),
        required: item?.required !== false,
      }))
      .filter((item) => item.id || item.label)
      .slice(0, 24),
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
    hashes: {
      expert: text(source.hashes?.expert || source.agentHash || source.contentHash || source.hash, 180),
      skills: normalizeHashMap(source.hashes?.skills || source.skillHashes),
      connectors: normalizeHashMap(source.hashes?.connectors || source.connectorHashes),
    },
    profileId: text(source.profileId, 80),
    profileVersion: text(source.profileVersion, 80),
    profileHash: text(source.profileHash, 180),
    snapshotRef: safeRef(source.snapshotRef || source.path, 300),
    bindings: {
      skills: normalizeStringList(source.bindings?.skills, 32, 160),
      connectors: normalizeStringList(source.bindings?.connectors, 32, 160),
    },
    optionalSkillIds: normalizeStringList(source.optionalSkillIds, 32, 160),
    permissions: source.permissions && typeof source.permissions === 'object'
      ? JSON.parse(JSON.stringify(source.permissions))
      : {},
    plan: normalizeExpertPlan(source.plan),
    sop: {
      version: text(source.sop?.version, 80),
      hash: text(source.sop?.hash, 180),
    },
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

function normalizeEvents(raw, fallbackBase, fallbackSource = 'system') {
  const values = Array.isArray(raw) ? raw : []
  const offset = Math.max(0, values.length - 200)
  return values.slice(-200).map((value, index) => {
    const item = value && typeof value === 'object' ? value : {}
    const legacyIndex = offset + index
    const type = text(item.type, 80) || 'updated'
    const userActivity = new Set(['input_provided', 'input_queued', 'plan_confirmed', 'changes_requested', 'deliverable_accepted']).has(type)
    const reviewActivity = type === 'changes_requested' || type === 'deliverable_accepted'
    const explicitSource = text(item.source, 80)
    const explicitActor = text(item.actorId, 120)
    // Before the activity contract, user actions were persisted with the task's
    // fallback source (or even as system review events). Recover their meaning
    // on read so old tasks render the same conversation as newly written tasks.
    const source = userActivity && (!explicitSource || explicitSource === fallbackSource || explicitSource === 'system')
      ? 'user'
      : explicitSource || fallbackSource
    const actorId = userActivity && (!explicitActor || source === 'user') ? 'user' : explicitActor
    return {
      id: text(item.id, 120) || `event-${legacyIndex + 1}`,
      type,
      kind: text(item.kind, 80) || (userActivity ? (reviewActivity ? 'review' : 'message') : 'event'),
      source,
      sequence: sequence(item.sequence, legacyIndex + 1),
      summary: text(item.summary, 500),
      actorId,
      createdAt: text(item.createdAt, 40) || stableLegacyIso(fallbackBase, legacyIndex),
    }
  })
}

function normalizeTaskAttention(raw) {
  if (!raw || typeof raw !== 'object') return null
  const kind = text(raw.kind, 80)
  const action = text(raw.action, 80)
  if (!kind || !action) return null
  return {
    kind,
    action,
    ...(text(raw.draftId, 160) ? { draftId: text(raw.draftId, 160) } : {}),
    ...(text(raw.runId, 160) ? { runId: text(raw.runId, 160) } : {}),
    title: text(raw.title, 180),
    detail: text(raw.detail, 800),
    field: text(raw.field, 120),
    item: text(raw.item, 180),
    question: text(raw.question, 500),
    example: text(raw.example, 500),
    options: normalizeStringList(raw.options, 4, 240),
    issues: (Array.isArray(raw.issues) ? raw.issues : []).slice(0, 8).map(issue => ({
      id: text(issue?.id, 160),
      code: text(issue?.code, 100),
      message: text(issue?.message, 500),
    })).filter(issue => issue.id),
    defaultValue: text(raw.defaultValue, 300),
    required: raw.required !== false,
    createdAt: text(raw.createdAt, 40) || nowIso(),
  }
}

function normalizeTaskProgress(raw) {
  if (!raw || typeof raw !== 'object') return null
  const phase = text(raw.phase, 80)
  const label = text(raw.label, 180)
  if (!phase && !label) return null
  return {
    phase,
    label,
    detail: text(raw.detail, 500),
    startedAt: text(raw.startedAt, 40),
    updatedAt: text(raw.updatedAt, 40),
    heartbeatAt: text(raw.heartbeatAt, 40),
  }
}

function normalizeInputQueue(raw) {
  if (!raw || typeof raw !== 'object') return null
  const pending = raw.pending === true
  const count = Math.max(0, Math.min(32, Math.floor(Number(raw.count) || 0)))
  if (!pending && !count) return null
  return {
    pending,
    count,
    queuedAt: text(raw.queuedAt, 40),
  }
}

function normalizeDeliverables(raw, fallbackBase, fallbackSource = 'system') {
  const values = Array.isArray(raw) ? raw : []
  const offset = Math.max(0, values.length - 80)
  return values.slice(-80).map((value, index) => {
    const item = value && typeof value === 'object' ? value : {}
    const legacyIndex = offset + index
    const version = Math.max(1, Math.floor(Number(item.version) || 1))
    return {
      deliverableId: text(item.deliverableId || item.id, 120) || `deliverable-${legacyIndex + 1}`,
      title: text(item.title, 160) || `交付物 ${legacyIndex + 1}`,
      type: text(item.type, 80) || 'document',
      version,
      required: item.required !== false,
      previousVersionId: text(item.previousVersionId, 120),
      artifactRef: safeRef(item.artifactRef || item.ref, 300),
      artifactRefs: [...new Set((Array.isArray(item.artifactRefs) ? item.artifactRefs : [item.artifactRef || item.ref])
        .map(value => safeRef(value, 300)).filter(Boolean))].slice(0, 32),
      executionRef: safeRef(item.executionRef || item.runRef, 300),
      kind: text(item.kind, 80) || 'deliverable',
      source: text(item.source, 80) || fallbackSource,
      sequence: sequence(item.sequence, legacyIndex + 1),
      evidenceStatus: ['verified', 'blocked', 'not_required'].includes(item.evidenceStatus)
        ? item.evidenceStatus
        : 'not_required',
      acceptanceStatus: ['pending', 'accepted', 'changes_requested', 'not_required'].includes(item.acceptanceStatus)
        ? item.acceptanceStatus
        : 'pending',
      comments: (Array.isArray(item.comments) ? item.comments : []).slice(-50).map((comment, commentIndex) => ({
        id: text(comment?.id, 120) || `comment-${legacyIndex + 1}-${commentIndex + 1}`,
        body: taskText(comment?.body || comment?.text),
        authorId: text(comment?.authorId, 120),
        createdAt: text(comment?.createdAt, 40) || stableLegacyIso(fallbackBase, legacyIndex * 1000 + commentIndex),
      })).filter(comment => comment.body),
      createdAt: text(item.createdAt, 40) || stableLegacyIso(fallbackBase, legacyIndex),
    }
  })
}

function normalizeExecutionEvidence(raw, fallbackBase) {
  const values = Array.isArray(raw) ? raw : []
  const offset = Math.max(0, values.length - 80)
  return values.slice(-80).map((value, index) => {
    const item = value && typeof value === 'object' ? value : {}
    const legacyIndex = offset + index
    const verificationDiagnostics = normalizeVerificationDiagnostics(item.verificationDiagnostics, {
      runId: text(item.runId, 160),
    })
    const qualificationContext = normalizeQualificationContext(item.qualificationContext)
    return {
      runId: text(item.runId, 160),
      deliverableId: text(item.deliverableId, 120),
      executionRoute: text(item.executionRoute, 160),
      gateStatus: ['verified', 'blocked', 'failed', 'not_required'].includes(item.gateStatus)
        ? item.gateStatus
        : 'not_required',
      verificationPassed: item.verificationPassed !== false,
      ...(verificationDiagnostics ? { verificationDiagnostics } : {}),
      ...(qualificationContext ? { qualificationContext } : {}),
      ...(item.qualityGuardrail && typeof item.qualityGuardrail === 'object' ? { qualityGuardrail: {
        mode: text(item.qualityGuardrail.mode, 80) || 'same_model_guardrail',
        enabled: item.qualityGuardrail.enabled === true,
        passed: item.qualityGuardrail.passed === true,
        rewritten: item.qualityGuardrail.rewritten === true,
        initialPassed: item.qualityGuardrail.initialPassed === true,
        finalPassed: item.qualityGuardrail.finalPassed === true,
        ...(item.qualityGuardrail.budgetExhausted === true ? { budgetExhausted: true } : {}),
        ...((Array.isArray(item.qualityGuardrail.issues) ? item.qualityGuardrail.issues : []).length ? {
          issues: item.qualityGuardrail.issues.slice(0, 12).map(issue => ({
            criterion: Number.isFinite(Number(issue?.criterion)) ? Number(issue.criterion) : 0,
            problem: text(issue?.problem, 500),
            requiredChange: text(issue?.requiredChange, 500),
          })).filter(issue => issue.problem || issue.requiredChange),
        } : {}),
      } } : {}),
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
        ...(getViolationClaimLabels(entry).length ? { claimLabels: getViolationClaimLabels(entry) } : {}),
      })),
      createdAt: text(item.createdAt, 40) || stableLegacyIso(fallbackBase, legacyIndex),
    }
  }).filter(item => item.runId)
}

function genId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeProjectSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  const projectId = text(raw.projectId, 100)
  const workspaceSourceId = text(raw.workspaceSourceId || raw.sourceId, 160)
  if (!projectId && !workspaceSourceId) return null
  return {
    projectId,
    workspaceSourceId,
    branch: text(raw.branch, 160),
    commit: text(raw.commit, 160),
    repositoryRef: text(raw.repositoryRef || raw.remoteProjectRef, 300),
    outputPolicy: {
      deliverablesDir: safeRef(raw.outputPolicy?.deliverablesDir || 'outputs', 240) || 'outputs',
      conflictStrategy: ['version', 'overwrite', 'ask'].includes(raw.outputPolicy?.conflictStrategy)
        ? raw.outputPolicy.conflictStrategy
        : 'version',
    },
    capturedAt: text(raw.capturedAt, 40) || nowIso(),
  }
}

function normalizeTask(raw = {}, legacyIndex = 0) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = text(source.createdAt, 40) || stableLegacyIso('', legacyIndex)
  const scheduleFields = normalizeTaskScheduleFields(source)
  const brief = normalizeBrief(source)
  const kind = source.kind === 'expert' || source.expertId ? 'expert' : (source.kind === 'workflow' || source.workflowId ? 'workflow' : 'legacy')
  const activitySource = activitySourceForTask({ kind })
  const deliverables = normalizeDeliverables(source.deliverables, createdAt, activitySource)
  const requiredDeliverableIds = brief.deliverables.filter(item => item.required !== false).map(item => item.id)
  const requestedComplete = !requiredDeliverableIds.length || requiredDeliverableIds.every(id => (
    deliverables.some(item => item.deliverableId === id && isExpertDeliverableComplete(item))
  ))
  const sourceStatus = pickStatus(source.status)
  // Legacy expert tasks could be marked completed after producing only the first
  // requested deliverable. Reopen them as actionable work instead of presenting
  // an incomplete task as finished or leaving it stuck in a review-only state.
  const status = sourceStatus === 'completed' && !requestedComplete ? 'needs_input' : sourceStatus
  return {
    taskVersion: VERSION,
    activityContractVersion: 1,
    id: text(source.id, 80) || genId(),
    projectId: text(source.projectId, 100) || null,
    projectSnapshot: normalizeProjectSnapshot(source.projectSnapshot),
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
    events: normalizeEvents(source.events, createdAt, activitySource),
    attention: normalizeTaskAttention(source.attention),
    progress: normalizeTaskProgress(source.progress),
    inputQueue: normalizeInputQueue(source.inputQueue),
    deliverables,
    executionEvidence: normalizeExecutionEvidence(source.executionEvidence, createdAt),
    resultSummary: text(source.resultSummary, SUMMARY_MAX),
    status,
    ...(kind === 'expert' ? { lifecycle: projectExpertTaskLifecycle({ ...source, status }) } : {}),
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
    return list.map((item, index) => normalizeTask(item, index))
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
    const validated = validateTaskTextFields(input)
    if (!validated.ok) return validated
    const requestedGoal = taskText(input?.brief?.goal || input?.goal)
    if (!requestedGoal) return { ok: false, error: '任务目标不能为空' }
    const task = normalizeTask({ ...input, id: '', createdAt: nowIso(), updatedAt: nowIso() })
    const tasks = loadAll()
    tasks.push(task)
    persist(tasks)
    return { ok: true, task }
  }

  function update(id, patch = {}) {
    const validated = validateTaskTextFields(patch)
    if (!validated.ok) return validated
    const key = text(id, 80)
    const tasks = loadAll()
    const index = tasks.findIndex(item => item.id === key)
    if (index === -1) return { ok: false, error: '任务不存在' }
    const current = tasks[index]
    const nextPatch = { ...(patch || {}) }
    if (Array.isArray(nextPatch.events)) {
      const knownIds = new Set(current.events.map((event) => event.id))
      let nextSequence = Math.max(0, ...current.events.map((event) => sequence(event.sequence, 0))) + 1
      const source = activitySourceForTask(current)
      nextPatch.events = nextPatch.events.map((event) => {
        if (!event || typeof event !== 'object' || knownIds.has(text(event.id, 120))) return event
        const hasSequence = Number.isFinite(Number(event.sequence)) && Number(event.sequence) > 0
        return {
          ...event,
          createdAt: text(event.createdAt, 40) || nowIso(),
          kind: text(event.kind, 80) || 'event',
          source: text(event.source, 80) || source,
          sequence: hasSequence ? sequence(event.sequence, nextSequence) : nextSequence++,
        }
      })
    }
    if (Array.isArray(nextPatch.deliverables)) {
      const knownKeys = new Set(current.deliverables.map((item) => `${item.deliverableId}:${item.version}`))
      let nextSequence = Math.max(0, ...current.deliverables.map((item) => sequence(item.sequence, 0))) + 1
      const source = activitySourceForTask(current)
      nextPatch.deliverables = nextPatch.deliverables.map((item) => {
        if (!item || typeof item !== 'object') return item
        const key = `${text(item.deliverableId || item.id, 120)}:${Math.max(1, Math.floor(Number(item.version) || 1))}`
        if (knownKeys.has(key)) return item
        const hasSequence = Number.isFinite(Number(item.sequence)) && Number(item.sequence) > 0
        return {
          ...item,
          createdAt: text(item.createdAt, 40) || nowIso(),
          kind: text(item.kind, 80) || 'deliverable',
          source: text(item.source, 80) || source,
          sequence: hasSequence ? sequence(item.sequence, nextSequence) : nextSequence++,
        }
      })
    }
    const merged = normalizeTask({ ...current, ...nextPatch, id: key, updatedAt: nowIso() })
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
    // Validate the raw batch before normalization can change it; update below
    // separately checks the combined old + new material count atomically.
    const validated = validateTaskTextFields({ materials: review.materials })
    if (!validated.ok) return validated
    const current = get(id)
    if (!current.ok) return current
    const deliverables = current.task.deliverables.map(item => item.deliverableId === text(deliverableId, 120)
      ? {
           ...item,
           acceptanceStatus: review.action === 'accept' ? 'accepted' : 'changes_requested',
           comments: review.comment ? [...item.comments, {
             id: `comment-${Date.now().toString(36)}`,
             body: review.comment,
             authorId: review.actorId,
             createdAt: nowIso(),
           }] : item.comments,
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
        && isExpertDeliverableComplete(item)
        && item.evidenceStatus !== 'blocked'
      )))
      : deliverables.filter(item => item.required).every(isExpertDeliverableComplete)
    return update(id, {
      brief: review.materials?.length
        ? {
            ...current.task.brief,
            materials: [...(current.task.brief?.materials || []), ...review.materials],
          }
        : current.task.brief,
      deliverables,
      status: allAccepted ? 'completed' : (review.action === 'accept' ? 'review' : 'revising'),
      events: [...current.task.events, {
        id: `review-${Date.now().toString(36)}`,
        type: review.action === 'accept' ? 'deliverable_accepted' : 'changes_requested',
        kind: 'review',
        source: 'user',
        summary: text(review.comment, 500),
        actorId: review.actorId || 'user',
        createdAt: nowIso(),
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
  normalizeExpertPlan,
  normalizeAssignmentSnapshot,
  normalizeDeliverables,
  normalizeExecutionEvidence,
  normalizeProjectSnapshot,
  createStore,
}
