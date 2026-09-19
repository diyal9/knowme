import { useEffect, useMemo, useRef, useState } from 'react'
import type { BrainClaim, BrainClaimStatus, BrainNode, BrainNodeKind } from '../../../shared/api'
import { useAppStore } from '../../app/store'

const KIND_LABEL: Record<BrainNodeKind, string> = {
  self: '你', person: '人物', project: '项目', goal: '目标', decision: '决策', preference: '偏好',
  problem: '问题', task: '任务', concept: '知识', source: '来源', collection: '知识库',
}
const PREDICATE_LABEL: Record<string, string> = {
  knows: '关联知识', contains: '包含资料', hasPreference: '偏好', pursues: '目标', worksOn: '参与项目',
  madeDecision: '重要决策', hasOpenProblem: '待解决问题', hasTask: '任务', relatesTo: '相关人物', canUse: '可用来源',
}
const PERSPECTIVES = [
  { id: 'self', label: '懂我', note: '偏好、目标与关系' },
  { id: 'work', label: '当前工作', note: '项目、任务与决策' },
  { id: 'knowledge', label: '知识版图', note: '本地认知与外挂入口' },
] as const
const FILTER_KINDS: BrainNodeKind[] = ['preference', 'goal', 'project', 'decision', 'task', 'problem', 'concept', 'collection']
const DENSITIES = [24, 42, 72, 100] as const

type BrainPerspective = typeof PERSPECTIVES[number]['id']
type GraphPresentation = 'constellation' | 'categories'
type VisualTier = 'root' | 'topic' | 'item' | 'external'
type VisualNode = {
  id: string
  label: string
  kind: BrainNodeKind | 'topic' | 'brain'
  tier: VisualTier
  brainNode?: BrainNode
  memberIds?: string[]
  count?: number
  clusterId?: string
  status?: BrainClaimStatus
}
type VisualEdge = { id: string; from: string; to: string; status: BrainClaimStatus; synthetic?: boolean; flow?: 'spoke' }
type TopicCluster = { id: string; label: string; members: BrainNode[] }
type VisualGraph = { nodes: VisualNode[]; edges: VisualEdge[]; rootId: string; hiddenCount: number; activeTopic?: TopicCluster }

const RADIAL_CENTER = { x: 500, y: 340 }
const RADIAL_RADIUS = 240
const RADIAL_TOPIC_SIZE = { width: 144, height: 56 }
const RADIAL_BRAIN_SIZE = { width: 192, height: 88 }

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash)
}

function stableAngle(id: string, index: number, count: number) {
  return ((index + (stableHash(id) % 19) / 29) / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2
}

function cleanTopic(raw: string) {
  const value = raw.replace(/\.[a-z0-9]+$/i, '').replace(/^\d+[._-]*/, '').replace(/[_-]+/g, ' ').trim()
  const aliases: Array<[RegExp, string]> = [
    [/architecture|架构/i, '架构设计'], [/agent/i, 'Agent 系统'], [/product|产品/i, '产品与体验'],
    [/knowledge|wiki|知识/i, '知识管理'], [/workflow|流程/i, '工作流'], [/eval|测试|quality/i, '评测与质量'],
    [/game|游戏/i, '游戏研发'], [/research|研究/i, '研究资料'], [/project|项目/i, '项目资料'],
    [/standard|convention|规范/i, '工程规范'], [/memory|记忆/i, '记忆与成长'],
  ]
  return aliases.find(([pattern]) => pattern.test(value))?.[1] || value || '其他知识'
}

function topicForNode(node: BrainNode) {
  const reference = String(node.sourceRef || node.id.replace(/^c:/, '')).replace(/\\/g, '/')
  const parts = reference.split('/').filter(Boolean)
  const rawIndex = parts.findIndex((part) => part.toLowerCase() === 'raw')
  const candidate = rawIndex >= 0 ? parts[rawIndex + 1] : parts.length > 1 ? parts[0] : node.tags?.[0] || '其他知识'
  return cleanTopic(candidate || '其他知识')
}

function topicId(label: string) {
  return `topic:${stableHash(label).toString(36)}`
}

function isTaxonomyNode(node: BrainNode) {
  return node.tags?.includes('brain-taxonomy') === true
}

function buildTopicClusters(nodes: BrainNode[]) {
  const taxonomy = nodes
    .filter((node) => node.kind === 'concept' && node.tags?.includes('brain-taxonomy-category'))
    .sort((a, b) => {
      const order = (node: BrainNode) => Number(node.tags?.find((tag) => tag.startsWith('taxonomy-order:'))?.split(':')[1] || 0)
      return order(a) - order(b)
    })
  const learned = nodes.filter((node) => node.kind === 'concept' && node.external !== true && !isTaxonomyNode(node))
  if (taxonomy.length) {
    const clusters = taxonomy.map((node) => ({ id: node.id, label: node.label, members: [] as BrainNode[], taxonomy: node }))
    for (const node of learned) {
      const explicit = node.tags?.find((tag) => tag.startsWith('taxonomy:'))
      let target = explicit ? clusters.find((cluster) => cluster.taxonomy.tags?.includes(explicit)) : undefined
      if (!target) {
        const haystack = [node.label, node.summary, node.sourceRef, ...(node.tags || [])].filter(Boolean).join(' ').toLowerCase()
        const ranked = clusters.map((cluster) => ({
          cluster,
          score: (cluster.taxonomy.tags || []).filter((tag) => tag.startsWith('taxonomy-keyword:') && haystack.includes(tag.slice('taxonomy-keyword:'.length).toLowerCase())).length,
        })).sort((a, b) => b.score - a.score)
        target = ranked[0]?.score ? ranked[0].cluster : clusters.find((cluster) => cluster.taxonomy.tags?.includes('taxonomy-catchall'))
      }
      target?.members.push(node)
    }
    return clusters.map(({ taxonomy: _taxonomy, ...cluster }) => ({
      ...cluster,
      members: cluster.members.sort((a, b) => (b.authority || 0) - (a.authority || 0) || a.label.localeCompare(b.label, 'zh-CN')),
    }))
  }
  const groups = new Map<string, BrainNode[]>()
  for (const node of learned) {
    const label = topicForNode(node)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)?.push(node)
  }
  const sorted = [...groups.entries()]
    .map(([label, members]) => ({ id: topicId(label), label, members: members.sort((a, b) => (b.authority || 0) - (a.authority || 0) || a.label.localeCompare(b.label, 'zh-CN')) }))
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label, 'zh-CN'))
  if (sorted.length <= 8) return sorted
  const visible = sorted.slice(0, 7)
  const rest = sorted.slice(7).flatMap((item) => item.members)
  return [...visible, { id: topicId('其他知识'), label: '其他知识', members: rest }]
}

