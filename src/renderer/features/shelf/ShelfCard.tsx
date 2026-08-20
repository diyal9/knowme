import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'

function ShelfBriefFlow({ labels }: { labels: string[] }) {
  const path = labels.length ? labels.join(' → ') : '按系统默认顺序调度'
  return (
    <span className="wb-shelf-brief-flow-text" title={path}>{path}</span>
  )
}

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
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
    >
      <div className="wb-shelf-card-top">
        <span className="wb-shelf-mark" aria-hidden="true">
          <Icon name={card.markIcon} />
        </span>
        <div className="wb-shelf-card-copy">
          <div className="wb-shelf-title-row">
            <h3>{card.name}</h3>
            <span className={`wb-shelf-badge wb-shelf-provenance wb-shelf-provenance-${card.provenanceKind}`}>
              {card.provenanceLabel}
            </span>
          </div>
          <p className="wb-shelf-outcome">{card.description}</p>
          <div className="wb-shelf-delivery" title={card.outcomeLabel}>
            <span><Icon name="clipboardCheck" /> 交付</span>
            <strong>{card.outcomeLabel}</strong>
          </div>
        </div>
      </div>
      <div className="wb-shelf-card-bottom">
        <div className="wb-shelf-brief">
          <div className="wb-shelf-brief-label">
            <span>协作路径</span>
            <span>{card.stepCount} 个节点</span>
          </div>
          <div className="wb-shelf-brief-flow" aria-label="简要流程">
            <ShelfBriefFlow labels={card.stepLabels} />
          </div>
        </div>
        <footer>
          <div className="wb-shelf-actions">
            <button
              type="button"
              className="wb-shelf-open"
              onClick={(e) => { e.stopPropagation(); onOpen() }}
            >
              <span>查看工作流</span>
              <Icon name="chevronRight" />
            </button>
          </div>
        </footer>
      </div>
    </article>
  )
}
