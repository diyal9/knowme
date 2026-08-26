export function WorkbenchListToggle({
  id,
  expanded,
  remaining,
  label,
  hidden,
  onToggle,
}: {
  id: string
  expanded: boolean
  remaining: number
  label?: string
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
      <span className="wb-list-toggle-text">{expanded ? '收起' : label ? `${label} ${remaining} 条` : `更多（${remaining}）`}</span>
      <span className="wb-list-toggle-mark" aria-hidden="true" />
    </button>
  )
}