function statusForNode(node: BrainNode, claims: BrainClaim[]) {
  const statuses = claims.filter((claim) => claim.subjectId === node.id || claim.objectNodeId === node.id).map((claim) => claim.status)
  if (statuses.includes('confirmed')) return 'confirmed'
  if (statuses.includes('inferred')) return 'inferred'
  if (statuses.includes('observed')) return 'observed'
  return statuses[0] || 'confirmed'
}

function buildVisualGraph(input: {
  allNodes: BrainNode[]
  allClaims: BrainClaim[]
  perspective: BrainPerspective
  density: number
  presentation: GraphPresentation
  activeTopicId: string | null
  kinds: BrainNodeKind[]
  statuses: BrainClaimStatus[]
}): VisualGraph {
  const { allClaims, perspective, activeTopicId, presentation } = input
  const density = presentation === 'categories' && perspective === 'knowledge' && !activeTopicId ? Math.max(100, input.density) : input.density
  const kinds = new Set(input.kinds)
  const statuses = new Set(input.statuses)
  const allowedNodes = input.allNodes.filter((node) => !kinds.size || node.kind === 'self' || kinds.has(node.kind))
  const allowedClaims = allClaims.filter((claim) => !statuses.size || statuses.has(claim.status))
  const clusters = buildTopicClusters(allowedNodes)
  const visualNodes: VisualNode[] = []
  const visualEdges: VisualEdge[] = []
  const addNode = (node: VisualNode) => { if (!visualNodes.some((item) => item.id === node.id)) visualNodes.push(node) }
  const addActual = (node: BrainNode, tier: VisualTier = 'item', clusterId?: string) => addNode({ id: node.id, label: node.label, kind: node.kind, tier, brainNode: node, clusterId, status: statusForNode(node, allowedClaims) })
  const connectActual = () => {
    const ids = new Set(visualNodes.map((node) => node.id))
    for (const claim of allowedClaims) {
      if (!claim.objectNodeId || !ids.has(claim.subjectId) || !ids.has(claim.objectNodeId)) continue
      if (perspective === 'knowledge' && claim.predicate === 'contains' && visualNodes.some((node) => node.clusterId && node.id === claim.objectNodeId)) continue
      visualEdges.push({ id: claim.id, from: claim.subjectId, to: claim.objectNodeId, status: claim.status })
    }
  }

  if (perspective === 'knowledge') {
    const active = clusters.find((cluster) => cluster.id === activeTopicId)
    if (active) {
      addNode({ id: active.id, label: active.label, kind: 'topic', tier: 'root', count: active.members.length, memberIds: active.members.map((item) => item.id) })
      for (const node of active.members.slice(0, density)) {
        addActual(node, 'item', active.id)
        visualEdges.push({ id: `${active.id}:${node.id}`, from: active.id, to: node.id, status: 'confirmed', synthetic: true })
      }
      return { nodes: visualNodes, edges: visualEdges, rootId: active.id, hiddenCount: Math.max(0, active.members.length - density), activeTopic: active }
    }

    const localCognition = allowedNodes.filter((node) => !node.external && !isTaxonomyNode(node) && node.kind !== 'source' && node.kind !== 'collection')
    addNode({ id: 'brain:knowledge', label: 'Brain', kind: 'brain', tier: 'root', count: localCognition.length })
    const shownClusters = clusters.slice(0, 8)
    if (presentation === 'categories') {
      for (const cluster of shownClusters) {
        addNode({ id: cluster.id, label: cluster.label, kind: 'topic', tier: 'topic', count: cluster.members.length, memberIds: cluster.members.map((item) => item.id) })
        visualEdges.push({ id: `brain:${cluster.id}`, from: 'brain:knowledge', to: cluster.id, status: 'confirmed', synthetic: true, flow: 'spoke' })
      }
      return { nodes: visualNodes, edges: visualEdges, rootId: 'brain:knowledge', hiddenCount: localCognition.length }
    }
    const memberBudget = Math.max(2, Math.floor((density - shownClusters.length - 1) / Math.max(1, shownClusters.length)))
    for (const cluster of shownClusters) {
      addNode({ id: cluster.id, label: cluster.label, kind: 'topic', tier: 'topic', count: cluster.members.length, memberIds: cluster.members.map((item) => item.id) })
      visualEdges.push({ id: `brain:${cluster.id}`, from: 'brain:knowledge', to: cluster.id, status: 'confirmed', synthetic: true })
      for (const node of cluster.members.slice(0, memberBudget)) {
        addActual(node, 'item', cluster.id)
        visualEdges.push({ id: `${cluster.id}:${node.id}`, from: cluster.id, to: node.id, status: statusForNode(node, allowedClaims), synthetic: true })
      }
    }
    connectActual()
    const shownActual = visualNodes.filter((node) => node.brainNode).length
    return { nodes: visualNodes, edges: visualEdges, rootId: 'brain:knowledge', hiddenCount: Math.max(0, localCognition.length - shownActual) }
  }

  const self = allowedNodes.find((node) => node.id === 'self:me') || allowedNodes.find((node) => node.kind === 'self')
  const workKinds = new Set<BrainNodeKind>(['project', 'goal', 'decision', 'task', 'problem'])
  const selfKinds = new Set<BrainNodeKind>(['self', 'person', 'project', 'goal', 'decision', 'preference', 'problem', 'task'])
  const relevant = allowedNodes.filter((node) => (perspective === 'work' ? workKinds : selfKinds).has(node.kind))
  const root = perspective === 'work' ? relevant.find((node) => node.kind === 'project') || self : self
  if (root) addActual(root, 'root')
  for (const node of relevant.filter((item) => item.id !== root?.id).slice(0, Math.min(22, density))) addActual(node)
  connectActual()

  if ((!kinds.size || kinds.has('concept')) && visualNodes.length < 12) {
    for (const cluster of clusters.slice(0, perspective === 'work' ? 4 : 6)) {
      addNode({ id: cluster.id, label: cluster.label, kind: 'topic', tier: 'topic', count: cluster.members.length, memberIds: cluster.members.map((item) => item.id), status: 'inferred' })
      if (root) visualEdges.push({ id: `${root.id}:${cluster.id}`, from: root.id, to: cluster.id, status: 'inferred', synthetic: true })
    }
  }
  const shownActual = visualNodes.filter((node) => node.brainNode).length
  return { nodes: visualNodes, edges: visualEdges, rootId: root?.id || visualNodes[0]?.id || '', hiddenCount: Math.max(0, allowedNodes.length - shownActual) }
}

