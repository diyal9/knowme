'use strict'

/**
 * 任务工作间投影（纯函数，可 Node 单测）
 * 将 Daemon task + 仓库 workflow JSON 合并为 UI 可用的 TaskRoomProjection。
 */

const workbenchModel = require('./workbench-model')
const { LOCAL_APPROVER } = require('./workbench-task-brief')

const DONE_STATES = new Set(['done', 'finished', 'completed', 'success'])
const TEAM_ROLE_LABELS = {
  producer: '制作人',
  developer: '开发',
  tester: '测试',
}

function text(value) {
  return String(value == null ? '' : value).trim()
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(text(value))
}

function normalizeNodeStatus(value) {
  const s = text(value).toLowerCase()
  if (['done', 'completed', 'finished', 'success', 'approved'].includes(s)) return 'done'
  if (['running', 'active', 'current', 'waiting', 'in_progress'].includes(s)) return 'active'
  if (['failed', 'error', 'rejected'].includes(s)) return 'error'
  if (['pending', 'queued', 'idle'].includes(s)) return 'pending'
  return s || 'pending'
}

function agentLabel(agent) {
  if (!agent) return ''
  const id = text(agent.id).toLowerCase()
  if (TEAM_ROLE_LABELS[id]) return TEAM_ROLE_LABELS[id]
  const role = text(agent.persona && agent.persona.role)
  if (hasChinese(role)) return role
  const title = text(agent.title)
  if (hasChinese(title)) {
    const chinese = title.replace(/[A-Za-z0-9_.-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (chinese) return chinese
  }
  if (TEAM_ROLE_LABELS[id]) return TEAM_ROLE_LABELS[id]
  return title || id || '智能专家'
}

function statusIndexMap(status) {
  const map = new Map()
  const nodes = Array.isArray(status && status.nodes)
    ? status.nodes
    : (Array.isArray(status && status.steps) ? status.steps : [])
  for (const item of nodes) {
    const id = text(item && (item.id || item.node || item.node_id))
    if (!id) continue
    map.set(id, normalizeNodeStatus(item.status || item.state))
  }
  return map
}

function resolveCurrentNodeId(task) {
  const status = task && task.status || {}
  const raw = text(status.current_node || status.current || task.current_node)
  if (raw) return raw
  const gates = Array.isArray(task.pending_gates) ? task.pending_gates : []
  if (gates[0]) return text(gates[0].node || gates[0].node_id || gates[0].id)
  const clarifications = Array.isArray(task.pending_clarifications) ? task.pending_clarifications : []
  if (clarifications[0]) return text(clarifications[0].node || clarifications[0].node_id)
  return ''
}

function inferNodeStatus(nodeId, currentId, nodeIndex, currentIndex, taskState, statusMap) {
  if (statusMap.has(nodeId)) return statusMap.get(nodeId)
  if (DONE_STATES.has(text(taskState).toLowerCase())) return 'done'
  if (!currentId) return nodeIndex === 0 ? 'active' : 'pending'
  if (currentIndex >= 0) {
    if (nodeIndex < currentIndex) return 'done'
    if (nodeIndex === currentIndex) return 'active'
    return 'pending'
  }
  if (nodeId === currentId) return 'active'
  return 'pending'
}

function ownerForNode(node, agentsById) {
  if (!node) return ''
  if (node.type === 'gate') return LOCAL_APPROVER
  if (node.type === 'agent' && node.agent) {
    const agent = agentsById[node.agent]
    return agentLabel(agent) || node.agent
  }
  if (node.type === 'script') return LOCAL_APPROVER
  if (node.type === 'terminal') return ''
  return LOCAL_APPROVER
}

function handoffLabel(node) {
  const out = node && node.output
  if (!out) return ''
  const parts = []
  if (out.kind) parts.push(text(out.kind))
  if (out.path) parts.push(text(out.path))
  return parts.join(' · ')
}

function rosterFromWorkflow(workflow, agentsById) {
  const seen = new Set()
  const roster = []
  for (const node of (workflow && workflow.nodes) || []) {
    if (node.type !== 'agent' || !node.agent || seen.has(node.agent)) continue
    seen.add(node.agent)
    const agent = agentsById[node.agent]
    roster.push({
      id: node.agent,
      label: agentLabel(agent) || node.agent,
      title: text(agent && agent.title) || node.agent,
    })
  }
  return roster
}

function userFacingDegradedReason() {
  // 不向用户暴露 workflow id 或 .cursor/workflows/ 等实现细节，只给可执行的引导。
  return '暂时无法确认执行步骤：当前激活内容源可能与该工作流不匹配。请在设置的内容源里确认已启用对应来源后刷新。'
}

function degradedGraphNodes(reason) {
  return [{
    id: 'degraded-info',
    label: '流程详情暂不可用',
    meta: reason || '工作流节点未能加载',
    status: 'pending',
    owner: '',
    handoff: '',
    type: 'info',
    degraded: true,
    degradedPlaceholder: true,
  }]
}

/**
 * 诚实进度文案：degraded 占位节点不计入步数，避免假 100%。
 * @param {Array} nodes
 * @param {{ status?: string, degraded?: boolean }} opts
 */
function summarizeRunnerProgress(nodes, opts = {}) {
  const all = Array.isArray(nodes) ? nodes : []
  const degraded = opts.degraded === true
    || all.some(node => node && (node.degradedPlaceholder || node.degraded))
  const list = all.filter(node => !(node && (node.degradedPlaceholder || (node.degraded && node.id === 'degraded-info'))))
  const status = text(opts.status).toLowerCase()
  const doneStatus = DONE_STATES.has(status)

  if (degraded && !list.length) return '无法确认进度'
  if (!list.length) return doneStatus ? '已完成' : '执行中'

  const statuses = list.map((node) => {
    const raw = text(node && node.status).toLowerCase()
    if (['done', 'completed', 'finished', 'success'].includes(raw)) return 'done'
    if (['running', 'active', 'current', 'waiting', 'in_progress'].includes(raw)) return 'active'
    if (['failed', 'error', 'rejected'].includes(raw)) return 'error'
    if (doneStatus) return 'done'
    return raw || 'pending'
  })
  const done = statuses.filter(s => s === 'done').length
  if (statuses.includes('error')) return `需要处理 · 已完成 ${done}/${list.length} 步`
  if (doneStatus) return `已完成 ${list.length}/${list.length} 步 · 100%`
  return `已完成 ${done}/${list.length} 步 · ${Math.round((done / list.length) * 100)}%`
}

/**
 * @param {object} input
 * @param {object} input.task Daemon task body
 * @param {object|null} input.workflow parsed workflow from repo
 * @param {object[]} [input.agents]
 * @param {string} [input.intent]
 * @param {string} [input.status]
 */
function projectTaskRoom(input = {}) {
  const task = input.task || {}
  const workflow = input.workflow || null
  const agents = Array.isArray(input.agents) ? input.agents : []
  const agentsById = Object.fromEntries(agents.map(a => [a.id, a]))
  const intent = text(task.intent || input.intent)
  const workflowId = text(task.workflow || input.workflowId || (workflow && workflow.id))
  const taskState = text(task.state || (task.status && task.status.state) || input.status)
  const status = task.status && typeof task.status === 'object' ? task.status : {}
  const currentNodeId = resolveCurrentNodeId(task)
  const statusMap = statusIndexMap(status)

  if (!workflow || !Array.isArray(workflow.nodes) || !workflow.nodes.length) {
    const remoteAgents = Array.isArray(status.agents)
      ? status.agents.map(item => text(item && (item.name || item.role || item.id) || item)).filter(Boolean)
      : []
    const reason = workflow
      ? '该工作流定义不完整，暂时无法确认执行步骤。请在设置的内容源里确认已启用完整来源后刷新。'
      : userFacingDegradedReason()
    const roster = remoteAgents.length
      ? remoteAgents.map(name => ({ id: name, label: name, title: name }))
      : []
    return {
      intentTitle: intent || workflowId || '任务',
      workflowId,
      workflowName: text(input.workflowName || workflowId),
      degraded: true,
      degradedReason: reason,
      roster,
      agents: roster.map(item => item.label),
      graphNodes: degradedGraphNodes(reason),
      currentNodeId,
      currentOwner: remoteAgents[0] || '',
      currentNodeLabel: '流程详情暂不可用',
      workflow: workflow || { id: workflowId, name: intent || workflowId },
      graph: null,
    }
  }

  const graph = workbenchModel.buildWorkflowGraph(workflow)
  const order = graph.order || []
  const currentIndex = currentNodeId ? order.indexOf(currentNodeId) : -1
  const graphNodes = order.map((id, index) => {
    const node = graph.byId.get(id)
    const nodeStatus = inferNodeStatus(id, currentNodeId, index, currentIndex, taskState, statusMap)
    const owner = ownerForNode(node, agentsById)
    const title = workbenchModel.nodeTitle(node, agentsById) || id
    const metaParts = [workbenchModel.nodeTypeLabel(node.type)]
    if (owner) metaParts.push(owner)
    const handoff = handoffLabel(node)
    if (handoff) metaParts.push(`产出 ${handoff}`)
    return {
      id,
      label: title,
      meta: metaParts.join(' · '),
      status: nodeStatus,
      owner,
      handoff,
      type: node.type,
    }
  })

  const currentNode = currentNodeId ? graph.byId.get(currentNodeId) : null
  const currentOwner = ownerForNode(currentNode, agentsById)
  const currentNodeLabel = currentNode
    ? workbenchModel.nodeTitle(currentNode, agentsById)
    : (currentNodeId || (DONE_STATES.has(taskState.toLowerCase()) ? '已完成' : '流程执行中'))

  const roster = rosterFromWorkflow(workflow, agentsById)

  return {
    intentTitle: intent || workflow.name || workflow.id,
    workflowId: workflow.id,
    workflowName: workflow.name || workflow.id,
    degraded: false,
    degradedReason: '',
    roster,
    agents: roster.map(item => item.label),
    graphNodes,
    currentNodeId,
    currentOwner,
    currentNodeLabel,
    workflow,
    graph,
  }
}

function applyProjectionToRun(run, projection) {
  if (!projection || !run) return run
  run.workflow = projection.workflow
  run.graph = projection.graph
  run.projection = projection
  if (projection.intentTitle) run.intent = projection.intentTitle
  return run
}

module.exports = {
  TEAM_ROLE_LABELS,
  LOCAL_APPROVER,
  agentLabel,
  projectTaskRoom,
  applyProjectionToRun,
  rosterFromWorkflow,
  degradedGraphNodes,
  userFacingDegradedReason,
  summarizeRunnerProgress,
}
