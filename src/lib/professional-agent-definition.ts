'use strict'

const crypto = require('crypto')
const {
  RISK_ORDER,
  validateAndNormalizeManifest,
} = require('./capability-manifest-v2')
const {
  isValidAgenticType,
  normalizeAgenticConfig,
  normalizeAgenticType,
  resolveSoulSop,
} = require('./expert-agentic-profile')

const PROFESSIONAL_DEFINITION_VERSION = 1
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function clonePlain(value, fallback = null) {
  if (value == null) return fallback
  if (Array.isArray(value)) return value.map(item => clonePlain(item, null))
  if (typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clonePlain(nested, null)]))
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
}

function normalizeIo(values) {
  return (Array.isArray(values) ? values : []).map((value) => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object') return null
    const name = String(value.name || value.id || '').trim()
    if (!name) return null
    return {
      name,
      ...(value.type ? { type: String(value.type).trim() } : {}),
      ...(value.description ? { description: String(value.description).trim() } : {}),
      ...(value.required === true ? { required: true } : {}),
    }
  }).filter(Boolean)
}

function normalizeLifecycle(raw = {}) {
  const state = ['active', 'deprecated', 'retired'].includes(String(raw.state || '').trim())
    ? String(raw.state).trim()
    : 'active'
  return {
    state,
    newTasks: state === 'retired' ? false : raw.newTasks !== false,
    successors: (Array.isArray(raw.successors) ? raw.successors : [])
      .map(item => ({ kind: String(item?.kind || '').trim(), id: String(item?.id || '').trim() }))
      .filter(item => item.kind && item.id),
  }
}

function normalizeExecution(raw = {}) {
  const routes = (Array.isArray(raw.routes) ? raw.routes : []).map((route) => ({
    ...clonePlain(route, {}),
    id: String(route?.id || '').trim(),
    label: String(route?.label || '').trim(),
    description: String(route?.description || '').trim(),
    keywords: uniqueStrings(route?.keywords),
    requiredSkills: uniqueStrings(route?.requiredSkills),
    requiredConnectorIds: uniqueStrings(route?.requiredConnectorIds),
    requiredTools: uniqueStrings(route?.requiredTools),
    toolAllowlist: uniqueStrings(route?.toolAllowlist),
  }))
  const deliverables = (Array.isArray(raw.deliverables) ? raw.deliverables : []).map((item) => ({
    ...clonePlain(item, {}),
    id: String(item?.id || '').trim(),
    title: String(item?.title || '').trim(),
    type: String(item?.type || 'answer').trim() || 'answer',
    required: item?.required !== false,
    requiredTools: uniqueStrings(item?.requiredTools),
  }))
  const qualityReview = raw.qualityReview && typeof raw.qualityReview === 'object'
    ? {
        enabled: raw.qualityReview.enabled !== false,
        criteria: uniqueStrings(raw.qualityReview.criteria),
      }
    : { enabled: true, criteria: [] }
  return {
    strategy: String(raw.strategy || 'sop-first').trim() || 'sop-first',
    routes,
    deliverables,
    qualityReview,
  }
}

