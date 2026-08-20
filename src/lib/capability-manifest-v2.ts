'use strict'

const { validateExperienceExtension } = require('./skill-experience')

const SCHEMA_VERSION = 3
const READABLE_SCHEMA_VERSIONS = new Set([2, 3])
const SIDECAR_FILE = 'capability.manifest.json'
const VALID_KINDS = new Set(['skill', 'expert', 'connector', 'pack'])
const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])
const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 })
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function issue(code, message, path = '') {
  return { code, message, path }
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))]
}

function clonePlain(value, fallback) {
  if (value == null) return fallback
  if (Array.isArray(value)) return value.map(item => clonePlain(item, null))
  if (typeof value !== 'object') return value
  const out = {}
  for (const [key, nested] of Object.entries(value)) out[key] = clonePlain(nested, null)
  return out
}

function normalizeDependency(raw, index = 0) {
  if (typeof raw === 'string') {
    const id = raw.trim()
    return id ? { ok: true, dependency: { id, required: true } } : {
      ok: false,
      issue: issue('invalid_dependency', '依赖 id 不能为空', `dependencies[${index}]`),
    }
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, issue: issue('invalid_dependency', '依赖必须是字符串或对象', `dependencies[${index}]`) }
  }
  const id = String(raw.id || '').trim()
  const kind = String(raw.kind || '').trim()
  const version = String(raw.version || raw.versionRange || '').trim()
  if (!id || !ID_RE.test(id)) {
    return { ok: false, issue: issue('invalid_dependency', '依赖 id 无效', `dependencies[${index}].id`) }
  }
  if (kind && !VALID_KINDS.has(kind)) {
    return { ok: false, issue: issue('invalid_dependency_kind', `依赖 kind 无效: ${kind}`, `dependencies[${index}].kind`) }
  }
  return {
    ok: true,
    dependency: {
      id,
      ...(kind ? { kind } : {}),
      required: raw.required !== false && raw.optional !== true,
      ...(version ? { version } : {}),
    },
  }
}

function normalizeDependencies(values) {
  const dependencies = []
  const issues = []
  const seen = new Set()
  for (const [index, raw] of (Array.isArray(values) ? values : []).entries()) {
    const result = normalizeDependency(raw, index)
    if (!result.ok) {
      issues.push(result.issue)
      continue
    }
    const key = `${result.dependency.kind || '*'}:${result.dependency.id}`
    if (seen.has(key)) {
      issues.push(issue('duplicate_dependency', `重复依赖: ${result.dependency.id}`, `dependencies[${index}]`))
      continue
    }
    seen.add(key)
    dependencies.push(result.dependency)
  }
  return { dependencies, issues }
}

function normalizeIo(values) {
  return (Array.isArray(values) ? values : []).map((value) => {
    if (typeof value === 'string') return { name: value.trim() }
    if (!value || typeof value !== 'object') return null
    const name = String(value.name || value.id || '').trim()
    if (!name) return null
    return {
      name,
      ...(value.type ? { type: String(value.type).trim() } : {}),
      ...(value.description ? { description: String(value.description).trim() } : {}),
      ...(value.required === true ? { required: true } : {}),
    }
  }).filter(item => item?.name)
}

