import type { ReviewTabId } from '../../../domain/daemon-review-tabs'
import type { ShelfCardModel } from '../../../domain/shelf'
import { rosterLabelsFromPackage } from '../../../domain/run-projection'
import type { RunState } from '../../app/store-types'
import { api } from '../../app/store-types'

export type { RunState }

export function emptyRun(
  card: Pick<ShelfCardModel, 'id' | 'name'>,
  brief = '',
  slug = card.id,
  phase: RunState['phase'] = 'input',
): RunState {
  return {
    taskId: '',
    workflowId: card.id,
    workflowName: card.name,
    slug,
    lane: 'workflow',
    phase,
    brief,
    launchInputs: {},
    log: phase === 'input'
      ? [`已打开工作流「${card.name}」`, '填写目标后开始运行']
      : [`已打开运行「${card.name}」`],
    gateNode: null,
    clarifyNode: null,
    gateTitle: null,
    processLogsText: '',
    progressText: '',
    showProcess: false,
    artifacts: [],
    inputAgents: [],
    agents: [],
    graphNodes: [],
    currentOwner: '',
    projectionDegraded: false,
    projectionDegradedReason: '',
    reviewTab: 'steps',
    reviewEvents: [],
    reviewChanges: { summary: '', files: [], empty: true },
    daemonStatus: '',
    dialogueMessages: [],
    workflowRunId: '',
    workflowPackage: null,
    selectedNodeId: null,
  }
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

function workflowResultText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = asRecord(value)
  for (const key of ['text', 'content', 'summary', 'message', 'result']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

export function workflowGraphPayload(rawPackage: unknown, goal: string) {
  const pkg = asRecord(rawPackage)
  const graph = asRecord(pkg.graph)
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const agentNodes = nodes.map(asRecord).filter((node) => String(node.type || 'agent') === 'agent')
  return {
    goal,
    teamPackageId: String(pkg.id || ''),
    teamName: String(pkg.name || '用户工作流'),
    version: String(pkg.version || '1.0.0'),
    nodes,
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    gates: Array.isArray(graph.gates) ? graph.gates : [],
    parallelism: Number(graph.parallelism || 1),
    joinStrategy: String(graph.joinStrategy || 'all'),
    members: agentNodes.map((node) => ({
      id: String(node.id || node.agentPackageId || ''),
      expertId: String(node.agentPackageId || node.agent || ''),
      agentPackageId: String(node.agentPackageId || node.agent || ''),
      profileId: String(node.profileId || ''),
      role: String(node.role || node.name || node.agentPackageId || ''),
      intent: String(node.intent || node.description || goal),
    })),
  }
}

export function workflowRunProjection(rawPackage: unknown, rawTree: unknown) {
  const pkg = asRecord(rawPackage)
  const graph = asRecord(pkg.graph)
  const packageNodes = Array.isArray(graph.nodes) ? graph.nodes.map(asRecord) : []
  const tree = asRecord(rawTree)
  const root = asRecord(tree.root)
  const rootRunId = String(tree.rootRunId || root.runId || '')
  const runtimeNodes = Object.values(asRecord(tree.nodes)).map(asRecord)
  const runtimeByWorkflowNode = new Map<string, Record<string, unknown>>()
  for (const runtimeNode of runtimeNodes) {
    const meta = asRecord(runtimeNode.meta)
    const workflowNodeId = String(meta.workflowNodeId || '')
    if (workflowNodeId) runtimeByWorkflowNode.set(workflowNodeId, runtimeNode)
  }
  const fallbackNodes = runtimeNodes
    .filter((runtimeNode) => String(runtimeNode.runId || '') !== rootRunId)
    .map((runtimeNode, index) => {
      const meta = asRecord(runtimeNode.meta)
      return asRecord({
        id: String(meta.workflowNodeId || runtimeNode.runId || `node-${index + 1}`),
        name: String(meta.role || meta.expertId || meta.agentPackageId || runtimeNode.expertId || `节点 ${index + 1}`),
        type: 'agent',
        agentPackageId: String(meta.expertId || meta.agentPackageId || runtimeNode.expertId || ''),
      })
    })
  const nodes = packageNodes.length ? packageNodes : fallbackNodes
  const events = Array.isArray(tree.events) ? tree.events.map(asRecord) : []
  const terminalEvent = [...events].reverse().find((event) => String(event.type || '') === 'workbench.graph.terminal')
  const terminalResult = asRecord(terminalEvent?.result)
  const resultByNode = asRecord(terminalResult.results)
  const statusByNode = new Map<string, string>()
  for (const event of events) {
    const nodeId = String(event.nodeId || '')
    if (!nodeId) continue
    const type = String(event.type || '')
    if (type.includes('started') || type.includes('waiting')) statusByNode.set(nodeId, type.includes('waiting') ? 'waiting' : 'running')
    if (type.includes('completed')) statusByNode.set(nodeId, 'completed')
    if (type.includes('failed') || type.includes('rejected')) statusByNode.set(nodeId, 'failed')
  }
  const graphNodes = nodes.map((node, index) => {
    const id = String(node.id || `node-${index + 1}`)
    const type = String(node.type || 'agent')
    const nodeResult = asRecord(resultByNode[id])
    const runtimeNode = runtimeByWorkflowNode.get(id) || {}
    const outputLabel = workflowResultText(nodeResult.output)
      || workflowResultText(nodeResult.summary)
      || workflowResultText(runtimeNode.summary)
    const runtimeStatus = String(runtimeNode.status || '')
    return {
      id,
      label: String(node.name || node.label || node.agentPackageId || id),
      meta: type === 'agent' ? '专家 Agent' : type,
      status: statusByNode.get(id) || runtimeStatus || 'pending',
      owner: String(node.agentPackageId || node.humanRole || ''),
      handoff: '',
      outputLabel,
    }
  })
  const pendingGates = Array.isArray(tree.pendingGates) ? tree.pendingGates.map(asRecord) : []
  const latestActive = [...graphNodes].reverse().find((node) => ['running', 'waiting'].includes(node.status))
  const rootStatus = String(root.status || '')
  const terminal = ['done', 'completed', 'failed', 'cancelled', 'canceled'].includes(rootStatus.toLowerCase())
  if (terminal && !graphNodes.some((node) => ['running', 'waiting', 'failed'].includes(node.status))) {
    for (const node of graphNodes) {
      if (node.status === 'pending') node.status = 'completed'
    }
  }
  const log = events.map((event) => String(event.summary || event.message || event.type || '')).filter(Boolean)
  return {
    graphNodes,
    currentOwner: latestActive?.owner || latestActive?.label || '',
    pendingGate: pendingGates[0] ? String(pendingGates[0].nodeId || '') : null,
    phase: pendingGates.length ? 'hitl' as const : terminal ? 'done' as const : 'running' as const,
    status: rootStatus,
    log,
    artifacts: Array.isArray(tree.artifacts) ? tree.artifacts : [],
  }
}

export async function loadInputAgents(workflowId: string): Promise<string[]> {
  try {
    const result = await api()?.workbenchWorkflowPackageGet?.(workflowId)
    return rosterLabelsFromPackage(result)
  } catch {
    return []
  }
}

export function parseReviewEventsFromRaw(
  eventsRaw: unknown,
  fallback: RunState['reviewEvents'],
): RunState['reviewEvents'] {
  const eventsRecord = eventsRaw && typeof eventsRaw === 'object'
    ? eventsRaw as Record<string, unknown>
    : null
  if (!Array.isArray(eventsRecord?.events)) return fallback
  return eventsRecord!.events.map((item, index) => {
    const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: String(rec.id || rec.event_id || `event-${index + 1}`),
      type: String(rec.type || rec.kind || 'event'),
      message: String(rec.message || rec.summary || rec.text || ''),
      at: String(rec.at || rec.ts || rec.time || ''),
    }
  })
}

export function parseReviewChangesFromRaw(
  changesRaw: unknown,
  fallback: RunState['reviewChanges'],
): RunState['reviewChanges'] {
  const changesRecord = changesRaw && typeof changesRaw === 'object'
    ? changesRaw as Record<string, unknown>
    : null
  if (!changesRecord) return fallback
  const files = Array.isArray(changesRecord.files) ? changesRecord.files : []
  return {
    summary: String(changesRecord.summary || changesRecord.message || ''),
    files: files.map((item, index) => {
      if (typeof item === 'string') {
        return { id: `chg-${index + 1}`, path: item, status: 'modified' }
      }
      const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        id: String(rec.id || rec.path || `chg-${index + 1}`),
        path: String(rec.path || rec.file || rec.name || ''),
        status: String(rec.status || rec.change || 'modified'),
      }
    }).filter((item) => item.path),
    empty: !files.length,
  }
}
