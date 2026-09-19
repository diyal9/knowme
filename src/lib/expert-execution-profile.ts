'use strict'

/**
 * Expert execution is capability driven.  The host consumes this normalized
 * profile and must not branch on a concrete expert id.
 */

const IMAGE_FILE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i
const CONVERSATIONAL_OUTPUT_TYPES = new Set(['answer', 'reply', 'response', 'text', 'chat'])
const FILE_DELIVERABLE_TITLE_PATTERN = /(?:\bPRD\b|需求文档|需求说明书|设计说明书|报告|方案(?:文档|文件)|纪要|合同|\bSOP\b)/i
const { isTaskControlMaterial } = require('./task-material-kind')
const { isExpertDeliverableComplete, isExpertDeliverableReady } = require('../shared/expert-task-lifecycle')
const { getArtifact } = require('./agent-artifact-tools')

function stringList(value, max = 64) {
  const values = Array.isArray(value) ? value : []
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))].slice(0, max)
}

function executionMetadata(snapshot) {
  const value = snapshot?.capabilityManifest?.metadata?.knowme?.execution
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizedQualityReview(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.enabled !== true) return null
  const criteria = stringList(raw.criteria, 12).map(item => item.slice(0, 360))
  return criteria.length ? { enabled: true, criteria } : null
}

function qualityReviewContract(snapshot, outputSpec = {}) {
  return normalizedQualityReview(outputSpec?.qualityReview)
    || normalizedQualityReview(executionMetadata(snapshot).qualityReview)
}

function declaredDeliverables(snapshot) {
  const declared = executionMetadata(snapshot).deliverables
  if (Array.isArray(declared)) {
    const rows = declared.filter(item => item && typeof item === 'object')
    const ids = new Set(rows.map(item => String(item.id || '')).filter(Boolean))
    return rows.filter(item => !item.mergeInto || !ids.has(String(item.mergeInto)))
  }
  if (declared && typeof declared === 'object') {
    return Object.entries(declared).map(([id, item]) => ({ id, ...(item && typeof item === 'object' ? item : {}) }))
  }
  return []
}

function mergeDeliverableContract(base = {}, declared = {}) {
  // Hydration runs on load, plan confirmation and retry. Set union must be
  // idempotent, including contracts persisted by older versions with duplicates.
  const unionRules = (key) => {
    const rules = new Map()
    for (const rule of [...(base[key] || []), ...(declared[key] || [])]) {
      if (!rule || typeof rule !== 'object') continue
      const stable = JSON.stringify(Object.keys(rule).sort().map(name => [name, rule[name]]))
      rules.set(stable, rule)
    }
    return [...rules.values()]
  }
  const title = String(declared.title || base.title || '任务成果')
  const rawType = String(declared.type || base.type || 'document').trim().toLowerCase()
  const type = CONVERSATIONAL_OUTPUT_TYPES.has(rawType) && FILE_DELIVERABLE_TITLE_PATTERN.test(title)
    ? 'document'
    : rawType || 'document'
  const artifactRequired = FILE_DELIVERABLE_TITLE_PATTERN.test(title)
    || Number(base.minArtifacts) > 0 || Number(declared.minArtifacts) > 0
    || (base.requiredArtifacts || []).length > 0 || (declared.requiredArtifacts || []).length > 0
    || [...(base.completionConditions || []), ...(declared.completionConditions || [])]
      .some(condition => condition?.type === 'artifact_present')
  const completionConditions = unionRules('completionConditions')
  if (artifactRequired && !completionConditions.some(condition => condition?.type === 'artifact_present')) {
    completionConditions.push({ type: 'artifact_present' })
  }
  return {
    ...base,
    ...declared,
    id: String(declared.id || base.id || 'primary'),
    title,
    type,
    required: declared.required !== false && base.required !== false,
    requiredTools: stringList([...(base.requiredTools || []), ...(declared.requiredTools || [])]),
    requiredSkills: stringList([...(base.requiredSkills || []), ...(declared.requiredSkills || [])]),
    requiredConnectorIds: stringList([...(base.requiredConnectorIds || []), ...(declared.requiredConnectorIds || [])]),
    requiredEvidence: unionRules('requiredEvidence'),
    requiredArtifacts: unionRules('requiredArtifacts'),
    completionConditions,
    minArtifacts: Math.max(Number(base.minArtifacts) || 0, Number(declared.minArtifacts) || 0, artifactRequired ? 1 : 0),
  }
}

