export type DaemonProcessTranscript = {
  tip?: string
  progress?: {
    title?: string
    text?: string
    empty?: boolean
    emptyLabel?: string
  }
  logs?: {
    title?: string
    lines?: string[]
    empty?: boolean
    emptyLabel?: string
  }
}

export type DaemonProgressCard = {
  kind: 'chat-progress'
  title?: string
  currentLabel?: string
  statusLabel?: string
  progressLine?: string
  ratio?: number
  tip?: string
  done?: boolean
}

export function buildDaemonProcessTranscript(
  status: string,
  lines: string[],
  progressText = '',
): DaemonProcessTranscript | null {
  const tip = String(status || '').trim()
  const logLines = lines.filter(Boolean)
  const progress = String(progressText || '').trim()
  if (!tip && !logLines.length && !progress) return null
  return {
    tip,
    progress: {
      title: '过程',
      text: progress,
      empty: !progress,
      emptyLabel: '暂无过程摘要，生成完成后会显示关键步骤。',
    },
    logs: {
      title: '运行日志',
      lines: logLines,
      empty: !logLines.length,
      emptyLabel: '等待 daemon 过程输出…',
    },
  }
}

export function daemonProgressRatio(nodes: { status?: string }[]): number {
  if (!nodes.length) return 0
  const done = nodes.filter((node) => {
    const value = String(node.status || '').toLowerCase()
    return ['done', 'completed', 'finished', 'success', 'approved'].includes(value)
  }).length
  return Math.round((done / nodes.length) * 100)
}

export function buildDaemonProgressCard(
  status: string,
  ratio = 0,
): DaemonProgressCard | null {
  const tip = String(status || '').trim()
  if (!tip) return null
  const done = /完成|失败|已停止/.test(tip)
  return {
    kind: 'chat-progress',
    title: '管线进度',
    currentLabel: '管线任务',
    statusLabel: done ? (tip.includes('失败') ? '失败' : '已完成') : '进行中',
    progressLine: tip,
    ratio: done ? 100 : Math.max(ratio, 8),
    tip: done ? '' : tip,
    done,
  }
}