function layoutVisualGraph(graph: VisualGraph, presentation: GraphPresentation) {
  const positions = new Map<string, { x: number; y: number }>()
  const center = RADIAL_CENTER
  positions.set(graph.rootId, center)
  const topics = graph.nodes.filter((node) => node.tier === 'topic')
  if (presentation === 'categories' && !graph.activeTopic && topics.length) {
    topics.forEach((node, index) => {
      const angle = (index / topics.length) * Math.PI * 2 - Math.PI / 2
      positions.set(node.id, {
        x: Math.round((center.x + Math.cos(angle) * RADIAL_RADIUS) / 4) * 4,
        y: Math.round((center.y + Math.sin(angle) * RADIAL_RADIUS) / 4) * 4,
      })
    })
    return positions
  }
  topics.forEach((node, index) => {
    const angle = stableAngle(node.id, index, topics.length)
    positions.set(node.id, { x: center.x + Math.cos(angle) * 260, y: center.y + Math.sin(angle) * 190 })
  })
  const externals = graph.nodes.filter((node) => node.tier === 'external')
  externals.forEach((node, index) => positions.set(node.id, { x: 874, y: 120 + index * Math.min(92, 470 / Math.max(1, externals.length)) }))

  const loose = graph.nodes.filter((node) => node.tier === 'item' && !node.clusterId)
  loose.forEach((node, index) => {
    const angle = stableAngle(node.id, index, loose.length)
    const ring = index % 2 === 0 ? 178 : 245
    positions.set(node.id, { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring * .72 })
  })

  const clustered = new Map<string, VisualNode[]>()
  for (const node of graph.nodes.filter((item) => item.tier === 'item' && item.clusterId)) {
    if (!clustered.has(node.clusterId || '')) clustered.set(node.clusterId || '', [])
    clustered.get(node.clusterId || '')?.push(node)
  }
  for (const [clusterId, members] of clustered) {
    const clusterPoint = positions.get(clusterId) || center
    members.forEach((node, index) => {
      const angle = stableAngle(node.id, index, members.length)
      const ring = graph.activeTopic ? 92 + Math.floor(index / 12) * 72 : 46 + Math.floor(index / 8) * 26
      positions.set(node.id, { x: clusterPoint.x + Math.cos(angle) * ring, y: clusterPoint.y + Math.sin(angle) * ring * .74 })
    })
  }
  return positions
}

function nodeRadius(node: VisualNode) {
  if (node.tier === 'root') return node.kind === 'self' ? 12 : 9
  if (node.kind === 'topic') return Math.min(13, 6 + Math.sqrt(node.count || 1) * .5)
  if (node.tier === 'external') return 7
  return Math.min(6, 3.2 + (node.brainNode?.authority || 1) * .42)
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }, id: string) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const bend = ((stableHash(id) % 17) - 8) * 1.4
  const middleX = (from.x + to.x) / 2 - (dy / length) * bend
  const middleY = (from.y + to.y) / 2 + (dx / length) * bend
  return `M ${from.x} ${from.y} Q ${middleX} ${middleY} ${to.x} ${to.y}`
}

function rectangleEdgeDistance(direction: { x: number; y: number }, size: { width: number; height: number }) {
  const horizontal = Math.abs(direction.x) > .0001 ? size.width / 2 / Math.abs(direction.x) : Number.POSITIVE_INFINITY
  const vertical = Math.abs(direction.y) > .0001 ? size.height / 2 / Math.abs(direction.y) : Number.POSITIVE_INFINITY
  return Math.min(horizontal, vertical)
}

function radialSpokePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const direction = { x: dx / length, y: dy / length }
  const startDistance = rectangleEdgeDistance(direction, RADIAL_BRAIN_SIZE)
  const endDistance = rectangleEdgeDistance(direction, RADIAL_TOPIC_SIZE)
  const start = { x: from.x + direction.x * startDistance, y: from.y + direction.y * startDistance }
  const end = { x: to.x - direction.x * endDistance, y: to.y - direction.y * endDistance }
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function BrainCanvas({ graph, selectedId, selectedPair, highlightedClaimIds, highlightedNodeIds, persistedPositions, onSavePositions, relationMode, onToggleRelationMode, relationSummary, onSelect, onClearSelection, onOpenTopic, onCloseTopic, density, onDensityChange, presentation, filtersOpen, inspectorOpen, onToggleFilters, onToggleInspector }: {
  graph: VisualGraph
  selectedId: string | null
  selectedPair: string[]
  highlightedClaimIds: string[]
  highlightedNodeIds: string[]
  persistedPositions: Record<string, { x: number; y: number }>
  onSavePositions: (positions: Record<string, { x: number; y: number }>) => void
  relationMode: boolean
  onToggleRelationMode: () => void
  relationSummary: string
  onSelect: (node: VisualNode) => void
  onClearSelection: () => void
  onOpenTopic: (node: VisualNode) => void
  onCloseTopic: () => void
  density: number
  onDensityChange: () => void
  presentation: GraphPresentation
  filtersOpen: boolean
  inspectorOpen: boolean
  onToggleFilters: () => void
  onToggleInspector: () => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ zoom: 1, x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const nodeDragRef = useRef<{ id: string; x: number; y: number; pointX: number; pointY: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const radialOverview = presentation === 'categories' && !graph.activeTopic
  const basePositions = useMemo(() => layoutVisualGraph(graph, presentation), [graph, presentation])
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({})
  useEffect(() => {
    if (radialOverview) {
      setPositionOverrides({})
      return
    }
    const ids = new Set(graph.nodes.map((node) => node.id))
    setPositionOverrides(Object.fromEntries(Object.entries(persistedPositions || {}).filter(([id]) => ids.has(id))))
  }, [graph.nodes, persistedPositions, radialOverview])
  const positions = useMemo(() => {
    const next = new Map(basePositions)
    if (!radialOverview) for (const [id, point] of Object.entries(positionOverrides)) next.set(id, point)
    return next
  }, [basePositions, positionOverrides, radialOverview])
  const topics = graph.nodes.filter((node) => node.tier === 'topic')
  const communityIndex = (node: VisualNode) => topics.findIndex((topic) => topic.id === node.id || topic.id === node.clusterId)
  const communities = useMemo(() => presentation === 'categories' && !graph.activeTopic && graph.nodes.some((node) => node.tier === 'item') ? topics.map((topic, index) => {
    const center = positions.get(topic.id) || { x: 500, y: 340 }
    const members = graph.nodes.filter((node) => node.clusterId === topic.id)
    const radius = Math.max(62, ...members.map((node) => {
      const point = positions.get(node.id) || center
      return Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2) + 19
    }))
    return { topic, index, center, radius }
  }) : [], [graph, positions, presentation, topics])
  const resetViewport = () => setViewport({ zoom: 1, x: 0, y: 0 })

  return <section className={`brain-canvas-shell presentation-${presentation}`} aria-label="Brain 关系图">
    <div className="brain-canvas-context">
      {graph.activeTopic ? <button type="button" onClick={onCloseTopic}>Brain <span>/</span> 知识版图 <span>/</span> <strong>{graph.activeTopic.label}</strong></button> : <span>{presentation === 'categories' ? '领域归类' : '本地关系图'}</span>}
      <small>{graph.nodes.length} 个可见节点{graph.hiddenCount ? ` · ${graph.hiddenCount} 个已收起` : ''}</small>
    </div>
    <div className="brain-canvas-tools" aria-label="图谱控制">
      <button type="button" onClick={() => setViewport((value) => ({ ...value, zoom: Math.min(1.8, value.zoom + .15) }))} aria-label="放大">＋</button>
      <button type="button" onClick={resetViewport} aria-label="适应画布">{Math.round(viewport.zoom * 100)}%</button>
      <button type="button" onClick={() => setViewport((value) => ({ ...value, zoom: Math.max(.55, value.zoom - .15) }))} aria-label="缩小">－</button>
      <button type="button" className="density" onClick={onDensityChange} aria-label={`图谱密度 ${density}`} title={`密度 ${density}`}>···</button>
      <button type="button" className={`relation-toggle${relationMode ? ' active' : ''}`} onClick={onToggleRelationMode} aria-label="关系链" aria-pressed={relationMode} title="关系链">⌁</button>
    </div>
    {relationMode ? <div className="brain-relation-mode" role="status"><strong>{selectedPair.length < 2 ? `选择第 ${selectedPair.length + 1} 个节点` : '关系链已找到'}</strong><span>{relationSummary || '依次选择两个本地节点，查看它们之间有证据的最短关系链。'}</span></div> : null}
    <svg
      className="brain-canvas"
      viewBox="0 0 1000 680"
      role="img"
      aria-labelledby="brain-graph-title brain-graph-desc"
      onClick={(event) => { if (event.target === event.currentTarget) onClearSelection() }}
      onWheel={(event) => {
        event.preventDefault()
        const factor = event.deltaY > 0 ? -.08 : .08
        setViewport((value) => ({ ...value, zoom: Math.max(.55, Math.min(1.8, value.zoom + factor)) }))
      }}
      onPointerDown={(event) => {
        dragRef.current = { x: event.clientX, y: event.clientY, panX: viewport.x, panY: viewport.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (nodeDragRef.current) {
          const bounds = event.currentTarget.getBoundingClientRect()
          const dx = (event.clientX - nodeDragRef.current.x) * (1000 / Math.max(1, bounds.width)) / viewport.zoom
          const dy = (event.clientY - nodeDragRef.current.y) * (680 / Math.max(1, bounds.height)) / viewport.zoom
          if (Math.abs(dx) + Math.abs(dy) > 2) nodeDragRef.current.moved = true
          setPositionOverrides((current) => ({
            ...current,
            [nodeDragRef.current!.id]: { x: nodeDragRef.current!.pointX + dx, y: nodeDragRef.current!.pointY + dy },
          }))
          return
        }
        if (!dragRef.current) return
        setViewport((value) => ({ ...value, x: dragRef.current!.panX + event.clientX - dragRef.current!.x, y: dragRef.current!.panY + event.clientY - dragRef.current!.y }))
      }}
      onPointerUp={() => {
        if (nodeDragRef.current) {
          const finalPositions = Object.fromEntries(positions)
          suppressClickRef.current = nodeDragRef.current.moved
          if (nodeDragRef.current.moved) onSavePositions(finalPositions)
          nodeDragRef.current = null
        }
        dragRef.current = null
      }}
      onPointerCancel={() => { dragRef.current = null; nodeDragRef.current = null }}
    >
      <title id="brain-graph-title">KnowMe Brain 本地知识图谱</title>
      <desc id="brain-graph-desc">以 Brain 为中心展示本地确认认知及岗位知识分类；双击分类可以查看主题中的具体知识。</desc>
      <defs>
        <filter id="brain-node-glow" x="-300%" y="-300%" width="600%" height="600%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <g transform={`translate(${viewport.x} ${viewport.y}) translate(${500 * (1 - viewport.zoom)} ${340 * (1 - viewport.zoom)}) scale(${viewport.zoom})`}>
        {radialOverview ? <circle className="brain-radial-orbit" cx={RADIAL_CENTER.x} cy={RADIAL_CENTER.y} r={RADIAL_RADIUS} /> : null}
        {communities.map(({ topic, index, center, radius }) => <g className={`brain-community community-${index % 8}`} key={`community:${topic.id}`}>
          <circle className="brain-community-hull" cx={center.x} cy={center.y} r={radius} />
          <text className="brain-community-title" x={center.x} y={center.y - radius + 18}>{topic.label}</text>
          <text className="brain-community-count" x={center.x} y={center.y - radius + 34}>{topic.count || 0} 项</text>
        </g>)}
        {graph.edges.map((edge) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) return null
          const edgeNode = graph.nodes.find((node) => node.id === edge.to) || graph.nodes.find((node) => node.id === edge.from)
          const edgeCommunity = edgeNode ? Math.max(0, communityIndex(edgeNode)) % 8 : 0
          const pathActive = highlightedClaimIds.includes(edge.id)
          const active = pathActive || selectedId === edge.from || selectedId === edge.to || hoveredId === edge.from || hoveredId === edge.to
          const dimmed = (!!selectedId || highlightedClaimIds.length > 0) && !active
          const path = radialOverview && edge.flow === 'spoke' ? radialSpokePath(from, to) : edgePath(from, to, edge.id)
          return <path key={edge.id} className={`brain-edge community-${edgeCommunity} ${edge.status}${edge.synthetic ? ' synthetic' : ''}${edge.flow ? ` flow-${edge.flow}` : ''}${active ? ' active' : ''}${pathActive ? ' path-active' : ''}${dimmed ? ' dimmed' : ''}`} d={path} />
        })}
        {graph.nodes.map((node) => {
          const point = positions.get(node.id) || { x: 500, y: 340 }
          const selected = node.id === selectedId || selectedPair.includes(node.id)
          const pathActive = highlightedNodeIds.includes(node.id)
          const hovered = node.id === hoveredId
          const radius = nodeRadius(node)
          const showLabel = node.tier === 'root' || (node.kind === 'topic' && presentation !== 'categories') || node.tier === 'external' || selected || hovered || graph.nodes.length <= 14
          const dimmed = (!!selectedId || highlightedNodeIds.length > 0) && !selected && !pathActive && !graph.edges.some((edge) => (edge.from === selectedId && edge.to === node.id) || (edge.to === selectedId && edge.from === node.id))
          const kind = node.kind === 'topic' || node.kind === 'brain' ? node.kind : `kind-${node.kind}`
          const aria = node.kind === 'topic' ? `主题：${node.label}，${node.count || 0} 项` : node.kind === 'brain' ? 'Brain 知识版图' : `${KIND_LABEL[node.kind]}：${node.label}`
          return <g
            key={node.id}
            className={`brain-node ${kind} tier-${node.tier} community-${Math.max(0, communityIndex(node)) % 8}${selected ? ' selected' : ''}${pathActive ? ' path-active' : ''}${hovered ? ' hovered' : ''}${dimmed ? ' dimmed' : ''}${node.brainNode?.external ? ' external' : ''}${node.brainNode?.stale ? ' stale' : ''}`}
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex={0}
            aria-label={aria}
            onPointerDown={(event) => {
              event.stopPropagation()
              if (radialOverview) return
              const current = positions.get(node.id) || point
              nodeDragRef.current = { id: node.id, x: event.clientX, y: event.clientY, pointX: current.x, pointY: current.y, moved: false }
              event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
            }}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(event) => {
              event.stopPropagation()
              if (suppressClickRef.current) { suppressClickRef.current = false; return }
              if (radialOverview && node.kind === 'topic') return
              onSelect(node)
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              onOpenTopic(node)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpenTopic(node)
              if (event.key === ' ') { event.preventDefault(); onSelect(node) }
            }}
          >
            {radialOverview && (node.kind === 'topic' || node.kind === 'brain') ? <>
              <rect className="brain-radial-hit" x={node.kind === 'brain' ? -100 : -76} y={node.kind === 'brain' ? -48 : -32} width={node.kind === 'brain' ? 200 : 152} height={node.kind === 'brain' ? 96 : 64} rx={8} />
              <rect className="brain-radial-card" x={node.kind === 'brain' ? -96 : -72} y={node.kind === 'brain' ? -44 : -28} width={node.kind === 'brain' ? 192 : 144} height={node.kind === 'brain' ? 88 : 56} rx={node.kind === 'brain' ? 8 : 6} />
              <text className="brain-radial-label" x="0" y={node.kind === 'brain' ? -4 : -3}>{node.kind === 'brain' ? 'Brain' : node.label.slice(0, 16)}</text>
              <text className="brain-radial-meta" x="0" y={node.kind === 'brain' ? 20 : 17}>{node.kind === 'brain' ? `${node.count || 0} 项确认认知` : `${node.count || 0} 项`}</text>
            </> : <>
              <circle className="brain-node-hit" r={Math.max(12, radius + 8)} />
              {(selected || hovered) ? <circle className="brain-node-glow" r={radius + 8} /> : null}
              <circle className="brain-node-core" r={radius} />
              {node.brainNode?.external ? <circle className="brain-node-orbit" r={radius + 6} /> : null}
              {showLabel ? <text className="brain-node-label" x={radius + 8} y={4}>{node.label.slice(0, 28)}{node.kind === 'topic' ? `  ${node.count}` : ''}</text> : null}
            </>}
            <title>{node.label}</title>
          </g>
        })}
      </g>
    </svg>
    <div className="brain-canvas-hint">{radialOverview ? '滚轮缩放 · 拖动画布 · 双击进入主题' : '滚轮缩放 · 拖动画布或节点 · 双击进入主题'}</div>
    {!radialOverview ? <div className="brain-canvas-legend"><span className="confirmed">已确认</span><span className="inferred">仍在推测</span><span className="external">外挂知识入口</span></div> : null}
  </section>
}