function normalizeActions(values, manifestId, issues) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).slice(0, 64).map((raw, index) => {
    const value = raw && typeof raw === 'object' ? raw : {}
    const id = String(value.id || value.name || '').trim()
    if (!ID_RE.test(id) || seen.has(id)) {
      issues.push(issue('invalid_action', `Action id 无效或重复: ${id || '(empty)'}`, `actions[${index}].id`))
      return null
    }
    seen.add(id)
    const sideEffect = String(value.sideEffect || value.side_effect || 'none').trim()
    if (!['none', 'read', 'reversible_write', 'irreversible_write'].includes(sideEffect)) {
      issues.push(issue('invalid_action_side_effect', `Action 副作用等级无效: ${sideEffect}`, `actions[${index}].sideEffect`))
    }
    const risk = deriveRisk(value, 'action')
    return {
      id,
      name: String(value.name || id).trim(),
      description: String(value.description || '').trim(),
      inputSchema: clonePlain(value.inputSchema || value.inputs, {}),
      outputSchema: clonePlain(value.outputSchema || value.outputs, {}),
      executor: clonePlain(value.executor || value.executorRef, {}),
      permissions: clonePlain(value.permissions, {}),
      risk,
      sideEffect,
      timeoutMs: Math.max(1000, Math.min(3600000, Number(value.timeoutMs) || 60000)),
      retry: clonePlain(value.retry, { maxAttempts: sideEffect === 'none' || sideEffect === 'read' ? 2 : 1 }),
      idempotency: clonePlain(value.idempotency, { supported: sideEffect !== 'irreversible_write' }),
      ref: `${manifestId}#${id}`,
    }
  }).filter(Boolean)
}

function deriveRisk(raw = {}, kind = '') {
  const explicit = typeof raw.risk === 'string' ? { level: raw.risk } : raw.risk
  let level = String(explicit?.level || '').trim().toLowerCase()
  const reasons = uniqueStrings(explicit?.reasons || (explicit?.reason ? [explicit.reason] : []))
  if (!VALID_RISK_LEVELS.has(level)) {
    level = 'low'
    if (kind === 'connector' && raw.mcp?.command) {
      level = 'high'
      reasons.push('可启动本地 MCP 进程')
    } else if (kind === 'connector' && (raw.type === 'feishu' || raw.permissions?.write)) {
      level = 'medium'
      reasons.push('可访问外部工作系统')
    } else if (kind === 'skill' && (raw.hasScripts || raw.permissions?.dangerous || raw.permissions?.network)) {
      level = raw.permissions?.dangerous ? 'high' : 'medium'
      reasons.push('技能包含可执行或外部访问能力')
    }
  }
  return { level, reasons: uniqueStrings(reasons) }
}

function normalizeProvenance(raw = {}, fallback = {}) {
  const source = String(raw.source || fallback.source || 'unknown').trim() || 'unknown'
  const ref = String(raw.ref || fallback.ref || '').trim()
  const trust = String(raw.trust || fallback.trust || 'unknown').trim() || 'unknown'
  const contentHash = String(raw.contentHash || fallback.contentHash || '').trim()
  const adaptedFrom = String(raw.adaptedFrom || fallback.adaptedFrom || '').trim()
  return {
    source,
    trust,
    ...(ref ? { ref } : {}),
    ...(contentHash ? { contentHash } : {}),
    ...(adaptedFrom ? { adaptedFrom } : {}),
  }
}

