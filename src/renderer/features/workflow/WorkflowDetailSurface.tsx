import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'
import { WorkbenchDetailHeaderAction } from '../workbench/WorkbenchDetailHeaderAction'
import { WorkflowLaunchDrawer, type WorkflowLaunchPayload } from './WorkflowLaunchDrawer'

type WorkflowPackage = Record<string, unknown> & {
  source?: string
  version?: string
  inputs?: unknown[]
  outputs?: unknown[]
  graph?: { nodes?: unknown[]; edges?: unknown[]; layout?: unknown }
}

type WorkflowNodeRow = {
  id: string
  type: string
  name: string
  role: string
  purpose: string
  output: string
  x?: number
  y?: number
}

type WorkflowEdgeRow = {
  from: string
  to: string
  label?: string
}

type WorkflowDagNode = WorkflowNodeRow & {
  x: number
  y: number
  width: number
  height: number
  boundary?: 'start' | 'end'
}

type WorkflowCanvasNode = WorkflowNodeRow & {
  width: number
  height: number
  boundary?: 'start' | 'end'
}

const EXECUTABLE_NODE_TYPES = new Set(['agent', 'human', 'action', 'llm', 'tool', 'knowledge'])

const DAG_NODE_WIDTH = 236
const DAG_NODE_HEIGHT = 116
const DAG_BOUNDARY_WIDTH = 176
const DAG_BOUNDARY_HEIGHT = 82
const DAG_LAYER_GAP = 66
const DAG_CANVAS_PADDING = 42

const NODE_KIND_META: Record<string, { label: string; icon: string }> = {
  start: { label: '开始节点', icon: 'play' },
  end: { label: '结束节点', icon: 'square' },
  terminal: { label: '结束节点', icon: 'square' },
  agent: { label: '专家节点', icon: 'users' },
  human: { label: '人工节点', icon: 'users' },
  action: { label: '动作节点', icon: 'component' },
  llm: { label: '大模型节点', icon: 'optimize' },
  tool: { label: '工具节点', icon: 'component' },
  knowledge: { label: '知识库节点', icon: 'bookOpen' },
  mcp: { label: '连接器节点', icon: 'component' },
  request: { label: '请求节点', icon: 'link' },
  condition: { label: '条件节点', icon: 'workflow' },
  join: { label: '汇合节点', icon: 'network' },
  gate: { label: '确认节点', icon: 'clipboardCheck' },
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function workflowGraph(pkg: WorkflowPackage | null, card: ShelfCardModel) {
  return record(pkg?.graph || card.graph)
}

function finitePosition(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined
}

function compactHint(value: unknown, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function declaredOutput(value: unknown) {
  if (typeof value === 'string') return compactHint(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const row = record(item)
        return compactHint(row.label || row.title || row.name || row.id || item, 60)
      })
      .filter(Boolean)
      .slice(0, 2)
      .join('、')
  }
  const row = record(value)
  const direct = compactHint(row.label || row.title || row.name || row.id)
  if (direct) return direct
  return Object.keys(row).slice(0, 2).map((key) => compactHint(key, 50)).filter(Boolean).join('、')
}

function edgeOutputLabel(graph: Record<string, unknown>, nodeId: string) {
  const edges = Array.isArray(graph.edges) ? graph.edges : []
  const label = edges.map(record).find((edge) => (
    String(edge.from || edge.source || edge.sourceId || '') === nodeId
  ))?.label
  const text = compactHint(label, 100)
  if (!text || text === '接着执行') return ''
  return text.replace(/^(交接|提交|传递|输出|形成|生成|返回|确认)(给下游)?\s*/, '') || text
}

