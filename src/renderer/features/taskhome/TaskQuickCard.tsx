import type { CSSProperties } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import {
  expertCardTitle,
  expertQuickBadge,
  expertQuickSub,
  expertQuickVersion,
} from '../../../domain/expert-present'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

export function TaskQuickCard({
  item,
  index,
  selected,
  onOpen,
}: {
  item: CapabilityItem
  index: number
  selected?: boolean
  onOpen: () => void
}) {
  const title = expertCardTitle(item)
  const badge = expertQuickBadge(item)
  const desc = item.description || '安排这位专家协作'

  return (
    <button
      type="button"
      className={`wb-task-quick-card wb-studio-expert-pick-card${selected ? ' is-selected' : ''}`}
      style={{ '--index': index } as CSSProperties}
      aria-label={`查看专家 ${title}`}
      onClick={onOpen}
    >
      <div className="wb-task-quick-head">
        <ExpertAvatarMark agent={item} className="wb-task-quick-icon" size={38} />
        <div className="wb-task-quick-meta">
          <div className="wb-task-quick-title">{title}</div>
          <div className="wb-task-quick-sub">{expertQuickSub(item)}</div>
        </div>
      </div>
      <p className="wb-task-quick-desc">{desc}</p>
      <div className="wb-task-quick-foot">
        <div className="wb-task-quick-badges">
          <span className={`wb-task-quick-badge${badge.installed ? ' installed' : ''}`}>{badge.text}</span>
        </div>
        <span className="wb-task-quick-version">v{expertQuickVersion(item)}</span>
      </div>
    </button>
  )
}
