import { useEffect, useRef, useState } from 'react'
import '../workbench/workbench-studio.css'
import { STUDIO_END_ID, STUDIO_START_ID, studioBusinessNodes, studioEdges } from '../../../domain/studio'
import { useAppStore } from '../../app/store'
import { StudioCanvasBoard } from './StudioCanvasBoard'
import { StudioExpertPicker } from './StudioExpertPicker'
import { StudioInspector } from './StudioInspector'
import { StudioPalette } from './StudioPalette'
import { StudioStepList } from './StudioStepList'
import { StudioToolbar } from './StudioToolbar'
import { useStudioGraphCheck } from './useStudioGraphCheck'

export function StudioSurface() {
  const draft = useAppStore((s) => s.studioDraft)
  const issues = useAppStore((s) => s.studioIssues)
  const initStudio = useAppStore((s) => s.initStudio)
  const addFromPalette = useAppStore((s) => s.addStudioNodeFromPalette)
  const moveStudioNode = useAppStore((s) => s.moveStudioNode)
  const connectStudioNodes = useAppStore((s) => s.connectStudioNodes)
  const removeStudioNode = useAppStore((s) => s.removeStudioNode)
  const disconnectStudioEdge = useAppStore((s) => s.disconnectStudioEdge)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [simpleMode, setSimpleMode] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const graphHostRef = useRef<HTMLElement | null>(null)
  const check = useStudioGraphCheck()

  useEffect(() => {
    initStudio()
  }, [initStudio])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (simpleMode) return
      const tag = String((event.target as HTMLElement)?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((event.target as HTMLElement)?.isContentEditable) return
      event.preventDefault()
      if (selectedEdgeId) {
        disconnectStudioEdge(selectedEdgeId)
        setSelectedEdgeId('')
        return
      }
      if (selectedNodeId && selectedNodeId !== STUDIO_START_ID && selectedNodeId !== STUDIO_END_ID) {
        removeStudioNode(selectedNodeId)
        setSelectedNodeId('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [simpleMode, selectedEdgeId, selectedNodeId, disconnectStudioEdge, removeStudioNode])

  if (!draft) return null

  const bizCount = studioBusinessNodes(draft).length
  const inputCount = Array.isArray(draft.inputs) ? draft.inputs.length : 0
  const outputCount = Array.isArray(draft.outputs) ? draft.outputs.length : 0
  const meta = draft.nodes.length
    ? `${bizCount || draft.nodes.length} 节点 · ${inputCount}入/${outputCount}出${draft.dirty ? ' · 未保存' : ''}`
    : (simpleMode ? '添加专家步骤' : '从左侧添加节点 · 右键可操作')

  function pickKind(kind: string) {
    if (kind === 'start') {
      setSelectedNodeId(STUDIO_START_ID)
      setSelectedEdgeId('')
      return
    }
    if (kind === 'end') {
      setSelectedNodeId(STUDIO_END_ID)
      setSelectedEdgeId('')
      return
    }
    if (kind === 'agent') {
      setPickerOpen(true)
      return
    }
    addFromPalette(kind)
  }

  const nodes = studioBusinessNodes(draft)
  const edges = studioEdges(draft)

  return (
    <div className={`wb-studio-shell wb-studio-page${selectedNodeId ? ' has-inspector' : ''}`} data-testid="studio-surface">
      <aside className="wb-studio-library" aria-labelledby="wbStudioLibTitle">
        <div className="wb-studio-lib-head">
          <h2 id="wbStudioLibTitle">组件</h2>
        </div>
        <StudioPalette onPickKind={pickKind} />
      </aside>
      <main className="wb-studio-canvas" aria-label="工作流节点画布" ref={(el) => { graphHostRef.current = el }}>
        <div className="wb-studio-toolbar">
          <StudioToolbar
            simpleMode={simpleMode}
            hasNodes={draft.nodes.length > 0}
            onToggleMode={() => setSimpleMode((value) => !value)}
            onInspect={() => {
              const graph = graphHostRef.current?.querySelector('#wbStudioGraph') as HTMLElement | null
              void check.run(draft, simpleMode, graph)
            }}
            meta={(
              <span id="wbStudioGraphMeta" data-testid={draft.dirty ? 'studio-dirty' : undefined}>
                {meta}
              </span>
            )}
          />
        </div>
        {simpleMode ? (
          <StudioStepList
            draft={draft}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => { setSelectedNodeId(id); setSelectedEdgeId('') }}
            onRemoveNode={removeStudioNode}
          />
        ) : (
          <StudioCanvasBoard
            draft={draft}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            nodeMarks={check.nodeMarks}
            edgeMarks={check.edgeMarks}
            checkDot={check.dot}
            onSelectNode={(id) => { setSelectedNodeId(id); setSelectedEdgeId('') }}
            onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedNodeId('') }}
            onMoveNode={moveStudioNode}
            onConnectNodes={connectStudioNodes}
            onRemoveNode={removeStudioNode}
          />
        )}
      </main>
      {selectedNodeId ? (
        <StudioInspector draft={draft} selectedNodeId={selectedNodeId} simpleMode={simpleMode} />
      ) : null}
      {pickerOpen ? <StudioExpertPicker onClose={() => setPickerOpen(false)} /> : null}
      <div hidden aria-hidden="true">
        <ul data-testid="studio-edge-list">
          {edges.map((edge) => (
            <li key={edge.id}>{edge.from} → {edge.to}</li>
          ))}
        </ul>
        <ul data-testid="studio-node-list">
          {nodes.map((node) => (
            <li key={node.id}>{node.name || node.id}</li>
          ))}
        </ul>
        {issues.length ? (
          <ul data-testid="studio-issues">
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.nodeId || issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
