'use strict'

const launchModel = require('./workbench-launch-model')
const workbenchConsoleModel = require('./workbench-console-model')

const LEGACY_BACKEND = 'legacy-local'
const WORKFLOW_RESOURCE = 'workflow'

function normalizeResourceType(value) {
  const type = String(value || '').trim().toLowerCase()
  if (type === WORKFLOW_RESOURCE) return 'pipeline'
  return type
}

function normalizeIncomingIntent(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const intent = launchModel.normalizeLaunchIntent(source)
  return launchModel.normalizeLaunchIntent({
    ...intent,
    resourceType: normalizeResourceType(intent.resourceType),
  })
}

function mergeFacts(input = {}) {
  const facts = input && typeof input === 'object' ? input : {}
  return workbenchConsoleModel.buildVerticalPipelineFacts({
    daemonOnline: facts.daemonOnline === true,
    localTeamEnabled: facts.localTeamEnabled !== false,
    officeAgentReady: facts.officeAgentReady === true,
    meetingConnectorReady: facts.meetingConnectorReady === true,
    documentConnectorReady: facts.documentConnectorReady === true,
    visualAgentReady: facts.visualAgentReady === true,
    imageProviderReady: facts.imageProviderReady === true,
    engineeringWorkflowCount: Number(facts.engineeringWorkflowCount) || 0,
    availableExpertIds: Array.isArray(facts.availableExpertIds) ? facts.availableExpertIds : [],
  })
}

