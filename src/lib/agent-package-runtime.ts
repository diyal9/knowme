'use strict'

const fs = require('fs')
const path = require('path')
const packageTrust = require('./agent-package-trust')
const {
  PROTOCOL_VERSION,
  SERVICE_ERROR_CODES,
  handshake,
  validateSnapshotHash,
  assertNoPlaintextSecrets,
} = require('./agent-service-protocol')

const AGENT_SCHEMA_VERSION = 1
const TEAM_SCHEMA_VERSION = 1
const PACKAGE_ID_RE = /^[a-z][a-z0-9-]{0,62}$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const VALID_NODE_TYPES = new Set([
  'agent', 'gate', 'join', 'human', 'terminal', 'condition',
  'llm', 'tool', 'knowledge',
])
const SPECIALTY_NODE_TYPES = new Set(['llm', 'tool', 'knowledge'])
const VALID_JOIN_STRATEGIES = new Set(['allSucceeded', 'all', 'any', 'anySucceeded'])
const VALID_BACKENDS = new Set(['local-executor', 'cursor-package', 'claude-package', 'daemon-agent'])
const BUILDER_BACKEND_MAP = Object.freeze({
  local: 'local-executor',
  knowme: 'local-executor',
  cursor: 'cursor-package',
  claude: 'claude-package',
  'claude-code': 'claude-package',
  daemon: 'daemon-agent',
  'workbench-daemon': 'daemon-agent',
})

function fail(code, message, extra = {}) {
  return { ok: false, code, error: message, issues: extra.issues || [], ...extra }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function issue(code, message, fieldPath = '') {
  return { code, message, path: fieldPath }
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => String(v || '').trim()).filter(Boolean))]
}

function computePackageContentHash(manifest, extraFiles = []) {
  return packageTrust.computeIntegrityHash(manifest, extraFiles)
}

function createVersionLock(manifest, contentHash, sourceProvenance = {}) {
  return {
    packageId: manifest.packageId,
    version: manifest.version,
    contentHash: contentHash || computePackageContentHash(manifest),
    hashAlgorithm: packageTrust.HASH_ALGORITHM,
    lockVersion: 2,
    schemaVersion: manifest.schemaVersion,
    protocolVersion: manifest.protocolVersion ?? PROTOCOL_VERSION,
    builder: manifest.builder,
    backend: mapToBackend(manifest),
    lockedAt: new Date().toISOString(),
    sourceProvenance: {
      source: String(sourceProvenance.source || manifest.builder || 'local').trim(),
      ref: sourceProvenance.ref ? String(sourceProvenance.ref).trim() : '',
      originalBuilder: sourceProvenance.originalBuilder
        ? String(sourceProvenance.originalBuilder).trim()
        : manifest.builder,
    },
  }
}

function evaluatePackageTrust(manifest, contentHash, options = {}) {
  if (!options.trustPolicy) return ok({ skipped: true, trustLevel: 'not_evaluated' })
  const permissions = options.permissions || {
    capabilities: manifest.capabilities || {},
    orchestration: manifest.orchestration || {},
  }
  const trust = packageTrust.verifyPackageTrust({
    manifest,
    managedFiles: options.managedFiles,
    expectedContentHash: options.expectedContentHash || options.versionLock?.contentHash || contentHash,
    signature: options.signature,
    permissions,
    policy: options.trustPolicy,
    metrics: options.metrics,
  })
  if (!trust.ok) return trust

  if (options.previousPermissions) {
    const review = packageTrust.verifyPermissionReview({
      previousPermissions: options.previousPermissions,
      nextPermissions: permissions,
      contentHash: trust.contentHash,
      receipt: options.permissionReviewReceipt,
    })
    if (!review.ok) {
      options.metrics?.increment?.('package_trust_rejection_total', 1, { code: review.code })
      return review
    }
    return ok({ ...trust, permissionReview: review })
  }
  return ok(trust)
}

function validateSemver(version, fieldPath) {
  const value = String(version || '').trim()
  if (!SEMVER_RE.test(value)) {
    return issue('invalid_version', 'version 须为 semver', fieldPath)
  }
  return null
}

function validatePackageId(packageId, fieldPath = 'packageId') {
  const value = String(packageId || '').trim()
  if (!PACKAGE_ID_RE.test(value)) {
    return issue('invalid_package_id', 'packageId 须为小写 kebab-case', fieldPath)
  }
  return null
}

