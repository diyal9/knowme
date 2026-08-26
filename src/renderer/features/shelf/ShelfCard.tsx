import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'

export function ShelfCard({
  card,
  onOpen,
}: {
  card: ShelfCardModel
  onOpen: () => void
}) {
  return (
    <article
      className={`wb-shelf-card${card.blocked ? ' blocked' : ''}`}
      role="button"
      tabIndex={0}
      data-flow-id={card.id}
      data-domain={card.domain}
      aria-label={`查看工作流：${card.name}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <div className="wb-shelf-card-top">
        <span className="wb-shelf-mark" aria-hidden="true">
          <Icon name={card.markIcon} />
        </span>
        <div className="wb-shelf-card-copy">
          <div className="wb-shelf-title-row">
            <h3>{card.name}</h3>
          </div>
          <div className="wb-shelf-card-sub" aria-label="工作流来源与节点数">
            <span className={`wb-shelf-badge wb-shelf-provenance wb-shelf-provenance-${card.provenanceKind}`}>
              {card.provenanceLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{card.stepCount} 个节点</span>
          </div>
        </div>
      </div>
      <div className="wb-shelf-delivery" title={card.outcomeLabel}>
        <span><Icon name="clipboardCheck" /> 交付</span>
        <strong>{card.outcomeLabel}</strong>
      </div>
      <div className="wb-shelf-card-summary" aria-label="工作流摘要">
        <span className="wb-shelf-card-detail">
          查看详情
          <Icon name="chevronRight" />
        </span>
      </div>
    </article>
  )
}
