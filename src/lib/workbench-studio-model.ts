'use strict'

;(function initWorkbenchStudioModel(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchStudioModel = api
})(typeof window !== 'undefined' ? window : globalThis, function createWorkbenchStudioModel() {
  const RELATIONS = new Set(['serial', 'parallel', 'approval'])
  const NODE_KINDS = new Set([
    'start', 'end', 'agent', 'llm', 'tool', 'knowledge', 'mcp', 'request', 'condition', 'join', 'gate',
  ])
  const EXEC_AGENT = new Set(['agent'])
  const EXEC_SPECIALTY = new Set(['llm', 'tool', 'knowledge', 'mcp', 'request'])
  const EXEC_CAPABILITY = new Set(['agent', 'llm', 'tool', 'knowledge', 'mcp', 'request'])
  /** @deprecated use EXEC_AGENT — specialty no longer compiles as agent */
  const COMPILE_AS_AGENT = EXEC_AGENT
  const MAX_NODES = 24
  const MAX_EDGES = 48
  const MAX_IO_ITEMS = 16
  const START_ID = '__start__'
  const END_ID = '__end__'

  function text(value, max = 1200) {
    return String(value == null ? '' : value).trim().slice(0, max)
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]))
  }

  function relation(value) {
    return RELATIONS.has(value) ? value : 'serial'
  }

  function kindOf(raw) {
    const value = text(raw?.kind || raw?.type || raw?.nodeType || 'agent', 24).toLowerCase()
    if (value === 'ifelse' || value === 'if') return 'condition'
    if (value === 'terminal') return 'end'
    // 旧版组件库曾暴露未打通的 Action；统一迁移为当前可执行的工具节点。
    if (value === 'action') return 'tool'
    if (value === 'human' || value === 'approval') return 'gate'
    return NODE_KINDS.has(value) ? value : 'agent'
  }

  function normalizeIoEntry(raw, index, prefix) {
    const source = raw && typeof raw === 'object' ? raw : { label: raw }
    const label = text(source.label || source.name || source.id, 160)
    if (!label) return null
    const type = text(source.type || source.valueType || 'text', 24) || 'text'
    const example = text(source.example || source.sample || '', 240)
    const options = (Array.isArray(source.options || source.enum) ? (source.options || source.enum) : [])
      .map(item => text(item, 80))
      .filter(Boolean)
      .slice(0, 20)
    return {
      id: text(source.id || `${prefix}-${index + 1}`, 80),
      label,
      type,
      required: source.required === true,
      example,
      options,
      description: text(source.description, 240),
    }
  }

  function normalizeIoList(raw, prefix) {
    return (Array.isArray(raw) ? raw : [])
      .map((item, index) => normalizeIoEntry(item, index, prefix))
      .filter(Boolean)
      .slice(0, MAX_IO_ITEMS)
  }

  function uniqueNodeId(base, existing = []) {
    const seed = text(base, 48).replace(/[^a-z0-9_-]/gi, '-') || 'node'
    const ids = new Set(existing.map(item => item.id))
    if (!ids.has(seed)) return seed
    let index = 2
    while (ids.has(`${seed}-${index}`)) index += 1
    return `${seed}-${index}`
  }

  function defaultName(kind) {
    return ({
      start: '开始节点',
      end: '结束节点',
      agent: '专家节点',
      llm: '大模型节点',
      tool: '工具节点',
      knowledge: '知识库节点',
      mcp: 'MCP 节点',
      request: 'HTTP 请求节点',
      condition: '条件判断',
      join: '汇合',
      gate: '人工确认',
    })[kind] || '节点'
  }

  function normalizeConfig(kind, raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {}
    if (kind === 'llm') {
      return {
        prompt: text(source.prompt || source.systemPrompt || '', 4000),
        modelName: text(source.modelName || source.model || '', 80),
        temperature: source.temperature == null ? '' : String(source.temperature).slice(0, 12),
      }
    }
    if (kind === 'tool') {
      return {
        skillId: text(source.skillId || source.toolId || source.id || '', 80),
        skillName: text(source.skillName || source.toolName || '', 120),
      }
    }
    if (kind === 'knowledge') {
      return {
        knowledgeId: text(source.knowledgeId || source.kbId || source.id || '', 80),
        knowledgeName: text(source.knowledgeName || '', 120),
        knowledgeKind: text(source.knowledgeKind || source.kind || '', 24),
        mode: text(source.mode || 'selected', 24) || 'selected',
      }
    }
    if (kind === 'mcp') {
      return {
        connectorId: text(source.connectorId || source.serverId || '', 120),
        connectorName: text(source.connectorName || source.serverName || '', 160),
        toolName: text(source.toolName || source.tool || '', 160),
        arguments: text(source.arguments || source.args || '{}', 4000),
      }
    }
    if (kind === 'request') {
      const method = text(source.method || 'GET', 12).toUpperCase()
      return {
        method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'GET',
        url: text(source.url || source.endpoint || '', 1200),
        headers: text(source.headers || '{}', 4000),
        body: text(source.body || '', 8000),
      }
    }
    if (kind === 'condition') {
      return {
        left: text(source.left || 'input', 160) || 'input',
        compare: text(source.compare || 'equal', 24) || 'equal',
        right: text(source.right || '', 240),
        trueLabel: text(source.trueLabel || '成立', 40) || '成立',
        falseLabel: text(source.falseLabel || '不成立', 40) || '不成立',
      }
    }
    if (kind === 'gate') {
      return {
        title: text(source.title || source.approvalNote || '', 160),
        note: text(source.note || source.approvalNote || '', 240),
      }
    }
    return clone(source)
  }

  function normalizeNode(raw = {}, index = 0, existing = []) {
    const kind = kindOf(raw)
    const agentPackageId = text(
      raw.agentPackageId || raw.expertId || raw.agentId || '',
      80,
    )
    const id = kind === 'start'
      ? START_ID
      : kind === 'end'
        ? END_ID
        : text(raw.id || '', 80) || uniqueNodeId(`${kind}-${index + 1}`, existing)
    const x = Number.isFinite(Number(raw.x)) ? Number(raw.x) : null
    const y = Number.isFinite(Number(raw.y)) ? Number(raw.y) : null
    return {
      id,
      kind,
      type: kind,
      agentPackageId,
      agentOrigin: text(raw.agentOrigin || raw.origin || 'local', 24) || 'local',
      profileId: text(raw.profileId, 80),
      packageHash: text(raw.packageHash || raw.contentHash, 160),
      profileHash: text(raw.profileHash || raw.profile?.profileHash, 160),
      name: text(raw.name || raw.title || defaultName(kind) || agentPackageId, 120) || defaultName(kind),
      role: text(raw.role || raw.name || agentPackageId, 240),
      intent: text(raw.intent || raw.goal || raw.prompt, 1200),
      description: text(raw.description, 1200),
      inputSpec: text(raw.inputSpec || raw.inputHint || '', 500),
      outputSpec: text(raw.outputSpec || raw.outputHint || '', 500),
      approvalNote: text(raw.approvalNote || raw.config?.note || '', 240),
      relation: relation(raw.relation || raw.relationToNext),
      config: normalizeConfig(kind, raw.config || raw.data || {}),
      profile: clone(raw.profile || null),
      x,
      y,
    }
  }

  function normalizeEdge(raw = {}, index = 0) {
    const from = text(raw.from || raw.source, 80)
    const to = text(raw.to || raw.target, 80)
    if (!from || !to || from === to) return null
    const branch = text(raw.branch || raw.labelKey || '', 24)
    return {
      id: text(raw.id || `e-${from}-${to}-${index + 1}`, 100),
      from,
      to,
      label: text(raw.label || '', 80),
      branch: branch === 'true' || branch === 'false' ? branch : '',
    }
  }

  function ensureSystemNodes(nodes) {
    const list = Array.isArray(nodes) ? nodes.slice() : []
    if (!list.some(item => item.kind === 'start')) {
      list.unshift(normalizeNode({ id: START_ID, kind: 'start', x: 48, y: 80 }, 0, list))
    }
    if (!list.some(item => item.kind === 'end')) {
      list.push(normalizeNode({ id: END_ID, kind: 'end', x: 720, y: 80 }, list.length, list))
    }
    return list.slice(0, MAX_NODES + 2)
  }

  function isLinearLegacy(raw) {
    if (Array.isArray(raw?.edges) && raw.edges.length) return false
    if (raw?.graphMode === 'free') return false
    return true
  }

  function createDraft(raw = {}) {
    const sourceNodes = Array.isArray(raw.nodes) ? raw.nodes : []
    const hasEdgeField = Object.prototype.hasOwnProperty.call(raw, 'edges') || raw.graphMode === 'free'
    const useFree = hasEdgeField && (raw.graphMode === 'free' || Array.isArray(raw.edges))

    let nodes
    let edges
    let graphMode

    if (!useFree) {
      // Linear step list (default / backward-compatible): ordered agent-only nodes.
      nodes = sourceNodes
        .filter(item => item && (
          item.agentPackageId
          || item.expertId
          || item.type === 'agent'
          || !item.kind
          || item.kind === 'agent'
        ))
        .filter(item => kindOf(item) === 'agent' || item.agentPackageId || item.expertId)
        .slice(0, MAX_NODES)
        .map((item, index, arr) => normalizeNode({ ...item, kind: 'agent' }, index, arr))
      edges = null
      graphMode = 'linear'
    } else {
      nodes = []
      sourceNodes.forEach((item, index) => {
        nodes.push(normalizeNode(item, index, nodes))
      })
      nodes = ensureSystemNodes(nodes)
      edges = (Array.isArray(raw.edges) ? raw.edges : [])
        .map((item, index) => normalizeEdge(item, index))
        .filter(Boolean)
        .slice(0, MAX_EDGES)
      graphMode = 'free'
    }

    return {
      id: text(raw.id || `draft-${Date.now().toString(36)}`, 80),
      name: text(raw.name || raw.title || '我的专家协作', 160),
      goal: text(raw.goal || raw.intent, 2000),
      inputs: normalizeIoList(raw.inputs, 'input'),
      outputs: normalizeIoList(raw.outputs, 'output'),
      sourceWorkflowId: text(raw.sourceWorkflowId, 80),
      dirty: raw.dirty === true,
      graphMode,
      nodes,
      edges,
    }
  }

  function fromGraph(graph = {}, meta = {}) {
    const members = new Map((Array.isArray(graph.members) ? graph.members : []).map(item => [
      text(item.id || item.agentPackageId, 80),
      item,
    ]))
    const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : []
    const capabilityTypes = new Set(['agent', 'llm', 'tool', 'knowledge', 'mcp', 'request'])
    const agentNodes = graphNodes.filter(item =>
      capabilityTypes.has(text(item.type, 24)) || item?.agentPackageId || EXEC_SPECIALTY.has(text(item.studioKind, 24)))
    const hasExplicitEdges = Array.isArray(graph.edges) && graph.edges.length
    const freeNodes = []

    freeNodes.push(normalizeNode({
      id: START_ID,
      kind: 'start',
      x: graph.layout?.start?.x ?? 48,
      y: graph.layout?.start?.y ?? 80,
    }, 0, freeNodes))

    graphNodes.forEach((item, index) => {
      const type = text(item.type, 24)
      if (type === 'terminal') return
      const member = members.get(text(item.id, 80)) || {}
      if (type === 'llm' || type === 'tool' || type === 'knowledge' || type === 'mcp' || type === 'request') {
        freeNodes.push(normalizeNode({
          ...item,
          kind: type,
          config: item.config || (
            type === 'llm'
              ? {
                prompt: item.intent || '',
                modelName: item.modelName || item.model || '',
                temperature: item.temperature || '',
              }
              : type === 'tool'
                ? { skillId: item.skillId || '', skillName: item.skillName || '' }
                : type === 'knowledge'
                  ? { knowledgeId: item.knowledgeId || '', knowledgeName: item.knowledgeName || '', mode: 'selected' }
                  : type === 'mcp'
                    ? { connectorId: item.connectorId || item.serverId || '', connectorName: item.connectorName || item.serverName || '', toolName: item.toolName || '', arguments: item.arguments || '{}' }
                    : { method: item.method || 'GET', url: item.url || '', headers: item.headers || '{}', body: item.body || '' }
          ),
          x: item.x ?? graph.layout?.nodes?.[item.id]?.x,
          y: item.y ?? graph.layout?.nodes?.[item.id]?.y,
        }, index, freeNodes))
        return
      }
      if (type === 'agent') {
        freeNodes.push(normalizeNode({
          ...member,
          ...item,
          kind: text(item.studioKind || item.kind || member.studioKind || 'agent', 24) || 'agent',
          profile: item.profile || member.profile,
          x: item.x ?? graph.layout?.nodes?.[item.id]?.x,
          y: item.y ?? graph.layout?.nodes?.[item.id]?.y,
        }, index, freeNodes))
        return
      }
      if (type === 'join' || type === 'gate' || type === 'condition') {
        const kind = type === 'gate' ? 'gate' : type
        freeNodes.push(normalizeNode({
          ...item,
          kind,
          name: item.name || defaultName(kind),
          x: item.x ?? graph.layout?.nodes?.[item.id]?.x,
          y: item.y ?? graph.layout?.nodes?.[item.id]?.y,
          config: type === 'condition'
            ? (item.condition || item.config || {})
            : (item.config || { note: item.gateRef || '', title: item.title || '' }),
        }, index, freeNodes))
      }
    })

    freeNodes.push(normalizeNode({
      id: END_ID,
      kind: 'end',
      x: graph.layout?.end?.x ?? 720,
      y: graph.layout?.end?.y ?? 80,
    }, freeNodes.length, freeNodes))

    let edges = []
    if (hasExplicitEdges) {
      edges = graph.edges.map((edge, index) => {
        const from = text(edge.from, 80) === 'n-terminal' ? END_ID : text(edge.from, 80)
        const to = text(edge.to, 80) === 'n-terminal' ? END_ID : text(edge.to, 80)
        // rewire roots that had no predecessor to start
        return normalizeEdge({ ...edge, from, to }, index)
      }).filter(Boolean)

      const hasIncoming = new Set(edges.map(item => item.to))
      agentNodes.forEach(node => {
        if (!hasIncoming.has(node.id)) edges.push(normalizeEdge({ from: START_ID, to: node.id }, edges.length))
      })
      const hasOutgoing = new Set(edges.map(item => item.from))
      agentNodes.forEach(node => {
        if (!hasOutgoing.has(node.id)) edges.push(normalizeEdge({ from: node.id, to: END_ID }, edges.length))
      })
      // composition sometimes uses terminal only
      edges = edges.map(edge => ({
        ...edge,
        to: edge.to === 'n-terminal' ? END_ID : edge.to,
        from: edge.from === 'n-terminal' ? END_ID : edge.from,
      }))
    }

    if (!agentNodes.length && !hasExplicitEdges) {
      return createDraft({
        id: meta.id,
        name: meta.name,
        goal: meta.goal || graph.goal,
        inputs: meta.inputs || graph.inputs || [],
        outputs: meta.outputs || graph.outputs || [],
        sourceWorkflowId: meta.sourceWorkflowId,
        nodes: [],
      })
    }

    if (!hasExplicitEdges) {
      return createDraft({
        id: meta.id,
        name: meta.name,
        goal: meta.goal || graph.goal,
        inputs: meta.inputs || graph.inputs || [],
        outputs: meta.outputs || graph.outputs || [],
        sourceWorkflowId: meta.sourceWorkflowId,
        nodes: agentNodes.map((item, index) => {
          const member = members.get(text(item.id, 80)) || {}
          return {
            ...member,
            ...item,
            profile: item.profile || member.profile,
          }
        }),
      })
    }

    return createDraft({
      id: meta.id,
      name: meta.name,
      goal: meta.goal || graph.goal,
      inputs: meta.inputs || graph.inputs || [],
      outputs: meta.outputs || graph.outputs || [],
      sourceWorkflowId: meta.sourceWorkflowId,
      graphMode: 'free',
      nodes: freeNodes,
      edges,
    })
  }

  function draftAgents(draft) {
    return (draft?.nodes || []).filter(item =>
      EXEC_CAPABILITY.has(item.kind) || (!item.kind && item.agentPackageId))
  }

  function draftExpertNodes(draft) {
    return (draft?.nodes || []).filter(item =>
      EXEC_AGENT.has(item.kind) || (!item.kind && item.agentPackageId && !item.config?.modelName))
  }

  function validateDraft(draft) {
    const value = createDraft(draft)
    const issues = []
    const capabilities = draftAgents(value)
    if (!capabilities.length) {
      issues.push({ code: 'empty', message: '请至少添加一个可执行节点（专家 / 大模型 / 工具 / 知识库）' })
    }
    capabilities.forEach(node => {
      if (node.kind === 'agent' && !text(node.agentPackageId, 80)) {
        issues.push({
          code: 'missing_agent',
          nodeId: node.id,
          message: `节点「${node.name || node.id}」需要绑定本地专家`,
        })
      }
      if (node.kind === 'llm' && !text(node.config?.modelName || node.config?.model || '', 80)) {
        issues.push({
          code: 'missing_model',
          nodeId: node.id,
          message: `大模型节点「${node.name || node.id}」需要选择模型`,
        })
      }
      if (node.kind === 'tool' && !text(node.config?.skillId, 80)) {
        issues.push({
          code: 'missing_skill',
          nodeId: node.id,
          message: `工具节点「${node.name || node.id}」需要选择 Skill`,
        })
      }
      if (node.kind === 'knowledge' && !text(node.config?.knowledgeId, 80)) {
        issues.push({
          code: 'missing_knowledge',
          nodeId: node.id,
          message: `知识库节点「${node.name || node.id}」需要选择知识库`,
        })
      }
      if (node.kind === 'mcp' && (!text(node.config?.connectorId || node.config?.connectorName, 120) || !text(node.config?.toolName, 120))) {
        issues.push({
          code: 'missing_mcp_tool',
          nodeId: node.id,
          message: `MCP 节点「${node.name || node.id}」需要填写服务和工具`,
        })
      }
      if (node.kind === 'request' && !text(node.config?.url, 1200)) {
        issues.push({
          code: 'missing_request_url',
          nodeId: node.id,
          message: `HTTP 请求节点「${node.name || node.id}」需要填写 URL`,
        })
      }
    })
    if (value.graphMode === 'free') {
      const conditions = (value.nodes || []).filter(item => item.kind === 'condition')
      conditions.forEach(node => {
        const outs = (value.edges || []).filter(edge => edge.from === node.id)
        if (!outs.length) {
          issues.push({
            code: 'condition_no_out',
            nodeId: node.id,
            message: `条件节点「${node.name || node.id}」需要至少一条出边`,
          })
        }
      })
      const nodeIds = new Set((value.nodes || []).map(item => item.id))
      ;(value.edges || []).forEach(edge => {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          issues.push({
            code: 'dangling_edge',
            message: `连线引用了不存在的节点（${edge.from} → ${edge.to}）`,
          })
        }
      })
    }
    return { ok: !issues.length, issues }
  }

  /**
   * Static graph inspection for studio dry-run preview.
   * Returns ordered walk from start for canvas animation + structured issues.
   */
  function inspectStudioGraph(draft) {
    const value = createDraft(draft)
    const nodes = Array.isArray(value.nodes) ? value.nodes : []
    const edges = Array.isArray(value.edges) ? value.edges : []
    const issues = []
    const byId = new Map(nodes.map(node => [node.id, node]))
    const start = nodes.find(node => node.kind === 'start' || node.id === START_ID)
    const end = nodes.find(node => node.kind === 'end' || node.id === END_ID)

    if (!start) {
      issues.push({ code: 'missing_start', message: '缺少开始节点' })
    }
    if (!end) {
      issues.push({ code: 'missing_end', message: '缺少结束节点' })
    }

    const nodeIds = new Set(nodes.map(node => node.id))
    edges.forEach(edge => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        issues.push({
          code: 'dangling_edge',
          edgeId: `e-${edge.from}-${edge.to}`,
          message: `连线引用了不存在的节点（${edge.from} → ${edge.to}）`,
        })
      }
    })

    const adj = new Map()
    nodes.forEach(node => adj.set(node.id, []))
    edges.forEach(edge => {
      if (!adj.has(edge.from)) return
      adj.get(edge.from).push(edge)
    })

    const walk = []
    const visited = new Set()
    if (start) {
      const queue = [start.id]
      visited.add(start.id)
      while (queue.length) {
        const id = queue.shift()
        walk.push({ nodeId: id, order: walk.length })
        const outs = adj.get(id) || []
        outs.forEach(edge => {
          const next = edge.to
          if (!byId.has(next)) return
          if (visited.has(next)) return
          visited.add(next)
          queue.push(next)
        })
      }
    }

    nodes.forEach(node => {
      if (node.kind === 'start' || node.kind === 'end') return
      if (visited.has(node.id)) return
      issues.push({
        code: 'unreachable',
        nodeId: node.id,
        message: `节点「${node.name || node.id}」从开始节点不可达`,
      })
    })

    if (end && start && !visited.has(end.id)) {
      issues.push({
        code: 'end_unreachable',
        nodeId: end.id,
        message: '结束节点从开始节点不可达，请检查连线',
      })
    }

    // Binding / specialty checks (reuse validateDraft codes)
    const binding = validateDraft(value)
    binding.issues.forEach(issue => {
      if (issues.some(existing => existing.code === issue.code && existing.nodeId === issue.nodeId && existing.message === issue.message)) {
        return
      }
      issues.push(issue)
    })

    // Prefer walk that includes only reachable path; if empty graph, still expose start/end when present
    if (!walk.length && start) walk.push({ nodeId: start.id, order: 0 })

    return {
      ok: !issues.length,
      issues,
      walk,
      startId: start?.id || START_ID,
      endId: end?.id || END_ID,
    }
  }

  function ensureFreeGraph(draft, options = {}) {
    const markDirty = options.markDirty !== false
    const source = createDraft(draft)
    if (source.graphMode === 'free' && Array.isArray(source.edges) && source.nodes.some(item => item.kind === 'start')) {
      return createDraft({
        ...source,
        nodes: ensureSystemNodes(source.nodes),
        graphMode: 'free',
        edges: source.edges || [],
      })
    }
    const linear = createDraft({ ...draft, edges: null, graphMode: undefined })
    const agents = draftAgents(linear)
    const freeNodes = ensureSystemNodes(agents.map((node, index) => ({
      ...node,
      x: Number.isFinite(node.x) ? node.x : 300 + index * 280,
      y: Number.isFinite(node.y) ? node.y : 120 + (index % 2) * 40,
    })))
    const edges = []
    if (!agents.length) {
      edges.push(normalizeEdge({ from: START_ID, to: END_ID }, 0))
    } else {
      edges.push(normalizeEdge({ from: START_ID, to: agents[0].id }, 0))
      for (let i = 0; i < agents.length - 1; i += 1) {
        edges.push(normalizeEdge({ from: agents[i].id, to: agents[i + 1].id }, edges.length))
      }
      edges.push(normalizeEdge({ from: agents[agents.length - 1].id, to: END_ID }, edges.length))
    }
    return createDraft({
      ...draft,
      graphMode: 'free',
      nodes: freeNodes,
      edges: edges.filter(Boolean),
      // 渲染归一化可传 markDirty:false，避免「只是打开画布」就变成未保存
      dirty: markDirty ? true : source.dirty === true,
    })
  }

  function addAgent(draft, agent = {}, at = null) {
    return addNode(draft, {
      kind: 'agent',
      agentPackageId: agent.id || agent.agentPackageId || agent.expertId,
      agentOrigin: agent.origin || 'local',
      name: agent.name || agent.title || agent.role,
      role: agent.role || agent.persona?.role || agent.name,
      description: agent.description || agent.summary || '',
      profileId: agent.profileId || '',
      packageHash: agent.packageHash || agent.contentHash || '',
      profileHash: agent.profileHash || agent.profile?.profileHash || '',
      profile: agent.profile || null,
    }, { at })
  }

  function addNode(draft, raw = {}, options = {}) {
    let next = createDraft(draft)
    const kind = kindOf(raw)
    if (kind === 'start' || kind === 'end') return next
    if (next.graphMode === 'free') next = ensureFreeGraph(next)
    if (next.nodes.filter(item => item.kind !== 'start' && item.kind !== 'end').length >= MAX_NODES) return next

    const node = normalizeNode({
      ...raw,
      kind,
      id: uniqueNodeId(raw.id || kind, next.nodes),
      x: Number.isFinite(Number(options.x)) ? Number(options.x) : (kind === 'condition' ? 420 : 360),
      y: Number.isFinite(Number(options.y)) ? Number(options.y) : 160 + next.nodes.length * 12,
    }, next.nodes.length, next.nodes)

    if (next.graphMode === 'linear') {
      // keep linear list as agents only
      if (kind !== 'agent') {
        next = ensureFreeGraph(next)
      } else {
        const index = Number.isInteger(options.at)
          ? Math.max(0, Math.min(next.nodes.length, options.at))
          : next.nodes.length
        next.nodes.splice(index, 0, node)
        next.dirty = true
        return next
      }
    }

    next.nodes.push(node)
    // free 图：只去掉空的 start→end；首个业务节点默认接 start，后续节点由用户连线组成 DAG。
    next.edges = Array.isArray(next.edges) ? next.edges.slice() : []
    next.edges = next.edges.filter(edge => !(edge.from === START_ID && edge.to === END_ID))
    const priorBiz = next.nodes.filter(item =>
      item.id !== node.id && item.kind !== 'start' && item.kind !== 'end'
    ).length
    const hasIncoming = next.edges.some(edge => edge.to === node.id)
    if (!hasIncoming && priorBiz === 0) {
      next.edges.push(normalizeEdge({ from: START_ID, to: node.id }, next.edges.length))
    }
    next.dirty = true
    return createDraft(next)
  }

  function moveNode(draft, nodeIdValue, toIndex) {
    const next = createDraft(draft)
    if (next.graphMode === 'free') {
      // order irrelevant; treat as no-op except dirty when x/y patched elsewhere
      return next
    }
    const from = next.nodes.findIndex(item => item.id === nodeIdValue)
    if (from < 0) return next
    const index = Math.max(0, Math.min(next.nodes.length - 1, Number(toIndex) || 0))
    const [node] = next.nodes.splice(from, 1)
    next.nodes.splice(index, 0, node)
    next.dirty = true
    return next
  }

  function updatePosition(draft, nodeIdValue, x, y) {
    const next = ensureFreeGraph(draft)
    const node = next.nodes.find(item => item.id === nodeIdValue)
    if (!node) return next
    node.x = Math.max(0, Number(x) || 0)
    node.y = Math.max(0, Number(y) || 0)
    next.dirty = true
    return createDraft(next)
  }

  function removeNode(draft, nodeIdValue) {
    if (nodeIdValue === START_ID || nodeIdValue === END_ID) return createDraft(draft)
    const next = createDraft(draft)
    next.nodes = next.nodes.filter(item => item.id !== nodeIdValue)
    if (Array.isArray(next.edges)) {
      next.edges = next.edges.filter(edge => edge.from !== nodeIdValue && edge.to !== nodeIdValue)
    }
    next.dirty = true
    return createDraft(next)
  }

  function duplicateNode(draft, nodeIdValue) {
    const next = createDraft(draft)
    const source = next.nodes.find(item => item.id === nodeIdValue)
    if (!source || source.kind === 'start' || source.kind === 'end') return next
    if (next.nodes.filter(item => item.kind !== 'start' && item.kind !== 'end').length >= MAX_NODES) return next
    const copy = {
      ...clone(source),
      id: uniqueNodeId(`${source.kind}-copy`, next.nodes),
      name: `${source.name} 副本`,
      x: (source.x || 200) + 40,
      y: (source.y || 120) + 40,
    }
    if (next.graphMode === 'linear') {
      const index = next.nodes.findIndex(item => item.id === nodeIdValue)
      next.nodes.splice(index + 1, 0, copy)
    } else {
      const free = ensureFreeGraph(next)
      free.nodes.push(normalizeNode(copy, free.nodes.length, free.nodes))
      free.dirty = true
      return createDraft(free)
    }
    next.dirty = true
    return createDraft(next)
  }

  function updateNode(draft, nodeIdValue, patch = {}) {
    const next = createDraft(draft)
    const node = next.nodes.find(item => item.id === nodeIdValue)
    if (!node) return next
    if (node.kind === 'start' || node.kind === 'end') {
      // only name/description cosmetic; workflow IO lives on draft
      if (patch.name !== undefined) node.name = text(patch.name, 120) || node.name
      next.dirty = true
      return createDraft(next)
    }
    const nextKind = patch.kind ? kindOf(patch) : node.kind
    Object.assign(node, {
      ...patch,
      id: node.id,
      kind: nextKind,
      type: nextKind,
      agentPackageId: patch.agentPackageId === undefined ? node.agentPackageId : text(patch.agentPackageId, 80),
      inputSpec: text(patch.inputSpec === undefined ? node.inputSpec : patch.inputSpec, 500),
      outputSpec: text(patch.outputSpec === undefined ? node.outputSpec : patch.outputSpec, 500),
      approvalNote: text(patch.approvalNote === undefined ? node.approvalNote : patch.approvalNote, 240),
      relation: relation(patch.relation || node.relation),
      config: patch.config === undefined ? node.config : normalizeConfig(nextKind, { ...node.config, ...patch.config }),
      profile: patch.profile === undefined ? node.profile : clone(patch.profile),
      x: patch.x === undefined ? node.x : Number(patch.x),
      y: patch.y === undefined ? node.y : Number(patch.y),
    })
    next.dirty = true
    return createDraft(next)
  }

  function updateDraft(draft, patch = {}) {
    const next = createDraft(draft)
    if (patch.name !== undefined) next.name = text(patch.name, 160) || next.name
    if (patch.goal !== undefined) next.goal = text(patch.goal, 2000)
    if (patch.inputs !== undefined) next.inputs = normalizeIoList(patch.inputs, 'input')
    if (patch.outputs !== undefined) next.outputs = normalizeIoList(patch.outputs, 'output')
    if (patch.graphMode !== undefined) next.graphMode = text(patch.graphMode, 16) || next.graphMode
    if (patch.edges !== undefined) {
      next.edges = (Array.isArray(patch.edges) ? patch.edges : [])
        .map((item, index) => normalizeEdge(item, index))
        .filter(Boolean)
        .slice(0, MAX_EDGES)
      next.graphMode = 'free'
    }
    next.dirty = true
    return createDraft(next)
  }

  function connect(draft, fromId, toId, meta = {}) {
    const next = ensureFreeGraph(draft)
    const from = text(fromId, 80)
    const to = text(toId, 80)
    if (!from || !to || from === to) return next
    if (from === END_ID || to === START_ID) return next
    if (!next.nodes.some(item => item.id === from) || !next.nodes.some(item => item.id === to)) return next
    // 拒绝成环，保证可运行 DAG
    if (wouldCreateCycle(next.edges || [], from, to)) return next
    const existing = (next.edges || []).find(edge => edge.from === from && edge.to === to)
    if (existing) {
      existing.branch = text(meta.branch || existing.branch, 24)
      if (existing.branch !== 'true' && existing.branch !== 'false') existing.branch = ''
      existing.label = text(meta.label || existing.label, 80)
      next.dirty = true
      return createDraft(next)
    }
    if ((next.edges || []).length >= MAX_EDGES) return next
    next.edges = [
      ...(next.edges || []),
      normalizeEdge({
        from,
        to,
        branch: meta.branch || '',
        label: meta.label || '',
      }, (next.edges || []).length),
    ].filter(Boolean)
    next.dirty = true
    return createDraft(next)
  }

  function wouldCreateCycle(edges, from, to) {
    // if `to` can already reach `from`, adding from→to creates a cycle
    const adj = new Map()
    ;(edges || []).forEach(edge => {
      if (!adj.has(edge.from)) adj.set(edge.from, [])
      adj.get(edge.from).push(edge.to)
    })
    const stack = [to]
    const seen = new Set()
    while (stack.length) {
      const cur = stack.pop()
      if (cur === from) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      const nexts = adj.get(cur) || []
      nexts.forEach(id => stack.push(id))
    }
    return false
  }

  function disconnect(draft, edgeIdOrFrom, toId) {
    const next = ensureFreeGraph(draft)
    if (toId) {
      const from = text(edgeIdOrFrom, 80)
      const to = text(toId, 80)
      next.edges = (next.edges || []).filter(edge => !(edge.from === from && edge.to === to))
    } else {
      const edgeId = text(edgeIdOrFrom, 100)
      next.edges = (next.edges || []).filter(edge => edge.id !== edgeId)
    }
    next.dirty = true
    return createDraft(next)
  }

  function buildProfileForKind(node) {
    const base = node.profile && typeof node.profile === 'object' ? clone(node.profile) : {}
    if (node.kind === 'llm') {
      return {
        ...base,
        promptOverlay: text(node.config?.prompt || node.intent || base.promptOverlay || '', 4000),
        modelPolicy: {
          ...(base.modelPolicy || {}),
          model: text(node.config?.modelName || base.modelPolicy?.model || '', 80),
          temperature: node.config?.temperature || base.modelPolicy?.temperature || '',
        },
      }
    }
    if (node.kind === 'tool' && node.config?.skillId) {
      const skillRefs = Array.isArray(base.skillRefs) ? base.skillRefs.slice() : []
      if (!skillRefs.some(item => (item.id || item) === node.config.skillId)) {
        skillRefs.push({ id: node.config.skillId, version: 'latest' })
      }
      return { ...base, skillRefs }
    }
    if (node.kind === 'knowledge' && node.config?.knowledgeId) {
      const knowledgeRefs = Array.isArray(base.knowledgeRefs) ? base.knowledgeRefs.slice() : []
      if (!knowledgeRefs.some(item => (item.id || item) === node.config.knowledgeId)) {
        knowledgeRefs.push({ id: node.config.knowledgeId })
      }
      return {
        ...base,
        knowledgeRefs,
        knowledgePolicy: { mode: node.config.mode || 'selected', includeWorkMemory: false },
      }
    }
    return base
  }

  function compileLinear(value) {
    const graphNodes = value.nodes.map(node => ({
      id: node.id,
      type: 'agent',
      agentPackageId: node.agentPackageId,
      agentOrigin: node.agentOrigin,
      profileId: node.profileId,
      packageHash: node.packageHash,
      profileHash: node.profileHash || node.profile?.profileHash || '',
      role: node.role,
      intent: node.intent,
      description: node.description,
      inputSpec: node.inputSpec || '',
      outputSpec: node.outputSpec || '',
      relation: node.relation,
      studioKind: 'agent',
    }))
    const members = value.nodes.map(node => ({
      id: node.id,
      expertId: node.agentPackageId,
      agentPackageId: node.agentPackageId,
      agentOrigin: node.agentOrigin,
      profileId: node.profileId,
      packageHash: node.packageHash,
      profileHash: node.profileHash || node.profile?.profileHash || '',
      role: node.role,
      intent: node.intent,
      inputSpec: node.inputSpec || '',
      outputSpec: node.outputSpec || '',
      profile: clone(node.profile || null),
    }))
    const edges = []
    const gates = []
    let previous = []
    let index = 0

    while (index < value.nodes.length) {
      const group = [value.nodes[index]]
      while (index < value.nodes.length - 1 && value.nodes[index].relation === 'parallel') {
        index += 1
        group.push(value.nodes[index])
      }
      if (previous.length) {
        previous.forEach(from => group.forEach(node => edges.push({ from, to: node.id })))
      }
      if (group.length > 1) {
        const joinId = `join-${group[0].id}`
        graphNodes.push({ id: joinId, type: 'join', joinStrategy: 'allSucceeded' })
        group.forEach(node => edges.push({ from: node.id, to: joinId }))
        previous = [joinId]
      } else {
        previous = [group[0].id]
      }
      const last = group[group.length - 1]
      if (last.relation === 'approval' && index < value.nodes.length - 1) {
        const gateId = `approval-${last.id}`
        const gateNodeId = `gate-${last.id}`
        gates.push({
          id: gateId,
          type: 'approval',
          title: text(last.approvalNote || `确认 ${last.name} 的结果`, 160) || `确认 ${last.name} 的结果`,
        })
        graphNodes.push({ id: gateNodeId, type: 'gate', gateRef: gateId })
        previous.forEach(from => edges.push({ from, to: gateNodeId }))
        previous = [gateNodeId]
      }
      index += 1
    }

    if (graphNodes.length) {
      graphNodes.push({ id: 'n-terminal', type: 'terminal', status: 'completed' })
      previous.forEach(from => edges.push({ from, to: 'n-terminal' }))
    }
    return {
      goal: value.goal,
      name: value.name,
      inputs: normalizeIoList(value.inputs, 'input'),
      outputs: normalizeIoList(value.outputs, 'output'),
      template: value.nodes.some(item => item.relation === 'parallel') ? 'parallel' : 'serial',
      members,
      nodes: graphNodes,
      edges,
      gates,
      joinStrategy: 'allSucceeded',
      parallelism: value.nodes.some(item => item.relation === 'parallel') ? 2 : 1,
      layout: { mode: 'linear' },
    }
  }

  function compileFree(value) {
    const layout = { mode: 'free', nodes: {} }
    const graphNodes = []
    const members = []
    const gates = []
    const idMap = new Map() // studio id -> runtime id

    value.nodes.forEach(node => {
      if (node.kind === 'start') {
        layout.start = { x: node.x, y: node.y }
        return
      }
      if (node.kind === 'end') {
        layout.end = { x: node.x, y: node.y }
        idMap.set(node.id, 'n-terminal')
        return
      }
      layout.nodes[node.id] = { x: node.x, y: node.y, kind: node.kind }
      if (EXEC_AGENT.has(node.kind)) {
        const profile = buildProfileForKind(node)
        graphNodes.push({
          id: node.id,
          type: 'agent',
          agentPackageId: node.agentPackageId,
          agentOrigin: node.agentOrigin,
          profileId: node.profileId,
          packageHash: node.packageHash,
          profileHash: node.profileHash || profile?.profileHash || '',
          role: node.role,
          intent: node.intent || '',
          description: node.description,
          inputSpec: node.inputSpec || '',
          outputSpec: node.outputSpec || '',
          studioKind: 'agent',
          x: node.x,
          y: node.y,
        })
        members.push({
          id: node.id,
          expertId: node.agentPackageId,
          agentPackageId: node.agentPackageId,
          agentOrigin: node.agentOrigin,
          profileId: node.profileId,
          packageHash: node.packageHash,
          profileHash: node.profileHash || profile?.profileHash || '',
          role: node.role,
          intent: node.intent || '',
          inputSpec: node.inputSpec || '',
          outputSpec: node.outputSpec || '',
          profile,
          studioKind: 'agent',
        })
        idMap.set(node.id, node.id)
        return
      }
      if (EXEC_SPECIALTY.has(node.kind)) {
        const cfg = normalizeConfig(node.kind, node.config || {})
        graphNodes.push({
          id: node.id,
          type: node.kind,
          role: node.role || node.name || defaultName(node.kind),
          intent: node.intent || cfg.prompt || '',
          description: node.description,
          inputSpec: node.inputSpec || '',
          outputSpec: node.outputSpec || '',
          studioKind: node.kind,
          config: cfg,
          x: node.x,
          y: node.y,
        })
        idMap.set(node.id, node.id)
        return
      }
      if (node.kind === 'join') {
        graphNodes.push({ id: node.id, type: 'join', joinStrategy: 'allSucceeded', x: node.x, y: node.y })
        idMap.set(node.id, node.id)
        return
      }
      if (node.kind === 'gate') {
        const gateId = `approval-${node.id}`
        gates.push({
          id: gateId,
          type: 'approval',
          title: text(node.config?.title || node.approvalNote || node.name || '人工确认', 160),
        })
        graphNodes.push({ id: node.id, type: 'gate', gateRef: gateId, x: node.x, y: node.y })
        idMap.set(node.id, node.id)
        return
      }
      if (node.kind === 'condition') {
        graphNodes.push({
          id: node.id,
          type: 'condition',
          condition: clone(node.config || {}),
          x: node.x,
          y: node.y,
        })
        idMap.set(node.id, node.id)
      }
    })

    graphNodes.push({ id: 'n-terminal', type: 'terminal', status: 'completed' })

    const edges = []
    ;(value.edges || []).forEach(edge => {
      const from = edge.from === START_ID ? null : (idMap.get(edge.from) || edge.from)
      const to = idMap.get(edge.to) || edge.to
      if (edge.from === START_ID) {
        // roots: no edge from virtual start — runtime roots have no deps
        return
      }
      if (!from || !to || from === to) return
      edges.push({
        from,
        to,
        label: edge.label || '',
        branch: edge.branch || '',
      })
    })

    // Ensure every non-terminal node can reach terminal if it has no outgoing
    const outgoing = new Set(edges.map(item => item.from))
    graphNodes.forEach(node => {
      if (node.type === 'terminal') return
      if (!outgoing.has(node.id)) edges.push({ from: node.id, to: 'n-terminal' })
    })

    const hasParallelFanout = edges.some(edge => {
      const outs = edges.filter(item => item.from === edge.from)
      return outs.length > 1 && outs.every(item => !item.branch)
    })

    return {
      goal: value.goal,
      name: value.name,
      inputs: normalizeIoList(value.inputs, 'input'),
      outputs: normalizeIoList(value.outputs, 'output'),
      // free 图已有显式 nodes/edges；无专家时不得套 serial 模板（minMembers≥1）
      template: members.length ? (hasParallelFanout ? 'parallel' : 'serial') : null,
      members,
      nodes: graphNodes,
      edges,
      gates,
      joinStrategy: 'allSucceeded',
      parallelism: hasParallelFanout ? 2 : 1,
      layout,
    }
  }

  function toComposition(draft) {
    const value = createDraft(draft)
    if (value.graphMode === 'free' && Array.isArray(value.edges)) {
      return compileFree({
        ...value,
        nodes: ensureSystemNodes(value.nodes),
      })
    }
    // linear: nodes are agents only
    return compileLinear({
      ...value,
      nodes: value.nodes.filter(item => item.kind === 'agent' || (!item.kind && item.agentPackageId)),
    })
  }

  return {
    MAX_NODES,
    MAX_EDGES,
    RELATIONS,
    NODE_KINDS,
    COMPILE_AS_AGENT,
    EXEC_AGENT,
    EXEC_SPECIALTY,
    EXEC_CAPABILITY,
    START_ID,
    END_ID,
    createDraft,
    fromGraph,
    validateDraft,
    inspectStudioGraph,
    addAgent,
    addNode,
    moveNode,
    removeNode,
    duplicateNode,
    updateDraft,
    updateNode,
    updatePosition,
    connect,
    disconnect,
    ensureFreeGraph,
    toComposition,
    draftAgents,
    draftExpertNodes,
  }
})
