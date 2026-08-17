import {
  hubCatalogSelectedChips,
  type HubCatalogFieldSpec,
} from '../../../domain/hub-catalog-fields'

type Props = {
  field: HubCatalogFieldSpec
  onOpen: () => void
  onEmptyAction?: () => void
}

export function HubCatalogSummary({ field, onOpen, onEmptyAction }: Props) {
  const chips = hubCatalogSelectedChips(field.items, field.selected)
  const empty = field.items.length === 0
  return (
    <section className="hub-expert-section hub-catalog-summary" data-picker={field.name}>
      <header className="hub-expert-section-head">
        <div>
          <h3>
            {field.title}
            <span className={`hub-picker-count${field.selected.length ? ' active' : ''}`}>
              {field.selected.length}/{field.items.length}
            </span>
          </h3>
          <p>{field.hint}</p>
        </div>
        {empty ? null : (
          <button
            type="button"
            className="hub-btn"
            data-testid={`hub-open-picker-${field.key}`}
            onClick={onOpen}
          >
            {field.selectLabel}
          </button>
        )}
      </header>
      {empty ? (
        <div className="hub-picker-empty">
          <p>{field.emptyLabel}</p>
          {field.emptyAction && onEmptyAction ? (
            <button type="button" className="hub-mini-btn" onClick={onEmptyAction}>
              {field.emptyAction.label}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="hub-catalog-chips">
          {chips.empty ? (
            <span className="hub-catalog-placeholder">尚未选择，点右侧按钮打开列表</span>
          ) : (
            <>
              {chips.chips.map((chip) => (
                <span key={chip.id} className="hub-catalog-chip">{chip.name}</span>
              ))}
              {chips.extra > 0 ? <span className="hub-catalog-chip more">+{chips.extra}</span> : null}
            </>
          )}
        </div>
      )}
    </section>
  )
}
