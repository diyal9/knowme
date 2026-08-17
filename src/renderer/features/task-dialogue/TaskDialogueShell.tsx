/**
 * 任务房左栏壳：日志区 + 底部 composer。
 * 流式时把滚动钉在底部，避免新 token 把阅读位置顶走。
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { AgentComposer } from '../assistant/AgentComposer'

export function TaskDialogueShell({
  variant,
  launch,
  label,
  testId,
  logTestId,
  composerExtraClass,
  children,
}: {
  variant: 'expert' | 'workflow' | 'pipeline'
  launch: boolean
  label: string
  testId?: string
  logTestId: string
  composerExtraClass?: string
  children: ReactNode
}) {
  const logRef = useRef<HTMLDivElement>(null)
  const variantClass = variant === 'expert'
    ? 'is-expert-collab'
    : variant === 'pipeline'
      ? 'is-pipeline-dialogue'
      : 'is-workflow-dialogue'

  useLayoutEffect(() => {
    if (launch) return
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [children, launch])

  return (
    <aside
      className={`agent-col ${variantClass}${launch ? ' agent-launch-state' : ''}`}
      id="agentCol"
      data-testid={testId}
      aria-label={label}
    >
      <div className="agent-chat-log" id="agentChatLog" data-testid={logTestId} ref={logRef}>
        {children}
      </div>
      {launch ? null : (
        <div className="agent-col-foot">
          <AgentComposer extraClass={composerExtraClass} surface="workbench" />
        </div>
      )}
    </aside>
  )
}
