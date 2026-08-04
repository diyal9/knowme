'use strict'

/**
 * Workbench 纯数据模型（无 IO，可 Node 单测）
 *
 * 复用 workbench 项目（D:\workflows\workbench\.cursor\agents）的 AgentTeams 格式：
 *   - 每个 Agent 一个目录 = agent.manifest.json（机器配置）+ AGENT.md（提示词/frontmatter）
 *   - 工作流为独立 JSON 状态机（entry_node + nodes[]），节点类型：
 *     agent | gate | parallel | script | loop | terminal
 *
 * 本模块只做「解析 + 图构建 + 派单 prompt 组装 + 状态推进」，
 * 文件读取在主进程（main.js）完成，编排执行在渲染层（workbench.js）完成。
 */

const NODE_TYPES = ['agent', 'gate', 'parallel', 'script', 'loop', 'terminal']

function asArray(v) {
  if (Array.isArray(v)) return v
  if (v === undefined || v === null || v === '') return []
  return [v]
}

/** 归一化 agent.manifest.json → 前端统一结构 */
function parseAgentManifest(json, extra = {}) {
  const m = json && typeof json === 'object' ? json : {}
  const persona = m.persona && typeof m.persona === 'object' ? m.persona : {}
  const skills = m.skills && typeof m.skills === 'object' ? m.skills : {}
  const nodeSpecs = m.node_specs && typeof m.node_specs === 'object' ? m.node_specs : {}
  return {
    id: String(m.id || extra.id || '').trim(),
    title: String(m.title || extra.title || m.id || '').trim(),
    model: String(m.model || '').trim(),
    version: String(m.version || '').trim(),
    description: String(extra.description || '').trim(),
    persona: {
      role: String(persona.role || '').trim(),
      stance: String(persona.stance || '').trim(),
      behavior: String(persona.behavior || persona.default_bias || '').trim(),
    },
    display: normalizeDisplay(m.display),
    modes: asArray(m.modes).map(String),
    skills: {
      required: asArray(skills.required).map(String),
      optional: asArray(skills.optional).map(String),
    },
    workflowNodes: asArray(m.workflow_nodes).map(String),
    nodeSpecs,
    path: String(extra.path || m.path || '').trim(),
  }
}

/**
 * 面向终端用户的展示文案（可选）。
 * manifest 的 description/skills 是写给开发者的，作者若要控制产品界面上的措辞，
 * 在 manifest 里写 display.summary / display.capabilities。
 */
function normalizeDisplay(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  return {
    summary: String(d.summary || '').trim(),
    capabilities: asArray(d.capabilities).map(String).map(s => s.trim()).filter(Boolean),
  }
}

/**
 * 从 AGENT.md 提取 YAML frontmatter 的关键字段（轻量解析，不引第三方库）。
 * 只需 description / model / persona.role 等展示字段。
 */
function parseAgentFrontmatter(md) {
  const text = String(md || '')
  const fm = text.match(/^---\s*[\r\n]([\s\S]*?)[\r\n]---/)
  const out = { description: '', model: '', persona: {} }
  if (!fm) return out
  const body = fm[1]
  const lines = body.split(/\r?\n/)
  let inPersona = false
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^\S/.test(line)) inPersona = false
    const top = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (top && /^\S/.test(line)) {
      const key = top[1]
      const val = top[2].trim()
      if (key === 'persona') { inPersona = true; continue }
      if (key === 'description') out.description = stripQuotes(val)
      else if (key === 'model') out.model = stripQuotes(val)
      continue
    }
    if (inPersona) {
      const sub = line.match(/^\s+([a-zA-Z_]+):\s*(.*)$/)
      if (sub) out.persona[sub[1]] = stripQuotes(sub[2].trim())
    }
  }
  return out
}