function hydrateDeliverableContracts(brief = {}, snapshot) {
  const requested = Array.isArray(brief?.deliverables) ? brief.deliverables : []
  const declared = declaredDeliverables(snapshot)
  const source = requested.length ? requested : declared
  const deliverables = source.map((item, index) => {
    const base = item && typeof item === 'object' ? item : { title: item }
    const id = String(base.id || `output-${index + 1}`)
    // A sole package default is not the same artifact as a sole user-owned
    // deliverable. Inherit its method/evidence contract without replacing the
    // user's identity fields. Artifact contracts remain authoritative because
    // a legacy document placeholder must not weaken a required image/file.
    const exact = declared.find(candidate => String(candidate.id || '') === id)
    const soleDefault = requested.length === 1 && declared.length === 1 ? declared[0] : null
    const declaredMatch = exact || soleDefault
    const inheritedDefault = declaredMatch && !expectsArtifact(declaredMatch)
      ? {
          ...declaredMatch,
          id,
          title: base.title || declaredMatch.title,
          type: base.type || declaredMatch.type,
        }
      : declaredMatch || {}
    const matching = inheritedDefault
    return mergeDeliverableContract({ ...base, id }, matching)
  })
  return { ...(brief || {}), deliverables }
}

function routeKeywords(route) {
  if (Array.isArray(route?.keywords)) return route.keywords.map(String).map(item => item.trim()).filter(Boolean)
  return String(route?.keywords || '').split(',').map(item => item.trim()).filter(Boolean)
}

