export function WorkbenchListToggle({
  id,
  expanded,
  remaining,
  hidden,
  onToggle,
}: {
  id: string
  expanded: boolean
  remaining: number
  hidden?: boolean
  onToggle: () => void
}) {
  if (hidden) return null
  return (
    <button
      className="wb-list-toggle"
      id={id}
      type="button"
      aria-expanded={expanded}
      data-testid={id}
      onClick={onToggle}
    >
      <span className="wb-list-toggle-text">{expanded ? '收起' : `更多（${remaining}）`}</span>
      <span className="wb-list-toggle-mark" aria-hidden="true" />
    </button>
  )
}
