'use strict'

const crypto = require('crypto')
const {
  validateTeamPackage,
  validateWorkflowDag,
  computePackageContentHash,
  mapToBackend,
  issue,
  TEAM_SCHEMA_VERSION,
  VALID_NODE_TYPES,
  VALID_JOIN_STRATEGIES,
} = require('./agent-package-runtime')

const MAX_MEMBERS = 8
const MAX_NODES = 32
const MAX_EDGES = 32
const MAX_GOAL_LENGTH = 2000
const MAX_PARALLELISM = 4
const DEFAULT_JOIN_STRATEGY = 'allSucceeded'
const DEFAULT_PARALLELISM = 1
const DEFAULT_TEAM_VERSION = '1.0.0'
const TERMINAL_NODE_ID = 'n-terminal'
const JOIN_NODE_ID = 'n-join'

const GRAPH_TEMPLATES = Object.freeze({
  single: Object.freeze({
    id: 'single',
    label: '单 Agent',
    minMembers: 1,
    maxMembers: 1,
    requiresGate: false,
  }),
  serial: Object.freeze({
    id: 'serial',
    label: '串行团队',
    minMembers: 1,
    maxMembers: MAX_MEMBERS,
    requiresGate: false,
  }),
  parallel: Object.freeze({
    id: 'parallel',
    label: '并行汇总',
    minMembers: 2,
    maxMembers: MAX_MEMBERS,
    requiresGate: false,
  }),
  gate: Object.freeze({
    id: 'gate',
    label: '带审批门禁',
    minMembers: 2,
    maxMembers: 2,
    requiresGate: true,
  }),
})

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
  if (raw.executionContract && typeof raw.executionContract === 'object') {
    normalized.executionContract = JSON.parse(JSON.stringify(raw.executionContract))
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

function validateTemplateMembers(templateId, members, gates, issues) {
  if (!templateId) return
  const spec = GRAPH_TEMPLATES[templateId]
  if (!spec) return
  if (members.length < spec.minMembers) {
    issues.push(makeIssue(
      'template_member_mismatch',
      `模板 ${templateId} 至少需要 ${spec.minMembers} 个 member`,
      'members',
    ))
  }
  if (members.length > spec.maxMembers) {
    issues.push(makeIssue(
      'template_member_mismatch',
      `模板 ${templateId} 最多允许 ${spec.maxMembers} 个 member`,
      'members',
    ))
  }
  if (spec.requiresGate && !gates.length) {
    issues.push(makeIssue('missing_gate_definition', `模板 ${templateId} 需要 gates 定义`, 'gates'))
  }
}

function gateNodeId(gateRef) {
  return `n-gate-${gateRef}`
}

function buildTemplateGraph(templateId, members, gates, joinStrategy) {
  const terminalNode = { id: TERMINAL_NODE_ID, type: 'terminal', status: 'completed' }

  if (templateId === 'single') {
    const member = members[0]
    return {
      nodes: [
        {
          id: member.id,
          type: 'agent',
          agentPackageId: member.agentPackageId,
          role: member.role,
          intent: member.intent,
        },
        terminalNode,
      ],
      edges: [{ from: member.id, to: TERMINAL_NODE_ID }],
    }
  }

  if (templateId === 'serial') {
    const nodes = members.map(member => ({
      id: member.id,
      type: 'agent',
      agentPackageId: member.agentPackageId,
      role: member.role,
      intent: member.intent,
    }))
    nodes.push(terminalNode)
    const edges = []
    for (let i = 0; i < members.length - 1; i += 1) {
      edges.push({ from: members[i].id, to: members[i + 1].id })
    }
    edges.push({ from: members[members.length - 1].id, to: TERMINAL_NODE_ID })
    return { nodes, edges }
  }

  if (templateId === 'parallel') {
    const agentNodes = members.map(member => ({
      id: member.id,
      type: 'agent',
      agentPackageId: member.agentPackageId,
      role: member.role,
      intent: member.intent,
    }))
    const joinNode = {
      id: JOIN_NODE_ID,
      type: 'join',
      joinStrategy,
      description: '并行分支汇聚',
    }
    return {
      nodes: [...agentNodes, joinNode, terminalNode],
      edges: [
        ...members.map(member => ({ from: member.id, to: JOIN_NODE_ID })),
        { from: JOIN_NODE_ID, to: TERMINAL_NODE_ID },
      ],
    }
  }

  if (templateId === 'gate') {
    const [first, second] = members
    const gate = gates[0]
    const gateNode = {
      id: gateNodeId(gate.id),
      type: 'gate',
      gateRef: gate.id,
      description: gate.description || gate.title,
    }
    return {
      nodes: [
        {
          id: first.id,
          type: 'agent',
          agentPackageId: first.agentPackageId,
          role: first.role,
          intent: first.intent,
        },
        gateNode,
        {
          id: second.id,
          type: 'agent',
          agentPackageId: second.agentPackageId,
          role: second.role,
          intent: second.intent,
        },
        terminalNode,
      ],
      edges: [
        { from: first.id, to: gateNode.id },
        { from: gateNode.id, to: second.id },
        { from: second.id, to: TERMINAL_NODE_ID },
      ],
    }
  }

  return { nodes: [], edges: [] }
}

function ensureTerminalNode(nodes, edges, issues) {
  const nodeIds = new Set(nodes.map(node => node.id))
  if (nodeIds.has(TERMINAL_NODE_ID) || nodes.some(node => node.type === 'terminal')) return { nodes, edges }

  const outgoing = new Map([...nodeIds].map(id => [id, 0]))
  for (const edge of edges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1)
  }
  const leafExec = nodes.filter(node =>
    (node.type === 'agent' || node.type === 'llm' || node.type === 'tool' || node.type === 'knowledge')
    && (outgoing.get(node.id) || 0) === 0)
  if (!leafExec.length) {
    issues.push(makeIssue('missing_terminal', 'Graph 缺少 terminal 节点', 'nodes'))
    return { nodes, edges }
  }
  if (leafExec.length > 1) {
    issues.push(makeIssue('ambiguous_terminal', '显式 Graph 须包含唯一 terminal 节点', 'nodes'))
    return { nodes, edges }
  }

  return {
    nodes: [...nodes, { id: TERMINAL_NODE_ID, type: 'terminal', status: 'completed' }],
    edges: [...edges, { from: leafExec[0].id, to: TERMINAL_NODE_ID }],
  }
}