function validateAndNormalizeManifest(raw = {}, options = {}) {
  const issues = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: [issue('invalid_manifest', 'manifest 必须是对象')] }
  }
  const schemaVersion = Number(raw.schemaVersion || SCHEMA_VERSION)
  const id = String(raw.id || options.id || '').trim()
  const kind = String(raw.kind || options.kind || '').trim()
  const name = String(raw.name || options.name || id).trim()
  const description = String(raw.description || options.description || '').trim()
  const version = String(raw.version || options.version || '1.0.0').trim()

  if (!READABLE_SCHEMA_VERSIONS.has(schemaVersion)) issues.push(issue('unsupported_schema', `不支持的 schemaVersion: ${schemaVersion}`, 'schemaVersion'))
  if (!ID_RE.test(id)) issues.push(issue('invalid_id', '能力 id 无效', 'id'))
  if (!VALID_KINDS.has(kind)) issues.push(issue('invalid_kind', `能力 kind 无效: ${kind}`, 'kind'))
  if (!name) issues.push(issue('missing_name', '缺少 name', 'name'))
  if (!SEMVER_RE.test(version)) issues.push(issue('invalid_version', 'version 必须是 semver', 'version'))

  const normalizedDeps = normalizeDependencies(raw.dependencies)
  issues.push(...normalizedDeps.issues)
  if (normalizedDeps.dependencies.some(dep => dep.id === id && (!dep.kind || dep.kind === kind))) {
    issues.push(issue('self_dependency', `能力不能依赖自身: ${id}`, 'dependencies'))
  }

  const risk = deriveRisk(raw, kind)
  if (!VALID_RISK_LEVELS.has(risk.level)) issues.push(issue('invalid_risk', `风险等级无效: ${risk.level}`, 'risk.level'))
  const provenance = normalizeProvenance(raw.provenance, options.provenance)
  const actions = normalizeActions(raw.actions, id, issues)

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    id,
    kind,
    name,
    description,
    version,
    dependencies: normalizedDeps.dependencies,
    permissions: clonePlain(raw.permissions, {}),
    inputs: normalizeIo(raw.inputs),
    outputs: normalizeIo(raw.outputs),
    actions,
    risk,
    provenance,
  }
  const warnings = []
  if (raw.metadata && typeof raw.metadata === 'object') {
    manifest.metadata = clonePlain(raw.metadata, {})
    const knowme = manifest.metadata.knowme
    if (knowme && typeof knowme === 'object' && knowme.experience != null) {
      const validated = validateExperienceExtension(knowme.experience, { skillId: id })
      manifest.metadata.knowme = {
        ...knowme,
        experience: { tasks: validated.tasks },
      }
      for (const item of validated.issues) {
        warnings.push({
          ...item,
          path: item.path || 'metadata.knowme.experience',
        })
      }
    }
  }
  return { ok: issues.length === 0, manifest, issues, warnings }
}

function dependenciesForLegacy(kind, raw = {}) {
  const deps = Array.isArray(raw.dependencies) ? [...raw.dependencies] : []
  if (kind === 'expert') {
    for (const id of uniqueStrings(raw.skills)) deps.push({ id, kind: 'skill', required: true })
    for (const id of uniqueStrings(raw.connectors)) deps.push({ id, kind: 'connector', required: true })
  }
  if (kind === 'pack') {
    if (raw.expert) deps.push({ id: raw.expert, kind: 'expert', required: true })
    for (const id of uniqueStrings(raw.skills)) deps.push({ id, kind: 'skill', required: true })
    for (const id of uniqueStrings(raw.connectors)) deps.push({ id, kind: 'connector', required: true })
  }
  return deps
}

function adaptLegacyCapability(kind, raw = {}, options = {}) {
  const id = String(options.id || raw.id || raw.name || '').trim()
  const legacyType = String(options.adaptedFrom || (
    kind === 'skill' ? 'SKILL.md'
      : kind === 'expert' ? 'EXPERT.md'
        : kind === 'pack' ? 'pack.json' : 'connector-manifest'
  )).trim()
  const candidate = {
    schemaVersion: SCHEMA_VERSION,
    id,
    kind,
    name: options.name || raw.name || raw.title || id,
    description: options.description || raw.description || '',
    version: options.version || raw.version || '1.0.0',
    dependencies: dependenciesForLegacy(kind, raw),
    permissions: raw.permissions || (
      kind === 'connector' ? { tools: uniqueStrings(raw.allowlist), connector: raw.type || 'mcp' } : {}
    ),
    inputs: raw.inputs || [],
    outputs: raw.outputs || [],
    risk: raw.risk,
    provenance: {
      source: options.source || 'legacy',
      ref: options.ref || '',
      trust: options.trust || 'unknown',
      contentHash: options.contentHash || raw.contentHash || '',
      adaptedFrom: legacyType,
    },
    metadata: {
      legacy: true,
      knowme: { experience: { tasks: [] } },
      ...(kind === 'connector' ? { connector: clonePlain({ type: raw.type || 'mcp', mcp: raw.mcp || {}, allowlist: raw.allowlist || [] }, {}) } : {}),
    },
    mcp: raw.mcp,
    type: raw.type,
    hasScripts: options.hasScripts === true,
  }
  return validateAndNormalizeManifest(candidate)
}

