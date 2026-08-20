export type RunLane = 'workflow' | 'pipeline'
export type WorkbenchTaskKind = 'expert-chat' | 'workflow-chat' | 'pipeline-review'

export function resolveWorkbenchTaskKind(opts: {
  expertRoom: boolean
  lane?: RunLane | null
}): WorkbenchTaskKind {
  if (opts.expertRoom) return 'expert-chat'
  if (opts.lane === 'pipeline') return 'pipeline-review'
  return 'workflow-chat'
}

export function workbenchTaskModeLabel(kind: WorkbenchTaskKind): string {
  if (kind === 'expert-chat') return '协作'
  if (kind === 'pipeline-review') return '管线服务'
  return '工作流'
}

export function workbenchTaskBackLabel(kind: WorkbenchTaskKind): string {
  if (kind === 'expert-chat') return '返回专家协作'
  if (kind === 'pipeline-review') return '返回管线服务'
  return '返回工作流'
}

export function joinTaskTitle(primary?: string | null, secondary?: string | null): string {
  const a = String(primary || '').trim()
  const b = String(secondary || '').trim()
  if (a && b && a !== b) return `${a} · ${b}`
  return a || b
}

export function workbenchTaskShowsDialogue(kind: WorkbenchTaskKind): boolean {
  return kind === 'expert-chat' || kind === 'workflow-chat' || kind === 'pipeline-review'
}

export function workbenchRunReturnSurface(lane?: RunLane | null): 'shelf' | 'manage' {
  return lane === 'pipeline' ? 'manage' : 'shelf'
}

export function workbenchTaskStateLabel(
  kind: WorkbenchTaskKind,
  phase?: 'input' | 'running' | 'hitl' | 'done' | null,
): string {
  if (kind === 'expert-chat') return '协作中'
  if (kind === 'workflow-chat') {
    if (phase === 'done') return '已完成'
    if (phase === 'hitl') return '等待确认'
    if (phase === 'input') return '待启动'
    return '执行中'
  }
  if (phase === 'done') return '已完成'
  if (phase === 'hitl') return '等待确认'
  if (phase === 'input') return '确认输入'
  return '执行中'
}

export function workbenchTaskHasDaemonReview(kind: WorkbenchTaskKind): boolean {
  return kind === 'pipeline-review'
}

export function workbenchTaskStateTone(phase?: 'input' | 'running' | 'hitl' | 'done' | null): string | undefined {
  if (phase === 'done') return 'done'
  if (phase === 'hitl') return 'waiting'
  if (phase === 'running') return 'running'
  return undefined
}
