import { useRef, useState } from 'react'
import { inspectStudioDraft, studioEdges, type StudioDraft, type StudioIssue } from '../../../domain/studio'
import { useAppStore } from '../../app/store'

export type StudioCheckMark = '' | 'active' | 'pass' | 'fail' | 'flow'

const STEP_MS = typeof process !== 'undefined' && process.env.VITEST ? 0 : 360
const FLOW_MS = typeof process !== 'undefined' && process.env.VITEST ? 0 : 28

function sleep(ms: number) {
  if (!ms) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useStudioGraphCheck() {
  const inspectStudio = useAppStore((s) => s.inspectStudio)
  const showToast = useAppStore((s) => s.showToast)
  const [nodeMarks, setNodeMarks] = useState<Record<string, StudioCheckMark>>({})
  const [edgeMarks, setEdgeMarks] = useState<Record<string, StudioCheckMark>>({})
  const [dot, setDot] = useState<{ edgeId: string; x: number; y: number } | null>(null)
  const tokenRef = useRef(0)

  function clear() {
    setNodeMarks({})
    setEdgeMarks({})
    setDot(null)
  }

  async function animateEdge(graph: HTMLElement, fromId: string, toId: string, token: number) {
    const edge = graph.querySelector(
      `.wb-studio-edge[data-studio-edge-from="${CSS.escape(fromId)}"][data-studio-edge-to="${CSS.escape(toId)}"]`,
    ) as SVGPathElement | null
    if (!edge) {
      await sleep(FLOW_MS * 6)
      return
    }
    const edgeId = edge.getAttribute('data-studio-edge') || `${fromId}->${toId}`
    setEdgeMarks((prev) => ({ ...prev, [edgeId]: 'flow' }))
    try {
      const len = edge.getTotalLength()
      const steps = 12
      for (let i = 0; i <= steps; i += 1) {
        if (token !== tokenRef.current) break
        const pt = edge.getPointAtLength((len * i) / steps)
        setDot({ edgeId, x: pt.x, y: pt.y })
        await sleep(FLOW_MS)
      }
    } catch {
      await sleep(FLOW_MS * 8)
    }
    setDot(null)
    if (token === tokenRef.current) {
      setEdgeMarks((prev) => ({ ...prev, [edgeId]: 'pass' }))
    }
  }

  async function run(draft: StudioDraft | null, simpleMode: boolean, graph: HTMLElement | null) {
    if (simpleMode) {
      showToast('请切换到画布模式后再检查流程')
      return
    }
    if (!draft || !graph) {
      showToast('编排草稿未就绪')
      return
    }
    const report = inspectStudio() || inspectStudioDraft(draft)
    const token = ++tokenRef.current
    clear()
    const issueByNode = new Map<string, StudioIssue>()
    for (const issue of report.issues || []) {
      if (issue.nodeId && !issueByNode.has(issue.nodeId)) issueByNode.set(issue.nodeId, issue)
    }
    const adj = new Map<string, string[]>()
    for (const edge of studioEdges(draft)) {
      const list = adj.get(edge.from) || []
      list.push(edge.to)
      adj.set(edge.from, list)
    }
    const startId = report.startId || '__start__'
    const seen = new Set<string>()

    async function visit(nodeId: string, fromId: string): Promise<boolean> {
      if (token !== tokenRef.current) return false
      if (seen.has(nodeId)) return true
      seen.add(nodeId)
      if (fromId) await animateEdge(graph as HTMLElement, fromId, nodeId, token)
      if (token !== tokenRef.current) return false
      setNodeMarks((prev) => ({ ...prev, [nodeId]: 'active' }))
      await sleep(STEP_MS)
      if (token !== tokenRef.current) return false
      const fail = issueByNode.get(nodeId)
      if (fail) {
        setNodeMarks((prev) => ({ ...prev, [nodeId]: 'fail' }))
        showToast(fail.message || '节点未通过检查')
        return false
      }
      setNodeMarks((prev) => ({ ...prev, [nodeId]: 'pass' }))
      for (const nextId of adj.get(nodeId) || []) {
        const ok = await visit(nextId, nodeId)
        if (!ok) return false
      }
      return true
    }

    showToast('开始检查流程（不会真正运行）')
    const okPath = await visit(startId, '')
    if (token !== tokenRef.current) return
    if (!okPath) return
    if (!report.ok) {
      const leftover = (report.issues || []).find((issue) => !issue.nodeId || !seen.has(issue.nodeId))
        || report.issues?.[0]
      if (leftover?.nodeId) setNodeMarks((prev) => ({ ...prev, [leftover.nodeId as string]: 'fail' }))
      showToast(leftover?.message || '流程未通过检查')
      return
    }
    showToast('流程检查通过')
  }

  return { nodeMarks, edgeMarks, dot, run, clear }
}
