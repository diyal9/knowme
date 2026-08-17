/** DOM-free helpers extracted from workbench-daemon-review.js */

const MAX_LOG_LINES = 200
const MAX_PROGRESS_CHARS = 12000

function text(value: unknown): string {
  return String(value == null ? '' : value).trim()
}

export function normalizeLogLines(raw: unknown, limit = MAX_LOG_LINES): string[] {
  const source = text(raw)
  if (!source || source === '(no log yet)') return []
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length <= limit) return lines
  return lines.slice(-limit)
}

export function normalizeProgressText(raw: unknown): string {
  let source = text(raw)
  if (!source || source === '(no progress yet)') return ''
  if (source.length > MAX_PROGRESS_CHARS) {
    source = `${source.slice(0, MAX_PROGRESS_CHARS)}\n…（摘要已截断）`
  }
  return source
}

export interface ProcessTranscript {
  progress: { text: string; empty: boolean; emptyLabel: string }
  logs: { lines: string[]; empty: boolean; emptyLabel: string }
}

export function projectProcessTranscript(input: {
  progressText?: unknown
  logsText?: unknown
  status?: unknown
} = {}): ProcessTranscript {
  const progressText = normalizeProgressText(input.progressText)
  const logLines = normalizeLogLines(input.logsText)
  const status = text(input.status)

  return {
    progress: {
      text: progressText,
      empty: !progressText,
      emptyLabel: '暂无过程摘要（任务运行后将自动生成）。',
    },
    logs: {
      lines: logLines,
      empty: !logLines.length,
      emptyLabel: status && ['done', 'finished', 'completed', 'success'].includes(status.toLowerCase())
        ? '任务已结束。日志可能未保留，请查看 progress 摘要或右侧制品。'
        : '（等待日志输出…）',
    },
  }
}

export interface DaemonGateInfo {
  node: string
  title: string
}

export function extractGateInfo(gate: Record<string, unknown> | null | undefined): DaemonGateInfo | null {
  if (!gate || typeof gate !== 'object') return null
  const node = text(gate.node || gate.node_id || gate.id)
  if (!node) return null
  return {
    node,
    title: text(gate.title || gate.label || node) || node,
  }
}
