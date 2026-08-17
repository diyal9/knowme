import { Icon } from '../../app/Icon'

export function DialogueStatusBar({
  mode,
  title,
  meta,
  state,
  stateTone,
  onBack,
  backLabel = '返回',
}: {
  mode: string
  title: string
  meta?: string
  state?: string
  stateTone?: string
  onBack: () => void
  backLabel?: string
}) {
  return (
    <header className="agent-dialogue-status-bar" aria-label="任务对话状态">
      <span className="agent-dialogue-status-mode" data-mode={mode}>{mode}</span>
      <span className="agent-dialogue-status-title" id="agentDialogueStatusTitle">{title}</span>
      {meta ? (
        <span className="agent-dialogue-status-meta" id="agentDialogueStatusMeta">{meta}</span>
      ) : (
        <span className="agent-dialogue-status-meta" id="agentDialogueStatusMeta" hidden />
      )}
      {state ? (
        <span
          className={`agent-dialogue-status-state${stateTone ? ` tone-${stateTone}` : ''}`}
          id="agentDialogueStatusState"
          role="status"
        >
          {state}
        </span>
      ) : (
        <span className="agent-dialogue-status-state" id="agentDialogueStatusState" hidden />
      )}
      <button type="button" className="wb-task-back" onClick={onBack} aria-label={backLabel}>
        <Icon name="chevronLeft" />
        <span>{backLabel}</span>
      </button>
    </header>
  )
}