function validateJsonSchemaSubset(schema, value, fieldPath = '$') {
  const issues = []
  if (!schema || typeof schema !== 'object') {
    issues.push(issue('invalid_schema', 'schema 必须是对象', fieldPath))
    return { ok: false, issues }
  }

  const type = schema.type ? String(schema.type).trim() : null
  if (type === 'object') {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      issues.push(issue('type_mismatch', '期望 object', fieldPath))
      return { ok: false, issues }
    }
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (!(key in value)) {
        issues.push(issue('missing_required', `缺少必填字段 ${key}`, `${fieldPath}.${key}`))
      }
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in value)) continue
      const child = validateJsonSchemaSubset(propSchema, value[key], `${fieldPath}.${key}`)
      if (!child.ok) issues.push(...child.issues)
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(issue('type_mismatch', '期望 array', fieldPath))
      return { ok: false, issues }
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        const child = validateJsonSchemaSubset(schema.items, value[i], `${fieldPath}[${i}]`)
        if (!child.ok) issues.push(...child.issues)
      }
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'string') {
    if (typeof value !== 'string') issues.push(issue('type_mismatch', '期望 string', fieldPath))
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push(issue('type_mismatch', `期望 ${type}`, fieldPath))
    } else if (type === 'integer' && !Number.isInteger(value)) {
      issues.push(issue('type_mismatch', '期望 integer', fieldPath))
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') issues.push(issue('type_mismatch', '期望 boolean', fieldPath))
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  return { ok: true, issues: [] }
}

function normalizeCapabilities(raw) {
  if (!raw || typeof raw !== 'object') return { required: [], optional: [] }
  const mapDeps = (values) => (Array.isArray(values) ? values : []).map((item) => {
    if (typeof item === 'string') return { id: item.trim(), required: true }
    if (!item || typeof item !== 'object') return null
    const id = String(item.id || '').trim()
    if (!id) return null
    return {
      id,
      kind: item.kind ? String(item.kind).trim() : undefined,
      required: item.required !== false && item.optional !== true,
    }
  }).filter(Boolean)
  return {
    required: mapDeps(raw.required),
    optional: mapDeps(raw.optional),
  }
}

function normalizeGates(raw) {
  return (Array.isArray(raw) ? raw : []).map((gate, index) => {
    if (!gate || typeof gate !== 'object') return null
    const id = String(gate.id || '').trim()
    if (!id) return null
    const type = String(gate.type || 'smoke').trim()
    return {
      id,
      type,
      params: gate.params && typeof gate.params === 'object' ? gate.params : {},
      description: gate.description ? String(gate.description).trim() : '',
      _index: index,
    }
  }).filter(Boolean)
}

function normalizeTests(raw) {
  return (Array.isArray(raw) ? raw : []).map((test, index) => {
    if (!test || typeof test !== 'object') return null
    const id = String(test.id || '').trim()
    if (!id) return null
    return {
      id,
      fixtureRef: test.fixtureRef ? String(test.fixtureRef).trim() : '',
      expectation: test.expectation && typeof test.expectation === 'object' ? test.expectation : {},
      _index: index,
    }
  }).filter(Boolean)
}

function validateAgentPackage(raw = {}) {
  if (!raw || typeof raw !== 'object') return fail('invalid_manifest', 'agent manifest 必须是对象')

  const schemaVersion = Number(raw.schemaVersion)
  if (schemaVersion !== AGENT_SCHEMA_VERSION) {
    return fail('unsupported_schema', `不支持的 schemaVersion: ${raw.schemaVersion}`, {
      issues: [issue('unsupported_schema', `仅支持 schemaVersion=${AGENT_SCHEMA_VERSION}`, 'schemaVersion')],
    })
  }

  const issues = []
  const packageIdIssue = validatePackageId(raw.packageId)
  if (packageIdIssue) issues.push(packageIdIssue)
  const versionIssue = validateSemver(raw.version, 'version')
  if (versionIssue) issues.push(versionIssue)

  if (!String(raw.name || '').trim()) issues.push(issue('missing_name', '缺少 name', 'name'))
  const builder = String(raw.builder || 'local').trim().toLowerCase()
  if (!builder) issues.push(issue('missing_builder', '缺少 builder', 'builder'))

  const persona = raw.persona && typeof raw.persona === 'object' ? raw.persona : null
  if (!persona || !String(persona.role || '').trim()) {
    issues.push(issue('missing_persona', 'persona.role 必填', 'persona.role'))
  }

  const inputs = raw.inputs && typeof raw.inputs === 'object' ? raw.inputs : null
  const outputs = raw.outputs && typeof raw.outputs === 'object' ? raw.outputs : null
  if (!inputs || !inputs.type) issues.push(issue('missing_inputs', 'inputs JSON Schema 必填', 'inputs'))
  if (!outputs || !outputs.type) issues.push(issue('missing_outputs', 'outputs JSON Schema 必填', 'outputs'))

  const protocolVersion = Number(raw.protocolVersion ?? PROTOCOL_VERSION)
  if (!Number.isFinite(protocolVersion) || protocolVersion < 1) {
    issues.push(issue('invalid_protocol', 'protocolVersion 无效', 'protocolVersion'))
  }

  if (issues.length) {
    return fail('validation_failed', 'Agent Package 校验失败', { issues })
  }

  const manifest = {
    schemaVersion: AGENT_SCHEMA_VERSION,
    packageId: String(raw.packageId).trim(),
    name: String(raw.name).trim(),
    version: String(raw.version).trim(),
    builder,
    protocolVersion,
    persona: {
      role: String(persona.role).trim(),
      stance: persona.stance ? String(persona.stance).trim() : '',
      description: persona.description ? String(persona.description).trim() : '',
    },
    capabilities: normalizeCapabilities(raw.capabilities),
    inputs,
    outputs,
    gates: normalizeGates(raw.gates),
    tests: normalizeTests(raw.tests),
    compatibility: {
      builders: uniqueStrings(raw.compatibility?.builders || [builder]),
      fallbackLocal: raw.compatibility?.fallbackLocal === true,
    },
    orchestration: raw.orchestration && typeof raw.orchestration === 'object'
      ? {
        allowDelegate: raw.orchestration.allowDelegate !== false,
        maxParallel: Number.isFinite(Number(raw.orchestration.maxParallel))
          ? Number(raw.orchestration.maxParallel)
          : 1,
        allowedSubExperts: uniqueStrings(raw.orchestration.allowedSubExperts),
      }
      : { allowDelegate: true, maxParallel: 1, allowedSubExperts: [] },
  }

  const contentHash = computePackageContentHash(manifest)
  return ok({ manifest, contentHash, summary: summarizeAgentPackage(manifest) })
}