function fallbackPurpose(type: string, nodeName = '', source: Record<string, unknown> = {}) {
  const config = record(source.config)
  const role = compactHint(source.role || nodeName, 80)
  if (type === 'agent' && role) return `由${role}处理上游信息，并完成当前环节的专业任务。`
  if (type === 'knowledge') {
    const knowledge = compactHint(config.knowledgeName || config.knowledgeId, 80)
    return knowledge
      ? `从${knowledge}中检索与当前任务相关的事实、规则和参考内容。`
      : '围绕上游问题检索知识库，整理相关事实和引用。'
  }
  if (type === 'tool') {
    const tool = compactHint(config.skillName || config.skillId, 80)
    return tool ? `调用${tool}处理上游输入并返回可供后续节点使用的结果。` : '调用已配置的工具处理输入并返回执行结果。'
  }
  return ({
    start: '接收本次运行目标和输入材料，并整理为流程可使用的输入。',
    end: '汇总各节点结果，检查交付是否完整并形成最终产物。',
    terminal: '汇总各节点结果，检查交付是否完整并形成最终产物。',
    agent: '由指定专家处理上游信息，完成本节点约定的专业任务。',
    human: '由用户检查当前结果并决定流程是否继续。',
    action: '执行配置好的动作，并把执行结果交给下游节点。',
    llm: '根据提示词处理上游内容并生成结构化结果。',
    tool: '调用已配置的工具处理输入并返回执行结果。',
    knowledge: '围绕上游问题检索知识库，整理相关事实和引用。',
    mcp: '调用已配置的连接器能力获取或处理外部数据。',
    request: '向指定服务发送请求并解析返回内容。',
    condition: '检查上游结果是否满足条件，并选择后续分支。',
    join: '等待并汇总多个上游分支，形成统一的后续输入。',
    gate: '请用户检查阶段结果，确认后再继续执行。',
  } as Record<string, string>)[type] || '处理上游输入，并按流程约定完成当前节点任务。'
}

function fallbackOutput(type: string, card: ShelfCardModel, nodeName = '', source: Record<string, unknown> = {}) {
  const config = record(source.config)
  const role = compactHint(source.role || nodeName, 80)
  if (type === 'agent' && role) return `${role}形成的阶段成果`
  if (type === 'knowledge') {
    const knowledge = compactHint(config.knowledgeName || config.knowledgeId, 80)
    return knowledge ? `${knowledge}的检索结果与引用` : '知识检索结果与引用'
  }
  if (type === 'tool') {
    const tool = compactHint(config.skillName || config.skillId, 80)
    return tool ? `${tool}的执行结果` : '工具执行结果'
  }
  return ({
    start: card.inputLabel || '标准化的流程输入',
    end: card.outcomeLabel || '最终工作流交付',
    terminal: card.outcomeLabel || '最终工作流交付',
    agent: '专家阶段成果',
    human: '用户确认结论',
    action: '动作执行结果',
    llm: '模型生成内容',
    tool: '工具执行结果',
    knowledge: '知识检索结果与引用',
    mcp: '连接器调用结果',
    request: '服务响应结果',
    condition: '分支判断结果',
    join: '合并后的阶段结果',
    gate: '验收意见与继续执行结论',
  } as Record<string, string>)[type] || '本节点处理结果'
}

function nodeRows(pkg: WorkflowPackage | null, card: ShelfCardModel): WorkflowNodeRow[] {
  const graph = workflowGraph(pkg, card)
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  return nodes.map((raw, index) => {
    const node = record(raw)
    const type = String(node.type || node.kind || 'agent').toLowerCase()
    const name = String(node.name || node.label || node.agentPackageId || node.agent || `节点 ${index + 1}`)
    const purpose = compactHint(node.intent || node.description) || fallbackPurpose(type, name, node)
    const output = declaredOutput(node.outputSpec || node.outputs)
      || edgeOutputLabel(graph, String(node.id || `node-${index + 1}`))
      || fallbackOutput(type, card, name, node)
    return {
      id: String(node.id || `node-${index + 1}`),
      type,
      name,
      role: String(node.role || node.intent || node.description || ''),
      purpose,
      output,
      x: finitePosition(node.x),
      y: finitePosition(node.y),
    }
  })
}

function edgeRows(pkg: WorkflowPackage | null, card: ShelfCardModel, nodes: WorkflowNodeRow[]): WorkflowEdgeRow[] {
  const graph = workflowGraph(pkg, card)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = (Array.isArray(graph.edges) ? graph.edges : [])
    .map((raw) => {
      const edge = record(raw)
      return {
        from: String(edge.from || edge.source || edge.sourceId || ''),
        to: String(edge.to || edge.target || edge.targetId || ''),
        label: String(edge.label || edge.relation || edge.branch || ''),
      }
    })
    .filter((edge) => edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to))
  const unique = [...new Map(edges.map((edge) => [`${edge.from}->${edge.to}`, edge])).values()]
  if (unique.length || nodes.length < 2) return unique
  return nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }))
}

