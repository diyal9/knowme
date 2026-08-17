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
const { fail, ok, issue, uniqueStrings, computePackageContentHash, createVersionLock, evaluatePackageTrust, validateSemver, validatePackageId, validateJsonSchemaSubset, normalizeCapabilities, normalizeGates, normalizeTests } = require('./agent-package-validate')

const AGENT_SCHEMA_VERSION = 1

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

module.exports = {
  validateAgentPackage,
  validateWorkflowDag,
  detectCycle,
  validateTeamPackage,
}