function validateWorkflowDag(workflow = {}) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const edges = Array.isArray(workflow.edges) ? workflow.edges : []
  const issues = []

  if (!nodes.length) {
    return fail('invalid_workflow', 'workflow.nodes 不能为空', {
      issues: [issue('missing_nodes', '缺少 workflow.nodes', 'workflow.nodes')],
    })
  }

  const nodeIds = new Set()
  const adjacency = new Map()
  const inDegree = new Map()

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      issues.push(issue('invalid_node', '节点必须是对象', 'workflow.nodes'))
      continue
    }
    const id = String(node.id || '').trim()
    if (!id) {
      issues.push(issue('missing_node_id', '节点缺少 id', 'workflow.nodes'))
      continue
    }
    if (nodeIds.has(id)) {
      issues.push(issue('duplicate_node_id', `重复节点 id: ${id}`, `workflow.nodes.${id}`))
      continue
    }
    nodeIds.add(id)
    adjacency.set(id, [])
    inDegree.set(id, 0)

    const type = String(node.type || 'agent').trim()
    if (!VALID_NODE_TYPES.has(type)) {
      issues.push(issue('invalid_node_type', `未知节点类型: ${type}`, `workflow.nodes.${id}.type`))
    }
    if (type === 'agent' && !String(node.agentPackageId || node.agent || '').trim()) {
      issues.push(issue('missing_agent_ref', 'agent 节点缺少 agentPackageId', `workflow.nodes.${id}.agentPackageId`))
    }
    if (type === 'llm') {
      const model = String(node.config?.modelName || node.config?.model || node.modelName || '').trim()
      if (!model) {
        issues.push(issue('missing_model', 'llm 节点缺少模型', `workflow.nodes.${id}.config.modelName`))
      }
      node.config = node.config && typeof node.config === 'object' ? node.config : {}
    }
    if (type === 'tool') {
      const skillId = String(node.config?.skillId || node.skillId || '').trim()
      if (!skillId) {
        issues.push(issue('missing_skill', 'tool 节点缺少 skillId', `workflow.nodes.${id}.config.skillId`))
      }
      node.config = node.config && typeof node.config === 'object' ? node.config : {}
    }
    if (type === 'knowledge') {
      const knowledgeId = String(node.config?.knowledgeId || node.knowledgeId || '').trim()
      if (!knowledgeId) {
        issues.push(issue('missing_knowledge', 'knowledge 节点缺少 knowledgeId', `workflow.nodes.${id}.config.knowledgeId`))
      }
      node.config = node.config && typeof node.config === 'object' ? node.config : {}
    }
    if (type === 'gate' && !String(node.gateRef || node.gate_id || '').trim()) {
      issues.push(issue('missing_gate_ref', 'gate 节点缺少 gateRef', `workflow.nodes.${id}.gateRef`))
    }
    if (type === 'condition') {
      // condition payload is optional; defaults applied at execution
      node.condition = node.condition && typeof node.condition === 'object' ? node.condition : {}
    }
  }

  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') {
      issues.push(issue('invalid_edge', '边必须是对象', 'workflow.edges'))
      continue
    }
    const from = String(edge.from || edge.source || '').trim()
    const to = String(edge.to || edge.target || '').trim()
    if (!from || !to) {
      issues.push(issue('invalid_edge', '边缺少 from/to', 'workflow.edges'))
      continue
    }
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      issues.push(issue('dangling_edge', `边引用未知节点: ${from} -> ${to}`, 'workflow.edges'))
      continue
    }
    adjacency.get(from).push(to)
    inDegree.set(to, (inDegree.get(to) || 0) + 1)
  }

  const cyclePath = detectCycle(adjacency, nodeIds)
  if (cyclePath.length) {
    return fail('workflow_cycle', `workflow 存在环: ${cyclePath.join(' -> ')}`, {
      issues: [issue('workflow_cycle', `环路径: ${cyclePath.join(' -> ')}`, 'workflow.edges')],
      cyclePath,
    })
  }

  const joinStrategy = String(workflow.joinStrategy || 'allSucceeded').trim()
  if (!VALID_JOIN_STRATEGIES.has(joinStrategy)) {
    issues.push(issue('invalid_join_strategy', `未知 joinStrategy: ${joinStrategy}`, 'workflow.joinStrategy'))
  }

  const parallelism = Number.isFinite(Number(workflow.parallelism))
    ? Number(workflow.parallelism)
    : 1
  if (parallelism < 1) {
    issues.push(issue('invalid_parallelism', 'parallelism 须 >= 1', 'workflow.parallelism'))
  }

  if (issues.length) {
    return fail('validation_failed', 'Workflow DAG 校验失败', { issues })
  }

  const entryNodes = [...nodeIds].filter(id => (inDegree.get(id) || 0) === 0)
  const terminalNodes = nodes.filter(n => String(n.type) === 'terminal').map(n => String(n.id))

  return ok({
    workflow: {
      nodes,
      edges,
      joinStrategy,
      parallelism,
      entryNodes,
      terminalNodes,
    },
  })
}

