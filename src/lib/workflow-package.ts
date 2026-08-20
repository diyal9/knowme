'use strict'

const crypto = require('crypto')

const PACKAGE_VERSION = 2
const READABLE_PACKAGE_VERSIONS = new Set([1, 2])
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const VALID_SOURCES = new Set(['official', 'team', 'personal', 'forked'])
const VALID_STATUSES = new Set(['draft', 'published', 'archived', 'unavailable'])
const VALID_BACKENDS = new Set(['local-team', 'daemon', 'legacy-local'])
const MAX_TEXT = 240
const MAX_ITEMS = 64
const AUTHORING_NODE_TYPES = new Set(['start', 'end', 'agent', 'human', 'action', 'condition', 'parallel', 'join', 'gate'])
const LEGACY_NODE_TYPES = new Set(['terminal', 'llm', 'tool', 'knowledge', 'mcp', 'request'])

function nowIso() {
  return new Date().toISOString()
}

function cleanText(value, max = MAX_TEXT) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function cleanId(value, label = '标识') {
  const id = cleanText(value, 80)
  if (!id || !ID_RE.test(id)) return { ok: false, error: `无效的${label}` }
  return { ok: true, id }
}

function uniqueIds(values, max = MAX_ITEMS) {
  const result = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const id = cleanText(value, 120)
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
    if (result.length >= max) break
  }
  return result
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]))
}

function stablePayload(value) {
  if (Array.isArray(value)) return value.map(stablePayload)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stablePayload(value[key])
    return out
  }, {})
}

function stableHash(value) {
  return `sha256:${crypto.createHash('sha256')
    .update(JSON.stringify(stablePayload(value)))
    .digest('hex')}`
}

function normalizeRef(raw, fallbackKind = 'agent') {
  const source = typeof raw === 'string' ? { id: raw } : (raw && typeof raw === 'object' ? raw : {})
  const parsed = cleanId(source.id || source.agentPackageId || source.skillId, `${fallbackKind} 引用`)
  if (!parsed.ok) return null
  return {
    id: parsed.id,
    kind: cleanText(source.kind || fallbackKind, 32) || fallbackKind,
    version: cleanText(source.version || 'latest', 80) || 'latest',
    contentHash: cleanText(source.contentHash || source.hash, 160),
    profileId: cleanText(source.profileId, 80),
  }
}

function normalizeLayoutPoint(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) return null
  const point = {
    x: Math.max(0, Number(raw.x)),
    y: Math.max(0, Number(raw.y)),
  }
  const kind = cleanText(raw.kind, 32)
  if (kind) point.kind = kind
  return point
}

function normalizeGraphLayout(raw) {
  if (!raw || typeof raw !== 'object') return null
  const layout = {
    mode: cleanText(raw.mode || 'free', 24) || 'free',
  }
  const start = normalizeLayoutPoint(raw.start)
  const end = normalizeLayoutPoint(raw.end)
  if (start) layout.start = start
  if (end) layout.end = end
  if (raw.nodes && typeof raw.nodes === 'object') {
    const nodes = {}
    for (const [id, value] of Object.entries(raw.nodes)) {
      const key = cleanText(id, 80)
      const point = normalizeLayoutPoint(value)
      if (key && point) nodes[key] = point
    }
    if (Object.keys(nodes).length) layout.nodes = nodes
  }
  return layout
}

