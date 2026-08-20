import { useEffect, useId, useMemo, useState } from 'react'
import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'
import { WorkbenchDetailHeaderAction } from '../workbench/WorkbenchDetailHeaderAction'
import { WorkflowLaunchDrawer, type WorkflowLaunchPayload } from './WorkflowLaunchDrawer'

type WorkflowPackage = Record<string, unknown> & {
  source?: string
  version?: string
  inputs?: unknown[]
  outputs?: unknown[]
  graph?: { nodes?: unknown[]; edges?: unknown[] }
}

type WorkflowNodeRow = {
  id: string
  type: string
  name: string
  role: string
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
  boundary?: 'start' | 'end'
}

const EXECUTABLE_NODE_TYPES = new Set(['agent', 'human', 'action', 'llm', 'tool', 'knowledge'])

const DAG_NODE_HEIGHT = 76
const DAG_LAYER_GAP = 122
const DAG_CANVAS_PADDING = 32

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function workflowGraph(pkg: WorkflowPackage | null, card: ShelfCardModel) {
  return record(pkg?.graph || card.graph)
}

function nodeRows(pkg: WorkflowPackage | null, card: ShelfCardModel): WorkflowNodeRow[] {
  const graph = workflowGraph(pkg, card)
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  return nodes.map((raw, index) => {
    const node = record(raw)
    const type = String(node.type || node.kind || 'agent').toLowerCase()
    return {
      id: String(node.id || `node-${index + 1}`),
      type,
      name: String(node.name || node.label || node.agentPackageId || node.agent || `节点 ${index + 1}`),
      role: String(node.role || node.intent || node.description || ''),
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

function workflowCanvasGraph(nodes: WorkflowNodeRow[], edges: WorkflowEdgeRow[]) {
  if (!nodes.length) return { nodes, edges }

  const incoming = new Set(edges.map((edge) => edge.to))
  const outgoing = new Set(edges.map((edge) => edge.from))
  const hasStart = nodes.some((node) => node.type === 'start')
  const hasEnd = nodes.some((node) => node.type === 'end' || node.type === 'terminal')
  const canvasNodes: WorkflowDagNode[] = nodes.map((node) => {
    const boundary = node.type === 'start'
      ? 'start'
      : node.type === 'end' || node.type === 'terminal'
        ? 'end'
        : undefined
    return {
      ...node,
      role: node.role || (boundary === 'start'
        ? '输入与流程目标'
        : boundary === 'end'
          ? '输出与交付结果'
          : ''),
      boundary,
      x: 0,
      y: 0,
      width: 0,
    }
  })
  const canvasEdges = [...edges]

  if (!hasStart) {
    const startId = '__workflow_start__'
    canvasNodes.unshift({
      id: startId,
      type: 'start',
      name: '开始节点',
      role: '输入与流程目标',
      boundary: 'start',
      x: 0,
      y: 0,
      width: 0,
    })
    nodes.filter((node) => !incoming.has(node.id)).forEach((node) => {
      canvasEdges.push({ from: startId, to: node.id, label: '接着执行' })
    })
  }

  if (!hasEnd) {
    const endId = '__workflow_end__'
    canvasNodes.push({
      id: endId,
      type: 'end',
      name: '结束节点',
      role: '输出与交付结果',
      boundary: 'end',
      x: 0,
      y: 0,
      width: 0,
    })
    nodes.filter((node) => !outgoing.has(node.id)).forEach((node) => {
      canvasEdges.push({ from: node.id, to: endId, label: '接着执行' })
    })
  }

  return { nodes: canvasNodes, edges: canvasEdges }
}

function workflowDagLayout(nodes: WorkflowNodeRow[], sourceEdges: WorkflowEdgeRow[]) {
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

  const layers = new Map<number, WorkflowNodeRow[]>()
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0
    layers.set(level, [...(layers.get(level) || []), node])
  })

  const positioned: WorkflowDagNode[] = []
  layers.forEach((layerNodes, level) => {
    const count = layerNodes.length
    const width = count === 1 ? 58 : Math.min(42, 90 / count)
    layerNodes.forEach((node, index) => {
      const boundary = 'boundary' in node ? node.boundary : undefined
      positioned.push({
        ...node,
        x: ((index + 1) * 100) / (count + 1),
        y: DAG_CANVAS_PADDING + level * DAG_LAYER_GAP,
        width: boundary || node.type === 'start' || node.type === 'end' || node.type === 'terminal'
          ? Math.min(width, 28)
          : width,
      })
    })
  })

  const maxY = Math.max(DAG_CANVAS_PADDING, ...positioned.map((node) => node.y))
  return {
    nodes: positioned,
    edges,
    height: maxY + DAG_NODE_HEIGHT + DAG_CANVAS_PADDING,
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

  const nodes = useMemo(() => nodeRows(pkg, card), [pkg, card])
  const edges = useMemo(() => edgeRows(pkg, card, nodes), [pkg, card, nodes])
  const canvasGraph = useMemo(() => workflowCanvasGraph(nodes, edges), [nodes, edges])
  const dag = useMemo(
    () => workflowDagLayout(canvasGraph.nodes, canvasGraph.edges),
    [canvasGraph],
  )
  const dagMarkerId = `workflow-dag-arrow-${useId().replace(/:/g, '')}`
  const executableNodeCount = nodes.filter((node) => EXECUTABLE_NODE_TYPES.has(node.type)).length
  const immutable = card.provenanceKind === 'team'
  const invalid = executableNodeCount < 1

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
            <span>{nodes.length} 个节点</span>
          </div>
          {dag.nodes.length ? (
            <div className="wb-workflow-dag-scroll" role="region" aria-label="工作流编排预览" tabIndex={0}>
              <div className="wb-workflow-dag" data-testid="workflow-dag" style={{ height: dag.height }}>
                <svg viewBox={`0 0 1000 ${dag.height}`} preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <marker id={dagMarkerId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 0 L 6 3 L 0 6 Z" />
                    </marker>
                  </defs>
                  {dag.edges.map((edge) => {
                    const from = dag.nodes.find((node) => node.id === edge.from)
                    const to = dag.nodes.find((node) => node.id === edge.to)
                    if (!from || !to) return null
                    const startY = from.y + DAG_NODE_HEIGHT
                    const endY = to.y - 4
                    const midY = (startY + endY) / 2
                    return (
                      <g key={`${edge.from}->${edge.to}`}>
                        <path
                          className="wb-workflow-dag-edge"
                          data-testid="workflow-dag-edge"
                          d={`M ${from.x * 10} ${startY} C ${from.x * 10} ${midY}, ${to.x * 10} ${midY}, ${to.x * 10} ${endY}`}
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
                    const midY = (from.y + DAG_NODE_HEIGHT + to.y - 4) / 2
                    return (
                      <span
                        key={`${edge.from}->${edge.to}`}
                        style={{ left: `${(from.x + to.x) / 2}%`, top: midY }}
                      >
                        {edge.label || '接着执行'}
                      </span>
                    )
                  })}
                </div>
                <ol className="wb-workflow-dag-nodes">
                  {dag.nodes.map((node, index) => (
                    <li
                      key={node.id}
                      className={`wb-workflow-dag-node is-${node.type}${node.boundary ? ` is-boundary is-${node.boundary}` : ''}`}
                      data-testid={node.boundary ? `workflow-canvas-${node.boundary}` : undefined}
                      style={{ left: `${node.x}%`, top: node.y, width: `${node.width}%` }}
                    >
                      <span className="wb-workflow-dag-symbol" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <strong>{node.name}</strong>
                        <span>
                          {node.boundary
                            ? node.role
                            : `${node.type === 'agent' ? '专家 Agent' : node.type}${node.role ? ` · ${node.role}` : ''}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
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