function normalizeProfessionalAgentDefinition(raw = {}) {
  const resolved = resolveSoulSop(raw)
  const permissions = raw.permissions && typeof raw.permissions === 'object'
    ? clonePlain(raw.permissions, {})
    : {}
  const risk = raw.risk && typeof raw.risk === 'object'
    ? {
        level: String(raw.risk.level || 'low').trim().toLowerCase(),
        reasons: uniqueStrings(raw.risk.reasons),
      }
    : { level: 'low', reasons: [] }
  return {
    definitionVersion: PROFESSIONAL_DEFINITION_VERSION,
    id: String(raw.id || raw.expertId || '').trim(),
    name: String(raw.name || '').trim(),
    description: String(raw.description || raw.persona || '').trim(),
    version: String(raw.version || '1.0.0').trim() || '1.0.0',
    avatar: String(raw.avatar || '').trim(),
    soul: resolved.soul,
    sop: resolved.sop,
    systemPrompt: resolved.systemPrompt,
    agenticType: normalizeAgenticType(raw.agenticType),
    agenticConfig: normalizeAgenticConfig(raw.agenticType, raw.agenticConfig),
    skills: uniqueStrings(raw.skills),
    connectors: uniqueStrings(raw.connectors),
    optionalConnectors: uniqueStrings(raw.optionalConnectors),
    knowledgeRefs: uniqueStrings(raw.knowledgeRefs),
    useCases: uniqueStrings(raw.useCases),
    boundaries: uniqueStrings(raw.boundaries),
    inputs: normalizeIo(raw.inputs || raw.inputContract),
    outputs: normalizeIo(raw.outputs || raw.outputContract),
    permissions,
    risk,
    execution: normalizeExecution(raw.execution || raw.capabilityManifest?.metadata?.knowme?.execution),
    lifecycle: normalizeLifecycle(raw.lifecycle),
  }
}

function buildProfessionalManifest(definition, options = {}) {
  const dependencies = [
    ...definition.skills.map(id => ({ id, kind: 'skill', required: true })),
    ...definition.connectors.map(id => ({ id, kind: 'connector', required: true })),
    ...definition.optionalConnectors.map(id => ({ id, kind: 'connector', required: false })),
  ]
  const candidate = {
    schemaVersion: 3,
    id: definition.id,
    kind: 'expert',
    name: definition.name,
    description: definition.description,
    version: definition.version,
    dependencies,
    permissions: definition.permissions,
    inputs: definition.inputs,
    outputs: definition.outputs,
    risk: definition.risk,
    provenance: {
      source: String(options.source || 'custom'),
      trust: String(options.trust || 'user'),
      ref: `experts/${definition.id}`,
      ...(options.contentHash ? { contentHash: String(options.contentHash) } : {}),
    },
    metadata: {
      knowledgeRefs: definition.knowledgeRefs,
      sop: definition.sop,
      knowme: {
        professionalDefinitionVersion: PROFESSIONAL_DEFINITION_VERSION,
        useCases: definition.useCases,
        boundaries: definition.boundaries,
        execution: definition.execution,
        qualification: {
          state: 'ready',
          issues: [],
          limitedSkills: [],
          assessedAtImport: false,
          verification: 'definition-only',
        },
      },
    },
  }
  return validateAndNormalizeManifest(candidate, { id: definition.id, kind: 'expert' })
}

function addIssue(issues, code, message, path) {
  issues.push({ code, message, path })
}