function stripQuotes(s) {
  const v = String(s || '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/** 归一化单个工作流定义 */
function parseWorkflow(json, extra = {}) {
  const w = json && typeof json === 'object' ? json : {}
  const nodes = asArray(w.nodes).map(normalizeNode)
  return {
    id: String(w.id || extra.id || '').trim(),
    name: String(w.name || extra.name || w.id || '').trim(),
    description: String(w.description || extra.description || '').trim(),
    entryNode: String(w.entry_node || (nodes[0] && nodes[0].id) || '').trim(),
    tags: asArray(w.tags || extra.tags).map(String),
    nodes,
    path: String(extra.path || '').trim(),
  }
}

function normalizeNode(n) {
  const node = n && typeof n === 'object' ? n : {}
  const type = NODE_TYPES.includes(node.type) ? node.type : 'agent'
  return {
    id: String(node.id || '').trim(),
    type,
    agent: String(node.agent || '').trim(),
    model: String(node.model || '').trim(),
    nodeKey: String(node.node_key || '').trim(),
    intent: String(node.intent || '').trim(),
    mode: String(node.mode || '').trim(),
    script: String(node.script || '').trim(),
    status: String(node.status || '').trim(),
    // 分支
    next: node.next ? String(node.next).trim() : '',
    onApprove: node.on_approve ? String(node.on_approve).trim() : '',
    onReject: node.on_reject ? String(node.on_reject).trim() : '',
    onRevise: node.on_revise ? String(node.on_revise).trim() : '',
    onSuccess: node.on_success ? String(node.on_success).trim() : '',
    onExhausted: node.on_exhausted ? String(node.on_exhausted).trim() : '',
    onFailGoto: node.on_fail_goto ? String(node.on_fail_goto).trim() : '',
    // 组合
    children: asArray(node.nodes).map(String),
    check: node.check ? String(node.check).trim() : '',
    body: node.body ? String(node.body).trim() : '',
    bodyWorkflow: node.body_workflow ? String(node.body_workflow).trim() : '',
    maxIterations: Number(node.max_iterations) || 0,
    gateId: String(node.gate_id || '').trim(),
    input: node.input || null,
    output: node.output || null,
    raw: node,
  }
}

/** 收集节点输入路径（展示 + 组装 prompt 用） */
function nodeInputPaths(node) {
  const inp = node && node.input
  if (!inp) return []
  if (typeof inp === 'string') return [inp]
  if (typeof inp.from === 'string') return [inp.from]
  return asArray(inp.paths).map(String)
}

/**
 * 构建工作流有向图：从 entry_node 出发 BFS，
 * 返回 { order: [nodeId...], edges: [{from,to,label}], byId }
 */
function buildWorkflowGraph(workflow) {
  const wf = workflow && Array.isArray(workflow.nodes) ? workflow : { nodes: [], entryNode: '' }
  const byId = new Map()
  for (const n of wf.nodes) byId.set(n.id, n)

  const edges = []
  const order = []
  const seen = new Set()
  const queue = []
  const start = wf.entryNode && byId.has(wf.entryNode) ? wf.entryNode : (wf.nodes[0] && wf.nodes[0].id)
  if (start) queue.push(start)

  const pushEdge = (from, to, label) => {
    if (!to || !byId.has(to)) return
    edges.push({ from, to, label: label || '' })
    if (!seen.has(to)) queue.push(to)
  }

  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id) || !byId.has(id)) continue
    seen.add(id)
    order.push(id)
    const node = byId.get(id)
    switch (node.type) {
      case 'gate':
        pushEdge(id, node.onApprove, '通过')
        pushEdge(id, node.onReject, '打回')
        if (node.onRevise && node.onRevise !== node.onReject) pushEdge(id, node.onRevise, '修订')
        break
      case 'parallel':
        for (const c of node.children) pushEdge(id, c, '并行')
        pushEdge(id, node.next, '汇合')
        break
      case 'loop':
        pushEdge(id, node.check, '检查')
        pushEdge(id, node.body, '修复')
        pushEdge(id, node.onSuccess, '成功')
        if (node.onExhausted && node.onExhausted !== node.onSuccess) pushEdge(id, node.onExhausted, '耗尽')
        break
      case 'terminal':
        break
      default:
        pushEdge(id, node.next, '')
        if (node.onFailGoto) pushEdge(id, node.onFailGoto, '失败')
        break
    }
  }
  // 补齐未被 BFS 触达的节点（孤立/仅被反向引用）
  for (const n of wf.nodes) if (!seen.has(n.id)) order.push(n.id)
  return { order, edges, byId }
}