function workflowCanvasGraph(
  nodes: WorkflowNodeRow[],
  edges: WorkflowEdgeRow[],
  graph: Record<string, unknown>,
  card: ShelfCardModel,
) {
  if (!nodes.length) return { nodes: [] as WorkflowCanvasNode[], edges }

  const layout = record(graph.layout)
  const layoutNodes = record(layout.nodes)
  const pointFor = (node: WorkflowNodeRow, boundary?: 'start' | 'end') => {
    const saved = boundary ? record(layout[boundary]) : record(layoutNodes[node.id])
    return {
      x: node.x ?? finitePosition(saved.x),
      y: node.y ?? finitePosition(saved.y),
    }
  }

  const incoming = new Set(edges.map((edge) => edge.to))
  const outgoing = new Set(edges.map((edge) => edge.from))
  const hasStart = nodes.some((node) => node.type === 'start')
  const hasEnd = nodes.some((node) => node.type === 'end' || node.type === 'terminal')
  const canvasNodes: WorkflowCanvasNode[] = nodes.map((node) => {
    const boundary = node.type === 'start'
      ? 'start'
      : node.type === 'end' || node.type === 'terminal'
        ? 'end'
        : undefined
    const point = pointFor(node, boundary)
    return {
      ...node,
      role: node.role || (boundary === 'start'
        ? '输入与流程目标'
        : boundary === 'end'
          ? '输出与交付结果'
          : ''),
      boundary,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    }
  })
  const canvasEdges = [...edges]

  if (!hasStart) {
    const startId = '__workflow_start__'
    const startNode: WorkflowNodeRow = {
      id: startId,
      type: 'start',
      name: '开始节点',
      role: '',
      purpose: fallbackPurpose('start'),
      output: fallbackOutput('start', card),
    }
    const point = pointFor(startNode, 'start')
    canvasNodes.unshift({
      ...startNode,
      role: '输入与流程目标',
      boundary: 'start',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })
    nodes.filter((node) => !incoming.has(node.id)).forEach((node) => {
      canvasEdges.push({ from: startId, to: node.id, label: '接着执行' })
    })
  }

  if (!hasEnd) {
    const endId = '__workflow_end__'
    const endNode: WorkflowNodeRow = {
      id: endId,
      type: 'end',
      name: '结束节点',
      role: '',
      purpose: fallbackPurpose('end'),
      output: fallbackOutput('end', card),
    }
    const point = pointFor(endNode, 'end')
    canvasNodes.push({
      ...endNode,
      role: '输出与交付结果',
      boundary: 'end',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })
    nodes.filter((node) => !outgoing.has(node.id)).forEach((node) => {
      canvasEdges.push({ from: node.id, to: endId, label: '接着执行' })
    })
  }

  return { nodes: canvasNodes, edges: canvasEdges }
}