function validateProfessionalAgentDefinition(raw = {}, options = {}) {
  const definition = normalizeProfessionalAgentDefinition(raw)
  const issues = []
  const warnings = []
  if (!ID_RE.test(definition.id)) addIssue(issues, 'invalid_id', 'Agent id 必须是 1-64 位字母、数字、点、下划线或短横线', 'id')
  if (!definition.name) addIssue(issues, 'missing_name', '缺少 Agent 名称', 'name')
  if (definition.description.length < 12) addIssue(issues, 'weak_description', '角色描述至少需要 12 个字符并明确专业责任', 'description')
  if (!SEMVER_RE.test(definition.version)) addIssue(issues, 'invalid_version', 'version 必须是 semver', 'version')
  if (!definition.soul) addIssue(issues, 'missing_soul', '缺少 Agent 的判断准则与专业立场', 'soul')
  if (!definition.sop) addIssue(issues, 'missing_sop', '缺少可执行 SOP', 'sop')
  if (!isValidAgenticType(definition.agenticType)) addIssue(issues, 'invalid_agentic_type', 'agenticType 无效', 'agenticType')
  if (!definition.skills.length) addIssue(issues, 'missing_method', '专业 Agent 至少需要绑定一个方法型 Skill', 'skills')
  if (!definition.useCases.length) addIssue(issues, 'missing_use_cases', '至少声明一个适用场景', 'useCases')
  if (!definition.boundaries.length) addIssue(issues, 'missing_boundaries', '至少声明一个能力边界', 'boundaries')
  if (!definition.inputs.length) addIssue(issues, 'missing_inputs', '至少声明一个必要输入', 'inputs')
  if (!definition.outputs.length) addIssue(issues, 'missing_outputs', '至少声明一个可验收输出', 'outputs')

  const routes = definition.execution.routes
  const routeIds = new Set()
  if (!routes.length) addIssue(issues, 'missing_routes', '至少声明一条执行路线', 'execution.routes')
  const skillIds = new Set(definition.skills)
  const connectorIds = new Set([...definition.connectors, ...definition.optionalConnectors])
  const allowedTools = new Set(uniqueStrings(definition.permissions?.tools?.allowlist || definition.permissions?.tools))
  for (const [index, route] of routes.entries()) {
    if (!route.id || routeIds.has(route.id)) addIssue(issues, 'invalid_route_id', '执行路线 id 不能为空且必须唯一', `execution.routes[${index}].id`)
    if (route.id) routeIds.add(route.id)
    if (!route.label) addIssue(issues, 'missing_route_label', '执行路线必须提供可读名称', `execution.routes[${index}].label`)
    if (!route.description) addIssue(issues, 'missing_route_description', '执行路线必须说明用途', `execution.routes[${index}].description`)
    for (const id of route.requiredSkills) {
      if (!skillIds.has(id)) addIssue(issues, 'undeclared_route_skill', `路线引用了未绑定的 Skill: ${id}`, `execution.routes[${index}].requiredSkills`)
    }
    for (const id of route.requiredConnectorIds) {
      if (!connectorIds.has(id)) addIssue(issues, 'undeclared_route_connector', `路线引用了未绑定的 Connector: ${id}`, `execution.routes[${index}].requiredConnectorIds`)
    }
    for (const tool of [...route.requiredTools, ...route.toolAllowlist]) {
      if (!allowedTools.has(tool)) addIssue(issues, 'tool_not_allowed', `路线工具未进入权限白名单: ${tool}`, `execution.routes[${index}]`)
    }
  }

  if (!definition.execution.deliverables.length) addIssue(issues, 'missing_deliverables', '至少声明一个交付物', 'execution.deliverables')
  for (const [index, item] of definition.execution.deliverables.entries()) {
    if (!item.id || !item.title) addIssue(issues, 'invalid_deliverable', '交付物必须包含 id 和 title', `execution.deliverables[${index}]`)
    for (const tool of item.requiredTools) {
      if (!allowedTools.has(tool)) addIssue(issues, 'tool_not_allowed', `交付工具未进入权限白名单: ${tool}`, `execution.deliverables[${index}]`)
    }
  }
  if (!definition.execution.qualityReview.enabled || definition.execution.qualityReview.criteria.length < 2) {
    addIssue(issues, 'weak_quality_review', '专业 Agent 至少需要两条质量复核标准', 'execution.qualityReview.criteria')
  }

  const connectorAllowlist = new Set(uniqueStrings(definition.permissions?.connectors?.allowedConnectorIds))
  for (const id of connectorIds) {
    if (!connectorAllowlist.has(id)) addIssue(issues, 'connector_not_allowed', `Connector 未进入权限白名单: ${id}`, 'permissions.connectors.allowedConnectorIds')
  }
  const riskRank = RISK_ORDER[definition.risk.level]
  if (riskRank == null) addIssue(issues, 'invalid_risk', '风险等级必须是 low/medium/high/critical', 'risk.level')
  const writeRisk = definition.permissions?.write === true || definition.permissions?.network === true
  if (writeRisk && (riskRank ?? -1) < RISK_ORDER.medium) addIssue(issues, 'risk_understated', '网络或本地写入能力至少需要 medium 风险', 'risk.level')
  if (definition.permissions?.externalWrite === true && (riskRank ?? -1) < RISK_ORDER.high) addIssue(issues, 'external_write_risk_understated', '外部写入能力至少需要 high 风险', 'risk.level')
  if ((riskRank ?? 0) >= RISK_ORDER.medium && !definition.risk.reasons.length) addIssue(issues, 'missing_risk_reason', '中高风险 Agent 必须说明风险原因', 'risk.reasons')

  const availableIds = options.availableIds instanceof Set
    ? options.availableIds
    : new Set((options.availableIds || []).map(String))
  if (availableIds.size) {
    for (const id of [...definition.skills, ...definition.connectors]) {
      if (!availableIds.has(id)) addIssue(issues, 'missing_dependency', `缺少必需能力: ${id}`, 'dependencies')
    }
    for (const id of definition.optionalConnectors) {
      if (!availableIds.has(id)) warnings.push({ code: 'missing_optional_dependency', message: `可选 Connector 当前不可用: ${id}`, path: 'optionalConnectors' })
    }
  }

  const manifestResult = buildProfessionalManifest(definition, options)
  if (!manifestResult.ok) issues.push(...manifestResult.issues)
  warnings.push(...(manifestResult.warnings || []))
  const uniqueIssues = [...new Map(issues.map(item => [`${item.code}:${item.path}:${item.message}`, item])).values()]
  return {
    ok: uniqueIssues.length === 0,
    definition,
    manifest: manifestResult.manifest,
    issues: uniqueIssues,
    warnings,
    quality: {
      state: uniqueIssues.length ? 'blocked' : (warnings.length ? 'ready_with_warnings' : 'ready'),
      score: Math.max(0, 100 - (uniqueIssues.length * 12) - (warnings.length * 3)),
    },
  }
}

