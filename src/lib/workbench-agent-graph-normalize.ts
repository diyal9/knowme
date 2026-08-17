'use strict'

const crypto = require('crypto')
const { issue } = require('./agent-package-validate')

function stableString(value) {
  return String(value ?? '').trim()
}

function uniqueNonEmpty(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(stableString).filter(Boolean))]
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')
}

function makeIssue(code, message, fieldPath = '') {
  return issue(code, message, fieldPath)
}

function failResult(issues, partial = {}) {
  return {
    ok: false,
    composition: partial.composition || null,
    teamPackage: partial.teamPackage || null,
    snapshot: partial.snapshot || null,
    issues: Array.isArray(issues) ? issues : [],
  }
}

function okResult(payload) {
  return {
    ok: true,
    composition: payload.composition,
    teamPackage: payload.teamPackage,
    snapshot: payload.snapshot,
    issues: [],
  }
}

function normalizeGate(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const id = stableString(raw.id || raw.gateRef || raw.gate_id)
  if (!id) return null
  return {
    id,
    type: stableString(raw.type || 'approval') || 'approval',
    title: stableString(raw.title || raw.description || id),
    description: stableString(raw.description || raw.title || ''),
    params: raw.params && typeof raw.params === 'object' ? raw.params : {},
    _index: index,
  }
}

function normalizeMember(raw, index, issues) {
  if (!raw || typeof raw !== 'object') {
    issues.push(makeIssue('invalid_member', 'member 必须是对象', `members[${index}]`))
    return null
  }
  const id = stableString(raw.id || raw.nodeId || raw.memberId || raw.agentPackageId || raw.expertId)
  const agentPackageId = stableString(raw.agentPackageId || raw.agent || raw.expertId || raw.id)
  if (!id) {
    issues.push(makeIssue('missing_member_id', 'member 缺少 id', `members[${index}].id`))
    return null
  }
  if (!agentPackageId) {
    issues.push(makeIssue('missing_member_agent', 'member 缺少 agentPackageId', `members[${index}].agentPackageId`))
    return null
  }
  const agentOrigin = stableString(raw.agentOrigin || raw.origin || 'local') || 'local'
  if (agentOrigin === 'daemon') {
    issues.push(makeIssue('daemon_agent_readonly', '管线服务专家不能作为本地工作流节点', `members[${index}].agentOrigin`))
  }
  return {
    id,
    expertId: stableString(raw.expertId || agentPackageId),
    agentPackageId,
    agentOrigin,
    profileId: stableString(raw.profileId || ''),
    packageHash: stableString(raw.packageHash || raw.contentHash || ''),
    profileHash: stableString(raw.profileHash || raw.profile?.profileHash || ''),
    role: stableString(raw.role || agentPackageId),
    intent: stableString(raw.intent || raw.goal || ''),
    gateRef: stableString(raw.gateRef || ''),
    skillRefs: Array.isArray(raw.skillRefs) ? raw.skillRefs.map(item => ({ ...item })) : [],
    connectorRefs: Array.isArray(raw.connectorRefs) ? raw.connectorRefs.map(item => ({ ...item })) : [],
    knowledgeRefs: Array.isArray(raw.knowledgeRefs) ? raw.knowledgeRefs.map(item => ({ ...item })) : [],
    profile: raw.profile && typeof raw.profile === 'object' ? { ...raw.profile } : null,
  }
}

function normalizeEdge(raw, index, issues) {
  if (!raw || typeof raw !== 'object') {
    issues.push(makeIssue('invalid_edge', 'edge 必须是对象', `edges[${index}]`))
    return null
  }
  const from = stableString(raw.from || raw.source)
  const to = stableString(raw.to || raw.target)
  if (!from || !to) {
    issues.push(makeIssue('invalid_edge', 'edge 缺少 from/to', `edges[${index}]`))
    return null
  }
  return {
    from,
    to,
    label: stableString(raw.label || raw.handoff || ''),
    branch: (() => {
      const value = stableString(raw.branch || raw.labelKey || '')
      return value === 'true' || value === 'false' ? value : ''
    })(),
  }
}