function detectCycle(adjacency, nodeIds) {
  const visiting = new Set()
  const visited = new Set()
  const stack = []

  const dfs = (node) => {
    if (visited.has(node)) return []
    if (visiting.has(node)) {
      const idx = stack.indexOf(node)
      return idx >= 0 ? [...stack.slice(idx), node] : [node]
    }
    visiting.add(node)
    stack.push(node)
    for (const next of adjacency.get(node) || []) {
      const cycle = dfs(next)
      if (cycle.length) return cycle
    }
    stack.pop()
    visiting.delete(node)
    visited.add(node)
    return []
  }

  for (const node of nodeIds) {
    const cycle = dfs(node)
    if (cycle.length) return cycle
  }
  return []
}

function validateTeamPackage(raw = {}, options = {}) {
  if (!raw || typeof raw !== 'object') return fail('invalid_manifest', 'team manifest 必须是对象')

  const schemaVersion = Number(raw.schemaVersion)
  if (schemaVersion !== TEAM_SCHEMA_VERSION) {
    return fail('unsupported_schema', `不支持的 schemaVersion: ${raw.schemaVersion}`, {
      issues: [issue('unsupported_schema', `仅支持 schemaVersion=${TEAM_SCHEMA_VERSION}`, 'schemaVersion')],
    })
  }

  const issues = []
  const packageIdIssue = validatePackageId(raw.packageId)
  if (packageIdIssue) issues.push(packageIdIssue)
  const versionIssue = validateSemver(raw.version, 'version')
  if (versionIssue) issues.push(versionIssue)
  if (!String(raw.name || '').trim()) issues.push(issue('missing_name', '缺少 name', 'name'))

  const members = (Array.isArray(raw.members) ? raw.members : []).map((member, index) => {
    if (!member || typeof member !== 'object') {
      issues.push(issue('invalid_member', 'member 必须是对象', `members[${index}]`))
      return null
    }
    const agentPackageId = String(member.agentPackageId || member.agent || '').trim()
    if (!agentPackageId) {
      issues.push(issue('missing_member_agent', 'member 缺少 agentPackageId', `members[${index}].agentPackageId`))
      return null
    }
    return {
      agentPackageId,
      role: member.role ? String(member.role).trim() : agentPackageId,
      gateRef: member.gateRef ? String(member.gateRef).trim() : '',
    }
  }).filter(Boolean)

  const dag = validateWorkflowDag(raw.workflow || {})
  if (!dag.ok) {
    issues.push(...(dag.issues || []))
  }

  if (!members.length) {
    const specialtyCount = (dag.ok ? dag.workflow.nodes : [])
      .filter(node => SPECIALTY_NODE_TYPES.has(String(node.type || ''))).length
    if (!specialtyCount) {
      issues.push(issue('missing_members', 'members 不能为空', 'members'))
    }
  }

  const resolveAgent = typeof options.resolveAgentPackage === 'function'
    ? options.resolveAgentPackage
    : null
  if (resolveAgent && dag.ok) {
    for (const member of members) {
      const resolved = resolveAgent(member.agentPackageId)
      if (!resolved || resolved.ok === false) {
        issues.push(issue(
          'unresolved_member',
          `执行专家「${member.agentPackageId}」已删除或不存在，请重新选择后再保存`,
          `members.${member.agentPackageId}`,
        ))
      }
    }
    for (const node of dag.workflow.nodes) {
      if (String(node.type) !== 'agent') continue
      const agentPackageId = String(node.agentPackageId || node.agent || '').trim()
      if (!agentPackageId) continue
      const resolved = resolveAgent(agentPackageId)
      if (!resolved || resolved.ok === false) {
        issues.push(issue(
          'unresolved_node_agent',
          `执行专家「${agentPackageId}」已删除或不存在，请重新选择后再保存`,
          `workflow.nodes.${node.id}.agentPackageId`,
        ))
      }
    }
  }

  if (issues.length) {
    return fail('validation_failed', 'Team Package 校验失败', { issues })
  }

  const manifest = {
    schemaVersion: TEAM_SCHEMA_VERSION,
    packageId: String(raw.packageId).trim(),
    name: String(raw.name).trim(),
    version: String(raw.version).trim(),
    members,
    workflow: dag.workflow,
    gates: normalizeGates(raw.gates),
    tests: normalizeTests(raw.tests),
  }

  const contentHash = computePackageContentHash(manifest)
  return ok({ manifest, contentHash, summary: summarizeTeamPackage(manifest) })
}