function validateExplicitGraphShape(nodes, edges, issues) {
  const nodeIds = new Set(nodes.map(node => node.id))
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push(makeIssue('dangling_edge', `边引用未知节点: ${edge.from}`, `edges.${edge.from}`))
    }
    if (!nodeIds.has(edge.to)) {
      issues.push(makeIssue('dangling_edge', `边引用未知节点: ${edge.to}`, `edges.${edge.to}`))
    }
  }

  const terminalCount = nodes.filter(node => node.type === 'terminal').length
  if (terminalCount !== 1) {
    issues.push(makeIssue('invalid_terminal_count', 'Graph 必须且只能包含 1 个 terminal 节点', 'nodes'))
  }
}

function validateHandoffConnectivity(workflow, issues) {
  const nodes = workflow.nodes || []
  const edges = workflow.edges || []
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const outgoing = new Map()
  const incoming = new Map()
  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue
    outgoing.get(edge.from).push(edge.to)
    incoming.get(edge.to).push(edge.from)
  }

  const entryNodes = nodes.filter(node => (incoming.get(node.id) || []).length === 0).map(node => node.id)
  if (!entryNodes.length) {
    issues.push(makeIssue('handoff_gap', 'Graph 缺少入口节点', 'workflow.edges'))
  }

  const reachable = new Set()
  const queue = [...entryNodes]
  while (queue.length) {
    const current = queue.shift()
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const next of outgoing.get(current) || []) queue.push(next)
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      issues.push(makeIssue('handoff_gap', `节点不可达: ${node.id}`, `workflow.nodes.${node.id}`))
    }
    if (node.type !== 'terminal' && !(outgoing.get(node.id) || []).length) {
      issues.push(makeIssue('handoff_gap', `节点缺少后续 handoff: ${node.id}`, `workflow.nodes.${node.id}`))
    }
  }
}

