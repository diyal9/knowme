'use strict'

const crypto = require('crypto')
const {
  VERSION,
  LIMITS,
  STEPS,
  STATUSES,
  DOMAINS,
  RESOURCE_TYPES,
  LAUNCHED_STATUSES,
  RECOVERABLE_STATUSES,
  SECRET_KEY,
  nowIso,
  text,
  pickEnum,
  safeTree,
  normalizeInputRef,
  normalizeInputRefs,
} = require('./workbench-launch-sanitize')

function normalizeLaunchIntent(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const step = pickEnum(source.step, STEPS, 'intent')
  const status = pickEnum(source.status, STATUSES, 'draft')
  const domain = pickEnum(source.domain, DOMAINS, '')
  const resourceType = pickEnum(source.resourceType, RESOURCE_TYPES, text(source.resourceType, LIMITS.resourceType))
  const profileSnapshot = safeTree(source.profileSnapshot, 0, LIMITS.profileSnapshotDepth)
  const returnState = safeTree(source.returnState, 0, LIMITS.returnStateDepth)

  return {
    version: VERSION,
    step,
    domain,
    resourceType,
    resourceId: text(source.resourceId, LIMITS.resourceId),
    goal: text(source.goal, LIMITS.goal),
    inputRefs: normalizeInputRefs(source.inputRefs),
    backend: text(source.backend, LIMITS.backend),
    profileSnapshot,
    runId: text(source.runId, LIMITS.runId),
    rootRunId: text(source.rootRunId, LIMITS.rootRunId),
    slug: text(source.slug, LIMITS.slug),
    executionSource: text(source.executionSource, LIMITS.executionSource),
    returnState,
    status,
    updatedAt: text(source.updatedAt, 40) || nowIso(),
  }
}

function patchLaunchIntent(current = {}, patch = {}) {
  const base = normalizeLaunchIntent(current)
  const next = normalizeLaunchIntent({ ...base, ...(patch || {}), updatedAt: nowIso() })
  if (Array.isArray(patch?.inputRefs)) next.inputRefs = normalizeInputRefs(patch.inputRefs)
  if (patch?.profileSnapshot !== undefined) {
    next.profileSnapshot = safeTree(patch.profileSnapshot, 0, LIMITS.profileSnapshotDepth)
  }
  if (patch?.returnState !== undefined) {
    next.returnState = safeTree(patch.returnState, 0, LIMITS.returnStateDepth)
  }
  const identityBefore = JSON.stringify({
    domain: base.domain,
    resourceType: base.resourceType,
    resourceId: base.resourceId,
    goal: base.goal,
    inputRefs: base.inputRefs,
    profileSnapshot: base.profileSnapshot,
  })
  const identityAfter = JSON.stringify({
    domain: next.domain,
    resourceType: next.resourceType,
    resourceId: next.resourceId,
    goal: next.goal,
    inputRefs: next.inputRefs,
    profileSnapshot: next.profileSnapshot,
  })
  const suppliesRunRef = ['runId', 'rootRunId', 'slug'].some(key =>
    Object.prototype.hasOwnProperty.call(patch || {}, key))
  if (identityBefore !== identityAfter && !suppliesRunRef) {
    next.runId = ''
    next.rootRunId = ''
    next.slug = ''
    if (!Object.prototype.hasOwnProperty.call(patch || {}, 'backend')) next.backend = ''
    if (!Object.prototype.hasOwnProperty.call(patch || {}, 'executionSource')) next.executionSource = ''
  }
  return next
}

function launchFingerprint(intent = {}) {
  const normalized = normalizeLaunchIntent(intent)
  const payload = {
    domain: normalized.domain,
    resourceType: normalized.resourceType,
    resourceId: normalized.resourceId,
    goal: normalized.goal,
    backend: normalized.backend,
    slug: normalized.slug,
    executionSource: normalized.executionSource,
    inputRefs: normalized.inputRefs.map(ref => ({
      id: ref.id,
      kind: ref.kind,
      hash: ref.hash || '',
    })),
  }
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)
}