function summarizeAgentPackage(manifest) {
  return {
    packageId: manifest.packageId,
    name: manifest.name,
    version: manifest.version,
    builder: manifest.builder,
    backend: mapToBackend(manifest),
    gateCount: manifest.gates.length,
    testCount: manifest.tests.length,
    requiredCapabilities: manifest.capabilities.required.map(c => c.id),
  }
}

function summarizeTeamPackage(manifest) {
  return {
    packageId: manifest.packageId,
    name: manifest.name,
    version: manifest.version,
    memberCount: manifest.members.length,
    nodeCount: manifest.workflow.nodes.length,
    joinStrategy: manifest.workflow.joinStrategy,
    parallelism: manifest.workflow.parallelism,
    gateCount: manifest.gates.length,
  }
}

function mapToBackend(manifest = {}) {
  const explicit = String(manifest.backend || manifest.runtimeBackend || '').trim()
  if (explicit && VALID_BACKENDS.has(explicit)) return explicit
  const builder = String(manifest.builder || 'local').trim().toLowerCase()
  return BUILDER_BACKEND_MAP[builder] || 'local-executor'
}

function normalizeLocalAgentPackage(raw = {}) {
  const validated = validateAgentPackage({
    schemaVersion: AGENT_SCHEMA_VERSION,
    packageId: raw.packageId || raw.id,
    name: raw.name || raw.title || raw.packageId || raw.id,
    version: raw.version || '1.0.0',
    builder: 'local',
    protocolVersion: raw.protocolVersion ?? PROTOCOL_VERSION,
    persona: raw.persona || { role: raw.role || raw.title || 'Agent' },
    capabilities: raw.capabilities || { required: raw.skills?.required, optional: raw.skills?.optional },
    inputs: raw.inputs || { type: 'object', properties: {} },
    outputs: raw.outputs || { type: 'object', properties: {} },
    gates: raw.gates,
    tests: raw.tests,
    compatibility: { builders: ['local'], fallbackLocal: true },
    orchestration: raw.orchestration,
  })
  if (!validated.ok) return validated
  return ok({
    manifest: validated.manifest,
    contentHash: validated.contentHash,
    adapter: 'local',
    normalized: true,
  })
}

function normalizeCursorAgentPackage(raw = {}) {
  const builderProtocolVersion = Number(raw.builderProtocolVersion ?? raw.protocolVersion ?? PROTOCOL_VERSION)
  const validated = validateAgentPackage({
    schemaVersion: AGENT_SCHEMA_VERSION,
    packageId: raw.packageId || raw.id || raw.agentId,
    name: raw.name || raw.title || raw.id,
    version: raw.version || '1.0.0',
    builder: 'cursor',
    protocolVersion: builderProtocolVersion,
    persona: raw.persona || {
      role: raw.persona?.role || raw.role || raw.title || 'Cursor Agent',
      stance: raw.persona?.stance || raw.stance || 'evidence-first',
    },
    capabilities: raw.capabilities || {
      required: (raw.skills?.required || raw.tools?.required || []).map(id => ({ id, kind: 'skill' })),
      optional: (raw.skills?.optional || raw.tools?.optional || []).map(id => ({ id, kind: 'skill' })),
    },
    inputs: raw.inputs || raw.inputSchema || { type: 'object', properties: {} },
    outputs: raw.outputs || raw.outputSchema || { type: 'object', properties: {} },
    gates: raw.gates,
    tests: raw.tests,
    compatibility: {
      builders: uniqueStrings(raw.compatibility?.builders || ['cursor']),
      fallbackLocal: raw.compatibility?.fallbackLocal === true,
    },
    orchestration: raw.orchestration,
  })
  if (!validated.ok) return validated
  return ok({
    manifest: validated.manifest,
    contentHash: validated.contentHash,
    adapter: 'cursor',
    normalized: true,
    sourceBuilder: 'cursor',
    builderProtocolVersion,
  })
}