function conditionKeywords(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

function hasReadableMaterials(task) {
  const materials = Array.isArray(task?.brief?.materials) ? task.brief.materials : []
  return materials.some((item) => {
    if (typeof item === 'string') return item.trim().length > 0
    if (!item || typeof item !== 'object') return false
    if (isTaskControlMaterial(item) || item.type === 'image' || item.kind === 'image' || item.dataUrl) return false
    return [item.content, item.text].some(value => typeof value === 'string' && value.trim().length > 0)
  })
}

function routeMatchesWhen(route, task, source) {
  const when = route?.when
  if (!when || typeof when !== 'object' || Array.isArray(when)) return true
  if (typeof when.hasReadableMaterials === 'boolean'
    && hasReadableMaterials(task) !== when.hasReadableMaterials) return false
  const excluded = conditionKeywords(when.noneKeywords)
  return !excluded.some(keyword => source.includes(keyword.toLowerCase()))
}

function selectExecutionRouteWithMatch(task, snapshot) {
  const routes = executionMetadata(snapshot).routes
  if (!Array.isArray(routes) || !routes.length) {
    return { route: null, match: 'none' }
  }
  const goalSource = [
    task?.brief?.goal,
    task?.goal,
    task?.brief?.plan?.goal,
  ].filter(Boolean).join('\n').toLowerCase()
  // Generated steps are not user route intent. Host-recorded user supplements
  // also support legacy clarification resumes without trusting generated steps.
  const routeHints = (task?.brief?.materials || [])
    .filter(item => String(item?.id || '').startsWith('user-input-') && !isTaskControlMaterial(item))
    .map(item => String(item.content || item.text || ''))
  let source = goalSource
  const findMatches = () => routes.filter((route) => {
    if (!routeMatchesWhen(route, task, source)) return false
    const keywords = routeKeywords(route)
    if (keywords.length > 0) return keywords.some(keyword => source.includes(keyword.toLowerCase()))
    return Object.prototype.hasOwnProperty.call(route?.when || {}, 'hasReadableMaterials')
  })
  let matches = findMatches()
  // Consult explicit supplements only when the goal has no eligible route.
  if (!matches.length && routeHints.length) {
    source = [goalSource, ...routeHints].join('\n').toLowerCase()
    matches = findMatches()
  }
  // Explicit user intent must beat a generic material/condition fallback even
  // when the manifest lists that fallback earlier. This keeps provided-material
  // routes safe without allowing them to swallow specialist routes such as
  // public research or knowledge curation.
  // Prefer the most specific matching vocabulary, preserving declaration order
  // for ties. A generic "待办" must not steal a goal about 飞书/群聊/私聊消息.
  const score = route => [...new Set(routeKeywords(route).map(word => word.toLowerCase()))]
    .filter(word => source.includes(word)).reduce((total, word) => total + word.length, 0)
  const matched = matches.filter(route => routeKeywords(route).length > 0)
    .sort((a, b) => score(b) - score(a))[0]
    || matches.find(route => routeKeywords(route).length === 0)
  if (matched) return { route: matched, match: routeKeywords(matched).length ? 'keyword' : 'condition' }
  const fallback = routes.find(route => route?.default === true && routeMatchesWhen(route, task, source))
  return fallback
    ? { route: fallback, match: 'default' }
    : { route: null, match: 'none' }
}

function selectExecutionRoute(task, snapshot) {
  return selectExecutionRouteWithMatch(task, snapshot).route
}

function routeContract(route, match = 'none', routesDeclared = true) {
  if (!route) {
    return {
      executionRouteMatch: 'none',
      executionRouteFit: routesDeclared ? 'unmatched' : 'unconfigured',
    }
  }
  const requiredTools = stringList(route.requiredTools)
  const hasToolAllowlist = Array.isArray(route.toolAllowlist)
  const qualityReview = normalizedQualityReview(route.qualityReview)
  return {
    requiredTools,
    requiredSkills: stringList([...(route.requiredSkills || []), route.skillId]),
    requiredConnectorIds: stringList([...(route.requiredConnectorIds || []), route.connectorId]),
    requiredEvidence: requiredTools.map(tool => ({ kind: 'tool_result', tool })),
    completionConditions: requiredTools.map(tool => ({ type: 'tool_success', tool })),
    executionRoute: String(route.id || '').trim(),
    executionRouteDescription: String(route.description || '').trim(),
    executionRouteMatch: match,
    executionRouteFit: match === 'default' ? 'fallback' : 'matched',
    ...(qualityReview ? { qualityReview } : {}),
    ...(hasToolAllowlist ? { executionToolAllowlist: stringList(route.toolAllowlist) } : {}),
  }
}

function scopePermissionsForOutputSpec(basePermissions = {}, outputSpec = {}) {
  if (!Array.isArray(outputSpec.executionToolAllowlist)) return basePermissions
  const granted = new Set(stringList(basePermissions?.tools?.allowlist))
  const allowlist = stringList(outputSpec.executionToolAllowlist).filter(tool => granted.has(tool))
  return {
    ...basePermissions,
    tools: {
      ...(basePermissions?.tools || {}),
      allowlist,
    },
  }
}

function resolveOutputSpec(task, snapshot) {
  const requested = hydrateDeliverableContracts(task?.brief || {}, snapshot).deliverables
  const source = requested.length
    ? requested
    : [{ id: 'primary', title: task?.title || '任务成果', type: 'document', required: true }]
  const changed = (task?.deliverables || []).find(item => item.acceptanceStatus === 'changes_requested')
  const next = changed
    ? source.find(item => item.id === changed.deliverableId)
    : source.find(item => !(task?.deliverables || []).some(deliverable => (
        deliverable.deliverableId === item.id && (task.brief?.completionPolicy === 'review'
          ? isExpertDeliverableReady(deliverable) : isExpertDeliverableComplete(deliverable))
      )))
  const selected = next || source.at(-1)
  const selectedRoute = selectExecutionRouteWithMatch(task, snapshot)
  const routes = executionMetadata(snapshot).routes
  const routesDeclared = Array.isArray(routes) && routes.length > 0
  const routed = routeContract(selectedRoute.route, selectedRoute.match, routesDeclared)
  return mergeDeliverableContract(selected, {
    ...routed,
    executionRoute: routed.executionRoute || selected.executionRoute,
    executionRouteDescription: routed.executionRouteDescription || selected.executionRouteDescription,
  })
}

function artifactCandidate(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const targetPath = String(value).trim()
    return targetPath ? { id: targetPath, type: IMAGE_FILE_PATTERN.test(targetPath) ? 'image' : 'artifact', targetPath } : null
  }
  if (typeof value !== 'object') return null
  const targetPath = String(value.targetPath || value.path || value.url || value.ref || '').trim()
  const type = String(value.type || value.kind || value.mimeType || (IMAGE_FILE_PATTERN.test(targetPath) ? 'image' : 'artifact')).toLowerCase()
  const id = String(value.id || value.ref || targetPath || '').trim()
  if (!id) return null
  const stored = getArtifact(undefined, id)
  return {
    ...(stored || {}),
    ...value,
    id,
    type,
    targetPath: targetPath || stored?.targetPath || undefined,
    body: value.body || value.content || stored?.body || stored?.content || undefined,
  }
}

