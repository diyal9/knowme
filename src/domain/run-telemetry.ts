import { extractGateInfo, type DaemonGateInfo } from './daemon-review'

export type RunPhase = 'input' | 'running' | 'hitl' | 'done'

export interface RunArtifact {
  id: string
  name: string
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

export function parseLaunchSlug(raw: unknown, fallback: string): string {
  const result = asRecord(raw)
  const intent = asRecord(result.intent)
  const slug = String(intent.slug || result.slug || '').trim()
  return slug || fallback
}

export function parseDaemonLogs(raw: unknown): {
  lines: string[]
  progress: string
  status: string
  gate: DaemonGateInfo | null
} {
  const result = asRecord(raw)
  const nested = asRecord(result.data)
  const source = { ...nested, ...result }
  const text = String(source.text || source.logs || source.log || source.body || '')
  const rawLines = Array.isArray(source.lines) ? source.lines : text.split(/\r?\n/)
  const lines = rawLines.map((line) => String(line)).map((line) => line.trim()).filter(Boolean)
  const progress = String(source.progress || source.progressText || '').trim()
  const status = String(source.status || source.state || '').trim()
  const gateRaw = source.gate
  const gate = extractGateInfo(
    gateRaw && typeof gateRaw === 'object' ? gateRaw as Record<string, unknown> : null,
  )
  return { lines, progress, status, gate }
}

export function parseDaemonArtifacts(raw: unknown): RunArtifact[] {
  const result = asRecord(raw)
  const list = Array.isArray(result.items)
    ? result.items
    : Array.isArray(result.artifacts)
      ? result.artifacts
      : []
  return list.map((item, index) => {
    const rec = asRecord(item)
    const id = String(rec.id || rec.path || rec.name || index)
    const name = String(rec.name || rec.title || rec.path || rec.id || `产物 ${index + 1}`)
    return { id, name }
  }).filter((item) => item.name)
}

export function nextRunPhase(current: RunPhase, status: string, gate: DaemonGateInfo | null): RunPhase {
  if (current === 'input') return 'input'
  const value = status.toLowerCase()
  if (['done', 'success', 'completed', 'finished'].includes(value)) return 'done'
  if (['failed', 'error', 'rejected', 'cancelled', 'canceled'].includes(value)) return 'done'
  if (gate) return 'hitl'
  if (current === 'done') return 'done'
  if (current === 'hitl') return 'hitl'
  return 'running'
}

export function runProgressLabel(phase: RunPhase, progressText: string): string {
  const progress = progressText.trim()
  if (progress) return progress
  if (phase === 'hitl') return '等待确认'
  if (phase === 'done') return '已完成'
  if (phase === 'input') return '待启动'
  return '执行中'
}

export function runStatusSummary(run: {
  phase: RunPhase
  log: string[]
  gateTitle: string | null
}): string {
  if (run.phase === 'hitl' && run.gateTitle) return `等待确认：${run.gateTitle}`
  const last = run.log.filter(Boolean).slice(-1)[0]
  return last || '根据本地工作流生成任务事实…'
}

export function runNextAction(run: { phase: RunPhase; gateTitle: string | null }): string {
  if (run.phase === 'hitl') {
    return run.gateTitle ? `请审阅并确认：${run.gateTitle}` : '需要人工确认后才能继续。'
  }
  if (run.phase === 'done') return '本轮已结束，可返回货架或再跑一次。'
  return '关注流程进度，按下方按钮继续。'
}

export function formatDaemonReview(raw: unknown): string {
  const result = asRecord(raw)
  const hint = String(result.hint || result.message || result.error || '').trim()
  const online = result.online
  const status = String(result.status || result.state || '').trim()
  const parts = [
    online === false ? '管线服务离线' : online === true ? '管线服务在线' : '',
    status ? `状态：${status}` : '',
    hint,
  ].filter(Boolean)
  return parts.join('\n') || '暂无管线详情。'
}