function normalizeClaudeAgentPackage(raw = {}) {
  const builderProtocolVersion = Number(raw.builderProtocolVersion ?? raw.protocolVersion ?? PROTOCOL_VERSION)
  const validated = validateAgentPackage({
    schemaVersion: AGENT_SCHEMA_VERSION,
    packageId: raw.packageId || raw.id || raw.agent_id,
    name: raw.name || raw.display_name || raw.id,
    version: raw.version || '1.0.0',
    builder: 'claude',
    protocolVersion: builderProtocolVersion,
    persona: raw.persona || {
      role: raw.persona?.role || raw.role || raw.display_name || 'Claude Agent',
      stance: raw.persona?.stance || 'helpful',
    },
    capabilities: raw.capabilities || {
      required: (raw.capabilities?.required || raw.tools || []).map(item => (
        typeof item === 'string' ? { id: item, kind: 'skill' } : item
      )),
      optional: raw.capabilities?.optional || [],
    },
    inputs: raw.inputs || raw.input_schema || { type: 'object', properties: {} },
    outputs: raw.outputs || raw.output_schema || { type: 'object', properties: {} },
    gates: raw.gates,
    tests: raw.tests,
    compatibility: {
      builders: uniqueStrings(raw.compatibility?.builders || ['claude']),
      fallbackLocal: raw.compatibility?.fallbackLocal === true,
    },
    orchestration: raw.orchestration,
  })
  if (!validated.ok) return validated
  return ok({
    manifest: validated.manifest,
    contentHash: validated.contentHash,
    adapter: 'claude',
    normalized: true,
    sourceBuilder: 'claude',
    builderProtocolVersion,
  })
}

function normalizeDaemonAgentPackage(raw = {}) {
  const validated = validateAgentPackage({
    schemaVersion: AGENT_SCHEMA_VERSION,
    packageId: raw.packageId || raw.slug || raw.id,
    name: raw.name || raw.title || raw.slug,
    version: raw.version || '1.0.0',
    builder: 'daemon',
    protocolVersion: raw.protocolVersion ?? PROTOCOL_VERSION,
    persona: raw.persona || { role: raw.role || raw.title || '管线服务专家' },
    capabilities: raw.capabilities || { required: raw.capabilities?.required, optional: raw.capabilities?.optional },
    inputs: raw.inputs || { type: 'object', properties: {} },
    outputs: raw.outputs || { type: 'object', properties: {} },
    gates: raw.gates,
    tests: raw.tests,
    compatibility: {
      builders: uniqueStrings(raw.compatibility?.builders || ['daemon', 'workbench-daemon']),
      fallbackLocal: raw.compatibility?.fallbackLocal === true,
    },
    orchestration: raw.orchestration,
  })
  if (!validated.ok) return validated
  return ok({
    manifest: validated.manifest,
    contentHash: validated.contentHash,
    adapter: 'daemon',
    normalized: true,
    sourceBuilder: 'daemon',
  })
}

const NORMALIZE_ADAPTERS = Object.freeze({
  local: normalizeLocalAgentPackage,
  knowme: normalizeLocalAgentPackage,
  cursor: normalizeCursorAgentPackage,
  claude: normalizeClaudeAgentPackage,
  'claude-code': normalizeClaudeAgentPackage,
  daemon: normalizeDaemonAgentPackage,
  'workbench-daemon': normalizeDaemonAgentPackage,
})

function normalizeAgentPackage(raw = {}, builderHint = '') {
  const builder = String(builderHint || raw.builder || raw.sourceBuilder || 'local').trim().toLowerCase()
  const adapter = NORMALIZE_ADAPTERS[builder] || normalizeLocalAgentPackage
  return adapter(raw)
}

function validateHandoffPayload(manifest, payload) {
  if (!manifest?.inputs) {
    return fail(SERVICE_ERROR_CODES.HANDOFF_SCHEMA_INVALID, '缺少 inputs schema')
  }
  const secretGuard = assertNoPlaintextSecrets(payload)
  if (!secretGuard.ok) return secretGuard
  const result = validateJsonSchemaSubset(manifest.inputs, payload, '$')
  if (!result.ok) {
    return fail(SERVICE_ERROR_CODES.HANDOFF_SCHEMA_INVALID, 'handoff payload 不符合 inputs schema', {
      issues: result.issues,
    })
  }
  return ok({ payload })
}

