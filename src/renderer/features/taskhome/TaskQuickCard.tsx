import type { CSSProperties } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import {
  expertCardTitle,
  expertQuickSub,
} from '../../../domain/expert-present'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

export function TaskQuickCard({
  item,
  index,
  selected,
  onStart,
  onDetail,
  onOpen,
}: {
  item: CapabilityItem
  index: number
  selected?: boolean
  onStart?: () => void
  onDetail?: () => void
  onOpen?: () => void
}) {
  const title = expertCardTitle(item)
  const desc = item.description || '安排这位专家协作'
  const body = (
    <>
      <div className="wb-task-quick-head">
        <ExpertAvatarMark agent={item} className="wb-task-quick-icon" size={38} />
        <div className="wb-task-quick-meta">
          <div className="wb-task-quick-title">{title}</div>
          <div className="wb-task-quick-sub">{expertQuickSub(item)}</div>
        </div>
      </div>
      <p className="wb-task-quick-desc">{desc}</p>
    </>
  )

  if (onOpen) {
    return (
      <button type="button" className={`wb-task-quick-card wb-studio-expert-pick-card${selected ? ' is-selected' : ''}`} style={{ '--index': index } as CSSProperties} aria-label={`查看专家 ${title}`} onClick={onOpen}>
        {body}
        <div className="wb-task-quick-foot"><span className="wb-task-quick-badge installed">选择专家</span><span className="wb-task-quick-version">单专家任务</span></div>
      </button>
    )
  }

  return (
    <article
      className={`wb-task-quick-card wb-studio-expert-pick-card${selected ? ' is-selected' : ''}`}
      style={{ '--index': index } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`查看专家 ${title}`}
      onClick={() => onDetail?.()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
        event.preventDefault()
        onDetail?.()
      }}
    >
      {body}
      <div className="wb-task-quick-foot">
        <button
          type="button"
          className="wb-task-quick-start"
          aria-label={`向${title}发起快捷任务`}
          onClick={(event) => { event.stopPropagation(); onStart?.() }}
        >
          快捷任务
        </button>
      </div>
    </article>
  )
}