function packageBackends(packageItem = {}) {
  const source = packageItem && typeof packageItem === 'object' ? packageItem : {}
  return (Array.isArray(source.executionBackends) ? source.executionBackends : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function chooseBackend(intent = {}, options = {}) {
  const normalized = normalizeIncomingIntent(intent)
  if (normalized.backend) {
    if (normalized.backend === LEGACY_BACKEND) {
      return { ok: false, code: 'legacy_readonly', error: 'Legacy 本地后端只读，请改用管线服务或 Local Team Runtime' }
    }
    if (!['daemon', 'local-team'].includes(normalized.backend)) {
      return { ok: false, code: 'backend_unsupported', error: '所选执行后端不受支持' }
    }
    if (options.skipRuntimeValidation === true) {
      return { ok: true, backend: normalized.backend }
    }
    if (normalizeResourceType(normalized.resourceType) === 'pipeline' && normalized.resourceId) {
      const verticalFacts = workbenchConsoleModel.buildVerticalPipelineFacts(options.facts || {})
      const resolved = workbenchConsoleModel.resolveVerticalPipelineById(normalized.resourceId, verticalFacts)
      if (resolved && !resolved.readiness.ready) {
        return {
          ok: false,
          code: 'pipeline_blocked',
          error: '所选 Workflow Package 的运行依赖尚未就绪',
          blockers: resolved.readiness.blockers,
          repairAction: resolved.readiness.repairAction,
        }
      }
    }
    if (normalized.backend === 'daemon' && options.facts?.daemonOnline !== true) {
      return { ok: false, code: 'daemon_offline', error: '管线服务当前离线' }
    }
    if (normalized.backend === 'local-team' && options.facts?.localTeamEnabled === false) {
      return { ok: false, code: 'local_team_disabled', error: 'Local Team Runtime 当前不可用' }
    }
    const declared = packageBackends(options.packageItem).filter(item => item !== LEGACY_BACKEND)
    if (declared.length && !declared.includes(normalized.backend)) {
      return { ok: false, code: 'backend_unsupported', error: '该资源不支持所选执行后端' }
    }
    return { ok: true, backend: normalized.backend }
  }

  const resourceType = normalizeResourceType(normalized.resourceType)
  if (['graph', 'agent', 'composition'].includes(resourceType)) {
    return { ok: true, backend: 'local-team' }
  }

  if (resourceType === 'pipeline' && normalized.resourceId) {
    const verticalFacts = workbenchConsoleModel.buildVerticalPipelineFacts(options.facts || {})
    const resolved = workbenchConsoleModel.resolveVerticalPipelineById(normalized.resourceId, verticalFacts)
    if (resolved && !resolved.readiness.ready) {
      return {
        ok: false,
        code: 'pipeline_blocked',
        error: '所选 Workflow Package 的运行依赖尚未就绪',
        blockers: resolved.readiness.blockers,
        repairAction: resolved.readiness.repairAction,
      }
    }
    const declared = packageBackends(options.packageItem).filter(item => item !== LEGACY_BACKEND)
    if (declared.length) {
      const preferred = declared.includes('daemon') && options.facts?.daemonOnline
        ? 'daemon'
        : (declared.includes('local-team') ? 'local-team' : declared[0])
      return preferred
        ? { ok: true, backend: preferred }
        : { ok: false, code: 'backend_unavailable', error: '当前没有可用执行后端' }
    }
    const facts = mergeFacts(options.facts)
    const resolvedFromFacts = workbenchConsoleModel.resolveVerticalPipelineById(normalized.resourceId, facts)
    const readinessBackend = resolvedFromFacts?.readiness?.backend
    const allowed = packageBackends(resolvedFromFacts?.package)
      .filter(item => item !== LEGACY_BACKEND)
    const preferred = readinessBackend && allowed.includes(readinessBackend)
      ? readinessBackend
      : (allowed.includes('daemon') && facts.daemonOnline ? 'daemon'
        : (allowed.includes('local-team') ? 'local-team' : readinessBackend))
    if (!preferred || preferred === LEGACY_BACKEND) {
      return {
        ok: false,
        code: 'backend_unavailable',
        error: '当前没有可用执行后端',
        blockers: resolvedFromFacts?.readiness?.blockers || [],
      }
    }
    return { ok: true, backend: preferred, readiness: resolvedFromFacts?.readiness }
  }

  if (normalized.backend === '') {
    return { ok: false, code: 'missing_backend', error: '缺少执行后端' }
  }

  return { ok: false, code: 'backend_unavailable', error: '无法解析执行后端' }
}

function determineRoute(intent = {}, options = {}) {
  const normalized = normalizeIncomingIntent(intent)
  const resourceType = normalizeResourceType(normalized.resourceType)
  const packageItem = options.packageItem && typeof options.packageItem === 'object'
    ? options.packageItem
    : null
  const graphNodes = packageItem?.graph?.nodes?.length
    || normalized.profileSnapshot?.nodes?.length
    || 0
  const agentCount = Array.isArray(packageItem?.agentRefs) ? packageItem.agentRefs.length : 0

  if (resourceType === 'pipeline') {
    if (normalized.backend === 'daemon') return 'confirm-daemon-workflow'
    if (normalized.backend === 'local-team') {
      return graphNodes || agentCount ? 'confirm-agent-graph' : 'confirm-local-workflow'
    }
    return 'drawer-readiness'
  }
  if (resourceType === 'graph' || resourceType === 'composition') return 'confirm-agent-graph'
  if (resourceType === 'agent') return 'plan-agent-run'
  if (resourceType === 'artifact') return 'drawer-inputs'
  if (resourceType === 'automation') return 'confirm-daemon-workflow'
  return 'drawer'
}

function assessIntent(intent = {}, options = {}) {
  const normalized = normalizeIncomingIntent(intent)
  const backendResult = chooseBackend(normalized, options)
  const patched = backendResult.ok
    ? launchModel.patchLaunchIntent(normalized, { backend: backendResult.backend })
    : normalized
  const readiness = launchModel.assessLaunchReadiness(patched, {
    requireBackend: patched.step === 'launch' || patched.step === 'confirm',
  })
  if (!backendResult.ok) {
    readiness.ready = false
    readiness.blockers = [
      ...(readiness.blockers || []),
      {
        id: backendResult.code || 'backend_unavailable',
        label: backendResult.error || '执行后端不可用',
        kind: 'backend',
        status: 'blocked',
      },
    ]
  }
  return {
    ok: true,
    intent: patched,
    readiness,
    backend: backendResult.backend || '',
    recoverable: launchModel.isRecoverableLaunch(patched),
    route: determineRoute(patched, options),
  }
}

function saveIntent(stores = {}, patch = {}, options = {}) {
  const persist = String(options.persist || 'both')
  const saveOptions = options.saveOptions || {}
  let contextResult = { ok: true, context: stores.context?.launchIntent ? { launchIntent: stores.context.launchIntent } : {} }
  let draftResult = { ok: true, draft: stores.draft?.launchIntent ? { launchIntent: stores.draft.launchIntent } : null }

  if (persist === 'context' || persist === 'both') {
    contextResult = stores.contextStore.saveLaunchIntent(patch, saveOptions)
    if (!contextResult.ok) {
      return {
        ok: false,
        duplicate: contextResult.duplicate === true,
        error: contextResult.error,
        runId: contextResult.runId,
        intent: contextResult.context?.launchIntent,
        context: contextResult.context,
        draft: draftResult.draft,
      }
    }
  }
  if (persist === 'draft' || persist === 'both') {
    draftResult = stores.draftStore.saveLaunchIntent(patch, saveOptions)
    if (!draftResult.ok) {
      return {
        ok: false,
        duplicate: draftResult.duplicate === true,
        error: draftResult.error,
        runId: draftResult.runId,
        intent: draftResult.draft?.launchIntent,
        context: contextResult.context,
        draft: draftResult.draft,
      }
    }
  }

  const intent = draftResult.draft?.launchIntent || contextResult.context?.launchIntent
  const assessed = assessIntent(intent, options)
  return {
    ok: true,
    intent: assessed.intent,
    readiness: assessed.readiness,
    route: assessed.route,
    context: contextResult.context,
    draft: draftResult.draft,
  }
}

function prepareStart(stores = {}, intent = {}, options = {}) {
  const current = stores.context?.launchIntent || stores.draft?.launchIntent || {}
  const normalized = normalizeIncomingIntent(intent)
  const guard = launchModel.guardDuplicateLaunch(current, normalized, options)
  if (!guard.ok) {
    return {
      ok: false,
      duplicate: true,
      error: guard.error,
      runId: guard.runId,
      intent: guard.intent,
    }
  }

  const assessed = assessIntent(guard.intent, options)
  if (!assessed.readiness.ready && assessed.intent.step === 'launch') {
    return {
      ok: false,
      error: '启动条件尚未满足',
      intent: assessed.intent,
      readiness: assessed.readiness,
      route: assessed.route,
    }
  }

  const prepared = launchModel.patchLaunchIntent(assessed.intent, {
    step: assessed.route.startsWith('confirm') || assessed.route === 'plan-agent-run' ? 'confirm' : 'readiness',
    status: assessed.readiness.ready ? 'ready' : 'draft',
    backend: assessed.backend || assessed.intent.backend,
    executionSource: assessed.intent.executionSource || assessed.backend,
  })
  const saved = saveIntent(stores, prepared, { ...options, persist: 'both' })
  if (!saved.ok) return saved

  return {
    ok: true,
    route: assessed.route,
    intent: saved.intent,
    readiness: saved.readiness,
  }
}

function completeStart(stores = {}, refs = {}) {
  const current = stores.draft?.launchIntent || stores.context?.launchIntent || {}
  const completed = launchModel.markLaunchCompleted(current, refs)
  return saveIntent(stores, completed, { persist: 'both', skipRuntimeValidation: true })
}

function ingestLaunchRequest(launchRequest = {}, extras = {}) {
  const source = launchRequest && typeof launchRequest === 'object' ? launchRequest : {}
  return normalizeIncomingIntent({
    domain: source.domain,
    resourceType: normalizeResourceType(source.resourceType),
    resourceId: source.resourceId,
    goal: source.goal,
    backend: source.backend,
    inputRefs: source.inputRefs,
    returnState: { ...(source.returnState || {}), ...(extras.returnState || {}) },
    executionSource: extras.executionSource || 'automation',
    step: 'confirm',
    status: 'ready',
  })
}

module.exports = {
  normalizeIncomingIntent,
  normalizeResourceType,
  chooseBackend,
  determineRoute,
  assessIntent,
  saveIntent,
  prepareStart,
  completeStart,
  ingestLaunchRequest,
}
