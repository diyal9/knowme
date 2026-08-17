import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'

function ShelfBriefFlow({ labels }: { labels: string[] }) {
  if (!labels.length) {
    return (
      <span className="wb-workflow-manage-flow-step" title="按系统默认顺序调度">
        按系统默认顺序调度
      </span>
    )
  }
  return (
    <>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index ? <span className="wb-workflow-manage-flow-sep" aria-hidden="true">→</span> : null}
          <span className="wb-workflow-manage-flow-step" title={label}>{label}</span>
        </span>
      ))}
    </>
  )
}

export function ShelfCard({
  card,
  onStart,
}: {
  card: ShelfCardModel
  onStart: () => void
}) {
  return (
    <article
      className={`wb-shelf-card${card.blocked ? ' blocked' : ''}`}
      role="button"
      tabIndex={0}
      data-flow-id={card.id}
      data-domain={card.domain}
      aria-label={`打开工作流对话：${card.name}`}
      onClick={onStart}
      onKeyDown={(e) => { if (e.key === 'Enter') onStart() }}
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
          <ul className="wb-shelf-chips" aria-label="工作流摘要">
            <li className="wb-shelf-chip" title={card.inputLabel}>
              <span className="wb-shelf-chip-k">输入</span>
              <span className="wb-shelf-chip-v">{card.inputLabel}</span>
            </li>
            <li className="wb-shelf-chip" title={card.outcomeLabel}>
              <span className="wb-shelf-chip-k">产出</span>
              <span className="wb-shelf-chip-v">{card.outcomeLabel}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="wb-shelf-card-bottom">
        <div className="wb-shelf-brief">
          <div className="wb-shelf-brief-label">简要流程</div>
          <div className="wb-shelf-brief-flow" aria-label="简要流程">
            <ShelfBriefFlow labels={card.stepLabels} />
          </div>
        </div>
        <footer>
          <div className="wb-shelf-meta">
            <span className="wb-shelf-steps">{card.stepCount} 步</span>
          </div>
          <div className="wb-shelf-actions">
            <button
              type="button"
              className="wb-shelf-icon-btn is-primary"
              title="开始运行"
              aria-label="开始运行"
              onClick={(e) => { e.stopPropagation(); onStart() }}
            >
              <Icon name="play" />
            </button>
          </div>
        </footer>
      </div>
    </article>
  )
}