function validateOutputPayload(manifest, payload) {
  if (!manifest?.outputs) {
    return fail(SERVICE_ERROR_CODES.OUTPUT_SCHEMA_INVALID, '缺少 outputs schema')
  }
  const result = validateJsonSchemaSubset(manifest.outputs, payload, '$')
  if (!result.ok) {
    return fail(SERVICE_ERROR_CODES.OUTPUT_SCHEMA_INVALID, 'output payload 不符合 outputs schema', {
      issues: result.issues,
    })
  }
  return ok({ payload })
}

function materializeRunSpec(ctx = {}) {
  const manifest = ctx.manifest || ctx.agentManifest
  if (!manifest) return fail('missing_manifest', '缺少 agent manifest')

  const lock = ctx.versionLock || createVersionLock(manifest, ctx.contentHash, ctx.sourceProvenance)
  const snapshotCheck = ctx.expectedSnapshotHash
    ? validateSnapshotHash(ctx.expectedSnapshotHash, lock)
    : ok()
  if (!snapshotCheck.ok) return snapshotCheck

  const trust = evaluatePackageTrust(manifest, lock.contentHash, {
    trustPolicy: ctx.trustPolicy,
    versionLock: lock,
    expectedContentHash: ctx.expectedPackageContentHash,
    signature: ctx.packageSignature || ctx.signature,
    permissions: ctx.permissions,
    previousPermissions: ctx.previousPermissions,
    permissionReviewReceipt: ctx.permissionReviewReceipt,
    managedFiles: ctx.managedFiles,
    metrics: ctx.metrics,
  })
  if (!trust.ok) return trust

  const backend = mapToBackend(manifest)
  const handshakeResult = ctx.remoteCapabilities
    ? handshake(
      {
        protocolVersion: lock.protocolVersion,
        supportedCapabilities: ctx.localCapabilities,
        authMode: ctx.authMode,
      },
      ctx.remoteCapabilities,
    )
    : ok({ negotiatedVersion: lock.protocolVersion, supportedCapabilities: [], builderId: manifest.builder })

  if (!handshakeResult.ok) return handshakeResult

  const permissions = {
    sandbox: { enabled: true, denyTraversal: true, ...(ctx.permissions?.sandbox || {}) },
    connectors: { allowedConnectorIds: uniqueStrings(ctx.permissions?.connectors?.allowedConnectorIds) },
    tools: {
      allowlist: uniqueStrings(ctx.permissions?.tools?.allowlist || ctx.toolAllowlist),
      denylist: uniqueStrings(ctx.permissions?.tools?.denylist),
    },
    orchestration: {
      allowDelegate: manifest.orchestration?.allowDelegate !== false,
      maxParallel: manifest.orchestration?.maxParallel ?? 1,
      allowedSubExperts: uniqueStrings(manifest.orchestration?.allowedSubExperts),
    },
    budget: ctx.permissions?.budget && typeof ctx.permissions.budget === 'object'
      ? ctx.permissions.budget
      : { maxToolCalls: 32, maxLlmRounds: 16, maxWallMs: 300000 },
    approvals: ctx.permissions?.approvals && typeof ctx.permissions.approvals === 'object'
      ? ctx.permissions.approvals
      : { sideEffectDefault: 'draft' },
    paths: ctx.permissions?.paths && typeof ctx.permissions.paths === 'object'
      ? ctx.permissions.paths
      : { contentRoots: [], denyTraversal: true },
  }

  return ok({
    runSpec: {
      packageRef: {
        kind: 'agent-package',
        id: manifest.packageId,
        version: lock.version,
        builder: manifest.builder,
        backend,
      },
      versionLock: lock,
      expertSnapshot: ctx.expertSnapshot || {
        expertId: ctx.expertId || manifest.packageId,
        contentHash: lock.contentHash,
      },
      tools: permissions.tools,
      permissions,
      workflow: ctx.workflow || null,
      gates: manifest.gates,
      handshake: handshakeResult.ok ? {
        negotiatedVersion: handshakeResult.negotiatedVersion,
        builderId: handshakeResult.builderId || manifest.builder,
        supportedCapabilities: handshakeResult.supportedCapabilities || [],
      } : null,
      governanceEnvelope: permissions,
      packageTrust: trust.skipped ? null : trust,
    },
  })
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    return { __parseError: err.message }
  }
}