function BrainRailIcon({ name }: { name: 'self' | 'work' | 'knowledge' | 'filter' | 'detail' | 'review' }) {
  const paths: Record<typeof name, React.ReactNode> = {
    self: <><circle cx="12" cy="8" r="3" /><path d="M6.5 19c.8-3.6 2.6-5.4 5.5-5.4s4.7 1.8 5.5 5.4" /></>,
    work: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16" /></>,
    knowledge: <><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="18" cy="17" r="2.4" /><path d="m8.3 11 7.3-3M8.3 13l7.3 3" /></>,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    detail: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>,
    review: <><path d="M6 4h12v16H6z" /><path d="m9 12 2 2 4-5" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function BrainInspector({ visualNode, clusters, onOpenTopic, onClose }: { visualNode: VisualNode | null; clusters: TopicCluster[]; onOpenTopic: (node: VisualNode) => void; onClose: () => void }) {
  const snapshot = useAppStore((s) => s.brainSnapshot)
  const queryHits = useAppStore((s) => s.brainQueryResult)
  const forget = useAppStore((s) => s.forgetBrainNode)
  const sync = useAppStore((s) => s.syncBrainProvider)
  const node = visualNode?.brainNode || null
  const close = <button type="button" className="brain-inspector-close" onClick={onClose} aria-label="关闭详情">×</button>

  if (visualNode?.kind === 'brain') {
    const knowledgeCount = clusters.reduce((sum, cluster) => sum + cluster.members.length, 0)
    return <aside className="brain-inspector brain-topic-inspector">
      {close}
      <div className="brain-inspector-eyebrow">知识版图</div>
      <h2>本地 Brain</h2>
      <p>确认后的本地认知按主题形成知识簇；外挂知识库只显示为外围入口。</p>
      <div className="brain-topic-count"><strong>{knowledgeCount}</strong><span>项本地认知 · {clusters.length} 个主题</span></div>
      <section className="brain-inspector-section">
        <h3>主要知识主题</h3>
        {clusters.slice(0, 7).map((cluster) => <button type="button" className="brain-topic-member interactive" key={cluster.id} onClick={() => onOpenTopic({ id: cluster.id, label: cluster.label, kind: 'topic', tier: 'topic', count: cluster.members.length, memberIds: cluster.members.map((item) => item.id) })}><i /><span>{cluster.label}</span><small>{cluster.members.length}</small></button>)}
      </section>
    </aside>
  }

  if (visualNode?.kind === 'topic') {
    const cluster = clusters.find((item) => item.id === visualNode.id)
    const members = cluster?.members || []
    return <aside className="brain-inspector brain-topic-inspector">
      {close}
      <div className="brain-inspector-eyebrow">知识主题</div>
      <h2>{visualNode.label}</h2>
      <p>Brain 根据已确认的本地认知形成的稳定主题，不包含外挂知识库正文。</p>
      <div className="brain-topic-count"><strong>{visualNode.count || members.length}</strong><span>项本地认知</span></div>
      <section className="brain-inspector-section">
        <h3>主题中的资料</h3>
        {members.slice(0, 7).map((member) => <div className="brain-topic-member" key={member.id}><i /><span>{member.label}</span></div>)}
      </section>
      <button type="button" className="brain-topic-open" onClick={() => onOpenTopic(visualNode)}>进入这个主题</button>
    </aside>
  }

  if (!node) return <aside className="brain-inspector">{close}<div className="brain-inspector-empty"><strong>选择一个节点</strong><span>查看它与其他理解的关系、来源和可信程度。</span></div></aside>
  const claims = (snapshot?.claims || []).filter((item) => item.subjectId === node.id || item.objectNodeId === node.id)
  const evidenceIds = new Set(claims.flatMap((item) => item.evidenceRefs || []))
  const evidence = (snapshot?.evidence || []).filter((item) => evidenceIds.has(item.id))
  const provider = snapshot?.providers?.find((item) => item.id === node.providerId)
  const collection = provider?.collections?.find((item) => item.id === node.collectionId)
  const recentQuery = provider?.recentQueries?.[0]
  const relatedHit = queryHits.find((item) => item.nodeId === node.id || item.providerId === node.providerId)
  const relationGroups = [...claims.reduce((groups, claim) => {
    const key = claim.predicate || 'related'
    const current = groups.get(key) || { predicate: key, claims: [] as BrainClaim[] }
    current.claims.push(claim)
    groups.set(key, current)
    return groups
  }, new Map<string, { predicate: string; claims: BrainClaim[] }>()).values()]

  return <aside className="brain-inspector">
    {close}
    <div className="brain-inspector-eyebrow">{KIND_LABEL[node.kind]} · {node.scope === 'project' ? '当前项目' : node.scope === 'organization' ? '组织范围' : '全局'}</div>
    <h2>{node.label}</h2>
    <p>{node.summary || '这项理解尚没有补充说明。'}</p>
    <div className="brain-inspector-metrics">
      <div><strong>{claims.length}</strong><span>相关关系</span></div>
      <div><strong>{evidence.length}</strong><span>来源证据</span></div>
      <div><strong>{Math.round((node.authority || 0) * 20)}%</strong><span>权威度</span></div>
    </div>
    {node.kind === 'collection' || node.kind === 'source' ? <section className="brain-inspector-section external">
      <h3>外挂知识入口</h3>
      <dl>
        <div><dt>Provider</dt><dd>{provider?.displayName || node.providerId || '本地'}</dd></div>
        <div><dt>连接状态</dt><dd>{provider?.health || '按需检查'}</dd></div>
        <div><dt>资料规模</dt><dd>{collection?.documentCount == null ? '按需读取' : `${collection.documentCount} 份文档`}</dd></div>
        <div><dt>覆盖主题</dt><dd>{collection?.topics?.join('、') || collection?.tags?.join('、') || '尚未建立主题锚点'}</dd></div>
        <div><dt>最近使用</dt><dd>{relatedHit ? '本次搜索已命中' : recentQuery ? `${recentQuery.hitCount || 0} 条命中 · ${recentQuery.status === 'ok' ? '查询正常' : '查询失败'}` : '暂无查询'}</dd></div>
      </dl>
      <p className="brain-boundary-note">仅在查询时读取，不会将整库正文、切片或向量导入 Brain。</p>
      {node.providerId && node.kind === 'source' ? <button type="button" className="knowledge-btn" onClick={() => void sync(node.providerId || '')}>刷新知识库入口</button> : null}
    </section> : null}
    <section className="brain-inspector-section">
      <h3>为什么这样理解</h3>
      {relationGroups.length ? relationGroups.slice(0, 6).map((group) => {
        const confirmed = group.claims.filter((claim) => claim.status === 'confirmed').length
        const confidence = Math.round(group.claims.reduce((sum, claim) => sum + (claim.confidence || 0), 0) / group.claims.length * 100)
        return <div className="brain-relation-row" key={group.predicate}>
          <span className={`brain-status-dot ${confirmed === group.claims.length ? 'confirmed' : 'inferred'}`} />
          <div><strong>{PREDICATE_LABEL[group.predicate] || group.predicate}</strong><small>{group.claims.length} 条关系 · {confirmed} 条已确认 · {confidence}%</small></div>
        </div>
      }) : <p className="brain-muted">暂时只有资料锚点，还没有稳定关系。</p>}
    </section>
    {evidence.length ? <section className="brain-inspector-section"><h3>来源与证据</h3>{evidence.slice(0, 5).map((item) => <div className="brain-evidence" key={item.id}><strong>{item.title}</strong><span>{item.documentRef || item.type}</span></div>)}</section> : null}
    {node.id !== 'self:me' && !node.external ? <button type="button" className="brain-forget" onClick={() => { if (window.confirm('清除这项稳定理解？历史记录会保留，相关关系将失效。')) void forget(node.id) }}>修正或忘记这项理解</button> : null}
  </aside>
}

export function BrainGraphView() {
  const perspective = useAppStore((s) => s.brainPerspective)
  const setPerspective = useAppStore((s) => s.setBrainPerspective)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const snapshot = useAppStore((s) => s.brainSnapshot)
  const visibleNodes = useAppStore((s) => s.brainVisibleNodes)
  const visibleClaims = useAppStore((s) => s.brainVisibleClaims)
  const selectedNodeId = useAppStore((s) => s.brainSelectedNodeId)
  const filters = useAppStore((s) => s.brainFilters)
  const setFilters = useAppStore((s) => s.setBrainFilters)
  const query = useAppStore((s) => s.knowledgeQuery)
  const setQuery = useAppStore((s) => s.setKnowledgeQuery)
  const runQuery = useAppStore((s) => s.queryBrain)
  const searching = useAppStore((s) => s.knowledgeSearching)
  const error = useAppStore((s) => s.brainError)
  const proposals = useAppStore((s) => s.brainProposals)
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const hits = useAppStore((s) => s.brainQueryResult)
  const select = useAppStore((s) => s.selectBrainNode)
  const focus = useAppStore((s) => s.focusBrainNode)
  const saveReference = useAppStore((s) => s.saveBrainReference)
  const promote = useAppStore((s) => s.promoteBrainHit)
  const saveLayout = useAppStore((s) => s.saveBrainLayout)
  const findPath = useAppStore((s) => s.findBrainPath)
  const [density, setDensity] = useState<number>(100)
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null)
  const [relationMode, setRelationMode] = useState(false)
  const [relationNodeIds, setRelationNodeIds] = useState<string[]>([])
  const [highlightedClaimIds, setHighlightedClaimIds] = useState<string[]>([])
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([])
  const [relationSummary, setRelationSummary] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [projectScope, setProjectScope] = useState<'all' | 'current'>('all')
  const presentation: GraphPresentation = perspective === 'knowledge' && !activeTopicId ? 'categories' : 'constellation'

  const activeProject = projects.find((project) => project.id === activeProjectId) || null
  const sourceNodes = snapshot?.nodes || visibleNodes
  const sourceClaims = snapshot?.claims || visibleClaims
  const allNodes = projectScope === 'current' && activeProjectId
    ? sourceNodes.filter((node) => !node.projectId || node.projectId === activeProjectId)
    : sourceNodes
  const allClaims = projectScope === 'current' && activeProjectId
    ? sourceClaims.filter((claim) => !claim.projectId || claim.projectId === activeProjectId)
    : sourceClaims
  const cognitionCount = allNodes.filter((node) => !node.external && !isTaxonomyNode(node) && node.kind !== 'source' && node.kind !== 'collection').length
  const externalCollectionCount = allNodes.filter((node) => node.external && node.kind === 'collection').length
  const clusters = useMemo(() => buildTopicClusters(allNodes), [allNodes])
  const graph = useMemo(() => buildVisualGraph({ allNodes, allClaims, perspective, density, presentation, activeTopicId, kinds: filters.kinds, statuses: filters.statuses }), [activeTopicId, allClaims, allNodes, density, filters.kinds, filters.statuses, perspective, presentation])
  const selectedGraphNode = graph.nodes.find((node) => node.brainNode?.id === selectedNodeId)
  const selectedVisual = graph.nodes.find((node) => node.id === selectedVisualId)
    || selectedGraphNode
    || graph.nodes.find((node) => node.id === graph.rootId)
    || null
  const canvasSelectedId = selectedVisualId || selectedGraphNode?.id || null

  const toggleKind = (kind: BrainNodeKind) => setFilters({ kinds: filters.kinds.includes(kind) ? filters.kinds.filter((item) => item !== kind) : [...filters.kinds, kind] })
  const toggleStatus = (status: BrainClaimStatus) => setFilters({ statuses: filters.statuses.includes(status) ? filters.statuses.filter((item) => item !== status) : [...filters.statuses, status] })
  const choosePerspective = (next: BrainPerspective) => {
    setActiveTopicId(null)
    setSelectedVisualId(null)
    select(null)
    setPerspective(next)
  }
  const openVisual = (node: VisualNode) => {
    if (node.kind === 'topic') {
      setActiveTopicId(node.id)
      setSelectedVisualId(node.id)
      if (perspective !== 'knowledge') setPerspective('knowledge')
      return
    }
    if (node.brainNode) void focus(node.brainNode.id)
  }
  const selectVisual = (node: VisualNode) => {
    setSelectedVisualId(node.id)
    setInspectorOpen(true)
    select(node.brainNode?.id || null)
    if (!relationMode || !node.brainNode) {
      setRelationNodeIds([])
      setHighlightedClaimIds([])
      setHighlightedNodeIds([])
      setRelationSummary('')
      return
    }
    const next = relationNodeIds.length >= 2 || relationNodeIds.includes(node.brainNode.id)
      ? [node.brainNode.id]
      : [...relationNodeIds, node.brainNode.id]
    setRelationNodeIds(next)
    setHighlightedNodeIds(next)
    setHighlightedClaimIds([])
    setRelationSummary(next.length === 1 ? `${node.label} → 请选择另一个节点` : '正在查找有证据的关系链…')
    if (next.length === 2) void findPath(next[0], next[1]).then((result) => {
      if (result.ok === false) {
        setRelationSummary(result.error || '这两个节点之间还没有可解释的关系链')
        return
      }
      setHighlightedClaimIds(result.claimIds || [])
      setHighlightedNodeIds(result.nodeIds || next)
      setRelationSummary(result.explanation || '已显示最短关系链')
    })
  }
  const cycleDensity = () => setDensity((current) => DENSITIES[(DENSITIES.indexOf(current as typeof DENSITIES[number]) + 1) % DENSITIES.length])

  return <div className="brain-home obsidian-brain">
    <div className="brain-commandbar">
      <form onSubmit={(event) => { event.preventDefault(); void runQuery() }}>
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识、经历和关系…" aria-label="搜索 Brain" />
        <button type="submit" disabled={searching || !query.trim()}>{searching ? '搜索中' : '搜索'}</button>
      </form>
    </div>
    {hits.length ? <section className="brain-query-results" aria-label="Brain 搜索结果">
      <div className="brain-query-results-head"><strong>搜索结果</strong><span>{hits.length} 条 · 外挂命中仅供本轮使用</span></div>
      <div className="brain-query-results-list">{hits.slice(0, 6).map((hit) => <article key={`${hit.sourceKind}:${hit.ref}`}>
        <button type="button" className="brain-hit-main" onClick={() => {
          setHighlightedClaimIds(hit.relationPath || [])
          setHighlightedNodeIds(hit.relationNodes || (hit.nodeId ? [hit.nodeId] : []))
          setRelationSummary(hit.explanation || '')
          if (hit.nodeId) void focus(hit.nodeId)
        }}><strong>{hit.title}{hit.conflict ? <em>存在冲突</em> : null}</strong><span>{hit.snippet || hit.explanation}</span><small>{hit.sourceKind === 'brain' ? `${hit.claimStatus === 'confirmed' ? '已确认' : '尚待确认'} · ${hit.graphDistance == null ? '本地 Brain' : `${hit.graphDistance} 跳关系`}` : `${hit.providerId || hit.sourceKind}${hit.collectionId ? ` · ${hit.collectionId}` : ''}`}</small></button>
        {hit.persistence !== 'local' ? <div><button type="button" onClick={() => useAppStore.getState().showToast('已保留为本轮上下文，不会写入 Brain')}>仅本轮使用</button><button type="button" onClick={() => void saveReference(hit)}>收藏引用</button><button type="button" onClick={() => void promote(hit)}>沉淀到 Brain</button></div> : null}
      </article>)}</div>
    </section> : null}
    {error ? <div className="brain-error"><strong>Brain 暂不可用</strong><span>{error}。本地知识仍会保留，请稍后重试。</span></div> : null}
    <div className={`brain-layout compact-rail${inspectorOpen ? '' : ' inspector-collapsed'}`}>
      <aside className="brain-toolrail" aria-label="Brain 工具栏">
        {PERSPECTIVES.map((item) => <button key={item.id} type="button" className={perspective === item.id ? 'active' : ''} title={`${item.label}：${item.note}`} aria-label={`${item.label}：${item.note}`} onClick={() => choosePerspective(item.id)}><BrainRailIcon name={item.id} /></button>)}
        <span className="brain-toolrail-separator" />
        <button type="button" className={filtersOpen ? 'active' : ''} onClick={() => setFiltersOpen((current) => !current)} aria-pressed={filtersOpen} aria-label="筛选 Brain" title="筛选"><BrainRailIcon name="filter" /></button>
        <button type="button" className={inspectorOpen ? 'active' : ''} onClick={() => setInspectorOpen((current) => !current)} aria-pressed={inspectorOpen} aria-label="显示详情" title="详情"><BrainRailIcon name="detail" /></button>
        <button type="button" className="brain-review-tool" onClick={() => setPage('review')} aria-label={`待我确认：${proposals.filter((item) => item.status === 'pending').length} 条`} title="待我确认"><BrainRailIcon name="review" />{proposals.some((item) => item.status === 'pending') ? <em>{proposals.filter((item) => item.status === 'pending').length}</em> : null}</button>
        {filtersOpen ? <section className="brain-filter-popover" aria-label="Brain 筛选面板">
          <header><strong>筛选</strong><button type="button" onClick={() => setFiltersOpen(false)} aria-label="关闭筛选">×</button></header>
          {activeProject ? <><span>项目范围</span><div className="brain-chip-grid"><button type="button" className={projectScope === 'all' ? 'active' : ''} onClick={() => setProjectScope('all')}>全部 Brain</button><button type="button" className={projectScope === 'current' ? 'active' : ''} onClick={() => setProjectScope('current')}>{activeProject.name}</button></div></> : null}
          <span>显示内容</span>
          <div className="brain-chip-grid">{FILTER_KINDS.map((kind) => <button key={kind} type="button" className={filters.kinds.includes(kind) ? 'active' : ''} onClick={() => toggleKind(kind)}>{KIND_LABEL[kind]}</button>)}</div>
          <span>理解状态</span>
          <label><input type="checkbox" checked={filters.statuses.includes('confirmed')} onChange={() => toggleStatus('confirmed')} /> 已确认</label>
          <label><input type="checkbox" checked={filters.statuses.includes('inferred')} onChange={() => toggleStatus('inferred')} /> 尚在推测</label>
          <label><input type="checkbox" checked={filters.statuses.includes('observed')} onChange={() => toggleStatus('observed')} /> 近期观察</label>
        </section> : null}
      </aside>
      <BrainCanvas graph={graph} selectedId={canvasSelectedId} selectedPair={relationNodeIds} highlightedClaimIds={highlightedClaimIds} highlightedNodeIds={highlightedNodeIds} persistedPositions={snapshot?.layout?.positions || {}} onSavePositions={(positions) => void saveLayout(positions)} relationMode={relationMode} onToggleRelationMode={() => { setRelationMode((current) => !current); setRelationNodeIds([]); setHighlightedClaimIds([]); setHighlightedNodeIds([]); setRelationSummary('') }} relationSummary={relationSummary} onSelect={selectVisual} onClearSelection={() => { setSelectedVisualId(null); setInspectorOpen(false); select(null); setRelationNodeIds([]); setHighlightedClaimIds([]); setHighlightedNodeIds([]); setRelationSummary('') }} onOpenTopic={openVisual} onCloseTopic={() => { setActiveTopicId(null); setSelectedVisualId(null) }} density={density} onDensityChange={cycleDensity} presentation={presentation} filtersOpen={filtersOpen} inspectorOpen={inspectorOpen} onToggleFilters={() => setFiltersOpen((current) => !current)} onToggleInspector={() => setInspectorOpen((current) => !current)} />
      <BrainInspector visualNode={selectedVisual} clusters={clusters} onOpenTopic={openVisual} onClose={() => setInspectorOpen(false)} />
    </div>
    <footer className="brain-statusbar"><span>当前视角：{perspective === 'self' ? '懂我' : perspective === 'work' ? '当前工作' : activeTopicId ? `知识版图 / ${graph.activeTopic?.label || ''}` : '知识版图 / 归类'}{projectScope === 'current' && activeProject ? ` · ${activeProject.name}` : ' · 全部项目'}</span><span>图上 {graph.nodes.length} 个对象 · Brain {cognitionCount} 项认知 · 外挂 {externalCollectionCount} 个知识库 · 待确认 {proposals.filter((item) => item.status === 'pending').length} 条</span></footer>
  </div>
}