function missingFields(intent = {}) {
  const normalized = normalizeLaunchIntent(intent)
  const missing = []
  if (!normalized.goal && !normalized.resourceId && !normalized.slug) missing.push('goal')
  if (!normalized.resourceType && !normalized.executionSource) missing.push('resourceType')
  if (!normalized.resourceId && normalized.resourceType && normalized.resourceType !== 'artifact') {
    missing.push('resourceId')
  }
  return missing
}

function assessLaunchReadiness(intent = {}, options = {}) {
  const normalized = normalizeLaunchIntent(intent)
  const blockers = []
  const missing = missingFields(normalized)

  for (const field of missing) {
    blockers.push({ id: `missing-${field}`, label: `缺少 ${field}`, kind: 'input', status: 'missing' })
  }

  if (normalized.status === 'blocked') {
    blockers.push({ id: 'intent-blocked', label: '启动意图被阻断', kind: 'state', status: 'blocked' })
  }

  if (options.requireBackend !== false && !normalized.backend && normalized.step === 'launch') {
    blockers.push({ id: 'missing-backend', label: '缺少执行后端', kind: 'backend', status: 'missing' })
  }

  const ready = blockers.length === 0 && normalized.step !== 'launch'
    ? normalized.step === 'confirm' || normalized.status === 'ready'
    : blockers.length === 0 && normalized.step === 'launch' && Boolean(normalized.backend)

  let nextStep = normalized.step
  if (missing.length) nextStep = 'inputs'
  else if (blockers.some(item => item.kind === 'backend')) nextStep = 'readiness'
  else if (ready && normalized.step === 'readiness') nextStep = 'confirm'
  else if (ready && normalized.step === 'confirm') nextStep = 'launch'

  return {
    ready,
    step: nextStep,
    status: ready ? (normalized.status === 'blocked' ? 'blocked' : 'ready') : 'draft',
    blockers: blockers.slice(0, 8),
    fingerprint: launchFingerprint(normalized),
  }
}

function isRecoverableLaunch(intent = {}) {
  const normalized = normalizeLaunchIntent(intent)
  if (LAUNCHED_STATUSES.has(normalized.status)) return false
  if (!RECOVERABLE_STATUSES.has(normalized.status)) return false
  return Boolean(
    normalized.goal
    || normalized.resourceId
    || normalized.slug
    || normalized.inputRefs.length
    || normalized.rootRunId,
  )
}

function guardDuplicateLaunch(existing = {}, incoming = {}, options = {}) {
  const prev = normalizeLaunchIntent(existing)
  const next = normalizeLaunchIntent(incoming)
  const fingerprint = launchFingerprint(next)
  const sameIntent = fingerprint === launchFingerprint(prev)

  if (!sameIntent) {
    return { ok: true, duplicate: false, intent: next, fingerprint }
  }

  if (options.allowRelaunch) {
    return { ok: true, duplicate: false, intent: next, fingerprint }
  }

  if (LAUNCHED_STATUSES.has(prev.status) && (prev.runId || prev.rootRunId)) {
    return {
      ok: false,
      duplicate: true,
      error: 'duplicate_launch',
      intent: prev,
      fingerprint,
      runId: prev.runId || prev.rootRunId,
    }
  }

  if (prev.status === 'launching') {
    return {
      ok: false,
      duplicate: true,
      error: 'duplicate_launch',
      intent: prev,
      fingerprint,
      runId: prev.runId || prev.rootRunId,
    }
  }

  return { ok: true, duplicate: false, intent: next, fingerprint }
}

function markLaunchStarted(intent = {}, refs = {}) {
  const next = patchLaunchIntent(intent, {
    status: 'launching',
    step: 'launch',
    runId: refs.runId || intent.runId,
    rootRunId: refs.rootRunId || intent.rootRunId || refs.runId || intent.runId,
    slug: refs.slug || intent.slug,
    executionSource: refs.executionSource || intent.executionSource,
    backend: refs.backend || intent.backend,
  })
  return next
}

function markLaunchCompleted(intent = {}, refs = {}) {
  return patchLaunchIntent(intent, {
    status: 'launched',
    step: 'launch',
    runId: refs.runId || intent.runId,
    rootRunId: refs.rootRunId || intent.rootRunId || refs.runId || intent.runId,
    slug: refs.slug || intent.slug,
  })
}

