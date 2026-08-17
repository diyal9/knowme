import type { WorkbenchTask } from '../shared/api'

export interface RunGraphNode {
  id: string
  label: string
  meta: string
  status: string
  owner: string
  handoff: string
  outputLabel: string
  degraded?: boolean
  degradedPlaceholder?: boolean
}

export interface RunAgentRoster {
  id: string
  label: string
}

export interface RunTaskProjection {
  agents: string[]
  roster: RunAgentRoster[]
  graphNodes: RunGraphNode[]
  currentOwner: string
  degraded: boolean
  degradedReason: string
  workflowName: string
}

function text(value: unknown): string {
  return String(value == null ? '' : value).trim()
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

export function graphNodeStatusClass(status: string): string {
  const value = text(status).toLowerCase()
  if (['done', 'completed', 'finished', 'success', 'approved'].includes(value)) return 'done'
  if (['failed', 'error', 'rejected'].includes(value)) return 'error'
  if (['running', 'active', 'current', 'waiting', 'in_progress'].includes(value)) return 'active'
  return 'pending'
}

export function parseRunProjection(raw: unknown): RunTaskProjection | null {
  const source = asRecord(raw)
  const projection = asRecord(source.projection)
  const body = Object.keys(projection).length ? projection : source
  const graphNodesRaw = Array.isArray(body.graphNodes) ? body.graphNodes : []
  const rosterRaw = Array.isArray(body.roster) ? body.roster : []
  const agentsRaw = Array.isArray(body.agents) ? body.agents : []

  const graphNodes: RunGraphNode[] = graphNodesRaw.map((item, index) => {
    const node = asRecord(item)
    return {
      id: text(node.id || `step-${index + 1}`),
      label: text(node.label || node.title || node.id || `步骤 ${index + 1}`),
      meta: text(node.meta || node.type || '步骤'),
      status: text(node.status || 'pending'),
      owner: text(node.owner),
      handoff: text(node.handoff),
      outputLabel: text(node.outputLabel),
      degraded: node.degraded === true,
      degradedPlaceholder: node.degradedPlaceholder === true,
    }
  })

  const roster: RunAgentRoster[] = rosterRaw.length
    ? rosterRaw.map((item, index) => {
      const rec = asRecord(item)
      const id = text(rec.id || `agent-${index + 1}`)
      const label = text(rec.label || rec.title || rec.name || id)
      return { id, label }
    })
    : agentsRaw.map((name, index) => ({
      id: `agent-${index + 1}`,
      label: text(name) || `专家 ${index + 1}`,
    }))

  const agents = roster.map((item) => item.label).filter(Boolean)
  if (!agents.length && !graphNodes.length) return null

  return {
    agents,
    roster,
    graphNodes,
    currentOwner: text(body.currentOwner),
    degraded: body.degraded === true,
    degradedReason: text(body.degradedReason),
    workflowName: text(body.workflowName || body.intentTitle),
  }
}

export function rosterLabelsFromPackage(raw: unknown): string[] {
  const result = asRecord(raw)
  const pkg = asRecord(result.package || result)
  const graph = asRecord(pkg.graph)
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : Array.isArray(pkg.nodes) ? pkg.nodes : []
  const seen = new Set<string>()
  const labels: string[] = []
  for (const item of nodes) {
    const node = asRecord(item)
    const kind = text(node.kind || node.type)
    if (kind && kind !== 'agent') continue
    const label = text(node.name || node.label || node.agentPackageId || node.agent)
    if (!label || seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  return labels.slice(0, 8)
}

export function parseTaskListResponse(raw: unknown): WorkbenchTask[] {
  const result = asRecord(raw)
  if (Array.isArray(result.items)) return result.items as WorkbenchTask[]
  if (Array.isArray(result.tasks)) return result.tasks as WorkbenchTask[]
  return []
}

export function taskHasWorkflowId(task: WorkbenchTask): boolean {
  return Boolean(text(task.workflowId))
}

export function workflowShelfTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return tasks.filter(taskHasWorkflowId)
}

export function expertHomeTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return tasks.filter((task) => !taskHasWorkflowId(task))
}

const TASK_STATUS_META: Record<string, { label: string; dot: string }> = {
  draft: { label: '草稿', dot: 'draft' },
  running: { label: '进行中', dot: 'running' },
  review: { label: '待确认', dot: 'running' },
  done: { label: '已完成', dot: 'done' },
  failed: { label: '失败', dot: 'failed' },
  cancelled: { label: '已取消', dot: 'cancelled' },
}

export function taskStatusMeta(status: string | undefined) {
  return TASK_STATUS_META[String(status || 'draft').toLowerCase()] || TASK_STATUS_META.draft
}

export function taskRecentSummary(task: WorkbenchTask): string {
  const result = text(task.resultSummary)
  if (result) return result
  const goal = text(task.goal)
  if (goal) return goal
  const meta = taskStatusMeta(task.status)
  if (meta.dot === 'running') return '专家协作进行中，点开可继续'
  if (meta.dot === 'done') return '任务已完成，可回看产物或再次安排'
  if (meta.dot === 'failed') return '上次执行未完成，点开可重试或调整目标'
  if (meta.dot === 'cancelled') return '任务已取消'
  return '等待安排专家执行'
}

export function taskRelTime(iso?: string): string {
  const value = text(iso)
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const delta = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) return '刚刚'
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟前`
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`
  if (delta < 7 * day) return `${Math.floor(delta / day)} 天前`
  return date.toLocaleDateString()
}

export function runPhaseFromTaskStatus(status: string | undefined): 'running' | 'hitl' | 'done' | 'input' {
  const value = String(status || '').toLowerCase()
  if (value === 'review') return 'hitl'
  if (['done', 'failed', 'cancelled'].includes(value)) return 'done'
  if (value === 'running') return 'running'
  return 'done'
}
