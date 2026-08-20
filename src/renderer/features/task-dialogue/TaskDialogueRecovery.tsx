export function TaskDialogueRecovery({
  title,
  body,
  nextAction,
  onViewLogs,
  onRefresh,
  onRestart,
}: {
  title: string
  body: string
  nextAction: string
  onViewLogs: () => void
  onRefresh: () => void
  onRestart?: () => void
}) {
  return (
    <section className="task-dialogue-recovery" data-testid="pipeline-recovery" aria-live="polite">
      <header className="task-dialogue-recovery-head">
        <span className="task-dialogue-recovery-dot" aria-hidden="true" />
        <strong>{title}</strong>
      </header>
      <p>{body}</p>
      <div className="task-dialogue-recovery-next">
        <span>下一步</span>
        <strong>{nextAction}</strong>
      </div>
      <div className="task-dialogue-recovery-actions">
        <button type="button" onClick={onViewLogs}>查看过程日志</button>
        <button type="button" onClick={onRefresh}>重新检查状态</button>
        {onRestart ? <button type="button" className="is-emphasis" onClick={onRestart}>重新开始</button> : null}
      </div>
    </section>
  )
}