function definitionFromLoadedExpert(expert = {}, catalogEntry = {}) {
  const manifest = expert.capabilityManifest || catalogEntry.manifest || {}
  const knowme = manifest.metadata?.knowme || {}
  return normalizeProfessionalAgentDefinition({
    id: expert.id || catalogEntry.id,
    name: expert.name || catalogEntry.name,
    description: expert.description || catalogEntry.description,
    version: manifest.version || catalogEntry.version || expert.manifest?.version,
    avatar: expert.avatar || catalogEntry.avatar,
    soul: expert.soul,
    sop: expert.sop || manifest.metadata?.sop || catalogEntry.sop,
    systemPrompt: expert.systemPrompt,
    agenticType: expert.agenticType,
    agenticConfig: expert.agenticConfig,
    skills: expert.skills,
    connectors: expert.connectors,
    optionalConnectors: expert.optionalConnectors,
    knowledgeRefs: manifest.metadata?.knowledgeRefs || catalogEntry.knowledgeRefs,
    useCases: expert.useCases || knowme.useCases || catalogEntry.useCases,
    boundaries: expert.boundaries || knowme.boundaries || catalogEntry.boundaries,
    inputs: manifest.inputs || catalogEntry.inputs,
    outputs: manifest.outputs || catalogEntry.outputs,
    permissions: manifest.permissions || catalogEntry.permissions,
    risk: manifest.risk || catalogEntry.risk,
    execution: knowme.execution,
    lifecycle: catalogEntry.lifecycle,
  })
}

function definitionHash(value) {
  const canonical = item => {
    if (Array.isArray(item)) return item.map(canonical)
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]))
    }
    return item
  }
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

module.exports = {
  PROFESSIONAL_DEFINITION_VERSION,
  normalizeLifecycle,
  normalizeProfessionalAgentDefinition,
  buildProfessionalManifest,
  validateProfessionalAgentDefinition,
  definitionFromLoadedExpert,
  definitionHash,
}