function normalizeGraph(raw) {
  const graph = raw && typeof raw === 'object' ? raw : {}
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.slice(0, MAX_ITEMS).map(node => {
    const next = {
      id: cleanText(node?.id, 80),
      type: cleanText(node?.type || 'agent', 32) || 'agent',
      agentPackageId: cleanText(node?.agentPackageId, 80),
      agentOrigin: cleanText(node?.agentOrigin || node?.origin || 'local', 24) || 'local',
      profileId: cleanText(node?.profileId, 80),
      packageHash: cleanText(node?.packageHash || node?.contentHash, 160),
      profileHash: cleanText(node?.profileHash || node?.profile?.profileHash, 160),
      gateRef: cleanText(node?.gateRef || node?.gate_id || node?.gateId, 80),
      actionRef: cleanText(node?.actionRef || node?.action_id || node?.actionId, 160),
      humanRole: cleanText(node?.humanRole || node?.assigneeRole, 80),
      status: cleanText(node?.status, 40),
      name: cleanText(node?.name || node?.title, 120),
      role: cleanText(node?.role, MAX_TEXT),
      intent: cleanText(node?.intent, MAX_TEXT),
      description: cleanText(node?.description, MAX_TEXT),
      relation: cleanText(node?.relation || node?.relationToNext || 'serial', 24),
      profile: clone(node?.profile || null),
      config: clone(node?.config || null),
      inputs: clone(node?.inputs || {}),
      outputs: clone(node?.outputs || {}),
      executionContract: clone(node?.executionContract || {}),
      permissionGrant: clone(node?.permissionGrant || null),
      compatibilityOnly: LEGACY_NODE_TYPES.has(cleanText(node?.type, 32)),
    }
    const studioKind = cleanText(node?.studioKind, 32)
    if (studioKind) next.studioKind = studioKind
    if (Number.isFinite(Number(node?.x))) next.x = Math.max(0, Number(node.x))
    if (Number.isFinite(Number(node?.y))) next.y = Math.max(0, Number(node.y))
    return next
  }).filter(node => node.id) : []
  const edges = Array.isArray(graph.edges) ? graph.edges.slice(0, MAX_ITEMS * 2).map(edge => {
    const next = {
      from: cleanText(edge?.from, 80),
      to: cleanText(edge?.to, 80),
      label: cleanText(edge?.label, 80),
      mapping: clone(edge?.mapping || edge?.handoff || {}),
    }
    const branch = cleanText(edge?.branch, 24)
    if (branch === 'true' || branch === 'false') next.branch = branch
    return next
  }).filter(edge => edge.from && edge.to) : []
  const normalized = {
    template: cleanText(graph.template, 40),
    goal: cleanText(graph.goal || graph.intent, MAX_TEXT),
    members: clone(Array.isArray(graph.members) ? graph.members.slice(0, 8) : []),
    nodes,
    edges,
    gates: clone(Array.isArray(graph.gates) ? graph.gates.slice(0, MAX_ITEMS) : []),
    parallelism: Math.max(1, Math.min(8, Number(graph.parallelism) || 1)),
    joinStrategy: cleanText(graph.joinStrategy || 'all', 40) || 'all',
  }
  const layout = normalizeGraphLayout(graph.layout)
  if (layout) normalized.layout = layout
  return normalized
}