function dependencyKey(dep) {
  return `${dep.kind || '*'}:${dep.id}`
}

function checkDependencyGraph(manifests = [], options = {}) {
  const issues = []
  const warnings = []
  const byId = new Map()
  for (const manifest of manifests) {
    const normalized = validateAndNormalizeManifest(manifest)
    if (!normalized.ok) {
      issues.push(...normalized.issues.map(item => ({ ...item, capabilityId: manifest?.id || '' })))
      continue
    }
    if (byId.has(normalized.manifest.id)) {
      issues.push(issue('duplicate_capability', `重复能力 id: ${normalized.manifest.id}`))
      continue
    }
    byId.set(normalized.manifest.id, normalized.manifest)
  }

  const availableIds = options.availableIds ? new Set([...options.availableIds].map(String)) : null
  for (const manifest of byId.values()) {
    for (const dep of manifest.dependencies) {
      const target = byId.get(dep.id)
      const externallyAvailable = availableIds?.has(dep.id)
      if (!target && !externallyAvailable) {
        const item = { ...issue(dep.required ? 'missing_dependency' : 'missing_optional_dependency', `缺少${dep.required ? '必需' : '可选'}依赖: ${dep.id}`, 'dependencies'), capabilityId: manifest.id, dependency: dep }
        if (dep.required) issues.push(item)
        else warnings.push(item)
      } else if (target && dep.kind && target.kind !== dep.kind) {
        issues.push({ ...issue('dependency_kind_mismatch', `依赖 ${dep.id} 的 kind 应为 ${dep.kind}，实际为 ${target.kind}`, 'dependencies'), capabilityId: manifest.id, dependency: dep })
      }
    }
  }

  const visiting = new Set()
  const visited = new Set()
  const stack = []
  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id)
      const cycle = [...stack.slice(start), id]
      issues.push({ ...issue('dependency_cycle', `依赖环: ${cycle.join(' -> ')}`), cycle })
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    stack.push(id)
    const manifest = byId.get(id)
    for (const dep of manifest?.dependencies || []) {
      if (dep.required && byId.has(dep.id)) visit(dep.id)
    }
    stack.pop()
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of byId.keys()) visit(id)

  return { ok: issues.length === 0, issues, warnings, manifests: [...byId.values()] }
}

function checkCapabilityDependencies(manifest, available = []) {
  const availableManifests = Array.isArray(available)
    ? available
    : Object.values(available || {})
  return checkDependencyGraph([manifest, ...availableManifests])
}

function aggregateRisk(manifests = []) {
  let level = 'low'
  const reasons = []
  for (const manifest of manifests) {
    const risk = deriveRisk(manifest, manifest?.kind)
    if (RISK_ORDER[risk.level] > RISK_ORDER[level]) level = risk.level
    reasons.push(...risk.reasons)
  }
  return { level, reasons: uniqueStrings(reasons) }
}

function serializeSidecar(manifest) {
  const normalized = validateAndNormalizeManifest(manifest)
  if (!normalized.ok) return normalized
  return { ok: true, manifest: normalized.manifest, content: `${JSON.stringify(normalized.manifest, null, 2)}\n` }
}

module.exports = {
  SCHEMA_VERSION,
  SIDECAR_FILE,
  VALID_KINDS,
  VALID_RISK_LEVELS,
  RISK_ORDER,
  READABLE_SCHEMA_VERSIONS,
  normalizeDependency,
  normalizeDependencies,
  normalizeProvenance,
  validateAndNormalizeManifest,
  adaptLegacyCapability,
  checkDependencyGraph,
  checkCapabilityDependencies,
  aggregateRisk,
  serializeSidecar,
  dependencyKey,
}
