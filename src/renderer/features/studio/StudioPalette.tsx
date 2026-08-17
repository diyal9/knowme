import { useMemo, useState } from 'react'
import { studioIconForKind, studioPaletteTypes } from '../../../domain/studio-canvas'
import { Icon } from '../../app/Icon'

type Props = {
  onPickKind: (kind: string) => void
}

export function StudioPalette({ onPickKind }: Props) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; items: ReturnType<typeof studioPaletteTypes> }>()
    const q = query.trim().toLowerCase()
    for (const item of studioPaletteTypes()) {
      if (q) {
        const hay = `${item.title} ${item.hint} ${item.kind}`.toLowerCase()
        if (!hay.includes(q)) continue
      }
      const id = item.group || 'default'
      const existing = map.get(id)
      if (existing) existing.items.push(item)
      else map.set(id, { id, title: item.groupTitle || '组件', items: [item] })
    }
    return [...map.values()]
  }, [query])

  return (
    <>
      <input
        className="wb-studio-search"
        type="search"
        placeholder="搜索节点"
        aria-label="搜索节点组件"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="wb-studio-palette" id="wbStudioPalette" aria-label="节点组件" data-testid="studio-palette">
        {groups.length === 0 ? (
          <p className="empty">没有匹配的组件</p>
        ) : groups.map((section) => (
          <section key={section.id} className="wb-studio-palette-section" aria-label={section.title}>
            <div className="wb-studio-palette-section-title">{section.title}</div>
            <div className="wb-studio-palette-col">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`wb-studio-palette-item kind-${item.kind}`}
                  data-studio-palette={item.kind}
                  title={item.hint}
                  data-testid={item.kind === 'agent' ? 'studio-add-node' : `studio-palette-${item.kind}`}
                  onClick={() => onPickKind(item.kind)}
                >
                  <span className="wb-studio-palette-glyph" aria-hidden="true">
                    <Icon name={studioIconForKind(item.kind)} />
                  </span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