function workflowDagLayout(nodes: WorkflowCanvasNode[], sourceEdges: WorkflowEdgeRow[]) {
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const levels = new Map(nodes.map((node) => [node.id, 0]))

  sourceEdges.forEach((edge) => {
    outgoing.get(edge.from)?.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1)
  })

  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id)
  const processed: string[] = []
  while (queue.length) {
    queue.sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0))
    const id = queue.shift() as string
    processed.push(id)
    for (const target of outgoing.get(id) || []) {
      levels.set(target, Math.max(levels.get(target) || 0, (levels.get(id) || 0) + 1))
      indegree.set(target, (indegree.get(target) || 0) - 1)
      if (indegree.get(target) === 0) queue.push(target)
    }
  }

  let edges = sourceEdges
  if (processed.length !== nodes.length) {
    nodes.forEach((node, index) => levels.set(node.id, index))
    edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }))
  }

  const layers = new Map<number, WorkflowCanvasNode[]>()
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0
    layers.set(level, [...(layers.get(level) || []), node])
  })

  const positioned: WorkflowDagNode[] = []
  layers.forEach((layerNodes, level) => {
    const count = layerNodes.length
    layerNodes.forEach((node, index) => {
      const boundary = node.boundary
      const width = boundary ? DAG_BOUNDARY_WIDTH : DAG_NODE_WIDTH
      const height = boundary ? DAG_BOUNDARY_HEIGHT : DAG_NODE_HEIGHT
      const layerWidth = count * DAG_NODE_WIDTH + Math.max(0, count - 1) * DAG_LAYER_GAP
      const fallbackX = DAG_CANVAS_PADDING + Math.max(0, (900 - layerWidth) / 2) + index * (DAG_NODE_WIDTH + DAG_LAYER_GAP)
      const fallbackY = DAG_CANVAS_PADDING + level * (DAG_NODE_HEIGHT + DAG_LAYER_GAP)
      positioned.push({
        ...node,
        x: node.x ?? fallbackX,
        y: node.y ?? fallbackY,
        width,
        height,
      })
    })
  })

  const maxX = Math.max(900, ...positioned.map((node) => node.x + node.width + DAG_CANVAS_PADDING))
  const maxY = Math.max(620, ...positioned.map((node) => node.y + node.height + DAG_CANVAS_PADDING))
  return {
    nodes: positioned,
    edges,
    order: processed.length === nodes.length ? processed : nodes.map((node) => node.id),
    width: maxX,
    height: maxY,
  }
}