function normalizeWorkflowPackage(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const parsed = cleanId(source.id || `workflow-${Date.now().toString(36)}`, 'Workflow Package 标识')
  if (!parsed.ok) return parsed
  const origin = cleanText(source.source || 'personal', 24) || 'personal'
  if (!VALID_SOURCES.has(origin)) return { ok: false, error: `无效的流程来源: ${origin}` }
  const status = cleanText(source.status || 'draft', 24) || 'draft'
  if (!VALID_STATUSES.has(status)) return { ok: false, error: `无效的流程状态: ${status}` }
  const backends = uniqueIds(source.executionBackends || source.backends, 8)
    .filter(item => VALID_BACKENDS.has(item))
  const packageValue = {
    packageVersion: PACKAGE_VERSION,
    id: parsed.id,
    name: cleanText(source.name || source.title || parsed.id),
    description: cleanText(source.description),
    source: origin,
    status,
    version: cleanText(source.version || '1.0.0', 40) || '1.0.0',
    parentRef: source.parentRef && typeof source.parentRef === 'object'
      ? {
          id: cleanText(source.parentRef.id, 80),
          version: cleanText(source.parentRef.version, 40),
        }
      : null,
    goalTypes: uniqueIds(source.goalTypes, 16),
    inputs: clone(Array.isArray(source.inputs) ? source.inputs.slice(0, MAX_ITEMS) : []),
    outputs: clone(Array.isArray(source.outputs) ? source.outputs.slice(0, MAX_ITEMS) : []),
    agentRefs: (Array.isArray(source.agentRefs) ? source.agentRefs : [])
      .map(item => normalizeRef(item, 'agent'))
      .filter(Boolean),
    skillRefs: (Array.isArray(source.skillRefs) ? source.skillRefs : [])
      .map(item => normalizeRef(item, 'skill'))
      .filter(Boolean),
    actionRefs: (Array.isArray(source.actionRefs) ? source.actionRefs : [])
      .map(item => normalizeRef(item, 'action'))
      .filter(Boolean),
    graph: normalizeGraph(source.graph || source.composition || source),
    executionBackends: backends.length ? backends : ['local-team'],
    governance: clone(source.governance || {}),
    qualityGates: clone(Array.isArray(source.qualityGates) ? source.qualityGates.slice(0, MAX_ITEMS) : []),
    provenance: clone(source.provenance || {}),
    publication: {
      visibility: cleanText(source.publication?.visibility || source.visibility || 'private', 32) || 'private',
      successfulRunId: cleanText(source.publication?.successfulRunId || source.successfulRunId, 120),
      successfulRunHash: cleanText(source.publication?.successfulRunHash, 160),
      uncoveredBranches: uniqueIds(source.publication?.uncoveredBranches, MAX_ITEMS),
      publishedAt: cleanText(source.publication?.publishedAt, 40),
    },
    createdAt: cleanText(source.createdAt, 40) || nowIso(),
    updatedAt: cleanText(source.updatedAt, 40) || nowIso(),
  }
  packageValue.compositionHash = stableHash(packageValue.graph)
  packageValue.packageHash = stableHash(packageValue)
  return { ok: true, package: packageValue }
}