function buildComposition(normalized, issues) {
  validateTemplateMembers(normalized.template, normalized.members, normalized.gates, issues)
  if (issues.length) return null

  let nodes = normalized.nodes
  let edges = normalized.edges

  if (!nodes.length) {
    if (!normalized.template) {
      issues.push(makeIssue('missing_graph_shape', '缺少 template 或显式 nodes/edges', 'template'))
      return null
    }
    if (!normalized.members.length) {
      issues.push(makeIssue('missing_members', 'members 不能为空', 'members'))
      return null
    }
    const built = buildTemplateGraph(
      normalized.template,
      normalized.members,
      normalized.gates,
      normalized.joinStrategy,
    )
    nodes = built.nodes
    edges = built.edges
  } else {
    validateExplicitGraphShape(nodes, edges, issues)
    if (issues.length) return null
    const ensured = ensureTerminalNode(nodes, edges, issues)
    nodes = ensured.nodes
    edges = ensured.edges
    if (issues.length) return null
  }

  const composition = {
    goal: normalized.goal,
    template: normalized.template || null,
    members: normalized.members.map(member => ({
      id: member.id,
      expertId: member.expertId,
      agentPackageId: member.agentPackageId,
      agentOrigin: member.agentOrigin,
      profileId: member.profileId,
      packageHash: member.packageHash,
      profileHash: member.profileHash,
      role: member.role,
      intent: member.intent,
      skillRefs: member.skillRefs,
      connectorRefs: member.connectorRefs,
      knowledgeRefs: member.knowledgeRefs,
      profile: member.profile,
      ...(member.gateRef ? { gateRef: member.gateRef } : {}),
    })),
    nodes: nodes.map(node => ({ ...node })),
    edges: edges.map(edge => ({ ...edge })),
    gates: normalized.gates.map(gate => ({
      id: gate.id,
      type: gate.type,
      title: gate.title,
      description: gate.description,
      params: gate.params,
    })),
    joinStrategy: normalized.joinStrategy,
    parallelism: normalized.parallelism,
  }
  if (normalized.layout) composition.layout = normalized.layout

  return composition
}

function buildTeamPackageRaw(composition, normalized) {
  const memberPackageIds = uniqueNonEmpty(composition.members.map(member => member.agentPackageId))
  const workflowAgentIds = uniqueNonEmpty(
    composition.nodes
      .filter(node => node.type === 'agent')
      .map(node => node.agentPackageId),
  )
  const members = uniqueNonEmpty([...memberPackageIds, ...workflowAgentIds]).map(agentPackageId => {
    const member = composition.members.find(item => item.agentPackageId === agentPackageId)
    return {
      agentPackageId,
      ...(member?.profileId ? { profileId: member.profileId } : {}),
      role: member?.role || agentPackageId,
      ...(member?.gateRef ? { gateRef: member.gateRef } : {}),
    }
  })

  return {
    schemaVersion: TEAM_SCHEMA_VERSION,
    packageId: normalized.teamPackageId,
    name: normalized.teamName,
    version: normalized.teamVersion,
    members,
    workflow: {
      nodes: composition.nodes,
      edges: composition.edges,
      joinStrategy: composition.joinStrategy,
      parallelism: composition.parallelism,
    },
    gates: composition.gates.map(gate => ({
      id: gate.id,
      type: gate.type,
      description: gate.description || gate.title,
      params: gate.params,
    })),
    tests: [],
  }
}

