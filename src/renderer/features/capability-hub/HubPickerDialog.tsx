import { useEffect, useMemo, useState } from 'react'
import {
  applyVisibleCatalogBulk,
  filterHubCatalogItems,
  groupHubCatalogItems,
  type HubCatalogFieldSpec,
} from '../../../domain/hub-catalog-fields'
import { Icon } from '../../app/Icon'

type Props = {
  spec: HubCatalogFieldSpec
  onClose: () => void
  onApply: (ids: string[]) => void
}

export function HubPickerDialog({ spec, onClose, onApply }: Props) {
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [selected, setSelected] = useState<string[]>(() => [...spec.selected])
  const browse = spec.items.length > 9

  const visible = useMemo(
    () => filterHubCatalogItems(spec.items, query, selectedOnly, selected),
    [query, selected, selectedOnly, spec.items],
  )
  const groups = useMemo(() => groupHubCatalogItems(visible, browse), [browse, visible])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div className="hub-dialog-mask hub-picker-mask" data-testid="hub-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="hubPickerTitle">
      <div className="hub-dialog hub-picker-dialog">
        <div className="hub-dialog-head">
          <div>
            <span className="hub-section-kicker">Catalog</span>
            <h2 id="hubPickerTitle">{spec.dialogTitle}</h2>
            <p id="hubPickerDesc">{spec.hint}</p>
          </div>
          <button type="button" className="hub-icon-btn" aria-label="关闭" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="hub-dialog-body" id="hubPickerBody">
          <div className="hub-picker-panel" data-picker={spec.name}>
            <header className="hub-picker-panel-head">
              <div className="hub-picker-tools">
                <button
                  type="button"
                  className="hub-mini-btn"
                  onClick={() => setSelected((prev) => applyVisibleCatalogBulk(prev, visible.map((item) => item.id), true))}
                >
                  全选
                </button>
                <button
                  type="button"
                  className="hub-mini-btn"
                  onClick={() => setSelected((prev) => applyVisibleCatalogBulk(prev, visible.map((item) => item.id), false))}
                >
                  清空
                </button>
              </div>
            </header>
            {browse ? (
              <div className="hub-picker-controls">
                <input
                  type="search"
                  className="hub-picker-search"
                  placeholder={`搜索 ${spec.items.length} 个${spec.unit}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={`搜索${spec.title}`}
                />
                <button
                  type="button"
                  className="hub-mini-btn hub-toggle-mini"
                  aria-pressed={selectedOnly}
                  onClick={() => setSelectedOnly((value) => !value)}
                >
                  仅看已选
                </button>
              </div>
            ) : null}
            {spec.items.length === 0 ? (
              <div className="hub-picker-empty"><p>{spec.emptyLabel}</p></div>
            ) : (
              <div className="hub-check-scroll">
                {groups.map((group) => (
                  <div key={group.key || 'all'} className={group.key ? 'hub-check-subgroup' : undefined}>
                    {group.key ? <h4>{group.key}<span>{group.items.length}</span></h4> : null}
                    <div className="hub-check-grid">
                      {group.items.map((item) => (
                        <label key={item.id} className="hub-check">
                          <input
                            type="checkbox"
                            checked={selected.includes(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                          <span className="hub-check-box" aria-hidden="true" />
                          <span className="hub-check-text">
                            <strong>{item.name}</strong>
                            {item.category && item.category !== item.name ? <em>{item.category}</em> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {visible.length === 0 ? <p className="hub-picker-none">没有匹配的{spec.unit}</p> : null}
              </div>
            )}
          </div>
        </div>
        <div className="hub-dialog-foot">
          <span className="hub-dialog-foot-hint" id="hubPickerSummary" aria-live="polite">
            已选 {selected.length} {spec.unit}
          </span>
          <div className="hub-dialog-foot-actions">
            <button type="button" className="hub-btn" id="hubPickerCancel" onClick={onClose}>取消</button>
            <button type="button" className="hub-btn primary" id="hubPickerApply" onClick={() => onApply(selected)}>完成</button>
          </div>
        </div>
      </div>
    </div>
  )
}