/** 根据节点类型与结果，返回下一个节点 id（编排推进核心） */
function nextNodeId(node, outcome = 'default') {
  if (!node) return ''
  switch (node.type) {
    case 'gate':
      if (outcome === 'reject') return node.onReject
      if (outcome === 'revise') return node.onRevise || node.onReject
      return node.onApprove
    case 'loop':
      if (outcome === 'exhausted') return node.onExhausted || node.onSuccess
      return node.onSuccess
    case 'terminal':
      return ''
    default:
      if (outcome === 'fail' && node.onFailGoto) return node.onFailGoto
      return node.next
  }
}

const NODE_TYPE_LABEL = {
  agent: 'Agent',
  gate: '门禁',
  parallel: '并行',
  script: '脚本',
  loop: '循环',
  terminal: '完成',
}

function nodeTypeLabel(type) {
  return NODE_TYPE_LABEL[type] || type
}

/** 节点展示标题 */
function nodeTitle(node, agentsById) {
  if (!node) return ''
  const spec = node.agent && agentsById && agentsById[node.agent]
    ? (agentsById[node.agent].nodeSpecs || {})[node.nodeKey]
    : null
  if (spec && spec.role) return spec.role
  if (node.nodeKey) return node.nodeKey
  if (node.script) return node.script
  if (node.gateId) return node.gateId
  return node.id
}

/**
 * 组装派单 prompt：把 Agent persona + 节点规格 + 输入拼成一段可发给 AI 的指令。
 * agentsById: { [agentId]: normalizedAgent }
 */
function composeDispatchPrompt(node, workflow, agentsById = {}) {
  if (!node) return ''
  const agent = node.agent ? agentsById[node.agent] : null
  const spec = agent ? (agent.nodeSpecs || {})[node.nodeKey] : null
  const lines = []
  if (agent) {
    const role = agent.persona.role || agent.title
    lines.push(`你现在扮演 AgentTeams 中的角色「${agent.title}」（${role}）。`)
    if (agent.description) lines.push(agent.description)
  } else {
    lines.push(`执行工作流节点「${node.id}」（${nodeTypeLabel(node.type)}）。`)
  }
  lines.push('')
  lines.push(`## 工作流：${workflow ? (workflow.name || workflow.id) : ''}`)
  lines.push(`## 当前节点：${node.id} · ${nodeTypeLabel(node.type)}${node.nodeKey ? ` · ${node.nodeKey}` : ''}`)
  if (node.intent) lines.push(`目标：${node.intent}`)
  if (spec) {
    if (spec.what) lines.push(`职责：${spec.what}`)
    if (spec.how) lines.push(`执行：${spec.how}`)
    const anti = asArray(spec.anti)
    if (anti.length) lines.push(`禁止：${anti.join('；')}`)
    if (spec.focus) lines.push(`聚焦：${spec.focus}`)
    if (spec.stop_rule) lines.push(`停止规则：${spec.stop_rule}`)
  }
  const inputs = nodeInputPaths(node)
  if (inputs.length) lines.push(`输入：${inputs.join('、')}`)
  const out = node.output
  if (out && (out.path || out.kind)) {
    lines.push(`期望产出：${out.kind || ''}${out.path ? `（${out.path}）` : ''}`)
  }
  lines.push('')
  lines.push('请以该角色视角，产出本节点应完成的成果（要点清晰、可执行）。')
  return lines.join('\n').trim()
}

const workbenchModelApi = {
  NODE_TYPES,
  parseAgentManifest,
  parseAgentFrontmatter,
  normalizeDisplay,
  parseWorkflow,
  normalizeNode,
  nodeInputPaths,
  buildWorkflowGraph,
  nextNodeId,
  nodeTypeLabel,
  nodeTitle,
  composeDispatchPrompt,
}

if (typeof module === 'object' && module.exports) {
  module.exports = workbenchModelApi
}
if (typeof window !== 'undefined') {
  window.WorkbenchModel = workbenchModelApi
}