function loadAgentPackageFromDir(packageDir, options = {}) {
  const dir = path.resolve(String(packageDir || ''))
  const manifestPath = path.join(dir, 'agent.package.json')
  if (!fs.existsSync(manifestPath)) {
    return fail('missing_manifest', `缺少 agent.package.json: ${manifestPath}`)
  }
  const raw = readJsonFile(manifestPath)
  if (raw.__parseError) return fail('invalid_json', raw.__parseError)

  const builderHint = options.builder || raw.builder
  const normalized = options.normalize === false
    ? validateAgentPackage(raw)
    : normalizeAgentPackage(raw, builderHint)

  if (!normalized.ok) return normalized

  const versionLock = createVersionLock(
    normalized.manifest,
    normalized.contentHash,
    { source: 'filesystem', ref: manifestPath, originalBuilder: raw.builder },
  )
  const trust = evaluatePackageTrust(normalized.manifest, normalized.contentHash, {
    ...options,
    expectedContentHash: options.expectedContentHash
      || options.versionLock?.contentHash
      || raw.integrity?.contentHash
      || raw.contentHash,
    signature: options.signature || raw.signature || raw.integrity?.signature,
    permissions: options.permissions || raw.permissions,
  })
  if (!trust.ok) return trust

  return ok({
    dir,
    manifestPath,
    manifest: normalized.manifest,
    contentHash: normalized.contentHash,
    versionLock,
    summary: summarizeAgentPackage(normalized.manifest),
    adapter: normalized.adapter || builderHint || normalized.manifest.builder,
    trust: trust.skipped ? null : trust,
  })
}

function loadTeamPackageFromDir(packageDir, options = {}) {
  const dir = path.resolve(String(packageDir || ''))
  const manifestPath = path.join(dir, 'team.package.json')
  if (!fs.existsSync(manifestPath)) {
    return fail('missing_manifest', `缺少 team.package.json: ${manifestPath}`)
  }
  const raw = readJsonFile(manifestPath)
  if (raw.__parseError) return fail('invalid_json', raw.__parseError)

  const resolveAgentPackage = (agentPackageId) => {
    if (typeof options.resolveAgentPackage === 'function') {
      return options.resolveAgentPackage(agentPackageId)
    }
    if (options.agentsRoot) {
      return loadAgentPackageFromDir(path.join(options.agentsRoot, agentPackageId), options)
    }
    return ok({ packageId: agentPackageId })
  }

  const validated = validateTeamPackage(raw, { resolveAgentPackage })
  if (!validated.ok) return validated

  const versionLock = createVersionLock(
    validated.manifest,
    validated.contentHash,
    { source: 'filesystem', ref: manifestPath },
  )
  const trust = evaluatePackageTrust(validated.manifest, validated.contentHash, {
    ...options,
    expectedContentHash: options.expectedContentHash
      || options.versionLock?.contentHash
      || raw.integrity?.contentHash
      || raw.contentHash,
    signature: options.signature || raw.signature || raw.integrity?.signature,
    permissions: options.permissions || raw.permissions,
  })
  if (!trust.ok) return trust

  return ok({
    dir,
    manifestPath,
    manifest: validated.manifest,
    contentHash: validated.contentHash,
    versionLock,
    summary: summarizeTeamPackage(validated.manifest),
    trust: trust.skipped ? null : trust,
  })
}

function importCompatiblePackage(raw = {}, builderHint = '', options = {}) {
  const normalized = normalizeAgentPackage(raw, builderHint)
  if (!normalized.ok) return normalized
  const trust = evaluatePackageTrust(normalized.manifest, normalized.contentHash, {
    ...options,
    expectedContentHash: options.expectedContentHash
      || options.versionLock?.contentHash
      || raw.integrity?.contentHash
      || raw.contentHash,
    signature: options.signature || raw.signature || raw.integrity?.signature,
    permissions: options.permissions || raw.permissions,
  })
  if (!trust.ok) return trust
  return ok({
    normalizedManifest: normalized.manifest,
    contentHash: normalized.contentHash,
    versionLock: createVersionLock(normalized.manifest, normalized.contentHash, {
      source: 'import',
      originalBuilder: builderHint || raw.builder,
    }),
    writeHint: {
      targetFile: 'agent.package.json',
      note: '原始 Builder 文件保持不变；normalized manifest 写入受管目录',
    },
    trust: trust.skipped ? null : trust,
  })
}

module.exports = {
  AGENT_SCHEMA_VERSION,
  TEAM_SCHEMA_VERSION,
  PACKAGE_ID_RE,
  SEMVER_RE,
  VALID_NODE_TYPES,
  SPECIALTY_NODE_TYPES,
  VALID_JOIN_STRATEGIES,
  VALID_BACKENDS,
  BUILDER_BACKEND_MAP,
  fail,
  ok,
  issue,
  computePackageContentHash,
  createVersionLock,
  evaluatePackageTrust,
  packageTrust,
  validateJsonSchemaSubset,
  validateAgentPackage,
  validateTeamPackage,
  validateWorkflowDag,
  validateHandoffPayload,
  validateOutputPayload,
  mapToBackend,
  normalizeLocalAgentPackage,
  normalizeCursorAgentPackage,
  normalizeClaudeAgentPackage,
  normalizeDaemonAgentPackage,
  normalizeAgentPackage,
  materializeRunSpec,
  loadAgentPackageFromDir,
  loadTeamPackageFromDir,
  importCompatiblePackage,
  summarizeAgentPackage,
  summarizeTeamPackage,
}
