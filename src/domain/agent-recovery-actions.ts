/**
 * 运行阻塞/失败 → 下一步动作。UI 只展示推荐 1 项 + 最多 2 个备选。
 */

export type RecoveryKind = 'waiting_input' | 'waiting_approval' | 'waiting_child' | 'timeout' | 'permission' | 'protocol' | 'evidence' | 'cancelled' | 'failed'

export type RecoveryAction = {
  id: string
  label: string
  hint: string
}

export type RecoveryView = {
  kind: RecoveryKind
  title: string
  estimatedWait: string
  recommended: RecoveryAction
  alternatives: RecoveryAction[]
}

const ACTIONS: Record<string, RecoveryAction> = {
  provide_input: { id: 'provide_input', label: '补充输入', hint: '按提示补全后再继续' },
  review_draft: { id: 'review_draft', label: '审阅草稿', hint: '通过或驳回后才会继续' },
  wait_children: { id: 'wait_children', label: '等待子任务', hint: '子 Run 结束后自动汇总' },
  retry: { id: 'retry', label: '重试', hint: '用同一后端再跑一轮' },
  degrade_local: { id: 'degrade_local', label: '降级本地', hint: '切到本地执行并保留审计' },
  switch_backend: { id: 'switch_backend', label: '切换后端', hint: '换一条可用链路' },
  converge: { id: 'converge', label: '收敛上下文', hint: '缩短上下文后再试' },
  cancel: { id: 'cancel', label: '取消', hint: '停止本轮并保留已有产物' },
}

export function classifyRecovery(input: {
  status?: string
  type?: string
  code?: string
  recommendedAction?: string
}): RecoveryKind {
  const blob = `${input.status || ''} ${input.type || ''} ${input.code || ''} ${input.recommendedAction || ''}`.toLowerCase()
  if (/waiting_approval|review_draft/.test(blob)) return 'waiting_approval'
  if (/waiting_input|provide_input|needs_input/.test(blob)) return 'waiting_input'
  if (/waiting_child|wait_children/.test(blob)) return 'waiting_child'
  if (/timeout/.test(blob)) return 'timeout'
  if (/scope_denied|permission|unauthorized/.test(blob)) return 'permission'
  if (/protocol|incompatible/.test(blob)) return 'protocol'
  if (/evidence/.test(blob)) return 'evidence'
  if (/cancel/.test(blob)) return 'cancelled'
  return 'failed'
}

export function buildRecoveryView(input: {
  status?: string
  type?: string
  code?: string
  recommendedAction?: string
  estimatedWait?: string
}): RecoveryView {
  const kind = classifyRecovery(input)
  const estimatedWait = String(input.estimatedWait || '').trim()
  if (kind === 'waiting_approval') {
    return {
      kind, title: '等待审阅', estimatedWait: estimatedWait || '1-5m',
      recommended: ACTIONS.review_draft, alternatives: [ACTIONS.retry, ACTIONS.cancel],
    }
  }
  if (kind === 'waiting_input') {
    return {
      kind, title: '等待补充输入', estimatedWait: estimatedWait || '30-120s',
      recommended: ACTIONS.provide_input, alternatives: [ACTIONS.retry, ACTIONS.cancel],
    }
  }
  if (kind === 'waiting_child') {
    return {
      kind, title: '等待子任务', estimatedWait: estimatedWait || '30-180s',
      recommended: ACTIONS.wait_children, alternatives: [ACTIONS.cancel],
    }
  }
  if (kind === 'timeout') {
    return {
      kind, title: '远程超时', estimatedWait: estimatedWait || '',
      recommended: ACTIONS.retry, alternatives: [ACTIONS.degrade_local, ACTIONS.switch_backend],
    }
  }
  if (kind === 'permission') {
    return {
      kind, title: '权限不足', estimatedWait: '',
      recommended: ACTIONS.converge, alternatives: [ACTIONS.cancel],
    }
  }
  if (kind === 'protocol') {
    return {
      kind, title: '协议不兼容', estimatedWait: '',
      recommended: ACTIONS.switch_backend, alternatives: [ACTIONS.degrade_local, ACTIONS.cancel],
    }
  }
  if (kind === 'evidence') {
    return {
      kind, title: '证据不足', estimatedWait: '',
      recommended: ACTIONS.converge, alternatives: [ACTIONS.retry, ACTIONS.cancel],
    }
  }
  return {
    kind, title: kind === 'cancelled' ? '已取消' : '运行失败', estimatedWait: '',
    recommended: ACTIONS.retry, alternatives: [ACTIONS.degrade_local, ACTIONS.cancel],
  }
}

export function redactPreviewFields(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((item) => redactPreviewFields(item, depth + 1))
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/token|authorization|password|secret|apikey|api_key|credential/i.test(key)) out[key] = '[REDACTED]'
    else out[key] = redactPreviewFields(nested, depth + 1)
  }
  return out
}
