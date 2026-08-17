import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  STUDIO_SCALE_MAX,
  STUDIO_SCALE_MIN,
  STUDIO_SCALE_STEP,
  buildStudioCanvasBoard,
  studioEdgePathPoints,
} from '../../../domain/studio-canvas'
import { studioDraftToComposition, type StudioDraft } from '../../../domain/studio'
import { StudioCanvasNodeCard } from './StudioCanvasNode'

type Props = {
  draft: StudioDraft
  selectedNodeId?: string
  selectedEdgeId?: string
  onSelectNode?: (id: string) => void
  onSelectEdge?: (id: string) => void
  onMoveNode?: (id: string, x: number, y: number) => void
  onConnectNodes?: (fromId: string, toId: string, branch?: string) => void
  onRemoveNode?: (id: string) => void
  nodeMarks?: Record<string, string>
  edgeMarks?: Record<string, string>
  checkDot?: { x: number; y: number } | null
}

function clientPoint(event: { clientX: number; clientY: number }) {
  return { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0 }
}

function clampScale(value: number) {
  return Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, value))
}

export function StudioCanvasBoard({
  draft,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onMoveNode,
  onConnectNodes,
  onRemoveNode,
  nodeMarks = {},
  edgeMarks = {},
  checkDot,
}: Props) {
  const graphRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const [wirePreview, setWirePreview] = useState('')
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const scaleRef = useRef(scale)
  const panStateRef = useRef(pan)
  scaleRef.current = scale
  panStateRef.current = pan

  const board = useMemo(
    () => buildStudioCanvasBoard(draft, {
      selectedId: selectedNodeId,
      selectedEdgeId,
      toComposition: (d) => studioDraftToComposition(d),
    }),
    [draft, selectedNodeId, selectedEdgeId],
  )

  const zoomAt = useCallback((nextScale: number, clientX?: number, clientY?: number) => {
    const graph = graphRef.current
    const clamped = clampScale(nextScale)
    const current = scaleRef.current
    const currentPan = panStateRef.current
    if (!graph || clientX == null || clientY == null) {
      setScale(clamped)
      return
    }
    const rect = graph.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const bx = (px - currentPan.x) / current
    const by = (py - currentPan.y) / current
    setScale(clamped)
    setPan({ x: px - bx * clamped, y: py - by * clamped })
  }, [])

  const fitView = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const rect = graph.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const next = clampScale(Math.min(rect.width / board.width, rect.height / board.height, 1))
    setScale(next)
    setPan({
      x: (rect.width - board.width * next) / 2,
      y: (rect.height - board.height * next) / 2,
    })
  }, [board.width, board.height])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.shiftKey) {
        setPan((prev) => ({ ...prev, x: prev.x - event.deltaY }))
        return
      }
      const factor = event.deltaY > 0 ? 1 - STUDIO_SCALE_STEP : 1 + STUDIO_SCALE_STEP
      zoomAt(scaleRef.current * factor, event.clientX, event.clientY)
    }
    graph.addEventListener('wheel', onWheel, { passive: false })
    return () => graph.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const tag = String((event.target as HTMLElement)?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      setSpaceHeld(true)
      event.preventDefault()
    }
    const onUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const handleDragStart = useCallback((nodeId: string, event: ReactPointerEvent) => {
    const node = board.nodes.find((n) => n.id === nodeId)
    if (!node || spaceHeld) return
    const point = clientPoint(event)
    dragRef.current = {
      id: nodeId,
      startX: point.x,
      startY: point.y,
      originX: node.x,
      originY: node.y,
    }
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }, [board.nodes, spaceHeld])

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    const point = clientPoint(event)
    const panDrag = panRef.current
    if (panDrag) {
      setPan({
        x: panDrag.originX + (point.x - panDrag.startX),
        y: panDrag.originY + (point.y - panDrag.startY),
      })
      return
    }
    const drag = dragRef.current
    if (!drag || !onMoveNode) return
    const dx = (point.x - drag.startX) / scale
    const dy = (point.y - drag.startY) / scale
    onMoveNode(drag.id, Math.max(0, drag.originX + dx), Math.max(0, drag.originY + dy))
  }, [onMoveNode, scale])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
    panRef.current = null
    setPanning(false)
  }, [])

  const handleBoardPointerDown = useCallback((event: ReactPointerEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-studio-node]') || target.closest('[data-studio-port]')) return
    if (target.closest('[data-studio-edge]')) return
    onSelectNode?.('')
    const point = clientPoint(event)
    panRef.current = {
      startX: point.x,
      startY: point.y,
      originX: pan.x,
      originY: pan.y,
    }
    setPanning(true)
  }, [pan, onSelectNode])

  const handlePortDown = useCallback((nodeId: string, branch?: string, event?: ReactPointerEvent) => {
    const graph = graphRef.current
    const boardEl = graph?.querySelector('[data-studio-board]') as HTMLElement | null
    const port = event?.currentTarget as HTMLElement | undefined
    if (!graph || !boardEl || !port) {
      return
    }
    const fromSide = port.getAttribute('data-studio-side') || 'right'
    const boardRect = boardEl.getBoundingClientRect()
    const portRect = port.getBoundingClientRect()
    const currentScale = scaleRef.current
    const x1 = ((portRect.left + portRect.width / 2) - boardRect.left) / currentScale
    const y1 = ((portRect.top + portRect.height / 2) - boardRect.top) / currentScale
    const onMove = (moveEvent: PointerEvent) => {
      const rect = boardEl.getBoundingClientRect()
      const x2 = (moveEvent.clientX - rect.left) / currentScale
      const y2 = (moveEvent.clientY - rect.top) / currentScale
      const preferTo = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
        ? (x2 >= x1 ? 'left' : 'right')
        : (y2 >= y1 ? 'top' : 'bottom')
      setWirePreview(studioEdgePathPoints(x1, y1, x2, y2, fromSide, preferTo))
    }
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setWirePreview('')
      const stack = document.elementsFromPoint(upEvent.clientX, upEvent.clientY)
      let toId = ''
      for (const el of stack) {
        const portIn = (el as HTMLElement).closest?.('[data-studio-port="in"]')
        const card = (el as HTMLElement).closest?.('[data-studio-node]')
        const id = (portIn || card)?.closest?.('[data-studio-node]')?.getAttribute('data-studio-node') || ''
        if (id && id !== nodeId) {
          toId = id
          break
        }
      }
      if (toId) onConnectNodes?.(nodeId, toId, branch)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [onConnectNodes])

  const panClass = `${spaceHeld ? ' is-space-pan' : ''}${panning ? ' is-panning' : ''}`

  return (
    <div
      ref={graphRef}
      className={`wb-studio-graph wb-studio-graph--canvas${panClass}`}
      id="wbStudioGraph"
      data-studio-dropzone="true"
      data-testid="studio-canvas"
      data-pan-x={Number.isFinite(pan.x) ? String(pan.x) : '0'}
      data-pan-y={Number.isFinite(pan.y) ? String(pan.y) : '0'}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="wb-studio-viewport" data-studio-viewport="true">
        <div
          className="wb-studio-board"
          style={{
            width: board.width,
            height: board.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          data-studio-board="true"
        >
          <svg className="wb-studio-edges" width={board.width} height={board.height} aria-hidden="true">
            <defs>
              <marker id="wb-studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b8def" />
              </marker>
            </defs>
            {board.edges.map((edge) => {
              const label = edge.label
                || (edge.branch === 'true' ? '成立' : edge.branch === 'false' ? '不成立' : '')
              const mid = edge.path.match(/C\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/)
              const labelX = mid ? (Number(mid[1]) + Number(mid[5])) / 2 : 0
              const labelY = mid ? (Number(mid[2]) + Number(mid[6])) / 2 - 6 : 0
              return (
                <g key={edge.id}>
                  <path
                    className={`wb-studio-edge${edge.selected ? ' is-selected' : ''}${edgeMarks[edge.id] ? ` is-check-${edgeMarks[edge.id]}` : ''}`}
                    d={edge.path}
                    fill="none"
                    markerEnd="url(#wb-studio-arrow)"
                    data-edge-id={edge.id}
                    data-studio-edge={edge.id}
                    data-studio-edge-from={edge.from}
                    data-studio-edge-to={edge.to}
                    data-studio-edge-branch={edge.branch || ''}
                    style={{ pointerEvents: 'stroke' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      onSelectEdge?.(edge.id)
                    }}
                  />
                  {label ? (
                    <text
                      className="wb-studio-edge-label"
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {label}
                    </text>
                  ) : null}
                </g>
              )
            })}
            {wirePreview ? <path className="wb-studio-edge is-wiring" d={wirePreview} fill="none" /> : null}
            {checkDot ? <circle className="wb-studio-check-dot" r="4" fill="#3d8bfd" cx={checkDot.x} cy={checkDot.y} /> : null}
          </svg>
          {board.nodes.map((node) => (
            <StudioCanvasNodeCard
              key={node.id}
              node={node}
              checkMark={nodeMarks[node.id]}
              onSelect={(id) => onSelectNode?.(id)}
              onRemove={(id) => onRemoveNode?.(id)}
              onPortDown={(id, branch, event) => handlePortDown(id, branch, event)}
              onPortUp={() => undefined}
              onDragStart={handleDragStart}
            />
          ))}
          {board.empty ? (
            <div className="wb-studio-empty wb-studio-empty--board">
              <strong>从左侧加入节点</strong>
              <span>滚轮缩放 · 拖空白平移 · 四向端口连线 · Delete 可删</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="wb-studio-nav" aria-label="画布缩放">
        <button type="button" className="wb-studio-nav-btn" data-studio-zoom="out" title="缩小" aria-label="缩小" onClick={() => zoomAt(scale - STUDIO_SCALE_STEP)}>−</button>
        <button type="button" className="wb-studio-nav-btn wb-studio-nav-label" data-studio-zoom="reset" title="重置 100%" aria-label="重置缩放" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}>
          {Math.round(scale * 100)}%
        </button>
        <button type="button" className="wb-studio-nav-btn" data-studio-zoom="in" title="放大" aria-label="放大" onClick={() => zoomAt(scale + STUDIO_SCALE_STEP)}>+</button>
        <button type="button" className="wb-studio-nav-btn" data-studio-zoom="fit" title="适应画布" aria-label="适应画布" onClick={fitView}>⤢</button>
      </div>
    </div>
  )
}
