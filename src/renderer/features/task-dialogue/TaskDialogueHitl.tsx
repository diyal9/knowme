export function TaskDialogueHitl({
  nextAction,
  gateTitle,
  onReject,
  onAccept,
}: {
  nextAction: string
  gateTitle: string | null
  onReject: () => void
  onAccept: () => void
}) {
  return (
    <article className="agent-workflow-hitl" data-testid="run-hitl-actions" aria-label="等待确认">
      <div className="wb-run-next-label">你现在要做什么</div>
      <div className="wb-run-next-action">{nextAction}</div>
      <p>{gateTitle ? `需要确认：${gateTitle}` : '需要确认后继续（人工门禁）。'}</p>
      <div className="wb-runner-actions">
        <button type="button" className="wb-modal-btn" onClick={onReject}>拒绝</button>
        <button type="button" className="wb-modal-btn primary" onClick={onAccept}>确认</button>
      </div>
    </article>
  )
}