function normalizeNode(raw, index, memberById, issues) {
  if (!raw || typeof raw !== 'object') {
    issues.push(makeIssue('invalid_node', 'node 必须是对象', `nodes[${index}]`))
    return null
  }
  const id = stableString(raw.id || raw.nodeId)
  if (!id) {
    issues.push(makeIssue('missing_node_id', 'node 缺少 id', `nodes[${index}].id`))
    return null
  }
  const type = stableString(raw.type || 'agent') || 'agent'
  if (!VALID_NODE_TYPES.has(type)) {
    issues.push(makeIssue('invalid_node_type', `未知节点类型: ${type}`, `nodes[${index}].type`))
  }
  const memberRef = stableString(raw.memberId || raw.member || '')
  const member = memberRef ? memberById.get(memberRef) : null
  const agentPackageId = stableString(
    raw.agentPackageId || raw.agent || member?.agentPackageId || '',
  )
  const gateRef = stableString(raw.gateRef || raw.gate_id || raw.gateId || '')
  const normalized = {
    id,
    type,
    intent: stableString(raw.intent || member?.intent || ''),
    role: stableString(raw.role || member?.role || agentPackageId),
    description: stableString(raw.description || ''),
    relation: stableString(raw.relation || raw.relationToNext || 'serial'),
  }
  if (type === 'agent') {
    normalized.agentPackageId = agentPackageId
    normalized.agentOrigin = stableString(raw.agentOrigin || member?.agentOrigin || 'local') || 'local'
    normalized.profileId = stableString(raw.profileId || member?.profileId || '')
    normalized.packageHash = stableString(raw.packageHash || member?.packageHash || '')
    normalized.profileHash = stableString(raw.profileHash || member?.profileHash || '')
    if (normalized.agentOrigin === 'daemon') {
      issues.push(makeIssue('daemon_agent_readonly', '管线服务专家不能作为本地工作流节点', `nodes[${index}].agentOrigin`))
    }
    if (!agentPackageId) {
      issues.push(makeIssue('missing_agent_ref', 'agent 节点缺少 agentPackageId', `nodes[${index}].agentPackageId`))
    }
  }
  if (type === 'gate') {
    normalized.gateRef = gateRef
    if (!gateRef) {
      issues.push(makeIssue('missing_gate_ref', 'gate 节点缺少 gateRef', `nodes[${index}].gateRef`))
    }
  }
  if (type === 'join') {
    normalized.joinStrategy = stableString(raw.joinStrategy || DEFAULT_JOIN_STRATEGY)
  }
  if (type === 'condition') {
    normalized.condition = raw.condition && typeof raw.condition === 'object' ? { ...raw.condition } : {}
  }
  if (type === 'llm' || type === 'tool' || type === 'knowledge') {
    const cfg = raw.config && typeof raw.config === 'object' ? { ...raw.config } : {}
    if (type === 'llm') {
      cfg.modelName = stableString(cfg.modelName || cfg.model || raw.modelName || '')
      cfg.prompt = stableString(cfg.prompt || raw.intent || '')
      cfg.temperature = cfg.temperature == null ? '' : String(cfg.temperature).slice(0, 12)
      if (!cfg.modelName) {
        issues.push(makeIssue('missing_model', 'llm 节点缺少模型', `nodes[${index}].config.modelName`))
      }
    }
    if (type === 'tool') {
      cfg.skillId = stableString(cfg.skillId || raw.skillId || '')
      cfg.skillName = stableString(cfg.skillName || '')
      if (!cfg.skillId) {
        issues.push(makeIssue('missing_skill', 'tool 节点缺少 skillId', `nodes[${index}].config.skillId`))
      }
    }
    if (type === 'knowledge') {
      cfg.knowledgeId = stableString(cfg.knowledgeId || raw.knowledgeId || '')
      cfg.knowledgeName = stableString(cfg.knowledgeName || '')
      cfg.mode = stableString(cfg.mode || 'selected') || 'selected'
      if (!cfg.knowledgeId) {
        issues.push(makeIssue('missing_knowledge', 'knowledge 节点缺少 knowledgeId', `nodes[${index}].config.knowledgeId`))
      }
    }
    normalized.config = cfg
    normalized.studioKind = type
  }
  if (type === 'terminal') {
    normalized.status = stableString(raw.status || 'completed') || 'completed'
  }
  const studioKind = stableString(raw.studioKind || '')
  if (studioKind) normalized.studioKind = studioKind
  if (Number.isFinite(Number(raw.x))) normalized.x = Math.max(0, Number(raw.x))
  if (Number.isFinite(Number(raw.y))) normalized.y = Math.max(0, Number(raw.y))
  return normalized
}

function normalizeLayoutPoint(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) return null
  const point = { x: Math.max(0, Number(raw.x)), y: Math.max(0, Number(raw.y)) }
  const kind = stableString(raw.kind || '')
  if (kind) point.kind = kind
  return point
}

