/**
 * 管线任务房左栏发送计划：澄清 / gate 修改意见 / 本地回执。
 * 不负责专家房 LLM，不发起 HTTP。
 */

export type PipelineComposerPlan =
  | { kind: 'empty' }
  | { kind: 'llm' }
  | { kind: 'clarify'; node: string; answer: string }
  | { kind: 'gate-revise'; node: string; comment: string }
  | { kind: 'ack'; text: string }

const RUNNING_ACK = '已记下。当前节点仍在执行；待确认或待澄清时再发，会提交给管线。'

export function planPipelineComposerSend(input: {
  expertRoom?: boolean
  run?: {
    lane?: string
    clarifyNode?: string | null
    gateNode?: string | null
    phase?: string
  } | null
  text?: string
}): PipelineComposerPlan {
  const text = String(input.text || '').trim()
  if (input.expertRoom) {
    return text ? { kind: 'llm' } : { kind: 'empty' }
  }
  if (!input.run || !text) return { kind: 'empty' }
  if (input.run.lane !== 'pipeline') {
    return { kind: 'llm' }
  }
  const clarifyNode = String(input.run.clarifyNode || '').trim()
  if (clarifyNode) {
    return { kind: 'clarify', node: clarifyNode, answer: text }
  }
  const gateNode = String(input.run.gateNode || '').trim()
  if (gateNode && input.run.phase === 'hitl') {
    return { kind: 'gate-revise', node: gateNode, comment: text }
  }
  return { kind: 'ack', text: RUNNING_ACK }
}

export function pipelineComposerReceipt(plan: PipelineComposerPlan): string {
  if (plan.kind === 'clarify') return '已提交澄清答复。'
  if (plan.kind === 'gate-revise') return '已把修改意见提交给当前确认节点。'
  if (plan.kind === 'ack') return plan.text
  return ''
}