function edgeCurve(from: WorkflowDagNode, to: WorkflowDagNode) {
  const fromCenterX = from.x + from.width / 2
  const fromCenterY = from.y + from.height / 2
  const toCenterX = to.x + to.width / 2
  const toCenterY = to.y + to.height / 2
  const deltaX = toCenterX - fromCenterX
  const deltaY = toCenterY - fromCenterY
  const vertical = Math.abs(deltaY) >= Math.abs(deltaX) * 0.75
  if (vertical) {
    const direction = deltaY >= 0 ? 1 : -1
    const startX = fromCenterX
    const startY = from.y + (direction > 0 ? from.height : 0)
    const endX = toCenterX
    const endY = to.y + (direction > 0 ? 0 : to.height)
    const control = Math.max(54, Math.abs(endY - startY) * 0.42)
    return {
      d: `M ${startX} ${startY} C ${startX} ${startY + direction * control}, ${endX} ${endY - direction * control}, ${endX} ${endY}`,
      labelX: (startX + endX) / 2,
      labelY: (startY + endY) / 2,
    }
  }
  const forward = deltaX >= 0
  const startX = forward ? from.x + from.width : from.x
  const endX = forward ? to.x : to.x + to.width
  const startY = fromCenterY
  const endY = toCenterY
  const control = Math.max(54, Math.abs(endX - startX) * 0.42)
  return {
    d: `M ${startX} ${startY} C ${startX + (forward ? control : -control)} ${startY}, ${endX - (forward ? control : -control)} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2,
  }
}

export function WorkflowDetailSurface({
  card,
  onBack,
  onLaunch,
  onFork,
}: {
  card: ShelfCardModel
  onBack: () => void
  onLaunch: (payload: WorkflowLaunchPayload) => Promise<boolean> | boolean
  onFork: () => void
}) {
  const [pkg, setPackage] = useState<WorkflowPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [launchOpen, setLaunchOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewStep, setPreviewStep] = useState(-1)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(.82)
  const dagScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void window.api?.workbenchWorkflowPackageGet?.(card.id)
      .then((result) => {
        if (!active) return
        setPackage((result?.package || null) as WorkflowPackage | null)
      })
      .catch(() => { if (active) setPackage(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [card.id])

  useEffect(() => {
    setPreviewing(false)
    setPreviewStep(-1)
    setSelectedNodeId(null)
    setCanvasZoom(.82)
  }, [card.id])

  const nodes = useMemo(() => nodeRows(pkg, card), [pkg, card])
  const edges = useMemo(() => edgeRows(pkg, card, nodes), [pkg, card, nodes])
  const graph = useMemo(() => workflowGraph(pkg, card), [pkg, card])
  const canvasGraph = useMemo(
    () => workflowCanvasGraph(nodes, edges, graph, card),
    [nodes, edges, graph, card],
  )
  const dag = useMemo(
    () => workflowDagLayout(canvasGraph.nodes, canvasGraph.edges),
    [canvasGraph],
  )
  const dagMarkerId = `workflow-dag-arrow-${useId().replace(/:/g, '')}`
  const executableNodeCount = nodes.filter((node) => EXECUTABLE_NODE_TYPES.has(node.type)).length
  const immutable = card.provenanceKind === 'team'
  const invalid = executableNodeCount < 1
  const previewIndex = useMemo(
    () => new Map(dag.order.map((id, index) => [id, index])),
    [dag.order],
  )
  const previewFinished = previewStep >= dag.order.length && dag.order.length > 0
  const previewCurrentStep = previewFinished
    ? dag.order.length
    : previewStep >= 0
      ? Math.min(previewStep + 1, dag.order.length)
      : 0
  const nextPreviewNode = previewing ? dag.nodes.find((node) => (
    previewIndex.get(node.id) === previewStep + 1
  )) : null

  const startPreview = () => {
    setSelectedNodeId(null)
    setPreviewStep(0)
    setPreviewing(true)
  }

  const advancePreview = () => {
    if (!previewing) return
    setSelectedNodeId(null)
    setPreviewStep((current) => {
      const next = current + 1
      if (next >= dag.order.length) {
        setPreviewing(false)
        return dag.order.length
      }
      return next
    })
  }

  const nodePreviewState = (nodeId: string) => {
    const index = previewIndex.get(nodeId) ?? -1
    if (previewFinished || (previewStep > index && index >= 0)) return 'complete'
    if (previewing && previewStep === index) return 'current'
    return previewStep >= 0 ? 'pending' : 'idle'
  }

  useEffect(() => {
    const scroll = dagScrollRef.current
    if (!scroll || previewStep < 0 || !dag.nodes.length) return
    const focusIndex = previewFinished ? dag.order.length - 1 : previewStep
    const focusId = dag.order[focusIndex]
    const focusNode = dag.nodes.find((node) => node.id === focusId)
    if (!focusNode) return
    const targetLeft = (focusNode.x + focusNode.width / 2) * canvasZoom - scroll.clientWidth / 2
    const targetTop = (focusNode.y + focusNode.height / 2) * canvasZoom - scroll.clientHeight / 2
    const left = Math.max(0, Math.min(targetLeft, scroll.scrollWidth - scroll.clientWidth))
    const top = Math.max(0, Math.min(targetTop, scroll.scrollHeight - scroll.clientHeight))
    if (typeof scroll.scrollTo === 'function') {
      scroll.scrollTo({ left, top, behavior: 'smooth' })
    } else {
      scroll.scrollLeft = left
      scroll.scrollTop = top
    }
  }, [canvasZoom, dag.nodes, dag.order, previewFinished, previewStep])

  return (
    <article className="wb-workflow-detail" data-testid="workflow-detail">
      <WorkbenchDetailHeaderAction label="返回工作流" onBack={onBack} />

      <div className="wb-workflow-detail-grid">
        <aside className="wb-workflow-detail-panel is-contract" data-testid="workflow-detail-summary">
          <header className="wb-workflow-detail-head">
            <div className="wb-workflow-detail-title">
              <div className="wb-workflow-detail-mark"><Icon name={card.markIcon} /></div>
              <div>
                <h1>{card.name}</h1>
                <p>{card.description || '由多个专家按既定交接关系共同完成一项复杂任务。'}</p>
              </div>
            </div>
          </header>

          {invalid && !loading ? (
            <div className="wb-workflow-detail-warning" role="status">
              此流程还没有可执行节点，请先完成工作流编排后再启动。
            </div>
          ) : null}

          <div className="wb-workflow-panel-heading">
            <div>
              <h2>输入与产出</h2>
            </div>
          </div>
          <div className="wb-workflow-contract-flow" aria-label="工作流输入、执行和产出">
            <div>
              <Icon name="note" />
              <span>输入</span>
              <strong>{card.inputLabel}</strong>
            </div>
            <Icon name="chevronRight" />
            <div>
              <Icon name="workflow" />
              <span>执行</span>
              <strong>{nodes.length} 个节点</strong>
            </div>
            <Icon name="chevronRight" />
            <div>
              <Icon name="clipboardCheck" />
              <span>产出</span>
              <strong>{card.outcomeLabel}</strong>
            </div>
          </div>
          <dl>
            <div><dt>执行方式</dt><dd>本地运行</dd></div>
            <div><dt>版本</dt><dd>{String(pkg?.version || '当前版本')}</dd></div>
          </dl>
          <p className="wb-workflow-detail-note">
            {immutable
              ? '团队与官方工作流只读；需要修改时先复制为自己的版本。'
              : '这是你的工作流，可在工作流管理中继续编排。'}
          </p>

          <div className="wb-workflow-detail-actions">
            {immutable ? (
              <button type="button" className="wb-modal-btn" onClick={onFork}>复制为我的工作流</button>
            ) : null}
            <button
              type="button"
              className="wb-modal-btn primary"
              onClick={() => setLaunchOpen(true)}
              disabled={loading || invalid || card.blocked}
            >
              <Icon name="play" />
              <span>使用此工作流</span>
            </button>
          </div>
        </aside>

        <section className="wb-workflow-detail-panel is-path" data-testid="workflow-detail-path">
          <div className="wb-workflow-panel-heading">
            <div>
              <h2>节点如何流转</h2>
            </div>
            <div className="wb-workflow-canvas-toolbar" aria-label="画布操作">
              <span>{nodes.length} 个节点</span>
              <button
                type="button"
                className={`wb-workflow-preview-btn${previewing ? ' is-active' : ''}`}
                data-testid="workflow-preview-toggle"
                aria-label={previewing
                  ? (nextPreviewNode ? `下一步：${nextPreviewNode.name}` : '完成预览')
                  : undefined}
                onClick={previewing ? advancePreview : startPreview}
              >
                <Icon name={previewing ? 'chevronRight' : 'play'} />
                {previewing
                  ? (nextPreviewNode ? '下一步' : '完成预览')
                  : previewStep >= 0 ? '重新预览' : '预览流转'}
              </button>
              {previewStep >= 0 ? (
                <div className="wb-workflow-preview-progress" data-testid="workflow-preview-progress" aria-label={`第 ${previewCurrentStep}/${dag.order.length} 步`}>
                  <span>第 {previewCurrentStep}/{dag.order.length} 步</span>
                  <span className="wb-workflow-preview-progress-track" aria-hidden="true">
                    <span style={{ width: `${dag.order.length ? (previewCurrentStep / dag.order.length) * 100 : 0}%` }} />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          {dag.nodes.length ? (
            <div className="wb-workflow-dag-frame">
            <div ref={dagScrollRef} className="wb-workflow-dag-scroll" role="region" aria-label="工作流编排预览" tabIndex={0}>
              <div
                className="wb-workflow-dag-viewport"
                style={{ width: dag.width * canvasZoom, height: dag.height * canvasZoom }}
              >
              <div
                className={`wb-workflow-dag${previewing ? ' is-previewing' : ''}`}
                data-testid="workflow-dag"
                style={{ width: dag.width, height: dag.height, transform: `scale(${canvasZoom})` }}
              >
                <svg viewBox={`0 0 ${dag.width} ${dag.height}`} aria-hidden="true">
                  <defs>
                    <marker id={dagMarkerId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 0 L 6 3 L 0 6 Z" />
                    </marker>
                  </defs>
                  {dag.edges.map((edge) => {
                    const from = dag.nodes.find((node) => node.id === edge.from)
                    const to = dag.nodes.find((node) => node.id === edge.to)
                    if (!from || !to) return null
                    const curve = edgeCurve(from, to)
                    const fromIndex = previewIndex.get(from.id) ?? -1
                    const toIndex = previewIndex.get(to.id) ?? -1
                    const complete = previewFinished || (previewStep > toIndex && toIndex >= 0)
                    const current = previewing && previewStep === fromIndex
                    return (
                      <g key={`${edge.from}->${edge.to}`}>
                        <path
                          className={`wb-workflow-dag-edge${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}`}
                          data-testid="workflow-dag-edge"
                          d={curve.d}
                          markerEnd={`url(#${dagMarkerId})`}
                        />
                      </g>
                    )
                  })}
                </svg>
                <div className="wb-workflow-dag-labels" aria-hidden="true">
                  {dag.edges.map((edge) => {
                    const from = dag.nodes.find((node) => node.id === edge.from)
                    const to = dag.nodes.find((node) => node.id === edge.to)
                    if (!from || !to) return null
                    const curve = edgeCurve(from, to)
                    const fromIndex = previewIndex.get(from.id) ?? -1
                    const toIndex = previewIndex.get(to.id) ?? -1
                    const complete = previewFinished || (previewStep > toIndex && toIndex >= 0)
                    const current = previewing && previewStep === fromIndex
                    return (
                      <span
                        key={`${edge.from}->${edge.to}`}
                        className={`wb-workflow-dag-edge-label${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}`}
                        style={{ left: curve.labelX, top: curve.labelY }}
                      >
                        {edge.label || '接着执行'}
                      </span>
                    )
                  })}
                </div>
                <ol className="wb-workflow-dag-nodes">
                  {dag.nodes.map((node, index) => {
                    const state = nodePreviewState(node.id)
                    const kind = NODE_KIND_META[node.type] || { label: '流程节点', icon: 'component' }
                    const selected = selectedNodeId === node.id
                    const statusText = state === 'current'
                      ? '运行中'
                      : state === 'complete'
                        ? '已完成'
                        : state === 'pending'
                          ? '等待输入'
                          : '未开始'
                    return (
                      <li
                        key={node.id}
                        className={`wb-workflow-dag-node is-${node.type} is-${state}${selected ? ' is-selected' : ''}${node.boundary ? ` is-boundary is-${node.boundary}` : ''}`}
                        data-testid={node.boundary ? `workflow-canvas-${node.boundary}` : `workflow-canvas-node-${node.id}`}
                        style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                      >
                        <button
                          type="button"
                          aria-label={`查看节点说明：${node.name}`}
                          aria-describedby={`workflow-node-tip-${node.id}`}
                          onClick={() => setSelectedNodeId((current) => current === node.id ? null : node.id)}
                        >
                          <span className="wb-workflow-dag-node-head">
                            <span className="wb-workflow-dag-kind-icon" aria-hidden="true"><Icon name={kind.icon} /></span>
                            <strong>{node.name}</strong>
                            <span className="wb-workflow-dag-state">{statusText}</span>
                          </span>
                          <span className="wb-workflow-dag-node-body">
                            <span>{kind.label}</span>
                            <b>{node.role || (node.boundary === 'start' ? '接收本次运行目标' : node.boundary === 'end' ? '汇总并交付工作结果' : '按流程约定处理上游输入')}</b>
                          </span>
                          <span className="wb-workflow-port is-input" aria-hidden="true" />
                          <span className="wb-workflow-port is-output" aria-hidden="true" />
                        </button>
                        <aside
                          id={`workflow-node-tip-${node.id}`}
                          className="wb-workflow-node-tip"
                          role="tooltip"
                        >
                          <span>节点说明 · {kind.label}</span>
                          <strong>{node.name}</strong>
                          <dl>
                            <div><dt>负责</dt><dd>{node.purpose}</dd></div>
                            <div><dt>产出</dt><dd>{node.output}</dd></div>
                          </dl>
                        </aside>
                        <span className="wb-workflow-node-sequence" aria-hidden="true">{index + 1}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
              </div>
            </div>
            <span className="wb-workflow-zoom-controls" aria-label="画布缩放控制">
              <button type="button" aria-label="缩小画布" onClick={() => setCanvasZoom((value) => Math.max(.55, value - .1))}>−</button>
              <output aria-label="当前缩放比例">{Math.round(canvasZoom * 100)}%</output>
              <button type="button" aria-label="放大画布" onClick={() => setCanvasZoom((value) => Math.min(1.25, value + .1))}>+</button>
              <button type="button" aria-label="适应画布" onClick={() => setCanvasZoom(.82)}>适应</button>
            </span>
            </div>
          ) : <div className="wb-workflow-dag-empty">尚未编排节点</div>}
        </section>
      </div>
      {launchOpen ? (
        <WorkflowLaunchDrawer
          card={card}
          workflowPackage={pkg}
          onClose={() => setLaunchOpen(false)}
          onSubmit={onLaunch}
        />
      ) : null}
    </article>
  )
}