function normalizeLayout(raw) {
  if (!raw || typeof raw !== 'object') return null
  const mode = stableString(raw.mode || '') || 'free'
  const layout = { mode }
  const start = normalizeLayoutPoint(raw.start)
  const end = normalizeLayoutPoint(raw.end)
  if (start) layout.start = start
  if (end) layout.end = end
  if (raw.nodes && typeof raw.nodes === 'object') {
    const nodes = {}
    for (const [id, value] of Object.entries(raw.nodes)) {
      const key = stableString(id)
      const point = normalizeLayoutPoint(value)
      if (key && point) nodes[key] = point
    }
    if (Object.keys(nodes).length) layout.nodes = nodes
  }
  return layout
}

function normalizeWorkbenchGraphInput(input = {}) {
  const issues = []
  const goal = stableString(input.goal)
  if (!goal) {
    issues.push(makeIssue('missing_goal', 'goal 必填', 'goal'))
  } else if (goal.length > MAX_GOAL_LENGTH) {
    issues.push(makeIssue('goal_too_long', `goal 长度不得超过 ${MAX_GOAL_LENGTH}`, 'goal'))
  }

  const template = stableString(input.template)
  if (template && !GRAPH_TEMPLATES[template]) {
    issues.push(makeIssue('unknown_template', `未知 graph 模板: ${template}`, 'template'))
  }

  const members = (Array.isArray(input.members) ? input.members : []).map((member, index) => (
    normalizeMember(member, index, issues)
  )).filter(Boolean)

  if (members.length > MAX_MEMBERS) {
    issues.push(makeIssue('member_limit_exceeded', `members 不得超过 ${MAX_MEMBERS}`, 'members'))
  }

  const memberIds = new Set()
  for (const member of members) {
    if (memberIds.has(member.id)) {
      issues.push(makeIssue('duplicate_member_id', `重复 member id: ${member.id}`, `members.${member.id}`))
    }
    memberIds.add(member.id)
  }

  const memberById = new Map(members.map(member => [member.id, member]))
  const gates = (Array.isArray(input.gates) ? input.gates : []).map((gate, index) => (
    normalizeGate(gate, index)
  )).filter(Boolean)

  const joinStrategy = stableString(input.joinStrategy || DEFAULT_JOIN_STRATEGY) || DEFAULT_JOIN_STRATEGY
  if (!VALID_JOIN_STRATEGIES.has(joinStrategy)) {
    issues.push(makeIssue('invalid_join_strategy', `未知 joinStrategy: ${joinStrategy}`, 'joinStrategy'))
  }

  const parallelism = Number.isFinite(Number(input.parallelism))
    ? Number(input.parallelism)
    : DEFAULT_PARALLELISM
  if (parallelism < 1) {
    issues.push(makeIssue('invalid_parallelism', 'parallelism 须 >= 1', 'parallelism'))
  } else if (parallelism > MAX_PARALLELISM) {
    issues.push(makeIssue('parallelism_limit_exceeded', `parallelism 不得超过 ${MAX_PARALLELISM}`, 'parallelism'))
  }

  const explicitNodes = Array.isArray(input.nodes) ? input.nodes : null
  const nodes = explicitNodes
    ? explicitNodes.map((node, index) => normalizeNode(node, index, memberById, issues)).filter(Boolean)
    : []

  const edges = (Array.isArray(input.edges) ? input.edges : []).map((edge, index) => (
    normalizeEdge(edge, index, issues)
  )).filter(Boolean)

  if (nodes.length > MAX_NODES) {
    issues.push(makeIssue('node_limit_exceeded', `nodes 不得超过 ${MAX_NODES}`, 'nodes'))
  }
  if (edges.length > MAX_EDGES) {
    issues.push(makeIssue('edge_limit_exceeded', `edges 不得超过 ${MAX_EDGES}`, 'edges'))
  }

  return {
    issues,
    normalized: {
      goal,
      template,
      members,
      memberById,
      gates,
      nodes,
      edges,
      joinStrategy,
      parallelism,
      layout: normalizeLayout(input.layout),
      teamPackageId: stableString(input.teamPackageId || input.packageId || 'workbench-agent-graph'),
      teamName: stableString(input.teamName || input.name || 'Workbench Agent Graph'),
      teamVersion: stableString(input.version || DEFAULT_TEAM_VERSION) || DEFAULT_TEAM_VERSION,
    },
  }
}

module.exports = {
  stableString,
  uniqueNonEmpty,
  sha256Hex,
  makeIssue,
  failResult,
  okResult,
  normalizeGate,
  normalizeMember,
  normalizeEdge,
  normalizeNode,
  normalizeLayoutPoint,
  normalizeLayout,
  normalizeWorkbenchGraphInput,
}