function launchIntentFromLegacy(source = {}) {
  const raw = source && typeof source === 'object' ? source : {}
  const inputRefs = normalizeInputRefs([
    ...(Array.isArray(raw.inputRefs) ? raw.inputRefs : []),
    ...(Array.isArray(raw.artifactRefs) ? raw.artifactRefs : []),
    ...(Array.isArray(raw.skillRefs) ? raw.skillRefs : []),
  ])

  let resourceType = text(raw.resourceType, LIMITS.resourceType)
  let resourceId = text(raw.resourceId, LIMITS.resourceId)
  if (!resourceId && raw.workflowId) {
    resourceId = text(raw.workflowId, LIMITS.resourceId)
    if (!resourceType) resourceType = 'pipeline'
  }
  if (!resourceId && raw.compositionId) {
    resourceId = text(raw.compositionId, LIMITS.resourceId)
    if (!resourceType) resourceType = 'graph'
  }
  if (!resourceId && raw.goalId) {
    resourceId = text(raw.goalId, LIMITS.resourceId)
  }

  const profileSnapshot = safeTree(
    raw.profileSnapshot
      || (Array.isArray(raw.profileIds) && raw.profileIds.length
        ? { profileIds: raw.profileIds.slice(0, LIMITS.inputRefs) }
        : undefined)
      || raw.composition,
    0,
    LIMITS.profileSnapshotDepth,
  )

  return normalizeLaunchIntent({
    step: raw.step,
    domain: raw.domain || raw.modeId,
    resourceType,
    resourceId,
    goal: raw.goal,
    inputRefs,
    backend: raw.backend,
    profileSnapshot,
    runId: raw.runId,
    rootRunId: raw.rootRunId,
    slug: raw.slug,
    executionSource: raw.executionSource,
    returnState: raw.returnState,
    status: raw.status,
    updatedAt: raw.updatedAt,
  })
}

function deriveLegacyContextFields(intent = {}) {
  const normalized = normalizeLaunchIntent(intent)
  return {
    goal: normalized.goal,
    goalId: normalized.slug || normalized.resourceId,
    workflowId: normalized.resourceType === 'pipeline' ? normalized.resourceId : '',
    workflowVersion: text(intent.workflowVersion, 40),
    compositionId: normalized.resourceType === 'graph' ? normalized.resourceId : '',
    compositionHash: text(intent.compositionHash, 160),
    rootRunId: normalized.rootRunId,
    executionSource: normalized.executionSource,
    artifactRefs: normalized.inputRefs,
  }
}

function deriveLegacyDraftFields(intent = {}) {
  const normalized = normalizeLaunchIntent(intent)
  const profileIds = Array.isArray(normalized.profileSnapshot?.profileIds)
    ? normalized.profileSnapshot.profileIds.map(id => text(id, 120)).filter(Boolean).slice(0, LIMITS.inputRefs)
    : []

  return {
    goal: normalized.goal,
    goalId: normalized.slug || normalized.resourceId,
    workflowId: normalized.resourceType === 'pipeline' ? normalized.resourceId : '',
    workflowVersion: text(intent.workflowVersion, 40),
    compositionId: normalized.resourceType === 'graph' ? normalized.resourceId : '',
    slug: normalized.slug,
    phase: normalized.status === 'cancelled'
      ? 'cancelled'
      : (normalized.step === 'launch' ? 'running' : 'preparing'),
    executionSource: normalized.executionSource,
    rootRunId: normalized.rootRunId,
    artifactRefs: normalized.inputRefs,
    profileIds,
    composition: normalized.profileSnapshot,
  }
}

module.exports = {
  VERSION,
  LIMITS,
  STEPS,
  STATUSES,
  DOMAINS,
  RESOURCE_TYPES,
  SECRET_KEY,
  normalizeLaunchIntent,
  patchLaunchIntent,
  launchFingerprint,
  assessLaunchReadiness,
  isRecoverableLaunch,
  guardDuplicateLaunch,
  markLaunchStarted,
  markLaunchCompleted,
  launchIntentFromLegacy,
  deriveLegacyContextFields,
  deriveLegacyDraftFields,
  normalizeInputRef,
  normalizeInputRefs,
}