function artifactMatchesType(artifact, expectedType) {
  const expected = String(expectedType || '').toLowerCase()
  if (!expected || expected === 'artifact' || expected === 'file') return true
  const actual = String(artifact?.type || artifact?.kind || '').toLowerCase()
  if (expected === 'image') return actual.startsWith('image') || IMAGE_FILE_PATTERN.test(String(artifact?.targetPath || ''))
  if (['document', 'report', 'brief', 'note', 'plan'].includes(expected)) {
    return ['document', 'markdown', 'text', 'report', 'brief', 'note', 'plan'].includes(actual)
  }
  if (['table', 'spreadsheet', 'csv'].includes(expected)) return ['table', 'spreadsheet', 'csv'].includes(actual)
  if (['checklist', 'list'].includes(expected)) return ['checklist', 'list', 'markdown', 'text'].includes(actual)
  return actual === expected || actual.startsWith(`${expected}/`)
}

function collectResultArtifacts(result, outputSpec = {}, existingArtifactIds = new Set()) {
  const values = [
    ...(Array.isArray(result?.artifactRefs) ? result.artifactRefs : []),
    ...(Array.isArray(result?.artifacts) ? result.artifacts : []),
    ...(Array.isArray(result?.terminal?.artifactRefs) ? result.terminal.artifactRefs : []),
  ]
  const seen = new Set(existingArtifactIds)
  const artifacts = []
  for (const value of values) {
    const candidate = artifactCandidate(value)
    if (!candidate || seen.has(candidate.id) || !artifactMatchesType(candidate, outputSpec.type)) continue
    seen.add(candidate.id)
    artifacts.push(candidate)
  }
  return artifacts
}

function expectsArtifact(outputSpec = {}) {
  return FILE_DELIVERABLE_TITLE_PATTERN.test(String(outputSpec.title || ''))
    || Number(outputSpec.minArtifacts) > 0
    || (outputSpec.requiredArtifacts || []).length > 0
    || (outputSpec.completionConditions || []).some(condition => condition?.type === 'artifact_present')
}

function snapshotNeedsRefresh(task, snapshot) {
  const manifest = snapshot?.capabilityManifest
  if (!manifest?.version || !task?.assignmentSnapshot?.agentVersion) return true
  if (String(task.assignmentSnapshot.agentVersion) !== String(manifest.version)) return true
  const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : []
  const expectedSkills = dependencies.filter(item => item?.kind === 'skill' && item.required !== false).map(item => String(item.id))
  const expectedConnectors = dependencies.filter(item => item?.kind === 'connector' && item.required !== false).map(item => String(item.id))
  const skills = new Set((snapshot?.bindings?.skills || []).map(String))
  const connectors = new Set((snapshot?.bindings?.connectors || []).map(String))
  return expectedSkills.some(id => !skills.has(id)) || expectedConnectors.some(id => !connectors.has(id))
}

function requiredDependencyIds(snapshot, kind) {
  const dependencies = Array.isArray(snapshot?.capabilityManifest?.dependencies)
    ? snapshot.capabilityManifest.dependencies
    : []
  return dependencies
    .filter(item => item?.kind === kind && item.required !== false)
    .map(item => String(item.id || '').trim())
    .filter(Boolean)
}

module.exports = {
  executionMetadata,
  qualityReviewContract,
  declaredDeliverables,
  hydrateDeliverableContracts,
  selectExecutionRoute,
  selectExecutionRouteWithMatch,
  routeContract,
  scopePermissionsForOutputSpec,
  resolveOutputSpec,
  artifactCandidate,
  artifactMatchesType,
  collectResultArtifacts,
  expectsArtifact,
  snapshotNeedsRefresh,
  requiredDependencyIds,
}