function validateWorkflowPackage(raw, options = {}) {
  const normalized = normalizeWorkflowPackage(raw)
  if (!normalized.ok) return normalized
  const pkg = normalized.package
  const issues = []
  const nodeIds = new Set(pkg.graph.nodes.map(node => node.id))
  const executableNodes = pkg.graph.nodes.filter(node => (
    ['agent', 'human', 'action', 'llm', 'tool', 'knowledge', 'mcp', 'request'].includes(node.type)
  ))
  if (!pkg.name) issues.push({ code: 'missing_name', message: '流程名称不能为空', path: 'name' })
  if (!pkg.agentRefs.length && !pkg.graph.nodes.length) {
    issues.push({ code: 'missing_graph', message: '流程必须包含 Agent 或 Graph 节点', path: 'graph' })
  }
  if (options.enforceProductBoundary === true && executableNodes.length < 1) {
    issues.push({
      code: 'executable_node_required',
      message: '工作流至少需要一个可执行节点',
      path: 'graph.nodes',
    })
  }
  if (options.enforceProductBoundary === true && pkg.executionBackends.includes('daemon')) {
    issues.push({
      code: 'pipeline_backend_not_allowed',
      message: '管线服务不属于普通工作流节点，请在「管线服务」入口单独使用',
      path: 'executionBackends',
    })
  }
  for (const edge of pkg.graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.push({ code: 'dangling_edge', message: `流程边引用不存在节点: ${edge.from} → ${edge.to}`, path: 'graph.edges' })
    }
  }
  for (const node of pkg.graph.nodes) {
    if (!AUTHORING_NODE_TYPES.has(node.type) && !LEGACY_NODE_TYPES.has(node.type)) {
      issues.push({ code: 'unsupported_node_type', message: `不支持节点类型: ${node.type}`, path: `graph.nodes.${node.id}` })
    }
    if (node.type === 'agent' && node.agentPackageId === 'personal') {
issues.push({ code: 'personal_agent_not_node', message: '智能伙伴只能在工作流外围协助，不能作为节点', path: `graph.nodes.${node.id}.agentPackageId` })
    }
    if (node.type === 'action' && !node.actionRef) {
      issues.push({ code: 'missing_action_ref', message: `动作节点缺少 Action Contract: ${node.id}`, path: `graph.nodes.${node.id}.actionRef` })
    }
    if (node.type === 'human' && !node.humanRole) {
      issues.push({ code: 'missing_human_role', message: `人工节点缺少负责人角色: ${node.id}`, path: `graph.nodes.${node.id}.humanRole` })
    }
  }
  if (pkg.status === 'published' && pkg.source !== 'official' && !pkg.publication.successfulRunId) {
    issues.push({ code: 'successful_run_required', message: '发布前至少需要一次完整成功 Run', path: 'publication.successfulRunId' })
  }
  const supported = Array.isArray(options.supportedBackends)
    ? new Set(options.supportedBackends)
    : VALID_BACKENDS
  if (!pkg.executionBackends.some(backend => supported.has(backend))) {
    issues.push({ code: 'unsupported_backend', message: '当前环境不支持该流程的执行后端', path: 'executionBackends' })
  }
  if (typeof options.resolveAgentPackage === 'function') {
    for (const ref of pkg.agentRefs) {
      const resolved = options.resolveAgentPackage(ref.id, ref)
      if (!resolved || resolved.ok === false) {
        issues.push({ code: 'missing_agent', message: `无法解析 Agent: ${ref.id}`, path: 'agentRefs' })
      }
    }
  }
  if (typeof options.resolveSkill === 'function') {
    for (const ref of pkg.skillRefs) {
      const resolved = options.resolveSkill(ref.id, ref)
      if (!resolved || resolved.ok === false) {
        issues.push({ code: 'missing_skill', message: `无法解析 Skill: ${ref.id}`, path: 'skillRefs' })
      }
    }
  }
  return {
    ok: issues.length === 0,
    package: pkg,
    issues,
  }
}

function createWorkflowSnapshot(pkg) {
  const normalized = normalizeWorkflowPackage(pkg)
  if (!normalized.ok) return normalized
  const value = normalized.package
  return {
    ok: true,
    snapshot: {
      packageId: value.id,
      packageVersion: value.version,
      packageHash: value.packageHash,
      compositionHash: value.compositionHash,
      goalTypes: value.goalTypes,
      agentRefs: clone(value.agentRefs),
      skillRefs: clone(value.skillRefs),
      actionRefs: clone(value.actionRefs),
      graph: clone(value.graph),
      provenance: clone(value.provenance),
    },
  }
}

function forkWorkflowPackage(pkg, options = {}) {
  const normalized = normalizeWorkflowPackage(pkg)
  if (!normalized.ok) return normalized
  const source = normalized.package
  const id = cleanId(options.id || `${source.id}-fork-${Date.now().toString(36)}`, '派生流程标识')
  if (!id.ok) return id
  return normalizeWorkflowPackage({
    ...clone(source),
    id: id.id,
    name: options.name || `${source.name}（我的版本）`,
    source: 'forked',
    status: 'draft',
    version: '1.0.0',
    parentRef: { id: source.id, version: source.version },
    provenance: {
      ...clone(source.provenance),
      forkedFrom: { id: source.id, version: source.version },
    },
  })
}

module.exports = {
  PACKAGE_VERSION,
  READABLE_PACKAGE_VERSIONS,
  AUTHORING_NODE_TYPES,
  LEGACY_NODE_TYPES,
  VALID_SOURCES,
  VALID_STATUSES,
  VALID_BACKENDS,
  normalizeWorkflowPackage,
  validateWorkflowPackage,
  createWorkflowSnapshot,
  forkWorkflowPackage,
  stableHash,
}