function buildSnapshot(composition, validated, resolveAgentPackage) {
  const packageRefs = []
  const contentHashes = {}
  const seen = new Set()

  const recordPackage = (agentPackageId) => {
    const id = stableString(agentPackageId)
    if (!id || seen.has(id)) return
    seen.add(id)
    const resolved = typeof resolveAgentPackage === 'function'
      ? resolveAgentPackage(id)
      : null
    const manifest = resolved?.manifest || resolved?.normalizedManifest || null
    const contentHash = resolved?.contentHash
      || (manifest ? computePackageContentHash(manifest) : '')
    packageRefs.push({
      packageId: id,
      version: manifest?.version || '',
      contentHash,
      builder: manifest?.builder || '',
      backend: manifest ? mapToBackend(manifest) : '',
      role: composition.members.find(member => member.agentPackageId === id)?.role || id,
    })
    if (contentHash) contentHashes[id] = contentHash
  }

  for (const member of composition.members) recordPackage(member.agentPackageId)
  for (const node of composition.nodes) {
    if (node.type === 'agent') recordPackage(node.agentPackageId)
  }

  const compositionHash = sha256Hex(JSON.stringify({
    goal: composition.goal,
    template: composition.template,
    members: composition.members,
    nodes: composition.nodes,
    edges: composition.edges,
    gates: composition.gates,
    joinStrategy: composition.joinStrategy,
    parallelism: composition.parallelism,
  }))

  const teamPackageHash = validated?.contentHash
    || (validated?.manifest ? computePackageContentHash(validated.manifest) : '')

  return {
    goal: composition.goal,
    template: composition.template,
    compositionHash,
    teamPackageHash,
    packageRefs,
    contentHashes,
    teamPackageId: validated?.manifest?.packageId || composition.teamPackageId || '',
    teamVersion: validated?.manifest?.version || '',
  }
}

function compileWorkbenchAgentGraph(input = {}, options = {}) {
  const { issues, normalized } = normalizeWorkbenchGraphInput(input)
  if (issues.length) return failResult(issues)

  const composition = buildComposition(normalized, issues)
  if (!composition || issues.length) return failResult(issues, { composition })

  const teamRaw = buildTeamPackageRaw(composition, normalized)
  const dag = validateWorkflowDag(teamRaw.workflow)
  if (!dag.ok) {
    return failResult(dag.issues || [], {
      composition,
      teamPackage: teamRaw,
      snapshot: buildSnapshot(composition, null, options.resolveAgentPackage),
    })
  }

  const handoffIssues = []
  validateHandoffConnectivity(
    { nodes: composition.nodes, edges: composition.edges },
    handoffIssues,
  )
  if (handoffIssues.length) {
    return failResult(handoffIssues, {
      composition,
      teamPackage: teamRaw,
      snapshot: buildSnapshot(composition, null, options.resolveAgentPackage),
    })
  }

  const validated = validateTeamPackage(teamRaw, {
    resolveAgentPackage: options.resolveAgentPackage,
  })
  const snapshot = buildSnapshot(
    composition,
    validated.ok ? validated : { manifest: teamRaw, contentHash: computePackageContentHash(teamRaw) },
    options.resolveAgentPackage,
  )

  if (!validated.ok) {
    return failResult(validated.issues || [], {
      composition,
      teamPackage: teamRaw,
      snapshot,
    })
  }

  return okResult({
    composition,
    teamPackage: validated.manifest,
    snapshot,
  })
}

function applyGraphTemplate(templateId, members = [], overrides = {}) {
  const template = GRAPH_TEMPLATES[templateId]
  if (!template) {
    return failResult([makeIssue('unknown_template', `未知 graph 模板: ${templateId}`, 'template')])
  }
  return compileWorkbenchAgentGraph({
    goal: overrides.goal || 'Workbench agent graph',
    template: templateId,
    members,
    gates: overrides.gates,
    joinStrategy: overrides.joinStrategy,
    parallelism: overrides.parallelism,
    ...overrides,
  }, overrides)
}

module.exports = {
  GRAPH_TEMPLATES,
  MAX_MEMBERS,
  MAX_NODES,
  MAX_EDGES,
  MAX_GOAL_LENGTH,
  MAX_PARALLELISM,
  TERMINAL_NODE_ID,
  JOIN_NODE_ID,
  normalizeWorkbenchGraphInput,
  buildComposition,
  compileWorkbenchAgentGraph,
  applyGraphTemplate,
}
