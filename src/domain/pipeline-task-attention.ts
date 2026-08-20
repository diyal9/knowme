export interface PipelineTaskAttentionInput {
  phase: 'input' | 'running' | 'hitl' | 'done'
  clarifyNode?: string | null
  daemonStatus?: string
  log?: string[]
  graphNodes?: { id: string; label?: string }[]
}

export interface PipelineTaskAttention {
  kind: 'clarification' | 'paused'
  title: string
  body: string
  nextAction: string
  statusLabel: string
  statusTone: 'waiting'
  composerPlaceholder?: string
  canClarify: boolean
  canRestart: boolean
}

const NEEDS_INPUT_RE = /NEED_INPUT|needs[_ -]?input|待人工|等待澄清|未收到澄清|需要补充/i
const PAUSED_RE = /paused|blocked|暂停|停止不前|超时/i

function clean(value: unknown): string {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nodeLabel(input: PipelineTaskAttentionInput, nodeId: string): string {
  const node = (input.graphNodes || []).find((item) => String(item.id || '').trim() === nodeId)
  return clean(node?.label) || nodeId
}

/**
 * 把 Daemon 的 NEED_INPUT / paused 事实投影成任务房可操作提示。
 * 原始 ALERT 与恢复命令只留在「过程日志」，不直接进入对话主线。
 */
export function projectPipelineTaskAttention(
  input: PipelineTaskAttentionInput,
): PipelineTaskAttention | null {
  if (input.phase === 'input' || input.phase === 'done') return null

  const clarifyNode = clean(input.clarifyNode)
  const latestLog = clean((input.log || []).filter(Boolean).slice(-4).join(' '))
  const status = clean(input.daemonStatus).toLowerCase()
  const hasInputSignal = Boolean(clarifyNode)
    || NEEDS_INPUT_RE.test(status)
    || NEEDS_INPUT_RE.test(latestLog)
  const paused = PAUSED_RE.test(status) || PAUSED_RE.test(latestLog)

  if (clarifyNode) {
    const step = nodeLabel(input, clarifyNode)
    return {
      kind: 'clarification',
      title: paused ? '任务已暂停，等待补充信息' : '任务正在等待补充信息',
      body: paused
        ? `步骤「${step}」等待补充信息超时，当前已暂停。`
        : `步骤「${step}」需要更多信息才能继续。`,
      nextAction: '在下方补充缺失信息或添加材料，发送后系统会提交答复并重新检查运行状态。',
      statusLabel: '等待补充',
      statusTone: 'waiting',
      composerPlaceholder: '补充缺失信息，发送后继续任务… @ 选文件',
      canClarify: true,
      canRestart: false,
    }
  }

  if (hasInputSignal || paused) {
    return {
      kind: 'paused',
      title: '任务已暂停',
      body: '管线没有继续推进，且当前没有可直接提交的澄清节点。',
      nextAction: '先重新检查状态；如果仍无变化，可重新开始本次任务。原始原因可在右侧「过程日志」查看。',
      statusLabel: '需要处理',
      statusTone: 'waiting',
      canClarify: false,
      canRestart: true,
    }
  }

  return null
}
